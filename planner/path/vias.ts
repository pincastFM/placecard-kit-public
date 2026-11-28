// The player's own route (1.7.0): their stops (vias), passed in the order given, with cards filling
// in between them to fit the time, on plan.ts's rules: one place for each card, the cheapest one
// in first until nothing more fits, then the line timed on real streets, the costliest card off
// while it runs over. A via is never cut and never dwelt at. plan.ts stays Treehopper's file byte
// for byte, so this is its own solver; a request with no vias never comes here.
//
// The record keeps its shape: its stops are the cards. With an open end the last via is the end, so
// the record names it as a destination (its label the name). Where each via falls comes back beside
// the record. 1.9.0: each via pass carries its own leg (the way to it from the point before), and a
// card's leg (or the finish's) runs from the point before it, a via when one is between, so the
// cards' legs, the finish's and the passes' sum to the totals (1.8.0's card legs ran through the
// vias). A request with no vias never comes here, so its records are unchanged.
import { estM, estMin, meters } from './geo'
import { PLAN_VERSION } from './plan'
import type { Candidate, Directions, ItineraryRecord, ItineraryStop, LatLon, Leg, Mode, PlanRequest, Timing } from './types'

/** One of the player's own stops: a point, and the name the player gives it */
export interface Via extends LatLon {
  label?: string | null
}

/** Where the line passes a via: n counts the vias from 1, after the stops placed before it */
export interface ViaPass {
  n: number
  at: LatLon
  label: string | null
  arriveMin: number // minutes from the start
  after: number     // stops placed before it; 0 when it comes straight from the start
  /** 1.9.0: the way here from the point before it (the start, a card or a via), at the timing's
   *  pace; the next card's (or the finish's) leg runs on from here. An open end's last via is the
   *  end, and its leg is the finish's. Optional, so a 1.8.0 caller's own passes still type-check. */
  leg?: Leg
}

// A via as the solver keeps it; `at` goes into every point list as itself, so a street timing can
// tell a via (no dwell) from a card's place
export interface ViaPoint {
  at: LatLon
  label: string | null
}

interface Node {
  at: LatLon
  via: number | null      // the via's index, or null for a card
  c: Candidate | null
}

const MAX_ROUNDS = 5 // street timings per plan, as plan.ts

/** The vias as the solver keeps them; throws an Error naming each one it cannot read */
export function viaPoints(vias: unknown): ViaPoint[] {
  if (!Array.isArray(vias)) throw new Error('vias: a list of { lat, lon, label? }')
  const errs: string[] = []
  const out = vias.map((v: any, i) => {
    const ok = v && typeof v === 'object' && Number.isFinite(v.lat) && Number.isFinite(v.lon) && Math.abs(v.lat) <= 90 && Math.abs(v.lon) <= 180
    if (!ok) errs.push(`vias[${i}]: not { lat, lon }`)
    if (ok && v.label != null && typeof v.label !== 'string') errs.push(`vias[${i}].label: a string or null`)
    return { at: { lat: ok ? v.lat : 0, lon: ok ? v.lon : 0 }, label: ok && typeof v.label === 'string' ? v.label : null }
  })
  if (errs.length) throw new Error(errs.join('; '))
  return out
}

// The fixed line a via route runs on: the start, the vias, the end (with an open end, the last via)
export function viaAnchors(req: Pick<PlanRequest, 'start' | 'end'>, vias: ViaPoint[]): { anchors: LatLon[]; middle: ViaPoint[]; endAt: LatLon } {
  if (req.end.kind === 'destination' && !req.end.at) throw new Error('a destination needs a point')
  const open = req.end.kind === 'open'
  const endAt = req.end.kind === 'start' ? req.start : req.end.kind === 'destination' ? (req.end.at as LatLon) : vias[vias.length - 1].at
  const middle = open ? vias.slice(0, -1) : vias
  return { anchors: [req.start, ...middle.map((v) => v.at), endAt], middle, endAt }
}

// What a place adds to the line at its cheapest gap, in straight meters
function detourM(anchors: LatLon[], p: LatLon): number {
  let best = Infinity
  for (let i = 0; i < anchors.length - 1; i++) {
    const add = meters(anchors[i], p) + meters(p, anchors[i + 1]) - meters(anchors[i], anchors[i + 1])
    if (add < best) best = add
  }
  return best
}

const lineM = (pts: LatLon[]) => sum(pts.slice(1).map((p, i) => meters(pts[i], p)))

/** plan.ts pickOne's reach, on the via line: the line with this place on it, and its minute, fit the time */
export function viaInReach(c: Candidate, anchors: LatLon[], T: number | null, mode: Mode, dwell: number): boolean {
  if (T === null) return true
  return !(estMin(lineM(anchors) + detourM(anchors, c.place), mode) + dwell > T)
}

export interface ViaPlan {
  record: ItineraryRecord
  geometry: [number, number][]
  passes: ViaPass[]
  points: LatLon[]            // the line's points in order: the start, every card and via, the end
  timingError: string | null  // why the street timing failed, when it did
}

/** A route through the player's vias, as a v1 record (solvePath raises it to v2). Planned order only. */
export async function planVias(req: PlanRequest, vias: ViaPoint[], directions: Directions | null): Promise<ViaPlan> {
  if (!vias.length) throw new Error('vias: at least one')
  if (req.order !== 'planned') throw new Error("vias: the player's own stops take a planned order (cards fill in between them)")
  const { start, mode, dwellMin: dwell, minutes: T } = req
  const { anchors, middle, endAt } = viaAnchors(req, vias)
  const viaIndex = new Map(vias.map((v, i) => [v, i]))

  const picked = pickOne(req.candidates, anchors, T, mode, dwell)
  let route = insertion(picked, middle.map((v) => ({ at: v.at, via: viaIndex.get(v)!, c: null })), start, endAt, T, mode, dwell)

  const pointsOf = (r: Node[]): LatLon[] => [start, ...r.map((n) => n.at), endAt]
  const cardsIn = (r: Node[]) => r.filter((n) => n.c).length
  let legs = estimateLegs(pointsOf(route), mode)
  let geometry: [number, number][] | null = null
  let timing: Timing = 'estimate'
  let timingError: string | null = null

  if (directions) {
    try {
      for (let round = 1; round <= MAX_ROUNDS; round++) {
        const pts = pointsOf(route)
        const walk = await directions(pts, mode)
        if (!walk || !Array.isArray(walk.legs) || walk.legs.length !== pts.length - 1) {
          throw new Error(`street timing gave ${walk && Array.isArray(walk.legs) ? walk.legs.length : 'no'} legs for ${pts.length - 1}`)
        }
        legs = walk.legs
        geometry = walk.geometry
        timing = 'mapbox'
        const total = sum(legs.map((l) => l.min)) + dwell * cardsIn(route)
        if (T === null || total <= T || !cardsIn(route)) break
        const cut = dropToFit(route, legs, pts, T, dwell, mode)
        route = cut.route
        legs = cut.legs
        if (round === MAX_ROUNDS) {
          geometry = null
          timing = 'estimate'
        }
      }
    } catch (error: any) {
      timingError = String(error?.message || error)
      legs = estimateLegs(pointsOf(route), mode)
      geometry = null
      timing = 'estimate'
    }
  }

  const stops: ItineraryStop[] = []
  const passes: ViaPass[] = []
  let arrive = 0
  let acc: Leg = { m: 0, min: 0 } // the way since the point before (the start, a card or a via)
  route.forEach((n, i) => {
    arrive += legs[i].min
    acc = { m: acc.m + legs[i].m, min: acc.min + legs[i].min }
    if (n.c) {
      stops.push({ n: stops.length + 1, card: n.c.card, place: n.c.place, leg: roundLeg(acc), arriveMin: round1(arrive), status: 'planned' })
      acc = { m: 0, min: 0 }
      arrive += dwell
    } else {
      passes.push({ n: n.via! + 1, at: { lat: n.at.lat, lon: n.at.lon }, label: vias[n.via!].label, arriveMin: round1(arrive), after: stops.length, leg: roundLeg(acc) })
      acc = { m: 0, min: 0 }
    }
  })
  const last = legs[route.length]
  arrive += last.min
  acc = { m: acc.m + last.m, min: acc.min + last.min }
  const finish = { leg: roundLeg(acc), arriveMin: round1(arrive) }
  const lastVia = vias[vias.length - 1]
  if (req.end.kind === 'open') passes.push({ n: vias.length, at: { lat: endAt.lat, lon: endAt.lon }, label: lastVia.label, arriveMin: finish.arriveMin, after: stops.length, leg: { ...finish.leg } })

  const walkMin = sum(legs.map((l) => l.min))
  const wanted = req.wanted ?? new Set(req.candidates.map((c) => c.card)).size
  const end: ItineraryRecord['end'] = req.end.kind === 'open'
    ? { kind: 'destination', at: endAt, name: lastVia.label }
    : { kind: req.end.kind, at: endAt, name: req.end.kind === 'destination' ? req.end.name || null : null }
  const record: ItineraryRecord = {
    id: newId(),
    app: req.app,
    set: req.set,
    madeBy: req.madeBy,
    madeAt: new Date().toISOString(),
    planVersion: PLAN_VERSION,
    start,
    end,
    mode,
    minutes: T,
    order: req.order,
    stops,
    finish,
    totals: {
      stops: stops.length,
      m: Math.round(sum(legs.map((l) => l.m))),
      walkMin: round1(walkMin),
      totalMin: round1(walkMin + dwell * stops.length),
      timing,
    },
    leftOver: Math.max(0, wanted - stops.length),
  }
  const points = pointsOf(route)
  return { record, geometry: geometry || points.map((p) => [p.lon, p.lat]), passes, points, timingError }
}

// One place for each card, inside the reach: the one that adds the least to the line
function pickOne(cands: Candidate[], anchors: LatLon[], T: number | null, mode: Mode, dwell: number): Candidate[] {
  const bare = lineM(anchors)
  const best = new Map<string, { key: number; c: Candidate }>()
  for (const c of cands) {
    const key = detourM(anchors, c.place)
    if (T !== null && estMin(bare + key, mode) + dwell > T) continue
    const had = best.get(c.card)
    if (!had || key < had.key) best.set(c.card, { key, c })
  }
  return [...best.values()].map((v) => v.c)
}

// The line starts as the walk through the vias, and each card goes in where it adds the least
// time, cheapest first, until nothing more fits (plan.ts insertion, from a longer first line)
function insertion(pool: Candidate[], nodes: Node[], a: LatLon, b: LatLon, T: number | null, mode: Mode, dwell: number): Node[] {
  const route = nodes.slice()
  const pts: LatLon[] = [a, ...route.map((n) => n.at), b]
  const used = new Set<string>()
  let total = estMin(lineM(pts), mode)
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
    route.splice(best.i, 0, { at: best.c.place, via: null, c: best.c })
    used.add(best.c.card)
    total += best.add
  }
  return route
}

// Drops cards until the projected line fits, the costliest first (plan.ts dropToFit, planned and
// careful: a via line always has an end); a via stays. A leg that joins two points is the
// estimate, scaled to how the streets ran against it on this line.
function dropToFit(route: Node[], legs: Leg[], pts: LatLon[], T: number, dwell: number, mode: Mode) {
  const r = route.slice()
  const P = pts.slice()
  const L = legs.map((l) => ({ ...l }))
  const est = sum(P.slice(1).map((p, i) => estMin(meters(P[i], p), mode)))
  const whole = est > 0 ? sum(L.map((l) => l.min)) / est : 1
  const ratio = Math.max(streetRatio(P, L, mode), whole)
  const total = () => sum(L.map((l) => l.min)) + dwell * r.filter((n) => n.c).length
  do {
    let k = -1
    let worst = -Infinity
    for (let i = 0; i < r.length; i++) {
      if (!r[i].c) continue
      const cost = L[i].min + L[i + 1].min - estMin(meters(P[i], P[i + 2]), mode)
      if (cost > worst) { worst = cost; k = i }
    }
    if (k < 0) break
    const d = meters(P[k], P[k + 2])
    L.splice(k, 2, { m: estM(d, mode) * ratio, min: estMin(d, mode) * ratio })
    r.splice(k, 1)
    P.splice(k + 1, 1)
  } while (r.some((n) => n.c) && total() > T)
  return { route: r, legs: L }
}

// plan.ts streetRatio: the median leg's ratio against the estimate, never under 1
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
