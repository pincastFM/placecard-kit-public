// Types for core/mapMarks.js: where the zone map's walk discs and event squares sit.

export interface MarkPlace {
  /** the row's anchor: a disc's own place, or the row's middle */
  lat: number
  lng: number
  /** the item's offset from it, px */
  dx: number
  dy: number
  /** a stacked event behind the top one */
  under: boolean
}
/** items: events in time order, pin for a walk disc; mpp: metres per screen px (metresPerPx) */
export declare function markPlaces<K>(
  items: readonly { key: K; lat: number; lng: number; pin?: boolean }[] | null | undefined,
  mpp: number,
  o?: { disc?: number; square?: number; gap?: number; peek?: number },
): Map<K, MarkPlace>
