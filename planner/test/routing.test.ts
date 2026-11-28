/**
 * 1.7.0's routing, piece by piece: the modes (run and transit; never a car), the time rule (leave now,
 * leave at, arrive by), the player's own stops (vias), and transit (the router the host injects, the
 * OTP query the kit builds for it and the answer the kit reads). No network: the street services and
 * the transit routers here are functions. A request that names none of it plans as 1.6.2 did, which
 * path.test.ts's goldens hold.
 */
import { describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { solvePath } from '../path/index'
import { MODES, meters } from '../path/geo'
import { toV1, upgradeV1, validateRecord } from '../record'
import { OTP_PLAN_QUERY, buildOtpPlanQuery, decodePolyline, otpPlanToLegs } from '../path/transit'
import type { TransitItinerary, TransitRequest } from '../path/transit'
import { epochOf, wallOf } from '../path/when'
import * as entry from '../index'
import { CANDIDATES, DEST, FAR, PATH_CASES, START, streets } from './fixtures/path-cases'
import { OTP_PLAN, T0 } from './fixtures/otp-plan'

const caseReq = (name: string): any => {
  const c = PATH_CASES.find((x) => x.name === name)
  if (!c) throw new Error(`no case ${name}`)
  return { ...c.req }
}
const OPEN30 = 'open, planned, 30 min, on the estimate'
const DEST40 = 'a destination, planned, 40 min, streets at 1.2'
const LOOP45 = 'back to the start, planned, 45 min, on the estimate'
const strip = (r: any) => ({ ...r, id: null, madeAt: null })
const ok = (r: unknown) => expect(validateRecord(r)).toEqual({ ok: true, errors: [] })
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {})

const NY = 'America/New_York'
const NOW = Date.UTC(2026, 10, 28, 14, 0) // 9:00 AM in New York
const V1 = { lat: 40.74, lon: -73.987, label: 'Park' }
const V2 = { lat: 40.733, lon: -73.984, label: 'Corner' }

describe('modes: walk, run, bike, transit; never a car', () => {
  it('MODES: walk and bike as before, run at an easy jog on the walk\'s streets, transit on the walk\'s estimate', () => {
    expect(Object.keys(MODES)).toEqual(['walk', 'run', 'bike', 'transit'])
    expect(MODES.walk).toEqual({ mPerMin: 80, factor: 1.3, profile: 'mapbox/walking' })
    expect(MODES.bike).toEqual({ mPerMin: 250, factor: 1.3, profile: 'mapbox/cycling' })
    expect(MODES.run).toEqual({ mPerMin: 160, factor: 1.3, profile: 'mapbox/walking' })
    expect(1000 / MODES.run.mPerMin).toBeCloseTo(6.25) // 6:15 a km
    expect(Math.abs(1609.344 / MODES.run.mPerMin - 10)).toBeLessThan(0.1) // about a 10-minute mile
    expect(MODES.transit).toEqual(MODES.walk)
    expect('car' in MODES).toBe(false)
  })

  it('a car, or any mode MODES has not, throws; a mode left out is walk', async () => {
    await expect(solvePath({ ...caseReq(OPEN30), mode: 'car' }, null)).rejects.toThrow("mode: 'car' is not walk, run, bike or transit")
    await expect(solvePath({ ...caseReq(OPEN30), mode: 'toString' }, null)).rejects.toThrow(/is not walk, run, bike or transit/)
    const { mode: _m, ...noMode } = caseReq(OPEN30)
    const p = await solvePath(noMode, null)
    expect(p.record.mode).toBe('walk')
    expect(strip(p.record)).toEqual(strip((await solvePath(caseReq(OPEN30), null)).record))
  })

  it('the record validator takes run and transit and refuses a car', async () => {
    const r = (await solvePath(caseReq(OPEN30), null)).record
    for (const m of ['walk', 'run', 'bike', 'transit']) ok({ ...r, mode: m })
    expect(validateRecord({ ...r, mode: 'car' }).errors).toContain('mode: not walk, run, bike or transit')
  })

  it('a request that names nothing new comes back with 1.6.2\'s keys, and no others', async () => {
    expect(Object.keys(await solvePath(caseReq(OPEN30), null))).toEqual(['record', 'geometry', 'timingError'])
    expect(Object.keys(await solvePath(caseReq(DEST40), streets(() => 1.2)))).toEqual(['record', 'geometry', 'timingError'])
  })

  it('run, on the estimate: each leg its meters at 160 a minute, and more cards in the same time', async () => {
    const walk = (await solvePath(caseReq(OPEN30), null)).record
    const run = (await solvePath({ ...caseReq(OPEN30), mode: 'run' }, null)).record
    ok(run)
    expect(run.mode).toBe('run')
    expect(run.totals.timing).toBe('estimate')
    for (const s of run.stops) expect(Math.abs(s.leg.min - s.leg.m / 160)).toBeLessThan(0.06)
    expect(run.stops.length).toBeGreaterThan(walk.stops.length)
    expect(toV1(run).mode).toBe('run')
  })

  it('run, timed: the adapter is asked for the walk\'s streets only, and each leg is timed at the running pace', async () => {
    const seen: string[] = []
    const s = streets(() => 1.1)
    const p = await solvePath({ ...caseReq(OPEN30), mode: 'run' }, async (pts: any, m: any) => { seen.push(m); return s(pts, m) })
    expect([...new Set(seen)]).toEqual(['walk'])
    expect(p.record.totals.timing).toBe('mapbox')
    for (const st of p.record.stops) expect(Math.abs(st.leg.min - st.leg.m / 160)).toBeLessThan(0.06)
    ok(p.record)
  })

  it('transit with no router: the walk\'s estimate, the street adapter never asked, transit null', async () => {
    const asked = vi.fn(streets(() => 1))
    const walk = (await solvePath(caseReq(OPEN30), null)).record
    const p = await solvePath({ ...caseReq(OPEN30), mode: 'transit' }, asked)
    expect(asked).not.toHaveBeenCalled()
    expect(p.record.totals.timing).toBe('estimate')
    expect(p.timingError).toBeNull()
    expect(p.transit).toBeNull()
    expect(p.record.stops.map((s) => s.card)).toEqual(walk.stops.map((s) => s.card))
    ok(p.record)
  })
})

describe('the time rule: leave now, leave at, arrive by', () => {
  it('leave at: the record\'s clock, and the plan otherwise as without one', async () => {
    const without = await solvePath(caseReq(DEST40), streets(() => 1.2))
    const p = await solvePath({ ...caseReq(DEST40), when: { kind: 'leaveAt', tz: NY, date: '2026-11-28', at: 615 } }, streets(() => 1.2))
    expect(p.record.clock).toEqual({ tz: NY, date: '2026-11-28', startAt: 615 })
    expect(strip({ ...p.record, clock: null })).toEqual(strip(without.record))
    expect(p.geometry).toEqual(without.geometry)
    ok(p.record)
  })

  it('leave now: the clock reads the instant on the place\'s own clock', async () => {
    const p = await solvePath({ ...caseReq(OPEN30), when: { kind: 'now', tz: NY, now: NOW + 7.5 * 60000 } }, null)
    expect(p.record.clock).toEqual({ tz: NY, date: '2026-11-28', startAt: 9 * 60 + 7 })
    const tokyo = await solvePath({ ...caseReq(OPEN30), when: { kind: 'now', tz: 'Asia/Tokyo', now: NOW } }, null)
    expect(tokyo.record.clock).toEqual({ tz: 'Asia/Tokyo', date: '2026-11-28', startAt: 23 * 60 })
    const sys = await solvePath({ ...caseReq(OPEN30), when: { kind: 'now', tz: 'UTC' } }, null)
    expect(sys.record.clock!.date).toBe(new Date().toISOString().slice(0, 10))
    ok(p.record)
  })

  it('arrive by, with time to spare: the time allowed stands, and the start is the time less the minutes to the end', async () => {
    const p = await solvePath({ ...caseReq(DEST40), when: { kind: 'arriveBy', tz: NY, date: '2026-11-28', at: 12 * 60, now: NOW } }, streets(() => 1.2))
    expect(p.record.minutes).toBe(40)
    expect(p.record.clock).toEqual({ tz: NY, date: '2026-11-28', startAt: 12 * 60 - Math.ceil(p.record.finish!.arriveMin) })
    ok(p.record)
  })

  it('arrive by, untimed: the minutes left before it are the time allowed; an open end arrives at its last stop', async () => {
    const p = await solvePath({ ...caseReq(OPEN30), minutes: null, when: { kind: 'arriveBy', tz: NY, at: 9 * 60 + 25, now: NOW } }, null)
    expect(p.record.minutes).toBe(25)
    expect(p.record.totals.totalMin).toBeLessThanOrEqual(25)
    const last = p.record.stops[p.record.stops.length - 1]
    expect(p.record.clock).toEqual({ tz: NY, date: '2026-11-28', startAt: 9 * 60 + 25 - Math.ceil(last.arriveMin) })
    ok(p.record)
  })

  it('arrive by sooner than the time asked for: cut to the minutes left', async () => {
    const p = await solvePath({ ...caseReq(OPEN30), when: { kind: 'arriveBy', tz: NY, at: 9 * 60 + 20, now: NOW + 30000 } }, null)
    expect(p.record.minutes).toBe(19)
    expect(p.record.totals.totalMin).toBeLessThanOrEqual(19)
  })

  it('arrive by just after midnight starts the day before', async () => {
    const p = await solvePath({ ...caseReq(LOOP45), when: { kind: 'arriveBy', tz: NY, date: '2026-11-29', at: 10, now: NOW } }, null)
    expect(p.record.clock).toEqual({ tz: NY, date: '2026-11-28', startAt: 24 * 60 + 10 - Math.ceil(p.record.finish!.arriveMin) })
    ok(p.record)
  })

  it('an arrive by that has passed, and a rule it cannot read, throw naming the field', async () => {
    const r = caseReq(OPEN30)
    await expect(solvePath({ ...r, when: { kind: 'arriveBy', tz: NY, at: 8 * 60, now: NOW } }, null)).rejects.toThrow('when: arrive by 2026-11-28 08:00 has passed')
    await expect(solvePath({ ...r, when: { kind: 'later', tz: NY } }, null)).rejects.toThrow("when.kind: 'now', 'leaveAt' or 'arriveBy', not 'later'")
    await expect(solvePath({ ...r, when: { kind: 'now', tz: 'Mars/Olympus' } }, null)).rejects.toThrow("when.tz: 'Mars/Olympus' is not an IANA time zone")
    await expect(solvePath({ ...r, when: { kind: 'now' } }, null)).rejects.toThrow('when.tz: an IANA time zone')
    await expect(solvePath({ ...r, when: { kind: 'leaveAt', tz: NY, at: 1440 } }, null)).rejects.toThrow('when.at: minutes past midnight')
    await expect(solvePath({ ...r, when: { kind: 'leaveAt', tz: NY, at: 600, date: '11/28/2026' } }, null)).rejects.toThrow('when.date: YYYY-MM-DD')
    await expect(solvePath({ ...r, when: { kind: 'now', tz: NY, now: Number.NaN } }, null)).rejects.toThrow('when.now: an instant')
    await expect(solvePath({ ...r, when: 'soon' }, null)).rejects.toThrow('when: {')
  })

  it('the place\'s clock across its changes: epochOf and wallOf agree, and a spring-forward day is 23 hours', () => {
    for (const [date, min] of [['2026-03-07', 600], ['2026-03-08', 600], ['2026-11-01', 30], ['2026-11-01', 600], ['2026-06-15', 0], ['2026-12-31', 1439]] as const) {
      expect(wallOf(epochOf(date, min, NY), NY)).toEqual({ date, min, sec: 0 })
    }
    expect(epochOf('2026-03-08', 600, NY) - epochOf('2026-03-07', 600, NY)).toBe(23 * 3600000)
    expect(epochOf('2026-11-01', 600, NY) - epochOf('2026-10-31', 600, NY)).toBe(25 * 3600000)
    expect(epochOf('2026-11-28', 540, NY)).toBe(NOW)
  })

  it('a clock is planner output only: v1 has none, and the record without one is 1.6.2\'s', async () => {
    const p = await solvePath({ ...caseReq(OPEN30), when: { kind: 'leaveAt', tz: NY, at: 600 } }, null)
    expect(upgradeV1(toV1(p.record)).clock).toBeNull()
  })
})

describe('the player\'s own stops (vias)', () => {
  it('one via and an open end plans as a destination at it, the via\'s label its name', async () => {
    const cases: [string, () => any][] = [
      [DEST40, () => streets(() => 1.2)],
      ['a destination, planned, 25 min, by bike, on the estimate', () => null],
      [DEST40, () => streets((i) => (i === 0 ? 6 : 1))], // five rounds and still over
    ]
    for (const [name, d] of cases) {
      const base = caseReq(name)
      const dest = await solvePath(base, d())
      const via = await solvePath({ ...base, end: { kind: 'open' }, vias: [{ ...DEST, label: 'Empire State Building' }] }, d())
      expect(strip(via.record), name).toEqual(strip({ ...dest.record, end: { kind: 'destination', at: DEST, name: 'Empire State Building' } }))
      expect(via.geometry).toEqual(dest.geometry)
      expect(via.vias).toEqual([{ n: 1, at: DEST, label: 'Empire State Building', arriveMin: dest.record.finish!.arriveMin, after: dest.record.stops.length }])
    }
  })

  it('a loop through two vias: back to the start, the vias in her order, cards between them, inside the time', async () => {
    const p = await solvePath({ ...caseReq(LOOP45), vias: [V1, V2] }, null)
    ok(p.record)
    const r = p.record
    expect(r.end).toEqual({ kind: 'start', at: START, name: null })
    expect(p.vias!.map((v) => [v.n, v.label])).toEqual([[1, 'Park'], [2, 'Corner']])
    expect(p.vias![0].arriveMin).toBeLessThan(p.vias![1].arriveMin)
    expect(r.finish!.arriveMin).toBeLessThanOrEqual(45)
    expect(r.stops.length).toBeGreaterThan(0)
    for (const v of p.vias!) {
      if (v.after > 0) expect(v.arriveMin).toBeGreaterThan(r.stops[v.after - 1].arriveMin)
      if (v.after < r.stops.length) expect(v.arriveMin).toBeLessThan(r.stops[v.after].arriveMin)
    }
    const idx = (v: { lat: number; lon: number }) => p.geometry.findIndex(([lon, lat]) => lon === v.lon && lat === v.lat)
    expect(idx(V1)).toBeGreaterThan(0)
    expect(idx(V2)).toBeGreaterThan(idx(V1))
    // the other order is another line
    const q = await solvePath({ ...caseReq(LOOP45), vias: [V2, V1] }, null)
    expect(q.vias!.map((v) => v.label)).toEqual(['Corner', 'Park'])
    const qi = (v: { lat: number; lon: number }) => q.geometry.findIndex(([lon, lat]) => lon === v.lon && lat === v.lat)
    expect(qi(V1)).toBeGreaterThan(qi(V2))
  })

  it('an open end: the last via is the end, recorded as a destination, and passes come in order', async () => {
    const p = await solvePath({ ...caseReq('open, planned, untimed'), vias: [V1, V2] }, null)
    ok(p.record)
    expect(p.record.stops.length).toBe(new Set(CANDIDATES.map((c) => c.card)).size) // untimed: every card, one place each
    expect(p.record.end).toEqual({ kind: 'destination', at: { lat: V2.lat, lon: V2.lon }, name: 'Corner' })
    expect(p.vias!.at(-1)).toEqual({ n: 2, at: { lat: V2.lat, lon: V2.lon }, label: 'Corner', arriveMin: p.record.finish!.arriveMin, after: p.record.stops.length })
  })

  it('timed on streets and over the time: cards come off, every via stays', async () => {
    const req = { ...caseReq(LOOP45), vias: [V1, V2] }
    const est = await solvePath(req, null)
    const p = await solvePath(req, streets(() => 1.2))
    ok(p.record)
    expect(p.record.totals.timing).toBe('mapbox')
    expect(p.vias).toHaveLength(2)
    expect(p.record.finish!.arriveMin).toBeLessThanOrEqual(45)
    expect(p.record.stops.length).toBeGreaterThan(0)
    expect(p.record.stops.length).toBeLessThan(est.record.stops.length)
    // her own line alone runs over (2,063 m through the vias, at 1.5 times the estimate, is 50.3 min):
    // no card fits, and the vias still stand
    const over = await solvePath(req, streets(() => 1.5))
    ok(over.record)
    expect(over.record.stops).toEqual([])
    expect(over.vias!.map((v) => v.n)).toEqual([1, 2])
    expect(over.record.finish!.arriveMin).toBeGreaterThan(45)
  })

  it('a street service that fails or gives too few legs: the estimate stands, with why', async () => {
    const req = { ...caseReq(LOOP45), vias: [V1] }
    const down = await solvePath(req, async () => { throw new Error('streets down') })
    expect(down.record.totals.timing).toBe('estimate')
    expect(down.timingError).toBe('streets down')
    const short = await solvePath(req, async () => ({ legs: [], geometry: [] }))
    expect(short.record.totals.timing).toBe('estimate')
    expect(short.timingError).toMatch(/^street timing gave 0 legs for \d+$/)
    expect(strip(short.record)).toEqual(strip((await solvePath(req, null)).record))
  })

  it('left over: a card far from the line is out of reach', async () => {
    const req = { ...caseReq(LOOP45), candidates: [...CANDIDATES, { card: 'Far tree', place: { id: 'far', ...FAR } }], vias: [V1] }
    const p = await solvePath(req, null)
    expect(p.record.leftOver.find((x) => x.key === 'Far tree')).toEqual({ key: 'Far tree', kind: 'card', reason: 'out of reach' })
    expect(p.record.leftOver.filter((x) => x.key !== 'Far tree').every((x) => x.reason === 'no time left')).toBe(true)
  })

  it('a run through vias: the line at the running pace', async () => {
    const p = await solvePath({ ...caseReq(LOOP45), mode: 'run', vias: [V1, V2] }, null)
    ok(p.record)
    for (const s of p.record.stops) expect(Math.abs(s.leg.min - s.leg.m / 160)).toBeLessThan(0.06)
  })

  it('vias take a planned order only; a via is a point with a label or none; an empty list is none', async () => {
    await expect(solvePath({ ...caseReq('fixed, untimed, a route as walked, streets at 1.3'), vias: [V1] }, null)).rejects.toThrow(/planned order/)
    await expect(solvePath({ ...caseReq(OPEN30), vias: [{ lat: 'x' }] }, null)).rejects.toThrow('vias[0]: not { lat, lon }')
    await expect(solvePath({ ...caseReq(OPEN30), vias: [V1, { ...V2, label: 3 }] }, null)).rejects.toThrow('vias[1].label: a string or null')
    await expect(solvePath({ ...caseReq(OPEN30), vias: 'here' }, null)).rejects.toThrow('vias: a list')
    await expect(solvePath({ ...caseReq(DEST40), end: { kind: 'destination', at: null }, vias: [V1] }, null)).rejects.toThrow('a destination needs a point')
    expect(Object.keys(await solvePath({ ...caseReq(OPEN30), vias: [] }, null))).toEqual(['record', 'geometry', 'timingError'])
    const unlabeled = await solvePath({ ...caseReq(OPEN30), vias: [{ lat: V1.lat, lon: V1.lon }] }, null)
    expect(unlabeled.record.end.name).toBeNull()
  })
})

describe('OpenTripPlanner 2.x: the query the kit builds, the answer it reads', () => {
  const REQ: TransitRequest = { from: START, to: DEST, date: '2026-11-28', time: '10:00', arriveBy: true, tz: NY }

  it('buildOtpPlanQuery: the plan query, walking and transit only, and its variables', () => {
    const q = buildOtpPlanQuery(REQ)
    expect(q.query).toBe(OTP_PLAN_QUERY)
    expect(q.query).toContain('arriveBy: $arriveBy')
    expect(q.query).toContain('transportModes: [{ mode: WALK }, { mode: TRANSIT }]')
    expect(q.query).toContain('headsign')
    expect(q.query).not.toMatch(/CAR/)
    expect(q.variables).toEqual({ fromLat: START.lat, fromLon: START.lon, toLat: DEST.lat, toLon: DEST.lon, date: '2026-11-28', time: '10:00:00', arriveBy: true, numItineraries: 3 })
    const declared = [...q.query.slice(0, q.query.indexOf(')')).matchAll(/\$(\w+):/g)].map((m) => m[1]).sort()
    expect(declared).toEqual(Object.keys(q.variables).sort())
    expect(buildOtpPlanQuery({ ...REQ, time: '10:00:30', numItineraries: 5 }).variables).toMatchObject({ time: '10:00:30', numItineraries: 5 })
  })

  it('buildOtpPlanQuery: one TypeError listing what is wrong', () => {
    expect(() => buildOtpPlanQuery({ ...REQ, from: { lat: 91, lon: 0 }, date: '28/11/2026', arriveBy: 'yes' } as any))
      .toThrow(new TypeError('buildOtpPlanQuery: from: not { lat, lon }; date: not YYYY-MM-DD; arriveBy: not true or false'))
    expect(() => buildOtpPlanQuery({ ...REQ, time: '10am', numItineraries: 0 })).toThrow('time: not HH:MM:SS; numItineraries: a whole number, 1 or more')
  })

  it('decodePolyline: Google\'s own example, as [lon, lat]; a cut-off string keeps the points before the cut', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]])
    expect(decodePolyline('_p~iF~ps|U_ulL')).toEqual([[-120.2, 38.5]])
    expect(decodePolyline('')).toEqual([])
    expect(decodePolyline(null)).toEqual([])
  })

  it('otpPlanToLegs: each way as the kit\'s legs, with the ride\'s route, color, headsign, stops and line', () => {
    const its = otpPlanToLegs(OTP_PLAN)
    expect(its).toHaveLength(2) // the third has no end time
    const [byL, onFoot] = its
    expect(byL).toMatchObject({ m: 4220, min: 20, startTime: T0, endTime: T0 + 20 * 60000, walkM: 620, waitMin: 3, transfers: 0 })
    expect(byL.legs.map((l) => [l.mode, l.ride, l.m, l.min])).toEqual([['WALK', false, 120, 2], ['SUBWAY', true, 3600, 9], ['WALK', false, 500, 6]])
    const ride = byL.legs[1]
    expect(ride.route).toEqual({ shortName: 'L', longName: '14 St-Canarsie Local', color: '#A7A9AC', textColor: '#FFFFFF', agency: 'MTA New York City Transit' })
    expect(ride.headsign).toBe('Canarsie - Rockaway Pkwy')
    expect(ride.from).toEqual({ name: '14 St-Union Sq', lat: 40.73479, lon: -73.99073, stop: '14 St-Union Sq', stopId: 'MTASBWY:L03', platform: 'L' })
    expect(ride.to).toEqual({ name: 'Bedford Av', lat: 40.7173, lon: -73.95687, stop: 'Bedford Av', stopId: 'MTASBWY:L08', platform: null })
    expect(ride.stops).toBe(2)
    expect([ride.startTime, ride.endTime]).toEqual([T0 + 5 * 60000, T0 + 14 * 60000])
    expect(ride.geometry).toEqual([[-73.99073, 40.73479], [-73.98612, 40.73223], [-73.98163, 40.73098], [-73.95687, 40.7173]])
    const walk = byL.legs[0]
    expect([walk.route, walk.headsign, walk.from.stop, walk.to.stop]).toEqual([null, null, null, '14 St-Union Sq'])
    expect(walk.steps[1]).toEqual({ m: 40, relativeDirection: 'RIGHT', absoluteDirection: 'SOUTHWEST', streetName: 'East 14th Street', lat: 40.7353, lon: -73.9905 })
    expect(byL.geometry).toHaveLength(3 + 4 + 3 - 2) // the legs' lines joined, each shared end once
    expect(byL.geometry[0]).toEqual([-73.9911, 40.7359])
    expect(byL.geometry.at(-1)).toEqual([-73.9614, 40.7142])
    expect(onFoot).toMatchObject({ m: 3500, min: 45, waitMin: 0, transfers: 0 })
    expect(onFoot.legs[0]).toMatchObject({ mode: 'WALK', ride: false, headsign: null, stops: 0, steps: [] })
  })

  it('otpPlanToLegs: a GraphQL error throws; no ways is an empty list; the answer\'s data alone reads the same', () => {
    expect(() => otpPlanToLegs({ errors: [{ message: 'Unknown field' }] })).toThrow('OTP: Unknown field')
    expect(() => otpPlanToLegs(null)).toThrow('OTP: no plan in the answer')
    expect(otpPlanToLegs({ data: { plan: { itineraries: [] } } })).toEqual([])
    expect(otpPlanToLegs(OTP_PLAN.data)).toEqual(otpPlanToLegs(OTP_PLAN))
  })

  it('the planner entry exports them, and the planner fetches nothing and reads no environment', () => {
    for (const k of ['buildOtpPlanQuery', 'otpPlanToLegs', 'decodePolyline', 'OTP_PLAN_QUERY']) expect(k in entry, k).toBe(true)
    const root = resolve(__dirname, '..')
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) { if (f !== 'test') walk(p) } else if (p.endsWith('.ts')) files.push(p)
      }
    }
    walk(root)
    expect(files.length).toBeGreaterThan(5)
    for (const f of files) {
      const text = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')
      expect(text, f).not.toMatch(/\bfetch\s*\(|process\.env|XMLHttpRequest/)
    }
  })
})

// A line every ten minutes on a UTC clock, as OTP answers WALK + TRANSIT: under 400 m, on foot at
// 80 m a minute; further, two minutes' walk to the line, then the straight line times 1.3 at mPerMin.
// Leaving: the next ride after the walk; arriving by: the last ride that makes it. Each answer
// carries a worse way too, so the pick is tested.
function cityLine(log: TransitRequest[], mPerMin = 300) {
  const walk = 2 * 60000
  const every = 10 * 60000
  return async (req: TransitRequest): Promise<TransitItinerary[]> => {
    log.push(req)
    const m = meters(req.from, req.to) * 1.3
    const t = Date.parse(`${req.date}T${req.time}Z`)
    const line: [number, number][] = [[req.from.lon, req.from.lat], [req.to.lon, req.to.lat]]
    if (m < 400 * 1.3) {
      const foot = Math.round((m / 80) * 60000)
      const at = req.arriveBy ? t - foot : t
      return [{ m, min: foot / 60000, startTime: at, endTime: at + foot, walkM: m, waitMin: 0, transfers: 0, legs: [], geometry: line }]
    }
    const ride = Math.round((m / mPerMin) * 60000)
    const way = (board: number): TransitItinerary => ({
      m, min: (walk + ride) / 60000, startTime: board - walk, endTime: board + ride, walkM: 150, waitMin: 0, transfers: 0, legs: [], geometry: line,
    })
    if (!req.arriveBy) {
      const board = Math.ceil((t + walk) / every) * every
      return [way(board + every), way(board)]
    }
    const board = Math.floor((t - ride) / every) * every
    return [way(board - every), way(board)]
  }
}
const asked = (q: TransitRequest) => Date.parse(`${q.date}T${q.time}Z`)
const toSecond = (ms: number) => Math.floor(ms / 1000) * 1000 // a request names its time to the second
const toMinute = (ms: number) => Math.floor(ms / 60000) * 60000 // the record's clock counts whole minutes
const startOf = (c: { date: string; startAt: number }) => Date.parse(`${c.date}T00:00:00Z`) + c.startAt * 60000

describe('transit through solvePath: the host\'s router, leg by leg', () => {
  it('leave at: each leg leaves when the one before arrives and the stop\'s minute is up; the record runs on the rides\' times', async () => {
    const log: TransitRequest[] = []
    const base = caseReq(DEST40)
    const p = await solvePath({ ...base, mode: 'transit', when: { kind: 'leaveAt', tz: 'UTC', date: '2026-11-28', at: 600 } }, null, { transit: cityLine(log) })
    ok(p.record)
    const r = p.record
    expect([r.mode, r.totals.timing]).toEqual(['transit', 'route'])
    expect(r.stops.length).toBeGreaterThan(0)
    const rides = p.transit!
    expect(rides).toHaveLength(r.stops.length + 1)
    const last = log.slice(-rides.length)
    expect(last[0]).toMatchObject({ date: '2026-11-28', time: '10:00:00', arriveBy: false, tz: 'UTC', from: START })
    for (let i = 1; i < last.length; i++) expect(asked(last[i])).toBe(toSecond(rides[i - 1]!.endTime + base.dwellMin * 60000))
    const start = startOf(r.clock!)
    expect(start).toBe(toMinute(rides[0]!.startTime)) // it leaves on the minute its first ride says to
    r.stops.forEach((s, i) => expect(Math.abs(start + s.arriveMin * 60000 - rides[i]!.endTime)).toBeLessThanOrEqual(3000))
    expect(Math.abs(start + r.finish!.arriveMin * 60000 - rides.at(-1)!.endTime)).toBeLessThanOrEqual(3000)
  })

  it('arrive by: asked from the end back, each leg arriving by the time the next one leaves, less the stop\'s minute', async () => {
    const log: TransitRequest[] = []
    const base = caseReq(DEST40)
    const noon = Date.UTC(2026, 10, 28, 12, 0)
    const p = await solvePath({ ...base, mode: 'transit', when: { kind: 'arriveBy', tz: 'UTC', date: '2026-11-28', at: 720, now: Date.UTC(2026, 10, 28, 9, 0) } }, null, { transit: cityLine(log) })
    ok(p.record)
    const r = p.record
    const rides = p.transit!
    const last = log.slice(-rides.length)
    expect(last.every((q) => q.arriveBy)).toBe(true)
    expect(last[0]).toMatchObject({ time: '12:00:00', to: DEST })
    const start = startOf(r.clock!)
    expect(start).toBe(toMinute(rides[0]!.startTime))
    expect(start + r.finish!.arriveMin * 60000).toBeLessThanOrEqual(noon + 3000)
    r.stops.forEach((s, i) => expect(Math.abs(start + (s.arriveMin + base.dwellMin) * 60000 - rides[i + 1]!.startTime)).toBeLessThanOrEqual(3000))
  })

  it('open, arrive by, slow rides over the time: the record is timed on the line its rides were found for', async () => {
    for (const minutes of [20, 30, 45]) {
      const log: TransitRequest[] = []
      const base = { ...caseReq(OPEN30), minutes }
      const deadline = Date.UTC(2026, 10, 28, 12, 0)
      const p = await solvePath({ ...base, mode: 'transit', when: { kind: 'arriveBy', tz: 'UTC', date: '2026-11-28', at: 720, now: Date.UTC(2026, 10, 28, 9, 0) } }, null, { transit: cityLine(log, 60) })
      ok(p.record)
      const r = p.record
      expect(r.totals.timing, `${minutes}`).toBe('route')
      const rides = p.transit!
      expect(rides).toHaveLength(r.stops.length)
      const start = startOf(r.clock!)
      expect(start).toBe(toMinute(rides[0]!.startTime))
      const lastStop = r.stops[r.stops.length - 1]
      expect(Math.abs(start + lastStop.arriveMin * 60000 - rides.at(-1)!.endTime)).toBeLessThanOrEqual(3000)
      expect(start + lastStop.arriveMin * 60000).toBeLessThanOrEqual(deadline + 3000)
      r.stops.slice(0, -1).forEach((s, i) => expect(Math.abs(start + (s.arriveMin + base.dwellMin) * 60000 - rides[i + 1]!.startTime), `${minutes}: stop ${i + 1}`).toBeLessThanOrEqual(3000))
    }
  })

  it('through vias: no minute at a via, and the rides beside the record', async () => {
    const log: TransitRequest[] = []
    const p = await solvePath({ ...caseReq(LOOP45), mode: 'transit', candidates: [], vias: [V1], when: { kind: 'leaveAt', tz: 'UTC', date: '2026-11-28', at: 600 } }, null, { transit: cityLine(log) })
    ok(p.record)
    expect(p.transit).toHaveLength(2)
    expect(asked(log.at(-1)!)).toBe(toSecond(p.transit![0]!.endTime)) // it leaves the via as it arrives
    expect(p.vias![0].arriveMin).toBeCloseTo((p.transit![0]!.endTime - p.transit![0]!.startTime) / 60000, 1)
  })

  it('a router that fails or finds no way, or no time rule: the estimate stands, with why, and the clock stands on it', async () => {
    const q = quiet()
    try {
      const req = { ...caseReq(DEST40), mode: 'transit', when: { kind: 'leaveAt', tz: 'UTC', date: '2026-11-28', at: 600 } }
      const down = await solvePath(req, null, { transit: async () => { throw new Error('OTP 503') } })
      expect([down.record.totals.timing, down.timingError, down.transit]).toEqual(['estimate', 'OTP 503', null])
      expect(down.record.clock).toEqual({ tz: 'UTC', date: '2026-11-28', startAt: 600 })
      const none = await solvePath(req, null, { transit: async () => [] })
      expect(none.timingError).toMatch(/^transit: no way for leg 1 of \d+$/)
      const noWhen = await solvePath({ ...req, when: undefined }, null, { transit: cityLine([]) })
      expect(noWhen.timingError).toMatch(/needs a time rule/)
      expect(noWhen.record.clock).toBeNull()
      await expect(solvePath(req, null, { transit: 'otp' as any })).rejects.toThrow('opts.transit: a TransitRouter function')
    } finally {
      q.mockRestore()
    }
  })

  it('a router given for a walk is never asked', async () => {
    const router = vi.fn(cityLine([]))
    const p = await solvePath(caseReq(OPEN30), null, { transit: router })
    expect(router).not.toHaveBeenCalled()
    expect(Object.keys(p)).toEqual(['record', 'geometry', 'timingError'])
  })
})
