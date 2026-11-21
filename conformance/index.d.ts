// Types for the conformance subpath (kit CONTRACT.md). The suite is plain JS; this is what an
// instance hands it.
import type { TabletopConfig, TtTheme } from '@pincast/placecard-kit/contract'

export declare const CONTRACT_VERSION: string
export declare const TT_CONFORMANCE_MADE_AT: string
export declare const TT_CONFORMANCE_BASES: readonly ['cardroom', 'table']
export declare const TT_CLASS_NS: RegExp

export type TtSheet = string | { name?: string; text: string }

export interface TtPlanCase {
  name: string
  /** the day solver's DayInput, or the path solver's PlanRequest */
  input: unknown
  /** a day record's { id, set, madeAt } */
  meta?: { id?: string; set?: string; madeAt?: string; [k: string]: unknown }
}

export interface TtConformanceInstance {
  /** the goldens' prefix and the suite's title */
  name: string
  config: TabletopConfig
  /** what config.source.load() returns for the fixture */
  collection: unknown
  /** the instance's own stylesheets for its table */
  css?: TtSheet[]
  /** the kit sheet under them: 'cardroom' (the Card room theme supplies the 22) or 'table' (yours supply all 22) */
  base: 'cardroom' | 'table'
  /** the instance's classes inside the kit's namespaces (tt-, ttf-) */
  own?: string[]
  plans?: TtPlanCase[]
  /** replaces the path solver's Directions adapter for the run (null: the estimate) */
  directions?: unknown
  /** TtTable props and slots the instance adds when it renders its Tabletop */
  props?: Record<string, unknown>
  slots?: Record<string, (...a: any[]) => unknown>
  /** the directory of its conformance goldens */
  goldens: string
}

export interface TtCssRule { selectors: string[]; decls: { prop: string; value: string; important: boolean }[]; at: string[] }

export declare function ttConformance(instance: TtConformanceInstance): void
export declare function ttConformanceEnv(): { laptop: boolean; restore(): void }
export declare function ttThemeErrors(input: { css?: TtSheet[]; base: string; theme?: TtTheme }): string[]
export declare function ttClassErrors(input: { css?: TtSheet[]; own?: string[]; theme?: TtTheme; rendered?: string[] }): string[]
export declare function ttHandPayloadErrors(raw: string | null, expected?: { zone?: string; entries?: { key: string; kind: 'card' | 'event' }[] }): string[]
export declare function ttRecordErrors(record: unknown, expected?: { app?: string; set?: string | null }): string[]
export declare function ttDayRulesErrors(rules: unknown): string[]
export declare function ttThemeClasses(theme: TtTheme | undefined): string[]
export declare function ttSheets(css: TtSheet | TtSheet[] | null | undefined): { name: string; text: string }[]
export declare function ttCssRules(text: string): TtCssRule[]
export declare function ttCssConditional(at: string[]): boolean
export declare function ttSelectorClasses(selector: string): string[]

export * from './moderation.js'
