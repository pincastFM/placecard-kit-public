// @vitest-environment jsdom
/**
 * The Studio face (1.4.0): Placecard's card design (the board) in the kit. The core: the name fitted as the board
 * fits it (ttStudioName, against the board's own numbers for Duffy Square and The Algonquin Hotel), the locked back's
 * bars (ttLockBars, ttLockValue), the long stamp date, print on, no rarity glyph, no foil, the root class. The face:
 * the front held (the struck stamp, the floodlight) and not yet (the dashed spot, no floodlight); the back held and
 * locked (no word of the story or a value reaches the page; one bar per wrapped line); the chip's stop only on a
 * Trek; tt-pc-fonts from TtFace and TtTable only with a Studio card. Goldens test/vue/goldens/k1/*.html, written by
 * these scenes with K1_WRITE=1 (as v13gold.test.js).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { TtFace, TtTable, setTtHost } from '../../vue/index.js'
import {
  TT_FACES, TT_FACE_FONTS, TT_PC_FONTS, ttCollector, ttFaceClass, ttFurniture, ttLockBars, ttLockValue, ttLook, ttPrintOn,
  ttStampDateLong, ttStudioName,
} from '../../core/face.js'
import { TT_CLASSES } from '../../core/index.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}
let head
beforeEach(() => {
  Element.prototype.animate = function () { return { onfinish: null, oncancel: null, cancel() {}, finish() {} } }
  head = vi.fn()
  setTtHost({ head, distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => { setTtHost({ head: null, distUnit: null }); document.body.innerHTML = '' })

// The two cards the board draws, as a Studio set would carry them
const DUFFY_STORY = "Duffy served as a pastor of Holy Cross Church in Hell's Kitchen. Climb the red steps behind the statue of Father Duffy and sit down for an unobstructed view over Times Square."
const DUFFY = (o = {}) => ({
  id: 'pc:duffy', app: 'studio', set: 'new-york', kind: 'place', face: 'studio', title: 'Duffy Square',
  subtitle: 'Manhattan square', type: 'Place', fact: "Duffy: Army's most highly decorated cleric", back: DUFFY_STORY,
  stats: [{ k: 'Chaplain to', v: '69th Infantry' }, { k: 'Step structure', v: 'Glass alone' }, { k: 'Served in', v: 'France, World War I' }],
  number: 1, of: 2, rarity: 'Common', rarityCount: null, foil: false, accent: null,
  img: 'https://example.org/duffy.jpg', credit: 'Photo: Akashputhraya, CC BY-SA 4.0',
  held: true, collected: '2026-10-14', find: 37, place: 'Duffy Square', collector: { n: 1, of: 2 }, ...o,
})
const ALGONQUIN = (o = {}) => DUFFY({
  id: 'pc:algonquin', title: 'The Algonquin Hotel', subtitle: 'Hotel, 1902', fact: 'Architect: Goldwin Starrett',
  back: "The poem on her stone was published in the New York World. Stand at the hotel's front and find the bronze plaque naming it a National Literary Landmark.",
  stats: [{ k: 'Opened', v: '1902' }, { k: 'Rooms', v: '181' }, { k: 'Lunch daily', v: '1919 to roughly 1929' }],
  number: 2, img: 'https://example.org/algonquin.jpg', credit: 'Photo: Epicgenius, CC BY-SA 4.0', place: 'The Algonquin', collector: { n: 2, of: 2 }, ...o,
})
const NOT = (c) => ({ ...c, held: false, collected: null, find: null, place: null, spot: '0.1 mi' })
const DATA = (set = {}) => ({
  apps: [{ id: 'studio', name: 'Studio', color: '#006638' }],
  sets: [{ id: 'new-york', app: 'studio', name: 'New York', short: 'NEW YORK', total: 2, kind: 'place', ...set }],
  rarities: { place: ['Common', 'Uncommon', 'Rare'] },
})
const TREK = () => DATA({ trek: 4001 })

const mountFace = (card, props = {}, slots) => mount(TtFace, { props: { card, data: TREK(), fonts: false, copyright: '© 2026 Placecard', ...props }, slots })
const face = (card, props, slots) => mountFace(card, props, slots).element
const text = el => el.textContent.replace(/\s+/g, ' ')

describe('ttStudioName: the name as the board fits it, in board units', () => {
  it('Duffy Square, full: one line, 58.07 at 461.84, filling 260', () => {
    const n = ttStudioName('Duffy Square')
    expect(n.lead).toBe('')
    expect(n.full.lines).toEqual([{ text: 'DUFFY SQUARE', base: 461.84, size: 58.07, tl: 260, adj: 'spacingAndGlyphs' }])
    expect(n.full.vb).toBe('8 373 284 149')
  })
  it('Duffy Square, small: two lines, DUFFY 93.71 at 454.12 and SQUARE 88.70 at 534.08', () => {
    const { lines } = ttStudioName('Duffy Square').small
    expect(lines.map(l => [l.text, l.size, l.base])).toEqual([['DUFFY', 93.71, 454.12], ['SQUARE', 88.7, 534.08]])
    expect(lines.every(l => l.tl === 252)).toBe(true)
  })
  it('The Algonquin Hotel, mid: the lead THE set apart at 429.06, ALGONQUIN HOTEL 46.83 at 473.52', () => {
    const n = ttStudioName('The Algonquin Hotel')
    expect(n.lead).toBe('THE')
    expect(n.mid.leadBase).toBe(429.06)
    expect(n.mid.lines).toEqual([{ text: 'ALGONQUIN HOTEL', base: 473.52, size: 46.83, tl: 260, adj: 'spacingAndGlyphs' }])
  })
  it('every tier is there, the back\'s head too; a name with no THE has no lead base', () => {
    const n = ttStudioName('Duffy Square')
    expect(Object.keys(n).sort()).toEqual(['back', 'full', 'lead', 'mid', 'small'])
    for (const k of ['full', 'mid', 'small', 'back']) expect(n[k].leadBase).toBe(null)
    expect(n.back.vb).toBe('8 8 284 118')
  })
  it('prints no dash: an en or em dash in the title is cleaned', () => {
    const n = ttStudioName('Pier — 17')
    expect(JSON.stringify(n)).not.toMatch(/[–—]/)
  })
})

describe('the locked back\'s bars and the stamp date', () => {
  it('ttLockBars wraps the story at 48 characters and draws each line\'s length, 260 at most', () => {
    expect(ttLockBars(DUFFY_STORY)).toEqual([252, 241.5, 220.5, 189])
    expect(ttLockBars('')).toEqual([])
    expect(ttLockBars(null)).toEqual([])
  })
  it('ttLockBars keeps 8 lines at most, or the max given', () => {
    const long = 'word '.repeat(200)
    expect(ttLockBars(long).length).toBe(8)
    expect(ttLockBars(long, 3).length).toBe(3)
    expect(Math.max(...ttLockBars('x'.repeat(80)))).toBe(260)
  })
  it('ttLockValue is the value\'s width, between 40 and 150', () => {
    expect(ttLockValue('69th Infantry')).toBe(79.8)
    expect(ttLockValue('1902')).toBe(40)
    expect(ttLockValue('')).toBe(40)
    expect(ttLockValue('France, World War I and more and more')).toBe(150)
  })
  it('ttStampDateLong is "14 OCT 2026", empty for anything that is not a date', () => {
    expect(ttStampDateLong('2026-10-14')).toBe('14 OCT 2026')
    expect(ttStampDateLong('2026-01-02T10:00:00Z')).toBe('2 JAN 2026')
    expect(ttStampDateLong('x')).toBe('')
    expect(ttStampDateLong(null)).toBe('')
  })
})

describe('the Studio face in the core', () => {
  it('is a kit face', () => { expect(TT_FACES).toContain('studio') })
  it('takes theme pc and no foil, even legendary or with card.foil', () => {
    const L = ttLook(DUFFY(), DATA())
    expect([L.face, L.theme, L.foil]).toEqual(['studio', 'pc', false])
    expect(ttLook(DUFFY({ rarity: 'Legendary', foil: true }), DATA()).foil).toBe(false)
  })
  it('prints by default; card.print and the face entry still win', () => {
    expect(ttPrintOn(DUFFY({ app: 'verythere' }), DATA())).toBe(true)
    expect(ttPrintOn(DUFFY({ print: false }), DATA())).toBe(false)
    expect(ttPrintOn(DUFFY({ app: 'verythere' }), { ...DATA(), faces: { studio: { print: false } } })).toBe(false)
  })
  it('ttCollector pads both numbers to three on the Studio face ("003/005", spec draft 2); unset, as before', () => {
    expect(ttCollector({ n: 1, of: 2 }, 3)).toBe('001/002')
    expect(ttCollector({ n: 37, of: 1204 }, 3)).toBe('0037/1204')
    expect(ttCollector({ n: 4 }, 3)).toBe('004')
    expect(ttCollector({ n: 1, of: 2 })).toBe('1/2')
    expect(ttCollector({ n: 7, of: 612 })).toBe('007/612')
  })
  it('the foot prints no rarity glyph', () => {
    const f = ttFurniture(DUFFY(), DATA())
    expect(f.rm).toBe('')
    expect(f.no).toBe('001/002')
  })
  it('the root takes ttf-pc, not ttf-c20', () => {
    expect(ttFaceClass(ttLook(DUFFY(), DATA()), 'front')).toBe('ttf ttf-front ttf-studio ttf-t-pc ttf-pc')
    expect(ttFaceClass(ttLook(DUFFY(), DATA()), 'back', true)).toBe('ttf ttf-back ttf-studio ttf-t-pc ttf-pc ttf-noimg')
  })
  it('the class list holds the face\'s names and no head key', () => {
    for (const c of ['ttf-pc', 'ttf-studio', 'ttf-pc-stamp', 'ttf-pc-lit', 'ttf-pc-locked', 'ttf-pc-inset']) expect(TT_CLASSES).toContain(c)
    expect(TT_CLASSES).not.toContain('tt-pc-fonts')
  })
})

describe('TtFace, the Studio front', () => {
  it('held: the struck stamp prints the find, the long date and the place; no spot', () => {
    const el = face(DUFFY())
    expect(el.dataset.face).toBe('studio')
    expect(el.dataset.held).toBe('true')
    expect(el.hasAttribute('data-print')).toBe(true)
    const st = el.querySelector('.ttf-pc-stamp')
    expect(st.hasAttribute('data-spot')).toBe(false)
    expect(st.getAttribute('aria-label')).toBe('Collected stamp, No. 37, 14 OCT 2026')
    expect(text(st)).toContain('PLACECARD · COLLECTED')
    expect(text(st)).toContain('37')
    expect(text(st)).toContain('14 OCT 2026')
    expect(text(st)).toContain('PER')
    expect(text(st)).toContain('DUFFY SQUARE')
  })
  it('held: the floodlight crosses the full and mid names, never the small', () => {
    const el = face(DUFFY())
    const tiers = [...el.querySelectorAll('.ttf-pc-nm')].map(n => [n.dataset.tier, n.querySelectorAll('.ttf-pc-lit').length])
    expect(tiers).toEqual([['full', 1], ['mid', 1], ['small', 0]])
    expect(el.querySelector('.ttf-pc-nm[data-tier="full"] .ttf-pc-lit').getAttribute('style')).toMatch(/clip-path: polygon\(/)
  })
  it('held without a place: no PER line; without a find: no number', () => {
    const st = face(DUFFY({ place: null, find: null })).querySelector('.ttf-pc-stamp')
    expect(text(st)).not.toContain('PER')
    expect(st.getAttribute('aria-label')).toBe('Collected stamp, 14 OCT 2026')
  })
  it('not yet: the dashed spot with the distance, no floodlight, full color', () => {
    const el = face(NOT(DUFFY()))
    expect(el.dataset.held).toBe('false')
    const st = el.querySelector('.ttf-pc-stamp')
    expect(st.hasAttribute('data-spot')).toBe(true)
    expect(st.getAttribute('aria-label')).toBe('Empty stamp spot, 0.1 mi to go')
    expect(text(st)).toContain('0.1 MI')
    expect(text(st)).toContain('TO GO')
    expect(el.querySelectorAll('.ttf-pc-lit').length).toBe(0)
    expect(el.querySelector('img.ttf-img')).not.toBe(null)
  })
  it('prints no rarity and no foil', () => {
    const el = face(DUFFY({ rarity: 'Legendary', foil: true }))
    expect(text(el)).not.toContain('Legendary')
    expect(el.dataset.foil).toBe('false')
    expect(el.querySelector('.ttf-shine, .ttf-rar, .ttf-furn-rm')).toBe(null)
  })
  it('the chip prints the stop only when the set names a trek', () => {
    expect(face(DUFFY()).querySelector('.ttf-chip').textContent).toBe('NEW YORK · No. 01')
    expect(face(DUFFY(), { data: DATA() }).querySelector('.ttf-chip').textContent).toBe('NEW YORK')
  })
  it('the print foot holds the collector number and the copyright; the credit is on the art with its word', () => {
    const el = face(DUFFY())
    expect(el.querySelector('.ttf-furn-no').textContent).toBe('001/002')
    expect(el.querySelector('.ttf-furn-cp').textContent).toBe('© 2026 Placecard')
    expect(el.querySelector('.ttf-art .ttf-credit').textContent).toBe('Photo: Akashputhraya, CC BY-SA 4.0')
  })
  it('the print foot prints the short credit, and under it the app\'s word and, when its entry names one, its site', () => {
    let el = face(DUFFY())
    expect(el.querySelector('.ttf-furn .ttf-furn-cr').textContent).toBe('PHOTO AKASHPUTHRAYA')
    expect(el.querySelector('.ttf-furn .ttf-pc-line').textContent).toBe('STUDIO')
    const data = TREK(); data.apps[0].site = 'placecard.io'
    el = face(DUFFY(), { data })
    expect(el.querySelector('.ttf-furn .ttf-pc-line').textContent).toBe('STUDIO · PLACECARD.IO')
    expect(face(DUFFY({ credit: null })).querySelector('.ttf-furn .ttf-furn-cr')).toBe(null)
    expect(face(DUFFY({ print: false })).querySelector('.ttf-furn')).toBe(null)
  })
  it('the name is in the DOM once as text, for a reader; the drawn tiers are hidden from it', () => {
    const el = face(ALGONQUIN())
    expect(el.querySelector('.ttf-title').textContent).toBe('The Algonquin Hotel')
    for (const n of el.querySelectorAll('.ttf-pc-nm')) expect(n.getAttribute('aria-hidden')).toBe('true')
    const mid = el.querySelector('.ttf-pc-nm[data-tier="mid"] svg')
    expect(mid.getAttribute('viewBox')).toBe('8 368 284 160')
    expect(mid.querySelector('text').textContent).toBe('THE')
    expect(mid.querySelector('text').getAttribute('y')).toBe('429.06')
  })
  it('labels replace the stamp\'s words', () => {
    const st = face(NOT(DUFFY()), { labels: { toGo: 'à pied' } }).querySelector('.ttf-pc-stamp')
    expect(text(st)).toContain('À PIED')
    expect(text(face(DUFFY(), { labels: { stampHead: 'Kept' } }).querySelector('.ttf-pc-stamp'))).toContain('KEPT')
  })
})

describe('TtFace, the Studio back', () => {
  const back = (card, props, slots) => face(card, { side: 'back', ...props }, slots)
  it('held: first found with the date and the find, the values, the story', () => {
    const el = back(DUFFY())
    expect(text(el.querySelector('.ttf-pc-find'))).toBe('First found14 OCT 2026No. 37')
    expect([...el.querySelectorAll('.ttf-cell-v')].map(v => v.textContent)).toEqual(['69th Infantry', 'Glass alone', 'France, World War I'])
    expect(el.querySelector('.ttf-bk-text').textContent).toBe(DUFFY_STORY)
    expect(el.querySelector('.ttf-pc-locked')).toBe(null)
    expect(el.querySelector('.ttf-pc-punch').hasAttribute('data-on')).toBe(true)
  })
  it('locked: no word of the story or a value reaches the page', () => {
    const el = back(NOT(DUFFY()))
    const all = el.textContent
    expect(all).not.toContain('Duffy served')
    expect(all).not.toContain('Holy Cross')
    for (const v of ['69th Infantry', 'Glass alone', 'France']) expect(all).not.toContain(v)
    expect(el.querySelector('.ttf-bk-text')).toBe(null)
  })
  it('locked: the keys stay, each value a bar of its width; one bar per wrapped story line', () => {
    const el = back(NOT(DUFFY()))
    expect([...el.querySelectorAll('.ttf-cell-k')].map(k => k.textContent)).toEqual(['Chaplain to', 'Step structure', 'Served in'])
    expect([...el.querySelectorAll('.ttf-cell-v .ttf-pc-bar')].map(b => b.style.getPropertyValue('--pc-w'))).toEqual(['69th Infantry', 'Glass alone', 'France, World War I'].map(v => +(ttLockValue(v) / 3).toFixed(3) + 'cqi'))
    expect(el.querySelectorAll('.ttf-pc-locked > .ttf-pc-bar').length).toBe(ttLockBars(DUFFY_STORY).length)
  })
  it('locked: the lock says go there, with the distance; not yet found; the punch is open', () => {
    const el = back(NOT(DUFFY()))
    expect(text(el.querySelector('.ttf-pc-lock'))).toBe('Go there to turn it over0.1 MI Away')
    expect(el.querySelector('.ttf-pc-find').classList.contains('is-not')).toBe(true)
    expect(text(el.querySelector('.ttf-pc-find'))).toBe('Not yet found')
    expect(el.querySelector('.ttf-pc-punch').hasAttribute('data-on')).toBe(false)
  })
  it('locked with no story still draws the lock', () => {
    const el = back(NOT(DUFFY({ back: '' })))
    expect(el.querySelectorAll('.ttf-pc-locked > .ttf-pc-bar').length).toBe(0)
    expect(el.querySelector('.ttf-pc-lock')).not.toBe(null)
  })
  it('the head prints the chip, the sub line and the name; the foot the collector, the copyright and the punch', () => {
    const el = back(DUFFY())
    expect(el.querySelector('.ttf-pc-head .ttf-chip').textContent).toBe('NEW YORK · No. 01')
    expect(el.querySelector('.ttf-pc-head .ttf-bk-sub').textContent).toBe('Manhattan square')
    expect(el.querySelector('.ttf-pc-head .ttf-bk-title').textContent).toBe('Duffy Square')
    expect(el.querySelector('.ttf-pc-foot .ttf-furn-no').textContent).toBe('001/002')
    expect(el.querySelector('.ttf-pc-foot .ttf-furn-cp').textContent).toBe('© 2026 Placecard')
    expect(el.querySelector('.ttf-pc-punch').textContent).toBe('Punched on site')
    expect(el.querySelector('.ttf-pc-app').textContent).toBe('Studio')
  })
  it('the street inset: card.inset\'s image and caption, or the inset slot in the image\'s place', () => {
    const ins = { img: 'https://example.org/map.png', caption: 'W 47 St at 7 Av' }
    let el = back(DUFFY({ inset: ins }))
    expect(el.querySelector('.ttf-pc-map img').getAttribute('src')).toBe(ins.img)
    expect(el.querySelector('.ttf-pc-cap').textContent).toBe('W 47 ST AT 7 AV')
    el = back(DUFFY({ inset: ins }), {}, { inset: '<i class="x-map">map</i>' })
    expect(el.querySelector('.ttf-pc-map .x-map')).not.toBe(null)
    expect(el.querySelector('.ttf-pc-map img')).toBe(null)
    expect(back(DUFFY()).querySelector('.ttf-pc-inset')).toBe(null)
  })
  it('labels replace the back\'s words', () => {
    const el = back(NOT(DUFFY()), { labels: { goThere: 'Walk there', away: 'off', notYetFound: 'Not yet', punched: 'Punched' } })
    expect(text(el.querySelector('.ttf-pc-lock'))).toBe('Walk there0.1 MI off')
    expect(text(el.querySelector('.ttf-pc-find'))).toBe('Not yet')
    expect(el.querySelector('.ttf-pc-punch').textContent).toBe('Punched')
  })
})

describe('the Studio face\'s fonts', () => {
  const keys = () => head.mock.calls.flatMap(c => (c[0].link || []).map(l => l.key))
  it('a Studio face adds tt-pc-fonts beside tt-face-fonts', () => {
    face(DUFFY(), { fonts: true })
    expect(head).toHaveBeenCalledWith({ link: [{ key: 'tt-face-fonts', rel: 'stylesheet', href: TT_FACE_FONTS }] })
    expect(head).toHaveBeenCalledWith({ link: [{ key: 'tt-pc-fonts', rel: 'stylesheet', href: TT_PC_FONTS }] })
  })
  it('another face, or fonts off, adds none', () => {
    face(DUFFY({ face: 'stop', app: 'verythere' }), { fonts: true })
    face(DUFFY(), { fonts: false })
    expect(keys()).toEqual(['tt-face-fonts'])
  })
  it('TtTable adds it at setup only when the collection holds a Studio card', async () => {
    const coll = f => ({ ...DATA(), cards: [DUFFY({ face: f })] })
    const tableKeys = async (c) => {
      head.mockClear()
      const w = mount(TtTable, { props: { collection: c, options: { key: 'tt_k1_face' } }, attachTo: document.body })
      await flushPromises(); await nextTick()
      const k = head.mock.calls.map(x => x[0]).find(e => e.htmlAttrs).link.map(l => l.key)
      w.unmount()
      return k
    }
    expect(await tableKeys(coll('studio'))).toEqual(['tt-pre-1', 'tt-pre-2', 'tt-face-fonts', 'tt-cr-fonts', 'tt-pc-fonts'])
    expect(await tableKeys(coll('stop'))).toEqual(['tt-pre-1', 'tt-pre-2', 'tt-face-fonts', 'tt-cr-fonts'])
  })
})

// Goldens: the face's markup, front and back, held and locked
const html = (card, props) => { const w = mountFace(card, props); const s = w.html(); w.unmount(); return s }
const SCENES = {
  'front-held': () => html(DUFFY()),
  'front-locked': () => html(NOT(DUFFY())),
  'back-held': () => html(ALGONQUIN({ inset: { img: 'https://example.org/map.png', caption: 'W 44 St' } }), { side: 'back' }),
  'back-locked': () => html(NOT(DUFFY()), { side: 'back' }),
}
const GOLD = resolve(__dirname, 'goldens/k1')
describe('K1 goldens: the Studio face, front and back, held and locked', () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    it(name, () => {
      const out = scene()
      const file = resolve(GOLD, `${name}.html`)
      if (process.env.K1_WRITE) { mkdirSync(GOLD, { recursive: true }); writeFileSync(file, out) }
      expect(out).toBe(readFileSync(file, 'utf8'))
    })
  }
})
