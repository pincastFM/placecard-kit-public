<template>
  <Transition name="tt-day" :css="!reduced" :duration="{ enter: 360, leave: 240 }">
    <div v-if="open" class="tt-day" role="dialog" aria-modal="true" aria-label="Your day">
      <div class="tt-day-bg" @click="emit('close')" />
      <section class="tt-day-p">
        <header class="tt-day-top">
          <button ref="backBtn" class="tt-back" type="button" @click="emit('close')">
            <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg><span>Table</span>
          </button>
          <span class="tt-tag tt-stub">Your day</span>
        </header>

        <div ref="scrollEl" class="tt-day-sc">
          <div class="tt-day-head">
            <h2 class="tt-day-d">{{ dateLine }}</h2>
            <p class="tt-day-tot">
              <span><b>{{ totals.stops }}</b> {{ totals.stops === 1 ? 'Stop' : 'Stops' }}</span>
              <span><b>{{ totals.walkMin }}</b> Min walk</span>
              <button class="tt-day-unit" type="button" :aria-label="`${dist.n} ${unitName}, show in ${unit === 'km' ? 'miles' : 'kilometres'}`" @click="toggleUnit"><b>{{ dist.n }}</b> {{ dist.u }}</button>
            </p>
          </div>

          <div class="tt-day-win">
            <label class="tt-chip tt-pick">
              <span>{{ dayLabel }}</span>
              <svg class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              <select v-model="dateM" aria-label="Day">
                <option v-for="o in sel.dayOptions.value" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </label>
            <label class="tt-chip tt-pick">
              <span>{{ startLabel }}</span>
              <svg class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              <select v-model="startM" aria-label="Start">
                <option v-for="o in sel.startOptions.value" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </label>
            <div class="tt-seg" role="radiogroup" aria-label="Hours">
              <button
                v-for="h in sel.hourOptions" :key="h" type="button" role="radio"
                :aria-checked="hoursM === h ? 'true' : 'false'" @click="hoursM = h"
              >{{ h }}H</button>
            </div>
          </div>

          <TransitionGroup v-if="rows.length" tag="ol" name="tt-dr" class="tt-tl" :css="!reduced">
            <li key="start" class="tt-tl-start">
              <span class="tt-tl-dot" aria-hidden="true" />
              <span class="tt-dl tt-stub">Start</span>
              <span class="tt-tl-at">{{ startAt }}</span>
            </li>
            <li v-for="r in rows" :key="r.id" class="tt-dr" :class="{ 'is-dealt': r.dealt }">
              <div v-if="r.walkMin" class="tt-walk"><span>{{ r.walkMin }} min walk</span></div>
              <div class="tt-dr-h">
                <span class="tt-dr-clk">{{ r.clock }}</span>
                <span class="tt-dl tt-stub" :data-l="r.tone">{{ r.label }}</span>
                <span v-if="r.dealt" class="tt-dealt tt-stub">Dealt</span>
                <span class="tt-dr-dur">{{ r.dur }} min</span>
              </div>
              <div class="tt-dr-b">
                <button class="tt-dr-face" type="button" :aria-label="`${r.title}, on the map`" @click="emit('card', r.key)">
                  <TtFace v-if="r.card" :card="r.card" :data="meta" :fonts="false" />
                </button>
                <div class="tt-dr-i">
                  <span class="tt-dr-t">{{ r.title }}</span>
                  <span v-if="r.sub" class="tt-dr-k">{{ r.sub }}</span>
                  <div class="tt-dr-a">
                    <button v-if="r.dealt" class="tt-act is-keep" type="button" @click="sel.keep(r.e)">
                      <svg class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>Keep
                    </button>
                    <button v-if="r.pos && r.pos.n > 1" class="tt-act" type="button" :aria-label="`Swap, ${r.pos.pos} of ${r.pos.n}`" @click="sel.swap(r.e)">
                      <svg class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true"><path d="m18 14 4 4-4 4" /><path d="m18 2 4 4-4 4" /><path d="M2 18h1.97a4 4 0 0 0 3.3-1.7l5.46-8.6a4 4 0 0 1 3.3-1.7H22" /><path d="M2 6h1.97a4 4 0 0 1 3.3 1.7l.66 1.04" /><path d="M22 18h-5.97a4 4 0 0 1-3.3-1.7l-.66-1.04" /></svg>Swap<span class="tt-v">{{ r.pos.pos }}/{{ r.pos.n }}</span>
                    </button>
                    <button class="tt-act is-x" type="button" :aria-label="`Drop, ${r.title}`" @click="sel.drop(r.e)">
                      <svg class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          </TransitionGroup>

          <div v-else class="tt-day-0">
            <div class="tt-e-cell tt-day-0c"><span class="tt-e-tag tt-stub">No cards</span></div>
          </div>

          <section v-if="left.length" class="tt-df">
            <h3 class="tt-df-h">Didn't fit<b>{{ left.length }}</b></h3>
            <ul class="tt-df-l">
              <li v-for="l in left" :key="l.id" class="tt-df-r">
                <span class="tt-df-face"><TtFace v-if="l.card" :card="l.card" :data="meta" :fonts="false" /></span>
                <span class="tt-df-i"><span class="tt-dr-t">{{ l.title }}</span><span class="tt-df-why">{{ l.reason }}</span></span>
                <button class="tt-act is-x" type="button" :aria-label="`Drop, ${l.title}`" @click="sel.drop(l.e)">
                  <svg class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
              </li>
            </ul>
          </section>
        </div>

        <footer class="tt-day-f">
          <template v-if="count">
            <button class="tt-btn-line" type="button" @click="emit('deal')">
              <svg class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true" v-html="DEAL" />{{ anyDealt ? 'Redeal' : 'Deal' }}
            </button>
            <button class="tt-st-go tt-stub" type="button" :disabled="!rows.length" @click="emit('map')">
              <span>Map</span><svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
            </button>
          </template>
          <button v-else class="tt-st-go tt-stub" type="button" @click="emit('deal')">
            <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true" v-html="DEAL" /><span>Deal me a hand</span>
          </button>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<script setup>
/**
 * The day sheet: the hand as a timed day on the window the visitor picks.
 * Phone: full screen, sliding up. Laptop: a 440 px drawer on the right over the dimmed table.
 * Escape and Table close it; the page locked while open (host.js). Rendered in the table's tray slot, so
 * the .tt tokens and the Card room classes apply.
 *
 * Props: open, sel (useTtSelection), meta (the table's collection, for the faces), reduced.
 * Emits: close, deal (Deal me a hand, or Redeal), map (the day on the map), card (key: one card on the map).
 * A dealt card offers Keep and Swap n/N; every card offers Drop. Didn't fit lists the hand's cards the
 * window cannot place, with the day's reason.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import TtFace from './TtFace.vue'
import { clock } from '../core/clock.js'
import { distParts } from '../core/dayMap.js'
import { ttDistUnit, ttLock } from './host.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  sel: { type: Object, required: true },
  meta: { type: Object, default: () => ({}) },
  reduced: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'deal', 'map', 'card'])

const DEAL = '<rect x="3" y="6" width="10" height="15" rx="1.5"/><path d="M8 3.5 17.5 3a1.5 1.5 0 0 1 1.6 1.4l.8 12.1a1.5 1.5 0 0 1-1.4 1.6"/>'
const backBtn = ref(null)
const scrollEl = ref(null)

const s = props.sel
const day = computed(() => s.day.value)
const totals = computed(() => day.value.totals || { stops: 0, walkMin: 0, m: 0 })
const { unit, toggle: toggleUnit } = ttDistUnit()
const dist = computed(() => distParts(totals.value.m, unit.value))
const unitName = computed(() => ({ mi: 'miles', ft: 'feet', km: 'kilometres', m: 'metres' })[dist.value.u])
const count = computed(() => s.hand.hand.value.length)
const anyDealt = computed(() => Object.keys(s.dealt.value).length > 0)
const dayLabel = computed(() => (s.dayOptions.value.find(o => o.value === s.date.value) || {}).label || '')
const startLabel = computed(() => (s.startSel.value === 'now' ? 'Now' : clock(s.win.value.start)))
// The window's choices, written back to the Selection
const model = r => computed({ get: () => r.value, set: (v) => { r.value = v } })
const dateM = model(s.date)
const startM = model(s.startSel)
const hoursM = model(s.hours)
// The head reads the date itself (the chip already says Today or Tomorrow): Fri 23 Oct
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dateLine = computed(() => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.date.value || '')
  if (!m) return dayLabel.value
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`
})
const startAt = computed(() => (s.set.value && s.set.value.center_label) || 'Start')

const cap = t => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '')
const toneOf = sl => (sl.kind === 'event' ? 'event' : sl.meal || sl.kind === 'eat' ? 'eat' : 'see')

const rows = computed(() => {
  const seen = new Map()
  return day.value.slots.map((sl) => {
    const kind = sl.kind === 'event' ? 'event' : 'card'
    const e = { key: String(sl.key), kind }
    const base = `${kind}:${sl.key}`
    const n = seen.get(base) || 0
    seen.set(base, n + 1)
    const card = s.cardFor(sl)
    return {
      id: n ? `${base}#${n}` : base, key: String(sl.key), e, card,
      clock: sl.clock || clock(sl.at), dur: sl.dur, walkMin: sl.walkMin || 0,
      label: sl.label, tone: toneOf(sl),
      title: (card && card.title) || (sl.place && sl.place.title) || '',
      sub: (card && card.subtitle) || '',
      dealt: s.isDealt(e), pos: s.dealtPos(e),
    }
  })
})

const left = computed(() => (day.value.leftOver || []).map((l) => {
  const kind = l.kind === 'event' ? 'event' : 'card'
  const card = s.cardFor({ key: l.key, kind })
  return { id: `${kind}:${l.key}`, e: { key: String(l.key), kind }, card, title: (card && card.title) || String(l.key), reason: cap(l.reason) }
}))

// Open: lock the page, focus Table, Escape closes
const lock = ttLock // the host's page lock (host.js)
const onKey = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); emit('close') } }
watch(() => props.open, async (v) => {
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
})
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.removeEventListener('keydown', onKey)
  if (props.open) lock(false)
})
</script>
