// @vitest-environment jsdom
/**
 * The Retired mark (kit 1.1.0). A Treehopper front with card.retired === true prints labels.retired ("Retired") in
 * its plate, after the latin; TtTable hands the word to its faces and its stage and adds it to the cell's spoken
 * label. Any other card, side or face gains no node, so its markup is 1.0.0's (the goldens in goldens/k2, which hold
 * Treehopper cells and an open Treehopper card, are the byte check).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { TtTable, TtFace, setTtHost, ttLock } from '../../vue/index.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}
beforeEach(() => {
  Element.prototype.animate = function () { return { onfinish: null, oncancel: null, cancel() {}, finish() {} } }
  setTtHost({ head: vi.fn(), distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => { setTtHost({ head: null, distUnit: null }); document.body.innerHTML = ''; ttLock(false) })

const base = { app: 'treehopper', face: 'treehopper', fact: '', back: 'A street tree.', stats: [], of: null, rarity: 'Widespread', rarityRank: 0, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2022-07-05', added: 1 }
const sp = (id, o = {}) => ({ ...base, id: `th:${id}`, set: 'species', kind: 'species', title: id, subtitle: `Latin ${id}`, type: 'Species', number: null, ...o })
const tree = (id, o = {}) => ({ ...base, id: `tree:${id}`, set: 'trees', kind: 'tree', title: `Tree ${id}`, subtitle: '', type: 'Tree', number: null, ...o })
const RAR = ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique']
const DATA = { sets: [{ id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612 }], rarities: { species: RAR } }
const COLL = (cards) => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [
    { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' },
    { id: 'trees', app: 'treehopper', name: 'Trees', short: 'TREES', total: null, kind: 'tree' },
  ],
  rarities: { species: RAR, tree: RAR },
  cards,
})
const WALK = { apps: [{ id: 'verythere', name: 'VeryThere', color: '#C2410C' }], sets: [{ id: 'walk-1', app: 'verythere', name: 'Old Town', short: 'OLD TOWN' }], rarities: {} }
const STOP = { id: 'vt:3', app: 'verythere', set: 'walk-1', kind: 'stop', title: 'The Mill', subtitle: 'Riverside', type: 'Stop', fact: '', back: 'Built 1820.', stats: [], number: 3, of: 12, rarity: '', foil: false, accent: null, img: null, credit: null, held: true }

const face = (card, props = {}) => {
  const w = mount(TtFace, { props: { card, data: DATA, fonts: false, ...props } })
  const html = w.html()
  w.unmount()
  return html
}
const MARK = '<span class="ttf-retired">Retired</span>'
const plateOrder = (card, props) => {
  const w = mount(TtFace, { props: { card, data: DATA, fonts: false, ...props } })
  const got = [...w.element.querySelector('.ttf-plate').children].map(e => e.className)
  w.unmount()
  return got
}
const table = async (cards, props = {}) => {
  const { options = {}, ...rest } = props
  const w = mount(TtTable, { props: { collection: COLL(cards), ...rest, options: { key: 'tt_k3_test', ...options } }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const settle = async () => { await flushPromises(); await nextTick() }

describe('K3 the face: only card.retired === true prints the mark', () => {
  const pear = sp('pear', { number: 9 })

  it('no flag, false, or a value that is not true: the same markup, no node', () => {
    const gold = face(pear)
    expect(gold).not.toContain('ttf-retired')
    for (const v of [false, 'true', 1, null, {}]) expect(face({ ...pear, retired: v })).toBe(gold)
  })

  it('true: the unretired markup with the one span after the latin', () => {
    const gold = face(pear)
    const got = face({ ...pear, retired: true })
    expect(got.split(MARK).length).toBe(2)
    expect(got.replace(MARK, '')).toBe(gold)
    expect(plateOrder({ ...pear, retired: true })).toEqual(['ttf-type', 'ttf-title', 'ttf-sub', 'ttf-retired'])
  })

  it('no latin: the mark follows the name', () => {
    expect(plateOrder({ ...pear, subtitle: '', retired: true })).toEqual(['ttf-type', 'ttf-title', 'ttf-retired'])
  })

  it('a tree card\'s tile code stays where it was; the mark joins the plate after it', () => {
    expect(plateOrder(tree('574031', { mark: 'Tree 574031', subtitle: 'Pyrus calleryana', retired: true }))).toEqual(['ttf-type', 'ttf-tcode', 'ttf-title', 'ttf-sub', 'ttf-retired'])
  })

  it('the back, and the other faces, gain nothing', () => {
    expect(face({ ...pear, retired: true }, { side: 'back' })).toBe(face(pear, { side: 'back' }))
    const stop = (c, side) => { const w = mount(TtFace, { props: { card: c, data: WALK, side, fonts: false } }); const h = w.html(); w.unmount(); return h }
    for (const side of ['front', 'back']) expect(stop({ ...STOP, retired: true }, side)).toBe(stop(STOP, side))
    const dest = { ...STOP, app: 'verythere', face: 'destination', kind: 'destination', img: 'https://example.invalid/a.jpg' }
    expect(stop({ ...dest, retired: true }, 'front')).toBe(stop(dest, 'front'))
  })

  it('labels.retired names it; an empty word prints none', () => {
    expect(face({ ...pear, retired: true }, { labels: { retired: 'Hors série' } })).toBe(face({ ...pear, retired: true }).replace(MARK, '<span class="ttf-retired">Hors série</span>'))
    expect(face({ ...pear, retired: true }, { labels: { retired: '' } })).toBe(face(pear))
  })

  it('the word is cleaned as every face text is (no dash reaches a face)', () => {
    const w = mount(TtFace, { props: { card: { ...pear, retired: true }, data: DATA, fonts: false, labels: { retired: 'Out — retired' } } })
    expect(w.find('.ttf-retired').text()).not.toMatch(/[–—]/)
    w.unmount()
  })
})

describe('K3 the table: the word reaches the cells, the stage and the spoken labels', () => {
  const cards = () => [sp('pear', { number: 9, retired: true }), sp('oak', { number: 3 }), sp('elm', { held: false, collected: null, added: null })]

  it('a retired cell prints the mark and is read as retired; the others as before', async () => {
    const w = await table(cards())
    expect(w.find('.tt-cell[data-id="th:pear"] .ttf-retired').text()).toBe('Retired')
    expect(w.findAll('.ttf-retired').length).toBe(1)
    const hit = id => w.find(`.tt-cell[data-id="${id}"] .tt-hit`).attributes('aria-label')
    expect(hit('th:pear')).toBe('pear, Species, Retired')
    expect(hit('th:oak')).toBe('oak, Species')
    w.unmount()
    // a missing card (shown with the Missing filter) keeps its word before this one
    const m = await table([sp('pear', { retired: true, held: false, collected: null, added: null }), sp('oak', { number: 3 })])
    m.vm.T.filter.missing = true
    await settle()
    const cell = m.find('.tt-cell[data-id="th:pear"] .tt-hit')
    expect(cell.exists()).toBe(true)
    expect(cell.attributes('aria-label')).toBe('pear, Species, missing, Retired')
    m.unmount()
  })

  it('the open card on the stage prints it too', async () => {
    const w = await table(cards())
    w.vm.openCard('th:pear')
    await settle()
    expect(w.find('.tt-st-card .ttf-retired').text()).toBe('Retired')
    w.unmount()
    const o = await table(cards())
    o.vm.openCard('th:oak')
    await settle()
    expect(o.find('.tt-st-card .ttf').exists()).toBe(true)
    expect(o.find('.tt-st-card .ttf-retired').exists()).toBe(false)
    o.unmount()
  })

  it('labels.retired is one word for the mark and the spoken label; empty, neither', async () => {
    const w = await table(cards(), { labels: { retired: 'Hors série' } })
    expect(w.find('.tt-cell[data-id="th:pear"] .ttf-retired').text()).toBe('Hors série')
    expect(w.find('.tt-cell[data-id="th:pear"] .tt-hit').attributes('aria-label')).toBe('pear, Species, Hors série')
    w.unmount()
    const none = await table(cards(), { labels: { retired: '' } })
    expect(none.find('.ttf-retired').exists()).toBe(false)
    expect(none.find('.tt-cell[data-id="th:pear"] .tt-hit').attributes('aria-label')).toBe('pear, Species')
    none.unmount()
  })

  it('a retired species with its trees: the stack is read as retired, its trees are not', async () => {
    const kids = ['a', 'b'].map(x => tree(`pear-${x}`, { mark: `Tree ${x}` }))
    const w = await table([sp('pear', { number: 9, retired: true, childTotal: 40, children: kids }), sp('oak', { number: 3 })], { options: { nest: true } })
    expect(w.find('.tt-nest[data-nest="th:pear"]').attributes('aria-label')).toBe('pear, Retired, 2 cards')
    w.vm.openNest('th:pear')
    await settle()
    const labels = w.findAll('.tt-hit').map(b => b.attributes('aria-label'))
    expect(labels.filter(l => /^Tree pear-/.test(l))).toEqual(['Tree pear-a, Trees', 'Tree pear-b, Trees'])
    w.unmount()
  })

  it('a table with no retired card is unchanged by the word (same markup with the default given)', async () => {
    const plain = () => [sp('oak', { number: 3 }), sp('elm', { held: false, collected: null, added: null })]
    const a = await table(plain())
    const ha = a.find('.tt').html()
    a.unmount()
    const b = await table(plain(), { labels: { retired: 'Retired' } })
    expect(b.find('.tt').html()).toBe(ha)
    b.unmount()
  })
})
