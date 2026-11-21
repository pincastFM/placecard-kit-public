// @vitest-environment jsdom
// createTabletop, Tabletop, and the table's additions under them (TtTable theme, useTtTable sorts and
// facets, useTtHand key). Every addition unused leaves the table as it was (the other vue tests, unchanged).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick, effectScope } from 'vue'
import { TtTable, TtSearch, Tabletop, createTabletop, useTtTable, useTtHand, setTtHost, CONTRACT_VERSION } from '../../vue/index.js'
import { TT_CARDROOM_THEME, CR_FONTS, TT_FACE_FONTS, TT_PC_FONTS, TT_TH_FONTS } from '../../core/index.js'
import { PATH_CASES } from '../../planner/test/fixtures/path-cases'

const planner = vi.hoisted(() => ({}))
vi.mock('@pincast/placecard-kit/planner', async (orig) => {
  const real = await orig()
  planner.real = real
  return { ...real, solveDay: vi.fn((...a) => real.solveDay(...a)), solvePath: vi.fn((...a) => real.solvePath(...a)) }
})
const { solveDay, solvePath } = await import('@pincast/placecard-kit/planner')

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.animate = function () { return { onfinish: null, oncancel: null, cancel() {}, finish() {} } }
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}

const LYCEUM = { id: 'walk-3986:17530', app: 'verythere', set: 'walk-3986', face: 'stop', title: 'The Lyceum Theatre', subtitle: 'Theater, 1903', type: 'Theater, 1903', fact: '149 to 157 West 45th Street', back: 'South side.', stats: [], number: 3, of: 10, rarity: 'Common', rarityRank: 0, rarityCount: null, foil: false, accent: '#3d5a3a', img: null, credit: null, held: true, collected: '2026-10-18', added: 56, kind: 'see', interests: ['history'] }
const BELASCO = { ...LYCEUM, id: 'walk-3986:17531', title: 'The Belasco', number: 4, rarity: 'Uncommon', rarityRank: 1, held: false, collected: null, added: null, interests: ['art'] }
const MUSEUM = { ...LYCEUM, id: 'dest:museum', set: 'provo', face: undefined, title: 'The Museum', number: null, of: null, kind: 'eat', interests: ['art', 'food'] }
const DATA = () => ({
  apps: [{ id: 'verythere', name: 'VeryThere', color: '#FFB61E' }],
  sets: [
    { id: 'walk-3986', app: 'verythere', name: 'Broadway Ghost Stories', short: 'BROADWAY', total: 10, kind: 'walk', action: 'Open the walk', trek: 3986 },
    { id: 'provo', app: 'verythere', name: 'Provo', short: 'PROVO', total: 591, kind: 'destination', meta: { face: 'destination' } },
  ],
  rarities: { walk: ['Common', 'Uncommon', 'Rare', 'Legendary'], destination: ['Common', 'Uncommon'] },
  cards: [LYCEUM, BELASCO, MUSEUM],
})
const memStore = () => { const m = new Map(); return { m, get: k => (m.has(k) ? m.get(k) : null), set: (k, v) => { m.set(k, v) }, remove: (k) => { m.delete(k) } } }
const CONFIG = (over = {}) => ({
  contract: 1,
  app: 'verythere',
  source: { load: vi.fn(async () => DATA()) },
  faces: { stop: {}, destination: {} },
  theme: { class: 'tt-provo', fonts: [{ key: 'tt-pv-fonts', href: 'https://fonts.example/pv.css' }] },
  hand: { key: 'vt_hand_provo', scope: 'provo', store: memStore() },
  modes: { collection: true, planning: { solver: 'day', rules: { tz: 'America/Denver' } } },
  ...over,
})

let head
beforeEach(() => {
  head = vi.fn()
  setTtHost({ head, distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => { setTtHost({ head: null, distUnit: null }) })
const tableEntry = () => head.mock.calls.map(c => c[0]).find(e => e.link && e.link.some(l => l.key === 'tt-pre-1'))
// The table's markup without Vue's scope ids and the theme's class
const markup = (w, cls) => w.html().replace(/ data-v-[a-z0-9]+(="")?/g, '').replace(new RegExp(` ?${cls}`, 'g'), '')

describe('TtTable prop theme', () => {
  it('unset, and set to the Card room, the head entry is as it was', async () => {
    const a = mount(TtTable, { props: { collection: DATA(), options: { key: 'k1' } }, attachTo: document.body })
    const before = tableEntry()
    expect(before.htmlAttrs).toEqual({ 'data-tt': 'cardroom' })
    expect(before.link.map(l => l.key)).toEqual(['tt-pre-1', 'tt-pre-2', 'tt-face-fonts', 'tt-cr-fonts'])
    head.mockClear()
    const b = mount(TtTable, { props: { collection: DATA(), options: { key: 'k1' }, theme: TT_CARDROOM_THEME }, attachTo: document.body })
    expect(tableEntry()).toEqual(before)
    a.unmount(); b.unmount()
  })
  it("a theme's fonts and <html> attributes take the Card room's place; the preconnects and face fonts stay", () => {
    const w = mount(TtTable, { props: { collection: DATA(), options: { key: 'k1' }, theme: { class: 'tt-x', fonts: ['https://f/a.css'], htmlAttrs: { 'data-tt': 'x' } } }, attachTo: document.body })
    expect(tableEntry()).toEqual({
      htmlAttrs: { 'data-tt': 'x' },
      link: [
        { key: 'tt-pre-1', rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { key: 'tt-pre-2', rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { key: 'tt-face-fonts', rel: 'stylesheet', href: TT_FACE_FONTS },
        { key: 'tt-theme-font-0', rel: 'stylesheet', href: 'https://f/a.css' },
      ],
    })
    expect(JSON.stringify(head.mock.calls)).not.toContain(CR_FONTS)
    w.unmount()
  })
  it("a theme with only a class keeps the Card room's fonts; fonts: [] leaves them out", () => {
    const a = mount(TtTable, { props: { collection: DATA(), options: { key: 'k1' }, theme: { class: 'tt-birds' } }, attachTo: document.body })
    const entry = tableEntry()
    expect(entry.htmlAttrs).toBeUndefined()
    expect(entry.link.map(l => l.key)).toEqual(['tt-pre-1', 'tt-pre-2', 'tt-face-fonts', 'tt-cr-fonts'])
    expect(entry.link[3]).toEqual({ key: 'tt-cr-fonts', rel: 'stylesheet', href: CR_FONTS })
    head.mockClear()
    const b = mount(TtTable, { props: { collection: DATA(), options: { key: 'k1' }, theme: { class: 'tt-birds', fonts: [] } }, attachTo: document.body })
    expect(tableEntry().link.map(l => l.key)).toEqual(['tt-pre-1', 'tt-pre-2', 'tt-face-fonts'])
    a.unmount(); b.unmount()
  })
  it('loads the Treehopper fonts for a card whose set names the Treehopper face', () => {
    const d = DATA()
    d.sets[1].meta.face = 'treehopper'
    const w = mount(TtTable, { props: { collection: d, options: { key: 'k1' } }, attachTo: document.body })
    expect(tableEntry().link.map(l => l.key)).toContain('tt-th-fonts')
    w.unmount()
  })
})

describe('what a table offers: useTtTable sorts and facets', () => {
  it('unset, all of them', () => {
    const t = useTtTable(DATA())
    expect(t.sortOptions.map(s => s.id)).toEqual(['newest', 'rarest', 'name', 'number'])
    expect(t.facetOptions).toEqual(['from', 'set', 'rarity', 'kind', 'interests'])
    expect(t.sort.value).toBe('newest')
  })
  it('sorts: the offered ones, in order; the first when newest is not offered; others refused, stored or set', () => {
    const store = memStore()
    store.set('k2', JSON.stringify({ v: 1, w: {}, group: 'set', sort: 'rarest' }))
    const t = useTtTable(DATA(), { key: 'k2', store, sorts: ['name', 'number'] })
    expect(t.sortOptions.map(s => s.id)).toEqual(['name', 'number'])
    expect(t.sort.value).toBe('name')
    t.restore()
    expect(t.sort.value).toBe('name')
    t.setSort('rarest')
    expect(t.sort.value).toBe('name')
    t.setSort('number')
    expect(t.sort.value).toBe('number')
  })
  it('facets: the offered ones; toggleFacet refuses a hidden one', () => {
    const t = useTtTable(DATA(), { facets: ['interests', 'kind'] })
    expect(t.facetOptions).toEqual(['kind', 'interests'])
    t.toggleFacet('rarity', 'Common')
    expect(t.filter.rarity).toEqual([])
    t.toggleFacet('interests', 'art')
    expect(t.filter.interests).toEqual(['art'])
  })
  it('TtTable draws chips for the offered facets alone, drops Missing at missing false and search at search false', async () => {
    const all = mount(TtTable, { props: { collection: DATA(), options: { key: 'k3' } }, attachTo: document.body })
    const some = mount(TtTable, { props: { collection: DATA(), options: { key: 'k3', facets: ['rarity', 'kind'], missing: false, search: false } }, attachTo: document.body })
    await flushPromises()
    const names = w => w.vm.$.setupState.chips.map(c => c.k)
    expect(names(all)).toEqual(['missing', 'set', 'rarity', 'sort'])
    expect(names(some)).toEqual(['rarity', 'sort'])
    expect(all.findComponent(TtSearch).exists()).toBe(true)
    expect(some.findComponent(TtSearch).exists()).toBe(false)
    all.unmount(); some.unmount()
  })
})

describe('useTtHand key', () => {
  it('keeps the hand under the given key with the old payload, its scope the zone', async () => {
    const store = memStore()
    const scope = effectScope()
    const hand = scope.run(() => useTtHand('provo', { key: () => 'my_hand', store }))
    expect(hand.key.value).toBe('my_hand')
    hand.restore()
    hand.add({ key: 'a', kind: 'card' })
    await nextTick()
    expect(JSON.parse(store.get('my_hand'))).toEqual({ v: 1, zone: 'provo', entries: [{ key: 'a', kind: 'card' }] })
    expect(store.get('vt_hand_provo')).toBe(null)
    const again = scope.run(() => useTtHand('provo', { key: 'my_hand', store }))
    expect(again.restore()).toEqual([{ key: 'a', kind: 'card' }])
    scope.stop()
  })
  it('unset, the key is derived as before', () => {
    expect(useTtHand('provo').key.value).toBe('vt_hand_provo')
    expect(useTtHand('provo', { demo: true }).key.value).toBe('vt_hand_provo_demo')
  })
})

describe('createTabletop', () => {
  it('throws on a bad config, listing every problem', () => {
    expect(() => createTabletop({ ...CONFIG(), contract: 9, app: 'Acme Co' })).toThrow(/createTabletop: 2 config errors[\s\S]*contract major 9[\s\S]*'Acme Co' is not an app id/)
  })
  it('returns the contract version, the config and its parts', () => {
    const c = CONFIG()
    const tt = createTabletop(c)
    expect(tt.contractVersion).toBe(CONTRACT_VERSION)
    expect(tt.config).toBe(c)
    expect(tt.collection.value).toBe(null)
    expect(tt.table.value).toBe(null)
    expect(tt.Tabletop).toBe(Tabletop)
    expect(tt.hand.key.value).toBe('vt_hand_provo')
    tt.dispose()
  })
  it('load: one call at a time, the collection checked and kept, faces added when it has none', async () => {
    const c = CONFIG()
    const tt = createTabletop(c)
    const [a, b] = [tt.load(), tt.load()]
    expect(a).toBe(b)
    expect(tt.loading.value).toBe(true)
    const got = await a
    expect(c.source.load).toHaveBeenCalledTimes(1)
    expect(tt.loading.value).toBe(false)
    expect(got.faces).toBe(c.faces)
    expect(tt.collection.value).toBe(got)
    const own = { ...DATA(), faces: { stop: { print: true } } }
    c.source.load.mockResolvedValueOnce(own)
    expect(await tt.load()).toBe(own)
    tt.dispose()
  })
  it('load: a collection with a face outside the config, or a failed source, sets error and returns null', async () => {
    const c = CONFIG({ faces: { stop: {} } })
    const tt = createTabletop(c)
    expect(await tt.load()).toBe(null)
    expect(tt.error.value).toBeInstanceOf(TypeError)
    expect(tt.error.value.message).toContain("collection.cards[2] (dest:museum): its face is 'destination'")
    expect(tt.collection.value).toBe(null)
    const boom = new Error('offline')
    c.source.load.mockRejectedValueOnce(boom)
    expect(await tt.load()).toBe(null)
    expect(tt.error.value).toBe(boom)
    tt.dispose()
  })
  it('plan, day: solveDay with the rules, the app and madeBy null under the caller\'s meta', () => {
    const c = CONFIG()
    const tt = createTabletop(c)
    const record = { id: 'r' }
    solveDay.mockReturnValueOnce(record)
    const input = { hand: [], cards: [] }
    expect(tt.plan(input, { id: 'd1', set: 'provo', madeAt: '2026-10-31T00:00:00.000Z' })).toBe(record)
    expect(solveDay).toHaveBeenLastCalledWith(c.modes.planning.rules, input, { app: 'verythere', madeBy: null, id: 'd1', set: 'provo', madeAt: '2026-10-31T00:00:00.000Z' })
    tt.dispose()
  })
  it('plan, path: solvePath with the directions, the same plan', async () => {
    const timed = PATH_CASES.find(x => x.name === 'open, planned, 30 min, streets at 1.1')
    const tt = createTabletop(CONFIG({ app: 'treehopper', modes: { planning: { solver: 'path' } } }))
    const got = await tt.plan(timed.req)
    expect(solvePath).toHaveBeenLastCalledWith(timed.req, null)
    const strip = p => ({ ...p, record: { ...p.record, id: null, madeAt: null } })   // a new id each run
    expect(strip(got)).toEqual(strip(await planner.real.solvePath(timed.req, null)))
    expect(got.record.totals.timing).toBe('estimate')
    tt.dispose()
  })
  it('plan without a planning mode throws', () => {
    const tt = createTabletop(CONFIG({ modes: { collection: true } }))
    expect(() => tt.plan({})).toThrow(/no planning mode/)
    tt.dispose()
  })
  it('dispose stops the hand\'s watchers', async () => {
    const c = CONFIG()
    const tt = createTabletop(c)
    tt.hand.restore()
    tt.hand.add({ key: 'a', kind: 'card' })
    await nextTick()
    expect(c.hand.store.get('vt_hand_provo')).not.toBe(null)
    tt.dispose()
    tt.hand.clear()
    await nextTick()
    expect(c.hand.store.get('vt_hand_provo')).not.toBe(null)
  })
})

describe('Tabletop', () => {
  const PROPS = { back: { label: 'Provo', href: '/provo' }, emptyLinks: [{ label: 'Walk', href: '/w' }], labels: { cards: 'Cards' }, options: { key: 'tt_sel', groups: ['kind', 'none'], group: 'kind', groupLabels: { none: 'All' }, stacked: true } }
  const FULL = () => CONFIG({
    table: { key: 'tt_sel', stacked: true },
    groups: ['kind', 'none'],
    labels: { cards: 'Cards', groups: { none: 'All' } },
    links: { back: { label: 'Provo', href: '/provo' }, empty: [{ label: 'Walk', href: '/w' }] },
  })

  it('draws the same table as a bare TtTable given the same props, its class the theme\'s', async () => {
    const tt = createTabletop(FULL())
    const w = mount(Tabletop, { props: { tabletop: tt }, attachTo: document.body })
    await flushPromises()
    await flushPromises()
    const bare = mount(TtTable, { props: { collection: tt.collection.value, theme: tt.config.theme, ...PROPS }, attachTo: document.body })
    await flushPromises()
    expect(w.classes()).toContain('tt-provo')
    expect(w.findAll('[data-id]').length).toBeGreaterThan(0)
    expect(markup(w, 'tt-provo')).toBe(markup(bare, 'tt-provo'))
    w.unmount(); bare.unmount()
  })
  it('passes every slot through and fills tabletop.table from mount to unmount', async () => {
    const tt = createTabletop(CONFIG())
    const w = mount(Tabletop, {
      props: { tabletop: tt },
      slots: { head: () => h('span', { class: 'my-head' }, 'Join'), cell: ({ card }) => h('i', { class: 'my-cell' }, card.id) },
      attachTo: document.body,
    })
    expect(tt.table.value).not.toBe(null)
    await flushPromises()
    await flushPromises()
    expect(w.find('.my-head').text()).toBe('Join')
    expect(w.findAll('.my-cell').length).toBeGreaterThan(0)
    expect(tt.table.value.T).toBeTruthy()
    expect(w.vm.T).toBe(tt.table.value.T)
    expect(typeof w.vm.openCard).toBe('function')
    expect(w.vm.$el).toBe(w.element)
    w.unmount()
    expect(tt.table.value).toBe(null)
  })
  it('autoload false leaves the loading to the caller; listeners and attributes reach the table', async () => {
    const tt = createTabletop(CONFIG())
    const onNest = vi.fn()
    const w = mount(Tabletop, { props: { tabletop: tt, autoload: false, tag: 'Sample', onNest }, attachTo: document.body })
    await flushPromises()
    expect(tt.config.source.load).not.toHaveBeenCalled()
    expect(w.findComponent(TtTable).props('loading')).toBe(true)
    expect(w.findComponent(TtTable).props('tag')).toBe('Sample')
    w.findComponent(TtTable).vm.$emit('nest', 'x')
    expect(onNest).toHaveBeenCalledWith('x')
    w.unmount()
  })
})

// A createTabletop table mounts before its collection (Tabletop runs load() on mount), so a face's fonts can't be in
// the entry the table makes at setup. They come in an entry of their own once a card that needs them is on the table.
describe("the faces' fonts for a collection that arrives after setup", () => {
  const BIRDS = face => ({
    apps: [{ id: 'bird-walk', name: 'Bird Walk', color: '#c2410c', site: 'https://birdwalk.example' }],
    sets: [{ id: 'park', app: 'bird-walk', name: 'Prospect Park Birds', short: 'PARK', total: 2, kind: 'bird', meta: { face } }],
    rarities: { bird: ['Common', 'Rare'] },
    cards: [
      { id: 'cardinal', app: 'bird-walk', set: 'park', kind: 'bird', title: 'Northern Cardinal', rarity: 'Common', number: 1, held: true, collected: '2026-11-01', added: 1 },
      { id: 'duck', app: 'bird-walk', set: 'park', kind: 'bird', title: 'Wood Duck', rarity: 'Rare', number: 2, held: false },
    ],
  })
  const birdTable = (faces, face) => createTabletop(CONFIG({ app: 'bird-walk', faces, theme: { class: 'tt-birds' }, source: { load: vi.fn(async () => BIRDS(face)) } }))
  const withKey = key => head.mock.calls.map(c => c[0]).filter(e => e.link && e.link.some(l => l.key === key))
  const LATE_PC = { link: [{ key: 'tt-pc-fonts', rel: 'stylesheet', href: TT_PC_FONTS }] }

  it('a Studio card that load() resolves gets tt-pc-fonts, in one entry, once', async () => {
    const tt = birdTable({ studio: {} }, 'studio')
    const w = mount(Tabletop, { props: { tabletop: tt }, attachTo: document.body })
    expect(tableEntry().link.map(l => l.key)).toEqual(['tt-pre-1', 'tt-pre-2', 'tt-face-fonts', 'tt-cr-fonts'])
    expect(withKey('tt-pc-fonts')).toEqual([])
    await flushPromises(); await nextTick()
    expect(tt.collection.value.cards).toHaveLength(2)
    expect(w.find('.ttf-pc').exists()).toBe(true)
    expect(withKey('tt-pc-fonts')).toEqual([LATE_PC])
    // a second load, and the updates it brings, ask for nothing more
    await tt.load(); await flushPromises(); await nextTick()
    expect(withKey('tt-pc-fonts')).toEqual([LATE_PC])
    expect(withKey('tt-th-fonts')).toEqual([])
    w.unmount()
  })
  it("an app's own face drawn by the Studio face counts too", async () => {
    const tt = birdTable({ board: { base: 'studio' } }, 'board')
    const w = mount(Tabletop, { props: { tabletop: tt }, attachTo: document.body })
    await flushPromises(); await nextTick()
    expect(w.find('.ttf[data-face="board"]').exists()).toBe(true)
    expect(withKey('tt-pc-fonts')).toEqual([LATE_PC])
    w.unmount()
  })
  it('a Treehopper card gets tt-th-fonts the same way', async () => {
    const tt = birdTable({ treehopper: {} }, 'treehopper')
    const w = mount(Tabletop, { props: { tabletop: tt }, attachTo: document.body })
    await flushPromises(); await nextTick()
    expect(withKey('tt-th-fonts')).toEqual([{ link: [{ key: 'tt-th-fonts', rel: 'stylesheet', href: TT_TH_FONTS }] }])
    expect(withKey('tt-pc-fonts')).toEqual([])
    w.unmount()
  })
  it('cards that need neither (Provo\'s faces) add no entry after setup', async () => {
    const tt = createTabletop(CONFIG())
    const w = mount(Tabletop, { props: { tabletop: tt }, attachTo: document.body })
    const before = head.mock.calls.length
    await flushPromises(); await nextTick()
    expect(tt.collection.value.cards).toHaveLength(3)
    expect(head.mock.calls.length).toBe(before)
    w.unmount()
  })
  it('a collection that holds the card at setup keeps the link in the setup entry, and none follows', async () => {
    const w = mount(TtTable, { props: { collection: BIRDS('studio'), options: { key: 'k1' } }, attachTo: document.body })
    expect(tableEntry().link.map(l => l.key)).toEqual(['tt-pre-1', 'tt-pre-2', 'tt-face-fonts', 'tt-cr-fonts', 'tt-pc-fonts'])
    await w.setProps({ collection: BIRDS('studio') }); await flushPromises(); await nextTick()
    expect(withKey('tt-pc-fonts')).toHaveLength(1)
    w.unmount()
  })
})
