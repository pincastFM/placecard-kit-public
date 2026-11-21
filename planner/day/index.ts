// The day solver as a v2 record (record.ts fromDay), and NYID's shape (day.ts handToDay).
import { dayCore } from './day'
import type { DayInput } from './day'
import type { DayRules } from './rules'
import type { PlanRecord } from '../../contract/record'
import { fromDay } from '../record'
import type { RecordMeta } from '../record'

export { handToDay, dayCore, handEntry } from './day'
export type { Day, DayCore, DayInput, DaySlot, DayLeftOver, DayWindow, HandEntry, CoreSlot } from './day'
export { DAY_DEFAULTS, DAY_HOURS, fullRules } from './rules'
export type { DayRules, DayLabels, Meal, Hours, Occurrence, ChipFamily, LatLng } from './rules'

/** A hand's day, as a v2 record. toDay(record, rules) gives handToDay's result back. */
export function solveDay(rules: DayRules, p: DayInput, meta: RecordMeta): PlanRecord {
  return fromDay(dayCore(rules, p), meta)
}
