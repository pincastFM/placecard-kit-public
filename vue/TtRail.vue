<template>
  <div class="tt-rail">
    <div v-for="m in (miss ? [miss] : [])" :key="m.name" class="tt-seg" role="radiogroup" :aria-label="m.name" data-seg="missing">
      <button
        v-for="o in m.opts" :key="String(o.v)" type="button" role="radio"
        :aria-checked="m.value === o.v ? 'true' : 'false'" @click="emit('missing', o.v)"
      >{{ o.label }}</button>
    </div>
    <div v-if="t.groupOptions.length > 1" class="tt-seg" role="radiogroup" aria-label="Group">
      <button
        v-for="g in t.groupOptions" :key="g.id" type="button" role="radio"
        :aria-checked="t.group === g.id ? 'true' : 'false'" @click="emit('group', g.id)"
      >{{ g.label }}</button>
    </div>
    <slot />
    <button
      v-for="c in chips" :key="c.k" class="tt-chip" :class="{ 'is-on': c.on }" type="button" :data-k="c.k"
      :aria-pressed="c.toggle ? (c.on ? 'true' : 'false') : undefined"
      :aria-haspopup="c.toggle ? undefined : 'true'"
      :aria-expanded="c.toggle ? undefined : (popKey === c.k ? 'true' : 'false')"
      @click="emit('chip', c.k, $event.currentTarget)"
    >
      <svg v-if="c.toggle && c.on" class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
      <svg v-if="c.k === 'sort'" class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true"><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></svg>
      {{ c.name }}<span v-if="c.value" class="tt-v">{{ c.value }}</span>
    </button>
    <TtSearch v-if="search" :q="t.filter.q" @query="v => emit('query', v)" @opening="emit('opening')" />
  </div>
</template>

<script setup>
/**
 * The Card room's chip rail: the Group segment, the table's own controls (default slot: the
 * Selection's In hand and window), the filter chips and Sort, and on a phone the search at its end.
 * The table renders it twice (the phone dock and the laptop strip), one hidden by the 900 px query.
 * chips: [{ k, name, value, on, toggle }] from the table (Missing toggles; the rest open a popover).
 * 1.2.0: miss ({ name, value, opts: [{ v, label }] }, the table's options.missing 'segment'): a segment
 * (data-seg="missing") first, before the Group segment, that emits missing(v); null unset, and the rail is as before.
 */
import TtSearch from './TtSearch.vue'

defineProps({
  t: { type: Object, required: true },
  chips: { type: Array, default: () => [] },
  popKey: { type: String, default: null },
  search: { type: Boolean, default: false },
  miss: { type: Object, default: null },
})
const emit = defineEmits(['group', 'chip', 'missing', 'query', 'opening'])
</script>
