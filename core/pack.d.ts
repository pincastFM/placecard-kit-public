// Types for core/pack.js: the pack's pure part (for 1.5.0, unreleased). The component is vue/TtPack.vue.

/** Each app's mark color, the band across its pack, '#RRGGBB' */
export declare const TT_PACK_TINTS: Readonly<{ studio: string; treehopper: string; verythere: string }>
/** The stripe when the card has no accent: Cornflower, the Studio face's waterline */
export declare const TT_PACK_STRIPE: string
/** The top rarity's gold: the pack never prints it */
export declare const TT_PACK_GOLD: string
/** Each step's length in ms */
export declare const TT_PACK_MS: Readonly<{ tear: number; rise: number; land: number; stamp: number; hold: number; fade: number }>
/** The share of the pack's width a rightward drag on the strip travels to tear it, 0.6 */
export declare const TT_PACK_TEAR_AT: number
/** Less than this in px each way, a press on the strip is a tap, 6 */
export declare const TT_PACK_TAP_PX: number

export type TtPackApp = 'studio' | 'treehopper' | 'verythere'

export interface TtPackInput {
  /** the app whose mark color the band takes; an app it doesn't know takes Studio green (1.6.0: any registry app id;
   *  its host passes the app's color from the collection's apps as `tint`) */
  app?: TtPackApp | string
  /** the host's own band color, over the app's; ignored when ttHex refuses it or it is gold */
  tint?: string | null
  /** the experience's name, the pack's title */
  name?: string
  /** the experience's chip word; else the city, else the name */
  chip?: string
  city?: string
  /** the card's accent, the stripe; ignored when ttHex refuses it or it is gold */
  accent?: string | null
  /** the cards inside, 1 or more */
  count?: number
}

/** What TtPack prints, every color '#RRGGBB' */
export interface TtPackLook {
  word: string
  title: string
  tint: string
  onTint: string
  stripe: string
  count: string
}

export type TtPackStepName = 'tear' | 'rise' | 'land' | 'stamp' | 'hold' | 'fade'

/** The pack's print from the experience and the card inside */
export declare function ttPackLook(input?: TtPackInput): TtPackLook
/** The opening's steps in order: tear, rise, land, stamp and hold; with reduced motion one fade */
export declare function ttPackSteps(reduced: unknown): { step: TtPackStepName; ms: number }[]
/** A drag on the strip: its progress, 0 to 1, rightward only, and whether it tears the pack */
export declare function ttPackTear(dx: unknown, width: unknown): { progress: number; torn: boolean }
/** Whether a press on the strip barely moved (a tap) */
export declare function ttPackTap(dx: unknown, dy: unknown): boolean
