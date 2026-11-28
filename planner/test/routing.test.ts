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
import { LEAVE_GRACE_MIN, WhenError, epochOf, resolveWhen, wallOf } from '../path/when'
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
const UTC9 = Date.UTC(2026, 10, 28, 9, 0) // 9:00 AM UTC, the transit tests' now
const hh = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
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
    const p = await solvePath({ ...caseReq(DEST40), when: { kind: 'leaveAt', tz: NY, date: '2026-11-28', at: 615, now: NOW } }, streets(() => 1.2))
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
    const passed = await solvePath({ ...r, when: { kind: 'arriveBy', tz: NY, date: '2026-11-28', at: 8 * 60, now: NOW } }, null).catch((e) => e)
    expect(passed).toBeInstanceOf(WhenError)
    expect(passed).toBeInstanceOf(Error)
    expect([passed.message, passed.code, passed.earliestArrival]).toEqual(['when: arrive by 2026-11-28 08:00 has passed', 'passed', null])
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

  // Review of 117a817, fix 2: a time with no date is its next time on the place's clock
  it('a time with no date is its next time on the clock: an arrive by or a leave at past midnight is tomorrow\'s', async () => {
    const at2330 = epochOf('2026-11-27', 23 * 60 + 30, NY)
    const by = resolveWhen({ kind: 'arriveBy', tz: NY, at: 30, now: at2330 }, 30)
    expect([by.deadlineMs, by.minutes]).toEqual([epochOf('2026-11-28', 30, NY), 30])
    const p = await solvePath({ ...caseReq(OPEN30), when: { kind: 'arriveBy', tz: NY, at: 30, now: at2330 } }, null)
    ok(p.record)
    const last = p.record.stops[p.record.stops.length - 1]
    expect(p.record.clock).toEqual({ tz: NY, date: '2026-11-28', startAt: 30 - Math.ceil(last.arriveMin) })
    const at2350 = epochOf('2026-11-27', 23 * 60 + 50, NY)
    const leave = await solvePath({ ...caseReq(OPEN30), when: { kind: 'leaveAt', tz: NY, at: 15, now: at2350 } }, null)
    expect(leave.record.clock).toEqual({ tz: NY, date: '2026-11-28', startAt: 15 })
    // a time still to come today is today's
    const later = await solvePath({ ...caseReq(OPEN30), when: { kind: 'leaveAt', tz: NY, at: 23 * 60 + 55, now: at2350 } }, null)
    expect(later.record.clock).toEqual({ tz: NY, date: '2026-11-27', startAt: 23 * 60 + 55 })
  })

  it(`a leave at with no date that passed ${LEAVE_GRACE_MIN} minutes ago or less is leave now; before that, tomorrow's`, async () => {
    expect(LEAVE_GRACE_MIN).toBe(15)
    const at = (min: number) => epochOf('2026-11-28', min, NY)
    const p = await solvePath({ ...caseReq(OPEN30), when: { kind: 'leaveAt', tz: NY, at: 9 * 60, now: at(9 * 60 + 5) } }, null)
    expect(p.record.clock).toEqual({ tz: NY, date: '2026-11-28', startAt: 9 * 60 + 5 })
    expect(resolveWhen({ kind: 'leaveAt', tz: NY, at: 540, now: at(555) }, 30).startMs).toBe(at(555))
    expect(resolveWhen({ kind: 'leaveAt', tz: NY, at: 540, now: at(555) + 1000 }, 30).startMs).toBe(epochOf('2026-11-29', 540, NY))
  })

  it('a time with a date is that day\'s: a leave at that passed throws (within the grace, it is now); a later day stands', async () => {
    const r = caseReq(OPEN30)
    const err = await solvePath({ ...r, when: { kind: 'leaveAt', tz: NY, date: '2026-11-28', at: 8 * 60, now: NOW } }, null).catch((e) => e)
    expect(err).toBeInstanceOf(WhenError)
    expect([err.message, err.code]).toEqual(['when: leave at 2026-11-28 08:00 has passed', 'passed'])
    const grace = await solvePath({ ...r, when: { kind: 'leaveAt', tz: NY, date: '2026-11-28', at: 9 * 60 - 10, now: NOW } }, null)
    expect(grace.record.clock).toEqual({ tz: NY, date: '2026-11-28', startAt: 9 * 60 })
    const tomorrow = await solvePath({ ...r, when: { kind: 'leaveAt', tz: NY, date: '2026-11-29', at: 8 * 60, now: NOW } }, null)
    expect(tomorrow.record.clock).toEqual({ tz: NY, date: '2026-11-29', startAt: 8 * 60 })
  })

  it('rolling over a spring-forward night: tomorrow\'s time on the clock, not 24 hours on', () => {
    const now = epochOf('2026-03-07', 23 * 60 + 30, NY) // 04:30Z on the 8th
    const by = resolveWhen({ kind: 'arriveBy', tz: NY, at: 3 * 60, now }, null)
    expect(by.deadlineMs).toBe(Date.UTC(2026, 2, 8, 7, 0)) // 03:00 EDT, two and a half hours on
    expect(by.minutes).toBe(150)
    const leave = resolveWhen({ kind: 'leaveAt', tz: NY, at: 3 * 60, now }, null)
    expect(wallOf(leave.startMs, NY)).toEqual({ date: '2026-03-08', min: 180, sec: 0 })
  })

  // Review of 117a817, fix 1: an arrive by the plan cannot make throws, and says when it could arrive
  it('an arrive by the walk cannot make throws WhenError unmet, with its arrival leaving now (estimate and street timing)', async () => {
    for (const d of [() => null, () => streets(() => 1.2)]) {
      const asIs = (await solvePath({ ...caseReq(DEST40), minutes: 10 }, d())).record // the plan the rule makes
      expect(asIs.finish!.arriveMin).toBeGreaterThan(10)
      const err = await solvePath({ ...caseReq(DEST40), when: { kind: 'arriveBy', tz: NY, at: 9 * 60 + 10, now: NOW } }, d()).catch((e) => e)
      expect(err).toBeInstanceOf(WhenError)
      expect(err.code).toBe('unmet')
      const at = 9 * 60 + Math.ceil(asIs.finish!.arriveMin)
      expect(err.earliestArrival).toEqual({ ms: NOW + asIs.finish!.arriveMin * 60000, tz: NY, date: '2026-11-28', at })
      expect(err.message).toBe(`when: arrive by 2026-11-28 09:10 cannot be met: leaving now, the plan arrives 2026-11-28 ${hh(at)}`)
    }
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
const way = (q: TransitRequest, startTime: number, endTime: number): TransitItinerary => ({
  m: 300, min: (endTime - startTime) / 60000, startTime, endTime, walkM: 100, waitMin: 0, transfers: 0, legs: [], geometry: [[q.from.lon, q.from.lat], [q.to.lon, q.to.lat]],
})
// A router whose way takes 3 minutes, or 100 when slow says so. Arrive by: it arrives at the time
// asked. Leave: it leaves at the next :05, :15, :25 and so on. From call failFrom on, it fails.
function rideRouter(slow: (q: TransitRequest, arrive: number) => boolean, failFrom = Infinity) {
  let n = 0
  const router = async (q: TransitRequest): Promise<TransitItinerary[]> => {
    if (++n >= failFrom) throw new Error('OTP 503')
    const t = asked(q)
    if (q.arriveBy) return [way(q, t - (slow(q, t) ? 100 : 3) * 60000, t)]
    const s = Math.ceil((t - 5 * 60000) / 600000) * 600000 + 5 * 60000
    return [way(q, s, s + (slow(q, s + 3 * 60000) ? 100 : 3) * 60000)]
  }
  return Object.assign(router, { calls: () => n })
}

describe('transit through solvePath: the host\'s router, leg by leg', () => {
  it('leave at: each leg leaves when the one before arrives and the stop\'s minute is up; the record runs on the rides\' times', async () => {
    const log: TransitRequest[] = []
    const base = caseReq(DEST40)
    const p = await solvePath({ ...base, mode: 'transit', when: { kind: 'leaveAt', tz: 'UTC', date: '2026-11-28', at: 600, now: UTC9 } }, null, { transit: cityLine(log) })
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
    const p = await solvePath({ ...caseReq(LOOP45), mode: 'transit', candidates: [], vias: [V1], when: { kind: 'leaveAt', tz: 'UTC', date: '2026-11-28', at: 600, now: UTC9 } }, null, { transit: cityLine(log) })
    ok(p.record)
    expect(p.transit).toHaveLength(2)
    expect(asked(log.at(-1)!)).toBe(toSecond(p.transit![0]!.endTime)) // it leaves the via as it arrives
    expect(p.vias![0].arriveMin).toBeCloseTo((p.transit![0]!.endTime - p.transit![0]!.startTime) / 60000, 1)
  })

  it('a router that fails or finds no way, or no time rule: the estimate stands, with why, and the clock stands on it', async () => {
    const q = quiet()
    try {
      const req = { ...caseReq(DEST40), mode: 'transit', when: { kind: 'leaveAt', tz: 'UTC', date: '2026-11-28', at: 600, now: UTC9 } }
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

  // Review of 117a817, fix 1, by transit
  it('an arrive by no ride can make (its one way leaves before now): WhenError unmet, with the arrival leaving now', async () => {
    const at = (h: number, m = 0) => Date.UTC(2026, 10, 28, h, m)
    const router = async (q: TransitRequest) => (q.arriveBy ? [way(q, at(10, 50), at(11, 55))] : [way(q, asked(q) + 10 * 60000, asked(q) + 75 * 60000)])
    const req = { ...caseReq(DEST40), mode: 'transit', candidates: [], when: { kind: 'arriveBy', tz: 'UTC', date: '2026-11-28', at: 720, now: at(11) } }
    const err = await solvePath(req, null, { transit: router }).catch((e) => e)
    expect(err).toBeInstanceOf(WhenError)
    expect(err.code).toBe('unmet')
    expect(err.earliestArrival).toEqual({ ms: at(12, 15), tz: 'UTC', date: '2026-11-28', at: 12 * 60 + 15 })
    expect(err.message).toBe('when: arrive by 2026-11-28 12:00 cannot be met: leaving now, the plan arrives 2026-11-28 12:15')
    // no way leaving now: nothing to offer
    const none = await solvePath(req, null, { transit: async (q: TransitRequest) => (q.arriveBy ? router(q) : []) }).catch((e) => e)
    expect([none.code, none.earliestArrival, none.message]).toEqual(['unmet', null, 'when: arrive by 2026-11-28 12:00 cannot be met: the plan would leave before now'])
    // asked before that way leaves, it stands
    const fine = await solvePath({ ...req, when: { ...req.when, now: at(10, 30) } }, null, { transit: router })
    expect(fine.record.clock).toEqual({ tz: 'UTC', date: '2026-11-28', startAt: 10 * 60 + 50 })
  })

  // Review of 117a817, fixes 3 and 4: three cards in a line off the start, an open end, 30 minutes with
  // 5 at each stop. plan.ts's first timing keeps the first two cards (its timed stops), its cuts end on
  // fewer, and it asks again for those two cards' line.
  const A = { card: 'A', place: { id: 'a', lat: START.lat + 0.001, lon: START.lon } }
  const B = { card: 'B', place: { id: 'b', lat: START.lat + 0.002, lon: START.lon } }
  const C = { card: 'C', place: { id: 'c', lat: START.lat + 0.003, lon: START.lon } }
  const lineReq = (when: any) => ({ ...caseReq(OPEN30), mode: 'transit', minutes: 30, dwellMin: 5, candidates: [A, B, C], when })
  const at = (h: number, m = 0) => Date.UTC(2026, 10, 28, h, m)
  const lateSlow = (_q: TransitRequest, arrive: number) => arrive > at(11, 30) // the reviewer's: arriving after 11:30, 100 minutes
  const toCSlow = (q: TransitRequest) => q.to.lat === C.place.lat

  it('open, arrive by, asked again on a slower line: the time still holds, on the first timing\'s rides and start', async () => {
    const router = rideRouter(lateSlow)
    const p = await solvePath(lineReq({ kind: 'arriveBy', tz: 'UTC', date: '2026-11-28', at: 720, now: UTC9 }), null, { transit: router })
    expect(router.calls()).toBe(8) // 3, 2, 1 and 0 a round, then 2 asking again
    ok(p.record)
    const r = p.record
    expect([r.stops.map((s) => s.card), r.totals.timing]).toEqual([['A', 'B'], 'route'])
    expect(r.totals.totalMin).toBeLessThanOrEqual(30)
    expect(r.stops.map((s) => s.leg.min)).toEqual([3, 3])
    const rides = p.transit!
    expect(rides.map((t) => [t!.startTime, t!.endTime])).toEqual([[at(10, 4), at(10, 7)], [at(10, 12), at(10, 15)]])
    expect(r.clock).toEqual({ tz: 'UTC', date: '2026-11-28', startAt: 10 * 60 + 4 })
    r.stops.forEach((s, i) => expect(startOf(r.clock!) + s.arriveMin * 60000).toBe(rides[i]!.endTime))
  })

  it('the router failing when asked again: the record stands on the timing its stops came from, with its rides and its start', async () => {
    const cases = [
      { name: 'arrive by', when: { kind: 'arriveBy', tz: 'UTC', date: '2026-11-28', at: 720, now: UTC9 }, slow: lateSlow, rides: [[at(10, 4), at(10, 7)], [at(10, 12), at(10, 15)]], startAt: 604 },
      // leave at 10:00: each ride leaves at the next :05, so the line waits five minutes at its start
      { name: 'leave at', when: { kind: 'leaveAt', tz: 'UTC', date: '2026-11-28', at: 600, now: UTC9 }, slow: toCSlow, rides: [[at(10, 5), at(10, 8)], [at(10, 15), at(10, 18)]], startAt: 605 },
    ]
    for (const c of cases) {
      const whole = rideRouter(c.slow)
      const full = await solvePath(lineReq(c.when), null, { transit: whole })
      expect(whole.calls(), c.name).toBe(8) // the last two ask again for A and B's line
      const down = rideRouter(c.slow, 7)
      const p = await solvePath(lineReq(c.when), null, { transit: down })
      ok(p.record)
      const r = p.record
      expect([r.stops.map((s) => s.card), r.totals.timing], c.name).toEqual([['A', 'B'], 'route'])
      expect(r.totals.totalMin).toBeLessThanOrEqual(30)
      const rides = p.transit!
      expect(rides && rides.map((t) => [t!.startTime, t!.endTime]), c.name).toEqual(c.rides)
      expect(r.clock, c.name).toEqual({ tz: 'UTC', date: '2026-11-28', startAt: c.startAt })
      r.stops.forEach((s, i) => expect(startOf(r.clock!) + s.arriveMin * 60000, `${c.name}: stop ${i + 1}`).toBe(rides[i]!.endTime))
      expect(strip(r)).toEqual(strip(full.record)) // as when asking again worked
      expect(p.transit).toEqual(full.transit)
    }
  })
})
