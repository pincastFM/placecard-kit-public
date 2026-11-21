// The moderation parts' shared words and requests (1.1.0; kit CONTRACT.md). The kit never signs anyone in and
// calls only the host's own endpoints: their paths are the
// `endpoints` prop, and a host whose bodies differ passes its own `request(op, args)`.

/** Every word the moderation parts write, by key; a host's `labels` replaces any of them. */
export const TT_MOD_LABELS = Object.freeze({
  // TtReport
  report: 'Report',
  reportTitle: 'Report',
  send: 'Report',
  cancel: 'Cancel',
  reported: 'Reported',
  // TtModChip (core ownerLabel's words)
  pending: 'Pending',
  declined: 'Declined',
  hidden: 'Hidden',
  // the admin moves (TtModHide, TtModQueue)
  approve: 'Approve',
  decline: 'Decline',
  keep: 'Keep',
  hide: 'Hide',
  restore: 'Restore',
  // TtModSwitches
  moderation: 'Moderation',
  queue: 'Approval queue',
  alerts: 'Alerts',
  on: 'On',
  off: 'Off',
  waiting: '{n} waiting',
  topic: 'ntfy',
  noTopic: 'No topic',
  // TtModQueue
  tabWaiting: 'Waiting',
  tabReported: 'Reported',
  tabHidden: 'Hidden',
  tabLatest: 'Latest',
  by: 'By',
  sent: 'Sent',
  shown: 'Shown',
  hiddenAt: 'Hidden',
  none: 'None',
  more: 'More',
  // answers
  failed: 'Failed',
  retry: 'Retry',
  limit: 'Limit reached',
  changed: 'Changed',
  // times: under a minute, minutes, hours, then the date in this locale
  now: 'now',
  min: 'min',
  h: 'h',
  locale: 'en-US',
})

/** The host's endpoints, the default paths */
export const TT_MOD_ENDPOINTS = Object.freeze({
  report: '/api/moderation/report',
  settings: '/api/admin/moderation/settings',
  queue: '/api/admin/moderation/queue',
  move: '/api/admin/moderation/move',
})

/** The labels with the defaults under them; `reasons` merges one level down, by kind */
export function ttModWords(labels) {
  const l = labels || {}
  return { ...TT_MOD_LABELS, ...l, reasons: { ...(l.reasons || {}) } }
}

/** A reason's word: the host's for this kind, else the code with its first letter raised and _ as spaces (as core's alerts) */
export function ttModReason(words, kind, code) {
  const k = words.reasons && words.reasons[kind]
  if (k && typeof k[code] === 'string') return k[code]
  return String(code).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

/** '{n} waiting' and the like */
export function ttModFill(word, vars) {
  return String(word).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m))
}

/** An item's time: now, 4 min, 3 h, then Oct 12 (labels.when(iso), a function, replaces this) */
export function ttModWhen(words, iso, now = Date.now()) {
  if (typeof words.when === 'function') return words.when(iso)
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const s = Math.max(0, (now - t) / 1000)
  if (s < 60) return words.now
  if (s < 3600) return `${Math.floor(s / 60)} ${words.min}`
  if (s < 86400) return `${Math.floor(s / 3600)} ${words.h}`
  try { return new Date(t).toLocaleDateString(words.locale || undefined, { month: 'short', day: 'numeric' }) } catch { return new Date(t).toDateString().slice(4, 10) }
}

/** A failed request: its HTTP status and the host's error code, when it gave one */
export class TtModRequestError extends Error {
  constructor(status, code, data) {
    super(`moderation request failed: ${status}${code ? ` ${code}` : ''}`)
    this.name = 'TtModRequestError'
    this.status = status
    this.code = code || null
    this.data = data ?? null
  }
}

const codeOf = d => (d && typeof d === 'object' ? d.code ?? (d.data && d.data.code) ?? d.statusMessage ?? null : null)

/**
 * The default request: one fetch to the host's endpoint for each op, JSON both ways, the session's cookie along.
 * ops: report { kind, ref, reason } (POST), settings (GET), saveSettings { queue?, alerts? } (PUT), queue { tab, before?,
 * limit? } (GET), move { kind, ref, move, seen? } (POST; seen, 1.5.0: the row's revision, sent only when given). Resolves the
 * host's JSON; a status outside 2xx throws TtModRequestError.
 */
export async function ttModRequest(op, args = {}, endpoints, fetchFn) {
  const ep = { ...TT_MOD_ENDPOINTS, ...(endpoints || {}) }
  const f = fetchFn || globalThis.fetch
  const init = { method: 'GET', credentials: 'same-origin', headers: { accept: 'application/json' } }
  const json = (method, body) => { init.method = method; init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body) }
  let url
  if (op === 'report') { url = ep.report; json('POST', { kind: args.kind, ref: String(args.ref), reason: args.reason }) }
  else if (op === 'settings') url = ep.settings
  else if (op === 'saveSettings') { url = ep.settings; json('PUT', args) }
  else if (op === 'queue') {
    const q = new URLSearchParams({ tab: args.tab })
    if (args.before) q.set('before', args.before)
    if (args.limit) q.set('limit', String(args.limit))
    url = `${ep.queue}${ep.queue.includes('?') ? '&' : '?'}${q}`
  } else if (op === 'move') {
    url = ep.move
    json('POST', { kind: args.kind, ref: String(args.ref), move: args.move, ...(typeof args.seen === 'string' ? { seen: args.seen } : {}) })
  }
  else throw new TypeError(`ttModRequest: no op '${op}'`)
  const res = await f(url, init)
  let data = null
  try { data = await res.json() } catch { data = null }
  if (!res.ok) throw new TtModRequestError(res.status, codeOf(data), data)
  return data
}

/**
 * The parts' one way to call the host: props.request when given, else ttModRequest on props.endpoints. A 401 calls
 * props.signIn() and resolves { signIn: true }; any other failure resolves { error } with its status.
 */
export async function ttModCall(props, op, args) {
  try {
    const data = props.request ? await props.request(op, args) : await ttModRequest(op, args, props.endpoints)
    return { data }
  } catch (e) {
    const status = e && typeof e.status === 'number' ? e.status : e && typeof e.statusCode === 'number' ? e.statusCode : 0
    if (status === 401) {
      if (typeof props.signIn === 'function') props.signIn()
      return { signIn: true, status }
    }
    return { error: e, status }
  }
}

/** The word for a failure: 429 the limit, otherwise Failed */
export const ttModErrWord = (words, status) => (status === 429 ? words.limit : words.failed)

let uidN = 0
/** An id for a part's labels and controls, unique on the page */
export const ttModUid = p => `tt-mod-${p}-${++uidN}`

/** The props every part that calls the host shares */
export const TT_MOD_CALL_PROPS = {
  endpoints: { type: Object, default: null },
  request: { type: Function, default: null },
  signIn: { type: Function, default: null },
  labels: { type: Object, default: () => ({}) },
}
