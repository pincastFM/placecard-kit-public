/**
 * The table's state: the shared mechanics, the same at every table whichever design draws it.
 * No markup and no motion: the table component draws the
 * chrome and runs the bloom, flip and snap; this keeps what they read.
 *
 *   const t = useTtTable(collection, { key: 'tt_viewer' })   // { apps, sets, rarities, cards }
 *   onMounted(t.restore)                                      // the stored slider, group and sort
 *   t.measure(el.clientWidth)                                 // from a ResizeObserver
 *   t.groups.value, t.countLabel.value, t.cardW.value
 *
 * - Filters: From, Set, Rarity, Kind, Interests (lists of ids, empty is all), Missing, search, and the table's own
 *   `only` (options.only, a test on a card, switched by filter.only: the Selection's "In hand").
 *   Not kept between visits.
 * - Sort and Group: kept. A new grouping spreads every pile, unless all were stacked (then all stay).
 *   options.groups names the groupings a table offers (the Selection: kind, rarity, none) and
 *   options.group its first one; a stored grouping the table does not offer is ignored.
 * - Piles: a group's id is stacked or not; a search spreads them all while it runs. options.stacked
 *   opens the table with every pile stacked, once its groups first exist (about 12 piles on a phone
 *   instead of 600 faces).
 * - Slider: the width is kept per layout (phone, laptop), so a laptop's 240 does not open a phone at
 *   one across. On input the table calls inputW (nothing stored); on release snapTo gives the stop to
 *   ease to, and commitW stores it. Defaults 111 on a phone, 150 on a laptop; options.widths
 *   sets a table's own (Card room opens a laptop at 176).
 * - Open card: open(id), step(+1 or -1) walks the row as the table lays it out (group by group, each
 *   in the sort), row gives "3 / 10".
 * - Nest (options.nest): a held card with children (ttNest) is a set one level under it.
 *   openNest(id) scopes the table to it, the parent first, then its children in the record's order;
 *   prev and next walk that row; closeNest() goes back. Not kept between visits, and the filters,
 *   group, sort, piles and width are left as they were.
 * Storage goes through utils/safeStorage.js and is read only by restore(), so the server render and
 * the first client render agree; nothing is written before restore().
 */
import { ref, reactive, computed, watch, toValue } from 'vue'
import { ttFilter, ttSort, ttPin, ttGroup, ttFacets, ttCounts, ttCountLabel, ttRow, ttRange, ttClampW, ttStops, ttSnap, ttAcross, ttAcrossStops, ttPileSeed, ttNest, TT_STOPS } from '../core/core.js'
import { safeLocal } from '../core/safeStorage.js'
import { TT_FACET_IDS } from '../core/tabletop.js'

export const TT_GROUPS = Object.freeze([
  { id: 'set', label: 'Set' }, { id: 'app', label: 'App' }, { id: 'kind', label: 'Kind' }, { id: 'rarity', label: 'Rarity' }, { id: 'none', label: 'None' },
])
export const TT_SORTS = Object.freeze([
  { id: 'newest', label: 'Newest' }, { id: 'rarest', label: 'Rarest' }, { id: 'name', label: 'Name' }, { id: 'number', label: 'Number' },
])
export const TT_DEFAULT_W = Object.freeze({ phone: 111, laptop: 150 })
// The table's inner width from which it is a laptop: a 960 px window less the 32 px gutters
export const TT_WIDE_AT = 896
const PHONE_INNER = 366   // a 390 phone less 12 px gutters, until the table is measured
const FACETS = TT_FACET_IDS   // from, set, rarity, kind, interests
const ok = (list, v) => list.some(x => x.id === v)

/**
 * data: the collection { apps, sets, rarities, cards } (object, ref or getter; null while loading).
 * options.key: the storage key (one per table: the Viewer, the Selection). options.gap: the grid gap
 * in px (the direction's token). options.wide: force the layout (boolean, ref or getter); default
 * from the measured width. options.store: { get, set } over strings (tests). options.only: card =>
 * boolean, the table's own filter (the Selection: card => hand.has(card.ref.key, card.ref.kind));
 * it reads live state, so the shown cards follow it; filter.only turns it on. options.groups: the
 * grouping ids offered (default all of TT_GROUPS); options.group: the first one (default the first
 * offered); options.stacked: open with every pile stacked; options.widths: { phone, laptop }, the
 * widths a first visit opens at (default TT_DEFAULT_W).
 * Both unused by Provo, so its table is as it was: options.stops: { across: [3, 2] }, the
 * slider's stops at the widths that lay exactly that many a row (ttAcrossStops), in place of
 * TT_STOPS; options.pin: card ids shown first, in that order, after the sort (the Overstory).
 * options.groupLabels: { [group id]: label }, an app's words for the Group segment (Treehopper's
 * { none: 'Found', set: 'Sets' }); an id it does not name keeps TT_GROUPS' label.
 * options.nest: true reads card.children (ttNest) as each held card's set; off (the default),
 * children are ignored and every card is a single card, as before.
 * For createTabletop's sorts and filters.facets: options.sorts: the sort ids offered (default all of TT_SORTS),
 * as sortOptions; the first sort is newest when offered, else the first offered; setSort and a stored sort take
 * only an offered one. options.facets: the facet ids offered (default all), as facetOptions; toggleFacet takes only
 * an offered one, and TtTable draws chips for those alone. Unset, both are as before.
 */
export function useTtTable(data, { key = 'tt_table', gap = 8, wide = null, store = safeLocal, only = null, groups: groupIds = null, group: firstGroup = null, stacked: openStacked = false, widths = TT_DEFAULT_W, stops: stopsOpt = null, pin = null, groupLabels = null, nest: nestOpt = false, sorts: sortIds = null, facets: facetIds = null } = {}) {
  const meta = computed(() => toValue(data) || {})
  const cards = computed(() => (Array.isArray(meta.value.cards) ? meta.value.cards : []))

  // ── Filters, sort, groups
  const filter = reactive({ from: [], set: [], rarity: [], kind: [], interests: [], missing: false, q: '', only: false })
  const onlyOn = computed(() => !!filter.only && typeof only === 'function')
  const sortOptions = Array.isArray(sortIds) && sortIds.length
    ? Object.freeze(sortIds.map(id => TT_SORTS.find(s => s.id === id)).filter(Boolean))
    : TT_SORTS
  const facetOptions = Array.isArray(facetIds) ? Object.freeze(FACETS.filter(f => facetIds.includes(f))) : FACETS
  const sort = ref(ok(sortOptions, 'newest') ? 'newest' : (sortOptions[0] || TT_SORTS[0]).id)
  const offered = Array.isArray(groupIds) && groupIds.length
    ? Object.freeze(groupIds.map(id => TT_GROUPS.find(g => g.id === id)).filter(Boolean))
    : TT_GROUPS
  const relabel = g => (groupLabels && typeof groupLabels[g.id] === 'string' && groupLabels[g.id] ? Object.freeze({ ...g, label: groupLabels[g.id] }) : g)
  const groupOptions = groupLabels ? Object.freeze(offered.map(relabel)) : offered
  const groupBy = ref(ok(groupOptions, firstGroup) ? firstGroup : (groupOptions[0] || TT_GROUPS[0]).id)
  const facets = computed(() => ttFacets(cards.value, meta.value))
  const shown = computed(() => {
    const list = ttFilter(cards.value, filter)
    const sorted = ttSort(onlyOn.value ? list.filter(c => only(c)) : list, sort.value, meta.value)
    return Array.isArray(pin) && pin.length ? ttPin(sorted, pin) : sorted
  })
  const groups = computed(() => ttGroup(shown.value, groupBy.value, { ...meta.value, cards: cards.value, filter: { missing: filter.missing } }))
  const counts = computed(() => ttCounts(shown.value))
  // The held cards the filter leaves with Missing set aside; under Missing alone ('only') the
  // table shows the gaps, and the head and the label keep this count
  const heldCount = computed(() => {
    const list = ttFilter(cards.value, { ...filter, missing: false })
    return (onlyOn.value ? list.filter(c => only(c)) : list).length
  })
  const countLabel = computed(() => (filter.missing === 'only'
    ? ttCountLabel({ cards: heldCount.value, missing: counts.value.missing }, true)
    : ttCountLabel(counts.value, !!filter.missing)))
  const searching = computed(() => !!String(filter.q || '').trim())
  const filtering = computed(() => FACETS.some(f => filter[f].length) || !!filter.missing || searching.value || onlyOn.value)

  function toggleFacet(kind, id) {
    if (!facetOptions.includes(kind)) return
    const v = String(id)
    filter[kind] = filter[kind].includes(v) ? filter[kind].filter(x => x !== v) : [...filter[kind], v]
  }
  function clearFilters() {
    for (const f of FACETS) filter[f] = []
    filter.missing = false
    filter.q = ''
    filter.only = false
  }

  // ── Piles
  const stacked = ref({})
  const isStacked = id => !searching.value && !!stacked.value[id]
  const allStacked = computed(() => groups.value.length > 0 && groups.value.every(g => isStacked(g.id)))
  const stackIds = ids => Object.fromEntries(ids.map(id => [id, true]))
  function stack(id) { stacked.value = { ...stacked.value, [id]: true } }
  function spread(id) { const s = { ...stacked.value }; delete s[id]; stacked.value = s }
  function toggleAll() { stacked.value = allStacked.value ? {} : stackIds(groups.value.map(g => g.id)) }
  // options.stacked: every pile stacked the first time there are piles (the data may load later)
  let stackPending = !!openStacked
  watch(() => groups.value.length, (n) => {
    if (!stackPending || !n) return
    stackPending = false
    stacked.value = stackIds(groups.value.map(g => g.id))
  }, { immediate: true })
  const group = computed({
    get: () => groupBy.value,
    set: (g) => {
      if (!ok(groupOptions, g) || g === groupBy.value) return
      const wasAll = allStacked.value
      groupBy.value = g
      stacked.value = wasAll ? stackIds(groups.value.map(x => x.id)) : {}
    },
  })

  // ── Slider
  const innerWidth = ref(0)
  const gapPx = ref(gap)
  const layout = computed(() => {
    const w = toValue(wide)
    if (w != null) return w ? 'laptop' : 'phone'
    return innerWidth.value >= TT_WIDE_AT ? 'laptop' : 'phone'
  })
  const range = computed(() => ttRange(innerWidth.value || PHONE_INNER, gapPx.value))
  const savedW = ref({ phone: null, laptop: null })
  const want = ref(null)   // { layout, w }: this visit's width, only for the layout it was set on
  const live = computed(() => (want.value && want.value.layout === layout.value ? want.value.w : null))
  const cardW = computed(() => ttClampW(live.value ?? savedW.value[layout.value] ?? (widths && widths[layout.value]) ?? TT_DEFAULT_W[layout.value], range.value))
  const stopList = computed(() => (stopsOpt && Array.isArray(stopsOpt.across)
    ? ttAcrossStops(innerWidth.value || PHONE_INNER, gapPx.value, stopsOpt.across)
    : TT_STOPS))
  const stops = computed(() => ttStops(range.value, stopList.value))
  const across = computed(() => ttAcross(cardW.value, innerWidth.value || PHONE_INNER, gapPx.value))
  const vars = computed(() => ({ '--card-w': `${cardW.value}px`, '--gap': `${gapPx.value}px` }))

  // ── Nest: a held card's set, one level under it
  const nestOn = !!nestOpt
  const nests = computed(() => {
    const m = new Map()
    const errors = []
    if (!nestOn) return { m, errors }
    for (const c of cards.value) {
      if (!c || c.held === false || m.has(c.id)) continue
      const r = ttNest(c)
      if (r.error) errors.push(`${c.id}: ${r.error}`)
      else if (r.cards.length) m.set(c.id, r)
    }
    return { m, errors }
  })
  // a bad set is drawn as the card alone and named once
  const told = new Set()
  watch(() => nests.value.errors, (list) => {
    for (const e of list) if (!told.has(e)) { told.add(e); console.error(`useTtTable: no set for ${e}`) }
  }, { immediate: true })
  const nestOf = c => (nestOn && c && c.held !== false ? nests.value.m.get(c.id) || null : null)
  const nest = ref(null)
  const nestCard = computed(() => (nest.value == null ? null : cards.value.find(c => c && c.id === nest.value && c.held !== false) || null))
  const nestCards = computed(() => { const r = nestCard.value && nestOf(nestCard.value); return r ? [nestCard.value, ...r.cards] : [] })
  const nestCount = computed(() => { const r = nestCard.value && nestOf(nestCard.value); return r ? { n: r.cards.length, of: r.total } : null })
  // a set the collection no longer holds closes (a reload); not while the collection is still empty
  watch(() => [nest.value, nestCards.value.length, cards.value.length], ([id, n, all]) => { if (id != null && all && !n) nest.value = null })

  // ── Open card
  const openId = ref(null)
  // the row as laid out: group by group, each in the sort (prev and next go to the card beside it);
  // inside a set, the set's own row
  const order = computed(() => (nestCards.value.length ? nestCards.value : groups.value.flatMap(g => g.cards)))
  const row = computed(() => ttRow(order.value, openId.value))
  const openCard = computed(() => (row.value.index >= 0 ? order.value[row.value.index] : null))
  function step(dir) {
    const n = dir > 0 ? row.value.next : row.value.prev
    if (n) openId.value = n.id
    return n || null
  }

  // ── Kept in this browser
  const ready = ref(false)
  function save() {
    if (!ready.value) return
    try {
      store.set(key, JSON.stringify({ v: 1, w: savedW.value, group: groupBy.value, sort: sort.value }))
    } catch { /* storage refused: the table still works */ }
  }
  function restore() {
    let s = null
    try { s = JSON.parse(store.get(key) || 'null') } catch { s = null }
    if (s && s.v === 1) {
      const w = s.w || {}
      const num = x => (Number.isFinite(x) && x >= 40 ? x : null)
      savedW.value = { phone: num(w.phone), laptop: num(w.laptop) }
      if (ok(groupOptions, s.group)) group.value = s.group
      if (ok(sortOptions, s.sort)) sort.value = s.sort
    }
    ready.value = true
  }
  watch([groupBy, sort], save)

  return {
    // what to draw
    cards, shown, groups, facets, counts, heldCount, countLabel, filtering, searching,
    // filters, sort, group
    filter, sort, group, setGroup: (g) => { group.value = g }, toggleFacet, clearFilters, toggleOnly: () => { filter.only = !filter.only }, groupOptions, sortOptions, facetOptions,
    setSort: (s) => { if (ok(sortOptions, s)) sort.value = s },
    // piles
    isStacked, allStacked, stack, spread, toggleAll, pileSeed: ttPileSeed,
    // slider
    innerWidth, layout, range, cardW, stops, across, vars,
    measure: (w, g) => { innerWidth.value = Math.max(0, Math.floor(Number(w) || 0)); if (g != null) gapPx.value = Number(g) || 0 },
    inputW: (v) => { want.value = { layout: layout.value, w: ttClampW(v, range.value) } },
    snapTo: v => ttSnap(v, range.value, stopList.value),
    commitW: (v) => {
      const w = ttClampW(v, range.value)
      want.value = { layout: layout.value, w }
      savedW.value = { ...savedW.value, [layout.value]: w }
      save()
    },
    // open card
    openId, openCard, row, order,
    open: (id) => { openId.value = id == null ? null : id },
    close: () => { openId.value = null },
    step,
    // nest: openNest returns false for a card with no set (or nests off), and leaves the table as it was
    nestOn, nestOf, nest, nestCard, nestCards, nestCount,
    openNest: (id) => {
      const c = cards.value.find(x => x && x.id === id)
      if (!c || !nestOf(c)) return false
      if (nest.value === id) return true
      openId.value = null
      nest.value = id
      return true
    },
    closeNest: () => { if (nest.value == null) return false; openId.value = null; nest.value = null; return true },
    // storage
    ready, restore,
  }
}
