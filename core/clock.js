// The zone's clock. Copied from NYID's llZoneDeal.js (clock, wall, addDays and dayLabel), so an
// instance's window and day read the time without an app import. wall takes the time zone every
// call; the app names it once in its day rules (rules.tz).

/**
 * A time of day from minutes after midnight: 450 is '7:30 AM', 1260 is '9:00 PM'. Copied from
 * NYID's llZoneDeal.js, the one VeryThere import dayMap.js and TtDay.vue had.
 */
export function clock(min) {
  const h = Math.floor(min / 60) % 24, m = min % 60
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// One formatter a time zone, made on first use
const fmtByTz = new Map()
function fmtFor(tz) {
  let f = fmtByTz.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    })
    fmtByTz.set(tz, f)
  }
  return f
}

/**
 * The wall clock in a time zone at an instant: `{ date: 'YYYY-MM-DD', min, weekday: 'Sat', day }`,
 * min being minutes past midnight there. tz is an IANA name and required ('America/Denver').
 */
export function wall(ms, tz) {
  if (typeof tz !== 'string' || !tz) throw new TypeError('wall(ms, tz): tz is required, an IANA time zone such as America/Denver')
  const p = Object.fromEntries(fmtFor(tz).formatToParts(new Date(ms)).map(x => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + (+p.minute), weekday: p.weekday, day: +p.day }
}

/** A calendar date n days on (n may be negative): addDays('2026-12-31', 1) is '2027-01-01'. */
export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** A date as the day sheet names it from today: 'Today', 'Tomorrow', else 'Mon 2'. */
export function dayLabel(date, today) {
  if (date === today) return 'Today'
  if (date === addDays(today, 1)) return 'Tomorrow'
  const [y, m, d] = date.split('-').map(Number)
  const wd = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  return `${wd} ${d}`
}
