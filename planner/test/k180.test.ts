// 1.8.0's planner additions: the clock helpers on the public planner entry, and buildOtpPlanQuery's walkSpeed
// (left out, the query and its variables are 1.7.0's byte for byte: the fingerprints below were taken on the kit
// at 1.7.0, 84c2ede, from these same requests).
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import * as planner from '../index'
import { OTP_PLAN_QUERY, OTP_PLAN_QUERY_WALK_SPEED, buildOtpPlanQuery } from '../path/transit'
import { clockAt as clockAtOwn, epochOf as epochOfOwn, wallOf as wallOfOwn } from '../path/when'
import type { TransitRequest } from '../path/transit'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const NY = 'America/New_York'
const REQ: TransitRequest = { from: { lat: 40.7359, lon: -73.9911 }, to: { lat: 40.758, lon: -73.9855 }, date: '2026-11-28', time: '10:00', arriveBy: true, tz: NY }

describe('the clock helpers on the planner entry', () => {
  it('wallOf, epochOf and clockAt are the planner\'s own', () => {
    expect(planner.wallOf).toBe(wallOfOwn)
    expect(planner.epochOf).toBe(epochOfOwn)
    expect(planner.clockAt).toBe(clockAtOwn)
  })

  it('a wall clock and back, across the autumn change; clockAt drops the seconds', () => {
    const ms = Date.UTC(2026, 10, 28, 19, 40, 30) // 2:40:30 PM in New York (EST)
    expect(planner.wallOf(ms, NY)).toEqual({ date: '2026-11-28', min: 880, sec: 30 })
    expect(planner.epochOf('2026-11-28', 880, NY)).toBe(Date.UTC(2026, 10, 28, 19, 40))
    expect(planner.clockAt(ms, NY)).toEqual({ tz: NY, date: '2026-11-28', startAt: 880 })
    expect(planner.epochOf('2026-07-04', 600, NY)).toBe(Date.UTC(2026, 6, 4, 14, 0)) // 10:00 AM EDT
    expect(planner.wallOf(Date.UTC(2026, 6, 4, 14, 0), 'America/Los_Angeles')).toEqual({ date: '2026-07-04', min: 420, sec: 0 })
  })
})

describe('buildOtpPlanQuery: walkSpeed', () => {
  it('left out: 1.7.0\'s query and variables, byte for byte', () => {
    expect(sha(OTP_PLAN_QUERY)).toBe('d71c9a719c5f357a03a4e0a71d511a8a302b8f18f2ef094f8b33cb182cf2601b')
    expect(buildOtpPlanQuery(REQ).query).toBe(OTP_PLAN_QUERY)
    expect(sha(JSON.stringify(buildOtpPlanQuery(REQ)))).toBe('0ba95d1673df02249c979e49bdf3fc2333288f8eb723992730cbfe964c58569b')
    expect(sha(JSON.stringify(buildOtpPlanQuery({ ...REQ, time: '10:00:30', numItineraries: 5, arriveBy: false }))))
      .toBe('f0ab936772946a1f4ee0b969a4d3853407b8831dd9c8eb8d7dfe9cfaadf412db')
    expect('walkSpeed' in buildOtpPlanQuery(REQ).variables).toBe(false)
  })

  it('given: the same query with the walk\'s speed declared and passed, and nothing else changed', () => {
    const q = buildOtpPlanQuery({ ...REQ, walkSpeed: 0.67 })
    expect(q.query).toBe(OTP_PLAN_QUERY_WALK_SPEED)
    expect(q.variables).toEqual({ ...buildOtpPlanQuery(REQ).variables, walkSpeed: 0.67 })
    expect(q.query).toContain('$numItineraries: Int!, $walkSpeed: Float!) {')
    expect(q.query).toContain('    numItineraries: $numItineraries\n    walkSpeed: $walkSpeed\n')
    expect(q.query.replace(', $walkSpeed: Float!', '').replace('    walkSpeed: $walkSpeed\n', '')).toBe(OTP_PLAN_QUERY)
    const declared = [...q.query.slice(0, q.query.indexOf(')')).matchAll(/\$(\w+):/g)].map((m) => m[1]).sort()
    expect(declared).toEqual(Object.keys(q.variables).sort())
  })

  it('a walkSpeed that is not a speed joins the one TypeError', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '1.3', null]) {
      expect(() => buildOtpPlanQuery({ ...REQ, walkSpeed: bad } as any)).toThrow('walkSpeed: m/s, above 0')
    }
    expect(() => buildOtpPlanQuery({ ...REQ, date: 'x', walkSpeed: 0 }))
      .toThrow(new TypeError('buildOtpPlanQuery: date: not YYYY-MM-DD; walkSpeed: m/s, above 0'))
  })
})
