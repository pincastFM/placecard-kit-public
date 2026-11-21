// @vitest-environment jsdom
// ttFromAppSet: an outside app's own set (the JSON it sent to PUT /v1/sets/:set) and one person's collects (the
// answer of GET /v1/sets/:set/collects: card keys and dates) into a collection the kit's table draws, the held cards
// held. Then the whole table mounted on it, with the app's own face, through createTabletop.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTabletop, setTtHost } from '../../vue/index.js'
import { ttFromAppSet, ttAppSetErrors, TT_PLACECARD_RARITIES } from '../../registry/index.js'
import { ttCollectionErrors, ttGroup, ttLook } from '../../core/index.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.animate = function () { return { cancel() {}, finish() {}, onfinish: null, oncancel: null } }
beforeEach(() => { setTtHost({ head: vi.fn(), distUnit: null }) })
afterEach(() => { setTtHost({ head: null, distUnit: null }) })

// The set as the app sent it, with its id and app id added
const SET = () => ({
  id: 'prospect-park',
  app: 'bird-walk',
  name: 'Prospect Park birds',
  meta: { short: 'Park', face: 'studio', season: 'spring' },
  cards: [
    { key: 'warbler-yellow', type: 'bird', title: 'Yellow Warbler', subtitle: 'Setophaga petechia', fact: 'Seen in May', rarity: 'Uncommon', image: { url: 'https://img.example/w.jpg', credit: 'Ana', license: 'CC BY 4.0' }, data: { number: 1, story: 'Sweet sweet sweet.' }, lat: 40.66, lng: -73.97 },
    { key: 'robin', type: 'bird', title: 'American Robin', rarity: 'Common', data: { number: 2 } },
    { key: 'heron-green', type: 'bird', title: 'Green Heron', rarity: 'Rare', foil: true, data: { number: 3 } },
    { key: 'owl', type: 'bird', title: 'Eastern Screech Owl', rarity: 'Unique', status: 'retired', data: { number: 4 } },
    { key: 'hawk', type: 'bird', title: 'Red-tailed Hawk', status: 'retired', data: { number: 5 } },
    { key: 'dawn-walk', type: 'experience', title: 'The dawn walk' },
    { key: 'nest-1', type: 'nest', title: 'A nest', parent: 'robin', extra: { any: 'thing' } },
  ],
})
// One person's collects, first collect first
const COLLECTS = () => ({
  app: 'bird-walk',
  set: 'prospect-park',
  held: { bird: 3 },
  cards: [
    { key: 'robin', type: 'bird', parent: null, via: null, collectedAt: '2026-11-01T13:05:00.000Z', lastCollectedAt: '2026-11-03T10:00:00.000Z', count: 2, source: 'logto' },
    { key: 'owl', type: 'bird', collectedAt: '2026-11-02T09:00:00.000Z' },
    { key: 'warbler-yellow', type: 'bird', collectedAt: '2026-11-04T18:30:00.000Z' },
    { key: 'gone', type: 'bird', collectedAt: '2026-11-05T08:00:00.000Z' },
    { key: 'robin', type: 'bird', collectedAt: '2026-11-06T08:00:00.000Z' },
  ],
})
const APPS = [{ id: 'bird-walk', name: 'Bird walk', color: '#B4432F', site: 'birds.example' }]

describe('ttFromAppSet', () => {
  const out = ttFromAppSet(SET(), COLLECTS(), { apps: APPS })

  it('one app, one set, the rarity list its cards rank on, the cards on the table in the set\'s order', () => {
    expect(out.apps).toEqual(APPS)
    expect(out.sets).toEqual([{
      id: 'prospect-park', app: 'bird-walk', name: 'Prospect Park birds', short: 'PARK', total: 4, kind: 'bird-walk',
      action: 'Open in Placecard', meta: { face: 'studio' }, held: 3,
    }])
    expect(out.rarities).toEqual({ 'bird-walk': TT_PLACECARD_RARITIES })
    // the retired hawk is not held, so it is gone; the retired owl is held, so it stays; the walk never shows
    expect(out.cards.map(c => c.ref.key)).toEqual(['warbler-yellow', 'robin', 'heron-green', 'owl', 'nest-1'])
  })

  it('the held cards: collected on their first collect\'s day, added by their place in the collects', () => {
    expect(out.cards.map(c => [c.ref.key, c.held, c.collected, c.added])).toEqual([
      ['warbler-yellow', true, '2026-11-04', 3],
      ['robin', true, '2026-11-01', 1],
      ['heron-green', false, null, null],
      ['owl', true, '2026-11-02', 2],
      ['nest-1', false, null, null],
    ])
    expect(out.cards.find(c => c.ref.key === 'owl').ref.retired).toBe(true)
  })

  it('each card is the registry mapping of its row: the set\'s face, the app\'s color, Placecard\'s card page', () => {
    const w = out.cards[0]
    expect(w).toMatchObject({
      id: 'bird-walk:prospect-park:warbler-yellow', app: 'bird-walk', set: 'prospect-park', face: 'studio',
      title: 'Yellow Warbler', subtitle: 'Setophaga petechia', fact: 'Seen in May', back: 'Sweet sweet sweet.',
      number: 1, of: 4, rarity: 'Uncommon', rarityRank: 3, foil: false, accent: '#B4432F', img: 'https://img.example/w.jpg',
      credit: 'Photo: Ana, CC BY 4.0', href: 'https://placecard.io/card/bird-walk/prospect-park/warbler-yellow',
      action: 'Open in Placecard',
    })
    expect(w.ref).toMatchObject({ uuid: null, cardType: 'bird', lat: 40.66, lng: -73.97, photo: 'https://img.example/w.jpg' })
    expect(out.cards[2]).toMatchObject({ foil: true, rarityRank: 4, img: null, credit: null })
    const [g] = ttGroup(out.cards, 'set', out)
    expect([g.id, g.held, g.total]).toEqual(['set:prospect-park', 3, 4])
    expect(ttLook(w, out)).toMatchObject({ face: 'studio', base: 'studio', ac: '#b4432f' })
  })

  it('no one signed in: nothing held; the id and app may come from the collects instead', () => {
    const none = ttFromAppSet(SET(), null)
    expect(none.cards.every(c => !c.held)).toBe(true)
    expect(none.cards.map(c => c.ref.key)).toEqual(['warbler-yellow', 'robin', 'heron-green', 'nest-1'])
    expect(none.sets[0]).toMatchObject({ total: 4, held: 0 })
    expect(none.apps).toEqual([{ id: 'bird-walk', name: 'bird-walk', color: null }])
    const { id, app, ...body } = SET()
    expect(ttFromAppSet(body, COLLECTS(), { apps: APPS })).toEqual(out)
    expect(ttFromAppSet({ ...SET(), cards: undefined }, { cards: [] }).cards).toEqual([])
  })

  it('collect times as Date objects or epoch milliseconds are read the same', () => {
    const c = COLLECTS()
    c.cards = c.cards.map((x, i) => ({ ...x, collectedAt: i % 2 ? new Date(x.collectedAt) : Date.parse(x.collectedAt) }))
    expect(ttFromAppSet(SET(), c, { apps: APPS })).toEqual(out)
  })

  it('the shared rules apply: a ladder, a host face, an app rule', () => {
    const faces = { bird: { base: 'studio' } }
    const rules = { 'bird-walk': { offTable: r => r.type === 'nest', card: (o, r) => ({ href: `https://birds.example/${r.key}` }) } }
    const o = ttFromAppSet({ ...SET(), meta: { face: 'bird' } }, COLLECTS(), { faces, rules, ladder: ['Common', 'Uncommon', 'Rare', 'Unique'] })
    expect(o.rarities).toEqual({ 'bird-walk': ['Common', 'Uncommon', 'Rare', 'Unique'] })
    expect(o.sets[0]).toMatchObject({ meta: { face: 'bird' }, total: 3, held: 3 })
    expect(o.cards.map(c => [c.ref.key, c.face, c.rarityRank, c.href])).toEqual([
      ['warbler-yellow', 'bird', 1, 'https://birds.example/warbler-yellow'],
      ['robin', 'bird', 0, 'https://birds.example/robin'],
      ['heron-green', 'bird', 2, 'https://birds.example/heron-green'],
      ['owl', 'bird', 3, 'https://birds.example/owl'],
    ])
    expect(ttCollectionErrors(o, { faces })).toEqual([])
  })

  it('refuses a set or collects it cannot read, listing each problem; fields it does not read are fine', () => {
    expect(ttAppSetErrors(SET(), COLLECTS(), { apps: APPS, zzz: 1, set: 'ignored' })).toEqual([])
    const bad = {
      id: 'Prospect Park', app: 'Bird', name: '', meta: [],
      cards: [null, { key: 'a b', type: 'Bird', title: '' }, { key: 'x', type: 'bird', title: 'X', subtitle: 5, image: { url: 7 }, data: 'd', status: 'gone' }, { key: 'x', type: 'bird', title: 'X2', image: 'url' }],
    }
    expect(ttAppSetErrors(bad, { app: 'other', set: 'other', cards: [{ key: '' }, 'x', { key: 'k', collectedAt: {} }] })).toEqual([
      "set.app: your app's id (the registry's shape: lowercase letters, digits and hyphens, 32 at most)",
      "set.id: the set's id, as in /v1/sets/:set (lowercase letters, digits, underscores and hyphens, starting with a letter or digit, 64 at most)",
      "collects.app: 'other', but the set is Bird's",
      "collects.set: 'other', but the set is 'Prospect Park'",
      "set.name: the set's name",
      'set.meta: an object',
      'set.cards[0]: a card { key, type, title, ... }',
      'set.cards[1].key: letters, digits and : _ . or hyphen, starting with a letter or digit, 128 at most',
      'set.cards[1].type: a lowercase word, 32 at most',
      "set.cards[1].title: the card's title",
      'set.cards[2].subtitle: a string',
      'set.cards[2].image.url: a string',
      'set.cards[2].data: an object',
      'set.cards[2].status: active or retired',
      "set.cards[3].key: 'x' twice",
      'set.cards[3].image: { url, credit?, license? }',
      "collects.cards[0].key: the card's key",
      'collects.cards[1]: { key, collectedAt }',
      'collects.cards[2].collectedAt: a time',
    ])
    expect(() => ttFromAppSet(SET(), { ...COLLECTS(), set: 'elsewhere' })).toThrow("ttFromAppSet: 1 input error\n- collects.set: 'elsewhere', but the set is 'prospect-park'")
    expect(() => ttFromAppSet(SET(), 'x')).toThrow('collects: the GET /v1/sets/:set/collects response, or null when no one is signed in')
    expect(() => ttFromAppSet({ ...SET(), id: undefined }, null)).toThrow("set.id: the set's id")
    expect(() => ttFromAppSet(SET(), { cards: 'x' })).toThrow('collects.cards: a list of { key, collectedAt }')
    expect(() => ttFromAppSet(SET(), null, { photo: 1 })).toThrow('options.photo: a function')
    expect(() => ttFromAppSet(null, null)).toThrow('set: your set as you sent it to PUT /v1/sets/:set')
  })

  it('app ids and keys named like Object\'s own keys are plain data', () => {
    const s = { ...SET(), app: 'constructor', cards: [{ key: 'constructor', type: 'bird', title: 'C' }, { key: '__proto__', type: 'bird', title: 'P' }] }
    expect(ttAppSetErrors(s, null)).toEqual(['set.cards[1].key: letters, digits and : _ . or hyphen, starting with a letter or digit, 128 at most'])
    s.cards.pop()
    const o = ttFromAppSet(s, { cards: [{ key: 'constructor', collectedAt: '2026-11-01' }] }, { rarities: {}, rules: {} })
    expect(o.apps).toEqual([{ id: 'constructor', name: 'constructor', color: null }])
    expect(o.cards.map(c => [c.id, c.held, c.collected])).toEqual([['constructor:prospect-park:constructor', true, '2026-11-01']])
    expect(Object.keys(o.rarities)).toEqual(['constructor'])
  })
})

describe('the table draws it: createTabletop over ttFromAppSet, with the app\'s own face', () => {
  const memStore = () => { const m = new Map(); return { get: k => (m.has(k) ? m.get(k) : null), set: (k, v) => { m.set(k, v) }, remove: k => { m.delete(k) } } }
  // the app's config names only its own face: no kit face at all
  const faces = { bird: { base: 'studio' } }
  const CONFIG = () => ({
    contract: 1,
    app: 'bird-walk',
    source: { load: vi.fn(async () => ttFromAppSet({ ...SET(), meta: { face: 'bird' } }, COLLECTS(), { apps: APPS, faces })) },
    faces,
    theme: { class: 'tt-birds' },
    hand: { key: 'bird_hand', scope: 'park', store: memStore() },
    modes: { collection: true },
  })

  it('loads with no error and draws the held cards on the Studio face under the app\'s own id', async () => {
    const tt = createTabletop(CONFIG())
    const w = mount(tt.Tabletop, { props: { tabletop: tt }, attachTo: document.body })
    await flushPromises()
    expect(tt.error.value).toBe(null)
    expect(tt.collection.value.cards).toHaveLength(5)
    expect(w.element.classList.contains('tt-birds')).toBe(true)
    const drawn = w.element.querySelectorAll('.ttf.ttf-pc[data-face="bird"]')
    expect(drawn.length).toBeGreaterThan(0)
    expect(w.element.querySelectorAll('.ttf:not([data-face="bird"])').length).toBe(0)
    w.unmount()
  })

  it('a card naming the app\'s face itself passes createTabletop\'s check too (the config\'s faces read)', () => {
    const coll = ttFromAppSet(SET(), COLLECTS(), { faces, face: 'bird' })
    expect(coll.sets[0].meta).toEqual({ face: 'studio' })
    const own = { ...coll, sets: [{ ...coll.sets[0], meta: undefined }] }
    own.cards = own.cards.map(c => ({ ...c, face: 'bird' }))
    expect(ttCollectionErrors(own, { faces })).toEqual([])
    // and a face the config does not name is still refused
    expect(ttCollectionErrors({ ...own, cards: [{ ...own.cards[0], face: 'perch' }] }, { faces })).toEqual([
      "collection.cards[0] (bird-walk:prospect-park:warbler-yellow): face 'perch' is not in config.faces (bird)",
    ])
  })
})
