// @vitest-environment jsdom
/**
 * Kit 1.6.0, the open kit (2026-11-10): the system scales to any number of apps built on the platform. Three closed
 * lists opened, each additive:
 *   1. apps: config.app is any id of the registry's shape; the registry alone says which apps exist;
 *   2. faces: an instance may name a face of its own, drawn by a kit face (`base`) or by its own component;
 *   3. marks: a theme no longer supplies one token per Pincast app; an app's mark is its color in the collection.
 * Unset, every kit face's markup is 1.5.0's (the goldens of k2labels, u2face, u3gold, v13gold, k1studio and pl035accent
 * hold it). The Studio face (1.4.0) is one more kit face here: a host's face may name it as its base.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { TtFace, TtTable, createTabletop, setTtHost } from '../../vue/index.js'
import {
  CONTRACT_VERSION, TT_APP_IDS, TT_APP_ID_RE, TT_FACES, TT_FACE_ID_RE, TT_LEGACY_MARK_TOKENS, TT_PC_FONTS, TT_THEME_TOKENS,
  TT_TH_FONTS, TT_RMARK, ttAppIdOk, ttCollectionErrors, ttConfigErrors, ttFaceBase, ttFaceClass, ttFaceComponent, ttFaceEntry,
  ttFaceOf, ttFurniture, ttLook, ttPrintOn,
} from '../../core/index.js'
import { TT_PACK_TINTS, ttPackLook } from '../../core/pack.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.animate = function () { return { cancel() {}, finish() {}, onfinish: null, oncancel: null } }

let head
beforeEach(() => { head = vi.fn(); setTtHost({ head, distUnit: null }) })
afterEach(() => { setTtHost({ head: null, distUnit: null }) })

// A host's own face: it draws both sides from the props the kit hands it, and places the slots it is given
const BirdFace = defineComponent({
  name: 'BirdFace',
  props: { card: Object, side: String, data: Object, labels: Object, look: Object },
  setup(props, { slots }) {
    return () => h('span', { class: 'bird', 'data-side': props.side, 'data-look': props.look && props.look.face }, [
      h('b', { class: 'bird-name' }, props.card.title),
      slots.art ? slots.art() : null,
      slots.more ? slots.more({ card: props.card }) : null,
    ])
  },
})
const memStore = () => { const m = new Map(); return { get: k => (m.has(k) ? m.get(k) : null), set: (k, v) => { m.set(k, v) }, remove: k => { m.delete(k) } } }
const FACES = () => ({ bird: { component: BirdFace, print: true }, perch: { base: 'treehopper' }, stop: {} })
const DATA = () => ({
  apps: [{ id: 'birds', name: 'Bird walk', color: '#B4432F' }],
  sets: [{ id: 'ramble', app: 'birds', name: 'The Ramble', meta: { face: 'bird' } }, { id: 'places', app: 'birds', name: 'Places', meta: { face: 'perch' } }],
  rarities: { birds: ['Everyday', 'Seasonal', 'Lucky'] },
  cards: [
    { id: 'b:robin', app: 'birds', set: 'ramble', title: 'American Robin', rarity: 'Everyday', held: true },
    { id: 'p:bow', app: 'birds', set: 'places', title: 'Bow Bridge', rarity: 'Everyday', held: false },
    { id: 's:1', app: 'birds', set: 'places', face: 'stop', title: 'A stop', held: true },
  ],
})
const CONFIG = (over = {}) => ({
  contract: 1,
  app: 'birds',
  source: { load: vi.fn(async () => DATA()) },
  faces: FACES(),
  theme: { class: 'tt-birds' },
  hand: { key: 'bird_hand', scope: 'park', store: memStore() },
  modes: { collection: true },
  ...over,
})

describe('1. apps: the registry is the authority, the kit checks the shape only', () => {
  it('an id of the registry\'s shape is an app; the three named are examples, not a gate', () => {
    expect(TT_APP_IDS).toEqual(['treehopper', 'verythere', 'studio'])
    expect(String(TT_APP_ID_RE)).toBe('/^[a-z0-9-]{1,32}$/')
    for (const id of [...TT_APP_IDS, 'birds', 'quirky-bird-girl', 'app-42', 'a'.repeat(32)]) {
      expect(ttAppIdOk(id), id).toBe(true)
      expect(ttConfigErrors(CONFIG({ app: id }), CONTRACT_VERSION), id).toEqual([])
    }
    for (const id of ['', 'Birds', 'bird walk', 'bird_walk', 'a'.repeat(33), 7, null]) {
      expect(ttAppIdOk(id), String(id)).toBe(false)
      expect(ttConfigErrors(CONFIG({ app: id }), CONTRACT_VERSION).some(e => e.startsWith('config.app: ')), String(id)).toBe(true)
    }
  })
  it('createTabletop takes an app the kit has never heard of', async () => {
    const tt = createTabletop(CONFIG())
    const c = await tt.load()
    expect(tt.error.value).toBe(null)
    expect(c.cards).toHaveLength(3)
    expect(Object.keys(c.faces)).toEqual(['bird', 'perch', 'stop'])
  })
})

describe('2. faces: the app\'s own, by a kit face or by its own component', () => {
  const data = { ...DATA(), faces: FACES() }
  it('a face is the kit\'s, or the collection\'s own under a well-formed id with a base or a component', () => {
    expect(TT_FACES).toEqual(['stop', 'destination', 'treehopper', 'studio'])
    expect(String(TT_FACE_ID_RE)).toBe('/^[a-z][a-z0-9-]{0,31}$/')
    expect(ttFaceEntry('bird', data)).toBe(data.faces.bird)
    expect(ttFaceEntry('bird', { faces: [{ id: 'bird', base: 'stop' }] })).toEqual({ id: 'bird', base: 'stop' })
    expect(ttFaceEntry('owl', data)).toBe(null)
    expect(ttFaceOf(data.cards[0], data)).toBe('bird')
    expect(ttFaceOf(data.cards[1], data)).toBe('perch')
    expect(ttFaceOf(data.cards[2], data)).toBe('stop')
    expect(ttFaceOf({ face: 'perch', set: 'ramble' }, data)).toBe('perch')
  })
  it('a face no entry draws is still the set\'s face, else stop, as at 1.5.0', () => {
    expect(ttFaceOf({ face: 'owl', set: 'ramble' }, data)).toBe('bird')
    expect(ttFaceOf({ face: 'bird' }, { sets: [] })).toBe('stop')
    expect(ttFaceOf({ face: 'bird' }, { faces: { bird: {} } })).toBe('stop')
    expect(ttFaceOf({ face: 'bird' }, { faces: { bird: { base: 'postcard' } } })).toBe('stop')
    expect(ttFaceOf({ face: 'constructor' }, { faces: {} })).toBe('stop')
    expect(ttFaceOf({ face: 'toString' }, { faces: {} })).toBe('stop')
  })
  it('the kit face that draws it: itself, the base, or none when the host\'s component draws', () => {
    for (const f of TT_FACES) expect(ttFaceBase(f, data)).toBe(f)
    expect(ttFaceBase('perch', data)).toBe('treehopper')
    expect(ttFaceBase('bird', data)).toBe(null)
    expect(ttFaceBase('owl', data)).toBe('stop')
    expect(ttFaceComponent('bird', data)).toBe(BirdFace)
    expect(ttFaceComponent('perch', data)).toBe(null)
    expect(ttFaceComponent('stop', data)).toBe(null)
    // both given: the component draws
    expect(ttFaceBase('x', { faces: { x: { base: 'stop', component: BirdFace } } })).toBe(null)
  })
  it('a based face takes its base\'s look, print and classes; a component takes ttf-own and prints only when asked', () => {
    const perch = ttLook(data.cards[1], data)
    expect([perch.face, perch.base, perch.theme]).toEqual(['perch', 'treehopper', 'th'])
    expect(ttFaceClass(perch, 'front')).toBe(ttFaceClass(ttLook({ ...data.cards[1], face: 'treehopper' }, data), 'front'))
    expect(ttPrintOn(data.cards[1], data)).toBe(true)
    const bird = ttLook(data.cards[0], data)
    expect([bird.face, bird.base, bird.theme]).toEqual(['bird', null, 'own'])
    expect(ttFaceClass(bird, 'front')).toBe('ttf ttf-front ttf-own')
    expect(ttFaceClass(bird, 'back')).toBe('ttf ttf-back ttf-own')
    expect(ttPrintOn(data.cards[0], data)).toBe(true)
    expect(ttPrintOn(data.cards[0], { ...data, faces: { bird: { component: BirdFace } } })).toBe(false)
    // a look made by hand, without base, is its own face's, as at 1.5.0
    expect(ttFaceClass({ face: 'treehopper', theme: 'th', photo: true }, 'front')).toBe('ttf ttf-front ttf-treehopper ttf-t-th ttf-th')
  })
  it('the collection check holds every card and set to the config\'s faces, own faces included', () => {
    expect(ttCollectionErrors(DATA(), CONFIG())).toEqual([])
    const c = DATA()
    c.cards.push({ id: 'b:owl', app: 'birds', set: 'ramble', face: 'owl' })
    expect(ttCollectionErrors(c, CONFIG())).toEqual(["collection.cards[3] (b:owl): face 'owl' is not in config.faces (bird, perch, stop)"])
  })

  it('TtFace draws the host\'s component inside the kit\'s card, both sides, with the frame\'s marks on the root', () => {
    for (const side of ['front', 'back']) {
      const w = mount(TtFace, { props: { card: data.cards[0], data, side, fonts: false } })
      const root = w.element
      expect(root.className).toBe(`ttf ttf-${side} ttf-own`)
      expect(root.getAttribute('data-face')).toBe('bird')
      expect(root.getAttribute('data-held')).toBe('true')
      expect(root.hasAttribute('data-print')).toBe(true)
      const inner = root.querySelector('.ttf-card > .ttf-face > .bird')
      expect(inner).not.toBe(null)
      expect(inner.getAttribute('data-side')).toBe(side)
      expect(inner.getAttribute('data-look')).toBe('bird')
      expect(inner.querySelector('.bird-name').textContent).toBe('American Robin')
      // none of a kit face's parts
      for (const cls of ['ttf-art', 'ttf-plate', 'ttf-bk-head', 'ttf-bk-body', 'ttf-furn']) expect(root.querySelector('.' + cls), cls).toBe(null)
      w.unmount()
    }
  })
  it('the slots a face is given reach the host\'s component under the same names', () => {
    const w = mount(TtFace, {
      props: { card: data.cards[0], data, fonts: false },
      slots: { art: '<i class="stub">WANTED</i>', more: p => h('i', { class: 'more' }, p.card.id) },
    })
    expect(w.element.querySelector('.bird > .stub').textContent).toBe('WANTED')
    expect(w.element.querySelector('.bird > .more').textContent).toBe('b:robin')
    w.unmount()
  })
  it('a based face is its base\'s markup under its own data-face, and loads its base\'s fonts', () => {
    const card = { ...data.cards[1], held: true, number: 7, collected: '2026-11-10T12:00:00Z', subtitle: 'Since 1862' }
    const own = mount(TtFace, { props: { card, data } })
    const kit = mount(TtFace, { props: { card: { ...card, face: 'treehopper' }, data } })
    expect(own.element.getAttribute('data-face')).toBe('perch')
    expect(own.html().replace('data-face="perch"', 'data-face="treehopper"')).toBe(kit.html())
    expect(head.mock.calls.some(([e]) => e.link.some(l => l.href === TT_TH_FONTS))).toBe(true)
    own.unmount(); kit.unmount()
  })
  it('the whole table mounts on an app and faces of its own', async () => {
    const tt = createTabletop(CONFIG())
    const w = mount(tt.Tabletop, { props: { tabletop: tt }, attachTo: document.body })
    await flushPromises()
    expect(tt.error.value).toBe(null)
    expect(w.element.classList.contains('tt-birds')).toBe(true)
    // the table shows each pile's top card: the Ramble's is the host's component, in the kit's card
    expect(w.element.querySelectorAll('.ttf.ttf-own[data-face="bird"] .bird').length).toBe(1)
    expect(w.element.querySelectorAll('.ttf').length).toBe(2)
    w.unmount()
  })
})

describe('3. marks: one per app, from the collection; no token per Pincast app', () => {
  it('a theme supplies 22 tokens, none of them an app\'s mark', () => {
    expect(TT_THEME_TOKENS).toHaveLength(22)
    expect(TT_THEME_TOKENS.filter(t => t.startsWith('--mark-'))).toEqual([])
    expect(TT_LEGACY_MARK_TOKENS).toEqual(['--mark-th', '--mark-vt', '--mark-pc'])
  })
  it('the table draws an app\'s mark from its color in the collection\'s apps', async () => {
    const tt = createTabletop(CONFIG({ groups: ['app', 'set'] }))
    const w = mount(tt.Tabletop, { props: { tabletop: tt }, attachTo: document.body })
    await flushPromises()
    const marked = [...w.element.querySelectorAll('[style*="--app"]')].map(e => e.style.getPropertyValue('--app'))
    expect(marked.length).toBeGreaterThan(0)
    expect(marked.every(v => v === '#B4432F')).toBe(true)
    w.unmount()
  })
})

describe('4. the Studio face is one more kit face: a host\'s face drawn by it is the Studio\'s, under its own id', () => {
  // A fourth app's face drawn by the Studio face (its base), beside the Studio's own card in the same collection
  const STUDIO_DATA = () => ({
    apps: [{ id: 'birds', name: 'Bird walk', color: '#B4432F', site: 'birds.example' }, { id: 'studio', name: 'Studio', color: '#006638' }],
    sets: [{ id: 'ramble', app: 'birds', name: 'The Ramble', short: 'RAMBLE', trek: 9, meta: { face: 'board' } }],
    rarities: { place: ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Unique', 'Mythic', 'Legendary'] },
    faces: { board: { base: 'studio' }, studio: {} },
    cards: [],
  })
  const CARD = (o = {}) => ({
    id: 'b:bow', app: 'birds', set: 'ramble', kind: 'place', title: 'The Bow Bridge', subtitle: 'Cast iron, 1862', type: 'Place',
    fact: 'The second oldest cast iron bridge in America', back: 'Stand at its middle and look west for the San Remo towers.',
    stats: [{ k: 'Built', v: '1862' }, { k: 'Span', v: '87 feet' }], number: 3, of: 12, rarity: 'Legendary', foil: true,
    accent: '#1E4FD0', img: 'https://example.org/bow.jpg', credit: 'Photo: Someone, CC BY-SA 4.0', held: true,
    collected: '2026-11-10', find: 4, place: 'Bow Bridge', collector: { n: 3, of: 12 }, ...o,
  })
  const data = STUDIO_DATA()

  it('the config takes a face based on studio, and studio itself, for an app the kit has never heard of', () => {
    expect(ttConfigErrors(CONFIG({ faces: { board: { base: 'studio' }, studio: {} } }), CONTRACT_VERSION)).toEqual([])
    expect(ttConfigErrors(CONFIG({ faces: { studio: { base: 'treehopper' } } }), CONTRACT_VERSION))
      .toEqual(["config.faces.studio.base: a kit face draws itself; give the app's own face its own id"])
  })
  it('the look, print, foil, waterline, furniture and classes are the Studio\'s', () => {
    const own = ttLook(CARD(), data)
    const kit = ttLook(CARD({ face: 'studio' }), data)
    expect([own.face, own.base, own.theme]).toEqual(['board', 'studio', 'pc'])
    expect({ ...own, face: 'studio' }).toEqual(kit)
    // the Studio has no foil, even on the top rarity; its waterline is the accent
    expect(own.foil).toBe(false)
    expect(own.wl).toBe(kit.wl)
    expect(own.wl).not.toBe(null)
    expect(ttFaceClass(own, 'front')).toBe(ttFaceClass(kit, 'front'))
    expect(ttFaceClass(own, 'front')).toContain('ttf-studio ttf-t-pc ttf-pc')
    // print on by its base, for an app that is not the Studio; the face entry still wins
    expect(ttPrintOn(CARD(), data)).toBe(true)
    expect(ttPrintOn(CARD(), { ...data, faces: { board: { base: 'studio', print: false } } })).toBe(false)
    // the collector number padded to three, no rarity glyph (the Studio prints none)
    expect(ttFurniture(CARD(), data)).toEqual(ttFurniture(CARD({ face: 'studio' }), data))
    expect(ttFurniture(CARD(), data).no).toBe('003/012')
    expect(ttFurniture(CARD(), data).rm).toBe('')
    expect(ttFurniture(CARD({ face: 'stop' }), data).rm).toBe(TT_RMARK[6])
  })
  it('TtFace draws the Studio\'s markup under the host\'s data-face, both sides, held and not, and loads its fonts', () => {
    const scenes = [CARD(), CARD({ held: false, collected: null, find: null, place: null, spot: '0.2 mi' }), CARD({ accent: null })]
    for (const card of scenes) {
      for (const side of ['front', 'back']) {
        const own = mount(TtFace, { props: { card, data, side, copyright: '(c) 2026 Bird walk' } })
        const kit = mount(TtFace, { props: { card: { ...card, face: 'studio' }, data, side, copyright: '(c) 2026 Bird walk' } })
        expect(own.element.getAttribute('data-face')).toBe('board')
        expect(own.html().replace('data-face="board"', 'data-face="studio"')).toBe(kit.html())
        own.unmount(); kit.unmount()
      }
    }
    expect(head.mock.calls.some(([e]) => e.link.some(l => l.href === TT_PC_FONTS))).toBe(true)
    expect(head.mock.calls.some(([e]) => e.link.some(l => l.href === TT_TH_FONTS))).toBe(false)
  })
  it('the Studio face\'s foot names the card\'s own app from the collection\'s apps', () => {
    const f = mount(TtFace, { props: { card: CARD(), data, fonts: false } })
    expect(f.element.querySelector('.ttf-pc-line').textContent).toBe('BIRD WALK · BIRDS.EXAMPLE')
    const b = mount(TtFace, { props: { card: CARD(), data, side: 'back', fonts: false } })
    expect(b.element.querySelector('.ttf-pc-app').textContent).toBe('Bird walk')
    f.unmount(); b.unmount()
  })
  it('the table loads the Studio\'s fonts for a collection whose only Studio-drawn cards are a host\'s face', async () => {
    const coll = { ...STUDIO_DATA(), cards: [CARD()] }
    const w = mount(TtTable, { props: { collection: coll, options: { key: 'tt_k14_board' } }, attachTo: document.body })
    await flushPromises()
    const keys = head.mock.calls.flatMap(([e]) => (e.link || []).map(l => l.key))
    expect(keys).toContain('tt-pc-fonts')
    expect(keys).not.toContain('tt-th-fonts')
    expect(w.element.querySelectorAll('.ttf.ttf-pc[data-face="board"]').length).toBe(1)
    w.unmount()
    // and createTabletop takes the face from the config
    const tt = createTabletop(CONFIG({ faces: { board: { base: 'studio' } }, source: { load: vi.fn(async () => coll) } }))
    const t = mount(tt.Tabletop, { props: { tabletop: tt }, attachTo: document.body })
    await flushPromises()
    expect(tt.error.value).toBe(null)
    expect(t.element.querySelectorAll('.ttf.ttf-pc[data-face="board"]').length).toBe(1)
    t.unmount()
  })
})

describe('5. the pack: a fourth app\'s band is the host\'s tint, its mark from the collection', () => {
  it('a host passes its app\'s color; an app the pack knows no tint for, without one, takes Studio green', () => {
    expect(ttPackLook({ app: 'birds', tint: '#B4432F', name: 'Bird walk' }).tint).toBe('#B4432F')
    expect(ttPackLook({ app: 'birds', name: 'Bird walk' }).tint).toBe(TT_PACK_TINTS.studio)
    for (const app of ['studio', 'treehopper', 'verythere']) expect(ttPackLook({ app }).tint).toBe(TT_PACK_TINTS[app])
  })
  it('an app id that is a name on every object takes no color from it', () => {
    for (const app of ['constructor', 'hasownproperty', '__proto__']) expect(ttPackLook({ app }).tint).toBe(TT_PACK_TINTS.studio)
  })
})
