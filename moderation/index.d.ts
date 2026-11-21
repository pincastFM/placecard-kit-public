// Types for the kit's moderation subpath (moderation/index.js). The shapes are the contract's
// (contract/moderation.ts); the DDL ships as sql/moderation.sql.
import type {
  ModState, ModMove, ModAdminMove, ModHiddenBy, ModTab, ModMoveRule, ModMoveContext, ModOwnerWords,
  ModAlert, Moderation, ModerationOptions, NtfyAlertOptions,
} from '@pincast/placecard-kit/contract'

export type * from '@pincast/placecard-kit/contract'

export declare const CONTRACT_VERSION: string
export declare const MOD_STATES: readonly ModState[]
export declare const MOD_TABS: readonly ModTab[]
export declare const MOD_ADMIN_MOVES: readonly ModAdminMove[]
/** 30: a player's reports in any 24 hours */
export declare const REPORTS_PER_DAY: number
export declare const MOVES: Readonly<Record<ModMove, ModMoveRule>>
/** 1.5.0: approve, keep, restore: the admin moves that check the revision the admin saw */
export declare const MOD_SEEN_MOVES: readonly ModAdminMove[]
/** 1.5.0: an item's revision from its submitted_at text and its content as the admin is shown it */
export declare function modRevision(submittedText: string | null | undefined, content: unknown): Promise<string>

export declare class ModError extends Error {
  constructor(code: string, status: number, message?: string)
  readonly name: 'ModError'
  /** sign_in, admins_only, not_yours, own_item, not_found, refused, limit, bad_kind, bad_ref, bad_reason, bad_move, bad_tab, bad_page, bad_settings, bad_actor; 1.5.0: moved (409), bad_seen (400) */
  code: string
  /** 400, 401, 403, 404, 409 or 429 */
  status: number
}

export declare function shownToAll(state: ModState): boolean
/** null or undefined is an item not yet in the table */
export declare function canMove(item: { state: ModState; hiddenBy?: ModHiddenBy | null } | null | undefined, move: ModMove): boolean
export declare function adminMoves(item: { state: ModState; hiddenBy?: ModHiddenBy | null }): ModAdminMove[]
/** throws ModError 409 for a move the table does not allow; submit and edit need ctx.queue */
export declare function nextState(state: ModState | 'new', move: ModMove, ctx?: ModMoveContext): ModState
export declare function ownerLabel(
  item: { state: ModState; hiddenBy?: ModHiddenBy | null; hidden_by?: ModHiddenBy | null } | null | undefined,
  words?: Partial<ModOwnerWords>,
): string | null
export declare function createModeration(opts: ModerationOptions): Moderation
export declare function ntfyAlert(
  topic: string | null | undefined,
  clickBase?: string | ((a: ModAlert) => string | null | undefined) | null,
  opts?: NtfyAlertOptions,
): ((a: ModAlert) => Promise<boolean>) & { readonly ready: boolean }
