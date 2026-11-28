// @vitest-environment jsdom
/**
 * TtPath 1.8.0 unset: with none of 1.8.0's props (modeOptions, whenOptions, when, whenError, tz, clockFmt, vias,
 * stopsEditable, trips), each scene renders 1.7.0's markup byte for byte. test/vue/goldens/p180/*.html were written
 * by these scenes on the kit at 1.7.0 (84c2ede) with P180_WRITE=1. The new behavior is path180.test.js.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TtPath, setTtHost, ttLock } from '../../vue/index.js'

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
const markup = html => html.replace(/(<input\b[^>]*?) value="[^"]*"/g, '$1')

const path = async (props = {}, slots) => {
  const w = mount(TtPath, { props: { open: true, plan: plan(), from: PILE, minutes: 30, cardFor, reduced: true, ...props }, slots, attachTo: document.body })
  await flushPromises()
  await nextTick()
  const html = markup(w.find('.tt-path').html())
  w.unmount()
  return html
}

afterEach(() => {
  setTtHost({ distUnit: null })
  ttLock(false)
  document.body.innerHTML = ''
})

const SCENES = {
  'pile-back-here': () => path(),
  'hand-didnt-fit': () => path({ from: HAND }),
  'home-labels': () => path({ labels: { home: 'Hunt', back: 'Hand', title: 'Plan', walking: 'on foot' } }),
  'estimate': () => path({ plan: plan({ totals: { stops: 3, m: 740, walkMin: 9.8, totalMin: 12.8, timing: 'estimate', leftOver: 1 } }) }),
  'open-end': () => path({ end: 'open', plan: plan({ end: { kind: 'open', at: null, name: null }, finish: null }) }),
  'destination': () => path({ end: 'destination', plan: plan({ end: { kind: 'destination', at: { lat: 40.74, lon: -73.98 }, name: 'Union Square' } }) }),
  'none-wider': () => path({ plan: empty(), wider: { minutes: 60, stops: 4 } }),
  'too-far': () => path({ plan: empty({ end: { kind: 'destination', at: { lat: 40.8, lon: -73.9 }, name: 'Far' }, finish: { leg: { m: 6000, min: 75 }, arriveMin: 75 } }), tooFar: true, end: 'destination' }),
  'failed': () => path({ failed: true }),
  'busy-no-plan': () => path({ plan: null, busy: true }),
  'busy-with-plan': () => path({ busy: true }),
  'slots': () => path({}, { map: '<i class="x-map">map</i>', end: '<i class="x-end">search</i>', rarity: '<i class="x-r">r</i>' }),
  async 'km'() { setTtHost({ distUnit: () => ({ unit: ref('km'), toggle() {} }) }); return path() },
}
const GOLD = resolve(__dirname, 'goldens/p180')
describe('1.8.0 unset: each scene is 1.7.0\'s markup, byte for byte', () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    it(name, async () => {
      const html = await scene()
      const file = resolve(GOLD, `${name}.html`)
      if (process.env.P180_WRITE) { mkdirSync(GOLD, { recursive: true }); writeFileSync(file, html) }
      expect(html).toBe(readFileSync(file, 'utf8'))
    })
  }
})
