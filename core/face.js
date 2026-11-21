/**
 * Tabletop card faces: the pure part of components/tabletop/TtFace.vue (2026-10-23).
 * A faithful port of the design lab's faces (the approved faces): the same look() per card, the same
 * text cleaning, title fit and accent-deep mix.
 * Pure JS, no Vue, no DOM, no fetch, so the table, the tests and any server code can call it.
 */

// Every face font and weight, one Google Fonts link. TtFace.vue hands it to the host (vue/host.js) only where a
// face renders; no page that shows no card loads these.
export const TT_FACE_FONTS = 'https://fonts.googleapis.com/css2?family=Archivo:wght@900&family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=Instrument+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap'
// The Treehopper faces' own fonts (1.2.0 sets the back in them too): Young Serif for names, stamp numbers and the
// back's text, Archivo 400 to 900 at 75 to 100% width for labels. Loaded beside TT_FACE_FONTS only where a
// Treehopper card renders.
export const TT_TH_FONTS = 'https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,75..100,400..900;1,75..100,400..900&family=Young+Serif&display=swap'
// 1.4.0, the Studio face's fonts (as Placecard's design board loads them): Big Shoulders 700 to 900 at
// its display size for names and figures, Jost 400 to 700 for every label. Loaded beside TT_FACE_FONTS only where a
// Studio card renders.
export const TT_PC_FONTS = 'https://fonts.googleapis.com/css2?family=Big+Shoulders:opsz,wght@10..72,700..900&family=Jost:wght@400;500;600;700&display=swap'

// lucide 0.461 icon nodes (the set LLStopCard imports), stroke drawn by the face's CSS
export const TT_ICON = {
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  timer: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  landmark: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M10.4 21.9a10 10 0 0 0 9.941-15.416"/><path d="M13.5 2.1a10 10 0 0 0-9.841 15.416"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  cherry: '<path d="M2 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M12 17a5 5 0 0 0 10 0c0-2.76-2.5-5-5-3-2.5-2-5 .24-5 3Z"/><path d="M7 14c3.22-2.91 4.29-8.75 5-12 1.66 2.38 4.94 9 5 12"/><path d="M22 9c-4.29 0-7.14-2.33-10-7 5.71 0 10 4.67 10 7Z"/>',
  donut: '<path d="M20.5 10a2.5 2.5 0 0 1-2.4-3H18a2.95 2.95 0 0 1-2.6-4.4 10 10 0 1 0 6.3 7.1c-.3.2-.8.3-1.2.3"/><circle cx="12" cy="12" r="3"/>',
  store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
  'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  dot: '<circle cx="12.1" cy="12.1" r="1"/>',
  lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  tree: '<path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z"/><path d="M12 19v3"/>',
  // not lucide: the approved design's tree mark on a Treehopper tree card's tile
  'tree-mark': '<path d="M12 21v-6"/><path d="M12 3 6 12h3l-3 4h12l-3-4h3z"/>',
}

// A stat's key picks its glyph, as llCardModel.js LL_STAT_ICONS does; unknown keys get Dot
export const TT_STAT_ICONS = {
  opened: 'calendar', original: 'calendar', 'saturday market': 'calendar', since: 'calendar',
  lift: 'timer', decks: 'layers', floor: 'ruler', footprint: 'ruler', spires: 'landmark',
  pendulum: 'orbit', makers: 'users', 'cherry trees': 'cherry', 'city doughnut': 'donut',
  market: 'store', address: 'map-pin',
}
export const ttStatIcon = (k) => TT_STAT_ICONS[String(k || '').trim().toLowerCase()] || 'dot'

// The keystone glyph LLStopCard draws beside LEGENDARY (custom, 16 px grid): the inner nodes
export const TT_KEYSTONE = '<path d="M3 14V9a5 5 0 0 1 10 0v5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6.6 2.5h2.8l-.6 4.2H7.2z" fill="currentColor"/>'

// Provo chip families (llZoneChips.js): a card face fills with the darker `face` step, never the
// map pin's hue, so cream text keeps its contrast. A pin color given as accent maps here.
const FACE_STEP = { '#d9480f': '#b33a0c', '#1e4fd0': '#1e3fa8', '#0f8a5f': '#0b6b4a' }
// The walk's look: a retail walk takes LL_RETAIL_DEFAULTS.theme 'pop' unless its line in
// LL_RETAIL_WALKS says otherwise; 3947 and 3986 do not (llRetailWalks.js on vt-rails)
const WALK_THEME = { 3947: 'pop', 3986: 'pop' }
const INK = { pop: '#0E2B1F', base: '#1a1a1a', pc: '#12261C' }
const PC_STOCK = '#FFFDF6' // the Studio card's Stock (TtFace's --sf on .ttf-t-pc)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Source text may carry em or en dashes; the faces print none
export function ttClean(s) {
  return s == null ? '' : String(s).replace(/\s*[\u2013\u2014]\s*/g, ', ').trim()
}
export function ttHex(c) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(c || '').trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]
  return '#' + h.toLowerCase()
}
// a at t, b at 1 - t, in sRGB (what color-mix(in srgb, a t%, b) gives)
export function ttMix(a, b, t) {
  let out = '#'
  for (let i = 1; i < 7; i += 2) {
    const v = Math.round(parseInt(a.substr(i, 2), 16) * t + parseInt(b.substr(i, 2), 16) * (1 - t))
    out += ('0' + v.toString(16)).slice(-2)
  }
  return out
}
// WCAG 2's contrast ratio of two '#rrggbb', 1 to 21 (relative luminance in sRGB)
const ttLum = (hex) => {
  let L = 0
  for (const [i, w] of [[1, 0.2126], [3, 0.7152], [5, 0.0722]]) {
    const c = parseInt(hex.substr(i, 2), 16) / 255
    L += w * (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  }
  return L
}
export function ttContrast(a, b) {
  const x = ttLum(a)
  const y = ttLum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
// 1.5.0: the Studio face's waterline in the card's own accent. The stripe sits on the plate's Night, so the
// color it draws holds 3:1 against it (WCAG 1.4.11, a graphic): a darker accent is mixed toward the card's Stock a
// twentieth at a time until it does. A color ttHex refuses (a name, a word, nothing) gives null, and the face keeps
// its Cornflower stripe. The chip's mark is the app's own and stays Placecard green.
export const TT_STUDIO_WL_MIN = 3
export function ttStudioAccent(accent) {
  const h = ttHex(accent)
  if (!h) return null
  for (let i = 0; i <= 20; i += 1) {
    const c = i ? ttMix(h, PC_STOCK, 1 - i / 20) : h
    if (ttContrast(c, INK.pc) >= TT_STUDIO_WL_MIN) return c
  }
  return PC_STOCK.toLowerCase()
}
export const ttPad2 = (n) => (n < 10 ? '0' + n : String(n))
// 1.1.0: words.no, the number's word ("No." unset); an empty word leaves the number alone
const ttNo = (words, n) => { const w = words && words.no != null ? String(words.no) : 'No.'; return w ? w + ' ' + n : String(n) }
export const ttNumberLabel = (n, words) => (n == null || n === '' ? '' : ttNo(words, ttPad2(Number(n))))
export function ttFmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  return m ? MONTHS[Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1] : ''
}
// The stamp's date, "19 APR 22" (day, month, two-digit year, in capitals)
export function ttStampDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  const mon = m && MONTHS[Number(m[2]) - 1]
  return mon ? Number(m[3]) + ' ' + mon.toUpperCase() + ' ' + m[1].slice(2) : ''
}
// 1.4.0: the Studio stamp's date, "14 OCT 2026" (as the design board writes it: day, month in capitals, the full year)
export function ttStampDateLong(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  const mon = m && MONTHS[Number(m[2]) - 1]
  return mon ? Number(m[3]) + ' ' + mon.toUpperCase() + ' ' + m[1] : ''
}
// Treehopper's stamp: each species card prints its find number (the order of first finds) and the date the player
// first found it. A held card with a number reads "No. N", unpadded, over its first-find date (card.collected), at
// every size. 1.1.0: words.no, as ttNumberLabel's. 1.2.0, both opt-in: a held card with no number but a first-find
// date gets the date alone, { n: null, no: '', date }, when the host sets card.dateStamp true (a tree card); a
// missing card whose host gives card.spot (a distance, "0.3 mi") gets the empty spot,
// { n: null, no: '', date: '', spot }. Else null, as at 1.1.0.
export function ttStamp(card, words) {
  const c = card || {}
  if (c.held === false) {
    const spot = ttClean(c.spot)
    return spot ? { n: null, no: '', date: '', spot } : null
  }
  const date = ttStampDate(c.collected)
  const n = c.number == null || c.number === '' ? NaN : Number(c.number)
  if (Number.isFinite(n)) return { n, no: ttNo(words, n), date }
  return date && c.dateStamp === true ? { n: null, no: '', date } : null
}
// Treehopper's rarity pips, 1 (Widespread) to 6 (Very Rare); Unique takes the gold plate and none
export const TT_TH_PIPS = Object.freeze({ widespread: 1, common: 2, numerous: 3, uncommon: 4, rare: 5, 'very rare': 6 })
export const ttPips = (word) => TT_TH_PIPS[ttClean(word).toLowerCase().replace(/[\s_-]+/g, ' ')] || null
// A credit without a leading "Photo:", for a face that prints its own Photo word. 1.2.0, opt-in: a Treehopper
// face prints its credit as given when the host sets card.creditAsGiven true (ttFaceCredit), so it can write
// "Photo: alias" as the design board does; unset, stripped as at 1.1.0.
export const ttCreditText = (s) => ttClean(s).replace(/^photo\s*[:·]\s*/i, '')
export const ttFaceCredit = (card, data) => (card && card.creditAsGiven === true && ttFaceBase(ttFaceOf(card, data), data) === 'treehopper' ? ttClean(card.credit) : ttCreditText(card && card.credit))

// Title fit: the longest word sets a ceiling (the CSS divides --fit by --lw), a long title steps
// down a little (--tl), so a word never runs past the plate and lines clamp whole.
export function ttFit(title) {
  const words = String(title || '').split(/\s+/)
  const len = String(title || '').length
  let lw = 4
  for (const w of words) if (w.length > lw) lw = w.length
  const tl = len > 34 ? 0.8 : len > 26 ? 0.88 : len > 20 ? 0.94 : 1
  return { lw, tl }
}

const setCache = new WeakMap()
export function ttSetOf(card, data) {
  const sets = data && data.sets
  if (!Array.isArray(sets)) return null
  let map = setCache.get(sets)
  if (!map) {
    map = {}
    for (const s of sets) map[s.id] = s
    setCache.set(sets, map)
  }
  return map[card.set] || null
}

// The kit's own faces (CONTRACT.md, `faces`): an instance names which of them its cards take.
// 1.4.0: `studio`, Placecard's Studio face: a card looks finished from its photo, name and lines alone. Its palette
// is literal (the Greenhouse look); it prints no rarity.
export const TT_FACES = Object.freeze(['stop', 'destination', 'treehopper', 'studio'])
// 1.6.0 (the open kit): an instance may also name a face of its own, an entry in its `faces` under any id of this
// shape that is not a kit face. The entry gives `base` (the kit face that draws it, restyled by the host's CSS under
// .ttf[data-face="<id>"]), or `component` (the host's own Vue component, drawn inside the kit's card: its size, its
// stock and print, its foil, its turn), or both (the component draws). The kit keeps no list of hosts' faces.
export const TT_FACE_ID_RE = /^[a-z][a-z0-9-]{0,31}$/
const isComp = v => !!v && (typeof v === 'object' || typeof v === 'function') && !Array.isArray(v)
// A face's entry in the collection's faces (data.faces: keyed by face, or a list of { id }); null without one
export function ttFaceEntry(face, data) {
  const fs = data && data.faces
  if (!fs || typeof face !== 'string') return null
  if (Array.isArray(fs)) return fs.find(x => x && x.id === face) || null
  return Object.prototype.hasOwnProperty.call(fs, face) ? fs[face] : null
}
// A host's own face, as its entry: a well-formed id outside the kit's, whose entry gives a base or a component
function ownFace(face, data) {
  if (typeof face !== 'string' || TT_FACES.includes(face) || !TT_FACE_ID_RE.test(face)) return null
  const e = ttFaceEntry(face, data)
  return e && typeof e === 'object' && (isComp(e.component) || TT_FACES.includes(e.base)) ? e : null
}
// A card's face: the card's own when it names a kit face or one of the collection's own faces (1.6.0), else
// its set's `meta.face` (faces live in set meta) by the same test, else 'stop'.
export function ttFaceOf(card, data) {
  const c = card || {}
  if (TT_FACES.includes(c.face) || ownFace(c.face, data)) return c.face
  const set = ttSetOf(c, data)
  const f = set && set.meta && set.meta.face
  return TT_FACES.includes(f) || ownFace(f, data) ? f : 'stop'
}
// The kit face that draws a face (1.6.0): a kit face draws itself; a host's own face is drawn by its `base`, or by
// its `component` (then null: no kit face draws it). An unknown face is 'stop', as ttFaceOf has it.
export function ttFaceBase(face, data) {
  if (TT_FACES.includes(face)) return face
  const e = ownFace(face, data)
  if (!e) return 'stop'
  return isComp(e.component) ? null : e.base
}
// The host's component for a face (1.6.0), or null: a kit face, a based face and an unknown face have none
export function ttFaceComponent(face, data) {
  const e = ownFace(face, data)
  return e && isComp(e.component) ? e.component : null
}

// Everything a face needs from one card and the collection's sets, computed once per card
export function ttLook(card, data) {
  const set = ttSetOf(card, data)
  const face = ttFaceOf(card, data)
  // 1.6.0: the kit face that draws it (null: the host's component), and the look that goes with that face
  const base = ttFaceBase(face, data)
  const theme = base === null ? 'own' : base === 'treehopper' ? 'th' : base === 'destination' ? 'base' : base === 'studio' ? 'pc' : (WALK_THEME[set && set.trek] || 'pop')
  let ac = ttHex(card.accent) || '#1e3a8a' // llCardModel's default accent
  if (FACE_STEP[ac]) ac = FACE_STEP[ac]
  // The Studio face (and a host's face it draws, 1.6.0) has no gold and no foil (gold belongs to the top rarity alone;
  // the Studio has none)
  const foil = base !== 'studio' && (card.foil === true || /^legendary$/i.test(String(card.rarity || '')))
  const name = ttClean(card.title)
  return {
    set, face, base, theme, foil, name,
    short: ttClean((set && (set.short || set.name)) || card.set || ''),
    setName: ttClean((set && set.name) || ''),
    of: card.of || null,
    ac, dp: theme === 'th' ? '#332E8F' : ttMix(ac, INK[theme] || INK.base, 0.85),
    // 1.5.0: the Studio face's waterline from card.accent (ttStudioAccent); null on every other face. 1.6.0:
    // a host's face the Studio face draws (its base) takes it too
    wl: base === 'studio' ? ttStudioAccent(card.accent) : null,
    photo: !!card.img, fit: ttFit(name),
  }
}

// ── The shared card: print is a face option any face can take ──────────────────────────────────────────────
// card.print (a boolean) wins; then the collection's face entry for the card's face (ttFaceOf; data.faces, keyed by
// face or a list of { id }, its `print`); else on for the Treehopper face, the Studio face, a host's face either
// of them draws (1.6.0) and the Placecard app (`studio`), off for every other, so
// Provo's and VeryThere's faces stay as they are by default.
export function ttPrintOn(card, data) {
  const c = card || {}
  if (typeof c.print === 'boolean') return c.print
  const face = ttFaceOf(c, data)
  const f = ttFaceEntry(face, data)
  if (f && typeof f.print === 'boolean') return f.print
  const base = ttFaceBase(face, data)
  return base === 'treehopper' || base === 'studio' || c.app === 'studio'
}
// The collector number against the set, { n, of }: "NNN/of", n padded to of's digits ("007/612"); n alone without of.
// The host computes n (Treehopper's: alphabetical by common name of the 612, punctuation and case ignored).
// 1.4.0: `pad` pads both numbers to at least that many digits; the Studio face's is 3 ("003/005"). Unset, as
// before.
export function ttCollector(col, pad = 0) {
  if (!col || typeof col !== 'object') return ''
  const n = Number(col.n)
  const of = Number(col.of)
  if (!Number.isInteger(n) || n < 1) return ''
  if (!Number.isInteger(of) || of < 1) return pad ? String(n).padStart(pad, '0') : String(n)
  const w = Math.max(pad, String(of).length)
  return String(n).padStart(w, '0') + '/' + (pad ? String(of).padStart(w, '0') : of)
}
// The rarity marks (as the approved design draws them): one glyph per word by its place in the card's rarity list,
// low to high (Treehopper: Widespread, Common, Numerous, Uncommon, Rare, Very Rare, Unique). SVG nodes, 10 by 10.
const star = (cx, cy, R, r) => {
  let d = ''
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI / 5
    const q = i % 2 ? r : R
    d += (i ? 'L' : 'M') + (cx + q * Math.cos(a)).toFixed(2) + ' ' + (cy + q * Math.sin(a)).toFixed(2)
  }
  return '<path d="' + d + 'z"/>'
}
export const TT_RMARK = Object.freeze([
  '<circle cx="5" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  '<circle cx="5" cy="5" r="3.4"/>',
  '<path d="M5 1.4 8.6 5 5 8.6 1.4 5z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  '<path d="M5 1 9 5 5 9 1 5z"/>',
  star(5, 5.3, 4.6, 1.9),
  star(2.9, 5.3, 2.8, 1.15) + star(7.6, 5.3, 2.8, 1.15),
  '<circle cx="5" cy="5" r="4.4" fill="none" stroke="currentColor" stroke-width="1"/>' + star(5, 5.25, 3, 1.25),
])
// The card's rarity word's place in its list: data.rarities[card.kind], else [card.app], else the first list
// holding the word. -1 for no word, an unknown word, or a place past the seventh (no glyph).
export function ttRarityIndex(card, data) {
  const w = card && card.rarity
  if (!w) return -1
  const R = (data && data.rarities) || {}
  const has = l => Array.isArray(l) && l.includes(w)
  const list = [R[card.kind], R[card.app]].find(has) || Object.values(R).find(has)
  const i = list ? list.indexOf(w) : -1
  return i >= 0 && i < TT_RMARK.length ? i : -1
}
// The foot of a print front (furniture): the collector number (else card.mark, a child's "Tree 574031"), the
// rarity glyph, the art's credit (its mark first when the card names one; as given on a Treehopper face), the
// copyright line. null when empty.
export function ttFurniture(card, data, copyright = '') {
  const c = card || {}
  // The Studio face pads its collector number to three digits and prints no rarity, so no glyph; 1.6.0: so
  // does a host's face the Studio face draws
  const studio = ttFaceBase(ttFaceOf(c, data), data) === 'studio'
  const no = ttCollector(c.collector, studio ? 3 : 0) || ttClean(c.mark)
  const i = studio ? -1 : ttRarityIndex(c, data)
  const credit = ttFaceCredit(c, data)
  const cr = credit ? [ttClean(c.creditMark), credit].filter(Boolean).join(' · ') : ''
  const cp = ttClean(copyright)
  // 1.6.0: a Studio foot always prints, since its second line names the app and its site
  return no || i >= 0 || cr || cp || studio ? { no, rm: i >= 0 ? TT_RMARK[i] : '', cr, cp } : null
}

// The root element's classes, as faces.js shell() writes them
// 1.4.0: the Studio face takes `ttf-pc` where the C20 faces take `ttf-c20`
// 1.6.0: a host's face based on a kit face takes that face's classes (its own id is the root's data-face); a host's
// component takes `ttf-own` and none of a kit face's. A look without `base` (made by hand) is its own face's.
export function ttFaceClass(L, side, noimg = false) {
  if (L.base === null) return 'ttf ttf-' + side + ' ttf-own'
  const b = L.base || L.face
  return 'ttf ttf-' + side + ' ttf-' + b + ' ttf-t-' + L.theme +
    (b === 'treehopper' ? ' ttf-th' : b === 'studio' ? ' ttf-pc' : ' ttf-c20') + (L.photo ? '' : ' ttf-typo') + (noimg ? ' ttf-noimg' : '')
}

// ── 1.4.0: the Studio face's name, fitted as the design board fits it (its fit, its name split and its name block).
// Big Shoulders 900 advances at 100 px, opsz 72 (measured in chromium); any other glyph counts 50, as the board's
// table does. Every figure below is in board units: the card is 300 wide (563 tall), so a unit is a third of a cqi
// and the face draws each tier's SVG in these coordinates.
const PC_ADV = {
  ' ': 22, '!': 25, '&': 62, "'": 20, '(': 29, ')': 29, ',': 25, '-': 45, '.': 25, '/': 41, ':': 25, ';': 25, '?': 48,
  0: 51, 1: 27, 2: 49, 3: 50, 4: 51, 5: 52, 6: 50, 7: 49, 8: 50, 9: 50,
  A: 48, B: 47, C: 49, D: 50, E: 41, F: 41, G: 49, H: 49, I: 23, J: 45, K: 50, L: 40, M: 75, N: 54, O: 50, P: 47,
  Q: 50, R: 48, S: 47, T: 42, U: 49, V: 49, W: 80, X: 47, Y: 47, Z: 42,
}
const PC_CAP = 0.8 // Big Shoulders' cap height, em
const pcW100 = t => { let w = 0; for (const ch of t) w += PC_ADV[ch] != null ? PC_ADV[ch] : 50; return w }
// Size and textLength so a line fills `target`: a long line condenses to `squash`; a short one spaces out
function pcFit(text, target, maxsize, squash = 0.84) {
  const w = pcW100(text)
  const size = Math.min(target / (w / 100) / squash, maxsize)
  return { size, tl: target, adj: w / 100 * size >= target * 0.8 ? 'spacingAndGlyphs' : 'spacing' }
}
// A long name steps to two lines, split where the halves are closest in width
function pcSplit(nm, maxOne) {
  const words = nm.split(' ')
  if (nm.length <= maxOne || words.length < 2) return [nm]
  let k = 1
  let best = Infinity
  for (let i = 1; i < words.length; i += 1) {
    const d = Math.abs(pcW100(words.slice(0, i).join(' ')) - pcW100(words.slice(i).join(' ')))
    if (d < best) { best = d; k = i }
  }
  return [words.slice(0, k).join(' '), words.slice(k).join(' ')]
}
// The name laid out in its zone, centred top to bottom, shrunk until it fits (as the board's name block does)
function pcBlock(lines, lead, zt, zb, target, maxsize, leadSize, gap) {
  let fits = lines.map(ln => pcFit(ln, target, maxsize))
  const leadH = lead ? leadSize * 0.74 + gap : 0
  const tail = (ln, size) => (/[Q,;]/.test(ln) ? size * 0.13 : 0)
  const height = fs => fs.reduce((h, f, i) => h + f.size * PC_CAP + (i < lines.length - 1 ? gap + tail(lines[i], f.size) : tail(lines[i], f.size) * 0.5), leadH)
  const room = zb - zt - 8
  for (let n = 0; n < 4; n += 1) {
    const total = height(fits)
    if (total <= room) break
    const fixed = leadH + gap * (lines.length - 1)
    const k = Math.max(0.5, (room - fixed) / (total - fixed)) * 0.985
    fits = lines.map((ln, i) => pcFit(ln, target, fits[i].size * k))
  }
  let y = zt + (zb - zt - height(fits)) / 2
  let leadBase = null
  if (lead) { leadBase = y + leadSize * 0.74; y += leadH }
  const out = lines.map((text, i) => {
    const f = fits[i]
    const base = y + f.size * PC_CAP
    y = base + gap + tail(text, f.size)
    return { text, base: +base.toFixed(2), size: +f.size.toFixed(2), tl: f.tl, adj: f.adj }
  })
  return { lines: out, leadBase: leadBase == null ? null : +leadBase.toFixed(2) }
}
// The Studio name's three tiers (the board's: full from 240 px, mid 150 to 239, small under 150) and the
// back's head. Each: the box the face's SVG draws in (`vb`, board units), the name's x, its lines, the lead ("THE",
// set apart and tracked, as the board sets it) and the zone the floodlight crosses (`zt`, `zb`).
const PC_TIERS = {
  // x, plate top and bottom (the SVG's box), zone top and bottom, target width, largest size (and for two lines),
  // lead size, gap, the longest one-line name
  full: { ax: 8, aw: 284, pad: 12, by: 373, bb: 522, zt: 399, zb: 482, max: 76, max2: 58, lead: 9.5, gap: 6, one: 16 },
  mid: { ax: 8, aw: 284, pad: 12, by: 368, bb: 528, zt: 398, zb: 498, max: 86, max2: 58, lead: 13, gap: 7, one: 16 },
  small: { ax: 10, aw: 280, pad: 14, by: 338, bb: 553, zt: 374, zb: 545, max: 112, max2: 112, lead: 21, gap: 9, one: 8 },
  back: { ax: 8, aw: 284, pad: 12, by: 8, bb: 126, zt: 34, zb: 106, max: 58, max2: 44, lead: 9, gap: 5, one: 16 },
}
export function ttStudioName(title) {
  let nm = ttClean(title).toUpperCase().replace(/\s+/g, ' ').trim()
  let lead = ''
  if (nm.startsWith('THE ') && nm.length > 4) { lead = 'THE'; nm = nm.slice(4) }
  const out = { lead }
  for (const [id, T] of Object.entries(PC_TIERS)) {
    const lines = pcSplit(nm, T.one)
    const target = T.aw - 2 * T.pad
    const max = lines.length === 2 ? T.max2 : T.max
    const b = pcBlock(lines, lead, T.zt, T.zb, target, max, T.lead, T.gap)
    out[id] = { vb: `${T.ax} ${T.by} ${T.aw} ${T.bb - T.by}`, x: T.ax + T.pad, zt: T.zt, zb: T.zb, by: T.by, bb: T.bb, leadSize: T.lead, ...b }
  }
  return out
}
// The locked back's rule bars: the board wraps the story at 48 characters, 8 lines at most, and draws each
// line as a bar of its length; a stat's value is a bar of its width. Widths in board units; no word reaches the page.
export function ttLockBars(text, max = 8) {
  const words = ttClean(text).split(/\s+/).filter(Boolean)
  const lines = []
  let ln = ''
  for (const w of words) {
    if (ln && ln.length + 1 + w.length > 48) { lines.push(ln); ln = w } else ln = ln ? ln + ' ' + w : w
  }
  if (ln) lines.push(ln)
  return lines.slice(0, max).map(l => +Math.min(260, l.length * 5.25).toFixed(2))
}
// (the 900 advances stand in for the board's 700, a little wider)
export const ttLockValue = v => +Math.min(150, Math.max(40, pcW100(ttClean(v).toUpperCase()) * 14 / 100)).toFixed(2)
