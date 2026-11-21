<template>
  <div ref="rootEl" class="tt" :class="{ 'is-empty': empty, 'has-tray': !!$slots.tray, 'is-dock-wrap': dockWrap, 'is-empty-status': empty && emptyStatus, 'is-nest': inNest }" :style="T.vars" :data-top-rows="Number(topRows) === 2 ? '2' : undefined">
    <header ref="topEl" class="tt-top">
      <div class="tt-top-in" :class="{ 'is-tight': tight }">
        <button v-if="inNest" class="tt-back" type="button" @click="closeNest">
          <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg><span>{{ nestBack }}</span>
        </button>
        <a v-else class="tt-back" :href="back.href">
          <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg><span>{{ back.label }}</span>
        </a>
        <span v-if="inNest" class="tt-tag tt-stub tt-nest-tag"><span>{{ T.nestCard.title }}</span></span>
        <span v-else-if="tag" class="tt-tag tt-stub">{{ tag }}</span>
        <span ref="cntEl" class="tt-cnt" aria-live="polite">
          <b>{{ inNest ? nestFig.n : counter ? fmtN(counter.n) : empty ? 0 : heldShown.toLocaleString('en-US') }}</b><span class="tt-cl">{{ inNest ? nestFig.of : counter ? `${W.of} ${fmtN(counter.of)}` : W.cards }}</span>
          <span v-if="!empty && T.filter.missing === true && missShown && !inNest" ref="cmEl" class="tt-cm tt-stub" :aria-label="`${missShown} missing`">+<b>{{ missShown }}</b>&nbsp;{{ W.wanted }}</span>
        </span>
        <slot v-if="!inNest" name="head" :t="T" />
        <div class="tt-top-sl">
          <TtSearch v-if="options.search !== false" :q="T.filter.q" always @query="onQuery" @opening="closePop()" />
          <TtRuler :t="T" :gap="CR_GAP" :reduced="reduced" @preview="onPreview" @commit="onCommit" />
        </div>
        <button ref="stkEl" class="tt-stk" type="button" :aria-pressed="stackedAll ? 'true' : 'false'" :disabled="T.searching" @click="stackAll">
          <svg class="tt-i" viewBox="0 0 24 24" aria-hidden="true" v-html="stackSvg" /><span>{{ stackedAll ? 'Spread' : 'Stack' }}</span>
        </button>
      </div>
    </header>

    <div ref="stripEl" class="tt-strip">
      <nav v-if="ledger.length" ref="ledgerEl" class="tt-ledger" :aria-label="ledgerName">
        <button
          v-for="col in ledger" :key="col.id" class="tt-lg" type="button" :data-lg="col.id" :disabled="col.off"
          :style="{ '--app': col.color }" :aria-current="current === col.id ? 'true' : 'false'"
          :aria-label="col.of != null ? `${col.label}, ${col.n} ${W.of} ${col.of}` : `${col.label}, ${col.n}`" @click="onLedger(col)"
        >
          <span class="tt-lg-top"><span class="tt-lg-name"><i />{{ col.name }}</span><span class="tt-lg-fig"><b>{{ col.n }}</b><template v-if="col.of != null">/{{ col.of }}</template></span></span>
          <span v-if="col.bar" class="tt-bar" :style="col.bar" />
        </button>
      </nav>
      <div class="tt-strip-rail">
        <TtRail :t="T" :chips="chips" :miss="missSeg" :pop-key="pop ? pop.k : null" @group="regroup" @chip="onChip" @missing="onMissing" @opening="closePop()">
          <slot name="rail" :t="T" />
        </TtRail>
      </div>
      <slot name="status" :t="T" />
    </div>

    <main ref="mainEl" class="tt-main">
      <div ref="groupsEl" class="tt-groups" :class="{ 'is-solo': empty || T.groups.length === 1 || inNest, 'is-q': T.searching }">
        <div v-if="empty" class="tt-empty">
          <div class="tt-e-cell"><span class="tt-e-tag tt-stub">Your first card</span></div>
          <div v-if="emptyLinks.length" class="tt-e-links">
            <template v-for="(l, i) in emptyLinks" :key="l.href">
              <span v-if="i" aria-hidden="true">·</span>
              <a :href="l.href" target="_blank" rel="noopener">{{ l.label }}<svg class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10" /><path d="M7 17 17 7" /></svg></a>
            </template>
          </div>
        </div>
        <section v-else-if="ready && inNest" class="tt-grp tt-nest-grp">
          <div class="tt-grid">
            <div v-for="c in T.nestCards" :key="c.id" class="tt-cell" :data-id="c.id" :data-face="c.face" :data-held="c.held === false ? 'false' : 'true'" :data-print="pAt(c)">
              <TtFace :card="c" :data="meta" :fonts="false" :copyright="W.copyright" :labels="W"><template #art><span v-if="c.held === false" class="tt-want tt-stub" aria-hidden="true">{{ W.want }}</span></template></TtFace>
              <button class="tt-hit" type="button" :aria-label="nestCellLabel(c)" @click="openCard(c.id, $event.currentTarget.parentNode)" />
              <slot name="cell" :card="c" :t="T" />
            </div>
          </div>
        </section>
        <template v-else-if="ready">
          <section v-for="g in T.groups" :key="g.id" class="tt-grp" :class="{ 'is-stacked': T.isStacked(g.id) }" :data-sec="g.id">
            <button
              v-if="g.kind !== 'all'" class="tt-bx" type="button" :data-g="g.id" :style="{ '--app': heads[g.id].color }"
              :aria-expanded="T.isStacked(g.id) ? 'false' : 'true'" :aria-label="`${headSpoken(heads[g.id])}, ${T.isStacked(g.id) ? 'spread' : 'stack'}`"
              @click="toggleStack(g.id)"
            >
              <span class="tt-bx-row">
                <span class="tt-bx-name" :class="{ 'is-gold': heads[g.id].gold }">{{ heads[g.id].name }}</span>
                <span v-if="heads[g.id].sub" class="tt-bx-sub">{{ heads[g.id].sub }}</span>
                <span class="tt-bx-end">
                  <span v-if="heads[g.id].shown != null" class="tt-bx-shown">{{ heads[g.id].shown }} {{ W.shown }}</span>
                  <span class="tt-bx-fig"><template v-if="quests[g.id]"><b>{{ quests[g.id].n }}</b><i v-if="quests[g.id].of">{{ quests[g.id].of }}</i><em v-if="heads[g.id].unit">{{ heads[g.id].unit }}</em><em v-if="quests[g.id].rest">{{ quests[g.id].rest }}</em></template><template v-else><b>{{ heads[g.id].n }}</b><i v-if="heads[g.id].of != null">{{ ` ${W.of} ${heads[g.id].of}` }}</i><em v-if="heads[g.id].unit">{{ heads[g.id].unit }}</em>{{ ptsOf(heads[g.id]) }}</template></span>
                  <svg v-if="!T.isStacked(g.id)" class="tt-i tt-i16" viewBox="0 0 24 24" aria-hidden="true" v-html="stackSvg" />
                </span>
              </span>
              <span v-if="heads[g.id].bar" class="tt-bar" :style="heads[g.id].bar" />
            </button>
            <div v-for="x in (g.kind !== 'all' && $slots['group-act'] ? [1] : [])" :key="x" class="tt-bx-act"><slot name="group-act" :group="g" :head="heads[g.id]" :stacked="T.isStacked(g.id)" :t="T" /></div>
            <div
              v-if="T.isStacked(g.id)" class="tt-pile" role="button" tabindex="0" :data-pg="g.id"
              :data-print="piles[g.id].print ? '' : undefined" :data-face="piles[g.id].print ? g.cards[0].face : undefined"
              :data-edges="piles[g.id].print ? piles[g.id].edges.length : undefined"
              :aria-label="`${g.kind === 'all' ? 'All' : heads[g.id].label}, ${g.cards.length} cards, spread`"
              @click="toggleStack(g.id)" @keydown.enter.space.prevent="toggleStack(g.id)"
            >
              <span v-for="i in piles[g.id].edges" :key="i" class="tt-edge" :style="{ '--i': i }" aria-hidden="true" />
              <div
                v-for="L in piles[g.id].layers" :key="L.card.id" class="tt-cell" :data-id="L.card.id" :data-k="L.k"
                :data-face="L.card.face" :data-held="L.card.held === false ? 'false' : 'true'" :data-print="pAt(L.card)" :style="{ transform: L.transform }" aria-hidden="true"
              >
                <TtFace :card="L.card" :data="meta" :fonts="false" :copyright="W.copyright" :labels="W"><template #art><span v-if="L.card.held === false" class="tt-want tt-stub" aria-hidden="true">{{ W.want }}</span></template></TtFace>
              </div>
              <span class="tt-pile-deco" aria-hidden="true" :style="{ transform: piles[g.id].coverTransform }"><span class="tt-pile-n tt-stub">×{{ g.cards.length }}</span></span>
            </div>
            <div v-else class="tt-grid">
              <template v-for="c in g.cards" :key="c.id">
                <div
                  v-if="T.nestOf(c)" class="tt-pile tt-nest" role="button" tabindex="0" :data-nest="c.id" :data-face="c.face" :data-print="pAt(c)" :aria-label="nestLabel(c)"
                  @click="openNest(c.id, $event.currentTarget)" @keydown.enter.space.prevent="openNest(c.id, $event.currentTarget)"
                >
                  <span v-for="i in edgesOf(c)" :key="i" class="tt-edge" :style="{ '--i': i }" aria-hidden="true" />
                  <div class="tt-cell" :data-face="c.face" data-held="true" :data-print="pAt(c)" aria-hidden="true"><TtFace :card="c" :data="meta" :fonts="false" :copyright="W.copyright" :labels="W" /></div>
                  <span class="tt-pile-deco" aria-hidden="true"><span class="tt-pile-n tt-stub"><slot name="nest-n" :card="c" :n="T.nestOf(c).cards.length">×</slot>{{ T.nestOf(c).cards.length }}</span></span>
                </div>
                <div v-else class="tt-cell" :data-id="c.id" :data-face="c.face" :data-held="c.held === false ? 'false' : 'true'" :data-print="pAt(c)">
                  <TtFace :card="c" :data="meta" :fonts="false" :copyright="W.copyright" :labels="W"><template #art><span v-if="c.held === false" class="tt-want tt-stub" aria-hidden="true">{{ W.want }}</span></template></TtFace>
                  <button class="tt-hit" type="button" :aria-label="cellLabel(c)" @click="openCard(c.id, $event.currentTarget.parentNode)" />
                  <slot name="cell" :card="c" :t="T" />
                </div>
              </template>
            </div>
          </section>
          <div v-if="!T.groups.length && T.cards.length" class="tt-none">
            <span class="tt-tag tt-stub">{{ W.noCards }}</span>
            <button class="tt-btn-line" type="button" @click="change(() => t.clearFilters())">Clear filters</button>
          </div>
        </template>
      </div>
    </main>

    <div ref="dockEl" class="tt-dock">
      <TtRail :t="T" :chips="chips" :miss="missSeg" :pop-key="pop ? pop.k : null" :search="options.search !== false" @group="regroup" @chip="onChip" @missing="onMissing" @query="onQuery" @opening="closePop()">
        <slot name="rail" :t="T" />
      </TtRail>
      <TtRuler :t="T" :gap="CR_GAP" :reduced="reduced" @preview="onPreview" @commit="onCommit" />
    </div>

    <div v-if="$slots.tray" ref="trayEl" class="tt-tray-w">
      <slot name="tray" :t="T" />
    </div>

    <div v-if="popView" ref="popEl" class="tt-pop" role="dialog" aria-modal="false" :aria-label="popView.name" :style="popPos">
      <div class="tt-pop-h">
        <span class="tt-ph">{{ popView.name }}</span>
        <span class="tt-pc"><b>{{ heldShown }}</b> cards<template v-if="T.filter.missing && missShown"> · <b>{{ missShown }}</b> missing</template></span>
      </div>
      <div class="tt-pop-b" role="group" :aria-label="popView.name">
        <template v-for="row in popView.rows" :key="row.key">
          <div v-if="row.label" class="tt-pop-row">{{ row.label }}</div>
          <button
            v-for="o in row.options" :key="o.v" class="tt-opt" type="button" :role="popView.multi ? 'menuitemcheckbox' : 'menuitemradio'"
            :data-v="o.v" :aria-checked="o.on ? 'true' : 'false'" @click="pick(o.v)"
          >
            <svg class="tt-i tt-i16 tt-ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            <span v-if="o.mk" class="tt-mk" :style="{ background: o.mk }" />
            <span class="tt-ol" :class="{ 'is-gold': o.gold }">{{ o.l }}</span>
            <span v-if="o.n != null" class="tt-oc">{{ o.n }}</span>
          </button>
        </template>
      </div>
      <div v-if="popView.multi" class="tt-pop-f">
        <button type="button" :disabled="!popView.any" @click="clearFacet">Clear</button>
        <button type="button" class="tt-done" @click="closePop(true)">Done</button>
      </div>
    </div>

    <TtStage ref="stageRef" :t="T" :data="meta" :locate="locate" :reduced="reduced" :want="W.want" :copyright="W.copyright" :labels="W" :quiver="quiver">
      <template v-if="$slots['stage-actions']" #actions="s"><slot name="stage-actions" v-bind="s" /></template>
      <template v-if="$slots['stage-back']" #more="s"><slot name="stage-back" v-bind="s" /></template>
      <template v-if="$slots['stage-foot']" #foot="s"><slot name="stage-foot" v-bind="s" /></template>
      <template v-if="$slots['stage-head']" #head="s"><slot name="stage-head" v-bind="s" /></template>
      <template v-if="$slots['stage-art']" #art="s"><slot name="stage-art" v-bind="s" /></template>
    </TtStage>
  </div>
</template>

<script setup>
/**
 * The Card room table: draws useTtTable's state and runs its motion. It owns the table:
 * useTtTable(collection, { gap: CR_GAP, widths: CR_DEFAULT_W, ...options, wide: lap }), with lap
 * null on the server and set from matchMedia(CR_LAPTOP) on mount. The layout is the table's own: an
 * options.wide is ignored.
 *
 * Props: collection ({ apps, sets, rarities, cards, kinds?, interests? }; null while loading),
 * options (useTtTable's: key, groups, group, stacked, only; read once), back ({ label, href }),
 * tag ('Sample'), emptyLinks ([{ label, href }] under the empty table), ledgerFig (group => { n, of }:
 * the ledger's own figures, the Selection's cards in hand), loading.
 * Slots: cell ({ card, t }: an overlay on each card), rail ({ t }: extra controls at the head of the
 * chip rail; rendered twice, phone dock and laptop strip), stage-actions ({ card, t }: replaces the
 * open card's Open link), tray ({ t }: fixed over the table's foot, the Selection's hand and day;
 * the table keeps room for it), stage-back ({ card, t }: drawn at the end of the open card's
 * back, inside its scroll; Treehopper's photos of the species' trees), stage-foot ({ card, t }, 1.2.0: the open card's
 * back foot, outside its scroll), head ({ t }: after the
 * count in the top bar, shown on an empty table too; Treehopper's Join), nest-n ({ card, n }: the mark
 * before N on a set's stack, "×" unset). Exposes { t } (the table), T (the same through reactive()),
 * change(fn) (a filter change with the table's motion), openCard(id, el), deal(), openNest(id)
 * and closeNest(); emits nest (the open set's parent id, or null) however the set changed.
 * The shared card: a card that prints (core ttPrintOn) has data-print on its cell and
 * stack too (the tile's shadow, cardroom.css). Prop print (false; true, or { light, tilt }) runs core/print.js's
 * ttPrint on the table's root from mount to unmount: the light that follows the phone and the finger tilt on the
 * open card. labels.copyright: the print foot's copyright line (empty unset).
 * 1.1.0, more words in labels, each defaulting to today's: of ("of": the counter's and an open set's "n of N",
 * a head's "3 of 9", the ledger's spoken "n of N", a face back's "No. 03 of 12"), noCards ("No cards"), pts ("pts",
 * a head's points), no ("No.", the face's number and Treehopper's stamp). labels.questSpoken: the spoken head of a
 * set with points ("{name}, {n} of {N}, {pts} points"); unset, the label as before. options.groupLabels.set also
 * names the set filter's chip and popover.
 * 1.1.0: retired ("Retired"), the mark a Treehopper front prints for card.retired === true, and the word its
 * cell's spoken label adds (", Retired", as ", missing"); an empty word prints and says none.
 * over(id, { back }) lays that card (a top card, or a set's child) face up over the open one, the card under
 * kept as it was; pop() goes back to it (as Back, Escape and close do). Both return false when refused.
 * With options.nest: a held card with children (ttNest) is a stack in the grid that opens its set:
 * the table scoped to the parent and its children, the top bar holding Back (labels.nestBack, else tag,
 * else Back), the parent's name and "n of childTotal"; strip, Stack, search, rail, tray and head slot
 * hidden. Off (the default), the markup is as before, comment nodes included.
 * For createTabletop: prop theme (its fonts and <html> attributes, see the prop); options.sorts and
 * options.facets (useTtTable's: what is offered); options.missing false drops the Missing chip and options.search
 * false the search. Unset, the markup and the head entry are as before.
 *
 * 1.2.0, each unset as before: slots stage-head ({ card, side, flip, t, over }: the open card's head),
 * stage-art ({ card, side, t }: its art) and group-act ({ group, head, stacked, t }: after each head button, in
 * .tt-bx-act); labels front and back (Flip), story (a Treehopper back's heading), held, missing and all (the Missing
 * chip's word and the segment's), questHead ("{name} {n} of {N} · {pts} pts": the printed head of a set with
 * points); prop stackIcon ('layers'; 'two-layers'), prop topRows (1; 2, the phone's two-row top bar);
 * options.missing 'segment' (Held / Missing / All in both rails in place of the chip) and options.sortChip false.
 * The open card's faces draw the table's current copy of their cards.
 * 1.3.0, prop landing (a card id, or null): the app's newest find for this visit. The first time that card shows
 * as a stack's cover (data-k 0) on screen, it drops onto the stack once (280 ms, from 8 px left, 34 px up and 4 deg,
 * fading in by 60%), in place of the riffle or gather on that cell, and the table emits landed
 * (the id) so the app can clear it. None under reduced motion, still emitted. Under a cover, in a spread group or off
 * the table, it waits, silent; an id that has landed never plays again. Unset, nothing runs and no markup changes.
 * The cards render on the client only (after restore() and the first measure), so the server and the
 * first client render agree; the table then riffles in. Phone dock and laptop rows are two copies,
 * one hidden by the 900 px query: nothing moves in the DOM.
 * FLIP is keyed by data-id (cells) and data-g (headers), not by element: Vue makes a new element when
 * a card moves between a pile and the grid. A card gone after a change leaves a ghost clone (into the
 * pile's place when gathering). Moves are capped at 30 and only on screen.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, onUpdated, reactive, ref, watch } from 'vue'
import TtFace from './TtFace.vue'
import TtRail from './TtRail.vue'
import TtRuler from './TtRuler.vue'
import TtSearch from './TtSearch.vue'
import TtStage from './TtStage.vue'
import { useTtTable } from './useTtTable.js'
import { ttDeal, ttFilter, ttGroup } from '../core/core.js'
import { TT_FACE_FONTS, TT_PC_FONTS, TT_TH_FONTS, ttFaceBase, ttFaceOf, ttPrintOn } from '../core/face.js'
import { ttThemeHead } from '../core/tabletop.js'
import { ttPrint } from '../core/print.js'
import {
  CR_DEFAULT_W, CR_EASE, CR_FONTS, CR_GAP, CR_LAPTOP, CR_REST, crCardTilt, crChip, crHead, crHeldNumbers,
  crKindRows, crLayer, crLedger, crMissingCount, crPile, crSeeds, crTransform,
} from '../core/cardroom.js'
import { ttHead, ttLocked } from './host.js'

const props = defineProps({
  collection: { type: Object, default: null },
  options: { type: Object, default: () => ({}) },
  back: { type: Object, default: () => ({ label: 'Back', href: '/' }) },
  tag: { type: String, default: '' },
  emptyLinks: { type: Array, default: () => [] },
  ledgerFig: { type: Function, default: null },
  loading: { type: Boolean, default: false },
  // The count as "n of N" (Treehopper's types), and the table's words; unset, the markup is as before
  counter: { type: Object, default: null },
  labels: { type: Object, default: () => ({}) },
  // The phone dock's chips wrap to rows (opt in; Provo's dock scrolls as before)
  dockWrap: { type: Boolean, default: false },
  // An empty table keeps the strip for the status slot (Treehopper's Next line); rail and ledger stay hidden
  emptyStatus: { type: Boolean, default: false },
  // The open card's first-card quiver, passed to TtStage (true, or a function of the card; off unset)
  quiver: { type: [Boolean, Function], default: false },
  // The print motion (core/print.js) on the table's root: false, true, or { light, tilt }
  print: { type: [Boolean, Object], default: false },
  // The instance's theme config ({ class, fonts, htmlAttrs }, createTabletop's `theme`): its fonts and <html>
  // attributes in the head entry, in place of the Card room's data-tt and tt-cr-fonts (ttThemeHead: no `fonts` key
  // keeps tt-cr-fonts, `fonts: []` drops it). Unset, the entry is as before.
  // The class goes on the root through Tabletop (a class on this component), not from here.
  theme: { type: Object, default: null },
  // 1.2.0: the stack glyph on Stack and on a spread group's head: 'layers' (unset) or 'two-layers'
  stackIcon: { type: String, default: 'layers' },
  // 1.2.0: 2 lays the phone's top bar in two rows (data-top-rows="2", table.css); 1 unset, one row as before
  topRows: { type: [Number, String], default: 1 },
  // 1.3.0: the newest find, dropped onto its stack once; emits landed (the id). Unset, nothing runs
  landing: { type: [String, Number], default: null },
})
const emit = defineEmits(['nest', 'landed'])
// 1.1.0: of, noCards, pts and no (the face's "No.") join the words, each defaulting to today's word
// 1.2.0: front and back (the stage's Flip), story (a Treehopper back's heading), held, missing and all
// (the Missing chip's word, and options.missing 'segment''s three)
const TT_WORDS = Object.freeze({
  cards: 'Cards', wanted: 'Wanted', want: 'WANTED', shown: 'SHOWN', child: 'card', children: 'cards', of: 'of', noCards: 'No cards', pts: 'pts', no: 'No.', retired: 'Retired',
  front: 'Front', back: 'Back', story: 'Species story', held: 'Held', missing: 'Missing', all: 'All',
})
const W = computed(() => ({ ...TT_WORDS, ...(props.labels || {}) }))
const fmtN = v => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-US') : '')
// A set's points beside its count, "· 120 pts", only when crHead gives them (text, so an unset one leaves no node)
const ptsOf = h => (h && h.pts != null ? ` · ${h.pts.toLocaleString('en-US')} ${W.value.pts}` : '')
// 1.1.0, labels.questSpoken: a head with points is read as the template ("{name}, {n} of {N}, {pts} points":
// name, held, total, points); without the key, or on a head without points, its label as before
const fillWords = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? String(v[k]) : m))
const headSpoken = h => (h.pts != null && W.value.questSpoken
  ? fillWords(W.value.questSpoken, { name: h.label, n: fmtN(h.n), N: h.of != null ? fmtN(h.of) : '', pts: h.pts.toLocaleString('en-US') })
  : h.label)
// 1.1.0: the set filter's chip and popover take the Group segment's word for sets (options.groupLabels.set,
// Treehopper's "Side quests"), so one word names the level everywhere; unset, "Set" as before
const setWord = () => { const g = props.options.groupLabels; return g && typeof g.set === 'string' && g.set ? g.set : null }

const LAYERS = '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>'
// 1.2.0: prop stackIcon; 'two-layers' is a flat two-sheet glyph
const STACK_ICONS = Object.freeze({ layers: LAYERS, 'two-layers': '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>' })
const stackSvg = computed(() => STACK_ICONS[props.stackIcon] || LAYERS)
// 1.2.0: labels.questHead ("{name} {n} of {N} · {pts} pts") prints a head with points in three parts: after
// {name}, <b> the held count, <i> the words through {N} (" of 9"), <em> the rest trimmed ("· 120 pts"). Unset, or a
// head without points, null: the figure as before
function questFig(h) {
  const tpl = W.value.questHead
  if (!tpl || !h || h.pts == null) return null
  const v = { n: h.n, N: h.of != null ? h.of : '', pts: h.pts.toLocaleString('en-US') } // as the figure prints them
  const t0 = String(tpl)
  const at = t0.indexOf('{name}')
  const after = at >= 0 ? t0.slice(at + 6) : t0
  const iN = after.indexOf('{n}')
  if (iN < 0) return null
  const rest = after.slice(iN + 3)
  const iT = rest.indexOf('{N}')
  return {
    n: v.n,
    of: iT >= 0 && h.of != null ? fillWords(rest.slice(0, iT + 3), v) : '',
    rest: fillWords(iT >= 0 ? rest.slice(iT + 3) : rest, v).trim(),
  }
}

// 1.6.0: by the kit face that draws a card (its base), so a host's face based on the Treehopper or Studio face loads its fonts too
const hasFace = (c, f) => !!(c && Array.isArray(c.cards) && c.cards.some(x => x && ttFaceBase(ttFaceOf(x, c), c) === f))
// The fonts and the page mark, handed to the host (host.js): the kit sets nothing on <html> itself.
// A theme's own fonts and <html> attributes take the Card room's place (ttThemeHead); the preconnects and the
// faces' fonts stay the table's.
const themeHead = props.theme ? ttThemeHead(props.theme) : null
// The faces' own fonts, by the kit face that draws a card: the Treehopper front's and the Studio face's (1.4.0)
const FACE_LINKS = [
  { face: 'treehopper', link: { key: 'tt-th-fonts', rel: 'stylesheet', href: TT_TH_FONTS } },
  { face: 'studio', link: { key: 'tt-pc-fonts', rel: 'stylesheet', href: TT_PC_FONTS } },
]
const faceLinks = c => FACE_LINKS.filter(f => hasFace(c, f.face)).map(f => ({ ...f.link }))
const setupFaceLinks = faceLinks(props.collection)
ttHead({
  ...(themeHead ? (themeHead.htmlAttrs ? { htmlAttrs: themeHead.htmlAttrs } : {}) : { htmlAttrs: { 'data-tt': 'cardroom' } }),
  link: [
    { key: 'tt-pre-1', rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { key: 'tt-pre-2', rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { key: 'tt-face-fonts', rel: 'stylesheet', href: TT_FACE_FONTS },
    ...(themeHead ? themeHead.link : [{ key: 'tt-cr-fonts', rel: 'stylesheet', href: CR_FONTS }]),
    // the faces' fonts for the cards the collection holds at setup
    ...setupFaceLinks,
  ],
})
// A collection that arrives after setup (Tabletop loads once it has mounted; a host may fetch on the client) gets
// the faces' fonts for its cards in an entry of their own, each link once, from the first mount or update that holds
// such a card. The faces on the table and the stage leave their fonts to the table, so nothing else asks for them.
// It runs in a lifecycle hook, where this table is the current instance, so a host's head that needs one (useHead)
// works there as it does at setup.
const facesGiven = new Set(setupFaceLinks.map(l => l.key))
const faceLinksNow = computed(() => faceLinks(props.collection))
function lateFaceFonts() {
  const link = faceLinksNow.value.filter(l => !facesGiven.has(l.key))
  if (!link.length) return
  for (const l of link) facesGiven.add(l.key)
  ttHead({ link })
}

const lap = ref(null)
const t = useTtTable(() => props.collection, { gap: CR_GAP, widths: CR_DEFAULT_W, ...props.options, wide: lap })
const T = reactive(t)
const meta = computed(() => props.collection || {})
// A printing card's cell and stack carry data-print (absent otherwise, so other markup is unchanged)
const pAt = c => (ttPrintOn(c, meta.value) ? '' : undefined)
let stopPrint = null
function runPrint() {
  if (stopPrint) { stopPrint(); stopPrint = null }
  if (props.print && rootEl.value) stopPrint = ttPrint({ root: rootEl.value, ...(typeof props.print === 'object' ? props.print : {}) })
}
const ready = ref(false)
const empty = computed(() => !props.loading && !!props.collection && !T.cards.some(c => c.held !== false))

const rootEl = ref(null)
const topEl = ref(null)
const stripEl = ref(null)
const ledgerEl = ref(null)
const mainEl = ref(null)
const groupsEl = ref(null)
const dockEl = ref(null)
const trayEl = ref(null)
const popEl = ref(null)
const cmEl = ref(null)
const stkEl = ref(null)
const stageRef = ref(null)

let rmq = null
const reduced = () => !!(rmq && rmq.matches)

// ── What the chrome reads
// The Missing chip shows the gaps alone (filter.missing 'only'), so the head keeps the held count
// the other filters leave; a host that sets filter.missing true still adds the gaps after the held, "+N"
const heldShown = computed(() => (T.filter.missing === 'only' ? T.heldCount : T.shown.filter(c => c.held !== false).length))
const missShown = computed(() => T.shown.filter(c => c.held === false).length)
const stackedAll = computed(() => !T.searching && T.allStacked)
const heldNums = computed(() => crHeldNumbers(T.cards))
const heads = computed(() => Object.fromEntries(T.groups.map(g => [g.id, crHead(g, meta.value, heldNums.value, { missingOnly: T.filter.missing === 'only' })])))
const quests = computed(() => Object.fromEntries(Object.entries(heads.value).map(([id, h]) => [id, questFig(h)])))
// A pile whose cover prints is a straight stack of cardstock (crPile edges), not the fan
const piles = computed(() => Object.fromEntries(T.groups.filter(g => T.isStacked(g.id)).map((g) => {
  const print = ttPrintOn(g.cards[0], meta.value)
  return [g.id, { ...crPile(g.id, g.cards, { edges: print }), print }]
})))
const setName = id => ((meta.value.sets || []).find(s => s.id === id) || {}).name || ''
// A retired card (card.retired === true) is read as retired too, as its face prints it
const retiredSaid = c => (c.retired === true && W.value.retired ? `, ${W.value.retired}` : '')
const cellLabel = c => `${c.title}, ${setName(c.set)}${c.held === false ? ', missing' : ''}${retiredSaid(c)}`

// ── A card's set, one level under it (the UI word is "set", the code word "nest"): its cell in the
// grid is a stack (edges under the card, the "×N" stub) that opens the set; the open set is the table
// scoped to the parent and its children, with back, the parent's name and "n of total" in the top bar
const inNest = computed(() => T.nest != null && T.nestCards.length > 0)
const nestBack = computed(() => W.value.nestBack || props.tag || 'Back')
const nestFig = computed(() => {
  const c = T.nestCount || { n: 0, of: null }
  return { n: fmtN(c.n), of: c.of != null ? `${W.value.of} ${fmtN(c.of)}` : W.value.cards }
})
const nestLabel = (c) => { const n = T.nestOf(c).cards.length; return `${c.title}${retiredSaid(c)}, ${n} ${n === 1 ? W.value.child : W.value.children}` }
const nestCellLabel = c => `${[c.title, setName(c.set)].filter(Boolean).join(', ')}${c.held === false ? ', missing' : ''}${retiredSaid(c)}`
// edges under the card, one a child up to 6, the lowest first
const edgesOf = (c) => { const e = Math.min(6, T.nestOf(c).cards.length); return Array.from({ length: e }, (_, i) => e - i) }

// The ledger: one column per group of the table's first grouping, over the whole collection
const firstGrouping = computed(() => (T.groupOptions[0] || {}).id)
const ledgerName = computed(() => { const l = (T.groupOptions[0] || {}).label || 'Group'; return /s$/.test(l) ? l : l + 's' })
const ledger = computed(() => {
  const by = firstGrouping.value
  if (!by || by === 'none' || empty.value) return []
  const present = new Set(ttGroup(T.shown, by, meta.value).map(g => g.id))
  return crLedger(ttGroup(T.cards, by, meta.value), present, meta.value, heldNums.value, props.ledgerFig)
})
const current = ref(null)

// Chips: a facet only with two or more options or while on; Missing only with missing cards.
// Only the facets the table offers (options.facets, T.facetOptions); options.missing false drops the Missing chip.
const FACETS = ['from', 'set', 'kind', 'interests', 'rarity']
const missCount = computed(() => (props.options.missing === false ? 0 : crMissingCount(T.cards)))
const chips = computed(() => {
  const out = []
  const mc = missCount.value
  if (mc > 0 && props.options.missing !== 'segment') out.push({ k: 'missing', name: W.value.missing, value: String(mc), on: !!T.filter.missing, toggle: true })
  for (const f of FACETS) {
    if (!T.facetOptions.includes(f)) continue
    const opts = T.facets[f] || []
    if (opts.length < 2 && !T.filter[f].length) continue
    const chip = { k: f, ...crChip(f, T.filter[f], T.facets, meta.value) }
    if (f === 'set' && setWord()) chip.name = setWord()
    out.push(chip)
  }
  if (props.options.sortChip === false) return out
  const s = T.sortOptions.find(x => x.id === T.sort)
  out.push({ k: 'sort', name: s ? s.label : 'Sort', value: '', on: false })
  return out
})
// 1.2.0: options.missing 'segment' shows Held / Missing / All (filter.missing false, 'only', true) at the
// rail's head in place of the Missing chip, while the table has missing cards; unset, null (TtRail draws none)
const missSeg = computed(() => {
  if (props.options.missing !== 'segment' || !(missCount.value > 0)) return null
  const m = T.filter.missing
  return {
    name: W.value.cards,
    value: m === 'only' ? 'only' : m ? true : false,
    opts: [{ v: false, label: W.value.held }, { v: 'only', label: W.value.missing }, { v: true, label: W.value.all }],
  }
})

// ── FLIP (a set's stack moves as its card: key c:<id>, from data-nest)
const idOf = el => el.dataset.id ?? el.dataset.nest
const keyOf = el => (idOf(el) != null ? `c:${idOf(el)}` : `g:${el.dataset.g}`)
const inPile = el => el.dataset.k != null
const tOf = el => (inPile(el) && !el.parentNode.hasAttribute('data-edges') ? crLayer(Number(el.dataset.k), crSeeds(el.parentNode.dataset.pg)) : CR_REST)
const boxOf = el => (inPile(el) ? el.parentNode : el).getBoundingClientRect()
const items = () => (groupsEl.value ? groupsEl.value.querySelectorAll('.tt-cell[data-id], .tt-bx[data-g], .tt-nest[data-nest]') : [])
// [key, el] in DOM order; a repeat of a key (a card in two sets) is key#2, #3, so each cell keeps its own place
function keyed() {
  const seen = new Map()
  return Array.from(items(), el => {
    const k = keyOf(el)
    const n = (seen.get(k) || 0) + 1
    seen.set(k, n)
    return [n > 1 ? `${k}#${n}` : k, el]
  })
}
const sameT = (a, b) => a.r === b.r && a.a === b.a && a.b === b.b
const sel = (attr, v) => `[${attr}="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(v)) : String(v)}"]`
const pileOf = id => (groupsEl.value ? groupsEl.value.querySelector(`.tt-pile${sel('data-pg', id)}`) : null)
const secOf = id => (groupsEl.value ? groupsEl.value.querySelector(`.tt-grp${sel('data-sec', id)}`) : null)

function snap() {
  const m = new Map()
  const vh = window.innerHeight
  for (const [k, el] of keyed()) {
    const r = boxOf(el)
    if (r.bottom < -80 || r.top > vh + 80 || !r.width) continue
    m.set(k, { x: r.left, y: r.top, t: tOf(el), el })
  }
  return m
}
function play(prev, o = {}) {
  const g = groupsEl.value
  if (!g) return
  const seen = new Set()
  for (const [k] of keyed()) seen.add(k)
  if (reduced()) { g.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 150, easing: CR_EASE.out }); exits(prev, null, seen); tryLand(); return }
  const vh = window.innerHeight
  const dur = o.dur || 220
  const st = o.stagger || 0
  let n = 0
  for (const [k, el] of keyed()) {
    const r = boxOf(el)
    if (r.bottom < 0 || r.top > vh || !r.width) continue
    let p = prev.get(k)
    if (!p && o.from) p = o.from(el, r)
    const t1 = tOf(el)
    if (p) {
      const dx = p.x - r.left
      const dy = p.y - r.top
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && sameT(p.t, t1)) continue
      if (n >= 30) continue // the rest appear at once
      const delay = st * n
      const z = o.z ? 40 - n : 0
      n++
      if (z) el.style.zIndex = z
      const a = el.animate([{ transform: crTransform(dx, dy, p.t) }, { transform: crTransform(0, 0, t1) }], { duration: dur, delay, easing: CR_EASE.out, fill: 'backwards' })
      if (z) a.onfinish = a.oncancel = () => { el.style.zIndex = '' }
    } else if (!o.noFade) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: CR_EASE.out })
    }
  }
  exits(prev, o.toward || null, seen)
  tryLand()
}
// 1.3.0: the landing card, once, when it shows as a stack's cover on screen (prop landing)
const landedIds = new Set()
const landKey = () => (props.landing == null || props.landing === '' ? null : String(props.landing))
function tryLand() {
  const id = landKey()
  const g = groupsEl.value
  if (id == null || landedIds.has(id) || !g) return
  const el = Array.from(g.querySelectorAll('.tt-pile[data-pg] > .tt-cell[data-k="0"]')).find(e => e.dataset.id === id)
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.bottom < 0 || r.top > window.innerHeight || !r.width) return
  landedIds.add(id)
  if (!reduced()) {
    // the drop replaces the riffle or gather running on this cell
    if (el.getAnimations) for (const a of el.getAnimations()) a.cancel()
    // and the pile paints in its resting order under it: the riffle's z-index (40 - n puts a fanned pile's cover lowest)
    // comes off the other layers now, as each riffle's own end would, so the card drops on top and the count stays above
    for (const c of el.parentNode.children) if (c !== el && c.style.zIndex) c.style.zIndex = ''
    const base = crTransform(0, 0, tOf(el))
    // the easing on each keyframe, as a CSS animation eases each segment: the fade reaches 1 at 60% of the time
    el.animate([
      { transform: `translate(-8px,-34px) rotate(-4deg) ${base}`, opacity: 0, easing: CR_EASE.out },
      { opacity: 1, offset: 0.6, easing: CR_EASE.out },
      { transform: base, opacity: 1 },
    ], { duration: 280, fill: 'backwards' })
  }
  emit('landed', props.landing)
}
// cards that left the table: a quick ghost, into the pile if one gathered them
function exits(prev, toward, seen) {
  let n = 0
  for (const [key, p] of prev) {
    if (!key.startsWith('c:') || seen.has(key) || n >= 12 || !rootEl.value) continue
    n++
    const gh = p.el.cloneNode(true)
    gh.classList.add('tt-ghost')
    gh.removeAttribute('data-k')
    gh.style.cssText = `left:${p.x}px;top:${p.y}px;transform:${crTransform(0, 0, p.t)};z-index:20;visibility:visible`
    gh.setAttribute('aria-hidden', 'true')
    rootEl.value.appendChild(gh)
    let kf
    let dur
    if (toward && !reduced()) {
      kf = [{ transform: crTransform(0, 0, p.t), opacity: 1 }, { opacity: 1, offset: 0.6 }, { transform: crTransform(toward.left - p.x, toward.top - p.y, toward.flat ? CR_REST : crCardTilt(idOf(p.el))), opacity: 0 }]
      dur = 240
    } else {
      kf = [{ opacity: 1, transform: crTransform(0, 0, p.t) }, { opacity: 0, transform: crTransform(0, 6, p.t) }]
      dur = reduced() ? 120 : 160
    }
    const a = gh.animate(kf, { duration: dur, easing: CR_EASE.out, fill: 'forwards' })
    a.onfinish = a.oncancel = () => gh.remove()
  }
}
function riffleAll() {
  const g = groupsEl.value
  if (!g) return
  if (reduced()) { g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }); tryLand(); return }
  play(new Map(), {
    stagger: 8, z: true, dur: 260,
    from: (el) => {
      if (idOf(el) == null) return null
      const sec = el.closest('.tt-grp')
      const first = sec && (sec.querySelector('.tt-pile:not(.tt-nest)') || sec.querySelector('.tt-grid > .tt-cell, .tt-grid > .tt-nest'))
      if (!first) return null
      const fr = first.getBoundingClientRect()
      return { x: fr.left, y: fr.top, t: first.hasAttribute('data-edges') ? CR_REST : crCardTilt(idOf(el)) }
    },
  })
}
// filters, sort and search: measure, change, play
async function change(fn) {
  const prev = snap()
  fn()
  await nextTick()
  play(prev, {})
}
async function toggleStack(id) {
  if (T.searching) return
  closePop()
  const was = T.isStacked(id)
  const prev = snap()
  const pr = was ? pileAt(pileOf(id)) : null
  if (was) t.spread(id)
  else t.stack(id)
  await nextTick()
  if (was) {
    play(prev, { stagger: 8, z: true, from: el => (idOf(el) != null && pr && el.closest('.tt-grp') === secOf(id) ? { x: pr.left, y: pr.top, t: pr.flat ? CR_REST : crCardTilt(idOf(el)) } : null) })
  } else {
    const np = pileOf(id)
    play(prev, { toward: pileAt(np) })
    fadeEdges([np])
  }
}
// A printing stack is flat, so cards gather into it and spread from it at rest, not through the
// fan's tilt, and its edges fade in while the cover travels to it (else a blank edge shows alone for the FLIP's 220 ms)
function pileAt(p) {
  if (!p) return null
  const r = p.getBoundingClientRect()
  return { left: r.left, top: r.top, flat: p.hasAttribute('data-edges') }
}
function fadeEdges(list) {
  if (reduced()) return
  for (const p of list) if (p) for (const e of p.querySelectorAll(':scope > .tt-edge')) e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: CR_EASE.out })
}
async function stackAll() {
  if (T.searching) return
  closePop()
  const all = T.allStacked
  const prev = snap()
  const rects = {}
  if (all) for (const g of T.groups) { const p = pileAt(pileOf(g.id)); if (p) rects[g.id] = p }
  t.toggleAll()
  await nextTick()
  if (all) {
    play(prev, {
      stagger: 8, z: true,
      from: (el) => {
        if (idOf(el) == null) return null
        const sec = el.closest('.tt-grp')
        const pr = sec && rects[sec.dataset.sec]
        return pr ? { x: pr.left, y: pr.top, t: pr.flat ? CR_REST : crCardTilt(idOf(el)) } : null
      },
    })
  } else {
    const fp = groupsEl.value && groupsEl.value.querySelector('.tt-pile:not(.tt-nest)')
    play(prev, { toward: pileAt(fp) })
    fadeEdges(T.groups.map(g => pileOf(g.id)))
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' })
  }
}
function regroup(id) {
  if (id === T.group) return
  closePop()
  const apply = async () => { t.setGroup(id); await nextTick(); window.scrollTo(0, 0) }
  const g = groupsEl.value
  if (reduced() || !g) { apply().then(() => { if (g) g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }); tryLand() }); return }
  const a = g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: CR_EASE.out, fill: 'forwards' })
  a.onfinish = async () => { await apply(); a.cancel(); riffleAll(); syncLedger() }
}
function onQuery(v) { change(() => { T.filter.q = v }) }

// ── Ledger: jump, and the current column from scroll
const stickyBottom = () => (stripEl.value && stripEl.value.offsetParent !== null ? stripEl.value : topEl.value).getBoundingClientRect().bottom
const dockTop = () => {
  const d = lap.value || !dockEl.value ? window.innerHeight : dockEl.value.getBoundingClientRect().top
  const h = trayEl.value && trayEl.value.firstElementChild
  return h ? Math.min(d, h.getBoundingClientRect().top) : d
}
function jump(id, instant) {
  const s = secOf(id)
  if (!s) return
  const y = s.getBoundingClientRect().top + window.scrollY - stickyBottom() - 12
  window.scrollTo({ top: Math.max(0, y), behavior: instant || reduced() ? 'auto' : 'smooth' })
}
async function onLedger(col) {
  if (col.off) return
  if (T.group !== firstGrouping.value) {
    closePop()
    t.setGroup(firstGrouping.value)
    await nextTick()
    window.scrollTo(0, 0)
    jump(col.id, true)
    riffleAll()
    return
  }
  jump(col.id, false)
}
function syncLedger() {
  if (!stripEl.value && !topEl.value) return // a frame or a riffle that lands after unmount
  let cur = null
  if (ready.value && !empty.value && T.group === firstGrouping.value && T.groups.length) {
    const line = stickyBottom() + 24
    cur = T.groups[0].id
    let curTop = -1e9
    for (const g of T.groups) {
      const s = secOf(g.id)
      const top = s ? s.getBoundingClientRect().top : 1e9
      if (top <= line && top > curTop + 1) { cur = g.id; curTop = top }
    }
    // at the very bottom, the last group on screen is the current one
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      const last = T.groups[T.groups.length - 1]
      const ls = secOf(last.id)
      if (ls && ls.getBoundingClientRect().top < window.innerHeight * 0.6) cur = last.id
    }
  }
  current.value = cur
}
// keep the current column in view when the ledger scrolls sideways (many kinds)
watch(current, () => nextTick(() => {
  const nav = ledgerEl.value
  const b = nav && nav.querySelector('[aria-current="true"]')
  if (!b) return
  if (b.offsetLeft < nav.scrollLeft) nav.scrollLeft = b.offsetLeft
  else if (b.offsetLeft + b.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = b.offsetLeft + b.offsetWidth - nav.clientWidth
}))
watch(() => [T.group, T.groups.length], () => nextTick(syncLedger))

// ── Slider: preview by scale while dragging, the real width on commit, the middle card held still
let pv = false
const centerY = () => (stickyBottom() + dockTop()) / 2
function clearPreview() {
  pv = false
  if (groupsEl.value) { groupsEl.value.style.transform = ''; groupsEl.value.style.willChange = '' }
}
function onPreview(w) {
  const g = groupsEl.value
  if (!g) return
  if (w === T.cardW) { clearPreview(); return }
  if (!pv) {
    pv = true
    const r = g.getBoundingClientRect()
    g.style.transformOrigin = `50% ${Math.max(0, centerY() - r.top).toFixed(0)}px`
    g.style.willChange = 'transform'
  }
  g.style.transform = `scale(${(w / T.cardW).toFixed(4)})`
}
function anchor() {
  const y = centerY()
  const x = window.innerWidth / 2
  for (const oy of [0, -60, 60]) {
    for (const ox of [0, -70, 70, -140, 140]) {
      const e = document.elementFromPoint(x + ox, y + oy)
      let el = e && e.closest && e.closest('.tt-cell, .tt-pile, .tt-bx')
      if (el && inPile(el)) el = el.parentNode
      if (el && groupsEl.value && groupsEl.value.contains(el)) { const r = el.getBoundingClientRect(); return { el, y: r.top + r.height / 2 } }
    }
  }
  return null
}
async function onCommit(w) {
  if (w === T.cardW && !pv) return
  const a = anchor()
  clearPreview()
  t.commitW(w)
  await nextTick()
  if (a && a.el.isConnected) {
    const r = a.el.getBoundingClientRect()
    const d = r.top + r.height / 2 - a.y
    if (Math.abs(d) > 1) window.scrollBy(0, d)
  }
}
function measure() {
  const m = mainEl.value
  if (!m) return
  const cs = getComputedStyle(m)
  t.measure(m.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), CR_GAP)
}

// ── Popover: filters and sort
const pop = ref(null) // { k, el }
const popPos = ref({})
const POPNAME = { from: 'From', set: 'Set', rarity: 'Rarity', kind: 'Kind', interests: 'Interests', sort: 'Sort' }
const facetName = k => (k === 'set' && setWord()) || POPNAME[k] || k
const appColor = id => ((meta.value.apps || []).find(a => a.id === id) || {}).color || null
const popView = computed(() => {
  if (!pop.value) return null
  const k = pop.value.k
  if (k === 'sort') return { k, name: 'Sort', multi: false, any: false, rows: [{ key: 'sort', label: '', options: T.sortOptions.map(s => ({ v: s.id, l: s.label, on: T.sort === s.id })) }] }
  let base = ttFilter(T.cards, { ...T.filter, [k]: [] })
  if (T.filter.only && typeof props.options.only === 'function') base = base.filter(props.options.only)
  const picked = new Set(T.filter[k])
  const test = {
    from: id => c => c.app === id,
    set: id => c => c.set === id,
    rarity: id => c => c.rarity === id,
    kind: id => c => String(c.kind) === id,
    interests: id => c => Array.isArray(c.interests) && c.interests.map(String).includes(id),
  }[k]
  const accent = id => { const c = T.cards.find(x => String(x.kind) === id && x.accent); return c ? c.accent : null }
  let opts = (T.facets[k] || []).map(o => ({
    v: String(o.id), l: o.label, on: picked.has(String(o.id)), n: base.filter(test(String(o.id))).length,
    mk: k === 'from' ? appColor(o.id) : k === 'set' ? appColor(o.app) : k === 'kind' ? accent(String(o.id)) : null,
    gold: k === 'rarity' && !!o.top, group: o.group, groupLabel: o.groupLabel,
  }))
  if (k === 'rarity' || k === 'kind' || k === 'interests') opts = opts.filter(o => o.n > 0 || o.on)
  const rows = k === 'kind' ? crKindRows(opts) : [{ key: k, label: '', options: opts }]
  return { k, name: facetName(k), multi: true, any: picked.size > 0, rows }
})
function placePop() {
  if (!pop.value || !lap.value) { popPos.value = {}; return }
  const r = pop.value.el.getBoundingClientRect()
  popPos.value = { top: `${r.bottom + 8}px`, left: `${Math.min(r.left, window.innerWidth - 316)}px` }
}
async function openPop(k, el) {
  pop.value = { k, el }
  placePop()
  await nextTick()
  if (popEl.value && !reduced()) popEl.value.animate([{ opacity: 0, transform: `translateY(${lap.value ? -6 : 6}px)` }, { opacity: 1, transform: 'none' }], { duration: 160, easing: CR_EASE.out })
  if (!lap.value) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' })
}
function closePop(refocus) {
  if (!pop.value) return
  const el = pop.value.el
  pop.value = null
  if (refocus && el && el.isConnected) el.focus({ preventScroll: true })
}
function onMissing(v) {
  closePop()
  if (T.filter.missing === v) return
  change(() => { T.filter.missing = v })
}
function onChip(k, el) {
  if (k === 'missing') { closePop(); change(() => { T.filter.missing = T.filter.missing ? false : 'only' }); return }
  if (pop.value && pop.value.k === k && pop.value.el === el) { closePop(); return }
  openPop(k, el)
}
function pick(v) {
  const k = pop.value && pop.value.k
  if (!k) return
  if (k === 'sort') { change(() => t.setSort(v)); closePop(true); return }
  change(() => t.toggleFacet(k, v))
}
function clearFacet() {
  const k = pop.value && pop.value.k
  if (k && k !== 'sort') change(() => { T.filter[k] = [] })
}
function onDocDown(e) {
  if (!pop.value) return
  if ((popEl.value && popEl.value.contains(e.target)) || (pop.value.el && pop.value.el.contains(e.target))) return
  closePop()
}
function onDocKey(e) {
  if (e.key !== 'Escape') return
  const staged = !!(stageRef.value && stageRef.value.isOpen())
  if (pop.value && !staged) closePop(true)
  // a set closes on Escape only when nothing over the table took it (the open card, a day or a path lock the page)
  else if (!pop.value && !staged && T.nest != null && !e.defaultPrevented && !ttLocked()) { e.preventDefault(); closeNest() }
}

// ── Open card
function openCard(id, cell) { closePop(); if (stageRef.value) stageRef.value.openFrom(id, cell) }
// Lay a card (a top card, or with nests on a set's child) over the open one; pop goes back
function cardById(id) {
  const all = T.cards || []
  const c = all.find(x => x && x.id === id)
  if (c) return c
  for (const p of all) {
    const r = T.nestOf(p)
    const k = r && r.cards.find(x => x && x.id === id)
    if (k) return k
  }
  return null
}
function over(id, o) { const c = cardById(id); return !!(c && stageRef.value && stageRef.value.over(c, o)) }
function closeOver() { return !!(stageRef.value && stageRef.value.pop()) }
function locate(id) {
  const g = groupsEl.value
  const cell = g ? g.querySelector(`.tt-grid > .tt-cell${sel('data-id', id)}`) : null
  let pile = null
  if (!cell) {
    // a parent on the top table sits on its set's stack
    pile = g ? g.querySelector(`.tt-grid > .tt-nest${sel('data-nest', id)}`) : null
    const grp = pile ? null : T.groups.find(x => x.cards.some(c => c.id === id))
    if (grp && T.isStacked(grp.id)) pile = pileOf(grp.id)
  }
  return { cell, pile, top: stickyBottom(), bot: dockTop() }
}

// ── Open set. openNest and closeNest are the table's (useTtTable); this watch does the rest
// whoever changes t.nest (a tap here, Escape, or the host from outside, Treehopper's ?set=): before the
// DOM changes it keeps the page's scroll and which copy of the stack opened it (a card can sit in two
// groups), closes the popover and an open card; after, an opened set starts at the top with focus on
// Back, a closed one puts the scroll back to the pixel and focus on the stack. A short fade both ways,
// none under reduced motion; no riffle.
let nestOpener = null
let nestFrom = null // { id, idx, y }
function openNest(id, el) {
  if (T.nest === id) return true
  nestOpener = el || null
  const ok = t.openNest(id)
  if (!ok) nestOpener = null
  return ok
}
function closeNest() { return t.closeNest() }
watch(() => T.nest, (id, old) => {
  settleDeal()
  closePop()
  if (stageRef.value && stageRef.value.isOpen()) stageRef.value.close({ all: true })
  if (id != null && old == null && typeof window !== 'undefined') {
    const list = groupsEl.value ? Array.from(groupsEl.value.querySelectorAll(`.tt-nest${sel('data-nest', id)}`)) : []
    nestFrom = { id, idx: Math.max(0, list.indexOf(nestOpener)), y: window.scrollY }
  }
  nestOpener = null
  emit('nest', id)
  nextTick(() => afterNest(id, old))
}, { flush: 'pre' })
function afterNest(id, old) {
  if (!rootEl.value) return
  if (id != null) {
    window.scrollTo(0, 0)
    const b = topEl.value && topEl.value.querySelector('.tt-back')
    if (b) b.focus({ preventScroll: true })
  } else {
    const f = nestFrom && nestFrom.id === old ? nestFrom : { id: old, idx: 0, y: nestFrom ? nestFrom.y : 0 }
    nestFrom = null
    window.scrollTo(0, f.y)
    const list = groupsEl.value ? groupsEl.value.querySelectorAll(`.tt-nest${sel('data-nest', f.id)}`) : []
    const el = list[f.idx] || list[0]
    if (el) el.focus({ preventScroll: true })
  }
  if (!reduced()) {
    for (const el of [groupsEl.value, topEl.value && topEl.value.querySelector('.tt-top-in')]) {
      if (el) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: CR_EASE.out })
    }
  }
  syncLedger()
}

// ── The +N WANTED stub must clear what follows the count (the head slot's first shown control, else
// Stack); on a narrow phone the CARDS word gives way
const tight = ref(false)
const cntEl = ref(null)
function afterCount() {
  for (let el = cntEl.value?.nextElementSibling; el; el = el.nextElementSibling) {
    if (el === stkEl.value || el.getBoundingClientRect().width > 0) return el
  }
  return stkEl.value
}
function fitTop() {
  tight.value = false
  nextTick(() => {
    if (lap.value || !cmEl.value || !stkEl.value) return
    const next = afterCount() || stkEl.value
    const a = cmEl.value.getBoundingClientRect()
    const b = next.getBoundingClientRect()
    // 1.2.0: in two rows (topRows 2) Stack sits on the first row, over the count's; one on another row is clear
    if (Number(props.topRows) === 2 && a.height > 0 && b.height > 0 && (b.bottom <= a.top || b.top >= a.bottom)) return
    tight.value = a.right > b.left - 10
  })
}
watch(() => [missShown.value, T.filter.missing, lap.value, heldShown.value, props.topRows], fitTop)

// ── Mount: layout, stored choices, measure, then the cards riffle in
let mq = null
let ro = null
let ticking = false
let rT = 0
const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; syncLedger(); tryLand() }) } }
const onLap = () => { closePop(); lap.value = mq.matches; nextTick(measure) }
const onResize = () => { clearTimeout(rT); rT = setTimeout(() => { measure(); placePop(); fitTop() }, 120) }
let vv = null
const lift = () => { if (dockEl.value && vv) { const off = window.innerHeight - vv.height - vv.offsetTop; dockEl.value.style.transform = off > 1 ? `translateY(${-off}px)` : '' } }

onMounted(async () => {
  rmq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq = window.matchMedia(CR_LAPTOP)
  lap.value = mq.matches
  if (mq.addEventListener) mq.addEventListener('change', onLap)
  t.restore()
  measure()
  if (typeof ResizeObserver !== 'undefined' && mainEl.value) { ro = new ResizeObserver(measure); ro.observe(mainEl.value) }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  document.addEventListener('pointerdown', onDocDown, true)
  document.addEventListener('keydown', onDocKey)
  if (window.visualViewport) { vv = window.visualViewport; vv.addEventListener('resize', lift); vv.addEventListener('scroll', lift) }
  ready.value = true
  runPrint()
  await nextTick()
  riffleAll()
  syncLedger()
  fitTop()
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); fitTop() })
})
// a collection that arrives after mount riffles in too
watch(() => T.cards.length, async (n, o) => { if (ready.value && n && !o) { await nextTick(); riffleAll(); syncLedger(); fitTop() } })
onMounted(lateFaceFonts)
onUpdated(lateFaceFonts)
// 1.3.0: a landing card given after mount lands when it shows
watch(() => props.landing, async () => { if (ready.value) { await nextTick(); tryLand() } })
onBeforeUnmount(() => {
  if (mq && mq.removeEventListener) mq.removeEventListener('change', onLap)
  if (ro) ro.disconnect()
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('pointerdown', onDocDown, true)
  document.removeEventListener('keydown', onDocKey)
  if (vv) { vv.removeEventListener('resize', lift); vv.removeEventListener('scroll', lift) }
  clearTimeout(rT)
  if (stopPrint) { stopPrint(); stopPrint = null }
})
watch(() => props.print, () => { if (ready.value) runPrint() }, { deep: true })

// ── The deal: the held cells on screen slide in from the right in number order (ttDeal's
// schedule); a tap, a key or a scroll settles it at once. The host calls it; reduced motion deals none.
const DEAL_EASE = 'cubic-bezier(.2,0,0,1)'
const DEAL_EVENTS = ['pointerdown', 'wheel', 'touchmove', 'keydown']
let dealRun = []
function settleDeal() {
  const run = dealRun
  dealRun = []
  for (const ev of DEAL_EVENTS) document.removeEventListener(ev, settleDeal, true)
  window.removeEventListener('scroll', settleDeal)
  for (const a of run) { try { a.finish() } catch { /* done */ } }
}
function deal(o = {}) {
  settleDeal()
  const g = groupsEl.value
  if (!g) return []
  const vh = window.innerHeight || 0
  const cells = Array.from(g.querySelectorAll('.tt-grid > .tt-cell[data-held="true"], .tt-grid > .tt-nest')).filter(el => {
    const r = el.getBoundingClientRect()
    return r.width && r.bottom > 0 && r.top < vh
  })
  const byId = new Map([...T.cards, ...T.nestCards].map(c => [c.id, c]))
  const plan = ttDeal(cells.map((el, i) => ({ id: i, number: (byId.get(idOf(el)) || {}).number })), { ms: o.ms, each: o.each, reduced: reduced() })
  for (const s of plan) {
    dealRun.push(cells[s.id].animate([{ transform: 'translateX(140%)' }, { transform: 'none' }], { duration: s.duration, delay: s.delay, easing: o.ease || DEAL_EASE, fill: 'backwards' }))
  }
  if (dealRun.length) {
    for (const ev of DEAL_EVENTS) document.addEventListener(ev, settleDeal, true)
    window.addEventListener('scroll', settleDeal, { passive: true })
  }
  return plan.map(s => ({ ...s, id: idOf(cells[s.id]) }))
}
onBeforeUnmount(settleDeal)

defineExpose({ t, T, change, openCard, deal, openNest, closeNest, over, pop: closeOver })
</script>

<style src="../css/cardroom.css"></style>
