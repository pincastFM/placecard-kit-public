// @vitest-environment jsdom
/**
 * Treehopper's front on its tile (2026-10-29). The stamp rule (the find number, "No. N" unpadded, over
 * the first-find date), the credit's mark, the rarity pips and the front's own fonts. The look itself is
 * CSS, checked by eye against Treehopper's own tile.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { TtFace, TtTable, setTtHost } from '../../vue/index.js'
import { TT_FACE_FONTS, TT_TH_FONTS, ttPips, ttStamp, ttStampDate } from '../../core/index.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.animate = function () { return { cancel() {}, finish() {}, onfinish: null, oncancel: null } }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}

let head
beforeEach(() => { head = vi.fn(); setTtHost({ head, distUnit: null }) })
afterEach(() => { setTtHost({ head: null, distUnit: null }) })

const TH = (o = {}) => ({
  id: 'th:dogwood', app: 'treehopper', set: 'species', face: 'treehopper', title: "'Appalachian Spring' Flowering Dogwood",
  subtitle: 'Cornus florida', type: 'Species', fact: '', back: '', stats: [], number: 404, of: 612,
  rarity: 'Uncommon', foil: false, img: 'https://example.org/d.jpg', credit: 'Eric Hunt, CC BY-SA 4.0',
  held: true, collected: '2022-04-19', ...o,
})
const DATA = { sets: [{ id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612 }] }
const face = (card, o = {}) => mount(TtFace, { props: { card, data: DATA, ...o } }).element

describe('core: the stamp', () => {
  it('ttStampDate prints R2\'s "19 APR 22"; anything else is empty', () => {
    expect(ttStampDate('2022-04-19')).toBe('19 APR 22')
    expect(ttStampDate('2026-10-05T14:00:00Z')).toBe('5 OCT 26')
    expect(ttStampDate('2026-13-05')).toBe('')
    expect(ttStampDate(null)).toBe('')
  })
  it('a held card with a number: "No. N", unpadded, with its date', () => {
    expect(ttStamp(TH())).toEqual({ n: 404, no: 'No. 404', date: '19 APR 22' })
    expect(ttStamp(TH({ number: 7, collected: null }))).toEqual({ n: 7, no: 'No. 7', date: '' })
    expect(ttStamp(TH({ number: '12' })).no).toBe('No. 12')
  })
  it('a missing card, or one with no number, has none', () => {
    expect(ttStamp(TH({ held: false }))).toBe(null)
    expect(ttStamp(TH({ number: null }))).toBe(null)
    expect(ttStamp(TH({ number: '' }))).toBe(null)
    expect(ttStamp(null)).toBe(null)
  })
  it('pips run 1 (Widespread) to 6 (Very Rare); Unique and unknown words have none', () => {
    expect(['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare'].map(ttPips)).toEqual([1, 2, 3, 4, 5, 6])
    expect(ttPips('very-rare')).toBe(6)
    expect(ttPips('Unique')).toBe(null)
    expect(ttPips('Legendary')).toBe(null)
    expect(ttPips(null)).toBe(null)
  })
})

describe('TtFace: the Treehopper front', () => {
  it('stamps "No. 404" with its date in the art, before the slot', () => {
    const el = face(TH())
    const s = el.querySelector('.ttf-art .ttf-stamp')
    expect(s.getAttribute('data-no')).toBe('404')
    expect(s.querySelector('.ttf-stamp-n').textContent).toBe('No. 404')
    expect(s.querySelector('.ttf-stamp-d').textContent).toBe('19 APR 22')
  })
  it('no first-find date, the number alone', () => {
    const s = face(TH({ collected: null })).querySelector('.ttf-stamp')
    expect(s.querySelector('.ttf-stamp-n').textContent).toBe('No. 404')
    expect(s.querySelector('.ttf-stamp-d')).toBe(null)
  })
  it('no stamp on a missing card, a card with no number, or another app\'s face', () => {
    expect(face(TH({ held: false })).querySelector('.ttf-stamp')).toBe(null)
    expect(face(TH({ number: null })).querySelector('.ttf-stamp')).toBe(null)
    expect(face(TH({ face: 'destination', app: 'provo' })).querySelector('.ttf-stamp')).toBe(null)
    expect(face(TH(), { side: 'back' }).querySelector('.ttf-stamp')).toBe(null)
  })
  it('the credit\'s mark: R2\'s word when given, else "Species photo"', () => {
    expect(face(TH()).querySelector('.ttf-credit').textContent).toBe('Species photo Eric Hunt, CC BY-SA 4.0')
    expect(face(TH({ creditMark: 'Parent species' })).querySelector('.ttf-credit b').textContent).toBe('Parent species')
  })
  it('the rarity word carries its pips; Unique carries none', () => {
    expect(face(TH()).querySelector('.ttf-type').getAttribute('data-pips')).toBe('4')
    expect(face(TH({ rarity: 'Unique', foil: true })).querySelector('.ttf-type').hasAttribute('data-pips')).toBe(false)
  })
  it('the root class and the pinned nodes are unchanged', () => {
    const el = face(TH())
    expect(el.className).toBe('ttf ttf-front ttf-treehopper ttf-t-th ttf-th')
    for (const k of ['.ttf-chip', '.ttf-rar', '.ttf-mark', '.ttf-sub', '.ttf-credit']) expect(el.querySelector(k)).not.toBe(null)
  })
})

describe('the Treehopper front\'s fonts', () => {
  const keys = () => head.mock.calls.flatMap(c => (c[0].link || []).map(l => l.key))
  it('a Treehopper face adds tt-th-fonts beside tt-face-fonts', () => {
    face(TH())
    expect(head).toHaveBeenCalledWith({ link: [{ key: 'tt-face-fonts', rel: 'stylesheet', href: TT_FACE_FONTS }] })
    expect(head).toHaveBeenCalledWith({ link: [{ key: 'tt-th-fonts', rel: 'stylesheet', href: TT_TH_FONTS }] })
  })
  it('another face, or fonts off, adds none', () => {
    face(TH({ face: 'destination', app: 'provo' }))
    face(TH(), { fonts: false })
    expect(keys()).toEqual(['tt-face-fonts'])
  })
  it('TtTable adds it at setup only when the collection holds a Treehopper card', async () => {
    const coll = (f) => ({ apps: [], sets: DATA.sets, rarities: {}, cards: [TH({ face: f })] })
    const tableKeys = async (c) => {
      head.mockClear()
      const w = mount(TtTable, { props: { collection: c, options: { key: 'tt_a4_face' } }, attachTo: document.body })
      await flushPromises(); await nextTick()
      const k = head.mock.calls.map(x => x[0]).find(e => e.htmlAttrs).link.map(l => l.key)
      w.unmount()
      return k
    }
    expect(await tableKeys(coll('treehopper'))).toEqual(['tt-pre-1', 'tt-pre-2', 'tt-face-fonts', 'tt-cr-fonts', 'tt-th-fonts'])
    expect(await tableKeys(coll('destination'))).toEqual(['tt-pre-1', 'tt-pre-2', 'tt-face-fonts', 'tt-cr-fonts'])
  })
})

describe('TtFace: the Treehopper front without a photo (visual check, A4.3)', () => {
  it('a card with no photo prints its latin in the art, as R2\'s bare art', () => {
    const el = face(TH({ img: null, held: false, number: null }))
    expect(el.classList.contains('ttf-typo')).toBe(true)
    expect(el.querySelector('.ttf-art .ttf-latin').textContent).toBe('Cornus florida')
  })
  it('a card with a photo has none', () => {
    expect(face(TH()).querySelector('.ttf-latin')).toBe(null)
  })
})
