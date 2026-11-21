// The registry subpath (kit CONTRACT.md section 3, "registry"): cards from the Placecard registry, and an outside
// app's own set, as the kit's cards and collections, so any app can draw its cards on the kit's table.
//
// Three sources, each the caller's to fetch (the kit fetches nothing and signs no one in):
// - a registry row (a placecard_cards row: { app_id, set_id, card_key, card_type, title, subtitle, fact, rarity, foil,
//   image_url, image_credit, image_license, url, lat, lng, data, status }) or a tile of GET /api/placecard/me/cards
//   ({ kind, app, set, key, id, title, subtitle, rarity, foil, image, lat, lng, mine, place, number, retired }):
//   ttFromRegistry, one card; ttSetFromRegistry, one set; ttFromMeCards, a whole /me/cards response as a collection;
// - an app's own set as it sent it to PUT /api/placecard/v1/sets/:set, with the answer of
//   GET /api/placecard/v1/sets/:set/collects for one person: ttFromAppSet, a collection with that person's cards held.
//
// The mapping here is the same for every app. What one app does differently (its face for a card, its set's kind and
// action, its card ids and links, its photo sizes) comes in through the options, by app id, so the kit names no app.
// With no options an app gets: its color from `apps` (else none), its face from its set's meta.face when that names a
// kit face or one the caller declares in `faces`, else its record's `face`, else 'destination'; its rarity ranked on
// Placecard's order; its card's link Placecard's card page.
//
// Pure functions over plain data: no Vue, no fetch, no storage, no Node-only API. Every entry point checks its input
// and refuses a bad one with one TypeError listing each problem; a field it does not read is never a problem.
import { CONTRACT_VERSION } from '../core/index.js'
import { TT_FACES, TT_FACE_ID_RE } from '../core/face.js'
import { ttAppIdOk } from '../core/tabletop.js'

export { CONTRACT_VERSION }

// Placecard's home. A card's page is <base>/card/<app>/<set>/<key>.
export const TT_PLACECARD_BASE = 'https://placecard.io'
// Placecard's rarity order, low to high: the player ranks every card's word on it. A card ranks on its set kind's
// list in `rarities` when the options give one, else on `ladder`, else on this.
export const TT_PLACECARD_RARITIES = Object.freeze(['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'])
// The face a card takes when nothing names one: its rule, its set's meta.face, its app's `face`, the options' `face`.
export const TT_REG_DEFAULT_FACE = 'destination'
// The registry's own shapes (the v1 API refuses anything else): a set id, a card key, a card type.
export const TT_REG_SET_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/
export const TT_REG_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,127}$/
export const TT_REG_TYPE_RE = /^[a-z][a-z0-9_-]{0,31}$/

// ── Helpers
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v)
const isFn = v => typeof v === 'function'
const isStr = v => typeof v === 'string' && v !== ''
const strOrNone = v => v == null || typeof v === 'string'
const strList = v => Array.isArray(v) && v.every(w => typeof w === 'string')
// An object's own key only: an id such as '__proto__' or 'constructor' names nothing
const ownGet = (o, k) => (isObj(o) && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined)
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype'])
const numOr = v => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v))
const upper = s => String(s || '').trim().toUpperCase()
const rankIn = (list, word) => Math.max(0, (list || []).indexOf(word))
const isTile = c => !!c && c.card_key == null && c.key != null
const https = v => typeof v === 'string' && /^https?:\/\/[^\s]+$/.test(v) && !v.endsWith('/')
// A card's own page as the app sent it: a whole http or https address, else none, so no other scheme reaches a link
function ownPage(v) {
  if (!isStr(v)) return null
  const s = v.trim()
  try {
    const u = new URL(s)
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password ? s : null
  } catch { return null }
}
const OPEN_PLACECARD = 'Open in Placecard'
function isoDay(v) {
  if (v instanceof Date) return isNaN(v) ? null : v.toISOString().slice(0, 10)
  const m = /^\d{4}-\d{2}-\d{2}/.exec(String(v || ''))
  return m ? m[0] : null
}
// A hook's answer onto a card or set: its fields set, a card's `ref` merged into the card's ref
function apply(out, part) {
  if (!isObj(part)) return
  for (const k of Object.keys(part)) {
    if (UNSAFE.has(k)) continue
    if (k === 'ref' && isObj(part.ref) && isObj(out.ref)) {
      for (const r of Object.keys(part.ref)) if (!UNSAFE.has(r)) out.ref[r] = part.ref[r]
    } else out[k] = part[k]
  }
}
const CAP = 20
function fail(fn, errs) {
  const lines = errs.length > CAP ? [...errs.slice(0, CAP), `and ${errs.length - CAP} more`] : errs
  throw new TypeError(`${fn}: ${errs.length} input ${errs.length === 1 ? 'error' : 'errors'}\n- ${lines.join('\n- ')}`)
}

// ── The options
// The faces a caller declares: a list of ids, or its config's `faces` (an object keyed by face, or a list of { id })
function declared(faces) {
  if (Array.isArray(faces)) return faces.map(f => (typeof f === 'string' ? f : f && f.id)).filter(f => typeof f === 'string')
  return isObj(faces) ? Object.keys(faces) : []
}
// A face a card may take: one of the kit's, or one the caller declares
const faceOk = (f, o) => typeof f === 'string' && (TT_FACES.includes(f) || (TT_FACE_ID_RE.test(f) && declared(o.faces).includes(f)))
const ruleOf = (o, app) => { const r = ownGet(o.rules, app); return isObj(r) ? r : null }
const appOf = (o, id) => (Array.isArray(o.apps) ? o.apps.find(a => isObj(a) && a.id === id) || null : null)
const ladderOf = (o, kind) => { const l = ownGet(o.rarities, kind); return strList(l) ? l : null }
// The list a card's rarity ranks on: its set kind's, else the options' ladder, else Placecard's order
const ladderFor = (o, set) => (set && ladderOf(o, set.kind)) || (strList(o.ladder) ? o.ladder : TT_PLACECARD_RARITIES)
// The app record a collection lists: id, name and color, and its site when it has one
function appEntry(o, id) {
  const a = appOf(o, id)
  if (!a) return { id, name: id, color: null }
  const out = { id, name: isStr(a.name) ? a.name : id, color: a.color ?? null }
  if (a.site != null) out.site = a.site
  return out
}
// The shared rules, without one call's own options (set, holding, meta, total, held, sets, cards, sort)
const RULE_KEYS = ['apps', 'faces', 'face', 'photo', 'rarities', 'ladder', 'rules', 'base']
function rulesOf(o) {
  const out = {}
  for (const k of RULE_KEYS) if (o[k] !== undefined) out[k] = o[k]
  return out
}
const RULE_HOOKS = ['face', 'set', 'card', 'offTable']

/**
 * Every problem with an options object, as strings (empty: the options are good). Keys it does not know are not
 * problems. The shared rules:
 *   apps      [{ id, name?, color?, site?, face? }]: the apps' records (the registry's, or the host's own). An app's
 *             color is its mark on the table and the accent of its cards; `face` its cards' face when their set
 *             names none
 *   faces     the host's own faces a set may name (a list of ids, or its config's `faces`)
 *   face      the face when nothing else names one (default 'destination')
 *   photo     (url, fields) => the photo the table shows (default: the url as given)
 *   rarities  { [set kind]: words, low to high }: the lists a card ranks on, and a collection's `rarities`
 *   ladder    the words a card ranks on when its set kind has no list (default Placecard's order)
 *   rules     { [app id]: { face?, set?, card?, offTable? } }: what one app does differently (each a function)
 *   base      Placecard's home (default https://placecard.io)
 */
export function ttRegOptionsErrors(options) {
  if (options == null) return []
  if (!isObj(options)) return ['options: an object']
  const o = options
  const errs = []
  if (o.faces != null) {
    if (!Array.isArray(o.faces) && !isObj(o.faces)) errs.push("options.faces: a list of face ids, or a config's faces")
    else for (const f of declared(o.faces)) if (!TT_FACE_ID_RE.test(f)) errs.push(`options.faces: '${f}' is not a face id (a lowercase letter, then letters, digits and hyphens, 32 at most)`)
    if (Array.isArray(o.faces) && declared(o.faces).length !== o.faces.length) errs.push('options.faces: each entry a face id or { id }')
  }
  if (o.apps != null) {
    if (!Array.isArray(o.apps)) errs.push('options.apps: a list of { id, name?, color?, site?, face? }')
    else {
      const seen = new Set()
      o.apps.forEach((a, i) => {
        const at = `options.apps[${i}]`
        if (!isObj(a)) { errs.push(`${at}: an object { id, name?, color?, site?, face? }`); return }
        if (!ttAppIdOk(a.id)) errs.push(`${at}.id: an app id (the registry's shape: lowercase letters, digits and hyphens, 32 at most)`)
        else if (seen.has(a.id)) errs.push(`${at}.id: '${a.id}' twice`)
        seen.add(a.id)
        for (const k of ['name', 'color', 'site']) if (!strOrNone(a[k])) errs.push(`${at}.${k}: a string`)
        if (a.face != null && !faceOk(a.face, o)) errs.push(`${at}.face: '${a.face}' is not a kit face (${TT_FACES.join(', ')}) or one of options.faces`)
      })
    }
  }
  if (o.face != null && !faceOk(o.face, o)) errs.push(`options.face: '${o.face}' is not a kit face (${TT_FACES.join(', ')}) or one of options.faces`)
  if (o.photo != null && !isFn(o.photo)) errs.push('options.photo: a function (url, fields) returning the photo the table shows')
  if (o.rarities != null) {
    if (!isObj(o.rarities)) errs.push('options.rarities: an object of word lists, keyed by set kind')
    else for (const k of Object.keys(o.rarities)) if (!strList(o.rarities[k])) errs.push(`options.rarities.${k}: a list of words, low to high`)
  }
  if (o.ladder != null && !strList(o.ladder)) errs.push('options.ladder: a list of words, low to high')
  if (o.rules != null) {
    if (!isObj(o.rules)) errs.push('options.rules: an object keyed by app id')
    else for (const k of Object.keys(o.rules)) {
      const r = o.rules[k]
      if (!ttAppIdOk(k)) errs.push(`options.rules.${k}: not an app id (the registry's shape: lowercase letters, digits and hyphens, 32 at most)`)
      else if (!isObj(r)) errs.push(`options.rules.${k}: an object { face?, set?, card?, offTable? }`)
      else for (const h of RULE_HOOKS) if (r[h] != null && !isFn(r[h])) errs.push(`options.rules.${k}.${h}: a function`)
    }
  }
  if (o.base != null && !https(o.base)) errs.push("options.base: Placecard's home, an http(s) address with no trailing slash")
  // one call's own
  if (o.set != null && !isObj(o.set)) errs.push('options.set: the card\'s set, as ttSetFromRegistry gives it')
  if (o.holding != null && typeof o.holding !== 'boolean' && !isObj(o.holding)) errs.push('options.holding: true, false, null or { collected, added }')
  if (o.meta != null && !isObj(o.meta)) errs.push('options.meta: an object')
  for (const k of ['sets', 'cards']) if (o[k] != null && !Array.isArray(o[k])) errs.push(`options.${k}: a list`)
  if (o.sort != null && typeof o.sort !== 'string') errs.push("options.sort: the sort the response was asked for ('newest')")
  return errs
}
function optionsOf(fn, options) {
  const errs = ttRegOptionsErrors(options)
  if (errs.length) fail(fn, errs)
  return options || {}
}

// ── One card's fields, whichever source it came from
/**
 * A registry row or a /me/cards tile as one field set: { app, set, key, uuid, type, title, subtitle, fact, rarity,
 * foil, image, credit, license, url, lat, lng, data, retired, place }. A tile has no type, credit or license, its
 * `url` is read when it sends one, its `subtitle` is the row's fact when it has one (so it is the fact here), and its
 * data is { number }.
 */
export function ttRegFields(c) {
  if (isTile(c)) {
    return {
      app: c.app, set: c.set, key: String(c.key), uuid: c.id ?? null, type: null, title: c.title || '',
      subtitle: null, fact: c.subtitle || null, rarity: c.rarity || null, foil: c.foil === true,
      image: c.image || null, credit: null, license: null, url: c.url || null, lat: c.lat ?? null, lng: c.lng ?? null,
      data: { number: c.number ?? null }, retired: c.retired === true, place: c.place || null,
    }
  }
  return {
    app: c.app_id, set: c.set_id, key: String(c.card_key), uuid: c.id ?? null, type: c.card_type || null,
    title: c.title || '', subtitle: c.subtitle || null, fact: c.fact || null, rarity: c.rarity || null,
    foil: c.foil === true, image: c.image_url || null, credit: c.image_credit || null,
    license: c.image_license || null, url: c.url || null, lat: c.lat ?? null, lng: c.lng ?? null,
    data: c.data || {}, retired: c.status === 'retired', place: null,
  }
}
const cardRef = r => `${r.app}/${r.set}/${r.key}`

/**
 * The credit line. A credit already written as a line ("Photo: ...") is kept as stored; a bare name gets "Photo: ",
 * its license, and "via Wikimedia Commons" when the photo is on Commons. null with no photo, or with neither a credit
 * nor a license (never a bare host).
 */
export function ttRegCredit(r) {
  const c = String((r && r.credit) || '').trim()
  if (!r || !r.image || (!c && !r.license)) return null
  if (/^photo\s*[:·]/i.test(c)) return c
  const parts = [c]
  if (r.license && !c.toLowerCase().includes(String(r.license).toLowerCase())) parts.push(r.license)
  if (/^https:\/\/upload\.wikimedia\.org\//i.test(r.image) && !/wikimedia/i.test(c)) parts.push('via Wikimedia Commons')
  const line = parts.filter(Boolean).join(', ')
  return line ? `Photo: ${line}` : null
}

// holding: undefined (a tile is held when `mine`, a row is held with no date), null or false (not held: a Missing
// card), true (held, no date), or { collected, added } (held; collected a date, added higher for newer)
function holdingOf(c, h) {
  const none = { held: false, collected: null, added: null }
  if (h === undefined) {
    if (!isTile(c)) return { held: true, collected: null, added: null }
    return c.mine === true ? { held: true, collected: isoDay(c.sort_at ?? c.collected_at), added: null } : none
  }
  if (!h) return none
  if (h === true) return { held: true, collected: null, added: null }
  return { held: true, collected: isoDay(h.collected), added: numOr(h.added) }
}

/**
 * The face a card takes: its app's rule (`rules[app].face(fields, set)`, when it names one), else its set's
 * meta.face, else its app record's `face`, else the options' `face`, else 'destination'. A face counts when it is a
 * kit face or one the options declare in `faces`; one that is neither is passed over, except from a rule, which is
 * refused. fields: ttRegFields of the card; set: its set as ttSetFromRegistry gives it.
 */
export function ttRegFace(fields, set = null, options = {}) {
  const o = optionsOf('ttRegFace', options)
  if (!isObj(fields) || !ttAppIdOk(fields.app)) fail('ttRegFace', ['fields: a card\'s fields (ttRegFields) with its app'])
  return faceOf(fields, set, o)
}
function faceOf(r, set, o) {
  const rule = ruleOf(o, r.app)
  if (rule && isFn(rule.face)) {
    const f = rule.face(r, set)
    if (f != null) {
      if (!faceOk(f, o)) throw new TypeError(`options.rules.${r.app}.face gave '${f}', which is not a kit face (${TT_FACES.join(', ')}) or one of options.faces`)
      return f
    }
  }
  const m = set && isObj(set.meta) ? set.meta.face : undefined
  if (faceOk(m, o)) return m
  const a = appOf(o, r.app)
  if (a && faceOk(a.face, o)) return a.face
  return faceOk(o.face, o) ? o.face : TT_REG_DEFAULT_FACE
}

// ── A set
function setErrors(s, at) {
  if (!isObj(s)) return [`${at}: a placecard_sets row ({ app_id, id, name, meta }) or a /me/cards set ({ app, set, name, held, total })`]
  const errs = []
  const row = !!s.app_id
  if (!ttAppIdOk(s.app_id || s.app)) errs.push(`${at}.${row ? 'app_id' : 'app'}: an app id (the registry's shape: lowercase letters, digits and hyphens, 32 at most)`)
  if (!isStr(row ? s.id : s.set)) errs.push(`${at}.${row ? 'id' : 'set'}: the set's id`)
  if (!strOrNone(s.name)) errs.push(`${at}.name: a string`)
  return errs
}

// A set row given for its meta and name: { app_id, id } (a placecard_sets row), or { app, set } or { app, id }
function rowErrors(s, at) {
  if (!isObj(s)) return [`${at}: a placecard_sets row ({ app_id, id, name, meta })`]
  const errs = []
  if (!ttAppIdOk(s.app_id || s.app)) errs.push(`${at}.app_id: an app id (the registry's shape: lowercase letters, digits and hyphens, 32 at most)`)
  if (!isStr(s.app_id ? s.id : s.set ?? s.id)) errs.push(`${at}.id: the set's id`)
  if (s.meta != null && !isObj(s.meta)) errs.push(`${at}.meta: an object`)
  return errs
}

/**
 * A registry set as the kit's set. s: a placecard_sets row ({ app_id, id, name, meta }) or a set of the /me/cards
 * response ({ app, set, name, held, total }). Options: meta (a row's meta, for a /me/cards set), total (the set's
 * current cards), held (the person's), and the shared rules.
 * Out: { id, app, name, short (meta.short, else the name, in capitals), total, kind (the app id),
 * action ('Open in Placecard'), meta: { face } (when its meta.face is a face that counts, see ttRegFace), held (when
 * known) }, then the app's rule (`rules[app].set(set, { row, meta, options })`: the fields to set, or changes made
 * in place).
 */
export function ttSetFromRegistry(s, options = {}) {
  const o = optionsOf('ttSetFromRegistry', options)
  const errs = setErrors(s, 'set')
  if (errs.length) fail('ttSetFromRegistry', errs)
  return setOf(s, o)
}
function setOf(s, o) {
  const app = s.app_id || s.app
  const id = s.app_id ? s.id : s.set
  const m = s.meta || o.meta || {}
  const name = s.name || id
  const out = { id, app, name, short: upper(m.short || name), total: numOr(o.total ?? s.total), kind: app, action: OPEN_PLACECARD }
  if (faceOk(m.face, o)) out.meta = { face: m.face }
  const rule = ruleOf(o, app)
  if (rule && isFn(rule.set)) apply(out, rule.set(out, { row: s, meta: m, options: o }))
  const h = numOr(o.held ?? s.held)
  if (h != null) out.held = h
  return out
}

// ── A card
function cardErrors(c, at) {
  if (!isObj(c)) return [`${at}: a registry row ({ app_id, set_id, card_key, ... }) or a /me/cards tile ({ app, set, key, ... })`]
  const tile = isTile(c)
  const errs = []
  if (c.card_key == null && c.key == null) return [`${at}: no card_key (a row) or key (a tile)`]
  if (!ttAppIdOk(tile ? c.app : c.app_id)) errs.push(`${at}.${tile ? 'app' : 'app_id'}: an app id (the registry's shape: lowercase letters, digits and hyphens, 32 at most)`)
  if (!isStr(tile ? c.set : c.set_id)) errs.push(`${at}.${tile ? 'set' : 'set_id'}: the card's set id`)
  const key = tile ? c.key : c.card_key
  if (!(isStr(key) || (typeof key === 'number' && isFinite(key)))) errs.push(`${at}.${tile ? 'key' : 'card_key'}: the card's key`)
  return errs
}

/**
 * One registry card (a placecard_cards row or a /me/cards tile) as the kit's card. Options: set (its set, from
 * ttSetFromRegistry), holding (see below), base (Placecard's home), and the shared rules.
 * holding: left out, a row is held with no date and a tile is held when it is the person's (`mine`); null or false,
 * not held (a Missing card); true, held with no date; { collected, added }, held (collected: a date or a time, kept
 * as its day; added: higher for newer).
 *
 * The mapping, for every app (row field: card field):
 *   id: '<app>:<set>:<key>'; face: ttRegFace; title; fact (else subtitle) as fact, and subtitle as subtitle and type
 *   only beside a fact; data.story as back; data.number and data.total (else the set's total) as number and of;
 *   rarity, ranked (rarityRank) on its set kind's list, else `ladder`, else Placecard's order; foil; the app's color
 *   as accent; image_url through `photo` as img, and in ref.photo; image_credit and image_license as credit
 *   (ttRegCredit); the card's own url (http or https) as href, else Placecard's card page, which is always
 *   ref.placecard; the action its set names, else 'Open in <the app's name>' on the card's own url ('Open' when the
 *   app has no name), else 'Open in Placecard';
 *   ref: { app, set, key, uuid, cardType, lat, lng, photo, place, address (data.address), placecard, retired }.
 * Then the app's rule: `rules[app].card(card, fields, { set, base, page, face, rank, options })` gives the fields to
 * set (its `ref` merged into the card's) or changes the card in place; rank(kind, word) is the word's place in that
 * kind's list. Last, a card the person reported carries reportedByMe: true, and the person's own card ref.own: true
 * (only when the source says so).
 */
export function ttFromRegistry(card, options = {}) {
  const o = optionsOf('ttFromRegistry', options)
  const errs = cardErrors(card, 'card')
  if (errs.length) fail('ttFromRegistry', errs)
  return cardOf(card, o)
}
function cardOf(card, o) {
  const set = o.set || null
  const base = o.base || TT_PLACECARD_BASE
  const r = ttRegFields(card)
  const face = faceOf(r, set, o)
  const d = r.data
  const page = `${base}/card/${r.app}/${r.set}/${encodeURIComponent(r.key)}${r.place ? `?place=${encodeURIComponent(r.place)}` : ''}`
  const app = appOf(o, r.app)
  const own = ownPage(r.url)
  const setAction = set && set.action !== OPEN_PLACECARD ? set.action : null
  const out = {
    id: `${r.app}:${r.set}:${r.key}`,
    app: r.app,
    set: r.set,
    face,
    title: r.title,
    subtitle: r.fact ? r.subtitle : null,
    type: r.fact ? r.subtitle : null,
    fact: r.fact || r.subtitle,
    back: d.story || null,
    stats: [],
    number: numOr(d.number),
    of: numOr(d.total) ?? (set ? set.total : null),
    rarity: r.rarity,
    rarityRank: rankIn(ladderFor(o, set), r.rarity),
    rarityCount: null,
    foil: r.foil,
    accent: app ? app.color ?? null : null,
    chip: null,
    chipLabel: null,
    img: r.image ? (isFn(o.photo) ? o.photo(r.image, r) ?? null : r.image) : null,
    credit: ttRegCredit(r),
    href: own || page,
    action: setAction || (own ? (app && app.name ? `Open in ${app.name}` : 'Open') : OPEN_PLACECARD),
    ...holdingOf(card, o.holding),
    ref: {
      app: r.app, set: r.set, key: r.key, uuid: r.uuid, cardType: r.type, lat: r.lat, lng: r.lng,
      photo: r.image, place: r.place, address: d.address || null, placecard: page, retired: r.retired,
    },
  }
  const rule = ruleOf(o, r.app)
  if (rule && isFn(rule.card)) {
    const rank = (kind, word) => rankIn(ladderOf(o, kind), word)
    apply(out, rule.card(out, r, { set, base, page, face, rank, options: o }))
  }
  // moderation: a card this person reported (the contract's card key), and the person's own card (in ref)
  if (card.reportedByMe === true) out.reportedByMe = true
  if (card.own === true) out.ref.own = true
  return out
}

// A card that never goes on the table: an experience (a walk, a side quest), an app tile, or one the app's rule
// leaves off (`rules[app].offTable(fields, source)`)
function offTable(c, r, o) {
  if (isTile(c) ? c.kind === 'experience' || c.kind === 'app' : c.card_type === 'experience') return true
  const rule = ruleOf(o, r.app)
  return !!(rule && isFn(rule.offTable) && rule.offTable(r, c))
}

// ── A /me/cards response
/**
 * A whole GET /api/placecard/me/cards response as a collection: { apps, sets, rarities, cards }. Ask the endpoint
 * for limit=1000 (its cap), or the list stops short. Options, besides the shared rules:
 *   sets   placecard_sets rows ({ app_id, id, name, meta }), to give the sets their meta; without them a set has
 *          only its name, held and total
 *   cards  registry rows (or tiles) of the person's started sets; each one the person does not hold becomes a
 *          Missing card. Rows of sets the person has not started, retired rows and cards off the table are left
 *          out. Without them the table holds the held cards only
 *   sort   the sort the response was asked for; 'newest' gives `added` from its order (the first tile is the
 *          newest). A tile's own sort_at or collected_at, when present, wins
 * Cards off the table (experiences, app tiles, an app's rule) are left out, and a card listed twice is one card.
 * sets: the response's started sets in its order, then any set a tile names that the list lacks, with no total.
 * apps: the `apps` records of the apps present, in their order, then any other app present as { id, name: id,
 * color: null }. rarities: each `rarities` list whose kind a set has.
 */
export function ttFromMeCards(res, options = {}) {
  const o = optionsOf('ttFromMeCards', options)
  const errs = []
  if (res != null && !isObj(res)) errs.push('res: the GET /api/placecard/me/cards response, an object')
  const tilesIn = isObj(res) ? res.tiles : undefined
  const setsIn = isObj(res) ? res.sets : undefined
  if (tilesIn != null && !Array.isArray(tilesIn)) errs.push('res.tiles: a list')
  if (setsIn != null && !Array.isArray(setsIn)) errs.push('res.sets: a list')
  if (Array.isArray(tilesIn)) tilesIn.forEach((t, i) => { if (t != null) errs.push(...cardErrors(t, `res.tiles[${i}]`)) })
  if (Array.isArray(setsIn)) setsIn.forEach((e, i) => errs.push(...setErrors(e, `res.sets[${i}]`)))
  ;(o.sets || []).forEach((s, i) => errs.push(...rowErrors(s, `options.sets[${i}]`)))
  ;(o.cards || []).forEach((c, i) => errs.push(...cardErrors(c, `options.cards[${i}]`)))
  if (errs.length) fail('ttFromMeCards', errs)

  const rules = rulesOf(o)
  const base = o.base || TT_PLACECARD_BASE
  const keyOf = s => `${s.app_id || s.app}/${s.app_id ? s.id : s.set ?? s.id}`
  const metaOf = new Map((o.sets || []).map(s => [keyOf(s), s.meta || {}]))
  const nameOf = new Map((o.sets || []).map(s => [keyOf(s), s.name]))
  const sets = []
  const setBy = new Map()
  const addSet = (entry) => {
    const k = `${entry.app}/${entry.set}`
    if (!setBy.has(k)) {
      const s = setOf({ ...entry, name: entry.name || nameOf.get(k) }, { ...rules, meta: metaOf.get(k) || null })
      setBy.set(k, s)
      sets.push(s)
    }
    return setBy.get(k)
  }
  const started = new Set()
  for (const e of setsIn || []) {
    addSet({ app: e.app, set: e.set, name: e.name, held: e.held, total: e.total })
    started.add(`${e.app}/${e.set}`)
  }

  // held tiles, one per card
  const seen = new Set()
  const tiles = []
  for (const t of tilesIn || []) {
    if (!t) continue
    const r = ttRegFields(t)
    if (offTable(t, r, rules) || seen.has(cardRef(r))) continue
    seen.add(cardRef(r))
    tiles.push(t)
  }
  const times = tiles.map(t => Date.parse(t.sort_at ?? t.collected_at ?? ''))
  const dated = times.map((ms, i) => ({ ms, i })).filter(x => isFinite(x.ms)).sort((a, b) => a.ms - b.ms || b.i - a.i)
  const added = new Array(tiles.length).fill(null)
  if (dated.length) dated.forEach((x, n) => { added[x.i] = n + 1 })
  else if (o.sort === 'newest') tiles.forEach((t, i) => { added[i] = tiles.length - i })

  const cards = tiles.map((t, i) => {
    const r = ttRegFields(t)
    const set = addSet({ app: r.app, set: r.set })
    return cardOf(t, { ...rules, set, base, holding: { collected: t.sort_at ?? t.collected_at ?? null, added: added[i] } })
  })

  // Missing cards: only of started sets, and only from the cards the caller passed
  for (const c of o.cards || []) {
    const r = ttRegFields(c)
    if (!started.has(`${r.app}/${r.set}`) || seen.has(cardRef(r)) || r.retired || offTable(c, r, rules)) continue
    seen.add(cardRef(r))
    cards.push(cardOf(c, { ...rules, set: setBy.get(`${r.app}/${r.set}`), base, holding: null }))
  }

  const present = new Set([...sets.map(s => s.app), ...cards.map(c => c.app)])
  const listed = (Array.isArray(o.apps) ? o.apps : []).filter(a => isObj(a) && present.has(a.id)).map(a => a.id)
  const apps = [...listed, ...[...present].filter(id => !listed.includes(id))].map(id => appEntry(o, id))
  return { apps, sets, rarities: raritiesOf(o, sets), cards }
}
function raritiesOf(o, sets) {
  const out = {}
  if (isObj(o.rarities)) for (const kind of Object.keys(o.rarities)) if (!UNSAFE.has(kind) && sets.some(s => s.kind === kind)) out[kind] = o.rarities[kind]
  return out
}

// ── An outside app's own set
// A card of the set as the app sent it (the v1 API's card: { key, type, parent?, title, subtitle?, fact?, rarity?,
// foil?, image?: { url, credit?, license? }, url?, lat?, lng?, data?, status? }) as a registry row
const rowOf = (app, set, c) => {
  const img = isObj(c.image) ? c.image : {}
  return {
    id: null, app_id: app, set_id: set, card_key: c.key, card_type: c.type, title: c.title,
    subtitle: c.subtitle ?? null, fact: c.fact ?? null, rarity: c.rarity ?? null, foil: c.foil === true,
    image_url: img.url ?? null, image_credit: img.credit ?? null, image_license: img.license ?? null,
    url: c.url ?? null, lat: numOr(c.lat), lng: numOr(c.lng), data: isObj(c.data) ? c.data : {},
    status: c.status === 'retired' ? 'retired' : 'active',
  }
}
const dateOk = v => v == null || typeof v === 'string' || (typeof v === 'number' && isFinite(v)) || v instanceof Date

/**
 * Every problem with ttFromAppSet's input, as strings (empty: it is good). Fields neither reads are not problems.
 */
export function ttAppSetErrors(set, collects, options) {
  // the shared rules only: a set or holding in the options is not read here
  const errs = isObj(options) ? ttRegOptionsErrors(rulesOf(options)) : ttRegOptionsErrors(options)
  if (!isObj(set)) return [...errs, 'set: your set as you sent it to PUT /v1/sets/:set, with its id and your app id: { id, app, name, meta?, cards }']
  const col = isObj(collects) ? collects : null
  if (collects != null && !col) errs.push('collects: the GET /v1/sets/:set/collects response, or null when no one is signed in')
  const app = set.app ?? (col ? col.app : undefined)
  const id = set.id ?? (col ? col.set : undefined)
  if (!ttAppIdOk(app)) errs.push("set.app: your app's id (the registry's shape: lowercase letters, digits and hyphens, 32 at most)")
  if (typeof id !== 'string' || !TT_REG_SET_ID_RE.test(id)) errs.push("set.id: the set's id, as in /v1/sets/:set (lowercase letters, digits, underscores and hyphens, starting with a letter or digit, 64 at most)")
  if (col && col.app != null && col.app !== app) errs.push(`collects.app: '${col.app}', but the set is ${app}'s`)
  if (col && col.set != null && col.set !== id) errs.push(`collects.set: '${col.set}', but the set is '${id}'`)
  if (typeof set.name !== 'string' || !set.name.trim()) errs.push("set.name: the set's name")
  if (set.meta != null && !isObj(set.meta)) errs.push('set.meta: an object')
  if (set.cards != null && !Array.isArray(set.cards)) errs.push('set.cards: a list of cards')
  const lines = []
  const keys = new Set()
  ;(Array.isArray(set.cards) ? set.cards : []).forEach((c, i) => {
    const at = `set.cards[${i}]`
    if (!isObj(c)) { lines.push(`${at}: a card { key, type, title, ... }`); return }
    if (typeof c.key !== 'string' || !TT_REG_KEY_RE.test(c.key)) lines.push(`${at}.key: letters, digits and : _ . or hyphen, starting with a letter or digit, 128 at most`)
    else if (keys.has(c.key)) lines.push(`${at}.key: '${c.key}' twice`)
    else keys.add(c.key)
    if (typeof c.type !== 'string' || !TT_REG_TYPE_RE.test(c.type)) lines.push(`${at}.type: a lowercase word, 32 at most`)
    if (typeof c.title !== 'string' || !c.title) lines.push(`${at}.title: the card's title`)
    for (const k of ['subtitle', 'fact', 'rarity', 'url']) if (!strOrNone(c[k])) lines.push(`${at}.${k}: a string`)
    if (c.image != null) {
      if (!isObj(c.image)) lines.push(`${at}.image: { url, credit?, license? }`)
      else for (const k of ['url', 'credit', 'license']) if (!strOrNone(c.image[k])) lines.push(`${at}.image.${k}: a string`)
    }
    if (c.data != null && !isObj(c.data)) lines.push(`${at}.data: an object`)
    if (c.status != null && c.status !== 'active' && c.status !== 'retired') lines.push(`${at}.status: active or retired`)
  })
  if (col) {
    if (!Array.isArray(col.cards)) lines.push('collects.cards: a list of { key, collectedAt }')
    else col.cards.forEach((c, i) => {
      const at = `collects.cards[${i}]`
      if (!isObj(c)) lines.push(`${at}: { key, collectedAt }`)
      else {
        if (!isStr(c.key)) lines.push(`${at}.key: the card's key`)
        if (!dateOk(c.collectedAt)) lines.push(`${at}.collectedAt: a time`)
      }
    })
  }
  return [...errs, ...lines]
}

/**
 * An outside app's own set, with one person's collects, as a collection the table draws: { apps, sets, rarities,
 * cards }. The app fetches both (its key stays on its server): set is the JSON it sent to PUT /v1/sets/:set, with
 * `id` (the :set) and `app` (its app id) added, or taken from the collects; collects is the answer of
 * GET /v1/sets/:set/collects for that person, or null when no one is signed in (nothing held). Options: the shared
 * rules.
 * - cards: each card of the set, in the set's order, by ttFromRegistry. Held: those in the collects, collected on
 *   their first collect's day, added by their place there (the first collect 1). A retired card shows only when
 *   held; an experience, and a card the app's rule leaves off, never shows. A collect of a key the set no longer
 *   lists is left out. A card's `parent` is not read.
 * - sets: the one set (ttSetFromRegistry), its total the cards on the table that are not retired, held the held ones.
 * - apps: the app's record from `apps`, else { id, name: id, color: null }.
 * - rarities: the list the set's cards rank on, under its kind.
 */
export function ttFromAppSet(set, collects, options = {}) {
  const errs = ttAppSetErrors(set, collects, options)
  if (errs.length) fail('ttFromAppSet', errs)
  const o = options || {}
  const rules = rulesOf(o)
  const col = isObj(collects) ? collects : null
  const app = set.app ?? col.app
  const id = set.id ?? col.set
  const held = new Map()
  ;(col ? col.cards : []).forEach((c) => {
    if (!held.has(c.key)) held.set(c.key, { collected: c.collectedAt instanceof Date ? c.collectedAt : (typeof c.collectedAt === 'number' ? new Date(c.collectedAt) : c.collectedAt ?? null), added: held.size + 1 })
  })
  const rows = (set.cards || []).map(c => rowOf(app, id, c)).filter((row) => {
    if (offTable(row, ttRegFields(row), rules)) return false
    return row.status !== 'retired' || held.has(row.card_key)
  })
  const total = rows.filter(r => r.status !== 'retired').length
  const heldN = rows.filter(r => held.has(r.card_key)).length
  const kitSet = setOf({ app_id: app, id, name: set.name, meta: set.meta || null }, { ...rules, total, held: heldN })
  const cards = rows.map(row => cardOf(row, { ...rules, set: kitSet, holding: held.has(row.card_key) ? held.get(row.card_key) : null }))
  return {
    apps: [appEntry(o, app)],
    sets: [kitSet],
    rarities: { [kitSet.kind]: ladderFor(o, kitSet) },
    cards,
  }
}
