/**
 * The Card room stylesheet in two parts, the theme (css/themes/cardroom.css) and the table
 * (css/table.css), and css/cardroom.css their join (scripts/css.mjs). Provo's byte-for-byte check is NYID's
 * computed-style goldens (tests/goldens/style), run on the packed kit.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import postcss from 'postcss'
import { joinCardroom } from '../../scripts/css.mjs'

const read = p => readFileSync(resolve(__dirname, '../..', p), 'utf8')
const THEME = read('css/themes/cardroom.css')
const TABLE = read('css/table.css')

// The kit contract's token lists
const THEME_TOKENS = ['--ground', '--ground-2', '--surface', '--backdrop', '--line', '--line-2', '--chrome', '--chrome-2', '--chrome-3',
  '--mark-th', '--mark-vt', '--mark-pc', '--gold', '--gold-2', '--spot', '--grain', '--grain-a', '--font-display', '--font-text', '--font-mono',
  '--r-1', '--r-2', '--r-3', '--r-pill', '--shadow-card']
const MECHANICS = ['--e-out', '--e-in', '--e-end', '--e-settle', '--d-fast', '--d-med', '--card-w', '--gap', '--sat', '--sab', '--padl', '--padr',
  '--top-h', '--strip-h', '--dock-h']

const rootRules = css => postcss.parse(css).nodes.filter(n => n.type === 'rule' && n.selector === '.tt')
const props = rule => rule.nodes.filter(n => n.type === 'decl').map(d => d.prop)

// each var(--x, fallback) in a value, the fallback as written
function fallbacks (css) {
  const out = []
  postcss.parse(css).walkDecls(d => {
    const v = d.value
    for (let i = v.indexOf('var(--'); i >= 0; i = v.indexOf('var(--', i + 1)) {
      let j = i + 4, n = 1
      while (n && j < v.length) { if (v[j] === '(') n++; else if (v[j] === ')') n--; j++ }
      const body = v.slice(i + 4, j - 1), c = body.indexOf(',')
      if (c > 0) out.push([body.slice(0, c).trim(), body.slice(c + 1).trim()])
    }
  })
  return out
}

describe('A3.3: the Card room stylesheet, theme and table', () => {
  it('css/cardroom.css is the join of its two parts (run npm run css after editing either)', () => {
    expect(read('css/cardroom.css')).toBe(joinCardroom())
  })

  it('the theme declares the 25 theme tokens on .tt, and the table the 15 mechanics tokens', () => {
    const [theme, ...more] = rootRules(THEME)
    expect(more).toEqual([])
    expect(props(theme)).toEqual(['color-scheme', ...THEME_TOKENS.slice(0, 6), ...THEME_TOKENS.slice(6, 9), ...THEME_TOKENS.slice(9, 14),
      '--grain', '--grain-a', '--spot', ...THEME_TOKENS.slice(17)])
    const table = rootRules(TABLE)[0]
    expect(props(table).filter(p => p.startsWith('--'))).toEqual(MECHANICS)
    // no rule in the table part sets a theme token or the scheme on .tt
    postcss.parse(TABLE).walkDecls(d => {
      expect(THEME_TOKENS, `${d.parent.selector} ${d.prop}`).not.toContain(d.prop)
      if (d.parent.selector === '.tt') expect(d.prop).not.toBe('color-scheme')
    })
  })

  it('the table reads no raw color outside a fallback; the one left is the masks\' #000, which is alpha', () => {
    const RAW = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(black|white)\b/
    postcss.parse(TABLE).walkDecls(d => {
      let v = d.value
      for (const [t, f] of fallbacks(`a{b:${v}}`)) v = v.split(`var(${t}, ${f})`).join(`var(${t})`)
      if (/^(-webkit-)?mask$/.test(d.prop)) v = v.replace(/#000\b/g, '')
      expect(v, `${d.parent.selector} ${d.prop}`).not.toMatch(RAW)
    })
  })

  it('the raw colors A3.3 moved sit behind tokens whose fallback is the value they had', () => {
    for (const t of [
      '{box-shadow:var(--shadow-pile, 0 1px 1px rgba(0,0,0,.5))}',
      '.tt-pile[data-edges]:not([data-edges="0"]) > .tt-cell{box-shadow:var(--shadow-edge, 0 1px 1px rgba(0,0,0,.4))}',
      '.tt-nest > .tt-cell{box-shadow:var(--shadow-edge, 0 1px 1px rgba(0,0,0,.4))}',
      'box-shadow:0 0 0 1px var(--line-2), var(--shadow-popover, 0 18px 40px rgba(0,0,0,.55))}',
      '.tt-opt:hover{background:var(--opt-hover, rgba(190,198,211,.06))}',
      'filter:var(--shadow-stage, drop-shadow(0 18px 36px rgba(0,0,0,.55)) drop-shadow(0 2px 2px rgba(0,0,0,.5)))}',
      '.tt-st-go:active{background:var(--chrome-press, #D3D9E2)}',
      '.tt-st-go:focus-visible{outline:none;background:var(--chrome-focus, #E3E8EF)}',
    ]) expect(TABLE, t).toContain(t)
  })

  it('the theme file lists every token with a default, with its default; none is declared', () => {
    const declared = new Set()
    postcss.parse(THEME + TABLE).walkDecls(d => { if (d.prop.startsWith('--')) declared.add(d.prop) })
    // --p is the ruler's fill, set by TtRuler; --thf-* are the Treehopper face's, listed in TtFace.vue
    const seen = new Map()
    for (const [t, f] of fallbacks(THEME + TABLE)) if (t !== '--p' && !t.startsWith('--thf-')) seen.set(t, [...(seen.get(t) || []), f])
    expect(seen.size).toBeGreaterThan(20)
    for (const [t, fs] of seen) {
      expect(declared.has(t), t).toBe(false)
      expect(fs.some(f => THEME.includes(`${t} ${f}`)), `${t} ${fs[0]}`).toBe(true)
    }
  })

  it('the theme keeps the page\'s ground on <html>, the table its mechanics', () => {
    expect(THEME).toContain('html[data-tt]{color-scheme:var(--tt-scheme, dark);background:var(--tt-ground, #0E1420)}')
    expect(THEME).toContain('html[data-tt] body{background:var(--tt-ground, #0E1420)}')
    expect(TABLE).toContain('html[data-tt]{scrollbar-gutter:stable;-webkit-text-size-adjust:100%;text-size-adjust:100%}')
    expect(TABLE).toContain('html[data-tt] body{margin:0}')
    expect(TABLE).toContain('html[data-tt-locked]{overflow:hidden}')
  })
})
