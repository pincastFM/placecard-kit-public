// The kit's moderation core (kit CONTRACT.md).
// One module each app runs as an instance: items in five states, the move table, one approval switch
// per instance, reports with a daily limit, the admin queue, and alerts. Framework-free ESM for the
// host's server: no h3, no driver; the host hands it a client with query(text, params) and its own
// transaction. It never signs anyone in and never reads a content table: each kind shows and unshows
// its own content inside the module's transaction. The tables are sql/moderation.sql, applied by hand.

export const CONTRACT_VERSION = '1.6.2'

const freeze = o => {
  Object.values(o).forEach(v => { if (v && typeof v === 'object') freeze(v) })
  return Object.freeze(o)
}

export const MOD_STATES = freeze(['pending', 'approved', 'declined', 'reported', 'hidden'])
export const MOD_TABS = freeze(['waiting', 'reported', 'hidden', 'latest'])
export const MOD_ADMIN_MOVES = freeze(['approve', 'decline', 'keep', 'hide', 'restore'])
export const REPORTS_PER_DAY = 30

// The move table. `hidden` narrows a move from 'hidden' to items hidden that way. `public` (1.5.0) lists states a
// move is allowed from only while the item's last approved version stays public (a kind's publicWhilePending): a
// Live card whose change waits can be reported and hidden.
export const MOVES = freeze({
  submit: { from: ['new', 'declined', 'hidden'], hidden: ['owner'], who: 'owner' },
  edit: { from: ['approved', 'reported'], who: 'owner' },
  approve: { from: ['pending', 'declined'], who: 'admin' },
  decline: { from: ['pending'], who: 'admin' },
  report: { from: ['approved', 'reported'], public: ['pending'], who: 'player' },
  keep: { from: ['reported'], who: 'admin' },
  hide: { from: ['approved', 'reported'], public: ['pending'], who: 'admin' },
  restore: { from: ['hidden'], hidden: ['admin'], who: 'admin' },
  replace: { from: ['pending', 'approved', 'reported'], who: 'system' },
  takedown: { from: ['pending', 'approved', 'reported'], who: 'owner' },
})

const MESSAGES = {
  sign_in: 'Sign in',
  admins_only: 'Admins only',
  not_yours: 'Not your item',
  own_item: 'Not on your own item',
  not_found: 'Not found',
  refused: 'Not from this state',
  limit: 'Too many reports today',
  bad_kind: 'Unknown kind',
  bad_ref: 'Bad ref',
  bad_reason: 'Unknown reason',
  bad_move: 'Unknown move',
  bad_tab: 'Unknown tab',
  bad_page: 'Bad page',
  bad_settings: 'Bad settings',
  bad_actor: 'Bad actor',
  bad_seen: 'Bad revision',
  moved: 'Changed',
}

/** The module's one error: the host turns it into its own HTTP error with `status`. */
export class ModError extends Error {
  constructor(code, status, message) {
    super(message || MESSAGES[code] || code)
    this.name = 'ModError'
    this.code = code
    this.status = status
  }
}

const err = (code, status, message) => new ModError(code, status, message)
const own = (o, k) => typeof k === 'string' && Object.hasOwn(o, k)

/** Approved and reported items are shown to everyone; pending, declined and hidden to their owner and admins only. */
export function shownToAll(state) {
  return state === 'approved' || state === 'reported'
}

const hiddenOf = item => (item ? item.hiddenBy ?? item.hidden_by ?? null : null)

/**
 * Whether the table allows `move` from this item (null or undefined: not yet in the table, 'new'). `item.public` true
 * says its last approved version stays public while its change waits: report and hide from pending.
 */
export function canMove(item, move) {
  if (!own(MOVES, move)) return false
  const m = MOVES[move]
  const state = item ? item.state : 'new'
  if (!m.from.includes(state)) return Boolean(item && item.public === true && m.public && m.public.includes(state))
  return state !== 'hidden' || !m.hidden || m.hidden.includes(hiddenOf(item))
}

/** The admin moves the queue offers this item, in the table's order. */
export function adminMoves(item) {
  return MOD_ADMIN_MOVES.filter(m => canMove(item, m))
}

/**
 * The state a move lands in. Throws ModError 409 for a move the table does not allow.
 * submit: pending while the switch is on, or for a forced review (ctx.review), unless the owner is an admin;
 * else shown (reported if reports are still open). edit: the same, or unchanged. A report on a waiting change whose
 * approved version stays public (ctx.public) leaves it pending; a restore of an item an admin hid while its
 * change waited (ctx.hiddenFrom 'pending') puts the change back in the queue. The rest land where the table says.
 */
export function nextState(state, move, ctx = {}) {
  if (!own(MOVES, move)) throw err('bad_move', 400)
  if (!canMove(state === 'new' ? null : { state, hiddenBy: ctx.hiddenBy ?? null, public: ctx.public === true }, move)) {
    throw err('refused', 409, `${move} is not a move from ${state}`)
  }
  if (move === 'submit' || move === 'edit') {
    if (typeof ctx.queue !== 'boolean') throw new TypeError(`nextState: ${move} needs ctx.queue`)
    if ((ctx.queue || ctx.review === true) && !ctx.ownerIsAdmin) return 'pending'
    if (move === 'edit') return state
    return ctx.reports > 0 ? 'reported' : 'approved'
  }
  if (move === 'restore') return ctx.hiddenFrom === 'pending' ? 'pending' : 'approved'
  if (move === 'approve' || move === 'keep') return 'approved'
  if (move === 'decline') return 'declined'
  if (move === 'report') return state === 'pending' ? 'pending' : 'reported'
  return 'hidden'
}

// The admin moves that put or keep content in view: each checks the revision the admin saw, when the host sends it
export const MOD_SEEN_MOVES = freeze(['approve', 'keep', 'restore'])

/**
 * An item's revision: a digest of when its owner last sent it (submitted_at, Postgres's own text) and its
 * content as the admin is shown it (the kind's revision when it has one, else its preview). Web Crypto's SHA-256, cut
 * to 32 hex; where there is none, the text itself.
 */
export async function modRevision(submittedText, content) {
  const s = JSON.stringify([submittedText == null ? null : String(submittedText), content ?? null])
  const subtle = globalThis.crypto && globalThis.crypto.subtle
  if (!subtle) return `j:${s}`
  const h = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(s)))
  return `r1:${[...h.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('')}`
}

const OWNER_WORDS = { pending: 'Pending', declined: 'Declined', hidden: 'Hidden' }

/** The owner's label on their own item: Pending, Declined or Hidden; null when shown, or replaced. */
export function ownerLabel(item, words) {
  if (!item) return null
  const w = { ...OWNER_WORDS, ...words }
  if (item.state === 'pending') return w.pending
  if (item.state === 'declined') return w.declined
  if (item.state === 'hidden' && hiddenOf(item) !== 'replaced') return w.hidden
  return null
}

// ---- Alerts ---------------------------------------------------------------------------------------

const TOPIC = /^[A-Za-z0-9_-]{1,64}$/
const URL_OK = /^https?:\/\/[\x21-\x7e]+$/
const ascii = s => String(s ?? '').replace(/[^\x20-\x7e]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * One push per alert to ntfy (the Studio's studioSendAlerts, moved in). ntfy headers are latin-1 on
 * the wire, so the title is cut to printable ASCII and people's words go in the body only. Click
 * opens the queue at the alert's tab: clickBase plus tab=..., or clickBase(alert) when a function.
 * No topic (or a bad one) sends nothing. Never throws: resolves true when ntfy took it.
 */
export function ntfyAlert(topic, clickBase, opts = {}) {
  const t = String(topic ?? '').trim()
  const ok = TOPIC.test(t) ? t : ''
  const server = String(opts.server || 'https://ntfy.sh').replace(/\/+$/, '')
  const log = opts.log || ((...a) => console.error(...a))
  const send = async (a) => {
    if (!ok || !a) return false
    try {
      const headers = { Title: ascii(a.title) || 'Moderation' }
      const tags = ascii(opts.tags)
      if (tags) headers.Tags = tags
      let click = typeof clickBase === 'function' ? clickBase(a) : clickBase
      if (typeof clickBase === 'string' && clickBase && a.tab) {
        click = `${clickBase}${clickBase.includes('?') ? '&' : '?'}tab=${encodeURIComponent(a.tab)}`
      }
      if (typeof click === 'string' && URL_OK.test(click)) headers.Click = click
      const f = opts.fetch || globalThis.fetch
      const r = await f(`${server}/${ok}`, {
        method: 'POST',
        headers,
        body: String(a.body ?? ''),
        signal: AbortSignal.timeout(opts.timeout ?? 5000),
      })
      if (!r.ok) throw new Error(`ntfy ${r.status}`)
      return true
    } catch (e) {
      try { log('[placecard-kit/moderation] alert failed:', e?.message || String(e)) } catch { /* never throws */ }
      return false
    }
  }
  send.ready = Boolean(ok)
  return send
}

const reasonWord = (k, code) =>
  k.reasonWords?.[code] || String(code).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())

// ---- The instance --------------------------------------------------------------------------------

// setItem's marker for a column set to now() in the statement itself
const NOW = Symbol('now')

const iso = v => (v == null ? null : (v instanceof Date ? v : new Date(v)).toISOString())

function itemOut(r) {
  return {
    id: String(r.id),
    instance: r.instance,
    kind: r.kind,
    ref: r.ref,
    owner: r.owner_sub,
    state: r.state,
    hiddenBy: r.hidden_by ?? null,
    reportsOpen: Number(r.reports_open),
    submittedAt: iso(r.submitted_at),
    decidedAt: iso(r.decided_at),
    decidedBy: r.decided_by ?? null,
    updatedAt: iso(r.updated_at),
  }
}

const b64 = s => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = s => atob(s.replace(/-/g, '+').replace(/_/g, '/'))

function cursorOf(at, id) {
  return b64(`${at}|${id}`)
}

// Postgres's own text for a timestamptz, so the next page starts exactly after the last row
const PG_TS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}(:\d{2}){0,2})?$/

function readCursor(c) {
  try {
    const [at, id, extra] = unb64(String(c)).split('|')
    if (extra !== undefined || !PG_TS.test(at) || !/^[1-9]\d{0,17}$/.test(id)) throw 0
    return { at, id }
  } catch {
    throw err('bad_page', 400)
  }
}

// Each tab: which items, the time it orders by, and which way (newest first or oldest first).
const TABS = {
  waiting: { where: `i.state = 'pending'`, at: 'i.submitted_at', dir: 'ASC' },
  reported: {
    where: `i.state = 'reported'`,
    at: `COALESCE((SELECT min(r.created_at) FROM moderation_reports r
                    WHERE r.item_id = i.id AND r.resolved_at IS NULL), i.updated_at)`,
    dir: 'ASC',
  },
  hidden: { where: `i.state = 'hidden' AND i.hidden_by = 'admin'`, at: 'i.decided_at', dir: 'DESC' },
  latest: { where: `i.state IN ('approved', 'reported')`, at: 'i.submitted_at', dir: 'DESC' },
}

/**
 * An instance: createModeration({ instance, db, transaction, kinds, alert }). Moves run in one
 * transaction (the host's, when it hands its client to submit, edit, takedown or replace) and
 * write one event row each; kinds' after() and alerts run once it commits, and never fail a move.
 */
export function createModeration(opts) {
  const { instance, db, transaction, kinds, alert } = opts || {}
  if (typeof instance !== 'string' || !instance || instance.length > 32) throw new TypeError('createModeration: instance, 1 to 32 characters')
  if (!db || typeof db.query !== 'function') throw new TypeError('createModeration: db.query')
  if (typeof transaction !== 'function') throw new TypeError('createModeration: transaction(fn)')
  if (!kinds || typeof kinds !== 'object' || !Object.keys(kinds).length) throw new TypeError('createModeration: kinds')
  for (const [key, k] of Object.entries(kinds)) {
    const at = `createModeration: kinds.${key}`
    if (key.length > 32) throw new TypeError(`${at}: a key of at most 32 characters`)
    if (!k || typeof k.label !== 'string' || !k.label) throw new TypeError(`${at}.label`)
    if (!Array.isArray(k.reasons) || !k.reasons.length || k.reasons.some(r => typeof r !== 'string' || !r || r.length > 24)) {
      throw new TypeError(`${at}.reasons: codes of 1 to 24 characters`)
    }
    for (const fn of ['show', 'unshow', 'preview']) if (typeof k[fn] !== 'function') throw new TypeError(`${at}.${fn}`)
    for (const fn of ['after', 'publicWhilePending', 'revision']) {
      if (k[fn] != null && typeof k[fn] !== 'function') throw new TypeError(`${at}.${fn}`)
    }
  }
  if (alert != null && typeof alert !== 'function') throw new TypeError('createModeration: alert')
  const kindKeys = Object.keys(kinds)
  const defaults = { queue: true, alerts: true, ...opts.defaults }
  const perDay = opts.reportsPerDay ?? REPORTS_PER_DAY
  const words = { reported: 'Reported', by: 'By', ...opts.words }
  const log = (...a) => { try { console.error('[placecard-kit/moderation]', ...a) } catch { /* never */ } }

  const kindOf = (kind) => {
    if (typeof kind !== 'string' || !Object.hasOwn(kinds, kind)) throw err('bad_kind', 400)
    return kinds[kind]
  }
  const refOf = (ref) => {
    const r = typeof ref === 'number' && Number.isFinite(ref) ? String(ref) : ref
    if (typeof r !== 'string' || !r || r.length > 64) throw err('bad_ref', 400)
    return r
  }
  const subOf = (actor) => {
    if (!actor || actor.sub == null || actor.sub === '') throw err('sign_in', 401)
    if (typeof actor.sub !== 'string' || actor.sub.length > 255) throw err('bad_actor', 400)
    return actor.sub
  }
  const adminOf = (actor) => {
    const sub = subOf(actor)
    if (actor.admin !== true) throw err('admins_only', 403)
    return sub
  }

  async function readSettings(c) {
    const row = (await c.query('SELECT queue, alerts FROM moderation_settings WHERE instance = $1', [instance])).rows[0]
    return row ? { queue: row.queue, alerts: row.alerts } : { queue: defaults.queue, alerts: defaults.alerts }
  }

  async function load(c, kind, ref) {
    return (await c.query(
      'SELECT * FROM moderation_items WHERE instance = $1 AND kind = $2 AND ref = $3 FOR UPDATE',
      [instance, kind, ref])).rows[0] || null
  }

  // The refs among these whose last approved version the kind keeps public while a change waits
  async function standing(c, k, refs) {
    if (!k.publicWhilePending || !refs.length) return new Set()
    const got = await k.publicWhilePending(c, refs)
    return new Set(got == null ? [] : [...got].map(String))
  }

  // Each ref's content as the admin is shown it: the kind's revision, else its preview
  async function contentOf(c, k, refs, previews) {
    if (k.revision) return (await k.revision(c, refs)) || {}
    return previews || (await k.preview(c, refs)) || {}
  }

  // The state an admin's hide took this item from (restore puts a waiting change back in the queue)
  async function hiddenFrom(c, id) {
    return (await c.query(
      `SELECT from_state FROM moderation_events WHERE item_id = $1 AND move = 'hide' ORDER BY id DESC LIMIT 1`,
      [id])).rows[0]?.from_state ?? null
  }

  async function event(c, id, move, from, to, actor) {
    await c.query(
      'INSERT INTO moderation_events (item_id, move, from_state, to_state, actor) VALUES ($1, $2, $3, $4, $5)',
      [id, move, from === 'new' ? null : from, to, actor])
  }

  // Closes the item's open reports; the caller sets reports_open to 0 in its own update.
  async function closeReports(c, id, resolution) {
    await c.query(
      `UPDATE moderation_reports SET resolved_at = now(), resolution = $2 WHERE item_id = $1 AND resolved_at IS NULL`,
      [id, resolution])
  }

  // f: column to value, or NOW for now() in the statement (the columns are the module's own names)
  async function setItem(c, id, f) {
    const vals = [id]
    const sets = Object.entries(f).map(([col, v]) => (v === NOW ? `${col} = now()` : `${col} = $${vals.push(v)}`))
    return (await c.query(
      `UPDATE moderation_items SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`, vals)).rows[0]
  }

  async function apply(c, k, ref, to, why) {
    if (shownToAll(to)) await k.show(c, ref)
    else await k.unshow(c, ref, why)
  }

  // A move's body runs in fn(client, fx); fx collects what runs after the commit.
  async function run(client, fn) {
    const fx = []
    const res = client ? await fn(client, fx) : await transaction(c => fn(c, fx))
    let done = null
    const after = () => (done ||= settle(fx))
    if (!client) await after()
    return { ...res, after }
  }

  async function settle(fx) {
    for (const f of fx) {
      try {
        if (f.after) await kinds[f.kind].after?.([f.ref])
        else if (f.alert) await sendAlert(f)
      } catch (e) {
        log(f.after ? 'after failed:' : 'alert failed:', e?.message || String(e))
      }
    }
  }

  async function sendAlert(f) {
    if (!alert) return
    const k = kinds[f.kind]
    let p = null
    try {
      p = (await k.preview(db, [f.ref]))?.[f.ref] || null
    } catch (e) {
      log('preview for alert failed:', e?.message || String(e))
    }
    const lines = f.alert === 'new'
      ? [p?.title, p?.where, p?.by ? `${words.by} ${p.by}` : null, p?.text]
      : [k.label, p?.title, p?.where, reasonWord(k, f.reason)]
    const body = lines.filter(x => x != null && String(x).trim()).join('\n') || k.label
    await alert({
      event: f.alert,
      instance,
      kind: f.kind,
      ref: f.ref,
      state: f.state,
      title: f.alert === 'new' ? (k.alertTitle || `New ${k.label.toLowerCase()}`) : words.reported,
      body,
      // a report on a waiting change is with the change, in Waiting
      tab: f.state === 'pending' ? 'waiting' : f.alert === 'reported' ? 'reported' : 'latest',
    })
  }

  // ---- Owner and system moves ----

  // opts.review (a forced review): it waits for an admin whatever the switch says, unless its owner is one
  async function submit(actor, kind, ref, client, opts) {
    const sub = subOf(actor)
    const review = opts?.review === true
    const k = kindOf(kind)
    const r = refOf(ref)
    return run(client, async (c, fx) => {
      const s = await readSettings(c)
      const row = await load(c, kind, r)
      if (row && row.owner_sub !== sub) throw err('not_yours', 403)
      const from = row ? row.state : 'new'
      const isAdmin = actor.admin === true
      const to = nextState(from, 'submit', {
        queue: s.queue, review, ownerIsAdmin: isAdmin, reports: row ? Number(row.reports_open) : 0, hiddenBy: row?.hidden_by,
      })
      const decidedBy = to === 'pending' ? null : isAdmin ? 'own' : 'auto'
      const item = row
        ? await setItem(c, row.id, {
          state: to, hidden_by: null, submitted_at: NOW, decided_at: decidedBy ? NOW : null, decided_by: decidedBy,
        })
        : (await c.query(
          `INSERT INTO moderation_items (instance, kind, ref, owner_sub, state, decided_at, decided_by)
           VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::boolean THEN now() END, $7)
           ON CONFLICT ON CONSTRAINT moderation_items_ref_uq DO NOTHING RETURNING *`,
          [instance, kind, r, sub, to, Boolean(decidedBy), decidedBy])).rows[0]
      if (!item) throw err('conflict', 409, 'the item was submitted at the same moment; try again')
      await event(c, item.id, 'submit', from, to, sub)
      await apply(c, k, r, to, 'pending')
      fx.push({ after: true, kind, ref: r })
      if (s.alerts && (to === 'pending' || (from === 'new' && !isAdmin))) fx.push({ alert: 'new', kind, ref: r, state: to })
      return { item: itemOut(item), move: 'submit', from, to }
    })
  }

  async function edit(actor, kind, ref, client, opts) {
    const sub = subOf(actor)
    const review = opts?.review === true
    const k = kindOf(kind)
    const r = refOf(ref)
    return run(client, async (c, fx) => {
      const s = await readSettings(c)
      const row = await load(c, kind, r)
      if (!row) throw err('not_found', 404)
      if (row.owner_sub !== sub) throw err('not_yours', 403)
      const from = row.state
      const isAdmin = actor.admin === true
      const to = nextState(from, 'edit', { queue: s.queue, review, ownerIsAdmin: isAdmin })
      const item = await setItem(c, row.id, to === 'pending'
        ? { state: to, submitted_at: NOW, decided_at: null, decided_by: null }
        : { submitted_at: NOW })
      await event(c, item.id, 'edit', from, to, sub)
      await apply(c, k, r, to, 'pending')
      fx.push({ after: true, kind, ref: r })
      if (s.alerts && to === 'pending') fx.push({ alert: 'new', kind, ref: r, state: to })
      return { item: itemOut(item), move: 'edit', from, to }
    })
  }

  async function takedown(actor, kind, ref, client) {
    const sub = subOf(actor)
    const k = kindOf(kind)
    const r = refOf(ref)
    return run(client, async (c, fx) => {
      const row = await load(c, kind, r)
      if (!row) throw err('not_found', 404)
      if (row.owner_sub !== sub) throw err('not_yours', 403)
      const from = row.state
      const to = nextState(from, 'takedown', { hiddenBy: row.hidden_by })
      const item = await setItem(c, row.id, { state: to, hidden_by: 'owner', decided_at: NOW, decided_by: 'own' })
      await event(c, item.id, 'takedown', from, to, sub)
      await apply(c, k, r, to, 'hidden')
      fx.push({ after: true, kind, ref: r })
      return { item: itemOut(item), move: 'takedown', from, to }
    })
  }

  async function replace(kind, ref, client) {
    const k = kindOf(kind)
    const r = refOf(ref)
    return run(client, async (c, fx) => {
      const row = await load(c, kind, r)
      if (!row) throw err('not_found', 404)
      const from = row.state
      const to = nextState(from, 'replace', { hiddenBy: row.hidden_by })
      await closeReports(c, row.id, 'hidden')
      const item = await setItem(c, row.id, {
        state: to, hidden_by: 'replaced', reports_open: 0, decided_at: NOW, decided_by: 'system',
      })
      await event(c, item.id, 'replace', from, to, 'system')
      await apply(c, k, r, to, 'replaced')
      fx.push({ after: true, kind, ref: r })
      return { item: itemOut(item), move: 'replace', from, to }
    })
  }

  // ---- Players ----

  async function report(actor, kind, ref, reason) {
    const sub = subOf(actor)
    const k = kindOf(kind)
    const r = refOf(ref)
    if (typeof reason !== 'string' || !k.reasons.includes(reason)) throw err('bad_reason', 400)
    return run(null, async (c, fx) => {
      const row = await load(c, kind, r)
      if (!row) throw err('not_found', 404)
      if (row.owner_sub === sub) throw err('own_item', 403)
      const from = row.state
      const pub = from === 'pending' && (await standing(c, k, [r])).has(r)
      const to = nextState(from, 'report', { public: pub })
      // one reporter at a time across the database (the limit counts all of a player's reports): released at commit
      await c.query("SELECT pg_advisory_xact_lock(hashtext('tt-mod-report'), hashtext($1))", [sub])
      const mine = await c.query('SELECT 1 FROM moderation_reports WHERE item_id = $1 AND reporter_sub = $2', [row.id, sub])
      if (mine.rows.length) return { item: itemOut(row), move: 'report', from, to: from, already: true }
      const today = (await c.query(
        `SELECT count(*)::int AS n FROM moderation_reports WHERE reporter_sub = $1 AND created_at > now() - interval '1 day'`,
        [sub])).rows[0].n
      if (today >= perDay) throw err('limit', 429)
      await c.query('INSERT INTO moderation_reports (item_id, reporter_sub, reason) VALUES ($1, $2, $3)', [row.id, sub, reason])
      const item = (await c.query(
        `UPDATE moderation_items SET state = $2, reports_open = reports_open + 1, updated_at = now()
          WHERE id = $1 RETURNING *`, [row.id, to])).rows[0]
      await event(c, item.id, 'report', from, to, sub)
      if (Number(item.reports_open) === 1 && (await readSettings(c)).alerts) {
        fx.push({ alert: 'reported', kind, ref: r, state: to, reason })
      }
      return { item: itemOut(item), move: 'report', from, to }
    })
  }

  // ---- Admins ----

  // opts.seen: the revision the admin saw (a queue row's `revision`). Approve, keep and restore answer 409
  // 'moved' when the item changed since; without it, as before 1.5.0.
  async function move(actor, kind, ref, mv, opts) {
    const sub = adminOf(actor)
    const k = kindOf(kind)
    const r = refOf(ref)
    if (!MOD_ADMIN_MOVES.includes(mv)) throw err('bad_move', 400)
    const seen = opts?.seen ?? null
    if (seen !== null && (typeof seen !== 'string' || !seen)) throw err('bad_seen', 400)
    return run(null, async (c, fx) => {
      const row = await load(c, kind, r)
      if (!row) throw err('not_found', 404)
      const from = row.state
      const pub = from === 'pending' && mv === 'hide' && (await standing(c, k, [r])).has(r)
      const was = from === 'hidden' && mv === 'restore' ? await hiddenFrom(c, row.id) : null
      const to = nextState(from, mv, { hiddenBy: row.hidden_by, public: pub, hiddenFrom: was })
      if (seen !== null && MOD_SEEN_MOVES.includes(mv)) {
        const at = (await c.query('SELECT submitted_at::text AS t FROM moderation_items WHERE id = $1', [row.id])).rows[0].t
        const now = await modRevision(at, (await contentOf(c, k, [r]))[r] ?? null)
        if (now !== seen) throw err('moved', 409)
      }
      const decided = to === 'pending' ? { decided_at: null, decided_by: null } : { decided_at: NOW, decided_by: sub }
      let f
      if (mv === 'approve' || mv === 'keep') {
        await closeReports(c, row.id, 'kept')
        f = { state: to, hidden_by: null, reports_open: 0, ...decided }
      } else if (mv === 'decline' || mv === 'hide') {
        await closeReports(c, row.id, 'hidden')
        f = { state: to, hidden_by: mv === 'hide' ? 'admin' : null, reports_open: 0, ...decided }
      } else {
        f = { state: to, hidden_by: null, ...decided } // restore: hide closed every report
      }
      const item = await setItem(c, row.id, f)
      await event(c, item.id, mv, from, to, sub)
      if (mv !== 'keep') {
        await apply(c, k, r, to, to === 'pending' ? 'pending' : mv === 'decline' ? 'declined' : 'hidden')
        fx.push({ after: true, kind, ref: r })
      }
      return { item: itemOut(item), move: mv, from, to }
    })
  }

  async function settings() {
    const s = await readSettings(db)
    const waiting = (await db.query(
      `SELECT count(*)::int AS n FROM moderation_items WHERE instance = $1 AND kind = ANY($2::text[]) AND state = 'pending'`,
      [instance, kindKeys])).rows[0].n
    return { queue: s.queue, alerts: s.alerts, topic: Boolean(alert) && alert.ready !== false, waiting }
  }

  async function saveSettings(actor, patch) {
    const sub = adminOf(actor)
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw err('bad_settings', 400)
    const keys = Object.keys(patch)
    if (!keys.length || keys.some(key => !['queue', 'alerts'].includes(key) || typeof patch[key] !== 'boolean')) {
      throw err('bad_settings', 400)
    }
    await transaction(c => c.query(
      `INSERT INTO moderation_settings (instance, queue, alerts, updated_by, updated_at)
       VALUES ($1, COALESCE($2::boolean, $4::boolean), COALESCE($3::boolean, $5::boolean), $6, now())
       ON CONFLICT (instance) DO UPDATE SET
         queue = COALESCE($2::boolean, moderation_settings.queue),
         alerts = COALESCE($3::boolean, moderation_settings.alerts),
         updated_by = $6, updated_at = now()`,
      [instance, patch.queue ?? null, patch.alerts ?? null, defaults.queue, defaults.alerts, sub]))
    return settings()
  }

  async function queue(actor, tab, page = {}) {
    adminOf(actor)
    const t = TABS[tab]
    if (!t || !Object.hasOwn(TABS, tab)) throw err('bad_tab', 400)
    const limit = Math.max(1, Math.min(100, Math.floor(Number(page?.limit)) || 30))
    const cur = page?.before ? readCursor(page.before) : null
    const cmp = t.dir === 'ASC' ? '>' : '<'
    const rows = (await db.query(
      `SELECT q.*, q.k_at::text AS k_text, q.submitted_at::text AS submitted_text FROM (
         SELECT i.*, ${t.at} AS k_at FROM moderation_items i
          WHERE i.instance = $1 AND i.kind = ANY($2::text[]) AND ${t.where}) q
        WHERE $3::timestamptz IS NULL OR (q.k_at, q.id) ${cmp} ($3::timestamptz, $4::bigint)
        ORDER BY q.k_at ${t.dir}, q.id ${t.dir}
        LIMIT $5`,
      [instance, kindKeys, cur?.at ?? null, cur?.id ?? null, limit + 1])).rows
    const more = rows.length > limit
    const shown = rows.slice(0, limit)
    const reported = shown.filter(x => Number(x.reports_open) > 0).map(x => String(x.id))
    const reasons = {}
    if (reported.length) {
      for (const x of (await db.query(
        `SELECT item_id, reason, count(*)::int AS n FROM moderation_reports
          WHERE item_id = ANY($1::bigint[]) AND resolved_at IS NULL GROUP BY item_id, reason ORDER BY item_id, reason`,
        [reported])).rows) {
        (reasons[String(x.item_id)] ||= {})[x.reason] = x.n
      }
    }
    const previews = {}
    const contents = {}
    const stands = {}
    for (const kind of [...new Set(shown.map(x => x.kind))]) {
      const refs = shown.filter(x => x.kind === kind).map(x => x.ref)
      previews[kind] = (await kinds[kind].preview(db, refs)) || {}
      contents[kind] = await contentOf(db, kinds[kind], refs, previews[kind])
      stands[kind] = await standing(db, kinds[kind], shown.filter(x => x.kind === kind && x.state === 'pending').map(x => x.ref))
    }
    const revisions = await Promise.all(shown.map(x => modRevision(x.submitted_text, contents[x.kind][x.ref] ?? null)))
    const counts = (await db.query(
      `SELECT count(*) FILTER (WHERE state = 'pending')::int AS waiting,
              count(*) FILTER (WHERE state = 'reported')::int AS reported,
              count(*) FILTER (WHERE state = 'hidden' AND hidden_by = 'admin')::int AS hidden
         FROM moderation_items WHERE instance = $1 AND kind = ANY($2::text[])`,
      [instance, kindKeys])).rows[0]
    const last = shown[shown.length - 1]
    return {
      tab,
      rows: shown.map((x, i) => {
        const item = itemOut(x)
        // public: a waiting change whose approved version stays in view, so Hide is offered
        if (stands[x.kind].has(x.ref)) item.public = true
        return {
          ...item,
          kindLabel: kinds[x.kind].label,
          preview: previews[x.kind][x.ref] || null,
          reasons: reasons[item.id] || {},
          moves: adminMoves(item),
          revision: revisions[i],
        }
      }),
      next: more ? cursorOf(last.k_text, String(last.id)) : null,
      counts: { waiting: counts.waiting, reported: counts.reported, hidden: counts.hidden },
    }
  }

  const refsOf = refs => (refs == null ? null : [...new Set(refs.map(refOf))])

  async function mine(sub, kind, refs) {
    kindOf(kind)
    if (typeof sub !== 'string' || !sub) return []
    const list = refsOf(refs)
    if (list && !list.length) return []
    const rows = (await db.query(
      `SELECT * FROM moderation_items
        WHERE instance = $1 AND kind = $2 AND owner_sub = $3
          AND (state IN ('pending', 'declined') OR (state = 'hidden' AND hidden_by <> 'replaced'))
          AND ($4::text[] IS NULL OR ref = ANY($4::text[]))
        ORDER BY submitted_at DESC, id DESC`,
      [instance, kind, sub, list])).rows
    return rows.map(x => ({ ...itemOut(x), label: ownerLabel(x) }))
  }

  async function reportedBy(sub, kind, refs) {
    kindOf(kind)
    const list = refsOf(refs || [])
    if (typeof sub !== 'string' || !sub || !list.length) return []
    return (await db.query(
      `SELECT i.ref FROM moderation_reports r JOIN moderation_items i ON i.id = r.item_id
        WHERE i.instance = $1 AND i.kind = $2 AND r.reporter_sub = $3 AND i.ref = ANY($4::text[])
        ORDER BY i.ref`,
      [instance, kind, sub, list])).rows.map(x => x.ref)
  }

  return Object.freeze({
    instance, settings, saveSettings, submit, edit, takedown, replace, report, move, queue, mine, reportedBy,
  })
}
