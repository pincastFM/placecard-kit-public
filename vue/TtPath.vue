<template>
  <Transition name="tt-path" :css="!reduced" :duration="{ enter: 360, leave: 240 }">
    <div v-if="open" class="tt-path" role="dialog" aria-modal="true" :aria-label="L.title">
      <header class="tt-path-top">
        <button v-if="!L.home" :ref="setBack" class="tt-back" type="button" @click="emit('close')">
          <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg><span>{{ L.back }}</span>
        </button>
        <button v-else class="tt-back tt-path-home" type="button" @click="emit('home')"><span>{{ L.home }}</span></button>
        <h2 class="tt-path-h">{{ L.title }}</h2>
        <button v-for="x in (L.home ? [1] : [])" :key="x" :ref="setBack" class="tt-back tt-path-back" type="button" @click="emit('close')"><span>{{ L.back }}</span></button>
      </header>

      <div class="tt-path-map"><slot name="map" :plan="shown" /></div>

      <div ref="scrollEl" class="tt-path-p">
        <div class="tt-path-row">
          <span class="tt-path-lab">{{ L.from }}</span>
          <span class="tt-path-from">{{ from.label }} · {{ from.n }}</span>
        </div>
        <div class="tt-path-row">
          <span class="tt-path-lab">{{ L.time }}</span>
          <div class="tt-path-chips" role="group" :aria-label="L.time">
            <button
              v-for="m in minuteOptions" :key="m" class="tt-chip" type="button"
              :class="{ 'is-on': m === minutes, 'is-dim': dim.has(m) }" :aria-pressed="m === minutes ? 'true' : 'false'"
              @click="pickMinutes(m)"
            >{{ m }} min</button>
          </div>
        </div>
        <div class="tt-path-row">
          <span class="tt-path-lab">{{ L.end }}</span>
          <div class="tt-path-chips" role="group" :aria-label="L.end">
            <button
              v-for="k in endOptions" :key="k" class="tt-chip" type="button"
              :class="{ 'is-on': k === end }" :aria-pressed="k === end ? 'true' : 'false'"
              @click="pickEnd(k)"
            >{{ L[k] }}</button>
          </div>
        </div>
        <slot name="end" :end="end" />

        <div v-if="sum" class="tt-path-sum" :class="{ 'is-busy': busy }" aria-live="polite">
          <template v-if="sum.head">
            <b class="tt-path-far">{{ sum.head }}</b>
            <button v-if="sum.wider" class="tt-chip tt-path-wider" type="button" @click="pickMinutes(sum.wider.minutes)">{{ sum.wider.minutes }} min · {{ sum.wider.stops }}</button>
          </template>
          <template v-else-if="sum.timed">
            <b>{{ sum.time }}</b><span>{{ L.walking }}</span><span>{{ sum.dist }}</span><span>{{ sum.count }}</span>
          </template>
          <template v-else>
            <b>{{ sum.dist }}</b><span>{{ sum.count }}</span>
          </template>
        </div>

        <ol v-if="rows.length" class="tt-path-stops">
          <li v-for="r in rows" :key="r.id">
            <span class="tt-path-n">{{ r.n }}</span>
            <button class="tt-path-nm" type="button" @click="emit('card', r.key)">{{ r.title }}</button>
            <slot name="rarity" :stop="r.stop"><span v-if="r.rarity" class="tt-path-r">{{ r.rarity }}</span></slot>
            <span class="tt-path-leg">{{ r.leg }}</span>
          </li>
          <li v-if="fin" class="tt-path-fin">
            <span class="tt-path-n" />
            <b class="tt-path-nm">{{ fin.title }}</b>
            <span class="tt-path-leg">{{ fin.leg }}</span>
          </li>
        </ol>

        <section v-if="left.length" class="tt-path-df">
          <h3 class="tt-path-df-h">{{ L.didntFit }}<b>{{ left.length }}</b></h3>
          <ul class="tt-path-df-l">
            <li v-for="l in left" :key="l.key">
              <button class="tt-path-nm" type="button" @click="emit('card', l.key)">{{ l.title }}</button>
              <span class="tt-path-why">{{ l.reason }}</span>
            </li>
          </ul>
        </section>
      </div>

      <footer class="tt-path-f">
        <button class="tt-path-go" type="button" :disabled="!canStart" @click="canStart && emit('start', shown)">{{ L.go }}</button>
      </footer>
    </div>
  </Transition>
</template>

<script setup>
/**
 * The day planner's path variant (the planner behaves the same in every app): a route
 * through the cards a hand or a pile wants, in a set time, ending open, back at the start or at a
 * destination. Markup and behavior only, as TtDay: the app's CSS draws it (Treehopper's on
 * .tt-path*, a full-screen layout). Escape and Back close it; the page locked while open (host.js);
 * Back takes focus and the panel scrolls to the top on each open.
 *
 * Props: open; plan (a v2 path record or null, kit contract/record); from { label, n, kind: 'hand' |
 * 'pile' } (what the route was asked for, and how many); minutes and minuteOptions; end ('open' |
 * 'start' | 'destination') and endOptions; busy (a plan is on its way: the last one stays, dimmed);
 * failed (the app's request failed); tooFar (a destination past the time); wider ({ minutes, stops }:
 * the first longer time that plans, or null); cardFor({ card }) gives { title, rarity } for a stop or
 * a card left off; labels (every word, below); reduced.
 * Head: Back with its chevron, then the title. With labels.home set (1.3.0; '' by default), the head
 * is Home, the title, then Back, with no chevrons; Home emits home, Back emits close and takes the
 * open focus. Unset, the head is 1.2.0's markup exactly.
 * Slots: map ({ plan }), end ({ end }: after the End chips, the app's destination search), rarity
 * ({ stop }: the app's rarity chip; the rarity word by default).
 * Emits: close, home (labels.home set), minutes (m), end (kind), start (plan), card (key).
 *
 * Summary: timed (timing 'mapbox' or 'route') reads walking minutes, distance and "N of M"; an
 * estimate reads distance and "N of M". Each leg's minutes round on the running total, at least 1,
 * and the summary's minutes are their sum, so the legs add up to it. No stops: "None in N min"
 * (the wider chip beside it) or, with tooFar, "Too far for N min"; the minutes that cannot plan dim.
 * Didn't fit lists the hand's cards left off, with why; a pile shows only "N of M".
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { durLabel, fmtDist } from '../core/dayMap.js'
import { ttDistUnit, ttLock } from './host.js'

const LABELS = {
  back: 'Collection', home: '', title: 'Route', from: 'From', time: 'Time', end: 'End',
  open: 'Open', start: 'Back here', destination: 'Destination',
  walking: 'walking', go: 'Start', didntFit: "Didn't fit",
  none: 'None in {n} min', far: 'Too far for {n} min', failed: 'No route', planning: 'Planning',
}

const props = defineProps({
  open: { type: Boolean, default: false },
  plan: { type: Object, default: null },
  from: { type: Object, default: () => ({ label: '', n: 0, kind: 'pile' }) },
  minutes: { type: Number, default: 30 },
  minuteOptions: { type: Array, default: () => [15, 30, 60, 90] },
  end: { type: String, default: 'open' },
  endOptions: { type: Array, default: () => ['open', 'start', 'destination'] },
  busy: { type: Boolean, default: false },
  failed: { type: Boolean, default: false },
  tooFar: { type: Boolean, default: false },
  wider: { type: Object, default: null },
  cardFor: { type: Function, default: () => null },
  labels: { type: Object, default: () => ({}) },
  reduced: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'home', 'minutes', 'end', 'start', 'card'])

const L = computed(() => ({ ...LABELS, ...props.labels }))
const fill = (t, n) => String(t).replace('{n}', String(n))
const cap = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '')
const { unit } = ttDistUnit()
const dist = m => fmtDist(m, unit.value)

// Back, the open focus: the chevron Back or, with labels.home, the Back at the head's end (a function ref, so the
// v-for one is not an array)
const backBtn = ref(null)
const setBack = (el) => { backBtn.value = el }
const scrollEl = ref(null)

// A failed request shows no route; while busy the last plan stays up
const shown = computed(() => (props.failed ? null : props.plan))
const stops = computed(() => (shown.value && shown.value.stops) || [])
const none = computed(() => !!shown.value && !stops.value.length)
const timed = computed(() => !!shown.value && ['mapbox', 'route'].includes(shown.value.totals && shown.value.totals.timing))
const finLeg = computed(() => {
  const p = shown.value
  return p && p.finish && p.end && p.end.kind !== 'open' ? p.finish.leg : null
})

// Each leg's minutes on the running total, at least 1, so the shown legs add up to the summary
const legMin = computed(() => {
  const legs = stops.value.map(s => s.leg).concat(finLeg.value ? [finLeg.value] : [])
  const out = []
  let cum = 0, shownSum = 0
  for (const l of legs) {
    cum += Number(l && l.min) || 0
    const d = Math.max(1, Math.round(cum) - shownSum)
    out.push(d)
    shownSum += d
  }
  return { each: out, sum: shownSum }
})
const legText = (leg, i) => dist(leg.m) + (timed.value ? ` · ${durLabel(legMin.value.each[i])}` : '')

const sum = computed(() => {
  if (props.failed) return { head: L.value.failed }
  const p = shown.value
  if (!p) return props.busy ? { head: L.value.planning } : null
  if (none.value) {
    if (props.tooFar) return { head: fill(L.value.far, props.minutes) }
    return { head: fill(L.value.none, props.minutes), wider: props.wider && props.wider.minutes ? props.wider : null }
  }
  return {
    timed: timed.value,
    time: durLabel(legMin.value.sum),
    dist: dist(p.totals.m),
    count: `${stops.value.length} of ${props.from.n}`,
  }
})

// The minutes that cannot plan: past a too-far destination's walk, or at and under an empty time
const dim = computed(() => {
  if (!shown.value || !none.value) return new Set()
  if (props.tooFar) {
    const f = shown.value.finish
    return new Set(f ? props.minuteOptions.filter(m => f.leg.min > m) : [])
  }
  return new Set(props.minuteOptions.filter(m => m <= props.minutes))
})

const rows = computed(() => stops.value.map((s, i) => {
  const c = props.cardFor(s) || {}
  return { id: `${s.n}:${s.card}`, n: s.n, key: s.card, stop: s, title: c.title || s.card, rarity: c.rarity || '', leg: legText(s.leg, i) }
}))
const fin = computed(() => {
  if (!finLeg.value) return null
  const p = shown.value
  const title = p.end.kind === 'start' ? L.value.start : (p.end.name || L.value.destination)
  return { title, leg: legText(finLeg.value, stops.value.length) }
})

// Didn't fit: the hand's cards the route left off, with why (a pile has no Didn't fit)
const left = computed(() => {
  if (props.from.kind !== 'hand' || !shown.value) return []
  return (shown.value.leftOver || []).filter(l => l.kind === 'card').map((l) => {
    const c = props.cardFor({ card: l.key, kind: l.kind, reason: l.reason }) || {}
    return { key: l.key, title: c.title || l.key, reason: cap(l.reason) }
  })
})

const canStart = computed(() => stops.value.length > 0 && !props.busy)
const pickMinutes = (m) => { if (m !== props.minutes) emit('minutes', m) }
const pickEnd = (k) => { if (k !== props.end) emit('end', k) }

// Open: lock the page, focus Back, scroll the panel to the top, Escape closes
const lock = ttLock // the host's page lock (host.js)
const onKey = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); emit('close') } }
const opened = async (v) => {
  lock(v)
  if (typeof document === 'undefined') return
  if (v) {
    document.addEventListener('keydown', onKey)
    await nextTick()
    if (scrollEl.value) scrollEl.value.scrollTop = 0
    if (backBtn.value) backBtn.value.focus({ preventScroll: true })
  } else {
    document.removeEventListener('keydown', onKey)
  }
}
watch(() => props.open, opened)
onMounted(() => { if (props.open) opened(true) })
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.removeEventListener('keydown', onKey)
  if (props.open) lock(false)
})
</script>
