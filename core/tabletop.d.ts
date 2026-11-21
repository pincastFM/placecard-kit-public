// Types for core/tabletop.js: createTabletop's ids, the token lists, the config and collection checks, a theme's head.
import type { TabletopConfig, TtAppId, TtFacetId, TtGroupId, TtSortId, TtTheme } from '@pincast/placecard-kit/contract'

/** Pincast's own apps; not a gate since 1.6.0 */
export declare const TT_APP_IDS: readonly TtAppId[]
/** The registry's app id shape (1.6.0) */
export declare const TT_APP_ID_RE: RegExp
export declare function ttAppIdOk(id: unknown): boolean
/** The three app marks a theme supplied until 1.5.0; optional since 1.6.0 */
export declare const TT_LEGACY_MARK_TOKENS: readonly string[]
export declare const TT_GROUP_IDS: readonly TtGroupId[]
export declare const TT_SORT_IDS: readonly TtSortId[]
export declare const TT_FACET_IDS: readonly TtFacetId[]
/** The 22 a theme supplies */
export declare const TT_THEME_TOKENS: readonly string[]
/** The 15 the kit keeps */
export declare const TT_MECHANICS_TOKENS: readonly string[]
/** Read with a default: a theme may set them */
export declare const TT_DEFAULTED_TOKENS: readonly string[]
/** The moderation parts' tokens */
export declare const TT_MOD_TOKENS: readonly string[]
/** The Card room as a theme config (frozen) */
export declare const TT_CARDROOM_THEME: Readonly<{ class: 'tt-cardroom'; fonts: { key: string; href: string }[]; htmlAttrs: Record<string, string> }>

export interface TtThemeHead {
  htmlAttrs?: Record<string, string>
  link: { key: string; rel: 'stylesheet'; href: string }[]
}
/** The theme's fonts and <html> attributes for the host's head. No `fonts` key: the Card room's (tt-cr-fonts); `fonts: []`: none */
export declare function ttThemeHead(theme: TtTheme | null | undefined): TtThemeHead
/** '0.3.0' is 0; NaN when it is not a version */
export declare function ttContractMajor(v: unknown): number
export declare function ttConfigFaceIds(faces: TabletopConfig['faces'] | null | undefined): (string | undefined)[]
/** Every problem, as strings; empty: the config is good. version: the kit's contract version */
export declare function ttConfigErrors(config: unknown, version: string): string[]
/** The config, or one TypeError listing every problem */
export declare function ttCheckConfig<T>(config: T, version: string): T
/** At most 20 card or set lines, then a count of the rest */
export declare function ttCollectionErrors(collection: unknown, config: { faces?: TabletopConfig['faces'] } | null | undefined): string[]
