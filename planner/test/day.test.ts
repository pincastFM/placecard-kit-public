/**
 * The day solver: NYID's handToDay moved into the kit with a DayRules object in place of the
 * Provo deal's imports. With Provo's rules (built here from NYID's own llZoneDeal.js and
 * llZoneChips.js at 02292349) it must give NYID's tests/goldens/provo-day.json back byte for byte:
 * every golden day reruns from the golden's own `input`, and each demo day from its `hand`.
 *
 * The inputs, as NYID's golden test built them (tests/tabletopGoldens.test.js):
 * - 'zone' cards: tests/fixtures/tabletop-provo.json's cards, each with its interests from
 *   server/data/zones/provo.json's tags (as the zone API adds them)
 * - 'table' cards: the Selection's tabletop cards in set provo-foundational, read from NYID's
 *   provo-zone.json golden (its `selection`), since the kit has no ttFromZone
 *
 * Then the record: solveDay's v2 record is valid, and toDay(record) gives handToDay's result back.
 * goldens/day-v2.json freezes those records.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NYID, hasPin, pinFiles } from './pinned'
import { asJson, golden } from './golden'
import { DAY_HOURS, handToDay, solveDay } from '../day/index'
import type { DayRules } from '../day/index'
import { toDay, validateRecord } from '../record'

const DEAL = 'components/likealocal/llZoneDeal.js'
const PINNED = [
  DEAL,
  'components/likealocal/llZoneChips.js',
  'utils/tabletop/day.js',
  'utils/tabletop/hand.js',
  'tests/fixtures/tabletop-provo.json',
  'server/data/zones/provo.json',
  'tests/goldens/provo-day.json',
  'tests/goldens/provo-zone.json',
]
const haveNyid = hasPin(NYID)
const META = { id: 'day-test', app: 'verythere', set: 'provo-foundational', madeBy: null, madeAt: '2026-10-28T12:00:00.000Z' }

let dir = ''
let rules: DayRules
let theirs: { handToDay: (p: any) => any; DAY_HOURS: unknown }
let gold: { days: { name: string; input: any; day: unknown }[]; demo: { win: any; hand: any[]; day: unknown }[] }
let goldText = ''
let ZONE: { cards: any[]; events: any[] }
let TABLE: any[]
let center: { lat: number; lng: number }

const read = (p: string) => readFileSync(resolve(dir, p), 'utf8')

// Every day the golden holds, as the call that made it: [name, the call's input]
function calls(): [string, any][] {
  const out: [string, any][] = []
  for (const d of gold.days) {
    const { cards, ...p } = d.input
    out.push([d.name, { cards: cards === 'table' ? TABLE : ZONE.cards, events: ZONE.events, center, ...p }])
  }
  for (const d of gold.demo) out.push([`demo ${d.win.date}`, { hand: d.hand, cards: ZONE.cards, events: ZONE.events, center, win: d.win, seed: 1 }])
  return out
}

// The golden's file rebuilt from a handToDay: each day from its input, each demo day from its hand
function rebuild(day: (p: any) => unknown): string {
  const [days, demo] = [gold.days, gold.demo]
  const all = calls()
  return asJson({
    days: days.map((d, i) => ({ name: d.name, input: d.input, day: day(all[i][1]) })),
    demo: demo.map((d, i) => ({ win: d.win, hand: d.hand, day: day(all[days.length + i][1]) })),
  })
}

describe.skipIf(!haveNyid)('day solver: against A0\'s Provo goldens (NYID 02292349)', () => {
  beforeAll(async () => {
    dir = pinFiles(NYID, PINNED)
    const deal = await import(/* @vite-ignore */ `${dir}/${DEAL}`)
    const chips = await import(/* @vite-ignore */ `${dir}/components/likealocal/llZoneChips.js`)
    theirs = await import(/* @vite-ignore */ `${dir}/utils/tabletop/day.js`)
    // Provo's rules: the 14 deal symbols and CHIP_FAMILY that day.js imported, as one object
    rules = {
      tz: deal.DEAL_TZ, meals: deal.DEAL_MEALS, gap: deal.DEAL_GAP, seeMin: deal.DEAL_SEE_MIN, alts: deal.DEAL_ALTS,
      seeChips: deal.DEAL_SEE_CHIPS, dayEnd: deal.DEAL_DAY_END, chipFamily: chips.CHIP_FAMILY, hours: DAY_HOURS,
      occurrences: deal.occurrences, walkMinutes: deal.walkMinutes, meters: deal.meters, rng: deal.rng, clock: deal.clock,
      rank: deal.dealRank, ring: deal.dealRing,
    }
    const fx = JSON.parse(read('tests/fixtures/tabletop-provo.json'))
    const extras = JSON.parse(read('server/data/zones/provo.json'))
    ZONE = { cards: fx.cards.map((c: any) => ({ ...c, interests: extras.tags[c.key] || [] })), events: fx.events }
    center = fx.set.center
    TABLE = JSON.parse(read('tests/goldens/provo-zone.json')).selection.cards.filter((c: any) => c.set === 'provo-foundational')
    goldText = read('tests/goldens/provo-day.json')
    gold = JSON.parse(goldText)
  })

  it('reads the inputs as A0 built them', () => {
    expect(gold.days).toHaveLength(13)
    expect(gold.demo).toHaveLength(3)
    expect(ZONE.cards).toHaveLength(40)
    expect(ZONE.events).toHaveLength(4)
    // the table cards: one per zone card, each read through its ref
    expect(TABLE).toHaveLength(ZONE.cards.length)
    expect(TABLE.map((c) => c.ref.key).sort()).toEqual(ZONE.cards.map((c) => c.key).sort())
    for (const c of TABLE) {
      expect(Object.keys(c.ref)).toEqual(expect.arrayContaining(['key', 'chip', 'lat', 'lng']))
      expect(typeof c.title).toBe('string')
    }
    expect(DAY_HOURS).toEqual(theirs.DAY_HOURS)
  })

  it('NYID\'s own handToDay gives provo-day.json from these inputs (the harness is right)', () => {
    expect(rebuild((p) => theirs.handToDay(p))).toBe(goldText)
  })

  it('the kit\'s handToDay with Provo\'s rules gives provo-day.json byte for byte', () => {
    const ours = rebuild((p) => handToDay(rules, p))
    if (ours !== goldText) expect(ours).toBe(goldText)
  })

  it('solveDay gives a valid v2 record, and toDay gives handToDay\'s day back', () => {
    for (const [name, p] of calls()) {
      const record = solveDay(rules, p, META)
      expect(validateRecord(record), name).toEqual({ ok: true, errors: [] })
      expect(asJson(toDay(record, rules)), name).toBe(asJson(handToDay(rules, p)))
    }
  })

  it('the records: goldens/day-v2.json', () => {
    golden('day-v2.json', asJson({
      source: 'the kit\'s solveDay with Provo\'s rules over A0\'s provo-day.json inputs',
      cases: calls().map(([name, p]) => ({ name, record: solveDay(rules, p, META) })),
    }))
  })

  it('the record keeps lon, a slot\'s place, the window as a clock, and what was left out', () => {
    const [name, p] = calls()[0]
    const r = solveDay(rules, p, META)
    expect(r.clock, name).toEqual({ tz: 'America/Denver', date: '2026-10-26', startAt: 13 * 60 })
    expect(r.start).toEqual({ lat: center.lat, lon: center.lng })
    expect(r.minutes).toBe(8 * 60)
    expect(r.stops[0].arriveMin).toBe(0)
    for (const s of r.stops) expect(s.place && Object.keys(s.place)).toEqual(['id', 'lat', 'lon'])
    const none = solveDay(rules, calls().find(([n]) => n === 'no window')![1], META)
    expect(none.clock).toBeNull()
    expect(none.minutes).toBeNull()
    expect(none.leftOver.map((x) => x.reason)).toEqual(['no window'])
    expect(none.totals.leftOver).toBe(1)
    // a day with no center starts nowhere and still plans
    const loose = solveDay(rules, { ...p, center: null }, META)
    expect(loose.start).toBeNull()
    expect(validateRecord(loose)).toEqual({ ok: true, errors: [] })
  })
})
