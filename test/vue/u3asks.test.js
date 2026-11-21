// @vitest-environment jsdom
/**
 * Kit 1.2.0, the stage and table additions given: the stage (live faces, the head slot and Flip words, the art slot
 * and keys in a field), the table (group actions, card.numbers, the quest figure and stack glyph, the Held /
 * Missing / All segment and sortChip, topRows and tokens), the card (readBack, hold) and the face (labels.story).
 * Unset, the markup is 1.1.0's: u3gold.test.js, k2labels, u2face.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { TtCard, TtFace, TtTable, setTtHost, ttLock } from '../../vue/index.js'
import { crHeldNumbers } from '../../core/cardroom.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}
const anims = []
beforeEach(() => {
  anims.length = 0
  Element.prototype.animate = function (kf, o) { const a = { el: this, kf, o, onfinish: null, oncancel: null, cancel() {}, finish() {} }; anims.push(a); return a }
  setTtHost({ head: vi.fn(), distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => { setTtHost({ head: null, distUnit: null }); document.body.innerHTML = ''; ttLock(false) })
const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await flushPromises()
    await nextTick()
    if (!anims.length) return
    anims.splice(0).forEach(a => a.onfinish && a.onfinish())
  }
  await flushPromises()
}

const base = { app: 'treehopper', face: 'treehopper', subtitle: 'Quercus', fact: '', back: 'A story.', stats: [], of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1 }
const sp = (id, o = {}) => ({ ...base, id: `th:${id}`, set: 'species', kind: 'species', title: id, type: 'Species', number: null, ...o })
const RAR = ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique']
const SETS = (cards) => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [
    { id: 'overstory', app: 'treehopper', name: 'Overstory', short: 'OVERSTORY', total: 3, kind: 'species', pts: 120 },
    { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' },
  ],
  rarities: { species: RAR },
  cards: cards || [
    sp('oak', { sets: ['overstory'], number: 3 }),
    sp('ash', { number: 1, added: 2 }),
    sp('elm', { number: 2, added: 3 }),
    sp('yew', { held: false, collected: null, added: null }),
  ],
})
const table = async (props = {}, slots) => {
  const { options = {}, ...rest } = props
  const w = mount(TtTable, { props: { collection: SETS(), ...rest, options: { key: 'tt_u3_asks', ...options } }, slots, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const ptr = (el, type, x = 10, y = 10) => {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  Object.defineProperty(e, 'pointerId', { value: 1 })
  el.dispatchEvent(e)
}
const tap = (el) => { ptr(el, 'pointerdown'); ptr(el, 'pointerup') }
const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
const open = async (w, id = 'th:oak') => { w.vm.openCard(id); await settle() }
const isOpen = w => w.find('.tt-stage').classes().includes('is-on')

describe('B8: the open card draws the table\'s current copy of its card', () => {
  it('a collection the host replaces redraws the open card in place, its face element kept', async () => {
    const w = await table()
    await open(w)
    const el = w.find('.tt-st-card > .ttf').element
    const D = SETS()
    D.cards[0] = { ...D.cards[0], title: 'Live oak' }
    await w.setProps({ collection: D })
    await settle()
    expect(w.find('.tt-st-card').text()).toContain('Live oak')
    expect(w.find('.tt-st-card > .ttf').element).toBe(el)
    w.unmount()
  })
  it('a card laid over, and the card under it, follow too', async () => {
    const w = await table()
    await open(w)
    w.vm.over('th:ash', { back: 'Back to oak' })
    await settle()
    const D = SETS()
    D.cards[0] = { ...D.cards[0], title: 'Live oak' }
    D.cards[1] = { ...D.cards[1], title: 'Live ash' }
    await w.setProps({ collection: D })
    await settle()
    const faces = w.findAll('.tt-st-card > .ttf')
    expect(faces[faces.length - 1].text()).toContain('Live ash')
    expect(w.find('.tt-st-card > .ttf.is-under').text()).toContain('Live oak')
    w.unmount()
  })
})

describe('B12: the stage head slot, and the Flip words', () => {
  it('stage-head fills the head in place of the kit\'s; its flip turns the card; over brings the kit\'s Back first', async () => {
    let flip = null
    const w = await table({}, {
      'stage-head': (s) => { flip = s.flip; return h('span', { class: 'x-head', 'data-side': s.side, 'data-over': String(s.over), 'data-has-t': String(!!s.t) }, s.card.title) },
    })
    await open(w)
    const head = w.find('.tt-st-head')
    expect(head.findAll('.tt-mk, .tt-st-set, .tt-st-pos, .tt-st-flip, .tt-st-back').length).toBe(0)
    expect(head.find('.x-head').text()).toBe('oak')
    expect(head.find('.x-head').attributes()).toMatchObject({ 'data-side': 'front', 'data-over': 'false', 'data-has-t': 'true' })
    flip()
    await settle()
    expect(w.find('.x-head').attributes('data-side')).toBe('back')
    w.vm.over('th:ash', { back: 'Back to oak' })
    await settle()
    const kids = [...w.find('.tt-st-head').element.children]
    expect(kids.map(k => k.className)).toEqual(['tt-st-back', 'x-head'])
    expect(kids[0].textContent).toBe('Back to oak')
    expect(kids[1].textContent).toBe('ash')
    expect(kids[1].getAttribute('data-over')).toBe('true')
    w.unmount()
  })
  it('labels.back and labels.front name the Flip button', async () => {
    const w = await table({ labels: { back: 'Verso', front: 'Recto' } })
    await open(w)
    expect(w.find('.tt-st-flip').text()).toBe('Verso')
    await w.find('.tt-st-flip').trigger('click')
    await settle()
    expect(w.find('.tt-st-flip').text()).toBe('Recto')
    w.unmount()
  })
})

describe('B17: the stage art slot, and keys typed in a field', () => {
  it('stage-art draws in the open face\'s art with { card, side, t }', async () => {
    const w = await table({}, { 'stage-art': s => h('input', { class: 'x-art', 'data-id': s.card.id, 'data-side': s.side, 'data-has-t': String(!!s.t) }) })
    await open(w)
    const a = w.find('.tt-st-card .x-art')
    expect(a.attributes()).toMatchObject({ 'data-id': 'th:oak', 'data-side': 'front', 'data-has-t': 'true' })
    expect(w.findAll('.tt-grid .x-art').length).toBe(0)
    w.unmount()
  })
  it('Escape and the arrows in a field are the field\'s; outside one they close and step as before', async () => {
    const w = await table({}, { 'stage-art': s => h('input', { class: 'x-art', 'data-id': s.card.id }) })
    await open(w)
    const input = () => w.find('.tt-st-card .x-art').element
    expect(key(input(), 'ArrowRight')).toBe(true)
    expect(key(input(), 'Escape')).toBe(true)
    await settle()
    expect(isOpen(w)).toBe(true)
    expect(input().getAttribute('data-id')).toBe('th:oak')
    key(w.find('.tt-st-card').element, 'ArrowRight')
    await settle()
    expect(input().getAttribute('data-id')).not.toBe('th:oak')
    key(document.body, 'Escape')
    await settle()
    expect(isOpen(w)).toBe(false)
    w.unmount()
  })
  it('Escape on a checkbox, a radio or a range closes the card; arrows on them stay theirs (U4, review N3)', async () => {
    const w = await table({}, { 'stage-art': s => [
      h('input', { class: 'x-ck', type: 'checkbox', 'data-id': s.card.id }), h('input', { class: 'x-rd', type: 'radio' }),
      h('input', { class: 'x-rg', type: 'range' }), h('select', { class: 'x-sel' }, [h('option', 'a')]),
    ] })
    const at = sel => w.find('.tt-st-card ' + sel).element
    for (const sel of ['.x-ck', '.x-rd', '.x-rg']) {
      await open(w)
      expect(key(at(sel), 'ArrowRight')).toBe(true)
      await settle()
      expect(at('.x-ck').getAttribute('data-id')).toBe('th:oak')
      expect(key(at(sel), 'Escape')).toBe(false)
      await settle()
      expect(isOpen(w)).toBe(false)
    }
    await open(w)
    expect(key(at('.x-sel'), 'Escape')).toBe(true)
    await settle()
    expect(isOpen(w)).toBe(true)
    w.unmount()
  })
})

describe('the Tab trap reaches the fields a slot draws (U4, review F2)', () => {
  // jsdom lays nothing out, so the trap's offsetParent test would drop every stop: a connected element counts as shown
  const real = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')
  beforeEach(() => { Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get() { return this.isConnected ? this.parentElement : null } }) })
  afterEach(() => { if (real) Object.defineProperty(HTMLElement.prototype, 'offsetParent', real); else delete HTMLElement.prototype.offsetParent })
  const tab = (shift = false) => { const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true }); document.activeElement.dispatchEvent(e); return document.activeElement }
  const slots = {
    'stage-art': () => [h('input', { class: 'x-in', 'aria-label': 'Note' }), h('input', { class: 'x-off', disabled: true }), h('input', { class: 'x-hid', type: 'hidden' })],
    'stage-head': () => [h('button', { class: 'x-h', type: 'button' }, 'H'), h('select', { class: 'x-sel' }, [h('option', 'a')])],
  }
  it('Tab and Shift+Tab visit the head\'s select and the art\'s input, never a disabled or hidden one', async () => {
    const w = await table({}, slots)
    await open(w)
    w.find('.x-h').element.focus()
    const ring = [document.activeElement]
    for (let i = 0; i < 12 && tab() !== ring[0]; i++) ring.push(document.activeElement)
    const cls = ring.map(e => e.classList[0])
    expect(cls).toContain('x-sel')
    expect(cls).toContain('x-in')
    expect(cls).not.toContain('x-off')
    expect(cls).not.toContain('x-hid')
    expect(cls).toContain('tt-st-card')
    expect(cls).toContain('tt-st-x')
    const back = [ring[0]]
    for (let i = 0; i < ring.length - 1; i++) back.push(tab(true))
    expect(back.map(e => e.classList[0])).toEqual([cls[0], ...cls.slice(1).reverse()])
    w.unmount()
  })
  it('Tab from inside a field goes on to the next stop, not back to the first', async () => {
    const w = await table({}, slots)
    await open(w)
    w.find('.x-h').element.focus()
    const ring = [document.activeElement]
    for (let i = 0; i < 12 && tab() !== ring[0]; i++) ring.push(document.activeElement)
    for (const sel of ['.x-in', '.x-sel']) {
      const el = w.find('.tt-stage ' + sel).element
      el.focus()
      expect(tab()).toBe(ring[(ring.indexOf(el) + 1) % ring.length])
    }
    w.unmount()
  })
})

describe('B20: a group\'s own actions after its head', () => {
  it('group-act draws after each head button, never inside it, with { group, head, stacked, t }', async () => {
    const w = await table({}, { 'group-act': s => h('button', { class: 'x-route', 'data-x': s.group.id, 'data-stacked': String(s.stacked), 'data-has-t': String(!!s.t) }, s.head.name) })
    const bx = w.findAll('.tt-bx')
    expect(bx.length).toBe(2)
    for (const b of bx) {
      const act = b.element.nextElementSibling
      expect(act.className).toBe('tt-bx-act')
      expect(act.querySelector('.x-route').getAttribute('data-x')).toBe(b.attributes('data-g'))
      expect(b.find('.x-route').exists()).toBe(false)
    }
    expect(w.find('.x-route').attributes()).toMatchObject({ 'data-stacked': 'false', 'data-has-t': 'true' })
    await w.find('.tt-stk').trigger('click')
    await settle()
    expect(w.findAll('.x-route').map(b => b.attributes('data-stacked'))).toEqual(['true', 'true'])
    w.unmount()
  })
  it('a table without heads (group none) draws none', async () => {
    const w = await table({ options: { groups: ['none', 'set'], group: 'none' } }, { 'group-act': () => h('button', { class: 'x-route' }, 'Route') })
    expect(w.findAll('.tt-bx-act').length).toBe(0)
    w.unmount()
  })
})

describe('B21: card.numbers, a card\'s place in its other sets', () => {
  it('the bar lights card.number in its own set and card.numbers[id] in the others', () => {
    const m = crHeldNumbers([
      { id: 'a', set: 'species', sets: ['q1', 'q2'], number: 7, numbers: { q1: 4, q2: null, q9: 1 } },
      { id: 'b', set: 'species', sets: ['q1'], number: null, numbers: { q1: 2 } },
      { id: 'c', set: 'species', sets: ['q1'], held: false, number: 5, numbers: { q1: 5 } },
    ])
    expect([...m.get('species')]).toEqual([7])
    expect([...m.get('q1')].sort()).toEqual([2, 4])
    expect(m.has('q2')).toBe(false)
    expect(m.has('q9')).toBe(false)
  })
  it('unset, only the own set\'s number counts, as before', () => {
    const m = crHeldNumbers([{ id: 'a', set: 'species', sets: ['q1'], number: 7 }, { id: 'b', set: 'species', number: null }])
    expect([...m.keys()]).toEqual(['species'])
    expect([...m.get('species')]).toEqual([7])
  })
})

describe('B24: the quest figure and the stack glyph', () => {
  const fig = w => [...w.find('.tt-bx[data-g="set:overstory"] .tt-bx-fig').element.children].map(c => `${c.tagName}:${c.textContent}`)
  it('labels.questHead prints a head with points as the board does; a head without points keeps its figure', async () => {
    const u = await table()
    const plain = u.find('.tt-bx[data-g="set:species"] .tt-bx-fig').element.innerHTML
    expect(u.find('.tt-bx[data-g="set:overstory"] .tt-bx-fig').text()).toBe('1 of 3 · 120 pts')
    u.unmount()
    const w = await table({ labels: { questHead: '{name} {n} of {N} · {pts} pts' } })
    expect(fig(w)).toEqual(['B:1', 'I: of 3', 'EM:· 120 pts'])
    expect(w.find('.tt-bx[data-g="set:overstory"] .tt-bx-name').text()).toBe('OVERSTORY')
    expect(w.find('.tt-bx[data-g="set:species"] .tt-bx-fig').element.innerHTML).toBe(plain)
    w.unmount()
  })
  it('stackIcon two-layers draws the board\'s glyph on Stack and on each spread head', async () => {
    const u = await table()
    expect(u.find('.tt-stk svg').element.innerHTML).toContain('m12.83 2.18')
    u.unmount()
    const w = await table({ stackIcon: 'two-layers' })
    const svgs = [w.find('.tt-stk svg'), ...w.findAll('.tt-bx svg')]
    expect(svgs.length).toBe(3)
    for (const s of svgs) expect(s.element.innerHTML).toBe('<path d="m12 3 9 5-9 5-9-5 9-5z"></path><path d="m3 13 9 5 9-5"></path>')
    w.unmount()
  })
})

describe('B11 item 4: options.missing segment and options.sortChip', () => {
  const segs = w => w.findAll('.tt-rail').map(r => r.element.firstElementChild)
  const checked = w => segs(w).map(s => [...s.children].find(b => b.getAttribute('aria-checked') === 'true').textContent)
  it('Held / Missing / All in place of the Missing chip, first in both rails, setting filter.missing', async () => {
    const w = await table({ options: { missing: 'segment' } })
    expect(w.findAll('.tt-chip[data-k="missing"]').length).toBe(0)
    expect(segs(w).length).toBe(2)
    for (const s of segs(w)) {
      expect(s.getAttribute('data-seg')).toBe('missing')
      expect(s.getAttribute('role')).toBe('radiogroup')
      expect([...s.children].map(b => b.textContent)).toEqual(['Held', 'Missing', 'All'])
    }
    expect(checked(w)).toEqual(['Held', 'Held'])
    const btn = i => w.find('.tt-strip [data-seg="missing"]').findAll('button')[i]
    await btn(1).trigger('click')
    await settle()
    expect(w.vm.T.filter.missing).toBe('only')
    expect(checked(w)).toEqual(['Missing', 'Missing'])
    await w.find('.tt-dock [data-seg="missing"]').findAll('button')[2].trigger('click')
    await settle()
    expect(w.vm.T.filter.missing).toBe(true)
    await btn(0).trigger('click')
    await settle()
    expect(w.vm.T.filter.missing).toBe(false)
    w.unmount()
  })
  it('labels name its words and the chip\'s; no missing cards, no segment', async () => {
    const w = await table({ options: { missing: 'segment' }, labels: { held: 'Got', missing: 'Need', all: 'Every' } })
    expect([...segs(w)[0].children].map(b => b.textContent)).toEqual(['Got', 'Need', 'Every'])
    w.unmount()
    const c = await table({ labels: { missing: 'Need' } })
    expect(c.find('.tt-strip .tt-chip[data-k="missing"]').text()).toMatch(/^Need/)
    c.unmount()
    const n = await table({ collection: SETS([sp('oak', { number: 3 })]), options: { missing: 'segment' } })
    expect(n.findAll('[data-seg="missing"]').length).toBe(0)
    n.unmount()
  })
  it('sortChip false leaves the sort chip out; unset it stays', async () => {
    const w = await table({ options: { sortChip: false } })
    expect(w.findAll('.tt-chip[data-k="sort"]').length).toBe(0)
    w.unmount()
    const u = await table()
    expect(u.findAll('.tt-chip[data-k="sort"]').length).toBe(2)
    u.unmount()
  })
})

describe('B11: topRows and the tokens', () => {
  it('topRows 2 marks the root; unset, no attribute', async () => {
    const w = await table({ topRows: 2 })
    expect(w.find('.tt').attributes('data-top-rows')).toBe('2')
    w.unmount()
    const u = await table()
    expect(u.find('.tt').attributes('data-top-rows')).toBe(undefined)
    u.unmount()
  })
  it('table.css reads each token with today\'s value, and draws two rows only under 900 px', () => {
    const css = readFileSync(resolve(__dirname, '../../css/table.css'), 'utf8')
    for (const s of ['padding:0 var(--seg-px, 9px)', 'padding:0 var(--chip-px, 13px)', 'padding:var(--pile-n-pad, 0 .95em)', 'margin-top:var(--nest-top, 0)']) expect(css).toContain(s)
    expect(css.split('var(--tile-r, min(4px, calc(var(--card-w) * .024)))').length - 1).toBe(3)
    const block = css.slice(css.indexOf('.tt[data-top-rows="2"]{--top-h'))
    expect(css.slice(0, css.indexOf('.tt[data-top-rows="2"]{--top-h')).trimEnd().endsWith('@media (max-width:899.98px){')).toBe(true)
    expect(block).toMatch(/^\.tt\[data-top-rows="2"\]\{--top-h:var\(--top-h2, 92px\)\}/)
    expect(css).toContain('.tt-bx-act:empty{display:none}')
  })
})

const DATA = () => ({ apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }], sets: [{ id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' }], rarities: { species: RAR } })
const W300 = () => ({ left: 0, top: 0, right: 300, bottom: 562, width: 300, height: 562 })
const card = async (props = {}) => {
  const w = mount(TtCard, { props: { card: sp('oak', { number: 3, back: 'A long story.' }), data: DATA(), ...props }, attachTo: document.body })
  w.find('.tt-cd-card').element.getBoundingClientRect = W300
  await flushPromises()
  return w
}
const sideOf = w => w.find('.tt-cd').attributes('data-side')

describe('N1: readBack, a tap in the back\'s body is the reader\'s', () => {
  it('set, a tap inside the shown back\'s body keeps the side; a tap elsewhere on the card turns it', async () => {
    const w = await card({ side: 'back', readBack: true })
    const body = w.find('.tt-cd-card > .ttf-back .ttf-bk-body').element
    tap(body)
    await settle()
    expect(w.emitted('update:side')).toBe(undefined)
    tap(w.find('.tt-cd-card').element)
    await settle()
    expect(w.emitted('update:side')).toEqual([['front']])
    w.unmount()
  })
  it('a swipe from the body still turns; unset, a tap in the body turns as before', async () => {
    const w = await card({ side: 'back', readBack: true })
    const body = w.find('.tt-cd-card > .ttf-back .ttf-bk-body').element
    ptr(body, 'pointerdown', 10)
    ptr(body, 'pointermove', 150)
    ptr(body, 'pointerup', 150)
    await settle()
    expect(w.emitted('update:side')).toEqual([['front']])
    w.unmount()
    const u = await card({ side: 'back' })
    tap(u.find('.tt-cd-card > .ttf-back .ttf-bk-body').element)
    await settle()
    expect(u.emitted('update:side')).toEqual([['front']])
    u.unmount()
  })
})

describe('N2: hold, the person\'s turns wait for the host', () => {
  it('held, a tap, a swipe, Enter and Space turn nothing; v-model:side and flip() still turn', async () => {
    const w = await card({ hold: true })
    const el = w.find('.tt-cd-card').element
    tap(el)
    ptr(el, 'pointerdown', 10)
    ptr(el, 'pointermove', 200)
    ptr(el, 'pointerup', 200)
    expect(key(el, 'Enter')).toBe(false)
    expect(key(el, ' ')).toBe(false)
    await settle()
    expect(w.emitted('update:side')).toBe(undefined)
    expect(sideOf(w)).toBe('front')
    await w.setProps({ side: 'back' })
    await settle()
    expect(sideOf(w)).toBe('back')
    w.vm.flip()
    await settle()
    expect(w.emitted('update:side')).toEqual([['front']])
    expect(sideOf(w)).toBe('front')
    w.unmount()
  })
})

describe('N3: labels.story names a Treehopper back\'s story heading', () => {
  const back = labels => mount(TtFace, { props: { card: sp('oak', { number: 3 }), data: DATA(), side: 'back', fonts: false, labels } }).element
  it('given, its word; empty, no heading and the story stays; unset, "Species story"', () => {
    expect(back({ story: 'Tree story' }).querySelector('.ttf-bk-h4').textContent).toBe('Tree story')
    const e = back({ story: '' })
    expect(e.querySelector('.ttf-bk-h4')).toBe(null)
    expect(e.querySelector('.ttf-bk-story .ttf-bk-text').textContent).toBe('A story.')
    expect(back({}).querySelector('.ttf-bk-h4').textContent).toBe('Species story')
  })
  it('the table hands it to the open card\'s back', async () => {
    const w = await table({ labels: { story: 'Tree story' } })
    await open(w)
    await w.find('.tt-st-flip').trigger('click')
    await settle()
    expect(w.find('.tt-st-card .ttf-bk-h4').text()).toBe('Tree story')
    w.unmount()
  })
})

// 1.4.0: the kit patch found while pinning 1.2.0, its stage part
describe('PL-055 (1.4.0): an empty stage head draws no ticket', () => {
  // Selectors 3's :empty, as browsers match it: no element child and no text of non-zero length (Vue's fragment
  // anchors are empty text nodes; jsdom counts them, Chromium does not; the visual check runs it in Chromium)
  const empty = el => [...el.childNodes].every(n => n.nodeType === 8 || (n.nodeType === 3 && n.nodeValue === ''))
  it('a stage-head slot that renders nothing leaves the head :empty, and both sheets hide it', async () => {
    const w = await table({}, { 'stage-head': () => null })
    await open(w)
    expect(empty(w.find('.tt-st-head').element)).toBe(true)
    for (const f of ['table.css', 'cardroom.css']) expect(readFileSync(resolve(__dirname, `../../css/${f}`), 'utf8')).toContain('.tt-st-head:empty{visibility:hidden}')
    w.unmount()
  })
  it('the kit\'s own head and a filled slot are not empty', async () => {
    const own = await table()
    await open(own)
    expect(empty(own.find('.tt-st-head').element)).toBe(false)
    own.unmount()
    const filled = await table({}, { 'stage-head': (s) => h('span', s.card.title) })
    await open(filled)
    expect(empty(filled.find('.tt-st-head').element)).toBe(false)
    filled.unmount()
  })
})
