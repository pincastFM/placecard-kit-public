// @vitest-environment jsdom
/**
 * One mount per component: each of the seven renders from the kit alone, on Vue 3.3.4 and on
 * the latest Vue (CI's matrix). The host hooks carry what the kit no longer does itself: the fonts
 * and the table's data-tt go to the host's head, the day sheet's unit comes from the host's store,
 * the page lock goes to the host's lock, and nothing is set on <html> by the kit (CONTRACT.md).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, ref, reactive, nextTick } from 'vue'
import { TtTable, TtFace, TtRail, TtRuler, TtSearch, TtStage, TtDay, useTtTable, setTtHost, ttLock, ttLocked, ttHtmlLock, CONTRACT_VERSION } from '../../vue/index.js'
import { TT_FACE_FONTS } from '../../core/face.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.animate = function () { return { onfinish: null, oncancel: null, cancel() {}, finish() {} } }
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}

const PINE = { id: 'th:loblolly-pine', app: 'treehopper', set: 'treehopper', face: 'treehopper', title: 'Loblolly Pine', subtitle: 'Pinus taeda', type: 'Species', fact: '1 in New York', back: 'The workhorse pine of the American South.', stats: [], number: null, of: null, rarity: 'Unique', rarityRank: 6, rarityCount: '1 in New York', foil: true, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 48 }
const GINKGO = { ...PINE, id: 'th:ginkgo', title: 'Ginkgo', subtitle: 'Ginkgo biloba', rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, held: false, collected: null, added: null }
const LYCEUM = { id: 'walk-3986:17530', app: 'verythere', set: 'walk-3986', face: 'stop', title: 'The Lyceum Theatre', subtitle: 'Theater, 1903', type: 'Theater, 1903', fact: '149 to 157 West 45th Street', back: "Frohman's penthouse was on the south side, facing 45th Street.", stats: [{ k: 'Opened', v: 'November 2, 1903' }], number: 3, of: 10, rarity: 'Common', rarityRank: 0, rarityCount: null, foil: false, accent: '#3d5a3a', img: null, credit: null, held: true, collected: '2026-10-18', added: 56 }
const DATA = {
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }, { id: 'verythere', name: 'VeryThere', color: '#FFB61E' }],
  sets: [
    { id: 'treehopper', app: 'treehopper', name: 'Treehopper', short: 'TREEHOPPER', total: 620, kind: 'species', action: 'Play in Treehopper' },
    { id: 'walk-3986', app: 'verythere', name: 'Broadway Ghost Stories', short: 'BROADWAY', total: 10, kind: 'walk', action: 'Open the walk', trek: 3986 },
  ],
  rarities: { species: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'], walk: ['Common', 'Uncommon', 'Rare', 'Legendary'] },
  cards: [PINE, GINKGO, LYCEUM],
}

// A component that needs the table's state gets it as TtTable passes it: reactive(useTtTable(...))
const withTable = (C, props = {}) => mount({ setup() { const t = reactive(useTtTable(DATA, { key: 'tt_kit_test' })); return () => h(C, { t, ...props }) } }, { attachTo: document.body })

let head
beforeEach(() => {
  head = vi.fn()
  setTtHost({ head, distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => { setTtHost({ head: null, distUnit: null, lock: null }); ttLock(false) })

describe('the host hooks', () => {
  it('TtFace hands its font sheet to the host, keyed, and only when asked', () => {
    mount(TtFace, { props: { card: LYCEUM, data: DATA } })
    expect(head).toHaveBeenCalledWith({ link: [{ key: 'tt-face-fonts', rel: 'stylesheet', href: TT_FACE_FONTS }] })
    head.mockClear()
    mount(TtFace, { props: { card: LYCEUM, data: DATA, fonts: false } })
    expect(head).not.toHaveBeenCalled()
  })

  it('TtTable hands its fonts and data-tt to the host, and sets nothing on <html> itself', async () => {
    const w = mount(TtTable, { props: { collection: DATA, options: { key: 'tt_kit_test' } }, attachTo: document.body })
    await flushPromises()
    const entry = head.mock.calls.map(c => c[0]).find(e => e.htmlAttrs)
    expect(entry.htmlAttrs['data-tt']).toBe('cardroom')
    expect(entry.link.map(l => l.key)).toEqual(expect.arrayContaining(['tt-face-fonts', 'tt-cr-fonts']))
    expect(document.documentElement.getAttribute('data-tt')).toBe(null)
    w.unmount()
  })

  it('without a host, nothing is added and the faces still render', () => {
    setTtHost({ head: null })
    const w = mount(TtFace, { props: { card: PINE, data: DATA } })
    expect(head).not.toHaveBeenCalled()
    expect(w.element.className).toContain('ttf-front')
  })
})

describe('each component mounts from the kit', () => {
  it('TtFace: a stop front, typographic without a photo', () => {
    const el = mount(TtFace, { props: { card: LYCEUM, data: DATA } }).element
    expect(el.className).toBe('ttf ttf-front ttf-stop ttf-t-pop ttf-c20 ttf-typo')
    expect(el.querySelector('.ttf-typo-name').textContent).toBe('The Lyceum Theatre')
  })

  it('TtTable: the count of held cards and a cell for each', async () => {
    const w = mount(TtTable, { props: { collection: DATA, options: { key: 'tt_kit_test' } }, attachTo: document.body })
    await flushPromises()
    await nextTick()
    expect(w.find('.tt').exists()).toBe(true)
    expect(w.find('.tt-cnt > b').text()).toBe('2')
    expect(w.findAll('.tt-grid > .tt-cell')).toHaveLength(2)
    w.unmount()
  })

  it('TtRail, TtRuler and TtStage: on the table state', () => {
    const rail = withTable(TtRail)
    expect(rail.find('.tt-rail').exists()).toBe(true)
    const ruler = withTable(TtRuler)
    expect(ruler.find('.tt-slrow input').exists()).toBe(true)
    const stage = withTable(TtStage, { data: DATA, locate: () => null })
    expect(stage.find('.tt-stage').exists()).toBe(true)
    for (const w of [rail, ruler, stage]) w.unmount()
  })

  it('TtSearch: the button, and the query it sends', async () => {
    const w = mount(TtSearch, { props: { always: true } })
    expect(w.find('.tt-search.is-open').exists()).toBe(true)
    const input = w.find('input')
    await input.setValue('pine')
    await new Promise(r => setTimeout(r, 400))
    expect(w.emitted('query')?.at(-1)).toEqual(['pine'])
  })

  const daySel = () => ({
    day: ref({ slots: [], totals: { stops: 0, walkMin: 0, m: 0 }, leftOver: [] }),
    hand: { hand: ref([]) }, dealt: ref({}), dayOptions: ref([{ value: '2026-10-29', label: 'Today' }]),
    date: ref('2026-10-29'), startSel: ref('now'), win: ref({ start: 540, end: 1260 }), hours: ref(4), hourOptions: [2, 4, 8],
    set: ref({ center_label: 'Start' }), startOptions: ref([{ value: 'now', label: 'Now' }]),
    cardFor: () => null, isDealt: () => false, dealtPos: () => null, keep() {}, swap() {}, drop() {},
  })

  it('TtDay: the host\'s unit, else miles first', async () => {
    const sel = daySel()
    const toggle = vi.fn()
    const distUnit = vi.fn(() => ({ unit: ref('km'), toggle }))
    setTtHost({ distUnit })
    const w = mount(TtDay, { props: { open: true, sel, reduced: true }, attachTo: document.body })
    await nextTick()
    expect(distUnit).toHaveBeenCalled()
    expect(w.find('.tt-day').exists()).toBe(true)
    w.unmount()
    setTtHost({ distUnit: null })
    const local = mount(TtDay, { props: { open: false, sel, reduced: true } })
    expect(local.find('.tt-day').exists()).toBe(false)
  })

  it('the page lock goes to the host, and without one nothing is set on <html>; ttHtmlLock is the Card room\'s', async () => {
    const html = () => document.documentElement.hasAttribute('data-tt-locked')
    const lock = vi.fn()
    setTtHost({ lock })
    const w = mount(TtDay, { props: { open: false, sel: daySel(), reduced: true }, attachTo: document.body })
    await w.setProps({ open: true })
    expect(lock).toHaveBeenLastCalledWith(true)
    expect([ttLocked(), html()]).toEqual([true, false])
    await w.setProps({ open: false })
    expect(lock).toHaveBeenLastCalledWith(false)
    expect(ttLocked()).toBe(false)
    setTtHost({ lock: null })
    await w.setProps({ open: true })
    expect([ttLocked(), html()]).toEqual([true, false])
    w.unmount()
    expect(ttLocked()).toBe(false)
    setTtHost({ lock: ttHtmlLock })
    ttLock(true)
    expect(html()).toBe(true)
    ttLock(false)
    expect(html()).toBe(false)
  })
})

describe('one version', () => {
  it('the package, core, nav, vue, conformance, moderation and the contract name the same version', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
    const core = await import('../../core/index.js')
    const nav = await import('../../nav/index.js')
    const conformance = await import('../../conformance/index.js')
    const moderation = await import('../../moderation/index.js')
    const record = readFileSync(resolve(__dirname, '../../contract/record.ts'), 'utf8')
    expect(CONTRACT_VERSION).toBe(pkg.version)
    expect(core.CONTRACT_VERSION).toBe(pkg.version)
    expect(nav.CONTRACT_VERSION).toBe(pkg.version)
    expect(conformance.CONTRACT_VERSION).toBe(pkg.version)
    expect(moderation.CONTRACT_VERSION).toBe(pkg.version)
    expect(record).toContain(`'${pkg.version}'`)
  })
})
