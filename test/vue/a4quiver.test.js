// @vitest-environment jsdom
/**
 * TtStage's first-card quiver (2026-10-29), through TtTable `quiver`, and the stage card's
 * is-lifted while it flips. Off unset; never under reduced motion (and then the function is not called);
 * called off by anything the person does first.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { TtTable, setTtHost } from '../../vue/index.js'

let RM = false
window.matchMedia = q => ({ matches: /reduce/.test(q) && RM, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}

const anims = []
const timers = []
const realST = globalThis.setTimeout
beforeEach(() => {
  RM = false
  anims.length = 0
  timers.length = 0
  Element.prototype.animate = function (kf, o) {
    const a = { el: this, kf, o, onfinish: null, oncancel: null, cancel: vi.fn(), finish: vi.fn() }
    anims.push(a)
    return a
  }
  // the stage's 1200 ms wait is held here and fired by hand; every other timer runs
  globalThis.setTimeout = (fn, ms, ...x) => (ms === 1200 ? (timers.push(fn), 9000 + timers.length) : realST(fn, ms, ...x))
  setTtHost({ head: vi.fn(), distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => { globalThis.setTimeout = realST; setTtHost({ head: null, distUnit: null }); document.body.innerHTML = '' })

const card = (id, o = {}) => ({ id, app: 'treehopper', set: 'treecount', kind: 'tree', face: 'treehopper', title: id, subtitle: 'Quercus', type: 'Species', fact: '', back: 'A story.', stats: [], number: 1, of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1, ...o })
const DATA = () => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [{ id: 'treecount', app: 'treehopper', name: 'Treecount', short: 'TREECOUNT', total: 612, kind: 'tree' }],
  rarities: { tree: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'] },
  cards: [card('oak'), card('ash', { number: 2, added: 2 })],
})
const at = async (props = {}) => {
  const w = mount(TtTable, { props: { collection: DATA(), ...props, options: { key: 'tt_quiver_test' } }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const settle = async () => { anims.splice(0).forEach(a => a.onfinish && a.onfinish()); await flushPromises(); await nextTick() }
const open = async (w, id = 'oak') => { await w.find(`.tt-cell[data-id="${id}"] .tt-hit`).trigger('click'); await settle() }
const fire = () => timers.splice(0).forEach(f => f())
const quivers = () => anims.filter(a => a.el.classList && a.el.classList.contains('tt-st-card') && JSON.stringify(a.kf).includes('-12deg'))

describe('TtStage quiver (H211)', () => {
  it('on: the open card quivers once, 1200 ms after it lands, rotateY(-12deg) at .45 over 520 ms', async () => {
    const w = await at({ quiver: true })
    await open(w)
    expect(timers.length).toBe(1)
    fire()
    const q = quivers()
    expect(q.length).toBe(1)
    expect(q[0].kf[1]).toEqual({ transform: 'rotateY(-12deg)', offset: 0.45 })
    expect(q[0].o).toEqual({ duration: 520, easing: 'ease-in-out' })
    fire()
    expect(quivers().length).toBe(1)
    w.unmount()
  })

  it('off unset: no wait, no quiver', async () => {
    const w = await at()
    await open(w)
    expect(timers.length).toBe(0)
    expect(quivers().length).toBe(0)
    w.unmount()
  })

  it('touched first (a pointer on the card): none', async () => {
    const w = await at({ quiver: true })
    await open(w)
    const e = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })
    Object.defineProperty(e, 'pointerId', { value: 1 })
    w.find('.tt-st-card').element.dispatchEvent(e)
    fire()
    expect(quivers().length).toBe(0)
    w.unmount()
  })

  it('flipped first: none; the card is lifted while it flips and set down after', async () => {
    const w = await at({ quiver: true })
    await open(w)
    await w.find('.tt-st-flip').trigger('click')
    expect(w.find('.tt-st-card').classes()).toContain('is-lifted')
    await settle()
    await settle()
    expect(w.find('.tt-st-card').classes()).not.toContain('is-lifted')
    expect(w.find('.tt-st-card .ttf-back').exists()).toBe(true)
    fire()
    expect(quivers().length).toBe(0)
    w.unmount()
  })

  it('reduced motion: none, and the function is not called', async () => {
    RM = true
    const fn = vi.fn(() => true)
    const w = await at({ quiver: fn })
    await open(w)
    fire()
    expect(quivers().length).toBe(0)
    expect(fn).not.toHaveBeenCalled()
    w.unmount()
  })

  it('a function decides once at open, with the card', async () => {
    const fn = vi.fn(() => true)
    const w = await at({ quiver: fn })
    await open(w)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0][0].id).toBe('oak')
    fire()
    expect(quivers().length).toBe(1)
    w.unmount()
  })
})
