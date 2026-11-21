<template>
  <section ref="root" class="tt-mod tt-mod-q" :aria-label="L.moderation">
    <div class="tt-mod-tabs" role="tablist" @keydown="onTabKey">
      <button
        v-for="t in TABS" :key="t" type="button" role="tab" class="tt-mod-tab" :class="{ 'is-on': t === cur }" :data-tab="t"
        :aria-selected="t === cur ? 'true' : 'false'" :tabindex="t === cur ? 0 : -1" @click="pick(t)"
      ><span>{{ tabWord(t) }}</span> <b v-if="countOf(t)" class="tt-mod-count">{{ countOf(t) }}</b></button>
    </div>
    <div class="tt-mod-panel" role="tabpanel" :aria-label="tabWord(cur)" :aria-busy="loading ? 'true' : null">
      <ul v-if="rows.length" class="tt-mod-rows">
        <li v-for="row in rows" :key="row.id" class="tt-mod-row" :class="{ 'has-thumb': !!img(row) }" :data-row="row.id" :data-kind="row.kind" :data-state="row.state">
          <a v-if="img(row)" class="tt-mod-thumb" :href="img(row)" target="_blank" rel="noopener" :aria-label="pv(row).title || row.kindLabel"><img :src="img(row)" alt="" loading="lazy" decoding="async"></a>
          <div class="tt-mod-body">
            <p class="tt-mod-kind">{{ row.kindLabel || row.kind }}<template v-if="pv(row).figure"> · {{ pv(row).figure }}</template></p>
            <p v-if="pv(row).title" class="tt-mod-title">{{ pv(row).title }}</p>
            <p v-if="pv(row).where" class="tt-mod-where">{{ pv(row).where }}</p>
            <p v-if="pv(row).text" class="tt-mod-text">{{ pv(row).text }}</p>
            <p class="tt-mod-meta">
              <span v-if="pv(row).by"><span class="tt-mod-k">{{ L.by }}</span> {{ pv(row).by }}</span>
              <span v-if="whenOf(row)"><span class="tt-mod-k">{{ whenWord(row) }}</span> {{ whenOf(row) }}</span>
            </p>
            <p v-if="reasonsOf(row).length" class="tt-mod-why">
              <span v-for="x in reasonsOf(row)" :key="x.code">{{ x.word }} <b>{{ x.n }}</b></span>
            </p>
          </div>
          <div class="tt-mod-acts">
            <button
              v-for="m in movesOf(row)" :key="m" type="button" class="tt-mod-btn" :class="{ 'is-primary': PRIMARY.includes(m) }" :data-move="m"
              :disabled="!!busyRow" :aria-busy="busyRow === row.id ? 'true' : null" @click="move(row, m)"
            >{{ L[m] }}</button>
            <slot name="row" :row="row" :tab="cur" :reload="reload" />
          </div>
          <p v-if="rowErr[row.id]" class="tt-mod-err" role="alert">{{ rowErr[row.id] }}</p>
        </li>
      </ul>
      <p v-else-if="!loading && !err" class="tt-mod-none">{{ L.none }}</p>
      <p v-if="err" class="tt-mod-err" role="alert">{{ err }} <button type="button" class="tt-mod-link" @click="reload">{{ L.retry }}</button></p>
      <button v-if="next && !err" type="button" class="tt-mod-btn tt-mod-more" :disabled="loading" @click="more">{{ L.more }}</button>
    </div>
  </section>
</template>

<script setup>
/**
 * 1.1.0: the admin queue: tabs Waiting, Reported, Hidden and Latest, with the counts the
 * host's queue answers; a row per item (its thumb, kind, title, where, text, by, time, open reports by reason) with
 * its `moves` as buttons, and slot `row` ({ row, tab, reload }) for an app's own action (the Studio's "Take down
 * set"), drawn after them. A move that takes the row out of its tab removes it and moves the counts; one that leaves
 * it (Keep in Latest) updates it in place. Approve, Keep and Restore send the row's `revision` as `seen` (1.5.0). A 409
 * reloads the tab, and a row still in it shows labels.changed when the error's code is the core's `moved` or `refused`,
 * else labels.failed; a 401 calls signIn(). v-model:tab;
 * 'counts' and 'moved' ({ move, row, result }); exposed reload().
 */
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { adminMoves, MOD_SEEN_MOVES } from '../moderation/index.js'
import { TT_MOD_CALL_PROPS, ttModCall, ttModErrWord, ttModReason, ttModWhen, ttModWords } from './moderation.js'

const TABS = ['waiting', 'reported', 'hidden', 'latest']
const ORDER = ['decline', 'approve', 'keep', 'hide', 'restore']
const PRIMARY = ['approve', 'keep', 'restore']
const TAB_WORD = { waiting: 'tabWaiting', reported: 'tabReported', hidden: 'tabHidden', latest: 'tabLatest' }

const props = defineProps({
  tab: { type: String, default: 'waiting' },
  limit: { type: Number, default: 20 },
  ...TT_MOD_CALL_PROPS,
})
const emit = defineEmits(['update:tab', 'counts', 'moved', 'denied'])

const L = computed(() => ttModWords(props.labels))
const cur = ref(TABS.includes(props.tab) ? props.tab : 'waiting')
const rows = ref([])
const next = ref(null)
const counts = ref(null)
const loading = ref(false)
const err = ref('')
const busyRow = ref(null)
const rowErr = reactive({})
const root = ref(null)
let seq = 0

watch(() => props.tab, t => { if (TABS.includes(t) && t !== cur.value) pick(t) })

const tabWord = t => L.value[TAB_WORD[t]]
const countOf = t => (counts.value && t !== 'latest' ? Number(counts.value[t]) || 0 : 0)
const pv = row => row.preview || {}
// http(s) or a relative address only: a browser drops tabs, newlines and controls from a scheme, so they go first
const safeUrl = u => { const s = u.replace(/[\u0000-\u0020]/g, ''); return !/^[a-z][a-z0-9+.-]*:/i.test(s) || /^https?:/i.test(s) }
const img = row => (row.preview && typeof row.preview.img === 'string' && safeUrl(row.preview.img) && row.preview.img) || ''
const movesOf = row => ORDER.filter(m => (row.moves || []).includes(m))
const reasonsOf = row => Object.entries(row.reasons || {}).filter(([, n]) => n > 0)
  .map(([code, n]) => ({ code, n, word: ttModReason(L.value, row.kind, code) }))
const whenWord = row => (row.state === 'pending' ? L.value.sent : row.state === 'hidden' ? L.value.hiddenAt : L.value.shown)
const whenOf = row => ttModWhen(L.value, row.state === 'pending' ? row.submittedAt : row.decidedAt || row.submittedAt)

// which tab an item is listed in (core's queue): Waiting pending, Reported reported, Hidden an admin's hides, Latest shown
const bucket = it => (it.state === 'pending' ? 'waiting' : it.state === 'reported' ? 'reported' : it.state === 'hidden' && it.hiddenBy === 'admin' ? 'hidden' : null)
const belongs = (tab, it) => (tab === 'latest' ? it.state === 'approved' || it.state === 'reported' : bucket(it) === tab)

async function load(append = false) {
  const my = ++seq
  const tab = cur.value
  loading.value = true
  err.value = ''
  const r = await ttModCall(props, 'queue', { tab, before: append ? next.value : null, limit: props.limit })
  if (my !== seq) return
  loading.value = false
  if (r.signIn) return
  if (r.status === 403) { err.value = ttModErrWord(L.value, 403); emit('denied', 403); return }
  if (r.error) { err.value = ttModErrWord(L.value, r.status); return }
  const page = r.data || {}
  const got = Array.isArray(page.rows) ? page.rows : []
  rows.value = append ? [...rows.value, ...got.filter(x => !rows.value.some(y => y.id === x.id))] : got
  next.value = page.next || null
  if (page.counts) { counts.value = { ...page.counts }; emit('counts', { ...page.counts }) }
}
const reload = () => load(false)
const more = () => { if (next.value && !loading.value) load(true) }

function pick(t) {
  if (!TABS.includes(t)) return
  if (t !== cur.value) {
    cur.value = t
    rows.value = []
    next.value = null
    Object.keys(rowErr).forEach(k => delete rowErr[k])
    emit('update:tab', t)
  }
  load(false)
}
function onTabKey(e) {
  const i = TABS.indexOf(cur.value)
  const to = e.key === 'ArrowRight' ? (i + 1) % 4 : e.key === 'ArrowLeft' ? (i + 3) % 4 : e.key === 'Home' ? 0 : e.key === 'End' ? 3 : -1
  if (to < 0) return
  e.preventDefault()
  pick(TABS[to])
  nextTick(() => { const b = root.value && root.value.querySelector(`.tt-mod-tab[data-tab="${TABS[to]}"]`); if (b) b.focus() })
}

async function move(row, m) {
  if (busyRow.value) return
  busyRow.value = row.id
  delete rowErr[row.id]
  // approve, keep and restore carry the revision this row shows (1.5.0): the host answers 409 if it changed
  const seen = MOD_SEEN_MOVES.includes(m) && typeof row.revision === 'string' ? { seen: row.revision } : {}
  const r = await ttModCall(props, 'move', { kind: row.kind, ref: row.ref, move: m, ...seen })
  busyRow.value = null
  if (r.signIn) return
  if (r.status === 409) {
    // the tab reloads. A row still listed says Changed when the core's own conflict refused it (moved: changed since
    // the admin saw it; refused: not from its state now); any other host 409 (NYID's set_not_live) says Failed
    await reload()
    const code = r.error && r.error.code
    if (rows.value.some(x => x.id === row.id)) rowErr[row.id] = code === 'moved' || code === 'refused' ? L.value.changed : ttModErrWord(L.value, 409)
    return
  }
  if (r.error) { rowErr[row.id] = ttModErrWord(L.value, r.status); return }
  const item = (r.data && r.data.item) || { ...row, state: r.data && r.data.to }
  const i = rows.value.findIndex(x => x.id === row.id)
  // the counts move with the item: out of its old tab, into its new one
  if (counts.value) {
    const c = { ...counts.value }
    const was = bucket(row)
    const now = bucket(item)
    if (was && was !== now) c[was] = Math.max(0, (Number(c[was]) || 0) - 1)
    if (now && was !== now) c[now] = (Number(c[now]) || 0) + 1
    counts.value = c
    emit('counts', { ...c })
  }
  emit('moved', { move: m, row, result: r.data })
  if (belongs(cur.value, item)) {
    const upd = { ...row, ...item, kindLabel: row.kindLabel, preview: row.preview, reasons: item.reportsOpen ? row.reasons : {} }
    upd.moves = adminMoves(upd)
    if (i >= 0) rows.value.splice(i, 1, upd)
    await nextTick()
    focusIn(row.id)
    return
  }
  const after = rows.value[i + 1] || rows.value[i - 1] || null
  if (i >= 0) rows.value.splice(i, 1)
  if (!rows.value.length && next.value) { reload(); return }
  await nextTick()
  if (after) focusIn(after.id)
  else { const b = root.value && root.value.querySelector('.tt-mod-tab.is-on'); if (b) b.focus() }
}
function focusIn(id) {
  const li = root.value && [...root.value.querySelectorAll('.tt-mod-row')].find(el => el.dataset.row === String(id))
  const b = li && li.querySelector('.tt-mod-acts button:not([disabled])')
  if (b) b.focus()
}

onMounted(() => load(false))
defineExpose({ reload, tab: () => cur.value, counts: () => (counts.value ? { ...counts.value } : null) })
</script>
