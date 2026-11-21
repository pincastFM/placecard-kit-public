/**
 * The shared card's pure part: which cards print, the collector number, the rarity glyph and the foot.
 */
import { describe, it, expect } from 'vitest'
import { CR_REST, TT_RMARK, crPile, crPrintEdges, crTransform, ttCollector, ttFurniture, ttPrintOn, ttRarityIndex } from '../../core/index.js'

const WORDS = ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique']

describe('ttPrintOn: card, then face entry, then the default', () => {
  const th = { face: 'treehopper', app: 'treehopper' }
  const stop = { face: 'stop', app: 'verythere' }
  const dest = { face: 'destination', app: 'verythere' }
  const pc = { face: 'stop', app: 'studio' }
  it('defaults: on for the Treehopper face and the Placecard app, off for Provo and VeryThere (item 11)', () => {
    expect(ttPrintOn(th, {})).toBe(true)
    expect(ttPrintOn(pc, {})).toBe(true)
    expect(ttPrintOn(stop, {})).toBe(false)
    expect(ttPrintOn(dest, {})).toBe(false)
    expect(ttPrintOn(null, null)).toBe(false)
  })
  it('the face entry overrides the default, keyed or as a list', () => {
    expect(ttPrintOn(stop, { faces: { stop: { print: true } } })).toBe(true)
    expect(ttPrintOn(th, { faces: { treehopper: { print: false } } })).toBe(false)
    expect(ttPrintOn(dest, { faces: [{ id: 'destination', print: true }] })).toBe(true)
    expect(ttPrintOn(dest, { faces: { stop: { print: true } } })).toBe(false)
    expect(ttPrintOn(th, { faces: { treehopper: {} } })).toBe(true)
    expect(ttPrintOn({ face: 'constructor' }, { faces: {} })).toBe(false)
  })
  it('card.print wins over both', () => {
    expect(ttPrintOn({ ...th, print: false }, {})).toBe(false)
    expect(ttPrintOn({ ...stop, print: true }, { faces: { stop: { print: false } } })).toBe(true)
    expect(ttPrintOn({ ...stop, print: 'yes' }, {})).toBe(false)
  })
})

describe('the collector number', () => {
  it('pads n to of\'s digits: "NNN/of"', () => {
    expect(ttCollector({ n: 7, of: 612 })).toBe('007/612')
    expect(ttCollector({ n: 612, of: 612 })).toBe('612/612')
    expect(ttCollector({ n: 3, of: 4260 })).toBe('0003/4260')
    expect(ttCollector({ n: 5, of: 9 })).toBe('5/9')
  })
  it('n alone without a total; nothing for a bad n', () => {
    expect(ttCollector({ n: 12 })).toBe('12')
    expect(ttCollector({ n: 0, of: 612 })).toBe('')
    expect(ttCollector({ n: 1.5, of: 612 })).toBe('')
    expect(ttCollector(null)).toBe('')
    expect(ttCollector(7)).toBe('')
  })
})

describe('the rarity glyph', () => {
  const data = { rarities: { species: WORDS, stop: ['Common', 'Uncommon', 'Legendary'] } }
  it('one glyph per place in the card\'s own list, seven in all', () => {
    expect(TT_RMARK).toHaveLength(7)
    expect(new Set(TT_RMARK).size).toBe(7)
    WORDS.forEach((w, i) => expect(ttRarityIndex({ kind: 'species', rarity: w }, data)).toBe(i))
  })
  it('the kind\'s list first, then the app\'s, then any list holding the word', () => {
    expect(ttRarityIndex({ kind: 'stop', rarity: 'Uncommon' }, data)).toBe(1)
    expect(ttRarityIndex({ app: 'species', rarity: 'Rare' }, data)).toBe(4)
    expect(ttRarityIndex({ rarity: 'Legendary' }, data)).toBe(2)
  })
  it('none for no word, an unknown word, or a place past the seventh', () => {
    expect(ttRarityIndex({ kind: 'species' }, data)).toBe(-1)
    expect(ttRarityIndex({ kind: 'species', rarity: 'Mythic' }, data)).toBe(-1)
    const long = { rarities: { k: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] } }
    expect(ttRarityIndex({ kind: 'k', rarity: 'g' }, long)).toBe(6)
    expect(ttRarityIndex({ kind: 'k', rarity: 'h' }, long)).toBe(-1)
    expect(ttRarityIndex({ rarity: 'Rare' }, null)).toBe(-1)
  })
})

describe('the foot', () => {
  const data = { rarities: { species: WORDS } }
  it('collector number, glyph, credit with its mark, copyright', () => {
    const f = ttFurniture({ kind: 'species', rarity: 'Unique', collector: { n: 7, of: 612 }, credit: 'Photo: Eric Hunt, CC BY-SA 4.0', creditMark: 'Genus' }, data, '© Pincast')
    expect(f).toEqual({ no: '007/612', rm: TT_RMARK[6], cr: 'Genus · Eric Hunt, CC BY-SA 4.0', cp: '© Pincast' })
  })
  it('a child prints its mark in place of a collector number', () => {
    expect(ttFurniture({ mark: 'Tree 574031' }, data).no).toBe('Tree 574031')
    expect(ttFurniture({ mark: 'Tree 574031', collector: { n: 2, of: 9 } }, data).no).toBe('2/9')
  })
  it('no credit, no mark on its own; an empty foot is null', () => {
    expect(ttFurniture({ creditMark: 'Genus' }, data)).toBe(null)
    expect(ttFurniture({}, data, '')).toBe(null)
    expect(ttFurniture({}, data, '© Pincast')).toEqual({ no: '', rm: '', cr: '', cp: '© Pincast' })
  })
  it('dashes never reach the foot', () => {
    expect(ttFurniture({ credit: 'A — B' }, data).cr).toBe('A, B')
  })
})

describe('a stack of printing cards (A4.9 item 8)', () => {
  it('crPrintEdges: none for one card, one per doubling, 6 at most', () => {
    expect([0, 1, 2, 3, 4, 5, 8, 9, 16, 33, 64, 65, 612].map(crPrintEdges)).toEqual([0, 0, 1, 2, 2, 3, 3, 4, 4, 6, 6, 6, 6])
    expect(crPrintEdges(undefined)).toBe(0)
    expect(crPrintEdges('4')).toBe(2)
  })
  const cards = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id }))
  it('with edges: the first card flat on top, edges deepest first', () => {
    const p = crPile('g:species', cards, { edges: true })
    expect(p.layers).toEqual([{ card: cards[0], k: 0, t: CR_REST, transform: '' }])
    expect(p.edges).toEqual([3, 2, 1])
    expect(p.cover).toBe(CR_REST)
    expect(p.coverTransform).toBe('')
    expect(crPile('g', cards.slice(0, 1), { edges: true }).edges).toEqual([])
    expect(crPile('g', [], { edges: true })).toEqual({ layers: [], edges: [], cover: CR_REST, coverTransform: '' })
  })
  it('without: the seeded fan of up to four, as before, and no edges', () => {
    const p = crPile('g:species', cards)
    expect(p.edges).toEqual([])
    expect(p.layers.map(L => L.k)).toEqual([3, 2, 1, 0])
    expect(p.layers[3].card).toBe(cards[0])
    expect(p.coverTransform).toBe(crTransform(0, 0, p.cover))
    expect(p.coverTransform).not.toBe('')
    expect(crPile('g:species', cards, { edges: false })).toEqual(p)
  })
})
