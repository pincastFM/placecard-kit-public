// Types for vue/moderation.js, the moderation parts' words and requests (1.1.0). The shapes are the
// contract's (contract/moderation.ts); test/vue/moderation-types.test.js holds the declared values equal to the module's.
import type { ModAdminMove, ModTab, TtModEndpoints, TtModLabels, TtModRequest } from '@pincast/placecard-kit/contract'

type Word = Exclude<keyof TtModLabels, 'when' | 'reasons'>
/** Every word the parts write, each set */
export type TtModWordSet = { [K in Word]-?: string }
/** The labels with the defaults under them (ttModWords) */
export type TtModWords = TtModWordSet & { reasons: Record<string, Record<string, string>>; when?: (iso: string | null) => string }

/** Every word the moderation parts write, by key; a host's `labels` replaces any of them */
export declare const TT_MOD_LABELS: Readonly<TtModWordSet>
/** The host's endpoints, the default paths */
export declare const TT_MOD_ENDPOINTS: Readonly<Required<TtModEndpoints>>

/** The labels with the defaults under them; `reasons` merges one level down, by kind */
export declare function ttModWords(labels?: TtModLabels | null): TtModWords
/** A reason's word: the host's for this kind, else the code with its first letter raised and _ as spaces */
export declare function ttModReason(words: { reasons?: Record<string, Record<string, string>> }, kind: string, code: string): string
/** '{n} waiting' and the like */
export declare function ttModFill(word: string, vars: Record<string, unknown>): string
/** An item's time: now, 4 min, 3 h, then Oct 12 (words.when replaces this) */
export declare function ttModWhen(
  words: Pick<TtModWords, 'now' | 'min' | 'h' | 'locale' | 'when'>,
  iso: string | null | undefined,
  now?: number,
): string

/** A failed request: its HTTP status and the host's error code, when it gave one */
export declare class TtModRequestError extends Error {
  constructor(status: number, code?: string | null, data?: unknown)
  name: 'TtModRequestError'
  status: number
  code: string | null
  data: unknown
}

export type TtModOp = Parameters<TtModRequest>[0]
/** Each op's arguments, as the parts send them */
export interface TtModOpArgs {
  report: { kind: string; ref: string | number; reason: string }
  settings: undefined
  saveSettings: { queue?: boolean; alerts?: boolean }
  queue: { tab: ModTab; before?: string | null; limit?: number | null }
  move: { kind: string; ref: string | number; move: ModAdminMove }
}
/** One fetch to the host's endpoint for the op, JSON both ways; a status outside 2xx throws TtModRequestError */
export declare function ttModRequest<O extends TtModOp>(
  op: O,
  args?: TtModOpArgs[O],
  endpoints?: TtModEndpoints | null,
  fetchFn?: typeof fetch | null,
): Promise<unknown>

/** The props every part that calls the host shares */
export interface TtModCallProps {
  endpoints?: TtModEndpoints | null
  request?: TtModRequest | null
  signIn?: (() => unknown) | null
}
/** A 401 calls signIn and resolves { signIn: true }; any other failure resolves { error } with its status */
export type TtModCallResult = { data: unknown } | { signIn: true; status: number } | { error: unknown; status: number }
export declare function ttModCall<O extends TtModOp>(props: TtModCallProps, op: O, args?: TtModOpArgs[O]): Promise<TtModCallResult>
/** 429 the limit, otherwise Failed */
export declare function ttModErrWord(words: Pick<TtModWords, 'limit' | 'failed'>, status: number): string
/** An id unique on the page */
export declare function ttModUid(p: string): string
/** The Vue prop definitions every part that calls the host shares */
export declare const TT_MOD_CALL_PROPS: {
  endpoints: { type: ObjectConstructor; default: null }
  request: { type: FunctionConstructor; default: null }
  signIn: { type: FunctionConstructor; default: null }
  labels: { type: ObjectConstructor; default: () => Record<string, never> }
}
