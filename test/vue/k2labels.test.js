// @vitest-environment jsdom
/**
 * Kit 1.1.0: the words the kit wrote as fixed text become labels, each defaulting to today's word. TtTable's labels
 * gain of, noCards, pts and no, and hand themselves to TtStage and TtFace (the face's "No." and a back's "of"); core
 * ttNumberLabel and ttStamp take an optional words.no; labels.questSpoken reads a head with points;
 * options.groupLabels.set also names the set filter's chip and popover. Unset, each scene renders 1.0.0's markup byte
 * for byte: test/vue/goldens/k2/*.html were written by this file's scenes on the kit at tag v1.0.0 with K2_WRITE=1.
 * NYID's own goldens are the outer check.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { TtTable, TtFace, setTtHost, ttLock } from '../../vue/index.js'
import { ttNumberLabel, ttStamp } from '../../core/index.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}
beforeEach(() => {
  Element.prototype.animate = function () { return { onfinish: null, oncancel: null, cancel() {}, finish() {} } }
  setTtHost({ head: vi.fn(), distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => { setTtHost({ head: null, distUnit: null }); document.body.innerHTML = ''; ttLock(false) })

const base = { app: 'treehopper', face: 'treehopper', subtitle: '', fact: '', back: '', stats: [], of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1 }
const sp = (id, o = {}) => ({ ...base, id: `th:${id}`, set: 'species', kind: 'species', title: id, type: 'Species', number: null, ...o })
const tree = (id, o = {}) => ({ ...base, id: `tree:${id}`, set: 'trees', kind: 'tree', title: `Tree ${id}`, type: 'Tree', number: null, ...o })
const RAR = ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique']
// Sets with points (Overstory, a side quest) and without (Species); a stamp on every numbered card
const SETS = () => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [
    { id: 'overstory', app: 'treehopper', name: 'Overstory', short: 'OVERSTORY', total: 3, kind: 'species', pts: 120 },
    { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' },
  ],
  rarities: { species: RAR },
  cards: [
    sp('oak', { sets: ['overstory'], number: 3 }),
    sp('ash', { number: 1 }),
    sp('elm', { number: 2 }),
    sp('yew', { held: false, collected: null, added: null }),
  ],
})
// Species as sets of trees (the kit's nest), for the open set's "n of N"
const NEST = () => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [
    { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' },
    { id: 'trees', app: 'treehopper', name: 'Trees', short: 'TREES', total: null, kind: 'tree' },
  ],
  rarities: { species: RAR, tree: RAR },
  cards: [
    sp('oak', { number: 1, childTotal: 4260, children: ['a', 'b', 'c'].map(x => tree(`oak-${x}`)) }),
    sp('ash', { number: 2 }),
  ],
})
// A walk card's back: the set line's "No. 03 of 12" (the default face, not Treehopper's)
const WALK = { apps: [{ id: 'verythere', name: 'VeryThere', color: '#C2410C' }], sets: [{ id: 'walk-1', app: 'verythere', name: 'Old Town', short: 'OLD TOWN' }], rarities: {} }
const STOP = { id: 'vt:3', app: 'verythere', set: 'walk-1', kind: 'stop', title: 'The Mill', subtitle: 'Riverside', type: 'Stop', fact: '', back: 'Built 1820.', stats: [], number: 3, of: 12, rarity: '', foil: false, accent: null, img: null, credit: null, held: true }

const table = async (props = {}) => {
  const { options = {}, ...rest } = props
  const w = mount(TtTable, { props: { collection: SETS(), ...rest, options: { key: 'tt_k2_test', ...options } }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const settle = async () => { await flushPromises(); await nextTick() }

// An input's value is a property: Vue 3.3 leaves it out of the markup and later Vue writes it as an attribute too
// (the card-size slider's), so it is left out, as conformance's table markup does. CI runs both.
const markup = html => html.replace(/(<input\b[^>]*?) value="[^"]*"/g, '$1')

// Each scene renders with the labels and options it is given and returns the markup it checks
const SCENES = {
  // the top bar's counter, the heads (a set with points, one without), the ledger, the rail's chips, the cells' stamps
  async table(labels, options) {
    const w = await table({ counter: { n: 403, of: 612 }, labels, options })
    const html = w.find('.tt').html()
    w.unmount()
    return markup(html)
  },
  // the set filter's chip and its popover
  async popover(labels, options) {
    const w = await table({ labels, options })
    await w.find('.tt-chip[data-k="set"]').trigger('click')
    await settle()
    const html = w.find('.tt-chip[data-k="set"]').html() + '\n' + w.find('.tt-pop').html()
    w.unmount()
    return markup(html)
  },
  // a search that matches no card
  async none(labels, options) {
    const w = await table({ labels, options })
    w.vm.T.filter.q = 'zzz'
    await settle()
    const html = w.find('.tt-none').html()
    w.unmount()
    return markup(html)
  },
  // an open set's top bar, "3 of 4,260"
  async nest(labels, options) {
    const w = await table({ collection: NEST(), labels, options: { nest: true, ...options } })
    w.vm.openNest('th:oak')
    await settle()
    const html = w.find('.tt-top').html()
    w.unmount()
    return markup(html)
  },
  // the open card on the stage: Treehopper's stamp
  async stage(labels, options) {
    const w = await table({ labels, options })
    w.vm.openCard('th:oak')
    await settle()
    const html = w.find('.tt-st-card').html()
    w.unmount()
    return markup(html)
  },
  // a walk card's back, alone
  async back(labels) {
    const w = mount(TtFace, { props: { card: STOP, data: WALK, side: 'back', fonts: false, ...(labels ? { labels } : {}) } })
    const html = w.html()
    w.unmount()
    return markup(html)
  },
}

const GOLD = resolve(__dirname, 'goldens/k2')
describe('K2 unset: each scene is 1.0.0\'s markup, byte for byte', () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    it(name, async () => {
      const html = await scene(undefined, {})
      const file = resolve(GOLD, `${name}.html`)
      if (process.env.K2_WRITE) { mkdirSync(GOLD, { recursive: true }); writeFileSync(file, html) }
      expect(html).toBe(readFileSync(file, 'utf8'))
    })
  }
})

describe('K2 defaults given: the same markup as unset', () => {
  const DEFAULTS = { of: 'of', noCards: 'No cards', pts: 'pts', no: 'No.' }
  for (const [name, scene] of Object.entries(SCENES)) {
    it(name, async () => {
      expect(await scene(DEFAULTS, {})).toBe(readFileSync(resolve(GOLD, `${name}.html`), 'utf8'))
    })
  }
})

describe('K2 given: each key replaces its word, and only its word', () => {
  const FR = { of: 'de', noCards: 'Aucune carte', pts: 'points', no: 'Nº' }
  const swap = (html, pairs) => pairs.reduce((s, [a, b]) => s.split(a).join(b), html)

  it('of and pts: the counter, a head\'s figure and points, the ledger\'s spoken figure', async () => {
    const w = await table({ counter: { n: 403, of: 612 }, labels: FR })
    expect(w.find('.tt-cnt > .tt-cl').text()).toBe('de 612')
    expect(w.find('.tt-bx[data-g="set:overstory"] .tt-bx-fig').text()).toBe('1 de 3 · 120 points')
    expect(w.find('.tt-bx[data-g="set:species"] .tt-bx-fig').text()).toBe('3 de 612')
    expect(w.find('.tt-lg[data-lg="set:species"]').attributes('aria-label')).toBe('Species, 3 de 612')
    w.unmount()
  })

  it('no: the cells\' stamps and the open card\'s', async () => {
    const w = await table({ labels: FR })
    expect(w.find('.tt-cell[data-id="th:oak"] .ttf-stamp-n').text()).toBe('Nº 3')
    w.vm.openCard('th:oak')
    await settle()
    expect(w.find('.tt-st-card .ttf-stamp-n').text()).toBe('Nº 3')
    w.unmount()
  })

  it('the whole table differs from the unset golden by those words alone', async () => {
    const gold = readFileSync(resolve(GOLD, 'table.html'), 'utf8')
    const got = await SCENES.table(FR, {})
    expect(got).not.toBe(gold)
    expect(swap(got, [['de 612', 'of 612'], [' de ', ' of '], ['points', 'pts'], ['Nº ', 'No. ']])).toBe(gold)
  })

  it('noCards: the empty search', async () => {
    expect(await SCENES.none(FR, {})).toBe(swap(readFileSync(resolve(GOLD, 'none.html'), 'utf8'), [['No cards', 'Aucune carte']]))
  })

  it('of: an open set\'s top bar', async () => {
    const w = await table({ collection: NEST(), labels: FR, options: { nest: true } })
    w.vm.openNest('th:oak')
    await settle()
    expect(w.find('.tt-cnt > .tt-cl').text()).toBe('de 4,260')
    w.unmount()
  })

  it('no and of on a face\'s back, through TtFace\'s labels; an empty no leaves the number', async () => {
    const fr = mount(TtFace, { props: { card: STOP, data: WALK, side: 'back', fonts: false, labels: FR } })
    expect(fr.find('.ttf-bk-set .ttf-no').text()).toBe('Nº 03 de 12')
    fr.unmount()
    const bare = mount(TtFace, { props: { card: STOP, data: WALK, side: 'back', fonts: false, labels: { no: '' } } })
    expect(bare.find('.ttf-bk-set .ttf-no').text()).toBe('03 of 12')
    bare.unmount()
  })

  it('core: ttNumberLabel and ttStamp take words.no; unset or without no, "No."', () => {
    expect(ttNumberLabel(3)).toBe('No. 03')
    expect(ttNumberLabel(3, {})).toBe('No. 03')
    expect(ttNumberLabel(3, { no: 'Nº' })).toBe('Nº 03')
    expect(ttNumberLabel(3, { no: '' })).toBe('03')
    expect(ttNumberLabel(null, { no: 'Nº' })).toBe('')
    const card = sp('oak', { number: 404, collected: '2022-04-19' })
    expect(ttStamp(card)).toEqual({ n: 404, no: 'No. 404', date: '19 APR 22' })
    expect(ttStamp(card, { no: 'Nº' })).toEqual({ n: 404, no: 'Nº 404', date: '19 APR 22' })
    expect(ttStamp({ ...card, held: false }, { no: 'Nº' })).toBe(null)
  })
})

describe('K2 questSpoken: a head with points is read by the template; one without keeps its label', () => {
  const Q = { questSpoken: '{name}, {n} of {N}, {pts} points' }
  it('the set with points takes it before the action word; the set without keeps "Species, stack"', async () => {
    const w = await table({ labels: Q })
    expect(w.find('.tt-bx[data-g="set:overstory"]').attributes('aria-label')).toBe('Overstory, 1 of 3, 120 points, stack')
    expect(w.find('.tt-bx[data-g="set:species"]').attributes('aria-label')).toBe('Species, stack')
    await w.find('.tt-bx[data-g="set:overstory"]').trigger('click')
    await settle()
    expect(w.find('.tt-bx[data-g="set:overstory"]').attributes('aria-label')).toBe('Overstory, 1 of 3, 120 points, spread')
    w.unmount()
  })

  it('unset, the head with points reads its label as before', async () => {
    const w = await table()
    expect(w.find('.tt-bx[data-g="set:overstory"]').attributes('aria-label')).toBe('Overstory, stack')
    w.unmount()
  })

  it('an unknown placeholder stays as written; the numbers read as the head prints them', async () => {
    const w = await table({ labels: { questSpoken: '{name} ({x}): {pts} pts' } })
    expect(w.find('.tt-bx[data-g="set:overstory"]').attributes('aria-label')).toBe('Overstory ({x}): 120 pts, stack')
    w.unmount()
  })
})

describe('K2 groupLabels.set: one word for the Group segment, the set chip and its popover', () => {
  it('"Side quests" names the chip and the popover; "Set" unset', async () => {
    const opts = { groupLabels: { none: 'Found', set: 'Side quests' } }
    const got = await SCENES.popover(undefined, opts)
    expect(got).toBe(readFileSync(resolve(GOLD, 'popover.html'), 'utf8').split('Set').join('Side quests'))
    const w = await table({ options: opts })
    expect(w.findAll('.tt-chip[data-k="set"]').map(c => c.text())).toEqual(['Side quests', 'Side quests'])
    expect(w.vm.T.groupOptions.find(g => g.id === 'set').label).toBe('Side quests')
    w.unmount()
  })

  it('a group label for another id, or an empty one, leaves "Set"', async () => {
    for (const groupLabels of [{ none: 'Found' }, { set: '' }]) {
      const w = await table({ options: { groupLabels } })
      expect(w.find('.tt-chip[data-k="set"]').text()).toBe('Set')
      w.unmount()
    }
  })
})
