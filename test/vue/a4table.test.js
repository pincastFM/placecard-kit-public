// @vitest-environment jsdom
/**
 * TtTable's half of four additions for Treehopper's Binder (2026-10-29): a set's points, the counter and
 * the table's words, the status slot, and deal(). Each one renders nothing when unused: the points are
 * text (an unset one leaves no node), the counter and the words are text in the nodes that were there,
 * and the status slot is empty. Provo's byte-for-byte check is NYID's own HTML goldens, run on the
 * packed kit.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { TtTable, setTtHost } from '../../vue/index.js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

let reduce = false
window.matchMedia = q => ({ matches: reduce && /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}

const anims = []
beforeEach(() => {
  reduce = false
  anims.length = 0
  Element.prototype.animate = function (kf, o) {
    const a = { el: this, kf, o, onfinish: null, oncancel: null, cancel() {}, finish: vi.fn() }
    anims.push(a)
    return a
  }
  setTtHost({ head: vi.fn(), distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => { setTtHost({ head: null, distUnit: null }) })

const card = (id, o = {}) => ({ id: `th:${id}`, app: 'treehopper', set: 'species', face: 'treehopper', title: id, subtitle: '', type: 'Species', fact: '', back: '', stats: [], number: null, of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1, ...o })
const DATA = (setO = {}) => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [
    { id: 'overstory', app: 'treehopper', name: 'Overstory', short: 'OVERSTORY', total: 3, kind: 'species', ...setO },
    { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' },
  ],
  rarities: { species: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'] },
  cards: [
    card('oak', { sets: ['overstory'], number: 3 }),
    card('ash', { number: 1 }),
    card('elm', { number: 2 }),
    card('yew', { held: false, collected: null, added: null }),
  ],
})
const at = async (props, slots) => {
  const w = mount(TtTable, { props: { options: { key: 'tt_a4_test' }, ...props }, slots, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const figOf = (w, set) => w.find(`.tt-bx[data-g="set:${set}"] .tt-bx-fig`)

describe('gap 3: a set\'s points in its head', () => {
  it('"· 120 pts" after the count when the set has points; without them the fig is as before', async () => {
    const w = await at({ collection: DATA({ pts: 120 }) })
    expect(figOf(w, 'overstory').text()).toBe('1 of 3 · 120 pts')
    expect(figOf(w, 'species').text()).toBe('3 of 612')
    expect(figOf(w, 'species').html()).not.toContain('pts')
    w.unmount()
  })

  it('a card in two sets has a cell in each', async () => {
    const w = await at({ collection: DATA() })
    expect(w.findAll('.tt-cell[data-id="th:oak"]')).toHaveLength(2)
    expect(w.find('.tt-grp[data-sec="set:overstory"] .tt-cell[data-id="th:oak"]').exists()).toBe(true)
    expect(w.find('.tt-grp[data-sec="set:species"] .tt-cell[data-id="th:oak"]').exists()).toBe(true)
    w.unmount()
  })
})

describe('gap 4: the counter and the table\'s words', () => {
  it('without them: the held count, Cards, Wanted, WANTED', async () => {
    const w = await at({ collection: DATA() })
    expect(w.find('.tt-cnt > b').text()).toBe('3')
    expect(w.find('.tt-cnt > .tt-cl').text()).toBe('Cards')
    w.vm.T.filter.missing = true
    await nextTick()
    expect(w.find('.tt-cm').text()).toBe('+1 Wanted')
    expect(w.find('.tt-want').text()).toBe('WANTED')
    w.unmount()
  })

  it('counter { n, of } prints "n of N"; labels say Missing', async () => {
    const w = await at({ collection: DATA(), counter: { n: 403, of: 612 }, labels: { wanted: 'Missing', want: 'MISSING' } })
    expect(w.find('.tt-cnt > b').text()).toBe('403')
    expect(w.find('.tt-cnt > .tt-cl').text()).toBe('of 612')
    w.vm.T.filter.missing = true
    await nextTick()
    expect(w.find('.tt-cm').text()).toBe('+1 Missing')
    expect(w.find('.tt-want').text()).toBe('MISSING')
    w.unmount()
  })
})

describe('H215: Missing shows the gaps alone', () => {
  it('the chip turns on Missing alone: the gaps only, the head keeps the held count, no "+N", no SHOWN', async () => {
    const w = await at({ collection: DATA() })
    await w.find('.tt-chip[data-k="missing"]').trigger('click')
    await flushPromises()
    await nextTick()
    expect(w.vm.T.filter.missing).toBe('only')
    expect(w.find('.tt-cnt > b').text()).toBe('3')
    expect(w.find('.tt-cm').exists()).toBe(false)
    expect([...new Set(w.findAll('.tt-cell').map(c => c.attributes('data-id')))]).toEqual(['th:yew'])
    expect(w.find('.tt-bx-shown').exists()).toBe(false)
    expect(figOf(w, 'species').text()).toBe('3 of 612')
    expect(w.vm.T.countLabel).toBe('3 cards · 1 missing')
    await w.find('.tt-chip[data-k="missing"]').trigger('click')
    await flushPromises()
    await nextTick()
    expect(w.vm.T.filter.missing).toBe(false)
    expect(w.findAll('.tt-cell[data-id="th:yew"]')).toHaveLength(0)
    w.unmount()
  })

  it('with a counter the head stays "n of N" under Missing alone', async () => {
    const w = await at({ collection: DATA(), counter: { n: 404, of: 612 } })
    await w.find('.tt-chip[data-k="missing"]').trigger('click')
    await flushPromises()
    await nextTick()
    expect(w.find('.tt-cnt > b').text()).toBe('404')
    expect(w.find('.tt-cnt > .tt-cl').text()).toBe('of 612')
    expect(w.find('.tt-cm').exists()).toBe(false)
    w.unmount()
  })
})

describe('gap 15: the status slot', () => {
  it('sits in the strip after the rail, and is empty unless filled', async () => {
    const w = await at({ collection: DATA() }, { status: () => h('div', { class: 'th-next' }, 'Next') })
    const kids = Array.from(w.find('.tt-strip').element.children).map(el => el.className)
    expect(kids.indexOf('th-next')).toBe(kids.indexOf('tt-strip-rail') + 1)
    w.unmount()
    const bare = await at({ collection: DATA() })
    expect(bare.find('.tt-strip').element.lastElementChild.className).toBe('tt-strip-rail')
    bare.unmount()
  })
})

describe('gap 7: deal()', () => {
  const onScreen = () => vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 10, right: 80, bottom: 120, width: 80, height: 110, x: 0, y: 10 })

  it('slides the held cells on screen in from the right, in number order; a tap settles it', async () => {
    const spy = onScreen()
    const w = await at({ collection: DATA() })
    anims.length = 0
    const plan = w.vm.deal()
    expect(plan.map(s => s.id)).toEqual(['th:ash', 'th:elm', 'th:oak', 'th:oak'])
    expect(plan[0]).toMatchObject({ delay: 0, duration: 260 })
    expect(plan[plan.length - 1].delay).toBe(740)
    const deals = anims.filter(a => a.kf[0].transform === 'translateX(140%)')
    expect(deals).toHaveLength(4)
    expect(deals[0].o).toMatchObject({ fill: 'backwards', duration: 260 })
    document.dispatchEvent(new Event('pointerdown'))
    for (const a of deals) expect(a.finish).toHaveBeenCalled()
    w.unmount()
    spy.mockRestore()
  })

  it('deals none with reduced motion, or with no cell on screen', async () => {
    const w = await at({ collection: DATA() })
    expect(w.vm.deal()).toEqual([])
    w.unmount()
    reduce = true
    const spy = onScreen()
    const r = await at({ collection: DATA() })
    expect(r.vm.deal()).toEqual([])
    r.unmount()
    spy.mockRestore()
  })
})

describe('gaps 1, 12, 13: tokens a theme can set, each with today\'s value', () => {
  const css = readFileSync(resolve(__dirname, '../../css/cardroom.css'), 'utf8')
  it('the raw colors and the ledger name size sit behind tokens whose fallback is the value they had', () => {
    for (const t of [
      'var(--tt-ground, #0E1420)', 'var(--tt-scheme, dark)', 'var(--search-edge, #2A3344)',
      'var(--thumb-shadow, 0 1px 0 rgba(0,0,0,.6), 0 4px 10px rgba(0,0,0,.45))',
      'var(--want-bg, #BEC6D3)', 'var(--want-ink, #0E1420)',
      'var(--pile-1, rgba(14,20,32,.2))', 'var(--pile-2, rgba(14,20,32,.4))', 'var(--pile-3, rgba(14,20,32,.6))',
      'font:700 var(--lg-name, 13px)/1 var(--font-display)',
    ]) expect(css, t).toContain(t)
    expect(css).not.toMatch(/background:#0E1420|#2A3344,|background:#BEC6D3/)
  })

  it('dock wrap only when asked', async () => {
    const w = await at({ collection: DATA() })
    expect(w.find('.tt').classes()).not.toContain('is-dock-wrap')
    w.unmount()
    const d = await at({ collection: DATA(), dockWrap: true })
    expect(d.find('.tt').classes()).toContain('is-dock-wrap')
    d.unmount()
  })
})
