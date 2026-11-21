<template>
  <div
    ref="root"
    :class="rootClass"
    lang="en"
    :data-face="L.face"
    :data-held="card.held === false ? 'false' : 'true'"
    :data-foil="L.foil ? 'true' : 'false'"
    :data-id="cardId"
    :data-print="pr ? '' : undefined"
    :data-mark="t.tmark ? '' : undefined"
    :data-ac="wl ? '' : undefined"
    :style="vars"
  >
    <span class="ttf-card">
      <!-- Front, Treehopper print (cards.css .th-card, SpeciesCard.vue, BinderTile.vue) -->
      <span v-if="own" class="ttf-face">
        <component :is="own" :card="card" :side="isBack ? 'back' : 'front'" :data="data" :labels="labels" :look="L">
          <template v-for="name in slotNames" :key="name" #[name]="p"><slot :name="name" v-bind="p || {}" /></template>
        </component>
      </span>
      <span v-else-if="!isBack && L.base === 'treehopper'" class="ttf-face">
        <span class="ttf-art">
          <img v-if="L.photo" class="ttf-img" :src="card.img" :alt="L.name" loading="lazy" decoding="async" draggable="false" @error="noimg = true">
          <span v-if="t.sub && (!L.photo || noimg)" class="ttf-latin">{{ t.sub }}</span>
          <span class="ttf-chip">{{ L.short }} · {{ t.thType }}</span>
          <span v-if="t.rarity" class="ttf-rar">{{ t.rarity }}</span>
          <span class="ttf-mark" aria-hidden="true"><svg class="ttf-ic" viewBox="0 0 24 24" aria-hidden="true" v-html="t.tmark ? TT_ICON['tree-mark'] : TT_ICON.tree" /></span>
          <span v-if="t.credit && L.photo" class="ttf-credit"><b v-for="m in (t.creditMark ? [t.creditMark] : [])" :key="m">{{ m }}</b>{{ t.creditMark ? ' ' + t.credit : t.credit }}</span>
          <span v-if="t.stamp" class="ttf-stamp" :data-no="t.stamp.n" :data-spot="t.stamp.spot ? '' : undefined"><b v-for="s in (t.stamp.no || t.stamp.spot ? [t.stamp.no || t.stamp.spot] : [])" :key="s" class="ttf-stamp-n">{{ s }}</b><small v-if="t.stamp.date" class="ttf-stamp-d">{{ t.stamp.date }}</small></span>
          <slot name="art" />
        </span>
        <span class="ttf-plate">
          <span v-if="t.rarity" class="ttf-type" :data-pips="t.pips">{{ t.rarity }}</span>
          <span v-for="m in (t.tmark ? [t.tmark] : [])" :key="m" class="ttf-tcode">{{ m }}</span>
          <span class="ttf-title">{{ L.name }}</span>
          <span v-if="t.sub" class="ttf-sub">{{ t.sub }}</span>
          <span v-for="r in (t.retired ? [t.retired] : [])" :key="r" class="ttf-retired">{{ r }}</span>
        </span>
        <span v-if="t.cells.length" class="ttf-fact" data-cells=""><span v-for="(f, i) in t.cells" :key="i" class="ttf-fact-c">{{ f }}</span></span>
        <span v-else-if="t.fact" class="ttf-fact">{{ t.fact }}</span>
        <span v-for="f in furn" :key="f.key" class="ttf-furn"><b v-if="f.no" class="ttf-furn-no">{{ f.no }}</b><svg v-if="f.rm" class="ttf-furn-rm" viewBox="0 0 10 10" aria-hidden="true" v-html="f.rm" /><span class="ttf-furn-cr">{{ f.cr }}</span><span v-if="f.cp" class="ttf-furn-cp">{{ f.cp }}</span></span>
      </span>

      <!-- Front, Studio (K1, 1.4.0): Placecard's board card (v2/kit/parts/k_card.py card_front), in board units -->
      <span v-else-if="!isBack && L.base === 'studio'" class="ttf-face">
        <span class="ttf-art">
          <img v-if="L.photo" class="ttf-img" :src="card.img" :alt="L.name" loading="lazy" decoding="async" draggable="false" @error="noimg = true">
          <span class="ttf-chip">{{ pc.chip }}</span>
          <span v-if="pc.credit && L.photo" class="ttf-credit">{{ pc.credit }}</span>
          <svg v-if="t.held" class="ttf-pc-stamp" viewBox="0 0 88 66" role="img" :aria-label="pc.stampLabel">
            <rect width="88" height="66" :fill="PC.stock" />
            <g fill="none" :stroke="PC.strike">
              <rect x="2.2" y="2.2" width="83.6" height="61.6" stroke-width="1.6" />
              <rect x="4.6" y="4.6" width="78.8" height="56.8" stroke-width=".7" />
              <path d="M4.6 15.5H83.4M27 15.5V40M4.6 40H83.4" stroke-width=".7" />
              <path v-if="pc.place" d="M20 61H80" stroke-width=".5" stroke-dasharray="1 1.2" />
            </g>
            <g :fill="PC.strike">
              <text class="ttf-pc-j" x="44" y="12.2" font-size="5.2" font-weight="700" letter-spacing=".62" text-anchor="middle">{{ pc.stampHead }}</text>
              <text class="ttf-pc-b" x="15.8" y="33" font-size="12" font-weight="800" text-anchor="middle">{{ pc.noWord }}</text>
              <text class="ttf-pc-b" x="30" y="36.6" font-size="22" font-weight="900">{{ pc.find }}</text>
              <text class="ttf-pc-b" x="8" y="50.6" font-size="9.6" font-weight="800">{{ pc.date }}</text>
              <template v-if="pc.place">
                <text class="ttf-pc-j" x="8" y="59.4" font-size="5.4" font-weight="600" letter-spacing=".54">{{ pc.per }}</text>
                <text class="ttf-pc-j" x="22" y="59.4" font-size="6.2" font-weight="700" letter-spacing=".74">{{ pc.place }}</text>
              </template>
            </g>
          </svg>
          <svg v-else class="ttf-pc-stamp" data-spot="" viewBox="0 0 88 66" role="img" :aria-label="pc.spotLabel">
            <rect width="88" height="66" :fill="PC.night" />
            <rect x="2.6" y="2.6" width="82.8" height="60.8" fill="none" :stroke="PC.stock" stroke-width="1.1" stroke-dasharray="3.2 2.4" />
            <g class="ttf-pc-fields">
              <text class="ttf-pc-j" x="8" y="14" font-size="6" font-weight="600" letter-spacing=".96" :fill="PC.steel">{{ pc.noWord }}</text>
              <path d="M19 14.6H80" :stroke="PC.steel" stroke-width=".5" stroke-dasharray="1 1.2" />
              <text v-if="pc.dist" class="ttf-pc-b" x="44" y="45" font-size="25" font-weight="900" text-anchor="middle" :fill="PC.stock">{{ pc.dist }}</text>
              <text v-if="pc.dist" class="ttf-pc-j" x="45" y="56.5" font-size="5.8" font-weight="600" letter-spacing="1.74" text-anchor="middle" :fill="PC.stock">{{ pc.toGo }}</text>
            </g>
            <g v-if="pc.dist" class="ttf-pc-bare">
              <text class="ttf-pc-b" x="44" y="42" font-size="27" font-weight="900" text-anchor="middle" :fill="PC.stock">{{ pc.dist }}</text>
              <text class="ttf-pc-j" x="45" y="56" font-size="8.4" font-weight="700" letter-spacing="1.85" text-anchor="middle" :fill="PC.stock">{{ pc.toGo }}</text>
            </g>
          </svg>
          <slot name="art" />
        </span>
        <span class="ttf-pc-wl" aria-hidden="true" />
        <span class="ttf-plate">
          <span class="ttf-title">{{ L.name }}</span>
          <span v-for="v in pc.tiers" :key="v.id" class="ttf-pc-nm" :data-tier="v.id" aria-hidden="true">
            <svg :viewBox="v.vb"><text v-if="pc.nm.lead" class="ttf-pc-j" :x="v.x + 1" :y="v.leadBase" :font-size="v.leadSize" font-weight="700" :letter-spacing="v.leadTrack">{{ pc.nm.lead }}</text><text v-for="(ln, i) in v.lines" :key="i" class="ttf-pc-b" :x="v.x" :y="ln.base" :font-size="ln.size" font-weight="900" :textLength="ln.tl" :lengthAdjust="ln.adj">{{ ln.text }}</text></svg>
            <span v-for="w in (t.held && v.wedge ? [v.wedge] : [])" :key="w" class="ttf-pc-lit" :style="{ clipPath: w }"><svg :viewBox="v.vb"><text v-if="pc.nm.lead" class="ttf-pc-j" :x="v.x + 1" :y="v.leadBase" :font-size="v.leadSize" font-weight="700" :letter-spacing="v.leadTrack">{{ pc.nm.lead }}</text><text v-for="(ln, i) in v.lines" :key="i" class="ttf-pc-b" :x="v.x" :y="ln.base" :font-size="ln.size" font-weight="900" :textLength="ln.tl" :lengthAdjust="ln.adj">{{ ln.text }}</text></svg></span>
          </span>
          <span v-if="t.sub" class="ttf-sub">{{ t.sub }}</span>
          <span v-if="t.fact" class="ttf-fact">{{ t.fact }}</span>
        </span>
        <span v-for="f in furn" :key="f.key" class="ttf-furn"><b v-if="f.no" class="ttf-furn-no">{{ f.no }}</b><span v-if="pc.footCredit" class="ttf-furn-cr">{{ pc.footCredit }}</span><span v-if="f.cp" class="ttf-furn-cp">{{ f.cp }}</span><span class="ttf-pc-line"><a v-for="h in pc.appLinks" :key="h" class="ttf-pc-app" :href="h" target="_blank" rel="noopener">{{ pc.appWord }}</a>{{ pc.appLinks.length ? '' : pc.appWord }}<span v-if="pc.site" class="ttf-pc-site"> · {{ pc.site }}</span></span></span>
      </span>

      <!-- Front, C20 without a photograph: the typographic face (LLStopCard.vue:36-40) -->
      <span v-else-if="!isBack && !L.photo" class="ttf-face">
        <span class="ttf-art is-typo">
          <span class="ttf-chip">{{ L.short }}<template v-if="t.no"> · <span class="ttf-no">{{ t.no }}</span></template></span>
          <span class="ttf-mark" aria-hidden="true"><template v-if="t.no">{{ t.mark }}</template><svg v-else class="ttf-ic" viewBox="0 0 24 24" aria-hidden="true" v-html="TT_ICON['map-pin']" /></span>
          <span class="ttf-typo-in">
            <span v-if="t.type" class="ttf-typo-type">{{ t.type }}</span>
            <span class="ttf-typo-name">{{ L.name }}</span>
            <span v-if="t.fact" class="ttf-typo-fact">{{ t.fact }}</span>
          </span>
          <slot name="art" />
        </span>
        <span class="ttf-grain" aria-hidden="true" />
      </span>

      <!-- Front, C20 stop or destination with a photograph (LLStopCard.vue front) -->
      <span v-else-if="!isBack" class="ttf-face">
        <span class="ttf-art">
          <img class="ttf-img" :src="card.img" :alt="L.name" loading="lazy" decoding="async" draggable="false" @error="noimg = true">
          <span class="ttf-chip">{{ L.short }}<template v-if="t.no"> · <span class="ttf-no">{{ t.no }}</span></template></span>
          <span class="ttf-mark" aria-hidden="true"><template v-if="t.no">{{ t.mark }}</template><svg v-else class="ttf-ic" viewBox="0 0 24 24" aria-hidden="true" v-html="TT_ICON['map-pin']" /></span>
          <span v-if="t.credit" class="ttf-credit">Photo · {{ t.credit }}</span>
          <slot name="art" />
        </span>
        <span class="ttf-plate">
          <span class="ttf-typerow"><span class="ttf-type">{{ t.type }}</span><span v-if="L.foil" class="ttf-legend"><svg viewBox="0 0 16 16" aria-hidden="true" v-html="TT_KEYSTONE" />{{ t.legend }}</span></span>
          <span class="ttf-title">{{ L.name }}</span>
          <span v-if="t.fact" class="ttf-fact">{{ t.fact }}</span>
        </span>
        <span v-for="f in furn" :key="f.key" class="ttf-furn"><b v-if="f.no" class="ttf-furn-no">{{ f.no }}</b><svg v-if="f.rm" class="ttf-furn-rm" viewBox="0 0 10 10" aria-hidden="true" v-html="f.rm" /><span class="ttf-furn-cr">{{ f.cr }}</span><span v-if="f.cp" class="ttf-furn-cp">{{ f.cp }}</span></span>
        <span class="ttf-grain" aria-hidden="true" />
      </span>

      <!-- Back, Studio (K1, 1.4.0): the board's back (k_card.py card_back); a card not yet collected is the locked back (H155) -->
      <span v-else-if="L.base === 'studio'" class="ttf-face">
        <span class="ttf-pc-head">
          <span class="ttf-chip">{{ pc.chip }}</span>
          <span class="ttf-bk-title">{{ L.name }}</span>
          <span class="ttf-pc-nm" aria-hidden="true"><svg :viewBox="pc.nm.back.vb"><text v-if="pc.nm.lead" class="ttf-pc-j" :x="pc.nm.back.x + 1" :y="pc.nm.back.leadBase" :font-size="pc.nm.back.leadSize" font-weight="700" :letter-spacing="pc.nm.back.leadTrack">{{ pc.nm.lead }}</text><text v-for="(ln, i) in pc.nm.back.lines" :key="i" class="ttf-pc-b" :x="pc.nm.back.x" :y="ln.base" :font-size="ln.size" font-weight="900" :textLength="ln.tl" :lengthAdjust="ln.adj">{{ ln.text }}</text></svg></span>
          <span v-if="t.sub" class="ttf-bk-sub">{{ t.sub }}</span>
          <span v-for="x in ($slots.head ? [1] : [])" :key="x" class="ttf-bk-act"><slot name="head" :card="card" /></span>
        </span>
        <span ref="bodyEl" class="ttf-bk-body" :class="fadeCls" @scroll.passive="onBodyScroll">
          <span v-if="t.held" class="ttf-pc-find"><span class="ttf-pc-k">{{ pc.foundWord }}</span><b class="ttf-pc-date">{{ pc.date }}</b><b v-if="pc.find !== ''" class="ttf-pc-no">{{ pc.noWord }} {{ pc.find }}</b></span>
          <span v-else class="ttf-pc-find is-not"><span class="ttf-pc-k">{{ pc.notFoundWord }}</span><span class="ttf-pc-dash" aria-hidden="true" /></span>
          <span class="ttf-pc-app">{{ pc.app }}</span>
          <span v-if="t.stats.length" class="ttf-bk-stats">
            <span v-for="(s, i) in t.stats" :key="i" class="ttf-cell"><span class="ttf-cell-k">{{ s.k }}</span><span v-if="t.held" class="ttf-cell-v">{{ s.v }}</span><span v-else class="ttf-cell-v"><span class="ttf-pc-bar" :style="{ '--pc-w': pc.cqi(pc.vbar(s.v)) }" /></span></span>
          </span>
          <span v-if="t.text && t.held" class="ttf-bk-text">{{ t.text }}</span>
          <span v-else-if="t.text || !t.held" class="ttf-pc-locked">
            <span v-for="(w, i) in pc.bars" :key="i" class="ttf-pc-bar" :style="{ '--pc-w': pc.cqi(w) }" />
            <span class="ttf-pc-lock"><svg class="ttf-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg><span class="ttf-pc-k">{{ pc.lockWord }}</span><span v-if="pc.dist" class="ttf-pc-away"><b>{{ pc.dist }}</b> {{ pc.awayWord }}</span></span>
          </span>
          <span v-if="pc.credit" class="ttf-bk-credit">{{ pc.credit }}</span>
          <span v-if="pc.inset || $slots.inset" class="ttf-pc-inset">
            <span class="ttf-pc-map"><slot name="inset" :card="card"><img v-if="pc.inset && pc.inset.img" class="ttf-img" :src="pc.inset.img" alt="" loading="lazy" decoding="async" draggable="false"></slot></span>
            <span v-if="pc.inset && pc.inset.caption" class="ttf-pc-cap">{{ pc.inset.caption }}</span>
          </span>
          <slot name="more" :card="card" />
        </span>
        <span v-for="x in ($slots.foot ? [1] : [])" :key="x" class="ttf-bk-foot"><slot name="foot" :card="card" /></span>
        <span class="ttf-pc-foot">
          <b v-if="pc.collector" class="ttf-furn-no">{{ pc.collector }}</b>
          <span v-if="copyright" class="ttf-furn-cp">{{ copyright }}</span>
          <span class="ttf-pc-punch" :data-on="t.held ? '' : undefined">{{ pc.punchWord }}</span>
        </span>
      </span>

      <!-- Back (LLStopCardBack.vue; Treehopper SpeciesCard back) -->
      <span v-else class="ttf-face">
        <span class="ttf-bk-head">
          <span v-if="t.bkHead == null" class="ttf-bk-set">{{ L.short }}<template v-if="t.no"> · <span class="ttf-no">{{ t.no }}<template v-if="L.of">{{ ` ${ofWord} ${L.of}` }}</template></span></template></span>
          <span v-else-if="t.bkHead" class="ttf-bk-set">{{ t.bkHead }}</span>
          <span class="ttf-bk-title">{{ L.name }}</span>
          <span v-if="t.bkSub" class="ttf-bk-sub">{{ t.bkSub }}</span>
          <span v-for="x in ($slots.head ? [1] : [])" :key="x" class="ttf-bk-act"><slot name="head" :card="card" /></span>
        </span>
        <span ref="bodyEl" class="ttf-bk-body" :class="fadeCls" @scroll.passive="onBodyScroll">
          <span v-if="t.count && card.rarity" class="ttf-bk-rar"><span class="ttf-rchip">{{ t.rarity }}</span><span class="ttf-inl">{{ t.count }}</span></span>
          <span v-if="t.stats.length" class="ttf-bk-stats" :style="{ '--n': t.stats.length }">
            <span v-for="(s, i) in t.stats" :key="i" class="ttf-cell"><span class="ttf-cell-k"><svg v-if="!t.th" class="ttf-ic" viewBox="0 0 24 24" aria-hidden="true" v-html="TT_ICON[s.icon]" /><span class="ttf-inl">{{ s.k }}</span></span><span class="ttf-cell-v">{{ s.v }}</span></span>
          </span>
          <template v-if="t.text">
            <span v-if="t.th" class="ttf-bk-story"><span v-if="storyWord" class="ttf-bk-h4">{{ storyWord }}</span><span class="ttf-bk-text">{{ t.text }}</span></span>
            <span v-else-if="L.base === 'destination'" class="ttf-bk-text"><span class="ttf-lead"><svg class="ttf-ic" viewBox="0 0 24 24" aria-hidden="true" v-html="TT_ICON.info" />About</span>{{ t.text }}</span>
            <span v-else class="ttf-bk-text"><span class="ttf-lead"><svg class="ttf-ic" viewBox="0 0 24 24" aria-hidden="true" v-html="TT_ICON.lightbulb" /></span>{{ t.text }}</span>
          </template>
          <span v-if="t.gotLine && t.held" class="ttf-bk-got"><span class="ttf-dot" aria-hidden="true" /><span class="ttf-inl">{{ t.got }}</span></span>
          <span v-else-if="t.gotLine" class="ttf-bk-got is-not"><span class="ttf-dot" aria-hidden="true" /><span class="ttf-inl">Not collected</span></span>
          <span v-if="t.credit" class="ttf-bk-credit"><b v-for="w in (t.photoWord ? [t.photoWord] : [])" :key="w">{{ w }}</b>{{ t.photoWord ? ' · ' + t.credit : t.credit }}</span>
          <slot name="more" :card="card" />
        </span>
        <span v-for="x in ($slots.foot ? [1] : [])" :key="x" class="ttf-bk-foot"><slot name="foot" :card="card" /></span>
      </span>

      <span v-if="L.foil" class="ttf-shine" aria-hidden="true" />
    </span>
  </div>
</template>

<script setup>
/**
 * One card face, front or back, for the tabletop (2026-10-23). A faithful Vue port of the design
 * lab's approved faces: the same DOM, classes and CSS, so the three skins (Treehopper print,
 * VeryThere C20 stop, Provo destination with its typographic fallback) look the same here as in
 * the lab.
 *
 * Props: `card` (the tabletop card shape; NYID's utils/tabletop/adapters.js builds it), `side`
 * ('front' | 'back'), `data` ({ sets, rarities }: the face reads the set's short word, total and
 * trek), `fonts` (false when the table loads TT_FACE_FONTS itself).
 *
 * Sizing: the face fills its parent's width at 8:15 and scales by container queries from about
 * 56 px to 560 px; give the parent a definite width (a grid track or `width: var(--card-w)`).
 * No outer shadow, no hover: the table adds its own on the root or the slot.
 * Missing: `data-held="false"` on the root, drawn exactly like a held card (never grey).
 * Slot `art`: drawn inside the front's art box (the table's WANTED stub sits there, as in the lab).
 * Slot `more` ({ card }): drawn last in the back's body, inside its scroll, so the card's size
 * holds however long it runs; Treehopper's photos of the species' trees.
 * Print: a face option any face can take (core ttPrintOn: card.print, else the
 * face entry's, else on for the Treehopper face and the Placecard app). On, the root carries data-print and
 * takes the cardstock below (cut edge, matte, grain, the light), and a front's foot prints the furniture
 * (ttFurniture: collector number or mark, rarity glyph, credit, prop `copyright`). Off, the markup is as before.
 * 1.1.0: a Treehopper front with `card.retired === true` prints `labels.retired` ("Retired") in its plate:
 * under the latin on the open card, at the plate's foot on the tile. Any other card gains no node.
 * 1.2.0, Treehopper's additions. Each is opt-in or Treehopper's CSS: unset, every face's markup is 1.1.0's.
 *   Card fields, read on a Treehopper face only: `backHead` (the back's head line in place of the set's word and
 *   number, "Tree N · Borough"; '' prints none), `backSub` (the back's second line in place of the latin; '' leaves it
 *   off), `collectedLine: false` (no Collected line), `factCells` ([a, b]: the front's fact as two cells), `spot` (a
 *   missing card's distance, printed in the stamp's place as the empty spot), `dateStamp: true` (a held card with no
 *   number stamps its first-find date alone, core ttStamp), `creditAsGiven: true` (the credit as given, below).
 *   Labels: `speciesPhoto` (the art credit's mark when the card names none, "Species photo"), `photo` (the back
 *   credit's word, "Photo"), and `story` (the back's story heading, "Species story"); an empty label prints none, so
 *   `speciesPhoto: ''` leaves the art's credit unmarked where a card names no `creditMark`. With `creditAsGiven: true`
 *   a Treehopper face prints its credit as given (no stripping of "Photo:"); the print foot wraps a long credit.
 *   Slots, both on the back only: `head` ({ card }) at the end of the back's head, beside the name (How it works'
 *   Front button); `foot` ({ card }) after the body, outside its scroll, so the card's size holds.
 *   A back for a card outside a set: `backHead: ''`, `collectedLine: false`, and the `head` and `foot` slots.
 *   CSS: the Treehopper back in Young Serif over Archivo at the design board's sizes, no auto margin over its
 *   credit, the print foot at 8 px in the second ink.
 * 1.3.0, card field `backFade: true`, read on any face: the back's text area takes no scrollbar, fades at its
 * lower edge while more is below (`is-more`), and keeps its top padding clear once scrolled (`is-scrolled`), as the
 * design board's back. The state follows the body's scroll and its size (photos in the `more` slot). Unset, the body's
 * markup is 1.2.0's and nothing is observed.
 * 1.4.0, the Studio face (`face: 'studio'`): Placecard's design board card, drawn in board units (300 wide, a unit
 * a third of a cqi), its palette literal (the Greenhouse look). Tiers as the board's: full from 240 px, mid 150 to
 * 239, small under 150. Root class `ttf-pc`, theme `pc`. No rarity on the plate or in the foot, no gold and no foil
 * (gold is the top rarity's alone); print on by default.
 * A card not yet collected stays full color, with the dashed spot on its front and the locked back: the stat
 * values and the story are rule bars (core ttLockValue, ttLockBars) under the lock with the distance, and no word of
 * either reaches the page. The name is fitted as the board fits it (core ttStudioName), floodlit once collected.
 *   Card fields, read on a Studio face only: `find` (the stamp's find number), `place` (the stamp's PER line), `spot`
 *   (the distance, printed in the spot and the lock), `inset` ({ img, caption }, the back's street inset), `collector`
 *   ({ n, of }, the back's foot). The chip prints the set's word and, when the set names a trek, the stop's number.
 *   1.5.0: `accent` ('#rgb' or '#rrggbb', as ttHex reads it) colors the front's waterline in place of
 *   Cornflower, lightened toward the Stock until it holds 3:1 on the plate's Night (core ttStudioAccent); the root
 *   takes `data-ac` and the `wl` custom property. A name, or none, keeps Cornflower and 1.4.0's markup. The chip's mark stays green.
 *   Labels, each with its default: `stampHead` ("Placecard · Collected"), `per` ("Per"), `toGo` ("To go"),
 *   `firstFound` ("First found"), `notYetFound` ("Not yet found"), `goThere` ("Go there to turn it over"), `away`
 *   ("Away"), `punched` ("Punched on site"); `no` and `photo` as on the other faces.
 *   Slot `inset` ({ card }): the back's street inset, drawn by the host in place of `inset.img` (a live map).
 *   Fonts: TT_PC_FONTS (Big Shoulders, Jost) as a third head entry (key tt-pc-fonts) where a Studio card renders.
 * Foil: call the exposed `sweep()` to run the one 900 ms sweep (a class added from outside would be
 * dropped on the next render, as Vue owns the root's class).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, onUpdated, ref, useSlots, watch } from 'vue'
import {
  TT_FACE_FONTS, TT_ICON, TT_KEYSTONE, TT_PC_FONTS, TT_TH_FONTS, ttClean, ttCollector, ttFaceClass, ttFaceCredit, ttFmtDate,
  ttLockBars, ttLockValue, ttLook, ttFaceBase, ttFaceComponent, ttFaceOf, ttFurniture, ttNumberLabel, ttPad2, ttPips, ttPrintOn,
  ttStamp, ttStampDateLong, ttStatIcon, ttStudioName,
} from '../core/face.js'
import { ttHead } from './host.js'

const props = defineProps({
  card: { type: Object, required: true },
  side: { type: String, default: 'front' },
  data: { type: Object, default: null },
  fonts: { type: Boolean, default: true },
  // The print foot's copyright line (TtTable labels.copyright; empty unset)
  copyright: { type: String, default: '' },
  // 1.1.0: the face's words, a table's labels as they are: no ("No."), of ("of"), retired ("Retired"); unset, today's words
  labels: { type: Object, default: () => ({}) },
  // 1.6.0: the Studio foot's app name is a link to the app's site. TtStage turns it on for the open card; on the
  // table the cell's own button covers the face, so the name stays text there
  appLink: { type: Boolean, default: false },
})

// 1.6.0: the app's site as the foot prints it (no scheme, no closing slash), and as a link (http or https only; a
// bare host takes https)
const siteWord = s => String(s || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')
function siteHref(s) {
  const w = String(s || '').trim()
  if (!w) return null
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(w) ? w : 'https://' + w)
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password ? u.href : null
  } catch { return null }
}

// The face fonts load only on a page that renders a face; the key makes every face share one tag.
// The host loads them (host.js); the kit adds no tag itself.
if (props.fonts) ttHead({ link: [{ key: 'tt-face-fonts', rel: 'stylesheet', href: TT_FACE_FONTS }] })
// A Treehopper card also loads its front's fonts (Young Serif, Archivo by width), as a second entry
// 1.6.0: and so does a host's face the Treehopper face draws (its base); the Studio's fonts likewise below
const faceBase = props.card ? ttFaceBase(ttFaceOf(props.card, props.data), props.data) : null
if (props.fonts && faceBase === 'treehopper') ttHead({ link: [{ key: 'tt-th-fonts', rel: 'stylesheet', href: TT_TH_FONTS }] })
// 1.4.0: a Studio card loads Big Shoulders and Jost (TT_PC_FONTS), as a third entry
if (props.fonts && faceBase === 'studio') ttHead({ link: [{ key: 'tt-pc-fonts', rel: 'stylesheet', href: TT_PC_FONTS }] })

const root = ref(null)
const noimg = ref(false)
const sweeping = ref(false)
watch(() => props.card && props.card.img, () => { noimg.value = false })

const isBack = computed(() => props.side === 'back')
const L = computed(() => ttLook(props.card, props.data || {}))
// 1.6.0 (the open kit): the template's first branch draws the host's own face on both sides, inside the kit's card.
// It carries no comment of its own and sits under the Treehopper front's, because a development build prints the
// template's comments and every golden holds them. The host's component for this card's face (core ttFaceComponent), or null: a kit face, or a
// host's face based on one, draws below. The component gets card, side, data, labels and look (ttLook), and each slot
// the face was given (art, head, foot, more) under the same name.
const own = computed(() => ttFaceComponent(L.value.face, props.data || {}))
const slots = useSlots()
const slotNames = computed(() => Object.keys(slots))
const cardId = computed(() => (props.card.id != null ? String(props.card.id) : undefined))
const rootClass = computed(() => ttFaceClass(L.value, isBack.value ? 'back' : 'front', noimg.value) + (sweeping.value ? ' ttf-sweep' : ''))
// Print, and the foot as a list of none or one (a v-for leaves no comment node when empty)
const pr = computed(() => ttPrintOn(props.card, props.data || {}))
const furn = computed(() => {
  if (!pr.value || isBack.value) return []
  const f = ttFurniture(props.card, props.data || {}, props.copyright)
  return f ? [{ key: 'furn', ...f }] : []
})
const ofWord = computed(() => (props.labels && props.labels.of != null ? props.labels.of : 'of'))
// 1.1.0: a retired type's mark on the Treehopper front; an empty word prints none
const retiredWord = computed(() => (props.labels && props.labels.retired != null ? props.labels.retired : 'Retired'))
// 1.5.0: a Studio front draws card.accent on its waterline (core ttStudioAccent, 3:1 on the plate's Night):
// the root takes data-ac and the wl custom property. Unset, or a color ttHex refuses, neither is written and the markup is 1.4.0's.
const wl = computed(() => (isBack.value ? null : L.value.wl))
const vars = computed(() => {
  const v = { '--ac': L.value.ac, '--dp': L.value.dp, '--lw': L.value.fit.lw, '--tl': L.value.fit.tl }
  if (wl.value) v['--wl'] = wl.value
  return v
})
// A face word from labels, else its default (an empty label is kept: it prints none)
const word = (k, d) => (props.labels && props.labels[k] != null ? props.labels[k] : d)
// 1.2.0: a Treehopper back's story heading, labels.story ("Species story"); empty, no heading
const storyWord = computed(() => word('story', 'Species story'))

// Every text the template prints, cleaned once (no em or en dash reaches a face)
const t = computed(() => {
  const c = props.card
  const th = L.value.base === 'treehopper'
  const no = ttNumberLabel(c.number, props.labels)
  const date = ttFmtDate(c.collected)
  return {
    th,
    no,
    mark: no ? ttPad2(Number(c.number)) : '',
    rarity: ttClean(c.rarity),
    thType: ttClean(c.type) || 'Species',
    type: ttClean(c.type || c.subtitle),
    legend: ttClean(c.rarity) || 'Legendary',
    sub: ttClean(c.subtitle),
    // A Treehopper tree card's own mark ("Tree <id>"), printed on its tile; NYID's faces have none
    tmark: th ? ttClean(c.mark) : '',
    // card.retired === true only (the host's flag; it marks a retired type, so a tree card never carries it)
    retired: th && c.retired === true ? ttClean(retiredWord.value) : '',
    // 1.2.0: a Treehopper back's own head line (card.backHead; '' prints none) and second line (card.backSub, in
    // place of the latin; '' leaves the latin off). Unset, the set's word and number and the latin, as before
    bkHead: th && c.backHead != null ? ttClean(c.backHead) : null,
    bkSub: th ? ttClean(c.backSub != null ? c.backSub : c.subtitle) : '',
    // card.collectedLine === false drops a Treehopper back's Collected or Not collected line
    gotLine: !(th && c.collectedLine === false),
    fact: ttClean(c.fact),
    // A Treehopper front's fact as two cells (card.factCells); unset, the one fact line
    cells: th && Array.isArray(c.factCells) ? c.factCells.map(ttClean).filter(Boolean).slice(0, 2) : [],
    // As given on a Treehopper face with card.creditAsGiven true, else without a leading "Photo:" (ttFaceCredit)
    credit: ttFaceCredit(c, props.data),
    // Treehopper's front: the credit's mark ("Genus", "Parent species"), the stamp, the pips. A card
    // with no creditMark takes labels.speciesPhoto ("Species photo"), which the host may empty for no mark
    creditMark: ttClean(c.creditMark) || ttClean(word('speciesPhoto', 'Species photo')),
    // The back credit's word, labels.photo ("Photo"); empty, the credit stands alone
    photoWord: ttClean(word('photo', 'Photo')),
    stamp: th ? ttStamp(c, props.labels) : null,
    pips: th ? ttPips(c.rarity) : null,
    count: ttClean(c.rarityCount),
    stats: (Array.isArray(c.stats) ? c.stats : []).filter(s => s && s.k && s.v).slice(0, 3)
      .map(s => { const k = ttClean(s.k); return { k, v: ttClean(s.v), icon: ttStatIcon(k) } }),
    text: ttClean(c.back),
    held: c.held !== false,
    got: 'Collected' + (date ? ' ' + date : ''),
  }
})

// 1.4.0: the Studio face. Its palette is literal (the design board's Greenhouse inks):
// Night (the plate, the key ink), Stock (the card), the strike (the stamp, coral as small text), Steel (quiet text on
// the plate). Everything here is computed only for a Studio card.
const PC = Object.freeze({ night: '#12261C', stock: '#FFFDF6', strike: '#C8361F', steel: '#A9B9AF' })
const up = v => ttClean(v).toUpperCase()
const pcCqi = u => +(u / 3).toFixed(3) + 'cqi'
const pc = computed(() => {
  if (L.value.base !== 'studio') return null
  const c = props.card
  const nm = ttStudioName(c.title)
  const set = L.value.set
  // the chip: the set's word and, on a Trek (its set names one), the stop's number
  const stop = set && set.trek != null && set.trek !== '' ? ttNumberLabel(c.number, props.labels) : ''
  const tier = (id) => {
    const v = nm[id]
    const h = v.bb - v.by
    // the floodlight (full and mid): a wedge of Stock across the name's zone, low left to high right
    const top = +((v.zt - v.by) / h * 100).toFixed(2)
    const bot = +((v.zb - v.by) / h * 100).toFixed(2)
    return { id, ...v, leadTrack: +(v.leadSize * 0.42).toFixed(2), wedge: id === 'small' ? null : `polygon(0 ${bot}%, 100% ${top}%, 100% ${bot}%)` }
  }
  nm.back = { ...nm.back, leadTrack: +(nm.back.leadSize * 0.42).toFixed(2) }
  const find = c.find == null || c.find === '' || !Number.isFinite(Number(c.find)) ? '' : String(Number(c.find))
  const credit = ttFaceCredit(c, props.data)
  const photo = ttClean(word('photo', 'Photo'))
  const dist = up(c.spot)
  const ins = c.inset && typeof c.inset === 'object' ? { img: c.inset.img || null, caption: up(c.inset.caption) } : null
  const apps = props.data && Array.isArray(props.data.apps) ? props.data.apps : []
  const app = apps.find(a => a && a.id === c.app)
  return {
    nm,
    tiers: ['full', 'mid', 'small'].map(tier),
    // the set's word in capitals, the stop's label as given ("NEW YORK · No. 01", the board's chip)
    chip: [up(L.value.short), stop].filter(Boolean).join(' · '),
    // the print foot's credit, short: the photo word and the name before the license ("PHOTO AKASHPUTHRAYA"); the
    // whole credit is on the art's band above it
    footCredit: credit ? up([photo, credit.split(',')[0]].filter(Boolean).join(' ')) : '',
    credit: credit ? (photo ? photo + ': ' + credit : credit) : '',
    find,
    date: ttStampDateLong(c.collected),
    place: up(c.place),
    dist,
    noWord: ttClean(word('no', 'No.')),
    stampHead: up(word('stampHead', 'Placecard · Collected')),
    per: up(word('per', 'Per')),
    toGo: up(word('toGo', 'To go')),
    stampLabel: ['Collected stamp', find ? ttClean(word('no', 'No.')) + ' ' + find : '', ttStampDateLong(c.collected)].filter(Boolean).join(', '),
    spotLabel: 'Empty stamp spot' + (dist ? ', ' + ttClean(c.spot) + ' to go' : ''),
    foundWord: ttClean(word('firstFound', 'First found')),
    notFoundWord: ttClean(word('notYetFound', 'Not yet found')),
    lockWord: ttClean(word('goThere', 'Go there to turn it over')),
    awayWord: ttClean(word('away', 'Away')),
    punchWord: ttClean(word('punched', 'Punched on site')),
    app: ttClean((app && app.name) || 'Studio'),
    // the foot's second line (full) and its right end (mid): the app's word, then its site when the app entry names one
    appWord: up((app && app.name) || 'Studio'),
    site: up(app && siteWord(app.site)),
    // a list of none or one, so a card with no link renders as before
    appLinks: props.appLink && app && app.name && siteHref(app.site) ? [siteHref(app.site)] : [],
    bars: t.value.held ? [] : ttLockBars(c.back),
    vbar: ttLockValue,
    cqi: pcCqi,
    inset: ins,
    collector: ttCollector(c.collector, 3),
  }
})

// 1.3.0: the back's text area, card.backFade. More below: more than 3 px of scroll left; scrolled: past 1 px (as
// the design board's back reads them). Both start false, so the server's render and the first client render agree.
const bodyEl = ref(null)
const fadeOn = computed(() => isBack.value && !!props.card && props.card.backFade === true)
const more = ref(false)
const scrolled = ref(false)
const fadeCls = computed(() => (fadeOn.value ? { 'is-fade': true, 'is-more': more.value, 'is-scrolled': scrolled.value } : undefined))
function measureFade() {
  const el = bodyEl.value
  if (!fadeOn.value || !el) return
  more.value = el.scrollHeight - el.scrollTop - el.clientHeight > 3
  scrolled.value = el.scrollTop > 1
}
const onBodyScroll = () => { if (fadeOn.value) measureFade() }
// The body and its element children are observed (the `more` slot's photos load late); re-observed after each render
let fro = null
function observeFade() {
  if (fro) { fro.disconnect(); fro = null }
  const el = bodyEl.value
  if (!fadeOn.value || !el) { more.value = false; scrolled.value = false; return }
  if (typeof ResizeObserver !== 'undefined') {
    fro = new ResizeObserver(measureFade)
    fro.observe(el)
    for (const c of el.children) fro.observe(c)
  }
  measureFade()
}
onMounted(() => { if (fadeOn.value) observeFade() })
onUpdated(() => { if (fadeOn.value || fro) observeFade() })
watch(fadeOn, () => nextTick(observeFade))
onBeforeUnmount(() => { if (fro) { fro.disconnect(); fro = null } })

// One foil sweep (top rarity only; the CSS shows nothing on other cards). Runs again on each call.
async function sweep() {
  sweeping.value = false
  await nextTick()
  if (root.value) void root.value.offsetWidth
  sweeping.value = true
}
defineExpose({ sweep, el: root })
</script>

<style>
/* The design lab's face styles (2026-10-23), unchanged below this note. Not scoped by Vue on purpose:
   every selector already sits under a .ttf class, and the table adds .ttf states from outside.
   Ported from the two approved designs:
   - Treehopper print card: Treehopper-pincast assets/css/cards.css (.th-card, .th-plate, .th-tile),
     SpeciesCard.vue, BinderTile.vue.
   - VeryThere C20 stop card: components/likealocal/LLStopCard.vue + LLStopCardBack.vue,
     assets/css/ll-tokens.css.
   Colors are literal: cards are light printed objects and never read a table's tokens. The one exception
   is the Treehopper front (at the end of the tiers): it reads the table's --thf-* theme tokens, Light
   Original by default. Sizes are in
   cqi of the .ttf container (the card's own width), so one face scales from about 56 px (6 across a
   phone) to about 560 px (the open card).
   Tiers (container width): tiny < 90, small 90 to 150, medium 150 to 240, large 240 up. */
/* ── Root and box ─────────────────────────────────────────────────────────────── */
.ttf {
  container: ttf / inline-size;
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 8 / 15;
  box-sizing: border-box;
  text-align: left;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-optical-sizing: auto;
  text-rendering: geometricPrecision;
  -webkit-tap-highlight-color: transparent;
}
.ttf *, .ttf *::before, .ttf *::after { box-sizing: border-box; }
.ttf.ttf-front { -webkit-user-select: none; user-select: none; }
:where(.ttf) span, :where(.ttf) b { display: block; }
.ttf-no, .ttf-inl { display: inline; }
.ttf svg.ttf-ic {
  display: inline-block; width: 1em; height: 1em; flex: none; vertical-align: -.14em;
  fill: none; stroke: currentColor; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round;
}

/* Themes. pop = the retail walks (llRetailWalks.js LL_RETAIL_DEFAULTS.theme 'pop' = .ll-theme-portland:
   Bricolage Grotesque 800 over Space Grotesk, ink #0E2B1F, cream #FFF6E8, cobalt heads).
   base = Provo (llMeta.js theme null = .ll-ground-light: Archivo 900 with .1em word space over
   Helvetica, ink #1a1a1a, cream #faf8f4). th = the Treehopper print (cards.css .th-print). */
.ttf-t-pop {
  --ink: #0E2B1F; --sf: #FFF6E8; --ink75: #4A5E51; --line: rgba(14, 43, 31, .16); --head: #1F3BE0;
  --fd: 'Bricolage Grotesque', 'Arial Black', Helvetica, sans-serif; --fw: 800; --fws: normal; --fit: 138cqi;
  --ft: 'Space Grotesk', Helvetica, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.ttf-t-base {
  --ink: #1a1a1a; --sf: #faf8f4; --ink75: #525251; --line: rgba(26, 26, 26, .14); --head: #1a1a1a;
  --fd: 'Archivo', Helvetica, -apple-system, sans-serif; --fw: 900; --fws: .1em; --fit: 122cqi;
  --ft: Helvetica, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
}
.ttf-t-th {
  --ink: #332E8F; --sf: #F8F4EA; --cream: #FBF7EE; --text: #201E3F; --ink75: #6B6885;
  --line: rgba(32, 30, 63, .16); --head: #332E8F;
  --fd: 'Fraunces', Georgia, 'Times New Roman', serif; --fw: 600; --fws: normal; --fit: 150cqi;
  --ft: 'Instrument Sans', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
}
.ttf { --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

/* Type scale, large tier (240 up; the reference is the 374 px phone card). Lower tiers reset these. */
.ttf-card {
  --fr: calc(1px + 1.07cqi);              /* the frame: 5 px at 374 */
  --f-cap: calc(5px + 1.34cqi);           /* type row, chips: 10 px at 374 */
  --f-fact: calc(6px + 1.85cqi);          /* fact line: 12.9 px at 374 */
  --f-credit: calc(4.5px + 1.47cqi);      /* credit pill: 10 px at 374 */
  --f-sub: calc(5px + 2.27cqi);           /* latin: 13.5 px at 374 */
  --f-title: 8.6cqi;                      /* C20 title: 32 px at 374 */
  --f-name: 7.5cqi;                       /* Treehopper name: 28 px at 374 */
  --f-typo: 11.8cqi;                      /* typographic face: 44 px at 374 */
  --f-mark: calc(2px + 6cqi);
  --f-rar: calc(2.5px + 4.5cqi);
  --ttl: calc(min(var(--f-title) * var(--tl, 1), var(--fit) / var(--lw, 8)));
}

/* ── The card: frame and inner face ───────────────────────────────────────────── */
.ttf-card {
  position: absolute; inset: 0;
  padding: var(--fr);
  overflow: hidden;
}
.ttf-face {
  position: relative; width: 100%; height: 100%;
  overflow: hidden;
  display: flex; flex-direction: column;
  background: var(--sf);
  color: var(--ink);
  font-family: var(--ft);
}
/* 1.6.0 (the open kit): a host's own component. The kit keeps the card's box, its stock (data-print) and its foil;
   the frame's padding and the face's ground, ink and type are the component's own. */
.ttf-own .ttf-card { padding: 0; }
.ttf-own .ttf-face { background: none; color: inherit; font-family: inherit; }

/* ═══ C20: stop and destination ═══════════════════════════════════════════════════ */
.ttf-c20 .ttf-card {
  border-radius: 4.8cqi;                                    /* 18 at 374 */
  background: var(--dp);                                    /* accent-deep: 85% accent, 15% ink */
  box-shadow: inset 0 0 0 1px rgba(255, 246, 232, .3);
}
.ttf-c20[data-foil="true"] .ttf-card {
  background: linear-gradient(135deg, #B8912F, #E8CD8C 38%, #B8912F 62%, #E8CD8C);
  box-shadow: inset 0 0 0 1px var(--ac);
}
.ttf-c20 .ttf-face { border-radius: calc(3.73cqi - 1px); }  /* 13 at 374 */

/* The art: a real photograph, saturate .94 contrast 1.03, one bottom scrim */
.ttf-art {
  position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden;
}
.ttf-c20 .ttf-art { background: var(--dp); }
.ttf-img {
  position: absolute; inset: 0; width: 100%; height: 100%;
  display: block; object-fit: cover; border: 0;
}
.ttf-c20 .ttf-img { object-position: 50% 40%; filter: saturate(.94) contrast(1.03); }
.ttf-noimg .ttf-img { display: none; }
.ttf-c20 .ttf-art::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 19cqi; pointer-events: none;
  background: linear-gradient(180deg, rgba(14, 43, 31, 0), rgba(14, 43, 31, .45));
}
/* No photograph: the typographic face, a flat accent field with the name set large */
.ttf-c20 .ttf-art.is-typo {
  background-color: var(--ac);
  background-image: linear-gradient(180deg, rgba(0, 0, 0, .12) 0%, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, .24) 100%);
}
.ttf-c20 .ttf-art.is-typo::after { display: none; }

/* Chips on the art */
.ttf-chip {
  position: absolute; z-index: 2; top: 2.7cqi; left: 2.7cqi; max-width: calc(100% - 5.4cqi);
  padding: .42em .8em; border-radius: 1.07cqi;
  font: 800 var(--f-cap)/1.3 var(--ft); letter-spacing: .1em; text-transform: uppercase;
  white-space: nowrap; overflow: hidden; text-overflow: clip;
}
.ttf-c20 .ttf-chip { background: rgba(255, 246, 232, .92); color: var(--ink); }
.ttf-no { text-transform: none; letter-spacing: .02em; }
.ttf-credit {
  position: absolute; z-index: 2; left: 2.7cqi; bottom: 2.7cqi; max-width: 74%;
  padding: .2em .6em; border-radius: 1.07cqi;
  font: 500 var(--f-credit)/1.3 var(--ft);
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
  overflow-wrap: break-word;
}
.ttf-c20 .ttf-credit { background: rgba(14, 43, 31, .78); color: var(--sf); }

/* The set mark (tiny and small only): the collector number, or the app's glyph */
.ttf-mark {
  position: absolute; z-index: 3; top: 4cqi; left: 4cqi;
  display: none; min-width: 1.9em; padding: .2em .38em; border-radius: .28em;
  font: 700 var(--f-mark)/1.1 var(--mono); letter-spacing: .02em; text-align: center;
}
.ttf-c20 .ttf-mark { background: rgba(255, 246, 232, .92); color: var(--ink); }
.ttf-c20[data-foil="true"] .ttf-mark { box-shadow: inset 0 0 0 1px #B8912F; }
.ttf-mark svg.ttf-ic { width: 1.15em; height: 1.15em; vertical-align: -.2em; stroke-width: 2.5; }

/* The nameplate: accent-deep band, type row, title in the walk's display face, one fact line */
.ttf-plate { flex: 0 0 auto; min-height: 0; }
.ttf-c20 .ttf-plate {
  background: var(--dp); color: var(--sf);
  padding: 3.2cqi 3.75cqi 3.6cqi;
}
.ttf-typerow {
  display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: .2em .8em;
}
.ttf-type {
  min-width: 0; max-width: 100%;
  font: 700 var(--f-cap)/1.25 var(--ft); letter-spacing: .14em; text-transform: uppercase;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden;
}
.ttf-legend {
  display: inline-flex !important; align-items: center; gap: .4em; color: #E8CD8C;
  font: 800 var(--f-cap)/1.25 var(--ft); letter-spacing: .14em; text-transform: uppercase; white-space: nowrap;
}
.ttf-legend svg { width: 1.1em; height: 1.1em; flex: none; }
.ttf-title {
  margin-top: 1.6cqi;
  font-family: var(--fd); font-weight: var(--fw); word-spacing: var(--fws);
  font-size: var(--ttl); line-height: 1.06; letter-spacing: -.01em;
  text-wrap: balance; overflow-wrap: normal; word-break: normal; hyphens: manual;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
}
.ttf-fact {
  font: 400 var(--f-fact)/1.32 var(--ft);
  overflow-wrap: break-word;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}
.ttf-c20 .ttf-fact { margin-top: 1.6cqi; color: var(--sf); opacity: .95; }

/* Typographic face block */
.ttf-typo-in {
  position: absolute; z-index: 1; left: 0; right: 0; bottom: 0; max-height: 100%;
  padding: 4.3cqi 4.3cqi 4.8cqi;
  display: flex !important; flex-direction: column; gap: 1.6cqi;
  color: var(--sf);
}
.ttf-typo-type {
  font: 700 var(--f-cap)/1.25 var(--ft); letter-spacing: .14em; text-transform: uppercase; opacity: .95;
  display: -webkit-box !important; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden;
}
.ttf-typo-name {
  font-family: var(--fd); font-weight: var(--fw); word-spacing: var(--fws);
  font-size: calc(min(var(--f-typo) * var(--tl, 1), var(--fit) / var(--lw, 8)));
  line-height: 1.04; letter-spacing: -.01em;
  text-wrap: balance; overflow-wrap: normal; word-break: normal; hyphens: manual;
  display: -webkit-box !important; -webkit-box-orient: vertical; -webkit-line-clamp: 6; overflow: hidden;
}
.ttf-typo-fact { font: 400 var(--f-fact)/1.32 var(--ft); opacity: .95; display: -webkit-box !important; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }

/* Paper grain over the face (C20 .lsc-grain at .025) */
.ttf-grain {
  position: absolute; inset: 0; z-index: 5; pointer-events: none; opacity: .025;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ═══ Treehopper print ════════════════════════════════════════════════════════════ */
.ttf-th .ttf-card {
  border-radius: min(4px, 2.4cqi);                          /* 4 from 167 up: cardstock (was 2.4cqi) */
  background: #332E8F;
}
.ttf-th .ttf-card::before {                                 /* the keyline printed inside the frame */
  content: ''; position: absolute; inset: .54cqi; z-index: 6; pointer-events: none;
  border: 1px solid rgba(251, 247, 238, .38); border-radius: max(0px, min(4px, 2.4cqi) - .54cqi);
}
.ttf-th[data-foil="true"] .ttf-card { background: linear-gradient(135deg, #B8912F, #E8CD8C 38%, #B8912F 62%, #E8CD8C); }
.ttf-th[data-foil="true"] .ttf-card::before { border-color: rgba(60, 45, 5, .35); }
.ttf-th .ttf-face {
  border-radius: 1px;                                       /* cardstock (was 1.34cqi) */
  color: var(--text);
  background-color: #F8F4EA;
}
.ttf-th .ttf-art { background: rgba(51, 46, 143, .12); }
.ttf-th .ttf-img { filter: saturate(.96) contrast(1.03); }
.ttf-th .ttf-art::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 22cqi; pointer-events: none;
  background: linear-gradient(to top, rgba(32, 30, 63, .5), rgba(32, 30, 63, 0));
}
.ttf-th .ttf-chip {
  top: 3.2cqi; left: 3.2cqi; max-width: calc(100% - 6.4cqi);
  padding: .42em .74em; border-radius: .8cqi;
  font-weight: 600; background: rgba(251, 247, 238, .94); color: #332E8F; border: 1px solid rgba(51, 46, 143, .35);
}
/* The tile's rarity chip (BinderTile .th-tile-rar), the small tier's set mark */
.ttf-rar {
  position: absolute; z-index: 4; top: 5cqi; left: 5cqi; max-width: calc(100% - 10cqi);
  display: none; padding: .27em .67em; border-radius: .8cqi;
  font: 600 var(--f-rar)/1.2 var(--ft); letter-spacing: .08em; text-transform: uppercase; white-space: nowrap;
  background: rgba(251, 247, 238, .95); color: #332E8F; border: 1px solid rgba(51, 46, 143, .35);
  overflow: hidden;
}
.ttf-th[data-foil="true"] .ttf-rar { background: linear-gradient(135deg, #B8912F, #E8CD8C 38%, #B8912F 62%, #E8CD8C); color: #3b2d05; border-color: transparent; }
.ttf-th .ttf-mark { background: rgba(251, 247, 238, .95); color: #332E8F; box-shadow: inset 0 0 0 1px rgba(51, 46, 143, .35); }
.ttf-th[data-foil="true"] .ttf-mark { background: linear-gradient(135deg, #B8912F, #E8CD8C 38%, #B8912F 62%, #E8CD8C); color: #3b2d05; box-shadow: none; }
.ttf-th .ttf-credit {
  left: 3.2cqi; bottom: 3.2cqi; max-width: 46%;
  padding: .33em .66em; border-radius: .8cqi;
  font: 400 calc(4px + 1.47cqi)/1.3 var(--ft);
  background: rgba(32, 30, 63, .72); color: #FBF7EE; -webkit-line-clamp: 3;
}
.ttf-th .ttf-credit b { display: inline; font-weight: 600; font-size: .9em; letter-spacing: .08em; text-transform: uppercase; }
.ttf-th .ttf-plate {
  background-color: #332E8F; color: #FBF7EE;
  padding: 3.5cqi 4.3cqi 3.2cqi;
}
.ttf-th .ttf-type {
  font-weight: 600; letter-spacing: .1em; opacity: .85; margin-bottom: 1.34cqi;
}
.ttf-th[data-foil="true"] .ttf-type { color: #E8CD8C; opacity: 1; }
.ttf-th .ttf-title {
  margin-top: 0;
  font-size: calc(min(var(--f-name) * var(--tl, 1), var(--fit) / var(--lw, 8)));
  line-height: 1.02; font-variation-settings: "opsz" 72;
}
.ttf-sub {
  margin-top: 1.07cqi;
  font: italic 400 var(--f-sub)/1.2 var(--fd); opacity: .85;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}
.ttf-th .ttf-fact {
  flex: 0 0 auto; padding: 2.7cqi 4.3cqi 3.5cqi;
  color: #201E3F; word-spacing: .05em; line-height: 1.35;
}
/* the paper grain of the print (cards.css --th-grain), medium and up */
.ttf-th .ttf-face, .ttf-th .ttf-plate {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .11 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ═══ Foil sweep (top rarity only): a table adds .ttf-sweep to run it once, 900 ms ═══ */
.ttf-shine { position: absolute; inset: 0; z-index: 7; display: none !important; border-radius: inherit; overflow: hidden; pointer-events: none; }
.ttf-sweep[data-foil="true"] .ttf-shine { display: block !important; }
.ttf-shine::before {
  content: ''; position: absolute; top: 0; bottom: 0; left: -60%; width: 220%;
  background: linear-gradient(105deg, transparent 40%, rgba(255, 246, 232, .62) 50%, transparent 60%);
  mix-blend-mode: soft-light;
  transform: translateX(-60%);
  animation: ttf-sweep 900ms cubic-bezier(.2, .8, .2, 1) 1 both;
}
@keyframes ttf-sweep { from { transform: translateX(-60%); } to { transform: translateX(60%); } }
@media (prefers-reduced-motion: reduce) {
  .ttf-shine::before { animation: none; transform: none; opacity: 0; }
}

/* ═══ Tiers ═══════════════════════════════════════════════════════════════════════ */
/* Medium, 150 to 240: chip, type row, title, fact. No credit, no latin. */
@container ttf (width < 240px) {
  .ttf-card {
    --f-cap: calc(2.5px + 2.4cqi);
    --f-fact: calc(2.4px + 3.33cqi);
    --f-title: 9cqi;
    --f-name: 8.4cqi;
    --f-typo: 12.5cqi;
  }
  .ttf-credit, .ttf-sub { display: none !important; }
  .ttf-c20 .ttf-fact { -webkit-line-clamp: 1; }
  .ttf-th .ttf-fact { -webkit-line-clamp: 1; padding: 2.6cqi 4.3cqi 3.2cqi; }
  .ttf-typo-name { -webkit-line-clamp: 6; }
}

/* Small, 90 to 150: title only on the plate; the set mark replaces the chip */
@container ttf (width < 150px) {
  .ttf-card {
    --f-title: 11cqi;
    --f-name: 10cqi;
    --f-typo: 14cqi;
    --f-mark: calc(2px + 6cqi);
    --fr: calc(1px + 1.6cqi);
  }
  .ttf-chip, .ttf-typerow, .ttf-type, .ttf-fact, .ttf-typo-type, .ttf-typo-fact, .ttf-grain { display: none !important; }
  .ttf-c20 .ttf-mark { display: block; }
  .ttf-th .ttf-rar { display: block; }
  .ttf-c20 .ttf-plate { padding: 2.6cqi 3.6cqi 3.4cqi; }
  .ttf-c20 .ttf-title { margin-top: 0; -webkit-line-clamp: 2; line-height: 1.05; }
  .ttf-th .ttf-plate { padding: 3cqi 4.4cqi 3.6cqi; }
  .ttf-th .ttf-title { -webkit-line-clamp: 2; line-height: 1.08; }
  .ttf-th .ttf-face, .ttf-th .ttf-plate { background-image: none; }
  .ttf-typo-in { padding: 4cqi 5cqi 5.5cqi; }
  .ttf-typo-name { -webkit-line-clamp: 5; }
}

/* Tiny, under 90: art or field, frame, set mark. The plate stays as a bare band. */
@container ttf (width < 90px) {
  .ttf-card {
    --f-typo: 15.5cqi;
    --f-mark: calc(1px + 9cqi);
    --fr: calc(1px + 2cqi);
  }
  .ttf-title { display: none !important; }
  .ttf-c20 .ttf-plate { padding: 0; min-height: 9cqi; }
  .ttf-th .ttf-plate { padding: 0; min-height: 9cqi; }
  .ttf-th .ttf-rar { display: none; }
  .ttf-th .ttf-mark { display: block; }
  .ttf-mark { top: 5cqi; left: 5cqi; }
  .ttf-typo-in { padding: 4cqi 5cqi 6cqi; }
  .ttf-typo-name { -webkit-line-clamp: 4; }
  .ttf-c20 .ttf-art::after, .ttf-th .ttf-art::after { height: 30cqi; }
}

/* ═══ Treehopper front: the design board's tile and open card ═════════════════════════════════════════
   The front only; the back keeps the print's layout and takes the theme's colors further down. Every rule sits under
   .ttf-th.ttf-front, so it outranks the print's .ttf-th rules and the tiers' at any width. The NYID-pinned nodes stay
   in the DOM (chip, rarity chip, mark, latin, shine) and are hidden where the board has none. Colors: the table's
   theme sets --thf-* (named apart from Treehopper's own .th-print --th-* tokens); unset, Light Original. No scrim,
   no photo filter, no sweep; the cardstock's grain only (below). Sizes run linear in cqi from the board's tile
   (114 px) to its open card (300 px). Stamp: the find number ("No. N") over the first-find date, at every size. */
.ttf-th.ttf-front {
  --tf-frame: var(--thf-frame, #5048E5);
  --tf-paper: var(--thf-paper, #FFFFFF);
  --tf-ink: var(--thf-ink, #5048E5);
  --tf-bed: var(--thf-art-bed, #CAC8F7);
  --tf-mat: var(--thf-mat, #F0F3FF);
  --tf-gold: var(--thf-gold, #E8CD8C);
  --tf-gold-2: var(--thf-gold-2, #A88437);
  --tf-on-gold: var(--thf-on-gold, #3C36AC);
  --tf-hair: var(--thf-hair, #5048E5);
  --tf-hatch: var(--thf-hatch, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Cpath d='M-1 1L1 -1M0 4L4 0M3 5L5 3' stroke='%23A88437' stroke-width='1'/%3E%3C/svg%3E"));
  --tf-speck: var(--thf-speck, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='s'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.3' numOctaves='1' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1.7 -.72'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23s)'/%3E%3C/svg%3E"));
  --fd: 'Young Serif', Georgia, 'Times New Roman', serif; --fw: 400; --fit: 130cqi;
  --ft: 'Archivo', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
  --tf-in: calc(.5px + .9cqi);                              /* paper round the photo: 1.5 at 114, 3.2 at 300 */
  --tf-band: 12px;                                          /* the credit band: 12 at every size, its text 9 */
  --tf-name: calc(4.65px + 6.45cqi);                        /* the name: 12 at 114, 24 at 300 */
  --tf-rar: calc(7.8px + 1.07cqi);                          /* the rarity word: 9 at 114, 11 at 300 */
}
.ttf-th.ttf-front .ttf-card, .ttf-th.ttf-front[data-foil="true"] .ttf-card {
  --fr: calc(1.2px + 1.5cqi);                               /* the frame: 2.9 at 114, 5.7 at 300 */
  border-radius: min(4px, calc(1px + 1.6cqi));              /* 4 from 188 up, today's under it */
  background: var(--tf-frame);                              /* ink on foil too, as the board draws Unique */
}
.ttf-th.ttf-front .ttf-card::before { display: none; }       /* the board's face rule is the frame's own ink */
.ttf-th.ttf-front .ttf-face, .ttf-th.ttf-front .ttf-plate { background-image: none; }
.ttf-th.ttf-front .ttf-face {
  padding: var(--tf-in) var(--tf-in) 0;
  border-radius: 1px;                                       /* cardstock (was .5px + .9cqi) */
  background-color: var(--tf-paper);
  color: var(--tf-ink);
}
.ttf-th.ttf-front .ttf-art { flex: 0 0 62%; border-radius: 1px; background: var(--tf-bed); }
.ttf-th.ttf-front .ttf-art::after { display: none; }
.ttf-th.ttf-front .ttf-img { filter: none; }
/* No photo, or one that failed: the board's bare art, paper with an inset hairline and the latin name in it */
.ttf-th.ttf-front.ttf-typo .ttf-art, .ttf-th.ttf-front.ttf-noimg .ttf-art {
  display: flex; align-items: center; justify-content: center; padding: 10px;
  background: var(--tf-paper); outline: 1px solid var(--tf-hair); outline-offset: -4px;
}
.ttf-th.ttf-front .ttf-latin {
  position: static; max-width: 100%; text-align: center; overflow-wrap: break-word;
  font: italic 400 calc(9.8px + 1.07cqi)/1.3 var(--ft); font-stretch: 85%; color: var(--tf-ink);
}
.ttf-th.ttf-front.ttf-typo .ttf-sub, .ttf-th.ttf-front.ttf-noimg .ttf-sub { display: none; }
.ttf-th.ttf-front .ttf-chip, .ttf-th.ttf-front .ttf-rar, .ttf-th.ttf-front .ttf-mark,
.ttf-th.ttf-front[data-foil] .ttf-shine { display: none !important; }
.ttf-th .ttf-tcode { display: none; }                       /* a tree card's code: its tile only (under 240) */

/* The credit: an opaque mat band across the art's foot, one line */
.ttf-th.ttf-front .ttf-credit {
  left: 0; right: 0; bottom: 0; max-width: none; height: var(--tf-band);
  display: block; padding: 0 .55em; border-radius: 0;
  font: 500 9px/var(--tf-band) var(--ft); font-stretch: 80%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  background: var(--tf-mat); color: var(--tf-ink);
}
.ttf-th.ttf-front .ttf-credit b { font-weight: 700; font-size: 1em; letter-spacing: 0; text-transform: none; margin-right: .3em; }

/* The stamp: a paper label pressed in the ink, just above the band */
.ttf-th.ttf-front .ttf-stamp {
  position: absolute; z-index: 3;
  right: calc(3px + 2.4cqi); bottom: calc(var(--tf-band) + 3px + 1.6cqi);
  width: calc(42px + 14cqi); padding: calc(3.5px + 2.6cqi) 2px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(1px + .7cqi);
  overflow: hidden; text-align: center;
  background: var(--tf-paper); color: var(--tf-ink);
  border-radius: 3px; box-shadow: inset 0 0 0 2px var(--tf-ink), inset 0 0 0 3.5px var(--tf-paper), inset 0 0 0 4.5px var(--tf-ink);
}
.ttf-th.ttf-front.ttf-typo .ttf-stamp, .ttf-th.ttf-front.ttf-noimg .ttf-stamp { bottom: calc(3px + 2.4cqi); }
.ttf-th.ttf-front .ttf-stamp::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: var(--tf-speck); background-size: 90px 90px;
}
.ttf-th.ttf-front .ttf-stamp-n { font: 400 calc(7.9px + 2.7cqi)/1 var(--fd); letter-spacing: .01em; white-space: nowrap; }
.ttf-th.ttf-front .ttf-stamp-d {
  display: block; font: 600 calc(7px + 1cqi)/1 var(--ft); font-stretch: 75%; letter-spacing: .08em; white-space: nowrap;
}
/* 1.2.0: a date-only stamp is the same box; a missing card's empty spot (card.spot) is the board's 2 px dashed box in
   the ink with the distance in capitals, 13 px at the open card (300) */
.ttf-th.ttf-front .ttf-stamp[data-spot] { border: 2px dashed var(--tf-ink); box-shadow: none; }
.ttf-th.ttf-front .ttf-stamp[data-spot]::after { display: none; }
.ttf-th.ttf-front .ttf-stamp[data-spot] .ttf-stamp-n {
  font: 700 calc(9.1px + 1.3cqi)/1 var(--ft); font-stretch: 75%; letter-spacing: .04em; text-transform: uppercase;
}

/* The plate: paper, the rarity word with its pips, the name in the serif, the latin; the fact at the foot */
.ttf-th.ttf-front .ttf-plate {
  flex: 1 1 auto; min-height: 0; overflow: hidden;
  display: flex; flex-direction: column; align-items: flex-start; gap: calc(2px + 1cqi);
  padding: calc(1.7px + 3.76cqi) calc(1.7px + 3.76cqi) calc(6.4px + .54cqi);
  background-color: transparent; color: var(--tf-ink);
}
.ttf-th.ttf-front .ttf-type {
  display: block; flex: none; max-width: 100%; margin: 0; opacity: 1;
  font: 600 var(--tf-rar)/1 var(--ft); font-stretch: 75%; letter-spacing: .14em; text-transform: uppercase;
  white-space: nowrap; overflow: hidden; text-overflow: clip; color: var(--tf-ink);
}
.ttf-th.ttf-front .ttf-type[data-pips]::after {
  content: ''; display: inline-block; vertical-align: .1em;
  width: calc(var(--pips) * .55em - .27em); height: .28em; margin-left: .6em;
  background: radial-gradient(circle at .14em .14em, currentColor .12em, transparent .145em) 0 0 / .55em .28em repeat-x;
}
.ttf-th .ttf-type[data-pips="1"] { --pips: 1; }
.ttf-th .ttf-type[data-pips="2"] { --pips: 2; }
.ttf-th .ttf-type[data-pips="3"] { --pips: 3; }
.ttf-th .ttf-type[data-pips="4"] { --pips: 4; }
.ttf-th .ttf-type[data-pips="5"] { --pips: 5; }
.ttf-th .ttf-type[data-pips="6"] { --pips: 6; }
.ttf-th.ttf-front[data-foil="true"] .ttf-type {
  padding: .34em .5em; border-radius: 2px; color: var(--tf-on-gold);
  background: var(--tf-gold) var(--tf-hatch); background-size: 4px 4px; box-shadow: inset 0 0 0 1px var(--tf-gold-2);
}
.ttf-th.ttf-front .ttf-title {
  align-self: stretch; margin: auto 0 0;
  font-size: min(var(--tf-name), var(--fit) / var(--lw, 8));
  line-height: 1.12; letter-spacing: 0; font-variation-settings: normal; color: var(--tf-ink);
  -webkit-line-clamp: 3;
}
.ttf-th.ttf-front .ttf-title:last-child { margin-bottom: auto; }
.ttf-th.ttf-front .ttf-sub {
  align-self: stretch; margin: 0 0 auto; opacity: 1;
  font: italic 500 calc(4px + 2.67cqi)/1.3 var(--ft); font-stretch: 85%; color: var(--tf-ink);
}
/* 1.1.0: a retired type's mark, as the board draws it, in the front's ink. At 240 up (the open card)
   it sits under the latin, the three kept together; 9 px at every size, as drawn */
.ttf-th.ttf-front .ttf-sub:has(+ .ttf-retired) { margin-bottom: 0; }
.ttf-th.ttf-front .ttf-retired {
  flex: none; align-self: flex-start; max-width: 100%; margin: 4px 0 auto;
  padding: 2px 4px 1px; border: 1px solid var(--tf-ink); color: var(--tf-ink);
  font: 700 9px/1.1 var(--ft); font-stretch: 75%; letter-spacing: .08em; text-transform: uppercase;
  white-space: nowrap; overflow: hidden; text-overflow: clip;
}
.ttf-th.ttf-front .ttf-fact {
  display: block; margin: 0 calc(1px + 3cqi) calc(1px + 3cqi); padding: .8em .8em .7em;
  border: 1px solid var(--tf-ink); color: var(--tf-ink); word-spacing: 0;
  font: 600 calc(4px + 2cqi)/1 var(--ft); font-stretch: 75%; letter-spacing: .12em; text-transform: uppercase;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* 1.2.0: the fact as two cells (card.factCells), as the board draws them: a 1 px box in the second ink, the second cell
   ruled off at its left, at least 72 px at the open card (7.2em of its 10 px), its text centered */
.ttf-th.ttf-front .ttf-fact[data-cells] {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; padding: 0; border-color: var(--thf-ink-2, var(--tf-ink));
}
.ttf-th.ttf-front .ttf-fact-c { min-width: 0; padding: .8em .8em .7em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ttf-th.ttf-front .ttf-fact-c + .ttf-fact-c { min-width: 7.2em; border-left: 1px solid var(--thf-ink-2, var(--tf-ink)); text-align: center; }

/* Under 240: one rule on the stamp; the name first, the rarity at the plate's foot; no latin, no fact */
@container ttf (width < 240px) {
  .ttf-th.ttf-front .ttf-credit { display: block !important; }
  .ttf-th.ttf-front .ttf-fact { display: none !important; }
  .ttf-th.ttf-front .ttf-stamp { border-radius: 2px; box-shadow: inset 0 0 0 1.5px var(--tf-ink); }
  .ttf-th.ttf-front .ttf-title, .ttf-th.ttf-front .ttf-title:last-child { order: 1; margin: 0; }
  .ttf-th.ttf-front .ttf-type { order: 2; margin-top: auto; display: block !important; letter-spacing: .08em; }
  /* On the tile the mark takes the plate's foot and the rarity rises to its middle (the board's tile plate spaces
     its three lines evenly); the latin is hidden here, the mark is not */
  .ttf-th.ttf-front .ttf-retired { order: 3; margin: auto 0 0; }
  .ttf-th.ttf-front .ttf-plate:has(> .ttf-retired) .ttf-title { -webkit-line-clamp: 2; }   /* the mark takes the third line */
  /* A tree card's tile: a round tree mark where a type's stamp sits,
     and "Tree {code}" in ink-2 at the plate's foot in place of the rarity. At 240 up the print foot carries it.
     The code sits before the name in the DOM (order puts it at the foot), so the name stays :last-child at 240 up;
     the rarity is hidden from sight only, so a screen reader still says it */
  .ttf-th.ttf-front[data-mark] .ttf-type {
    position: absolute; width: 1px; height: 1px; margin: 0; padding: 0; border: 0;
    overflow: hidden; clip-path: inset(50%); white-space: nowrap;
  }
  .ttf-th.ttf-front[data-mark] .ttf-tcode {
    order: 2; margin-top: auto; display: block; max-width: 100%; overflow: hidden;
    font: 600 9px/1.1 var(--ft); font-stretch: 75%; letter-spacing: .06em; text-transform: uppercase;
    white-space: nowrap; color: var(--thf-ink-2, var(--tf-ink));
  }
  .ttf-th.ttf-front[data-mark] .ttf-mark {
    display: grid !important; place-items: center; top: auto; left: auto;
    right: calc(3px + 2.4cqi); bottom: calc(var(--tf-band) + 3px + 1.6cqi);
    width: 24px; height: 24px; min-width: 0; padding: 0; border-radius: 50%;
    background: var(--tf-paper); color: var(--tf-ink); box-shadow: 0 0 0 1.5px currentColor;
  }
  .ttf-th.ttf-front.ttf-typo[data-mark] .ttf-mark, .ttf-th.ttf-front.ttf-noimg[data-mark] .ttf-mark { bottom: calc(3px + 2.4cqi); }
  /* 1.2.0: a tree card's date-only stamp is the open card's; on the tile the tree mark takes its place */
  .ttf-th.ttf-front[data-mark] .ttf-stamp:not([data-no]) { display: none; }
  .ttf-th.ttf-front[data-mark] .ttf-mark svg.ttf-ic { width: 15px; height: 15px; stroke-width: 1.8; vertical-align: 0; }
}
/* Under 108 a retired tile's plate holds one line of name with the rarity and the mark (measured: two lines are
   cut part way from 90 to 95, and to 106 under Unique's taller chip) */
@container ttf (width < 108px) {
  .ttf-th.ttf-front .ttf-plate:has(> .ttf-retired) .ttf-title { -webkit-line-clamp: 1; }
}
/* the board's small tree tile, under 96: mark 20, icon 12, code 8 */
@container ttf (width < 96px) {
  .ttf-th.ttf-front[data-mark] .ttf-mark { width: 20px; height: 20px; right: 4px; }
  .ttf-th.ttf-front[data-mark] .ttf-mark svg.ttf-ic { width: 12px; height: 12px; }
  .ttf-th.ttf-front[data-mark] .ttf-tcode { font-size: min(8px, 13cqi); }
}
/* Under 90: no name, no credit; the stamp spans the art; the rarity word alone */
@container ttf (width < 90px) {
  .ttf-th.ttf-front .ttf-credit, .ttf-th.ttf-front .ttf-latin { display: none !important; }
  .ttf-th.ttf-front .ttf-stamp { left: 3px; right: 3px; bottom: 5px; width: auto; padding: 3px 0; gap: 2px; }
  .ttf-th.ttf-front .ttf-stamp-n { font-size: min(16px, 17cqi); }
  .ttf-th.ttf-front .ttf-stamp-d { font-size: min(11px, 13cqi); }
  .ttf-th.ttf-front .ttf-plate { padding: 4px 3px 5px; }
  .ttf-th.ttf-front .ttf-type { font-size: min(9px, 14.5cqi); letter-spacing: 0; }
  .ttf-th.ttf-front .ttf-type[data-pips]::after { display: none; }
  .ttf-th.ttf-front[data-foil="true"] .ttf-type { padding: .3em .35em; }
  .ttf-th.ttf-front .ttf-retired { font-size: min(9px, 14.5cqi); letter-spacing: .02em; padding: 1px 3px 0; }   /* as the rarity word shrinks */
  /* no credit band here, so a tree card's mark sits at the art's foot */
  .ttf-th.ttf-front[data-mark] .ttf-mark, .ttf-th.ttf-front.ttf-typo[data-mark] .ttf-mark,
  .ttf-th.ttf-front.ttf-noimg[data-mark] .ttf-mark { bottom: 4px; }
}

/* ═══ The shared card: print ════════════════════════════════════════════════════════════════════════════════════
   A face option any face can take: data-print on the root (ttPrintOn). Both sides. Design as tokens with defaults,
   which the app's theme may set on its table: --pc-edge, --pc-veil, --pc-sheen, --pc-shade, --pc-grain, --pc-noise
   (unset, Light Original). A Treehopper face reads its --thf-* first, so its values are as they were. The cut
   edge at every size; the radius at most 4 px (a print C20 face too); at the large tier only (the open card, not the
   tiles) the matte (sheen, shade and veil over the whole card), the grain over the face, the light (a table running
   core/print.js sets data-tt-light, and --pc-lx, --pc-ly), and the foot. The stage's and the tiles' shadows are
   cardroom.css's (--pc-rest, --pc-lift, --pc-tile-rest). Provo's and VeryThere's faces do not print unless asked. */
.ttf[data-print] {
  --tp-edge: var(--pc-edge, rgba(255, 255, 255, .2));
  --tp-veil: var(--pc-veil, rgba(255, 255, 255, .03));
  --tp-sheen: var(--pc-sheen, transparent);
  --tp-shade: var(--pc-shade, rgba(20, 16, 60, .03));
  --tp-grain: var(--pc-grain, .025);
  --tp-noise: var(--pc-noise, url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"));
}
.ttf-th[data-print] {
  --tp-edge: var(--thf-edge, var(--pc-edge, rgba(255, 255, 255, .2)));
  --tp-veil: var(--thf-veil, var(--pc-veil, rgba(255, 255, 255, .03)));
  --tp-sheen: var(--thf-sheen, var(--pc-sheen, transparent));
  --tp-shade: var(--thf-shade, var(--pc-shade, rgba(20, 16, 60, .03)));
  --tp-grain: var(--thf-grain, var(--pc-grain, .025));
}
.ttf[data-print] .ttf-card { box-shadow: inset 0 0 0 1px var(--tp-edge); }          /* the stock's cut edge */
.ttf-c20[data-print] .ttf-card { border-radius: min(4px, 2.4cqi); }
.ttf-c20[data-print] .ttf-face { border-radius: 1px; }
.ttf-furn { display: none; }
@container ttf (width >= 240px) {
  .ttf[data-print] .ttf-card::after, .ttf[data-print] .ttf-face::after {
    content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
  }
  .ttf[data-print] .ttf-card::after {
    z-index: 6;
    background: linear-gradient(165deg, var(--tp-sheen), transparent 45%, var(--tp-shade)), linear-gradient(var(--tp-veil), var(--tp-veil));
  }
  .ttf[data-print] .ttf-face::after {
    z-index: 5;
    background-image: var(--tp-noise); background-size: 160px 160px; mix-blend-mode: multiply; opacity: var(--tp-grain);
  }
  .ttf[data-print] .ttf-grain { display: none; }               /* one grain: the stock's replaces the print's */
  /* The light that follows the phone: wide, faint, matte, over the front; a back's face is its own
     layer with the light under its text, so no line pales wherever the tilt takes it */
  [data-tt-light] .ttf[data-print] .ttf-face::before {
    content: ''; position: absolute; inset: 0; z-index: 6; pointer-events: none; border-radius: inherit;
    background: radial-gradient(farthest-corner at var(--pc-lx, 30%) var(--pc-ly, 20%), rgba(255, 255, 255, .4), rgba(255, 255, 255, .14) 30%, rgba(255, 255, 255, 0) 58%, rgba(0, 0, 0, .035) 80%, rgba(0, 0, 0, .07));
    mix-blend-mode: soft-light;
  }
  [data-tt-light] .ttf-back[data-print] .ttf-face { isolation: isolate; }
  [data-tt-light] .ttf-back[data-print] .ttf-face::before { z-index: -1; }
  /* The foot: collector number, rarity glyph, the art's credit (moved here from the art), copyright */
  .ttf[data-print] .ttf-furn {
    position: relative; z-index: 3; flex: none; display: flex; align-items: center; gap: calc(1px + 1.3cqi);
    font: 500 calc(3.5px + 1.5cqi)/1.25 var(--ft); font-stretch: 80%; letter-spacing: .03em; white-space: nowrap;
  }
  .ttf[data-print] .ttf-furn-no { flex: none; font-weight: 700; letter-spacing: .05em; font-variant-numeric: tabular-nums; }
  .ttf[data-print] svg.ttf-furn-rm { display: block; flex: none; width: calc(3px + 2cqi); height: calc(3px + 2cqi); fill: currentColor; }
  .ttf[data-print] .ttf-furn-cr { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; opacity: .78; }
  .ttf[data-print] .ttf-furn-cp { flex: none; opacity: .78; }
  .ttf[data-print] .ttf-face:has(> .ttf-furn) .ttf-credit { display: none !important; }
  .ttf-th[data-print] .ttf-furn { margin: calc(-1px - 1cqi) calc(1px + 3cqi) 0; padding: 0 0 calc(1px + 1.7cqi); color: var(--tf-ink, #5048E5); }
  /* 1.2.0: the board's foot, 8 px on 10 in the second ink; the number and the rarity glyph (9 px) in the
     first; the credit and the copyright at full strength; a long credit wraps instead of cutting */
  .ttf-th[data-print] .ttf-furn {
    align-items: flex-start; font-size: 8px; line-height: 10px; white-space: normal;
    color: var(--thf-ink-2, var(--tf-ink, #5048E5));
  }
  .ttf-th[data-print] .ttf-furn-no { white-space: nowrap; color: var(--tf-ink, #5048E5); }
  .ttf-th[data-print] svg.ttf-furn-rm { width: 9px; height: 9px; margin-top: .5px; color: var(--tf-ink, #5048E5); }
  .ttf-th[data-print] .ttf-furn-cr { opacity: 1; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; }
  .ttf-th[data-print] .ttf-furn-cp { opacity: 1; white-space: nowrap; }
  .ttf-c20[data-print] .ttf-furn { margin: 0; padding: 0 3.75cqi 2.6cqi; background: var(--dp); color: var(--sf); }
}

/* ═══ The back ════════════════════════════════════════════════════════════════════ */
.ttf-back .ttf-card {
  --fb-cap: calc(4px + 1.4cqi);          /* 9.5 at 390 */
  --fb-title: calc(6px + 4.1cqi);        /* 22 at 390 */
  --fb-text: calc(5px + 2.3cqi);         /* 14 at 390 */
  --fb-small: calc(4px + 1.8cqi);        /* 11 at 390 */
  --fb-key: calc(3.5px + 1.4cqi);        /* 9 at 390 */
  --fb-val: calc(5px + 2.3cqi);          /* 14 at 390 */
  --fb-story: calc(5.5px + 2.67cqi);     /* 15.9 at 390 */
  --btl: calc(min(var(--fb-title) * var(--tl, 1), var(--fit) * .9 / var(--lw, 8)));
}
.ttf-back .ttf-face { -webkit-user-select: text; user-select: text; }
.ttf-bk-head {
  flex: 0 0 auto; position: relative; z-index: 2;
  padding: 4.4cqi 4.4cqi 3.4cqi;
  border-bottom: 1px solid var(--line);
}
.ttf-bk-set {
  font: 800 var(--fb-cap)/1.3 var(--ft); letter-spacing: .1em; text-transform: uppercase; color: var(--ink75);
  display: -webkit-box !important; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}
.ttf-th .ttf-bk-set { font-weight: 600; }
.ttf-c20 .ttf-bk-head { border-bottom: 0; padding-bottom: 1.2cqi; }
.ttf-bk-set .ttf-no { color: var(--ink); }
.ttf-bk-title {
  margin-top: 1.4cqi;
  font-family: var(--fd); font-weight: var(--fw); word-spacing: var(--fws);
  font-size: var(--btl); line-height: 1.1; letter-spacing: -.01em; color: var(--head);
  text-wrap: balance; overflow-wrap: normal; word-break: normal;
  display: -webkit-box !important; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
}
.ttf-th .ttf-bk-title { font-variation-settings: "opsz" 72; }
.ttf-bk-sub { margin-top: .8cqi; font: italic 400 var(--fb-text)/1.25 var(--fd); color: var(--ink75); }
.ttf-bk-body {
  flex: 1 1 auto; min-height: 0;
  overflow-x: hidden; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
  touch-action: pan-y; scrollbar-width: thin; scrollbar-color: var(--line) transparent;
  padding: 3.4cqi 4.4cqi 5cqi;
  display: flex !important; flex-direction: column; gap: 3.4cqi;
}
/* 1.3.0, card.backFade: no scrollbar; a fade at the lower edge while more is below (the board's 44 px on its
   300 px card, 14.67cqi); scrolled, the body's own top padding (3.4cqi) stays clear, so no part of a line shows under
   the head's rule (as the board's back does) */
.ttf-bk-body.is-fade { scrollbar-width: none; }
.ttf-bk-body.is-fade::-webkit-scrollbar { display: none; }
.ttf-bk-body.is-more {
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 14.67cqi), transparent);
  mask-image: linear-gradient(to bottom, #000 calc(100% - 14.67cqi), transparent);
}
.ttf-bk-body.is-scrolled {
  -webkit-mask-image: linear-gradient(to bottom, transparent calc(3.4cqi - .5px), #000 3.4cqi);
  mask-image: linear-gradient(to bottom, transparent calc(3.4cqi - .5px), #000 3.4cqi);
}
.ttf-bk-body.is-scrolled.is-more {
  -webkit-mask-image: linear-gradient(to bottom, transparent calc(3.4cqi - .5px), #000 3.4cqi, #000 calc(100% - 14.67cqi), transparent);
  mask-image: linear-gradient(to bottom, transparent calc(3.4cqi - .5px), #000 3.4cqi, #000 calc(100% - 14.67cqi), transparent);
}
/* Rarity with its real count */
.ttf-bk-rar { display: flex !important; flex-wrap: wrap; align-items: center; gap: 1.2cqi 2.2cqi; font: 500 var(--fb-small)/1.3 var(--ft); color: var(--ink); }
.ttf-rchip {
  display: inline-block !important; padding: .3em .6em; border-radius: .3em;
  font: 800 var(--fb-cap)/1.2 var(--ft); letter-spacing: .1em; text-transform: uppercase;
  box-shadow: inset 0 0 0 1px var(--line); color: var(--ink);
}
.ttf-th .ttf-rchip { font-weight: 600; box-shadow: inset 0 0 0 1px rgba(51, 46, 143, .35); color: #332E8F; }
.ttf[data-foil="true"] .ttf-rchip { background: linear-gradient(135deg, #B8912F, #E8CD8C 38%, #B8912F 62%, #E8CD8C); color: #3b2d05; box-shadow: none; }
/* Box score: ruled stat cells (C20 .lsb-grid; Treehopper .th-score) */
.ttf-bk-stats {
  display: grid !important; grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr));
  border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
}
.ttf-th .ttf-bk-stats { border-top-color: #201E3F; }
.ttf-cell { position: relative; min-width: 0; padding: 2.1cqi 2.1cqi 2.4cqi; }
.ttf-cell:first-child { padding-left: 0; }
.ttf-cell + .ttf-cell::before { content: ''; position: absolute; left: 0; top: 2.1cqi; bottom: 2.1cqi; width: 1px; background: var(--line); }
.ttf-cell-k {
  display: flex !important; align-items: flex-start; gap: .45em; margin-bottom: 1.3cqi;
  font: 700 var(--fb-key)/1.3 var(--ft); letter-spacing: .08em; text-transform: uppercase; color: var(--ink75);
}
.ttf-cell-k svg.ttf-ic { width: 1.3em; height: 1.3em; color: var(--ac); vertical-align: 0; }
.ttf-th .ttf-cell-k { font-weight: 600; letter-spacing: .1em; }
.ttf-cell-v {
  font: 700 var(--fb-val)/1.22 var(--ft); color: var(--ink);
  overflow-wrap: normal; word-break: normal; hyphens: manual; text-wrap: balance;
}
.ttf-th .ttf-cell-v { font-weight: 600; color: #201E3F; }
/* The back text */
.ttf-bk-text { font: 400 var(--fb-text)/1.42 var(--ft); color: var(--ink); overflow-wrap: break-word; }
.ttf-c20 .ttf-bk-text {
  padding: 2.7cqi 3.1cqi; border: 1px solid var(--line); border-radius: 2.1cqi;
}
.ttf-stop .ttf-bk-text { background: color-mix(in srgb, var(--ac) 6%, transparent); }
.ttf-lead {
  display: inline !important; margin-right: .5em; white-space: nowrap;
  font: 800 var(--fb-key)/1 var(--ft); letter-spacing: .1em; text-transform: uppercase; color: var(--dp);
}
.ttf-lead svg.ttf-ic { width: 1.35em; height: 1.35em; margin-right: .35em; color: var(--ac); vertical-align: -.3em; }
.ttf-th .ttf-bk-h4 { font: 600 var(--fb-key)/1.3 var(--ft); letter-spacing: .1em; text-transform: uppercase; color: #332E8F; margin-bottom: 2cqi; }
.ttf-th .ttf-bk-text { font: 400 var(--fb-story)/1.5 var(--fd); color: #201E3F; font-variation-settings: "opsz" 14; }
.ttf-th .ttf-bk-text::first-letter { font-weight: 600; }
/* Collected */
.ttf-bk-got {
  display: flex !important; align-items: center; gap: 1.8cqi;
  font: 600 var(--fb-small)/1.3 var(--ft); color: var(--ink);
}
.ttf-dot { width: .7em; height: .7em; border-radius: 50%; flex: none; background: #63E6BE; box-shadow: inset 0 0 0 1px rgba(14, 43, 31, .25); }
.ttf-th .ttf-dot { background: #2E6B4E; box-shadow: none; }
.ttf-bk-got.is-not { color: var(--ink75); font-weight: 500; }
.ttf-bk-got.is-not .ttf-dot { background: transparent; box-shadow: inset 0 0 0 1px var(--ink75); }
/* Credit, the colophon */
.ttf-bk-credit {
  margin-top: auto; padding-top: 2.6cqi; border-top: 1px solid var(--line);
  font: 400 calc(4px + 1.55cqi)/1.4 var(--mono); letter-spacing: .02em; color: var(--ink75);
  overflow-wrap: anywhere;
}
.ttf-th .ttf-bk-credit { margin-top: 0; font-family: var(--ft); letter-spacing: 0; }   /* 1.2.0: no blank band over it */
.ttf-bk-credit b { display: inline; font-weight: 700; }
/* 1.2.0: the back's foot (slot foot), after the body and outside its scroll; the head's action (slot
   head) beside the name. Treehopper's, as the board draws them: a row, space between, gap 8 and 10 */
.ttf-bk-foot { flex: none; position: relative; z-index: 2; padding: 0 4.4cqi 4.4cqi; }
.ttf-th .ttf-bk-foot {
  display: flex !important; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px 12px; border-top: 1px solid var(--ink75);
}
.ttf-bk-head:has(> .ttf-bk-act) {
  display: grid !important; grid-template-columns: minmax(0, 1fr) auto; column-gap: 10px; align-items: start;
}
.ttf-bk-head:has(> .ttf-bk-act) > * { grid-column: 1; }
.ttf-bk-head > .ttf-bk-act { grid-column: 2; grid-row: 1 / span 3; align-self: start; display: flex; }
/* 1.4.0: the act spans the lines the head has. With no set or sub line it sat over two empty rows, and the
   inline strut under a 36 px button made the head 72 px against the board's 61 */
.ttf-bk-head:not(:has(> .ttf-bk-set)) > .ttf-bk-act, .ttf-bk-head:not(:has(> .ttf-bk-sub)) > .ttf-bk-act { grid-row: 1 / span 2; }
.ttf-bk-head:not(:has(> .ttf-bk-set, > .ttf-bk-sub)) > .ttf-bk-act { grid-row: 1; }

/* The Treehopper back, themed (colors only, the layout stays): the frame, paper and inks read the table's
   --thf-* tokens as the front does: title and chips in ink, labels and the
   keyline in ink-2, rules in the hair color. Unset, today's values, so a table that sets none is unchanged */
.ttf-th.ttf-back {
  --ink: var(--thf-ink, #332E8F); --head: var(--thf-ink, #332E8F); --text: var(--thf-ink, #201E3F);
  --ink75: var(--thf-ink-2, #6B6885); --line: var(--thf-hair, rgba(32, 30, 63, .16));
  /* 1.2.0: the board's back type, Young Serif over Archivo, as the front */
  --fd: 'Young Serif', Georgia, 'Times New Roman', serif; --fw: 400; --fit: 130cqi;
  --ft: 'Archivo', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
}
.ttf-th.ttf-back .ttf-card {
  background: var(--thf-frame, #332E8F);
  /* The board's sizes at its open card (300 px), linear in cqi: code line and heads 10, name 21, story 16, values 14.
     1.4.0: capped there, so a wider card (Treehopper's map, 356 px) keeps the board's sizes, not 1.13 to
     1.19 times them; at 300 px or less, as before */
  --fb-cap: min(10px, calc(4px + 2cqi)); --fb-key: min(10px, calc(4px + 2cqi)); --fb-title: min(21px, calc(6px + 5cqi));
  --fb-story: min(16px, calc(5.5px + 3.5cqi)); --fb-val: min(14px, calc(5px + 3cqi));
}
.ttf-th.ttf-back .ttf-bk-head { padding: min(14px, 4.67cqi) min(14px, 4.67cqi) min(10px, 3.33cqi); border-bottom-color: var(--ink75); }
.ttf-th.ttf-back .ttf-bk-set { font: 600 var(--fb-cap)/1.2 var(--ft); font-stretch: 75%; letter-spacing: .12em; }
.ttf-th.ttf-back .ttf-bk-title { margin-top: min(4.2px, 1.4cqi); font-variation-settings: normal; letter-spacing: 0; }
.ttf-th.ttf-back .ttf-bk-sub { font-family: var(--ft); font-stretch: 85%; }               /* Young Serif has no italic */
.ttf-th.ttf-back .ttf-bk-text { font: 400 var(--fb-story)/1.5 var(--fd); font-variation-settings: normal; }
.ttf-th.ttf-back .ttf-bk-text::first-letter { font-weight: 400; }                         /* one weight: no false bold */
.ttf-th.ttf-back .ttf-cell-k { font: 600 var(--fb-key)/1.4 var(--ft); font-stretch: 75%; letter-spacing: .1em; }
.ttf-th.ttf-back .ttf-cell-v { font: 400 var(--fb-val)/1.25 var(--fd); }
.ttf-th.ttf-back[data-foil="true"] .ttf-card {
  background: var(--thf-frame, linear-gradient(135deg, #B8912F, #E8CD8C 38%, #B8912F 62%, #E8CD8C));
}
.ttf-th.ttf-back .ttf-card::before { border-color: var(--thf-ink-2, rgba(251, 247, 238, .38)); }
.ttf-th.ttf-back[data-foil="true"] .ttf-card::before { border-color: var(--thf-ink-2, rgba(60, 45, 5, .35)); }
.ttf-th.ttf-back .ttf-face { background-color: var(--thf-paper, #F8F4EA); }
.ttf-th.ttf-back:not([data-foil="true"]) .ttf-rchip { color: var(--ink); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 35%, transparent); }
.ttf-th.ttf-back .ttf-bk-stats { border-top-color: var(--thf-ink-2, var(--text)); }   /* the board's one strong rule */
.ttf-th.ttf-back .ttf-cell-v { color: var(--text); }
.ttf-th.ttf-back .ttf-bk-h4 {                                   /* the board's section head, in the second ink */
  font: 600 var(--fb-key)/1.2 var(--ft); font-stretch: 75%; letter-spacing: .14em; color: var(--ink75);
}
.ttf-th.ttf-back .ttf-bk-text { color: var(--text); }
/* a printing back at the large tier: the stock's grain alone (one grain, as the front), not the legacy print grain
   that greyed its paper */
@container ttf (width >= 240px) {
  .ttf-th.ttf-back[data-print] .ttf-face { background-image: none; }
}

/* ═══ Studio (1.4.0): Placecard's design board card, front and back ═══════════════════════════════════════════════
   A Studio card looks finished from its photo, name and lines alone. Its anatomy is fixed: 8:15, the frame (the
   card's Stock), the credited photo, the chip, the stamp (collected) or the dashed spot with its distance (not yet),
   the plate with the name, the print foot; the back's head, scrolling body and foot.
   A card not yet collected stays full color, and its back is locked: the values and the story are rule bars
   under a lock with the distance; the head, the stat keys and the street inset stay. No rarity on the plate and
   no gold. Palette literal, the Greenhouse look. Every size is the board's, drawn at 300 wide: a board unit is a
   third of a cqi. Tiers as the board's: full from 240 px, mid 150 to 239, small under 150. */
.ttf-t-pc {
  --ink: #12261C; --sf: #FFFDF6; --ink75: #4E6156; --line: rgba(18, 38, 28, .16); --head: #12261C;
  --pc-strike: #C8361F; --pc-corn: #3E9BE9; --pc-steel: #A9B9AF; --pc-rule: #DDE0D3; --pc-mark: #006638;
  --pc-bs: 'Big Shoulders', 'Big Shoulders Display', Impact, sans-serif;
  --pc-jo: Jost, 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --fd: var(--pc-bs); --fw: 900; --fws: normal; --fit: 150cqi; --ft: var(--pc-jo);
}
.ttf-pc .ttf-pc-b { font-family: var(--pc-bs); font-variation-settings: "opsz" 72; }
.ttf-pc .ttf-pc-j { font-family: var(--pc-jo); }
.ttf-pc .ttf-card { padding: 2.667cqi 2.667cqi 0; border-radius: min(3px, 1cqi); background: var(--sf); }
.ttf-pc .ttf-face { background: var(--sf); color: var(--ink); font-family: var(--pc-jo); }
.ttf-pc .ttf-title, .ttf-pc .ttf-bk-title {
  position: absolute !important; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.ttf-pc .ttf-chip {
  position: absolute; z-index: 2; display: flex; align-items: center; gap: 1.667cqi;
  max-width: 100%; border-radius: 0; color: var(--sf);
  font: 600 2.8cqi/1 var(--pc-jo); letter-spacing: .16em; text-transform: none;
}
.ttf-pc .ttf-chip::before {                    /* the app's mark: a small square, Placecard green */
  content: ''; flex: none; width: 2.667cqi; height: 2.667cqi; background: var(--pc-mark); box-shadow: 0 0 0 .2cqi var(--sf);
}

/* The front: art 356, waterline 9, plate 149, foot 41 */
.ttf-pc.ttf-front .ttf-art { flex: none; height: 118.667cqi; background: var(--ink); }
.ttf-pc.ttf-front .ttf-chip { top: 0; left: 0; height: 7cqi; padding: 0 1cqi 0 2cqi; background: var(--ink); }
.ttf-pc.ttf-front .ttf-credit {
  left: 0; right: 0; bottom: 0; max-width: none; height: 5cqi; padding: 0 2cqi; border-radius: 0;
  display: block; -webkit-line-clamp: none; background: var(--ink); color: var(--sf);
  font: 500 2.333cqi/5cqi var(--pc-jo); letter-spacing: .1em; text-transform: uppercase;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ttf-pc-stamp {                                 /* the stamp or the spot, in the art's lower right */
  position: absolute; z-index: 3; right: 2.667cqi; bottom: 7.667cqi;
  display: block; width: 29.333cqi; height: 22cqi; overflow: visible;
}
.ttf-pc-stamp .ttf-pc-bare { display: none; }
.ttf-pc-wl { flex: none; height: 3cqi; background: var(--pc-corn); }   /* the waterline: one Cornflower stripe */
.ttf-pc[data-ac] .ttf-pc-wl { background: var(--wl); }                /* 1.5.0: or the card's accent */
.ttf-pc.ttf-front .ttf-plate { position: relative; flex: none; height: 49.667cqi; overflow: hidden; background: var(--ink); color: var(--sf); }
.ttf-pc-nm { position: absolute; inset: 0; display: none; }
.ttf-pc-nm[data-tier="full"], .ttf-pc-head .ttf-pc-nm { display: block; }
.ttf-pc-nm svg { position: absolute; inset: 0; display: block; width: 100%; height: 100%; overflow: visible; }
.ttf-pc-nm text { fill: var(--sf); }
.ttf-pc-lit { position: absolute; inset: 0; background: var(--sf); }  /* the floodlight: Stock, the name in Night */
.ttf-pc-lit text { fill: var(--ink); }
.ttf-pc.ttf-front .ttf-sub, .ttf-pc.ttf-front .ttf-fact {
  position: absolute; left: 4cqi; right: 4cqi; margin: 0; opacity: 1; color: var(--sf);
  display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; -webkit-line-clamp: none;
}
.ttf-pc.ttf-front .ttf-sub { bottom: 8.19cqi; font: 600 3.2cqi/1 var(--pc-jo); letter-spacing: .24em; text-transform: uppercase; }
.ttf-pc.ttf-front .ttf-fact { bottom: 2.93cqi; font: 400 3.8cqi/1 var(--pc-jo); font-variation-settings: normal; }
/* The print foot: the printer's margin line; the collector number, the short credit and the copyright; under them
   the app's word and site. Scoped to .ttf-furn, so none of it reaches the back's foot. */
.ttf-pc[data-print] .ttf-furn {
  position: relative; z-index: 3; flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: baseline; align-content: start; column-gap: 3.333cqi; row-gap: 1.667cqi;
  margin: 2.667cqi 0 0; padding: 1.8cqi 0 0; border-top: .2cqi solid var(--ink); background: none; color: var(--ink);
  font: 600 2.333cqi/1 var(--pc-jo); letter-spacing: .1em; text-transform: uppercase; white-space: nowrap;
}
.ttf-pc[data-print] .ttf-furn > .ttf-furn-no { grid-column: 1; font: 800 4.333cqi/1 var(--pc-bs); letter-spacing: 0; font-variation-settings: "opsz" 72; }
.ttf-pc[data-print] .ttf-furn > .ttf-furn-cr { grid-column: 2; min-width: 0; opacity: 1; overflow: hidden; text-overflow: ellipsis; }
.ttf-pc[data-print] .ttf-furn > .ttf-furn-cp { grid-column: 3; opacity: 1; overflow: hidden; text-overflow: ellipsis; }
.ttf-pc[data-print] .ttf-furn > .ttf-pc-line { grid-column: 1 / -1; font-size: 2.2cqi; letter-spacing: .26em; }
.ttf-pc-site { display: inline; }
/* 1.6.0: the app's name on an open card links to the app. The box reaches past the small type for a finger. */
.ttf-pc .ttf-pc-line a.ttf-pc-app { position: relative; border: 0; color: inherit; text-decoration: underline; text-decoration-thickness: .12em; text-underline-offset: .28em; }
.ttf-pc .ttf-pc-line a.ttf-pc-app::after { content: ""; position: absolute; inset: -3cqi -1.5cqi; border: 0; background: none; }
@container ttf (width >= 240px) {
  .ttf-pc[data-print] .ttf-face:has(> .ttf-furn) .ttf-credit { display: block !important; }
}
/* Mid, 150 to 239: chip, stamp, name, sub line, collector number. No credit, no fact. */
@container ttf (width < 240px) {
  .ttf-pc.ttf-front .ttf-art { height: 116.667cqi; }
  .ttf-pc.ttf-front .ttf-chip { height: 10cqi; padding: 0 1.333cqi 0 2.667cqi; gap: 2cqi; font-size: 4.167cqi; letter-spacing: .12em; }
  .ttf-pc.ttf-front .ttf-chip::before { width: 4cqi; height: 4cqi; box-shadow: 0 0 0 .267cqi var(--sf); }
  .ttf-pc-stamp { bottom: 3cqi; width: 36.667cqi; height: 27.5cqi; }
  .ttf-pc-stamp .ttf-pc-fields text, .ttf-pc-stamp .ttf-pc-fields path { display: none; }
  .ttf-pc-stamp .ttf-pc-bare { display: inline; }
  .ttf-pc-wl { height: 3.333cqi; }
  .ttf-pc.ttf-front .ttf-plate { height: 53.333cqi; }
  .ttf-pc-nm[data-tier="full"] { display: none; }
  .ttf-pc-nm[data-tier="mid"] { display: block; }
  .ttf-pc.ttf-front .ttf-sub { display: block !important; bottom: 2.99cqi; font-size: 4.5cqi; letter-spacing: .16em; }
  .ttf-pc.ttf-front .ttf-fact { display: none; }
  .ttf-pc[data-print] .ttf-furn { grid-template-columns: auto minmax(0, 1fr); margin: 0; padding: 3cqi 0 0; border-top: 0; }
  .ttf-pc[data-print] .ttf-furn > .ttf-furn-no { font-size: 5.667cqi; }
  .ttf-pc[data-print] .ttf-furn > .ttf-furn-cr, .ttf-pc[data-print] .ttf-furn > .ttf-furn-cp, .ttf-pc-site { display: none; }
  .ttf-pc[data-print] .ttf-furn > .ttf-pc-line { grid-column: 2; grid-row: 1; justify-self: end; font-size: 3.833cqi; letter-spacing: .2em; }
}
/* Small, under 150: stamp and name, up to two fitted lines. Collected prints the whole name band Stock. */
@container ttf (width < 150px) {
  .ttf-pc .ttf-card { padding: 3.333cqi 3.333cqi 0; }
  .ttf-pc.ttf-front .ttf-art { height: 105.333cqi; }
  .ttf-pc-stamp { width: 44.667cqi; height: 33.5cqi; }
  .ttf-pc-wl { height: 4cqi; }
  .ttf-pc.ttf-front .ttf-plate { height: 71.667cqi; }
  .ttf-pc-nm[data-tier="mid"] { display: none; }
  .ttf-pc-nm[data-tier="small"] { display: block; }
  .ttf-pc.ttf-front .ttf-sub { display: none !important; }
  .ttf-pc[data-print] .ttf-furn { display: none; }
  .ttf-pc.ttf-front[data-held="true"] .ttf-plate { background: var(--sf); box-shadow: inset 0 -1cqi 0 var(--ink); }
  .ttf-pc.ttf-front[data-held="true"] .ttf-pc-nm text { fill: var(--ink); }
}

/* The back: head 118, body, foot 59 */
.ttf-pc-head { position: relative; z-index: 2; flex: none; height: 39.333cqi; background: var(--ink); color: var(--sf); }
.ttf-pc-head .ttf-chip { top: 4.167cqi; left: 4cqi; max-width: calc(100% - 25cqi); padding: 0; background: none; white-space: nowrap; overflow: hidden; }
.ttf-pc-head .ttf-bk-sub {
  position: absolute; left: 4cqi; right: 4cqi; bottom: 2.207cqi; margin: 0; color: var(--sf);
  font: 600 3.067cqi/1 var(--pc-jo); letter-spacing: .24em; text-transform: uppercase;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ttf-pc-head > .ttf-bk-act { position: absolute; z-index: 3; top: 2.333cqi; right: 2.667cqi; }
.ttf-pc .ttf-bk-body { padding: 1.667cqi 4cqi 4cqi; gap: 0; }
.ttf-pc-k { font: 600 2.667cqi/1 var(--pc-jo); letter-spacing: .22em; text-transform: uppercase; color: var(--ink); }
.ttf-pc-find {
  flex: none; display: flex !important; align-items: baseline; gap: 2cqi;
  padding: 0 0 1.933cqi; border-bottom: .533cqi solid var(--ink);
}
.ttf-pc-find > .ttf-pc-k { flex: none; min-width: 29.333cqi; }
.ttf-pc-date, .ttf-pc-no { flex: none; font: 800 6.333cqi/1 var(--pc-bs); font-variation-settings: "opsz" 72; color: var(--pc-strike); white-space: nowrap; }
.ttf-pc-no { margin-left: auto; font-weight: 900; }
.ttf-pc-find.is-not { padding-top: 3.6cqi; }
.ttf-pc-dash { flex: 1; align-self: center; height: 0; border-top: .267cqi dashed var(--ink); }
.ttf-pc-app {
  flex: none; padding: 4.3cqi 0 2.6cqi; text-align: right; border-bottom: .2cqi solid var(--ink);
  font: 600 2.667cqi/1 var(--pc-jo); letter-spacing: .18em; text-transform: uppercase;
}
.ttf-pc .ttf-bk-stats { flex: none; display: block !important; padding: 1.367cqi 0 4.567cqi; border-top: 0; border-bottom: .2cqi solid var(--ink); }
.ttf-pc .ttf-cell { display: grid !important; grid-template-columns: 30.667cqi 1fr; align-items: center; min-height: 7cqi; padding: 0; }
.ttf-pc .ttf-cell + .ttf-cell::before { display: none; }
.ttf-pc .ttf-cell-k {
  display: block !important; margin: 0; text-align: right; color: var(--ink);
  font: 600 2.6cqi/1.1 var(--pc-jo); letter-spacing: .14em; text-transform: uppercase;
}
.ttf-pc .ttf-cell-v {
  align-self: stretch; display: flex; align-items: center; margin-left: 2.667cqi; padding-left: 3.333cqi; border-left: .267cqi solid var(--ink);
  font: 700 4.667cqi/1.05 var(--pc-bs); font-variation-settings: "opsz" 72; text-transform: uppercase; color: var(--ink);
}
.ttf-pc-bar { flex: none; width: var(--pc-w, 0); height: 3cqi; max-width: 100%; border-radius: .5cqi; background: var(--pc-rule); }
.ttf-pc .ttf-bk-text { flex: none; margin-top: 2.167cqi; font: 400 3.6cqi/4.867cqi var(--pc-jo); color: var(--ink); }
.ttf-pc-locked {
  position: relative; flex: none; display: flex !important; flex-direction: column; gap: 2.2cqi;
  min-height: 18cqi; margin-top: 3.167cqi;
}
.ttf-pc-locked > .ttf-pc-bar { height: 2.667cqi; }
.ttf-pc-lock {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  width: 70.667cqi; min-height: 14.667cqi; padding: 2cqi 3.333cqi; box-sizing: border-box;
  display: grid !important; grid-template-columns: 8cqi 1fr; column-gap: 2.667cqi; row-gap: 1.6cqi; align-items: center;
  background: var(--sf); border: .4cqi solid var(--ink); border-radius: 2cqi; color: var(--ink);
}
.ttf-pc-lock > svg.ttf-ic { grid-row: 1 / span 2; width: 8cqi; height: 8cqi; stroke-width: 2; }
.ttf-pc-lock > .ttf-pc-k { font-size: 2.8cqi; font-weight: 700; letter-spacing: .14em; }
.ttf-pc-away { font: 600 2.533cqi/1 var(--pc-jo); letter-spacing: .16em; text-transform: uppercase; }
.ttf-pc-away b { display: inline; margin-right: .4em; font: 800 4.333cqi/1 var(--pc-bs); font-variation-settings: "opsz" 72; letter-spacing: 0; color: var(--pc-strike); }
.ttf-pc .ttf-bk-credit {
  flex: none; margin-top: 3cqi; padding: 0; border: 0; color: var(--ink); overflow-wrap: anywhere;
  font: 600 2.333cqi/1.35 var(--pc-jo); letter-spacing: .1em; text-transform: uppercase;
}
.ttf-pc-inset { flex: none; margin-top: 2.333cqi; }
.ttf-pc-map { position: relative; height: 32cqi; overflow: hidden; background: var(--ink); }
.ttf-pc-map > * { position: absolute; inset: 0; width: 100%; height: 100%; }
.ttf-pc-map .ttf-img { object-fit: cover; }
.ttf-pc-cap { margin-top: 1.967cqi; font: 700 2.333cqi/1.2 var(--pc-jo); letter-spacing: .12em; text-transform: uppercase; color: var(--ink); }
.ttf-pc-foot {
  position: relative; flex: none; display: grid !important; grid-template-columns: 1fr auto; align-content: start;
  height: 19.667cqi; padding: 3.4cqi 4cqi 0; border-top: .533cqi solid var(--ink); color: var(--ink); row-gap: 3.933cqi;
}
.ttf-pc .ttf-pc-foot > .ttf-furn-no { grid-column: 1; grid-row: 1; font: 800 5.667cqi/1 var(--pc-bs); letter-spacing: 0; font-variation-settings: "opsz" 72; }
.ttf-pc .ttf-pc-foot > .ttf-furn-cp {
  grid-column: 1 / span 2; grid-row: 2; margin: 0; opacity: 1; font: 600 2.333cqi/1 var(--pc-jo); letter-spacing: .18em; text-transform: uppercase;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ttf-pc-punch {                                 /* punched on site: the hole, filled once collected */
  grid-column: 2; grid-row: 1 / span 2; align-self: center; margin-top: 2cqi; display: flex !important; align-items: center; gap: 2cqi; margin-right: -.333cqi;
  font: 600 2.333cqi/1 var(--pc-jo); letter-spacing: .14em; text-transform: uppercase; white-space: nowrap;
}
.ttf-pc-punch::after { content: ''; flex: none; width: 4.667cqi; height: 4.667cqi; border-radius: 50%; border: .4cqi dashed var(--ink); background: var(--sf); }
.ttf-pc-punch[data-on]::after { border-style: solid; background: var(--ink); }
</style>
