// The plan record, v2: what every solver returns and Placecard stores (kit CONTRACT.md).
// Built on Treehopper's ItineraryRecord (planVersion 1, planner/path/types.ts), which stays as
// it is for the records already written. Plain types and two constants; no logic.

export const CONTRACT_VERSION = '1.6.2'
export const PLAN_VERSION_2 = 2

export interface LatLon {
  lat: number
  lon: number // the record's; a solver on {lat, lng} converts at its boundary
}

export type EndKind = 'open' | 'start' | 'destination'
export type Mode = 'walk' | 'bike'
export type OrderRule = 'planned' | 'fixed' | 'placed'
// mapbox: Mapbox's streets; route: the app's own router; estimate: straight lines, the planner's walking pace
export type Timing = 'mapbox' | 'route' | 'estimate'
export type StopStatus = 'planned' | 'skipped' | 'collected'

// path: Treehopper's walk through places; day: a timed day from a hand (NYID's handToDay)
export type SolverId = 'path' | 'day'

export type StopKind = 'see' | 'eat' | 'event'

export interface Place extends LatLon {
  id: string
}

export interface Leg {
  m: number   // path: street meters (timed or estimated); day: straight-line meters
  min: number
}

// The wall clock a timed day runs on; every minute in the record counts from startAt
export interface PlanClock {
  tz: string        // IANA, e.g. America/Denver
  date: string      // YYYY-MM-DD on that clock
  startAt: number   // minutes past midnight on that clock
}

export interface Stop {
  n: number
  kind: StopKind
  card: string             // the card's key (an event's key for kind 'event')
  place: Place | null      // null when the card has no point
  leg: Leg                 // the way here from the stop before (or the start)
  arriveMin: number        // minutes from the start
  dwellMin: number         // minutes at the stop
  status: StopStatus
  label: string | null     // what the app shows for the slot (Lunch, See, Event); path: null
  meal: string | null      // the meal's id when the stop is one; path: null
  fromHand: boolean        // the player chose it; false when the solver suggested it
  alts: string[]           // keys the slot could swap to, the stop's own first; path: []
}

export interface LeftOver {
  key: string
  kind: 'card' | 'event'
  reason: string
}

export interface Totals {
  stops: number
  m: number
  walkMin: number
  totalMin: number   // path: walk plus dwell; day: the last stop's end, from the start
  timing: Timing
  leftOver: number   // cards wanted and not placed, including ones the solver never saw
}

export interface PlanRecord {
  id: string
  app: string
  set: string
  madeBy: string | null
  madeAt: string
  planVersion: 2
  solver: { id: SolverId }
  clock: PlanClock | null  // null: a walk with no wall clock (path)
  start: LatLon | null     // null: a day with no center
  end: { kind: EndKind; at: LatLon | null; name: string | null }
  mode: Mode
  minutes: number | null   // the time allowed; null: untimed
  order: OrderRule
  stops: Stop[]
  finish: { leg: Leg; arriveMin: number } | null
  totals: Totals
  leftOver: LeftOver[]     // the placed-not cards the solver saw, each with why
  ext: Record<string, unknown> // app-only fields; the kit never reads them
}
