// Types for core/core.js: the table's mechanics (slider, filters, sort, groups, piles, deal, counts, the nest).
// The card and collection shapes here are the fields core reads; an app's own card type passes when its fields fit.
import type { TtFaceEntry, TtGroupId, TtSortId } from '@pincast/placecard-kit/contract'

/** A card as core reads it. Every field but id is optional; an app's card keeps its own fields. */
export interface TtCoreCard {
  id: string
  app?: string
  set?: string
  /** the other sets the card files under */
  sets?: readonly string[] | null
  /** 1.2.0: the card's number in each of its other sets, by set id (its own set's is number) */
  numbers?: Readonly<Record<string, number>> | null
  /** false: a missing card (the table prints it whole) */
  held?: boolean
  title?: string
  rarity?: string | null
  rarityRank?: number | null
  number?: number | string | null
  kind?: string | number | null
  interests?: readonly (string | number)[] | null
  /** when it was collected, for 'newest' */
  added?: number | string | null
  /** the first-find date, YYYY-MM-DD (the Treehopper stamp) */
  collected?: string | null
  face?: string | null
  print?: boolean
  accent?: string | null
  foil?: boolean
  img?: unknown
  of?: unknown
  collector?: { n?: number | string | null; of?: number | string | null } | null
  mark?: string | null
  credit?: string | null
  creditMark?: string | null
  /** 1.2.0: a missing Treehopper card's empty spot, the distance the host gives ("0.3 mi") */
  spot?: string | null
  /** 1.2.0: true, a held card with no number stamps its first-find date alone (a tree card); unset, no stamp */
  dateStamp?: boolean | null
  /** 1.2.0: true, a Treehopper face prints the credit as given ("Photo: alias"); unset, without a leading "Photo:" */
  creditAsGiven?: boolean | null
  /** one level under the card (ttNest) */
  children?: readonly TtCoreCard[] | null
  childTotal?: number | string | null
}

/** site (1.4.0): the app's web address, printed on the Studio face's foot ("STUDIO · PLACECARD.IO") */
export interface TtCoreApp { id: string; name?: string; color?: string | null; site?: string | null }
export interface TtCoreSet {
  id: string
  app?: string
  name?: string
  short?: string | null
  action?: unknown
  /** the walk the set belongs to (a face's look) */
  trek?: string | number | null
  total?: number | null
  /** the set's points */
  pts?: number | string | null
  meta?: { face?: string; [k: string]: unknown }
}
/** A zone card's chip: its row on the page ("Things to do", "Eat & drink") */
export interface TtCoreKind { id: string | number; label?: string; group?: string | null; groupLabel?: string | null }
export interface TtCoreInterest { id: string | number; label?: string }

/** The collection, or the parts of it a call reads */
export interface TtCoreData {
  apps?: readonly TtCoreApp[]
  sets?: readonly TtCoreSet[]
  rarities?: Record<string, readonly string[]>
  kinds?: readonly TtCoreKind[]
  interests?: readonly TtCoreInterest[]
  cards?: readonly TtCoreCard[]
  faces?: Record<string, TtFaceEntry> | readonly TtFaceEntry[]
  /** ttGroup: the filter in force, so Missing is not counted as a reduction */
  filter?: TtFilter<any>
}

/** One id, a list of them, or empty for all */
export type TtPick = string | number | readonly (string | number)[] | null | undefined

export interface TtFilter<C = TtCoreCard> {
  from?: TtPick
  set?: TtPick
  rarity?: TtPick
  kind?: TtPick
  interests?: TtPick
  /** false: held only; true: adds the unheld cards of started sets; 'only': those alone */
  missing?: boolean | 'only'
  /** a substring of the title, case and accents ignored */
  q?: string | null
  /** the table's own test; anything but a function is ignored here */
  only?: ((card: C) => boolean) | boolean | null
}

export interface TtRange { min: number; max: number }

export declare const TT_STOPS: number[]
export declare const TT_MAX_W: number
export declare const TT_LAPTOP_MIN: number
export declare const TT_SNAP: number
export declare const TT_MOTION: {
  bloom: number; flipOut: number; flipIn: number; fileIn: number; snap: number; step: number
  reduced: { bloom: number; flip: number; regroup: number }
  staggerCap: number
}
export declare function ttRange(innerWidth: number, gap?: number): TtRange
export declare function ttClampW(value: number, range: TtRange): number
export declare function ttStops(range: TtRange, list?: readonly number[]): { w: number; at: number }[]
export declare function ttSnap(value: number, range: TtRange, list?: readonly number[]): number
export declare function ttAcross(cardW: number, innerWidth: number, gap?: number): number
export declare function ttAcrossStops(innerWidth: number, gap?: number, across?: readonly number[]): number[]
export declare function ttStageWidth(vw: number, vh: number): number

export declare function ttFold(s: unknown): string
/** Its set, then any in card.sets, once each (a card without a set gives [undefined]) */
export declare function ttSetsOf(c: TtCoreCard | null | undefined): (string | undefined)[]
export declare function ttStartedSets(cards: readonly TtCoreCard[] | null | undefined): Set<string | undefined>
export declare function ttFilter<C extends TtCoreCard>(cards: readonly C[] | null | undefined, filter?: TtFilter<C>): C[]

export interface TtFacetOptions {
  from: { id: string; label: string | undefined }[]
  set: { id: string; label: string | undefined; app: string | undefined }[]
  rarity: { id: string; label: string; top: boolean }[]
  kind: { id: string; label: string | undefined; group: string | null; groupLabel: string | null }[]
  interests: { id: string; label: string | undefined }[]
}
export declare function ttFacets(cards: readonly TtCoreCard[] | null | undefined, data?: TtCoreData): TtFacetOptions

export declare function ttSort<C extends TtCoreCard>(cards: readonly C[] | null | undefined, by?: TtSortId, data?: TtCoreData): C[]
export declare function ttPin<C extends TtCoreCard>(cards: readonly C[] | null | undefined, ids: readonly (string | number)[] | null | undefined): C[]

export interface TtRarityStep { word: string; top: boolean; rank: number }
export declare function ttRarityLadder(rarities?: Record<string, readonly string[]> | null): TtRarityStep[]

/** One pile (ttGroup): 'none' groups as kind 'all' */
export interface TtGroup<C extends TtCoreCard = TtCoreCard> {
  id: string
  kind: Exclude<TtGroupId, 'none'> | 'all'
  label: string | undefined
  app: string | null | undefined
  /** held cards of the group in the whole collection */
  held: number
  /** a set's total; null for app, rarity and none */
  total: number | null
  shown: number
  /** a filter hides some */
  reduced: boolean
  cards: C[]
  /** a set's */
  short?: string | null
  action?: unknown
  trek?: string | number | null
  /** a rarity's: the gold words */
  top?: boolean
  /** a kind's row */
  group?: string | null
  groupLabel?: string | null
}
export declare function ttGroup<C extends TtCoreCard>(cards: readonly C[] | null | undefined, by?: TtGroupId, data?: TtCoreData): TtGroup<C>[]

/** Three values in [-1, 1], the same for a group id on every device */
export declare function ttPileSeed(groupId: unknown): [number, number, number]

export declare const TT_DEAL: Readonly<{ ms: number; each: number }>
export interface TtDealStep<Id = string> { id: Id; delay: number; duration: number }
export declare function ttDeal<C extends { id: unknown; number?: unknown }>(
  cards: readonly (C | null | undefined)[] | null | undefined,
  o?: { ms?: number; each?: number; reduced?: boolean },
): TtDealStep<C['id']>[]

export interface TtCounts { cards: number; missing: number }
export declare function ttCounts(cards: readonly (TtCoreCard | null | undefined)[] | null | undefined): TtCounts
/** "118 cards", with Missing on "118 cards · 6 missing" */
export declare function ttCountLabel(counts: TtCounts, missingOn?: boolean): string

export interface TtRowPlace<C> { index: number; total: number; prev: C | null; next: C | null }
export declare function ttRow<C extends { id: unknown }>(cards: readonly C[] | null | undefined, id: C['id']): TtRowPlace<C>

export interface TtNest<K> { cards: K[]; total: number | null; error: string | null }
/** A card's children, one level only; an error leaves cards empty */
export declare function ttNest<K extends TtCoreCard>(
  card: { id: string | number; children?: readonly K[] | null; childTotal?: number | string | null } | null | undefined,
): TtNest<K>
