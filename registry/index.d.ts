// Types for the kit's registry subpath (registry/index.js): Placecard registry rows, a /me/cards response and an
// outside app's own set as the kit's cards and collections. The collection is the contract's (contract/tabletop.ts).
import type { TtAppId, TtCollection, TtFaceEntry, TtFaceId, TtKitFaceId } from '@pincast/placecard-kit/contract'

export declare const CONTRACT_VERSION: string
/** Placecard's home, https://placecard.io. A card's page is <base>/card/<app>/<set>/<key> */
export declare const TT_PLACECARD_BASE: string
/** Placecard's rarity order, low to high: Widespread, Common, Numerous, Uncommon, Rare, Very Rare, Unique */
export declare const TT_PLACECARD_RARITIES: readonly string[]
/** 'destination': the face a card takes when nothing names one */
export declare const TT_REG_DEFAULT_FACE: TtKitFaceId
/** A set id as the registry takes it (/v1/sets/:set) */
export declare const TT_REG_SET_ID_RE: RegExp
/** A card key as the registry takes it */
export declare const TT_REG_KEY_RE: RegExp
/** A card type as the registry takes it */
export declare const TT_REG_TYPE_RE: RegExp

/** A placecard_cards row */
export interface TtRegRow {
  id?: string | null
  app_id: TtAppId
  set_id: string
  card_key: string
  card_type?: string | null
  title?: string | null
  subtitle?: string | null
  fact?: string | null
  rarity?: string | null
  foil?: boolean
  image_url?: string | null
  image_credit?: string | null
  image_license?: string | null
  url?: string | null
  lat?: number | null
  lng?: number | null
  data?: Record<string, any> | null
  status?: 'active' | 'retired' | string
  /** moderation: the person reported this card */
  reportedByMe?: boolean
  /** moderation: the person's own card */
  own?: boolean
  [k: string]: unknown
}

/** A tile of GET /api/placecard/me/cards */
export interface TtRegTile {
  kind?: string
  app: TtAppId
  set: string
  key: string
  id?: string | null
  title?: string | null
  /** the row's fact when it has one, else its subtitle */
  subtitle?: string | null
  rarity?: string | null
  foil?: boolean
  image?: string | null
  lat?: number | null
  lng?: number | null
  mine?: boolean
  place?: string | null
  number?: number | null
  retired?: boolean
  sort_at?: string | null
  collected_at?: string | null
  reportedByMe?: boolean
  own?: boolean
  [k: string]: unknown
}

/** One card's fields, whichever source it came from (ttRegFields) */
export interface TtRegFields {
  app: TtAppId
  set: string
  key: string
  uuid: string | null
  type: string | null
  title: string
  subtitle: string | null
  fact: string | null
  rarity: string | null
  foil: boolean
  image: string | null
  credit: string | null
  license: string | null
  url: string | null
  lat: number | null
  lng: number | null
  data: Record<string, any>
  retired: boolean
  place: string | null
}

/** A set as the kit's table reads it */
export interface TtRegSet {
  id: string
  app: TtAppId
  name: string
  short: string
  total: number | null
  /** the app id, unless the app's rule names another kind */
  kind: string
  action: string
  /** only when the registry set's meta.face is a face that counts (ttRegFace) */
  meta?: { face: TtFaceId }
  held?: number
  [k: string]: unknown
}

/** A card as the kit's table and faces read it */
export interface TtRegCard {
  id: string
  app: TtAppId
  set: string
  face: TtFaceId
  title: string
  subtitle: string | null
  type: string | null
  fact: string | null
  back: string | null
  stats: { k: string; v: string }[]
  number: number | null
  of: number | null
  rarity: string | null
  rarityRank: number
  rarityCount: string | null
  foil: boolean
  accent: string | null
  chip: string | null
  chipLabel: string | null
  img: string | null
  credit: string | null
  href: string
  action: string
  held: boolean
  collected: string | null
  added: number | null
  ref: {
    app: TtAppId
    set: string
    key: string
    uuid: string | null
    cardType: string | null
    lat: number | null
    lng: number | null
    photo: string | null
    place: string | null
    address: string | null
    placecard: string
    retired: boolean
    own?: true
    [k: string]: unknown
  }
  reportedByMe?: true
  [k: string]: unknown
}

/** An app's record: from the registry, or the host's own */
export interface TtRegApp {
  id: TtAppId
  name?: string | null
  /** the app's mark on the table, and its cards' accent: any CSS color */
  color?: string | null
  /** the app's web address (the Studio face prints it on the foot) */
  site?: string | null
  /** its cards' face when their set names none: a kit face, or one of the options' faces */
  face?: TtFaceId | null
}

/** What a card rule is given beside the card and its fields */
export interface TtRegCardContext {
  set: TtRegSet | null
  base: string
  /** the card's Placecard page */
  page: string
  face: TtFaceId
  /** a word's place in a kind's list in the options' rarities (0 when it has none) */
  rank: (kind: string, word: string | null) => number
  options: TtRegOptions
}

/** What one app does differently, each optional */
export interface TtRegAppRule {
  /** its card's face: a kit face or one of the options' faces; null or undefined leaves it to the set, the app, the default */
  face?: (fields: TtRegFields, set: TtRegSet | null) => TtFaceId | null | undefined
  /** changes to its set: the fields to set, or changes made in place */
  set?: (set: TtRegSet, ctx: { row: Record<string, any>; meta: Record<string, any>; options: TtRegOptions }) => Partial<TtRegSet> | null | void
  /** changes to its card: the fields to set (`ref` merged into the card's), or changes made in place */
  card?: (card: TtRegCard, fields: TtRegFields, ctx: TtRegCardContext) => (Partial<Omit<TtRegCard, 'ref'>> & { ref?: Record<string, unknown> }) | null | void
  /** true leaves the card off the table (an experience and an app tile always are) */
  offTable?: (fields: TtRegFields, source: TtRegRow | TtRegTile) => boolean
}

/** The shared rules, then each call's own options */
export interface TtRegRules {
  apps?: TtRegApp[] | null
  /** the host's own faces a set may name: a list of ids, or its config's faces */
  faces?: (string | { id: string })[] | Record<string, TtFaceEntry> | null
  /** the face when nothing else names one (default 'destination') */
  face?: TtFaceId | null
  /** the photo the table shows (default: the url as given) */
  photo?: ((url: string, fields: TtRegFields) => string | null | undefined) | null
  /** word lists, low to high, by set kind */
  rarities?: Record<string, string[]> | null
  /** the words a card ranks on when its set kind has no list (default TT_PLACECARD_RARITIES) */
  ladder?: string[] | null
  rules?: Record<string, TtRegAppRule> | null
  /** Placecard's home (default TT_PLACECARD_BASE) */
  base?: string | null
}
export interface TtRegOptions extends TtRegRules {
  [k: string]: unknown
}
export interface TtRegSetOptions extends TtRegRules {
  /** a row's meta, for a /me/cards set */
  meta?: Record<string, any> | null
  total?: number | null
  held?: number | null
}
/** null or false: not held; true: held with no date; left out: a row held, a tile held when `mine` */
export type TtRegHolding = boolean | null | { collected?: string | Date | null; added?: number | null }
export interface TtRegCardOptions extends TtRegRules {
  set?: TtRegSet | null
  holding?: TtRegHolding
}
export interface TtMeCardsOptions extends TtRegRules {
  /** placecard_sets rows, for the sets' meta and names */
  sets?: { app_id?: TtAppId; app?: TtAppId; id?: string; set?: string; name?: string | null; meta?: Record<string, any> | null }[] | null
  /** registry rows (or tiles) of the person's started sets: the ones not held become Missing cards */
  cards?: (TtRegRow | TtRegTile)[] | null
  /** the sort the response was asked for */
  sort?: 'newest' | string | null
}

/** A GET /api/placecard/me/cards response (the fields read) */
export interface TtMeCardsResponse {
  tiles?: (TtRegTile | null)[] | null
  sets?: { app: TtAppId; set: string; name?: string | null; held?: number | null; total?: number | null }[] | null
  [k: string]: unknown
}

/** A card as an app sends it to PUT /v1/sets/:set */
export interface TtAppSetCard {
  key: string
  type: string
  title: string
  parent?: string | null
  subtitle?: string | null
  fact?: string | null
  rarity?: string | null
  foil?: boolean
  image?: { url?: string | null; credit?: string | null; license?: string | null } | null
  url?: string | null
  lat?: number | null
  lng?: number | null
  data?: Record<string, any> | null
  status?: 'active' | 'retired'
  [k: string]: unknown
}
/** The set an app sent to PUT /v1/sets/:set, with its id (the :set) and the app's id, unless the collects give them */
export interface TtAppSet {
  id?: string
  app?: TtAppId
  name: string
  meta?: Record<string, any> | null
  cards?: TtAppSetCard[] | null
  [k: string]: unknown
}
/** A GET /v1/sets/:set/collects response (the fields read) */
export interface TtCollectsResponse {
  app?: TtAppId
  set?: string
  cards: { key: string; collectedAt?: string | number | Date | null; [k: string]: unknown }[]
  [k: string]: unknown
}

/** The collection the registry functions give: the contract's, with the registry's cards and sets */
export interface TtRegCollection extends TtCollection {
  apps: { id: TtAppId; name: string; color: string | null; site?: string | null }[]
  sets: TtRegSet[]
  rarities: Record<string, string[]>
  cards: TtRegCard[]
}

export declare function ttRegOptionsErrors(options: unknown): string[]
export declare function ttRegFields(card: TtRegRow | TtRegTile): TtRegFields
export declare function ttRegCredit(fields: Pick<TtRegFields, 'credit' | 'license' | 'image'>): string | null
export declare function ttRegFace(fields: TtRegFields, set?: TtRegSet | null, options?: TtRegRules): TtFaceId
export declare function ttSetFromRegistry(set: Record<string, any>, options?: TtRegSetOptions): TtRegSet
export declare function ttFromRegistry(card: TtRegRow | TtRegTile, options?: TtRegCardOptions): TtRegCard
export declare function ttFromMeCards(res: TtMeCardsResponse | null | undefined, options?: TtMeCardsOptions): TtRegCollection
export declare function ttAppSetErrors(set: unknown, collects: unknown, options?: unknown): string[]
export declare function ttFromAppSet(set: TtAppSet, collects: TtCollectsResponse | null | undefined, options?: TtRegRules): TtRegCollection
