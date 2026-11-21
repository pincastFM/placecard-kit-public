/**
 * The visitor's hand on the tabletop Selection, kept in this browser.
 *
 * Wraps utils/tabletop/hand.js (pure) with storage, the way LLZoneDeal.vue keeps its deal:
 * key `vt_hand_<zone>`, and `vt_hand_<zone>_demo` at a demo address (?demo=1), so a demo never
 * touches a visitor's own hand. Storage goes through utils/safeStorage.js: every read and write
 * is caught, and a browser that refuses storage keeps the hand in this tab's memory.
 *
 * Usage, in the table:
 *   const hand = useTtHand('provo', { demo: () => route.query.demo === '1' })
 *   onMounted(async () => { const data = ...; hand.restore({ cardKeys, eventKeys }) })
 *   hand.toggle(card.ref)        // { key, kind } off the tabletop card
 *
 * Nothing is written before restore() runs, so a page that loads with an empty hand never wipes
 * the stored one. Reads only on the client; on the server the hand is empty and nothing is stored.
 */
import { ref, computed, watch, toValue } from 'vue'
import { handAdd, handRemove, handMove, handToggle, handHas, handSave, handRestore } from '../core/hand.js'
import { safeLocal } from '../core/safeStorage.js'

export const TT_HAND_STORE = 'vt_hand_'

export function ttHandKey(zone, demo = false) {
  return `${TT_HAND_STORE}${zone}${demo ? '_demo' : ''}`
}

/**
 * zone: the zone slug (a string, ref or getter), kept in the stored payload as its scope.
 * options.demo: boolean, ref or getter; true keeps the hand under the demo key.
 * options.store: { get, set, remove } over strings (default safeLocal); tests pass their own.
 * options.key (createTabletop's hand.key): the storage key (a string, ref or getter) in place of the
 * derived ttHandKey(zone, demo); the payload keeps `zone`. Unset, the key is as before.
 */
export function useTtHand(zone, { demo = false, store = safeLocal, key: keyOpt = null } = {}) {
  const hand = ref([])
  const ready = ref(false)
  const key = computed(() => (keyOpt != null ? String(toValue(keyOpt)) : ttHandKey(toValue(zone), !!toValue(demo))))
  let known = {}

  function read() {
    try {
      const raw = store.get(key.value)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  function write() {
    if (!ready.value) return
    try {
      if (hand.value.length) store.set(key.value, JSON.stringify(handSave(hand.value, toValue(zone))))
      else store.remove(key.value)
    } catch { /* storage refused: the hand still works for this page */ }
  }

  /**
   * Load the stored hand once the zone's cards are known. cardKeys, eventKeys: the zone's current
   * keys (Set, Map or array); a key the zone no longer has is dropped. Returns the hand.
   */
  function restore({ cardKeys = null, eventKeys = null } = {}) {
    known = { cardKeys, eventKeys }
    hand.value = handRestore(read(), { zone: toValue(zone), cardKeys, eventKeys })
    ready.value = true
    write()   // keeps the stored copy free of the dropped keys
    return hand.value
  }

  // A different zone or a switch into or out of demo: that key's hand, against the last known keys.
  watch(key, () => { if (ready.value) restore(known) })
  watch(hand, write, { deep: true })

  return {
    hand,
    ready,
    key,
    count: computed(() => hand.value.length),
    restore,
    has: (k, kind) => handHas(hand.value, k, kind),
    add: (entry, index) => { hand.value = handAdd(hand.value, entry, index) },
    remove: (k, kind) => { hand.value = handRemove(hand.value, k, kind) },
    move: (from, to) => { hand.value = handMove(hand.value, from, to) },
    toggle: (entry) => { hand.value = handToggle(hand.value, entry) },
    clear: () => { hand.value = [] },
  }
}
