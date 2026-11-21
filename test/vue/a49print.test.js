// @vitest-environment jsdom
/**
 * The shared card (2026-10-31). Print as a face option (data-print on the face, its cell and its stack), the
 * foot (furniture) on a print front, and core/print.js (the light that follows the phone or the finger, the
 * finger tilt with its spring) run by TtTable's `print`. A face that does not print renders exactly as before:
 * the same html with print absent or false, and no node for the foot, not even a comment (NYID's goldens
 * serialize Vue's comment placeholders).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { TtFace, TtTable, setTtHost } from '../../vue/index.js'
import { TT_ICON, TT_RMARK, ttPrint } from '../../core/index.js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

let RM = false
window.matchMedia = q => ({ matches: /reduce/.test(q) && RM, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.animate = function () { return { cancel() {}, finish() {}, onfinish: null, oncancel: null } }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}

let q = []
beforeEach(() => {
  RM = false
  q = []
  window.requestAnimationFrame = (fn) => { q.push(fn); return q.length }
  window.cancelAnimationFrame = () => {}
  setTtHost({ head: vi.fn(), distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => {
  setTtHost({ head: null, distUnit: null })
  document.body.innerHTML = ''
  delete window.DeviceOrientationEvent
})
// run queued frames, 16 ms apart, until none are queued or n have run
const frames = (n = 400) => { let t = 1000; for (let i = 0; i < n && q.length; i++) { t += 16; q.splice(0).forEach(f => f(t)) } }

const WORDS = ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique']
const TH = (o = {}) => ({
  id: 'th:dogwood', app: 'treehopper', set: 'species', kind: 'species', face: 'treehopper', title: 'Flowering Dogwood',
  subtitle: 'Cornus florida', type: 'Species', fact: 'Blooms before it leafs', back: 'A story.', stats: [], number: 4, of: 612,
  rarity: 'Uncommon', foil: false, img: 'https://example.org/d.jpg', credit: 'Eric Hunt, CC BY-SA 4.0',
  held: true, collected: '2022-04-19', collector: { n: 7, of: 612 }, ...o,
})
const STOP = (o = {}) => ({
  id: 'vt:s1', app: 'verythere', set: 'walk', kind: 'stop', face: 'stop', title: 'Steel Bridge', subtitle: '', type: 'Landmark',
  fact: 'A double-deck lift bridge', back: 'About it.', stats: [{ k: 'Opened', v: '1912' }], number: 2, of: 4, rarity: 'Common',
  foil: false, accent: '#1e4fd0', img: 'https://example.org/s.jpg', credit: 'Photo: A. Person', held: true, collected: null, ...o,
})
const DATA = {
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }, { id: 'verythere', name: 'VeryThere', color: '#1e4fd0' }],
  sets: [
    { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' },
    { id: 'walk', app: 'verythere', name: 'Walk', short: 'WALK', total: 4, trek: 3947, kind: 'stop' },
  ],
  rarities: { species: WORDS, stop: ['Common', 'Uncommon', 'Legendary'] },
}
const html = (card, o = {}) => mount(TtFace, { props: { card, data: DATA, fonts: false, ...o } }).html({ raw: true })
const face = (card, o = {}) => mount(TtFace, { props: { card, data: DATA, fonts: false, ...o } }).element

describe('a face that does not print: as before', () => {
  for (const [name, card] of [['stop', STOP()], ['destination', STOP({ face: 'destination', id: 'pv:d1' })], ['stop, no photo', STOP({ img: null })]]) {
    it(`${name}: the same html with print absent, false, or off in the face entry; no attribute, no foot`, () => {
      const base = html(card)
      expect(html({ ...card, print: false })).toBe(base)
      expect(mount(TtFace, { props: { card, data: { ...DATA, faces: { [card.face]: { print: false } } }, fonts: false } }).html({ raw: true })).toBe(base)
      expect(base).not.toContain('data-print')
      expect(base).not.toContain('ttf-furn')
      expect(html(card, { side: 'back' })).not.toContain('data-print')
    })
  }
  it('a Treehopper card asked not to print loses the attribute and the foot', () => {
    const el = face(TH({ print: false }))
    expect(el.hasAttribute('data-print')).toBe(false)
    expect(el.querySelector('.ttf-furn')).toBe(null)
  })
})

describe('a face that prints', () => {
  it('the Treehopper front: data-print, the foot after the fact (number, glyph, credit, copyright)', () => {
    const el = face(TH({ creditMark: 'Genus' }), { copyright: '© Pincast' })
    expect(el.getAttribute('data-print')).toBe('')
    const foot = el.querySelector('.ttf-face > .ttf-furn')
    expect(foot).not.toBe(null)
    expect(foot.previousElementSibling.classList.contains('ttf-fact')).toBe(true)
    expect(foot.querySelector('.ttf-furn-no').textContent).toBe('007/612')
    const rm = foot.querySelector('svg.ttf-furn-rm')
    expect(rm.getAttribute('aria-hidden')).toBe('true')
    expect(rm.querySelector('path').getAttribute('d')).toBe(/d="([^"]+)"/.exec(TT_RMARK[3])[1])
    expect(foot.querySelector('.ttf-furn-cr').textContent).toBe('Genus · Eric Hunt, CC BY-SA 4.0')
    expect(foot.querySelector('.ttf-furn-cp').textContent).toBe('© Pincast')
  })
  it('a child (a tree) prints its mark in place of a number; no copyright, no node for it', () => {
    const el = face(TH({ id: 'tree:574031', kind: 'tree', collector: null, mark: 'Tree 574031', rarity: null }))
    const foot = el.querySelector('.ttf-furn')
    expect(foot.querySelector('.ttf-furn-no').textContent).toBe('Tree 574031')
    expect(foot.querySelector('.ttf-furn-rm')).toBe(null)
    expect(foot.querySelector('.ttf-furn-cp')).toBe(null)
  })
  it('a tree card\'s tile (H214): the root carries data-mark, the plate one code before the name (order prints it at the foot), no stamp', () => {
    const el = face(TH({ id: 'tree:574031', kind: 'tree', collector: null, mark: 'Tree 574031', number: null, subtitle: '' }))
    expect(el.getAttribute('data-mark')).toBe('')
    const codes = el.querySelectorAll('.ttf-plate .ttf-tcode')
    expect(codes.length).toBe(1)
    expect(codes[0].textContent).toBe('Tree 574031')
    expect(codes[0].nextElementSibling.classList.contains('ttf-title')).toBe(true)
    expect(el.querySelector('.ttf-stamp')).toBe(null)
    const ds = (e) => [...e.querySelectorAll('.ttf-art .ttf-mark svg path')].map(q => q.getAttribute('d'))
    const want = (k) => [...TT_ICON[k].matchAll(/d="([^"]+)"/g)].map(m => m[1])
    expect(ds(el)).toEqual(want('tree-mark'))
    expect(ds(face(TH()))).toEqual(want('tree'))
  })
  it('review F1: a marked tree card keeps its name the plate\'s last child, so at 240 up the name sits where it did', () => {
    const plate = c => [...face(TH(c)).querySelector('.ttf-plate').children].map(e => e.className)
    expect(plate({ id: 'tree:1', kind: 'tree', collector: null, mark: 'Tree 1', subtitle: '' }).at(-1)).toBe('ttf-title')
    expect(plate({ id: 'tree:1', kind: 'tree', collector: null, mark: 'Tree 1', subtitle: 'Cornus florida' }).at(-1)).toBe('ttf-sub')
    expect(plate({ subtitle: '' }).at(-1)).toBe('ttf-title')
  })
  it('review F2: under 240 a tree tile hides its rarity from sight only, so a screen reader still says it', () => {
    const src = readFileSync(resolve(__dirname, '../../vue/TtFace.vue'), 'utf8')
    const rule = src.match(/\.ttf-th\.ttf-front\[data-mark\] \.ttf-type \{([^}]*)\}/)
    expect(rule).not.toBe(null)
    expect(rule[1]).not.toMatch(/display:\s*none/)
    expect(rule[1]).toMatch(/clip-path:\s*inset\(50%\)/)
    expect(face(TH({ id: 'tree:1', kind: 'tree', collector: null, mark: 'Tree 1' })).querySelector('.ttf-plate .ttf-type').textContent).toBe('Uncommon')
  })
  it('a card without a mark: no data-mark, no code node, its plate as before; a stop\'s mark field is ignored', () => {
    for (const card of [TH(), TH({ mark: '' }), STOP({ mark: 'Tree 1' })]) {
      const el = face(card)
      expect(el.hasAttribute('data-mark')).toBe(false)
      expect(el.querySelector('.ttf-tcode')).toBe(null)
    }
    const plate = html(TH()).match(/<span class="ttf-plate">[\s\S]*?<\/span><\/span>/)[0]
    expect(plate).not.toMatch(/<!--/)
    expect(plate.endsWith('<span class="ttf-sub">Cornus florida</span></span>')).toBe(true)
  })
  it('an empty foot renders nothing; a back has none', () => {
    expect(face(TH({ collector: null, rarity: null, credit: null })).querySelector('.ttf-furn')).toBe(null)
    const back = face(TH(), { side: 'back', copyright: '© Pincast' })
    expect(back.getAttribute('data-print')).toBe('')
    expect(back.querySelector('.ttf-furn')).toBe(null)
  })
  it('the Placecard app\'s photo front prints, its foot after the plate; its typographic front takes no foot', () => {
    const el = face(STOP({ app: 'studio', collector: { n: 2, of: 40 } }), { copyright: '© Pincast' })
    expect(el.getAttribute('data-print')).toBe('')
    const foot = el.querySelector('.ttf-face > .ttf-furn')
    expect(foot.previousElementSibling.classList.contains('ttf-plate')).toBe(true)
    expect(foot.nextElementSibling.classList.contains('ttf-grain')).toBe(true)
    expect(foot.querySelector('.ttf-furn-no').textContent).toBe('02/40')
    expect(foot.querySelector('.ttf-furn-cr').textContent).toBe('A. Person')
    const typo = face(STOP({ app: 'studio', img: null }), { copyright: '© Pincast' })
    expect(typo.getAttribute('data-print')).toBe('')
    expect(typo.querySelector('.ttf-furn')).toBe(null)
  })
  it('a VeryThere face prints when its face entry asks', () => {
    const el = mount(TtFace, { props: { card: STOP(), data: { ...DATA, faces: { stop: { print: true } } }, fonts: false } }).element
    expect(el.getAttribute('data-print')).toBe('')
  })
})

describe('TtTable', () => {
  const coll = () => ({ ...DATA, cards: [TH(), TH({ id: 'th:ash', title: 'Ash', number: 5, collector: { n: 30, of: 612 } }), STOP()] })
  const at = async (props = {}) => {
    const w = mount(TtTable, { props: { collection: coll(), options: { key: 'tt_print_test', group: 'none' }, ...props }, attachTo: document.body })
    await flushPromises()
    await nextTick()
    return w
  }
  it('a printing card\'s cell carries data-print; a VeryThere cell does not', async () => {
    const w = await at()
    expect(w.find('.tt-cell[data-id="th:dogwood"]').attributes('data-print')).toBe('')
    expect(w.find('.tt-cell[data-id="vt:s1"]').attributes('data-print')).toBe(undefined)
    w.unmount()
  })
  it('print off (the default): no motion attributes on the root', async () => {
    const w = await at()
    expect(w.element.hasAttribute('data-tt-light')).toBe(false)
    expect(w.element.hasAttribute('data-tt-tilt')).toBe(false)
    w.unmount()
  })
  it('print on: light and tilt from mount, gone at unmount; { tilt: false } keeps the light alone', async () => {
    const w = await at({ print: true })
    const root = w.element
    expect(root.getAttribute('data-tt-light')).toBe('on')
    expect(root.getAttribute('data-tt-tilt')).toBe('on')
    w.unmount()
    expect(root.hasAttribute('data-tt-light')).toBe(false)
    expect(root.hasAttribute('data-tt-tilt')).toBe(false)
    const w2 = await at({ print: { tilt: false } })
    expect(w2.element.getAttribute('data-tt-light')).toBe('on')
    expect(w2.element.hasAttribute('data-tt-tilt')).toBe(false)
    w2.unmount()
  })
  it('labels.copyright reaches the open card\'s foot', async () => {
    const w = await at({ labels: { copyright: '© Pincast' } })
    w.vm.openCard('th:dogwood')
    await flushPromises()
    await nextTick()
    expect(document.querySelector('.tt-st-card > .ttf .ttf-furn-cp').textContent).toBe('© Pincast')
    w.unmount()
  })
  it('a stacked pile of printing cards is a straight stack: data-print, its face, edges, one flat cover; a VeryThere pile keeps the fan', async () => {
    const species = Array.from({ length: 5 }, (_, i) => TH({ id: `th:${i}`, title: `Tree ${i}`, number: i + 1, collector: { n: i + 1, of: 612 } }))
    const walk = [STOP(), STOP({ id: 'vt:s2', title: 'Tom McCall', number: 3 })]
    const w = mount(TtTable, { props: { collection: { ...DATA, cards: [...species, ...walk] }, options: { key: 'tt_print_pile', group: 'set', stacked: true } }, attachTo: document.body })
    await flushPromises()
    await nextTick()
    const piles = w.findAll('.tt-pile')
    expect(piles).toHaveLength(2)
    const th = piles.find(p => p.find('.tt-cell[data-face="treehopper"]').exists())
    const vt = piles.find(p => p !== th)
    expect(th.attributes('data-print')).toBe('')
    expect(th.attributes('data-face')).toBe('treehopper')
    expect(th.attributes('data-edges')).toBe('3')
    expect(th.findAll('.tt-edge').map(e => e.attributes('style'))).toEqual(['--i: 3;', '--i: 2;', '--i: 1;'])
    expect(th.element.firstElementChild.classList.contains('tt-edge')).toBe(true)
    const cells = th.findAll('.tt-cell')
    expect(cells).toHaveLength(1)
    expect(cells[0].attributes('data-k')).toBe('0')
    expect(cells[0].attributes('style') || '').not.toMatch(/rotate/)
    expect(th.find('.tt-pile-deco').attributes('style') || '').not.toMatch(/rotate/)
    expect(th.find('.tt-pile-n').text()).toBe('×5')
    for (const a of ['data-print', 'data-face', 'data-edges']) expect(vt.attributes(a)).toBe(undefined)
    expect(vt.findAll('.tt-edge')).toHaveLength(0)
    expect(vt.findAll('.tt-cell')).toHaveLength(2)
    expect(vt.find('.tt-cell[data-k="0"]').attributes('style')).toMatch(/rotate/)
    w.unmount()
  })
  it('review F3: a one-card printing stack has no edge, and its cover keeps the tile shadow (the hairline skips data-edges="0")', async () => {
    const w = mount(TtTable, { props: { collection: { ...DATA, cards: [TH(), STOP(), STOP({ id: 'vt:s2', title: 'Tom McCall', number: 3 })] }, options: { key: 'tt_print_one', group: 'set', stacked: true } }, attachTo: document.body })
    await flushPromises()
    await nextTick()
    const th = w.findAll('.tt-pile').find(p => p.find('.tt-cell[data-face="treehopper"]').exists())
    expect(th.attributes('data-edges')).toBe('0')
    expect(th.findAll('.tt-edge')).toHaveLength(0)
    expect(th.find('.tt-cell').attributes('data-print')).toBe('')
    const css = readFileSync(resolve(__dirname, '../../css/cardroom.css'), 'utf8')
    expect(css).toContain('.tt-pile[data-edges]:not([data-edges="0"]) > .tt-cell{box-shadow:var(--shadow-edge, 0 1px 1px rgba(0,0,0,.4))}')
    expect(css).not.toMatch(/\.tt-pile\[data-edges\] > \.tt-cell\{/)
    expect(css).toContain('.tt-cell[data-print]{border-radius:var(--tile-r, min(4px, calc(var(--card-w) * .024)));box-shadow:var(--pc-tile-rest,') // 1.2.0: --tile-r, today's radius unset
    w.unmount()
  })
  it('review F4: cards gather into a printing stack and spread from it at rest, not through the fan\'s tilt; its edges fade in', async () => {
    const species = Array.from({ length: 5 }, (_, i) => TH({ id: `th:${i}`, title: `Tree ${i}`, number: i + 1, collector: { n: i + 1, of: 612 } }))
    const gbr = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function () {
      const x = this.classList && this.classList.contains('tt-pile') ? 300 : 10
      return { left: x, top: 10, x, y: 10, width: 100, height: 187, right: x + 100, bottom: 197 }
    }
    const calls = []
    const anim = Element.prototype.animate
    Element.prototype.animate = function (kf, o) { calls.push({ el: this, kf, o }); return anim.call(this, kf, o) }
    try {
      const w = mount(TtTable, { props: { collection: { ...DATA, cards: species }, options: { key: 'tt_print_f4', group: 'set', stacked: false } }, attachTo: document.body })
      await flushPromises()
      await nextTick()
      const head = () => w.findAll('[aria-expanded]').find(b => /^Species, /.test(b.attributes('aria-label') || ''))
      const rot = s => Number((/rotate\((-?[\d.]+)deg\)/.exec(s) || [])[1])
      calls.length = 0
      await head().trigger('click')
      await flushPromises()
      await nextTick()
      expect(w.find('.tt-pile').attributes('data-edges')).toBe('3')
      const ghosts = calls.filter(c => c.el.classList.contains('tt-ghost'))
      expect(ghosts.length).toBe(4)
      for (const g of ghosts) expect(rot(g.kf.at(-1).transform)).toBe(0)
      const edges = calls.filter(c => c.el.classList.contains('tt-edge'))
      expect(edges).toHaveLength(3)
      for (const e of edges) expect(e.kf[0].opacity).toBe(0)
      calls.length = 0
      await head().trigger('click')
      await flushPromises()
      await nextTick()
      expect(w.find('.tt-pile').exists()).toBe(false)
      const moved = calls.filter(c => c.el.classList.contains('tt-cell') && c.kf[0].transform)
      expect(moved.length).toBe(5)
      for (const m of moved) expect(rot(m.kf[0].transform)).toBe(0)
      w.unmount()
    } finally {
      Element.prototype.getBoundingClientRect = gbr
      Element.prototype.animate = anim
    }
  })
})

describe('core/print.js', () => {
  const dom = () => {
    document.body.innerHTML = '<div id="root"><div class="tt-st-card"><div class="ttf ttf-front" data-print=""><button class="ctl">x</button><span class="ttf-bk-body">t</span><span class="art">a</span></div></div>' +
      '<div class="ttf ttf-front plain"><span class="art2">b</span></div></div><button id="out">out</button>'
    const root = document.getElementById('root')
    const f = root.querySelector('.ttf[data-print]')
    for (const el of [f, root.querySelector('.plain')]) el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 562 })
    return { root, f, holder: root.querySelector('.tt-st-card'), plain: root.querySelector('.plain') }
  }
  const ptr = (el, type, x = 0, y = 0, o = {}) => {
    const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, ...o })
    Object.defineProperty(e, 'pointerId', { value: 1 })
    el.dispatchEvent(e)
  }
  it('the finger lights the print face under it, never another; leaving clears it; stop undoes everything', () => {
    const { root, f, plain } = dom()
    const stop = ttPrint({ root })
    ptr(f.querySelector('.art'), 'pointermove', 150, 0)
    expect(f.style.getPropertyValue('--pc-lx')).toBe('50.0%')
    expect(f.style.getPropertyValue('--pc-ly')).toBe('0.0%')
    ptr(plain.querySelector('.art2'), 'pointermove', 10, 10)
    expect(plain.style.getPropertyValue('--pc-lx')).toBe('')
    ptr(f.querySelector('.art'), 'pointerout', 0, 0, { relatedTarget: document.getElementById('out') })
    expect(f.style.getPropertyValue('--pc-lx')).toBe('')
    ptr(f.querySelector('.art'), 'pointermove', 30, 0)
    stop()
    expect(f.style.getPropertyValue('--pc-lx')).toBe('')
    expect(root.hasAttribute('data-tt-light')).toBe(false)
    expect(root.hasAttribute('data-tt-tilt')).toBe(false)
    ptr(f.querySelector('.art'), 'pointermove', 150, 0)
    ptr(f.querySelector('.art'), 'pointerdown', 290, 10)
    frames()
    expect(f.style.getPropertyValue('--pc-lx')).toBe('')
    expect(f.style.rotate || '').toBe('')
  })
  it('reduced motion: the light holds still, no tilt', () => {
    RM = true
    const { root, f, holder } = dom()
    const stop = ttPrint({ root })
    expect(root.getAttribute('data-tt-light')).toBe('still')
    expect(root.hasAttribute('data-tt-tilt')).toBe(false)
    ptr(f.querySelector('.art'), 'pointermove', 150, 0)
    ptr(f.querySelector('.art'), 'pointerdown', 290, 10)
    frames()
    expect(f.style.getPropertyValue('--pc-lx')).toBe('')
    expect(f.style.rotate || '').toBe('')
    expect(holder.hasAttribute('data-tt-held')).toBe(false)
    stop()
  })
  it('iOS: the permission is asked once, inside the first click on a button or a print card; granted, the phone moves the light', async () => {
    const req = vi.fn(() => Promise.resolve('granted'))
    window.DeviceOrientationEvent = { requestPermission: req }
    const { root, plain } = dom()
    const stop = ttPrint({ root })
    plain.click()
    expect(req).not.toHaveBeenCalled()
    document.getElementById('out').click()
    document.getElementById('out').click()
    expect(req).toHaveBeenCalledTimes(1)
    await flushPromises()
    const e = new Event('deviceorientation')
    Object.assign(e, { beta: 45, gamma: 30 })
    window.dispatchEvent(e)
    expect(root.getAttribute('data-tt-light')).toBe('phone')
    frames()
    // smoothed toward the target (gamma 30: x 10%; beta 45: y 50%), stopping within 0.1 of it
    expect(Math.abs(parseFloat(root.style.getPropertyValue('--pc-lx')) - 10)).toBeLessThan(0.2)
    expect(Math.abs(parseFloat(root.style.getPropertyValue('--pc-ly')) - 50)).toBeLessThan(0.2)
    stop()
    expect(root.style.getPropertyValue('--pc-lx')).toBe('')
  })
  it('the finger tilt leans the face toward the finger, at most 8 deg, and springs back to rest', () => {
    const { root, f, holder } = dom()
    const stop = ttPrint({ root })
    ptr(f.querySelector('.art'), 'pointerdown', 300, 281)
    expect(holder.hasAttribute('data-tt-held')).toBe(true)
    frames(6)
    expect(f.style.rotate).toMatch(/^0\.0000 1\.0000 0 [\d.]+deg$/)
    frames(60)
    const a = Number(/ ([\d.]+)deg$/.exec(f.style.rotate)[1])
    expect(a).toBeGreaterThan(7.5)
    expect(a).toBeLessThanOrEqual(8.5)
    ptr(f, 'pointerup', 300, 281)
    expect(holder.hasAttribute('data-tt-held')).toBe(false)
    frames()
    expect(q).toHaveLength(0)
    expect(f.style.rotate || '').toBe('')
    stop()
  })
  it('controls, a back\'s text and a card mid-flip are left alone', () => {
    const { root, f, holder } = dom()
    const stop = ttPrint({ root })
    ptr(f.querySelector('.ctl'), 'pointerdown', 290, 10)
    ptr(f.querySelector('.ttf-bk-body'), 'pointerdown', 290, 10)
    holder.classList.add('is-lifted')
    ptr(f.querySelector('.art'), 'pointerdown', 290, 10)
    frames()
    expect(holder.hasAttribute('data-tt-held')).toBe(false)
    expect(f.style.rotate || '').toBe('')
    stop()
  })
})
