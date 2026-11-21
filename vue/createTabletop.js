/**
 * The one entry (kit CONTRACT.md): an instance's tabletop from its config.
 *
 *   const tabletop = createTabletop(config)          // throws one TypeError listing every config problem
 *   <Tabletop :tabletop="tabletop" />                 // or <component :is="tabletop.Tabletop" :tabletop="tabletop" />
 *
 * Returns { contractVersion, config, collection, loading, error, load, table, hand, plan, Tabletop, dispose }:
 * - collection: a shallow ref, null until load() succeeds; loading and error: refs.
 * - load(): runs config.source.load() (one call at a time; a second call while one runs gets the same promise),
 *   checks what it returns (core ttCollectionErrors: error is set and it returns null on a problem), adds
 *   `faces: config.faces` when the collection has none, keeps it in `collection` and returns it.
 * - table: a shallow ref of the mounted table's handle (TtTable's exposed { t, T, change, openCard, ... }), set
 *   by Tabletop on mount and null before it and after unmount.
 * - hand: useTtHand under config.hand's key, with config.hand.scope as the payload's scope.
 * - plan(input, meta): the planning mode's solver. day: solveDay(rules, input, { app, madeBy: null, ...meta }),
 *   a record v2 (meta gives id, set and madeAt); path: solvePath(input, directions), a Promise of
 *   { record, geometry, timingError }. Throws when the config has no planning mode.
 * - dispose(): stops the hand's watchers. Called inside a component's setup, they stop with the component anyway.
 */
import { effectScope, markRaw, ref, shallowRef } from 'vue'
import { solveDay, solvePath } from '@pincast/placecard-kit/planner'
import { CONTRACT_VERSION } from '../core/index.js'
import { ttCheckConfig, ttCollectionErrors } from '../core/tabletop.js'
import { useTtHand } from './useTtHand.js'
import Tabletop from './Tabletop.vue'

export function createTabletop(config) {
  ttCheckConfig(config, CONTRACT_VERSION)
  const scope = effectScope()
  const collection = shallowRef(null)
  const loading = ref(false)
  const error = ref(null)
  const table = shallowRef(null)
  const h = config.hand
  const hand = scope.run(() => useTtHand(h.scope, { key: h.key, store: h.store }))

  let running = null
  function load() {
    if (running) return running
    loading.value = true
    error.value = null
    running = (async () => {
      try {
        const data = await config.source.load()
        const errs = ttCollectionErrors(data, config)
        if (errs.length) {
          error.value = new TypeError(`createTabletop: the collection has ${errs.length} ${errs.length === 1 ? 'problem' : 'problems'}\n- ${errs.join('\n- ')}`)
          return null
        }
        const out = data.faces ? data : { ...data, faces: config.faces }
        collection.value = out
        return out
      } catch (e) {
        error.value = e
        return null
      } finally {
        loading.value = false
        running = null
      }
    })()
    return running
  }

  function plan(input, meta = {}) {
    const p = config.modes.planning
    if (!p) throw new Error('createTabletop: this tabletop has no planning mode (config.modes.planning)')
    if (p.solver === 'day') return solveDay(p.rules, input, { app: config.app, madeBy: null, ...meta })
    return solvePath(input, p.directions || null)
  }

  return markRaw({
    contractVersion: CONTRACT_VERSION,
    config,
    collection,
    loading,
    error,
    load,
    table,
    hand,
    plan,
    Tabletop,
    dispose: () => scope.stop(),
  })
}
