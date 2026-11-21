// Distances and the estimate the planner orders by. Walking: 80 m a minute along 1.3
// times the straight line (measured against Mapbox on 10-16, within 2 minutes).
import type { LatLon, Mode } from './types'

export const MODES: Record<Mode, { mPerMin: number; factor: number; profile: string }> = {
  walk: { mPerMin: 80, factor: 1.3, profile: 'mapbox/walking' },
  bike: { mPerMin: 250, factor: 1.3, profile: 'mapbox/cycling' },
}

// Straight-line meters; flat-earth at city scale, with the ellipsoid's two degree lengths
export function meters(a: LatLon, b: LatLon): number {
  const kx = 111320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  return Math.hypot((a.lon - b.lon) * kx, (a.lat - b.lat) * 110540)
}

// The estimated travel minutes over a straight-line distance
export const estMin = (m: number, mode: Mode) => (m * MODES[mode].factor) / MODES[mode].mPerMin

// The estimated street meters over a straight-line distance
export const estM = (m: number, mode: Mode) => m * MODES[mode].factor

// How far from the start a stop can be in this many minutes (spec: minutes times speed, over 1.3)
export const reachM = (minutes: number, mode: Mode) => (minutes * MODES[mode].mPerMin) / MODES[mode].factor
