// @vitest-environment jsdom
// Ported from NYID tests/tabletopHandStore.test.js: the same assertions, the kit's paths.
/**
 * The tabletop hand kept in this browser (composables/useTtHand.js, 2026-10-23): the key per
 * zone and per demo, nothing written before restore, vanished keys dropped, storage that throws.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useTtHand, ttHandKey } from '../../vue/useTtHand.js'
import { handSave } from '../../core/hand.js'

// A stubbed store: a Map behind the safeLocal shape.
function memStore(seed = {}) {
  const m = new Map(Object.entries(seed))
  return { m, get: k => (m.has(k) ? m.get(k) : null), set: (k, v) => { m.set(k, String(v)) }, remove: k => { m.delete(k) } }
}
// A store whose every touch throws, like a browser that blocks site data.
const blocked = { get() { throw new Error('SecurityError') }, set() { throw new Error('SecurityError') }, remove() { throw new Error('SecurityError') } }

const A = { key: 'moa', kind: 'card' }
const B = { key: 'aloha-plate', kind: 'card' }
const EV = { key: 'ev-halloween-family-night', kind: 'event' }
const cardKeys = ['moa', 'aloha-plate', 'swig']
const eventKeys = ['ev-halloween-family-night']
const saved = (store, k) => JSON.parse(store.m.get(k))

describe('useTtHand', () => {
  let store
  beforeEach(() => { store = memStore() })

  it('keys a zone, and a demo apart from it', () => {
    expect(ttHandKey('provo')).toBe('vt_hand_provo')
    expect(ttHandKey('provo', true)).toBe('vt_hand_provo_demo')
  })

  it('writes nothing before restore, so an empty page never wipes a stored hand', async () => {
    store.set('vt_hand_provo', JSON.stringify(handSave([A, B], 'provo')))
    const h = useTtHand('provo', { store })
    h.add(EV)
    await nextTick()
    expect(saved(store, 'vt_hand_provo').entries).toEqual([A, B])
    expect(h.ready.value).toBe(false)
  })

  it('restores the stored hand and drops keys the zone no longer has', async () => {
    store.set('vt_hand_provo', JSON.stringify(handSave([A, { key: 'gone', kind: 'card' }, EV], 'provo')))
    const h = useTtHand('provo', { store })
    expect(h.restore({ cardKeys, eventKeys })).toEqual([A, EV])
    expect(h.count.value).toBe(2)
    // the stored copy loses the vanished key at once
    expect(saved(store, 'vt_hand_provo').entries).toEqual([A, EV])
  })

  it('stores every change, and removes the key when the hand is empty', async () => {
    const h = useTtHand('provo', { store })
    h.restore({ cardKeys, eventKeys })
    h.add(A); h.add(B); h.toggle(EV)
    await nextTick()
    expect(saved(store, 'vt_hand_provo')).toEqual({ v: 1, zone: 'provo', entries: [A, B, EV] })
    h.move(2, 0)
    await nextTick()
    expect(saved(store, 'vt_hand_provo').entries).toEqual([EV, A, B])
    expect(h.has('moa')).toBe(true)
    h.remove('moa'); h.toggle(EV)
    await nextTick()
    expect(saved(store, 'vt_hand_provo').entries).toEqual([B])
    h.clear()
    await nextTick()
    expect(store.m.has('vt_hand_provo')).toBe(false)
  })

  it('keeps a demo hand apart, and switches hands when the demo flag changes', async () => {
    store.set('vt_hand_provo', JSON.stringify(handSave([A], 'provo')))
    const demo = ref(true)
    const h = useTtHand('provo', { store, demo })
    expect(h.restore({ cardKeys, eventKeys })).toEqual([])
    h.add(B)
    await nextTick()
    expect(saved(store, 'vt_hand_provo_demo').entries).toEqual([B])
    expect(saved(store, 'vt_hand_provo').entries).toEqual([A])
    demo.value = false
    await nextTick()
    expect(h.hand.value).toEqual([A])
    expect(saved(store, 'vt_hand_provo_demo').entries).toEqual([B])
  })

  it('ignores a hand stored for another zone, another version, or unreadable text', () => {
    store.set('vt_hand_provo', JSON.stringify(handSave([A], 'portland')))
    expect(useTtHand('provo', { store }).restore({ cardKeys })).toEqual([])
    store.set('vt_hand_provo', JSON.stringify({ v: 99, zone: 'provo', entries: [A] }))
    expect(useTtHand('provo', { store }).restore({ cardKeys })).toEqual([])
    store.set('vt_hand_provo', '{not json')
    expect(useTtHand('provo', { store }).restore({ cardKeys })).toEqual([])
  })

  it('works on a browser that refuses storage', async () => {
    const h = useTtHand('provo', { store: blocked })
    expect(h.restore({ cardKeys, eventKeys })).toEqual([])
    h.add(A); h.add(EV)
    await nextTick()
    expect(h.hand.value).toEqual([A, EV])
    h.clear()
    await nextTick()
    expect(h.count.value).toBe(0)
  })

  it('uses safeLocal by default (window.localStorage under jsdom)', async () => {
    window.localStorage.removeItem('vt_hand_testzone')
    const h = useTtHand('testzone')
    h.restore()
    h.add(A)
    await nextTick()
    expect(JSON.parse(window.localStorage.getItem('vt_hand_testzone')).entries).toEqual([A])
    h.clear()
    await nextTick()
    expect(window.localStorage.getItem('vt_hand_testzone')).toBe(null)
  })
})
