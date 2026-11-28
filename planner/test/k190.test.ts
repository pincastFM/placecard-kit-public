/**
 * 1.9.0's planner change: each of the player's own stops (a via pass) carries its own leg, the way to it from the point
 * before, and the next card's leg (or the finish's) runs on from it, so the legs in the list's order sum to the totals.
 * A request with no vias never reaches the via solver: the no-via records below were written as a golden on the kit at
 * 1.8.0 (4c5e9c7, UPDATE_GOLDENS=1, this file's "no vias" block alone) and must match byte for byte.
 */
import { describe, expect, it, vi } from 'vitest'
import { solvePath } from '../path/index'
import { validateRecord } from '../record'
import { asJson, golden } from './golden'
import { MADE_AT, PATH_CASES, streets } from './fixtures/path-cases'

const caseReq = (name: string): any => {
  const c = PATH_CASES.find((x) => x.name === name)
  if (!c) throw new Error(`no case ${name}`)
  return { ...c.req }
}
const caseOf = (name: string) => {
  const c = PATH_CASES.find((x) => x.name === name)
  if (!c) throw new Error(`no case ${name}`)
  return c
}
const strip = (r: any) => ({ ...r, id: null, madeAt: null })
const V1 = { lat: 40.74, lon: -73.987, label: 'Park' }
const V2 = { lat: 40.733, lon: -73.984, label: 'Corner' }
const V3 = { lat: 40.738, lon: -73.995, label: 'Gate' }
const NY = 'America/New_York'
const NOW = Date.UTC(2026, 10, 28, 14, 0) // 9:00 AM in New York

// The legs in the list's order: each card's, each middle pass's own, then the finish's (an open end's last via is the
// end, its leg the finish's, so it is counted once)
function listLegs(p: any) {
  const r = p.record
  const passes = (p.vias || []) as any[]
  const endVia = r.end.kind === 'destination' && passes.length && passes[passes.length - 1].arriveMin === r.finish?.arriveMin && passes[passes.length - 1].after === r.stops.length
    ? passes[passes.length - 1] : null
  const mids = passes.filter((v) => v !== endVia)
  const out: { kind: 'card' | 'via' | 'finish'; leg: { m: number; min: number }; arriveMin: number; dwell: number }[] = []
  r.stops.forEach((s: any, i: number) => {
    for (const v of mids) if (v.after === i) out.push({ kind: 'via', leg: v.leg, arriveMin: v.arriveMin, dwell: 0 })
    out.push({ kind: 'card', leg: s.leg, arriveMin: s.arriveMin, dwell: s.dwellMin })
  })
  for (const v of mids) if (v.after >= r.stops.length) out.push({ kind: 'via', leg: v.leg, arriveMin: v.arriveMin, dwell: 0 })
  if (r.finish) out.push({ kind: 'finish', leg: r.finish.leg, arriveMin: r.finish.arriveMin, dwell: 0 })
  return { out, endVia }
}

describe('a via\'s own leg', () => {
  const cases: [string, any, () => any][] = [
    ['a loop through two vias, on the estimate', { ...caseReq('back to the start, planned, 45 min, on the estimate'), vias: [V1, V2] }, () => null],
    ['a loop through three vias, streets at 1.5', { ...caseReq('back to the start, planned, 45 min, on the estimate'), vias: [V3, V1, V2] }, () => streets(() => 1.5)],
    ['an open end through two vias, untimed', { ...caseReq('open, planned, untimed'), vias: [V1, V2] }, () => null],
    ['a destination through one via, streets at 1.2', { ...caseReq('a destination, planned, 40 min, streets at 1.2'), vias: [V2] }, () => streets(() => 1.2)],
    ['a run through two vias, streets at 1.1', { ...caseReq('open, planned, 30 min, on the estimate'), mode: 'run', end: { kind: 'start' }, vias: [V1, V2] }, () => streets(() => 1.1)],
  ]
  for (const [name, req, d] of cases) {
    it(`${name}: every pass has a leg, and the list's legs sum to the totals`, async () => {
      const p = await solvePath(req, d())
      expect(validateRecord(p.record)).toEqual({ ok: true, errors: [] })
      expect(p.vias!.length).toBe(req.vias.length)
      for (const v of p.vias!) {
        expect(v.leg, `via ${v.n}`).toBeDefined()
        expect(v.leg!.m).toBeGreaterThanOrEqual(0)
        expect(v.leg!.min).toBeGreaterThanOrEqual(0)
      }
      const { out, endVia } = listLegs(p)
      if (endVia) expect(endVia.leg).toEqual(p.record.finish!.leg)
      const n = out.length
      const m = out.reduce((a, x) => a + x.leg.m, 0)
      const min = out.reduce((a, x) => a + x.leg.min, 0)
      // each leg is rounded on its own (whole metres, tenths of a minute); the totals round the sum
      expect(Math.abs(m - p.record.totals.m)).toBeLessThanOrEqual(n * 0.5 + 0.5)
      expect(Math.abs(min - p.record.totals.walkMin)).toBeLessThanOrEqual(n * 0.05 + 0.05)
      // each entry arrives its leg after the one before (and the card before's minutes there)
      let prev = 0
      for (const x of out) {
        expect(Math.abs(x.arriveMin - (prev + x.leg.min))).toBeLessThanOrEqual(0.15)
        prev = x.arriveMin + x.dwell
      }
    })
  }

  it('a card after a via runs on from the via, not through it: shorter than 1.8.0\'s through-leg', async () => {
    const req = { ...caseReq('back to the start, planned, 45 min, on the estimate'), vias: [V1, V2] }
    const p = await solvePath(req, null)
    const { out } = listLegs(p)
    const k = out.findIndex((x, i) => x.kind === 'card' && i > 0 && out[i - 1].kind === 'via')
    expect(k).toBeGreaterThan(0)
    // the via's leg plus the card's is the way from the point before the via to the card (1.8.0's card leg)
    const through = out[k - 1].leg.m + out[k].leg.m
    expect(out[k].leg.m).toBeLessThan(through)
  })

  it('transit: passes carry legs from the router\'s legs too', async () => {
    const router = async (q: any) => {
      const d = Math.hypot((q.to.lat - q.from.lat) * 111000, (q.to.lon - q.from.lon) * 84000)
      const start = Date.parse(`${q.date}T${q.time}:00Z`)
      const min = d / 250
      return [{ m: d, min, startTime: start, endTime: start + min * 60000, walkM: 0, waitMin: 0, transfers: 0, legs: [], geometry: [] }]
    }
    const p = await solvePath({ ...caseReq('back to the start, planned, 45 min, on the estimate'), mode: 'transit', vias: [V1, V2], when: { kind: 'leaveAt', tz: 'UTC', at: 600, date: '2026-11-28', now: Date.UTC(2026, 10, 28, 9, 0) } }, null, { transit: router })
    expect(p.vias!.every((v) => v.leg && v.leg.min >= 0)).toBe(true)
    const { out } = listLegs(p)
    const min = out.reduce((a, x) => a + x.leg.min, 0)
    expect(Math.abs(min - p.record.totals.walkMin)).toBeLessThanOrEqual(out.length * 0.05 + 0.05)
  })
})

describe('no vias: the records are 1.8.0\'s', () => {
  it('every path case, and each again as a run and with a leave-at time rule, matches the golden written on 1.8.0', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers({ now: new Date(MADE_AT), toFake: ['Date'] })
    const out: unknown[] = []
    try {
      for (const c of PATH_CASES) {
        const variants: [string, any][] = [
          ['as given', { ...c.req }],
          ['run', { ...c.req, mode: 'run' }],
          ['leave at 10:00', { ...c.req, when: { kind: 'leaveAt', tz: NY, at: 600, date: '2026-11-28', now: NOW } }],
        ]
        for (const [v, req] of variants) {
          try {
            const p = await solvePath(req, caseOf(c.name).directions())
            out.push({ name: c.name, variant: v, record: strip(p.record), geometry: p.geometry, timingError: p.timingError, vias: p.vias ?? null })
          } catch (e: any) {
            out.push({ name: c.name, variant: v, error: String(e?.message || e) })
          }
        }
      }
    } finally {
      vi.useRealTimers()
      quiet.mockRestore()
    }
    golden('k190-novia.json', asJson(out))
  })
})
