// Types for core/hand.js: the cards a visitor picks off the table, in order. Every function returns a new array.

export type HandKind = 'card' | 'event'
export interface HandEntry { key: string; kind: HandKind }
/** A key (a card's), or an entry */
export type HandEntryInput = string | number | { key: string | number; kind?: HandKind }
export type HandList = readonly HandEntry[] | null | undefined

export declare const HAND_V: 1
/** null when it is not an entry */
export declare function handEntry(key: HandEntryInput | null | undefined, kind?: HandKind): HandEntry | null
/** With no kind, an entry of either kind */
export declare function handHas(hand: HandList, key: string | number, kind?: HandKind): boolean
export declare function handAdd(hand: HandList, entry: HandEntryInput, index?: number): HandEntry[]
export declare function handRemove(hand: HandList, key: string | number, kind?: HandKind): HandEntry[]
export declare function handMove(hand: HandList, from: number, to: number): HandEntry[]
export declare function handToggle(hand: HandList, entry: HandEntryInput): HandEntry[]

export interface HandSaved { v: number; zone: string; entries: HandEntry[] }
export declare function handSave(hand: HandList, zone: unknown): HandSaved
/** A zone's current keys: a Set, a Map or a list */
export type HandKeys = ReadonlySet<string> | ReadonlyMap<string, unknown> | Iterable<string | number>
/** [] for another version, another zone or anything unreadable */
export declare function handRestore(
  saved: unknown,
  o?: { zone?: string | null; cardKeys?: HandKeys | null; eventKeys?: HandKeys | null },
): HandEntry[]
