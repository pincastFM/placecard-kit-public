// Types for core/dayMap.js: the day on the map, its query and its labels.

export type DistUnit = 'mi' | 'km'
export declare const M_PER_MI: number
export interface DistParts { n: string; u: 'mi' | 'ft' | 'km' | 'm' }
export declare function distParts(m: number, unit?: DistUnit): DistParts
/** '0.6 mi', '450 ft', '0.9 km', '350 m' */
export declare function fmtDist(m: number, unit?: DistUnit): string
/** '45 min', '4 h', '4 h 15 min' */
export declare function durLabel(min: number): string
/** '7:00 to 11:15 AM' */
export declare function spanLabel(from: number, to: number): string

export interface DaySpan { from: number; to: number }
export interface DayQuery { keys: string[]; span: DaySpan | null; walkMin: number | null; m: number | null }
/** The map's query: ?day=k1,k2&span=420-675&walk=14&m=1030 */
export declare function dayQuery(q?: { day?: unknown; span?: unknown; walk?: unknown; m?: unknown }): DayQuery

export interface LatLng { lat: number; lng: number }
export interface DayStop { n: number; key: string; kind: string; title: string; lat: number; lng: number }
/** A key the map does not know, or with no place, is skipped; line is [lng, lat] from the center through every stop */
export declare function dayStops(
  keys: Iterable<string | number> | null | undefined,
  byKey: { get(key: string): { lat?: number | null; lng?: number | null; kind?: string | null; title?: string | null } | null | undefined } | null | undefined,
  center?: LatLng | null,
): { stops: DayStop[]; line: [number, number][] }
export declare function metresPerPx(zoom: number, lat: number): number
export declare function metresApart(a: LatLng, b: LatLng): number
export declare function dayGroups<K>(stops: readonly ({ key: K } & LatLng)[] | null | undefined, m: number): { keys: K[]; lat: number; lng: number }[]
export declare function dayPlaces<K>(stops: readonly ({ key: K } & LatLng)[] | null | undefined, m: number, gap?: number): Map<K, { lat: number; lng: number; dx: number }>
/** '3 stops', '4 h 15 min', '7:00 to 11:15 AM', '14 min walk' */
export declare function dayTotals(n: number, q?: { span?: DaySpan | null; walkMin?: number | null } | null): string[]
