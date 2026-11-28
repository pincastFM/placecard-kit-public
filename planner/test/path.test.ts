/**
 * The path solver: Treehopper's planner, frozen first, then moved.
 *
 * Treehopper has no tests of its own, so its v1 outputs are frozen from its own code at
 * treehopper-next 1947477 (read with git show into .pinned/) over the cases in
 * fixtures/path-cases.ts: goldens/path-v1.json. Every later step must give that file back
 * byte for byte:
 * - planner/path/{types,geo,plan}.ts are Treehopper's files, byte for byte (since 1.7.0, types.ts and geo.ts
 *   with the lines in ADDED_1_7 and nothing else: run and transit in Mode and in MODES)
 * - the moved planItinerary gives path-v1.json
 * - toV1(upgradeV1(v1)) and toV1(solvePath(...).record) give each v1 record back
 * goldens/path-v2.json freezes solvePath's v2 records (the left-over list and its reasons).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TREEHOPPER, gitShow, hasPin, pinFiles } from './pinned'
import { GOLDENS, asJson, golden, runPathCases } from './golden'
import { FAR, PATH_CASES, START } from './fixtures/path-cases'
import { planItinerary } from '../path/plan'
import { solvePath } from '../path/index'
import { toV1, upgradeV1, validateRecord } from '../record'
import type { PlanRecord } from '../../contract/record'

const FILES = ['types.ts', 'geo.ts', 'plan.ts']
// 1.7.0's lines in Treehopper's files, each [Treehopper's text, the kit's]: run and transit in Mode and MODES
const ADDED_1_7: Record<string, [string, string][]> = {
  'types.ts': [[
    "export type Mode = 'walk' | 'bike'\n",
    "export type Mode = 'walk' | 'run' | 'bike' | 'transit' // 1.7.0: run and transit; never a car\n",
  ]],
  'geo.ts': [[
    "  walk: { mPerMin: 80, factor: 1.3, profile: 'mapbox/walking' },\n  bike: { mPerMin: 250, factor: 1.3, profile: 'mapbox/cycling' },\n",
    "  walk: { mPerMin: 80, factor: 1.3, profile: 'mapbox/walking' },\n"
      + "  run: { mPerMin: 160, factor: 1.3, profile: 'mapbox/walking' }, // 1.7.0: the walk's streets at an easy jog, a 10-minute mile (6:13 a km)\n"
      + "  bike: { mPerMin: 250, factor: 1.3, profile: 'mapbox/cycling' },\n"
      + "  transit: { mPerMin: 80, factor: 1.3, profile: 'mapbox/walking' }, // 1.7.0: the TransitRouter times it; the estimate walks, so a plan never counts on a ride\n",
  ]],
}
const V1 = FILES.map((f) => `lib/placecard/itinerary/${f}`)
const haveTreehopper = hasPin(TREEHOPPER)
const SOURCE = `Treehopper ${TREEHOPPER.commit.slice(0, 7)}`
const v1Golden = () => JSON.parse(readFileSync(resolve(GOLDENS, 'path-v1.json'), 'utf8'))

describe('path solver: Treehopper at 1947477 (the freeze)', () => {
  it.skipIf(!haveTreehopper)('its planItinerary gives goldens/path-v1.json', async () => {
    const dir = pinFiles(TREEHOPPER, V1)
    const { planItinerary: theirs } = await import(/* @vite-ignore */ `${dir}/lib/placecard/itinerary/plan.ts`)
    golden('path-v1.json', asJson({ source: SOURCE, cases: await runPathCases(theirs) }))
  })
})

describe('path solver: moved into the kit', () => {
  it.skipIf(!haveTreehopper)('planner/path is Treehopper\'s files byte for byte (types.ts and geo.ts with 1.7.0\'s lines)', () => {
    for (const f of FILES) {
      const ours = readFileSync(resolve(__dirname, '..', 'path', f))
      let theirs = gitShow(TREEHOPPER, `lib/placecard/itinerary/${f}`).toString('utf8')
      for (const [was, now] of ADDED_1_7[f] || []) {
        expect(theirs.split(was).length - 1, `${f}: Treehopper's line, once`).toBe(1)
        theirs = theirs.replace(was, now)
      }
      expect(ours.equals(Buffer.from(theirs, 'utf8')), f).toBe(true)
    }
  })

  it('the moved planItinerary gives goldens/path-v1.json', async () => {
    golden('path-v1.json', asJson({ source: SOURCE, cases: await runPathCases(planItinerary) }))
  })

  it('upgradeV1 then toV1 gives each v1 record back, and the v2 record is valid', () => {
    const { cases } = v1Golden()
    let n = 0
    for (const c of cases) {
      if (!c.result.record) continue
      const v2 = upgradeV1(c.result.record)
      expect(validateRecord(v2), c.name).toEqual({ ok: true, errors: [] })
      expect(v2.leftOver).toEqual([])
      expect(v2.totals.leftOver).toBe(c.result.record.leftOver)
      expect(asJson(toV1(v2)), c.name).toBe(asJson(c.result.record))
      n++
    }
    expect(n).toBe(PATH_CASES.length - 1) // all but the destination with no point
  })

  it('solvePath, lowered by toV1, gives goldens/path-v1.json', async () => {
    const lowered = async (req: any, d: any) => {
      const p = await solvePath(req, d)
      return { record: toV1(p.record), geometry: p.geometry }
    }
    golden('path-v1.json', asJson({ source: SOURCE, cases: await runPathCases(lowered) }))
  })

  it('solvePath gives valid v2 records: goldens/path-v2.json', async () => {
    const out = await runPathCases((req, d) => solvePath(req, d))
    for (const c of out) {
      const r = (c.result as any).record as PlanRecord | undefined
      if (r) expect(validateRecord(r), c.name).toEqual({ ok: true, errors: [] })
    }
    golden('path-v2.json', asJson({ source: 'the kit\'s solvePath over fixtures/path-cases.ts', cases: out }))
  })

  it('left over: each unplaced candidate card once, with why; the count keeps v1\'s meaning', async () => {
    const out = await runPathCases((req, d) => solvePath(req, d))
    const by = (name: string) => (out.find((c) => c.name === name)!.result as any).record as PlanRecord
    for (const [i, c] of PATH_CASES.entries()) {
      const r = (out[i].result as any).record as PlanRecord | undefined
      if (!r) continue
      const cards: string[] = [...new Set<string>(c.req.candidates.map((x: any) => x.card))]
      const placed = new Set(r.stops.map((s) => s.card))
      expect(r.leftOver.map((x) => x.key), c.name).toEqual(cards.filter((k) => !placed.has(k)))
      if (c.req.order !== 'planned' || c.req.minutes === null) expect(r.leftOver.every((x) => x.reason === 'no time left'), c.name).toBe(true)
    }
    const none = by('nothing in reach: no candidates, 12 wanted')
    expect(none.leftOver).toEqual([])
    expect(none.totals.leftOver).toBe(12)
    const short = by('more wanted than have a tree in reach')
    expect(short.totals.leftOver).toBe(25 - short.stops.length)
  })

  it('left over: out of reach when every place of a card fails the planner\'s reach', async () => {
    const at = (dLat: number, dLon: number) => ({ lat: START.lat + dLat, lon: START.lon + dLon })
    const cands = [
      { card: 'Near', place: { id: 't1', ...at(0.001, 0) } },
      { card: 'Far', place: { id: 't2', ...FAR } },
      { card: 'Split', place: { id: 't3', ...FAR } },
      { card: 'Split', place: { id: 't4', ...at(0, 0.006) } },
    ]
    const req = { ...(PATH_CASES[0].req as any), minutes: 10, candidates: cands }
    const { record } = await solvePath(req, null)
    expect(record.stops.map((s) => s.card)).toEqual(['Near'])
    expect(record.leftOver).toEqual([
      { key: 'Far', kind: 'card', reason: 'out of reach' },
      { key: 'Split', kind: 'card', reason: 'no time left' },
    ])
    const untimed = await solvePath({ ...req, minutes: null, order: 'fixed', candidates: cands.slice(0, 2) }, null)
    expect(untimed.record.leftOver).toEqual([])
  })
})

describe('record v2: the validator', () => {
  const good = async () => (await solvePath(PATH_CASES[0].req as any, null)).record
  const errs = (r: unknown) => validateRecord(r).errors

  it('names what is wrong', async () => {
    const r = await good()
    expect(errs({ ...r, planVersion: 1 })).toContain('planVersion: not 2')
    expect(errs({ ...r, solver: { id: 'maze' } })).toContain('solver.id: not path or day')
    expect(errs({ ...r, start: null })).toContain('start: a path needs one')
    expect(errs({ ...r, clock: { tz: 'America/Denver', date: '10-28', startAt: 600 } })).toContain('clock: not {tz, date, startAt}')
    expect(errs({ ...r, extra: 1 })[0]).toMatch(/^keys: /)
    expect(errs({ ...r, stops: r.stops.map((s, i) => (i === 1 ? { ...s, n: 9 } : s)) })).toContain('stops[1].n: not 2')
    expect(errs({ ...r, stops: r.stops.map((s, i) => (i === 0 ? { ...s, kind: 'eat' } : s)) })).toContain('stops[0].kind: a path stop is see')
    expect(errs({ ...r, totals: { ...r.totals, stops: 99 } })).toContain('totals.stops: not the number of stops')
    expect(errs({ ...r, leftOver: [{ key: 'x', kind: 'tree' }] })).toContain('leftOver[0]: not {key, kind, reason}')
    expect(errs({ ...r, finish: { leg: { m: 1, min: 1 }, arriveMin: 3 } })).toContain('finish: an open end has none')
    expect(validateRecord('a record')).toEqual({ ok: false, errors: ['not an object'] })
  })

  it('upgradeV1 refuses a record that is not v1, and toV1 refuses a day', async () => {
    const r = await good()
    expect(() => upgradeV1(r as any)).toThrow(/planVersion 2/)
    expect(() => toV1({ ...r, solver: { id: 'day' } })).toThrow(/day record has no v1 form/)
  })
})
