// @vitest-environment jsdom
/**
 * TtCard (1.1.0), one card in the host's layout (Treehopper's CardShell role). Both sides mounted, the one not shown
 * hidden and inert; TtStage's turn (same keyframes and timings, held together below); tap, Enter, Space and a swipe
 * that follows the thumb; a control inside keeps its tap; reduced motion crossfades; the first-card quiver once and
 * never after a touch; v-model:side; labels and copyright reach the faces; print runs core ttPrint on this card only;
 * ttLock never called.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { TtCard, TtTable, setTtHost, ttLocked } from '../../vue/index.js'
import { TT_CLASSES } from '../../core/index.js'

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
    const a = { el: this, kf, o, onfinish: null, cancel: vi.fn(), finish: vi.fn() }
    anims.push(a)
    return a
  }
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
const W300 = () => ({ left: 0, top: 0, right: 300, bottom: 562, width: 300, height: 562 })
const at = async (props = {}, slots = {}) => {
  const w = mount(TtCard, { props: { card: card('oak'), data: DATA(), ...props }, slots, attachTo: document.body })
  w.find('.tt-cd-card').element.getBoundingClientRect = W300
  await flushPromises()
  return w
}
const settle = async () => {
  for (let i = 0; i < 4; i++) {
    await flushPromises()
    await nextTick()
    if (!anims.length) return
    anims.splice(0).forEach(a => a.onfinish && a.onfinish())
  }
  await flushPromises()
}
const shown = w => w.findAll('.tt-cd-card > .ttf').filter(f => !f.classes().includes('is-under'))
const sideOf = w => (shown(w)[0].classes().includes('ttf-back') ? 'back' : 'front')
const ptr = (el, type, x, y = 10) => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  Object.defineProperty(e, 'pointerId', { value: 1 })
  el.dispatchEvent(e)
}
const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
const turns = () => anims.filter(a => a.el.classList && a.el.classList.contains('tt-cd-card'))
const fire = () => timers.splice(0).forEach(f => f())

describe('TtCard (K4)', () => {
  it('both sides mounted: the front shown, the back hidden in place and inert; a named group; exported, classes listed', async () => {
    const w = await at()
    const f = w.findAll('.tt-cd-card > .ttf')
    expect(f.length).toBe(2)
    expect(f[0].classes()).toContain('ttf-front')
    expect(f[1].classes()).toEqual(expect.arrayContaining(['ttf-back', 'is-under']))
    expect(f[1].attributes('inert')).toBeDefined()
    expect(f[1].attributes('aria-hidden')).toBe('true')
    expect(f[0].attributes('inert')).toBeUndefined()
    const c = w.find('.tt-cd-card')
    expect(c.attributes('role')).toBe('group')
    expect(c.attributes('tabindex')).toBe('0')
    expect(c.attributes('aria-label')).toBe('oak')
    expect(w.find('.tt-cd').attributes('data-side')).toBe('front')
    for (const k of ['tt-cd', 'tt-cd-card', 'tt-cd-out']) expect(TT_CLASSES).toContain(k)
    w.unmount()
    const w2 = await at({ label: 'Oak, tree 12', side: 'back' })
    expect(w2.find('.tt-cd-card').attributes('aria-label')).toBe('Oak, tree 12')
    expect(sideOf(w2)).toBe('back')
    w2.unmount()
  })

  it("Enter turns it in TtStage's two halves, lifted between, and says so through update:side; ttLock never called", async () => {
    const w = await at()
    const c = w.find('.tt-cd-card').element
    key(c, 'Enter')
    await nextTick()
    expect(ttLocked()).toBe(false)
    let t = turns()
    expect(t.length).toBe(1)
    expect(t[0].kf).toEqual([{ transform: 'rotateY(0deg) scale(1)' }, { transform: 'rotateY(90deg) scale(.96)' }])
    expect(t[0].o).toEqual({ duration: 230, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })
    expect(w.find('.tt-cd-card').classes()).toContain('is-lifted')
    expect(w.emitted('update:side')).toEqual([['back']])
    expect(sideOf(w)).toBe('front')
    anims.splice(0)[0].onfinish()
    await flushPromises()
    await nextTick()
    expect(sideOf(w)).toBe('back')
    t = turns()
    expect(t[0].kf).toEqual([{ transform: 'rotateY(-90deg) scale(.96)' }, { transform: 'rotateY(0deg) scale(1)' }])
    expect(t[0].o).toEqual({ duration: 290, easing: 'cubic-bezier(0,0,.2,1)' })
    await settle()
    expect(w.find('.tt-cd-card').classes()).not.toContain('is-lifted')
    expect(w.find('.tt-cd').attributes('data-side')).toBe('back')
    key(c, ' ')
    await settle()
    expect(sideOf(w)).toBe('front')
    expect(w.emitted('update:side')).toEqual([['back'], ['front']])
    expect(ttLocked()).toBe(false)
    w.unmount()
  })

  it('a tap turns it; a tap, Enter or Space on a control inside is that control\'s', async () => {
    const onClick = vi.fn()
    const w = await at({}, { art: () => h('button', { class: 'host-btn', type: 'button', onClick }, 'Photograph'), more: ({ card: c }) => h('a', { class: 'host-link', href: '#x' }, `More on ${c.title}`) })
    const c = w.find('.tt-cd-card').element
    const btn = w.find('.host-btn').element
    ptr(btn, 'pointerdown', 100)
    ptr(btn, 'pointerup', 100)
    btn.click()
    key(btn, 'Enter')
    key(btn, ' ')
    await settle()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(sideOf(w)).toBe('front')
    expect(w.emitted('update:side')).toBeUndefined()
    ptr(c, 'pointerdown', 100)
    ptr(c, 'pointerup', 103)
    await settle()
    expect(sideOf(w)).toBe('back')
    expect(w.find('.host-link').text()).toBe('More on oak')
    const link = w.find('.host-link').element
    ptr(link, 'pointerdown', 50)
    ptr(link, 'pointerup', 50)
    await settle()
    expect(sideOf(w)).toBe('back')
    w.unmount()
  })

  it('a swipe follows the thumb, shows the other side past 90 degrees, and finishes the way it was going', async () => {
    const w = await at()
    const c = w.find('.tt-cd-card')
    ptr(c.element, 'pointerdown', 100)
    ptr(c.element, 'pointermove', 130)
    await nextTick()
    expect(c.attributes('style')).toContain('rotateY(18deg)')
    expect(c.classes()).toEqual(expect.arrayContaining(['is-drag', 'is-lifted']))
    ptr(c.element, 'pointermove', 280)
    await nextTick()
    expect(sideOf(w)).toBe('back')
    expect(c.attributes('style')).toContain('rotateY(-72deg)')
    expect(w.emitted('update:side')).toBeUndefined()
    ptr(c.element, 'pointerup', 280)
    await nextTick()
    expect(w.emitted('update:side')).toEqual([['back']])
    const t = turns()
    expect(t.length).toBe(1)
    expect(t[0].kf).toEqual([{ transform: 'rotateY(-72deg) scale(.968)' }, { transform: 'rotateY(0deg) scale(1)' }])
    await settle()
    expect(c.attributes('style') || '').not.toContain('rotateY')
    expect(sideOf(w)).toBe('back')
    // a short swipe left on the back, released before 90 degrees but past the distance: the first half from there
    ptr(c.element, 'pointerdown', 200)
    ptr(c.element, 'pointermove', 140)
    ptr(c.element, 'pointerup', 140)
    await nextTick()
    const t2 = turns()
    expect(t2[0].kf).toEqual([{ transform: 'rotateY(-36deg) scale(.984)' }, { transform: 'rotateY(-90deg) scale(.96)' }])
    expect(t2[0].o.duration).toBe(138)
    await settle()
    expect(sideOf(w)).toBe('front')
    expect(w.emitted('update:side')).toEqual([['back'], ['front']])
    w.unmount()
  })

  it('a swipe short of the line settles back; the click after any swipe is swallowed; a vertical drag is the page\'s', async () => {
    const onClick = vi.fn()
    const w = await at({}, { art: () => h('a', { class: 'host-link', href: '#y', onClick }, 'link') })
    const c = w.find('.tt-cd-card')
    ptr(c.element, 'pointerdown', 100)
    ptr(c.element, 'pointermove', 120)
    ptr(c.element, 'pointerup', 120)
    await nextTick()
    expect(w.emitted('update:side')).toBeUndefined()
    const t = turns()
    expect(t[0].kf).toEqual([{ transform: 'rotateY(12deg) scale(.9947)' }, { transform: 'rotateY(0deg) scale(1)' }])
    w.find('.host-link').element.click()
    expect(onClick).not.toHaveBeenCalled()
    await settle()
    await new Promise(r => realST(r, 5))
    w.find('.host-link').element.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    ptr(c.element, 'pointerdown', 100, 10)
    ptr(c.element, 'pointermove', 102, 80)
    ptr(c.element, 'pointerup', 102, 80)
    await settle()
    expect(sideOf(w)).toBe('front')
    expect(c.classes()).not.toContain('is-drag')
    w.unmount()
  })

  it('v-model:side: the host turns it; a change mid-turn is followed once the turn lands; uncontrolled it stays turned', async () => {
    const side = ref('front')
    const Host = defineComponent({ setup: () => () => h(TtCard, { card: card('oak'), data: DATA(), side: side.value, 'onUpdate:side': (v) => { side.value = v } }) })
    const w = mount(Host, { attachTo: document.body })
    await flushPromises()
    side.value = 'back'
    await nextTick()
    expect(turns().length).toBe(1)
    side.value = 'front'
    await nextTick()
    expect(turns().length).toBe(1)
    await settle()
    expect(w.find('.tt-cd').attributes('data-side')).toBe('front')
    expect(side.value).toBe('front')
    key(w.find('.tt-cd-card').element, 'Enter')
    await settle()
    expect(side.value).toBe('back')
    expect(w.find('.tt-cd').attributes('data-side')).toBe('back')
    w.unmount()
    const u = await at()
    key(u.find('.tt-cd-card').element, 'Enter')
    await settle()
    expect(sideOf(u)).toBe('back')
    u.unmount()
  })

  it('reduced motion: the sides crossfade over 180 ms, nothing turns, a swipe neither follows nor turns past a crossfade', async () => {
    RM = true
    const w = await at({ quiver: true, card: card('oak', { foil: true, rarity: 'Unique' }) })
    expect(timers.length).toBe(0)
    const c = w.find('.tt-cd-card')
    key(c.element, 'Enter')
    await flushPromises()
    await nextTick()
    expect(turns().length).toBe(0)
    const f = w.findAll('.tt-cd-card > .ttf')
    expect(f[0].classes()).toEqual(expect.arrayContaining(['is-under', 'tt-cd-out']))
    const out = anims.find(a => a.el === f[0].element)
    const inn = anims.find(a => a.el === f[1].element)
    expect(out.kf).toEqual([{ opacity: 1 }, { opacity: 0 }])
    expect(inn.kf).toEqual([{ opacity: 0 }, { opacity: 1 }])
    expect(inn.o.duration).toBe(180)
    await settle()
    expect(w.findAll('.tt-cd-card > .ttf')[0].classes()).not.toContain('tt-cd-out')
    expect(sideOf(w)).toBe('back')
    ptr(c.element, 'pointerdown', 100)
    ptr(c.element, 'pointermove', 200)
    await nextTick()
    expect(c.attributes('style') || '').not.toContain('rotateY')
    ptr(c.element, 'pointerup', 200)
    await settle()
    expect(sideOf(w)).toBe('front')
    expect(turns().length).toBe(0)
    w.unmount()
  })

  it('quiver: once, 1200 ms after mount, as TtStage\'s; never after a touch, on the back, or under reduced motion', async () => {
    let w = await at({ quiver: true })
    expect(timers.length).toBe(1)
    fire()
    const q = turns().filter(a => JSON.stringify(a.kf).includes('-12deg'))
    expect(q.length).toBe(1)
    expect(q[0].kf).toEqual([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-12deg)', offset: 0.45 }, { transform: 'rotateY(0deg)' }])
    expect(q[0].o).toEqual({ duration: 520, easing: 'ease-in-out' })
    fire()
    expect(turns().filter(a => JSON.stringify(a.kf).includes('-12deg')).length).toBe(1)
    w.unmount()
    anims.length = 0
    w = await at({ quiver: true })
    ptr(w.find('.tt-cd-card').element, 'pointerdown', 100)
    fire()
    expect(turns().length).toBe(0)
    w.unmount()
    const fn = vi.fn(() => false)
    w = await at({ quiver: fn })
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ id: 'oak' }))
    expect(timers.length).toBe(0)
    w.unmount()
    w = await at({ quiver: true, side: 'back' })
    expect(timers.length).toBe(0)
    expect(w.vm.quiver()).toBe(false)
    w.unmount()
    RM = true
    const fn2 = vi.fn(() => true)
    w = await at({ quiver: fn2 })
    expect(fn2).not.toHaveBeenCalled()
    expect(w.vm.quiver()).toBe(false)
    w.unmount()
    RM = false
    w = await at()
    expect(w.vm.quiver(() => false)).toBe(false)
    expect(w.vm.quiver()).toBe(true)
    fire()
    expect(turns().filter(a => JSON.stringify(a.kf).includes('-12deg')).length).toBe(1)
    w.unmount()
  })

  it("holds TtStage's turn and quiver to the same keyframes and timings", async () => {
    const tt = mount(TtTable, { props: { collection: DATA(), quiver: true, options: { key: 'tt_k4_parity' } }, attachTo: document.body })
    await flushPromises()
    await tt.find('.tt-cell[data-id="oak"] .tt-hit').trigger('click')
    await settle()
    fire()
    await tt.find('.tt-st-flip').trigger('click')
    await nextTick()
    const st = anims.filter(a => a.el.classList.contains('tt-st-card'))
    const stQ = st.find(a => JSON.stringify(a.kf).includes('-12deg'))
    const stOut = st.find(a => a.o.duration === 230)
    stOut.onfinish()
    await flushPromises()
    await nextTick()
    const stIn = anims.filter(a => a.el.classList.contains('tt-st-card')).find(a => a.o.duration === 290)
    tt.unmount()
    anims.length = 0
    const w = await at({ quiver: true })
    fire()
    const cQ = turns().find(a => JSON.stringify(a.kf).includes('-12deg'))
    key(w.find('.tt-cd-card').element, 'Enter')
    await nextTick()
    const cOut = turns().find(a => a.o.duration === 230)
    cOut.onfinish()
    await flushPromises()
    await nextTick()
    const cIn = turns().find(a => a.o.duration === 290)
    for (const [a, b] of [[stQ, cQ], [stOut, cOut], [stIn, cIn]]) {
      expect(b.kf).toEqual(a.kf)
      expect(b.o).toEqual(a.o)
    }
    w.unmount()
  })

  it('labels and copyright reach both faces as TtTable passes them; the copyright prop wins', async () => {
    const tree = card('oak', { retired: true, number: 3, of: 12 })
    let w = await at({ card: tree, labels: { retired: 'Gone', of: 'de', copyright: '© Pincast' } })
    expect(w.find('.ttf-front .ttf-retired').text()).toBe('Gone')
    expect(w.find('.ttf-back').text()).toContain('de 12')
    expect(w.find('.ttf-front .ttf-furn-cp').text()).toBe('© Pincast')
    w.unmount()
    w = await at({ card: tree, labels: { copyright: '© Pincast' }, copyright: '© Treehopper' })
    expect(w.find('.ttf-front .ttf-furn-cp').text()).toBe('© Treehopper')
    expect(w.find('.ttf-front .ttf-retired').text()).toBe('Retired')
    w.unmount()
  })

  it('print: core ttPrint on this card only, the shown side leaned, undone at unmount', async () => {
    const w = await at({ print: true })
    const r = w.find('.tt-cd').element
    expect(r.getAttribute('data-tt-light')).toBe('on')
    expect(r.getAttribute('data-tt-tilt')).toBe('on')
    expect(document.documentElement.hasAttribute('data-tt-light')).toBe(false)
    key(w.find('.tt-cd-card').element, 'Enter')
    await settle()
    const back = w.find('.tt-cd-card > .ttf-back')
    expect(back.attributes('data-print')).toBeDefined()
    ptr(back.find('.ttf-face').element, 'pointerdown', 100)
    expect(w.find('.tt-cd-card').attributes('data-tt-held')).toBeDefined()
    ptr(back.find('.ttf-face').element, 'pointerup', 100)
    await settle()
    expect(sideOf(w)).toBe('front')
    // a swipe takes the card over: the press lets go once the card carries is-drag
    const hold = w.find('.tt-cd-card')
    const face = shown(w)[0].find('.ttf-face').element
    ptr(face, 'pointerdown', 100)
    expect(hold.attributes('data-tt-held')).toBeDefined()
    ptr(hold.element, 'pointermove', 130)
    await nextTick()
    expect(hold.classes()).toContain('is-drag')
    ptr(hold.element, 'pointermove', 140)
    expect(hold.attributes('data-tt-held')).toBeUndefined()
    ptr(hold.element, 'pointerup', 140)
    await settle()
    w.unmount()
    expect(r.hasAttribute('data-tt-light')).toBe(false)
    expect(r.hasAttribute('data-tt-tilt')).toBe(false)
    const off = await at()
    expect(off.find('.tt-cd').attributes('data-tt-light')).toBeUndefined()
    off.unmount()
  })
})
