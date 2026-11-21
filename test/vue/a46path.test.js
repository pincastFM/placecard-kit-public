// @vitest-environment jsdom
/**
 * TtPath (2026-10-29), the day planner's path variant: the planner behaves the same in every app.
 * Markup and behavior only; Treehopper's collection draws it in its own layout. Checked
 * here: open and close (lock, focus, Escape), the summary timed and as an estimate, legs rounded on
 * the running total, the finish row, None in N min with the wider chip, Too far, the dimmed minutes,
 * Didn't fit for a hand only, Start, the slots, the host's unit and the labels.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'
import { TtPath, setTtHost, ttLock, ttLocked } from '../../vue/index.js'

const START = { lat: 40.7359, lon: -73.9911 }
const stop = (n, card, m, min) => ({ n, kind: 'card', card, place: { id: `t${n}`, lat: 40.73 + n / 1000, lon: -73.99 }, leg: { m, min }, arriveMin: 0, dwellMin: 1, status: 'planned', label: null, meal: null, fromHand: true, alts: [] })
const plan = (o = {}) => ({
  id: 'p1', app: 'treehopper', set: 'treecount', madeBy: null, madeAt: '2026-10-29T00:00:00Z', planVersion: 2, solver: 'path', clock: null,
  start: START, end: { kind: 'start', at: START, name: null }, mode: 'walk', minutes: 30, order: 'planned',
  stops: [stop(1, 'red-maple', 180, 2.4), stop(2, 'pin-oak', 190, 2.4), stop(3, 'ginkgo', 170, 2.4)],
  finish: { leg: { m: 200, min: 2.6 }, arriveMin: 13.8 },
  totals: { stops: 3, m: 740, walkMin: 9.8, totalMin: 12.8, timing: 'route', leftOver: 1 },
  leftOver: [{ key: 'yew', kind: 'card', reason: 'no time left' }],
  ext: {},
  ...o,
})
const empty = (o = {}) => plan({ stops: [], finish: null, end: { kind: 'open', at: null, name: null }, totals: { stops: 0, m: 0, walkMin: 0, totalMin: 0, timing: 'route', leftOver: 4 }, leftOver: [], ...o })
const NAMES = { 'red-maple': ['Red Maple', 'Common'], 'pin-oak': ['Pin Oak', 'Widespread'], ginkgo: ['Ginkgo', 'Numerous'], yew: ['English Yew', 'Rare'] }
const cardFor = s => (NAMES[s.card] ? { title: NAMES[s.card][0], rarity: NAMES[s.card][1] } : null)
const HAND = { label: 'Hand', n: 4, kind: 'hand' }
const PILE = { label: 'Missing', n: 5, kind: 'pile' }

const at = async (props = {}, slots) => {
  const w = mount(TtPath, { props: { open: true, plan: plan(), from: PILE, minutes: 30, cardFor, reduced: true, ...props }, slots, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const texts = (w, sel) => w.findAll(sel).map(x => x.text())
const locked = () => ttLocked()

afterEach(() => {
  setTtHost({ distUnit: null })
  ttLock(false)
  document.body.innerHTML = ''
})

describe('open and close', () => {
  it('renders nothing closed, and nothing locked', async () => {
    const w = await at({ open: false })
    expect(w.find('.tt-path').exists()).toBe(false)
    expect(locked()).toBe(false)
  })

  it('mounted open: a dialog named Route, the page locked, Back focused', async () => {
    const w = await at()
    const d = w.find('.tt-path')
    expect(d.attributes('role')).toBe('dialog')
    expect(d.attributes('aria-label')).toBe('Route')
    expect(w.find('.tt-path-h').text()).toBe('Route')
    expect(w.find('.tt-back').text()).toBe('Collection')
    expect(locked()).toBe(true)
    expect(document.activeElement).toBe(w.find('.tt-back').element)
  })

  it('Escape and Back close it; closing unlocks; unmounting open unlocks', async () => {
    const w = await at({ open: false })
    await w.setProps({ open: true })
    await flushPromises()
    expect(locked()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.find('.tt-back').trigger('click')
    expect(w.emitted('close')).toHaveLength(2)
    await w.setProps({ open: false })
    expect(locked()).toBe(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(2)
    const v = await at()
    expect(locked()).toBe(true)
    v.unmount()
    expect(locked()).toBe(false)
  })
})

describe('the summary and the stops', () => {
  it('timed: walking minutes, distance, N of M; each leg on the running total so they add up', async () => {
    const w = await at()
    expect(w.find('.tt-path-from').text()).toBe('Missing · 5')
    expect(texts(w, '.tt-path-sum > *')).toEqual(['10 min', 'walking', '0.5 mi', '3 of 5'])
    // legs 2.4, 2.4, 2.4 and 2.6: running 2.4, 4.8, 7.2, 9.8 round to 2, 5, 7, 10
    expect(texts(w, '.tt-path-stops .tt-path-leg')).toEqual(['0.1 mi · 2 min', '0.1 mi · 3 min', '0.1 mi · 2 min', '0.1 mi · 3 min'])
    expect(texts(w, '.tt-path-stops li:not(.tt-path-fin) .tt-path-n')).toEqual(['1', '2', '3'])
    expect(texts(w, '.tt-path-stops li:not(.tt-path-fin) .tt-path-nm')).toEqual(['Red Maple', 'Pin Oak', 'Ginkgo'])
    expect(texts(w, '.tt-path-r')).toEqual(['Common', 'Widespread', 'Numerous'])
  })

  it('a leg under half a minute still reads 1 min, and the summary is their sum', async () => {
    const w = await at({ plan: plan({ stops: [stop(1, 'red-maple', 20, 0.2), stop(2, 'pin-oak', 30, 0.2)], finish: null, end: { kind: 'open', at: null, name: null }, totals: { stops: 2, m: 50, walkMin: 0.4, totalMin: 2.4, timing: 'mapbox', leftOver: 0 } }) })
    expect(texts(w, '.tt-path-leg')).toEqual(['70 ft · 1 min', '100 ft · 1 min'])
    expect(w.find('.tt-path-sum b').text()).toBe('2 min')
  })

  it('an estimate: distance and N of M only, no minutes on the legs', async () => {
    const w = await at({ plan: plan({ totals: { stops: 3, m: 740, walkMin: 9.8, totalMin: 12.8, timing: 'estimate', leftOver: 1 } }) })
    expect(texts(w, '.tt-path-sum > *')).toEqual(['0.5 mi', '3 of 5'])
    expect(w.find('.tt-path-sum b').text()).toBe('0.5 mi')
    expect(texts(w, '.tt-path-leg')).toEqual(['0.1 mi', '0.1 mi', '0.1 mi', '0.1 mi'])
  })

  it('the finish row: Back here, a destination by name, none for Open', async () => {
    let w = await at()
    expect(w.find('.tt-path-fin .tt-path-nm').text()).toBe('Back here')
    expect(w.find('.tt-path-fin .tt-path-n').text()).toBe('')
    w = await at({ plan: plan({ end: { kind: 'destination', at: { lat: 40.74, lon: -73.98 }, name: 'Gramercy Park' } }) })
    expect(w.find('.tt-path-fin .tt-path-nm').text()).toBe('Gramercy Park')
    w = await at({ plan: plan({ end: { kind: 'destination', at: { lat: 40.74, lon: -73.98 }, name: null } }) })
    expect(w.find('.tt-path-fin .tt-path-nm').text()).toBe('Destination')
    w = await at({ plan: plan({ end: { kind: 'open', at: null, name: null }, finish: null }) })
    expect(w.find('.tt-path-fin').exists()).toBe(false)
    expect(w.findAll('.tt-path-stops li')).toHaveLength(3)
  })

  it('distance in the host\'s unit', async () => {
    setTtHost({ distUnit: () => ({ unit: ref('km'), toggle() {} }) })
    const w = await at()
    expect(texts(w, '.tt-path-sum > *')).toEqual(['10 min', 'walking', '740 m', '3 of 5'])
    expect(w.find('.tt-path-leg').text()).toBe('180 m · 2 min')
  })
})

describe('no stops', () => {
  it('None in N min, the wider chip beside it, the minutes at and under it dimmed', async () => {
    const w = await at({ plan: empty(), wider: { minutes: 60, stops: 2 } })
    expect(w.find('.tt-path-far').text()).toBe('None in 30 min')
    const wide = w.find('.tt-path-wider')
    expect(wide.text()).toBe('60 min · 2')
    await wide.trigger('click')
    expect(w.emitted('minutes')).toEqual([[60]])
    const chips = w.findAll('.tt-path-row')[1].findAll('.tt-chip')
    expect(chips.map(c => c.classes('is-dim'))).toEqual([true, true, false, false])
    expect(w.find('.tt-path-stops').exists()).toBe(false)
    expect(w.find('.tt-path-go').attributes('disabled')).toBeDefined()
  })

  it('no wider time: the headline alone', async () => {
    const w = await at({ plan: empty(), wider: null })
    expect(texts(w, '.tt-path-sum > *')).toEqual(['None in 30 min'])
  })

  it('too far: Too far for N min, no wider chip, the minutes under the walk to it dimmed', async () => {
    const w = await at({ minutes: 15, tooFar: true, wider: { minutes: 60, stops: 2 }, plan: empty({ end: { kind: 'destination', at: { lat: 40.76, lon: -73.97 }, name: 'Central Park' }, finish: { leg: { m: 2600, min: 32.5 }, arriveMin: 32.5 } }) })
    expect(texts(w, '.tt-path-sum > *')).toEqual(['Too far for 15 min'])
    const chips = w.findAll('.tt-path-row')[1].findAll('.tt-chip')
    expect(chips.map(c => c.classes('is-dim'))).toEqual([true, true, false, false])
    expect(w.find('.tt-path-fin').exists()).toBe(false)
  })

  it('a plan with stops dims nothing', async () => {
    const w = await at()
    expect(w.findAll('.tt-chip.is-dim')).toHaveLength(0)
  })
})

describe("Didn't fit", () => {
  it('a hand lists each card left off, with why', async () => {
    const w = await at({ from: HAND, plan: plan({ leftOver: [{ key: 'yew', kind: 'card', reason: 'no time left' }, { key: 'larch', kind: 'card', reason: 'out of reach' }, { key: 'e1', kind: 'event', reason: 'closed' }] }) })
    expect(w.find('.tt-path-df-h').text()).toBe("Didn't fit2")
    expect(texts(w, '.tt-path-df-l .tt-path-nm')).toEqual(['English Yew', 'larch'])
    expect(texts(w, '.tt-path-why')).toEqual(['No time left', 'Out of reach'])
    expect(texts(w, '.tt-path-sum > *')).toEqual(['10 min', 'walking', '0.5 mi', '3 of 4'])
    await w.find('.tt-path-df-l .tt-path-nm').trigger('click')
    expect(w.emitted('card')).toEqual([['yew']])
  })

  it('a pile has none', async () => {
    const w = await at({ from: PILE })
    expect(w.find('.tt-path-df').exists()).toBe(false)
  })
})

describe('the states, the chips and Start', () => {
  it('busy with no plan reads Planning; busy keeps the last plan, dimmed, and holds Start', async () => {
    let w = await at({ plan: null, busy: true })
    expect(texts(w, '.tt-path-sum > *')).toEqual(['Planning'])
    w = await at({ busy: true })
    expect(w.find('.tt-path-sum').classes('is-busy')).toBe(true)
    expect(w.findAll('.tt-path-stops li')).toHaveLength(4)
    expect(w.find('.tt-path-go').attributes('disabled')).toBeDefined()
  })

  it('no plan and not busy: no summary', async () => {
    const w = await at({ plan: null })
    expect(w.find('.tt-path-sum').exists()).toBe(false)
  })

  it('failed reads No route, shows no stops, holds Start', async () => {
    const w = await at({ failed: true, from: HAND })
    expect(texts(w, '.tt-path-sum > *')).toEqual(['No route'])
    expect(w.find('.tt-path-stops').exists()).toBe(false)
    expect(w.find('.tt-path-df').exists()).toBe(false)
    expect(w.find('.tt-path-go').attributes('disabled')).toBeDefined()
  })

  it('Start emits the plan; a stop emits its card', async () => {
    const p = plan()
    const w = await at({ plan: p })
    const go = w.find('.tt-path-go')
    expect(go.text()).toBe('Start')
    expect(go.attributes('disabled')).toBeUndefined()
    await go.trigger('click')
    expect(w.emitted('start')).toHaveLength(1)
    expect(w.emitted('start')[0][0].id).toBe('p1')
    await w.findAll('.tt-path-stops .tt-path-nm')[1].trigger('click')
    expect(w.emitted('card')).toEqual([['pin-oak']])
  })

  it('Time and End chips: pressed state, and an emit only on a change', async () => {
    const w = await at({ minutes: 30, end: 'start' })
    const [time, end] = w.findAll('.tt-path-row').slice(1)
    expect(texts(time, '.tt-chip')).toEqual(['15 min', '30 min', '60 min', '90 min'])
    expect(time.findAll('.tt-chip').map(c => c.attributes('aria-pressed'))).toEqual(['false', 'true', 'false', 'false'])
    expect(texts(end, '.tt-chip')).toEqual(['Open', 'Back here', 'Destination'])
    expect(end.find('.is-on').text()).toBe('Back here')
    await time.findAll('.tt-chip')[1].trigger('click')
    await time.findAll('.tt-chip')[3].trigger('click')
    await end.findAll('.tt-chip')[1].trigger('click')
    await end.findAll('.tt-chip')[2].trigger('click')
    expect(w.emitted('minutes')).toEqual([[90]])
    expect(w.emitted('end')).toEqual([['destination']])
  })

  it('the slots: map gets the plan, end follows the End chips, rarity replaces the word', async () => {
    const w = await at({ end: 'destination' }, {
      map: ({ plan: p }) => h('div', { class: 'app-map' }, p ? String(p.stops.length) : 'none'),
      end: ({ end }) => h('label', { class: 'app-search' }, end),
      rarity: ({ stop: s }) => h('span', { class: 'app-chip', 'data-k': s.card }),
    })
    expect(w.find('.tt-path-map .app-map').text()).toBe('3')
    const search = w.find('.app-search')
    expect(search.text()).toBe('destination')
    expect(search.element.previousElementSibling.querySelector('.tt-path-lab').textContent).toBe('End')
    expect(w.findAll('.app-chip').map(x => x.attributes('data-k'))).toEqual(['red-maple', 'pin-oak', 'ginkgo'])
    expect(w.find('.tt-path-r').exists()).toBe(false)
  })

  it('labels: each word the app\'s, the rest kept', async () => {
    const w = await at({ plan: empty(), labels: { back: 'Table', none: 'Nothing in {n} min' } })
    expect(w.find('.tt-back').text()).toBe('Table')
    expect(w.find('.tt-path-far').text()).toBe('Nothing in 30 min')
    expect(w.find('.tt-path-h').text()).toBe('Route')
  })
})
