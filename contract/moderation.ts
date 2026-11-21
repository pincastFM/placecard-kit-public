// The moderation module's types (kit CONTRACT.md).
// The functions are moderation/index.js's, typed in moderation/index.d.ts from these.

/** An item's one state. Its content is in a public read if and only if the state is approved or reported. */
export type ModState = 'pending' | 'approved' | 'declined' | 'reported' | 'hidden'

/** Every move in the table; any other is refused (409) */
export type ModMove = 'submit' | 'edit' | 'approve' | 'decline' | 'report' | 'keep' | 'hide' | 'restore' | 'replace' | 'takedown'

/** The moves an admin makes from the queue */
export type ModAdminMove = 'approve' | 'decline' | 'keep' | 'hide' | 'restore'

/** Who hid a hidden item: an admin (it stays down), its owner (they may submit it again), or the system (replaced) */
export type ModHiddenBy = 'admin' | 'owner' | 'replaced'

/** The admin queue's tabs: Waiting (pending), Reported, Hidden (by an admin), Latest (shown, newest first) */
export type ModTab = 'waiting' | 'reported' | 'hidden' | 'latest'

/** One row of the move table */
export interface ModMoveRule {
  /** the states it moves from; 'new' is an item not yet in the table */
  from: readonly (ModState | 'new')[]
  /** from 'hidden', only an item hidden this way (submit: the owner's own; restore: an admin's) */
  hidden?: readonly ModHiddenBy[]
  /** 1.5.0: states it moves from only while the item's last approved version stays public (report and hide from pending) */
  public?: readonly ModState[]
  who: 'owner' | 'admin' | 'player' | 'system'
}

/** What nextState needs besides the state and the move */
export interface ModMoveContext {
  /** the instance's approval switch (submit and edit read it) */
  queue?: boolean
  /** the owner is an admin of the instance: their submit or edit shows at once */
  ownerIsAdmin?: boolean
  /** the item's open reports: an item that shows again with reports open is reported, not approved */
  reports?: number
  /** a hidden item's hidden_by */
  hiddenBy?: ModHiddenBy | null
  /** 1.5.0, a forced review: submit or edit waits for an admin whatever the switch says (an admin owner's still shows) */
  review?: boolean
  /** 1.5.0: a waiting change's approved version stays public, so report and hide move from pending */
  public?: boolean
  /** 1.5.0: the state an admin's hide took the item from; restore of one hidden while its change waited lands pending */
  hiddenFrom?: ModState | null
}

/** The person making a move, from the host's own session (the kit never signs anyone in) */
export interface ModActor {
  /** Logto id */
  sub: string
  name?: string | null
  /** an admin of this instance, by the host's own check */
  admin?: boolean
}

/** What a queue row and an alert show of an item's content; the kind writes it, the module never reads content tables */
export interface ModPreview {
  /** the tree's name, the card's title */
  title?: string | null
  /** the address, the set's name */
  where?: string | null
  /** a note's text */
  text?: string | null
  /** a thumb's URL */
  img?: string | null
  /** the owner's name as the app shows it */
  by?: string | null
  /** a figure beside the kind, as a Studio card's "3 of 9" */
  figure?: string | null
  [k: string]: unknown
}

/** A database client: node-postgres's Pool or PoolClient, PGlite, or anything with the same query */
export interface ModClient {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>
}

/** One kind of people's content an instance moderates: how to show and unshow it, inside the module's transaction */
export interface ModKind {
  /** 'Photo', 'Note', 'Card' */
  label: string
  /** report reason codes, in order (at most 24 characters each) */
  reasons: string[]
  /** each reason's words for the alert; unset, the code with its first letter raised and _ as spaces */
  reasonWords?: Record<string, string>
  /** the new item alert's title, ASCII; unset, 'New ' and the label in lower case */
  alertTitle?: string
  /** make the content public */
  show(client: ModClient, ref: string): Promise<void>
  /** take the content out of every public read */
  unshow(client: ModClient, ref: string, why: 'pending' | 'declined' | 'hidden' | 'replaced'): Promise<void>
  /** the queue's and the alerts' view of each ref (a ref left out shows no preview) */
  preview(client: ModClient, refs: string[]): Promise<Record<string, ModPreview>>
  /** after the commit of a move that showed or unshowed refs (Treehopper's key photo); an error here is logged, never thrown */
  after?(refs: string[]): void | Promise<void>
  /**
   * 1.5.0: of these pending refs, the ones whose last approved version the kind keeps public while the change
   * waits (its unshow(ref, 'pending') left it up). Players can report them and admins hide them. Unset: none.
   */
  publicWhilePending?(client: ModClient, refs: string[]): Promise<Iterable<string>>
  /**
   * 1.5.0: each ref's content version, any JSON value, the same whenever the content is. Unset: the preview,
   * so a kind whose preview carries something besides the content (a count of the set's cards) gives this.
   */
  revision?(client: ModClient, refs: string[]): Promise<Record<string, unknown>>
}

/** One alert: an ASCII title, people's words in the body only, and the queue tab it opens */
export interface ModAlert {
  event: 'new' | 'reported'
  instance: string
  kind: string
  ref: string
  state: ModState
  title: string
  body: string
  tab: ModTab
}

/** An item as the module hands it out */
export interface ModItem {
  id: string
  instance: string
  kind: string
  ref: string
  /** the owner's Logto id */
  owner: string
  state: ModState
  hiddenBy: ModHiddenBy | null
  reportsOpen: number
  submittedAt: string
  decidedAt: string | null
  /** an admin's Logto id, or auto | own | system | backfill | import */
  decidedBy: string | null
  updatedAt: string
}

/** The owner's own item that the public does not see, with its label */
export interface ModMine extends ModItem {
  label: string
}

/** A queue row: the item, its kind's label, its preview, its open reports by reason, and the admin moves open to it */
export interface ModQueueRow extends ModItem {
  kindLabel: string
  preview: ModPreview | null
  reasons: Record<string, number>
  moves: ModAdminMove[]
  /** 1.5.0: the revision this row shows (the kit's queue always gives it); the admin's move sends it back as `seen` */
  revision?: string
  /** 1.5.0: true on a waiting change whose approved version stays public */
  public?: boolean
}

export interface ModQueuePage {
  tab: ModTab
  rows: ModQueueRow[]
  /** the cursor for the next page (page.before), or null at the end */
  next: string | null
  counts: { waiting: number; reported: number; hidden: number }
}

export interface ModSettings {
  /** Approval queue: new submissions wait for an admin */
  queue: boolean
  /** Alerts: one push per new item and per first report */
  alerts: boolean
  /** an alert can reach someone (a topic is set) */
  topic: boolean
  /** items waiting */
  waiting: number
}

/** A move's result. With the host's own client, the host calls after() once its transaction commits; otherwise the module has */
export interface ModResult {
  item: ModItem
  move: ModMove
  from: ModState | 'new'
  to: ModState
  /** a report this player had already made: nothing was written */
  already?: true
  after(): Promise<void>
}

export interface ModerationOptions {
  /** 'treehopper', 'studio' (at most 32 characters) */
  instance: string
  /** reads outside a move: the settings, the queue, mine, previews and alerts */
  db: ModClient
  /** runs fn in one transaction, committing when it resolves and rolling back when it throws */
  transaction<T>(fn: (client: ModClient) => Promise<T>): Promise<T>
  kinds: Record<string, ModKind>
  /** one push per alert; ntfyAlert(topic, clickBase) ships in the kit. Never fails a move */
  alert?: ((a: ModAlert) => Promise<unknown>) & { ready?: boolean }
  /** when the instance has no settings row yet; default { queue: true, alerts: true } (held for review) */
  defaults?: { queue?: boolean; alerts?: boolean }
  /** default 30 */
  reportsPerDay?: number
  /** the words the alerts write; default { reported: 'Reported', by: 'By' } */
  words?: { reported?: string; by?: string }
}

/** 1.5.0: submit's and edit's options */
export interface ModSendOptions {
  /** a forced review (a pin moved more than 150 m): it waits for an admin whatever the switch says, unless its owner is one */
  review?: boolean
}

export interface Moderation {
  readonly instance: string
  settings(): Promise<ModSettings>
  saveSettings(actor: ModActor, patch: { queue?: boolean; alerts?: boolean }): Promise<ModSettings>
  /** the owner sends new content, or sends again a declined item or one they took down; inside the host's insert transaction when client is given */
  submit(actor: ModActor, kind: string, ref: string | number, client?: ModClient, opts?: ModSendOptions): Promise<ModResult>
  /** the owner changed shown content */
  edit(actor: ModActor, kind: string, ref: string | number, client?: ModClient, opts?: ModSendOptions): Promise<ModResult>
  /** the owner takes their item down */
  takedown(actor: ModActor, kind: string, ref: string | number, client?: ModClient): Promise<ModResult>
  /** the system hides an item its owner's newer one replaces (Treehopper's one photo per player per tree) */
  replace(kind: string, ref: string | number, client?: ModClient): Promise<ModResult>
  report(actor: ModActor | null | undefined, kind: string, ref: string | number, reason: string): Promise<ModResult>
  /** opts.seen: the queue row's revision; approve, keep and restore answer 409 'moved' when the item changed since */
  move(actor: ModActor, kind: string, ref: string | number, move: ModAdminMove, opts?: { seen?: string | null }): Promise<ModResult>
  queue(actor: ModActor, tab: ModTab, page?: { before?: string | null; limit?: number }): Promise<ModQueuePage>
  /** the owner's own pending, declined and hidden items (a replaced one is not theirs to see) */
  mine(sub: string, kind: string, refs?: (string | number)[]): Promise<ModMine[]>
  /** of these refs, the ones this player has reported */
  reportedBy(sub: string, kind: string, refs: (string | number)[]): Promise<string[]>
}

/** On the owner's own item only, while the public does not see it (the card shape's and an item's `moderation`) */
export interface ModOwnMark {
  state: 'pending' | 'declined' | 'hidden'
  mine: true
}

/** The words the moderation parts write (vue TT_MOD_LABELS holds the defaults); reasons by kind, then code */
export interface TtModLabels {
  report?: string; reportTitle?: string; send?: string; cancel?: string; reported?: string
  pending?: string; declined?: string; hidden?: string
  approve?: string; decline?: string; keep?: string; hide?: string; restore?: string
  moderation?: string; queue?: string; alerts?: string; on?: string; off?: string
  /** '{n} waiting' */
  waiting?: string; topic?: string; noTopic?: string
  tabWaiting?: string; tabReported?: string; tabHidden?: string; tabLatest?: string
  by?: string; sent?: string; shown?: string; hiddenAt?: string; none?: string; more?: string
  failed?: string; retry?: string; limit?: string
  /** 1.5.0: on a queue row still listed once the tab reloads after a 409 the core refused ('moved' or 'refused'); a host's own 409 says failed */
  changed?: string
  now?: string; min?: string; h?: string; locale?: string
  /** an item's time, replacing now, 4 min, 3 h, Oct 12 */
  when?: (iso: string | null) => string
  reasons?: Record<string, Record<string, string>>
}

/** The host's endpoints (the default paths when unset) */
export interface TtModEndpoints { report?: string; settings?: string; queue?: string; move?: string }

/** A host's own request in place of the parts' fetch: resolve the host's JSON, throw with `status` on a failure */
export type TtModRequest = (
  op: 'report' | 'settings' | 'saveSettings' | 'queue' | 'move',
  args?: { kind?: string; ref?: string | number; reason?: string; move?: ModAdminMove; tab?: ModTab; before?: string | null; limit?: number; queue?: boolean; alerts?: boolean; seen?: string },
) => Promise<unknown>

export interface ModOwnerWords {
  pending: string
  declined: string
  hidden: string
}

export interface NtfyAlertOptions {
  /** default https://ntfy.sh */
  server?: string
  /** the ntfy Tags header, ASCII (the Studio's: 'placecard') */
  tags?: string
  /** ms, default 5000 */
  timeout?: number
  fetch?: typeof fetch
  /** where a failure is written; default console.error */
  log?: (...args: unknown[]) => void
}
