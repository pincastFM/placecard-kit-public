// The path solver's cases: Treehopper's planner over a made-up block of Manhattan trees, every
// end (open, back to the start, a destination), every order (planned, fixed, placed), timed and
// untimed, on the estimate and on a fake street service that stands in for Mapbox. Plain
// shapes only (no import from the planner), so the same cases run against Treehopper's code
// at its pinned commit and against the kit's.

interface LatLon { lat: number; lon: number }
interface Candidate { card: string; place: { id: string; lat: number; lon: number } }
type Mode = 'walk' | 'bike'
type Directions = (points: LatLon[], mode: Mode) => Promise<{ legs: { m: number; min: number }[]; geometry: [number, number][] }>

// A seeded random (mulberry32): the same numbers on every machine
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6

export const START: LatLon = { lat: 40.7359, lon: -73.9911 } // Union Square
export const DEST: LatLon = { lat: 40.7484, lon: -73.9857 }  // 34th and Fifth
export const FAR: LatLon = { lat: 40.7061, lon: -74.0087 }   // the Financial District

const TYPES = [
  'Pin oak', 'London planetree', 'Honeylocust', 'Callery pear', 'Ginkgo', 'Japanese zelkova',
  'Littleleaf linden', 'Red maple', 'Norway maple', 'Sophora', 'Cherry', 'American elm',
  'Silver linden', 'Hedge maple', 'Swamp white oak', 'Sweetgum', 'Kentucky coffeetree', 'Amur maackia',
]

// Each type at one to three trees within about 800 m of the start
export const CANDIDATES: Candidate[] = (() => {
  const rand = rng(1947477)
  const out: Candidate[] = []
  let id = 100
  TYPES.forEach((card) => {
    const n = 1 + Math.floor(rand() * 3)
    for (let i = 0; i < n; i++) {
      const lat = r6(START.lat + (rand() - 0.5) * 0.014)
      const lon = r6(START.lon + (rand() - 0.5) * 0.018)
      out.push({ card, place: { id: `tree:${id++}`, lat, lon } })
    }
  })
  return out
})()

// One tree a type, in the fixture's order: a route as it is walked (routeTrees)
export const WALKED: Candidate[] = (() => {
  const seen = new Set<string>()
  return CANDIDATES.filter((c) => !seen.has(c.card) && seen.add(c.card)).slice(0, 9)
})()

function flat(a: LatLon, b: LatLon) {
  const kx = 111320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  return Math.hypot((a.lon - b.lon) * kx, (a.lat - b.lat) * 110540)
}
// A street service: each leg is the straight line times 1.3 (as the estimate) times a stretch
// for that leg and call; `failOn` throws on that call (1 = the first). `count.calls` says how
// many calls a plan made, so the golden shows which branch each case took.
export const count = { calls: 0 }
export function streets(stretch: (leg: number, call: number) => number, failOn = 0): Directions {
  let calls = 0
  return async (points, mode) => {
    calls++
    count.calls = calls
    if (calls === failOn) throw new Error(`street service down on call ${calls}`)
    const speed = mode === 'bike' ? 250 : 80
    const legs = points.slice(1).map((p, i) => {
      const m = flat(points[i], p) * 1.3 * stretch(i, calls)
      return { m, min: m / speed }
    })
    return { legs, geometry: points.map((p) => [p.lon, p.lat] as [number, number]) }
  }
}

const base = { app: 'treehopper', set: 'nyc-street-trees', madeBy: 'player:test', start: START, mode: 'walk' as Mode, dwellMin: 1 }

export interface PathCase {
  name: string
  req: any
  directions: () => Directions | null
}

export const PATH_CASES: PathCase[] = [
  { name: 'open, planned, 30 min, on the estimate', req: { ...base, end: { kind: 'open' }, minutes: 30, order: 'planned', candidates: CANDIDATES }, directions: () => null },
  { name: 'open, planned, 30 min, streets at 1.1', req: { ...base, end: { kind: 'open' }, minutes: 30, order: 'planned', candidates: CANDIDATES }, directions: () => streets(() => 1.1) },
  { name: 'open, planned, 20 min, a barrier every fourth leg', req: { ...base, end: { kind: 'open' }, minutes: 20, order: 'planned', candidates: CANDIDATES }, directions: () => streets((i) => (i % 4 === 2 ? 3 : 1.4)) },
  { name: 'open, planned, untimed', req: { ...base, end: { kind: 'open' }, minutes: null, order: 'planned', candidates: CANDIDATES }, directions: () => null },
  { name: 'back to the start, planned, 45 min, on the estimate', req: { ...base, end: { kind: 'start' }, minutes: 45, order: 'planned', candidates: CANDIDATES }, directions: () => null },
  { name: 'back to the start, planned, 45 min, streets at 1.5', req: { ...base, end: { kind: 'start' }, minutes: 45, order: 'planned', candidates: CANDIDATES }, directions: () => streets(() => 1.5) },
  { name: 'a destination, planned, 40 min, streets at 1.2', req: { ...base, end: { kind: 'destination', at: DEST, name: 'Empire State Building' }, minutes: 40, order: 'planned', candidates: CANDIDATES }, directions: () => streets(() => 1.2) },
  { name: 'a destination, planned, 25 min, by bike, on the estimate', req: { ...base, mode: 'bike', end: { kind: 'destination', at: DEST, name: null }, minutes: 25, order: 'planned', candidates: CANDIDATES }, directions: () => null },
  { name: 'fixed, untimed, a route as walked, streets at 1.3', req: { ...base, end: { kind: 'open' }, minutes: null, order: 'fixed', candidates: WALKED }, directions: () => streets(() => 1.3) },
  { name: 'placed, 15 min, on the estimate', req: { ...base, end: { kind: 'open' }, minutes: 15, order: 'placed', candidates: WALKED }, directions: () => null },
  { name: 'fixed, back to the start, 25 min, streets at 2', req: { ...base, end: { kind: 'start' }, minutes: 25, order: 'fixed', candidates: WALKED }, directions: () => streets(() => 2) },
  { name: 'nothing in reach: no candidates, 12 wanted', req: { ...base, end: { kind: 'destination', at: FAR, name: 'Wall Street' }, minutes: 20, order: 'planned', candidates: [], wanted: 12 }, directions: () => null },
  { name: 'more wanted than have a tree in reach', req: { ...base, end: { kind: 'open' }, minutes: 30, order: 'planned', candidates: CANDIDATES, wanted: 25 }, directions: () => null },
  { name: 'the street service fails: the estimate stands', req: { ...base, end: { kind: 'open' }, minutes: 30, order: 'planned', candidates: CANDIDATES }, directions: () => streets(() => 1.2, 1) },
  { name: 'the street service fails on the second call', req: { ...base, end: { kind: 'start' }, minutes: 30, order: 'planned', candidates: CANDIDATES }, directions: () => streets(() => 1.8, 2) },
  { name: 'five rounds and still over, back to the start: the estimate', req: { ...base, end: { kind: 'start' }, minutes: 45, order: 'planned', candidates: CANDIDATES }, directions: () => streets((i) => (i === 0 ? 6 : 1)) },
  { name: 'five rounds and still over, open: the timed stops win', req: { ...base, end: { kind: 'open' }, minutes: 45, order: 'planned', candidates: CANDIDATES }, directions: () => streets((i) => (i === 0 ? 6 : 1)) },
  { name: 'a destination with no point', req: { ...base, end: { kind: 'destination', at: null, name: 'Nowhere' }, minutes: 30, order: 'planned', candidates: CANDIDATES }, directions: () => null },
]

// What a case's result looks like in the golden: the record and the line, or the error
export const MADE_AT = '2026-10-28T12:00:00.000Z'
export const idFor = (i: number) => `plan-${String(i + 1).padStart(2, '0')}`
