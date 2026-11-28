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

      <div class="tt-path-map"><slot name="map" :plan="shown" :rows="mapRows" /></div>

      <div ref="scrollEl" class="tt-path-p">
        <div class="tt-path-row">
          <span class="tt-path-lab">{{ L.from }}</span>
          <span class="tt-path-from">{{ from.label }} · {{ from.n }}</span>
        </div>
        <div v-for="x in byRow" :key="x" class="tt-path-row">
          <span class="tt-path-lab">{{ L.by }}</span>
          <div class="tt-path-chips" role="group" :aria-label="L.by">
            <button
              v-for="m in modeOptions" :key="m" class="tt-chip" type="button"
              :class="{ 'is-on': m === mode }" :aria-pressed="m === mode ? 'true' : 'false'"
              @click="pickMode(m)"
            >{{ L[m] }}</button>
          </div>
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
        <div v-for="x in whenRow" :key="x" class="tt-path-row">
          <span class="tt-path-lab">{{ L.when }}</span>
          <div class="tt-path-chips" role="group" :aria-label="L.when">
            <template v-for="k in whenOptions" :key="k">
              <label v-if="k !== 'now' && k === whenKind" class="tt-chip tt-path-when is-on">
                <span>{{ whenWord(k) }}</span>
                <input
                  :ref="setTimeEl" class="tt-path-time" type="time" :value="whenValue" :aria-label="chipWord(k)"
                  @click="openPicker" @change="onTime(k, $event)"
                >
              </label>
              <button
                v-else class="tt-chip" type="button" :class="{ 'is-on': k === whenKind }"
                :aria-pressed="k === whenKind ? 'true' : 'false'" @click="pickWhen(k)"
              >{{ chipWord(k) }}</button>
            </template>
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
        <div v-for="x in addRow" :key="x" class="tt-path-row">
          <span class="tt-path-lab">{{ L.stops }}</span>
          <div class="tt-path-chips" role="group" :aria-label="L.stops">
            <button
              class="tt-chip tt-path-add" type="button" :class="{ 'is-on': adding }"
              :aria-pressed="adding ? 'true' : 'false'" :aria-expanded="adding ? 'true' : 'false'" @click="toggleAdd"
            >{{ L.addStop }}</button>
          </div>
        </div>
        <template v-for="x in addSlot" :key="x"><slot name="add" :close="closeAdd" /></template>

        <div v-if="sum" class="tt-path-sum" :class="{ 'is-busy': busy }" aria-live="polite">
          <template v-if="sum.head">
            <b class="tt-path-far">{{ sum.head }}</b>
            <button v-if="sum.wider" class="tt-chip tt-path-wider" type="button" @click="pickMinutes(sum.wider.minutes)">{{ sum.wider.minutes }} min · {{ sum.wider.stops }}</button>
          </template>
          <template v-else-if="sum.timed">
            <b>{{ sum.time }}</b><span>{{ sum.word }}</span><span>{{ sum.dist }}</span><span>{{ sum.count }}</span>
          </template>
          <template v-else>
            <b>{{ sum.dist }}</b><span>{{ sum.count }}</span>
          </template>
          <span v-for="u in unmetLine" :key="u" class="tt-path-unmet">{{ u }}</span>
        </div>

        <ol v-if="rows.length" ref="listEl" class="tt-path-stops">
          <template v-for="r in rows" :key="r.id">
            <li
              v-if="r.via" class="is-via" :class="{ 'is-drag': !!drag && drag.from === r.via.i }"
              :style="drag && drag.from === r.via.i ? { '--tt-drag-y': `${drag.dy}px` } : undefined"
            >
              <span class="tt-path-n">{{ r.n }}</span>
              <span class="tt-path-nm">{{ r.title }}</span>
              <span v-if="r.trip" class="tt-path-leg is-transit"><span class="tt-path-badges"><span v-for="(b, j) in r.trip.badges" :key="j" class="tt-path-badge" :class="{ 'is-plain': !b.bg }" :style="b.bg ? { background: b.bg, color: b.fg || undefined } : undefined">{{ b.name }}</span></span><span v-for="t in r.trip.words" :key="t" class="tt-path-ride">{{ t }}</span></span>
              <span v-else class="tt-path-leg">{{ r.leg }}</span>
              <button class="tt-path-x" type="button" :aria-label="fillName(L.removeStop, r.title)" @click="emit('remove', r.via.i)">
                <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
              <button
                :ref="setHandle(r.via.i)" class="tt-path-drag" type="button" :aria-label="fillName(L.moveStop, r.title)"
                @pointerdown="dragStart($event, r.via.i)" @pointermove="dragMove" @pointerup="dragEnd" @pointercancel="dragCancel"
                @keydown="dragKey($event, r.via.i)"
              >
                <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h14M5 15h14" /></svg>
              </button>
            </li>
            <li v-else>
              <span class="tt-path-n">{{ r.n }}</span>
              <button class="tt-path-nm" type="button" @click="emit('card', r.key)">{{ r.title }}</button>
              <slot name="rarity" :stop="r.stop"><span v-if="r.rarity" class="tt-path-r">{{ r.rarity }}</span></slot>
              <span v-if="r.trip" class="tt-path-leg is-transit"><span class="tt-path-badges"><span v-for="(b, j) in r.trip.badges" :key="j" class="tt-path-badge" :class="{ 'is-plain': !b.bg }" :style="b.bg ? { background: b.bg, color: b.fg || undefined } : undefined">{{ b.name }}</span></span><span v-for="t in r.trip.words" :key="t" class="tt-path-ride">{{ t }}</span></span>
              <span v-else class="tt-path-leg">{{ r.leg }}</span>
            </li>
          </template>
          <li v-if="fin" class="tt-path-fin">
            <span class="tt-path-n" />
            <b class="tt-path-nm">{{ fin.title }}</b>
            <span v-if="fin.trip" class="tt-path-leg is-transit"><span class="tt-path-badges"><span v-for="(b, j) in fin.trip.badges" :key="j" class="tt-path-badge" :class="{ 'is-plain': !b.bg }" :style="b.bg ? { background: b.bg, color: b.fg || undefined } : undefined">{{ b.name }}</span></span><span v-for="t in fin.trip.words" :key="t" class="tt-path-ride">{{ t }}</span></span>
            <span v-else class="tt-path-leg">{{ fin.leg }}</span>
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
 * Slots: map ({ plan, rows }), end ({ end }: after the End chips, the app's destination search), rarity
 * ({ stop }: the app's rarity chip; the rarity word by default), add ({ close }, 1.8.0, below).
 * Emits: close, home (labels.home set), minutes (m), end (kind), start (plan), card (key); 1.8.0: mode,
 * when, move, remove, add-open, add-close.
 *
 * Summary: timed (timing 'mapbox' or 'route') reads walking minutes, distance and "N of M"; an
 * estimate reads distance and "N of M". Each leg's minutes round on the running total, at least 1,
 * and the summary's minutes are their sum, so the legs add up to it. No stops: "None in N min"
 * (the wider chip beside it) or, with tooFar, "Too far for N min"; the minutes that cannot plan dim.
 * Didn't fit lists the hand's cards left off, with why; a pile shows only "N of M".
 *
 * 1.8.0, each off until its prop is given, so a host that passes none of them gets 1.7.0's markup:
 * - By (modeOptions, e.g. ['walk', 'run', 'bike', 'transit']; mode, 'walk' by default): a chip row
 *   under From, above Time. A pick emits mode. The summary's word follows the mode (walking, running,
 *   biking, by transit); with no modeOptions it reads walking, as before.
 * - When (whenOptions, any of 'now', 'at', 'by'; when { kind, time: 'HH:MM' | null }): a chip row
 *   after Time. Now, Leave at and Arrive by; the picked Leave at or Arrive by chip holds its time
 *   ("Leave 3:15 PM", "Arrive by 3:00 PM") and wraps a native time input (input.tt-path-time, which
 *   the app lays over the chip), so a tap opens the picker; showPicker() is called where the browser
 *   has it. A pick emits when { kind, time }: Now with time null; Leave at or Arrive by keeps the
 *   time already set, or takes the next quarter hour after now on the place's clock (tz, the
 *   device's when null: at 2:07 PM, 2:15 PM; at 2:15 PM, 2:30 PM). A time picked emits when with it.
 *   Times read on a 12-hour clock; clockFmt(minutes past midnight) gives the app's own.
 * - whenError ({ code, earliestArrival: { at } } or null, the app's answer to a time rule): with code
 *   'unmet' the summary adds "Leave now, arrive 2:40 PM" (earliestArrival's at, minutes past
 *   midnight), or "Leave now" when it is null.
 * - The player's own stops: vias (the plan's ViaPass list, null by default) and stopsEditable. With
 *   vias, the list is one list with one numbering, matching the map: each via sits after the cards
 *   placed before it (its after), its row li.is-via with its label (or "Stop"), an × (emits remove,
 *   the via's index in the order given) and a drag handle at the row's end (button.tt-path-drag:
 *   pointer drag on the handle alone, so the panel still scrolls, or ArrowUp and ArrowDown on it;
 *   emits move { from, to }, both indexes in the order given). While a row is dragged it carries
 *   is-drag and --tt-drag-y, the pointer's offset. Card rows never drag; the app plans again and the
 *   cards fill in around the new order. An open end's last via is the end: its row is the list's
 *   last, with the finish leg, in place of the finish row. A street via row shows no leg of its own:
 *   the card after it shows the way through it. With stopsEditable, a Stops row under End holds an
 *   Add stop chip that opens the add slot inline ({ close }) and emits add-open or add-close.
 *   The map slot's rows ({ n, kind: 'card' | 'via', at }) follow the list's numbering.
 * - Transit legs: trips (the app's trip for each leg of the line, start to the first point and on to
 *   the end, null where there is none). A leg with a trip reads its rides and its walk: a badge per
 *   ride (span.tt-path-badge, the route's short name in the route's color and text color, or
 *   is-plain with no color for the app to draw), the rides' minutes, then "walk 4 min". The
 *   summary's minutes stay the record's legs.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { durLabel, fmtDist } from '../core/dayMap.js'
import { ttDistUnit, ttLock } from './host.js'

const LABELS = {
  back: 'Collection', home: '', title: 'Route', from: 'From', time: 'Time', end: 'End',
  open: 'Open', start: 'Back here', destination: 'Destination',
  walking: 'walking', go: 'Start', didntFit: "Didn't fit",
  none: 'None in {n} min', far: 'Too far for {n} min', failed: 'No route', planning: 'Planning',
  // 1.8.0
  by: 'By', walk: 'Walk', run: 'Run', bike: 'Bike', transit: 'Transit',
  running: 'running', biking: 'biking', byTransit: 'by transit',
  when: 'When', now: 'Now', leaveAt: 'Leave at', arriveBy: 'Arrive by', leaveTime: 'Leave {t}', arriveTime: 'Arrive by {t}',
  unmet: 'Leave now, arrive {t}', unmetNone: 'Leave now',
  stops: 'Stops', addStop: 'Add stop', via: 'Stop', moveStop: 'Move {name}', removeStop: 'Remove {name}',
  walkMin: 'walk {n} min', ride: 'Ride',
}
// The summary's word for each mode
const MODE_WORD = { walk: 'walking', run: 'running', bike: 'biking', transit: 'byTransit' }

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
  // 1.8.0 (above): each off by default
  modeOptions: { type: Array, default: () => [] },
  mode: { type: String, default: 'walk' },
  whenOptions: { type: Array, default: () => [] },
  when: { type: Object, default: () => ({ kind: 'now', time: null }) },
  whenError: { type: Object, default: null },
  tz: { type: String, default: null },
  clockFmt: { type: Function, default: null },
  vias: { type: Array, default: null },
  stopsEditable: { type: Boolean, default: false },
  trips: { type: Array, default: null },
})
const emit = defineEmits(['close', 'home', 'minutes', 'end', 'start', 'card', 'mode', 'when', 'move', 'remove', 'add-open', 'add-close'])

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
    word: modeWord.value,
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

// 1.8.0: the summary's word follows the mode once the app offers modes
const modeWord = computed(() => (props.modeOptions.length ? (L.value[MODE_WORD[props.mode]] || L.value.walking) : L.value.walking))

// Times on the place's clock, as minutes past midnight
const toMin = t => (typeof t === 'string' && /^\d{1,2}:\d{2}/.test(t) ? (+t.split(':')[0] % 24) * 60 + +t.split(':')[1].slice(0, 2) : null)
const toHHMM = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const clock12 = (min) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  const hr = Math.floor(m / 60)
  return `${hr % 12 || 12}:${String(m % 60).padStart(2, '0')} ${hr < 12 ? 'AM' : 'PM'}`
}
const clock = min => (props.clockFmt ? props.clockFmt(min) : clock12(min))
const fillT = (t, v) => String(t).replace('{t}', v)
const fillName = (t, v) => String(t).replace('{name}', v)
const nowMin = () => {
  const d = new Date()
  if (!props.tz) return d.getHours() * 60 + d.getMinutes()
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: props.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]))
  return (+p.hour % 24) * 60 + +p.minute
}
// The next quarter hour after now: 2:07 PM is 2:15 PM, 2:15 PM is 2:30 PM
const nextQuarter = () => toHHMM(((Math.floor(nowMin() / 15) + 1) * 15) % 1440)

// The rows that show only when the app offers them (a v-for over one key or none, so an unset row leaves no mark)
const byRow = computed(() => (props.modeOptions.length ? ['by'] : []))
const whenRow = computed(() => (props.whenOptions.length ? ['when'] : []))
const addRow = computed(() => (props.stopsEditable ? ['add'] : []))

// When: the chips, the picked one's time, the native picker
const whenKind = computed(() => (props.when && props.when.kind) || 'now')
const whenValue = computed(() => { const m = toMin(props.when && props.when.time); return m == null ? '' : toHHMM(m) })
const chipWord = k => (k === 'at' ? L.value.leaveAt : k === 'by' ? L.value.arriveBy : L.value.now)
const whenWord = (k) => {
  const m = toMin(props.when && props.when.time)
  if (m == null) return chipWord(k)
  return fillT(k === 'by' ? L.value.arriveTime : L.value.leaveTime, clock(m))
}
const timeEl = ref(null)
const setTimeEl = (el) => { timeEl.value = el }
const openPicker = (ev) => {
  const el = (ev && ev.currentTarget) || timeEl.value
  if (!el || typeof el.showPicker !== 'function') return
  try { el.showPicker() } catch { /* no user activation, or the browser draws its own */ }
}
const pickMode = (m) => { if (m !== props.mode) emit('mode', m) }
const pickWhen = async (k) => {
  if (k === whenKind.value) return
  const time = k === 'now' ? null : (whenValue.value || nextQuarter())
  emit('when', { kind: k, time })
  if (k === 'now') return
  await nextTick()
  openPicker()
}
const onTime = (k, ev) => {
  const v = ev && ev.target ? ev.target.value : ''
  if (toMin(v) == null) return
  if (k === whenKind.value && v === whenValue.value) return
  emit('when', { kind: k, time: toHHMM(toMin(v)) })
}

// Unmet: an arrive by the plan cannot make, planned from now
const unmetLine = computed(() => {
  const e = props.whenError
  if (!e || e.code !== 'unmet') return []
  const ea = e.earliestArrival
  const m = ea == null ? null : (Number.isFinite(ea.at) ? ea.at : toMin(ea.time))
  return [m == null ? L.value.unmetNone : fillT(L.value.unmet, clock(m))]
})

// A trip's words: a badge per ride, the rides' minutes, the walk's
const tripOf = (t) => {
  if (!t || !Array.isArray(t.legs)) return null
  const legs = t.legs
  const rides = legs.filter(l => l && l.ride)
  const rideMin = rides.reduce((a, l) => a + (Number(l.min) || 0), 0)
  const walkMin = legs.filter(l => l && !l.ride).reduce((a, l) => a + (Number(l.min) || 0), 0)
  const badges = rides.map((l) => {
    const r = l.route || {}
    return { name: r.shortName || L.value.ride, bg: r.color || null, fg: r.textColor || null }
  })
  const words = []
  if (rides.length) words.push(durLabel(Math.max(1, Math.round(rideMin))))
  if (walkMin > 0) words.push(String(L.value.walkMin).replace('{n}', String(Math.max(1, Math.round(walkMin)))))
  return { badges, words }
}
const tripAt = i => (Array.isArray(props.trips) ? tripOf(props.trips[i]) : null)

// The player's stops: the plan's via passes, each after the cards placed before it. An open end's last
// via is the end (the record names it as a destination at its place, reached at the finish)
const passes = computed(() => (shown.value && Array.isArray(props.vias) ? props.vias : []))
const endVia = computed(() => {
  const p = shown.value, list = passes.value
  const v = list[list.length - 1]
  if (!p || !v || !p.end || p.end.kind !== 'destination' || !p.end.at || !p.finish) return null
  const same = v.at && v.at.lat === p.end.at.lat && v.at.lon === p.end.at.lon
  return same && v.after === stops.value.length && v.arriveMin === p.finish.arriveMin ? v : null
})

const rows = computed(() => {
  const mids = passes.value.filter(v => v !== endVia.value)
  const out = []
  const via = v => ({ id: `via:${v.n}`, via: { i: v.n - 1 }, at: v.at, title: v.label || L.value.via, leg: '' })
  stops.value.forEach((s, i) => {
    for (const v of mids) if (v.after === i) out.push(via(v))
    const c = props.cardFor(s) || {}
    out.push({ id: `${s.n}:${s.card}`, key: s.card, stop: s, at: s.place, title: c.title || s.card, rarity: c.rarity || '', leg: legText(s.leg, i) })
  })
  for (const v of mids) if (v.after >= stops.value.length) out.push(via(v))
  const e = endVia.value
  if (e && finLeg.value) out.push({ ...via(e), leg: legText(finLeg.value, stops.value.length) })
  return out.map((r, i) => ({ ...r, n: i + 1, trip: tripAt(i) }))
})
const fin = computed(() => {
  if (!finLeg.value || endVia.value) return null
  const p = shown.value
  const title = p.end.kind === 'start' ? L.value.start : (p.end.name || L.value.destination)
  return { title, leg: legText(finLeg.value, stops.value.length), trip: tripAt(rows.value.length) }
})
// The map's discs, in the list's numbering
const mapRows = computed(() => rows.value.map(r => ({ n: r.n, kind: r.via ? 'via' : 'card', at: r.at || null })))

// Add stop: the app's search, inline
const adding = ref(false)
const addSlot = computed(() => (props.stopsEditable && adding.value ? ['add'] : []))
const toggleAdd = () => {
  adding.value = !adding.value
  emit(adding.value ? 'add-open' : 'add-close')
}
const closeAdd = () => { if (adding.value) { adding.value = false; emit('add-close') } }

// Moving a stop: the handle's pointer drag, or its arrow keys; indexes in the order given
const listEl = ref(null)
const handles = new Map()
const setHandle = i => (el) => { if (el) handles.set(i, el); else handles.delete(i) }
const drag = ref(null) // { from, to, y0, dy, id }
const viaLis = () => (listEl.value ? Array.from(listEl.value.children).filter(el => el.classList && el.classList.contains('is-via')) : [])
const dragStart = (ev, i) => {
  if (ev.button != null && ev.button > 0) return
  if (ev.preventDefault) ev.preventDefault()
  const el = ev.currentTarget
  try { if (el && el.setPointerCapture && ev.pointerId != null) el.setPointerCapture(ev.pointerId) } catch { /* jsdom, an old browser */ }
  drag.value = { from: i, to: i, y0: Number(ev.clientY) || 0, dy: 0 }
}
const dragMove = (ev) => {
  const d = drag.value
  if (!d) return
  const y = Number(ev.clientY) || 0
  let to = 0
  viaLis().forEach((li, j) => {
    if (j === d.from) return
    const r = li.getBoundingClientRect()
    if (r.top + r.height / 2 < y) to++
  })
  drag.value = { ...d, to, dy: y - d.y0 }
}
const refocus = ref(null)
const dragEnd = (ev) => {
  const d = drag.value
  if (!d) return
  if (ev && ev.clientY != null) dragMove(ev)
  const { from, to } = drag.value
  drag.value = null
  if (to !== from) emit('move', { from, to })
}
const dragCancel = () => { drag.value = null }
const dragKey = (ev, i) => {
  const n = passes.value.length
  const to = ev.key === 'ArrowUp' ? i - 1 : ev.key === 'ArrowDown' ? i + 1 : null
  if (to == null) return
  ev.preventDefault()
  if (to < 0 || to >= n) return
  refocus.value = to
  emit('move', { from: i, to })
}
// After a keyboard move, the handle keeps the focus once the new order is in
watch(() => props.vias, async () => {
  if (refocus.value == null) return
  const i = refocus.value
  refocus.value = null
  await nextTick()
  const el = handles.get(i)
  if (el) el.focus({ preventScroll: true })
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
