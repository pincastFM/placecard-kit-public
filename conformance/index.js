/**
 * The conformance suite (kit CONTRACT.md): what every instance runs, in its own vitest file, with
 * its config and a fixture. The file needs a DOM (`// @vitest-environment jsdom` on line 1) and the kit run
 * through Vite (vitest `server.deps.inline: [/@pincast\/placecard-kit/]`, as for the kit's .vue files).
 * Test-only peers (1.4.0, PL-055): the host installs vitest (>=1.6.0 <3) and @electric-sql/pglite (>=0.2.0 <1) as
 * its own dev dependencies; the package no longer lists them as peers. Both are needed by any import of this
 * subpath under Vite: it re-exports the moderation suite, whose pglite import Vite resolves when it loads.
 *
 *   // @vitest-environment jsdom
 *   import { ttConformance } from '@pincast/placecard-kit/conformance'
 *   ttConformance({ name: 'verythere-provo', config, collection, css: [{ name, text }], base: 'cardroom',
 *     own: [...], plans: [{ name, input, meta }], props: { tag: 'Provo' }, goldens: resolve(__dirname, 'goldens') })
 *
 * The instance:
 * - config: as createTabletop takes it. The suite swaps in `source` (the collection below) and the hand's store
 *   (in memory); with `directions` given, the path solver's adapter too. Everything else is the instance's.
 * - collection: what config.source.load() returns for the fixture.
 * - css: the instance's own stylesheets for its table (text, or { name, text }); base: the kit sheet under them,
 *   'cardroom' or 'table'.
 * - own: the instance's classes inside the kit's namespaces (tt-, ttf-), if any.
 * - plans: cases for the planning mode, { name, input, meta } (meta: a day's { id, set, madeAt }).
 * - props, slots: what the instance adds to its Tabletop when it renders it (TtTable props the config does not
 *   hold, its slots), for the table goldens.
 * - goldens: the directory of its conformance goldens: <name>.table-phone.html, <name>.table-laptop.html,
 *   <name>.plans.json. UPDATE_GOLDENS=1 writes them; read the diff before committing.
 *
 * It checks: the config and the collection (createTabletop's own checks); the theme (every theme token, no
 * mechanics token); class names; the hand's key, scope and stored shape with HAND_V; every plan a valid record v2;
 * the table through createTabletop at phone and laptop widths, against the goldens.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp, h, nextTick, toValue } from 'vue'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CONTRACT_VERSION, CR_LAPTOP } from '../core/index.js'
import { ttConfigErrors, ttCollectionErrors } from '../core/tabletop.js'
import { createTabletop } from '../vue/createTabletop.js'
import { ttThemeErrors, ttClassErrors, ttHandPayloadErrors, ttRecordErrors, ttDayRulesErrors, ttThemeClasses, TT_CLASS_NS } from './checks.js'

export { CONTRACT_VERSION }
export * from './checks.js'
export { ttCssRules, ttCssConditional, ttSelectorClasses } from './css.js'

// A path record's id and time are new on every run; its golden fixes them
export const TT_CONFORMANCE_MADE_AT = '2026-10-28T12:00:00.000Z'

const asJson = v => JSON.stringify(v, null, 2) + '\n'
// NYID's goldens' form: raw markup, Vue scope ids out, a newline between tags. An input's value is a
// property: Vue 3.3 leaves it out of the markup and later Vue writes it as an attribute too, so it is left out.
const asHtml = html => html.replace(/ data-v-[0-9a-f]{8}(="")?/g, '').replace(/(<input\b[^>]*?) value="[^"]*"/g, '$1')
  .replace(/></g, '>\n<') + '\n'

function golden(dir, file, text) {
  if (!dir) throw new Error(`conformance: no goldens directory for ${file} (instance.goldens)`)
  const path = resolve(dir, file)
  if (typeof process !== 'undefined' && process.env.UPDATE_GOLDENS === '1') {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
    return
  }
  let want
  try { want = readFileSync(path) } catch { throw new Error(`conformance: no golden ${file} in ${dir}: write it once with UPDATE_GOLDENS=1 and read it`) }
  if (!Buffer.from(text, 'utf8').equals(want)) expect(text).toBe(want.toString('utf8'))
}

const memStore = () => {
  const m = new Map()
  return { m, get: k => (m.has(k) ? m.get(k) : null), set: (k, v) => { m.set(k, String(v)) }, remove: (k) => { m.delete(k) } }
}
const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 0))
    await nextTick()
  }
}

/**
 * What the table needs from jsdom: matchMedia (`laptop` turns CR_LAPTOP on), and no-op animation and scrolling.
 * Returns the switch and a restore.
 */
export function ttConformanceEnv() {
  const env = { laptop: false }
  const w = window
  const E = Element.prototype
  const g = globalThis
  const before = { matchMedia: w.matchMedia, gMatchMedia: g.matchMedia, scrollTo: w.scrollTo, animate: E.animate, getAnimations: E.getAnimations, scrollIntoView: E.scrollIntoView }
  // vitest's jsdom copies window's globals onto globalThis: a bare matchMedia() reads the copy, so set both
  w.matchMedia = q => ({ matches: env.laptop && q === CR_LAPTOP, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })
  g.matchMedia = w.matchMedia
  w.scrollTo = () => {}
  E.animate = function () { return { onfinish: null, oncancel: null, cancel() {}, finish() {}, play() {}, pause() {} } }
  E.getAnimations = function () { return [] }
  E.scrollIntoView = function () {}
  env.restore = () => {
    w.matchMedia = before.matchMedia
    g.matchMedia = before.gMatchMedia
    w.scrollTo = before.scrollTo
    E.animate = before.animate
    E.getAnimations = before.getAnimations
    E.scrollIntoView = before.scrollIntoView
  }
  return env
}

/** Registers the conformance suite for one instance (see the head of this file). */
export function ttConformance(instance) {
  const { name, config, collection, css = [], base, own = [], plans = [], props = {}, slots = {}, goldens } = instance || {}
  const label = name || (config && config.app) || 'instance'
  const file = s => `${label}.${s}`
  const planning = config && config.modes && config.modes.planning
  // The instance's config, run on the fixture: its source and hand store swapped, the rest its own
  const runConfig = (store = memStore()) => {
    const c = { ...config, source: { load: async () => collection }, hand: { ...config.hand, store } }
    if (planning && planning.solver === 'path' && 'directions' in instance) c.modes = { ...config.modes, planning: { ...planning, directions: instance.directions } }
    return c
  }

  describe(`conformance: ${label} (kit contract ${CONTRACT_VERSION})`, () => {
    let env
    const rendered = new Set()
    beforeAll(() => {
      if (typeof window === 'undefined' || typeof document === 'undefined') throw new Error('conformance: needs a DOM; put // @vitest-environment jsdom on line 1')
      env = ttConformanceEnv()
    })
    afterAll(() => { if (env) env.restore() })

    it('the config passes createTabletop\'s checks for this kit (keys, kinds, the contract major)', () => {
      expect(ttConfigErrors(config, CONTRACT_VERSION)).toEqual([])
    })

    it('the collection fits the config (lists, rarities, every card\'s face among config.faces)', () => {
      expect(ttCollectionErrors(collection, config)).toEqual([])
    })

    it('the theme declares every theme token on the table root and no mechanics token', () => {
      expect(ttThemeErrors({ css, base, theme: config.theme })).toEqual([])
    })

    it('class names: the instance\'s sheets name only the kit\'s, its theme\'s or its own, and own reuses none of the kit\'s', () => {
      expect(ttClassErrors({ css, own, theme: config.theme })).toEqual([])
    })

    it('the hand: its key and scope, and the stored shape { v: HAND_V, zone, entries }', async () => {
      const key = String(toValue(config.hand.key))
      const zone = String(toValue(config.hand.scope))
      expect(key.trim(), 'hand.key resolves to a non-empty string').not.toBe('')
      expect(zone.trim(), 'hand.scope resolves to a non-empty string').not.toBe('')
      if (config.table && config.table.key) expect(key, 'the hand and the table keep their state under different keys').not.toBe(config.table.key)
      const store = memStore()
      const a = createTabletop(runConfig(store))
      const entries = [{ key: 'conformance-card', kind: 'card' }, { key: 'conformance-event', kind: 'event' }]
      expect(a.hand.restore({})).toEqual([])
      for (const e of entries) a.hand.add(e)
      await nextTick()
      expect([...store.m.keys()]).toEqual([key])
      expect(ttHandPayloadErrors(store.m.get(key), { zone, entries })).toEqual([])
      const b = createTabletop(runConfig(store))
      expect(b.hand.restore({}), 'a second tabletop on the same store restores the hand').toEqual(entries)
      a.dispose()
      b.dispose()
    })

    it('every plan case is a valid record v2 for this app, and the records match the golden', async () => {
      if (!planning) {
        expect(plans, 'plan cases given, but the config has no planning mode').toEqual([])
        return
      }
      expect(plans.length, 'a planning mode needs at least one plan case').toBeGreaterThan(0)
      if (planning.solver === 'day') expect(ttDayRulesErrors(planning.rules)).toEqual([])
      const tt = createTabletop(runConfig())
      const out = []
      for (const [i, c] of plans.entries()) {
        let got
        try { got = await tt.plan(c.input, c.meta) } catch (e) { throw new Error(`conformance: plan case '${c.name}' threw: ${(e && e.message) || e}`) }
        let record = planning.solver === 'path' ? got.record : got
        const set = planning.solver === 'path' ? c.input && c.input.set : c.meta && c.meta.set
        expect(ttRecordErrors(record, { app: config.app, set }), c.name).toEqual([])
        if (planning.solver === 'path') record = { ...record, id: `plan-${String(i + 1).padStart(2, '0')}`, madeAt: TT_CONFORMANCE_MADE_AT }
        out.push({ name: c.name, record })
      }
      tt.dispose()
      golden(goldens, file('plans.json'), asJson({ solver: planning.solver, cases: out }))
    })

    async function table(laptop) {
      try { localStorage.clear() } catch { /* none */ }
      env.laptop = laptop
      const tt = createTabletop(runConfig())
      expect(await tt.load(), 'the collection loads through createTabletop').toBeTruthy()
      const el = document.createElement('div')
      document.body.appendChild(el)
      const app = createApp({ render: () => h(tt.Tabletop, { tabletop: tt, ...props }, slots) })
      app.mount(el)
      await settle()
      const html = el.innerHTML
      const root = el.firstElementChild
      const classes = root ? [...root.classList] : []
      for (const n of el.querySelectorAll('[class]')) for (const c of n.classList) rendered.add(c)
      app.unmount()
      el.remove()
      tt.dispose()
      env.laptop = false
      return { html, classes }
    }

    for (const [w, laptop] of [['phone', false], ['laptop', true]]) {
      it(`the table through createTabletop, ${w}: the root wears tt and the theme's class, and the markup matches the golden`, async () => {
        const { html, classes } = await table(laptop)
        expect(classes).toContain('tt')
        for (const c of ttThemeClasses(config.theme)) expect(classes).toContain(c)
        golden(goldens, file(`table-${w}.html`), asHtml(html))
      })
    }

    it('class names: every kit-namespace class the table renders is the kit\'s, its theme\'s or its own', () => {
      expect(rendered.size, 'the table rendered (the two table cases ran first)').toBeGreaterThan(0)
      expect(ttClassErrors({ own, theme: config.theme, rendered: [...rendered].filter(c => TT_CLASS_NS.test(c)) })).toEqual([])
    })
  })
}

export { modConformance, modDDL, MOD_CONFORMANCE_ACTORS } from './moderation.js'
