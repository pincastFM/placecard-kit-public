// createTabletop's pure part (core/tabletop.js) and a card's face (core/face.js ttFaceOf).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  TT_APP_IDS, TT_FACES, TT_GROUP_IDS, TT_SORT_IDS, TT_FACET_IDS, TT_THEME_TOKENS, TT_LEGACY_MARK_TOKENS, TT_MECHANICS_TOKENS, TT_DEFAULTED_TOKENS,
  TT_CARDROOM_THEME, CR_FONTS, CONTRACT_VERSION, ttConfigErrors, ttCheckConfig, ttCollectionErrors, ttContractMajor, ttThemeHead,
  ttFaceOf, ttLook, ttPrintOn,
} from '../../core/index.js'
import { TT_GROUPS, TT_SORTS, useTtTable } from '../../vue/useTtTable.js'

const root = resolve(__dirname, '../..')
const read = p => readFileSync(resolve(root, p), 'utf8')
const styleOf = s => (s.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || []).join('\n')
const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '')
const declared = s => new Set([...noComments(s).matchAll(/(?<![\w-])(--[\w-]+)\s*:/g)].map(m => m[1]))
const reads = (s, withDefault) => new Set([...noComments(s).matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)].filter(m => !!m[2] === withDefault).map(m => m[1]))
const sorted = x => [...x].sort()

const GOOD = () => ({
  contract: 1,
  app: 'verythere',
  source: { load: async () => ({ apps: [], sets: [], rarities: {}, cards: [] }) },
  faces: { stop: {}, destination: { print: false } },
  theme: { class: 'tt-provo', fonts: ['https://fonts.example/a.css', { key: 'tt-pv-fonts', href: 'https://fonts.example/b.css' }], htmlAttrs: { 'data-tt': 'cardroom' } },
  hand: { key: 'vt_hand_provo', scope: 'provo' },
  modes: { collection: true, planning: { solver: 'day', rules: {} } },
  table: { key: 'tt_selection', widths: { phone: 111, laptop: 150 }, stacked: true, only: () => true },
  labels: { cards: 'Cards', groups: { kind: 'Kind' } },
  links: { back: { label: 'Provo', href: '/provo' }, empty: [{ label: 'Walk', href: '/w' }] },
  groups: ['kind', 'rarity', 'none'],
  sorts: ['newest', 'name'],
  filters: { facets: ['kind', 'interests'], missing: true, search: true },
})

describe('the lists a config names from', () => {
  it('match the table: groups, sorts, facets (useTtTable) and the chip loop (TtTable)', () => {
    expect(TT_GROUP_IDS).toEqual(TT_GROUPS.map(g => g.id))
    expect(TT_SORT_IDS).toEqual(TT_SORTS.map(s => s.id))
    expect(useTtTable(null).facetOptions).toEqual(TT_FACET_IDS)
    const chipLoop = /const FACETS = \[([^\]]+)\]/.exec(read('vue/TtTable.vue'))[1].match(/'([a-z]+)'/g).map(x => x.slice(1, -1))
    expect(sorted(chipLoop)).toEqual(sorted(TT_FACET_IDS))
    expect(TT_FACES).toEqual(['stop', 'destination', 'treehopper', 'studio']) // the Studio face (1.4.0)
    expect(TT_APP_IDS).toEqual(['treehopper', 'verythere', 'studio'])
  })
})

describe('the token lists (section 5), from the stylesheets', () => {
  const table = read('css/table.css')
  const theme = read('css/themes/cardroom.css')
  const face = styleOf(read('vue/TtFace.vue'))
  // Variables a component sets inline ('--x' in its script): not tokens
  const inline = new Set()
  for (const dir of ['vue', 'core']) for (const f of readdirSync(resolve(root, dir))) {
    if (!/\.(js|vue)$/.test(f) || f === 'tabletop.js') continue   // tabletop.js names the tokens themselves
    for (const m of read(`${dir}/${f}`).matchAll(/'(--[\w-]+)'/g)) inline.add(m[1])
  }
  const local = new Set([...declared(table), ...declared(face), ...inline])

  // 1.6.0 (the open kit): the three app marks left the list a theme supplies; the Card room theme still declares them
  it('the theme file declares the 22 theme tokens, the three legacy app marks, and no other', () => {
    expect(TT_THEME_TOKENS).toHaveLength(22)
    expect(TT_LEGACY_MARK_TOKENS).toEqual(['--mark-th', '--mark-vt', '--mark-pc'])
    expect(TT_LEGACY_MARK_TOKENS.filter(t => TT_THEME_TOKENS.includes(t))).toEqual([])
    expect(sorted(declared(theme))).toEqual(sorted([...TT_THEME_TOKENS, ...TT_LEGACY_MARK_TOKENS]))
  })
  it('no kit file reads an app mark token: an app\'s mark is its color in the collection\'s apps', () => {
    for (const f of ['css/table.css', 'vue/TtTable.vue', 'vue/TtStage.vue', 'vue/TtFace.vue', 'vue/TtCard.vue', 'core/cardroom.js']) {
      expect(/var\(\s*--mark-/.test(read(f)), f).toBe(false)
    }
  })
  it('table.css declares the 15 mechanics tokens, and reads bare only tokens and its own variables', () => {
    expect(TT_MECHANICS_TOKENS).toHaveLength(15)
    for (const t of TT_MECHANICS_TOKENS) expect(declared(table).has(t), t).toBe(true)
    const known = new Set([...TT_THEME_TOKENS, ...TT_MECHANICS_TOKENS, ...local])
    expect([...reads(table, false)].filter(t => !known.has(t))).toEqual([])
    expect(TT_MECHANICS_TOKENS.filter(t => TT_THEME_TOKENS.includes(t))).toEqual([])
  })
  it('the defaulted list is every token read with a default that no kit file sets', () => {
    const got = new Set([...reads(table, true), ...reads(theme, true), ...reads(face, true)].filter(t => !local.has(t)))
    expect(sorted(TT_DEFAULTED_TOKENS)).toEqual(sorted(got))
    expect(new Set(TT_DEFAULTED_TOKENS).size).toBe(TT_DEFAULTED_TOKENS.length)
  })
})

describe('ttConfigErrors', () => {
  it('a good config has none, and ttCheckConfig returns it', () => {
    const c = GOOD()
    expect(ttConfigErrors(c, CONTRACT_VERSION)).toEqual([])
    expect(ttCheckConfig(c, CONTRACT_VERSION)).toBe(c)
    const lean = GOOD()
    for (const k of ['table', 'labels', 'links', 'groups', 'sorts', 'filters']) delete lean[k]
    lean.modes = { planning: { solver: 'path' } }
    lean.faces = [{ id: 'treehopper', print: true }]
    lean.hand = { key: () => 'k', scope: { value: 'z' }, store: { get() {}, set() {}, remove() {} } }
    expect(ttConfigErrors(lean, CONTRACT_VERSION)).toEqual([])
  })

  const CASES = [
    ['not an object', () => null, 'config: an object'],
    ['a missing required key', c => { delete c.app }, 'config.app: required'],
    ['an unknown key', c => { c.colour = 1 }, 'config.colour: not a key here'],
    ['a contract major that is not a number', c => { c.contract = '0' }, 'config.contract: the contract major'],
    ['a contract major mismatch', c => { c.contract = 0 }, `config.contract: built for contract major 0, this kit is ${CONTRACT_VERSION} (major 1)`],
    ['an app id the registry could not hold', c => { c.app = 'Acme Co' }, "config.app: 'Acme Co' is not an app id"],
    ['an app id past 32 characters', c => { c.app = 'a'.repeat(33) }, 'is not an app id'],
    ['a source without load', c => { c.source = {} }, 'config.source.load: a function'],
    ['no faces', c => { c.faces = {} }, 'config.faces: a non-empty list'],
    ['a face of the app\'s own with neither base nor component', c => { c.faces = { poster: {} } }, "config.faces.poster: the app's own face needs a base"],
    ['a face id that is not one', c => { c.faces = { 'Big Poster': { base: 'stop' } } }, "config.faces.Big Poster: 'Big Poster' is not a face id"],
    ['an own face on a base the kit has not', c => { c.faces = { poster: { base: 'postcard' } } }, 'config.faces.poster.base: one of stop, destination, treehopper'],
    ['an own face whose component is not one', c => { c.faces = { poster: { component: 'Poster' } } }, 'config.faces.poster.component: a component'],
    ['a kit face given a component', c => { c.faces = { stop: { component: {} } } }, 'config.faces.stop.component: a kit face draws itself'],
    ['a face listed twice', c => { c.faces = [{ id: 'stop' }, { id: 'stop' }] }, "config.faces[1]: 'stop' twice"],
    ['a face print that is not a boolean', c => { c.faces.stop.print = 'yes' }, 'config.faces.stop.print: a boolean'],
    ['a theme without a class', c => { c.theme.class = ' ' }, 'config.theme.class: a non-empty class name'],
    ["the table's own class", c => { c.theme.class = 'tt tt-provo' }, "config.theme.class: 'tt' is the table's own class"],
    ['a class that is not one', c => { c.theme.class = '9lives' }, "config.theme.class: '9lives' is not a class name"],
    ['a font that is not https', c => { c.theme.fonts = ['http://x/a.css'] }, 'config.theme.fonts[0]: an https URL'],
    ['a font entry without a key', c => { c.theme.fonts = [{ href: 'https://x/a.css' }] }, 'config.theme.fonts[0].key: a string'],
    ['an <html> attribute that is not a string', c => { c.theme.htmlAttrs = { 'data-x': 1 } }, 'config.theme.htmlAttrs.data-x: a string'],
    ['a hand without a key', c => { delete c.hand.key }, 'config.hand.key: the storage key'],
    ['a hand without a scope', c => { delete c.hand.scope }, "config.hand.scope: the hand's scope"],
    ['a hand store without remove', c => { c.hand.store = { get() {}, set() {} } }, 'config.hand.store: { get, set, remove }'],
    ['no mode', c => { c.modes = {} }, 'config.modes: collection, planning or both'],
    ['an unknown solver', c => { c.modes.planning = { solver: 'tsp' } }, "config.modes.planning.solver: 'day' or 'path', not 'tsp'"],
    ['a day solver without rules', c => { c.modes.planning = { solver: 'day' } }, 'config.modes.planning.rules: the day solver needs its DayRules'],
    ['a path solver with a bad directions', c => { c.modes.planning = { solver: 'path', directions: 'mapbox' } }, 'config.modes.planning.directions: a Directions function'],
    ['a table width that is not one', c => { c.table.widths = { phone: 0, laptop: 150 } }, 'config.table.widths.phone: a width in px'],
    ['a table only that is not a function', c => { c.table.only = true }, 'config.table.only: a function of a card'],
    ['a group label for no group', c => { c.labels.groups = { genus: 'Genus' } }, 'config.labels.groups.genus: not a group'],
    ['a label that is not a string', c => { c.labels.cards = 3 }, 'config.labels.cards: a string'],
    ['a back link without href', c => { c.links.back = { label: 'Back' } }, 'config.links.back.href: a string'],
    ['an empty link list that is not a list', c => { c.links.empty = {} }, 'config.links.empty: a list of { label, href }'],
    ['no groups', c => { c.groups = [] }, 'config.groups: a non-empty list of'],
    ['a sort the table has not', c => { c.sorts = ['price'] }, "config.sorts: 'price' is not one of"],
    ['a facet the table has not', c => { c.filters.facets = ['colour'] }, "config.filters.facets: 'colour' is not one of"],
    ['a missing switch that is not a boolean', c => { c.filters.missing = 'only' }, 'config.filters.missing: a boolean'],
    ['a map that is not a component', c => { c.map = 'LLZoneMap' }, 'config.map: a component'],
  ]
  for (const [name, change, msg] of CASES) {
    it(`names ${name}`, () => {
      let c = GOOD()
      const r = change(c)
      if (r !== undefined) c = r
      const errs = ttConfigErrors(c, CONTRACT_VERSION)
      expect(errs.length, errs.join('\n')).toBe(1)
      expect(errs[0]).toContain(msg)
    })
  }

  it('lists every problem at once, and ttCheckConfig throws them as one TypeError', () => {
    const c = GOOD()
    delete c.source
    c.contract = 2
    c.faces = { poster: {} }
    c.sorts = ['price']
    const errs = ttConfigErrors(c, CONTRACT_VERSION)
    expect(errs).toHaveLength(4)
    let thrown = null
    try { ttCheckConfig(c, CONTRACT_VERSION) } catch (e) { thrown = e }
    expect(thrown).toBeInstanceOf(TypeError)
    expect(thrown.message.startsWith('createTabletop: 4 config errors\n- ')).toBe(true)
    for (const e of errs) expect(thrown.message).toContain(e)
  })

  it('reads the contract major off a semver', () => {
    expect(ttContractMajor('0.3.0')).toBe(0)
    expect(ttContractMajor('1.0.0')).toBe(1)
    expect(ttContractMajor('x')).toBeNaN()
    expect(ttConfigErrors({ ...GOOD(), contract: 1 }, '1.2.0')).toEqual([])
  })
})

describe('a card\'s face', () => {
  const sets = [{ id: 'walk', meta: { face: 'destination' } }, { id: 'trees', meta: { face: 'treehopper' } }, { id: 'odd', meta: { face: 'poster' } }, { id: 'bare' }]
  const data = { sets }
  it('is its own when it names a kit face, else its set\'s meta.face, else stop', () => {
    expect(ttFaceOf({ face: 'treehopper', set: 'walk' }, data)).toBe('treehopper')
    expect(ttFaceOf({ face: 'stop', set: 'trees' }, data)).toBe('stop')
    expect(ttFaceOf({ set: 'walk' }, data)).toBe('destination')
    expect(ttFaceOf({ face: 'poster', set: 'trees' }, data)).toBe('treehopper')
    expect(ttFaceOf({ set: 'odd' }, data)).toBe('stop')
    expect(ttFaceOf({ set: 'bare' }, data)).toBe('stop')
    expect(ttFaceOf({ set: 'trees' }, null)).toBe('stop')
    expect(ttFaceOf(null, data)).toBe('stop')
  })
  it('ttLook and ttPrintOn go through it', () => {
    expect(ttLook({ title: 'Oak', set: 'trees' }, data).face).toBe('treehopper')
    expect(ttLook({ title: 'Oak', set: 'trees' }, data).theme).toBe('th')
    expect(ttPrintOn({ set: 'trees' }, data)).toBe(true)
    expect(ttPrintOn({ set: 'walk' }, data)).toBe(false)
    expect(ttPrintOn({ set: 'trees' }, { sets, faces: { treehopper: { print: false } } })).toBe(false)
    expect(ttPrintOn({ face: 'stop' }, { faces: [{ id: 'stop', print: true }] })).toBe(true)
  })
})

describe('ttCollectionErrors', () => {
  const config = { faces: { stop: {}, destination: {} } }
  it('a good collection has none', () => {
    const c = { apps: [], sets: [{ id: 'w', meta: { face: 'destination' } }], rarities: {}, cards: [{ id: 'a', set: 'w' }, { id: 'b', face: 'stop' }] }
    expect(ttCollectionErrors(c, config)).toEqual([])
  })
  it('names the missing lists, and every face outside the config', () => {
    expect(ttCollectionErrors(null, config)).toEqual(['collection: an object { apps, sets, rarities, cards }'])
    expect(ttCollectionErrors({ cards: [] }, config)).toEqual(['collection.apps: a list', 'collection.sets: a list', 'collection.rarities: an object of rarity lists'])
    const c = { apps: [], rarities: {}, sets: [{ id: 'trees', meta: { face: 'treehopper' } }], cards: [{ id: 'oak', set: 'trees' }, { id: 'x', face: 'poster' }, 7] }
    expect(ttCollectionErrors(c, config)).toEqual([
      "collection.sets[0] (trees): meta.face 'treehopper' is not in config.faces (stop, destination)",
      "collection.cards[0] (oak): its face is 'treehopper', not in config.faces (stop, destination)",
      "collection.cards[1] (x): face 'poster' is not in config.faces (stop, destination)",
      'collection.cards[2]: an object',
    ])
  })
  it('stops at 20 lines and counts the rest', () => {
    const cards = Array.from({ length: 25 }, (_, i) => ({ id: `c${i}`, face: 'treehopper' }))
    const errs = ttCollectionErrors({ apps: [], sets: [], rarities: {}, cards }, config)
    expect(errs).toHaveLength(21)
    expect(errs[20]).toBe('and 5 more')
  })
})

describe('a theme\'s head entry', () => {
  it('the Card room gives the table\'s data-tt and tt-cr-fonts, as TtTable has them', () => {
    expect(ttThemeHead(TT_CARDROOM_THEME)).toEqual({ htmlAttrs: { 'data-tt': 'cardroom' }, link: [{ key: 'tt-cr-fonts', rel: 'stylesheet', href: CR_FONTS }] })
    expect(ttConfigErrors({ ...GOOD(), theme: TT_CARDROOM_THEME }, CONTRACT_VERSION)).toEqual([])
  })
  it('keys a font given as a URL, and leaves out htmlAttrs it does not set', () => {
    expect(ttThemeHead({ class: 'x', fonts: ['https://a', { key: 'k', href: 'https://b' }] })).toEqual({
      link: [{ key: 'tt-theme-font-0', rel: 'stylesheet', href: 'https://a' }, { key: 'k', rel: 'stylesheet', href: 'https://b' }],
    })
  })
  it("with no fonts key, the Card room's fonts (the ones its tokens name); fonts: [] asks for none", () => {
    expect(ttThemeHead({ class: 'x' })).toEqual({ link: [{ key: 'tt-cr-fonts', rel: 'stylesheet', href: CR_FONTS }] })
    expect(ttThemeHead({ class: 'x', htmlAttrs: { 'data-tt': 'x' } })).toEqual({ htmlAttrs: { 'data-tt': 'x' }, link: [{ key: 'tt-cr-fonts', rel: 'stylesheet', href: CR_FONTS }] })
    expect(ttThemeHead({ class: 'x', fonts: [] })).toEqual({ link: [] })
    expect(ttConfigErrors({ ...GOOD(), theme: { class: 'x', fonts: [] } }, CONTRACT_VERSION)).toEqual([])
  })
})
