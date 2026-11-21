/**
 * Card room, the table (2026-10-23): the pure part of components/tabletop/TtTable.vue. A port of the design
 * lab's working Card room page. No Vue, no DOM.
 *
 * The table's state comes from composables/useTtTable.js; this file only turns it into what the
 * Card room draws: the seeded pile tilt, the segmented held bar, the box-score header, the ledger's
 * figures and the chip labels.
 */
import { ttFilter, ttRarityLadder, ttSetsOf } from './core.js'

// Big Shoulders Display (counts and labels), Inter Tight (text), JetBrains Mono (figures)
export const CR_FONTS = 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500..900&family=Inter+Tight:wght@400..700&family=JetBrains+Mono:wght@400..700&display=swap'
export const CR_GAP = 6
// The lab page opened a laptop at 176 (two steps up), a phone at 111 (three across)
export const CR_DEFAULT_W = Object.freeze({ phone: 111, laptop: 176 })
export const CR_LAPTOP = '(min-width: 900px)'
export const CR_EASE = Object.freeze({
  out: 'cubic-bezier(.2,.8,.2,1)', in: 'cubic-bezier(.4,0,1,1)', end: 'cubic-bezier(0,0,.2,1)', settle: 'cubic-bezier(.4,0,.2,1)',
})

// ── Piles: tilted, seeded ───────────────────────────────────────────────────────
// FNV-1a then mulberry32, four values in [-1, 1]: the cover's and three edges'. The cover always
// sits a little askew (at least .6 of its tilt). The same key gives the same pile on every device.
export function crSeeds(key) {
  let h = 2166136261
  const s = String(key == null ? '' : key)
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  const out = []
  for (let k = 0; k < 4; k++) {
    h += 0x6D2B79F5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    out.push((((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1)
  }
  if (Math.abs(out[0]) < 0.35) out[0] = out[0] < 0 ? -0.6 : 0.6
  return out
}

export const CR_REST = Object.freeze({ r: 0, a: 0, b: 0 })

// Layer k of a pile (0 the cover): the cover turns up to 1.2 deg; edge k up to 2.5 deg, 2 px aside
// and k x 2 px up, so three edges show as a fanned corner.
export function crLayer(k, sd) {
  return k === 0 ? { r: sd[0] * 1.2, a: 0, b: 0 } : { r: sd[k] * 2.5, a: sd[k] * 2, b: -k * 2 }
}

// A card's own toss while it flies out of a pile (riffle) or into one (gather)
export function crCardTilt(id) {
  const sd = crSeeds(id)
  return { r: sd[1] * 4, a: sd[2] * 3, b: 0 }
}

export function crTransform(x, y, t = CR_REST) {
  return `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${t.r.toFixed(2)}deg) translate(${t.a.toFixed(1)}px,${t.b.toFixed(1)}px)`
}

// The paper edges under a stack of printing cards, one per doubling of its count, 6 at most (as the approved design
// draws them)
export function crPrintEdges(n) {
  const c = Number(n) || 0
  return c <= 1 ? 0 : Math.min(6, Math.ceil(Math.log2(c)))
}

// The pile's layers in paint order (deepest edge first, the cover last), up to four cards. With o.edges (the cards
// print) the pile is a straight stack instead: the first card in the table's order flat on top, and edges the
// paper edges under it, deepest first (crPrintEdges(n) down to 1); without it, edges is empty
export function crPile(groupId, cards, o = {}) {
  const list = Array.isArray(cards) ? cards : []
  if (o.edges) {
    const e = crPrintEdges(list.length)
    return {
      layers: list.length ? [{ card: list[0], k: 0, t: CR_REST, transform: '' }] : [],
      edges: Array.from({ length: e }, (_, i) => e - i), cover: CR_REST, coverTransform: '',
    }
  }
  const sd = crSeeds(groupId)
  const top = list.slice(0, 4)
  const out = []
  for (let k = top.length - 1; k >= 0; k--) {
    const t = crLayer(k, sd)
    out.push({ card: top[k], k, t, transform: crTransform(0, 0, t) })
  }
  return { layers: out, edges: [], cover: crLayer(0, sd), coverTransform: crTransform(0, 0, crLayer(0, sd)) }
}

// ── The segmented held bar ──────────────────────────────────────────────────────
// One segment per number for a set of 12 or fewer (each lit when that number is held), else twelve
// segments filled to the share held. Returns the inline style the .tt-bar reads.
export function crBar({ held = 0, total = null, nums = null } = {}) {
  const T = Number(total)
  if (!Number.isFinite(T) || T <= 0) return null
  if (T <= 12 && nums) {
    const P = 100 / T
    const parts = []
    for (let i = 1; i <= T; i++) parts.push(`${nums.has(i) ? 'var(--chrome)' : 'var(--line-2)'} ${((i - 1) * P).toFixed(3)}% ${(i * P).toFixed(3)}%`)
    return { '--n': T, background: `linear-gradient(90deg,${parts.join(',')})` }
  }
  const p = (Math.max(0, Math.min(T, Number(held) || 0)) / T * 100).toFixed(3)
  return { '--n': Math.min(12, T), background: `linear-gradient(90deg,var(--chrome) ${p}%,var(--line-2) ${p}%)` }
}

// Held numbers per set across the whole collection (the bar lights the numbers you have). The number
// is card.number in the card's own set and card.numbers[id] in each other set it files under (1.2.0:
// a quest numbers its places by the type's index in it); unset, only the own set's number counts.
export function crHeldNumbers(cards) {
  const m = new Map()
  const add = (set, n) => {
    if (n == null) return
    if (!m.has(set)) m.set(set, new Set())
    m.get(set).add(Number(n))
  }
  for (const c of cards || []) {
    if (!c || c.held === false) continue
    add(c.set, c.number)
    if (c.numbers) for (const id of ttSetsOf(c)) if (id !== c.set) add(id, c.numbers[id])
  }
  return m
}

const appOf = (data, id) => (data.apps || []).find(a => a.id === id) || null
const setOf = (data, id) => (data.sets || []).find(s => s.id === id) || null
const topWords = data => new Set(ttRarityLadder(data.rarities).filter(r => r.top).map(r => r.word))

/**
 * The box-score header of a group (ttGroup's output). Returns
 * { name, sub, n, of, unit, shown, gold, color, bar, label }:
 * - set: the short word, the full name under it, held of total, the segmented bar, "3 SHOWN" when a
 *   filter hides some, and `pts` when the set meta has points; app: name, held and HELD; rarity: the word (gold on top) and the count;
 *   opts.missingOnly (the table under Missing alone): "N SHOWN" only when a filter hides some of the gaps;
 *   kind: the chip label, its row on the page ("Eat & drink") as the sub line, the count, its color.
 */
export function crHead(group, data = {}, heldNums = null, { missingOnly = false } = {}) {
  const g = group || {}
  const shownOf = visHeld => (missingOnly ? (g.reduced ? g.shown : null) : visHeld < g.held ? visHeld : null)
  if (g.kind === 'set') {
    const s = setOf(data, g.id.replace(/^set:/, '')) || {}
    const short = s.short || g.short || g.label || ''
    const name = s.name || g.label || ''
    const visHeld = (g.cards || []).filter(c => c.held !== false).length
    const app = appOf(data, s.app || g.app)
    const nums = heldNums ? heldNums.get(s.id) : null
    return {
      name: short, sub: name.toUpperCase() === String(short).toUpperCase() ? '' : name, n: g.held, of: g.total, unit: null,
      shown: shownOf(visHeld), gold: false, color: app ? app.color : 'var(--chrome-3)',
      bar: crBar({ held: g.held, total: g.total, nums: nums || new Set() }), label: name,
      // The set's points (set meta `pts`), only when the set has them, so other heads keep their shape
      ...(s.pts != null && Number.isFinite(Number(s.pts)) ? { pts: Number(s.pts) } : {}),
    }
  }
  if (g.kind === 'app') {
    const a = appOf(data, g.app || g.id.replace(/^app:/, '')) || {}
    const visHeld = (g.cards || []).filter(c => c.held !== false).length
    return { name: a.name || g.label, sub: '', n: g.held, of: null, unit: 'HELD', shown: shownOf(visHeld), gold: false, color: a.color || 'var(--chrome-3)', bar: null, label: a.name || g.label }
  }
  if (g.kind === 'rarity') {
    const gold = g.top != null ? !!g.top : topWords(data).has(g.label)
    return { name: g.label, sub: '', n: g.shown, of: null, unit: null, shown: null, gold, color: gold ? 'var(--gold)' : 'var(--chrome-3)', bar: null, label: g.label }
  }
  if (g.kind === 'kind') {
    const first = (g.cards || [])[0]
    return { name: g.label, sub: g.groupLabel && g.groupLabel !== g.label ? g.groupLabel : '', n: g.shown, of: null, unit: null, shown: null, gold: false, color: (first && first.accent) || 'var(--chrome-3)', bar: null, label: g.label }
  }
  return { name: 'All', sub: '', n: g.shown, of: null, unit: null, shown: null, gold: false, color: 'var(--chrome-3)', bar: null, label: 'All' }
}

/**
 * The ledger: one column per group of the table's first grouping (sets for the Viewer, kinds for
 * the Selection), over the whole collection so the columns hold still while filters change.
 * columns: ttGroup over the collection; present: group ids in the shown table. A column is off when
 * the shown table has none of it. fig(group) may replace the figures ({ n, of }), for example the
 * Selection's cards in hand of the kind.
 */
export function crLedger(columns, present, data = {}, heldNums = null, fig = null) {
  return (columns || []).map((g) => {
    const h = crHead(g, data, heldNums)
    const f = typeof fig === 'function' ? fig(g) : null
    const n = f && f.n != null ? f.n : h.n
    const of = f && 'of' in f ? f.of : h.of
    return {
      id: g.id, key: g.id.replace(/^[a-z]+:/, ''), name: h.name, color: h.color, n, of,
      bar: f ? crBar({ held: n, total: of }) : h.bar, off: !present.has(g.id), label: h.label,
    }
  })
}

// ── Chips ───────────────────────────────────────────────────────────────────────
// A chip's label and value: "Set" alone, "Set Broadway" with one picked, "Set 2" with two
const titleCase = s => String(s || '').toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase())
export function crChip(facet, picked, facets = {}, data = {}) {
  const list = Array.isArray(picked) ? picked : []
  const name = { from: 'From', set: 'Set', rarity: 'Rarity', kind: 'Kind', interests: 'Interests' }[facet] || facet
  if (!list.length) return { name, value: '', on: false }
  if (list.length > 1) return { name, value: String(list.length), on: true }
  const id = String(list[0])
  if (facet === 'set') {
    const s = setOf(data, id)
    return { name, value: s ? titleCase(s.short || s.name) : id, on: true }
  }
  const opt = (facets[facet] || []).find(o => String(o.id) === id)
  return { name, value: opt ? opt.label : id, on: true }
}

// Missing: the unheld cards of started sets, the chip's figure
export function crMissingCount(cards) {
  return ttFilter(cards, { missing: 'only' }).length
}

// The popover's kind options in their rows on the page ("Things to do", "Eat & drink")
export function crKindRows(options) {
  const rows = []
  for (const o of options || []) {
    const key = o.group || ''
    let r = rows.find(x => x.key === key)
    if (!r) { r = { key, label: o.groupLabel || '', options: [] }; rows.push(r) }
    r.options.push(o)
  }
  return rows
}
