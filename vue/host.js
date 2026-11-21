/**
 * The host app's three hooks (kit CONTRACT.md). The kit loads no fonts,
 * sets nothing on <html>, keeps no unit store of its own and does not lock the page: it hands each to
 * the app that hosts it.
 *
 *   setTtHost({
 *     head: (entry) => useHead(entry),      // TtTable and TtFace: { htmlAttrs?, link: [{ key, rel, href }] }
 *     distUnit: () => useDistUnit(),        // TtDay: { unit (a ref, 'mi' or 'km'), toggle() }
 *     lock: ttHtmlLock,                     // TtStage, TtDay, TtPath: (on) while they cover the table
 *   })
 *
 * Call it once, before the first table or face renders (a plugin, or a module the app imports first).
 * Without a host: no head entries are made, TtDay keeps miles first, its km switch for this page, and
 * the page is not locked (the kit still knows it is covered: ttLocked()).
 */
import { ref } from 'vue'

const host = { head: null, distUnit: null, lock: null }
let locked = false
let local = null

export function setTtHost({ head, distUnit, lock } = {}) {
  if (head !== undefined) host.head = head
  if (distUnit !== undefined) host.distUnit = distUnit
  if (lock !== undefined) host.lock = lock
}

// A component's head entry (fonts, the table's data-tt), passed to the host as it is
export function ttHead(entry) {
  if (host.head) host.head(entry)
}

// The distance unit: the host's store, or one ref kept for this page
export function ttDistUnit() {
  if (host.distUnit) return host.distUnit()
  if (!local) {
    const unit = ref('mi')
    local = { unit, toggle() { unit.value = unit.value === 'km' ? 'mi' : 'km' } }
  }
  return local
}

// The page lock: the open card, a day or a path covers the table. The last call wins (each holder
// locks on open and unlocks on close), as the <html> attribute did in earlier versions; the host is told each time.
export function ttLock(on) {
  if (typeof document === 'undefined') return
  locked = !!on
  if (host.lock) host.lock(locked)
}

// Whether something over the table holds the page (TtTable's Escape leaves an open set alone then)
export function ttLocked() {
  return locked
}

// The Card room's own lock, for a host that wants it: data-tt-locked on <html>, which the table's
// stylesheet reads (overflow hidden). NYID and Treehopper pass it as their lock.
export function ttHtmlLock(on) {
  if (typeof document !== 'undefined') document.documentElement.toggleAttribute('data-tt-locked', !!on)
}
