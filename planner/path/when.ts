// The time rule a path is planned on (1.7.0): leave now, leave at a time, or arrive by one, on
// the place's own clock. The solved start goes in the record's clock { tz, date, startAt }; the
// rule itself stays planner input (kit CONTRACT.md section 8). Pure: the instant counted from is
// when.now when the host gives one, else the system clock, as madeAt already is.
import type { PlanClock } from '../../contract/record'

export type WhenKind = 'now' | 'leaveAt' | 'arriveBy'

export type PlanWhen =
  | { kind: 'now'; tz: string; now?: number }
  // at: minutes past midnight on tz's clock; date: YYYY-MM-DD there (left out: the next time at comes on that clock)
  | { kind: 'leaveAt' | 'arriveBy'; tz: string; at: number; date?: string; now?: number }

// A rule checked and read against the clock: when the walk leaves, or when it must arrive, in ms
export interface ResolvedWhen {
  kind: WhenKind
  tz: string
  nowMs: number            // the instant the rule was read at (when.now, else the system clock)
  startMs: number          // now and leaveAt: the leave time; arriveBy: now (the earliest it can leave)
  deadlineMs: number | null // arriveBy: the time to arrive by
  minutes: number | null   // the time allowed: as asked, and at most the minutes left before an arrive by
}

/** A leave at that fell this many minutes ago or less means now: 9:00 asked at 9:05 is leave now */
export const LEAVE_GRACE_MIN = 15

/** A time on tz's clock, as an instant and as the clock reads it */
export interface WhenTime {
  ms: number   // ms since 1970
  tz: string
  date: string // YYYY-MM-DD on tz's clock
  at: number   // whole minutes past midnight there, rounded up (an arrival is never shown early)
}

/**
 * Why a time rule cannot stand, so a host can tell the two apart: 'passed', a time with a date that
 * has passed (an arrive by; a leave at more than LEAVE_GRACE_MIN ago); 'unmet', an arrive by the plan
 * cannot make, leaving now. An unmet one carries earliestArrival, when it was found: leaving now, when
 * the plan reaches its end (its last stop with an open end), for a host to offer "leave now, arrive
 * HH:MM". The message names the field, as every other time-rule error does.
 */
export class WhenError extends Error {
  readonly code: 'passed' | 'unmet'
  readonly earliestArrival: WhenTime | null
  constructor(message: string, code: 'passed' | 'unmet', earliestArrival: WhenTime | null = null) {
    super(message)
    this.name = 'WhenError'
    this.code = code
    this.earliestArrival = earliestArrival
  }
}

const KINDS: WhenKind[] = ['now', 'leaveAt', 'arriveBy']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// One formatter a time zone, made on first use (core/clock.js's, with seconds)
const fmtByTz = new Map<string, Intl.DateTimeFormat>()
function fmtFor(tz: string): Intl.DateTimeFormat {
  let f = fmtByTz.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    })
    fmtByTz.set(tz, f)
  }
  return f
}

/** The wall clock in tz at an instant: the date, the whole minutes past midnight, the seconds */
export function wallOf(ms: number, tz: string): { date: string; min: number; sec: number } {
  const p = Object.fromEntries(fmtFor(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute, sec: +p.second }
}

/** The instant a wall clock in tz reads date and min (a minute a spring-forward skips lands an hour earlier: 02:30 reads 01:30) */
export function epochOf(date: string, min: number, tz: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const naive = Date.UTC(y, m - 1, d, 0, 0, 0) + min * 60000 // the wall clock read as UTC
  const offset = (t: number) => {
    const w = wallOf(t, tz)
    const [wy, wm, wd] = w.date.split('-').map(Number)
    return Date.UTC(wy, wm - 1, wd, 0, w.min, w.sec) - Math.floor(t / 1000) * 1000
  }
  const first = naive - offset(naive)
  return naive - offset(first) // once more, for a clock that moved between the two
}

/** The record's clock at an instant: tz, the date there and the minute past midnight (seconds dropped) */
export function clockAt(ms: number, tz: string): PlanClock {
  const w = wallOf(ms, tz)
  return { tz, date: w.date, startAt: w.min }
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`

// The calendar day after a YYYY-MM-DD
const nextDate = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** An instant as a WhenTime: tz's date, and the minute rounded up */
export function whenTime(ms: number, tz: string): WhenTime {
  const w = wallOf(Math.ceil(ms / 60000) * 60000, tz)
  return { ms, tz, date: w.date, at: w.min }
}

/** The error for an arrive by the plan cannot make; earliestMs: leaving now, when it reaches its end */
export function unmetError(when: ResolvedWhen, earliestMs: number | null): WhenError {
  const by = wallOf(when.deadlineMs as number, when.tz)
  const earliest = earliestMs === null ? null : whenTime(earliestMs, when.tz)
  const why = earliest ? `leaving now, the plan arrives ${earliest.date} ${hhmm(earliest.at)}` : 'the plan would leave before now'
  return new WhenError(`when: arrive by ${by.date} ${hhmm(by.min)} cannot be met: ${why}`, 'unmet', earliest)
}

/**
 * A time rule checked and read against the clock. Throws an Error naming the field for a rule it
 * cannot read, and a WhenError ('passed') for a time with a date that has passed. minutes is the
 * request's: an arrive by keeps it when it fits before the time and cuts it to the minutes left when
 * not (untimed: the minutes left).
 *
 * A time with no date is its next time on tz's clock: an arrive by that has passed today is
 * tomorrow's, as is a leave at that passed more than LEAVE_GRACE_MIN ago; one that passed within
 * LEAVE_GRACE_MIN means leave now. A time with a date is that day's: an arrive by that has passed
 * throws, a leave at within LEAVE_GRACE_MIN means now, and one before that throws.
 */
export function resolveWhen(when: PlanWhen, minutes: number | null): ResolvedWhen {
  const w = when as any
  if (!w || typeof w !== 'object') throw new Error("when: { kind: 'now' | 'leaveAt' | 'arriveBy', tz, at?, date? }")
  if (!KINDS.includes(w.kind)) throw new Error(`when.kind: 'now', 'leaveAt' or 'arriveBy', not '${w.kind}'`)
  if (typeof w.tz !== 'string' || !w.tz) throw new Error('when.tz: an IANA time zone, such as America/New_York')
  try { fmtFor(w.tz) } catch { throw new Error(`when.tz: '${w.tz}' is not an IANA time zone`) }
  if (w.now !== undefined && !Number.isFinite(w.now)) throw new Error('when.now: an instant in ms since 1970')
  const nowMs: number = w.now !== undefined ? w.now : Date.now()
  if (w.kind === 'now') return { kind: 'now', tz: w.tz, nowMs, startMs: nowMs, deadlineMs: null, minutes }

  if (!Number.isFinite(w.at) || w.at < 0 || w.at >= 24 * 60) throw new Error('when.at: minutes past midnight, 0 to 1439')
  if (w.date !== undefined && (typeof w.date !== 'string' || !DATE_RE.test(w.date))) throw new Error('when.date: YYYY-MM-DD')
  const dated = w.date !== undefined
  let date: string = dated ? w.date : wallOf(nowMs, w.tz).date
  let atMs = epochOf(date, w.at, w.tz)
  if (w.kind === 'leaveAt') {
    if (atMs < nowMs) {
      if (nowMs - atMs <= LEAVE_GRACE_MIN * 60000) return { kind: 'leaveAt', tz: w.tz, nowMs, startMs: nowMs, deadlineMs: null, minutes }
      if (dated) throw new WhenError(`when: leave at ${date} ${hhmm(w.at)} has passed`, 'passed')
      date = nextDate(date)
      atMs = epochOf(date, w.at, w.tz)
    }
    return { kind: 'leaveAt', tz: w.tz, nowMs, startMs: atMs, deadlineMs: null, minutes }
  }

  if (atMs <= nowMs) {
    if (dated) throw new WhenError(`when: arrive by ${date} ${hhmm(w.at)} has passed`, 'passed')
    date = nextDate(date)
    atMs = epochOf(date, w.at, w.tz)
  }
  const left = Math.floor((atMs - nowMs) / 60000)
  return { kind: 'arriveBy', tz: w.tz, nowMs, startMs: nowMs, deadlineMs: atMs, minutes: minutes === null ? left : Math.min(minutes, left) }
}
