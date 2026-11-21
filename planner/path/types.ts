// Placecard's itinerary builder: the shapes going in and the record coming out.
// Plain types, nothing of any one app. Spec: Itinerary Builder section 3 (H130).

export interface LatLon {
  lat: number
  lon: number
}

// open: ends at the last stop; start: back where it began; destination: a point the player picks
export type EndKind = 'open' | 'start' | 'destination'

export type Mode = 'walk' | 'bike'

// planned: the builder orders (collections); fixed: as given (linear treks); placed: by hand (DMO grid)
export type OrderRule = 'planned' | 'fixed' | 'placed'

export interface Place extends LatLon {
  id: string
}

// One card at one place; a card with many places (a species) comes in once per place
export interface Candidate {
  card: string
  place: Place
}

export interface PlanEnd {
  kind: EndKind
  at?: LatLon | null   // destination only
  name?: string | null // destination only
}

export interface PlanRequest {
  app: string
  set: string
  madeBy: string | null
  start: LatLon
  end: PlanEnd
  mode: Mode
  minutes: number | null // null: untimed, nothing is cut (a route timed again as walked)
  dwellMin: number       // minutes at each stop, set per set
  order: OrderRule
  candidates: Candidate[]
  wanted?: number        // cards wanted, for leftOver; the distinct cards in candidates if left out
}

export interface Leg {
  m: number
  min: number
}

export type StopStatus = 'planned' | 'skipped' | 'collected'

export interface ItineraryStop {
  n: number
  card: string
  place: Place
  leg: Leg            // the walk to this stop from the one before (or the start)
  arriveMin: number   // minutes from the start
  status: StopStatus
}

export type Timing = 'mapbox' | 'estimate'

export interface ItineraryRecord {
  id: string
  app: string
  set: string
  madeBy: string | null
  madeAt: string
  planVersion: number
  start: LatLon
  end: { kind: EndKind; at: LatLon | null; name: string | null }
  mode: Mode
  minutes: number | null
  order: OrderRule
  stops: ItineraryStop[]
  finish: { leg: Leg; arriveMin: number } | null // the walk on to the end, when there is one
  totals: { stops: number; m: number; walkMin: number; totalMin: number; timing: Timing }
  leftOver: number
}

// A walk timed on real streets: one leg per pair of points, and the line to draw
export interface TimedWalk {
  legs: Leg[]
  geometry: [number, number][] // [lon, lat]
}

export type Directions = (points: LatLon[], mode: Mode) => Promise<TimedWalk>
