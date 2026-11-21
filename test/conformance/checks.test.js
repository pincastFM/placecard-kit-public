// Conformance's parts. The CSS reader against postcss on the kit's own sheets; TT_CLASSES rebuilt from the
// sources; each check passing the samples and failing on a broken instance, with a message that names the fault.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss from 'postcss'
import { parse } from 'vue/compiler-sfc'
import { ttCssRules, ttCssConditional, ttSelectorClasses } from '../../conformance/css.js'
import { ttThemeErrors, ttClassErrors, ttHandPayloadErrors, ttRecordErrors, ttDayRulesErrors, ttSheets } from '../../conformance/checks.js'
import { TT_CLASSES, TT_THEME_TOKENS, HAND_V } from '../../core/index.js'
import { kitClasses, classesModule } from '../../scripts/classes.mjs'
import { SAMPLE_DAY, SAMPLE_PATH, SAMPLE_DAY_CSS, SAMPLE_PATH_CSS, SAMPLE_RULES } from './samples.js'

const ROOT = resolve(__dirname, '../..')
const read = p => readFileSync(resolve(ROOT, p), 'utf8')
const ws = v => v.replace(/\s+/g, ' ').trim()

// postcss's view, in the reader's shape: one row per declaration, its rule's selectors and at-rule preludes
function viaPostcss(text) {
  const rows = []
  postcss.parse(text).walkDecls((d) => {
    const at = []
    let sel = null
    for (let p = d.parent; p && p.type !== 'root'; p = p.parent) {
      if (p.type === 'rule' && sel === null) sel = p.selectors.map(ws)
      if (p.type === 'atrule') at.unshift(ws(`@${p.name} ${p.params}`))
    }
    if (at.some(a => /^@(keyframes|font-face)/.test(a))) return
    rows.push([sel.join(' , '), at.join(' | '), d.prop, ws(d.value), !!d.important])
  })
  return rows
}
const viaReader = text => ttCssRules(text).flatMap(r => r.decls.map(d => [r.selectors.map(ws).join(' , '), r.at.map(ws).join(' | '), d.prop, ws(d.value), d.important]))

describe('the CSS reader', () => {
  const sheets = [['css/table.css', read('css/table.css')], ['css/themes/cardroom.css', read('css/themes/cardroom.css')], ['css/cardroom.css', read('css/cardroom.css')]]
  for (const f of readdirSync(resolve(ROOT, 'vue')).filter(f => f.endsWith('.vue'))) {
    for (const [i, st] of parse(read(`vue/${f}`)).descriptor.styles.entries()) if (st.content.trim()) sheets.push([`vue/${f} <style> ${i}`, st.content])
  }
  for (const [name, text] of sheets) {
    it(`reads ${name} as postcss does, declaration for declaration`, () => {
      const want = viaPostcss(text)
      expect(want.length).toBeGreaterThan(0)
      expect(viaReader(text)).toEqual(want)
    })
  }
  it('reads the samples\' sheets as postcss does', () => {
    for (const t of [SAMPLE_DAY_CSS, SAMPLE_PATH_CSS]) expect(viaReader(t)).toEqual(viaPostcss(t))
  })
  it('keeps strings, parens and comments whole, resolves nesting, skips keyframes and font faces', () => {
    const r = ttCssRules(`/* a { b: c } */ .a, .b:is(.c, .d) { --x: "a;b}"; content: url(x;y) !important }
      .p { color: red; & .q { color: blue } .r & { --y: 1 } @media (min-width: 9px) { --z: 2 } }
      @keyframes k { from { --no: 1 } } @font-face { font-family: X } @layer base { .tt { --ground: #000 } }`)
    expect(r.map(x => [x.selectors, x.at, x.decls.map(d => [d.prop, d.value, d.important])])).toEqual([
      [['.a', '.b:is(.c, .d)'], [], [['--x', '"a;b}"', false], ['content', 'url(x;y)', true]]],
      [['.p'], [], [['color', 'red', false]]],
      [['.p .q'], [], [['color', 'blue', false]]],
      [['.r .p'], [], [['--y', '1', false]]],
      [['.p'], ['@media (min-width: 9px)'], [['--z', '2', false]]],
      [['.tt'], ['@layer base'], [['--ground', '#000', false]]],
    ])
    expect(ttCssConditional(['@layer base'])).toBe(false)
    expect(ttCssConditional(['@layer base', '@media (x)'])).toBe(true)
    expect(ttSelectorClasses('.tt-a > .tt-b:not(.tt-c)[data-x=".nope"]::before')).toEqual(['tt-a', 'tt-b', 'tt-c'])
  })
})

describe('TT_CLASSES', () => {
  it('is what scripts/classes.mjs builds from the kit\'s sources now (else run npm run classes)', () => {
    const now = kitClasses(ROOT)
    expect(TT_CLASSES).toEqual(now)
    expect(read('core/classes.js')).toBe(classesModule(now))
  })
  it('holds the table\'s, the faces\' and the transitions\' names, and no head key', () => {
    for (const c of ['tt-cell', 'tt-bx-fig', 'ttf-front', 'ttf-destination', 'ttf-treehopper', 'tt-day-enter-active', 'tt-dr-move', 'tt-ghost']) expect(TT_CLASSES).toContain(c)
    for (const c of ['tt-pre-1', 'tt-cr-fonts', 'tt-face-fonts', 'tt-th-fonts']) expect(TT_CLASSES).not.toContain(c)
  })
})

describe('the checks fail on a broken instance', () => {
  const theme = { class: 'tt-sample' }
  it('theme: the samples pass', () => {
    expect(ttThemeErrors({ css: SAMPLE_DAY.css, base: 'cardroom', theme })).toEqual([])
    expect(ttThemeErrors({ css: SAMPLE_PATH.css, base: 'table', theme: { class: 'tt-grove' } })).toEqual([])
  })
  it('theme: a token missing, one only under @media, one on a selector that is not the root', () => {
    const cut = SAMPLE_PATH_CSS.replace('--gold:#B8862B;', '').replace('--r-3:14px;', '') + '@media (min-width:1px){ .tt-grove{ --gold:#000 } } .tt-grove .x{ --r-3:1px }'
    expect(ttThemeErrors({ css: [cut], base: 'table', theme: { class: 'tt-grove' } })).toEqual(['the theme leaves out 2 of the 22 theme tokens on the table root (.tt or .tt-grove, under no @media): --gold, --r-3'])
    expect(ttThemeErrors({ css: [], base: 'table', theme })[0]).toMatch(/leaves out 22 of the 22/)
  })
  it('theme: a mechanics token set anywhere, and an unknown base', () => {
    const errs = ttThemeErrors({ css: [{ name: 'x.css', text: '.tt-sample .tt-cell{ --card-w: 90px }' }], base: 'cardroom', theme })
    expect(errs).toEqual(["x.css: .tt-sample .tt-cell sets --card-w, one of the kit's 15 mechanics tokens; an app never sets one (CONTRACT section 5)"])
    expect(ttThemeErrors({ css: [], base: 'cardroom.css', theme })[0]).toMatch(/^base: 'cardroom.css' is not one of cardroom, table/)
  })
  it('classes: a renamed kit class in a sheet, own reusing a kit class or outside the namespaces, an unknown rendered class', () => {
    expect(ttClassErrors({ css: SAMPLE_DAY.css, own: SAMPLE_DAY.own, theme })).toEqual([])
    const errs = ttClassErrors({
      css: [{ name: 'a.css', text: '.tt-bx-figure{ color:red } .tt-sx-note .ttf-front, .my-own{ x:y } .tt-sample{ --a:1 }' }],
      own: ['tt-sx-note', 'tt-cell', 'my-own'],
      theme,
      rendered: ['tt', 'tt-sample', 'tt-cell', 'tt-sx-note', 'tt-mystery', 'is-on'],
    })
    expect(errs).toEqual([
      "own: 'tt-cell' is the kit's class; an instance never reuses one (CONTRACT section 4)",
      "own: 'my-own' is outside the kit's namespaces (tt-, ttf-); list only an instance class inside them",
      "a.css: '.tt-bx-figure' names .tt-bx-figure, which the kit does not have (renamed or removed?) and own does not list",
      'the table renders .tt-mystery: neither the kit\'s nor listed in own',
    ])
  })
  it('hand: the stored shape, HAND_V, the zone and the entries', () => {
    const entries = [{ key: 'a', kind: 'card' }]
    const good = JSON.stringify({ v: HAND_V, zone: 'z', entries })
    expect(HAND_V).toBe(1)
    expect(ttHandPayloadErrors(good, { zone: 'z', entries })).toEqual([])
    expect(ttHandPayloadErrors('{', {})[0]).toMatch(/not JSON/)
    expect(ttHandPayloadErrors(JSON.stringify({ v: 2, zone: 'y', entries: [{ key: 'a', kind: 'place' }], extra: 1 }), { zone: 'z', entries })).toEqual([
      "the stored hand's keys are v, zone, entries, extra, not v, zone, entries",
      "the stored hand's v is 2, not HAND_V (1)",
      "the stored hand's zone is 'y', not the scope 'z'",
      'entries[0]: not { key, kind: \'card\' | \'event\' } ({"key":"a","kind":"place"})',
      'the stored entries are [{"key":"a","kind":"place"}], not [{"key":"a","kind":"card"}]',
    ])
  })
  it('record: validateRecord\'s errors, another app, another set', () => {
    expect(ttRecordErrors({}, {})[0]).toMatch(/^record: keys: want /)
    const rec = JSON.parse(read('test/conformance/goldens/sample-day.plans.json')).cases[0].record
    expect(ttRecordErrors(rec, { app: 'verythere', set: 'town' })).toEqual([])
    expect(ttRecordErrors(rec, { app: 'treehopper', set: 'elsewhere' })).toEqual([
      "record.app is 'verythere', the config's app is 'treehopper'",
      "record.set is 'town', the case's set is 'elsewhere'",
    ])
  })
  it('day rules: the sample\'s are whole; thin rules name every missing key', () => {
    expect(ttDayRulesErrors(SAMPLE_RULES)).toEqual([])
    const errs = ttDayRulesErrors({ tz: 'America/Denver', gap: '10' })
    expect(errs).toContain('modes.planning.rules.gap: a string, the day solver needs a number')
    expect(errs).toContain('modes.planning.rules.chipFamily: missing, the day solver needs an object')
    expect(errs).toHaveLength(15)
  })
  it('sheets: strings and { name, text }', () => {
    expect(ttSheets(['.a{}', { name: 'b.css', text: '.b{}' }])).toEqual([{ name: 'css[0]', text: '.a{}' }, { name: 'b.css', text: '.b{}' }])
    expect(TT_THEME_TOKENS).toHaveLength(22)
  })
})
