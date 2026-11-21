// Site storage that never throws (from a VeryThere usability test, 2026-10-16).
//
// A browser set to block site data throws a SecurityError on any touch of localStorage or
// sessionStorage, even the bare read of the property; an old private tab reads fine and throws
// on every write. Either one used to stop the card walk: a grey page, or a paid link showing the
// price. Every get, set and remove here is caught. A value the browser refuses is kept in memory
// for this tab, so a buyer's proof still opens the walk until they leave the page; nothing is kept
// on the server side (no window), where module state would be shared between visitors.

const memory = { localStorage: new Map(), sessionStorage: new Map() }

function backing (name) {
  if (typeof window === 'undefined') return null
  try { return window[name] || null } catch { return null }
}

function make (name) {
  const mem = memory[name]
  return {
    /** The stored string, or null. A value this tab could not store is answered from memory. */
    get (key) {
      if (typeof window === 'undefined') return null
      const k = String(key)
      if (mem.has(k)) return mem.get(k)
      try {
        const s = backing(name)
        return s ? s.getItem(k) : null
      } catch { return null }
    },
    /** Stores the string; true when the browser kept it, false when only this tab's memory has it. */
    set (key, value) {
      if (typeof window === 'undefined') return false
      const k = String(key)
      const v = String(value)
      try {
        const s = backing(name)
        if (s) { s.setItem(k, v); mem.delete(k); return true }
      } catch { /* refused: memory below */ }
      mem.set(k, v)
      return false
    },
    remove (key) {
      if (typeof window === 'undefined') return
      const k = String(key)
      mem.delete(k)
      try {
        const s = backing(name)
        if (s) s.removeItem(k)
      } catch { /* refused: nothing stored there to remove */ }
    },
    /** Every key this tab can read (the browser's and the ones only memory holds); [] when refused. */
    keys () {
      if (typeof window === 'undefined') return []
      const out = new Set(mem.keys())
      try {
        const s = backing(name)
        if (s) for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k != null) out.add(k) }
      } catch { /* refused: memory only */ }
      return [...out]
    }
  }
}

export const safeLocal = make('localStorage')
export const safeSession = make('sessionStorage')

// The Storage shape (getItem, setItem, removeItem) over safeLocal, for code that takes a Storage,
// such as a pinia store's persist option.
export const safeLocalStorage = {
  getItem: (key) => safeLocal.get(key),
  setItem: (key, value) => { safeLocal.set(key, value) },
  removeItem: (key) => safeLocal.remove(key)
}

// Tests only: forget what memory holds.
export function _resetSafeStorageMemory () {
  memory.localStorage.clear()
  memory.sessionStorage.clear()
}
