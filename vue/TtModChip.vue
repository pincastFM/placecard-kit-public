<template>
  <span v-if="word" class="tt-mod-chip" :data-state="st">{{ word }}</span>
</template>

<script setup>
/**
 * 1.1.0: the owner's mark on their own item that the public does not see: Pending, Declined or Hidden (core
 * ownerLabel's words, as labels). `moderation` is the card shape's `{ state, mine: true }` (or a state string); any
 * other state, or none, renders nothing. A replaced photo never reaches the owner (core `mine` leaves it out).
 */
import { computed } from 'vue'
import { ownerLabel } from '../moderation/index.js'
import { ttModWords } from './moderation.js'

const props = defineProps({
  moderation: { type: [Object, String], default: null },
  labels: { type: Object, default: () => ({}) },
})
const st = computed(() => {
  const m = props.moderation
  return typeof m === 'string' ? m : m && typeof m.state === 'string' ? m.state : null
})
const word = computed(() => {
  if (!st.value) return null
  const w = ttModWords(props.labels)
  return ownerLabel({ state: st.value, hiddenBy: null }, { pending: w.pending, declined: w.declined, hidden: w.hidden })
})
</script>
