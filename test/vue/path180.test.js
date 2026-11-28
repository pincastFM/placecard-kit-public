// @vitest-environment jsdom
/**
 * TtPath 1.8.0: the planner's route controls, each off until its prop is given (path180gold.test.js holds the
 * unset markup to 1.7.0's). Checked here: By (modeOptions, mode, the summary's word), When (whenOptions, when, the
 * picked chip's time and its native input, the next quarter hour, clockFmt, tz), the unmet line (whenError), the
 * player's own stops (vias: one list, one numbering, the open end's last via, remove, the handle's pointer drag and
 * arrow keys, the map's rows, Add stop and its slot) and transit legs (trips: badges, colors, the rides' and the
 * walk's minutes).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
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
const NAMES = { 'red-maple': ['Red Maple', 'Common'], 'pin-oak': ['Pin Oak', 'Widespread'], ginkgo: ['Ginkgo', 'Numerous'] }
const cardFor = s => (NAMES[s.card] ? { title: NAMES[s.card][0], rarity: NAMES[s.card][1] } : null)
const PILE = { label: 'Missing', n: 5, kind: 'pile' }

const at = async (props = {}, slots) => {
  const w = mount(TtPath, { props: { open: true, plan: plan(), from: PILE, minutes: 30, cardFor, reduced: true, ...props }, slots, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const labs = w => w.findAll('.tt-path-row > .tt-path-lab').map(x => x.text())
const rowOf = (w, lab) => w.findAll('.tt-path-row').find(r => r.find('.tt-path-lab').text() === lab)
const chipText = (w, lab) => rowOf(w, lab).findAll('.tt-chip').map(c => c.text())

afterEach(() => {
  vi.useRealTimers()
  setTtHost({ distUnit: null })
  ttLock(false)
  document.body.innerHTML = ''
})

describe('By: the mode row', () => {
  it('off by default; with modeOptions it sits under From, above Time', async () => {
    expect(labs(await at())).toEqual(['From', 'Time', 'End'])
    const w = await at({ modeOptions: ['walk', 'run', 'bike', 'transit'] })
    expect(labs(w)).toEqual(['From', 'By', 'Time', 'End'])
    expect(chipText(w, 'By')).toEqual(['Walk', 'Run', 'Bike', 'Transit'])
    expect(rowOf(w, 'By').find('.tt-path-chips').attributes('aria-label')).toBe('By')
  })

  it('walk is on by default; a pick emits mode, the one on emits nothing', async () => {
    const w = await at({ modeOptions: ['walk', 'run', 'bike', 'transit'] })
    const chips = rowOf(w, 'By').findAll('.tt-chip')
    expect(chips.map(c => c.attributes('aria-pressed'))).toEqual(['true', 'false', 'false', 'false'])
    expect(chips[0].classes()).toContain('is-on')
    await chips[0].trigger('click')
    await chips[3].trigger('click')
    expect(w.emitted('mode')).toEqual([['transit']])
  })

  it('the summary\'s word follows the mode once modes are offered', async () => {
    const word = async p => (await at(p)).findAll('.tt-path-sum span')[0].text()
    expect(await word({ mode: 'run' })).toBe('walking')
    const MODES = ['walk', 'run', 'bike', 'transit']
    expect(await word({ modeOptions: MODES, mode: 'walk' })).toBe('walking')
    expect(await word({ modeOptions: MODES, mode: 'run' })).toBe('running')
    expect(await word({ modeOptions: MODES, mode: 'bike' })).toBe('biking')
    expect(await word({ modeOptions: MODES, mode: 'transit' })).toBe('by transit')
    expect(await word({ modeOptions: MODES, mode: 'bike', labels: { biking: 'cycling', bike: 'Cycle' } })).toBe('cycling')
  })
})

describe('When: the time rule row', () => {
  const WHEN = ['now', 'at', 'by']
  it('off by default; with whenOptions it sits after Time, before End; Now on by default', async () => {
    const w = await at({ whenOptions: WHEN, modeOptions: ['walk'] })
    expect(labs(w)).toEqual(['From', 'By', 'Time', 'When', 'End'])
    expect(chipText(w, 'When')).toEqual(['Now', 'Leave at', 'Arrive by'])
    expect(rowOf(w, 'When').findAll('.tt-chip')[0].classes()).toContain('is-on')
    expect(w.find('input.tt-path-time').exists()).toBe(false)
  })

  it('the picked Leave at chip holds its time on a 12-hour clock and wraps the native input; no input beside it', async () => {
    const w = await at({ whenOptions: WHEN, when: { kind: 'at', time: '15:15' } })
    const row = rowOf(w, 'When')
    const chips = row.findAll('.tt-chip')
    expect(chips.map(c => c.text())).toEqual(['Now', 'Leave 3:15 PM', 'Arrive by'])
    const picked = chips[1]
    expect(picked.element.tagName).toBe('LABEL')
    expect(picked.classes()).toEqual(expect.arrayContaining(['tt-chip', 'tt-path-when', 'is-on']))
    const input = picked.find('input')
    expect(input.attributes('type')).toBe('time')
    expect(input.classes()).toContain('tt-path-time')
    expect(input.element.value).toBe('15:15')
    expect(input.attributes('aria-label')).toBe('Leave at')
    expect(row.findAll('input')).toHaveLength(1)
  })

  it('Arrive by reads its time; noon and midnight read 12', async () => {
    const t = async time => rowOf(await at({ whenOptions: WHEN, when: { kind: 'by', time } }), 'When').findAll('.tt-chip')[2].text()
    expect(await t('15:00')).toBe('Arrive by 3:00 PM')
    expect(await t('12:05')).toBe('Arrive by 12:05 PM')
    expect(await t('00:30')).toBe('Arrive by 12:30 AM')
    expect(await t(null)).toBe('Arrive by')
  })

  it('clockFmt gives the app\'s clock', async () => {
    const w = await at({ whenOptions: WHEN, when: { kind: 'at', time: '15:15' }, clockFmt: m => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` })
    expect(rowOf(w, 'When').findAll('.tt-chip')[1].text()).toBe('Leave 15h15')
  })

  it('a pick emits when: Now with no time, Leave at with the next quarter hour, then opens the picker', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 28, 14, 7))
    const w = await at({ whenOptions: WHEN })
    const showPicker = vi.fn()
    await rowOf(w, 'When').findAll('.tt-chip')[1].trigger('click')
    expect(w.emitted('when')).toEqual([[{ kind: 'at', time: '14:15' }]])
    await w.setProps({ when: { kind: 'at', time: '14:15' } })
    w.find('input.tt-path-time').element.showPicker = showPicker
    await rowOf(w, 'When').findAll('.tt-chip')[0].trigger('click')
    expect(w.emitted('when')[1]).toEqual([{ kind: 'now', time: null }])
    await w.find('input.tt-path-time').trigger('click')
    expect(showPicker).toHaveBeenCalledTimes(1)
  })

  it('on the quarter hour, the next one; past 11:45 PM, midnight; a time already set is kept on a switch', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 28, 14, 15))
    let w = await at({ whenOptions: WHEN })
    await rowOf(w, 'When').findAll('.tt-chip')[2].trigger('click')
    expect(w.emitted('when')[0]).toEqual([{ kind: 'by', time: '14:30' }])
    vi.setSystemTime(new Date(2026, 10, 28, 23, 50))
    w = await at({ whenOptions: WHEN })
    await rowOf(w, 'When').findAll('.tt-chip')[1].trigger('click')
    expect(w.emitted('when')[0]).toEqual([{ kind: 'at', time: '00:00' }])
    w = await at({ whenOptions: WHEN, when: { kind: 'at', time: '9:05' } })
    await rowOf(w, 'When').findAll('.tt-chip')[2].trigger('click')
    expect(w.emitted('when')[0]).toEqual([{ kind: 'by', time: '09:05' }])
  })

  it('the next quarter hour reads the place\'s clock with tz', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 28, 22, 7))) // 2:07 PM in San Francisco
    const w = await at({ whenOptions: WHEN, tz: 'America/Los_Angeles' })
    await rowOf(w, 'When').findAll('.tt-chip')[1].trigger('click')
    expect(w.emitted('when')[0]).toEqual([{ kind: 'at', time: '14:15' }])
  })

  it('a time picked emits when with it; the same time, or an empty one, emits nothing', async () => {
    const w = await at({ whenOptions: WHEN, when: { kind: 'by', time: '15:00' } })
    const input = w.find('input.tt-path-time')
    await input.trigger('change')
    input.element.value = ''
    await input.trigger('change')
    input.element.value = '16:45'
    await input.trigger('change')
    expect(w.emitted('when')).toEqual([[{ kind: 'by', time: '16:45' }]])
  })

  it('the picker opens only where the browser has showPicker, and a refusal is swallowed', async () => {
    const w = await at({ whenOptions: WHEN, when: { kind: 'at', time: '10:00' } })
    const input = w.find('input.tt-path-time')
    await input.trigger('click')
    input.element.showPicker = () => { throw new Error('NotAllowedError') }
    await input.trigger('click')
    expect(w.find('.tt-path').exists()).toBe(true)
  })
})

describe('the unmet line', () => {
  it('an unmet arrive by adds "Leave now, arrive" and the time; null reads Leave now; passed adds nothing', async () => {
    const line = async e => (await at({ whenError: e })).findAll('.tt-path-sum .tt-path-unmet').map(x => x.text())
    expect(await line(null)).toEqual([])
    expect(await line({ code: 'unmet', message: '', earliestArrival: { ms: 0, tz: 'America/New_York', date: '2026-11-28', at: 880 } })).toEqual(['Leave now, arrive 2:40 PM'])
    expect(await line({ code: 'unmet', message: '', earliestArrival: { time: '14:40' } })).toEqual(['Leave now, arrive 2:40 PM'])
    expect(await line({ code: 'unmet', message: '', earliestArrival: null })).toEqual(['Leave now'])
    expect(await line({ code: 'passed', message: '', earliestArrival: null })).toEqual([])
  })

  it('follows the summary\'s words and the app\'s clock', async () => {
    const w = await at({ whenError: { code: 'unmet', earliestArrival: { at: 880 } }, labels: { unmet: 'Go now: {t}' }, clockFmt: () => '14:40' })
    const sum = w.find('.tt-path-sum')
    expect(sum.find('.tt-path-unmet').text()).toBe('Go now: 14:40')
    expect(sum.find('b').text()).toBe('10 min')
  })
})

describe('the player\'s own stops', () => {
  // Three vias with a card between the first two, a closed loop: via 1 before any card, via 2 after one card, via 3
  // after all three
  const VIAS = [
    { n: 1, at: { lat: 40.731, lon: -73.995 }, label: 'Coffee', arriveMin: 2, after: 0 },
    { n: 2, at: { lat: 40.733, lon: -73.993 }, label: null, arriveMin: 6, after: 1 },
    { n: 3, at: { lat: 40.736, lon: -73.990 }, label: 'Park gate', arriveMin: 12, after: 3 },
  ]
  const listRows = w => w.findAll('.tt-path-stops > li').map(li => [li.find('.tt-path-n').text(), li.find('.tt-path-nm').text(), li.classes().includes('is-via')])

  it('one list, one numbering: each via after the cards placed before it; its label or Stop', async () => {
    const w = await at({ vias: VIAS })
    expect(listRows(w)).toEqual([
      ['1', 'Coffee', true], ['2', 'Red Maple', false], ['3', 'Stop', true], ['4', 'Pin Oak', false],
      ['5', 'Ginkgo', false], ['6', 'Park gate', true], ['', 'Back here', false],
    ])
  })

  it('a street via row shows no leg; the cards keep theirs, and the legs still add up to the summary', async () => {
    const w = await at({ vias: VIAS })
    const legs = w.findAll('.tt-path-stops > li').map(li => li.find('.tt-path-leg').text())
    expect(legs).toEqual(['', '0.1 mi · 2 min', '', '0.1 mi · 3 min', '0.1 mi · 2 min', '', '0.1 mi · 3 min'])
    expect(w.find('.tt-path-sum b').text()).toBe('10 min')
  })

  it('a via row has an × and a handle at its end; card rows have neither', async () => {
    const w = await at({ vias: VIAS })
    const lis = w.findAll('.tt-path-stops > li')
    const via = lis[0]
    const kids = Array.from(via.element.children).map(e => e.className)
    expect(kids).toEqual(['tt-path-n', 'tt-path-nm', 'tt-path-leg', 'tt-path-x', 'tt-path-drag'])
    expect(via.find('.tt-path-x').attributes('aria-label')).toBe('Remove Coffee')
    expect(via.find('.tt-path-drag').attributes('aria-label')).toBe('Move Coffee')
    expect(lis[2].find('.tt-path-drag').attributes('aria-label')).toBe('Move Stop')
    expect(lis[1].find('.tt-path-drag').exists()).toBe(false)
    expect(lis[1].find('.tt-path-x').exists()).toBe(false)
    expect(lis[1].find('button.tt-path-nm').exists()).toBe(true)
  })

  it('× emits remove with the via\'s index in the order given', async () => {
    const w = await at({ vias: VIAS })
    await w.findAll('.tt-path-x')[1].trigger('click')
    expect(w.emitted('remove')).toEqual([[1]])
  })

  it('an open end\'s last via is the end: the list\'s last row, with the finish leg, and no finish row', async () => {
    const end = { lat: 40.74, lon: -73.98 }
    const vias = [VIAS[0], { n: 2, at: end, label: 'Union Square', arriveMin: 13.8, after: 3 }]
    const w = await at({ end: 'open', vias, plan: plan({ end: { kind: 'destination', at: end, name: 'Union Square' } }) })
    expect(listRows(w)).toEqual([
      ['1', 'Coffee', true], ['2', 'Red Maple', false], ['3', 'Pin Oak', false], ['4', 'Ginkgo', false], ['5', 'Union Square', true],
    ])
    expect(w.find('.tt-path-fin').exists()).toBe(false)
    expect(w.findAll('.tt-path-stops > li')[4].find('.tt-path-leg').text()).toBe('0.1 mi · 3 min')
    expect(w.findAll('.tt-path-drag')).toHaveLength(2)
  })

  it('a destination of its own keeps its finish row after the last via', async () => {
    const w = await at({ vias: [VIAS[0]], plan: plan({ end: { kind: 'destination', at: { lat: 40.75, lon: -73.97 }, name: 'Pier' } }) })
    expect(listRows(w).map(r => r[1])).toEqual(['Coffee', 'Red Maple', 'Pin Oak', 'Ginkgo', 'Pier'])
    expect(w.find('.tt-path-fin').text()).toContain('Pier')
  })

  it('the map\'s rows follow the list\'s numbering', async () => {
    let rows = null
    await at({ vias: VIAS }, { map: (p) => { rows = p.rows; return h('i') } })
    expect(rows.map(r => [r.n, r.kind])).toEqual([[1, 'via'], [2, 'card'], [3, 'via'], [4, 'card'], [5, 'card'], [6, 'via']])
    expect(rows[0].at).toEqual(VIAS[0].at)
    expect(rows[1].at.id).toBe('t1')
    let none = null
    await at({}, { map: (p) => { none = p.rows; return h('i') } })
    expect(none.map(r => r.kind)).toEqual(['card', 'card', 'card'])
  })

  it('the handle drags by pointer: past the next via\'s middle it moves there; short of it, nothing', async () => {
    const w = await at({ vias: VIAS })
    const lis = w.findAll('.tt-path-stops > li.is-via')
    lis.forEach((li, j) => { li.element.getBoundingClientRect = () => ({ top: 100 * j, height: 40, bottom: 100 * j + 40, left: 0, right: 0, width: 0 }) })
    const handle = w.findAll('.tt-path-drag')[0]
    await handle.trigger('pointerdown', { clientY: 20, button: 0 })
    await handle.trigger('pointermove', { clientY: 110 })
    const dragged = w.findAll('.tt-path-stops > li.is-via')[0]
    expect(dragged.classes()).toContain('is-drag')
    expect(dragged.attributes('style')).toContain('--tt-drag-y: 90px')
    await handle.trigger('pointerup', { clientY: 130 })
    expect(w.emitted('move')).toEqual([[{ from: 0, to: 1 }]])
    expect(w.findAll('.tt-path-stops > li.is-via')[0].classes()).not.toContain('is-drag')
    await handle.trigger('pointerdown', { clientY: 20, button: 0 })
    await handle.trigger('pointerup', { clientY: 60 })
    expect(w.emitted('move')).toHaveLength(1)
    const last = w.findAll('.tt-path-drag')[2]
    await last.trigger('pointerdown', { clientY: 220, button: 0 })
    await last.trigger('pointerup', { clientY: -10 })
    expect(w.emitted('move')[1]).toEqual([{ from: 2, to: 0 }])
  })

  it('a cancelled drag or a second button moves nothing', async () => {
    const w = await at({ vias: VIAS })
    const handle = w.findAll('.tt-path-drag')[0]
    await handle.trigger('pointerdown', { clientY: 20, button: 2 })
    await handle.trigger('pointerup', { clientY: 900 })
    await handle.trigger('pointerdown', { clientY: 20, button: 0 })
    await handle.trigger('pointercancel')
    await handle.trigger('pointerup', { clientY: 900 })
    expect(w.emitted('move')).toBeUndefined()
  })

  it('ArrowUp and ArrowDown on a handle move it one place, never past either end, and it keeps the focus', async () => {
    const w = await at({ vias: VIAS })
    const handles = () => w.findAll('.tt-path-drag')
    await handles()[0].trigger('keydown', { key: 'ArrowUp' })
    await handles()[2].trigger('keydown', { key: 'ArrowDown' })
    await handles()[0].trigger('keydown', { key: 'Enter' })
    expect(w.emitted('move')).toBeUndefined()
    await handles()[0].trigger('keydown', { key: 'ArrowDown' })
    expect(w.emitted('move')).toEqual([[{ from: 0, to: 1 }]])
    const moved = [{ ...VIAS[1], n: 1, after: 0 }, { ...VIAS[0], n: 2, after: 1 }, VIAS[2]]
    await w.setProps({ vias: moved })
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(handles()[1].element)
  })

  it('with no vias, nothing changes: no via rows, no handles', async () => {
    const w = await at({ vias: [] })
    expect(w.findAll('li.is-via')).toHaveLength(0)
    expect(w.findAll('.tt-path-drag')).toHaveLength(0)
  })
})

describe('Add stop', () => {
  it('off by default; stopsEditable adds a Stops row under End, after the end slot', async () => {
    expect(labs(await at())).not.toContain('Stops')
    const w = await at({ stopsEditable: true }, { end: '<i class="x-end">search</i>' })
    expect(labs(w)).toEqual(['From', 'Time', 'End', 'Stops'])
    const p = w.find('.tt-path-p').element
    const kids = Array.from(p.children)
    const endSlot = kids.findIndex(e => e.classList.contains('x-end'))
    const stopsRow = kids.findIndex(e => e.querySelector && e.querySelector('.tt-path-add'))
    expect(stopsRow).toBe(endSlot + 1)
    expect(chipText(w, 'Stops')).toEqual(['Add stop'])
  })

  it('Add stop opens the add slot inline with close; a second tap or close shuts it', async () => {
    let close = null
    const w = await at({ stopsEditable: true }, { add: (p) => { close = p.close; return h('i', { class: 'x-add' }, 'find a place') } })
    expect(w.find('.x-add').exists()).toBe(false)
    const chip = w.find('.tt-path-add')
    await chip.trigger('click')
    expect(w.find('.x-add').exists()).toBe(true)
    expect(chip.attributes('aria-expanded')).toBe('true')
    expect(chip.classes()).toContain('is-on')
    close()
    await nextTick()
    expect(w.find('.x-add').exists()).toBe(false)
    await chip.trigger('click')
    await chip.trigger('click')
    expect(w.find('.x-add').exists()).toBe(false)
    expect(w.emitted('add-open')).toHaveLength(2)
    expect(w.emitted('add-close')).toHaveLength(2)
  })

  it('without stopsEditable the add slot never shows', async () => {
    const w = await at({}, { add: '<i class="x-add">x</i>' })
    expect(w.find('.x-add').exists()).toBe(false)
  })
})

describe('transit legs', () => {
  const walk = min => ({ mode: 'WALK', ride: false, route: null, headsign: null, from: null, to: null, startTime: 0, endTime: 0, m: min * 80, min, stops: 0, geometry: [] })
  const ride = (name, min, color, textColor) => ({ mode: 'BUS', ride: true, route: name == null ? null : { shortName: name, color, textColor }, headsign: 'Ocean Beach', from: 'Market St', to: 'Park', startTime: 0, endTime: 0, m: min * 300, min, stops: 6, geometry: [] })
  const trip = legs => ({ startTime: 0, endTime: 0, m: 0, min: 0, walkM: 0, waitMin: 0, transfers: 0, legs })
  const TRIPS = [
    trip([walk(3.2), ride('5', 12.4, '#005B95', '#FFFFFF'), walk(0.6)]),
    null,
    trip([walk(1), ride('K', 6, '#B2C8E5', null), ride(null, 4, null, null), walk(2.4)]),
    trip([walk(5)]),
  ]

  it('a leg with a trip reads its badges, the rides\' minutes and the walk; a leg with none reads as before', async () => {
    const w = await at({ trips: TRIPS, mode: 'transit' })
    const legs = w.findAll('.tt-path-stops > li .tt-path-leg')
    expect(legs[0].classes()).toContain('is-transit')
    expect(legs[0].text()).toBe('512 minwalk 4 min')
    expect(legs[0].findAll('.tt-path-badge').map(b => b.text())).toEqual(['5'])
    expect(legs[0].findAll('.tt-path-ride').map(b => b.text())).toEqual(['12 min', 'walk 4 min'])
    expect(legs[1].classes()).not.toContain('is-transit')
    expect(legs[1].text()).toBe('0.1 mi · 3 min')
    expect(legs[2].findAll('.tt-path-badge').map(b => b.text())).toEqual(['K', 'Ride'])
    expect(legs[2].findAll('.tt-path-ride').map(b => b.text())).toEqual(['10 min', 'walk 3 min'])
    expect(legs[3].findAll('.tt-path-badge')).toHaveLength(0)
    expect(legs[3].findAll('.tt-path-ride').map(b => b.text())).toEqual(['walk 5 min'])
    expect(w.find('.tt-path-fin .tt-path-leg').classes()).toContain('is-transit')
  })

  it('a badge takes the route\'s color and text color; with no color it is is-plain with no style', async () => {
    const w = await at({ trips: TRIPS })
    const badges = w.findAll('.tt-path-badge')
    expect(badges[0].attributes('style')).toBe('background: rgb(0, 91, 149); color: rgb(255, 255, 255);')
    expect(badges[0].classes()).not.toContain('is-plain')
    expect(badges[1].attributes('style')).toBe('background: rgb(178, 200, 229);')
    expect(badges[2].classes()).toContain('is-plain')
    expect(badges[2].attributes('style')).toBeUndefined()
  })

  it('the summary\'s minutes stay the record\'s legs', async () => {
    const w = await at({ trips: TRIPS, modeOptions: ['walk', 'transit'], mode: 'transit' })
    expect(w.find('.tt-path-sum').text()).toBe('10 minby transit0.5 mi3 of 5')
  })

  it('trips follow the list with vias: a via row gets its own trip', async () => {
    const vias = [{ n: 1, at: { lat: 40.731, lon: -73.995 }, label: 'Coffee', arriveMin: 2, after: 0 }]
    const w = await at({ vias, trips: [trip([walk(2)]), trip([ride('N', 7, '#004A87', '#FFFFFF')]), null, null, null] })
    const legs = w.findAll('.tt-path-stops > li .tt-path-leg')
    expect(legs[0].text()).toBe('walk 2 min')
    expect(legs[1].findAll('.tt-path-badge').map(b => b.text())).toEqual(['N'])
    expect(legs[2].text()).toBe('0.1 mi · 3 min')
  })

  it('labels: the walk\'s words and a ride with no name', async () => {
    const w = await at({ trips: [trip([ride(null, 3, null, null), walk(2)])], labels: { walkMin: '{n} min on foot', ride: 'Bus' } })
    const leg = w.find('.tt-path-stops > li .tt-path-leg')
    expect(leg.find('.tt-path-badge').text()).toBe('Bus')
    expect(leg.findAll('.tt-path-ride').map(b => b.text())).toEqual(['3 min', '2 min on foot'])
  })
})
