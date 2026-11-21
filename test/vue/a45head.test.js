// @vitest-environment jsdom
/**
 * Two more additions for Treehopper's collection (2026-10-29), each rendering nothing when unused.
 * The head slot draws after the count in the top bar (Treehopper's Join), on an empty table too; the
 * +N stub's fit measures against its first shown control. emptyStatus keeps the strip on an empty
 * table for the status slot alone (Treehopper's Next line for a new guest). Provo's byte-for-byte
 * check is NYID's goldens, run on the packed kit.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { TtTable, setTtHost } from '../../vue/index.js'

window.matchMedia = q => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}

const anims = []
const realRect = Element.prototype.getBoundingClientRect
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
afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect
  setTtHost({ head: null, distUnit: null })
  document.body.innerHTML = ''
})

const card = (id, o = {}) => ({ id, app: 'treehopper', set: 'treecount', kind: 'tree', face: 'treehopper', title: id, subtitle: 'Quercus', type: 'Species', fact: '', back: 'A story.', stats: [], number: 1, of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1, ...o })
const missing = id => card(id, { held: false, number: null, collected: null, added: null })
const DATA = (cards) => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [{ id: 'treecount', app: 'treehopper', name: 'Treecount', short: 'TREECOUNT', total: 612, kind: 'tree' }],
  rarities: { tree: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'] },
  cards: cards || [card('oak'), card('ash', { number: 2, added: 2 }), missing('yew')],
})
const EMPTY = () => DATA([missing('oak'), missing('ash'), missing('yew')])
const at = async (props = {}, slots) => {
  const { options = {}, collection = DATA(), ...rest } = props
  const w = mount(TtTable, { props: { collection, ...rest, options: { key: 'tt_a45h_test', ...options } }, slots, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const settle = async () => { anims.splice(0).forEach(a => a.onfinish && a.onfinish()); await flushPromises(); await nextTick() }
const join = () => h('a', { class: 'th-join', href: '/sign-in' }, 'Join')

describe('the head slot', () => {
  it('renders nothing unused: the count is followed by the laptop search row, as before', async () => {
    const w = await at()
    const cnt = w.find('.tt-top-in .tt-cnt').element
    expect(cnt.nextElementSibling.classList.contains('tt-top-sl')).toBe(true)
    expect(w.find('.tt-top-in').findAll('a').length).toBe(1) // Back only
  })

  it('draws after the count and before the search row and Stack, with the table', async () => {
    let seen = null
    const w = await at({}, { head: ({ t }) => { seen = t; return join() } })
    const cnt = w.find('.tt-top-in .tt-cnt').element
    expect(cnt.nextElementSibling.classList.contains('th-join')).toBe(true)
    expect(cnt.nextElementSibling.nextElementSibling.classList.contains('tt-top-sl')).toBe(true)
    expect(seen && typeof seen.openId !== 'undefined').toBe(true)
  })

  it('shows on an empty table, where the strip, dock and Stack are hidden', async () => {
    const w = await at({ collection: EMPTY() }, { head: join })
    expect(w.classes()).toContain('is-empty')
    expect(w.find('.tt-empty').exists()).toBe(true)
    expect(w.find('.tt-top-in .th-join').exists()).toBe(true)
  })

  it('the +N stub gives way (the Cards word hides) when it would run under the head control', async () => {
    const rects = { 'tt-cm': { left: 220, right: 300, width: 80 }, 'th-join': { left: 280, right: 330, width: 50 }, 'tt-stk': { left: 345, right: 390, width: 45 } }
    Element.prototype.getBoundingClientRect = function () {
      const k = Object.keys(rects).find(c => this.classList?.contains(c))
      const r = k ? rects[k] : { left: 0, right: 0, width: 0 }
      return { top: 0, bottom: 0, height: 0, x: r.left, y: 0, ...r }
    }
    const w = await at({}, { head: join })
    w.vm.T.filter.missing = true // a host's Missing after the held, "+N" (the chip shows the gaps alone)
    await settle()
    expect(w.find('.tt-cm').exists()).toBe(true)
    expect(w.find('.tt-top-in').classes()).toContain('is-tight')
  })

  it('with no head control the stub measures against Stack, as before', async () => {
    const rects = { 'tt-cm': { left: 220, right: 300, width: 80 }, 'tt-stk': { left: 345, right: 390, width: 45 } }
    Element.prototype.getBoundingClientRect = function () {
      const k = Object.keys(rects).find(c => this.classList?.contains(c))
      const r = k ? rects[k] : { left: 0, right: 0, width: 0 }
      return { top: 0, bottom: 0, height: 0, x: r.left, y: 0, ...r }
    }
    const w = await at()
    w.vm.T.filter.missing = true // a host's Missing after the held, "+N" (the chip shows the gaps alone)
    await settle()
    expect(w.find('.tt-cm').exists()).toBe(true)
    expect(w.find('.tt-top-in').classes()).not.toContain('is-tight')
    rects['tt-stk'].left = 305
    window.dispatchEvent(new Event('resize'))
    await new Promise(r => setTimeout(r, 150))
    await nextTick()
    await nextTick()
    expect(w.find('.tt-top-in').classes()).toContain('is-tight')
  })

  it('in two rows (topRows 2) Stack on the other row does not tighten the stub; a control on its own row still does (U4)', async () => {
    // row 1 (top 0 to 40): Back and Stack; row 2 (top 46 to 86): the count and its +N stub, then the head's controls
    const rects = { 'tt-cm': { left: 220, right: 330, width: 110, top: 46, bottom: 86, height: 40 }, 'tt-stk': { left: 300, right: 345, width: 45, top: 0, bottom: 40, height: 40 } }
    Element.prototype.getBoundingClientRect = function () {
      const k = Object.keys(rects).find(c => this.classList?.contains(c))
      const r = k ? rects[k] : { left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0 }
      return { x: r.left, y: r.top, ...r }
    }
    const w = await at({ topRows: 2 })
    w.vm.T.filter.missing = true
    await settle()
    expect(w.find('.tt-cm').exists()).toBe(true)
    expect(w.find('.tt-top-in').classes()).not.toContain('is-tight')
    w.unmount()
    // one row, the same rects: measured against Stack as at 1.1.0
    const one = await at()
    one.vm.T.filter.missing = true
    await settle()
    expect(one.find('.tt-top-in').classes()).toContain('is-tight')
    one.unmount()
    // two rows, a head control on the count's row that the stub would run under
    rects['th-join'] = { left: 300, right: 340, width: 40, top: 46, bottom: 86, height: 40 }
    const two = await at({ topRows: 2 }, { head: join })
    two.vm.T.filter.missing = true
    await settle()
    expect(two.find('.tt-top-in').classes()).toContain('is-tight')
    two.unmount()
  })
})

describe('emptyStatus', () => {
  const status = () => h('div', { class: 'th-status' }, 'Next')

  it('marks an empty table so the strip stays for the status slot', async () => {
    const w = await at({ collection: EMPTY(), emptyStatus: true }, { status })
    expect(w.classes()).toEqual(expect.arrayContaining(['is-empty', 'is-empty-status']))
    expect(w.find('.tt-strip .th-status').exists()).toBe(true)
  })

  it('renders nothing unset, and nothing on a table with cards', async () => {
    const off = await at({ collection: EMPTY() }, { status })
    expect(off.classes()).toContain('is-empty')
    expect(off.classes()).not.toContain('is-empty-status')
    off.unmount()
    const full = await at({ emptyStatus: true }, { status })
    expect(full.classes()).not.toContain('is-empty')
    expect(full.classes()).not.toContain('is-empty-status')
  })
})
