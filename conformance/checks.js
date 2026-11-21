/**
 * Conformance's checks (kit CONTRACT.md), framework-free: each returns a list of problems as
 * strings, empty when the instance conforms. conformance/index.js runs them as a vitest suite; they run anywhere.
 */
import { validateRecord } from '@pincast/placecard-kit/planner'
import { TT_THEME_TOKENS, TT_MECHANICS_TOKENS } from '../core/tabletop.js'
import { TT_CLASSES } from '../core/classes.js'
import { HAND_V } from '../core/hand.js'
import { ttCssRules, ttCssConditional, ttSelectorClasses } from './css.js'

// The kit stylesheet an instance loads under its own: 'cardroom' (css/cardroom.css: the Card room theme, which
// declares the 22 theme tokens on .tt, and the table) or 'table' (css/table.css: the table alone)
export const TT_CONFORMANCE_BASES = Object.freeze(['cardroom', 'table'])
// The kit's class namespaces (an app never renames a class in them)
export const TT_CLASS_NS = /^(tt|ttf)-[\w-]+$/

const THEME = new Set(TT_THEME_TOKENS)
const MECH = new Set(TT_MECHANICS_TOKENS)
const KIT = new Set(TT_CLASSES)

/** The class names in a theme config's `class`. */
export function ttThemeClasses(theme) {
  return theme && typeof theme.class === 'string' ? theme.class.trim().split(/\s+/).filter(Boolean) : []
}

/** Stylesheets as [{ name, text }], from strings or { name, text }. */
export function ttSheets(css) {
  const list = css == null ? [] : Array.isArray(css) ? css : [css]
  return list.map((s, i) => (typeof s === 'string' ? { name: `css[${i}]`, text: s } : { name: (s && s.name) || `css[${i}]`, text: String(s && s.text != null ? s.text : '') }))
}

// A selector that is the table root itself: only .tt and the theme's classes, compounded (.tt, .tt-x, .tt.tt-x)
function isRoot(sel, root) {
  if (!/^(\.[_a-zA-Z-][\w-]*)+$/.test(sel)) return false
  return ttSelectorClasses(sel).every(c => root.has(c))
}

/**
 * The theme: every one of the 22 theme tokens declared on the table root (a selector of .tt and the theme's
 * classes only, under no @media, @supports or @container), by the base or the instance's sheets; none of the
 * 15 mechanics tokens declared in any instance sheet.
 * { css: the instance's own sheets, base: 'cardroom' | 'table', theme: config.theme }
 */
export function ttThemeErrors({ css, base, theme } = {}) {
  const errs = []
  if (!TT_CONFORMANCE_BASES.includes(base)) errs.push(`base: '${base}' is not one of ${TT_CONFORMANCE_BASES.join(', ')} ('cardroom': the kit's css/cardroom.css, whose Card room theme declares the theme tokens on .tt; 'table': css/table.css, your sheets declare all ${TT_THEME_TOKENS.length})`)
  const cls = ttThemeClasses(theme)
  const root = new Set(['tt', ...cls])
  const supplied = new Set(base === 'cardroom' ? TT_THEME_TOKENS : [])
  for (const s of ttSheets(css)) {
    for (const r of ttCssRules(s.text)) {
      for (const d of r.decls) if (MECH.has(d.prop)) errs.push(`${s.name}: ${r.selectors.join(', ')} sets ${d.prop}, one of the kit's 15 mechanics tokens; an app never sets one (CONTRACT section 5)`)
      if (ttCssConditional(r.at) || !r.selectors.some(sel => isRoot(sel, root))) continue
      for (const d of r.decls) if (THEME.has(d.prop)) supplied.add(d.prop)
    }
  }
  const missing = TT_THEME_TOKENS.filter(t => !supplied.has(t))
  if (missing.length) errs.push(`the theme leaves out ${missing.length} of the ${TT_THEME_TOKENS.length} theme tokens on the table root (${[...root].map(c => `.${c}`).join(' or ')}, under no @media): ${missing.join(', ')}`)
  return errs
}

/**
 * Class names: `own` (the instance's classes inside the kit's namespaces, tt- and ttf-) shares none with the
 * kit's TT_CLASSES; every tt- or ttf- class the instance's sheets name, and every one `rendered` (class names off
 * the table's markup), is the kit's, the theme's or listed in `own`.
 * { css, own, theme, rendered }
 */
export function ttClassErrors({ css, own = [], theme, rendered = [] } = {}) {
  const errs = []
  const mine = new Set()
  for (const c of own) {
    if (!TT_CLASS_NS.test(c)) errs.push(`own: '${c}' is outside the kit's namespaces (tt-, ttf-); list only an instance class inside them`)
    else if (KIT.has(c)) errs.push(`own: '${c}' is the kit's class; an instance never reuses one (CONTRACT section 4)`)
    else mine.add(c)
  }
  const ok = c => !TT_CLASS_NS.test(c) || KIT.has(c) || mine.has(c) || ttThemeClasses(theme).includes(c)
  for (const s of ttSheets(css)) {
    const seen = new Set()
    for (const r of ttCssRules(s.text)) {
      for (const sel of r.selectors) {
        for (const c of ttSelectorClasses(sel)) {
          if (ok(c) || seen.has(c)) continue
          seen.add(c)
          errs.push(`${s.name}: '${sel}' names .${c}, which the kit does not have (renamed or removed?) and own does not list`)
        }
      }
    }
  }
  const bad = [...new Set(rendered)].filter(c => !ok(c)).sort()
  if (bad.length) errs.push(`the table renders ${bad.map(c => `.${c}`).join(', ')}: neither the kit's nor listed in own`)
  return errs
}

/** A stored hand (the string the store holds) against the contract's shape: exactly { v: HAND_V, zone, entries }. */
export function ttHandPayloadErrors(raw, { zone, entries } = {}) {
  let p
  try { p = JSON.parse(raw) } catch { return [`the stored hand is not JSON: ${String(raw).slice(0, 80)}`] }
  const errs = []
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['the stored hand is not an object']
  const keys = Object.keys(p)
  if (keys.join(',') !== 'v,zone,entries') errs.push(`the stored hand's keys are ${keys.join(', ')}, not v, zone, entries`)
  if (p.v !== HAND_V) errs.push(`the stored hand's v is ${p.v}, not HAND_V (${HAND_V})`)
  if (zone !== undefined && p.zone !== zone) errs.push(`the stored hand's zone is '${p.zone}', not the scope '${zone}'`)
  if (!Array.isArray(p.entries)) errs.push('the stored hand\'s entries are not a list')
  else {
    p.entries.forEach((e, i) => {
      if (!e || typeof e !== 'object' || Object.keys(e).join(',') !== 'key,kind' || typeof e.key !== 'string' || !['card', 'event'].includes(e.kind)) errs.push(`entries[${i}]: not { key, kind: 'card' | 'event' } (${JSON.stringify(e)})`)
    })
    if (entries && JSON.stringify(p.entries) !== JSON.stringify(entries)) errs.push(`the stored entries are ${JSON.stringify(p.entries)}, not ${JSON.stringify(entries)}`)
  }
  return errs
}

// DayRules (planner/day/rules.ts): the keys the day solver reads with no default, by kind
const DAY_RULES = {
  tz: 'string', meals: 'array', gap: 'number', seeMin: 'number', alts: 'number', seeChips: 'array', dayEnd: 'number',
  chipFamily: 'object', hours: 'object', occurrences: 'function', walkMinutes: 'function', meters: 'function',
  rng: 'function', clock: 'function', rank: 'function', ring: 'function',
}
const kindOf = v => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v)

/** The day solver's rules: every DayRules key without a default, of its kind (createTabletop checks only an object). */
export function ttDayRulesErrors(rules) {
  if (!rules || typeof rules !== 'object') return ['modes.planning.rules: the day solver\'s DayRules, an object']
  const errs = []
  for (const [k, want] of Object.entries(DAY_RULES)) {
    const got = kindOf(rules[k])
    if (got !== want) errs.push(`modes.planning.rules.${k}: ${got === 'undefined' ? 'missing' : `a ${got}`}, the day solver needs ${want === 'array' || want === 'object' ? 'an' : 'a'} ${want}`)
  }
  return errs
}

/** A plan's record against record v2 (planner validateRecord) and the instance: its app, and its set when given. */
export function ttRecordErrors(record, { app, set } = {}) {
  const v = validateRecord(record)
  const errs = v.ok ? [] : v.errors.map(e => `record: ${e}`)
  if (record && typeof record === 'object') {
    if (app !== undefined && record.app !== app) errs.push(`record.app is '${record.app}', the config's app is '${app}'`)
    if (set !== undefined && set !== null && record.set !== set) errs.push(`record.set is '${record.set}', the case's set is '${set}'`)
  }
  return errs
}
