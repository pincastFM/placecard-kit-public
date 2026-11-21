// Types for the kit's nav subpath (nav/navFollow.js). The map is any object with Mapbox GL's
// camera methods (GL 2 and 3 both work); the kit never imports mapbox-gl.

export type LngLatPair = [number, number]

/** One paint change on one of the map's own layers: [paint property, value] */
export type PaintChange = [string, unknown]

export interface NavDotLayer {
  id: string
  /** applied when following starts */
  hide: PaintChange[]
  /** applied on stop() */
  show: PaintChange[]
}

export interface NavTraceFrame {
  t: number
  want: number
  got: number
  x: number
  y: number
}

export interface NavFollowerOptions {
  /** the route being walked, as [lng, lat] pairs; null or fewer than two points means off route */
  getRoute?: () => LngLatPair[] | null | undefined
  /** the page's bottom sheets; the walker sits 62% down the map they leave visible */
  sheetSelector?: string | null
  /** false lets the person pan: the dot keeps moving, the camera stays put */
  isLocked?: () => boolean
  /** collects one entry per frame; default: window.__navTrace when ?navtrace=1 is on the URL */
  trace?: NavTraceFrame[] | null
  /** the HTML dot's inline CSS; default NYID's white dot in a #4287f5 ring */
  dotStyle?: string
  /** the map's own walker layers to hide while following; default user-location-dot and user-location-glow */
  dotLayers?: NavDotLayer[]
}

export interface NavFollower {
  /** call on every real GPS fix while navigating */
  update(fix: { lng: number; lat: number }): void
  /** hands the camera back; call before the page moves the camera itself, and on exit */
  stop(): void
  readonly active: boolean
  /** after the person panned: puts the camera back on the walker */
  recenter(): void
}

export function createNavFollower(map: any, opts?: NavFollowerOptions): NavFollower

export const CONTRACT_VERSION: string
