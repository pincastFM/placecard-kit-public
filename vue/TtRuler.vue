<template>
  <div class="tt-slrow">
    <div class="tt-ruler" :style="{ '--p': pct }">
      <input
        type="range" :min="t.range.min" :max="t.range.max" step="1" :value="val"
        aria-label="Card size" :aria-valuetext="`${acrossOf(val)} across`"
        @input="onInput" @change="onChange"
      >
      <span v-for="s in ticks" :key="s.w" class="tt-tk" :class="{ 'is-on': s.w === val }" :style="{ left: `calc(7px + (100% - 14px) * ${s.at.toFixed(4)})` }"><span>{{ acrossOf(s.w) }}</span></span>
    </div>
    <output class="tt-acr">{{ acrossOf(val) }}×</output>
  </div>
</template>

<script setup>
/**
 * The Card room's ruler: a track with minor ticks and the natural stops,
 * each labeled with how many cards it lays across. While dragging the table only previews (a scale
 * of the groups, emit 'preview'); after a 160 ms pause, or on release, it commits the real width
 * (emit 'commit'). A release near a stop eases to it over 160 ms first (t.snapTo).
 * Props: t, the table (useTtTable through reactive(), so refs read without .value); gap, the grid
 * gap; reduced, a function that says whether to skip the ease.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { ttAcross } from '../core/core.js'

const props = defineProps({
  t: { type: Object, required: true },
  gap: { type: Number, default: 6 },
  reduced: { type: Function, default: () => false },
})
const emit = defineEmits(['preview', 'commit'])

const w = ref(null) // the value while dragging; null at rest (the table's width)
const val = computed(() => (w.value == null ? props.t.cardW : w.value))
const span = computed(() => Math.max(1, props.t.range.max - props.t.range.min))
const pct = computed(() => `${(((val.value - props.t.range.min) / span.value) * 100).toFixed(2)}%`)
// stops strictly inside the track
const ticks = computed(() => props.t.stops.filter(s => s.w > props.t.range.min && s.w < props.t.range.max))
const acrossOf = x => ttAcross(x, props.t.innerWidth || 366, props.gap)

let raf = 0
let tmr = 0
let snapping = 0
function commit(v) {
  clearTimeout(tmr)
  if (raf) { cancelAnimationFrame(raf); raf = 0 }
  emit('commit', v)
  w.value = null
}
function onInput(e) {
  if (snapping) { cancelAnimationFrame(snapping); snapping = 0 }
  w.value = Number(e.target.value)
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (w.value != null) emit('preview', w.value) })
  clearTimeout(tmr)
  tmr = setTimeout(() => { if (w.value != null) commit(w.value) }, 160)
}
function onChange(e) {
  const v = Number(e.target.value)
  const to = props.t.snapTo(v)
  if (to !== v) easeTo(v, to)
  else commit(v)
}
function easeTo(from, to) {
  clearTimeout(tmr)
  if (props.reduced()) { w.value = to; commit(to); return }
  const t0 = performance.now()
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 160)
    const x = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))
    w.value = x
    emit('preview', x)
    if (k < 1) snapping = requestAnimationFrame(step)
    else { snapping = 0; commit(to) }
  }
  snapping = requestAnimationFrame(step)
}
onBeforeUnmount(() => {
  clearTimeout(tmr)
  if (raf) cancelAnimationFrame(raf)
  if (snapping) cancelAnimationFrame(snapping)
})
</script>
