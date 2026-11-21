// The street-timing adapter an app hands the path solver: points in, one leg per pair and the
// line to draw out. The kit imports no map service; Treehopper's Mapbox adapter (its own
// lib/placecard/itinerary/mapbox.ts) stays in Treehopper. With none, or when it throws, the
// solver's estimate stands. The shapes are Treehopper's, unchanged (path/types.ts).
export type { Directions, TimedWalk, Leg, LatLon, Mode } from './path/types'
