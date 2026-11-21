// createTabletop's config (kit CONTRACT.md). The checks are core/tabletop.js's ttConfigErrors.
import type { DayRules } from '../planner/day/index'
import type { Directions } from '../planner/directions'
import type { NamedDirections } from '../planner/path/index'
import type { ModOwnMark } from './moderation'

/** An app: any id of the registry's shape (lowercase letters, digits and hyphens, 32 at most; core TT_APP_ID_RE).
 *  The three named are Pincast's own; the registry, not the kit, says which apps exist (1.6.0) */
export type TtAppId = 'treehopper' | 'verythere' | 'studio' | (string & {})
/** The kit's own faces (core TT_FACES) */
export type TtKitFaceId = 'stop' | 'destination' | 'treehopper' | 'studio'
/** A face: one of the kit's, or the app's own under its own id (core TT_FACE_ID_RE; 1.6.0) */
export type TtFaceId = TtKitFaceId | (string & {})
export type TtGroupId = 'set' | 'app' | 'kind' | 'rarity' | 'none'
export type TtSortId = 'newest' | 'rarest' | 'name' | 'number'
export type TtFacetId = 'from' | 'set' | 'rarity' | 'kind' | 'interests'

/** A string, a Vue ref of one, or a getter (read live) */
export type TtLive<T> = T | { value: T } | (() => T)

/** A face entry: a named face style over TtFace's fixed anatomy, as data */
export interface TtFaceEntry {
  id?: TtFaceId
  /** the shared card's print motion for this face (core ttPrintOn) */
  print?: boolean
  /** the app's own face only (1.6.0): the kit face that draws it; the host restyles it under .ttf[data-face="<id>"] */
  base?: TtKitFaceId
  /** the app's own face only (1.6.0): the host's Vue component, drawn inside the kit's card on both sides. Props: card,
   *  side ('front' | 'back'), data, labels, look (core ttLook); slots art, head, foot and more pass through */
  component?: unknown
  [k: string]: unknown
}

/** A theme: the class on the table root that supplies every theme token, its fonts and <html> attributes */
export interface TtTheme {
  class: string
  /** Its font stylesheets. Left out, the Card room's (the fonts the theme tokens name); [] for none */
  fonts?: (string | { key: string; href: string })[]
  htmlAttrs?: Record<string, string>
}

export interface TtStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export interface TtHandConfig {
  /** the storage key */
  key: TtLive<string>
  /** the hand's scope, kept in its payload (Provo: the zone) */
  scope: TtLive<string>
  store?: TtStore
}

export type TtPlanning = { solver: 'day'; rules: DayRules } | { solver: 'path'; directions?: NamedDirections | Directions | null }

export interface TtModes {
  collection?: boolean
  planning?: TtPlanning
}

export interface TtLink { label: string; href: string }

export interface TtCollection {
  /** site (1.4.0): the app's web address, on the Studio face's foot */
  apps: { id: string; name?: string; color?: string | null; site?: string | null }[]
  sets: { id: string; app?: string; name?: string; meta?: { face?: TtFaceId; [k: string]: unknown }; [k: string]: unknown }[]
  rarities: Record<string, string[]>
  /** moderation (1.1.0): `moderation` on the owner's own card while the public does not see it, `reportedByMe`
   *  on a card this player has reported; public cards carry neither, so approved and reported look the same */
  cards: { id: string; face?: TtFaceId; set?: string; moderation?: ModOwnMark; reportedByMe?: true; [k: string]: unknown }[]
  faces?: Record<string, TtFaceEntry> | TtFaceEntry[]
  [k: string]: unknown
}

export interface TabletopConfig {
  /** the contract major the instance was built for */
  contract: number
  app: TtAppId
  source: { load: () => TtCollection | Promise<TtCollection> }
  faces: Partial<Record<TtFaceId, TtFaceEntry>> | (TtFaceEntry & { id: TtFaceId })[]
  theme: TtTheme
  hand: TtHandConfig
  modes: TtModes
  table?: { key?: string; widths?: { phone: number; laptop: number }; stacked?: boolean; only?: (card: any) => boolean }
  labels?: { groups?: Partial<Record<TtGroupId, string>>; [word: string]: string | Partial<Record<TtGroupId, string>> | undefined }
  links?: { back?: TtLink; empty?: TtLink[] }
  /** the groupings offered; the first is the starting one */
  groups?: TtGroupId[]
  sorts?: TtSortId[]
  filters?: { facets?: TtFacetId[]; missing?: boolean; search?: boolean }
  map?: unknown
}
