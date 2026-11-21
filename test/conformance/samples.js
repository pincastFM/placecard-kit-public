// The kit's two sample instances for conformance: what an instance hands ttConformance, made up here.
// sample-day is VeryThere-like (stop and destination faces, the Card room under its own sheet, the day solver on
// the default rules); sample-path is Treehopper-like (the Treehopper face, the bare table under a full theme of its
// own, the path solver on the estimate).
import { DAY_HOURS } from '@pincast/placecard-kit/planner'
import { PATH_CASES } from '../../planner/test/fixtures/path-cases'

const memStore = () => { const m = new Map(); return { get: k => (m.has(k) ? m.get(k) : null), set: (k, v) => { m.set(k, v) }, remove: (k) => { m.delete(k) } } }

// ── sample-day
const STOP = { id: 'walk-1:1', app: 'verythere', set: 'walk-1', face: 'stop', title: 'The Lyceum Theatre', subtitle: 'Theater, 1903', type: 'Theater, 1903', fact: '149 West 45th Street', back: 'South side.', stats: [], number: 1, of: 3, rarity: 'Common', rarityRank: 0, rarityCount: null, foil: false, accent: '#3d5a3a', img: null, credit: null, held: true, collected: '2026-10-18', added: 2, kind: 'see', interests: ['history'] }
const DAY_COLLECTION = {
  apps: [{ id: 'verythere', name: 'VeryThere', color: '#FFB61E' }],
  sets: [
    { id: 'walk-1', app: 'verythere', name: 'A Sample Walk', short: 'SAMPLE', total: 3, kind: 'walk', action: 'Open the walk' },
    { id: 'town', app: 'verythere', name: 'Sample Town', short: 'TOWN', total: 40, kind: 'destination', meta: { face: 'destination' } },
  ],
  rarities: { walk: ['Common', 'Uncommon', 'Rare', 'Legendary'], destination: ['Common', 'Uncommon'] },
  cards: [
    STOP,
    { ...STOP, id: 'walk-1:2', title: 'The Belasco', number: 2, rarity: 'Uncommon', rarityRank: 1, held: false, collected: null, added: null, interests: ['art'] },
    { ...STOP, id: 'town:swig', set: 'town', face: undefined, title: 'Swig', subtitle: 'Soda shop', number: null, of: null, kind: 'sweets', interests: [] },
    { ...STOP, id: 'town:square', set: 'town', face: undefined, title: 'Brigham Square', subtitle: 'Public plaza', number: null, of: null, kind: 'parks', interests: ['outdoors', 'free'] },
  ],
}
// The day solver's input: zone cards as an app's zone API sends them (three of Provo's)
const ZONE_CARDS = [
  { key: 'ovt:swig', title: 'Swig', subtitle: 'Soda shop', rarity: 'Common', lat: 40.254313, lng: -111.656303, chip: 'sweets', interests: [] },
  { key: 'ovt:square', title: 'Brigham Square', subtitle: 'Public plaza', rarity: 'Common', lat: 40.249203, lng: -111.648384, chip: 'parks', interests: ['outdoors', 'free'] },
  { key: 'ovt:aloha', title: 'Aloha Plate', subtitle: 'Hawaiian restaurant', rarity: 'Common', lat: 40.248671, lng: -111.647064, chip: 'food', interests: [] },
]
// A small app's DayRules, every key the solver needs (an app builds its own from its deal; Provo's are NYID's)
const rad = d => (d * Math.PI) / 180
const meters = (a, b) => {
  const x = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(x))
}
const rng = (seed) => { // mulberry32
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}
const nearest = (pool, from) => [...pool].sort((a, b) => meters(from, a) - meters(from, b))
export const SAMPLE_RULES = {
  tz: 'America/Denver',
  meals: [
    { id: 'lunch', label: 'Lunch', from: 11 * 60 + 30, to: 14 * 60, chips: ['food', 'cafes'] },
    { id: 'dinner', label: 'Dinner', from: 17 * 60 + 30, to: 20 * 60 + 30, chips: ['food'] },
  ],
  gap: 10,
  seeMin: 45,
  alts: 2,
  seeChips: ['parks', 'museums', 'campus'],
  dayEnd: 22 * 60,
  chipFamily: { food: 'eat', cafes: 'eat', sweets: 'eat', parks: 'see', museums: 'see', campus: 'see' },
  hours: DAY_HOURS,
  occurrences: () => [],
  walkMinutes: (a, b) => Math.round(meters(a, b) / 80),
  meters,
  rng,
  clock: (min) => { const h = Math.floor(min / 60) % 24; return `${((h + 11) % 12) + 1}:${String(min % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` },
  rank: (pool, from) => nearest(pool, from),
  ring: (pool, from, need) => nearest(pool, from).slice(0, need),
}
const DAY_INPUT = { cards: ZONE_CARDS, events: [], center: { lat: 40.2559, lng: -111.64535 } }
const META = n => ({ id: `day-${n}`, set: 'town', madeAt: '2026-10-28T16:00:00.000Z' })

export const SAMPLE_DAY_CSS = `/* sample-day's own sheet: two theme values over the Card room, its own tokens, a rule for its own class */
.tt-sample{
  --gold:#C8A24A;
  --spot:rgba(200,162,74,.2);
  --sx-note:#E9E2D0;
}
.tt-sample .tt-sx-note{ color:var(--sx-note); }
@media (min-width: 900px){ .tt-sample{ --gold-2:#E2C27A; } }
`

export const SAMPLE_DAY = {
  name: 'sample-day',
  config: {
    contract: 1,
    app: 'verythere',
    source: { load: async () => DAY_COLLECTION },
    faces: { stop: {}, destination: {} },
    theme: { class: 'tt-sample', fonts: [{ key: 'tt-sx-fonts', href: 'https://fonts.example/sample.css' }], htmlAttrs: { 'data-tt': 'sample' } },
    hand: { key: () => 'sx_hand_town', scope: 'town', store: memStore() },
    modes: { collection: true, planning: { solver: 'day', rules: SAMPLE_RULES } },
    table: { key: 'sx_table', stacked: true },
    links: { back: { label: 'Map', href: '/town' } },
    groups: ['kind', 'rarity', 'none'],
  },
  collection: DAY_COLLECTION,
  css: [{ name: 'sample-day.css', text: SAMPLE_DAY_CSS }],
  base: 'cardroom',
  own: ['tt-sx-note'],
  plans: [
    { name: 'three cards from 1 PM', input: { ...DAY_INPUT, hand: ZONE_CARDS.map(c => ({ key: c.key, kind: 'card' })), win: { date: '2026-10-28', start: 13 * 60, hours: 4 } }, meta: META(1) },
    { name: 'no window', input: { ...DAY_INPUT, hand: [{ key: 'ovt:swig', kind: 'card' }], win: null }, meta: META(2) },
  ],
  props: { tag: 'Town' },
}

// ── sample-path
const TREE = { id: 'th:pin-oak', app: 'treehopper', set: 'th-species', title: 'Pin oak', subtitle: 'Quercus palustris', type: 'Tree', fact: 'A street oak.', back: '', stats: [], number: 1, of: 3, rarity: 'Common', rarityRank: 0, rarityCount: 120, foil: false, accent: '#4a6b3a', img: null, credit: null, held: true, collected: '2026-10-20', added: 1, kind: 'tree', interests: [] }
const PATH_COLLECTION = {
  apps: [{ id: 'treehopper', name: 'Treehopper', color: '#4A8B3A' }],
  sets: [{ id: 'th-species', app: 'treehopper', name: 'Street Trees', short: 'TREES', total: 3, kind: 'species', meta: { face: 'treehopper' } }],
  rarities: { species: ['Common', 'Uncommon', 'Rare', 'Unique'] },
  cards: [
    TREE,
    { ...TREE, id: 'th:ginkgo', title: 'Ginkgo', subtitle: 'Ginkgo biloba', number: 2, rarity: 'Uncommon', rarityRank: 1, held: false, collected: null, added: null },
    { ...TREE, id: 'th:zelkova', title: 'Japanese zelkova', subtitle: 'Zelkova serrata', number: 3, rarity: 'Rare', rarityRank: 2, foil: false, held: false, collected: null, added: null },
  ],
}

export const SAMPLE_PATH_CSS = `/* sample-path's theme: the bare table (css/table.css) under it, so it declares all 25 */
.tt.tt-grove{
  --ground:#F4EFE3; --ground-2:#ECE5D4; --surface:#FFFDF7; --backdrop:rgba(20,30,20,.6); --line:rgba(30,40,30,.14); --line-2:rgba(30,40,30,.24);
  --chrome:#2F4A2A; --chrome-2:#3E5E37; --chrome-3:#577A4E;
  --mark-th:#4A8B3A; --mark-vt:#FFB61E; --mark-pc:#2B6CB0;
  --gold:#B8862B; --gold-2:#D9A84A; --spot:rgba(74,139,58,.18); --grain:url("data:image/png;base64,AAAA"); --grain-a:.06;
  --font-display:"Fraunces", Georgia, serif; --font-text:"Inter", system-ui, sans-serif; --font-mono:"IBM Plex Mono", monospace;
  --r-1:4px; --r-2:8px; --r-3:14px; --r-pill:999px; --shadow-card:0 1px 2px rgba(0,0,0,.2), 0 6px 14px rgba(0,0,0,.12);
  --thf-frame:#2F4A2A;
}
`

export const SAMPLE_PATH = {
  name: 'sample-path',
  config: {
    contract: 1,
    app: 'treehopper',
    source: { load: async () => PATH_COLLECTION },
    faces: [{ id: 'treehopper', print: true }],
    theme: { class: 'tt-grove' },
    hand: { key: 'th_hand', scope: 'nyc', store: memStore() },
    modes: { collection: true, planning: { solver: 'path', directions: async () => { throw new Error('the sample never calls a street service') } } },
    sorts: ['rarest', 'name', 'number'],
    filters: { facets: ['rarity'], missing: false, search: false },
  },
  collection: PATH_COLLECTION,
  css: [{ name: 'sample-path.css', text: SAMPLE_PATH_CSS }],
  base: 'table',
  directions: null,
  plans: ['open, planned, 30 min, on the estimate', 'a destination, planned, 25 min, by bike, on the estimate', 'placed, 15 min, on the estimate']
    .map(name => ({ name, input: { ...PATH_CASES.find(c => c.name === name).req, app: 'treehopper', set: 'th-species' } })),
}
