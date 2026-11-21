// @vitest-environment jsdom
/**
 * TtStage over (2026-10-31), also inside a set, through TtTable over(id, { back }) and pop(). A card
 * laid face up over the open one; the card under kept in place (its element, face, flip, a typed draft,
 * the focus it had), hidden and inert; Back, Escape, the close control and the backdrop go back to it;
 * prev, next, arrows and swipe off while one lies over; over() of the card just under pops (a tree opened
 * from its species' rows); the table's set change closes the whole stage.
 * Never called, the stage's markup is as before.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { TtTable, setTtHost, ttLock } from '../../vue/index.js'

let RM = false
window.matchMedia = q => ({ matches: /reduce/.test(q) && RM, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = (x, y) => { window.scrollY = typeof x === 'object' ? x.top : y }

const anims = []
beforeEach(() => {
  RM = false
  anims.length = 0
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

const tree = (id, o = {}) => ({ id: `tree:${id}`, app: 'treehopper', set: 'trees', kind: 'tree', face: 'treehopper', title: `Tree ${id}`, subtitle: '', type: 'Tree', fact: '', back: 'A tree.', stats: [], number: null, of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1, ...o })
const sp = (id, o = {}) => ({ id: `th:${id}`, app: 'treehopper', set: 'species', kind: 'species', face: 'treehopper', title: id, subtitle: '', type: 'Species', fact: '', back: 'A species.', stats: [], number: null, of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1, ...o })
const DATA = () => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [
    { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' },
    { id: 'trees', app: 'treehopper', name: 'Trees', short: 'TREES', total: null, kind: 'tree' },
  ],
  rarities: { species: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'], tree: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'] },
  cards: [
    sp('oak', { number: 1, childTotal: 4260, children: ['a', 'b', 'c'].map(x => tree(`oak-${x}`)) }),
    sp('ash', { number: 2, childTotal: 1, children: [tree('ash-a')] }),
    sp('yew', { number: 3 }),
  ],
})

// the host (Treehopper): a tree's back carries a draft and "Species card"; a species' back lists its trees
let W = null
const speciesOf = id => id.replace(/^tree:(\w+)-.*$/, 'th:$1')
const SLOTS = {
  'stage-back': ({ card: c }) => (c.kind === 'tree'
    ? h('span', { class: 'host' }, [
        h('input', { class: 'draft' }),
        h('button', { class: 'sp-btn', type: 'button', onClick: (e) => { e.stopPropagation(); W.vm.over(speciesOf(c.id), { back: 'Back to tree' }) } }, 'Species card'),
      ])
    : h('span', { class: 'host' }, [
        h('button', { class: 'row-btn', type: 'button', onClick: (e) => { e.stopPropagation(); W.vm.over('tree:oak-b', { back: 'Back to species' }) } }, 'Tree oak-b'),
      ])),
}
const at = async ({ nest = true } = {}) => {
  W = mount(TtTable, { props: { collection: DATA(), options: { key: 'tt_over_test', nest } }, slots: SLOTS, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return W
}
// every animation finishes, including the ones a finish starts (a flip's second half)
const drain = async () => {
  for (let i = 0; i < 8; i++) {
    await flushPromises()
    await nextTick()
    if (!anims.length) return
    anims.splice(0).forEach(a => a.onfinish && a.onfinish())
  }
}
const faces = () => W.findAll('.tt-st-card > .ttf')
const key = k => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
function swipe(el, dx) {
  for (const [type, x] of [['pointerdown', 200], ['pointerup', 200 + dx]]) {
    const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 10 })
    Object.defineProperty(e, 'pointerId', { value: 1 })
    el.dispatchEvent(e)
  }
}
// open oak's set, open a tree in it, turn it to its back
async function treeBack(id = 'tree:oak-a') {
  expect(W.vm.openNest('th:oak')).toBe(true)
  await drain()
  await W.find(`.tt-cell[data-id="${id}"] .tt-hit`).trigger('click')
  await drain()
  await W.find('.tt-st-flip').trigger('click')
  await drain()
  expect(W.find('.tt-st-card .ttf-back').exists()).toBe(true)
}

describe('TtStage over (A4.9 item 7)', () => {
  it('lays the species face up over the open tree; the tree stays in place, hidden, inert, still on its back', async () => {
    await at()
    await treeBack()
    const treeEl = faces()[0].element
    await W.find('.sp-btn').trigger('click')
    await drain()
    const f = faces()
    expect(f.length).toBe(2)
    expect(f[0].element).toBe(treeEl)
    expect(f[0].classes()).toContain('is-under')
    expect(f[0].attributes('inert')).toBeDefined()
    expect(f[0].attributes('data-id')).toBe('tree:oak-a')
    expect(f[0].classes().includes('ttf-back')).toBe(true)
    expect(f[1].attributes('data-id')).toBe('th:oak')
    expect(f[1].classes()).not.toContain('is-under')
    expect(f[1].attributes('inert')).toBeUndefined()
    expect(f[1].classes().includes('ttf-back')).toBe(false)
    // the head: the way back in place of the mark, set and position; the flip is the species'
    expect(W.find('.tt-st-back').text()).toBe('Back to tree')
    expect(W.find('.tt-st-head .tt-mk').exists()).toBe(false)
    expect(W.find('.tt-st-set').exists()).toBe(false)
    expect(W.find('.tt-st-pos').exists()).toBe(false)
    expect(W.find('.tt-st-flip').text()).toBe('Back')
    expect(W.find('.tt-stage').attributes('aria-label')).toBe('oak')
    // prev and next off; the table's open card is still the tree
    expect(W.find('.tt-st-act').classes()).toContain('is-over')
    expect(W.find('.tt-st-nav.is-prev').attributes('disabled')).toBeDefined()
    expect(W.find('.tt-st-nav.is-next').attributes('disabled')).toBeDefined()
    expect(W.vm.T.openId).toBe('tree:oak-a')
    W.unmount()
  })

  it('Back goes to the tree as it was: the same element, still flipped, the draft kept, focus on Species card', async () => {
    await at()
    await treeBack()
    const treeEl = faces()[0].element
    W.find('.draft').element.value = 'half a note'
    const btn = W.find('.sp-btn').element
    btn.focus()
    await W.find('.sp-btn').trigger('click')
    await drain()
    expect(document.activeElement).toBe(W.find('.tt-st-card').element) // off the hidden tree
    await W.find('.tt-st-back').trigger('click')
    await drain()
    const f = faces()
    expect(f.length).toBe(1)
    expect(f[0].element).toBe(treeEl)
    expect(f[0].classes()).not.toContain('is-under')
    expect(f[0].attributes('inert')).toBeUndefined()
    expect(f[0].classes().includes('ttf-back')).toBe(true)
    expect(W.find('.draft').element.value).toBe('half a note')
    expect(W.find('.tt-st-flip').text()).toBe('Front')
    expect(W.find('.tt-st-pos').text()).toBe('2 / 4')
    expect(W.find('.tt-st-back').exists()).toBe(false)
    expect(W.find('.tt-st-act').classes()).not.toContain('is-over')
    expect(W.find('.tt-st-nav.is-prev').attributes('disabled')).toBeUndefined()
    expect(document.activeElement).toBe(btn)
    W.unmount()
  })

  it('Escape, the close control and the backdrop each go back first; the next Escape closes the tree, the set stays', async () => {
    await at()
    await treeBack()
    for (const act of [() => key('Escape'), () => W.find('.tt-st-x').trigger('click'), () => W.find('.tt-st-bg').trigger('click')]) {
      expect(W.vm.over('th:oak', { back: 'Back to tree' })).toBe(true)
      await drain()
      expect(faces().length).toBe(2)
      await act()
      await drain()
      expect(W.find('.tt-stage').classes()).toContain('is-on')
      expect(faces().length).toBe(1)
      expect(faces()[0].attributes('data-id')).toBe('tree:oak-a')
    }
    key('Escape')
    await drain()
    expect(W.find('.tt-stage').classes()).not.toContain('is-on')
    expect(W.vm.T.openId).toBe(null)
    expect(W.vm.T.nest).toBe('th:oak')
    W.unmount()
  })

  it('arrows and a swipe do nothing while a card lies over', async () => {
    await at()
    await treeBack()
    W.vm.over('th:oak')
    await drain()
    key('ArrowRight')
    await drain()
    key('ArrowLeft')
    await drain()
    swipe(W.find('.tt-st-card').element, -120)
    await drain()
    expect(W.vm.T.openId).toBe('tree:oak-a')
    expect(faces().map(x => x.attributes('data-id'))).toEqual(['tree:oak-a', 'th:oak'])
    W.unmount()
  })

  it('over() of the card just under the top goes back to it: a tree opened from its species\' rows', async () => {
    await at()
    expect(W.vm.openNest('th:oak')).toBe(true)
    await drain()
    await W.find('.tt-cell[data-id="th:oak"] .tt-hit').trigger('click')
    await drain()
    await W.find('.tt-st-flip').trigger('click')
    await drain()
    await W.find('.row-btn').trigger('click')
    await drain()
    expect(faces().map(x => x.attributes('data-id'))).toEqual(['th:oak', 'tree:oak-b'])
    expect(W.find('.tt-st-back').text()).toBe('Back to species')
    expect(W.vm.over('th:oak', { back: 'Back to tree' })).toBe(true) // the tree's Species card
    await drain()
    expect(faces().map(x => x.attributes('data-id'))).toEqual(['th:oak'])
    expect(faces()[0].classes().includes('ttf-back')).toBe(true)
    expect(W.find('.tt-st-back').exists()).toBe(false)
    expect(W.vm.T.openId).toBe('th:oak')
    W.unmount()
  })

  it('refused: no open card, the card on top, an unknown id, nothing to go back to, and while it moves', async () => {
    await at()
    expect(W.vm.over('th:oak')).toBe(false)
    expect(W.vm.pop()).toBe(false)
    await treeBack()
    expect(W.vm.over('tree:oak-a')).toBe(false)
    expect(W.vm.over('nope')).toBe(false)
    expect(W.vm.pop()).toBe(false)
    expect(W.vm.over('th:oak')).toBe(true)
    expect(W.vm.over('th:ash')).toBe(false) // still laying the first
    await drain()
    expect(W.vm.pop()).toBe(true)
    expect(W.vm.pop()).toBe(false) // still lifting it
    await drain()
    expect(faces().length).toBe(1)
    W.unmount()
  })

  it('the default way back is the title of the card under; two deep, each Back goes one down', async () => {
    await at()
    await treeBack()
    W.vm.over('th:oak')
    await drain()
    expect(W.find('.tt-st-back').text()).toBe('Tree oak-a')
    W.vm.over('th:ash')
    await drain()
    const f = faces()
    expect(f.map(x => x.attributes('data-id'))).toEqual(['tree:oak-a', 'th:oak', 'th:ash'])
    expect(f.map(x => x.classes().includes('is-under'))).toEqual([true, true, false])
    expect(W.find('.tt-st-back').text()).toBe('oak')
    expect(W.vm.pop()).toBe(true)
    await drain()
    expect(faces().map(x => x.attributes('data-id'))).toEqual(['tree:oak-a', 'th:oak'])
    expect(W.find('.tt-st-back').text()).toBe('Tree oak-a')
    expect(W.vm.pop()).toBe(true)
    await drain()
    expect(faces().map(x => x.attributes('data-id'))).toEqual(['tree:oak-a'])
    expect(faces()[0].classes().includes('ttf-back')).toBe(true)
    W.unmount()
  })

  it('a top card takes its own set\'s child over it; with sets off a child is no card and over() refuses it', async () => {
    await at()
    W.vm.openCard('th:oak') // the parent opened on the top table (no set open)
    await drain()
    expect(W.vm.over('tree:oak-a', { back: 'Back to species' })).toBe(true)
    await drain()
    expect(faces().map(x => x.attributes('data-id'))).toEqual(['th:oak', 'tree:oak-a'])
    expect(W.vm.T.nest).toBe(null)
    W.unmount()
    await at({ nest: false })
    await W.find('.tt-cell[data-id="th:oak"] .tt-hit').trigger('click')
    await drain()
    expect(W.vm.over('tree:oak-a')).toBe(false)
    expect(W.vm.over('th:ash')).toBe(true)
    await drain()
    expect(faces().map(x => x.attributes('data-id'))).toEqual(['th:oak', 'th:ash'])
    W.unmount()
  })

  it('motion: lays down from just above in 280 ms, lifts away in 220 ms', async () => {
    await at()
    await treeBack()
    W.vm.over('th:oak')
    await nextTick()
    const lay = anims.find(a => a.o && a.o.duration === 280)
    expect(lay.el).toBe(faces()[1].element)
    expect(lay.kf[0]).toEqual({ transform: 'translate(0px,-18px) scale(1.03)', opacity: 0, offset: 0 })
    expect(lay.kf[2]).toEqual({ transform: 'translate(0px,0px) scale(1)', opacity: 1 })
    expect(faces()[0].classes()).not.toContain('is-under') // the tree is hidden once the species lands
    await drain()
    expect(faces()[0].classes()).toContain('is-under')
    W.vm.pop()
    await nextTick()
    const lift = anims.find(a => a.o && a.o.duration === 220)
    expect(lift.el).toBe(faces()[1].element)
    expect(lift.o.fill).toBe('forwards')
    expect(lift.kf[2]).toEqual({ transform: 'translate(0px,-18px) scale(1.03)', opacity: 0 })
    expect(faces()[0].classes()).not.toContain('is-under') // the tree shows under the species as it lifts
    await drain()
    expect(faces().length).toBe(1)
    W.unmount()
  })

  it('reduced motion: no movement, the faces change at once and the card fades in', async () => {
    RM = true // read once, when the table mounts
    await at()
    await treeBack()
    anims.length = 0
    W.vm.over('th:oak')
    await nextTick()
    expect(faces().map(x => x.classes().includes('is-under'))).toEqual([true, false])
    expect(anims.every(a => !JSON.stringify(a.kf).includes('transform'))).toBe(true)
    expect(anims.some(a => a.el === W.find('.tt-st-card').element && a.o.duration === 180)).toBe(true)
    await drain()
    W.vm.pop()
    await nextTick()
    expect(faces().length).toBe(1)
    expect(anims.every(a => !JSON.stringify(a.kf).includes('transform'))).toBe(true)
    await drain()
    expect(W.find('.tt-st-back').exists()).toBe(false)
    W.unmount()
  })

  it('the set closing closes the whole stage, the card over it included; the next open card has one face', async () => {
    await at()
    await treeBack()
    W.vm.over('th:oak')
    await drain()
    expect(W.vm.closeNest()).toBe(true)
    await drain()
    expect(W.find('.tt-stage').classes()).not.toContain('is-on')
    expect(faces().length).toBe(0)
    expect(W.vm.T.openId).toBe(null)
    await treeBack('tree:oak-c')
    expect(faces().length).toBe(1)
    expect(W.find('.tt-st-back').exists()).toBe(false)
    expect(W.find('.tt-st-pos').text()).toBe('4 / 4')
    W.unmount()
  })

  it('the focus trap skips the hidden card\'s controls', async () => {
    const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', { configurable: true, get() { return this.parentNode } })
    try {
      await at()
      await treeBack()
      W.vm.over('th:oak')
      await drain()
      const seen = []
      for (let i = 0; i < 8; i++) { key('Tab'); seen.push(document.activeElement) }
      expect(seen.some(el => el.closest('[inert]'))).toBe(false)
      expect(seen).toContain(W.find('.tt-st-back').element)
      expect(seen).toContain(W.find('.tt-st-card').element)
      W.unmount()
    } finally {
      if (d) Object.defineProperty(HTMLElement.prototype, 'offsetParent', d)
    }
  })

  it('never called, the open card\'s stage is as before: mark, set, position, flip; no class or attribute added', async () => {
    await at()
    await treeBack()
    expect(W.findAll('.tt-st-head > *').map(x => x.classes()[0])).toEqual(['tt-mk', 'tt-st-set', 'tt-st-pos', 'tt-st-flip'])
    expect(W.find('.tt-st-act').attributes('class')).toBe('tt-st-act')
    const f = faces()[0]
    expect(f.attributes('inert')).toBeUndefined()
    expect(f.classes()).not.toContain('is-under')
    expect(W.find('.tt-st-card').html()).not.toContain('is-under')
    W.unmount()
  })
})
