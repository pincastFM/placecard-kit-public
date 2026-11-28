// @vitest-environment jsdom
/**
 * TtPath 1.9.0, each change only under a 1.8.0 prop (path180gold.test.js still holds the unset markup to 1.7.0's):
 * Add stop as the stops list's last row (stopsEditable), a via's own leg (a pass with leg), and the clocks line (a
 * time rule picked, the record's clock).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { TtPath, setTtHost, ttLock } from '../../vue/index.js'

const START = { lat: 40.7359, lon: -73.9911 }
const stop = (n, card, m, min) => ({ n, kind: 'card', card, place: { id: `t${n}`, lat: 40.73 + n / 1000, lon: -73.99 }, leg: { m, min }, arriveMin: 0, dwellMin: 1, status: 'planned', label: null, meal: null, fromHand: true, alts: [] })
const plan = (o = {}) => ({
  id: 'p1', app: 'treehopper', set: 'treecount', madeBy: null, madeAt: '2026-10-29T00:00:00Z', planVersion: 2, solver: 'path', clock: null,
  start: START, end: { kind: 'start', at: START, name: null }, mode: 'walk', minutes: 30, order: 'planned',
  stops: [stop(1, 'red-maple', 180, 2.4), stop(2, 'pin-oak', 190, 2.4), stop(3, 'ginkgo', 170, 2.4)],
  finish: { leg: { m: 200, min: 2.6 }, arriveMin: 13.8 },
  totals: { stops: 3, m: 740, walkMin: 9.8, totalMin: 12.8, timing: 'route', leftOver: 0 },
  leftOver: [], ext: {},
  ...o,
})
const empty = (o = {}) => plan({ stops: [], finish: null, end: { kind: 'open', at: null, name: null }, totals: { stops: 0, m: 0, walkMin: 0, totalMin: 0, timing: 'route', leftOver: 4 }, leftOver: [], ...o })
const NAMES = { 'red-maple': ['Red Maple', 'Common'], 'pin-oak': ['Pin Oak', 'Widespread'], ginkgo: ['Ginkgo', 'Numerous'], yew: ['English Yew', 'Rare'] }
const cardFor = s => (NAMES[s.card] ? { title: NAMES[s.card][0], rarity: NAMES[s.card][1] } : null)
const PILE = { label: 'Missing', n: 5, kind: 'pile' }
const HAND = { label: 'Hand', n: 4, kind: 'hand' }

const at = async (props = {}, slots) => {
  const w = mount(TtPath, { props: { open: true, plan: plan(), from: PILE, minutes: 30, cardFor, reduced: true, ...props }, slots, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const labs = w => w.findAll('.tt-path-row > .tt-path-lab').map(x => x.text())
const lis = w => w.findAll('.tt-path-stops > li')
const minOf = t => { const m = /(\d+) min/.exec(t); return m ? +m[1] : 0 }

afterEach(() => {
  setTtHost({ distUnit: null })
  ttLock(false)
  document.body.innerHTML = ''
})

describe('Add stop, the stops list\'s last row', () => {
  it('off by default; with stopsEditable there is no Stops controls row and the add row closes the list', async () => {
    expect((await at()).find('.tt-path-add').exists()).toBe(false)
    const w = await at({ stopsEditable: true })
    expect(labs(w)).toEqual(['From', 'Time', 'End'])
    const rows = lis(w)
    expect(rows).toHaveLength(5) // three cards, Back here, the add row
    expect(rows[3].classes()).toContain('tt-path-fin')
    const add = rows[4]
    expect(add.classes()).toContain('tt-path-add')
    expect(add.find('.tt-path-n').classes()).toContain('is-add')
    expect(add.find('.tt-path-n').text()).toBe('+')
    expect(add.find('.tt-path-n').attributes('aria-hidden')).toBe('true')
    expect(add.find('button.tt-path-nm').text()).toBe('Add stop')
    expect(add.find('button.tt-path-nm').attributes('aria-expanded')).toBe('false')
  })

  it('sits above Didn\'t fit', async () => {
    const w = await at({ stopsEditable: true, from: HAND, plan: plan({ leftOver: [{ key: 'yew', kind: 'card', reason: 'no time left' }] }) })
    const p = Array.from(w.find('.tt-path-p').element.children)
    const list = p.findIndex(e => e.classList.contains('tt-path-stops'))
    const df = p.findIndex(e => e.classList.contains('tt-path-df'))
    expect(list).toBeGreaterThan(-1)
    expect(df).toBe(list + 1)
    expect(w.find('.tt-path-stops > li:last-child').classes()).toContain('tt-path-add')
  })

  it('the button opens the add slot in its place with close; close puts the button back', async () => {
    let close = null
    const w = await at({ stopsEditable: true }, { add: (p) => { close = p.close; return h('i', { class: 'x-add' }, 'find a place') } })
    expect(w.find('.x-add').exists()).toBe(false)
    await w.find('.tt-path-add button.tt-path-nm').trigger('click')
    const add = w.find('.tt-path-add')
    expect(add.classes()).toContain('is-on')
    expect(add.find('.x-add').exists()).toBe(true)
    expect(add.find('button.tt-path-nm').exists()).toBe(false)
    expect(add.find('.tt-path-n').text()).toBe('+')
    expect(w.emitted('add-open')).toHaveLength(1)
    close()
    await nextTick()
    expect(w.find('.x-add').exists()).toBe(false)
    expect(w.find('.tt-path-add').classes()).not.toContain('is-on')
    expect(w.find('.tt-path-add button.tt-path-nm').exists()).toBe(true)
    expect(w.emitted('add-close')).toHaveLength(1)
  })

  it('Escape closes an open search first, then the panel', async () => {
    const w = await at({ stopsEditable: true }, { add: '<i class="x-add">find</i>' })
    await w.find('.tt-path-add button.tt-path-nm').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.find('.x-add').exists()).toBe(false)
    expect(w.emitted('add-close')).toHaveLength(1)
    expect(w.emitted('close')).toBeUndefined()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('shows alone when the plan has no stops, and with no plan yet', async () => {
    for (const p of [empty(), null]) {
      const w = await at({ stopsEditable: true, plan: p })
      const rows = lis(w)
      expect(rows).toHaveLength(1)
      expect(rows[0].classes()).toContain('tt-path-add')
      w.unmount()
    }
    // without stopsEditable an empty plan has no list, as before
    expect((await at({ plan: empty() })).find('.tt-path-stops').exists()).toBe(false)
  })

  it('a host\'s labels.stops is no longer read; addStop names the row', async () => {
    const w = await at({ stopsEditable: true, labels: { stops: 'Stops', addStop: 'Add a stop' } })
    expect(labs(w)).toEqual(['From', 'Time', 'End'])
    expect(w.find('.tt-path-add button').text()).toBe('Add a stop')
  })
})

describe('a via\'s own leg', () => {
  // A loop: via 1 straight from the start, via 2 after the first card; the cards' legs run on from the point before
  const VIAS = [
    { n: 1, at: { lat: 40.731, lon: -73.995 }, label: 'Coffee', arriveMin: 1.2, after: 0, leg: { m: 90, min: 1.2 } },
    { n: 2, at: { lat: 40.733, lon: -73.993 }, label: 'Corner', arriveMin: 6, after: 1, leg: { m: 100, min: 1.3 } },
  ]
  const P = () => plan({
    stops: [stop(1, 'red-maple', 90, 1.2), stop(2, 'pin-oak', 90, 1.1), stop(3, 'ginkgo', 170, 2.4)],
    totals: { stops: 3, m: 740, walkMin: 9.8, totalMin: 12.8, timing: 'route', leftOver: 0 },
  })

  it('shows like a card\'s, between the name and the ×, and the list adds up to the summary', async () => {
    const w = await at({ plan: P(), vias: VIAS, stopsEditable: true })
    const rows = lis(w).filter(li => !li.classes().includes('tt-path-add'))
    expect(rows.map(r => r.find('.tt-path-nm').text())).toEqual(['Coffee', 'Red Maple', 'Corner', 'Pin Oak', 'Ginkgo', 'Back here'])
    const via1 = rows[0]
    const kids = Array.from(via1.element.children).map(e => e.className)
    expect(kids).toEqual(['tt-path-n', 'tt-path-nm', 'tt-path-leg', 'tt-path-x', 'tt-path-drag'])
    expect(via1.find('.tt-path-leg').text()).toBe('300 ft · 1 min')
    expect(rows[2].find('.tt-path-leg').text()).toBe('330 ft · 2 min') // 3.7 on the running total rounds to 4
    const legs = rows.map(r => minOf(r.find('.tt-path-leg').text()))
    expect(legs.reduce((a, b) => a + b, 0)).toBe(minOf(w.find('.tt-path-sum b').text()))
    expect(minOf(w.find('.tt-path-sum b').text())).toBe(10) // 1.2 + 1.2 + 1.3 + 1.1 + 2.4 + 2.6 = 9.8, on the running total
  })

  it('a 1.8.0 pass (no leg) shows none, and the cards\' legs still round as before', async () => {
    const old = VIAS.map(({ leg, ...v }) => v)
    const w = await at({ plan: plan(), vias: old })
    const rows = lis(w)
    expect(rows[0].find('.tt-path-leg').text()).toBe('')
    const cards = rows.filter(r => !r.classes().includes('is-via')).map(r => r.find('.tt-path-leg').text())
    const plain = lis(await at({ plan: plan() })).map(r => r.find('.tt-path-leg').text())
    expect(cards).toEqual(plain)
  })

  it('in transit the via row keeps its trip', async () => {
    const trips = [{ legs: [{ ride: true, min: 5, route: { shortName: '5', color: '#cc0000', textColor: '#ffffff' } }, { ride: false, min: 2 }] }]
    const w = await at({ plan: P(), vias: VIAS, trips })
    const via1 = lis(w)[0]
    expect(via1.find('.tt-path-leg').classes()).toContain('is-transit')
    expect(via1.find('.tt-path-badge').text()).toBe('5')
  })
})

describe('the clocks line', () => {
  const CLOCK = { tz: 'America/New_York', date: '2026-11-28', startAt: 540 }
  const line = w => w.findAll('.tt-path-sum .tt-path-clocks').map(x => x.text())

  it('with a time rule picked and the record\'s clock: Leave and Arrive, the start plus the outing (rounded up)', async () => {
    const w = await at({ plan: plan({ clock: CLOCK }), whenOptions: ['now', 'at', 'by'], when: { kind: 'at', time: '09:00' } })
    expect(line(w)).toEqual(['Leave 9:00 AM · Arrive 9:13 AM']) // totalMin 12.8
    expect(w.find('.tt-path-sum b').text()).toBe('10 min') // the serif number stays the moving minutes
    const by = await at({ plan: plan({ clock: { ...CLOCK, startAt: 1247 } }), whenOptions: ['now', 'at', 'by'], when: { kind: 'by', time: '21:00' } })
    expect(line(by)).toEqual(['Leave 8:47 PM · Arrive 9:00 PM'])
  })

  it('none with Now, with no clock, with no stops, or with a whenError (the unmet line instead)', async () => {
    expect(line(await at({ plan: plan({ clock: CLOCK }), whenOptions: ['now', 'at', 'by'], when: { kind: 'now', time: null } }))).toEqual([])
    expect(line(await at({ plan: plan({ clock: CLOCK }) }))).toEqual([]) // no when given: Now
    expect(line(await at({ plan: plan(), when: { kind: 'at', time: '09:00' } }))).toEqual([])
    expect(line(await at({ plan: empty({ clock: CLOCK }), when: { kind: 'at', time: '09:00' } }))).toEqual([])
    const w = await at({ plan: plan({ clock: CLOCK }), when: { kind: 'by', time: '09:00' }, whenError: { code: 'unmet', earliestArrival: { at: 1310 } } })
    expect(line(w)).toEqual([])
    expect(w.find('.tt-path-unmet').text()).toBe('Leave now · Arrive 9:50 PM')
  })

  it('follows the app\'s words and clock, and wraps past midnight', async () => {
    const w = await at({ plan: plan({ clock: { ...CLOCK, startAt: 1435 } }), when: { kind: 'at', time: '23:55' }, labels: { leaveArrive: '{a} to {b}' }, clockFmt: m => `${Math.floor(m / 60) % 24}h${String(m % 60).padStart(2, '0')}` })
    expect(line(w)).toEqual(['23h55 to 0h08'])
    const z = await at({ plan: plan({ clock: { ...CLOCK, startAt: 1435 } }), when: { kind: 'at', time: '23:55' } })
    expect(line(z)).toEqual(['Leave 11:55 PM · Arrive 12:08 AM'])
  })
})
