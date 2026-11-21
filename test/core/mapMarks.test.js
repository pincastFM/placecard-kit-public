// Ported from NYID tests/tabletopMapMarks.test.js: the same assertions, the kit's paths.
/**
 * The zone map's walk discs and event squares (utils/tabletop/mapMarks.js, 2026-10-27): discs
 * stay on their stops; events that would touch form a row in time order, and each row takes the
 * nearest open spot, or folds into a stack when the map is too zoomed out for it. Coordinates are
 * the Provo zone's walk and events (server/data/zones/provo.json).
 */
import { describe, it, expect } from 'vitest'
import { markPlaces } from '../../core/mapMarks.js'
import { metresPerPx } from '../../core/dayMap.js'

const WALK = [
  { key: 'walk-0', lat: 40.2559, lng: -111.64535, pin: true },
  { key: 'walk-1', lat: 40.2528, lng: -111.647, pin: true },
  { key: 'walk-2', lat: 40.250833, lng: -111.648056, pin: true },
  { key: 'walk-3', lat: 40.248262, lng: -111.649806, pin: true },
]
// In start order, as the map hands them over.
const EVENTS = [
  { key: 'ev-filmquest-film-festival', lat: 40.2356085, lng: -111.659179 },
  { key: 'ev-halloween-family-night', lat: 40.253388, lng: -111.647151 },
  { key: 'ev-poe-murder-mystery-dinner', lat: 40.235443, lng: -111.658941 },
  { key: 'ev-all-the-beautiful-things', lat: 40.24996468172995, lng: -111.64799164469814 },
  { key: 'ev-string-chamber-night', lat: 40.248502, lng: -111.643119 },
  { key: 'ev-jazz-combo-showcase', lat: 40.248502, lng: -111.643119 },
  { key: 'ev-autumn-apparitions', lat: 40.257523, lng: -111.663618 },
  { key: 'ev-coveys-tapestry-of-dance', lat: 40.2334157, lng: -111.666352 },
  { key: 'ev-jazz-legacy-band', lat: 40.248502, lng: -111.643119 },
  { key: 'ev-a-house-united-screening', lat: 40.2546347, lng: -111.6475266 },
  { key: 'ev-group-for-new-music', lat: 40.248502, lng: -111.643119 },
  { key: 'ev-byu-laboween', lat: 40.24835, lng: -111.645945 },
  { key: 'ev-enchanted-lake-skate', lat: 40.23509, lng: -111.6379388 },
  { key: 'ev-jack-mitchener-organ', lat: 40.248502, lng: -111.643119 },
  { key: 'ev-paranormal-percussion', lat: 40.2334157, lng: -111.666352 },
]
const MUSIC = ['ev-string-chamber-night', 'ev-jazz-combo-showcase', 'ev-jazz-legacy-band', 'ev-group-for-new-music', 'ev-jack-mitchener-organ']
const LAT0 = 40.25
const STILL = { dx: 0, dy: 0, under: false }

const place = (items, zoom) => markPlaces(items, metresPerPx(zoom, LAT0))
// Screen px of a placed item at a zoom (y grows down), from its anchor and offset.
function px(p, zoom) {
  const rad = Math.PI / 180, R = 6371008.8, mpp = metresPerPx(zoom, LAT0)
  return { x: (p.lng * rad * Math.cos(WALK[0].lat * rad) * R) / mpp + p.dx, y: -(p.lat * rad * R) / mpp + p.dy }
}

describe('walk discs', () => {
  it('never move, at any zoom', () => {
    for (const z of [11, 12.6, 13, 14, 15.5, 17]) {
      const at = place([...WALK, ...EVENTS], z)
      for (const w of WALK) expect(at.get(w.key)).toEqual({ lat: w.lat, lng: w.lng, ...STILL })
    }
  })

  it('stay put even when they touch one another', () => {
    const at = place(WALK, 11)
    for (const w of WALK) expect(at.get(w.key)).toEqual({ lat: w.lat, lng: w.lng, ...STILL })
  })
})

describe('events', () => {
  it('at one venue sit in a row on their middle, in the order given', () => {
    const at = place(EVENTS, 16.5)
    expect(MUSIC.map(k => at.get(k).dx)).toEqual([-52, -26, 0, 26, 52])
    for (const k of MUSIC) expect(at.get(k)).toMatchObject({ lat: 40.248502, lng: -111.643119, dy: 0, under: false })
  })

  it('far from everything stay on their own place', () => {
    const at = place([...WALK, ...EVENTS], 12.6)
    expect(at.get('ev-autumn-apparitions')).toEqual({ lat: 40.257523, lng: -111.663618, ...STILL })
    expect(at.get('ev-enchanted-lake-skate')).toEqual({ lat: 40.23509, lng: -111.6379388, ...STILL })
  })

  it('that a disc would cover move off it, a square and a half at most (the Museum of Art event)', () => {
    const z = 13.3
    const ev = EVENTS.find(e => e.key === 'ev-all-the-beautiful-things')
    const own = px({ ...ev, dx: 0, dy: 0 }, z), d = px(place(WALK, z).get('walk-2'), z)
    expect(Math.abs(own.x - d.x) < 27 && Math.abs(own.y - d.y) < 27).toBe(true)   // covered before
    const e = px(place([...WALK, ...EVENTS], z).get(ev.key), z)
    expect(Math.abs(e.x - d.x) >= 27 || Math.abs(e.y - d.y) >= 27).toBe(true)
    expect(Math.hypot(e.x - own.x, e.y - own.y)).toBeLessThanOrEqual(39.01)
  })

  it('stay on their own place when the walk is off and nothing else is near', () => {
    expect(place(EVENTS, 15).get('ev-all-the-beautiful-things')).toMatchObject(STILL)
  })

  it('stack when the map is too zoomed out for their row, the earliest on top', () => {
    const at = place([...WALK, ...EVENTS], 12.6)
    const m0 = at.get(MUSIC[0])
    const stack = [...at.entries()].filter(([, p]) => p.lat === m0.lat && p.lng === m0.lng)
    for (const k of MUSIC) expect(stack.map(([key]) => key)).toContain(k)
    const tops = stack.filter(([, p]) => !p.under)
    expect(tops.length).toBe(1)
    const order = EVENTS.map(e => e.key)
    expect(order.indexOf(tops[0][0])).toBe(Math.min(...stack.map(([key]) => order.indexOf(key))))
  })

  it('open into their row again when the map zooms in', () => {
    const at = place([...WALK, ...EVENTS], 16.5)
    for (const k of MUSIC) expect(at.get(k).under).toBe(false)
  })

  it('move the short way: sideways before down, right before left', () => {
    // Near the equator a degree is about 111 km; at 1 m a px the event sits 5 px right of the disc.
    const d = 1 / 111195
    const at = markPlaces([{ key: 'a', lat: 0, lng: 0, pin: true }, { key: 'e', lat: 0, lng: 5 * d }], 1)
    expect(at.get('e')).toMatchObject({ dx: 26, dy: 0, under: false })
  })

  it('take the other side when one side is a disc', () => {
    const d = 1 / 111195
    const items = [
      { key: 'a', lat: 0, lng: 0, pin: true },
      { key: 'b', lat: 0, lng: 30 * d, pin: true },
      { key: 'e', lat: 0, lng: 2 * d },
    ]
    const p = markPlaces(items, 1).get('e')
    expect(p.dy).toBe(0)
    expect(p.dx).toBeLessThan(-26)
  })

  it('cover no disc and no other event at the phone and laptop zooms', () => {
    for (const z of [12.4, 12.6, 12.8, 13, 13.5, 14, 14.5, 15, 15.5, 16]) {
      const at = place([...WALK, ...EVENTS], z)
      const ev = EVENTS.map(e => ({ key: e.key, ...px(at.get(e.key), z), p: at.get(e.key) }))
      const all = [...WALK.map(w => ({ key: w.key, ...px(at.get(w.key), z), p: at.get(w.key) })), ...ev]
      const sameStack = (a, b) => (a.p.under || b.p.under) && a.p.lat === b.p.lat && a.p.lng === b.p.lng
      for (const e of ev) {
        for (const o of all) {
          if (o.key === e.key || sameStack(e, o)) continue
          const hit = Math.abs(e.x - o.x) < 26 && Math.abs(e.y - o.y) < 26
          expect(hit, `${e.key} on ${o.key} at zoom ${z}`).toBe(false)
        }
      }
    }
  })
})

describe('nonsense', () => {
  it('takes no items, items with no place, and no scale', () => {
    expect(markPlaces([], 10).size).toBe(0)
    expect(markPlaces(null, 10).size).toBe(0)
    expect(markPlaces([{ key: 'x', lat: NaN, lng: 1 }], 10).size).toBe(0)
    expect(markPlaces([{ key: 'x', lat: 1, lng: 1 }, { key: 'y', lat: 1, lng: 1 }], 0).get('y')).toEqual({ lat: 1, lng: 1, ...STILL })
  })
})
