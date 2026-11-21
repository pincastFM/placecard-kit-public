<template>
  <span class="tt-mod tt-mod-hide">
    <template v-if="down">
      <span ref="stateEl" class="tt-mod-state" role="status" tabindex="-1">{{ L.hidden }}</span>
      <button type="button" class="tt-mod-link" :disabled="busy" :aria-busy="busy ? 'true' : null" @click="go('restore')">{{ L.restore }}</button>
    </template>
    <button v-else ref="btn" type="button" class="tt-mod-link" :disabled="busy" :aria-busy="busy ? 'true' : null" @click="go('hide')">{{ L.hide }}</button>
    <span v-if="err" class="tt-mod-err" role="alert">{{ err }}</span>
  </span>
</template>

<script setup>
/**
 * 1.1.0: an admin's Hide, beside each Report on an item.
 * The host mounts it for its admins only; the host's move endpoint checks again. Hide, then "Hidden" with Restore
 * (the same item's restore move), so a tap is undone where it was made. `hidden` starts it hidden. Emits 'moved'
 * ({ move, kind, ref, result }) with the host's answer.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { TT_MOD_CALL_PROPS, ttModCall, ttModErrWord, ttModWords } from './moderation.js'

const props = defineProps({
  kind: { type: String, required: true },
  itemRef: { type: [String, Number], required: true },
  hidden: { type: Boolean, default: false },
  ...TT_MOD_CALL_PROPS,
})
const emit = defineEmits(['moved'])

const L = computed(() => ttModWords(props.labels))
const down = ref(props.hidden)
const busy = ref(false)
const err = ref('')
const btn = ref(null)
const stateEl = ref(null)
watch(() => [props.kind, props.itemRef, props.hidden], () => { down.value = props.hidden; err.value = '' })

async function go(move) {
  if (busy.value) return
  busy.value = true
  err.value = ''
  const r = await ttModCall(props, 'move', { kind: props.kind, ref: props.itemRef, move })
  busy.value = false
  if (r.signIn) return
  if (r.error) { err.value = ttModErrWord(L.value, r.status); return }
  down.value = move === 'hide'
  emit('moved', { move, kind: props.kind, ref: props.itemRef, result: r.data })
  await nextTick()
  const el = down.value ? stateEl.value : btn.value
  if (el) el.focus()
}
</script>
