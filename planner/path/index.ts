// The path solver: Treehopper's planItinerary (plan.ts, moved unchanged from treehopper-next),
// its record raised to v2. The v2 record adds what v1 counts but does not name: each
// candidate card left off the route, with why.
//
// 1.7.0 adds, each only when a request asks for it (a request with none plans as 1.6.2 did):
// - modes: run (the walk's streets at MODES.run's pace) and transit (the host's TransitRouter);
// - a time rule (when: leave now, leave at, arrive by), solved to the record's clock;
// - the player's own stops (vias), passed in her order, cards filling in between (vias.ts).
import { MODES, estMin, meters, reachM } from './geo'
import { planItinerary } from './plan'
import type { Candidate, Directions, ItineraryRecord, LatLon, Leg, Mode, PlanRequest, TimedWalk } from './types'
import type { LeftOver, PlanRecord } from '../../contract/record'
import { upgradeV1 } from '../record'
import { planVias, viaAnchors, viaInReach, viaPoints } from './vias'
import type { Via, ViaPass, ViaPoint } from './vias'
import { clockAt, resolveWhen } from './when'
import type { PlanWhen } from './when'
import { transitTimer } from './transit'
import type { TransitChain, TransitItinerary, TransitRouter } from './transit'

export { planItinerary, PLAN_VERSION } from './plan'

export interface PathPlan {
  record: PlanRecord
  geometry: [number, number][] // [lon, lat], from the start through every stop to the end
  timingError: string | null   // why the street timing failed and the estimate stands; the caller logs it
  /** 1.7.0, with vias only: where the line passes each of the player's stops, in her order */
  vias?: ViaPass[]
  /** 1.7.0, in transit mode only: the way the router found for each leg of the line (start to the
   *  first point, on to the end; vias count as points), null for a leg between two points at the
   *  same place. null when the router did not time the plan (none given, or it failed). */
  transit?: (TransitItinerary | null)[] | null
}

// An adapter may name its timing: 'route' for the app's own router; 'mapbox' when left out
export interface NamedWalk extends TimedWalk {
  timing?: 'mapbox' | 'route'
}
// The modes an adapter is asked for: solvePath asks for the walk's streets for a run, and never
// asks the adapter for transit (1.7.0), so an adapter written for walk and bike stays one
export type StreetMode = 'walk' | 'bike'
export type NamedDirections = (points: LatLon[], mode: StreetMode) => Promise<NamedWalk>

/** A path request, with what 1.7.0 adds; every addition is optional */
export interface PathRequest extends PlanRequest {
  /** the player's own stops, passed in this order; cards fill in between them (a planned order only) */
  vias?: Via[] | null
  /** leave now, leave at or arrive by, on the place's clock; the solved start is the record's clock */
  when?: PlanWhen | null
}

/** solvePath's options beside the street timing */
export interface PathOptions {
  /** times a transit path, leg by leg (otpPlanToLegs over the host's own OTP call) */
  transit?: TransitRouter | null
}

/**
 * A walk through places, as a v2 record. Throws as planItinerary does (a destination with no point).
 * plan.ts stays Treehopper's file byte for byte, so the two additions wrap the adapter here: the
 * record names the adapter's timing ('route' when it says so), and a failed timing comes back as
 * timingError for the caller to log (planItinerary still writes its own console line, as it did).
 *
 * 1.7.0: mode run asks the adapter for the walk's streets ('walk') and times each leg's meters at
 * MODES.run's pace; mode transit times every leg with opts.transit (the adapter is not asked) and,
 * with none, the estimate stands; a mode left out is walk, and any other (a car) throws. when gives
 * the record a clock: leave now or at, its start; arrive by, the time allowed is cut to the minutes
 * left before it and the start is solved back from it (transit: the router's arrive by). vias go to
 * the via solver. Each throws an Error naming the field when it cannot be read.
 */
export async function solvePath(req: PathRequest, directions: NamedDirections | Directions | null, opts: PathOptions = {}): Promise<PathPlan> {
  const mode: Mode = req.mode == null ? 'walk' : req.mode
  if (!Object.prototype.hasOwnProperty.call(MODES, mode)) throw new Error(`mode: '${mode}' is not walk, run, bike or transit`)
  const vias: ViaPoint[] = req.vias == null ? [] : viaPoints(req.vias)
  const when = req.when == null ? null : resolveWhen(req.when, req.minutes)
  const transitRouter = mode === 'transit' && opts && opts.transit ? opts.transit : null
  if (transitRouter && typeof transitRouter !== 'function') throw new Error('opts.transit: a TransitRouter function')

  // The street timing for the mode: walk and bike, the adapter as given (1.6.2's); run, the walk's
  // streets at the running pace; transit, the router, leg by leg
  let timer: ReturnType<typeof transitTimer> | null = null
  let base: NamedDirections | Directions | null = directions
  if (mode === 'run') base = directions ? runOnWalk(directions) : null
  if (mode === 'transit') {
    timer = transitRouter ? transitTimer(transitRouter, when, req.dwellMin, new Set(vias.map((v) => v.at))) : null
    base = timer ? timer.directions : null
  }

  let named = 'mapbox' as 'mapbox' | 'route' // set inside the wrapper
  let timingError: string | null = null
  const wrapped: Directions | null = base
    ? async (points, m) => {
      try {
        // plan.ts passes the request's mode: walk or bike is the street mode, and run and transit have their own adapters
        const walk = (await base!(points, m as StreetMode)) as NamedWalk
        if (walk && walk.timing === 'route') named = 'route'
        return walk
      } catch (error: any) {
        timingError = String(error?.message || error)
        throw error
      }
    }
    : null

  // a request that names nothing new goes to planItinerary as it came
  const asked: PlanRequest = when ? { ...req, mode, minutes: when.minutes } : mode === req.mode ? req : { ...req, mode }
  let record: ItineraryRecord
  let geometry: [number, number][]
  let passes: ViaPass[] | null = null
  let points: LatLon[]
  let inReachOf: (c: Candidate) => boolean
  if (vias.length) {
    const v = await planVias(asked, vias, wrapped)
    record = v.record
    geometry = v.geometry
    passes = v.passes
    points = v.points
    if (v.timingError && timingError === null) timingError = v.timingError
    const { anchors } = viaAnchors(asked, vias)
    inReachOf = (c) => viaInReach(c, anchors, asked.minutes, asked.mode, asked.dwellMin)
  } else {
    ({ record, geometry } = await planItinerary(asked, wrapped))
    points = [record.start, ...record.stops.map((s) => s.place), ...(record.end.kind !== 'open' && record.end.at ? [record.end.at] : [])]
    const endAt = record.end.at
    inReachOf = (c) => inReach(c, asked, endAt)
  }

  // transit: the rides of the line the record ended on (the last timing, when it timed that line);
  // a record on an earlier timing of the same line (plan.ts's timed stops) takes the chain's legs
  let rides: TransitChain | null = null
  if (timer && timer.state.last && record.totals.timing !== 'estimate' && samePoints(timer.state.last.points, points)) {
    rides = timer.state.last
    if (!vias.length && !sameLegs(record, rides.legs)) record = retime(record, rides.legs, asked.dwellMin)
  }

  const placed = new Set(record.stops.map((s) => s.card))
  const v2 = upgradeV1(record, { dwellMin: req.dwellMin, leftOver: leftOverOf(asked, placed, inReachOf) })
  if (v2.totals.timing === 'mapbox' && named === 'route') v2.totals.timing = 'route'
  if (when) {
    // the start: the first ride's (transit), else the rule's, or for an arrive by, its time less the
    // minutes to the line's end (the end's arrival; an open end's, its last stop's)
    const lastStop = v2.stops[v2.stops.length - 1]
    const endMin = v2.finish ? v2.finish.arriveMin : lastStop ? lastStop.arriveMin : 0
    const startMs = rides ? rides.startMs : when.kind === 'arriveBy' ? (when.deadlineMs as number) - Math.ceil(endMin) * 60000 : when.startMs
    v2.clock = clockAt(startMs, when.tz)
  }
  const out: PathPlan = { record: v2, geometry, timingError: v2.totals.timing === 'estimate' ? timingError : null }
  if (passes) out.vias = passes
  if (mode === 'transit') out.transit = rides ? rides.trips : null
  return out
}

// Run: the adapter's walking streets, each leg's meters at the running pace
function runOnWalk(directions: NamedDirections | Directions): NamedDirections {
  return async (points) => {
    const walk = (await directions(points, 'walk')) as NamedWalk
    return { ...walk, legs: walk.legs.map((l) => ({ m: l.m, min: l.m / MODES.run.mPerMin })) }
  }
}

const samePoints = (a: LatLon[], b: LatLon[]) => a.length === b.length && a.every((p, i) => p.lat === b[i].lat && p.lon === b[i].lon)

const round1 = (x: number) => Math.round(x * 10) / 10
const roundLeg = (l: Leg): Leg => ({ m: Math.round(l.m), min: round1(l.min) })

// A v1 record's legs, one a pair of points (the stops', then the finish's)
const legsOf = (r: ItineraryRecord): Leg[] => [...r.stops.map((s) => s.leg), ...(r.finish ? [r.finish.leg] : [])]
const sameLegs = (r: ItineraryRecord, legs: Leg[]) => {
  const have = legsOf(r)
  return have.length === legs.length && legs.every((l, i) => { const x = roundLeg(l); return x.m === have[i].m && x.min === have[i].min })
}

// A v1 record re-timed on these legs (one a pair of points), as plan.ts writes it
function retime(r: ItineraryRecord, legs: Leg[], dwell: number): ItineraryRecord {
  let arrive = 0
  const stops = r.stops.map((s, i) => {
    arrive += legs[i].min
    const out = { ...s, leg: roundLeg(legs[i]), arriveMin: round1(arrive) }
    arrive += dwell
    return out
  })
  const last = r.finish ? legs[r.stops.length] : null
  const walkMin = legs.reduce((a, l) => a + l.min, 0)
  return {
    ...r,
    stops,
    finish: last ? { leg: roundLeg(last), arriveMin: round1(arrive + last.min) } : null,
    totals: { ...r.totals, m: Math.round(legs.reduce((a, l) => a + l.m, 0)), walkMin: round1(walkMin), totalMin: round1(walkMin + dwell * stops.length) },
  }
}

/**
 * The cards a hand or a pile asks the path planner for: hand entries {key, kind}, cards {id}
 * or plain keys, to card keys in the order given, each once. Events and blanks are left out: a path
 * places cards. The app then hands in each key's places as candidates, with wanted: the list's length.
 */
export function planInput(list: ReadonlyArray<unknown> | null | undefined): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of list || []) {
    let key: unknown = x
    if (x && typeof x === 'object') {
      const o = x as { key?: unknown; id?: unknown; kind?: unknown }
      if (o.kind != null && o.kind !== 'card') continue
      key = o.key != null ? o.key : o.id
    }
    if (key == null || key === '') continue
    const k = String(key)
    if (!seen.has(k)) { seen.add(k); out.push(k) }
  }
  return out
}

// Each candidate card not on the route, in the order the candidates name them: 'out of reach'
// when the route was planned and timed and every one of its places fails the planner's reach
// (pickOne), else 'no time left'. Cards wanted but never handed in are only in totals.leftOver.
function leftOverOf(req: PlanRequest, placed: Set<string>, inReachOf: (c: Candidate) => boolean): LeftOver[] {
  const out: LeftOver[] = []
  const seen = new Set<string>()
  for (const c of req.candidates) {
    if (placed.has(c.card) || seen.has(c.card)) continue
    seen.add(c.card)
    const reach = req.order === 'planned' && req.minutes !== null
      && req.candidates.filter((x) => x.card === c.card).every((x) => !inReachOf(x))
    out.push({ key: c.card, kind: 'card', reason: reach ? 'out of reach' : 'no time left' })
  }
  return out
}

// plan.ts pickOne's test, as it is there
function inReach(c: Candidate, req: PlanRequest, b: LatLon | null): boolean {
  const T = req.minutes
  if (T === null) return true
  const toA = meters(req.start, c.place)
  if (b) return !(estMin(toA + meters(c.place, b), req.mode) + req.dwellMin > T)
  return !(toA > reachM(T, req.mode))
}
