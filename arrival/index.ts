// Arrival: has the player reached the place? One mechanism for every Placecard app, each app's rule
// passed in as config (kit CONTRACT.md, "arrival"). Observe only: every function here
// returns a verdict and none refuses, throws, stores or fetches anything; what a verdict does (raise a card,
// light Collect, record a server's confirmation) stays the app's. Server-safe: no Vue, no mapbox, no DOM.
//
// The rules as the apps hold them today, each passed in by its app:
// - Placecard's collect rule: `placecardRule(card.trigger_m)` (below). The distance less the
//   smaller of the fix's accuracy and 25 m is within the card's trigger (20 to 150 m, default 40).
// - Treehopper: `{ reachM: 8, accuracy: { kind: 'require', maxM: 15 }, holdM: 15 }`.
//   Found inside 8 m on a fix of 15 m or better; Collect holds to 15 m once found.
// - VeryThere's card walk: `{ reachM: 16, accuracy: { kind: 'hold', sureM: 25 } }` through `arrivalStep`.
//   A fix worse than 25 m inside 16 m is held until a sure fix or a short dwell. "I'm here" is
//   `{ reachM: 60, accuracy: { kind: 'widen', padM: 25 } }`.
export { CONTRACT_VERSION } from '../contract/record'

// A position as the kit reads it: degrees, and the fix's accuracy in meters (null when it has none)
export interface Fix {
  lat: number
  lng: number
  accuracy: number | null
}

// What a fix's accuracy does to the reach
export type ArrivalAccuracy =
  // a worse fix reaches farther, by its accuracy up to capM; no accuracy, no allowance (Placecard's rule)
  | { kind: 'allowance'; capM: number }
  // inside the reach counts only on a fix of maxM or better; worse, or no accuracy, is 'poor' (Treehopper)
  | { kind: 'require'; maxM: number }
  // inside the reach on a fix worse than sureM is 'poor' alone; arrivalStep holds it until a sure fix or a
  // dwell of the recent fixes' middle (VeryThere). No accuracy counts as sure (a demo or simulated walk)
  | ({ kind: 'hold'; sureM: number } & Partial<ArrivalHoldTimes>)
  // the reach grows to the fix's accuracy plus padM when that is farther (VeryThere's "I'm here")
  | { kind: 'widen'; padM: number }
  // the distance alone
  | { kind: 'ignore' }

export interface ArrivalRule {
  reachM: number
  accuracy?: ArrivalAccuracy // default { kind: 'ignore' }
  holdM?: number // once arrived, the distance the arrival holds to (holdArrival); default reachM
}

// The hold's numbers (arrivalStep under a 'hold' rule); each defaults to VeryThere's
export interface ArrivalHoldTimes {
  windowMs: number // the recent fixes the middle is taken over
  maxFixes: number // at most this many of them
  minFixes: number // and at least this many before the middle counts
  dwell: number // this many fixes in a row with the middle inside the reach arrive
  carryMs: number // a position with no accuracy this soon after a real fix is that fix passed on again
}

export const ARRIVAL_HOLD: Readonly<ArrivalHoldTimes & { cueMs: number }> = Object.freeze({
  windowMs: 20000,
  maxFixes: 12,
  minFixes: 6,
  dwell: 5,
  carryMs: 30000,
  cueMs: 8000, // arrivalHeld: the held cue stays this long after the last held fix
})

// in: arrived. poor: inside the reach on a fix the rule does not trust. out: not arrived, or no distance
export type ArrivalVerdict = 'in' | 'poor' | 'out'

export interface ArrivalCheck {
  verdict: ArrivalVerdict
  reachM: number
  allowanceM: number // the meters the fix's accuracy added to the reach (allowance and widen; else 0)
}

const IGNORE: ArrivalAccuracy = { kind: 'ignore' }
const HOLD_KEYS = ['windowMs', 'maxFixes', 'minFixes', 'dwell', 'carryMs'] as const

// A 'hold' rule's numbers, VeryThere's for each one the rule leaves out
function holdTimes(a: Partial<ArrivalHoldTimes>): ArrivalHoldTimes {
  const H = { ...ARRIVAL_HOLD } as ArrivalHoldTimes & { cueMs?: number }
  for (const k of HOLD_KEYS) if (a[k] != null) H[k] = a[k] as number
  delete H.cueMs
  return H
}

const R_EARTH = 6371008.8
const RAD = Math.PI / 180

// A number from a number or a numeric string; null, undefined and '' are none (NaN)
const num = (v: unknown): number => (v == null || v === '' ? NaN : Number(v))

// A distance in meters: finite and 0 or more, else NaN (no distance)
function distanceOf(v: unknown): number {
  const d = num(v)
  return Number.isFinite(d) && d >= 0 ? d : NaN
}

// An accuracy in meters: finite and 0 or more, else null (the fix has none)
export function accuracyOf(v: unknown): number | null {
  const a = num(v)
  return Number.isFinite(a) && a >= 0 ? a : null
}

const lngOf = (p: any): unknown => (p?.lng ?? p?.lon)

/**
 * A fix from what a host has: GeolocationCoordinates or `{ latitude, longitude, accuracy }`, or
 * `{ lat, lng | lon, accuracy }` (a request body, a place). Null for a position it cannot read: not finite (vueuse's
 * first coords carry latitude Infinity) or out of range. The accuracy is null when missing, not finite or negative.
 */
export function fixOf(c: unknown): Fix | null {
  if (!c || typeof c !== 'object') return null
  const o = c as any
  const lat = num(o.latitude ?? o.lat)
  const lng = num(o.longitude ?? lngOf(o))
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng, accuracy: accuracyOf(o.accuracy) }
}

/**
 * Meters between two `{ lat, lng | lon }` points: equirectangular on the mean earth radius, exact enough under a mile
 * (VeryThere's llMetres, the formula its hold was tuned on). The planner's `meters` (flat earth, the ellipsoid's two
 * degree lengths) differs by under 0.6 percent; an app that measures with PostGIS passes its own distance to
 * checkArrival.
 */
export function arrivalMeters(a: any, b: any): number {
  const x = (Number(lngOf(b)) - Number(lngOf(a))) * RAD * Math.cos(((Number(a?.lat) + Number(b?.lat)) / 2) * RAD)
  const y = (Number(b?.lat) - Number(a?.lat)) * RAD
  return Math.hypot(x, y) * R_EARTH
}

/**
 * One reading against a rule. `distanceM` is the distance to the place in meters and `accuracyM` the fix's accuracy;
 * either may be a numeric string. No distance (missing, not finite, negative) is 'out'. Each kind compares as its app
 * does today: allowance `d - allowance <= reach`, widen `d <= max(reach, accuracy + pad)`, the others `d <= reach`.
 */
export function checkArrival(
  reading: { distanceM?: unknown; accuracyM?: unknown } | null | undefined,
  rule: ArrivalRule,
): ArrivalCheck {
  const d = distanceOf(reading?.distanceM)
  const acc = accuracyOf(reading?.accuracyM)
  const reachM = num(rule?.reachM)
  const a = rule?.accuracy ?? IGNORE
  const has = !Number.isNaN(d)
  if (a.kind === 'allowance') {
    const allowanceM = acc != null && acc > 0 ? Math.min(acc, a.capM) : 0
    return { verdict: has && d - allowanceM <= reachM ? 'in' : 'out', reachM, allowanceM }
  }
  if (a.kind === 'widen') {
    const radius = Math.max(reachM, (acc != null && acc > 0 ? acc : 0) + a.padM)
    return { verdict: has && d <= radius ? 'in' : 'out', reachM, allowanceM: radius - reachM }
  }
  if (!has || !(d <= reachM)) return { verdict: 'out', reachM, allowanceM: 0 }
  if (a.kind === 'require') return { verdict: acc != null && acc <= a.maxM ? 'in' : 'poor', reachM, allowanceM: 0 }
  if (a.kind === 'hold') return { verdict: acc == null || acc <= a.sureM ? 'in' : 'poor', reachM, allowanceM: 0 }
  return { verdict: 'in', reachM, allowanceM: 0 }
}

// What a server records when it confirms a collect: the verdict and what it was read from. 'unknown': no position
export interface ArrivalObservation {
  verdict: ArrivalVerdict | 'unknown'
  distanceM: number | null
  accuracyM: number | null
  reachM: number
  allowanceM: number
}

/**
 * A position against a place, for the record: the server's confirmation of a collect, observe only (it never
 * refuses; enforcing a verdict is a later call, his). `position` and `place` as fixOf reads them; a place's own
 * accuracy is ignored. A missing or unreadable position or place is 'unknown'.
 */
export function observeArrival(position: unknown, place: unknown, rule: ArrivalRule): ArrivalObservation {
  const f = fixOf(position)
  const p = fixOf(place)
  if (!f || !p) return { verdict: 'unknown', distanceM: null, accuracyM: f ? f.accuracy : null, reachM: num(rule?.reachM), allowanceM: 0 }
  const distanceM = arrivalMeters(f, p)
  return { ...checkArrival({ distanceM, accuracyM: f.accuracy }, rule), distanceM, accuracyM: f.accuracy }
}

export type ArrivalHold = 'held' | 'walkedOff' | 'none'

/**
 * After an arrival: 'held' while the player stays within the rule's holdM (default its reach), so GPS drift does not
 * take the arrival away; 'walkedOff' past it; 'none' before any arrival or with no distance. Treehopper's
 * `collectable` is 'held', its `walkedOff` is 'walkedOff' (never collect from there).
 */
export function holdArrival(arrivedOnce: boolean, distanceM: unknown, rule: ArrivalRule): ArrivalHold {
  const d = distanceOf(distanceM)
  if (!arrivedOnce || Number.isNaN(d)) return 'none'
  const holdM = Number.isFinite(rule?.holdM) ? Number(rule.holdM) : num(rule?.reachM)
  return d <= holdM ? 'held' : 'walkedOff'
}

// arrivalStep's state for one place; a host keeps it and hands it back with the next fix
export interface ArrivalState {
  key: unknown
  fixes: { lat: number; lng: number; w: number; t: number }[]
  inside: number
  heldAt: number | null
  verdict: ArrivalStepVerdict
  lastAcc: number | null
  lastAccAt: number | null
}

// fire: arrived now. hold: inside the reach on a fix the rule does not trust yet. none: not arrived
export type ArrivalStepVerdict = 'fire' | 'hold' | 'none'

/** A fresh state for a place (`key`: anything that changes per place, its id); the last real fix carries over. */
export function arrivalFresh(key: unknown = null, from: Partial<ArrivalState> | null = null): ArrivalState {
  return { key, fixes: [], inside: 0, heldAt: null, verdict: 'none', lastAcc: from?.lastAcc ?? null, lastAccAt: from?.lastAccAt ?? null }
}

/**
 * One fix toward a place, for a page that follows the player (VeryThere's llArrivalStep, with its numbers as the
 * rule). `prev` is the last call's state (or null), `fix` is `{ lat, lng | lon, accuracy?, t? }` (t in ms, default
 * now), `place` is `{ lat, lng | lon, key }`; a new key starts afresh. Returns `{ state, verdict }`.
 *
 * Under a 'hold' rule: a sure fix (accuracy sureM or better, or none) fires inside the reach at once. A weak fix
 * inside the reach is held, and the place fires when a sure fix comes in or when the middle of the recent fixes
 * (their average, sure ones weighing more) has stayed inside the reach for `dwell` fixes. A position with no accuracy
 * within carryMs of a real fix is that fix passed on again (a map camera does it): it keeps the last verdict.
 * Under any other rule each fix stands alone: checkArrival's 'in' fires, 'poor' holds, 'out' is none.
 */
export function arrivalStep(
  prev: ArrivalState | null | undefined,
  fix: any,
  place: any,
  rule: ArrivalRule,
): { state: ArrivalState; verdict: ArrivalStepVerdict } {
  const key = place?.key ?? null
  const state = prev && prev.key === key ? prev : arrivalFresh(key, prev)
  const lat = num(fix?.lat), lng = num(lngOf(fix)), slat = num(place?.lat), slng = num(lngOf(place))
  if (![lat, lng, slat, slng].every(Number.isFinite)) return { state, verdict: 'none' }
  const t = Number.isFinite(num(fix.t)) ? num(fix.t) : Date.now()
  const own = accuracyOf(fix.accuracy)
  const reachM = num(rule?.reachM)
  const a = rule?.accuracy ?? IGNORE
  const d = () => arrivalMeters({ lat, lng }, { lat: slat, lng: slng })

  if (a.kind !== 'hold') {
    const c = checkArrival({ distanceM: d(), accuracyM: own }, rule).verdict
    const verdict: ArrivalStepVerdict = c === 'in' ? 'fire' : c === 'poor' ? 'hold' : 'none'
    const heldAt = verdict === 'hold' ? t : verdict === 'fire' ? null : state.heldAt
    return {
      state: { key, fixes: [], inside: 0, heldAt, verdict, lastAcc: own ?? state.lastAcc, lastAccAt: own != null ? t : state.lastAccAt },
      verdict,
    }
  }

  const H = holdTimes(a)
  const fresh = state.lastAcc != null && Number.isFinite(state.lastAcc) && t - num(state.lastAccAt) < H.carryMs
  if (own == null && fresh) return { state, verdict: state.verdict || 'none' }
  const lastAcc = own != null ? own : state.lastAcc
  const lastAccAt = own != null ? t : state.lastAccAt
  const dist = d()
  const sure = own == null || own <= a.sureM

  const fixes = state.fixes.filter((f) => t - f.t < H.windowMs && f.t <= t)
  fixes.push({ lat, lng, w: 1 / Math.max(5, own != null ? own : 5) ** 2, t })
  while (fixes.length > H.maxFixes) fixes.shift()

  if (sure) {
    const verdict: ArrivalStepVerdict = dist <= reachM ? 'fire' : 'none'
    return { state: { key, fixes, inside: 0, heldAt: verdict === 'fire' ? null : state.heldAt, verdict, lastAcc, lastAccAt }, verdict }
  }

  let inside = 0
  if (fixes.length >= H.minFixes) {
    let W = 0, la = 0, ln = 0
    for (const f of fixes) { W += f.w; la += f.lat * f.w; ln += f.lng * f.w }
    if (arrivalMeters({ lat: la / W, lng: ln / W }, { lat: slat, lng: slng }) <= reachM) inside = state.inside + 1
  }
  if (inside >= H.dwell) return { state: { key, fixes, inside, heldAt: null, verdict: 'fire', lastAcc, lastAccAt }, verdict: 'fire' }
  const held = dist <= reachM || inside > 0
  const verdict: ArrivalStepVerdict = held ? 'hold' : 'none'
  return { state: { key, fixes, inside, heldAt: held ? t : state.heldAt, verdict, lastAcc, lastAccAt }, verdict }
}

/** True while a held cue should show: a held fix within the last cueMs (default ARRIVAL_HOLD.cueMs). */
export function arrivalHeld(state: ArrivalState | null | undefined, now: number = Date.now(), cueMs: number = ARRIVAL_HOLD.cueMs): boolean {
  return !!(state && state.heldAt != null && now - state.heldAt < cueMs)
}

const nonNeg = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const count = (v: unknown, min: number) => Number.isInteger(v) && (v as number) >= min

/** What is wrong with a rule, as a list (empty: none). For a host's config check and tests; nothing here throws. */
export function arrivalRuleErrors(rule: unknown): string[] {
  if (!rule || typeof rule !== 'object') return ['rule: an object']
  const r = rule as any
  const out: string[] = []
  if (!nonNeg(r.reachM)) out.push('reachM: meters, 0 or more')
  if (r.holdM !== undefined && !nonNeg(r.holdM)) out.push('holdM: meters, 0 or more')
  for (const k of Object.keys(r)) if (!['reachM', 'accuracy', 'holdM'].includes(k)) out.push(`${k}: not a rule key`)
  const a = r.accuracy
  if (a === undefined) return out
  if (!a || typeof a !== 'object') return [...out, 'accuracy: an object with a kind']
  const keys: Record<string, string[]> = {
    allowance: ['capM'],
    require: ['maxM'],
    hold: ['sureM'],
    widen: ['padM'],
    ignore: [],
  }
  if (typeof a.kind !== 'string' || !Object.prototype.hasOwnProperty.call(keys, a.kind)) {
    return [...out, `accuracy.kind: one of ${Object.keys(keys).join(', ')}`]
  }
  const need = keys[a.kind]
  const times: readonly string[] = a.kind === 'hold' ? HOLD_KEYS : []
  for (const k of need) if (!nonNeg(a[k])) out.push(`accuracy.${k}: meters, 0 or more`)
  for (const k of Object.keys(a)) if (k !== 'kind' && !need.includes(k) && !times.includes(k)) out.push(`accuracy.${k}: not a key of ${a.kind}`)
  if (a.kind === 'hold') {
    const H = holdTimes(a)
    if (!(typeof H.windowMs === 'number' && H.windowMs > 0)) out.push('accuracy.windowMs: more than 0')
    if (!nonNeg(H.carryMs)) out.push('accuracy.carryMs: 0 or more')
    if (!count(H.minFixes, 1)) out.push('accuracy.minFixes: a whole number, 1 or more')
    if (!count(H.maxFixes, 1) || H.maxFixes < H.minFixes) out.push('accuracy.maxFixes: a whole number, minFixes or more')
    if (!count(H.dwell, 1)) out.push('accuracy.dwell: a whole number, 1 or more')
  }
  return out
}

// Placecard's own collect rule: one check for the player, the Studio's Walk test and
// the server. NYID's utils/placecardCollect.js keeps these names and signatures, so it can become a re-export.
export const PC_ACCURACY_ALLOWANCE_M = 25
export const PC_TRIGGER_M: Readonly<{ min: number; max: number; default: number }> = Object.freeze({ min: 20, max: 150, default: 40 })

/** A card's trigger distance as the check reads it: a whole number of meters in range, else the default. */
export function pcTriggerM(v: unknown): number {
  const n = Number(v)
  return Number.isInteger(n) && n >= PC_TRIGGER_M.min && n <= PC_TRIGGER_M.max ? n : PC_TRIGGER_M.default
}

/** Placecard's rule for a card: its trigger as the reach, the fix's accuracy as an allowance up to 25 m. */
export function placecardRule(trigger_m?: unknown): ArrivalRule {
  return { reachM: pcTriggerM(trigger_m), accuracy: { kind: 'allowance', capM: PC_ACCURACY_ALLOWANCE_M } }
}

/**
 * `{ distance_m, accuracy_m, trigger_m }` to `{ ok, allowance_m, trigger_m }`, as NYID's pcCollectCheck. The distance
 * is read with Number(), as there (so null reads 0); a fix with no accuracy gets no allowance.
 */
export function pcCollectCheck(
  { distance_m, accuracy_m = null, trigger_m }: { distance_m?: unknown; accuracy_m?: unknown; trigger_m?: unknown } = {},
): { ok: boolean; allowance_m: number; trigger_m: number } {
  const rule = placecardRule(trigger_m)
  const c = checkArrival({ distanceM: Number(distance_m), accuracyM: accuracy_m }, rule)
  return { ok: c.verdict === 'in', allowance_m: c.allowanceM, trigger_m: rule.reachM }
}
