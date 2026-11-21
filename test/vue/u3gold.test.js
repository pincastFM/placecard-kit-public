// @vitest-environment jsdom
/**
 * Kit 1.2.0, the stage and table additions: unset, each scene below renders 1.1.0's markup byte for byte.
 * test/vue/goldens/u3/*.html were written by these scenes on the kit just before these changes with U3_WRITE=1: the
 * open card's whole stage (its head, the live faces, the head slot and Flip words, the art slot), a card laid over
 * (its Back), the table stacked and flat (the group actions, the stack glyph and quest figure, the Held / Missing /
 * All rail). The goldens in goldens/k2 and goldens/u2 still hold too. The additions given are u3asks.test.js.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { TtTable, setTtHost, ttLock } from '../../vue/index.js'

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

const base = { app: 'treehopper', face: 'treehopper', subtitle: 'Quercus', fact: '', back: 'A story.', stats: [], of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1 }
const sp = (id, o = {}) => ({ ...base, id: `th:${id}`, set: 'species', kind: 'species', title: id, type: 'Species', number: null, ...o })
const RAR = ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique']
// A side quest with points and a set without; a missing card; one card in two sets
const SETS = () => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [
    { id: 'overstory', app: 'treehopper', name: 'Overstory', short: 'OVERSTORY', total: 3, kind: 'species', pts: 120 },
    { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' },
  ],
  rarities: { species: RAR },
  cards: [
    sp('oak', { sets: ['overstory'], number: 3 }),
    sp('ash', { number: 1, added: 2 }),
    sp('elm', { number: 2, added: 3 }),
    sp('yew', { held: false, collected: null, added: null }),
  ],
})
const table = async (props = {}) => {
  const { options = {}, ...rest } = props
  const w = mount(TtTable, { props: { collection: SETS(), ...rest, options: { key: 'tt_u3_gold', ...options } }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const tap = (el) => {
  for (const type of ['pointerdown', 'pointerup']) {
    const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })
    Object.defineProperty(e, 'pointerId', { value: 1 })
    el.dispatchEvent(e)
  }
}
const markup = html => html.replace(/(<input\b[^>]*?) value="[^"]*"/g, '$1')
const grab = (w, sel) => { const html = markup(w.find(sel).html()); w.unmount(); return html }

const SCENES = {
  async 'stage-front'() { const w = await table(); w.vm.openCard('th:oak'); await settle(); return grab(w, '.tt-stage') },
  async 'stage-back'() { const w = await table(); w.vm.openCard('th:oak'); await settle(); tap(w.find('.tt-st-card').element); await settle(); return grab(w, '.tt-stage') },
  async 'stage-missing'() {
    const w = await table()
    await w.find('.tt-strip .tt-chip[data-k="missing"]').trigger('click')
    await settle()
    w.vm.openCard('th:yew')
    await settle()
    return grab(w, '.tt-stage')
  },
  async 'stage-over'() { const w = await table(); w.vm.openCard('th:oak'); await settle(); w.vm.over('th:ash', { back: 'Back to oak' }); await settle(); return grab(w, '.tt-stage') },
  async 'table-stacked'() { const w = await table(); await w.find('.tt-stk').trigger('click'); await settle(); return grab(w, '.tt') },
  async 'table-flat'() { const w = await table({ options: { groups: ['none', 'set'], group: 'none' } }); await settle(); return grab(w, '.tt') },
}
const GOLD = resolve(__dirname, 'goldens/u3')
describe('U3 unset: each scene is 1.1.0\'s markup, byte for byte', () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    it(name, async () => {
      const html = await scene()
      const file = resolve(GOLD, `${name}.html`)
      if (process.env.U3_WRITE) { mkdirSync(GOLD, { recursive: true }); writeFileSync(file, html) }
      expect(html).toBe(readFileSync(file, 'utf8'))
    })
  }
})
