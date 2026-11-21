// @vitest-environment jsdom
/**
 * Kit 1.3.0, three additions: unset, each scene below renders 1.2.0's markup byte for byte.
 * test/vue/goldens/v13/*.html were written by these scenes on the kit at 1.2.0 with V13_WRITE=1: the back's text
 * area (card.backFade), the table's piles (landing), the planner's head (labels.home). The goldens in goldens/k2,
 * goldens/u2 and goldens/u3 still hold too. The new behavior given is v13.test.js.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { TtFace, TtTable, TtPath, setTtHost, ttLock } from '../../vue/index.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}
const anims = []
beforeEach(() => {
  anims.length = 0
  Element.prototype.animate = function () { const a = { onfinish: null, oncancel: null, cancel() {}, finish() {} }; anims.push(a); return a }
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
const markup = html => html.replace(/(<input\b[^>]*?) value="[^"]*"/g, '$1')

// ── card.backFade: faces whose back has a text area
const FDATA = {
  sets: [{ id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612 }],
  rarities: { species: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'] },
}
const WALK = { sets: [{ id: 'walk-1', app: 'verythere', name: 'Old Town', short: 'OLD TOWN' }], rarities: {} }
const STORY = 'A small tree of the understory. '.repeat(24).trim()
const TH = (o = {}) => ({
  id: 'th:dogwood', app: 'treehopper', set: 'species', kind: 'species', face: 'treehopper', title: 'Flowering Dogwood',
  subtitle: 'Cornus florida', type: 'Species', fact: 'In the city · 6,700', back: STORY,
  stats: [{ k: 'Height', v: '30 ft' }, { k: 'Bloom', v: 'April' }], number: 404, of: 612, rarity: 'Uncommon',
  rarityCount: '1,204 in the city', foil: false, img: 'https://example.org/d.jpg', credit: 'Eric Hunt, CC BY-SA 4.0',
  held: true, collected: '2022-04-19', collector: { n: 7, of: 612 }, ...o,
})
const STOP = (o = {}) => ({
  id: 'vt:3', app: 'verythere', set: 'walk-1', kind: 'stop', title: 'The Mill', subtitle: 'Riverside', type: 'Stop',
  fact: 'Built 1820', back: 'Built 1820. '.repeat(30).trim(), stats: [], number: 3, of: 12, rarity: '', foil: false, accent: null,
  img: 'https://example.org/m.jpg', credit: 'Photo: A. Person', held: true, ...o,
})
const faceHtml = (card, o = {}) => {
  const w = mount(TtFace, { props: { card, data: card.app === 'verythere' ? WALK : FDATA, fonts: false, ...o.props }, slots: o.slots })
  const html = markup(w.html())
  w.unmount()
  return html
}

// ── landing: the table, stacked (a printing pile, and the fan) and flat
const base = { app: 'treehopper', face: 'treehopper', subtitle: 'Quercus', fact: '', back: 'A story.', stats: [], of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1 }
const sp = (id, o = {}) => ({ ...base, id: `th:${id}`, set: 'species', kind: 'species', title: id, type: 'Species', number: null, ...o })
const RAR = ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique']
const SETS = (o = {}) => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [
    { id: 'overstory', app: 'treehopper', name: 'Overstory', short: 'OVERSTORY', total: 3, kind: 'species', pts: 120 },
    { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' },
  ],
  rarities: { species: RAR },
  cards: [
    sp('oak', { sets: ['overstory'], number: 3, ...o }),
    sp('ash', { number: 1, added: 2, ...o }),
    sp('elm', { number: 2, added: 3, ...o }),
    sp('yew', { held: false, collected: null, added: null, ...o }),
  ],
})
const table = async (props = {}, cardO) => {
  const { options = {}, ...rest } = props
  const w = mount(TtTable, { props: { collection: SETS(cardO), ...rest, options: { key: 'tt_v13_gold', ...options } }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const grab = (w, sel) => { const html = markup(w.find(sel).html()); w.unmount(); return html }

// ── labels.home: the planner, open
const START = { lat: 40.7359, lon: -73.9911 }
const stop = (n, card, m, min) => ({ n, kind: 'card', card, place: { id: `t${n}`, lat: 40.73 + n / 1000, lon: -73.99 }, leg: { m, min }, arriveMin: 0, dwellMin: 1, status: 'planned', label: null, meal: null, fromHand: true, alts: [] })
const plan = () => ({
  id: 'p1', app: 'treehopper', set: 'treecount', madeBy: null, madeAt: '2026-10-29T00:00:00Z', planVersion: 2, solver: 'path', clock: null,
  start: START, end: { kind: 'start', at: START, name: null }, mode: 'walk', minutes: 30, order: 'planned',
  stops: [stop(1, 'red-maple', 180, 2.4), stop(2, 'pin-oak', 190, 2.4)],
  finish: { leg: { m: 200, min: 2.6 }, arriveMin: 13.8 },
  totals: { stops: 2, m: 570, walkMin: 7.4, totalMin: 9.4, timing: 'route', leftOver: 0 },
  leftOver: [], ext: {},
})
const NAMES = { 'red-maple': ['Red Maple', 'Common'], 'pin-oak': ['Pin Oak', 'Widespread'] }
const cardFor = s => (NAMES[s.card] ? { title: NAMES[s.card][0], rarity: NAMES[s.card][1] } : null)
const path = async (props = {}) => {
  const w = mount(TtPath, { props: { open: true, plan: plan(), from: { label: 'Missing', n: 5, kind: 'pile' }, minutes: 30, cardFor, reduced: true, ...props }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}

const SCENES = {
  'face-th-back': async () => faceHtml(TH(), { props: { side: 'back' } }),
  'face-th-back-more': async () => faceHtml(TH({ credit: null }), { props: { side: 'back' }, slots: { more: '<i class="x-more">photos</i>' } }),
  'face-th-front': async () => faceHtml(TH()),
  'face-stop-back': async () => faceHtml(STOP(), { props: { side: 'back' } }),
  async 'table-stacked-print'() { const w = await table(); await w.find('.tt-stk').trigger('click'); await settle(); return grab(w, '.tt') },
  async 'table-stacked-fan'() { const w = await table({}, { print: false }); await w.find('.tt-stk').trigger('click'); await settle(); return grab(w, '.tt') },
  async 'table-flat'() { const w = await table({ options: { groups: ['none', 'set'], group: 'none' } }); await settle(); return grab(w, '.tt') },
  async 'path-default'() { const w = await path(); return grab(w, '.tt-path') },
  async 'path-labels'() { const w = await path({ labels: { back: 'Hand', title: 'Plan' } }); return grab(w, '.tt-path') },
}
const GOLD = resolve(__dirname, 'goldens/v13')
describe('1.3.0 unset: each scene is 1.2.0\'s markup, byte for byte', () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    it(name, async () => {
      const html = await scene()
      const file = resolve(GOLD, `${name}.html`)
      if (process.env.V13_WRITE) { mkdirSync(GOLD, { recursive: true }); writeFileSync(file, html) }
      expect(html).toBe(readFileSync(file, 'utf8'))
    })
  }
})
