// Types for vue/createTabletop.js (kit CONTRACT.md).
import type { Component, Ref, ShallowRef } from 'vue'
import type { TabletopConfig, TtCollection } from '@pincast/placecard-kit/contract'
import type { DayInput, PathPlan, PlanRecord, PlanRequest, RecordMeta } from '@pincast/placecard-kit/planner'

export interface TtHandEntry { key: string; kind: 'card' | 'event' }

/** useTtHand's return */
export interface TtHand {
  hand: Ref<TtHandEntry[]>
  ready: Ref<boolean>
  key: Readonly<Ref<string>>
  count: Readonly<Ref<number>>
  restore(known?: { cardKeys?: unknown; eventKeys?: unknown }): TtHandEntry[]
  has(key: string, kind?: 'card' | 'event'): boolean
  add(entry: TtHandEntry | string, index?: number): void
  remove(key: string, kind?: 'card' | 'event'): void
  move(from: number, to: number): void
  toggle(entry: TtHandEntry | string): void
  clear(): void
}

/** The mounted table's handle (TtTable's exposed) */
export interface TtTableHandle {
  t: Record<string, any>
  T: Record<string, any>
  change(fn: () => void): unknown
  openCard(id: string, el?: Element | null): unknown
  deal(opts?: Record<string, unknown>): unknown
  openNest(id: string): boolean
  closeNest(): boolean
  over(id: string, opts?: { back?: boolean }): boolean
  pop(): boolean
  $el?: Element
}

export interface Tabletop {
  contractVersion: string
  config: TabletopConfig
  collection: ShallowRef<TtCollection | null>
  loading: Ref<boolean>
  error: Ref<unknown>
  load(): Promise<TtCollection | null>
  table: ShallowRef<TtTableHandle | null>
  hand: TtHand
  /** day: a record v2; path: a Promise of { record, geometry, timingError } */
  plan(input: DayInput, meta: Partial<RecordMeta> & Pick<RecordMeta, 'id' | 'set' | 'madeAt'>): PlanRecord
  plan(input: PlanRequest): Promise<PathPlan>
  Tabletop: Component
  dispose(): void
}

export function createTabletop(config: TabletopConfig): Tabletop
