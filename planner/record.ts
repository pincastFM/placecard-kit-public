// The record's logic: check a v2 record, raise a v1 record to v2 and lower it back, and carry a
// day between the day solver's shape and the record. Spec: kit CONTRACT.md.
import { PLAN_VERSION_2 } from '../contract/record'
import type { LatLon, LeftOver, PlanRecord, Stop } from '../contract/record'
import type { ItineraryRecord } from './path/types'
import type { Day, DayCore } from './day/day'
import type { DayRules } from './day/rules'

// ── Validation ──────────────────────────────────────────────────────────────────

const RECORD_KEYS = ['id', 'app', 'set', 'madeBy', 'madeAt', 'planVersion', 'solver', 'clock', 'start', 'end', 'mode', 'minutes', 'order', 'stops', 'finish', 'totals', 'leftOver', 'ext']
const STOP_KEYS = ['n', 'kind', 'card', 'place', 'leg', 'arriveMin', 'dwellMin', 'status', 'label', 'meal', 'fromHand', 'alts']
const TOTALS_KEYS = ['stops', 'm', 'walkMin', 'totalMin', 'timing', 'leftOver']

const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x)
const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x)
const nonNeg = (x: unknown) => num(x) && (x as number) >= 0
const str = (x: unknown) => typeof x === 'string' && x.length > 0
const strOrNull = (x: unknown) => x === null || typeof x === 'string'
const latLon = (x: unknown) => isObj(x) && num(x.lat) && num(x.lon) && Math.abs(x.lat) <= 90 && Math.abs(x.lon) <= 180
const leg = (x: unknown) => isObj(x) && nonNeg(x.m) && nonNeg(x.min)
const sameKeys = (x: Record<string, any>, keys: string[]) => {
  const have = Object.keys(x)
  return have.length === keys.length && keys.every((k) => k in x)
}

export interface Check {
  ok: boolean
  errors: string[]
}

/** Every rule a v2 record keeps; errors name the field. */
export function validateRecord(r: unknown): Check {
  const errors: string[] = []
  const bad = (what: string) => { errors.push(what) }
  if (!isObj(r)) return { ok: false, errors: ['not an object'] }
  if (!sameKeys(r, RECORD_KEYS)) bad(`keys: want ${RECORD_KEYS.join(',')}, have ${Object.keys(r).join(',')}`)
  if (r.planVersion !== PLAN_VERSION_2) bad('planVersion: not 2')
  for (const k of ['id', 'app', 'set'] as const) if (!str(r[k])) bad(`${k}: not a string`)
  if (!strOrNull(r.madeBy)) bad('madeBy: not a string or null')
  if (typeof r.madeAt !== 'string' || !Number.isFinite(Date.parse(r.madeAt))) bad('madeAt: not a time')
  const solver = isObj(r.solver) ? r.solver.id : undefined
  if (solver !== 'path' && solver !== 'day') bad('solver.id: not path or day')

  if (r.clock !== null) {
    const c = r.clock
    if (!isObj(c) || !str(c.tz) || typeof c.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.date) || !num(c.startAt) || c.startAt < 0 || c.startAt >= 24 * 60) bad('clock: not {tz, date, startAt}')
  }
  if (r.start !== null && !latLon(r.start)) bad('start: not {lat, lon} or null')
  if (solver === 'path' && r.start === null) bad('start: a path needs one')

  const end = r.end
  if (!isObj(end) || !['open', 'start', 'destination'].includes(end.kind)) bad('end.kind: not open, start or destination')
  else {
    if (end.at !== null && !latLon(end.at)) bad('end.at: not {lat, lon} or null')
    if (end.kind === 'destination' && end.at === null) bad('end.at: a destination needs a point')
    if (!strOrNull(end.name)) bad('end.name: not a string or null')
  }
  if (!['walk', 'bike'].includes(r.mode)) bad('mode: not walk or bike')
  if (r.minutes !== null && !nonNeg(r.minutes)) bad('minutes: not a number or null')
  if (!['planned', 'fixed', 'placed'].includes(r.order)) bad('order: not planned, fixed or placed')

  const stops: any[] = Array.isArray(r.stops) ? r.stops : []
  if (!Array.isArray(r.stops)) bad('stops: not a list')
  stops.forEach((s, i) => {
    const at = `stops[${i}]`
    if (!isObj(s)) return bad(`${at}: not an object`)
    if (!sameKeys(s, STOP_KEYS)) bad(`${at}: keys: want ${STOP_KEYS.join(',')}, have ${Object.keys(s).join(',')}`)
    if (s.n !== i + 1) bad(`${at}.n: not ${i + 1}`)
    if (!['see', 'eat', 'event'].includes(s.kind)) bad(`${at}.kind: not see, eat or event`)
    if (!str(s.card)) bad(`${at}.card: not a key`)
    if (s.place !== null && !(latLon(s.place) && str(s.place.id))) bad(`${at}.place: not {id, lat, lon} or null`)
    if (!leg(s.leg)) bad(`${at}.leg: not {m, min}`)
    if (!nonNeg(s.arriveMin)) bad(`${at}.arriveMin: not a number`)
    if (!nonNeg(s.dwellMin)) bad(`${at}.dwellMin: not a number`)
    if (!['planned', 'skipped', 'collected'].includes(s.status)) bad(`${at}.status: not planned, skipped or collected`)
    if (!strOrNull(s.label)) bad(`${at}.label: not a string or null`)
    if (!strOrNull(s.meal)) bad(`${at}.meal: not a string or null`)
    if (typeof s.fromHand !== 'boolean') bad(`${at}.fromHand: not true or false`)
    if (!Array.isArray(s.alts) || !s.alts.every(str)) bad(`${at}.alts: not a list of keys`)
    else if (s.alts.length && !s.alts.includes(s.card)) bad(`${at}.alts: leaves out the stop's own card`)
    if (i > 0 && isObj(stops[i - 1]) && s.arriveMin < stops[i - 1].arriveMin) bad(`${at}.arriveMin: before the stop before`)
    if (solver === 'path') {
      if (s.kind !== 'see') bad(`${at}.kind: a path stop is see`)
      if (s.place === null) bad(`${at}.place: a path stop needs one`)
    }
    if (solver === 'day') {
      const next = stops[i + 1]
      if (isObj(next) && s.arriveMin + s.dwellMin > next.arriveMin) bad(`${at}: runs into the stop after`)
      if (r.minutes !== null && s.arriveMin + s.dwellMin > r.minutes) bad(`${at}: runs past the time allowed`)
    }
  })

  if (r.finish !== null && !(isObj(r.finish) && leg(r.finish.leg) && nonNeg(r.finish.arriveMin))) bad('finish: not {leg, arriveMin} or null')
  if (r.finish !== null && isObj(end) && end.kind === 'open') bad('finish: an open end has none')

  const t = r.totals
  if (!isObj(t)) bad('totals: not an object')
  else {
    if (!sameKeys(t, TOTALS_KEYS)) bad(`totals: keys: want ${TOTALS_KEYS.join(',')}, have ${Object.keys(t).join(',')}`)
    if (t.stops !== stops.length) bad('totals.stops: not the number of stops')
    for (const k of ['m', 'walkMin', 'totalMin'] as const) if (!nonNeg(t[k])) bad(`totals.${k}: not a number`)
    if (!['mapbox', 'route', 'estimate'].includes(t.timing)) bad('totals.timing: not mapbox, route or estimate')
    if (!Number.isInteger(t.leftOver) || t.leftOver < 0) bad('totals.leftOver: not a count')
  }
  if (!Array.isArray(r.leftOver)) bad('leftOver: not a list')
  else r.leftOver.forEach((x: any, i: number) => {
    if (!isObj(x) || !str(x.key) || !['card', 'event'].includes(x.kind) || !str(x.reason)) bad(`leftOver[${i}]: not {key, kind, reason}`)
  })
  if (!isObj(r.ext)) bad('ext: not an object')
  return { ok: !errors.length, errors }
}

// ── v1 and back ─────────────────────────────────────────────────────────────────

const round1 = (x: number) => Math.round(x * 10) / 10

export interface UpgradeOptions {
  dwellMin?: number      // the set's dwell, when the caller knows it (v1 does not store it)
  leftOver?: LeftOver[]  // what the solver left out, when known (a fresh solve); [] for a stored v1
}

/** A v1 record (Treehopper's planVersion 1) as v2. Nothing is lost: toV1 gives it back. */
export function upgradeV1(v1: ItineraryRecord, opts: UpgradeOptions = {}): PlanRecord {
  if (v1.planVersion !== 1) throw new Error(`upgradeV1: planVersion ${v1.planVersion}, not 1`)
  const t = v1.totals
  const dwellMin = opts.dwellMin ?? (t.stops ? round1((t.totalMin - t.walkMin) / t.stops) : 0)
  return {
    id: v1.id,
    app: v1.app,
    set: v1.set,
    madeBy: v1.madeBy,
    madeAt: v1.madeAt,
    planVersion: 2,
    solver: { id: 'path' },
    clock: null,
    start: { ...v1.start },
    end: { kind: v1.end.kind, at: v1.end.at ? { ...v1.end.at } : null, name: v1.end.name },
    mode: v1.mode,
    minutes: v1.minutes,
    order: v1.order,
    stops: v1.stops.map((s) => ({
      n: s.n, kind: 'see', card: s.card, place: { ...s.place }, leg: { ...s.leg }, arriveMin: s.arriveMin, dwellMin,
      status: s.status, label: null, meal: null, fromHand: true, alts: [],
    })),
    finish: v1.finish ? { leg: { ...v1.finish.leg }, arriveMin: v1.finish.arriveMin } : null,
    totals: { stops: t.stops, m: t.m, walkMin: t.walkMin, totalMin: t.totalMin, timing: t.timing, leftOver: v1.leftOver },
    leftOver: (opts.leftOver || []).map((x) => ({ ...x })),
    ext: {},
  }
}

/** A path record as Treehopper's v1, for code that reads v1 (the game today). */
export function toV1(r: PlanRecord): ItineraryRecord {
  if (r.solver.id !== 'path') throw new Error(`toV1: a ${r.solver.id} record has no v1 form`)
  if (!r.start) throw new Error('toV1: a path record without a start')
  const t = r.totals
  return {
    id: r.id,
    app: r.app,
    set: r.set,
    madeBy: r.madeBy,
    madeAt: r.madeAt,
    planVersion: 1,
    start: { ...r.start },
    end: { kind: r.end.kind, at: r.end.at ? { ...r.end.at } : null, name: r.end.name },
    mode: r.mode,
    minutes: r.minutes,
    order: r.order,
    stops: r.stops.map((s) => {
      if (!s.place) throw new Error(`toV1: stop ${s.n} has no place`)
      return { n: s.n, card: s.card, place: { ...s.place }, leg: { ...s.leg }, arriveMin: s.arriveMin, status: s.status }
    }),
    finish: r.finish ? { leg: { ...r.finish.leg }, arriveMin: r.finish.arriveMin } : null,
    // v1 has no 'route': a walk the app's own router timed reads as street timed, 'mapbox'
    totals: { stops: t.stops, m: t.m, walkMin: t.walkMin, totalMin: t.totalMin, timing: t.timing === 'route' ? 'mapbox' : t.timing },
    leftOver: t.leftOver,
  }
}

// ── The day and back ────────────────────────────────────────────────────────────

export interface RecordMeta {
  id: string
  app: string
  set: string
  madeBy: string | null
  madeAt: string
}

const hasXY = (p: any) => !!p && p.lat != null && p.lng != null && Number.isFinite(+p.lat) && Number.isFinite(+p.lng)
// {lat, lng} in, the record's {lat, lon} out (the day side's coordinates stop at this boundary)
const toLatLon = (p: any): LatLon => ({ lat: +p.lat, lon: +p.lng })

/** The day solver's full result (dayCore) as a v2 record. */
export function fromDay(core: DayCore, meta: RecordMeta): PlanRecord {
  const startAt = core.win ? core.win.start : 0
  const stops: Stop[] = core.slots.map((s, i) => ({
    n: i + 1,
    kind: s.kind,
    card: s.key,
    place: hasXY(s.place) ? { id: s.key, ...toLatLon(s.place) } : null,
    leg: { m: Math.round(s.m), min: s.walkMin },
    arriveMin: s.at - startAt,
    dwellMin: s.dur,
    status: 'planned',
    label: s.label,
    meal: s.meal,
    fromHand: s.fromHand,
    alts: [...s.alts],
  }))
  const last = core.slots[core.slots.length - 1]
  return {
    id: meta.id,
    app: meta.app,
    set: meta.set,
    madeBy: meta.madeBy,
    madeAt: meta.madeAt,
    planVersion: 2,
    solver: { id: 'day' },
    clock: core.win ? { tz: core.tz, date: core.win.date, startAt } : null,
    start: hasXY(core.center) ? toLatLon(core.center) : null,
    end: { kind: 'open', at: null, name: null },
    mode: 'walk',
    minutes: core.win && core.end !== null ? core.end - startAt : null,
    order: 'planned',
    stops,
    finish: null,
    totals: {
      stops: stops.length,
      m: core.totals.m,
      walkMin: core.totals.walkMin,
      totalMin: last ? last.at + last.dur - startAt : 0,
      timing: 'estimate',
      leftOver: core.leftOver.length,
    },
    leftOver: core.leftOver.map((x) => ({ ...x })),
    ext: {},
  }
}

/** A day record in the day solver's shape (handToDay's), its clock strings from the rules. */
export function toDay(r: PlanRecord, rules: Pick<DayRules, 'clock'>): Day {
  if (r.solver.id !== 'day') throw new Error(`toDay: a ${r.solver.id} record is not a day`)
  const startAt = r.clock ? r.clock.startAt : 0
  return {
    slots: r.stops.map((s) => {
      const at = startAt + s.arriveMin
      return {
        kind: s.kind, key: s.card, at, dur: s.dwellMin, label: s.label ?? '', meal: s.meal, fromHand: s.fromHand,
        suggested: !s.fromHand, alts: [...s.alts], idx: s.alts.indexOf(s.card), clock: rules.clock(at), walkMin: s.leg.min,
      }
    }),
    leftOver: r.leftOver.map((x) => ({ ...x })),
    totals: { stops: r.totals.stops, walkMin: r.totals.walkMin, m: r.totals.m },
  }
}
