/**
 * Four core additions, each new and unused by Provo, so a table that does not ask for one is as it was:
 * points, a card in two sets and a pinned first card; the slider's stops by cards across; the deal; and a
 * function `only`.
 */
import { describe, it, expect } from 'vitest'
import {
  TT_STOPS, ttAcross, ttAcrossStops, ttDeal, ttFacets, ttFilter, ttGroup, ttPin, ttRange, ttSetsOf, ttSnap, ttStops,
} from '../../core/core.js'
import { crHead } from '../../core/cardroom.js'
import { useTtTable } from '../../vue/useTtTable.js'

const card = (id, o = {}) => ({ id, app: 'treehopper', set: 'species', title: id, held: true, number: null, ...o })
const memo = () => { const m = new Map(); return { get: k => m.get(k) ?? null, set: (k, v) => m.set(k, v) } }

describe('gap 6: the slider stops by cards across', () => {
  it('each stop lays exactly that many a row, ascending', () => {
    const W = 366
    const g = 6
    const w = ttAcrossStops(W, g, [3, 2])
    expect(w).toEqual([118, 180])
    expect(ttAcross(w[0], W, g)).toBe(3)
    expect(ttAcross(w[1], W, g)).toBe(2)
    expect(ttAcrossStops(W, g, [2, 2, 0, 'x'])).toEqual([180])
  })
  it('ttStops and ttSnap take the list, and default to TT_STOPS', () => {
    const range = ttRange(366, 6)
    expect(ttStops(range)).toEqual(ttStops(range, TT_STOPS))
    const list = ttAcrossStops(366, 6, [3, 2])
    expect(ttStops(range, list).map(s => s.w)).toEqual(list)
    expect(ttSnap(120, range, list)).toBe(118)
    expect(ttSnap(120, range)).toBe(111)
  })
  it('useTtTable: options.stops sets the ticks and the snap; without it the stops are TT_STOPS', () => {
    const data = { cards: [card('a')] }
    const plain = useTtTable(data, { store: memo() })
    plain.measure(366, 6)
    expect(plain.stops.value.map(s => s.w)).toEqual(TT_STOPS.filter(w => w >= plain.range.value.min && w <= plain.range.value.max))
    const binder = useTtTable(data, { store: memo(), stops: { across: [3, 2] } })
    binder.measure(366, 6)
    expect(binder.stops.value.map(s => s.w)).toEqual([118, 180])
    expect(binder.snapTo(176)).toBe(180)
  })
})

describe('gap 7: the deal', () => {
  it('number order, a card without a number first, the last landing at ms', () => {
    const cards = [card('c', { number: 9 }), card('o'), card('a', { number: 2 }), card('b', { number: 5 })]
    const d = ttDeal(cards)
    expect(d.map(x => x.id)).toEqual(['o', 'a', 'b', 'c'])
    expect(d.map(x => x.delay)).toEqual([0, 247, 493, 740])
    expect(d.every(x => x.duration === 260)).toBe(true)
    expect(d.at(-1).delay + d.at(-1).duration).toBe(1000)
  })
  it('one card starts at once; reduced motion deals nothing', () => {
    expect(ttDeal([card('a')])).toEqual([{ id: 'a', delay: 0, duration: 260 }])
    expect(ttDeal([card('a'), card('b')], { reduced: true })).toEqual([])
    expect(ttDeal([card('a'), card('b')], { ms: 500, each: 100 }).map(x => x.delay)).toEqual([0, 400])
  })
})

describe('gap 8: a function only', () => {
  const cards = [card('near', { near: true }), card('far')]
  it('ttFilter applies a function only, and ignores a boolean', () => {
    expect(ttFilter(cards, { only: c => !!c.near }).map(c => c.id)).toEqual(['near'])
    expect(ttFilter(cards, { only: true }).map(c => c.id)).toEqual(['near', 'far'])
    expect(ttFilter(cards, { only: false }).map(c => c.id)).toEqual(['near', 'far'])
  })
})

describe('gap 3: points, a card in two sets, a pinned card', () => {
  const data = {
    apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }],
    sets: [
      { id: 'overstory', app: 'treehopper', name: 'The Overstory', short: 'OVERSTORY', total: 4, pts: 120 },
      { id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612 },
    ],
    rarities: {},
  }
  const oak = card('oak', { sets: ['overstory'] })
  const elm = card('elm', { set: 'overstory', held: false })
  const ash = card('ash')
  const cards = [oak, elm, ash]

  it('ttSetsOf: the set alone, or the set then card.sets, once each', () => {
    expect(ttSetsOf(ash)).toEqual(['species'])
    expect(ttSetsOf(oak)).toEqual(['species', 'overstory'])
    expect(ttSetsOf(card('x', { sets: ['species'] }))).toEqual(['species'])
  })
  it('ttGroup by set files a two-set card under each and counts it once a set', () => {
    const groups = ttGroup(ttFilter(cards, { missing: true }), 'set', { ...data, cards, filter: { missing: true } })
    expect(groups.map(g => [g.id, g.held, g.shown, g.cards.map(c => c.id)])).toEqual([
      ['set:overstory', 1, 2, ['oak', 'elm']],
      ['set:species', 2, 2, ['oak', 'ash']],
    ])
  })
  it('the set filter, Missing and the facets read card.sets', () => {
    expect(ttFilter(cards, { set: 'overstory' }).map(c => c.id)).toEqual(['oak'])
    expect(ttFilter(cards, { missing: 'only' }).map(c => c.id)).toEqual(['elm'])
    expect(ttFacets(cards, data).set.map(s => s.id)).toEqual(['overstory', 'species'])
  })
  it('crHead gives pts only when the set has them', () => {
    const [ov, sp] = ttGroup(cards, 'set', { ...data, cards })
    expect(crHead(ov, data).pts).toBe(120)
    expect('pts' in crHead(sp, data)).toBe(false)
  })
  it('ttPin and options.pin: the pinned ids first in their order, the rest as sorted', () => {
    expect(ttPin([ash, elm, oak], ['oak', 'nope', 'elm']).map(c => c.id)).toEqual(['oak', 'elm', 'ash'])
    expect(ttPin([ash, oak], []).map(c => c.id)).toEqual(['ash', 'oak'])
    const t = useTtTable({ ...data, cards: [ash, oak] }, { store: memo(), pin: ['oak'] })
    t.setSort('name')
    expect(t.shown.value.map(c => c.id)).toEqual(['oak', 'ash'])
    const plain = useTtTable({ ...data, cards: [ash, oak] }, { store: memo() })
    plain.setSort('name')
    expect(plain.shown.value.map(c => c.id)).toEqual(['ash', 'oak'])
  })
})
