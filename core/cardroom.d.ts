// Types for core/cardroom.js: what the Card room draws (pile tilt, the held bar, the box-score head, the ledger, chips).
import type { TtCoreCard, TtCoreData, TtFacetOptions, TtGroup } from './core.js'

export declare const CR_FONTS: string
export declare const CR_GAP: number
export declare const CR_DEFAULT_W: Readonly<{ phone: number; laptop: number }>
export declare const CR_LAPTOP: string
export declare const CR_EASE: Readonly<{ out: string; in: string; end: string; settle: string }>

/** Four values in [-1, 1]: the cover's and three edges' */
export declare function crSeeds(key: unknown): [number, number, number, number]

/** A turn in deg (r), then a shift in px (a, b) */
export interface CrTilt { r: number; a: number; b: number }
export declare const CR_REST: Readonly<CrTilt>
export declare function crLayer(k: number, sd: readonly number[]): CrTilt
export declare function crCardTilt(id: unknown): CrTilt
export declare function crTransform(x: number, y: number, t?: Readonly<CrTilt>): string
/** Paper edges under a printing stack: one per doubling of its count, 6 at most */
export declare function crPrintEdges(n: unknown): number

export interface CrPileLayer<C> { card: C; k: number; t: Readonly<CrTilt>; transform: string }
export interface CrPile<C> { layers: CrPileLayer<C>[]; edges: number[]; cover: Readonly<CrTilt>; coverTransform: string }
export declare function crPile<C>(groupId: unknown, cards: readonly C[] | null | undefined, o?: { edges?: boolean }): CrPile<C>

/** The inline style a .tt-bar reads */
export interface CrBarStyle { '--n': number; background: string }
/** null without a total above 0 */
export declare function crBar(o?: { held?: number; total?: number | null; nums?: ReadonlySet<number> | null }): CrBarStyle | null
/** Held numbers per set: card.number in its own set, card.numbers[id] in its other sets (1.2.0) */
export declare function crHeldNumbers(cards: readonly (TtCoreCard | null | undefined)[] | null | undefined): Map<string | undefined, Set<number>>

export interface CrHead {
  name: string | undefined
  sub: string
  n: number
  of: number | null
  unit: 'HELD' | null
  shown: number | null
  gold: boolean
  color: string | null | undefined
  bar: CrBarStyle | null
  label: string | undefined
  /** A set's points, only when its set has them */
  pts?: number
}
export declare function crHead(
  group: TtGroup<any> | null | undefined,
  data?: TtCoreData,
  heldNums?: ReadonlyMap<string | undefined, ReadonlySet<number>> | null,
  o?: { missingOnly?: boolean },
): CrHead

export interface CrLedgerColumn {
  id: string
  key: string
  name: string | undefined
  color: string | null | undefined
  n: number
  of: number | null | undefined
  bar: CrBarStyle | null
  off: boolean
  label: string | undefined
}
export declare function crLedger(
  columns: readonly TtGroup<any>[] | null | undefined,
  present: ReadonlySet<string>,
  data?: TtCoreData,
  heldNums?: ReadonlyMap<string | undefined, ReadonlySet<number>> | null,
  fig?: ((group: TtGroup<any>) => { n?: number | null; of?: number | null } | null | undefined) | null,
): CrLedgerColumn[]

export interface CrChip { name: string; value: string | undefined; on: boolean }
export declare function crChip(
  facet: string,
  picked: readonly (string | number)[] | null | undefined,
  facets?: Partial<Record<string, readonly { id: string | number; label?: string }[]>> | Partial<TtFacetOptions>,
  data?: TtCoreData,
): CrChip
export declare function crMissingCount(cards: readonly TtCoreCard[] | null | undefined): number
export declare function crKindRows<O extends { group?: string | null; groupLabel?: string | null }>(
  options: readonly O[] | null | undefined,
): { key: string; label: string; options: O[] }[]
