// The registry subpath for an app the kit has never heard of, with no options: the generic mapping, the face from a
// set's meta.face, the app's color from `apps`, the shared rules one at a time, and refusals of bad input.
import { describe, it, expect } from 'vitest'
import {
  CONTRACT_VERSION, TT_PLACECARD_BASE, TT_PLACECARD_RARITIES, TT_REG_DEFAULT_FACE, ttAppSetErrors, ttFromAppSet,
  ttFromMeCards, ttFromRegistry, ttRegCredit, ttRegFace, ttRegFields, ttRegOptionsErrors, ttSetFromRegistry,
} from '../../registry/index.js'
import { ttCollectionErrors, ttLook, ttFaceOf, ttGroup } from '../../core/index.js'
import pkg from '../../package.json'

const SET_ROW = { app_id: 'bird-walk', id: 'prospect-park', name: 'Prospect Park', meta: { listed: true } }
const ROW = {
  id: 'f3a0c1d2-0000-4000-8000-000000000001', app_id: 'bird-walk', set_id: 'prospect-park', card_key: 'warbler:yellow',
  card_type: 'bird', title: 'Yellow Warbler', subtitle: 'Setophaga petechia', fact: 'Seen in May', rarity: 'Uncommon', foil: true,
  image_url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Warbler.jpg', image_credit: 'A. Birder',
  image_license: 'CC BY-SA 4.0', url: 'https://birds.example/warbler', lat: 40.66, lng: -73.97,
  data: { number: 7, total: 40, story: 'It sings sweet sweet sweet.', address: 'The Ravine' }, status: 'active',
}
const TILE = {
  kind: 'card', app: 'bird-walk', set: 'prospect-park', key: 'warbler:yellow', id: ROW.id, title: 'Yellow Warbler',
  subtitle: 'Seen in May', rarity: 'Uncommon', foil: true, image: ROW.image_url, lat: 40.66, lng: -73.97, mine: true, number: 7,
}
const PAGE = `${TT_PLACECARD_BASE}/card/bird-walk/prospect-park/warbler%3Ayellow`

describe('a fourth app, no options', () => {
  const set = ttSetFromRegistry(SET_ROW, { total: 40 })
  const card = ttFromRegistry(ROW, { set })

  it('its set: kind is the app id, the action opens Placecard, no meta without a face', () => {
    expect(set).toEqual({ id: 'prospect-park', app: 'bird-walk', name: 'Prospect Park', short: 'PROSPECT PARK', total: 40, kind: 'bird-walk', action: 'Open in Placecard' })
    expect(ttSetFromRegistry({ app: 'bird-walk', set: 'prospect-park', name: 'Prospect Park', held: 3, total: '40' })).toEqual({ ...set, held: 3 })
  })

  it('its card: the generic mapping, the default face, no accent, ranked on Placecard\'s order', () => {
    expect(TT_REG_DEFAULT_FACE).toBe('destination')
    expect(card).toEqual({
      id: 'bird-walk:prospect-park:warbler:yellow', app: 'bird-walk', set: 'prospect-park', face: 'destination',
      title: 'Yellow Warbler', subtitle: 'Setophaga petechia', type: 'Setophaga petechia', fact: 'Seen in May',
      back: 'It sings sweet sweet sweet.', stats: [], number: 7, of: 40, rarity: 'Uncommon', rarityRank: 3, rarityCount: null,
      foil: true, accent: null, chip: null, chipLabel: null, img: ROW.image_url,
      credit: 'Photo: A. Birder, CC BY-SA 4.0, via Wikimedia Commons', href: ROW.url, action: 'Open',
      held: true, collected: null, added: null,
      ref: {
        app: 'bird-walk', set: 'prospect-park', key: 'warbler:yellow', uuid: ROW.id, cardType: 'bird', lat: 40.66, lng: -73.97,
        photo: ROW.image_url, place: null, address: 'The Ravine', placecard: PAGE, retired: false,
      },
    })
    expect(TT_PLACECARD_RARITIES.indexOf('Uncommon')).toBe(3)
    // a row with no fact prints its subtitle as the fact, no subtitle line; no number or total: the set's
    const plain = ttFromRegistry({ ...ROW, fact: null, data: {} }, { set })
    expect([plain.subtitle, plain.type, plain.fact, plain.back, plain.number, plain.of]).toEqual([null, null, 'Setophaga petechia', null, null, 40])
  })

  it('its tile: the same card, held when it is the person\'s, its date kept as a day', () => {
    const t = ttFromRegistry({ ...TILE, sort_at: '2026-11-01T22:10:00Z' }, { set })
    expect(t).toMatchObject({ id: card.id, face: 'destination', fact: 'Seen in May', subtitle: null, number: 7, of: 40, held: true, collected: '2026-11-01', credit: null })
    expect(ttFromRegistry({ ...TILE, mine: false }, { set })).toMatchObject({ held: false, collected: null })
    expect(ttRegFields(TILE)).toMatchObject({ app: 'bird-walk', set: 'prospect-park', key: 'warbler:yellow', type: null, fact: 'Seen in May', data: { number: 7 } })
  })

  it('a /me/cards response with it: the app listed by its id with no color, no rarities without the option', () => {
    const out = ttFromMeCards({ tiles: [TILE], sets: [{ app: 'bird-walk', set: 'prospect-park', name: 'Prospect Park', held: 1, total: 40 }] })
    expect(out.apps).toEqual([{ id: 'bird-walk', name: 'bird-walk', color: null }])
    expect(out.rarities).toEqual({})
    expect(out.cards.map(c => [c.id, c.face, c.held])).toEqual([['bird-walk:prospect-park:warbler:yellow', 'destination', true]])
    expect(ttGroup(out.cards, 'set', out).map(g => [g.id, g.held, g.total])).toEqual([['set:prospect-park', 1, 40]])
  })

  it('every value the subpath exports is the kit\'s own version', () => {
    expect(CONTRACT_VERSION).toBe(pkg.version)
  })
})

describe('the app\'s record: its color and its face', () => {
  const apps = [{ id: 'bird-walk', name: 'Bird walk', color: '#B4432F', site: 'birds.example' }]

  it('its color is its cards\' accent and its mark; its name and site are listed', () => {
    const set = ttSetFromRegistry(SET_ROW, { apps })
    expect(ttFromRegistry(ROW, { set, apps }).accent).toBe('#B4432F')
    const out = ttFromMeCards({ tiles: [TILE] }, { apps: [{ id: 'other-app', color: '#000' }, ...apps] })
    expect(out.apps).toEqual([{ id: 'bird-walk', name: 'Bird walk', color: '#B4432F', site: 'birds.example' }])
    expect(ttFromMeCards({ tiles: [TILE] }, { apps: [{ id: 'bird-walk' }] }).apps).toEqual([{ id: 'bird-walk', name: 'bird-walk', color: null }])
  })

  it('its face draws its cards when their set names none', () => {
    const o = { apps: [{ ...apps[0], face: 'studio' }] }
    expect(ttFromRegistry(ROW, o).face).toBe('studio')
    const set = ttSetFromRegistry({ ...SET_ROW, meta: { face: 'stop' } }, o)
    expect(ttFromRegistry(ROW, { ...o, set }).face).toBe('stop')
  })
})

describe('the face: a set\'s meta.face, a declared face of the host\'s, the default', () => {
  it('a set naming a kit face carries it, and its cards take it', () => {
    for (const f of ['stop', 'destination', 'treehopper', 'studio']) {
      const set = ttSetFromRegistry({ ...SET_ROW, meta: { face: f } })
      expect(set.meta).toEqual({ face: f })
      expect(ttFromRegistry(ROW, { set }).face).toBe(f)
      expect(ttFaceOf(ttFromRegistry(ROW, { set }), { sets: [set] })).toBe(f)
    }
  })

  it('a host\'s own face counts only when the options declare it, as a list or as its config\'s faces', () => {
    const row = { ...SET_ROW, meta: { face: 'bird' } }
    const set0 = ttSetFromRegistry(row)
    expect('meta' in set0).toBe(false)
    expect(ttFromRegistry(ROW, { set: set0 }).face).toBe('destination')
    for (const faces of [['bird'], [{ id: 'bird' }], { bird: { base: 'studio' } }]) {
      const set = ttSetFromRegistry(row, { faces })
      expect(set.meta).toEqual({ face: 'bird' })
      expect(ttFromRegistry(ROW, { set, faces }).face).toBe('bird')
      // a face named in the options but not well formed is refused
    }
    expect(ttRegOptionsErrors({ faces: ['Bird'] })).toEqual(["options.faces: 'Bird' is not a face id (a lowercase letter, then letters, digits and hyphens, 32 at most)"])
  })

  it('names that are not faces are passed over: __proto__, constructor, an empty or odd value', () => {
    for (const face of ['__proto__', 'constructor', 'toString', '', 7, null, { face: 'stop' }]) {
      const set = ttSetFromRegistry({ ...SET_ROW, meta: { face } }, { faces: ['bird'] })
      expect('meta' in set, String(face)).toBe(false)
      expect(ttFromRegistry(ROW, { set }).face).toBe('destination')
    }
  })

  it('options.face sets the default; ttRegFace answers the same', () => {
    expect(ttFromRegistry(ROW, { face: 'studio' }).face).toBe('studio')
    expect(ttRegFace(ttRegFields(ROW), null, { face: 'stop' })).toBe('stop')
    expect(ttRegFace(ttRegFields(ROW))).toBe('destination')
    expect(ttRegOptionsErrors({ face: 'bird' })).toEqual(["options.face: 'bird' is not a kit face (stop, destination, treehopper, studio) or one of options.faces"])
    expect(ttRegOptionsErrors({ face: 'bird', faces: ['bird'] })).toEqual([])
  })

  it('a collection of these cards passes createTabletop\'s check when the config names the faces', () => {
    const faces = { bird: { base: 'studio' }, destination: {} }
    const set = ttSetFromRegistry({ ...SET_ROW, meta: { face: 'bird' } }, { faces })
    const coll = { apps: [], sets: [set, ttSetFromRegistry({ ...SET_ROW, id: 'other' })], rarities: {}, cards: [ttFromRegistry(ROW, { set, faces }), ttFromRegistry({ ...ROW, set_id: 'other' })] }
    expect(coll.cards.map(c => c.face)).toEqual(['bird', 'destination'])
    expect(ttCollectionErrors(coll, { faces })).toEqual([])
    expect(ttLook(coll.cards[0], { ...coll, faces }).base).toBe('studio')
  })
})

describe('the shared rules, one at a time', () => {
  it('photo: the table\'s photo from the url and the fields; ref.photo keeps the url', () => {
    const c = ttFromRegistry(ROW, { photo: (url, r) => `${url}?w=480&k=${r.key}` })
    expect(c.img).toBe(`${ROW.image_url}?w=480&k=warbler:yellow`)
    expect(c.ref.photo).toBe(ROW.image_url)
    expect(ttFromRegistry({ ...ROW, image_url: null }, { photo: () => 'x' }).img).toBe(null)
    expect(ttFromRegistry(ROW, { photo: () => undefined }).img).toBe(null)
  })

  it('rarities and ladder: a card ranks on its set kind\'s list, else the ladder, else Placecard\'s order', () => {
    const set = ttSetFromRegistry(SET_ROW)
    expect(ttFromRegistry(ROW, { set }).rarityRank).toBe(3)
    expect(ttFromRegistry(ROW, { set, ladder: ['Common', 'Uncommon', 'Rare'] }).rarityRank).toBe(1)
    expect(ttFromRegistry(ROW, { set, rarities: { 'bird-walk': ['Uncommon', 'Lucky'] }, ladder: ['Common', 'Uncommon'] }).rarityRank).toBe(0)
    expect(ttFromRegistry({ ...ROW, rarity: 'Lucky' }, { set, rarities: { 'bird-walk': ['Uncommon', 'Lucky'] } }).rarityRank).toBe(1)
    expect(ttFromRegistry({ ...ROW, rarity: 'Nope' }, { set }).rarityRank).toBe(0)
    const out = ttFromMeCards({ tiles: [TILE] }, { rarities: { 'bird-walk': ['Uncommon', 'Lucky'], other: ['A'] } })
    expect(out.rarities).toEqual({ 'bird-walk': ['Uncommon', 'Lucky'] })
  })

  it('base: Placecard\'s home for the card page', () => {
    expect(ttFromRegistry({ ...ROW, url: null }, { base: 'https://staging.placecard.io' }).href).toBe('https://staging.placecard.io/card/bird-walk/prospect-park/warbler%3Ayellow')
    expect(ttRegOptionsErrors({ base: 'https://placecard.io/' })).toEqual(["options.base: Placecard's home, an http(s) address with no trailing slash"])
  })

  it('rules: an app\'s face, set, card and offTable, each changing only that app', () => {
    const rules = {
      'bird-walk': {
        face: r => (r.type === 'bird' ? 'studio' : null),
        set: (out, { meta }) => ({ kind: 'birds', action: 'Open the walk', short: meta.listed ? 'LISTED' : out.short }),
        card: (out, r, ctx) => ({ href: r.url || ctx.page, rarityRank: ctx.rank('birds', r.rarity), ref: { birdId: r.key } }),
        offTable: r => r.type === 'nest',
      },
    }
    const o = { rules, rarities: { birds: ['Common', 'Uncommon'] } }
    const set = ttSetFromRegistry(SET_ROW, o)
    expect(set).toMatchObject({ kind: 'birds', action: 'Open the walk', short: 'LISTED' })
    const c = ttFromRegistry(ROW, { ...o, set })
    expect(c).toMatchObject({ face: 'studio', href: 'https://birds.example/warbler', rarityRank: 1, action: 'Open the walk' })
    expect(c.ref).toMatchObject({ birdId: 'warbler:yellow', key: 'warbler:yellow', placecard: PAGE })
    // a face rule that names nothing leaves the face to the set, the app, the default
    expect(ttFromRegistry({ ...ROW, card_type: 'place' }, { ...o, set }).face).toBe('destination')
    // another app is not touched
    expect(ttFromRegistry({ ...ROW, url: null, app_id: 'other-app' }, o)).toMatchObject({ face: 'destination', href: `${TT_PLACECARD_BASE}/card/other-app/prospect-park/warbler%3Ayellow` })
    // offTable leaves a card off a /me/cards collection, and off an app's set
    const nest = { ...TILE, key: 'nest:1' }
    expect(ttFromMeCards({ tiles: [TILE, nest] }, o).cards).toHaveLength(2) // a tile has no type: the rule reads the key or the type
    const off = { rules: { 'bird-walk': { offTable: r => /^nest:/.test(r.key) } } }
    expect(ttFromMeCards({ tiles: [TILE, nest] }, off).cards.map(c => c.ref.key)).toEqual(['warbler:yellow'])
  })

  it('a rule may change the card in place; its answer never sets __proto__ or constructor', () => {
    const card = (out) => { out.title = out.title.toUpperCase(); return JSON.parse('{"__proto__": {"polluted": 1}, "constructor": 1, "chip": "x", "ref": {"__proto__": {"bad": 1}, "k": 1}}') }
    const c = ttFromRegistry(ROW, { rules: { 'bird-walk': { card } } })
    expect(c.title).toBe('YELLOW WARBLER')
    expect(c.chip).toBe('x')
    expect(c.ref.k).toBe(1)
    expect(Object.getPrototypeOf(c)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(c.ref)).toBe(Object.prototype)
    expect(c.polluted).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(c, 'constructor')).toBe(false)
    expect({}.polluted).toBeUndefined()
  })

  it('a face rule that names a face that does not count is refused', () => {
    const rules = { 'bird-walk': { face: () => 'bird' } }
    expect(() => ttFromRegistry(ROW, { rules })).toThrow("options.rules.bird-walk.face gave 'bird', which is not a kit face (stop, destination, treehopper, studio) or one of options.faces")
    expect(ttFromRegistry(ROW, { rules, faces: ['bird'] }).face).toBe('bird')
  })

  it('apps named like Object\'s own keys are apps like any other', () => {
    for (const app of ['constructor', 'hasownproperty', 'tostring', 'valueof']) {
      const o = { rules: { other: {} }, rarities: { other: ['A'] }, apps: [{ id: 'other', color: '#111' }] }
      const set = ttSetFromRegistry({ app_id: app, id: 's', name: 'S', meta: { face: 'constructor' } }, o)
      expect(set).toEqual({ id: 's', app, name: 'S', short: 'S', total: null, kind: app, action: 'Open in Placecard' })
      const c = ttFromRegistry({ ...ROW, app_id: app, set_id: 's' }, { ...o, set })
      expect(c).toMatchObject({ app, face: 'destination', accent: null, rarityRank: 3 })
      const out = ttFromMeCards({ tiles: [{ ...TILE, app, set: 's' }] }, o)
      expect(out.apps).toEqual([{ id: app, name: app, color: null }])
      expect(out.rarities).toEqual({})
    }
  })
})

describe('bad input is refused with one TypeError listing each problem; fields it does not read never are', () => {
  it('a card that is not a row or a tile, or lacks its app, set or key', () => {
    expect(() => ttFromRegistry(null)).toThrow(TypeError)
    expect(() => ttFromRegistry(null)).toThrow('ttFromRegistry: 1 input error\n- card: a registry row ({ app_id, set_id, card_key, ... }) or a /me/cards tile ({ app, set, key, ... })')
    expect(() => ttFromRegistry({ app_id: 'bird-walk', set_id: 'p' })).toThrow('card: no card_key (a row) or key (a tile)')
    expect(() => ttFromRegistry({ ...ROW, app_id: 'Bird Walk', set_id: '' })).toThrow(/2 input errors\n- card\.app_id: an app id .*\n- card\.set_id: the card's set id/)
    expect(() => ttFromRegistry({ ...TILE, app: undefined })).toThrow('card.app: an app id')
    expect(() => ttFromRegistry({ ...ROW, card_key: {} })).toThrow("card.card_key: the card's key")
  })

  it('a set that is not a row or a /me/cards set', () => {
    expect(() => ttSetFromRegistry('prospect-park')).toThrow('ttSetFromRegistry: 1 input error\n- set: a placecard_sets row')
    expect(() => ttSetFromRegistry({ app_id: 'bird-walk' })).toThrow("set.id: the set's id")
    expect(() => ttSetFromRegistry({ app: 'bird-walk', set: 'p', name: 5 })).toThrow('set.name: a string')
  })

  it('options: each problem listed, unknown keys ignored', () => {
    expect(ttRegOptionsErrors(undefined)).toEqual([])
    expect(ttRegOptionsErrors({ zzz: 1, chips: [1], set: null, holding: undefined })).toEqual([])
    expect(ttRegOptionsErrors('x')).toEqual(['options: an object'])
    expect(ttRegOptionsErrors({
      apps: [{ id: 'bird-walk' }, { id: 'bird-walk' }, null, { id: 'Bad' }, { id: 'ok-app', name: 5, face: 'nope' }],
      photo: 'x', rarities: { a: 'x', b: [1] }, ladder: [2], rules: { 'Bad App': {}, ok: { face: 'studio' }, also: 'x' },
      set: 'prospect-park', holding: 'yes', meta: [], sets: {}, cards: 'x', sort: 1, faces: 'x',
    })).toEqual([
      "options.faces: a list of face ids, or a config's faces",
      "options.apps[1].id: 'bird-walk' twice",
      'options.apps[2]: an object { id, name?, color?, site?, face? }',
      "options.apps[3].id: an app id (the registry's shape: lowercase letters, digits and hyphens, 32 at most)",
      'options.apps[4].name: a string',
      "options.apps[4].face: 'nope' is not a kit face (stop, destination, treehopper, studio) or one of options.faces",
      'options.photo: a function (url, fields) returning the photo the table shows',
      'options.rarities.a: a list of words, low to high',
      'options.rarities.b: a list of words, low to high',
      'options.ladder: a list of words, low to high',
      "options.rules.Bad App: not an app id (the registry's shape: lowercase letters, digits and hyphens, 32 at most)",
      'options.rules.ok.face: a function',
      'options.rules.also: an object { face?, set?, card?, offTable? }',
      "options.set: the card's set, as ttSetFromRegistry gives it",
      'options.holding: true, false, null or { collected, added }',
      'options.meta: an object',
      'options.sets: a list',
      'options.cards: a list',
      "options.sort: the sort the response was asked for ('newest')",
    ])
    expect(() => ttFromRegistry(ROW, { photo: 'x' })).toThrow('ttFromRegistry: 1 input error\n- options.photo: a function')
  })

  it('a /me/cards response that is not one; a null tile is skipped', () => {
    expect(() => ttFromMeCards('x')).toThrow('res: the GET /api/placecard/me/cards response, an object')
    expect(() => ttFromMeCards({ tiles: 'x', sets: {} })).toThrow(/2 input errors\n- res\.tiles: a list\n- res\.sets: a list/)
    expect(() => ttFromMeCards({ tiles: [TILE, 5] })).toThrow('res.tiles[1]: a registry row')
    expect(() => ttFromMeCards({ sets: [{ app: 'bird-walk' }] })).toThrow("res.sets[0].set: the set's id")
    expect(() => ttFromMeCards({}, { sets: [null], cards: [{}] })).toThrow(/options\.sets\[0\]: a placecard_sets row.*\n- options\.cards\[0\]: no card_key/)
    expect(ttFromMeCards({ tiles: [null, TILE, undefined] }).cards).toHaveLength(1)
    expect(ttFromMeCards(undefined)).toEqual({ apps: [], sets: [], rarities: {}, cards: [] })
    expect(ttFromMeCards({ tiles: [{ ...TILE, extra: { deep: [1] }, __proto__: { x: 1 } }], counts: 'any', more: null }).cards).toHaveLength(1)
  })

  it('more than 20 problems: the first 20, then a count', () => {
    const tiles = Array.from({ length: 25 }, () => 5)
    let msg = ''
    try { ttFromMeCards({ tiles }) } catch (e) { msg = e.message }
    expect(msg.split('\n')[0]).toBe('ttFromMeCards: 25 input errors')
    expect(msg.split('\n')).toHaveLength(22)
    expect(msg.endsWith('- and 5 more')).toBe(true)
  })

  it('ttRegCredit: a written line kept, a bare name given its license and Commons, nothing without a photo', () => {
    expect(ttRegCredit({ image: 'https://x/a.jpg', credit: 'Photo: someone', license: 'CC0' })).toBe('Photo: someone')
    expect(ttRegCredit({ image: 'https://upload.wikimedia.org/a.jpg', credit: 'Ana', license: 'CC BY 4.0' })).toBe('Photo: Ana, CC BY 4.0, via Wikimedia Commons')
    expect(ttRegCredit({ image: 'https://x/a.jpg', credit: 'Ana, CC0', license: 'cc0' })).toBe('Photo: Ana, CC0')
    expect(ttRegCredit({ image: null, credit: 'Ana' })).toBe(null)
    expect(ttRegCredit({ image: 'https://x/a.jpg' })).toBe(null)
    expect(ttRegCredit(null)).toBe(null)
  })

  it('the outside builder\'s checker is exported alone', () => {
    expect(ttAppSetErrors(null, null)).toEqual(['set: your set as you sent it to PUT /v1/sets/:set, with its id and your app id: { id, app, name, meta?, cards }'])
    expect(typeof ttFromAppSet).toBe('function')
  })
})
