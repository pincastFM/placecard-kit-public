// The registry subpath with an app's rules passed in: three made-up apps (sample-rules.js) over a short made-up
// fixture (fixtures/sample-registry.json). generic.test.js covers an app with no rules.
import { describe, it, expect } from 'vitest'
import fx from './fixtures/sample-registry.json'
import { ttFromRegistry, ttFromMeCards, ttSetFromRegistry } from '../../registry/index.js'
import { ttGroup, ttLook, ttFaceClass, ttFit, ttClean, ttCreditText, ttNumberLabel, ttFmtDate, ttStatIcon } from '../../core/index.js'
import { SAMPLE_APPS, SAMPLE_RARITIES, STOP_ACCENT, chipColor, sampleRules } from './sample-rules.js'

const RULES = sampleRules()
const setFrom = (s, o = {}) => ttSetFromRegistry(s, { ...RULES, ...o })
const fromReg = (c, o = {}) => ttFromRegistry(c, { ...RULES, ...o })
const fromMe = (res, o = {}) => ttFromMeCards(res, { ...RULES, ...o })

const BASE = 'https://placecard.io'
const WORDS = SAMPLE_RARITIES.species

// A /me/cards tile as the endpoint sends it: subtitle is the fact when the row has one, no sort_at, Placecard's own
// card page as href.
function tileOf(r, extra = {}) {
  return {
    kind: r.card_type === 'experience' ? 'experience' : 'card', app: r.app_id, set: r.set_id, key: r.card_key,
    id: r.id || null, title: r.title, subtitle: r.fact || r.subtitle || null, rarity: r.rarity || null,
    foil: r.foil === true, image: r.image_url || null, lat: r.lat ?? null, lng: r.lng ?? null, distance_m: null,
    city: null, price: null, mine: true, href: `/card/${r.app_id}/${r.set_id}/${encodeURIComponent(r.card_key)}`,
    place: null, number: (r.data && r.data.number) ?? null, ...extra,
  }
}

const LEAF_ROWS = fx.leaf.rows
const leafSet = setFrom(fx.sets.leaf)
const heldOf = r => fx.leaf.held[r.card_key] || null
const leafCards = LEAF_ROWS.map(r => fromReg(r, { set: leafSet, holding: heldOf(r) }))

const PAPER_KEY = '0b7c1e52-6a43-4f7e-9d0e-3c2b8a51f001'
const PAPER_SET_ROW = { app_id: 'paper-room', id: 'pocket-theaters-x7k2', name: 'Pocket Theaters', meta: { listed: true, city: 'Old Town' } }
const PAPER_ROW = {
  id: 'a1d0c9f4-2b7e-4c51-8e3a-6f9b0d2c7e10', app_id: 'paper-room', set_id: 'pocket-theaters-x7k2', card_key: PAPER_KEY,
  card_type: 'place', title: 'Paper card', subtitle: 'Front line', fact: null, rarity: null, foil: false,
  image_url: 'https://images.example/full/paper.jpg', image_credit: 'Photo credit',
  image_license: null, url: null, lat: 10.7, lng: 20.7,
  data: { story: 'Story text.', address: 'Address line', number: 2, total: 5 }, status: 'active',
}

const STOP_ROW = {
  app_id: 'old-town', set_id: 'walk-12', card_key: 'stop:301', card_type: 'stop', title: 'The Old Mill',
  subtitle: 'Mill, 1840', fact: '12 Water Street', rarity: null, foil: false,
  image_url: 'https://images.example/full/old-mill.jpg', image_credit: 'B. Painter, CC BY 4.0', image_license: 'CC BY 4.0',
  url: 'https://oldtown.example/walk/12', lat: 10.8, lng: 20.8,
  data: { number: 3, total: 10, walk_id: 12 }, status: 'active',
}
const walkSet = setFrom({ app_id: 'old-town', id: 'walk-12', name: 'Mill Race Walk', meta: { listed: true } }, { total: 10 })

describe('a species app with its own rarity words', () => {
  it('makes its set', () => {
    expect(leafSet).toEqual({ id: 'leaf-log', app: 'leaf-log', name: 'Leaf Log', short: 'LEAF LOG', total: 12, kind: 'species', action: 'Play in Leaf Log' })
  })

  it('maps each row field by field, with the app\'s photo size and the person\'s holding', () => {
    expect(leafCards).toHaveLength(6)
    leafCards.forEach((card, i) => {
      const r = LEAF_ROWS[i]
      const h = heldOf(r)
      const slug = r.card_key.replace('species:', '')
      expect(card).toMatchObject({
        id: `leaf:${slug}`, app: 'leaf-log', set: 'leaf-log', face: 'treehopper', title: r.title, subtitle: r.subtitle, type: 'Species',
        fact: r.fact, back: null, number: null, of: null, rarity: r.rarity, rarityCount: r.fact, accent: null,
        img: r.image_url.replace('/full/', '/480/'), href: `https://leaflog.example/book?card=${slug}`, action: 'Play in Leaf Log',
        held: !!h, collected: h ? h.collected.slice(0, 10) : null, added: h ? h.added : null,
      })
      expect(card.credit).toContain(r.image_credit)
      expect(card.ref).toMatchObject({ app: 'leaf-log', set: 'leaf-log', key: r.card_key, photo: r.image_url, cardType: 'species' })
    })
  })

  it('ranks on its own words, foil only on the top word, path out to the app', () => {
    for (const c of leafCards) {
      expect(c.foil).toBe(c.rarity === 'One of a kind')
      expect(c.rarityRank).toBe(WORDS.indexOf(c.rarity))
    }
    expect(leafCards.filter(c => c.foil)).toHaveLength(1)
    // a foil flag on a lower word does not make it foil
    expect(fromReg({ ...LEAF_ROWS[0], foil: true }).foil).toBe(false)
  })

  it('gives the set held of total', () => {
    const [g] = ttGroup(leafCards, 'set', { apps: SAMPLE_APPS, sets: [leafSet], cards: leafCards })
    expect(g).toMatchObject({ id: 'set:leaf-log', held: 4, total: 12 })
  })
})

describe('a plain app that only names its cards', () => {
  const set = setFrom(PAPER_SET_ROW, { total: 5 })
  const card = fromReg(PAPER_ROW, { set })

  it('keeps Placecard\'s action on its set', () => {
    expect(set).toEqual({ id: 'pocket-theaters-x7k2', app: 'paper-room', name: 'Pocket Theaters', short: 'POCKET THEATERS', total: 5, kind: 'paper-room', action: 'Open in Placecard' })
  })

  it('maps to the destination face with the app\'s color', () => {
    expect(card).toMatchObject({
      id: `paper:${PAPER_KEY}`, app: 'paper-room', set: 'pocket-theaters-x7k2', face: 'destination',
      title: 'Paper card', subtitle: null, type: null, fact: 'Front line', back: 'Story text.', number: 2, of: 5,
      rarity: null, rarityRank: 0, rarityCount: null, foil: false, accent: '#7A3E9D', chip: null,
      credit: 'Photo: Photo credit', href: `${BASE}/card/paper-room/pocket-theaters-x7k2/${PAPER_KEY}`,
      action: 'Open in Placecard', held: true, collected: null, added: null,
    })
    expect(card.ref).toMatchObject({ address: 'Address line', uuid: PAPER_ROW.id, lat: 10.7, lng: 20.7 })
    const L = ttLook(card, { sets: [set] })
    expect(L).toMatchObject({ face: 'destination', theme: 'base', ac: '#7a3e9d', photo: true, short: 'POCKET THEATERS' })
  })

  it('a tile of the same card prints the same front line', () => {
    const t = fromReg(tileOf(PAPER_ROW), { set })
    expect(t).toMatchObject({ id: card.id, fact: 'Front line', subtitle: null, accent: '#7A3E9D', href: card.href, number: 2, of: 5, back: null, credit: null })
  })
})

describe('a town app with walk stops and destination cards', () => {
  it('a stop row: its id, path out and stop face', () => {
    const c = fromReg(STOP_ROW, { set: walkSet })
    expect(walkSet).toMatchObject({ id: 'walk-12', kind: 'walk', walk: 12, short: 'MILL RACE WALK', action: 'Open the walk' })
    expect(c).toMatchObject({
      id: 'walk-12:301', face: 'stop', title: 'The Old Mill', subtitle: 'Mill, 1840', type: 'Mill, 1840', fact: '12 Water Street',
      number: 3, of: 10, rarity: 'Common', rarityRank: 0, foil: false, href: 'https://oldtown.example/walk/12',
      img: 'https://images.example/480/old-mill.jpg', credit: 'Photo: B. Painter, CC BY 4.0', accent: STOP_ACCENT, stats: [], back: null,
    })
    expect(c.ref).toMatchObject({ stop: 301, walk: 12 })
    expect(ttLook(c, { sets: [walkSet] })).toMatchObject({ face: 'stop', theme: 'pop' })
  })

  it('a destination row: its chip, its back, and its own page when it has one', () => {
    const set = setFrom(fx.sets.town, { total: 2 })
    expect(set).toMatchObject({ id: 'old-town-core', kind: 'destination', short: 'OLD TOWN', action: 'Open in Old Town', zone: 'oldtown' })
    const [tower, bakery] = fx.town.rows.map(r => fromReg(r, { set }))
    expect(tower).toMatchObject({
      id: 'oldtown:place:clock-tower', face: 'destination', subtitle: 'Landmark', type: 'Landmark', fact: 'Built in 1888.',
      back: 'It has run four minutes fast since the flood.', rarity: 'Uncommon', rarityRank: 1, foil: false, chip: 'history', chipLabel: 'History',
      accent: chipColor('history'), href: `${BASE}/card/old-town/old-town-core/place%3Aclock-tower`, action: 'Open in Old Town',
    })
    expect(tower.ref).toMatchObject({ key: 'place:clock-tower', chip: 'history', address: '1 Square Street' })
    expect(bakery).toMatchObject({ chip: 'food', chipLabel: 'Food', accent: chipColor('food'), rarityRank: 0, back: null, href: 'https://oldtown.example/bakery' })
  })

  it('a chip marked always takes the always color', () => {
    const set = setFrom(fx.sets.town, { total: 2 })
    const c = fromReg({ ...fx.town.rows[0], data: { chip: 'info' } }, { set })
    expect(c).toMatchObject({ chip: 'info', chipLabel: 'Visitor info', accent: chipColor('info', true) })
  })
})

describe('a /me/cards response', () => {
  const leafTiles = LEAF_ROWS.slice(0, 3).map(r => tileOf(r))
  const paperTiles = [tileOf(PAPER_ROW), tileOf({ ...PAPER_ROW, card_key: 'b'.repeat(8) + PAPER_KEY.slice(8), data: { ...PAPER_ROW.data, number: 3 } })]
  const quest = tileOf({ app_id: 'leaf-log', set_id: 'leaf-log', card_key: 'quest:sample', card_type: 'experience', title: 'Side quest' })
  const res = {
    tiles: [paperTiles[0], leafTiles[0], quest, leafTiles[1], paperTiles[1], leafTiles[2], leafTiles[0]],
    sets: [
      { app: 'leaf-log', set: 'leaf-log', name: 'Leaf Log', held: 3, total: 12 },
      { app: 'paper-room', set: 'pocket-theaters-x7k2', name: 'Pocket Theaters', held: 2, total: 5 },
    ],
    total: 6, counts: { 'leaf-log': 4, 'paper-room': 2 }, rarities: [], cities: [],
  }

  it('gives the apps present, the started sets with held of total, and the held cards', () => {
    const out = fromMe(res, { sort: 'newest', sets: [PAPER_SET_ROW] })
    expect(out.apps.map(a => a.id)).toEqual(['leaf-log', 'paper-room'])
    expect(out.sets).toEqual([
      { id: 'leaf-log', app: 'leaf-log', name: 'Leaf Log', short: 'LEAF LOG', total: 12, kind: 'species', action: 'Play in Leaf Log', held: 3 },
      { id: 'pocket-theaters-x7k2', app: 'paper-room', name: 'Pocket Theaters', short: 'POCKET THEATERS', total: 5, kind: 'paper-room', action: 'Open in Placecard', held: 2 },
    ])
    expect(out.rarities).toEqual({ species: WORDS })
    // the quest (an experience) and the repeated tile are left out; newest first gives added
    expect(out.cards.map(c => c.id)).toEqual([`paper:${PAPER_KEY}`, 'leaf:paper-oak', 'leaf:river-ash', `paper:${paperTiles[1].key}`, 'leaf:silver-elm'])
    expect(out.cards.map(c => c.added)).toEqual([5, 4, 3, 2, 1])
    expect(out.cards.every(c => c.held && c.collected === null)).toBe(true)
    const oak = out.cards[1]
    expect(oak).toMatchObject({ face: 'treehopper', fact: '4,210 in Old Town', rarityCount: '4,210 in Old Town', subtitle: null, type: 'Species', href: 'https://leaflog.example/book?card=paper-oak', credit: null })
    expect(oak.ref.placecard).toBe(`${BASE}/card/leaf-log/leaf-log/species%3Apaper-oak`)
    const groups = ttGroup(out.cards, 'set', out)
    expect(groups.map(g => [g.id, g.held, g.total])).toEqual([['set:leaf-log', 3, 12], ['set:pocket-theaters-x7k2', 2, 5]])
  })

  it('a tile\'s own date wins over the order', () => {
    const dated = { ...res, tiles: [tileOf(LEAF_ROWS[0], { sort_at: '2026-10-20T14:00:00.000Z' }), tileOf(LEAF_ROWS[1], { sort_at: '2026-10-22T09:30:00.000Z' })] }
    const out = fromMe(dated, { sort: 'newest' })
    expect(out.cards.map(c => [c.collected, c.added])).toEqual([['2026-10-20', 1], ['2026-10-22', 2]])
    expect(fromMe(res).cards.every(c => c.added === null)).toBe(true)
  })

  it('Missing cards come only for started sets, from the cards passed', () => {
    const notStarted = { ...PAPER_ROW, set_id: 'another-set-a1b2', card_key: 'c'.repeat(8) + PAPER_KEY.slice(8) }
    const retired = { ...LEAF_ROWS[5], status: 'retired' }
    const out = fromMe(res, { sort: 'newest', cards: [...LEAF_ROWS.slice(0, 5), retired, notStarted, PAPER_ROW] })
    const missing = out.cards.filter(c => !c.held)
    expect(missing.map(c => c.id)).toEqual(['leaf:copper-birch', 'leaf:glass-maple'])
    expect(missing.every(c => c.collected === null && c.added === null)).toBe(true)
    expect(out.sets.map(s => s.id)).toEqual(['leaf-log', 'pocket-theaters-x7k2'])
    const [leaf] = ttGroup(out.cards, 'set', out)
    expect([leaf.held, leaf.total, leaf.cards.length]).toEqual([3, 12, 5])
  })

  it('an empty or missing response is an empty table', () => {
    expect(fromMe(null)).toEqual({ apps: [], sets: [], rarities: {}, cards: [] })
  })
})

describe('the face accepts every adapted card', () => {
  const paperSet = setFrom(PAPER_SET_ROW, { total: 5 })
  const townSet = setFrom(fx.sets.town, { total: 2 })
  const me = fromMe({ tiles: [...LEAF_ROWS.map(r => tileOf(r)), tileOf(PAPER_ROW), tileOf(STOP_ROW), ...fx.town.rows.map(r => tileOf(r))], sets: [] })
  const cards = [
    ...leafCards,
    fromReg(PAPER_ROW, { set: paperSet }),
    fromReg({ ...PAPER_ROW, image_url: null, image_credit: null, data: {} }, { set: paperSet }),
    fromReg(STOP_ROW, { set: walkSet }),
    ...fx.town.rows.map(r => fromReg(r, { set: townSet })),
    ...me.cards,
  ]
  const data = { apps: SAMPLE_APPS, sets: [leafSet, paperSet, walkSet, townSet, ...me.sets], cards }

  it('runs ttLook, the classes and every text helper the face uses on each card', () => {
    expect(cards.length).toBe(6 + 2 + 1 + 2 + 6 + 1 + 1 + 2)
    for (const c of cards) {
      const L = ttLook(c, data)
      expect(L.face).toBe(c.face)
      expect(ttFaceClass(L, 'front')).toContain('ttf-' + c.face)
      expect(ttFaceClass(L, 'back')).toContain('ttf-back')
      expect(ttFit(L.name).lw).toBeGreaterThanOrEqual(4)
      for (const k of ['title', 'subtitle', 'type', 'fact', 'back', 'rarity', 'rarityCount']) expect(typeof ttClean(c[k])).toBe('string')
      expect(typeof ttCreditText(c.credit)).toBe('string')
      expect(typeof ttNumberLabel(c.number)).toBe('string')
      expect(typeof ttFmtDate(c.collected)).toBe('string')
      for (const s of c.stats) expect(typeof ttStatIcon(s.k)).toBe('string')
      expect(typeof c.href).toBe('string')
      expect(c.id).toBeTruthy()
    }
    expect(new Set(cards.map(c => c.face))).toEqual(new Set(['treehopper', 'destination', 'stop']))
  })
})

// The two moderation facts a host's tile carries reach the table's card
describe('ttFromRegistry and the moderation fields', () => {
  const KEY = '5b0c6a0e-8f7d-4c1e-9a52-3e1f0b7c2d41'
  const ROW = {
    id: 'a1d0c9f4-2b7e-4c51-8e3a-6f9b0d2c7e10', app_id: 'paper-room', set_id: 'pocket-theaters-x7k2', card_key: KEY,
    card_type: 'place', title: 'The Lantern', subtitle: 'Down a flight, low and red.', fact: null, rarity: null, foil: false,
    image_url: 'https://images.example/full/lantern.jpg', image_credit: 'Ana', image_license: null, url: null,
    lat: 10.9, lng: 20.9, data: { story: 'The late shows ran past two.', address: '3 Lamp Row', number: 3, total: 9 },
    status: 'active',
  }
  const paperSet = setFrom({ app_id: 'paper-room', id: 'pocket-theaters-x7k2', name: 'Pocket Theaters', meta: { listed: true } }, { total: 9 })
  const townSet = setFrom(fx.sets.town, { total: 2 })
  const ROWS = [
    ...fx.leaf.rows.map(r => [r, leafSet]),
    ...fx.town.rows.map(r => [r, townSet]),
    [ROW, paperSet],
  ]

  it('copies reportedByMe and ref.own from a tile', () => {
    const c = fromReg(tileOf(ROW, { own: true, reportedByMe: true }), { set: paperSet })
    expect(c.reportedByMe).toBe(true)
    expect(c.ref.own).toBe(true)
    expect(c.ref.key).toBe(KEY)
    expect(c.app).toBe('paper-room')
    // everything else is the plain tile's card
    const plain = fromReg(tileOf(ROW), { set: paperSet })
    const { reportedByMe, ...rest } = c
    expect(reportedByMe).toBe(true)
    expect({ ...rest, ref: { ...rest.ref, own: undefined } }).toEqual({ ...plain, ref: { ...plain.ref, own: undefined } })
  })

  it('copies each one alone', () => {
    const own = fromReg(tileOf(ROW, { own: true }), { set: paperSet })
    expect(own.ref.own).toBe(true)
    expect('reportedByMe' in own).toBe(false)
    const rep = fromReg(tileOf(ROW, { reportedByMe: true }), { set: paperSet })
    expect(rep.reportedByMe).toBe(true)
    expect('own' in rep.ref).toBe(false)
  })

  it('adds no key when the source has neither, for every fixture row and its tile', () => {
    expect(ROWS.length).toBe(fx.leaf.rows.length + fx.town.rows.length + 1)
    for (const [r, set] of ROWS) {
      for (const src of [r, tileOf(r)]) {
        const c = fromReg(src, { set })
        expect('reportedByMe' in c).toBe(false)
        expect('own' in c.ref).toBe(false)
        // false, or anything but true, is not carried either
        expect(fromReg({ ...src, own: false, reportedByMe: false }, { set })).toEqual(c)
        expect(fromReg({ ...src, own: 'yes', reportedByMe: 1 }, { set })).toEqual(c)
      }
    }
  })

  it('reaches the table through ttFromMeCards', () => {
    const other = { ...ROW, id: null, card_key: '9d2e4f10-1a3b-4c5d-8e6f-7a8b9c0d1e2f', title: 'Low Stage', data: { number: 4 } }
    const res = {
      tiles: [tileOf(ROW, { own: true }), tileOf(other, { reportedByMe: true }), tileOf(fx.leaf.rows[0])],
      sets: [
        { app: 'paper-room', set: 'pocket-theaters-x7k2', name: 'Pocket Theaters', held: 2, total: 9 },
        { app: 'leaf-log', set: 'leaf-log', name: 'Leaf Log', held: 1, total: 12 },
      ],
      total: 3, counts: { 'paper-room': 2, 'leaf-log': 1 }, rarities: [], cities: [],
    }
    const out = fromMe(res)
    const byKey = Object.fromEntries(out.cards.map(c => [c.ref.key, c]))
    expect(byKey[KEY].ref.own).toBe(true)
    expect('reportedByMe' in byKey[KEY]).toBe(false)
    expect(byKey[other.card_key].reportedByMe).toBe(true)
    expect('own' in byKey[other.card_key].ref).toBe(false)
    const leaf = byKey[fx.leaf.rows[0].card_key]
    expect('reportedByMe' in leaf).toBe(false)
    expect('own' in leaf.ref).toBe(false)
  })
})
