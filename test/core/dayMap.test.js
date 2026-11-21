// Ported from NYID tests/tabletopDayMap.test.js: the same assertions, the kit's paths.
/**
 * The day on the map (utils/tabletop/dayMap.js, 2026-10-27): distance in miles or km, the day's
 * time and span, the map's query, and the numbered stops with their route.
 */
import { describe, it, expect } from 'vitest'
import { distParts, fmtDist, durLabel, spanLabel, dayQuery, dayStops, dayTotals, metresPerPx, metresApart, dayGroups, dayPlaces } from '../../core/dayMap.js'

describe('distance (miles first, km a switch)', () => {
  it('reads miles to one place, and feet under a tenth of a mile', () => {
    expect(fmtDist(1030)).toBe('0.6 mi')
    expect(fmtDist(161)).toBe('0.1 mi')
    expect(fmtDist(160)).toBe('520 ft')
    expect(fmtDist(0)).toBe('0 ft')
    expect(distParts(4828, 'mi')).toEqual({ n: '3.0', u: 'mi' })
  })

  it('reads km to one place, and metres under 1 km rounded to ten', () => {
    expect(fmtDist(1030, 'km')).toBe('1.0 km')
    expect(fmtDist(994, 'km')).toBe('990 m')
    expect(fmtDist(346, 'km')).toBe('350 m')
    expect(fmtDist(2560, 'km')).toBe('2.6 km')
  })

  it('takes nonsense as nothing', () => {
    expect(fmtDist(undefined)).toBe('0 ft')
    expect(fmtDist(-5, 'km')).toBe('0 m')
  })
})

describe('time', () => {
  it('says minutes, hours, or both', () => {
    expect(durLabel(45)).toBe('45 min')
    expect(durLabel(240)).toBe('4 h')
    expect(durLabel(255)).toBe('4 h 15 min')
    expect(durLabel(60)).toBe('1 h')
  })

  it('says the span once for one half of the day, twice across noon', () => {
    expect(spanLabel(420, 675)).toBe('7:00 to 11:15 AM')
    expect(spanLabel(660, 855)).toBe('11:00 AM to 2:15 PM')
    expect(spanLabel(13 * 60 + 15, 17 * 60 + 30)).toBe('1:15 to 5:30 PM')
  })
})

describe('the map\'s query', () => {
  it('reads the keys in order, the span, the walk and the metres', () => {
    expect(dayQuery({ day: 'b,a,b,c', span: '420-675', walk: '14', m: '1030' }))
      .toEqual({ keys: ['b', 'a', 'c'], span: { from: 420, to: 675 }, walkMin: 14, m: 1030 })
  })

  it('has no span without one, or with a span that runs backward', () => {
    expect(dayQuery({ day: 'a' })).toEqual({ keys: ['a'], span: null, walkMin: null, m: null })
    expect(dayQuery({ day: 'a', span: '700-600' }).span).toBe(null)
    expect(dayQuery({ span: 'x' })).toEqual({ keys: [], span: null, walkMin: null, m: null })
  })
})

describe('the numbered stops and their route', () => {
  const center = { lat: 40.2508, lng: -111.6493 }
  const byKey = new Map([
    ['a', { lat: 40.25, lng: -111.65, title: 'A', kind: 'card' }],
    ['e', { lat: 40.24, lng: -111.66, title: 'E', kind: 'event' }],
    ['x', { title: 'No place' }],
  ])

  it('numbers the known stops in order and runs the line from the center through them', () => {
    const { stops, line } = dayStops(['e', 'gone', 'x', 'a'], byKey, center)
    expect(stops.map(s => [s.n, s.key, s.kind])).toEqual([[1, 'e', 'event'], [2, 'a', 'card']])
    expect(line).toEqual([[center.lng, center.lat], [-111.66, 40.24], [-111.65, 40.25]])
  })

  it('starts the line at the first stop when there is no center', () => {
    expect(dayStops(['a'], byKey, null).line).toEqual([[-111.65, 40.25]])
  })

  it('reads the totals row', () => {
    const q = dayQuery({ day: 'a,e,c', span: '420-675', walk: '14', m: '1030' })
    expect(dayTotals(3, q)).toEqual(['3 stops', '4 h 15 min', '7:00 to 11:15 AM', '14 min walk'])
    expect(dayTotals(1, dayQuery({ day: 'a' }))).toEqual(['1 stop'])
  })
})

// Close stops: the Provo cards that hid one another on the phone map.
describe('close stops sit side by side', () => {
  const cafe = { key: 'cafe', lat: 40.250845, lng: -111.647987 }      // MOA Café
  const moa = { key: 'moa', lat: 40.250833, lng: -111.648056 }        // BYU Museum of Art
  const hbl = { key: 'hbl', lat: 40.2492, lng: -111.649 }             // Harold B. Lee Library
  const perry = { key: 'perry', lat: 40.249167, lng: -111.649167 }    // L. Tom Perry Special Collections
  const fam = { key: 'fam', lat: 40.248777, lng: -111.649231 }        // BYU Library Family History
  const cell = s => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`

  it('measures metres between places and per pixel', () => {
    expect(metresApart(cafe, moa)).toBeGreaterThan(5)
    expect(metresApart(cafe, moa)).toBeLessThan(7)
    expect(metresApart(hbl, perry)).toBeCloseTo(14.7, 0)
    expect(metresApart(hbl, fam)).toBeCloseTo(51, 0)
    expect(metresPerPx(0, 0)).toBeCloseTo(78271.5, 0)
    expect(metresPerPx(14.5, 40.25)).toBeCloseTo(2.58, 2)
  })

  it('groups the café and the museum, which rounding to four places kept apart', () => {
    expect(cell(cafe)).not.toBe(cell(moa))
    expect(dayGroups([cafe, hbl, moa], 60).map(g => g.keys)).toEqual([['cafe', 'moa'], ['hbl']])
  })

  it('groups the library cards by how wide a disc is', () => {
    expect(dayGroups([hbl, perry, fam], 50).map(g => g.keys)).toEqual([['hbl', 'perry', 'fam']])
    expect(dayGroups([fam, hbl, perry], 20).map(g => g.keys)).toEqual([['fam'], ['hbl', 'perry']])
    expect(dayGroups([hbl, perry, fam], 10).length).toBe(3)
  })

  it('merges a stop that a row of discs would reach, though no stop in it is near', () => {
    const m = 30, east = mx => -111.65 + mx / (6371008.8 * Math.PI / 180 * Math.cos(40.25 * Math.PI / 180))
    const row = ['a', 'b', 'c'].map(key => ({ key, lat: 40.25, lng: -111.65 }))
    const q = { key: 'q', lat: 40.25, lng: east(45) }
    expect(metresApart(row[0], q)).toBeGreaterThan(m)
    expect(dayGroups([...row, q], m).map(g => g.keys)).toEqual([['a', 'b', 'c', 'q']])
    expect(dayGroups([row[0], q], m).length).toBe(2)
  })

  it('takes a disc width at the fitted zoom', () => {
    const m = metresPerPx(14.5, 40.25) * 30
    expect(dayGroups([cafe, moa, hbl, perry, fam], m).map(g => g.keys)).toEqual([['cafe', 'moa'], ['hbl', 'perry', 'fam']])
    expect(dayGroups([cafe, hbl], metresPerPx(17, 40.25) * 30).length).toBe(2)
  })

  it('puts a group on its middle, side by side in stop order, and a lone stop on its place', () => {
    const at = dayPlaces([cafe, moa, hbl, perry, fam, { key: 'far', lat: 40.2338, lng: -111.6585 }], 60)
    expect(at.get('cafe')).toEqual({ lat: (cafe.lat + moa.lat) / 2, lng: (cafe.lng + moa.lng) / 2, dx: -14 })
    expect(at.get('moa').dx).toBe(14)
    expect([at.get('hbl').dx, at.get('perry').dx, at.get('fam').dx]).toEqual([-28, 0, 28])
    expect(at.get('far')).toEqual({ lat: 40.2338, lng: -111.6585, dx: 0 })
  })

  it('skips stops with no place', () => {
    expect(dayGroups([{ key: 'x' }, cafe], 60).map(g => g.keys)).toEqual([['cafe']])
    expect(dayGroups(null, 60)).toEqual([])
  })
})
