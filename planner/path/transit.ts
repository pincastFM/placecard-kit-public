// Transit (1.7.0): the router the host injects, as it injects Directions, and two pure helpers for
// an OpenTripPlanner 2.x server: buildOtpPlanQuery (the GraphQL plan query for one leg) and
// otpPlanToLegs (its answer as the kit's legs, with each ride's route, color, headsign and stops).
// The kit holds no key and fetches nothing (CONTRACT.md section 9): the host's router sends the
// query from its own server, with its own base URL and secret, and hands back the mapped answer:
//
//   const transit: TransitRouter = async (req) => otpPlanToLegs(await signedPost(OTP_URL, buildOtpPlanQuery(req)))
//
// solvePath times a transit path with it, one leg at a time (each leg leaves when the one before
// it arrives and the stop's minutes are up; an arrive by is solved back from its time), and its
// times are the record's: totals.timing 'route'. The rides themselves go beside the record (PathPlan
// transit), never into its stops.
import { meters } from './geo'
import type { LatLon, Leg, TimedWalk } from './types'
import type { ResolvedWhen } from './when'
import { wallOf } from './when'

/** One leg the planner asks the router for, on the place's clock */
export interface TransitRequest {
  from: LatLon
  to: LatLon
  date: string      // YYYY-MM-DD on tz's clock
  time: string      // HH:MM:SS on tz's clock
  arriveBy: boolean // true: arrive at `to` by date and time; false: leave `from` then
  tz: string        // the clock date and time are read on (OTP reads them on its own feed's)
  numItineraries?: number // how many to ask for; 3 when left out
}

export interface TransitPlace {
  name: string | null
  lat: number
  lon: number
  stop: string | null     // the stop's name, on a ride's ends
  stopId: string | null   // its GTFS id
  platform: string | null
}

export interface TransitRoute {
  shortName: string | null
  longName: string | null
  color: string | null     // a CSS color, '#RRGGBB'
  textColor: string | null
  agency: string | null
}

export interface TransitStep {
  m: number
  relativeDirection: string | null
  absoluteDirection: string | null
  streetName: string | null
  lat: number
  lon: number
}

/** One leg of a trip: the kit's { m, min }, and what the rider needs to follow it */
export interface TransitLeg extends Leg {
  mode: string            // OTP's: WALK, BUS, SUBWAY, RAIL, TRAM, FERRY and so on
  ride: boolean           // a vehicle, not WALK or BICYCLE
  route: TransitRoute | null
  headsign: string | null
  from: TransitPlace
  to: TransitPlace
  startTime: number       // ms since 1970
  endTime: number
  stops: number           // stops ridden past, between from and to
  geometry: [number, number][] // [lon, lat], decoded from OTP's polyline
  steps: TransitStep[]
}

/** One way from a leg's start to its end: its legs, and its own { m, min } */
export interface TransitItinerary extends Leg {
  startTime: number
  endTime: number
  walkM: number
  waitMin: number
  transfers: number
  legs: TransitLeg[]
  geometry: [number, number][]
}

/** The host's transit router: one leg asked, the ways found (otpPlanToLegs' answer), best first or not */
export type TransitRouter = (req: TransitRequest) => Promise<TransitItinerary[]>

// ── OpenTripPlanner 2.x ─────────────────────────────────────────────────────────

// The GTFS GraphQL API's plan query (OTP 2.x), walking and transit only: never a car
export const OTP_PLAN_QUERY = `query PlacecardPlan($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!, $date: String!, $time: String!, $arriveBy: Boolean!, $numItineraries: Int!) {
  plan(
    from: { lat: $fromLat, lon: $fromLon }
    to: { lat: $toLat, lon: $toLon }
    date: $date
    time: $time
    arriveBy: $arriveBy
    numItineraries: $numItineraries
    transportModes: [{ mode: WALK }, { mode: TRANSIT }]
  ) {
    itineraries {
      startTime
      endTime
      duration
      walkDistance
      waitingTime
      legs {
        mode
        startTime
        endTime
        duration
        distance
        headsign
        from { name lat lon stop { gtfsId name platformCode } }
        to { name lat lon stop { gtfsId name platformCode } }
        legGeometry { points }
        route { shortName longName color textColor agency { name } }
        intermediateStops { name }
        steps { distance relativeDirection absoluteDirection streetName lat lon }
      }
    }
  }
}`

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/
const isLatLon = (p: any) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180

/** The OTP 2.x GraphQL plan query for one leg: POST it as JSON. Throws one TypeError listing what is wrong. */
export function buildOtpPlanQuery(input: TransitRequest): { query: string; variables: Record<string, unknown> } {
  const errs: string[] = []
  const i = (input || {}) as any
  if (!isLatLon(i.from)) errs.push('from: not { lat, lon }')
  if (!isLatLon(i.to)) errs.push('to: not { lat, lon }')
  if (typeof i.date !== 'string' || !DATE_RE.test(i.date)) errs.push('date: not YYYY-MM-DD')
  if (typeof i.time !== 'string' || !TIME_RE.test(i.time)) errs.push('time: not HH:MM:SS')
  if (typeof i.arriveBy !== 'boolean') errs.push('arriveBy: not true or false')
  const n = i.numItineraries === undefined ? 3 : i.numItineraries
  if (!Number.isInteger(n) || n < 1) errs.push('numItineraries: a whole number, 1 or more')
  if (errs.length) throw new TypeError(`buildOtpPlanQuery: ${errs.join('; ')}`)
  return {
    query: OTP_PLAN_QUERY,
    variables: {
      fromLat: i.from.lat, fromLon: i.from.lon, toLat: i.to.lat, toLon: i.to.lon,
      date: i.date, time: i.time.length === 5 ? `${i.time}:00` : i.time, arriveBy: i.arriveBy, numItineraries: n,
    },
  }
}

const num = (x: unknown, or = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : or)
const str = (x: unknown) => (typeof x === 'string' && x !== '' ? x : null)
const css = (x: unknown) => {
  const s = typeof x === 'string' ? x.trim() : ''
  if (/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s.startsWith('#') ? s : `#${s}`
  return null
}
const NOT_RIDES = ['WALK', 'BICYCLE', 'CAR', 'SCOOTER']

function place(p: any): TransitPlace {
  const s = p && p.stop
  return {
    name: str(p && p.name), lat: num(p && p.lat), lon: num(p && p.lon),
    stop: str(s && s.name), stopId: str(s && s.gtfsId), platform: str(s && s.platformCode),
  }
}

function joinLines(lines: [number, number][][]): [number, number][] {
  const out: [number, number][] = []
  for (const line of lines) {
    for (const [i, p] of line.entries()) {
      const prev = out[out.length - 1]
      if (i === 0 && prev && prev[0] === p[0] && prev[1] === p[1]) continue
      out.push(p)
    }
  }
  return out
}

/**
 * An OTP 2.x plan answer (the GraphQL body { data, errors }, or its data) as the kit's legs: each
 * itinerary's { m, min } and its legs, each with its own { m, min }, mode, route (short and long
 * name, '#RRGGBB' colors, agency), headsign, from and to (stop names, ids, platforms), start and
 * end times (ms), stops ridden past, the line decoded to [lon, lat], and the turn-by-turn steps.
 * An itinerary without both times is left out. Throws on a GraphQL error with no plan.
 */
export function otpPlanToLegs(response: unknown): TransitItinerary[] {
  const body = (response || {}) as any
  const data = body.data !== undefined ? body.data : body
  const plan = data && data.plan
  if (!plan) {
    const why = Array.isArray(body.errors) && body.errors.length ? String(body.errors[0]?.message || 'an error') : 'no plan in the answer'
    throw new Error(`OTP: ${why}`)
  }
  const out: TransitItinerary[] = []
  for (const it of Array.isArray(plan.itineraries) ? plan.itineraries : []) {
    if (!it || !Number.isFinite(it.startTime) || !Number.isFinite(it.endTime)) continue
    const legs: TransitLeg[] = (Array.isArray(it.legs) ? it.legs : []).map((l: any) => {
      const mode = str(l && l.mode) || 'WALK'
      const start = num(l && l.startTime)
      const end = num(l && l.endTime)
      const r = l && l.route
      return {
        m: num(l && l.distance),
        min: end > start ? (end - start) / 60000 : num(l && l.duration) / 60,
        mode,
        ride: !NOT_RIDES.includes(mode),
        route: r ? { shortName: str(r.shortName), longName: str(r.longName), color: css(r.color), textColor: css(r.textColor), agency: str(r.agency && r.agency.name) } : null,
        headsign: str(l && l.headsign),
        from: place(l && l.from),
        to: place(l && l.to),
        startTime: start,
        endTime: end,
        stops: Array.isArray(l && l.intermediateStops) ? l.intermediateStops.length : 0,
        geometry: decodePolyline(l && l.legGeometry && l.legGeometry.points),
        steps: (Array.isArray(l && l.steps) ? l.steps : []).map((s: any) => ({
          m: num(s && s.distance), relativeDirection: str(s && s.relativeDirection), absoluteDirection: str(s && s.absoluteDirection),
          streetName: str(s && s.streetName), lat: num(s && s.lat), lon: num(s && s.lon),
        })),
      }
    })
    const rides = legs.filter((l) => l.ride).length
    out.push({
      m: legs.reduce((a, l) => a + l.m, 0),
      min: (it.endTime - it.startTime) / 60000,
      startTime: it.startTime,
      endTime: it.endTime,
      walkM: num(it.walkDistance),
      waitMin: num(it.waitingTime) / 60,
      transfers: Math.max(0, rides - 1),
      legs,
      geometry: joinLines(legs.map((l) => l.geometry)),
    })
  }
  return out
}

/** A Google encoded polyline (OTP's legGeometry.points) as [lon, lat] points; precision 5 unless given */
export function decodePolyline(encoded: unknown, precision = 5): [number, number][] {
  if (typeof encoded !== 'string' || !encoded) return []
  const factor = Math.pow(10, precision)
  const out: [number, number][] = []
  let index = 0
  let lat = 0
  let lon = 0
  const next = () => {
    let shift = 0
    let result = 0
    let byte: number
    do {
      if (index >= encoded.length) return null
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }
  while (index < encoded.length) {
    const dLat = next()
    const dLon = next()
    if (dLat === null || dLon === null) break // a cut-off string: the points decoded so far
    lat += dLat
    lon += dLon
    out.push([lon / factor, lat / factor])
  }
  return out
}

// ── Timing a line by transit (solvePath's) ──────────────────────────────────────

export interface TransitChain {
  points: LatLon[]
  trips: (TransitItinerary | null)[] // one a leg; null where two points are the same place
  legs: Leg[]
  startMs: number                    // when the line leaves its start
}

const hms = (ms: number, tz: string) => {
  const w = wallOf(ms, tz)
  return { date: w.date, time: `${String(Math.floor(w.min / 60)).padStart(2, '0')}:${String(w.min % 60).padStart(2, '0')}:${String(w.sec).padStart(2, '0')}` }
}

/**
 * The street timing solvePath hands its solver in transit mode: each leg asked of the router in
 * turn. Leave now or at a time: each leg leaves when the one before arrives and the stop's minutes
 * are up, and the first ride's own start is the line's. Arrive by: the last leg arrives by the time,
 * and each one before it by the time the next one leaves, less the stop's minutes. A leg's minutes
 * include the wait for its ride. noDwell: the points that take no minutes (the player's vias).
 * Throws when it has no time rule or a leg has no way, and the estimate stands.
 */
export function transitTimer(router: TransitRouter, when: ResolvedWhen | null, dwellMin: number, noDwell: Set<LatLon>) {
  const state: { last: TransitChain | null } = { last: null }
  const directions = async (points: LatLon[]): Promise<TimedWalk & { timing: 'route' }> => {
    if (!when) throw new Error('transit: the router needs a time rule (when: now, leaveAt or arriveBy, with its tz)')
    const n = points.length - 1
    const dwell = (i: number) => (i > 0 && i < n && !noDwell.has(points[i]) ? dwellMin * 60000 : 0)
    const trips: (TransitItinerary | null)[] = new Array(Math.max(0, n)).fill(null)
    const legs: Leg[] = new Array(Math.max(0, n)).fill(null).map(() => ({ m: 0, min: 0 }))
    const ask = async (i: number, ms: number, arriveBy: boolean) => {
      const at = hms(ms, when.tz)
      const req: TransitRequest = { from: { lat: points[i].lat, lon: points[i].lon }, to: { lat: points[i + 1].lat, lon: points[i + 1].lon }, ...at, arriveBy, tz: when.tz }
      const found = (await router(req)) || []
      const ok = found.filter((x) => x && Number.isFinite(x.startTime) && Number.isFinite(x.endTime) && x.endTime >= x.startTime)
      // leaving: the one that arrives first; arriving by: the one that leaves last and still arrives in time
      const pick = arriveBy
        ? ok.filter((x) => x.endTime <= ms + 60000).reduce<TransitItinerary | null>((b, x) => (!b || x.startTime > b.startTime ? x : b), null)
        : ok.reduce<TransitItinerary | null>((b, x) => (!b || x.endTime < b.endTime ? x : b), null)
      if (!pick) throw new Error(`transit: no way for leg ${i + 1} of ${n}`)
      return pick
    }
    const near = (i: number) => meters(points[i], points[i + 1]) < 1
    let startMs: number
    if (when.kind !== 'arriveBy') {
      const leave = when.startMs
      let ready = leave
      let first = true
      startMs = leave
      for (let i = 0; i < n; i++) {
        ready += dwell(i)
        if (near(i)) continue
        const trip = await ask(i, ready, false)
        trips[i] = trip
        if (first) {
          startMs = trip.startTime - (ready - leave) // no wait at the start: the line leaves when its first ride says to
          legs[i] = { m: trip.m, min: (trip.endTime - trip.startTime) / 60000 }
          first = false
        } else {
          legs[i] = { m: trip.m, min: Math.max(0, trip.endTime - ready) / 60000 }
        }
        ready = Math.max(ready, trip.endTime)
      }
    } else {
      let by = when.deadlineMs as number
      let last = true
      for (let i = n - 1; i >= 0; i--) {
        if (!near(i)) {
          const trip = await ask(i, by, true)
          trips[i] = trip
          legs[i] = { m: trip.m, min: (last ? trip.endTime - trip.startTime : Math.max(0, by - trip.startTime)) / 60000 }
          last = false
          by = trip.startTime
        }
        by -= dwell(i)
      }
      startMs = by
    }
    // the record's clock counts whole minutes: the line leaves on the minute, and its first ride's
    // leg takes the seconds before that ride
    const onMinute = Math.floor(startMs / 60000) * 60000
    const firstRide = trips.findIndex((t) => t)
    if (firstRide >= 0 && onMinute < startMs) legs[firstRide] = { ...legs[firstRide], min: legs[firstRide].min + (startMs - onMinute) / 60000 }
    startMs = onMinute
    const geometry = joinLines(points.slice(1).map((p, i) => trips[i]?.geometry.length ? trips[i]!.geometry : [[points[i].lon, points[i].lat], [p.lon, p.lat]] as [number, number][]))
    state.last = { points: points.slice(), trips, legs, startMs }
    return { legs, geometry, timing: 'route' }
  }
  return { directions, state }
}
