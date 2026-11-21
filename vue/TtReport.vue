<template>
  <div class="tt-mod tt-mod-report" :class="{ 'is-open': open }">
    <span v-if="done" ref="doneEl" class="tt-mod-state" role="status" tabindex="-1">{{ L.reported }}</span>
    <button v-else-if="!open" ref="btn" type="button" class="tt-mod-link" aria-expanded="false" @click="start">{{ L.report }}</button>
    <div v-else ref="sheet" class="tt-mod-sheet" role="group" :aria-label="L.reportTitle" @keydown.esc.stop="cancel" @pointerdown.stop>
      <p class="tt-mod-sheet-title" aria-hidden="true">{{ L.reportTitle }}</p>
      <div class="tt-mod-reasons" role="radiogroup" :aria-label="L.reportTitle" @keydown.left.right.up.down.stop @keydown.tab.stop>
        <label v-for="r in reasonList" :key="r.code" class="tt-mod-reason" :class="{ 'is-on': pick === r.code }">
          <input v-model="pick" type="radio" :name="group" :value="r.code" :disabled="busy">
          <span>{{ r.word }}</span>
        </label>
      </div>
      <p v-if="err" class="tt-mod-err" role="alert">{{ err }}</p>
      <div class="tt-mod-acts">
        <button type="button" class="tt-mod-btn" :disabled="busy" @click="cancel">{{ L.cancel }}</button>
        <button type="button" class="tt-mod-btn is-primary" :disabled="!pick || busy" :aria-busy="busy ? 'true' : null" @click="send">{{ L.send }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * 1.1.0: Report on one item (a photo, a note, a Studio card) and its report sheet. "Report", then the
 * sheet in place (its reasons, Cancel, Report), then "Reported". `reported` (the card shape's reportedByMe) starts it
 * at "Reported"; `guest` sends a tap straight to signIn(), as a 401 does. Reasons are `reasons` (codes, in
 * order), else the keys of labels.reasons[kind], else 'other'. The sheet is inline, never a dialog: no lock, no
 * overlay, and a press inside it never turns a TtCard (pointerdown stops there). The owner's own item has no Report:
 * the host leaves this part out. The radios keep their arrow keys and Tab, so an open card around the sheet (TtStage's
 * page-wide keys) neither steps to the next card nor moves focus past them. Emits 'reported' ({ kind, ref, reason, already }).
 */
import { computed, nextTick, ref, watch } from 'vue'
import { TT_MOD_CALL_PROPS, ttModCall, ttModErrWord, ttModReason, ttModUid, ttModWords } from './moderation.js'

const props = defineProps({
  kind: { type: String, required: true },
  itemRef: { type: [String, Number], required: true },
  reasons: { type: Array, default: null },
  reported: { type: Boolean, default: false },
  guest: { type: Boolean, default: false },
  ...TT_MOD_CALL_PROPS,
})
const emit = defineEmits(['reported'])

const L = computed(() => ttModWords(props.labels))
const reasonList = computed(() => {
  const codes = props.reasons && props.reasons.length ? props.reasons : Object.keys(L.value.reasons[props.kind] || {})
  return (codes.length ? codes : ['other']).map(code => ({ code, word: ttModReason(L.value, props.kind, code) }))
})

const done = ref(props.reported)
const open = ref(false)
const busy = ref(false)
const pick = ref(null)
const err = ref('')
const group = ref('')
const btn = ref(null)
const sheet = ref(null)
const doneEl = ref(null)
watch(() => props.reported, v => { if (v) { done.value = true; open.value = false } })
watch(() => [props.kind, props.itemRef], () => { done.value = props.reported; open.value = false; pick.value = null; err.value = '' })

async function start() {
  if (props.guest) { if (typeof props.signIn === 'function') props.signIn(); return }
  group.value = ttModUid('reason')
  pick.value = null
  err.value = ''
  open.value = true
  await nextTick()
  const first = sheet.value && sheet.value.querySelector('input')
  if (first) first.focus()
}
async function cancel() {
  if (busy.value) return
  open.value = false
  err.value = ''
  await nextTick()
  if (btn.value) btn.value.focus()
}
async function send() {
  if (!pick.value || busy.value) return
  busy.value = true
  err.value = ''
  const reason = pick.value
  const r = await ttModCall(props, 'report', { kind: props.kind, ref: props.itemRef, reason })
  busy.value = false
  if (r.signIn) return
  if (r.error) { err.value = ttModErrWord(L.value, r.status); return }
  open.value = false
  done.value = true
  emit('reported', { kind: props.kind, ref: props.itemRef, reason, already: !!(r.data && r.data.already) })
  await nextTick()
  if (doneEl.value) doneEl.value.focus()
}
</script>
