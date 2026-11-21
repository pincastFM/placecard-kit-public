<template>
  <div class="tt-pk" :class="`is-${state}`" :style="vars" @click="tapped">
    <div class="tt-pk-stage">
      <div ref="cardEl" class="tt-pk-card" :aria-hidden="state === 'out' ? undefined : 'true'">
        <slot :width="cardW" />
      </div>
      <div v-if="state !== 'out'" ref="bodyEl" class="tt-pk-body" aria-hidden="true" @click.stop="open">
        <span class="tt-pk-band"><span class="tt-pk-word">{{ look.word }}</span></span>
        <span class="tt-pk-stripe" />
        <span class="tt-pk-title">{{ look.title }}</span>
        <span class="tt-pk-count">{{ look.count }}</span>
      </div>
      <div
        v-if="state !== 'out'"
        ref="stripEl"
        class="tt-pk-strip"
        aria-hidden="true"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up"
        @pointercancel="back"
        @click.stop
      />
    </div>
    <!-- kept, unseen, while it plays, so the pack stays where it is -->
    <div v-if="state !== 'out'" class="tt-pk-calls" :class="{ gone: state !== 'sealed' }">
      <button type="button" data-focus :class="openClass" aria-label="Open the pack" @click.stop="open">Open</button>
      <button type="button" :class="skipClass" @click.stop="skip">Skip</button>
    </div>
  </div>
</template>

<script setup>
/**
 * The pack (for 1.5.0, unreleased; core/pack.js). A sealed silver foil pack printed with the experience's
 * chip word and colors holds the card just collected (the default slot, given the card's width: 86 percent of the
 * pack's). A drag along the top strip tears it, as do a tap on the pack and Open; then the card rises out, lands and
 * settles, and `done` is emitted. A tap anywhere while it plays skips to the end, and so does Skip before it starts.
 * Web Animations only, no timers; with reduced motion the pack fades and nothing moves; where the API is missing (or on
 * the server) Open goes straight to the card. Ported from NYID's components/placecard/next/PcnPack.vue: the
 * props, the slot, `done`, and open, skip and state on the ref are its own.
 * Its colors and type are its own custom properties on the root, each with a fallback (the Studio's tokens, then the
 * Studio's values), so it needs no stylesheet of the host's.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { ttPackSteps, ttPackTap, ttPackTear } from '../core/pack.js'

const props = defineProps({
  // ttPackLook's answer: { word, title, tint, onTint, stripe, count }
  look: { type: Object, required: true },
  // the pack's width in px; the card inside is 86 percent of it
  width: { type: Number, default: 240 },
  // the host's own button looks; the kit's plain ones unset
  openClass: { type: String, default: 'tt-pk-open' },
  skipClass: { type: String, default: 'tt-pk-skip' },
})
const emit = defineEmits(['done'])

const state = ref('sealed') // sealed | opening | out
const cardEl = ref(null)
const bodyEl = ref(null)
const stripEl = ref(null)
const cardW = computed(() => Math.round(props.width * 0.86))
const vars = computed(() => ({
  '--tt-pk-w': `${props.width}px`,
  '--tt-pk-tint': props.look.tint,
  '--tt-pk-on': props.look.onTint,
  '--tt-pk-stripe': props.look.stripe,
}))

let running = []
let gone = false

function reduced() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
}

// One Web Animation, kept so a skip can cancel it; nothing animates where the API is missing.
function anim(el, frames, ms, easing = 'cubic-bezier(.2, .8, .2, 1)') {
  if (!el || typeof el.animate !== 'function') return Promise.resolve()
  const a = el.animate(frames, { duration: ms, easing, fill: 'forwards' })
  running.push(a)
  return a.finished
}

const STEPS = {
  tear: (ms) => anim(stripEl.value, [{ transform: `translate(${props.width * 0.45}px, ${-props.width * 0.5}px) rotate(16deg)`, opacity: 0 }], ms, 'ease-in'),
  // the card rises as the pack drops away below it, clear of it before the pack fades
  rise: (ms) => Promise.all([
    anim(cardEl.value, [{ transform: 'translateY(0)' }, { transform: 'translateY(-16%)' }], ms),
    anim(bodyEl.value, [
      { transform: 'translateY(0)', opacity: 1 },
      { transform: 'translateY(66%)', opacity: 1, offset: 0.7 },
      { transform: 'translateY(95%)', opacity: 0 },
    ], ms, 'ease-in'),
  ]),
  land: (ms) => anim(cardEl.value, [{ transform: 'translateY(-16%)' }, { transform: 'translateY(0) scale(1.05)' }], ms),
  stamp: (ms) => anim(cardEl.value, [{ transform: 'scale(1.05)' }, { transform: 'scale(1)' }], ms, 'ease-out'),
  // a pause on the card before the host's collected screen, as an animation rather than a timer
  hold: (ms) => anim(cardEl.value, [{ transform: 'scale(1)' }, { transform: 'scale(1)' }], ms, 'linear'),
  fade: (ms) => Promise.all([
    anim(bodyEl.value, [{ opacity: 1 }, { opacity: 0 }], ms, 'linear'),
    anim(stripEl.value, [{ opacity: 1 }, { opacity: 0 }], ms, 'linear'),
  ]),
}

async function open() {
  if (state.value !== 'sealed') return
  state.value = 'opening'
  try {
    for (const s of ttPackSteps(reduced())) {
      if (state.value !== 'opening' || gone) return
      await STEPS[s.step](s.ms)
    }
  } catch { /* a skip cancels the running animation */ }
  finish()
}

function finish() {
  if (state.value === 'out' || gone) return
  const list = running
  running = []
  state.value = 'out'
  list.forEach((a) => a.cancel())
  emit('done')
}

function skip() {
  finish()
}

// A tap anywhere while it plays skips to the end.
function tapped() {
  if (state.value === 'opening') finish()
}

// ---- The tear: a drag along the top strip, rightward from its notch ----
let drag = null
function setLift(p) {
  if (stripEl.value) stripEl.value.style.transform = p ? `translateY(${-p * 8}px) rotate(${-p * 7}deg)` : ''
}
function down(e) {
  if (state.value !== 'sealed') return
  drag = { x: e.clientX || 0, y: e.clientY || 0, w: stripEl.value?.offsetWidth || props.width, p: 0 }
  e.currentTarget?.setPointerCapture?.(e.pointerId)
}
function move(e) {
  if (!drag) return
  drag.p = ttPackTear((e.clientX || 0) - drag.x, drag.w).progress
  setLift(drag.p)
}
function up(e) {
  if (!drag) return
  const t = ttPackTear((e.clientX || 0) - drag.x, drag.w)
  const tap = ttPackTap((e.clientX || 0) - drag.x, (e.clientY || 0) - drag.y)
  drag = null
  // a tear, or a plain tap on the strip, opens it; any other drag (short, leftward or up and down) springs back
  if (t.torn || tap) open()
  else back()
}
function back() {
  drag = null
  setLift(0)
}

onBeforeUnmount(() => {
  gone = true
  running.forEach((a) => a.cancel())
  running = []
})

defineExpose({ open, skip, state })
</script>

<style>
/* Its own tokens: the foil (silver, never gold) and the Studio's type and ink, each a host may set on the root
   or above it (--pc-display, --pc-sans, --pc-ink, --pc-quiet, as NYID's Studio pages do) */
.tt-pk {
  --tt-pk-foil: linear-gradient(115deg, #EEF1F3 0%, #C5CCD2 16%, #F9FAFB 30%, #B4BCC3 48%, #E9EDF0 62%, #C2C9CF 80%, #F3F5F6 100%);
  --tt-pk-sheen: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, .55) 50%, transparent 65%);
  --tt-pk-crimp: repeating-linear-gradient(90deg, rgba(18, 38, 28, .16) 0 1.5px, transparent 1.5px 4px);
  --tt-pk-tear: rgba(18, 38, 28, .38);
  --tt-pk-shadow: 0 1px 2px rgba(18, 38, 28, .18), 0 10px 24px rgba(18, 38, 28, .18);
  --tt-pk-display: var(--pc-display, 'Big Shoulders', 'Arial Narrow', sans-serif);
  --tt-pk-sans: var(--pc-sans, 'Jost', -apple-system, 'Segoe UI', Helvetica, sans-serif);
  --tt-pk-ink: var(--pc-ink, #12261C);
  --tt-pk-quiet: var(--pc-quiet, #4E6156);
  display: flex; flex-direction: column; align-items: center; gap: 18px; background: transparent;
  color: var(--tt-pk-ink); font-family: var(--tt-pk-sans);
}
/* the pack, sized by the card inside it: the card is 86 percent of the pack's width and sits in its flow, behind the
   front; the face's own layers are kept inside the card (isolation) */
.tt-pk-stage {
  position: relative; box-sizing: border-box; width: var(--tt-pk-w);
  padding: calc(var(--tt-pk-w) * .1) 7% calc(var(--tt-pk-w) * .12);
}
.tt-pk-card { position: relative; z-index: 0; isolation: isolate; transform-origin: 50% 60%; }
.tt-pk-body { z-index: 1; }
.tt-pk-strip { z-index: 2; }

/* one cool gray sweep, with a crimped seal at the top and the foot */
.tt-pk-body, .tt-pk-strip {
  position: absolute; left: 0; right: 0; box-sizing: border-box;
  background: var(--tt-pk-foil); box-shadow: var(--tt-pk-shadow);
}
.tt-pk-body {
  top: calc(var(--tt-pk-w) * .13); bottom: 0; border-radius: 0 0 4px 4px; cursor: pointer; overflow: hidden;
  display: flex; flex-direction: column; align-items: center;
}
.tt-pk-body::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 9px; background: var(--tt-pk-crimp);
}
/* the sheen that crosses the sealed pack */
.tt-pk-body::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: var(--tt-pk-sheen); background-size: 300% 100%; background-position: 100% 0;
}
.tt-pk.is-sealed .tt-pk-body::before { animation: tt-pk-sheen 3.2s ease-in-out infinite; }
@keyframes tt-pk-sheen { 0%, 40% { background-position: 100% 0; } 100% { background-position: 0 0; } }

/* the tear strip along the top: crimped above, a dashed tear line below, a notch at its left */
.tt-pk-strip {
  top: 0; height: calc(var(--tt-pk-w) * .16); border-radius: 4px 4px 0 0; cursor: grab; touch-action: none;
  border-bottom: 2px dashed var(--tt-pk-tear); transform-origin: 100% 100%;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 62%, 9px 50%, 0 38%);
}
.tt-pk-strip::before {
  content: ''; position: absolute; left: 0; right: 0; top: 0; height: 9px; background: var(--tt-pk-crimp);
}
.tt-pk.is-opening .tt-pk-strip, .tt-pk.is-opening .tt-pk-body { pointer-events: none; }

/* the print: the experience's word on a band of its app's color, the card's stripe, its name, the count */
.tt-pk-band {
  margin-top: calc(var(--tt-pk-w) * .36); align-self: stretch; display: grid; place-items: center;
  min-height: calc(var(--tt-pk-w) * .3); padding: 0 10px; background: var(--tt-pk-tint);
}
.tt-pk-word {
  font: 900 calc(var(--tt-pk-w) * .15)/1 var(--tt-pk-display); letter-spacing: .02em; color: var(--tt-pk-on);
  text-align: center; overflow-wrap: anywhere;
}
.tt-pk-stripe { align-self: stretch; height: 6px; background: var(--tt-pk-stripe); }
.tt-pk-title {
  margin: 12px 14px 0; font: 600 14px/1.25 var(--tt-pk-sans); color: var(--tt-pk-ink); text-align: center;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.tt-pk-count {
  margin-top: auto; margin-bottom: 18px; font: 600 12px var(--tt-pk-sans); letter-spacing: .08em; text-transform: uppercase;
  color: var(--tt-pk-quiet);
}

.tt-pk-calls { width: 100%; max-width: 360px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.tt-pk-calls.gone { visibility: hidden; }
.tt-pk-calls > button:first-child { width: 100%; }
/* the kit's plain buttons, for a host that passes none of its own */
.tt-pk-open {
  min-height: 48px; padding: 0 20px; border: 0; border-radius: 999px; cursor: pointer;
  background: var(--tt-pk-ink); color: #FFFFFF; font: 600 16px/1 var(--tt-pk-sans);
}
.tt-pk-skip {
  min-height: 44px; padding: 0 12px; border: 0; background: none; cursor: pointer;
  color: var(--tt-pk-quiet); font: 500 14px/1 var(--tt-pk-sans); text-decoration: underline;
}

@media (prefers-reduced-motion: reduce) {
  .tt-pk.is-sealed .tt-pk-body::before { animation: none; }
}
</style>
