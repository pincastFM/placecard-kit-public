/**
 * Arrival: one mechanism, each app's rule passed in as config. Observe only: verdicts, never a refusal.
 *
 * Three proofs that no app's number moves when it adopts the kit:
 * - each app's own tests, ported: NYID's collect rule (tests/placecardStudioV2Publish.test.js "the collect check"),
 *   Treehopper's lib/cards/arrival.ts (tests/arrival.test.ts) and VeryThere's weak-fix hold
 *   (tests/arrivalHold.test.js) and "I'm here" radius (tests/walkReach.test.js), each against the kit with its rule
 * - goldens: goldens/arrival-grid.json (distance by accuracy to verdict for every app rule) and
 *   goldens/arrival-hold.json (the hold's seeded walks); UPDATE_GOLDENS=1 writes them
 * - parity with the apps' code as it is, read with git show at NYID 7987dc3b (origin/main) and Treehopper 6763aed
 *   (origin/main, live) into .pinned/: the same grid and walks give the same verdicts, and the hold the same state at
 *   every fix. Without the repos (CI) those tests are skipped and say so.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as arrival from '../index'
import {
  ARRIVAL_HOLD, CONTRACT_VERSION, PC_ACCURACY_ALLOWANCE_M, PC_TRIGGER_M, accuracyOf, arrivalFresh, arrivalHeld,
  arrivalMeters, arrivalRuleErrors, arrivalStep, checkArrival, fixOf, holdArrival, observeArrival, pcCollectCheck,
  pcTriggerM, placecardRule,
} from '../index'
import type { ArrivalRule, ArrivalState } from '../index'
import { meters as plannerMeters } from '../../planner/path/geo'
import { NYID, TREEHOPPER, hasPin, pinFiles } from '../../planner/test/pinned'
import type { Pin } from '../../planner/test/pinned'
import { asJson, golden } from '../../planner/test/golden'

const GOLDENS = resolve(__dirname, 'goldens')

// Each app's rule, as the app passes it
const TREEHOPPER_RULE: ArrivalRule = { reachM: 8, accuracy: { kind: 'require', maxM: 15 }, holdM: 15 }
const VERYTHERE_STOP: ArrivalRule = { reachM: 16, accuracy: { kind: 'hold', sureM: 25 } }
const VERYTHERE_HERE: ArrivalRule = { reachM: 60, accuracy: { kind: 'widen', padM: 25 } }
const VERYTHERE_SIDE_QUEST: ArrivalRule = { reachM: 50 } // server/api/ll/collect.post.js, distance alone

const verdict = (d: unknown, a: unknown, rule: ArrivalRule) => checkArrival({ distanceM: d, accuracyM: a }, rule).verdict

describe('Placecard, rule 10 (NYID utils/placecardCollect.js and its test)', () => {
  it('accuracy allows at most 25 m, no accuracy allows nothing, the trigger is 20 to 150 m or else 40', () => {
    expect(PC_ACCURACY_ALLOWANCE_M).toBe(25)
    expect(PC_TRIGGER_M).toEqual({ min: 20, max: 150, default: 40 })
    const ok = (distance_m: unknown, accuracy_m: unknown, trigger_m: unknown) => pcCollectCheck({ distance_m, accuracy_m, trigger_m }).ok
    expect([ok(40, null, 40), ok(40.1, null, 40), ok(40, undefined, 40), ok(40.1, '', 40)]).toEqual([true, false, true, false])
    expect([ok(50, 10, 40), ok(50.1, 10, 40)]).toEqual([true, false])
    expect([ok(65, 25, 40), ok(65.1, 25, 40), ok(65, 100, 40), ok(65.1, 100, 40)]).toEqual([true, false, true, false])
    expect([ok(20, null, 20), ok(20.1, null, 20), ok(150, null, 150), ok(175, 25, 150), ok(175.1, 25, 150)])
      .toEqual([true, false, true, true, false])
    expect([ok(41, 0, 40), ok(41, -5, 40), ok(NaN, null, 40), ok(-1, null, 40), ok(undefined, 5, 40)])
      .toEqual([false, false, false, false, false])
    expect(pcCollectCheck({ distance_m: 30, accuracy_m: 100, trigger_m: 20 })).toEqual({ ok: true, allowance_m: 25, trigger_m: 20 })
    expect(pcCollectCheck()).toEqual({ ok: false, allowance_m: 0, trigger_m: 40 })
    expect([10, 19, 20, 150, 151, 40.5, '60', null, undefined, 'x'].map(pcTriggerM)).toEqual([40, 40, 20, 150, 40, 40, 60, 40, 40, 40])
  })

  it('placecardRule is the card\'s trigger with a 25 m allowance; checkArrival reads it as pcCollectCheck does', () => {
    expect(placecardRule(120)).toEqual({ reachM: 120, accuracy: { kind: 'allowance', capM: 25 } })
    expect(placecardRule(null).reachM).toBe(40)
    expect(arrivalRuleErrors(placecardRule(20))).toEqual([])
    expect(checkArrival({ distanceM: 64, accuracyM: 50 }, placecardRule(40))).toEqual({ verdict: 'in', reachM: 40, allowanceM: 25 })
    expect(checkArrival({ distanceM: 46, accuracyM: 5 }, placecardRule(40))).toEqual({ verdict: 'out', reachM: 40, allowanceM: 5 })
    // Placecard's rule has no poor fix: a weak fix only reaches farther
    for (const a of [null, 0, 5, 25, 100]) for (const d of [0, 20, 40, 65, 66, 200]) expect(verdict(d, a, placecardRule(40))).not.toBe('poor')
  })

  it('pcCollectCheck reads its distance with Number(), as NYID does: null is 0, undefined is none', () => {
    expect(pcCollectCheck({ distance_m: null, trigger_m: 40 }).ok).toBe(true)
    expect(pcCollectCheck({ distance_m: '39', trigger_m: 40 }).ok).toBe(true)
    expect(pcCollectCheck({ distance_m: undefined, trigger_m: 40 }).ok).toBe(false)
    // checkArrival itself reads null as no distance
    expect(verdict(null, null, placecardRule(40))).toBe('out')
  })
})

describe('Treehopper: found inside 8 m on a 15 m fix, held to 15 m (lib/cards/arrival.ts and its test)', () => {
  // Treehopper's words for the kit's verdicts: found is in, poor is poor, away is out
  const arrivalOf = (m: unknown, a: unknown) => ({ in: 'found', poor: 'poor', out: 'away' })[verdict(m, a, TREEHOPPER_RULE)]

  it('found at 8 m on 15 m, both at the line', () => {
    expect(arrivalOf(8, 15)).toBe('found')
    expect(arrivalOf(3, 5)).toBe('found')
    expect(arrivalOf(0, 0)).toBe('found')
  })

  it('poor inside 8 m on a worse fix, or with no accuracy (the URL fix)', () => {
    expect(arrivalOf(6, 38)).toBe('poor')
    expect(arrivalOf(8, 15.1)).toBe('poor')
    expect(arrivalOf(5, null)).toBe('poor')
    expect(arrivalOf(5, undefined)).toBe('poor')
    expect(arrivalOf(5, Number.NaN)).toBe('poor')
    expect(arrivalOf(5, -1)).toBe('poor')
  })

  it('away past 8 m, whatever the fix, and with no distance', () => {
    expect(arrivalOf(8.1, 3)).toBe('away')
    expect(arrivalOf(11, 5)).toBe('away') // the tree across a side street, on a 5 m fix
    expect(arrivalOf(15, 15)).toBe('away')
    expect(arrivalOf(120, 3)).toBe('away')
    expect(arrivalOf(null, 3)).toBe('away')
    expect(arrivalOf(Number.POSITIVE_INFINITY, 3)).toBe('away')
  })

  it('Collect only once found, then held to 15 m against drift; never from farther (H274)', () => {
    const collectable = (once: boolean, m: unknown) => holdArrival(once, m, TREEHOPPER_RULE) === 'held'
    const walkedOff = (once: boolean, m: unknown) => holdArrival(once, m, TREEHOPPER_RULE) === 'walkedOff'
    expect([14, 15, 16, 400].map((m) => collectable(true, m))).toEqual([true, true, false, false])
    expect(collectable(false, 3)).toBe(false) // a card a link raised, never found
    expect(collectable(true, null)).toBe(false)
    expect(collectable(true, Number.NaN)).toBe(false)
    expect([15, 15.1, 120, 3].map((m) => walkedOff(true, m))).toEqual([false, true, true, false])
    expect(walkedOff(false, 120)).toBe(false) // never reached: still the walk in
    expect(walkedOff(true, null)).toBe(false)
    expect(walkedOff(true, Number.NaN)).toBe(false)
    expect(walkedOff(true, Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('reads accuracy only from a finite fix (vueuse starts at Infinity with accuracy 0)', () => {
    const acc = (c: unknown) => fixOf(c)?.accuracy ?? null
    expect(acc({ latitude: Number.POSITIVE_INFINITY, longitude: Number.POSITIVE_INFINITY, accuracy: 0 })).toBeNull()
    expect(acc({ latitude: 40.7, longitude: -74, accuracy: 12 })).toBe(12)
    expect(acc({ latitude: 40.7, longitude: -74 })).toBeNull()
    expect(acc({ latitude: 91, longitude: -74, accuracy: 5 })).toBeNull()
    expect(acc(null)).toBeNull()
  })

  it('arrivalStep under the rule stands each fix alone: found fires, poor holds (the hunt box\'s Hold still)', () => {
    const TREE = { lat: 40.7359, lng: -73.9911, key: 4242 }
    const north = (m: number) => ({ lat: TREE.lat + m / 111195.08, lng: TREE.lng })
    expect(arrivalStep(null, { ...north(5), accuracy: 10, t: 0 }, TREE, TREEHOPPER_RULE).verdict).toBe('fire')
    const held = arrivalStep(null, { ...north(5), accuracy: 38, t: 0 }, TREE, TREEHOPPER_RULE)
    expect(held.verdict).toBe('hold')
    expect(arrivalHeld(held.state, 1000)).toBe(true)
    expect(arrivalStep(held.state, { ...north(5), t: 500 }, TREE, TREEHOPPER_RULE).verdict).toBe('hold') // no accuracy is poor here
    expect(arrivalStep(null, { ...north(11), accuracy: 5, t: 0 }, TREE, TREEHOPPER_RULE).verdict).toBe('none')
  })
})

// VeryThere's hold, its test's noise model: gaussian scatter, sigma = accuracy / 2 per axis, one fix a second, seeded
const LAT = 24.5513, LNG = -81.8011 // 3947 stop 5, the brick wall
const STOP = { lat: LAT, lng: LNG, key: 's5' }
const off = (dx: number, dy: number) => ({ lat: LAT + dy / 111320, lng: LNG + dx / (111320 * Math.cos((LAT * Math.PI) / 180)) })
function rng(seed: number) {
  let x = seed >>> 0
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296 }
}
function noisy(seed: number, acc: number) {
  const R = rng(seed)
  const g = () => Math.sqrt(-2 * Math.log(Math.max(R(), 1e-12))) * Math.cos(2 * Math.PI * R())
  return (x: number, y: number) => off(x + (g() * acc) / 2, y + (g() * acc) / 2)
}
type Step = (prev: any, fix: any, stop: any) => { state: any; verdict: string }
const kitStep: Step = (prev, fix, stop) => arrivalStep(prev, fix, stop, VERYTHERE_STOP)
// Fixes until the stop fires (null: not within n)
function standAt(step: Step, dx: number, acc: number, n: number, seed: number) {
  const f = noisy(seed, acc)
  let st: any = null
  for (let i = 0; i < n; i++) {
    const r = step(st, { ...f(dx, 0), accuracy: acc, t: i * 1000 }, STOP)
    st = r.state
    if (r.verdict === 'fire') return i + 1
  }
  return null
}
// Where a walker walking through the stop fires (x in meters, null: never)
function walkThrough(step: Step, seed: number, acc: number) {
  const f = noisy(seed, acc)
  let st: any = null
  for (let i = 0; i < 95; i++) {
    const x = -80 + i * 1.3
    const r = step(st, { ...f(x, 0), accuracy: acc, t: i * 1000 }, STOP)
    st = r.state
    if (r.verdict === 'fire') return Math.round(x * 10) / 10
  }
  return null
}

describe('VeryThere: a weak fix inside 16 m is held (utils/arrivalHold.js and its test)', () => {
  it('fires at once inside 16 m with a sure fix, not outside', () => {
    expect(kitStep(null, { ...off(10, 0), accuracy: 8, t: 0 }, STOP).verdict).toBe('fire')
    expect(kitStep(null, { ...off(20, 0), accuracy: 8, t: 0 }, STOP).verdict).toBe('none')
    expect(kitStep(null, { ...off(15, 0), accuracy: 25, t: 0 }, STOP).verdict).toBe('fire')
  })
  it('treats a fix with no accuracy (demo, simulation) as sure', () => {
    expect(kitStep(null, { ...off(5, 0), t: 0 }, STOP).verdict).toBe('fire')
  })
  it('ignores a fix it cannot read', () => {
    expect(kitStep(null, { lat: 'x', lng: null, accuracy: 8 }, STOP).verdict).toBe('none')
  })
  it('holds a single weak fix inside 16 m instead of firing', () => {
    const r = kitStep(null, { ...off(5, 0), accuracy: 45, t: 0 }, STOP)
    expect(r.verdict).toBe('hold')
    expect(arrivalHeld(r.state, 1000)).toBe(true)
    expect(arrivalHeld(r.state, ARRIVAL_HOLD.cueMs + 1)).toBe(false)
    expect(verdict(5, 45, VERYTHERE_STOP)).toBe('poor') // the same fix, alone
  })
  it('a sure fix confirms a held stop at once', () => {
    const st = kitStep(null, { ...off(5, 0), accuracy: 45, t: 0 }, STOP).state
    expect(kitStep(st, { ...off(8, 0), accuracy: 10, t: 1000 }, STOP).verdict).toBe('fire')
  })
  it('fires after a short dwell for a walker who stands on the stop (45 m and 60 m)', () => {
    for (const acc of [45, 60]) {
      const n = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => standAt(kitStep, 0, acc, 60, seed))
      expect(n.every((x) => x != null && x <= 40)).toBe(true)
    }
  })
  it('does not fire for a walker standing at the stop before, 46 to 56 m away (L4#3)', () => {
    for (const d of [46, 54, 56]) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) expect(standAt(kitStep, d, 45, 60, seed)).toBe(null)
    for (const seed of [1, 2, 3, 4]) expect(standAt(kitStep, 46, 60, 150, seed)).toBe(null)
  })
  it('rarely fires 31 m away (stops 8 and 9), where every fix used to', () => {
    let fired = 0
    for (let seed = 1; seed <= 40; seed++) if (standAt(kitStep, 31, 45, 60, seed) != null) fired++
    expect(fired).toBeLessThanOrEqual(4)
  })
  it('fires near the stop for a walker walking through it at 45 m', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const at = walkThrough(kitStep, seed, 45)
      if (at != null) expect(Math.abs(at)).toBeLessThanOrEqual(25)
    }
  })
  it('starts afresh for a new stop', () => {
    const st = kitStep(null, { ...off(5, 0), accuracy: 45, t: 0 }, STOP).state
    const r = kitStep(st, { ...off(5, 0), accuracy: 45, t: 1000 }, { ...STOP, key: 's6' })
    expect(r.state.key).toBe('s6')
    expect(r.state.fixes.length).toBe(1)
  })
  it('treats a position with no accuracy right after a real fix as that fix passed on again', () => {
    let st = kitStep(null, { ...off(30, 0), accuracy: 45, t: 0 }, STOP).state
    const r = kitStep(st, { ...off(5, 0), t: 1000 }, STOP)
    expect(r.verdict).toBe('none')
    expect(r.state.fixes.length).toBe(1)
    expect(kitStep(r.state, { ...off(5, 0), t: 1500 }, { ...STOP, key: 's6' }).verdict).toBe('none')
    st = kitStep(null, { ...off(3, 0), accuracy: 45, t: 0 }, STOP).state
    for (let i = 1; i < 20; i++) {
      const x = kitStep(st, { ...off(3, 0), t: i * 100 }, STOP)
      expect(x.verdict).toBe('hold')
      st = x.state
    }
    expect(st.fixes.length).toBe(1)
    expect(kitStep(r.state, { ...off(4, 0), t: 40000 }, STOP).verdict).toBe('fire')
  })
  it('measures meters', () => {
    expect(Math.round(arrivalMeters(off(0, 0), off(30, 40)))).toBe(50)
    expect(arrivalMeters({ lat: 1, lon: 2 }, { lat: 1, lng: 2 })).toBe(0) // lng or lon
  })
  it('the hold\'s numbers are the rule\'s: a longer dwell fires later, never sooner', () => {
    const slow: ArrivalRule = { reachM: 16, accuracy: { kind: 'hold', sureM: 25, dwell: 10 } }
    const slowStep: Step = (p, f, s) => arrivalStep(p, f, s, slow)
    for (const seed of [1, 2, 3, 4]) {
      const a = standAt(kitStep, 0, 45, 80, seed)
      const b = standAt(slowStep, 0, 45, 80, seed)
      expect(a).not.toBeNull()
      expect(b == null || b >= (a as number)).toBe(true)
    }
    expect(arrivalRuleErrors(slow)).toEqual([])
  })
  it('"I\'m here" shows within max(60 m, accuracy + 25 m) (utils/walkReach.js llHereRadius)', () => {
    const radius = (a: unknown) => { const c = checkArrival({ distanceM: 0, accuracyM: a }, VERYTHERE_HERE); return c.reachM + c.allowanceM }
    expect([radius(8), radius(45), radius(null)]).toEqual([60, 70, 60])
    expect(verdict(34, 45, VERYTHERE_HERE)).toBe('in')
    expect(verdict(75, 45, VERYTHERE_HERE)).toBe('out')
    expect(verdict(70, 45, VERYTHERE_HERE)).toBe('in')
  })
})

describe('the mechanism', () => {
  it('a negative distance is no distance, under every rule; so is a negative accuracy', () => {
    for (const rule of [placecardRule(40), TREEHOPPER_RULE, VERYTHERE_STOP, VERYTHERE_HERE, VERYTHERE_SIDE_QUEST]) {
      expect(verdict(-1, 5, rule)).toBe('out')
      expect(holdArrival(true, -1, rule)).toBe('none')
    }
    expect(accuracyOf(-1)).toBeNull()
    expect(verdict(5, -1, VERYTHERE_STOP)).toBe('in') // no accuracy counts as sure under hold
    expect(verdict(5, -1, TREEHOPPER_RULE)).toBe('poor') // and as poor under require
  })

  it('ignore: the distance alone (VeryThere\'s side quest on its server, 50 m)', () => {
    expect([verdict(50, null, VERYTHERE_SIDE_QUEST), verdict(50.1, 3, VERYTHERE_SIDE_QUEST), verdict(10, 400, VERYTHERE_SIDE_QUEST)])
      .toEqual(['in', 'out', 'in'])
    expect(arrivalStep(null, { ...off(40, 0), accuracy: 200, t: 0 }, STOP, VERYTHERE_SIDE_QUEST).verdict).toBe('fire')
    expect(holdArrival(true, 50, VERYTHERE_SIDE_QUEST)).toBe('held') // holdM defaults to the reach
    expect(holdArrival(true, 50.1, VERYTHERE_SIDE_QUEST)).toBe('walkedOff')
  })

  it('reads a fix from GeolocationCoordinates, a request body or a place', () => {
    expect(fixOf({ latitude: 40.7, longitude: -74, accuracy: 12 })).toEqual({ lat: 40.7, lng: -74, accuracy: 12 })
    expect(fixOf({ lat: '40.7', lng: '-74', accuracy: '12' })).toEqual({ lat: 40.7, lng: -74, accuracy: 12 })
    expect(fixOf({ lat: 40.7, lon: -74 })).toEqual({ lat: 40.7, lng: -74, accuracy: null })
    expect(fixOf({ lat: 40.7, lng: 181 })).toBeNull()
    expect(fixOf({ lat: null, lng: -74 })).toBeNull()
    expect(fixOf('40.7,-74')).toBeNull()
    expect(fixOf({ lat: 0, lng: 0, accuracy: 0 })).toEqual({ lat: 0, lng: 0, accuracy: 0 })
  })

  it('observeArrival: what a server records with a collect, never a refusal', () => {
    const at = { lat: LAT, lng: LNG }
    const near = { ...off(30, 0), accuracy: 20 }
    const o = observeArrival(near, at, placecardRule(40))
    expect(o.verdict).toBe('in')
    expect(o.distanceM).toBeCloseTo(30, 0)
    expect(o.accuracyM).toBe(20)
    expect(o.allowanceM).toBe(20)
    expect(observeArrival({ ...off(30, 0), accuracy: 20 }, at, TREEHOPPER_RULE).verdict).toBe('out')
    expect(observeArrival({ ...off(3, 0), accuracy: 40 }, at, TREEHOPPER_RULE).verdict).toBe('poor')
    // no position sent (Treehopper's collects today): unknown, not out
    expect(observeArrival(null, at, TREEHOPPER_RULE)).toEqual({ verdict: 'unknown', distanceM: null, accuracyM: null, reachM: 8, allowanceM: 0 })
    expect(observeArrival({ lat: LAT, lng: LNG, accuracy: 5 }, { lat: null }, TREEHOPPER_RULE).verdict).toBe('unknown')
  })

  it('nothing throws on a bad rule or a bad reading', () => {
    for (const rule of [null, {}, { reachM: 'x' }, { reachM: 10, accuracy: { kind: 'nope' } }] as any[]) {
      expect(() => checkArrival({ distanceM: 5, accuracyM: 5 }, rule)).not.toThrow()
      expect(() => arrivalStep(null, { ...off(5, 0), t: 0 }, STOP, rule)).not.toThrow()
      expect(() => holdArrival(true, 5, rule)).not.toThrow()
      expect(() => observeArrival(off(5, 0), STOP, rule)).not.toThrow()
      expect(checkArrival({ distanceM: 5 }, rule).verdict).toBe(rule?.reachM === 'x' || !rule?.reachM ? 'out' : 'in')
    }
    expect(checkArrival(null, placecardRule()).verdict).toBe('out')
    expect(arrivalStep(undefined, null, null, VERYTHERE_STOP)).toEqual({ state: arrivalFresh(null), verdict: 'none' })
  })

  it('arrivalRuleErrors names each problem, and passes every app rule', () => {
    for (const r of [TREEHOPPER_RULE, VERYTHERE_STOP, VERYTHERE_HERE, VERYTHERE_SIDE_QUEST, placecardRule(150)]) expect(arrivalRuleErrors(r)).toEqual([])
    expect(arrivalRuleErrors(null)).toEqual(['rule: an object'])
    expect(arrivalRuleErrors({ reachM: -1, holdM: 'x', extra: 1 })).toEqual(['reachM: meters, 0 or more', 'holdM: meters, 0 or more', 'extra: not a rule key'])
    expect(arrivalRuleErrors({ reachM: 8, accuracy: { kind: 'toString' } })).toEqual(['accuracy.kind: one of allowance, require, hold, widen, ignore'])
    expect(arrivalRuleErrors({ reachM: 8, accuracy: { kind: 'require', capM: 3 } })).toEqual(['accuracy.maxM: meters, 0 or more', 'accuracy.capM: not a key of require'])
    expect(arrivalRuleErrors({ reachM: 16, accuracy: { kind: 'hold', sureM: 25, minFixes: 6, maxFixes: 4, dwell: 0, windowMs: 0 } }))
      .toEqual(['accuracy.windowMs: more than 0', 'accuracy.maxFixes: a whole number, minFixes or more', 'accuracy.dwell: a whole number, 1 or more'])
    expect(arrivalRuleErrors({ reachM: 8, accuracy: null })).toEqual(['accuracy: an object with a kind'])
  })

  it('arrivalMeters is within 0.6 percent of the planner\'s meters at city scale', () => {
    for (const [dx, dy] of [[30, 40], [100, 0], [0, 100], [500, 500]]) {
      const a = off(0, 0), b = off(dx, dy)
      const k = arrivalMeters(a, b)
      const p = plannerMeters({ lat: a.lat, lon: a.lng }, { lat: b.lat, lon: b.lng })
      expect(Math.abs(p - k) / k).toBeLessThan(0.006)
    }
  })
})

// The grid: every distance by every accuracy, one letter a verdict (i in, p poor, o out)
const DISTANCES: unknown[] = [0, 0.5, 3, 7.9, 8, 8.1, 12, 15, 15.1, 16, 16.1, 19.9, 20, 20.1, 25, 30, 35, 39.9, 40, 40.1, 45, 50, 55,
  60, 60.1, 64.9, 65, 65.1, 69.9, 70, 70.1, 100, 125, 150, 150.1, 174.9, 175, 175.1, 200, null, NaN, Infinity]
const ACCURACIES: unknown[] = [null, 0, 3, 5, 10, 14.9, 15, 15.1, 20, 24.9, 25, 25.1, 38, 45, 60, 100, NaN, Infinity]
const GRID_RULES: Record<string, ArrivalRule> = {
  'placecard-20': placecardRule(20),
  'placecard-40': placecardRule(40),
  'placecard-150': placecardRule(150),
  treehopper: TREEHOPPER_RULE,
  'verythere-stop': VERYTHERE_STOP,
  'verythere-here': VERYTHERE_HERE,
  'verythere-side-quest': VERYTHERE_SIDE_QUEST,
}
const LETTER = { in: 'i', poor: 'p', out: 'o' } as const
// A row: the distance, right-aligned, then one letter for each column
const row = (d: unknown, letters: string) => `${String(d).padStart(8)} ${letters}`

function grid() {
  const rules: Record<string, { rule: ArrivalRule; rows: string[] }> = {}
  for (const [name, rule] of Object.entries(GRID_RULES)) {
    rules[name] = { rule, rows: DISTANCES.map((d) => row(d, ACCURACIES.map((a) => LETTER[verdict(d, a, rule)]).join(''))) }
  }
  const hold = DISTANCES.map((d) => row(d, [true, false].map((once) => ({ held: 'h', walkedOff: 'w', none: '-' })[holdArrival(once, d, TREEHOPPER_RULE)]).join('')))
  return {
    letters: 'i in, p poor, o out; treehopperHold: h held, w walkedOff, - none',
    columns: ACCURACIES.map(String),
    rules,
    treehopperHold: { columns: ['arrived', 'not yet'], rows: hold },
  }
}

function holdTrace(step: Step) {
  const stand: Record<string, (number | null)[]> = {}
  for (const acc of [8, 25, 45, 60]) for (const d of [0, 10, 16, 20, 31, 46, 56]) {
    stand[`${d} m on ${acc} m`] = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => standAt(step, d, acc, 60, seed))
  }
  const through: Record<string, (number | null)[]> = {}
  for (const acc of [25, 45, 60]) through[`${acc} m`] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((seed) => walkThrough(step, seed, acc))
  return { stand, through }
}

describe('goldens', () => {
  it('goldens/arrival-grid.json: every app rule, distance by accuracy', () => {
    golden('arrival-grid.json', asJson(grid()), GOLDENS)
  })
  it('goldens/arrival-hold.json: VeryThere\'s hold on seeded walks (fixes to fire; where a walk-through fires)', () => {
    golden('arrival-hold.json', asJson(holdTrace(kitStep)), GOLDENS)
  })
})

// The apps' code as it is today
const NYID_NOW: Pin = { ...NYID, name: 'nyid-7987dc3b', commit: '7987dc3b17effc0144c2460344446a2bbeaf1798' }
const TREEHOPPER_NOW: Pin = { ...TREEHOPPER, name: 'treehopper-6763aed', commit: '6763aedaa570b16879eb1ca143ecaf0629581bd7' }
const haveNyid = hasPin(NYID_NOW)
const haveTreehopper = hasPin(TREEHOPPER_NOW)

describe('parity: NYID at 7987dc3b (rule 10, the weak-fix hold, I\'m here)', () => {
  const load = async () => {
    const dir = pinFiles(NYID_NOW, ['utils/placecardCollect.js', 'utils/arrivalHold.js', 'utils/walkReach.js'])
    return {
      collect: await import(/* @vite-ignore */ `${dir}/utils/placecardCollect.js`),
      hold: await import(/* @vite-ignore */ `${dir}/utils/arrivalHold.js`),
      reach: await import(/* @vite-ignore */ `${dir}/utils/walkReach.js`),
    }
  }

  it.skipIf(!haveNyid)('pcCollectCheck and pcTriggerM equal NYID\'s on the grid and on odd input', async () => {
    const { collect } = await load()
    expect(collect.PC_ACCURACY_ALLOWANCE_M).toBe(PC_ACCURACY_ALLOWANCE_M)
    expect(collect.PC_TRIGGER_M).toEqual(PC_TRIGGER_M)
    const ds = [...DISTANCES, -1, -0.1, '40', '', undefined, '1e1']
    const as = [...ACCURACIES, -5, '10', '', undefined, '-3']
    for (const t of [undefined, null, 19, 20, 40, 40.5, '60', 120, 150, 151, 'x']) {
      expect(pcTriggerM(t)).toBe(collect.pcTriggerM(t))
      for (const d of ds) for (const a of as) {
        const args = { distance_m: d, accuracy_m: a, trigger_m: t }
        expect(pcCollectCheck(args), JSON.stringify([d, a, t])).toEqual(collect.pcCollectCheck(args))
      }
    }
    expect(pcCollectCheck()).toEqual(collect.pcCollectCheck())
  })

  it.skipIf(!haveNyid)('arrivalStep gives llArrivalStep\'s state and verdict at every fix of every seeded walk', async () => {
    const { hold } = await load()
    const theirs: Step = (p, f, s) => hold.llArrivalStep(p, f, s)
    const both = (fixes: any[], stops: any[] = fixes.map(() => STOP)) => {
      let a: any = null, b: any = null
      fixes.forEach((f, i) => {
        const x = kitStep(a, f, stops[i]), y = theirs(b, f, stops[i])
        expect(x, `fix ${i}`).toEqual(y)
        a = x.state; b = y.state
        for (const now of [f.t + 1, f.t + 7999, f.t + 8000]) expect(arrivalHeld(a, now)).toBe(hold.llArrivalHeld(b, now))
      })
    }
    for (const acc of [8, 25, 25.1, 45, 60]) for (const d of [0, 10, 16, 20, 31, 46, 56]) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const f = noisy(seed, acc)
      both(Array.from({ length: 60 }, (_, i) => ({ ...f(d, 0), accuracy: acc, t: i * 1000 })))
    }
    for (const acc of [25, 45, 60]) for (let seed = 1; seed <= 10; seed++) {
      const f = noisy(seed, acc)
      both(Array.from({ length: 95 }, (_, i) => ({ ...f(-80 + i * 1.3, 0), accuracy: acc, t: i * 1000 })))
    }
    // the map camera's positions with no accuracy, mixed in; a stop change; a carry run out; a bad fix
    const f = noisy(7, 45)
    const mixed = Array.from({ length: 80 }, (_, i) => {
      const p = f(20 - i * 0.4, 0)
      return i % 3 === 1 ? { ...p, t: i * 700 } : i === 50 ? { ...p, accuracy: 9, t: i * 700 } : { ...p, accuracy: 45, t: i * 700 }
    })
    both(mixed, mixed.map((_, i) => (i < 40 ? STOP : { ...STOP, key: 's6' })))
    both([{ ...off(3, 0), accuracy: 45, t: 0 }, { ...off(3, 0), t: 45000 }, { lat: 'x', lng: 1, accuracy: 3, t: 46000 }, { ...off(1, 0), accuracy: 5, t: 47000 }])
    // the hold's state, carried across a new stop, reads the same
    expect(arrivalFresh('s7', { lastAcc: 30, lastAccAt: 5 })).toEqual(hold.llArrivalFresh('s7', { lastAcc: 30, lastAccAt: 5 }))
  })

  it.skipIf(!haveNyid)('the hold\'s golden is NYID\'s own: its walks give goldens/arrival-hold.json', async () => {
    const { hold } = await load()
    expect(asJson(holdTrace((p, f, s) => hold.llArrivalStep(p, f, s)))).toBe(readFileSync(resolve(GOLDENS, 'arrival-hold.json'), 'utf8'))
  })

  it.skipIf(!haveNyid)('arrivalMeters is llMetres; the widen rule is llWhereAmI\'s near on a fresh fix', async () => {
    const { hold, reach } = await load()
    for (const [dx, dy] of [[0, 0], [30, 40], [16, 0], [0.3, 15.9], [500, -120]]) {
      expect(arrivalMeters(off(0, 0), off(dx, dy))).toBe(hold.llMetres(off(0, 0), off(dx, dy)))
    }
    const now = 100000
    for (const d of DISTANCES) for (const a of [...ACCURACIES, '30', '']) {
      const near = reach.llWhereAmI({ distance: d, accuracy: a, fixAt: now - 1000, now }) === 'near'
      expect(verdict(d, a, VERYTHERE_HERE) === 'in', JSON.stringify([d, a])).toBe(near)
    }
  })
})

describe('parity: Treehopper at 6763aed (live: found, held, walked off)', () => {
  const load = async () => {
    const dir = pinFiles(TREEHOPPER_NOW, ['lib/cards/arrival.ts'])
    return import(/* @vite-ignore */ `${dir}/lib/cards/arrival.ts`)
  }

  it.skipIf(!haveTreehopper)('its numbers are the rule\'s', async () => {
    const th = await load()
    expect([th.FOUND_M, th.FOUND_ACCURACY_M, th.COLLECT_HOLD_M]).toEqual([8, 15, 15])
  })

  it.skipIf(!haveTreehopper)('checkArrival gives arrivalOf\'s answer on the grid', async () => {
    const th = await load()
    const word = { in: 'found', poor: 'poor', out: 'away' } as const
    for (const d of DISTANCES) for (const a of ACCURACIES) {
      expect(word[verdict(d, a, TREEHOPPER_RULE)], JSON.stringify([d, a])).toBe(th.arrivalOf(d, a))
    }
  })

  it.skipIf(!haveTreehopper)('holdArrival gives collectable and walkedOff on every distance', async () => {
    const th = await load()
    for (const d of DISTANCES) for (const once of [true, false]) {
      const h = holdArrival(once, d, TREEHOPPER_RULE)
      expect(h === 'held', JSON.stringify([once, d])).toBe(th.collectable(once, d))
      expect(h === 'walkedOff', JSON.stringify([once, d])).toBe(th.walkedOff(once, d))
    }
  })

  it.skipIf(!haveTreehopper)('fixOf\'s accuracy is fixAccuracy\'s', async () => {
    const th = await load()
    const coords = [
      { latitude: Infinity, longitude: Infinity, accuracy: 0 }, { latitude: 40.7, longitude: -74, accuracy: 12 },
      { latitude: 40.7, longitude: -74 }, { latitude: 91, longitude: -74, accuracy: 5 }, { latitude: -91, longitude: 0, accuracy: 5 },
      { latitude: 40.7, longitude: -74, accuracy: -1 }, { latitude: 40.7, longitude: -74, accuracy: 0 },
      { latitude: 40.7, longitude: NaN, accuracy: 3 }, { latitude: 40.7, longitude: -74, accuracy: Infinity }, null,
    ]
    for (const c of coords) expect(fixOf(c)?.accuracy ?? null, JSON.stringify(c)).toBe(th.fixAccuracy(c))
  })

  it.skipIf(!haveTreehopper)('the grid golden\'s Treehopper rows are arrivalOf\'s, collectable\'s and walkedOff\'s', async () => {
    const th = await load()
    const g = JSON.parse(readFileSync(resolve(GOLDENS, 'arrival-grid.json'), 'utf8'))
    const letter = { found: 'i', poor: 'p', away: 'o' } as Record<string, string>
    expect(g.rules.treehopper.rows).toEqual(DISTANCES.map((d) => row(d, ACCURACIES.map((a) => letter[th.arrivalOf(d, a)]).join(''))))
    const hold = (once: boolean, d: unknown) => (th.collectable(once, d) ? 'h' : th.walkedOff(once, d) ? 'w' : '-')
    expect(g.treehopperHold.rows).toEqual(DISTANCES.map((d) => row(d, hold(true, d) + hold(false, d))))
  })
})

describe('the package', () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'package.json'), 'utf8'))

  it('exports ./arrival from dist with its types, and dist ships', () => {
    expect(pkg.exports['./arrival']).toEqual({ types: './dist/arrival/index.d.ts', import: './dist/arrival/index.js' })
    expect(pkg.files).toContain('dist')
    expect(readFileSync(resolve(__dirname, '..', '..', 'scripts', 'build.mjs'), 'utf8')).toMatch(/\['planner', 'contract', 'arrival'\]/)
  })

  it('says the one contract version', () => {
    expect(CONTRACT_VERSION).toBe(pkg.version)
  })

  it('is server-safe: it imports the contract\'s constants and nothing else', () => {
    const src = readFileSync(resolve(__dirname, '..', 'index.ts'), 'utf8')
    expect([...src.matchAll(/^(?:import|export)[^'"\n]*from\s+'([^']+)'/gm)].map((m) => m[1])).toEqual(['../contract/record'])
  })

  it('exports these values, and nothing else', () => {
    expect(Object.keys(arrival).sort()).toEqual([
      'ARRIVAL_HOLD', 'CONTRACT_VERSION', 'PC_ACCURACY_ALLOWANCE_M', 'PC_TRIGGER_M', 'accuracyOf', 'arrivalFresh', 'arrivalHeld',
      'arrivalMeters', 'arrivalRuleErrors', 'arrivalStep', 'checkArrival', 'fixOf', 'holdArrival', 'observeArrival', 'pcCollectCheck',
      'pcTriggerM', 'placecardRule',
    ])
    const st: ArrivalState = arrivalFresh('x')
    expect(st).toEqual({ key: 'x', fixes: [], inside: 0, heldAt: null, verdict: 'none', lastAcc: null, lastAccAt: null })
  })
})
