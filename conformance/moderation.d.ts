// Types for the moderation conformance suite (conformance/moderation.js). The suite is plain JS; this is what an
// instance hands it.
import type { Moderation, ModClient } from '@pincast/placecard-kit/contract'

export interface ModConformanceActor { sub: string; name: string; admin: boolean }

export interface ModConformanceDatabase {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>
  exec(text: string): Promise<unknown>
  transaction<T>(fn: (client: ModClient) => Promise<T>): Promise<T>
  /** an empty database again: the suite runs sql/moderation.sql and setup() after it */
  reset(): Promise<unknown>
  close?(): Promise<unknown>
}

export interface ModConformanceKind {
  /** one new content row as the host writes it before its submit, in the suite's transaction; its ref */
  insert(tx: ModClient, row: { owner: ModConformanceActor; n: number }): Promise<string | number>
  /** the refs the instance's public read returns for this kind */
  shown(db: ModConformanceDatabase): Promise<(string | number)[]>
  /** every content ref of the kind, to prove each has an item */
  all?(db: ModConformanceDatabase): Promise<(string | number)[]>
  /** a report reason the kind takes (default 'other') */
  reason?: string
  /** the kind's owners edit, or take down (the Studio's cards) */
  edit?: boolean
  takedown?: boolean
}

export interface ModConformanceInstance {
  name: string
  /** the instance's createModeration over the suite's database, as its server builds it */
  moderation(db: { db: ModConformanceDatabase; transaction: ModConformanceDatabase['transaction'] }): Moderation
  /** the instance's content tables, after sql/moderation.sql */
  setup?(db: ModConformanceDatabase): Promise<unknown>
  kinds: Record<string, ModConformanceKind>
  /** default: PGlite in memory (@electric-sql/pglite in the instance's devDependencies) */
  database?(): Promise<ModConformanceDatabase>
}

export declare const MOD_CONFORMANCE_ACTORS: Readonly<Record<'owner' | 'other' | 'admin', Readonly<ModConformanceActor>>>
export declare function modDDL(): string
export declare function modConformance(instance: ModConformanceInstance): void
