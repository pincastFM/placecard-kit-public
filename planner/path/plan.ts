// Placecard's itinerary builder (spec section 3): one place for each card, an order, a cut
// at the time, then the walk timed on real streets. Knows cards, places, minutes and order,
// and nothing of any one app. The app hands in its candidate places and a Directions
// function (mapbox.ts); with none, or when it fails, the estimate stands.
import { estM, estMin, meters, reachM } from './geo'
import type {
  Candidate, Directions, ItineraryRecord, ItineraryStop, LatLon, Leg, Mode, PlanRequest, Timing,
} from './types'

export const PLAN_VERSION = 1
const MAX_ROUNDS = 5 // Mapbox timings per plan; each round drops what runs over

interface Plan {
  record: ItineraryRecord
  geometry: [number, number][] // [lon, lat], from the start through every stop to the end
}

export async function planItinerary(req: PlanRequest, directions: Directions | null): Promise<Plan> {
  const { start, mode, dwellMin: dwell, minutes: T } = req
  const endAt: LatLon | null = req.end.kind === 'start' ? start : req.end.kind === 'destination' ? req.end.at || null : null
  if (req.end.kind === 'destination' && !endAt) throw new Error('a destination needs a point')

  let route: Candidate[]
  if (req.order === 'planned') {
    const picked = pickOne(req.candidates, start, endAt, T, mode, dwell)
    route = endAt ? insertion(picked, start, endAt, T, mode, dwell) : nearestNext(picked, start, T, mode, dwell)
  } else {
    route = asGiven(req.candidates, start, endAt, T, mode, dwell)
  }

  const pointsOf = (r: Candidate[]): LatLon[] => [start, ...r.map((c) => c.place), ...(endAt ? [endAt] : [])]
  let legs = estimateLegs(pointsOf(route), mode)
  let geometry: [number, number][] | null = null
  let timing: Timing = 'estimate'

  if (directions && (route.length || endAt)) {
    try {
      // Open: the most stops Mapbox has timed inside the time so far (the first stops of a
      // timed route are timed too), kept in case the cut by the estimate ends worse
      let timedFit: { route: Candidate[]; legs: Leg[] } | null = null
      for (let round = 1; round <= MAX_ROUNDS; round++) {
        const walk = await directions(pointsOf(route), mode)
        legs = walk.legs
        geometry = walk.geometry
        timing = 'mapbox'
        const total = sum(legs.map((l) => l.min)) + dwell * route.length
        if (T === null || total <= T || !route.length) break
        if (!endAt) {
          const n = stopsInTime(legs, dwell, T)
          if (n > (timedFit?.route.length ?? 0)) timedFit = { route: route.slice(0, n), legs: legs.slice(0, n) }
        }
        // over the time: the stop that costs the most comes off, and so on until it fits
        const cut = dropToFit(route, legs, pointsOf(route), T, dwell, mode, req.order === 'planned', !!endAt)
        route = cut.route
        legs = cut.legs
        if (round === MAX_ROUNDS) {
          geometry = null
          timing = 'estimate'
        }
      }
      // the timed stops win when the cut ended on the estimate or with fewer stops
      if (timedFit && (timing === 'estimate' || timedFit.route.length > route.length)) {
        route = timedFit.route
        legs = timedFit.legs
        timing = 'mapbox'
        geometry = (await directions(pointsOf(route), mode).catch(() => null))?.geometry ?? null
      }
    } catch (error: any) {
      console.error('itinerary: street timing failed, the estimate stands:', error?.message || error)
      legs = estimateLegs(pointsOf(route), mode)
      geometry = null
      timing = 'estimate'
    }
  }

  const stops: ItineraryStop[] = []
  let arrive = 0
  route.forEach((c, i) => {
    arrive += legs[i].min
    stops.push({ n: i + 1, card: c.card, place: c.place, leg: roundLeg(legs[i]), arriveMin: round1(arrive), status: 'planned' })
    arrive += dwell
  })
  const last = endAt ? legs[route.length] : null
  const walkMin = sum(legs.map((l) => l.min))
  const wanted = req.wanted ?? new Set(req.candidates.map((c) => c.card)).size

  const record: ItineraryRecord = {
    id: newId(),
    app: req.app,
    set: req.set,
    madeBy: req.madeBy,
    madeAt: new Date().toISOString(),
    planVersion: PLAN_VERSION,
    start,
    end: { kind: req.end.kind, at: endAt, name: req.end.kind === 'destination' ? req.end.name || null : null },
    mode,
    minutes: T,
    order: req.order,
    stops,
    finish: last ? { leg: roundLeg(last), arriveMin: round1(arrive + last.min) } : null,
    totals: {
      stops: stops.length,
      m: Math.round(sum(legs.map((l) => l.m))),
      walkMin: round1(walkMin),
      totalMin: round1(walkMin + dwell * stops.length),
      timing,
    },
    leftOver: Math.max(0, wanted - stops.length),
  }
  return { record, geometry: geometry || pointsOf(route).map((p) => [p.lon, p.lat]) }
}

// One place for each card, inside the reach. Open: the one nearest the start. With an end:
// the one that adds the least to the trip.
function pickOne(cands: Candidate[], a: LatLon, b: LatLon | null, T: number | null, mode: Mode, dwell: number): Candidate[] {
  const best = new Map<string, { key: number; c: Candidate }>()
  for (const c of cands) {
    const toA = meters(a, c.place)
    let key: number
    if (b) {
      key = toA + meters(c.place, b)
      if (T !== null && estMin(key, mode) + dwell > T) continue
    } else {
      key = toA
      if (T !== null && toA > reachM(T, mode)) continue
    }
    const had = best.get(c.card)
    if (!had || key < had.key) best.set(c.card, { key, c })
  }
  return [...best.values()].map((v) => v.c)
}

// Open: nearest-next from the start, cut where the time runs out
function nearestNext(pool: Candidate[], a: LatLon, T: number | null, mode: Mode, dwell: number): Candidate[] {
  const left = pool.slice()
  const route: Candidate[] = []
  let cur = a
  let used = 0
  while (left.length) {
    let j = 0
    let dj = Infinity
    left.forEach((c, i) => {
      const d = meters(cur, c.place)
      if (d < dj) { dj = d; j = i }
    })
    const leg = estMin(dj, mode) + dwell
    if (T !== null && used + leg > T) break
    used += leg
    const [c] = left.splice(j, 1)
    route.push(c)
    cur = c.place
  }
  return route
}

// With an end: the trip starts as the straight walk from start to end, and each stop goes
// in where it adds the least time, cheapest first, until nothing more fits
function insertion(pool: Candidate[], a: LatLon, b: LatLon, T: number | null, mode: Mode, dwell: number): Candidate[] {
  const route: Candidate[] = []
  const pts: LatLon[] = [a, b]
  const used = new Set<string>()
  let total = estMin(meters(a, b), mode)
  for (;;) {
    let best: { add: number; i: number; c: Candidate } | null = null
    for (const c of pool) {
      if (used.has(c.card)) continue
      for (let i = 0; i < pts.length - 1; i++) {
        const add = estMin(meters(pts[i], c.place) + meters(c.place, pts[i + 1]) - meters(pts[i], pts[i + 1]), mode) + dwell
        if (!best || add < best.add) best = { add, i, c }
      }
    }
    if (!best || (T !== null && total + best.add > T)) break
    pts.splice(best.i + 1, 0, best.c.place)
    route.splice(best.i, 0, best.c)
    used.add(best.c.card)
    total += best.add
  }
  return route
}

// Fixed or placed by hand: as given, cut at the time (the walk on to the end kept)
function asGiven(cands: Candidate[], a: LatLon, b: LatLon | null, T: number | null, mode: Mode, dwell: number): Candidate[] {
  if (T === null) return cands.slice()
  const route: Candidate[] = []
  let cur = a
  let used = 0
  for (const c of cands) {
    const leg = estMin(meters(cur, c.place), mode) + dwell
    const home = b ? estMin(meters(c.place, b), mode) : 0
    if (used + leg + home > T) break
    used += leg
    route.push(c)
    cur = c.place
  }
  return route
}

// Drops stops until the projected walk fits: the costliest first when planned (what it adds
// over walking straight past it), the last first when the order is fixed. A leg that joins
// two stops is the estimate, scaled to how the streets ran against it on this route.
// careful: scaled by the whole route's ratio when that is higher than the median leg's. A
// route with an end cuts carefully: it has no timed stops to fall back on.
function dropToFit(route: Candidate[], legs: Leg[], pts: LatLon[], T: number, dwell: number, mode: Mode, planned: boolean, careful: boolean) {
  const r = route.slice()
  const P = pts.slice()
  const L = legs.map((l) => ({ ...l }))
  const est = sum(P.slice(1).map((p, i) => estMin(meters(P[i], p), mode)))
  const whole = est > 0 ? sum(L.map((l) => l.min)) / est : 1
  const ratio = Math.max(streetRatio(P, L, mode), careful ? whole : 1)
  const total = () => sum(L.map((l) => l.min)) + dwell * r.length
  do {
    let k = r.length - 1
    if (planned) {
      let worst = -Infinity
      for (let i = 0; i < r.length; i++) {
        const hasNext = i + 2 < P.length
        const cost = L[i].min + (hasNext ? L[i + 1].min - estMin(meters(P[i], P[i + 2]), mode) : 0)
        if (cost > worst) { worst = cost; k = i }
      }
    }
    if (k + 2 < P.length) {
      const d = meters(P[k], P[k + 2])
      L.splice(k, 2, { m: estM(d, mode) * ratio, min: estMin(d, mode) * ratio })
    } else {
      L.splice(k, 1)
    }
    r.splice(k, 1)
    P.splice(k + 1, 1)
  } while (r.length && total() > T)
  return { route: r, legs: L }
}

// How many of an Open route's first stops fit the time on these legs (one leg a stop)
function stopsInTime(legs: Leg[], dwell: number, T: number): number {
  let t = 0
  let n = 0
  for (const l of legs) {
    t += l.min + dwell
    if (t > T) break
    n++
  }
  return n
}

// How the streets ran against the estimate on this route: the median leg's ratio, never under
// 1. The median, so a few legs across a barrier (two trees either side of a fence or a
// highway, meters apart and many minutes on foot) do not stretch every other leg and cut
// the whole route.
function streetRatio(P: LatLon[], L: Leg[], mode: Mode): number {
  const rs: number[] = []
  L.forEach((l, i) => {
    const e = estMin(meters(P[i], P[i + 1]), mode)
    if (e > 0) rs.push(l.min / e)
  })
  if (!rs.length) return 1
  rs.sort((a, b) => a - b)
  return Math.max(1, rs[Math.floor(rs.length / 2)])
}

function estimateLegs(pts: LatLon[], mode: Mode): Leg[] {
  return pts.slice(1).map((p, i) => {
    const d = meters(pts[i], p)
    return { m: estM(d, mode), min: estMin(d, mode) }
  })
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const round1 = (x: number) => Math.round(x * 10) / 10
const roundLeg = (l: Leg): Leg => ({ m: Math.round(l.m), min: round1(l.min) })

function newId(): string {
  const c = (globalThis as any).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
