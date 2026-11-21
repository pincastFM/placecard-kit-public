/**
 * createTabletop's pure part (CONTRACT.md): the ids a config names from, the theme token lists, the config and
 * collection checks, and a theme's head entry. Framework-free; runs in Node.
 * vue/createTabletop.js runs these checks; a conformance suite reads the same lists.
 */
import { CR_FONTS } from './cardroom.js'
import { TT_FACES, TT_FACE_ID_RE, ttFaceOf } from './face.js'

// ── What a config names from
// 1.6.0 (the open kit): an app is any id of the registry's own shape (placecard_apps.id: lowercase letters, digits
// and hyphens, 32 at most). The registry is the one authority on which apps exist; the kit keeps no list of them.
export const TT_APP_ID_RE = /^[a-z0-9-]{1,32}$/
export const ttAppIdOk = id => typeof id === 'string' && TT_APP_ID_RE.test(id)
// Pincast's own apps, as examples and for the types. Not a gate since 1.6.0: nothing checks a config against it.
export const TT_APP_IDS = Object.freeze(['treehopper', 'verythere', 'studio'])
// useTtTable's TT_GROUPS and TT_SORTS, by id (a test holds them equal); the facets are useTtTable's own list
export const TT_GROUP_IDS = Object.freeze(['set', 'app', 'kind', 'rarity', 'none'])
export const TT_SORT_IDS = Object.freeze(['newest', 'rarest', 'name', 'number'])
export const TT_FACET_IDS = Object.freeze(['from', 'set', 'rarity', 'kind', 'interests'])

// ── Tokens. A test derives each list from the stylesheets, so none can drift.
// The 22 a theme supplies, every one (css/themes/cardroom.css declares them on .tt)
export const TT_THEME_TOKENS = Object.freeze([
  '--ground', '--ground-2', '--surface', '--backdrop', '--line', '--line-2',
  '--chrome', '--chrome-2', '--chrome-3',
  '--gold', '--gold-2', '--spot', '--grain', '--grain-a',
  '--font-display', '--font-text', '--font-mono',
  '--r-1', '--r-2', '--r-3', '--r-pill', '--shadow-card',
])
// 1.6.0 (the open kit): the three app marks a theme had to supply until 1.5.0, one token per Pincast app. No kit
// file ever read one: an app's mark is its `color` in the collection's `apps` (any CSS color, from the registry or
// the host), which the table and the open card draw. The Card room theme still declares the three, so a host that
// writes `var(--mark-th)` in its data or its own CSS reads what it read before; a theme need not supply them.
export const TT_LEGACY_MARK_TOKENS = Object.freeze(['--mark-th', '--mark-vt', '--mark-pc'])
// The 15 the kit keeps (css/table.css declares them); a theme never sets one
export const TT_MECHANICS_TOKENS = Object.freeze([
  '--e-out', '--e-in', '--e-end', '--e-settle', '--d-fast', '--d-med',
  '--card-w', '--gap', '--sat', '--sab', '--padl', '--padr', '--top-h', '--strip-h', '--dock-h',
])
// Every token the kit reads with a default (table.css, the theme file's <html> ground, TtFace): a theme may set it
export const TT_DEFAULTED_TOKENS = Object.freeze([
  // the table
  '--tt-ground', '--tt-scheme', '--search-edge', '--thumb-shadow', '--want-bg', '--want-ink', '--pile-1', '--pile-2', '--pile-3', '--lg-name',
  '--edge-core', '--edge-line', '--pc-stock-t', '--pc-rest', '--pc-lift', '--pc-tile-rest',
  '--shadow-pile', '--shadow-edge', '--shadow-popover', '--shadow-stage', '--opt-hover', '--chrome-press', '--chrome-focus',
  // 1.2.0: a printing tile's radius, the chips' and segments' padding, a stack's count badge, an open set's top
  // room, the phone's two-row top bar
  '--tile-r', '--chip-px', '--seg-px', '--pile-n-pad', '--nest-top', '--top-h2',
  // the faces: the print face and the Treehopper face
  '--pc-edge', '--pc-veil', '--pc-sheen', '--pc-shade', '--pc-grain', '--pc-noise',
  '--thf-frame', '--thf-paper', '--thf-ink', '--thf-ink-2', '--thf-art-bed', '--thf-mat', '--thf-gold', '--thf-gold-2', '--thf-on-gold',
  '--thf-hair', '--thf-hatch', '--thf-speck', '--thf-edge', '--thf-veil', '--thf-sheen', '--thf-shade', '--thf-grain',
])
// The moderation parts' tokens (css/moderation.css, 1.1.0): each read with a default or left to inherit, so a
// host sets any of them where it mounts the parts (on a card's back, around its admin screen)
export const TT_MOD_TOKENS = Object.freeze([
  '--tt-mod-ink', '--tt-mod-ink-2', '--tt-mod-line', '--tt-mod-surface', '--tt-mod-accent', '--tt-mod-fill', '--tt-mod-on-fill',
  '--tt-mod-focus', '--tt-mod-font', '--tt-mod-font-label', '--tt-mod-r', '--tt-mod-r-pill', '--tt-mod-thumb', '--tt-mod-max',
])

// ── The Card room, as a theme config: the base on every .tt (css/themes/cardroom.css); the class only marks it
export const TT_CARDROOM_THEME = Object.freeze({
  class: 'tt-cardroom',
  fonts: Object.freeze([Object.freeze({ key: 'tt-cr-fonts', href: CR_FONTS })]),
  htmlAttrs: Object.freeze({ 'data-tt': 'cardroom' }),
})

/**
 * A theme's head entry for the host (vue/host.js): { htmlAttrs?, link }. A font given as a string is keyed tt-theme-font-<i>.
 * A theme with no `fonts` key gets the Card room's (tt-cr-fonts), the fonts its tokens name unless its class sets
 * others; `fonts: []` asks for none.
 */
export function ttThemeHead(theme) {
  const t = theme || {}
  const fonts = t.fonts === undefined ? TT_CARDROOM_THEME.fonts : t.fonts
  const link = (Array.isArray(fonts) ? fonts : []).map((f, i) => (typeof f === 'string'
    ? { key: `tt-theme-font-${i}`, rel: 'stylesheet', href: f }
    : { key: f.key, rel: 'stylesheet', href: f.href }))
  return t.htmlAttrs ? { htmlAttrs: { ...t.htmlAttrs }, link } : { link }
}

// ── The contract's major
/** The major of a semver string ('0.3.0' is 0); NaN when it is not one. */
export function ttContractMajor(v) {
  const m = /^(\d+)\.\d+\.\d+/.exec(String(v == null ? '' : v))
  return m ? Number(m[1]) : NaN
}

// ── The config checks
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v)
const isFn = v => typeof v === 'function'
// Vue's ref without importing Vue: an object with a `value`
const isRefLike = v => isObj(v) && 'value' in v
const isStr = v => typeof v === 'string' && v.trim() !== ''
const strRefGetter = v => isStr(v) || isFn(v) || isRefLike(v)
const CLASS_TOKEN = /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/
const https = v => typeof v === 'string' && /^https:\/\/[^\s]+$/.test(v)

const KEYS = ['contract', 'app', 'source', 'faces', 'theme', 'hand', 'modes', 'table', 'labels', 'links', 'groups', 'sorts', 'filters', 'map']
const REQUIRED = ['contract', 'app', 'source', 'faces', 'theme', 'hand', 'modes']

function unknownKeys(errs, obj, allowed, at) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) errs.push(`${at}.${k}: not a key here (${allowed.join(', ')})`)
}
function idList(errs, v, ids, at, { empty = false } = {}) {
  if (!Array.isArray(v) || (!empty && !v.length)) { errs.push(`${at}: a ${empty ? '' : 'non-empty '}list of ${ids.join(', ')}`); return }
  const seen = new Set()
  for (const id of v) {
    if (!ids.includes(id)) errs.push(`${at}: '${id}' is not one of ${ids.join(', ')}`)
    else if (seen.has(id)) errs.push(`${at}: '${id}' twice`)
    seen.add(id)
  }
}
function link(errs, v, at) {
  if (!isObj(v)) { errs.push(`${at}: { label, href }`); return }
  unknownKeys(errs, v, ['label', 'href'], at)
  if (!isStr(v.label)) errs.push(`${at}.label: a string`)
  if (!isStr(v.href)) errs.push(`${at}.href: a string`)
}
// The face ids a config names, from a list of { id } or an object keyed by id
export function ttConfigFaceIds(faces) {
  if (Array.isArray(faces)) return faces.map(f => (f && f.id))
  return isObj(faces) ? Object.keys(faces) : []
}

/**
 * Every problem with a config, as strings (empty: the config is good). version: the kit's contract version,
 * whose major the config's `contract` must equal.
 */
export function ttConfigErrors(config, version) {
  const errs = []
  if (!isObj(config)) return ['config: an object']
  unknownKeys(errs, config, KEYS, 'config')
  for (const k of REQUIRED) if (config[k] === undefined) errs.push(`config.${k}: required`)

  // contract: the major the instance was built for
  if (config.contract !== undefined) {
    const major = ttContractMajor(version)
    if (!Number.isInteger(config.contract) || config.contract < 0) errs.push('config.contract: the contract major, a whole number')
    else if (!Number.isFinite(major)) errs.push(`config.contract: no kit version to check it against (got ${version})`)
    else if (config.contract !== major) errs.push(`config.contract: built for contract major ${config.contract}, this kit is ${version} (major ${major})`)
  }
  if (config.app !== undefined && !ttAppIdOk(config.app)) errs.push(`config.app: '${config.app}' is not an app id (the registry's shape: lowercase letters, digits and hyphens, 32 at most)`)

  if (config.source !== undefined) {
    if (!isObj(config.source)) errs.push('config.source: { load }')
    else {
      unknownKeys(errs, config.source, ['load'], 'config.source')
      if (!isFn(config.source.load)) errs.push('config.source.load: a function returning the collection')
    }
  }

  if (config.faces !== undefined) {
    const fs = config.faces
    const entries = Array.isArray(fs) ? fs.map((f, i) => [`config.faces[${i}]`, f, f && f.id]) : isObj(fs) ? Object.entries(fs).map(([id, f]) => [`config.faces.${id}`, f, id]) : null
    if (!entries || !entries.length) errs.push(`config.faces: a non-empty list of { id } or an object keyed by face (${TT_FACES.join(', ')}, or a face of the app's own)`)
    else {
      const seen = new Set()
      for (const [at, f, id] of entries) {
        if (!isObj(f)) { errs.push(`${at}: an object`); continue }
        const kit = TT_FACES.includes(id)
        // 1.6.0: a face of the app's own, under its own id, drawn by a kit face (`base`) or by its `component`
        const own = !kit && typeof id === 'string' && TT_FACE_ID_RE.test(id)
        if (!kit && !own) errs.push(`${at}: '${id}' is not a face id (${TT_FACES.join(', ')}, or the app's own: a lowercase letter, then letters, digits and hyphens, 32 at most)`)
        else if (seen.has(id)) errs.push(`${at}: '${id}' twice`)
        seen.add(id)
        if (f.print !== undefined && typeof f.print !== 'boolean') errs.push(`${at}.print: a boolean`)
        if (kit) {
          for (const k of ['base', 'component']) if (f[k] !== undefined) errs.push(`${at}.${k}: a kit face draws itself; give the app's own face its own id`)
        } else if (own) {
          if (f.base !== undefined && !TT_FACES.includes(f.base)) errs.push(`${at}.base: one of ${TT_FACES.join(', ')}`)
          if (f.component !== undefined && !(isObj(f.component) || isFn(f.component))) errs.push(`${at}.component: a component`)
          if (f.base === undefined && f.component === undefined) errs.push(`${at}: the app's own face needs a base (${TT_FACES.join(', ')}) or a component`)
        }
      }
    }
  }

  if (config.theme !== undefined) {
    const t = config.theme
    if (!isObj(t)) errs.push('config.theme: { class, fonts?, htmlAttrs? }')
    else {
      unknownKeys(errs, t, ['class', 'fonts', 'htmlAttrs'], 'config.theme')
      const cls = typeof t.class === 'string' ? t.class.trim().split(/\s+/).filter(Boolean) : []
      if (!cls.length) errs.push('config.theme.class: a non-empty class name')
      for (const c of cls) {
        if (!CLASS_TOKEN.test(c)) errs.push(`config.theme.class: '${c}' is not a class name`)
        else if (c === 'tt') errs.push("config.theme.class: 'tt' is the table's own class")
      }
      if (t.fonts !== undefined) {
        if (!Array.isArray(t.fonts)) errs.push('config.theme.fonts: a list of URLs or { key, href }')
        else t.fonts.forEach((f, i) => {
          const at = `config.theme.fonts[${i}]`
          if (typeof f === 'string') { if (!https(f)) errs.push(`${at}: an https URL`) } else if (!isObj(f)) errs.push(`${at}: an https URL or { key, href }`)
          else {
            unknownKeys(errs, f, ['key', 'href'], at)
            if (!isStr(f.key)) errs.push(`${at}.key: a string`)
            if (!https(f.href)) errs.push(`${at}.href: an https URL`)
          }
        })
      }
      if (t.htmlAttrs !== undefined) {
        if (!isObj(t.htmlAttrs)) errs.push('config.theme.htmlAttrs: an object of strings')
        else for (const [k, v] of Object.entries(t.htmlAttrs)) if (typeof v !== 'string') errs.push(`config.theme.htmlAttrs.${k}: a string`)
      }
    }
  }

  if (config.hand !== undefined) {
    const h = config.hand
    if (!isObj(h)) errs.push('config.hand: { key, scope, store? }')
    else {
      unknownKeys(errs, h, ['key', 'scope', 'store'], 'config.hand')
      if (!strRefGetter(h.key)) errs.push('config.hand.key: the storage key (a string, ref or getter)')
      if (!strRefGetter(h.scope)) errs.push("config.hand.scope: the hand's scope, kept in its payload (a string, ref or getter)")
      if (h.store !== undefined && !(isObj(h.store) && isFn(h.store.get) && isFn(h.store.set) && isFn(h.store.remove))) errs.push('config.hand.store: { get, set, remove }')
    }
  }

  if (config.modes !== undefined) {
    const m = config.modes
    if (!isObj(m)) errs.push("config.modes: { collection?: true, planning?: { solver: 'day' | 'path' } }")
    else {
      unknownKeys(errs, m, ['collection', 'planning'], 'config.modes')
      if (m.collection !== undefined && typeof m.collection !== 'boolean') errs.push('config.modes.collection: a boolean')
      if (m.collection !== true && m.planning === undefined) errs.push('config.modes: collection, planning or both')
      if (m.planning !== undefined) {
        const p = m.planning
        if (!isObj(p)) errs.push("config.modes.planning: { solver: 'day', rules } or { solver: 'path', directions? }")
        else if (p.solver === 'day') {
          unknownKeys(errs, p, ['solver', 'rules'], 'config.modes.planning')
          if (!isObj(p.rules)) errs.push('config.modes.planning.rules: the day solver needs its DayRules')
        } else if (p.solver === 'path') {
          unknownKeys(errs, p, ['solver', 'directions'], 'config.modes.planning')
          if (p.directions !== undefined && p.directions !== null && !isFn(p.directions)) errs.push('config.modes.planning.directions: a Directions function')
        } else errs.push(`config.modes.planning.solver: 'day' or 'path', not '${p.solver}'`)
      }
    }
  }

  // ── optional
  if (config.table !== undefined) {
    const t = config.table
    if (!isObj(t)) errs.push('config.table: { key?, widths?, stacked?, only? }')
    else {
      unknownKeys(errs, t, ['key', 'widths', 'stacked', 'only'], 'config.table')
      if (t.key !== undefined && !isStr(t.key)) errs.push('config.table.key: a string')
      if (t.widths !== undefined) {
        const w = t.widths
        if (!isObj(w)) errs.push('config.table.widths: { phone, laptop }')
        else {
          unknownKeys(errs, w, ['phone', 'laptop'], 'config.table.widths')
          for (const k of ['phone', 'laptop']) if (!(Number.isFinite(w[k]) && w[k] > 0)) errs.push(`config.table.widths.${k}: a width in px`)
        }
      }
      if (t.stacked !== undefined && typeof t.stacked !== 'boolean') errs.push('config.table.stacked: a boolean')
      if (t.only !== undefined && !isFn(t.only)) errs.push('config.table.only: a function of a card')
    }
  }
  if (config.labels !== undefined) {
    const l = config.labels
    if (!isObj(l)) errs.push('config.labels: an object of words')
    else for (const [k, v] of Object.entries(l)) {
      if (k === 'groups') {
        if (!isObj(v)) errs.push('config.labels.groups: { [group id]: label }')
        else for (const [g, s] of Object.entries(v)) {
          if (!TT_GROUP_IDS.includes(g)) errs.push(`config.labels.groups.${g}: not a group (${TT_GROUP_IDS.join(', ')})`)
          else if (!isStr(s)) errs.push(`config.labels.groups.${g}: a string`)
        }
      } else if (typeof v !== 'string') errs.push(`config.labels.${k}: a string`)
    }
  }
  if (config.links !== undefined) {
    const l = config.links
    if (!isObj(l)) errs.push('config.links: { back?, empty? }')
    else {
      unknownKeys(errs, l, ['back', 'empty'], 'config.links')
      if (l.back !== undefined) link(errs, l.back, 'config.links.back')
      if (l.empty !== undefined) {
        if (!Array.isArray(l.empty)) errs.push('config.links.empty: a list of { label, href }')
        else l.empty.forEach((x, i) => link(errs, x, `config.links.empty[${i}]`))
      }
    }
  }
  if (config.groups !== undefined) idList(errs, config.groups, TT_GROUP_IDS, 'config.groups')
  if (config.sorts !== undefined) idList(errs, config.sorts, TT_SORT_IDS, 'config.sorts')
  if (config.filters !== undefined) {
    const f = config.filters
    if (!isObj(f)) errs.push('config.filters: { facets?, missing?, search? }')
    else {
      unknownKeys(errs, f, ['facets', 'missing', 'search'], 'config.filters')
      if (f.facets !== undefined) idList(errs, f.facets, TT_FACET_IDS, 'config.filters.facets', { empty: true })
      if (f.missing !== undefined && typeof f.missing !== 'boolean') errs.push('config.filters.missing: a boolean')
      if (f.search !== undefined && typeof f.search !== 'boolean') errs.push('config.filters.search: a boolean')
    }
  }
  if (config.map !== undefined && !(isObj(config.map) || isFn(config.map))) errs.push('config.map: a component')
  return errs
}

/** The config, or one TypeError listing every problem with it. */
export function ttCheckConfig(config, version) {
  const errs = ttConfigErrors(config, version)
  if (errs.length) throw new TypeError(`createTabletop: ${errs.length} config ${errs.length === 1 ? 'error' : 'errors'}\n- ${errs.join('\n- ')}`)
  return config
}

// ── The collection checks (what source.load() returns)
const CAP = 20
/**
 * Every problem with a loaded collection against its config, as strings: { apps, sets, cards } lists and a
 * `rarities` object; each card's face (its own, or its set's meta.face, ttFaceOf) and each set's meta.face among
 * config.faces. At most 20 card or set lines, then a count of the rest.
 */
export function ttCollectionErrors(collection, config) {
  if (!isObj(collection)) return ['collection: an object { apps, sets, rarities, cards }']
  const errs = []
  for (const k of ['apps', 'sets', 'cards']) if (!Array.isArray(collection[k])) errs.push(`collection.${k}: a list`)
  if (!isObj(collection.rarities)) errs.push('collection.rarities: an object of rarity lists')
  const faces = ttConfigFaceIds(config && config.faces)
  const named = faces.join(', ')
  // a card's face read as the table reads it: createTabletop adds the config's faces to a collection that has none,
  // so a face of the app's own resolves here too (1.6.0)
  const data = collection.faces ? collection : { ...collection, faces: config && config.faces }
  const lines = []
  for (const [i, s] of (Array.isArray(collection.sets) ? collection.sets : []).entries()) {
    const f = s && s.meta && s.meta.face
    if (f != null && !faces.includes(f)) lines.push(`collection.sets[${i}] (${s.id}): meta.face '${f}' is not in config.faces (${named})`)
  }
  for (const [i, c] of (Array.isArray(collection.cards) ? collection.cards : []).entries()) {
    if (!isObj(c)) { lines.push(`collection.cards[${i}]: an object`); continue }
    if (c.face != null && !faces.includes(c.face)) { lines.push(`collection.cards[${i}] (${c.id}): face '${c.face}' is not in config.faces (${named})`); continue }
    const f = ttFaceOf(c, data)
    if (!faces.includes(f)) lines.push(`collection.cards[${i}] (${c.id}): its face is '${f}', not in config.faces (${named})`)
  }
  errs.push(...lines.slice(0, CAP))
  if (lines.length > CAP) errs.push(`and ${lines.length - CAP} more`)
  return errs
}
