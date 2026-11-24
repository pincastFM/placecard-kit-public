// @vitest-environment jsdom
/**
 * Kit 1.6.1: the table's head says "1 Card" at one card, where it said "1 Cards". The number and the word sit in
 * .tt-cnt (the CSS uppercases the word, so a one-card table read "1 CARDS"). labels.card names the one; a host
 * that sets labels.cards and not labels.card keeps its own word at one, as before. The counter's "n of N" and
 * every other count on the table are as before.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { TtTable, setTtHost, ttLock } from '../../vue/index.js'

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

const base = { app: 'treehopper', face: 'treehopper', subtitle: '', fact: '', back: '', stats: [], number: null, of: null, rarity: 'Common', rarityRank: 1, rarityCount: null, foil: false, accent: null, img: null, credit: null, held: true, collected: '2026-10-12', added: 1 }
const sp = (id, o = {}) => ({ ...base, id: `th:${id}`, set: 'species', kind: 'species', title: id, type: 'Species', ...o })
const tree = (id, o = {}) => ({ ...base, id: `tree:${id}`, set: 'trees', kind: 'tree', title: `Tree ${id}`, type: 'Tree', ...o })
const RAR = ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique']
const DATA = cards => ({
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
  sets: [
    { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612, kind: 'species' },
    { id: 'trees', app: 'treehopper', name: 'Trees', short: 'TREES', total: null, kind: 'tree' },
  ],
  rarities: { species: RAR, tree: RAR },
  cards,
})
const table = async (cards, props = {}) => {
  const { options = {}, ...rest } = props
  const w = mount(TtTable, { props: { collection: DATA(cards), ...rest, options: { key: 'tt_plural_test', ...options } }, attachTo: document.body })
  await flushPromises()
  await nextTick()
  return w
}
const head = w => `${w.find('.tt-cnt > b').text()} ${w.find('.tt-cnt > .tt-cl').text()}`

describe('the head\'s count word agrees with its number', () => {
  it('one card: "1 Card"', async () => {
    const w = await table([sp('oak')])
    expect(head(w)).toBe('1 Card')
    w.unmount()
  })

  it('two cards: "2 Cards", as before', async () => {
    const w = await table([sp('oak'), sp('ash')])
    expect(head(w)).toBe('2 Cards')
    w.unmount()
  })

  it('one held card beside a missing one: "1 Card" (the head counts the held)', async () => {
    const w = await table([sp('oak'), sp('yew', { held: false, collected: null, added: null })])
    expect(head(w)).toBe('1 Card')
    w.unmount()
  })

  it('a search that leaves one card: "1 Card"; cleared, "2 Cards"', async () => {
    const w = await table([sp('oak'), sp('ash')])
    w.vm.T.filter.q = 'oak'
    await flushPromises(); await nextTick()
    expect(head(w)).toBe('1 Card')
    w.vm.T.filter.q = ''
    await flushPromises(); await nextTick()
    expect(head(w)).toBe('2 Cards')
    w.unmount()
  })

  it('labels.card names the one; labels.cards the rest', async () => {
    const one = await table([sp('oak')], { labels: { card: 'Find', cards: 'Finds' } })
    expect(head(one)).toBe('1 Find')
    one.unmount()
    const two = await table([sp('oak'), sp('ash')], { labels: { card: 'Find', cards: 'Finds' } })
    expect(head(two)).toBe('2 Finds')
    two.unmount()
  })

  it('a host that sets labels.cards alone keeps its word at one, as before', async () => {
    const w = await table([sp('oak')], { labels: { cards: 'Species' } })
    expect(head(w)).toBe('1 Species')
    w.unmount()
  })

  it('the counter\'s "n of N" is as before at one', async () => {
    const w = await table([sp('oak')], { counter: { n: 1, of: 612 } })
    expect(head(w)).toBe('1 of 612')
    w.unmount()
  })

  it('an open set with one child and no total: "1 Card"; with a total, "1 of N" as before', async () => {
    const bare = await table([sp('oak', { children: [tree('oak-a')] }), sp('ash')], { options: { nest: true } })
    bare.vm.openNest('th:oak')
    await flushPromises(); await nextTick()
    expect(head(bare)).toBe('1 Card')
    bare.unmount()
    const told = await table([sp('oak', { childTotal: 9, children: [tree('oak-a')] }), sp('ash')], { options: { nest: true } })
    told.vm.openNest('th:oak')
    await flushPromises(); await nextTick()
    expect(head(told)).toBe('1 of 9')
    told.unmount()
  })
})
