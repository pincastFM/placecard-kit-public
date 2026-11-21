/**
 * Tabletop core: the mechanics every table shares, whichever direction is picked (2026-10-23).
 * Pure JS: no Vue, no DOM, no fetch, no storage.
 *
 * Cards are the tabletop card shape (NYID's utils/tabletop/adapters.js builds them). `data` is the collection:
 * { apps, sets, rarities, cards }. The usual pipeline for one render:
 *   shown = ttSort(ttFilter(data.cards, filter), sort, data)
 *   groups = ttGroup(shown, by, { ...data, filter })
 *   label = ttCountLabel(ttCounts(shown), filter.missing)
 */

// ── Slider ──────────────────────────────────────────────────────────────────────
// Natural stops (px of card width). They land on the face tiers on purpose: 111 the tile, 150 the
// medium card, 176 the medium card a step up, 240 the full card.
export const TT_STOPS = [111, 150, 176, 240]
export const TT_MAX_W = 420 // one card filling a phone's width, capped
export const TT_LAPTOP_MIN = 96 // the smallest card on a laptop
export const TT_SNAP = 0.05 // a release within 5 percent of the track snaps to a stop

// Motion (ms), the same in every direction; the easing curves are the direction's tokens
export const TT_MOTION = {
  bloom: 560, flipOut: 230, flipIn: 290, fileIn: 420, snap: 160, step: 200,
  reduced: { bloom: 200, flip: 180, regroup: 150 },
  staggerCap: 30,
}

/**
 * The slider's range for a table of inner width W (px, gutters already taken off) and a grid gap.
 * min: six across on a phone, floor((W - 5 gap) / 6), never above 96 (so a laptop's smallest card is
 * 96 and a tablet sits in between without a breakpoint). max: one card filling the width, at most 420.
 */
export function ttRange(innerWidth, gap = 8) {
  const W = Math.max(1, Math.floor(Number(innerWidth) || 0))
  const g = Math.max(0, Number(gap) || 0)
  const max = Math.max(1, Math.min(W, TT_MAX_W))
  const six = Math.floor((W - 5 * g) / 6)
  const min = Math.max(1, Math.min(TT_LAPTOP_MIN, six, max))
  return { min, max }
}

export function ttClampW(value, range) {
  const v = Math.round(Number(value))
  if (!isFinite(v)) return range.min
  return Math.max(range.min, Math.min(range.max, v))
}

// The stops inside the range, each with its place on the track (0 to 1), for drawing ticks.
// list: the table's own stops (ttAcrossStops), default TT_STOPS.
export function ttStops(range, list = TT_STOPS) {
  const span = range.max - range.min
  return (Array.isArray(list) ? list : TT_STOPS).filter(w => w >= range.min && w <= range.max)
    .map(w => ({ w, at: span > 0 ? (w - range.min) / span : 0 }))
}

// On release: the nearest stop when the value is within 5 percent of the track, else the value
// (rounded and clamped). The table eases to the result over TT_MOTION.snap. list as ttStops.
export function ttSnap(value, range, list = TT_STOPS) {
  const v = ttClampW(value, range)
  const reach = TT_SNAP * (range.max - range.min)
  let best = null
  for (const { w } of ttStops(range, list)) {
    const d = Math.abs(w - v)
    if (d <= reach && (best === null || d < Math.abs(best - v))) best = w
  }
  return best === null ? v : best
}

// How many cards of width cardW fit across W with a gap (what the auto-fill grid lays out)
export function ttAcross(cardW, innerWidth, gap = 8) {
  const g = Math.max(0, Number(gap) || 0)
  const w = Math.max(1, Number(cardW) || 1)
  return Math.max(1, Math.floor((Math.max(0, Number(innerWidth) || 0) + g) / (w + g)))
}

// A table's own stops by cards across (Treehopper's Binder: 3 and 2 a row): for each N, the
// widest card that lays exactly N across W, floor((W - (N - 1) gap) / N). Ascending, no repeats.
export function ttAcrossStops(innerWidth, gap = 8, across = []) {
  const W = Math.max(0, Math.floor(Number(innerWidth) || 0))
  const g = Math.max(0, Number(gap) || 0)
  const out = new Set()
  for (const n of Array.isArray(across) ? across : []) {
    const N = Math.floor(Number(n))
    if (!(N >= 1)) continue
    const w = Math.floor((W - (N - 1) * g) / N)
    if (w >= 1) out.add(w)
  }
  return [...out].sort((a, b) => a - b)
}

// The open card's width on the stage: min(100vw - 48, (100dvh - 212) x 8/15, 420)
export function ttStageWidth(vw, vh) {
  return Math.max(0, Math.floor(Math.min(vw - 48, (vh - 212) * 8 / 15, TT_MAX_W)))
}

// ── Filters ─────────────────────────────────────────────────────────────────────
const asSet = (v) => {
  if (v == null || v === '') return null
  const list = (Array.isArray(v) ? v : [v]).filter(x => x != null && x !== '')
  return list.length ? new Set(list.map(String)) : null
}
// Case and accent folding for search ("cafe" finds "Café")
export const ttFold = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// The sets a card files under: its set, then any in card.sets (a card in two sets), once each
export function ttSetsOf(c) {
  if (!c) return []
  if (!Array.isArray(c.sets) || !c.sets.length) return [c.set]
  return [...new Set([c.set, ...c.sets].filter(x => x != null))]
}

// A set is started when the collection holds at least one of its cards
export function ttStartedSets(cards) {
  const out = new Set()
  for (const c of cards || []) if (c && c.held !== false) for (const s of ttSetsOf(c)) out.add(s)
  return out
}

/**
 * filter: { from, set, rarity, kind, interests, missing, q }
 * - from: app id(s); set: set id(s); rarity: rarity word(s); kind: kind id(s) (a zone card's chip,
 *   'events' for an event). A string, an array, or empty for all.
 * - interests: interest id(s); a card shows when it has any of them (the Provo page's rule). A card
 *   with none shows only while the filter is empty. No chip is always shown (the page's map keeps
 *   visitor info on every filter; a table of cards does not).
 * - missing: false shows held cards only; true adds the unheld cards of started sets (full prints,
 *   the table never greys them); 'only' shows those unheld cards alone.
 * - q: a substring of the title, case and accents ignored.
 * - only: a function, card => boolean, the table's own test (Treehopper's Near). Anything else
 *   is ignored here (useTtTable keeps its boolean switch and applies options.only itself).
 * A card in more than one set (card.sets) matches a set it is in, and starts each of them.
 * Pass the whole collection: a set counts as started from every held card, not the filtered ones.
 */
export function ttFilter(cards, filter = {}) {
  const list = Array.isArray(cards) ? cards : []
  const from = asSet(filter.from), set = asSet(filter.set), rarity = asSet(filter.rarity)
  const kind = asSet(filter.kind), interests = asSet(filter.interests)
  const q = ttFold(filter.q).trim()
  const missing = filter.missing === 'only' ? 'only' : !!filter.missing
  const started = missing ? ttStartedSets(list) : null
  const only = typeof filter.only === 'function' ? filter.only : null
  const inStarted = c => ttSetsOf(c).some(s => started.has(s))
  return list.filter((c) => {
    if (!c) return false
    const held = c.held !== false
    if (missing === 'only') { if (held || !inStarted(c)) return false }
    else if (!held && !(missing && inStarted(c))) return false
    if (from && !from.has(String(c.app))) return false
    if (set && !ttSetsOf(c).some(s => set.has(String(s)))) return false
    if (rarity && !rarity.has(String(c.rarity))) return false
    if (kind && !kind.has(String(c.kind))) return false
    if (interests && !(Array.isArray(c.interests) && c.interests.some(t => interests.has(String(t))))) return false
    if (q && !ttFold(c.title).includes(q)) return false
    if (only && !only(c)) return false
    return true
  })
}

// The options a filter can offer for this collection: apps and sets in the data's order, rarity
// words of the kinds present, high to low (ttRarityLadder), and the data's kinds and interests that
// some card has, in the data's order (a kind keeps its group and groupLabel for a two-row picker).
// A collection without data.kinds or data.interests offers none.
export function ttFacets(cards, data = {}) {
  const list = Array.isArray(cards) ? cards : []
  const apps = new Set(list.map(c => c.app)), sets = new Set(list.flatMap(ttSetsOf)), words = new Set(list.map(c => c.rarity).filter(Boolean))
  const kinds = new Set(list.map(c => c.kind).filter(k => k != null).map(String))
  const tags = new Set(list.flatMap(c => (Array.isArray(c.interests) ? c.interests : [])).map(String))
  return {
    from: (data.apps || []).filter(a => apps.has(a.id)).map(a => ({ id: a.id, label: a.name })),
    set: (data.sets || []).filter(s => sets.has(s.id)).map(s => ({ id: s.id, label: s.name, app: s.app })),
    rarity: ttRarityLadder(data.rarities).filter(r => words.has(r.word)).map(r => ({ id: r.word, label: r.word, top: r.top })),
    kind: (data.kinds || []).filter(k => kinds.has(String(k.id)))
      .map(k => ({ id: String(k.id), label: k.label, group: k.group ?? null, groupLabel: k.groupLabel ?? null })),
    interests: (data.interests || []).filter(i => tags.has(String(i.id))).map(i => ({ id: String(i.id), label: i.label })),
  }
}

// ── Sort ────────────────────────────────────────────────────────────────────────
const byName = (a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'en', { sensitivity: 'base', numeric: true })
const byId = (a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0)
const numOr = (n, dflt) => (n == null || n === '' || !isFinite(Number(n)) ? dflt : Number(n))

/**
 * by: 'newest' (added, high first; unheld cards have none and go last), 'rarest' (rarityRank high
 * first, then number), 'name', 'number' (the data's set order, then number). Ties fall to the name,
 * then the id, so an order never flickers. Returns a new array.
 */
export function ttSort(cards, by = 'newest', data = {}) {
  const list = Array.isArray(cards) ? cards.slice() : []
  const setIndex = new Map((data.sets || []).map((s, i) => [s.id, i]))
  const setOrder = (c) => (setIndex.has(c.set) ? setIndex.get(c.set) : setIndex.size)
  const tie = (a, b) => byName(a, b) || byId(a, b)
  const cmp = {
    newest: (a, b) => numOr(b.added, -Infinity) - numOr(a.added, -Infinity) || tie(a, b),
    rarest: (a, b) => numOr(b.rarityRank, 0) - numOr(a.rarityRank, 0) || numOr(a.number, Infinity) - numOr(b.number, Infinity) || tie(a, b),
    name: tie,
    number: (a, b) => setOrder(a) - setOrder(b) || String(a.set).localeCompare(String(b.set)) ||
      numOr(a.number, Infinity) - numOr(b.number, Infinity) || tie(a, b),
  }[by] || tie
  // Infinity - Infinity is NaN: read it as a tie
  return list.sort((a, b) => cmp(a, b) || 0)
}

// Pinned cards first, in the pin's order, the rest in the order given (the Overstory leads the
// Binder). ids: card ids; an id not in the list is skipped. Returns a new array.
export function ttPin(cards, ids) {
  const list = Array.isArray(cards) ? cards : []
  if (!Array.isArray(ids) || !ids.length) return list.slice()
  const at = new Map(ids.map((id, i) => [String(id), i]))
  const head = list.filter(c => c && at.has(String(c.id))).sort((a, b) => at.get(String(a.id)) - at.get(String(b.id)))
  return [...head, ...list.filter(c => !(c && at.has(String(c.id))))]
}

// ── Groups ──────────────────────────────────────────────────────────────────────
/**
 * Every rarity word across the kinds, high to low: the top words first (Unique, Legendary: these
 * take gold), then by the highest rank the word has in any kind. A word is top only when it is the
 * top word of every kind that uses it, so Provo's "Uncommon" (its highest) is not gold beside
 * Treehopper's "Uncommon" (the middle of seven); a Provo-only table does gild it.
 */
export function ttRarityLadder(rarities = {}) {
  const words = new Map()
  for (const list of Object.values(rarities || {})) {
    if (!Array.isArray(list)) continue
    list.forEach((w, i) => {
      const top = i === list.length - 1 && list.length > 1
      const prev = words.get(w)
      words.set(w, { word: w, top: prev ? prev.top && top : top, rank: Math.max(prev ? prev.rank : -1, i), first: prev ? prev.first : words.size })
    })
  }
  return [...words.values()].sort((a, b) => (b.top - a.top) || (b.rank - a.rank) || (a.first - b.first))
    .map(({ word, top, rank }) => ({ word, top, rank }))
}

/**
 * Groups the cards to show (already filtered and sorted; each group keeps that order, so its first
 * card is the pile's cover). by: 'set' (default), 'app', 'rarity', 'kind', 'none'.
 * Each group: { id, kind, label, app, held, total, shown, reduced, cards }, plus `short`, `action`
 * and `trek` for a set, `top` for a rarity, and `group` and `groupLabel` for a kind (its row on the
 * Provo page: "Things to do", "Eat & drink").
 * - held: held cards of that group in the whole collection (`data.cards`, else the cards given).
 * - total: the set's total ("7 of 10", Treehopper "44 of 620"); null for app, rarity and none.
 * - shown: cards in the group now; reduced: a filter hides some (the label adds "3 shown"). Pass the
 *   filter in force as `data.filter` so Missing does not count as a reduction.
 * Groups come in the data's order (sets, apps, kinds) or the rarity ladder; empty groups are left
 * out; a kind the data does not name comes after, as its id ("Other" without one).
 * By set, a card in more than one set (card.sets) is filed and counted under each, once a set.
 */
export function ttGroup(cards, by = 'set', data = {}) {
  const shown = Array.isArray(cards) ? cards : []
  const all = Array.isArray(data.cards) ? data.cards : shown
  const base = ttFilter(all, { missing: data.filter ? data.filter.missing : false })
  const keyOf = {
    set: c => c.set,
    app: c => c.app,
    rarity: c => c.rarity || '',
    kind: c => (c.kind == null ? '' : String(c.kind)),
    none: () => 'all',
  }[by] || (c => c.set)
  const keysOf = by === 'set' ? ttSetsOf : c => [keyOf(c)]
  const tally = (list, pick) => {
    const m = new Map()
    for (const c of list) if (pick(c)) for (const k of keysOf(c)) m.set(k, (m.get(k) || 0) + 1)
    return m
  }
  const heldBy = tally(all, c => c.held !== false)
  const baseBy = tally(base, () => true)
  const buckets = new Map()
  for (const c of shown) {
    for (const k of keysOf(c)) {
      if (!buckets.has(k)) buckets.set(k, [])
      buckets.get(k).push(c)
    }
  }
  const make = (k, extra) => {
    const list = buckets.get(k) || []
    return {
      id: `${by === 'none' ? 'all' : by}:${k}`, kind: by === 'none' ? 'all' : by, label: '', app: null,
      held: heldBy.get(k) || 0, total: null, shown: list.length, reduced: list.length < (baseBy.get(k) || 0),
      cards: list, ...extra,
    }
  }
  const order = []
  if (by === 'none') {
    if (buckets.has('all')) order.push(make('all', { id: 'all' }))
  } else if (by === 'app') {
    const known = new Set()
    for (const a of data.apps || []) { known.add(a.id); if (buckets.has(a.id)) order.push(make(a.id, { label: a.name, app: a.id })) }
    for (const k of buckets.keys()) if (!known.has(k)) order.push(make(k, { label: String(k), app: k }))
  } else if (by === 'rarity') {
    const known = new Set()
    for (const r of ttRarityLadder(data.rarities)) {
      known.add(r.word)
      if (buckets.has(r.word)) order.push(make(r.word, { label: r.word, top: r.top }))
    }
    for (const k of buckets.keys()) if (!known.has(k)) order.push(make(k, { label: k || 'Other', top: false }))
  } else if (by === 'kind') {
    const known = new Set()
    for (const kd of data.kinds || []) {
      const k = String(kd.id)
      known.add(k)
      if (buckets.has(k)) order.push(make(k, { label: kd.label || k, group: kd.group ?? null, groupLabel: kd.groupLabel ?? null }))
    }
    for (const k of buckets.keys()) if (!known.has(k)) order.push(make(k, { label: k || 'Other', group: null, groupLabel: null }))
  } else {
    const known = new Set()
    for (const s of data.sets || []) {
      known.add(s.id)
      if (buckets.has(s.id)) {
        order.push(make(s.id, {
          label: s.name, app: s.app, short: s.short || null, action: s.action || null, trek: s.trek || null,
          total: s.total != null ? s.total : null,
        }))
      }
    }
    for (const k of buckets.keys()) if (!known.has(k)) order.push(make(k, { label: String(k), app: (buckets.get(k)[0] || {}).app || null }))
  }
  return order
}

// ── Piles ───────────────────────────────────────────────────────────────────────
// FNV-1a over the id, then mulberry32 (as llZoneDeal's rng): the same three values for a group id on
// every device and every render, each in [-1, 1]. The table turns them into a pile's offsets and tilt.
export function ttPileSeed(groupId) {
  let h = 0x811c9dc5
  const s = String(groupId == null ? '' : groupId)
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  let a = h >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return [next(), next(), next()].map(v => Math.round((v * 2 - 1) * 10000) / 10000)
}

// ── Deal ────────────────────────────────────────────────────────────────────────
// The Binder's deal, as the approved design deals it: the cards in number order (none first, a tile
// without a stamp reading as 0), each sliding in over `each` ms, the starts spread so the last lands at
// `ms`. Returns [{ id, delay, duration }]; reduced motion deals nothing.
export const TT_DEAL = Object.freeze({ ms: 1000, each: 260 })
export function ttDeal(cards, { ms = TT_DEAL.ms, each = TT_DEAL.each, reduced = false } = {}) {
  if (reduced) return []
  const list = (Array.isArray(cards) ? cards : []).filter(Boolean)
  const no = c => numOr(c.number, 0)
  const order = list.map((c, i) => ({ c, i })).sort((a, b) => no(a.c) - no(b.c) || a.i - b.i)
  const n = order.length
  const gap = n > 1 ? Math.max(0, ms - each) / (n - 1) : 0
  return order.map(({ c }, i) => ({ id: c.id, delay: Math.round(i * gap), duration: each }))
}

// ── Counts and the open card's row ──────────────────────────────────────────────
export function ttCounts(cards) {
  let missing = 0
  for (const c of cards || []) if (c && c.held === false) missing++
  return { cards: (cards || []).length, missing }
}

// "118 cards", with Missing on "118 cards · 6 missing"
export function ttCountLabel(counts, missingOn = false) {
  const n = counts.cards.toLocaleString('en-US')
  const base = `${n} ${counts.cards === 1 ? 'card' : 'cards'}`
  return missingOn ? `${base} · ${counts.missing.toLocaleString('en-US')} missing` : base
}

// Where a card sits in the filtered row, and its neighbors for prev and next (null at the ends)
export function ttRow(cards, id) {
  const list = Array.isArray(cards) ? cards : []
  const index = list.findIndex(c => c && c.id === id)
  if (index < 0) return { index: -1, total: list.length, prev: null, next: null }
  return { index, total: list.length, prev: list[index - 1] || null, next: list[index + 1] || null }
}

// ── A card's set, one level under it ────────────────────────────────────────────
// Three levels: the experience (the game, a card's app), its collection (a table's
// cards) and a set (at most one level under one card: a species' trees). The kit's older `set` (a
// group inside a collection) keeps its name, so in code the new level is the nest: card.children,
// cards of another kind, and card.childTotal, the parent's own total of them (the city's count).
// Returns { cards, total, error }: the children in the record's order, the total (a number from 0,
// else null) and null; a card with no children gives cards []. One level only, so a child with its
// own children is an error, as is a child without an id or an id met twice (the parent's included):
// then cards is [] and the table draws the card on its own. Children never enter the collection's
// filters, counts or groups.
export function ttNest(card) {
  const t = card ? Number(card.childTotal) : NaN
  const total = card && card.childTotal != null && Number.isFinite(t) && t >= 0 ? t : null
  const kids = card && Array.isArray(card.children) ? card.children : []
  if (!kids.length) return { cards: [], total, error: null }
  const seen = new Set([String(card.id)])
  for (const k of kids) {
    if (!k || typeof k !== 'object' || k.id == null || k.id === '') return { cards: [], total, error: 'a child without an id' }
    if (Array.isArray(k.children) && k.children.length) return { cards: [], total, error: `child ${k.id} has children (one level only)` }
    if (seen.has(String(k.id))) return { cards: [], total, error: `id ${k.id} twice` }
    seen.add(String(k.id))
  }
  return { cards: kids, total, error: null }
}
