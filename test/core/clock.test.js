// The zone's clock (core/clock.js): clock, and wall, addDays and dayLabel copied from NYID's
// llZoneDeal.js. Known instants, Denver's two DST edges in 2026, another zone, and a
// missing tz.
import { describe, it, expect } from 'vitest'
import { clock, wall, addDays, dayLabel } from '../../core/clock.js'
import * as core from '../../core/index.js'

const at = s => Date.parse(s)
const DEN = 'America/Denver'

describe('clock', () => {
  it('reads minutes past midnight on a 12-hour clock', () => {
    expect(clock(0)).toBe('12:00 AM')
    expect(clock(450)).toBe('7:30 AM')
    expect(clock(720)).toBe('12:00 PM')
    expect(clock(1260)).toBe('9:00 PM')
    expect(clock(1439)).toBe('11:59 PM')
  })
})

describe('wall', () => {
  it('gives the date, minutes, weekday and day in the zone', () => {
    expect(wall(at('2026-10-28T16:00:00Z'), DEN)).toEqual({ date: '2026-10-28', min: 600, weekday: 'Wed', day: 28 })
    expect(wall(at('2026-10-28T16:00:00Z'), 'UTC')).toEqual({ date: '2026-10-28', min: 960, weekday: 'Wed', day: 28 })
    expect(wall(at('2026-10-28T16:00:00Z'), 'Asia/Tokyo')).toEqual({ date: '2026-10-29', min: 60, weekday: 'Thu', day: 29 })
  })

  it('turns the date at the zone\'s midnight, not UTC\'s', () => {
    expect(wall(at('2026-10-31T05:59:00Z'), DEN)).toEqual({ date: '2026-10-30', min: 23 * 60 + 59, weekday: 'Fri', day: 30 })
    expect(wall(at('2026-10-31T06:00:00Z'), DEN)).toEqual({ date: '2026-10-31', min: 0, weekday: 'Sat', day: 31 })
  })

  it('springs forward in Denver on 2026-03-08: 1:59 AM, then 3:00 AM', () => {
    expect(wall(at('2026-03-08T08:59:00Z'), DEN)).toMatchObject({ date: '2026-03-08', min: 60 + 59, weekday: 'Sun' })
    expect(wall(at('2026-03-08T09:00:00Z'), DEN)).toMatchObject({ date: '2026-03-08', min: 3 * 60 })
    expect(wall(at('2026-03-08T18:00:00Z'), DEN)).toMatchObject({ min: 12 * 60 })
  })

  it('falls back in Denver on 2026-11-01: 1:30 AM twice, an hour apart', () => {
    expect(wall(at('2026-11-01T07:30:00Z'), DEN)).toMatchObject({ date: '2026-11-01', min: 90, weekday: 'Sun' })
    expect(wall(at('2026-11-01T08:30:00Z'), DEN)).toMatchObject({ date: '2026-11-01', min: 90 })
    expect(wall(at('2026-11-01T19:00:00Z'), DEN)).toMatchObject({ min: 12 * 60 })
    expect(wall(at('2026-11-02T06:59:00Z'), DEN)).toMatchObject({ date: '2026-11-01', min: 23 * 60 + 59 })
    expect(wall(at('2026-11-02T07:00:00Z'), DEN)).toMatchObject({ date: '2026-11-02', min: 0, weekday: 'Mon' })
  })

  it('asks for the zone', () => {
    expect(() => wall(0)).toThrow(/tz is required/)
    expect(() => wall(0, '')).toThrow(/tz is required/)
  })
})

describe('addDays', () => {
  it('moves across months, years and a leap day, both ways', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-11-01', 0)).toBe('2026-11-01')
  })
})

describe('dayLabel', () => {
  it('says Today, Tomorrow, else the weekday and the day', () => {
    expect(dayLabel('2026-10-31', '2026-10-31')).toBe('Today')
    expect(dayLabel('2026-11-01', '2026-10-31')).toBe('Tomorrow')
    expect(dayLabel('2026-11-02', '2026-10-31')).toBe('Mon 2')
    expect(dayLabel('2026-10-30', '2026-10-31')).toBe('Fri 30')
  })
})

describe('core index', () => {
  it('exports the clock', () => {
    expect(core.clock).toBe(clock)
    expect(core.wall).toBe(wall)
    expect(core.addDays).toBe(addDays)
    expect(core.dayLabel).toBe(dayLabel)
  })
})
