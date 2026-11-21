// Types for core/face.js: the faces' pure part (fonts, icons, text cleaning, stamps, the look, print, furniture).
import type { TtFaceEntry, TtFaceId, TtKitFaceId } from '@pincast/placecard-kit/contract'
import type { TtCoreCard, TtCoreSet } from './core.js'

export declare const TT_FACE_FONTS: string
export declare const TT_TH_FONTS: string
/** 1.4.0: the Studio face's fonts, Big Shoulders and Jost */
export declare const TT_PC_FONTS: string

export type TtIconName =
  | 'calendar' | 'timer' | 'layers' | 'ruler' | 'landmark' | 'orbit' | 'users' | 'cherry' | 'donut' | 'store'
  | 'map-pin' | 'dot' | 'lightbulb' | 'info' | 'tree' | 'tree-mark'
/** SVG inner nodes, 24 by 24 */
export declare const TT_ICON: Record<TtIconName, string>
export declare const TT_STAT_ICONS: Record<string, TtIconName>
/** A stat's glyph by its key; unknown keys get 'dot' */
export declare function ttStatIcon(k: unknown): TtIconName
export declare const TT_KEYSTONE: string

/** 1.1.0: the number's word, "No." unset; an empty word leaves the number alone */
export interface TtNoWords { no?: string | null }

/** Dashes out ("a, b"), trimmed */
export declare function ttClean(s: unknown): string
/** '#rrggbb' lower case, or null */
export declare function ttHex(c: unknown): string | null
/** a at t, b at 1 - t, both '#rrggbb' */
export declare function ttMix(a: string, b: string, t: number): string
/** 1.5.0: WCAG 2's contrast ratio of two '#rrggbb', 1 to 21 */
export declare function ttContrast(a: string, b: string): number
/** 1.5.0: the least contrast the Studio waterline holds on the plate's Night, 3 (WCAG 1.4.11) */
export declare const TT_STUDIO_WL_MIN: number
/** 1.5.0: the Studio face's waterline color for an accent, '#rrggbb' lower case: the accent, else mixed
 *  toward the card's Stock until it holds 3:1 on the plate's Night; null for anything ttHex refuses */
export declare function ttStudioAccent(accent: unknown): string | null
export declare function ttPad2(n: number): string
export declare function ttNumberLabel(n: number | string | null | undefined, words?: TtNoWords | null): string
/** 'Apr 19, 2022' */
export declare function ttFmtDate(iso: unknown): string
/** '19 APR 22' */
export declare function ttStampDate(iso: unknown): string
/** 1.4.0: the Studio stamp's date, "14 OCT 2026" */
export declare function ttStampDateLong(iso: unknown): string
/** n and no for a numbered card; n null and no '' for a date-only stamp or a missing card's spot (1.2.0) */
export interface TtStampMark { n: number | null; no: string; date: string; spot?: string }
/** A held card with a number ("No. N" over its date), else with a first-find date and card.dateStamp true (the date
 *  alone); a missing card with card.spot (the empty spot); else null */
export declare function ttStamp(card: TtCoreCard | null | undefined, words?: TtNoWords | null): TtStampMark | null

export declare const TT_TH_PIPS: Readonly<Record<'widespread' | 'common' | 'numerous' | 'uncommon' | 'rare' | 'very rare', number>>
/** 1 to 6, or null (Unique and unknown words) */
export declare function ttPips(word: unknown): number | null
export declare function ttCreditText(s: unknown): string
/** The card's credit as its face prints it: as given on a Treehopper face with card.creditAsGiven true, else without a
 *  leading "Photo:" (1.2.0) */
export declare function ttFaceCredit(card: TtCoreCard | null | undefined, data?: { sets?: readonly TtCoreSet[] } | null): string
export interface TtFitMark { lw: number; tl: number }
export declare function ttFit(title: unknown): TtFitMark

export declare function ttSetOf<S extends TtCoreSet>(card: { set?: string }, data: { sets?: readonly S[] } | null | undefined): S | null
/** The kit's own faces (typed wide, as before 1.6.0, so `TT_FACES.includes(ttFaceOf(card, data))` still checks) */
export declare const TT_FACES: readonly TtFaceId[]
/** The shape of an app's own face id (1.6.0) */
export declare const TT_FACE_ID_RE: RegExp
type TtFaceData = { sets?: readonly TtCoreSet[]; faces?: Record<string, TtFaceEntry> | readonly TtFaceEntry[] } | null
/** A face's entry in the collection's faces, or null (1.6.0) */
export declare function ttFaceEntry(face: unknown, data?: TtFaceData): TtFaceEntry | null
/** The card's own face (a kit face, or one of the collection's own), else its set's meta.face, else 'stop' */
export declare function ttFaceOf(card: TtCoreCard | null | undefined, data?: TtFaceData): TtFaceId
/** The kit face that draws a face: itself, an own face's base, or null when the host's component draws it (1.6.0) */
export declare function ttFaceBase(face: unknown, data?: TtFaceData): TtKitFaceId | null
/** The host's component for a face, or null (1.6.0) */
export declare function ttFaceComponent(face: unknown, data?: TtFaceData): unknown

export interface TtLook {
  set: TtCoreSet | null
  face: TtFaceId
  /** the kit face that draws it; null when the host's component does (1.6.0) */
  base: TtKitFaceId | null
  /** 'own' with the host's component (1.6.0) */
  theme: 'th' | 'base' | 'pop' | 'pc' | 'own'
  foil: boolean
  name: string
  short: string
  setName: string
  of: unknown
  /** the accent, '#rrggbb' */
  ac: string
  /** the accent's deep mix */
  dp: string
  /** 1.5.0: the Studio face's waterline color (ttStudioAccent of card.accent); null on every other face,
   *  and on a Studio card with no accent ttHex reads */
  wl: string | null
  photo: boolean
  fit: TtFitMark
}
export declare function ttLook(card: TtCoreCard, data?: { sets?: readonly TtCoreSet[] } | null): TtLook

type FaceData = { sets?: readonly TtCoreSet[]; faces?: Record<string, TtFaceEntry> | readonly TtFaceEntry[] | null } | null | undefined
/** card.print, else the face entry's print, else on for the Treehopper and Studio faces (and a host's face either
 *  draws, 1.6.0) and the Studio app */
export declare function ttPrintOn(card: TtCoreCard | null | undefined, data?: FaceData): boolean
/** "007/612"; n alone without of; '' without a whole n from 1 */
/** 1.4.0: `pad` pads both numbers to at least that many digits (the Studio face's 3, "003/005") */
export declare function ttCollector(col: { n?: unknown; of?: unknown } | null | undefined, pad?: number): string
/** One glyph per rarity place, low to high: SVG nodes, 10 by 10 */
export declare const TT_RMARK: readonly string[]
/** The word's place in its rarity list; -1 for none */
export declare function ttRarityIndex(card: TtCoreCard | null | undefined, data?: { rarities?: Record<string, readonly string[]> } | null): number
export interface TtFurniture { no: string; rm: string; cr: string; cp: string }
export declare function ttFurniture(card: TtCoreCard | null | undefined, data?: { rarities?: Record<string, readonly string[]> } | null, copyright?: string): TtFurniture | null
/** 1.6.0: `base` null gives the host's component's classes (ttf-own); unset, the face's own */
export declare function ttFaceClass(L: Pick<TtLook, 'face' | 'theme' | 'photo'> & { base?: TtKitFaceId | null }, side: 'front' | 'back', noimg?: boolean): string

/** 1.4.0: the Studio name fitted as the board fits it, in board units (300 wide) */
export interface TtStudioLine { text: string; base: number; size: number; tl: number; adj: 'spacing' | 'spacingAndGlyphs' }
export interface TtStudioTier { vb: string; x: number; zt: number; zb: number; by: number; bb: number; leadSize: number; lines: TtStudioLine[]; leadBase: number | null }
export interface TtStudioName { lead: string; full: TtStudioTier; mid: TtStudioTier; small: TtStudioTier; back: TtStudioTier }
export declare function ttStudioName(title: unknown): TtStudioName
/** 1.4.0: the locked back's story bars, widths in board units */
export declare function ttLockBars(text: unknown, max?: number): number[]
/** 1.4.0: a locked stat value's bar width, in board units */
export declare function ttLockValue(v: unknown): number
