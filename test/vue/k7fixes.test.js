// @vitest-environment jsdom
/**
 * Kit 1.1.0 fixes, the Vue side: a press that starts in a field of a card's back is the field's (TtCard
 * never turns, TtStage never steps to the next card), the report sheet's radios keep their arrow keys and Tab inside
 * an open card, and the admin queue links a thumb only to an http(s) or relative address.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { TtCard, TtTable, TtReport, TtModQueue, setTtHost } from '../../vue/index.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
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
  cards: [card('oak'), card('ash', { number: 2, added: 2 })],
})
const settle = async () => {
  for (let i = 0; i < 4; i++) {
    await flushPromises()
    await nextTick()
    if (!anims.length) return
    anims.splice(0).forEach(a => a.onfinish && a.onfinish())
  }
  await flushPromises()
}
const ptr = (el, type, x, y = 10) => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  Object.defineProperty(e, 'pointerId', { value: 1 })
  el.dispatchEvent(e)
}
const drag = async (el, from, to) => {
  ptr(el, 'pointerdown', from)
  ptr(el, 'pointermove', from + (to - from) / 2)
  ptr(el, 'pointermove', to)
  ptr(el, 'pointerup', to)
  await settle()
}
const key = (el, k, o = {}) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o })
  el.dispatchEvent(e)
  return e
}
const note = () => h('textarea', { class: 'note' }, 'a note')

describe('TtCard: a press in a field is the field\'s', () => {
  it('a sideways drag that starts in a textarea on the back never turns the card; one from the card still does', async () => {
    const w = mount(TtCard, { props: { card: card('oak'), data: DATA(), side: 'back' }, slots: { more: note }, attachTo: document.body })
    const c = w.find('.tt-cd-card')
    c.element.getBoundingClientRect = () => ({ left: 0, top: 0, right: 300, bottom: 562, width: 300, height: 562 })
    await flushPromises()
    await drag(w.find('.note').element, 50, 160)
    expect(w.emitted('update:side')).toBeUndefined()
    expect(c.classes()).not.toContain('is-drag')
    await drag(c.element, 50, 290)
    expect(w.emitted('update:side')).toEqual([['front']])
    w.unmount()
  })
})

describe('TtStage: a swipe that starts in a field of the open card stays on that card', () => {
  it('a drag in a textarea on the back neither steps nor flips; a swipe on the card still steps', async () => {
    const w = mount(TtTable, { props: { collection: DATA(), options: { key: 'tt_k7_stage' } }, slots: { 'stage-back': note }, attachTo: document.body })
    await flushPromises()
    await nextTick()
    await w.find('.tt-cell[data-id="oak"] .tt-hit').trigger('click')
    await settle()
    ptr(w.find('.tt-st-card').element, 'pointerdown', 10)
    ptr(w.find('.tt-st-card').element, 'pointerup', 10)
    await settle()
    expect(w.find('.tt-st-card .ttf-back').exists()).toBe(true)
    const open = w.vm.T.openId
    // both ways, so one of them would step whichever end of the table the card sits at
    await drag(w.find('.tt-st-card .note').element, 200, 60)
    await drag(w.find('.tt-st-card .note').element, 60, 200)
    expect(w.vm.T.openId).toBe(open)
    expect(w.find('.tt-st-card .ttf-back').exists()).toBe(true)
    await drag(w.find('.tt-st-card').element, 200, 60)
    await drag(w.find('.tt-st-card').element, 60, 200)
    expect(w.vm.T.openId).not.toBe(open)
    w.unmount()
  })
})

describe('TtReport: the reason radios keep their keys inside an open card', () => {
  it('arrows and Tab on a radio never reach the page (TtStage listens there); on the sheet\'s buttons they still do', async () => {
    const seen = vi.fn()
    document.addEventListener('keydown', seen)
    const w = mount(TtReport, { props: { kind: 'tree_photo', itemRef: 1, labels: { reasons: { tree_photo: { spam: 'Spam', other: 'Other' } } } }, attachTo: document.body })
    await w.find('.tt-mod-link').trigger('click')
    await flushPromises()
    const radio = w.find('.tt-mod-reason input').element
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Tab']) key(radio, k)
    key(radio, 'Tab', { shiftKey: true })
    expect(seen).not.toHaveBeenCalled()
    key(w.find('.tt-mod-btn').element, 'ArrowRight')
    expect(seen).toHaveBeenCalledTimes(1)
    document.removeEventListener('keydown', seen)
    w.unmount()
  })

  it('in TtTable\'s open card, the arrows on a radio leave the card and the sheet open', async () => {
    const back = () => h(TtReport, { kind: 'tree_photo', itemRef: 1, labels: { reasons: { tree_photo: { spam: 'Spam', other: 'Other' } } } })
    const w = mount(TtTable, { props: { collection: DATA(), options: { key: 'tt_k7_report' } }, slots: { 'stage-back': back }, attachTo: document.body })
    await flushPromises()
    await nextTick()
    await w.find('.tt-cell[data-id="oak"] .tt-hit').trigger('click')
    await settle()
    ptr(w.find('.tt-st-card').element, 'pointerdown', 10)
    ptr(w.find('.tt-st-card').element, 'pointerup', 10)
    await settle()
    const open = w.vm.T.openId
    await w.find('.tt-st-card .tt-mod-link').trigger('click')
    await flushPromises()
    key(w.find('.tt-st-card .tt-mod-reason input').element, 'ArrowRight')
    await settle()
    key(w.find('.tt-st-card .tt-mod-reason input').element, 'ArrowLeft')
    await settle()
    expect(w.vm.T.openId).toBe(open)
    expect(w.find('.tt-st-card .tt-mod-sheet').exists()).toBe(true)
    w.unmount()
  })
})

describe('TtModQueue: a thumb links only to http(s) or a relative address', () => {
  const row = (id, img) => ({ id, kind: 'tree_photo', kindLabel: 'Photo', state: 'pending', moves: [], preview: { img, title: `t${id}` }, submittedAt: null })
  it('javascript:, data: and a scheme split by a tab get no thumb; https, http and a relative path do', async () => {
    const rows = [row(1, 'javascript:alert(1)'), row(2, 'java\tscript:alert(1)'), row(3, ' JavaScript:alert(1)'), row(4, 'data:text/html,x'),
      row(5, 'https://img.example/a.jpg'), row(6, 'http://img.example/b.jpg'), row(7, '/photos/c.jpg'), row(8, 'photos/d.jpg')]
    const request = vi.fn(async (op) => (op === 'queue' ? { rows, next: null, counts: { waiting: rows.length } } : {}))
    const w = mount(TtModQueue, { props: { request }, attachTo: document.body })
    await flushPromises()
    const thumbs = Object.fromEntries(w.findAll('.tt-mod-row').map(r => [r.attributes('data-row'), r.find('.tt-mod-thumb').exists() ? r.find('.tt-mod-thumb').attributes('href') : null]))
    expect(thumbs).toEqual({ 1: null, 2: null, 3: null, 4: null, 5: 'https://img.example/a.jpg', 6: 'http://img.example/b.jpg', 7: '/photos/c.jpg', 8: 'photos/d.jpg' })
    w.unmount()
  })
})
