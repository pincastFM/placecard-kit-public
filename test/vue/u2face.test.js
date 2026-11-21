// @vitest-environment jsdom
/**
 * Kit 1.2.0: the Treehopper face's additions. Markup additions are opt-in card fields, labels and slots; CSS
 * additions change .ttf-th rules only. Unset, each scene below renders 1.1.0's markup byte for byte:
 * test/vue/goldens/u2/*.html were written by this file's scenes on the kit just before these changes with
 * U2_WRITE=1. The goldens in goldens/k2 (k2labels.test.js) still hold too. The date-only stamp and the credit as
 * given are opt-in card fields (`dateStamp`, `creditAsGiven`). No mark before a type's own credit is
 * `labels.speciesPhoto: ''`, and a card's empty creditMark falls back as at 1.1.0.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { TtFace, TtCard, TtTable, setTtHost, ttLock } from '../../vue/index.js'
import { TT_TH_FONTS, ttFaceCredit, ttFurniture, ttStamp } from '../../core/index.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}
const anims = []
const settle = async () => { anims.splice(0).forEach(a => a.onfinish && a.onfinish()); await flushPromises(); await nextTick() }
beforeEach(() => {
  Element.prototype.animate = function () { const a = { onfinish: null, oncancel: null, cancel() {}, finish() {} }; anims.push(a); return a }
  setTtHost({ head: vi.fn(), distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => { setTtHost({ head: null, distUnit: null }); document.body.innerHTML = ''; ttLock(false) })

const DATA = {
  sets: [{ id: 'species', app: 'treehopper', name: 'Species', short: 'SPECIES', total: 612 }],
  rarities: { species: ['Widespread', 'Common', 'Numerous', 'Uncommon', 'Rare', 'Very Rare', 'Unique'] },
}
// A held species card: number, latin, stats, story, rarity count, a photo with its credit
const TH = (o = {}) => ({
  id: 'th:dogwood', app: 'treehopper', set: 'species', kind: 'species', face: 'treehopper', title: 'Flowering Dogwood',
  subtitle: 'Cornus florida', type: 'Species', fact: 'In the city · 6,700', back: 'A small tree of the understory.',
  stats: [{ k: 'Height', v: '30 ft' }, { k: 'Bloom', v: 'April' }], number: 404, of: 612, rarity: 'Uncommon',
  rarityCount: '1,204 in the city', foil: false, img: 'https://example.org/d.jpg', credit: 'Eric Hunt, CC BY-SA 4.0',
  held: true, collected: '2022-04-19', collector: { n: 7, of: 612 }, ...o,
})
// A tree card, as the app's treeFace builds it (no number, a mark, its fact "Tree N · Borough")
const TREE = (o = {}) => TH({
  id: 'tree:574031', kind: 'tree', type: 'Tree', number: null, of: null, mark: 'Tree 574031', subtitle: 'Cornus florida',
  fact: 'Tree 574031 · Brooklyn', collector: null, rarityCount: null, stats: [], ...o,
})
const STOP = (o = {}) => ({
  id: 'vt:3', app: 'verythere', set: 'walk-1', kind: 'stop', title: 'The Mill', subtitle: 'Riverside', type: 'Stop',
  fact: 'Built 1820', back: 'Built 1820.', stats: [], number: 3, of: 12, rarity: '', foil: false, accent: null,
  img: 'https://example.org/m.jpg', credit: 'Photo: A. Person', held: true, ...o,
})
const WALK = { sets: [{ id: 'walk-1', app: 'verythere', name: 'Old Town', short: 'OLD TOWN' }], rarities: {} }

const markup = html => html.replace(/(<input\b[^>]*?) value="[^"]*"/g, '$1')
const faceW = (card, o = {}) => mount(TtFace, { props: { card, data: card.app === 'verythere' ? WALK : DATA, fonts: false, ...o.props }, slots: o.slots })
const face = (card, o) => faceW(card, o).element
const txt = (el, sel) => { const e = el.querySelector(sel); return e ? e.textContent : null }

// Each scene is a face 1.1.0 already drew; unset, these additions must leave it as it was
const SCENES = {
  'th-back': () => faceW(TH(), { props: { side: 'back' } }),
  'th-back-missing': () => faceW(TH({ held: false, collected: null, number: null }), { props: { side: 'back' } }),
  'th-back-slot': () => faceW(TH({ credit: null }), { props: { side: 'back' }, slots: { more: '<i class="x-more">photos</i>' } }),
  'th-front-credit': () => faceW(TH({ print: false })),
  'th-front-genus': () => faceW(TH({ print: false, creditMark: 'Genus' })),
  'th-front-print': () => faceW(TH({ creditMark: 'Parent species' }), { props: { copyright: '© Pincast' } }),
  'tree-front': () => faceW(TREE({ collected: null })),
  'stop-front': () => faceW(STOP()),
  'stop-back': () => faceW(STOP(), { props: { side: 'back' } }),
}
const GOLD = resolve(__dirname, 'goldens/u2')
describe('U2 unset: each scene is 1.1.0\'s markup, byte for byte', () => {
  for (const [name, scene] of Object.entries(SCENES)) {
    it(name, () => {
      const w = scene()
      const html = markup(w.html())
      w.unmount()
      const file = resolve(GOLD, `${name}.html`)
      if (process.env.U2_WRITE) { mkdirSync(GOLD, { recursive: true }); writeFileSync(file, html) }
      expect(html).toBe(readFileSync(file, 'utf8'))
    })
  }
})

describe('B1: a Treehopper back\'s own head line, and the latin left off', () => {
  it('card.backHead takes the set word\'s place; \'\' prints no line', () => {
    const el = face(TREE({ backHead: 'Tree 574031 · Brooklyn' }), { props: { side: 'back' } })
    expect(el.querySelectorAll('.ttf-bk-set').length).toBe(1)
    expect(txt(el, '.ttf-bk-set')).toBe('Tree 574031 · Brooklyn')
    expect(el.querySelector('.ttf-bk-set .ttf-no')).toBe(null)
    expect(face(TH({ backHead: '' }), { props: { side: 'back' } }).querySelector('.ttf-bk-set')).toBe(null)
    expect(txt(face(TH(), { props: { side: 'back' } }), '.ttf-bk-set')).toBe('SPECIES · No. 404 of 612')
  })
  it('card.backSub replaces the latin on the back; \'\' leaves it off; the front keeps its latin', () => {
    expect(face(TH({ backSub: '' }), { props: { side: 'back' } }).querySelector('.ttf-bk-sub')).toBe(null)
    expect(txt(face(TH({ backSub: 'Brooklyn' }), { props: { side: 'back' } }), '.ttf-bk-sub')).toBe('Brooklyn')
    expect(txt(face(TH({ backSub: '', print: false })), '.ttf-sub')).toBe('Cornus florida')
  })
  it('another face ignores both fields', () => {
    const el = face(STOP({ backHead: 'X', backSub: 'Y' }), { props: { side: 'back' } })
    expect(txt(el, '.ttf-bk-set')).toBe('OLD TOWN · No. 03 of 12')
    expect(el.querySelector('.ttf-bk-sub')).toBe(null)
  })
})

describe('B2: no collected line', () => {
  it('card.collectedLine === false drops Collected and Not collected on a Treehopper back', () => {
    expect(face(TH({ collectedLine: false }), { props: { side: 'back' } }).querySelector('.ttf-bk-got')).toBe(null)
    expect(face(TH({ collectedLine: false, held: false }), { props: { side: 'back' } }).querySelector('.ttf-bk-got')).toBe(null)
    expect(txt(face(TH({ collectedLine: true }), { props: { side: 'back' } }), '.ttf-bk-got')).toBe('Collected Apr 19, 2022')
    expect(face(STOP({ collectedLine: false }), { props: { side: 'back' } }).querySelector('.ttf-bk-got')).not.toBe(null)
  })
  it('the Treehopper credit has no auto margin over it (no blank band on a short back)', () => {
    const src = readFileSync(resolve(__dirname, '../../vue/TtFace.vue'), 'utf8')
    expect(src).toMatch(/\.ttf-th \.ttf-bk-credit \{ margin-top: 0;/)
  })
})

describe('B4, B7, B15: the back\'s foot and its head action', () => {
  it('slot foot sits after the body, outside its scroll; slot head ends the head', () => {
    const el = face(TH(), { props: { side: 'back' }, slots: { foot: '<button class="x-front">Front</button>', head: '<button class="x-act">Front</button>' } })
    const foot = el.querySelector('.ttf-bk-foot')
    expect(foot.parentElement.classList.contains('ttf-face')).toBe(true)
    expect(foot.previousElementSibling.classList.contains('ttf-bk-body')).toBe(true)
    expect(foot.querySelector('.x-front')).not.toBe(null)
    expect(el.querySelector('.ttf-bk-body .x-front')).toBe(null)
    const act = el.querySelector('.ttf-bk-head > .ttf-bk-act')
    expect(act.querySelector('.x-act')).not.toBe(null)
    expect(act.previousElementSibling.classList.contains('ttf-bk-sub')).toBe(true)
  })
  it('the front draws neither; a back without them gains no node', () => {
    const slots = { foot: '<i class="x-f">f</i>', head: '<i class="x-h">h</i>' }
    const fr = face(TH(), { slots })
    expect(fr.querySelector('.x-f, .x-h, .ttf-bk-foot, .ttf-bk-act')).toBe(null)
    expect(face(TH(), { props: { side: 'back' } }).querySelector('.ttf-bk-foot, .ttf-bk-act')).toBe(null)
  })
  it('a back for a card outside a set (How it works): no set word, no collected line, an action in the head, a foot', () => {
    const card = { id: 'deck:1', app: 'treehopper', face: 'treehopper', title: 'How it works', back: 'Find a tree.', backHead: '', collectedLine: false, held: true }
    const el = face(card, { props: { side: 'back' }, slots: { head: '<button class="x-act">Front</button>', foot: '<button class="x-join">Join</button>' } })
    expect(el.querySelector('.ttf-bk-set')).toBe(null)
    expect(el.querySelector('.ttf-bk-got')).toBe(null)
    expect(txt(el, '.ttf-bk-title')).toBe('How it works')
    expect(el.querySelector('.ttf-bk-head .x-act')).not.toBe(null)
    expect(el.querySelector('.ttf-bk-foot .x-join')).not.toBe(null)
  })
  it('TtCard passes head and foot to its back', async () => {
    const w = mount(TtCard, { props: { card: TH(), data: DATA, fonts: false }, slots: { foot: ({ card }) => h('i', { class: 'x-f' }, card.title), head: () => h('i', { class: 'x-h' }) }, attachTo: document.body })
    await nextTick()
    const back = w.find('.ttf-back')
    expect(back.find('.ttf-bk-foot .x-f').text()).toBe('Flowering Dogwood')
    expect(back.find('.ttf-bk-head .x-h').exists()).toBe(true)
    expect(w.find('.ttf-front .x-f').exists()).toBe(false)
    w.unmount()
  })
  it('TtTable\'s stage-foot reaches the open card\'s back through TtStage, with the card and the table', async () => {
    const collection = { apps: [{ id: 'treehopper', name: 'Treehopper', color: '#5048E5' }], sets: DATA.sets, rarities: DATA.rarities, cards: [TH({ img: null })] }
    const w = mount(TtTable, { props: { collection, options: { key: 'tt_u2_test' } }, slots: { 'stage-foot': ({ card, t }) => h('i', { class: 'x-sf' }, `${card.title} ${typeof t}`) }, attachTo: document.body })
    await flushPromises(); await nextTick()
    w.vm.openCard('th:dogwood')
    await settle(); await settle()
    expect(w.find('.tt-st-card .x-sf').exists()).toBe(false)   // the stage draws the side that shows: the front
    await w.find('.tt-st-flip').trigger('click')
    await settle(); await settle()
    expect(w.find('.tt-st-card .ttf-back .ttf-bk-foot .x-sf').text()).toBe('Flowering Dogwood object')
    w.unmount()
  })
})

describe('B5: the print foot', () => {
  it('8 px on 10 in the second ink; number and glyph in the first; credit and copyright at full strength, wrapping', () => {
    const src = readFileSync(resolve(__dirname, '../../vue/TtFace.vue'), 'utf8')
    const rule = sel => { const m = src.match(new RegExp(sel.replace(/[.[\]]/g, '\\$&') + ' \\{([^}]*)\\}', 'g')); return m ? m.join('\n') : '' }
    expect(rule('.ttf-th[data-print] .ttf-furn')).toMatch(/font-size: 8px; line-height: 10px; white-space: normal;/)
    expect(rule('.ttf-th[data-print] .ttf-furn')).toMatch(/color: var\(--thf-ink-2, var\(--tf-ink, #5048E5\)\)/)
    expect(rule('.ttf-th[data-print] svg.ttf-furn-rm')).toMatch(/width: 9px; height: 9px;/)
    expect(rule('.ttf-th[data-print] .ttf-furn-cr')).toMatch(/opacity: 1; overflow: visible; text-overflow: clip;/)
    expect(rule('.ttf-th[data-print] .ttf-furn-cp')).toMatch(/opacity: 1;/)
  })
})

describe('B3 and B19: the Treehopper back\'s type', () => {
  it('Young Serif over Archivo on the back, at the board\'s sizes', () => {
    const src = readFileSync(resolve(__dirname, '../../vue/TtFace.vue'), 'utf8')
    const back = src.match(/\.ttf-th\.ttf-back \{([^}]*)\}/)[1]
    expect(back).toMatch(/--fd: 'Young Serif'/)
    expect(back).toMatch(/--ft: 'Archivo'/)
    expect(back).toMatch(/--fw: 400/)
    expect(src).toMatch(/--fb-cap: min\(10px, calc\(4px \+ 2cqi\)\); --fb-key: min\(10px, calc\(4px \+ 2cqi\)\); --fb-title: min\(21px, calc\(6px \+ 5cqi\)\);/)
    expect(src).not.toMatch(/\.ttf-th\.ttf-back[^{]*\{[^}]*Fraunces/)
  })
  it('TT_TH_FONTS loads Archivo to 900, upright and italic', () => {
    expect(TT_TH_FONTS).toContain('0,75..100,400..900;1,75..100,400..900')
    expect(TT_TH_FONTS).not.toContain('400..700')
  })
})

describe('B9: the date-only stamp and the empty spot', () => {
  it('core: a held card with no number but a date stamps the date with dateStamp; a missing card with a spot gets the spot', () => {
    expect(ttStamp(TREE({ dateStamp: true }))).toEqual({ n: null, no: '', date: '19 APR 22' })
    expect(ttStamp(TREE({ dateStamp: true, collected: null }))).toBe(null)
    expect(ttStamp(TREE())).toBe(null)
    expect(ttStamp(TREE({ dateStamp: false }))).toBe(null)
    expect(ttStamp(TREE({ dateStamp: 'yes' }))).toBe(null)
    expect(ttStamp(TH({ held: false, spot: '0.3 mi' }))).toEqual({ n: null, no: '', date: '', spot: '0.3 mi' })
    expect(ttStamp(TH({ held: false, spot: '' }))).toBe(null)
    expect(ttStamp(TH())).toEqual({ n: 404, no: 'No. 404', date: '19 APR 22' })
    expect(ttStamp(TH({ dateStamp: true }))).toEqual({ n: 404, no: 'No. 404', date: '19 APR 22' })
    expect(ttStamp(TH({ spot: '0.3 mi' }))).toEqual({ n: 404, no: 'No. 404', date: '19 APR 22' })
  })
  it('the face: the date alone in the same box (no number node, no data-no); the spot with data-spot', () => {
    expect(face(TREE()).querySelector('.ttf-stamp')).toBe(null)
    const d = face(TREE({ dateStamp: true })).querySelector('.ttf-stamp')
    expect(d.hasAttribute('data-no')).toBe(false)
    expect(d.hasAttribute('data-spot')).toBe(false)
    expect(d.querySelector('.ttf-stamp-n')).toBe(null)
    expect(txt(d, '.ttf-stamp-d')).toBe('19 APR 22')
    const s = face(TH({ held: false, spot: '0.3 mi' })).querySelector('.ttf-stamp')
    expect(s.getAttribute('data-spot')).toBe('')
    expect(txt(s, '.ttf-stamp-n')).toBe('0.3 mi')
    expect(s.querySelector('.ttf-stamp-d')).toBe(null)
    expect(face(TH({ held: false })).querySelector('.ttf-stamp')).toBe(null)
    expect(face(STOP({ spot: '1 mi', held: false })).querySelector('.ttf-stamp')).toBe(null)
  })
  it('a tree tile hides the date-only stamp under 240, where its tree mark sits; a numbered stamp stays (review N4)', () => {
    const src = readFileSync(resolve(__dirname, '../../vue/TtFace.vue'), 'utf8')
    expect(src).toMatch(/@container ttf \(width < 240px\) \{[^@]*\.ttf-th\.ttf-front\[data-mark\] \.ttf-stamp:not\(\[data-no\]\) \{ display: none; \}/)
    expect(src).not.toMatch(/\.ttf-th\.ttf-front\[data-mark\] \.ttf-stamp \{ display: none; \}/)
    expect(face(TREE({ number: 3 })).querySelector('.ttf-stamp').getAttribute('data-no')).toBe('3')
  })
})

describe('B10: no mark before a type\'s own credit', () => {
  it('an empty labels.speciesPhoto prints the credit alone; an empty creditMark falls back as at 1.1.0', () => {
    const band = (c, labels) => face(TH({ print: false, ...c }), { props: { labels } }).querySelector('.ttf-credit')
    expect(band({ creditMark: '' }).innerHTML).toBe('<b>Species photo</b> Eric Hunt, CC BY-SA 4.0')
    expect(band({ creditMark: '  ' }).innerHTML).toBe('<b>Species photo</b> Eric Hunt, CC BY-SA 4.0')
    expect(band({}, { speciesPhoto: '' }).innerHTML).toBe('Eric Hunt, CC BY-SA 4.0')
    expect(band({ creditMark: '' }, { speciesPhoto: '' }).innerHTML).toBe('Eric Hunt, CC BY-SA 4.0')
    expect(band({}, { speciesPhoto: 'Type photo' }).innerHTML).toBe('<b>Type photo</b> Eric Hunt, CC BY-SA 4.0')
    expect(band({ creditMark: 'Genus' }, { speciesPhoto: '' }).innerHTML).toBe('<b>Genus</b> Eric Hunt, CC BY-SA 4.0')
    expect(band({}).innerHTML).toBe('<b>Species photo</b> Eric Hunt, CC BY-SA 4.0')
  })
  it('the print foot already prints no mark the card does not name', () => {
    expect(ttFurniture(TH(), DATA).cr).toBe('Eric Hunt, CC BY-SA 4.0')
    expect(ttFurniture(TH({ creditMark: 'Genus' }), DATA).cr).toBe('Genus · Eric Hunt, CC BY-SA 4.0')
  })
})

describe('B13: the front\'s fact as two cells', () => {
  it('card.factCells draws two cells in the one fact box; a string fact stays one span', () => {
    const el = face(TREE({ factCells: ['Tree 574031', 'Brooklyn'] }))
    const f = el.querySelectorAll('.ttf-fact')
    expect(f.length).toBe(1)
    expect(f[0].getAttribute('data-cells')).toBe('')
    expect([...f[0].querySelectorAll('.ttf-fact-c')].map(e => e.textContent)).toEqual(['Tree 574031', 'Brooklyn'])
    const one = face(TREE()).querySelector('.ttf-fact')
    expect(one.hasAttribute('data-cells')).toBe(false)
    expect(one.children.length).toBe(0)
    expect(one.textContent).toBe('Tree 574031 · Brooklyn')
  })
  it('empty cells are dropped, at most two are drawn, and another face ignores them', () => {
    expect([...face(TH({ factCells: ['In the city', '', '6,700', 'x'] })).querySelectorAll('.ttf-fact-c')].map(e => e.textContent)).toEqual(['In the city', '6,700'])
    expect(face(TH({ factCells: [] })).querySelector('.ttf-fact').textContent).toBe('In the city · 6,700')
    expect(face(STOP({ factCells: ['a', 'b'] })).querySelector('.ttf-fact-c')).toBe(null)
  })
})

describe('B16: the credit as given on the Treehopper face', () => {
  it('core: ttFaceCredit keeps "Photo:" on a Treehopper face with creditAsGiven, and strips it unset or elsewhere', () => {
    expect(ttFaceCredit(TH({ credit: 'Photo: alias', creditAsGiven: true }), DATA)).toBe('Photo: alias')
    expect(ttFaceCredit(TH({ credit: 'Photo: alias' }), DATA)).toBe('alias')
    expect(ttFaceCredit(TH({ credit: 'Photo: alias', creditAsGiven: 'yes' }), DATA)).toBe('alias')
    expect(ttFaceCredit(STOP(), WALK)).toBe('A. Person')
    expect(ttFaceCredit(STOP({ credit: 'Photo: A. Person', creditAsGiven: true }), WALK)).toBe('A. Person')
    expect(ttFurniture(TH({ credit: 'Photo: alias', creditAsGiven: true }), DATA).cr).toBe('Photo: alias')
    expect(ttFurniture(TH({ credit: 'Photo: alias' }), DATA).cr).toBe('alias')
  })
  it('the band, the foot and the back print it as given; the back\'s Photo word is labels.photo, empty for none', () => {
    const c = TH({ credit: 'Photo: alias', creditAsGiven: true })
    expect(face(c, { props: { labels: {} } }).querySelector('.ttf-furn-cr').textContent).toBe('Photo: alias')
    expect(face({ ...c, print: false }, { props: { labels: { speciesPhoto: '' } } }).querySelector('.ttf-credit').innerHTML).toBe('Photo: alias')
    expect(face(c, { props: { side: 'back' } }).querySelector('.ttf-bk-credit').innerHTML).toBe('<b>Photo</b> · Photo: alias')
    expect(face(c, { props: { side: 'back', labels: { photo: '' } } }).querySelector('.ttf-bk-credit').innerHTML).toBe('Photo: alias')
    const u = TH({ credit: 'Photo: alias' })
    expect(face(u).querySelector('.ttf-furn-cr').textContent).toBe('alias')
    expect(face({ ...u, print: false }).querySelector('.ttf-credit').innerHTML).toBe('<b>Species photo</b> alias')
    expect(face(u, { props: { side: 'back' } }).querySelector('.ttf-bk-credit').innerHTML).toBe('<b>Photo</b> · alias')
    expect(face(STOP(), { props: { side: 'back', labels: { photo: 'Foto' } } }).querySelector('.ttf-bk-credit').innerHTML).toBe('<b>Foto</b> · A. Person')
  })
})

// 1.4.0: the kit patch found while pinning 1.2.0 (the tree card back's head here; its other parts in u3asks and
// core/types)
describe('PL-055 (1.4.0): the tree card back\'s head', () => {
  const src = readFileSync(resolve(__dirname, '../../vue/TtFace.vue'), 'utf8')
  // min(Npx, calc(Apx + Bcqi)) or min(Npx, Bcqi) at a card W px wide (1cqi = W / 100 px)
  const at = (expr, W) => {
    const m = expr.match(/^min\(([\d.]+)px, (?:calc\(([\d.]+)px \+ ([\d.]+)cqi\)|([\d.]+)cqi)\)$/)
    expect(m, expr).not.toBe(null)
    const lin = m[2] != null ? +m[2] + +m[3] * W / 100 : +m[4] * W / 100
    return { capped: Math.min(+m[1], lin), lin }
  }
  it('item 2: each size is the old one at 300 px or less, and stops at the board\'s size above', () => {
    const card = src.match(/\.ttf-th\.ttf-back \.ttf-card \{([^}]*)\}/)[1]
    const want = { '--fb-cap': 10, '--fb-key': 10, '--fb-title': 21, '--fb-story': 16, '--fb-val': 14 }
    for (const [v, px] of Object.entries(want)) {
      const expr = card.match(new RegExp(`${v}: (min\\([^;]*\\));`))[1]
      for (const W of [120, 200, 300]) expect(Math.abs(at(expr, W).capped - at(expr, W).lin), `${v} at ${W}`).toBeLessThan(0.01)
      expect(at(expr, 300).capped, v).toBeCloseTo(px, 2)
      expect(at(expr, 356).capped, v).toBeCloseTo(px, 2)
    }
    const pad = src.match(/\.ttf-th\.ttf-back \.ttf-bk-head \{ padding: ([^;]*);/)[1].match(/min\([^)]*\)/g)
    expect(pad).toEqual(['min(14px, 4.67cqi)', 'min(14px, 4.67cqi)', 'min(10px, 3.33cqi)'])
    const mt = src.match(/\.ttf-th\.ttf-back \.ttf-bk-title \{ margin-top: (min\([^)]*\));/)[1]
    expect(at(mt, 300).capped).toBeCloseTo(at(mt, 300).lin, 2)
    expect(at(mt, 356).capped).toBeCloseTo(4.2, 2)
  })
  it('item 3: the act is a flex box over the lines the head has', () => {
    expect(src).toMatch(/\.ttf-bk-head > \.ttf-bk-act \{ grid-column: 2; grid-row: 1 \/ span 3; align-self: start; display: flex; \}/)
    expect(src).toMatch(/\.ttf-bk-head:not\(:has\(> \.ttf-bk-set\)\) > \.ttf-bk-act, \.ttf-bk-head:not\(:has\(> \.ttf-bk-sub\)\) > \.ttf-bk-act \{ grid-row: 1 \/ span 2; \}/)
    expect(src).toMatch(/\.ttf-bk-head:not\(:has\(> \.ttf-bk-set, > \.ttf-bk-sub\)\) > \.ttf-bk-act \{ grid-row: 1; \}/)
    // the rule for neither line comes after the rule for one (same specificity, the later wins)
    expect(src.indexOf('.ttf-bk-head:not(:has(> .ttf-bk-set, > .ttf-bk-sub))')).toBeGreaterThan(src.indexOf('.ttf-bk-head:not(:has(> .ttf-bk-sub)) > .ttf-bk-act'))
  })
  it('item 3: the heads those rules meet, as the face draws them (no markup change)', () => {
    const head = c => [...face(c, { props: { side: 'back' }, slots: { head: '<button class="x-act">Front</button>' } }).querySelector('.ttf-bk-head').children].map(e => e.className)
    expect(head(TH())).toEqual(['ttf-bk-set', 'ttf-bk-title', 'ttf-bk-sub', 'ttf-bk-act'])
    expect(head(TH({ backHead: '' }))).toEqual(['ttf-bk-title', 'ttf-bk-sub', 'ttf-bk-act'])
    expect(head(TH({ backHead: '', backSub: '' }))).toEqual(['ttf-bk-title', 'ttf-bk-act'])
  })
})
