// The path solver: Treehopper's planItinerary (plan.ts, moved unchanged from treehopper-next),
// its record raised to v2. The v2 record adds what v1 counts but does not name: each
// candidate card left off the route, with why.
import { estMin, meters, reachM } from './geo'
import { planItinerary } from './plan'
import type { Candidate, Directions, LatLon, PlanRequest, TimedWalk } from './types'
import type { LeftOver, PlanRecord } from '../../contract/record'
import { upgradeV1 } from '../record'

export { planItinerary, PLAN_VERSION } from './plan'

export interface PathPlan {
  record: PlanRecord
  geometry: [number, number][] // [lon, lat], from the start through every stop to the end
  timingError: string | null   // why the street timing failed and the estimate stands; the caller logs it
}

// An adapter may name its timing: 'route' for the app's own router; 'mapbox' when left out
export interface NamedWalk extends TimedWalk {
  timing?: 'mapbox' | 'route'
}
export type NamedDirections = (points: LatLon[], mode: PlanRequest['mode']) => Promise<NamedWalk>

/**
 * A walk through places, as a v2 record. Throws as planItinerary does (a destination with no point).
 * plan.ts stays Treehopper's file byte for byte, so the two additions wrap the adapter here: the
 * record names the adapter's timing ('route' when it says so), and a failed timing comes back as
 * timingError for the caller to log (planItinerary still writes its own console line, as it did).
 */
export async function solvePath(req: PlanRequest, directions: NamedDirections | Directions | null): Promise<PathPlan> {
  let named = 'mapbox' as 'mapbox' | 'route' // set inside the wrapper
  let timingError: string | null = null
  const wrapped: Directions | null = directions
    ? async (points, mode) => {
      try {
        const walk = (await directions(points, mode)) as NamedWalk
        if (walk && walk.timing === 'route') named = 'route'
        return walk
      } catch (error: any) {
        timingError = String(error?.message || error)
        throw error
      }
    }
    : null
  const { record, geometry } = await planItinerary(req, wrapped)
  const placed = new Set(record.stops.map((s) => s.card))
  const v2 = upgradeV1(record, { dwellMin: req.dwellMin, leftOver: leftOverOf(req, record.end.at, placed) })
  if (v2.totals.timing === 'mapbox' && named === 'route') v2.totals.timing = 'route'
  return { record: v2, geometry, timingError: v2.totals.timing === 'estimate' ? timingError : null }
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
function leftOverOf(req: PlanRequest, endAt: LatLon | null, placed: Set<string>): LeftOver[] {
  const out: LeftOver[] = []
  const seen = new Set<string>()
  for (const c of req.candidates) {
    if (placed.has(c.card) || seen.has(c.card)) continue
    seen.add(c.card)
    const reach = req.order === 'planned' && req.minutes !== null
      && req.candidates.filter((x) => x.card === c.card).every((x) => !inReach(x, req, endAt))
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
