// Types for core/clock.js: the zone's clock.

/** 450 is '7:30 AM' */
export declare function clock(min: number): string
export interface WallTime {
  /** YYYY-MM-DD there */
  date: string
  /** minutes past midnight there */
  min: number
  /** 'Sat' */
  weekday: string
  day: number
}
/** tz is required, an IANA name; a missing one throws a TypeError */
export declare function wall(ms: number | Date, tz: string): WallTime
/** addDays('2026-12-31', 1) is '2027-01-01' */
export declare function addDays(date: string, n: number): string
/** 'Today', 'Tomorrow', else 'Mon 2' */
export declare function dayLabel(date: string, today: string): string
