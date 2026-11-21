/**
 * The day on the map (2026-10-27): what the Selection hands the zone map and how the
 * map labels it. Pure JS: no Vue, no fetch, no storage.
 *
 * The Selection's Map button (useTtSelection.mapTo) sends the day's keys in time order and its totals:
 *   ?view=map&day=k1,k2,k3&span=420-675&walk=14&m=1030
 * span is the first slot's start and the last slot's end, in minutes from midnight on the zone's clock.
 * The map numbers the stops in that order, draws the route from the day's start (the zone's center)
 * through them, and reads the totals in one row (the whole route in one view with its time).
 *
 * Distance: miles first, km as a switch; feet under a tenth of a mile, metres under 1 km.
 */
import { clock } from './clock.js'

export const M_PER_MI = 1609.344
const M_PER_FT = 0.3048

/** A distance in metres as { n, u }: '0.6' 'mi', '450' 'ft', '0.9' 'km', '350' 'm'. */
export function distParts(m, unit = 'mi') {
  const d = Math.max(0, Number(m) || 0)
  if (unit === 'km') {
    if (d < 1000) return { n: String(Math.round(d / 10) * 10), u: 'm' }
    return { n: (d / 1000).toFixed(1), u: 'km' }
  }
  if (d < M_PER_MI / 10) return { n: String(Math.round(d / M_PER_FT / 10) * 10), u: 'ft' }
  return { n: (d / M_PER_MI).toFixed(1), u: 'mi' }
}

export function fmtDist(m, unit = 'mi') {
  const p = distParts(m, unit)
  return `${p.n} ${p.u}`
}

/** 45 → '45 min', 240 → '4 h', 255 → '4 h 15 min'. */
export function durLabel(min) {
  const t = Math.max(0, Math.round(Number(min) || 0))
  if (t < 60) return `${t} min`
  const h = Math.floor(t / 60), r = t % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

/** 420, 675 → '7:00 to 11:15 AM'; 660, 855 → '11:00 AM to 2:15 PM'. */
export function spanLabel(from, to) {
  const a = clock(from), b = clock(to)
  const [at, am] = a.split(' ')
  return am === b.split(' ')[1] ? `${at} to ${b}` : `${a} to ${b}`
}

const int = (v) => {
  const n = Number.parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** The map's query: { keys (in order, no repeats), span: { from, to } | null, walkMin, m }. */
export function dayQuery(q = {}) {
  const keys = [...new Set(String(q.day || '').split(',').map(s => s.trim()).filter(Boolean))]
  const sm = /^(\d+)-(\d+)$/.exec(String(q.span || ''))
  const span = sm && +sm[2] >= +sm[1] ? { from: +sm[1], to: +sm[2] } : null
  return { keys, span, walkMin: int(q.walk), m: int(q.m) }
}

const hasXY = p => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng)

/**
 * The day's stops, numbered in order: keys (in order) looked up in byKey (a Map of things with lat,
 * lng); a key the map does not know, or with no place, is skipped. line: [lng, lat] from the center
 * (when it has a place) through every stop.
 */
export function dayStops(keys, byKey, center = null) {
  const stops = []
  for (const k of keys || []) {
    const x = byKey && byKey.get(String(k))
    if (!hasXY(x)) continue
    stops.push({ n: stops.length + 1, key: String(k), kind: x.kind || 'card', title: x.title || '', lat: x.lat, lng: x.lng })
  }
  const line = [...(hasXY(center) ? [[center.lng, center.lat]] : []), ...stops.map(s => [s.lng, s.lat])]
  return { stops, line }
}

/** Metres one screen pixel covers at a zoom and latitude (Mapbox GL's 512 px tiles). */
export function metresPerPx(zoom, lat) {
  return 78271.517 * Math.cos((lat * Math.PI) / 180) / 2 ** zoom
}

/** Metres between two places; flat earth is close enough at walking distances. */
export function metresApart(a, b) {
  const rad = Math.PI / 180
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad)
  const y = (b.lat - a.lat) * rad
  return 6371008.8 * Math.hypot(x, y)
}

/**
 * Stops whose discs would cover one another, grouped (2026-10-27). m is a disc's width in
 * metres at the map's zoom. A group's discs sit in a row on its middle, one width apart, so two
 * groups merge while their rows touch: across within m, and along within their half-rows plus m.
 * Close stops chain (a near b, b near c is one group). Groups come in the order of their first stop;
 * each lists its keys in stop order and its middle (mean lat, lng).
 */
export function dayGroups(stops, m) {
  const list = (stops || []).filter(hasXY)
  if (!list.length) return []
  const rad = Math.PI / 180, R = 6371008.8, k = Math.cos(list[0].lat * rad)
  const pts = list.map((s, i) => ({ i, s, x: s.lng * rad * k * R, y: s.lat * rad * R }))
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length
  const group = ps => ({ ps, x: mean(ps.map(p => p.x)), y: mean(ps.map(p => p.y)), half: (ps.length - 1) / 2 * m })
  const touch = (a, b) => Math.abs(a.y - b.y) < m && Math.abs(a.x - b.x) < a.half + b.half + m
  let gs = pts.map(p => group([p]))
  for (let merged = true; merged;) {
    merged = false
    outer: for (let a = 0; a < gs.length; a++) {
      for (let b = a + 1; b < gs.length; b++) {
        if (!touch(gs[a], gs[b])) continue
        gs[a] = group([...gs[a].ps, ...gs[b].ps].sort((p, q) => p.i - q.i))
        gs.splice(b, 1)
        merged = true
        break outer
      }
    }
  }
  gs.sort((a, b) => a.ps[0].i - b.ps[0].i)
  return gs.map(g => ({ keys: g.ps.map(p => p.s.key), lat: mean(g.ps.map(p => p.s.lat)), lng: mean(g.ps.map(p => p.s.lng)) }))
}

/**
 * Where each stop's disc sits: a stop alone at its own place; a group's discs side by side, gap px
 * apart, in stop order, centred on the group's middle. Returns key -> { lat, lng, dx }.
 */
export function dayPlaces(stops, m, gap = 28) {
  const out = new Map()
  for (const g of dayGroups(stops, m)) {
    const n = g.keys.length
    g.keys.forEach((k, i) => out.set(k, { lat: g.lat, lng: g.lng, dx: (i - (n - 1) / 2) * gap }))
  }
  return out
}

/** The map's totals row: '3 stops', '4 h 15 min', '7:00 to 11:15 AM', '14 min walk' (the distance apart). */
export function dayTotals(n, q) {
  const parts = [`${n} ${n === 1 ? 'stop' : 'stops'}`]
  if (q && q.span) parts.push(durLabel(q.span.to - q.span.from), spanLabel(q.span.from, q.span.to))
  if (q && q.walkMin != null) parts.push(`${q.walkMin} min walk`)
  return parts
}
