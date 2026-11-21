// @vitest-environment jsdom
/**
 * The kit's two additions for Treehopper's collection (2026-10-29), each rendering nothing when
 * unused. options.groupLabels names the Group segment's buttons ("Found", "Sets"); the back slot runs
 * TtFace `more` (the end of the back's body, inside its scroll) through TtStage `more` and
 * TtTable `stage-back`, and a tap or Enter on a link in it is the link's, not a flip. The open card's
 * head says the table's want word. Provo's byte-for-byte check is NYID's goldens, run on the packed kit.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { TtFace, TtTable, setTtHost } from '../../vue/index.js'

window.matchMedia = q => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}

const anims = []
beforeEach(() => {
  anims.length = 0
  Element.prototype.animate = function (kf, o) {
    const a = { el: this, kf, o, onfinish: null, oncancel: null, cancel() {}, finish: vi.fn() }
    anims.push(a)
    return a
  }
  setTtHost({ head: vi.fn(), distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => { setTtHost({ head: null, distUnit: null }); document.body.innerHTML = '' })

const card = (id, o = {}) => ({ id, app: 'treehopper', set: 'treecount', kind: 'tree', face: 'treehopper', title: id, subtitle: 'Quercus', type: 'Species', fact: '', back: 'A story.', stats: [], number: 1, of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1, ...o })
const DATA = () => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [{ id: 'treecount', app: 'treehopper', name: 'Treecount', short: 'TREECOUNT', total: 612, kind: 'tree' }],
  rarities: { tree: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'] },
  cards: [card('oak'), card('ash', { number: 2, added: 2 }), card('yew', { held: false, number: null, collected: null, added: null })],
})
const at = async (props = {}, slots) => {
  const { options = {}, ...rest } = props
  const w = mount(TtTable, { props: { collection: DATA(), ...rest, options: { key: 'tt_a45_test', ...options } }, slots, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const settle = async () => { anims.splice(0).forEach(a => a.onfinish && a.onfinish()); await flushPromises(); await nextTick() }
const segment = w => w.find('.tt-strip .tt-seg').findAll('button').map(b => b.text())
// A tap: pointerdown then pointerup at one point on el, bubbling to the stage's card
function tap(el) {
  for (const type of ['pointerdown', 'pointerup']) {
    const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })
    Object.defineProperty(e, 'pointerId', { value: 1 })
    el.dispatchEvent(e)
  }
}
async function showMissing(w) {
  await w.find('.tt-strip .tt-chip[data-k="missing"]').trigger('click')
  await settle()
}
async function openBack(w, id = 'oak') {
  await w.find(`.tt-cell[data-id="${id}"] .tt-hit`).trigger('click')
  await settle()
  tap(w.find('.tt-st-card').element)
  await settle()
  return w.find('.tt-st-card')
}

describe('options.groupLabels', () => {
  it('names the offered groups in the Group segment; an id it leaves out keeps its word', async () => {
    const w = await at({ options: { groups: ['none', 'rarity', 'set'], group: 'none', groupLabels: { none: 'Found', set: 'Sets', kind: 'Kinds' } } })
    expect(segment(w)).toEqual(['Found', 'Rarity', 'Sets'])
    w.unmount()
  })

  it('unset, the segment is as before', async () => {
    const w = await at({ options: { groups: ['none', 'rarity', 'set'], group: 'none' } })
    expect(segment(w)).toEqual(['None', 'Rarity', 'Set'])
    w.unmount()
  })

  it('a ledger name already plural takes no second s', async () => {
    const w = await at({ options: { groups: ['set', 'none'], groupLabels: { set: 'Sets' } } })
    expect(w.find('.tt-ledger').attributes('aria-label')).toBe('Sets')
    w.unmount()
    const v = await at({ options: { groups: ['set', 'none'] } })
    expect(v.find('.tt-ledger').attributes('aria-label')).toBe('Sets')
    v.unmount()
  })
})

describe('TtFace slot more', () => {
  it('draws last in the back\'s body, inside its scroll, with the card', () => {
    const w = mount(TtFace, { props: { card: card('oak'), side: 'back', fonts: false }, slots: { more: ({ card: c }) => h('a', { class: 'ph', href: '/trees/7' }, c.title) } })
    const body = w.find('.ttf-bk-body')
    expect(body.element.lastElementChild.className).toBe('ph')
    expect(body.find('.ph').text()).toBe('oak')
  })

  it('unused, the back is as before; the front never draws it', () => {
    const plain = mount(TtFace, { props: { card: card('oak'), side: 'back', fonts: false } })
    expect(plain.find('.ttf-bk-body').element.lastElementChild.className).toContain('ttf-bk-got')
    const front = mount(TtFace, { props: { card: card('oak'), side: 'front', fonts: false }, slots: { more: () => h('a', { class: 'ph', href: '/' }, 'x') } })
    expect(front.find('.ph').exists()).toBe(false)
  })
})

describe('TtTable stage-back and TtStage more', () => {
  const slots = { 'stage-back': ({ card: c, t }) => h('span', { class: 'ph-list' }, [h('a', { class: 'ph', href: `/trees/${c.title}` }, `${c.title} ${t.shown.length}`)]) }

  it('the open card\'s back carries the slot inside its body, with { card, t }', async () => {
    const w = await at({}, slots)
    const st = await openBack(w)
    expect(st.find('.ttf-back').exists()).toBe(true)
    const ph = st.find('.ttf-bk-body .ph-list .ph')
    expect(ph.exists()).toBe(true)
    expect(ph.text()).toBe('oak 2')
    w.unmount()
  })

  it('a tap or Enter on a link in it does not flip; a tap elsewhere on the card still does', async () => {
    const w = await at({}, slots)
    const st = await openBack(w)
    const link = st.find('.ph').element
    tap(link)
    await settle()
    expect(w.find('.tt-st-card .ttf-back').exists()).toBe(true)
    const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    link.dispatchEvent(key)
    await settle()
    expect(key.defaultPrevented).toBe(false)
    expect(w.find('.tt-st-card .ttf-back').exists()).toBe(true)
    tap(w.find('.tt-st-card .ttf-bk-title').element)
    await settle()
    expect(w.find('.tt-st-card .ttf-back').exists()).toBe(false)
    expect(w.find('.tt-st-card .ttf-front').exists()).toBe(true)
    w.unmount()
  })

  it('Enter on the card itself still flips', async () => {
    const w = await at()
    await w.find('.tt-cell[data-id="oak"] .tt-hit').trigger('click')
    await settle()
    const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    w.find('.tt-st-card').element.dispatchEvent(key)
    await settle()
    expect(key.defaultPrevented).toBe(true)
    expect(w.find('.tt-st-card .ttf-back').exists()).toBe(true)
    w.unmount()
  })

  it('unused, the open back ends as before', async () => {
    const w = await at()
    const st = await openBack(w)
    expect(st.find('.ttf-bk-body').element.lastElementChild.className).toContain('ttf-bk-got')
    expect(st.find('.ph-list').exists()).toBe(false)
    w.unmount()
  })
})

describe('the open card\'s want word', () => {
  it('the table\'s labels.want on a missing card; WANTED unset', async () => {
    const w = await at({ labels: { want: 'MISSING' } })
    await showMissing(w)
    await w.find('.tt-cell[data-id="yew"] .tt-hit').trigger('click')
    await settle()
    expect(w.find('.tt-st-want').text()).toBe('MISSING')
    w.unmount()
    const v = await at()
    await showMissing(v)
    await v.find('.tt-cell[data-id="yew"] .tt-hit').trigger('click')
    await settle()
    expect(v.find('.tt-st-want').text()).toBe('WANTED')
    v.unmount()
  })
})
