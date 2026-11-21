// @vitest-environment jsdom
/**
 * The Studio face draws a card's accent on its waterline, the stripe between the photo and the plate (1.5.0,
 * unreleased). The core: ttContrast (WCAG 2) and ttStudioAccent, which keeps the accent when it holds 3:1 on the
 * plate's Night and mixes it toward the card's Stock until it does, and refuses anything ttHex refuses. The face:
 * data-ac and the wl custom property on a Studio front with an accent, the waterline's rule reading that property
 * only under data-ac, the chip's mark still Placecard green, the back and every other face untouched. Unset (or a
 * name), the markup is 1.4.0's: the goldens in goldens/k1 (k1studio.test.js) hold, and the scenes here match them
 * byte for byte. Goldens test/vue/goldens/pl035/*.html, written by these scenes with PL035_WRITE=1 (as
 * k1studio.test.js).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { TtFace, setTtHost } from '../../vue/index.js'
import { TT_STUDIO_WL_MIN, ttContrast, ttHex, ttLook, ttMix, ttStudioAccent } from '../../core/face.js'
import * as core from '../../core/index.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
beforeEach(() => {
  Element.prototype.animate = function () { return { onfinish: null, oncancel: null, cancel() {}, finish() {} } }
  setTtHost({ head: vi.fn(), distUnit: null })
})
afterEach(() => { setTtHost({ head: null, distUnit: null }); document.body.innerHTML = '' })

const NIGHT = '#12261C'
const STOCK = '#FFFDF6'
// The golden card of k1studio.test.js (DUFFY), so an unset accent can be held against its goldens
const DUFFY = (o = {}) => ({
  id: 'pc:duffy', app: 'studio', set: 'new-york', kind: 'place', face: 'studio', title: 'Duffy Square',
  subtitle: 'Manhattan square', type: 'Place', fact: "Duffy: Army's most highly decorated cleric",
  back: "Duffy served as a pastor of Holy Cross Church in Hell's Kitchen. Climb the red steps behind the statue of Father Duffy and sit down for an unobstructed view over Times Square.",
  stats: [{ k: 'Chaplain to', v: '69th Infantry' }, { k: 'Step structure', v: 'Glass alone' }, { k: 'Served in', v: 'France, World War I' }],
  number: 1, of: 2, rarity: 'Common', rarityCount: null, foil: false, accent: null,
  img: 'https://example.org/duffy.jpg', credit: 'Photo: Akashputhraya, CC BY-SA 4.0',
  held: true, collected: '2026-10-14', find: 37, place: 'Duffy Square', collector: { n: 1, of: 2 }, ...o,
})
const NOT = (c) => ({ ...c, held: false, collected: null, find: null, place: null, spot: '0.1 mi' })
const DATA = () => ({
  apps: [{ id: 'studio', name: 'Studio', color: '#006638' }],
  sets: [{ id: 'new-york', app: 'studio', name: 'New York', short: 'NEW YORK', total: 2, kind: 'place', trek: 4001 }],
  rarities: { place: ['Common', 'Uncommon', 'Rare'] },
})
const mountFace = (card, props = {}) => mount(TtFace, { props: { card, data: DATA(), fonts: false, copyright: '© 2026 Placecard', ...props } })
const html = (card, props) => { const w = mountFace(card, props); const s = w.html(); w.unmount(); return s }
const K1 = resolve(__dirname, 'goldens/k1')
const k1 = name => readFileSync(resolve(K1, `${name}.html`), 'utf8')
const SRC = readFileSync(resolve(__dirname, '../../vue/TtFace.vue'), 'utf8')
const STYLE = SRC.slice(SRC.indexOf('<style'))

describe('ttContrast: WCAG 2', () => {
  it('black on white is 21, a color on itself 1, either order', () => {
    expect(ttContrast('#000000', '#ffffff')).toBeCloseTo(21, 6)
    expect(ttContrast('#ffffff', '#000000')).toBeCloseTo(21, 6)
    expect(ttContrast('#3e9be9', '#3E9BE9')).toBe(1)
  })
  it('the Greenhouse figures: ink 14.98 on ground, quiet 6.24 on ground (v2/kit/tokens.py)', () => {
    expect(ttContrast('#12261C', '#FBF8EE').toFixed(2)).toBe('14.98')
    expect(ttContrast('#4E6156', '#FBF8EE').toFixed(2)).toBe('6.24')
  })
})

describe('ttStudioAccent: the waterline\'s color, 3:1 on the plate\'s Night', () => {
  it('keeps an accent that already holds it, in lower case; Cornflower, Primrose and Chartreuse (the board\'s waterlines) as they are', () => {
    expect(TT_STUDIO_WL_MIN).toBe(3)
    expect(ttStudioAccent('#3E9BE9')).toBe('#3e9be9')
    expect(ttStudioAccent('#FFD23F')).toBe('#ffd23f')
    expect(ttStudioAccent('#44C16C')).toBe('#44c16c')
    expect(ttStudioAccent('#F2553D')).toBe('#f2553d')
    expect(ttStudioAccent('f2553d')).toBe('#f2553d')
    expect(ttStudioAccent('#fd0')).toBe('#ffdd00')
  })
  it('lightens a dark accent toward the Stock until it holds 3:1, and no further', () => {
    for (const a of ['#1e3a8a', '#0f8048', '#006638', '#12261c', '#000000', '#c8361f', '#245c93', '#6b2a1e']) {
      const c = ttStudioAccent(a)
      expect(c, a).toMatch(/^#[0-9a-f]{6}$/)
      expect(ttContrast(c, NIGHT), a).toBeGreaterThanOrEqual(3)
      if (c !== ttHex(a)) {
        // one twentieth less of the Stock would fail: the least lightening that passes
        let i = 1
        while (ttMix(ttHex(a), STOCK, 1 - i / 20) !== c) i += 1
        const less = i === 1 ? ttHex(a) : ttMix(ttHex(a), STOCK, 1 - (i - 1) / 20)
        expect(ttContrast(less, NIGHT), a).toBeLessThan(3)
      }
    }
    expect(ttStudioAccent('#1e3a8a')).not.toBe('#1e3a8a')
    expect(ttStudioAccent('#12261c')).not.toBe('#12261c')
  })
  it('refuses what ttHex refuses: a name, a word, a bad hex, nothing', () => {
    for (const a of ['sky', 'cornflower', 'red', '#12345', '#ggg', '', null, undefined, 42, {}]) expect(ttStudioAccent(a), String(a)).toBe(null)
  })
  it('is in the core\'s exports', () => {
    expect(core.ttStudioAccent).toBe(ttStudioAccent)
    expect(core.ttContrast).toBe(ttContrast)
    expect(core.TT_STUDIO_WL_MIN).toBe(3)
  })
})

describe('ttLook.wl', () => {
  it('is the Studio face\'s waterline color, and null with no accent ttHex reads', () => {
    expect(ttLook(DUFFY({ accent: '#F2553D' }), DATA()).wl).toBe('#f2553d')
    expect(ttLook(DUFFY({ accent: '#1e3a8a' }), DATA()).wl).toBe(ttStudioAccent('#1e3a8a'))
    expect(ttLook(DUFFY(), DATA()).wl).toBe(null)
    expect(ttLook(DUFFY({ accent: 'sky' }), DATA()).wl).toBe(null)
  })
  it('is null on every other face, accent or not; their ac and dp are as before', () => {
    for (const face of ['stop', 'destination', 'treehopper']) {
      const L = ttLook(DUFFY({ face, accent: '#F2553D' }), DATA())
      expect(L.wl, face).toBe(null)
      expect(L.ac, face).toBe('#f2553d')
    }
    // the Studio face's ac and dp are what they were: the waterline reads its own color
    const L = ttLook(DUFFY({ accent: '#1e3a8a' }), DATA())
    expect(L.ac).toBe('#1e3a8a')
  })
})

describe('TtFace, the Studio waterline', () => {
  it('a front with an accent: data-ac on the root and the wl property in its style, the waterline still one stripe', () => {
    const el = mountFace(DUFFY({ accent: '#F2553D' })).element
    expect(el.hasAttribute('data-ac')).toBe(true)
    expect(el.getAttribute('data-ac')).toBe('')
    expect(el.style.getPropertyValue('--wl')).toBe('#f2553d')
    expect(el.querySelectorAll('.ttf-pc-wl')).toHaveLength(1)
  })
  it('draws the lightened color for a dark accent, not the accent itself', () => {
    const el = mountFace(DUFFY({ accent: '#1e3a8a' })).element
    expect(el.style.getPropertyValue('--wl')).toBe(ttStudioAccent('#1e3a8a'))
    expect(el.style.getPropertyValue('--ac')).toBe('#1e3a8a')
  })
  it('the not-yet front takes it too (the card stays full color, H155)', () => {
    const el = mountFace(NOT(DUFFY({ accent: '#44C16C' }))).element
    expect(el.style.getPropertyValue('--wl')).toBe('#44c16c')
    expect(el.hasAttribute('data-ac')).toBe(true)
  })
  it('the back has no waterline and takes neither', () => {
    const el = mountFace(DUFFY({ accent: '#F2553D' }), { side: 'back' }).element
    expect(el.hasAttribute('data-ac')).toBe(false)
    expect(el.style.getPropertyValue('--wl')).toBe('')
  })
  it('another face with an accent takes neither', () => {
    for (const face of ['stop', 'destination', 'treehopper']) {
      const el = mountFace(DUFFY({ face, accent: '#F2553D' })).element
      expect(el.hasAttribute('data-ac'), face).toBe(false)
      expect(el.style.getPropertyValue('--wl'), face).toBe('')
    }
  })
  it('unset, a name or a bad hex: the K1 goldens byte for byte, front and back, held and locked', () => {
    for (const accent of [null, undefined, 'sky', '#12345']) {
      expect(html(DUFFY({ accent })), String(accent)).toBe(k1('front-held'))
      expect(html(NOT(DUFFY({ accent }))), String(accent)).toBe(k1('front-locked'))
      expect(html(NOT(DUFFY({ accent })), { side: 'back' }), String(accent)).toBe(k1('back-locked'))
    }
  })
  it('the stylesheet: the waterline reads the wl property only under data-ac, Cornflower otherwise; the chip\'s mark stays green', () => {
    expect(STYLE).toContain('.ttf-pc-wl { flex: none; height: 3cqi; background: var(--pc-corn); }')
    expect(STYLE).toContain('.ttf-pc[data-ac] .ttf-pc-wl { background: var(--wl); }')
    expect(STYLE.match(/var\(--wl\)/g)).toHaveLength(1)
    expect(STYLE).toMatch(/\.ttf-pc \.ttf-chip::before \{[^}]*background: var\(--pc-mark\);/)
    expect(STYLE).toContain('--pc-mark: #006638;')
    // no tier rule paints the waterline: they set its height alone
    for (const m of STYLE.matchAll(/^\s*\.ttf-pc-wl \{([^}]*)\}/gm)) if (!m[1].includes('flex: none')) expect(m[1].trim()).toMatch(/^height: [\d.]+cqi;$/)
  })
})

// The accent's scenes: a front held and not yet with a light accent (as given) and a dark one (lightened)
const SCENES = {
  'front-held-coral': () => html(DUFFY({ accent: '#F2553D' })),
  'front-locked-chartreuse': () => html(NOT(DUFFY({ accent: '#44C16C' }))),
  'front-held-navy': () => html(DUFFY({ accent: '#1e3a8a' })),
  'back-held-coral': () => html(DUFFY({ accent: '#F2553D' }), { side: 'back' }),
}
const GOLD = resolve(__dirname, 'goldens/pl035')
describe('PL-035 A goldens: the Studio waterline in a card\'s accent', () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    it(name, () => {
      const out = scene()
      const file = resolve(GOLD, `${name}.html`)
      if (process.env.PL035_WRITE) { mkdirSync(GOLD, { recursive: true }); writeFileSync(file, out) }
      expect(out).toBe(readFileSync(file, 'utf8'))
    })
  }
  it('each accent golden is the K1 golden but for data-ac and the wl property on the root', () => {
    const strip = s => s.replace(' data-ac=""', '').replace(/ --wl: #[0-9a-f]{6};/, '')
    const read = n => readFileSync(resolve(GOLD, `${n}.html`), 'utf8')
    const ac = (s, hex) => s.replace(/--ac: #[0-9a-f]{6}; --dp: #[0-9a-f]{6};/, `--ac: ${hex}; --dp: ${ttLook(DUFFY({ accent: hex }), DATA()).dp};`)
    expect(strip(read('front-held-coral'))).toBe(ac(k1('front-held'), '#f2553d'))
    expect(strip(read('front-locked-chartreuse'))).toBe(ac(k1('front-locked'), '#44c16c'))
    expect(strip(read('front-held-navy'))).toBe(k1('front-held'))
    expect(read('back-held-coral')).not.toContain('data-ac')
    expect(read('front-held-coral')).toContain(' data-ac=""')
    expect(read('front-held-navy')).toContain(`--wl: ${ttStudioAccent('#1e3a8a')};`)
  })
})
