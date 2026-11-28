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
import { clockAt, resolveWhen, unmetError } from './when'
import type { PlanWhen, ResolvedWhen } from './when'
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
 * the via solver. Each throws an Error naming the field when it cannot be read. An arrive by the
 * plan cannot make (its start would come before now) throws a WhenError, code 'unmet', with the
 * earliest arrival leaving now when it was found (resolveWhen's 'passed' is the other code).
 * An open end (no vias) ends at its last stop, so an arrive by counts that stop's minutes too: the
 * walk is over by the time, and the earliest arrival is when it is over. Transit picks its cards at
 * the walk's pace, then, when the rides ran faster and time is left, picks again at their pace and
 * keeps that plan when the router's times fit (refill, at most REFILL_ROUNDS lines more).
 */
export async function solvePath(req: PathRequest, directions: NamedDirections | Directions | null, opts: PathOptions = {}): Promise<PathPlan> {
  const mode: Mode = req.mode == null ? 'walk' : req.mode
  if (!Object.prototype.hasOwnProperty.call(MODES, mode)) throw new Error(`mode: '${mode}' is not walk, run, bike or transit`)
  const vias: ViaPoint[] = req.vias == null ? [] : viaPoints(req.vias)
  const when = req.when == null ? null : resolveWhen(req.when, req.minutes)
  const transitRouter = mode === 'transit' && opts && opts.transit ? opts.transit : null
  if (transitRouter && typeof transitRouter !== 'function') throw new Error('opts.transit: a TransitRouter function')
  // an open end with no vias ends at its last stop, whose minutes count: an arrive by is over by then
  const openEnd = !!req.end && req.end.kind === 'open' && !vias.length
  const noDwell = new Set(vias.map((v) => v.at))

  // The street timing for the mode: walk and bike, the adapter as given (1.6.2's); run, the walk's
  // streets at the running pace; transit, the router, leg by leg
  const newTimer = () => transitTimer(transitRouter as TransitRouter, when, req.dwellMin, noDwell, openEnd)
  let timer: Timer | null = null
  let base: NamedDirections | Directions | null = directions
  if (mode === 'run') base = directions ? runOnWalk(directions) : null
  if (mode === 'transit') {
    timer = transitRouter ? newTimer() : null
    base = timer ? timer.directions : null
  }

  // a request that names nothing new goes to planItinerary as it came
  const asked: PlanRequest = when ? { ...req, mode, minutes: when.minutes } : mode === req.mode ? req : { ...req, mode }
  let line = await planLine(asked, vias, base, timer)
  // transit: the cards were picked at the walk's pace; when the rides ran faster and left time, the
  // plan is picked again at their pace (refill)
  if (timer && asked.minutes !== null && line.rides && asked.minutes - line.record.totals.totalMin >= asked.dwellMin) {
    line = await refill(line, asked, vias, when, newTimer)
  }
  const { record, geometry, passes, rides, named, timingError } = line

  const placed = new Set(record.stops.map((s) => s.card))
  const v2 = upgradeV1(record, { dwellMin: req.dwellMin, leftOver: leftOverOf(asked, placed, reachOf(line, vias)) })
  if (v2.totals.timing === 'mapbox' && named === 'route') v2.totals.timing = 'route'
  if (when) {
    // the start: the first ride's (transit), else the rule's, or for an arrive by, its time less the
    // minutes to the line's end (the end's arrival; an open end's, its last stop's arrival and minutes)
    const lastStop = v2.stops[v2.stops.length - 1]
    const endMin = v2.finish ? v2.finish.arriveMin : lastStop ? lastStop.arriveMin + lastStop.dwellMin : 0
    const startMs = rides ? rides.startMs : when.kind === 'arriveBy' ? (when.deadlineMs as number) - Math.ceil(endMin) * 60000 : when.startMs
    // an arrive by whose start comes before now (on the clock's whole minutes) cannot be made
    if (when.kind === 'arriveBy' && Math.floor(startMs / 60000) < Math.floor(when.nowMs / 60000)) {
      const earliest = rides && transitRouter
        ? await leaveNowEnd(transitRouter, when, req.dwellMin, noDwell, rides.points, openEnd)
        : when.nowMs + endMin * 60000
      throw unmetError(when, earliest)
    }
    v2.clock = clockAt(startMs, when.tz)
  }
  const out: PathPlan = { record: v2, geometry, timingError: v2.totals.timing === 'estimate' ? timingError : null }
  if (passes) out.vias = passes
  if (mode === 'transit') out.transit = rides ? rides.trips : null
  return out
}

type Timer = ReturnType<typeof transitTimer>

// One line planned and timed: the record (v1), its line and points, and in transit mode the rides
// it was timed on
interface Line {
  record: ItineraryRecord
  geometry: [number, number][]
  passes: ViaPass[] | null
  points: LatLon[]
  rides: TransitChain | null
  reach: PlanRequest            // whose reach sorts the cards left over: the request, or a refill's at the rides' pace
  named: 'mapbox' | 'route'
  timingError: string | null
}

// plan.ts (or the via solver) on this request, with the adapter wrapped: the record names the
// adapter's timing ('route' when it says so), and a failed timing comes back as timingError
async function planLine(asked: PlanRequest, vias: ViaPoint[], base: NamedDirections | Directions | null, timer: Timer | null): Promise<Line> {
  const seen = { named: 'mapbox' as 'mapbox' | 'route', timingError: null as string | null } // set inside the wrapper
  const wrapped: Directions | null = base
    ? async (points, m) => {
      try {
        // plan.ts passes the request's mode: walk or bike is the street mode, and run and transit have their own adapters
        const walk = (await base(points, m as StreetMode)) as NamedWalk
        if (walk && walk.timing === 'route') seen.named = 'route'
        return walk
      } catch (error: any) {
        seen.timingError = String(error?.message || error)
        throw error
      }
    }
    : null

  let record: ItineraryRecord
  let geometry: [number, number][]
  let passes: ViaPass[] | null = null
  let points: LatLon[]
  if (vias.length) {
    const v = await planVias(asked, vias, wrapped)
    record = v.record
    geometry = v.geometry
    passes = v.passes
    points = v.points
    if (v.timingError && seen.timingError === null) seen.timingError = v.timingError
  } else {
    ({ record, geometry } = await planItinerary(asked, wrapped))
    points = [record.start, ...record.stops.map((s) => s.place), ...(record.end.kind !== 'open' && record.end.at ? [record.end.at] : [])]
  }

  // transit: the rides of the line the record ended on (the last timing, when it timed that line).
  // plan.ts may keep an earlier timing's first stops and ask again for their line (an open end over
  // the time): the new rides re-time the record when that still fits the time; when it runs over, or
  // the asking again failed, the earlier timing stands, with its first rides and its start
  let rides: TransitChain | null = null
  if (timer && record.totals.timing !== 'estimate') {
    const last = timer.state.last
    if (last && samePoints(last.points, points)) {
      if (vias.length || sameLegs(record, last.legs)) rides = last
      else {
        const re = retime(record, last.legs, asked.dwellMin)
        if (asked.minutes === null || re.totals.totalMin <= asked.minutes) { record = re; rides = last }
      }
    }
    if (!rides && !vias.length) {
      const earlier = earlierChain(timer.state.chains, points, record, asked.dwellMin)
      if (earlier) { rides = earlier; record = retime(record, earlier.legs, asked.dwellMin) }
    }
  }
  return { record, geometry, passes, points, rides, reach: asked, named: seen.named, timingError: seen.timingError }
}

// Transit refills at most this many times a plan; each round times one line
const REFILL_ROUNDS = 3
// A line whose rides take this share of the walk's estimate or more is not picked again
const REFILL_RATIO = 0.9

// Transit picks its cards at the walk's pace (MODES.transit), so rides faster than walking leave
// time unused: a far destination fits no card at all. Each round reads how the rides ran against the
// walk's estimate on the line timed last (r, their minutes over the estimate's), picks again on the
// estimate with the time and each stop's minutes over r (the cards that fit at the rides' pace),
// and times those cards once, uncut, in the order the pick put them in (the same greedy order: the
// pick's cards are a subset of its pool). It keeps a line only when the router timed it, it fits
// the time, every card picked is on it, an arrive by still leaves after now, and it has more stops.
async function refill(first: Line, asked: PlanRequest, vias: ViaPoint[], when: ResolvedWhen | null, newTimer: () => Timer): Promise<Line> {
  const T = asked.minutes as number
  const wanted = asked.wanted ?? new Set(asked.candidates.map((c) => c.card)).size
  let best = first
  let chain: TransitChain | null = first.rides
  for (let round = 1; round <= REFILL_ROUNDS && chain; round++) {
    if (T - best.record.totals.totalMin < asked.dwellMin) break
    const pts: LatLon[] = chain.points
    const est = sumOf(pts.slice(1).map((p, i) => estMin(meters(pts[i], p), 'transit')))
    const rode = sumOf(chain.legs.map((l) => l.min))
    if (!(est > 0) || !(rode / est < REFILL_RATIO)) break
    const r = Math.max(rode / est, 0.01)
    const scaled: PlanRequest = { ...asked, minutes: T / r, dwellMin: asked.dwellMin / r }
    const pick = vias.length ? (await planVias(scaled, vias, null)).record : (await planItinerary(scaled, null)).record
    if (pick.stops.length <= best.record.stops.length) break
    const cards = new Set<string>()
    const picked = asked.candidates.filter((c) => pick.stops.some((s) => s.card === c.card && s.place === c.place) && !cards.has(c.card) && !!cards.add(c.card))
    const timer = newTimer()
    const line = await planLine({ ...asked, candidates: picked, minutes: null, wanted }, vias, timer.directions, timer)
    chain = line.rides
    if (!line.rides || line.record.totals.timing === 'estimate') break
    const late = !!when && when.kind === 'arriveBy' && Math.floor(line.rides.startMs / 60000) < Math.floor(when.nowMs / 60000)
    if (line.record.totals.totalMin <= T && line.record.stops.length === picked.length && !late && line.record.stops.length > best.record.stops.length) {
      best = { ...line, record: { ...line.record, minutes: T }, reach: scaled }
    }
  }
  return best
}

// The reach that sorts a line's left-over cards (out of reach, or no time left)
function reachOf(line: Line, vias: ViaPoint[]): (c: Candidate) => boolean {
  const q = line.reach
  if (vias.length) {
    const { anchors } = viaAnchors(q, vias)
    return (c) => viaInReach(c, anchors, q.minutes, q.mode, q.dwellMin)
  }
  const endAt = line.record.end.at
  return (c) => inReach(c, q, endAt)
}

const sumOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

// Run: the adapter's walking streets, each leg's meters at the running pace
function runOnWalk(directions: NamedDirections | Directions): NamedDirections {
  return async (points) => {
    const walk = (await directions(points, 'walk')) as NamedWalk
    return { ...walk, legs: walk.legs.map((l) => ({ m: l.m, min: l.m / MODES.run.mPerMin })) }
  }
}

const samePoints = (a: LatLon[], b: LatLon[]) => a.length === b.length && a.every((p, i) => p.lat === b[i].lat && p.lon === b[i].lon)

// The newest timed line whose first points and legs are the record's (plan.ts's timed stops), cut to
// them: its first rides and its start. Its last leg there ran on to the next ride the longer line
// took; the record's ends where its own ride arrives. No vias (each leg one pair of points).
function earlierChain(chains: TransitChain[], points: LatLon[], r: ItineraryRecord, dwell: number): TransitChain | null {
  const n = points.length - 1
  for (let k = chains.length - 1; k >= 0; k--) {
    const c = chains[k]
    if (c.points.length < points.length || !samePoints(c.points.slice(0, points.length), points)) continue
    const legs = c.legs.slice(0, n).map((l) => ({ ...l }))
    if (!sameLegs(r, legs)) continue
    const trips = c.trips.slice(0, n)
    const ends = c.startMs + (legs.reduce((a, l) => a + l.min, 0) + dwell * Math.max(0, n - 1)) * 60000
    const ride = n ? trips[n - 1] : null
    let endMs = ends
    if (ride && ends > ride.endTime) {
      legs[n - 1] = { ...legs[n - 1], min: Math.max(0, legs[n - 1].min - (ends - ride.endTime) / 60000) }
      endMs = ride.endTime
    }
    return { points: c.points.slice(0, points.length), trips, legs, startMs: c.startMs, endMs }
  }
  return null
}

// Leaving now, when the line through these points reaches its end by transit (an open end's: its
// last stop's minutes up, so the walk is over); null when the router finds no way (for an arrive by
// that cannot be made: what a host can offer instead)
async function leaveNowEnd(router: TransitRouter, when: ResolvedWhen, dwellMin: number, noDwell: Set<LatLon>, points: LatLon[], openEnd: boolean): Promise<number | null> {
  const now: ResolvedWhen = { kind: 'now', tz: when.tz, nowMs: when.nowMs, startMs: when.nowMs, deadlineMs: null, minutes: null }
  const timer = transitTimer(router, now, dwellMin, noDwell, openEnd)
  try {
    await timer.directions(points)
  } catch {
    return null
  }
  const n = points.length - 1
  const lastDwell = openEnd && n > 0 && !noDwell.has(points[n]) ? dwellMin * 60000 : 0
  return timer.state.last ? timer.state.last.endMs + lastDwell : null
}

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
