<template>
  <div ref="stage" class="tt-stage" :class="{ 'is-on': on }" role="dialog" aria-modal="true" :aria-label="card ? card.title : 'Card'">
    <div ref="bg" class="tt-st-bg" @click="close" />
    <button ref="xBtn" class="tt-st-x" type="button" aria-label="Close" @click="close">
      <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
    </button>
    <div class="tt-st-col" :style="{ '--cw': `${cw}px` }" @click.self="close">
      <div v-if="card" ref="head" class="tt-st-head tt-stub">
        <template v-if="$slots.head">
          <button v-if="overTop" class="tt-st-back" type="button" @click="pop">
            <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg><span>{{ overTop.back }}</span>
          </button>
          <slot name="head" :card="card" :side="side" :flip="flip" :t="t" :over="!!overTop" />
        </template>
        <template v-else>
          <span v-if="!overTop" class="tt-mk" :style="{ background: appColor }" />
          <b v-if="!overTop" class="tt-st-set">{{ setShort }}</b>
          <span v-if="!overTop" class="tt-st-pos">{{ pos }}</span>
          <button v-else class="tt-st-back" type="button" @click="pop">
            <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg><span>{{ overTop.back }}</span>
          </button>
          <span v-if="gold" class="tt-st-gold" />
          <span v-if="card.held === false" class="tt-st-want tt-stub">{{ want }}</span>
          <button class="tt-st-flip" type="button" @click="flip">{{ side === 'back' ? word('front', 'Front') : word('back', 'Back') }}</button>
        </template>
      </div>
      <div class="tt-st-wrap">
        <div
          ref="cardEl" class="tt-st-card" :class="{ 'is-lifted': lifted }" role="button" tabindex="0" aria-label="Flip"
          @pointerdown="onDown" @pointercancel="pd = null" @pointerup="onUp" @keydown.enter.space="onFlipKey"
        >
          <TtFace v-for="f in shown" :key="f.key" :ref="setFace" :class="f.under ? 'is-under' : undefined" :inert="f.under || undefined" :card="live(f.card)" :side="f.side" :data="data" :fonts="false" :copyright="copyright" :labels="labels" app-link>
            <template v-if="$slots.art" #art><slot name="art" :card="live(f.card)" :side="f.side" :t="t" /></template>
            <template v-if="$slots.more" #more="s"><slot name="more" v-bind="s" :t="t" /></template>
            <template v-if="$slots.foot" #foot="s"><slot name="foot" v-bind="s" :t="t" /></template>
          </TtFace>
        </div>
      </div>
      <div v-if="card" ref="act" class="tt-st-act" :class="{ 'is-over': !!overTop }">
        <button class="tt-st-nav is-prev" type="button" aria-label="Previous" :disabled="!t.row.prev || !!overTop" @click="go(-1)">
          <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <slot name="actions" :card="card" :t="t">
          <a v-if="card.href" class="tt-st-go tt-stub" :href="card.href" target="_blank" rel="noopener" :aria-label="`${action}, ${card.title}`">
            <span>{{ action }}</span>
            <svg class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg>
          </a>
        </slot>
        <button class="tt-st-nav is-next" type="button" aria-label="Next" :disabled="!t.row.next || !!overTop" @click="go(1)">
          <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * The Card room's stage: one card open.
 * Bloom from its place on the table (560), flip in two halves (230 then 290), prev and next as a
 * 200 ms crossfade over the row as laid out (t.order), swipe and arrow keys, a focus trap, and on
 * close a file-in (420) back to its place, or into its pile when its group is stacked.
 * Props: t (the table through reactive()), data (the collection), locate(id) => { cell, pile, top,
 * bot } from the table (the card's cell on the table, else its pile; the visible band between the
 * sticky bars), reduced() for prefers-reduced-motion. Slot actions ({ card, t }): replaces the
 * default Open link (the Selection's add to hand). The table calls the exposed openFrom(id, cell).
 * Prop want, the head's word on a missing card (the table's labels.want; WANTED unset). Slot more
 * ({ card, t }): the face's back slot (the end of its body, inside the scroll). 1.2.0: slot foot ({ card, t }),
 * the back's foot, after its body and outside the scroll. A tap, Enter or Space
 * on a link or button inside the card is that control's, not a flip.
 * Prop quiver (true, or a function of the card read once at open; off unset): 1200 ms after the open
 * lands, a card still on its front and untouched (pointer, key, flip, step, close) turns rotateY(-12deg)
 * at .45 over 520 ms and back (NYID LLStopCard 351 to 356); never under reduced motion, and then the
 * function is not called. The card carries is-lifted while it flips (cardroom.css's Treehopper shadow).
 * over(card, { back }) lays a card face up over the open one (in an open set too), which keeps
 * its face, flip and DOM (hidden in place, inert; a typed draft or a scrolled back survive) under it. The head
 * holds the way back (back, default the title of the card under) in place of the mark, set and position;
 * prev, next, arrows and swipe are off. Back, Escape, the close control and the backdrop pop to the card
 * under as it was, focus where it was; over() of the card just under the top pops too (a tree opened from
 * its species' own rows goes back to it). The table's own close (its set changed) is close({ all: true }).
 * The table's t.openId stays the card under: the cards over it are the stage's alone.
 * 1.2.0: each face draws the table's current copy of its card (t.order, then t.cards, then the sets'
 * children), so a collection the host replaces redraws the open card, an over card and the cards under in place.
 * Slot head ({ card, side, flip, t, over }): given, it fills the head in place of the mark, set word, position,
 * gold mark, want word and Flip; while a card is laid over, the kit's Back comes first (over true). The Flip button's
 * words are labels.front ("Front") and labels.back ("Back"). Slot art ({ card, side, t }): the face's art slot;
 * Escape and the arrows typed in a field (input, textarea, select, contenteditable) are the field's, Tab still traps.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import TtFace from './TtFace.vue'
import { ttRarityLadder, ttStageWidth } from '../core/core.js'
import { CR_EASE } from '../core/cardroom.js'
import { ttLock } from './host.js'

const props = defineProps({
  t: { type: Object, required: true },
  data: { type: Object, default: () => ({}) },
  locate: { type: Function, required: true },
  reduced: { type: Function, default: () => false },
  want: { type: String, default: 'WANTED' },
  // The print foot's copyright line, handed to the face (the table's labels.copyright)
  copyright: { type: String, default: '' },
  // 1.1.0: the face's words (the table's labels: no, of), handed to the face; unset, today's words
  labels: { type: Object, default: () => ({}) },
  quiver: { type: [Boolean, Function], default: false },
})
const emit = defineEmits(['closed'])

const stage = ref(null)
const bg = ref(null)
const xBtn = ref(null)
const head = ref(null)
const act = ref(null)
const cardEl = ref(null)
const on = ref(false)
const side = ref('front')
const faces = shallowRef([]) // [{ key, card, side }]: two only during a crossfade
// Cards laid over the open one, bottom first: { card, back, side, face, focus }, where side, face and
// focus are the card under's, kept for the way back; unders are their faces, hidden in place, bottom first
const overs = shallowRef([])
const unders = shallowRef([])
const shown = computed(() => (unders.value.length ? [...unders.value, ...faces.value] : faces.value))
const cw = ref(337)
const lifted = ref(false)
let busy = false
let cell = null // the open card's cell on the table, hidden while the stage shows it
let faceComp = null
let seq = 0
let touched = false
let qTimer = null
let qAnim = null

const overTop = computed(() => (on.value && overs.value.length ? overs.value[overs.value.length - 1] : null))
const card = computed(() => (on.value ? (overTop.value ? live(overTop.value.card) : props.t.openCard) : null))
const setOf = c => (props.data.sets || []).find(s => s.id === c.set) || {}
const appColor = computed(() => { const a = card.value && (props.data.apps || []).find(x => x.id === card.value.app); return a ? a.color : 'var(--chrome-3)' })
const setShort = computed(() => (card.value ? setOf(card.value).short || setOf(card.value).name || '' : ''))
const action = computed(() => (card.value ? card.value.action || setOf(card.value).action || 'Open' : 'Open'))
const tops = computed(() => new Set(ttRarityLadder(props.data.rarities).filter(r => r.top).map(r => r.word)))
const gold = computed(() => !!(card.value && tops.value.has(card.value.rarity)))
// "3 / 10" within the card's group as the table lays it out; inside an open set, within the set
const pos = computed(() => {
  const c = card.value
  if (!c) return ''
  const ns = props.t.nestCards
  if (Array.isArray(ns) && ns.length) { const i = ns.findIndex(y => y.id === c.id); return i >= 0 ? `${i + 1} / ${ns.length}` : '' }
  const g = props.t.groups.find(x => x.cards.some(y => y.id === c.id))
  return g ? `${g.cards.findIndex(y => y.id === c.id) + 1} / ${g.cards.length}` : ''
})

const face = (c, s) => ({ key: `${c.id}:${s}:${++seq}`, card: c, side: s })
// 1.2.0: a face draws the table's current copy of its card (the host replaced the collection, a story filled in):
// the row as laid out, then every card, then the sets' children, else the card as it was opened
function live(c) {
  if (!c) return c
  const t = props.t
  const find = list => (Array.isArray(list) ? list.find(x => x && x.id === c.id) : null)
  const hit = find(t.order) || find(t.cards)
  if (hit) return hit
  if (typeof t.nestOf === 'function') {
    for (const p of t.cards || []) {
      const r = t.nestOf(p)
      const k = r && find(r.cards)
      if (k) return k
    }
  }
  return c
}
// 1.2.0: a stage word from labels (the table's), else its default
const word = (k, d) => (props.labels && props.labels[k] != null ? props.labels[k] : d)
function setFace(el) { if (el) faceComp = el }
function eager() { if (cardEl.value) cardEl.value.querySelectorAll('img').forEach((i) => { i.loading = 'eager' }) }
const chromeEls = () => [head.value, act.value, xBtn.value].filter(Boolean)
const lock = ttLock // the host's page lock (host.js)
const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

// The first-card quiver, and anything the person does first calls it off
function touch() {
  touched = true
  if (qTimer) { clearTimeout(qTimer); qTimer = null }
  if (qAnim) { qAnim.cancel(); qAnim = null }
}
function wantsQuiver(c) {
  if (!props.quiver || props.reduced()) return false
  return typeof props.quiver === 'function' ? !!props.quiver(c) : true
}
function armQuiver() {
  qTimer = setTimeout(() => {
    qTimer = null
    if (!on.value || touched || busy || side.value !== 'front' || !cardEl.value) return
    qAnim = cardEl.value.animate([
      { transform: 'rotateY(0deg)' }, { transform: 'rotateY(-12deg)', offset: 0.45 }, { transform: 'rotateY(0deg)' },
    ], { duration: 520, easing: 'ease-in-out' })
    qAnim.onfinish = () => { qAnim = null }
  }, 1200)
}

async function openFrom(id, fromCell) {
  if (on.value) return
  busy = true
  props.t.open(id)
  const c = props.t.openCard
  if (!c) { busy = false; return }
  touched = false
  const q = wantsQuiver(c)
  overs.value = []
  unders.value = []
  cell = fromCell || null
  side.value = 'front'
  faces.value = [face(c, 'front')]
  cw.value = ttStageWidth(window.innerWidth, window.innerHeight)
  on.value = true
  lock(true)
  await nextTick()
  eager()
  const done = () => {
    busy = false
    if (c.foil && !props.reduced() && faceComp && faceComp.sweep) faceComp.sweep()
    if (q) armQuiver()
  }
  cardEl.value.focus({ preventScroll: true })
  if (props.reduced() || !cell) {
    if (cell) cell.style.visibility = 'hidden'
    stage.value.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 }).onfinish = done
    return
  }
  const dst = cardEl.value.getBoundingClientRect()
  const src = cell.getBoundingClientRect()
  const s = src.width / dst.width
  const a0 = center(src)
  const a1 = center(dst)
  bg.value.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: CR_EASE.out })
  chromeEls().forEach(el => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 224, delay: 336, easing: CR_EASE.out, fill: 'backwards' }))
  const a = cardEl.value.animate([
    { transform: `translate(${a0.x - a1.x}px,${a0.y - a1.y}px) scale(${s})`, opacity: 0, offset: 0 },
    { opacity: 1, offset: 0.16 },
    { transform: 'translate(0px,0px) scale(1)', opacity: 1 },
  ], { duration: 560, easing: CR_EASE.out })
  const mine = cell
  setTimeout(() => { if (on.value && cell === mine && cell) cell.style.visibility = 'hidden' }, 90)
  a.onfinish = done
}

function flipOut() {
  return cardEl.value.animate([{ transform: 'rotateY(0deg) scale(1)' }, { transform: 'rotateY(90deg) scale(.96)' }], { duration: 230, easing: CR_EASE.in, fill: 'forwards' })
}
async function flip() {
  if (!on.value) return
  touch()
  if (busy || !card.value) return
  busy = true
  const next = side.value === 'back' ? 'front' : 'back'
  const c = card.value
  if (props.reduced()) {
    side.value = next
    faces.value = [face(c, next)]
    await nextTick()
    eager()
    cardEl.value.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 180 }).onfinish = () => { busy = false }
    return
  }
  lifted.value = true
  const a1 = flipOut()
  a1.onfinish = async () => {
    side.value = next
    faces.value = [face(c, next)]
    await nextTick()
    eager()
    const a2 = cardEl.value.animate([{ transform: 'rotateY(-90deg) scale(.96)' }, { transform: 'rotateY(0deg) scale(1)' }], { duration: 290, easing: CR_EASE.end })
    a1.cancel()
    a2.onfinish = () => { busy = false; lifted.value = false }
  }
}

async function go(d) {
  if (!on.value) return
  touch()
  if (busy || overs.value.length) return
  const n = d > 0 ? props.t.row.next : props.t.row.prev
  if (!n) return
  busy = true
  if (cell) cell.style.visibility = ''
  props.t.step(d)
  cell = props.locate(n.id).cell
  if (cell) cell.style.visibility = 'hidden'
  const nf = face(n, side.value)
  if (props.reduced() || !faces.value.length) {
    faces.value = [nf]
    await nextTick()
    eager()
    busy = false
    return
  }
  faces.value = [faces.value[faces.value.length - 1], nf]
  await nextTick()
  eager()
  const kids = cardEl.value.children
  const old = kids[0]
  const nw = kids[kids.length - 1]
  const a = nw.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: CR_EASE.settle })
  old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: CR_EASE.settle, fill: 'forwards' })
  a.onfinish = () => { faces.value = [nf]; busy = false }
}

function close(o) {
  if (!on.value) return
  if (!(o && o.all === true) && overs.value.length) { pop(); return }
  touch()
  if (busy) return
  busy = true
  const laid = overs.value.length > 0
  const c = laid ? props.t.openCard : card.value
  const loc = c ? props.locate(c.id) : {}
  const target0 = cell || loc.cell || null
  const finish = () => {
    if (target0) target0.style.visibility = ''
    on.value = false
    lifted.value = false
    lock(false)
    faces.value = []
    overs.value = []
    unders.value = []
    cell = null
    busy = false
    props.t.close()
    emit('closed', c ? c.id : null)
    const f = target0 ? target0.querySelector('.tt-hit') : loc.pile
    if (f && f.isConnected) f.focus({ preventScroll: true })
  }
  // bring its place on the table into view behind the backdrop
  if (target0 && loc.top != null) {
    const r0 = target0.getBoundingClientRect()
    if (r0.top < loc.top || r0.bottom > loc.bot) window.scrollBy(0, r0.top - (loc.top + loc.bot - r0.height) / 2)
  }
  const all = () => [cardEl.value, bg.value, stage.value, ...chromeEls()].filter(Boolean)
  if (props.reduced() || laid) {
    stage.value.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).onfinish = () => { all().forEach(el => el.getAnimations().forEach(x => x.cancel())); finish() }
    return
  }
  const target = target0 || loc.pile || null
  const fileIn = (fromEdge) => {
    chromeEls().forEach(el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 147, easing: CR_EASE.out, fill: 'forwards' }))
    bg.value.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: CR_EASE.settle, fill: 'forwards' })
    const startT = fromEdge ? 'translate(0px,0px) scale(.96) rotateY(-90deg)' : 'translate(0px,0px) scale(1) rotateY(0deg)'
    let a
    if (target) {
      const dst = cardEl.value.getBoundingClientRect()
      const src = target.getBoundingClientRect()
      const s = src.width / dst.width
      const a0 = center(src)
      const a1 = center(dst)
      a = cardEl.value.animate([
        { transform: startT, opacity: 1, offset: 0 }, { opacity: 1, offset: 0.7 },
        { transform: `translate(${a0.x - a1.x}px,${a0.y - a1.y}px) scale(${s}) rotateY(0deg)`, opacity: 0 },
      ], { duration: 420, easing: CR_EASE.settle, fill: 'forwards' })
      setTimeout(() => { if (target0) target0.style.visibility = '' }, 290)
    } else {
      a = cardEl.value.animate([{ transform: startT, opacity: 1 }, { transform: 'translate(0px,12px) scale(.92) rotateY(0deg)', opacity: 0 }], { duration: 240, easing: CR_EASE.settle, fill: 'forwards' })
    }
    a.onfinish = () => { finish(); nextTick(() => all().forEach(el => el.getAnimations().forEach(x => x.cancel()))) }
  }
  if (side.value === 'back' && c) {
    const a1 = flipOut()
    a1.onfinish = async () => {
      side.value = 'front'
      faces.value = [face(c, 'front')]
      await nextTick()
      a1.cancel()
      fileIn(true)
    }
  } else fileIn(false)
}

// ── A card laid over the open one
const LAY = 'translate(0px,-18px) scale(1.03)'
function over(c, o) {
  if (!on.value || !c) return false
  touch()
  const now = card.value
  const cur = faces.value[faces.value.length - 1]
  if (busy || !now || !cur || c.id === now.id) return false
  const ov = overs.value
  if (ov.length) {
    const below = ov.length > 1 ? ov[ov.length - 2].card : props.t.openCard
    if (below && below.id === c.id) return pop()
  }
  busy = true
  const prev = typeof document !== 'undefined' ? document.activeElement : null
  overs.value = [...ov, { card: c, back: (o && o.back) || now.title || '', side: side.value, face: cur, focus: prev }]
  side.value = 'front'
  lifted.value = false
  const nf = face(c, 'front')
  const hide = () => { unders.value = [...unders.value, { ...cur, under: true }]; faces.value = [nf] }
  const land = () => {
    busy = false
    if (c.foil && !props.reduced() && faceComp && faceComp.sweep) faceComp.sweep()
  }
  if (cardEl.value) cardEl.value.focus({ preventScroll: true })
  if (props.reduced()) {
    hide()
    nextTick(() => { eager(); cardEl.value.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 180 }).onfinish = land })
    return true
  }
  faces.value = [cur, nf]
  nextTick(() => {
    eager()
    const kids = cardEl.value.children
    const a = kids[kids.length - 1].animate([
      { transform: LAY, opacity: 0, offset: 0 }, { opacity: 1, offset: 0.35 }, { transform: 'translate(0px,0px) scale(1)', opacity: 1 },
    ], { duration: 280, easing: CR_EASE.out })
    a.onfinish = () => { hide(); land() }
  })
  return true
}
// back to the card under the top as it was: its face, its flip, the focus it had
function pop() {
  if (!on.value) return false
  touch()
  const ov = overs.value
  if (busy || !ov.length) return false
  busy = true
  const top = ov[ov.length - 1]
  const out = faces.value[faces.value.length - 1]
  overs.value = ov.slice(0, -1)
  unders.value = unders.value.slice(0, -1)
  side.value = top.side
  lifted.value = false
  const done = () => {
    faces.value = [top.face]
    busy = false
    nextTick(() => {
      const f = top.focus
      const el = f && f.isConnected && cardEl.value && cardEl.value.contains(f) && !f.closest('[inert]') ? f : cardEl.value
      if (el) el.focus({ preventScroll: true })
    })
  }
  if (props.reduced() || !out) {
    faces.value = [top.face]
    nextTick(() => { cardEl.value.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 180 }).onfinish = done })
    return true
  }
  faces.value = [top.face, out]
  nextTick(() => {
    const kids = cardEl.value.children
    const a = kids[kids.length - 1].animate([
      { transform: 'translate(0px,0px) scale(1)', opacity: 1, offset: 0 }, { opacity: 1, offset: 0.55 }, { transform: LAY, opacity: 0 },
    ], { duration: 220, easing: CR_EASE.in, fill: 'forwards' })
    a.onfinish = done
  })
  return true
}

// tap flips, a sideways swipe walks the row
let pd = null
// A press in a field (text, a slider, a list) is the field's: selecting text or dragging a range never turns the card
const FIELD = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
// 1.2.0: Escape is a field's only where it types or lists; on a checkbox, a radio or a range it closes
const TYPED = 'textarea, select, [contenteditable]:not([contenteditable="false"]), input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="color"]):not([type="file"]):not([type="image"])'
// The Tab trap's stops: 1.1.0's controls, and (1.2.0) the fields a head, art or back slot draws
const TABS = 'button:not([disabled]), a[href], [tabindex="0"], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable]:not([contenteditable="false"])'
function inField(e) {
  const el = e.target && e.target.closest ? e.target.closest(FIELD) : null
  return !!el && !!cardEl.value && cardEl.value.contains(el)
}
function onDown(e) { touch(); pd = inField(e) ? null : { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId } }
function onUp(e) {
  if (!pd || e.pointerId !== pd.id) return
  const dx = e.clientX - pd.x
  const dy = e.clientY - pd.y
  const dt = performance.now() - pd.t
  pd = null
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) { go(dx < 0 ? 1 : -1); return }
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && dt < 600 && !onControl(e)) flip()
}
// A control inside the card (the back slot's links) keeps its own tap and keys
function onControl(e) {
  const el = e.target && e.target.closest ? e.target.closest('a[href], button, input, select, textarea, label, [role="button"]') : null
  return !!el && el !== cardEl.value && !!cardEl.value && cardEl.value.contains(el)
}
function onFlipKey(e) {
  if (e.target !== e.currentTarget) return
  e.preventDefault()
  flip()
}
function onKey(e) {
  if (!on.value) return
  touch()
  // 1.2.0: the arrows in a field (the art slot's, a draft) are the field's, and Escape where it types or lists
  if (e.key !== 'Tab' && e.target && e.target.closest && e.target.closest(e.key === 'Escape' ? TYPED : FIELD)) return
  if (e.key === 'Escape') { e.preventDefault(); close() }
  else if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
  else if (e.key === 'Tab') {
    const f = [...stage.value.querySelectorAll(TABS)].filter(x => (x.offsetParent !== null || x === cardEl.value) && !x.closest('[inert]'))
    if (!f.length) return
    e.preventDefault()
    const i = f.indexOf(document.activeElement)
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus()
  }
}
function onResize() { if (on.value) cw.value = ttStageWidth(window.innerWidth, window.innerHeight) }
onMounted(() => { document.addEventListener('keydown', onKey); window.addEventListener('resize', onResize) })
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onResize)
  touch()
  if (on.value) lock(false)
})

defineExpose({ openFrom, close, isOpen: () => on.value, over, pop })
</script>
