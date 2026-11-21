/**
 * The planner's additions for Treehopper's route planner: planInput (a hand or a pile to card keys), an adapter
 * that names its timing, and a failed timing that comes back as timingError. plan.ts stays Treehopper's file byte
 * for byte (path.test.ts), so the last two live in solvePath's wrapper of the adapter; the goldens' adapters name
 * nothing and never fail, so their records are as before.
 */
import { describe, it, expect, vi } from 'vitest'
import { planInput, solvePath } from '../path/index'
import { toV1, validateRecord } from '../record'
import { PATH_CASES } from './fixtures/path-cases'

const timed = PATH_CASES.find((c) => c.name === 'open, planned, 30 min, streets at 1.1')!
const streets = timed.directions()!

describe('gap 5: planInput', () => {
  it('hand entries, cards and keys to card keys, in order, each once; events and blanks out', () => {
    expect(planInput([
      { key: 'oak', kind: 'card' }, { id: 'ash' }, 'elm', { key: 'fair', kind: 'event' },
      { key: 'oak', kind: 'card' }, '', null, { id: 'ash' }, { key: 'yew' }, 7,
    ])).toEqual(['oak', 'ash', 'elm', 'yew', '7'])
    expect(planInput(null)).toEqual([])
  })
})

describe('gap 10: the adapter names its timing', () => {
  it('a route adapter gives timing "route", valid, and lowers to v1 as "mapbox"', async () => {
    const route = async (pts: any, mode: any) => ({ ...(await streets(pts, mode)), timing: 'route' as const })
    const p = await solvePath(timed.req as any, route)
    expect(p.record.totals.timing).toBe('route')
    expect(validateRecord(p.record)).toEqual({ ok: true, errors: [] })
    expect(toV1(p.record).totals.timing).toBe('mapbox')
  })

  it('an adapter that names nothing gives "mapbox"; none gives "estimate"', async () => {
    expect((await solvePath(timed.req as any, streets)).record.totals.timing).toBe('mapbox')
    expect((await solvePath(timed.req as any, null)).record.totals.timing).toBe('estimate')
  })
})

describe('gap 11: a failed timing comes back as timingError', () => {
  it('the message when the estimate stands; null when timed or untimed', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const failed = await solvePath(timed.req as any, async () => { throw new Error('mapbox 503') })
      expect(failed.record.totals.timing).toBe('estimate')
      expect(failed.timingError).toBe('mapbox 503')
      expect((await solvePath(timed.req as any, streets)).timingError).toBeNull()
      expect((await solvePath(timed.req as any, null)).timingError).toBeNull()
    } finally {
      quiet.mockRestore()
    }
  })
})

describe('A4.4: the geo helpers Treehopper\'s server reads', () => {
  it('the planner entry exports path/geo\'s MODES, meters, estMin, estM and reachM, the same functions', async () => {
    const entry = await import('../index')
    const geo = await import('../path/geo')
    for (const k of ['MODES', 'meters', 'estMin', 'estM', 'reachM'] as const) expect(entry[k]).toBe(geo[k])
    expect(entry.reachM(10, 'walk')).toBeCloseTo(geo.reachM(10, 'walk'))
  })
})
