// @vitest-environment jsdom
/**
 * A card's set, one level under it (2026-10-31; UI word "set", code word "nest"). Core ttNest;
 * useTtTable's nest (options.nest, off by default); TtTable's stack in the grid, the open set, the way
 * back, Escape, the host's openNest/closeNest and the nest event; the open card's "i / n" inside a set.
 * Off, the markup is byte for byte as before (NYID's goldens are the Provo check, run on the packed kit).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick, reactive } from 'vue'
import { TtTable, setTtHost, useTtTable, ttLock } from '../../vue/index.js'
import { ttNest } from '../../core/index.js'

let RM = false
window.matchMedia = q => ({ matches: /reduce/.test(q) && RM, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
const scrolls = []
window.scrollTo = (x, y) => { const top = typeof x === 'object' ? x.top : y; scrolls.push(top); window.scrollY = top }

const anims = []
beforeEach(() => {
  RM = false
  anims.length = 0
  scrolls.length = 0
  window.scrollY = 0
  Element.prototype.animate = function (kf, o) {
    const a = { el: this, kf, o, onfinish: null, oncancel: null, cancel: vi.fn(), finish: vi.fn() }
    anims.push(a)
    return a
  }
  setTtHost({ head: vi.fn(), distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => { setTtHost({ head: null, distUnit: null }); document.body.innerHTML = ''; ttLock(false) })

const tree = (id, o = {}) => ({ id: `tree:${id}`, app: 'treehopper', set: 'trees', kind: 'tree', face: 'treehopper', title: `Tree ${id}`, subtitle: '', type: 'Tree', fact: '', back: '', stats: [], number: null, of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1, ...o })
const sp = (id, o = {}) => ({ id: `th:${id}`, app: 'treehopper', set: 'species', kind: 'species', face: 'treehopper', title: id, subtitle: '', type: 'Species', fact: '', back: '', stats: [], number: null, of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1, ...o })
const DATA = ({ kids = true } = {}) => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [
    { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' },
    { id: 'trees', app: 'treehopper', name: 'Trees', short: 'TREES', total: null, kind: 'tree' },
  ],
  rarities: { species: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'], tree: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'] },
  cards: [
    sp('oak', { number: 1, ...(kids ? { childTotal: 4260, children: ['a', 'b', 'c'].map(x => tree(`oak-${x}`)) } : {}) }),
    sp('ash', { number: 2, ...(kids ? { childTotal: 1, children: [tree('ash-a')] } : {}) }),
    sp('elm', { number: 3, ...(kids ? { childTotal: 900, children: Array.from({ length: 9 }, (_, i) => tree(`elm-${i}`)) } : {}) }),
    sp('yew', { number: 4 }),
    sp('fir', { held: false, collected: null, added: null, ...(kids ? { children: [tree('fir-a')] } : {}) }),
  ],
})
const at = async (props = {}, slots) => {
  const { options = {}, ...rest } = props
  const w = mount(TtTable, { props: { collection: DATA(), ...rest, options: { key: 'tt_nest_test', ...options } }, slots, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const settle = async () => { anims.splice(0).forEach(a => a.onfinish && a.onfinish()); await flushPromises(); await nextTick() }
const NEST = { options: { nest: true } }

describe('core ttNest', () => {
  it('the children in order, the total, no error', () => {
    const r = ttNest({ id: 'p', childTotal: 12, children: [{ id: 'a' }, { id: 'b' }] })
    expect(r.cards.map(c => c.id)).toEqual(['a', 'b'])
    expect(r.total).toBe(12)
    expect(r.error).toBeNull()
  })
  it('no children: cards [], the total kept; a bad total is null', () => {
    expect(ttNest({ id: 'p', childTotal: 3 })).toEqual({ cards: [], total: 3, error: null })
    expect(ttNest({ id: 'p', childTotal: 'x', children: [{ id: 'a' }] }).total).toBeNull()
    expect(ttNest({ id: 'p', childTotal: -1, children: [{ id: 'a' }] }).total).toBeNull()
    expect(ttNest(null)).toEqual({ cards: [], total: null, error: null })
  })
  it('one level only, ids present and distinct (the parent\'s included): else cards [] and the error', () => {
    expect(ttNest({ id: 'p', children: [{ id: 'a', children: [{ id: 'z' }] }] }).error).toMatch(/one level only/)
    expect(ttNest({ id: 'p', children: [{ id: 'a' }, { title: 'no id' }] }).error).toBe('a child without an id')
    expect(ttNest({ id: 'p', children: [{ id: 'a' }, { id: 'a' }] }).error).toBe('id a twice')
    const r = ttNest({ id: 'p', children: [{ id: 'p' }] })
    expect(r.error).toBe('id p twice')
    expect(r.cards).toEqual([])
  })
})

describe('useTtTable nest', () => {
  const table = (o = {}) => reactive(useTtTable(() => DATA(), { key: 'tt_nest_unit', ...o }))
  it('off by default: children ignored, openNest false, the row as before', () => {
    const T = table()
    expect(T.nestOn).toBe(false)
    expect(T.nestOf(T.cards[0])).toBeNull()
    expect(T.openNest('th:oak')).toBe(false)
    expect(T.nest).toBeNull()
  })
  it('on: children never enter counts or groups; the open set is the row, parent first; closeNest goes back', () => {
    const T = table({ nest: true })
    const ids = T.groups.flatMap(g => g.cards.map(c => c.id))
    expect(ids.some(id => id.startsWith('tree:'))).toBe(false)
    expect(T.heldCount).toBe(4)
    expect(T.nestOf(T.cards.find(c => c.id === 'th:fir'))).toBeNull() // a missing card has no set
    expect(T.openNest('th:yew')).toBe(false)
    expect(T.openNest('th:oak')).toBe(true)
    expect(T.nestCards.map(c => c.id)).toEqual(['th:oak', 'tree:oak-a', 'tree:oak-b', 'tree:oak-c'])
    expect(T.nestCount).toEqual({ n: 3, of: 4260 })
    T.open('tree:oak-a')
    expect(T.row.index).toBe(1)
    expect(T.row.total).toBe(4)
    T.step(1)
    expect(T.openId).toBe('tree:oak-b')
    expect(T.openNest('th:oak')).toBe(true) // the same set again leaves the open card as it is
    expect(T.openId).toBe('tree:oak-b')
    expect(T.closeNest()).toBe(true)
    expect(T.nest).toBeNull()
    expect(T.openId).toBeNull()
    expect(T.closeNest()).toBe(false)
  })
  it('a bad set: the card alone, named once', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = DATA()
    d.cards[0].children[1].children = [tree('deep')]
    const T = reactive(useTtTable(() => d, { key: 'tt_nest_bad', nest: true }))
    expect(T.nestOf(T.cards[0])).toBeNull()
    expect(err).toHaveBeenCalledTimes(1)
    expect(err.mock.calls[0][0]).toMatch(/th:oak: child tree:oak-b has children/)
    err.mockRestore()
  })
})

describe('TtTable, nest off', () => {
  it('children change nothing: the markup is the same as a collection without them', async () => {
    const a = await at({ collection: DATA({ kids: false }) })
    const b = await at({ collection: DATA() })
    expect(b.html()).toBe(a.html())
    expect(b.find('.tt-nest').exists()).toBe(false)
    expect(b.find('.tt').classes()).not.toContain('is-nest')
    a.unmount(); b.unmount()
  })
})

describe('TtTable, nest on: the stack in the grid', () => {
  it('a held card with children is a stack: edges N..1 (6 at most), the card on top without data-id, the ×N stub', async () => {
    const w = await at(NEST)
    const oak = w.find('.tt-nest[data-nest="th:oak"]')
    expect(oak.attributes('role')).toBe('button')
    expect(oak.attributes('tabindex')).toBe('0')
    expect(oak.attributes('data-face')).toBe('treehopper')
    expect(oak.attributes('aria-label')).toBe('oak, 3 cards')
    expect(oak.findAll('.tt-edge').map(e => e.attributes('style'))).toEqual(['--i: 3;', '--i: 2;', '--i: 1;'])
    const top = oak.find('.tt-cell')
    expect(top.attributes('data-id')).toBeUndefined()
    expect(top.attributes('data-k')).toBeUndefined()
    expect(top.attributes('aria-hidden')).toBe('true')
    expect(top.find('.tt-hit').exists()).toBe(false)
    expect(oak.find('.tt-pile-n').text()).toBe('×3')
    expect(w.find('.tt-nest[data-nest="th:elm"]').findAll('.tt-edge')).toHaveLength(6)
    expect(w.find('.tt-nest[data-nest="th:ash"]').attributes('aria-label')).toBe('ash, 1 card')
    // no set: an ordinary cell; a missing card never stacks
    expect(w.find('.tt-cell[data-id="th:yew"] .tt-hit').exists()).toBe(true)
    expect(w.find('.tt-nest[data-nest="th:fir"]').exists()).toBe(false)
    w.unmount()
  })
  it('labels child and children, and slot nest-n before N', async () => {
    const w = await at({ ...NEST, labels: { child: 'tree', children: 'trees' } }, { 'nest-n': ({ n }) => h('i', { class: 'mark' }, `t${n}`) })
    expect(w.find('.tt-nest[data-nest="th:oak"]').attributes('aria-label')).toBe('oak, 3 trees')
    expect(w.find('.tt-nest[data-nest="th:ash"]').attributes('aria-label')).toBe('ash, 1 tree')
    expect(w.find('.tt-nest[data-nest="th:oak"] .tt-pile-n').html()).toContain('<i class="mark">t3</i>3')
    w.unmount()
  })
})

describe('TtTable, nest on: the open set and the way back', () => {
  it('a tap opens it: Back, the parent on the slip, "n of total", the parent then its children as cells; the chrome hidden', async () => {
    const w = await at({ ...NEST, tag: 'Treecount', counter: { n: 4, of: 612 } }, { head: () => h('button', { class: 'join' }, 'Join') })
    expect(w.find('.join').exists()).toBe(true)
    window.scrollY = 840
    await w.find('.tt-nest[data-nest="th:oak"]').trigger('click')
    await nextTick()
    expect(w.emitted('nest')).toEqual([['th:oak']])
    expect(w.find('.tt').classes()).toContain('is-nest')
    expect(w.find('button.tt-back').text()).toBe('Treecount')
    expect(w.find('a.tt-back').exists()).toBe(false)
    expect(w.find('.tt-nest-tag > span').text()).toBe('oak')
    expect(w.find('.tt-cnt > b').text()).toBe('3')
    expect(w.find('.tt-cnt > .tt-cl').text()).toBe('of 4,260')
    expect(w.find('.join').exists()).toBe(false)
    expect(w.find('.tt-groups').classes()).toContain('is-solo')
    const cells = w.findAll('.tt-nest-grp .tt-grid > .tt-cell')
    expect(cells.map(c => c.attributes('data-id'))).toEqual(['th:oak', 'tree:oak-a', 'tree:oak-b', 'tree:oak-c'])
    expect(cells[0].find('.tt-hit').attributes('aria-label')).toBe('oak, Species')
    expect(cells[1].find('.tt-hit').attributes('aria-label')).toBe('Tree oak-a, Trees')
    expect(w.find('.tt-bx').exists()).toBe(false)
    expect(scrolls.at(-1)).toBe(0)
    expect(document.activeElement).toBe(w.find('button.tt-back').element)
    // Back: the top table again, the scroll to the pixel, focus on the stack that opened it
    await w.find('button.tt-back').trigger('click')
    await nextTick()
    expect(w.emitted('nest')).toEqual([['th:oak'], [null]])
    expect(w.find('.tt').classes()).not.toContain('is-nest')
    expect(w.find('a.tt-back').exists()).toBe(true)
    expect(w.find('.tt-tag').text()).toBe('Treecount')
    expect(w.find('.tt-cnt > .tt-cl').text()).toBe('of 612')
    expect(w.find('.join').exists()).toBe(true)
    expect(scrolls.at(-1)).toBe(840)
    expect(document.activeElement).toBe(w.find('.tt-nest[data-nest="th:oak"]').element)
    w.unmount()
  })
  it('back reads labels.nestBack, else the tag, else Back; no total: the cards word', async () => {
    const d = DATA()
    delete d.cards[0].childTotal
    const w = await at({ ...NEST, collection: d })
    await w.find('.tt-nest[data-nest="th:oak"]').trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(w.find('button.tt-back').text()).toBe('Back')
    expect(w.find('.tt-cnt > .tt-cl').text()).toBe('Cards')
    w.unmount()
    const v = await at({ ...NEST, tag: 'Sample', labels: { nestBack: 'Treecount' } })
    await v.find('.tt-nest[data-nest="th:oak"]').trigger('keydown', { key: ' ' })
    await nextTick()
    expect(v.find('button.tt-back').text()).toBe('Treecount')
    v.unmount()
  })
  it('a fade both ways, none under reduced motion', async () => {
    const w = await at(NEST)
    anims.length = 0
    await w.find('.tt-nest[data-nest="th:oak"]').trigger('click')
    await nextTick()
    const fades = anims.filter(a => a.o && a.o.duration === 160 && a.kf[0].opacity === 0)
    expect(fades.map(a => a.el.className)).toEqual(expect.arrayContaining(['tt-groups is-solo', 'tt-top-in']))
    w.unmount()
    RM = true
    const v = await at(NEST)
    anims.length = 0
    await v.find('.tt-nest[data-nest="th:oak"]').trigger('click')
    await nextTick()
    expect(anims.filter(a => a.o && a.o.duration === 160)).toHaveLength(0)
    v.unmount()
  })
  it('Escape closes the set, unless something over the table took it', async () => {
    const w = await at(NEST)
    await w.find('.tt-nest[data-nest="th:oak"]').trigger('click')
    await nextTick()
    ttLock(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(w.find('.tt').classes()).toContain('is-nest')
    ttLock(false)
    const taken = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    taken.preventDefault()
    document.dispatchEvent(taken)
    await nextTick()
    expect(w.find('.tt').classes()).toContain('is-nest')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()
    expect(w.find('.tt').classes()).not.toContain('is-nest')
    w.unmount()
  })
  it('the host drives it: openNest and closeNest exposed, false for a card with no set; the nest event either way', async () => {
    const w = await at(NEST)
    expect(w.vm.openNest('th:yew')).toBe(false)
    expect(w.vm.openNest('th:elm')).toBe(true)
    await nextTick()
    expect(w.findAll('.tt-nest-grp .tt-cell')).toHaveLength(10)
    expect(w.vm.closeNest()).toBe(true)
    await flushPromises()
    expect(w.emitted('nest')).toEqual([['th:elm'], [null]])
    expect(document.activeElement).toBe(w.find('.tt-nest[data-nest="th:elm"]').element)
    w.unmount()
  })
  it('inside a set the open card counts "i / n" over the set, and prev and next walk it', async () => {
    const w = await at(NEST)
    await w.find('.tt-nest[data-nest="th:oak"]').trigger('click')
    await nextTick()
    await w.find('.tt-cell[data-id="tree:oak-b"] .tt-hit').trigger('click')
    await settle()
    expect(w.find('.tt-st-pos').text()).toBe('3 / 4')
    expect(w.find('.tt-st-nav.is-prev').attributes('disabled')).toBeUndefined()
    expect(w.find('.tt-st-nav.is-next').attributes('disabled')).toBeUndefined()
    w.unmount()
  })
  it('the deal counts the stacks with the cells', async () => {
    const w = await at(NEST)
    const g0 = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function () { return { top: 10, bottom: 100, left: 0, right: 50, width: 50, height: 90 } }
    const plan = w.vm.deal()
    Element.prototype.getBoundingClientRect = g0
    expect(plan.map(s => s.id)).toEqual(['th:oak', 'th:ash', 'th:elm', 'th:yew'])
    w.unmount()
  })
})
