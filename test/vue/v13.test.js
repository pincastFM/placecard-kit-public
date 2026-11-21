// @vitest-environment jsdom
/**
 * Kit 1.3.0: three additions. Each is opt-in; unset, the markup is 1.2.0's (v13gold.test.js holds the goldens
 * written on the kit at 1.2.0).
 *   card.backFade: the back's text area fades at its lower edge while more is below and clears its top once scrolled.
 *   TtTable's landing: the newest find drops onto its stack once.
 *   TtPath's labels.home: the planner's head reads Hunt, Route, Collection.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { TtFace, TtTable, TtPath, setTtHost, ttLock } from '../../vue/index.js'
import { CR_REST, crTransform } from '../../core/index.js'

let reduce = false
window.matchMedia = q => ({ get matches() { return reduce && /reduce/.test(q) }, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}
beforeEach(() => {
  Element.prototype.animate = function () { return { onfinish: null, oncancel: null, cancel() {}, finish() {} } }
  setTtHost({ head: vi.fn(), distUnit: null })
})
afterEach(() => { setTtHost({ head: null, distUnit: null }); document.body.innerHTML = ''; ttLock(false); delete globalThis.ResizeObserver })

const FDATA = {
  sets: [{ id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612 }],
  rarities: { species: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'] },
}
const WALK = { sets: [{ id: 'walk-1', app: 'verythere', name: 'Old Town', short: 'OLD TOWN' }], rarities: {} }
const TH = (o = {}) => ({
  id: 'th:dogwood', app: 'treehopper', set: 'species', kind: 'species', face: 'treehopper', title: 'Flowering Dogwood',
  subtitle: 'Cornus florida', type: 'Species', fact: '', back: 'A small tree of the understory. '.repeat(24).trim(),
  stats: [], number: 404, of: 612, rarity: 'Uncommon', rarityCount: null, foil: false, img: null, credit: null,
  held: true, collected: '2022-04-19', ...o,
})
const STOP = (o = {}) => ({
  id: 'vt:3', app: 'verythere', set: 'walk-1', kind: 'stop', title: 'The Mill', subtitle: 'Riverside', type: 'Stop',
  fact: 'Built 1820', back: 'Built 1820.', stats: [], number: 3, of: 12, rarity: '', foil: false, accent: null,
  img: null, credit: null, held: true, ...o,
})
const back = (card, o = {}) => mount(TtFace, { props: { card, data: card.app === 'verythere' ? WALK : FDATA, fonts: false, side: 'back', ...o.props }, slots: o.slots, attachTo: document.body })
const bodyOf = w => w.find('.ttf-bk-body').element
// jsdom lays nothing out: the body's sizes are set by hand, then a scroll is dispatched
const box = (el, { sh, ch, st }) => {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: sh })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: ch })
  Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: st })
}
const scrollTo = async (el, st) => { el.scrollTop = st; el.dispatchEvent(new Event('scroll')); await nextTick() }
const cls = el => el.getAttribute('class')

describe('V1: card.backFade, the back\'s text area', () => {
  it('unset or false: the body is class="ttf-bk-body" alone, and a scroll changes nothing', async () => {
    for (const card of [TH(), TH({ backFade: false })]) {
      const w = back(card)
      const el = bodyOf(w)
      expect(cls(el)).toBe('ttf-bk-body')
      box(el, { sh: 600, ch: 200, st: 0 })
      await scrollTo(el, 100)
      expect(cls(el)).toBe('ttf-bk-body')
      w.unmount()
    }
  })

  it('backFade: false renders the unset markup exactly', () => {
    const a = back(TH())
    const b = back(TH({ backFade: false }))
    expect(b.html()).toBe(a.html())
    a.unmount(); b.unmount()
  })

  it('set: is-fade at once; more below gives is-more; scrolled adds is-scrolled; at the bottom is-more goes', async () => {
    const w = back(TH({ backFade: true }))
    const el = bodyOf(w)
    expect(cls(el)).toBe('ttf-bk-body is-fade')
    box(el, { sh: 600, ch: 200, st: 0 })
    await scrollTo(el, 0)
    expect(el.classList.contains('is-more')).toBe(true)
    expect(el.classList.contains('is-scrolled')).toBe(false)
    await scrollTo(el, 100)
    expect(el.classList.contains('is-more')).toBe(true)
    expect(el.classList.contains('is-scrolled')).toBe(true)
    await scrollTo(el, 398) // 2 px left: the design's 3 px tolerance
    expect(el.classList.contains('is-more')).toBe(false)
    expect(el.classList.contains('is-scrolled')).toBe(true)
    await scrollTo(el, 1) // 1 px is not scrolled
    expect(el.classList.contains('is-scrolled')).toBe(false)
    w.unmount()
  })

  it('a body that fits: is-fade only', async () => {
    const w = back(TH({ backFade: true, back: 'Short.' }))
    const el = bodyOf(w)
    box(el, { sh: 200, ch: 200, st: 0 })
    await scrollTo(el, 0)
    expect(cls(el)).toBe('ttf-bk-body is-fade')
    w.unmount()
  })

  it('any face: a stop\'s back takes it too; a front has no body and draws as before', async () => {
    const w = back(STOP({ backFade: true }))
    expect(cls(bodyOf(w))).toBe('ttf-bk-body is-fade')
    w.unmount()
    const f1 = mount(TtFace, { props: { card: TH({ backFade: true }), data: FDATA, fonts: false } })
    const f0 = mount(TtFace, { props: { card: TH(), data: FDATA, fonts: false } })
    expect(f1.html()).toBe(f0.html())
    f1.unmount(); f0.unmount()
  })

  it('the body and its children are observed (late photos in the more slot); off and unmount disconnect', async () => {
    const made = []
    globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; this.els = []; this.off = false; made.push(this) } observe(e) { this.els.push(e) } disconnect() { this.off = true } }
    const w = back(TH({ backFade: true }), { slots: { more: '<i class="x-more">photos</i>' } })
    await flushPromises()
    const live = made.filter(o => !o.off)
    expect(live).toHaveLength(1)
    const el = bodyOf(w)
    expect(live[0].els[0]).toBe(el)
    expect(live[0].els).toContain(w.find('.x-more').element)
    // a photo loads: the observer's call measures again
    box(el, { sh: 600, ch: 200, st: 0 })
    live[0].cb()
    await nextTick()
    expect(el.classList.contains('is-more')).toBe(true)
    // the side turns to the front: disconnected, and nothing new observed
    await w.setProps({ side: 'front' })
    await flushPromises()
    expect(made.every(o => o.off)).toBe(true)
    // back again, then unmounted
    await w.setProps({ side: 'back' })
    await flushPromises()
    expect(made.filter(o => !o.off)).toHaveLength(1)
    w.unmount()
    expect(made.every(o => o.off)).toBe(true)
  })

  it('unset, nothing is observed', async () => {
    const made = []
    globalThis.ResizeObserver = class { constructor() { made.push(this) } observe() {} disconnect() {} }
    const w = back(TH())
    await flushPromises()
    await w.setProps({ card: TH({ back: 'Other.' }) })
    await flushPromises()
    expect(made).toHaveLength(0)
    w.unmount()
  })
})

// ── landing
const GBCR = Element.prototype.getBoundingClientRect
const tbase = { app: 'treehopper', face: 'treehopper', subtitle: 'Quercus', fact: '', back: 'A story.', stats: [], of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1 }
const sp = (id, o = {}) => ({ ...tbase, id: `th:${id}`, set: 'species', kind: 'species', title: id, type: 'Species', number: null, ...o })
const SETS = (o = {}) => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [
    { id: 'overstory', app: 'treehopper', name: 'Overstory', short: 'OVERSTORY', total: 3, kind: 'species' },
    { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' },
  ],
  rarities: { species: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'] },
  cards: ['oak', 'ash', 'elm', 'fir', 'yew', 'box'].map((id, i) => sp(id, { number: i + 1, added: i + 1, sets: i === 0 ? ['overstory'] : undefined, ...o })),
})
const anims = []
let rect
const LAND0 = 'translate(-8px,-34px) rotate(-4deg) '
const drops = () => anims.filter(a => a.o && a.o.duration === 280 && String(a.kf[0].transform).startsWith(LAND0))
const tableAt = async (props = {}, cardO) => {
  const { options = {}, ...rest } = props
  const w = mount(TtTable, { props: { collection: SETS(cardO), ...rest, options: { key: 'tt_v13', ...options } }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  await flushPromises()
  return w
}
const covers = w => w.findAll('.tt-pile[data-pg] > .tt-cell[data-k="0"]').map(x => x.attributes('data-id'))
const coversOf = async (cardO) => { const w = await tableAt({ options: { stacked: true } }, cardO); const c = covers(w); const under = w.findAll('.tt-pile[data-pg] > .tt-cell[data-k="1"]').map(x => x.attributes('data-id')); w.unmount(); anims.length = 0; return { c, under } }

describe('V2: landing, the newest find drops onto its stack once', () => {
  beforeEach(() => {
    reduce = false
    anims.length = 0
    rect = { left: 10, top: 100, right: 110, bottom: 300, width: 100, height: 200, x: 10, y: 100 }
    Element.prototype.getBoundingClientRect = function () { return rect }
    Element.prototype.animate = function (kf, o) {
      const a = { el: this, kf, o, live: true, onfinish: null, oncancel: null, cancel() { this.live = false; if (this.oncancel) this.oncancel() }, finish() {} }
      anims.push(a)
      return a
    }
    Element.prototype.getAnimations = function () { return anims.filter(a => a.el === this && a.live) }
    try { localStorage.clear() } catch { /* none */ }
  })
  afterEach(() => {
    Element.prototype.getBoundingClientRect = GBCR
    Element.prototype.getAnimations = function () { return [] }
    reduce = false
  })

  it('given on mount, a printing stack\'s cover drops once: 280 ms, the board\'s frames and easing; landed once with the id', async () => {
    const { c } = await coversOf()
    expect(c.length).toBeGreaterThan(1)
    const w = await tableAt({ landing: c[1], options: { stacked: true } })
    const d = drops()
    expect(d).toHaveLength(1)
    expect(d[0].el.dataset.id).toBe(c[1])
    expect(d[0].el.dataset.k).toBe('0')
    const base = crTransform(0, 0, CR_REST)
    const E = 'cubic-bezier(.2,.8,.2,1)'
    expect(d[0].kf).toEqual([{ transform: LAND0 + base, opacity: 0, easing: E }, { opacity: 1, offset: 0.6, easing: E }, { transform: base, opacity: 1 }])
    expect(d[0].o).toEqual({ duration: 280, fill: 'backwards' })
    expect(w.emitted('landed')).toEqual([[c[1]]])
    w.unmount()
  })

  it('on a fanned stack the drop replaces the riffle on that cell and ends on its layer\'s transform', async () => {
    const { c } = await coversOf({ print: false })
    const w = await tableAt({ landing: c[0], options: { stacked: true } }, { print: false })
    const d = drops()
    expect(d).toHaveLength(1)
    const el = d[0].el
    expect(d[0].kf[2].transform).toBe(el.style.transform)
    const others = anims.filter(a => a.el === el && a !== d[0])
    expect(others.length).toBeGreaterThan(0) // the riffle had started on it
    expect(others.every(a => !a.live)).toBe(true)
    w.unmount()
  })

  it('on a fanned stack riffling at mount the card drops on top: the riffle\'s z-index comes off the layers under it (review F1)', async () => {
    const w0 = await tableAt({ options: { stacked: true } }, { print: false })
    const big = w0.findAll('.tt-pile[data-pg]').find(p => p.findAll('.tt-cell').length > 1)
    const id = big.find('.tt-cell[data-k="0"]').attributes('data-id')
    w0.unmount()
    anims.length = 0
    const w = await tableAt({ landing: id, options: { stacked: true } }, { print: false })
    const d = drops()
    expect(d).toHaveLength(1)
    const el = d[0].el
    expect(el.dataset.id).toBe(id)
    const under = Array.from(el.parentNode.querySelectorAll('.tt-cell')).filter(x => x !== el)
    expect(under.length).toBeGreaterThan(1)
    expect(under.every(x => anims.some(a => a.el === x && a.live))).toBe(true) // still riffling
    expect(under.map(x => x.style.zIndex)).toEqual(under.map(() => ''))
    expect(el.style.zIndex).toBe('')
    w.unmount()
  })

  it('set after mount: under a cover it waits, silent; then a cover lands', async () => {
    const { c, under } = await coversOf({ print: false })
    expect(under.length).toBeGreaterThan(0)
    const w = await tableAt({ options: { stacked: true } }, { print: false })
    expect(drops()).toHaveLength(0)
    await w.setProps({ landing: under[0] })
    await flushPromises()
    expect(drops()).toHaveLength(0)
    expect(w.emitted('landed')).toBeUndefined()
    await w.setProps({ landing: c[0] })
    await flushPromises()
    expect(drops()).toHaveLength(1)
    expect(w.emitted('landed')).toEqual([[c[0]]])
    w.unmount()
  })

  it('a spread group waits; Stack all shows it as a cover and it lands then', async () => {
    const { c } = await coversOf()
    const w = await tableAt({ landing: c[0] })
    expect(w.find('.tt-pile[data-pg]').exists()).toBe(false)
    expect(drops()).toHaveLength(0)
    expect(w.emitted('landed')).toBeUndefined()
    await w.find('.tt-stk').trigger('click')
    await flushPromises()
    expect(drops()).toHaveLength(1)
    expect(w.emitted('landed')).toEqual([[c[0]]])
    w.unmount()
  })

  it('off screen it waits; a scroll that brings it on screen lands it', async () => {
    const raf = window.requestAnimationFrame
    window.requestAnimationFrame = (cb) => { cb(0); return 1 }
    const { c } = await coversOf()
    rect = { left: 10, top: 2000, right: 110, bottom: 2200, width: 100, height: 200, x: 10, y: 2000 }
    const w = await tableAt({ landing: c[0], options: { stacked: true } })
    expect(drops()).toHaveLength(0)
    rect = { left: 10, top: 300, right: 110, bottom: 500, width: 100, height: 200, x: 10, y: 300 }
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(drops()).toHaveLength(1)
    expect(w.emitted('landed')).toEqual([[c[0]]])
    w.unmount()
    window.requestAnimationFrame = raf
  })

  it('never twice: not cleared, given again, or the stacks riffled again, it does not replay', async () => {
    const { c } = await coversOf()
    const w = await tableAt({ landing: c[0], options: { stacked: true } })
    expect(drops()).toHaveLength(1)
    await w.find('.tt-stk').trigger('click') // spread all
    await flushPromises()
    await w.find('.tt-stk').trigger('click') // stack all again
    await flushPromises()
    await w.setProps({ landing: null })
    await w.setProps({ landing: c[0] })
    await flushPromises()
    expect(drops()).toHaveLength(1)
    expect(w.emitted('landed')).toEqual([[c[0]]])
    w.unmount()
  })

  it('reduced motion: no drop, still taken and emitted', async () => {
    const { c } = await coversOf()
    reduce = true
    const w = await tableAt({ landing: c[0], options: { stacked: true } })
    expect(drops()).toHaveLength(0)
    expect(w.emitted('landed')).toEqual([[c[0]]])
    w.unmount()
  })

  it('unset, nothing lands or is emitted; set, the markup is the same', async () => {
    const { c } = await coversOf()
    const a = await tableAt({ options: { stacked: true } })
    expect(drops()).toHaveLength(0)
    expect(a.emitted('landed')).toBeUndefined()
    const html0 = a.find('.tt').html()
    a.unmount()
    const b = await tableAt({ landing: c[0], options: { stacked: true } })
    expect(drops()).toHaveLength(1)
    expect(b.find('.tt').html()).toBe(html0)
    b.unmount()
  })
})

// ── labels.home: the planner's head
const PSTART = { lat: 40.7359, lon: -73.9911 }
const pstop = (n, card, m, min) => ({ n, kind: 'card', card, place: { id: `t${n}`, lat: 40.73 + n / 1000, lon: -73.99 }, leg: { m, min }, arriveMin: 0, dwellMin: 1, status: 'planned', label: null, meal: null, fromHand: true, alts: [] })
const pplan = () => ({
  id: 'p1', app: 'treehopper', set: 'treecount', madeBy: null, madeAt: '2026-10-29T00:00:00Z', planVersion: 2, solver: 'path', clock: null,
  start: PSTART, end: { kind: 'start', at: PSTART, name: null }, mode: 'walk', minutes: 30, order: 'planned',
  stops: [pstop(1, 'red-maple', 180, 2.4)], finish: { leg: { m: 200, min: 2.6 }, arriveMin: 5 },
  totals: { stops: 1, m: 380, walkMin: 5, totalMin: 6, timing: 'route', leftOver: 0 }, leftOver: [], ext: {},
})
const HEAD = { home: 'Hunt', back: 'Collection', title: 'Route' }
const pathAt = async (props = {}) => {
  const w = mount(TtPath, { props: { open: true, plan: pplan(), from: { label: 'Missing', n: 5, kind: 'pile' }, minutes: 30, reduced: true, ...props }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const headKids = w => [...w.find('.tt-path-top').element.children].map(el => `${el.tagName.toLowerCase()}.${el.getAttribute('class').split(' ').join('.')}:${el.textContent.trim()}`)

describe('V3: labels.home, the planner\'s head reads Hunt, Route, Collection', () => {
  it('unset (and home given as \'\'): 1.2.0\'s head, Back with its chevron then the title', async () => {
    for (const labels of [undefined, { home: '' }]) {
      const w = await pathAt(labels ? { labels } : {})
      expect(headKids(w)).toEqual(['button.tt-back:Collection', 'h2.tt-path-h:Route'])
      expect(w.find('.tt-path-top svg').exists()).toBe(true)
      expect(w.find('.tt-path-home').exists()).toBe(false)
      expect(w.find('.tt-path-back').exists()).toBe(false)
      expect(document.activeElement).toBe(w.find('.tt-back').element)
      w.unmount()
    }
  })

  it('set: Hunt, the title, Collection, in that order, with no chevrons', async () => {
    const w = await pathAt({ labels: HEAD })
    expect(headKids(w)).toEqual(['button.tt-back.tt-path-home:Hunt', 'h2.tt-path-h:Route', 'button.tt-back.tt-path-back:Collection'])
    expect(w.find('.tt-path-top svg').exists()).toBe(false)
    expect(w.findAll('.tt-path-top button').map(b => b.attributes('type'))).toEqual(['button', 'button'])
    expect(w.find('.tt-path').attributes('aria-label')).toBe('Route')
    w.unmount()
  })

  it('Hunt emits home and Collection emits close, each once and nothing else', async () => {
    const w = await pathAt({ labels: HEAD })
    await w.find('.tt-path-home').trigger('click')
    expect(w.emitted('home')).toHaveLength(1)
    expect(w.emitted('close')).toBeUndefined()
    await w.find('.tt-path-back').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    expect(w.emitted('home')).toHaveLength(1)
    w.unmount()
  })

  it('Collection takes the open focus, mounted open and opened later; Escape still closes', async () => {
    const a = await pathAt({ labels: HEAD })
    expect(document.activeElement).toBe(a.find('.tt-path-back').element)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(a.emitted('close')).toHaveLength(1)
    a.unmount()
    const b = await pathAt({ labels: HEAD, open: false })
    expect(b.find('.tt-path').exists()).toBe(false)
    await b.setProps({ open: true })
    await flushPromises()
    await nextTick()
    expect(document.activeElement).toBe(b.find('.tt-path-back').element)
    b.unmount()
  })

  it('home turned on and off while open: the head follows, and the next open focuses the Back it shows', async () => {
    const w = await pathAt()
    await w.setProps({ labels: HEAD })
    expect(headKids(w)).toEqual(['button.tt-back.tt-path-home:Hunt', 'h2.tt-path-h:Route', 'button.tt-back.tt-path-back:Collection'])
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flushPromises()
    await nextTick()
    expect(document.activeElement).toBe(w.find('.tt-path-back').element)
    await w.setProps({ labels: {} })
    expect(headKids(w)).toEqual(['button.tt-back:Collection', 'h2.tt-path-h:Route'])
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flushPromises()
    await nextTick()
    expect(document.activeElement).toBe(w.find('.tt-back').element)
    w.unmount()
  })

  it('unset, no home is emitted and the head\'s markup holds no comment node', async () => {
    const w = await pathAt()
    await w.find('.tt-back').trigger('click')
    expect(w.emitted('home')).toBeUndefined()
    const kids = [...w.find('.tt-path-top').element.childNodes].filter(n => n.nodeType === 8)
    expect(kids).toHaveLength(0)
    w.unmount()
  })
})
