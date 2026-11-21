<template>
  <div ref="root" class="tt-cd" :data-side="cur">
    <div
      ref="cardEl" class="tt-cd-card" :class="{ 'is-lifted': lifted, 'is-drag': dragging }" :style="dragStyle"
      role="group" tabindex="0" :aria-label="name"
      @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onCancel" @keydown="onKey" @click.capture="onClickCapture"
    >
      <TtFace
        v-for="s in SIDES" :key="s" :ref="el => setFace(s, el)" :class="faceClass(s)" :inert="s !== cur || undefined" :aria-hidden="s !== cur ? 'true' : undefined"
        :card="card" :side="s" :data="data" :fonts="fonts" :copyright="copy" :labels="labels"
      >
        <template v-if="$slots.art" #art><slot name="art" :card="card" /></template>
        <template v-if="$slots.more" #more="m"><slot name="more" v-bind="m" /></template>
        <template v-if="$slots.head" #head="m"><slot name="head" v-bind="m" /></template>
        <template v-if="$slots.foot" #foot="m"><slot name="foot" v-bind="m" /></template>
      </TtFace>
    </div>
  </div>
</template>

<script setup>
/**
 * 1.1.0: one card in the host's own layout, not a dialog (Treehopper's CardShell role: the species card, the tree
 * card, the hunt's card once the app's own rise lands it). Both TtFace sides stay mounted; the side not shown is hidden
 * in place and inert, so a typed draft or a scrolled back survives a turn. It fills its parent's width at 8:15.
 * The turn is TtStage's: two halves, 230 ms out to the edge (CR_EASE.in) and 290 ms in (CR_EASE.end), the card lifted
 * between (is-lifted). A tap on the card, Enter or Space on it, or a horizontal swipe turns it; the swipe follows the
 * thumb (past 90 degrees the other side shows) and a release past min(64 px, 18% of the width) or 50 degrees finishes
 * the turn the way it was going, else it settles back. A control inside (link, button, field) keeps its own tap and
 * keys; a click right after a swipe is swallowed. Reduced motion: no follow, the two sides crossfade (180 ms).
 * Props: card, data (the collection's sets, rarities, faces), side (v-model:side, 'front' or 'back'), label (the
 * group's name; unset, the card's title), labels and copyright as TtTable passes them to its faces (no, of, retired,
 * copyright), fonts (TtFace's), reduced() (unset, prefers-reduced-motion), quiver (true, or a function of the card
 * read once at mount; 1200 ms later a card still on its front and untouched turns rotateY(-12deg) at .45 over 520 ms
 * and back, as TtStage), print (true or ttPrint's options: core ttPrint's light and finger tilt on this card only,
 * started at mount, stopped at unmount). ttLock is never called. Slots art (the front's) and more (the back's, { card }).
 * 1.2.0: slots head and foot ({ card }), the back's head action and its foot outside the scroll (TtFace).
 * 1.2.0: readBack (false; CardShell's rule): true, a tap that starts and ends in the shown back's body
 * (.ttf-bk-body, its scroll) is the reader's, not a turn; a swipe from there still turns. hold (false; CardShell's
 * canTurn false): true, the person's turns wait (no press is kept, Enter and Space do nothing); v-model:side and the
 * exposed flip() still turn the card (the host's Collect).
 * Exposed: flip(), quiver(when) (arms it now, as CardShell's: false on the back or under reduced motion), sweep()
 * (the foil's, which also runs once at mount on a foil card), side(), el.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TtFace from './TtFace.vue'
import { CR_EASE } from '../core/cardroom.js'
import { ttPrint } from '../core/print.js'

const SIDES = ['front', 'back']
const props = defineProps({
  card: { type: Object, required: true },
  data: { type: Object, default: null },
  side: { type: String, default: 'front' },
  label: { type: String, default: '' },
  labels: { type: Object, default: () => ({}) },
  copyright: { type: String, default: '' },
  fonts: { type: Boolean, default: true },
  reduced: { type: Function, default: null },
  quiver: { type: [Boolean, Function], default: false },
  print: { type: [Boolean, Object], default: false },
  // 1.2.0: a tap in the back's body is the reader's; the person's turns held
  readBack: { type: Boolean, default: false },
  hold: { type: Boolean, default: false },
})
const emit = defineEmits(['update:side'])

const norm = s => (s === 'back' ? 'back' : 'front')
const other = s => (s === 'back' ? 'front' : 'back')
const root = ref(null)
const cardEl = ref(null)
const cur = ref(norm(props.side)) // the side shown
const fading = ref(null) // reduced motion: the side fading out
const lifted = ref(false)
const dragging = ref(false)
const dragV = ref(null) // the angle under the thumb, null at rest
let want = cur.value // the side asked for, by the person or by v-model
let busy = false
const faces = {}

const name = computed(() => props.label || (props.card && props.card.title) || '')
const copy = computed(() => props.copyright || (props.labels && props.labels.copyright) || '')
const faceClass = s => (s === cur.value ? undefined : s === fading.value ? 'is-under tt-cd-out' : 'is-under')
function setFace(s, el) { faces[s] = el || null }
function isReduced() {
  if (props.reduced) return !!props.reduced()
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
// TtStage's strings at rest and at the edge: rotateY(0deg) scale(1), rotateY(90deg) scale(.96)
const scaleAt = (v) => {
  const s = Math.round((1 - 0.04 * Math.min(90, Math.abs(v)) / 90) * 10000) / 10000
  return s === 1 ? '1' : String(s).replace(/^0\./, '.')
}
const T = v => `rotateY(${Math.round(v * 100) / 100 || 0}deg) scale(${scaleAt(v)})`
const dragStyle = computed(() => (dragV.value == null ? undefined : { transform: T(dragV.value) }))

// The first-card quiver, and anything the person does first calls it off
let touched = false
let qTimer = null
let qAnim = null
function touch() {
  touched = true
  if (qTimer) { clearTimeout(qTimer); qTimer = null }
  if (qAnim) { qAnim.cancel(); qAnim = null }
}
function armQuiver() {
  if (qTimer) clearTimeout(qTimer)
  qTimer = setTimeout(() => {
    qTimer = null
    const el = cardEl.value
    if (touched || busy || dragging.value || cur.value !== 'front' || !el || typeof el.animate !== 'function') return
    qAnim = el.animate([
      { transform: 'rotateY(0deg)' }, { transform: 'rotateY(-12deg)', offset: 0.45 }, { transform: 'rotateY(0deg)' },
    ], { duration: 520, easing: 'ease-in-out' })
    qAnim.onfinish = () => { qAnim = null }
  }, 1200)
}
function quiver(when) {
  if (isReduced() || cur.value !== 'front') return false
  if (typeof when === 'function' && !when(props.card)) return false
  touched = false
  armQuiver()
  return true
}
function sweep() { const f = faces[cur.value]; if (f && f.sweep) f.sweep() }

// ── the turn
function flip() {
  touch()
  if (busy) return
  const next = other(cur.value)
  want = next
  emit('update:side', next)
  turn(next)
}
// from v degrees (the thumb's, 0 at rest) to target at rest, the first half toward dir's edge
function turn(target, v = 0, dir = 1) {
  busy = true
  if (isReduced()) { fade(target); return }
  const el = cardEl.value
  if (!el || typeof el.animate !== 'function') { cur.value = target; dragV.value = null; done(); return }
  lifted.value = true
  if (cur.value === target) {
    dragV.value = null
    if (Math.abs(v) < 0.5) { done(); return }
    el.animate([{ transform: T(v) }, { transform: T(0) }], { duration: Math.max(80, Math.round(290 * Math.abs(v) / 90)), easing: CR_EASE.end }).onfinish = done
    return
  }
  const a1 = el.animate([{ transform: T(v) }, { transform: T(dir * 90) }], {
    duration: v ? Math.max(60, Math.round(230 * (90 - Math.abs(v)) / 90)) : 230, easing: CR_EASE.in, fill: 'forwards',
  })
  dragV.value = null
  a1.onfinish = async () => {
    cur.value = target
    await nextTick()
    const a2 = el.animate([{ transform: T(-dir * 90) }, { transform: T(0) }], { duration: 290, easing: CR_EASE.end })
    a1.cancel()
    a2.onfinish = done
  }
}
// reduced motion: the two sides crossfade
async function fade(target) {
  dragV.value = null
  const from = cur.value
  if (from === target) { done(); return }
  fading.value = from
  cur.value = target
  await nextTick()
  const kids = cardEl.value ? cardEl.value.children : []
  const fIn = kids[SIDES.indexOf(target)]
  const fOut = kids[SIDES.indexOf(from)]
  if (!fIn || !fOut || typeof fIn.animate !== 'function') { fading.value = null; done(); return }
  const o = fOut.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: CR_EASE.settle, fill: 'forwards' })
  fIn.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: CR_EASE.settle }).onfinish = () => { fading.value = null; o.cancel(); done() }
}
function done() {
  busy = false
  lifted.value = false
  // v-model moved while it turned: follow it
  if (want !== cur.value) nextTick(() => { if (!busy && want !== cur.value) turn(want) })
}
watch(() => props.side, (v) => {
  const s = norm(v)
  if (s === want) return
  want = s
  touch()
  if (!busy && s !== cur.value) turn(s)
})

// ── tap, swipe and keys
let pd = null
let suppress = false
// A press in a field (text, a slider, a list) is the field's: selecting text or dragging a range never turns the card
const FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
function inField(e) {
  const el = e.target && e.target.closest ? e.target.closest(FIELD) : null
  return !!el && !!cardEl.value && cardEl.value.contains(el)
}
// 1.2.0: with readBack, a press in the shown back's body (its scroll: the story, a thread) is the reader's
function inBody(e) {
  if (!props.readBack || cur.value !== 'back') return false
  const el = e.target && e.target.closest ? e.target.closest('.ttf-bk-body') : null
  return !!el && !!cardEl.value && cardEl.value.contains(el) && !el.closest('[inert]')
}
function onDown(e) {
  touch()
  // 1.2.0: held, the person's turns wait for the host (v-model:side and flip() still turn)
  if (props.hold) { pd = null; return }
  if (e.pointerType === 'mouse' && e.button > 0) return
  if (inField(e)) { pd = null; return }
  const w = cardEl.value ? cardEl.value.getBoundingClientRect().width : 0
  pd = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, axis: null, w: w || 1, from: cur.value, a: 0, rm: isReduced(), body: inBody(e) }
}
function onMove(e) {
  if (!pd || e.pointerId !== pd.id) return
  const dx = e.clientX - pd.x
  const dy = e.clientY - pd.y
  if (!pd.axis) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    pd.axis = Math.abs(dx) > Math.abs(dy) ? (busy ? 'skip' : 'x') : 'y'
    if (pd.axis !== 'x') return
    dragging.value = true
    try { cardEl.value.setPointerCapture(e.pointerId) } catch (_) { /* not capturable */ }
    if (!pd.rm) lifted.value = true
  }
  if (pd.axis !== 'x' || pd.rm) return
  // the thumb's angle; past 90 degrees the other side shows, turned the rest of the way
  const a = Math.max(-180, Math.min(180, (dx / pd.w) * 180))
  pd.a = a
  const over = Math.abs(a) > 90
  const s = over ? other(pd.from) : pd.from
  if (cur.value !== s) cur.value = s
  dragV.value = over ? a - Math.sign(a) * 180 : a
}
function onUp(e) {
  if (!pd || e.pointerId !== pd.id) return
  const p = pd
  pd = null
  const dx = e.clientX - p.x
  const dy = e.clientY - p.y
  if (p.axis === 'x' || p.axis === 'skip') {
    dragging.value = false
    suppress = true
    setTimeout(() => { suppress = false }, 0)
    if (p.axis === 'skip') return
    const go = Math.abs(dx) > Math.min(64, p.w * 0.18) || Math.abs(p.a) > 50
    const target = go ? other(p.from) : p.from
    if (target !== p.from) { want = target; emit('update:side', target) }
    if (p.rm) { if (go) turn(target); return }
    turn(target, dragV.value == null ? 0 : dragV.value, Math.sign(p.a) || Math.sign(dx) || 1)
    return
  }
  if (p.axis) return
  if (p.body && inBody(e)) return // a tap that starts and ends in the back's body is the reader's
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && performance.now() - p.t < 600 && !onControl(e)) flip()
}
function onCancel() {
  const p = pd
  pd = null
  dragging.value = false
  if (p && p.axis === 'x' && !busy && !p.rm) { const v = dragV.value || 0; turn(p.from, v, Math.sign(v) || 1) }
}
// A control inside the card (a slot's link or button) keeps its own tap and keys
function onControl(e) {
  const el = e.target && e.target.closest ? e.target.closest('a[href], button, input, select, textarea, label, [role="button"]') : null
  return !!el && el !== cardEl.value && !!cardEl.value && cardEl.value.contains(el)
}
function onKey(e) {
  touch()
  if (e.target !== e.currentTarget) return
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); if (!props.hold) flip() }
}
function onClickCapture(e) {
  if (!suppress) return
  e.stopPropagation()
  e.preventDefault()
  suppress = false
}

let stopPrint = null
onMounted(() => {
  if (props.quiver && cur.value === 'front' && !isReduced() && (typeof props.quiver !== 'function' || props.quiver(props.card))) { touched = false; armQuiver() }
  if (props.card && props.card.foil && !isReduced()) sweep()
  if (props.print && root.value) stopPrint = ttPrint({ ...(typeof props.print === 'object' ? props.print : {}), root: root.value, card: '.tt-cd-card' })
})
onBeforeUnmount(() => {
  touch()
  if (stopPrint) stopPrint()
  stopPrint = null
})

defineExpose({ flip, quiver, sweep, side: () => cur.value, el: root })
</script>

<style>
/* TtCard (1.1.0): one card in the host's layout. The stage card's look (cardroom.css .tt-st-wrap, .tt-st-card) under
   its own classes, since the card sits outside any .tt: the same shadow tokens (--shadow-stage; a print card's
   --pc-rest and --pc-lift on the wrap so it narrows on the turn), the stock's edge while it turns, the finger tilt's
   lift. The side not shown is hidden in place (is-under, as TtStage's card under); both are 8:15 of one width. */
.tt-cd{position:relative;width:100%;perspective:1600px}
.tt-cd-card{position:relative;width:100%;cursor:pointer;touch-action:pan-y;-webkit-tap-highlight-color:transparent;
  filter:var(--shadow-stage, drop-shadow(0 18px 36px rgba(0,0,0,.55)) drop-shadow(0 2px 2px rgba(0,0,0,.5)))}
.tt-cd-card:focus{outline:none}
.tt-cd-card:focus-visible{outline:2px solid var(--tt-cd-focus, currentColor);outline-offset:3px}
.tt-cd:has(> .tt-cd-card > .ttf[data-print]){transition:filter 180ms ease-out;
  filter:var(--pc-rest, drop-shadow(0 18px 36px rgba(0,0,0,.55)) drop-shadow(0 2px 2px rgba(0,0,0,.5)))}
.tt-cd:has(> .tt-cd-card:is(.is-lifted,[data-tt-held]) > .ttf[data-print]){filter:var(--pc-lift, drop-shadow(0 30px 52px rgba(0,0,0,.55)) drop-shadow(0 4px 6px rgba(0,0,0,.45)))}
.tt-cd-card:has(> .ttf[data-print]){border-radius:4px;filter:none;transform-style:preserve-3d}
.tt-cd-card.is-lifted:has(> .ttf[data-print])::before,.tt-cd-card.is-lifted:has(> .ttf[data-print])::after{
  content:"";position:absolute;top:1px;bottom:1px;width:var(--pc-stock-t, 4px);transform:rotateY(90deg);pointer-events:none;
  --st-l:var(--edge-line, var(--thf-frame, rgba(40,30,20,.5)));
  background:linear-gradient(90deg, var(--st-l) 0 1px, var(--edge-core, #DCD4C2) 1px calc(100% - 1px), var(--st-l) calc(100% - 1px))}
.tt-cd-card.is-lifted:has(> .ttf[data-print])::before{left:calc(var(--pc-stock-t, 4px) / -2)}
.tt-cd-card.is-lifted:has(> .ttf[data-print])::after{right:calc(var(--pc-stock-t, 4px) / -2)}
[data-tt-tilt] .tt-cd-card > .ttf[data-print]{transition:translate 180ms ease-out}
[data-tt-tilt] .tt-cd-card[data-tt-held] > .ttf[data-print]:not(.is-under){translate:0 0 24px}
@media (prefers-reduced-motion:reduce){ [data-tt-tilt] .tt-cd-card > .ttf[data-print]{transition:none} }
.tt-cd-card > .ttf{width:100%}
.tt-cd-card > .ttf.is-under{position:absolute;left:0;top:0;visibility:hidden;opacity:0;pointer-events:none}
.tt-cd-card > .ttf.is-under.tt-cd-out{visibility:visible}
.tt-cd-card > .ttf-front,.tt-cd-card.is-drag{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
/* a swipe turning the card holds the face flat on it: the press's lean and lift let go (core/print.js), at once */
.tt-cd-card.is-drag > .ttf[data-print]{rotate:none !important;translate:none !important;transition:none !important}
.tt-cd-card .ttf-back .ttf-bk-body{touch-action:pan-y}
</style>
