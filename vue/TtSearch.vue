<template>
  <div class="tt-search" :class="{ 'is-open': open || always, 'is-has': !!q }" role="search">
    <button class="tt-s-btn" type="button" aria-label="Search" @click="onBtn">
      <svg class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
    </button>
    <input
      ref="inp" v-model="text" type="search" placeholder="Name" aria-label="Name"
      autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"
      @input="onInput" @keydown="onKey" @blur="onBlur"
    >
    <button class="tt-s-x" type="button" aria-label="Clear" :hidden="!text" @click="clear">
      <svg class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
    </button>
  </div>
</template>

<script setup>
/**
 * The Card room's search by name. On a phone it sits at the end of the chip rail, a 46 px button
 * that opens to a field; on a laptop it is always open in the top bar (always). Typing waits 90 ms,
 * then emits 'query' (the table filters through its FLIP). q is the table's committed query, so a
 * Clear filters elsewhere empties this field too. 'opening' lets the table close a popover first.
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { ttFold } from '../core/core.js'

const props = defineProps({
  q: { type: String, default: '' },
  always: { type: Boolean, default: false },
})
const emit = defineEmits(['query', 'opening'])

const text = ref(props.q)
const open = ref(!!props.q)
const inp = ref(null)
let qT = 0

// follow the table's query unless this field already says the same (never fight the typist)
watch(() => props.q, (q) => {
  if (ttFold(text.value).trim() !== ttFold(q).trim()) text.value = q
  if (q) open.value = true
})

function send(v) { if (ttFold(v).trim() !== ttFold(props.q).trim()) emit('query', v.trim()) }
function onBtn() {
  emit('opening')
  if (props.always) { if (inp.value) inp.value.focus(); return }
  if (open.value && !text.value) { open.value = false; return }
  open.value = true
  if (inp.value) inp.value.focus({ preventScroll: true })
}
function onInput() {
  clearTimeout(qT)
  qT = setTimeout(() => send(text.value), 90)
}
function onKey(e) {
  if (e.key === 'Enter') e.target.blur()
  if (e.key === 'Escape') { text.value = ''; clearTimeout(qT); send(''); e.target.blur() }
}
function onBlur() { if (!text.value && !props.always) open.value = false }
function clear() {
  text.value = ''
  clearTimeout(qT)
  send('')
  if (inp.value) inp.value.focus()
}
onBeforeUnmount(() => clearTimeout(qT))
</script>
