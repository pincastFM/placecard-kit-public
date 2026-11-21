/**
 * The hand (2026-10-23): the cards a visitor picks off the tabletop, in their order, before
 * the day (utils/tabletop/day.js) turns them into a timed itinerary. Pure JS: no Vue, no storage.
 *
 * A hand is an ordered array of entries { key, kind }:
 *   kind 'card': key is the zone card's key (the zone API's `key`, the tabletop card's ref.key);
 *   kind 'event': key is the event's own key (the zone API's events[].key, 'ev-...'), not one night
 *        of it. A multi-night event is one card on the table; the day picks the night in its window.
 * An entry is the same entry when key and kind match. Every function returns a new array and never
 * changes the one passed in. There is no cap: the day reports what did not fit.
 */

export const HAND_V = 1
const KINDS = ['card', 'event']

// An entry from a key or an { key, kind } object; null when it is not one.
export function handEntry(key, kind = 'card') {
  if (key && typeof key === 'object') return handEntry(key.key, key.kind || 'card')
  if (key == null || key === '' || !KINDS.includes(kind)) return null
  return { key: String(key), kind }
}

const same = (a, b) => a.key === b.key && a.kind === b.kind

// The position of an entry, or -1. With no kind, the first entry with that key of either kind.
function indexOf(hand, key, kind) {
  const k = String(key)
  return (hand || []).findIndex(e => e && e.key === k && (!kind || e.kind === kind))
}

export function handHas(hand, key, kind) {
  return indexOf(hand, key, kind) >= 0
}

/** Add an entry (at `index`, else at the end). Already held: the hand as it was, copied. */
export function handAdd(hand, entry, index) {
  const list = [...(hand || [])]
  const e = handEntry(entry)
  if (!e || list.some(x => same(x, e))) return list
  const at = Number.isInteger(index) ? Math.max(0, Math.min(index, list.length)) : list.length
  list.splice(at, 0, e)
  return list
}

/** Remove an entry by key (and kind, when given). */
export function handRemove(hand, key, kind) {
  const k = String(key)
  return (hand || []).filter(e => !(e.key === k && (!kind || e.kind === kind)))
}

/** Move the entry at `from` to `to` (both clamped). Out of range: the hand as it was, copied. */
export function handMove(hand, from, to) {
  const list = [...(hand || [])]
  if (!Number.isInteger(from) || from < 0 || from >= list.length || !Number.isInteger(to)) return list
  const [e] = list.splice(from, 1)
  list.splice(Math.max(0, Math.min(to, list.length)), 0, e)
  return list
}

/** Held: take it out. Not held: add it at the end. */
export function handToggle(hand, entry) {
  const e = handEntry(entry)
  if (!e) return [...(hand || [])]
  return handHas(hand, e.key, e.kind) ? handRemove(hand, e.key, e.kind) : handAdd(hand, e)
}

// ── Keeping a hand (the caller writes it to storage) ───────────────────────────────
/** A hand as a plain object to store: { v, zone, entries }. */
export function handSave(hand, zone) {
  return { v: HAND_V, zone: String(zone || ''), entries: (hand || []).map(e => ({ key: String(e.key), kind: e.kind })) }
}

const toSet = (x) => (x instanceof Set ? x : x instanceof Map ? new Set(x.keys()) : new Set([...(x || [])].map(String)))

/**
 * A stored hand back, for one zone. Returns [] for another version, another zone or anything
 * unreadable; drops entries that are malformed, repeated, or whose key the zone no longer has.
 * cardKeys, eventKeys: the zone's current keys (a Set, a Map or an array). Leave one out to keep
 * that kind unchecked.
 */
export function handRestore(saved, { zone, cardKeys = null, eventKeys = null } = {}) {
  if (!saved || typeof saved !== 'object' || saved.v !== HAND_V) return []
  if (String(saved.zone || '') !== String(zone || '')) return []
  if (!Array.isArray(saved.entries)) return []
  const known = { card: cardKeys ? toSet(cardKeys) : null, event: eventKeys ? toSet(eventKeys) : null }
  let hand = []
  for (const raw of saved.entries) {
    const e = handEntry(raw)
    if (!e) continue
    if (known[e.kind] && !known[e.kind].has(e.key)) continue
    hand = handAdd(hand, e)
  }
  return hand
}
