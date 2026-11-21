/**
 * The day solver: the cards a visitor picked off the tabletop turned into a timed day. NYID's
 * handToDay (utils/tabletop/day.js) moved here, line for line, with one change:
 * the Provo deal's numbers, ranking and chip families come in as a DayRules object (rules.ts)
 * instead of imports, so any app's deal can drive it. With Provo's rules it returns what NYID's
 * returns, byte for byte (planner/test/day.test.ts against NYID's provo-day.json golden).
 *
 * The rules, as NYID wrote them:
 * - events at their own time: the night that falls on the window's date, joined late when it is
 *   already on at the start, held to two hours (the deal's cap);
 * - eat-family cards at the deal's meals whose chips take them, one card a meal (the best chip fit
 *   first); an eat card with no meal left is a stop in a gap, like a sight, never dropped;
 * - every other card in the gaps, nearest first from where the visitor is (the center at the start,
 *   then the slot before), an hour each (seeMin), ended early for a coming meal or event but never
 *   under half an hour.
 * Between two slots there is the walk (rules.walkMinutes), never less than rules.gap, and a start
 * after a walk rounds up to five minutes. The first slot starts at the window's start; the walk to
 * it from the center is still reported. Nothing overlaps and nothing passes the window's end; what
 * cannot fit is listed in `leftOver` with a reason.
 *
 * Hours: a place to see keeps the usual hours of its kind (rules.hours, by chip); a card's own
 * `hours` win. Its slot starts no earlier than it opens and ends by its close. In a gap, a card that
 * is open now comes before one that is not, and one that would close before the next hour comes
 * before the nearest. Meals keep the meal windows; events their own times.
 *
 * Two entries: dayCore keeps each slot's place and the straight-line meters walked to it, for the
 * record (solveDay, record.ts fromDay); handToDay returns NYID's shape exactly.
 */
import { fullRules } from './rules'
import type { DayRules, LatLng } from './rules'

// ── The hand (NYID utils/tabletop/hand.js handEntry, copied: the kit imports nothing of NYID's)
export interface HandEntry {
  key: string
  kind: 'card' | 'event'
}
const KINDS = ['card', 'event']

// An entry from a key or an { key, kind } object; null when it is not one.
export function handEntry(key: any, kind: string = 'card'): HandEntry | null {
  if (key && typeof key === 'object') return handEntry(key.key, key.kind || 'card')
  if (key == null || key === '' || !KINDS.includes(kind)) return null
  return { key: String(key), kind: kind as HandEntry['kind'] }
}

export interface DayWindow {
  date: string
  start: number    // minutes past midnight on the zone's clock
  hours?: number   // 4 when left out
}

export interface DayInput {
  hand?: any[]               // [{ key, kind: 'card' | 'event' }]; an event entry is the event's key
  cards?: any[]              // the zone's cards (the zone API's shape, or tabletop cards)
  events?: any[]             // the zone's events
  center?: LatLng | null     // where the day starts
  win?: DayWindow | null
  tz?: string                // default the rules'
  seed?: number              // the suggestions' draw
  fill?: boolean             // also suggest cards not in the hand, and one event
  interests?: string[]       // the suggestions' leaning
  hours?: Record<string, { from: number; to: number }> // default the rules'; {} turns them off
}

export interface DaySlot {
  kind: 'event' | 'eat' | 'see'
  key: string
  at: number
  dur: number
  label: string
  meal: string | null
  fromHand: boolean
  suggested: boolean
  alts: string[]
  idx: number
  clock: string
  walkMin: number
}

export interface DayLeftOver {
  key: string
  kind: 'card' | 'event'
  reason: string
}

export interface Day {
  slots: DaySlot[]
  leftOver: DayLeftOver[]
  totals: { stops: number; walkMin: number; m: number }
}

// A slot as the core keeps it: NYID's slot before its clock string, with the place and the
// straight-line meters walked to it from the slot before (the center for the first)
export interface CoreSlot extends Omit<DaySlot, 'clock'> {
  place: any
  m: number
}

export interface DayCore {
  win: DayWindow | null    // null: no window, nothing placed
  tz: string
  end: number | null       // the window's last minute
  center: LatLng | null
  slots: CoreSlot[]
  leftOver: DayLeftOver[]
  totals: { stops: number; walkMin: number; m: number }
}

const hasXY = (p: any) => !!p && p.lat != null && p.lng != null && Number.isFinite(+p.lat) && Number.isFinite(+p.lng)
const okHours = (h: any) => !!h && Number.isFinite(h.from) && Number.isFinite(h.to) && h.to > h.from

// A card as the day reads it: the zone API's shape as it is, or a tabletop card (NYID adapters.js
// ttFromZoneCard) through its ref, so a table can pass either.
function asCard(c: any): any {
  if (!c) return null
  if (c.ref && c.ref.key != null) {
    const r = c.ref
    return {
      key: String(r.key), title: c.title || '', chip: r.chip || c.chip || '', lat: r.lat, lng: r.lng,
      interests: Array.isArray(r.interests) ? r.interests : [], image: r.photo ? (r.art ? { url: r.photo, kind: 'art' } : { url: r.photo }) : null,
      hours: r.hours || c.hours || null,
    }
  }
  return c.key == null ? null : { ...c, key: String(c.key) }
}

/** The day for a hand, in NYID's shape: { slots, leftOver, totals }. */
export function handToDay(rules: DayRules, p: DayInput = {}): Day {
  const core = dayCore(rules, p)
  const clock = rules.clock
  return {
    slots: core.slots.map(({ place, m, walkMin, ...s }) => ({ ...s, clock: clock(s.at), walkMin })),
    leftOver: core.leftOver,
    totals: core.totals,
  }
}

/** The day for a hand, with each slot's place and meters kept for the record. */
export function dayCore(rules: DayRules, p: DayInput = {}): DayCore {
  const R = fullRules(rules)
  const {
    hand = [], cards = [], events = [], center = null, win, tz = R.tz, seed = 1, fill = false, interests = [], hours = R.hours,
  } = p || {}
  const MEALS = R.meals, GAP = R.gap, SEE_MIN = R.seeMin, ALTS = R.alts, SEE_CHIPS = R.seeChips, DAY_END = R.dayEnd
  const CHIP_FAMILY = R.chipFamily, EVENT_MAX = R.eventMax, MIN_SLOT = R.minSlot, MEAL_MIN = R.mealMin
  const STEP = R.step, AT_START_M = R.atStartM, L = R.labels
  const { occurrences, walkMinutes, meters, rng, rank, ring } = R

  const walk = (a: any, b: any) => (hasXY(a) && hasXY(b) ? walkMinutes(a, b) : 0)
  const dist = (a: any, b: any) => (hasXY(a) && hasXY(b) ? meters(a, b) : 0)
  // Time from one slot to the next: the walk, never under GAP.
  const travel = (a: any, b: any) => Math.max(GAP, walk(a, b))
  const up = (m: number) => Math.ceil(m / STEP) * STEP

  const entries: HandEntry[] = []
  for (const raw of hand || []) {
    const e = handEntry(raw)
    if (e && !entries.some(x => x.key === e.key && x.kind === e.kind)) entries.push(e)
  }
  const leftOver: DayLeftOver[] = []
  const miss = (e: { key: string; kind: 'card' | 'event' }, reason: string) => { leftOver.push({ key: e.key, kind: e.kind, reason }) }
  if (!win || !Number.isFinite(win.start)) {
    entries.forEach(e => miss(e, 'no window'))
    return { win: null, tz, end: null, center, slots: [], leftOver, totals: { stops: 0, walkMin: 0, m: 0 } }
  }
  const start = win.start
  const end = Math.min(DAY_END, start + (win.hours ?? 4) * 60)
  const list = (cards || []).map(asCard).filter(Boolean)
  const cardByKey = new Map<string, any>(list.map((c: any) => [c.key, c]))
  const evByKey = new Map<string, any>((events || []).map((e: any) => [String(e.key), e]))
  const want = interests || []
  // A card's hours: its own, else its chip's usual ones; null is open all day.
  const hoursOf = (x: any) => (okHours(x.hours) ? x.hours : okHours(((hours || {}) as any)[x.chip]) ? (hours as any)[x.chip] : null)
  const opensAt = (x: any) => hoursOf(x)?.from ?? 0
  const closesAt = (x: any) => hoursOf(x)?.to ?? Infinity

  // ── Fitting a card into a stretch of free time. A stretch is { t, prev, hasPrev, T, q }: free
  // from t, standing at prev (hasPrev: a slot came before, so walk first), until T, when the slot
  // at q (or the window's end, q null) begins.
  const arrive = (sg: any, x: any) => (sg.hasPrev ? up(sg.t + travel(sg.prev, x)) : sg.t)
  const limit = (sg: any, x: any) => sg.T - (sg.q ? travel(x, sg.q) : 0)
  const crosses = (m: any) => Math.max(m.from, start) < m.to - MIN_SLOT && Math.max(m.from, start) + MIN_SLOT <= end
  function fitMeal(sg: any, m: any, x: any) {
    const at = Math.max(arrive(sg, x), m.meal.from)
    if (at >= m.meal.to - MIN_SLOT) return null
    const dur = Math.min(MEAL_MIN, limit(sg, x) - at)
    return dur >= MIN_SLOT ? { at, dur } : null
  }
  // A place to see; with a meal coming in this stretch, ended in time to walk to it.
  function fitSee(sg: any, x: any, bound: any) {
    const at = Math.max(arrive(sg, x), opensAt(x))
    let lim = Math.min(limit(sg, x), closesAt(x))
    if (bound) lim = Math.min(lim, bound.meal.from - travel(x, bound.card))
    const dur = Math.min(SEE_MIN, lim - at)
    return dur >= MIN_SLOT ? { at, dur } : null
  }
  // The earliest a pending meal could start: closed once that is past its window or the day.
  function closed(sg: any, m: any) {
    const at = Math.max(m.card ? arrive(sg, m.card) : (sg.hasPrev ? up(sg.t + GAP) : sg.t), m.meal.from)
    return at >= m.meal.to - MIN_SLOT || at + MIN_SLOT > end
  }
  function take(sg: any, out: any[], got: any, m: any) {
    const x = got.card
    const fam = CHIP_FAMILY[x.chip]
    out.push({
      kind: m || fam === 'eat' ? 'eat' : 'see', key: x.key, at: got.at, dur: got.dur,
      label: m ? m.meal.label : fam === 'eat' ? L.eat : fam === 'stay' ? L.stay : L.see,
      meal: m ? m.meal.id : null, fromHand: got.hand, suggested: !got.hand, alts: got.alts, idx: 0, place: x,
    })
    sg.t = got.at + got.dur
    sg.prev = x
    sg.hasPrev = true
  }
  // Fill one stretch, slot by slot: the next meal when its window is open, else a place to see
  // (ended for the coming meal), else the meal at its window's opening. pick chooses the cards.
  function fillStretch(sg: any, pending: any[], failed: any[], pick: any, out: any[]) {
    for (;;) {
      while (pending.length && closed(sg, pending[0])) failed.push(pending.shift())
      const m = pending.length && pending[0].meal.from < sg.T ? pending[0] : null
      let bound = m
      if (m && arrive(sg, m.card) >= m.meal.from) {
        const got = pick.meal(sg, m)
        if (got) { take(sg, out, got, m); pending.shift(); continue }
        bound = null // no room before this stretch ends; it may still fit after it
      }
      const got = pick.see(sg, bound)
      if (got) { take(sg, out, got, null); continue }
      if (bound) {
        const meal = pick.meal(sg, bound)
        if (meal) { take(sg, out, meal, bound); pending.shift(); continue }
      }
      return
    }
  }

  // ── 1. Events at their own time, first in the hand first; a later one that clashes is left out.
  const fixed: any[] = []
  entries.forEach((e) => {
    if (e.kind !== 'event') return
    const ev = evByKey.get(e.key)
    if (!ev) return miss(e, 'no longer listed')
    const nights = occurrences([ev], tz).filter(o => o.date === win.date)
    if (!nights.length) return miss(e, 'not on this day')
    const o = nights.find(n => n.at < end - MIN_SLOT && n.at + n.dur > start + MIN_SLOT)
    if (!o) return miss(e, 'outside these hours')
    const at = Math.max(start, o.at)
    const dur = Math.min(o.at + o.dur - at, EVENT_MAX, end - at)
    if (dur < MIN_SLOT) return miss(e, 'outside these hours')
    const clash = fixed.find(f => at < f.at + f.dur + travel(f.place, ev) && f.at < at + dur + travel(ev, f.place))
    if (clash) return miss(e, `clashes with ${clash.place.title || clash.key}`)
    fixed.push({ kind: 'event', key: e.key, at, dur, label: L.event, meal: null, fromHand: true, suggested: false, alts: [e.key], idx: 0, place: ev })
  })
  fixed.sort((a, b) => a.at - b.at)

  // ── 2. Cards: eat-family cards try the meals; the rest wait for the gaps.
  const eats: any[] = [], others: any[] = []
  entries.forEach((e, i) => {
    if (e.kind !== 'card') return
    const c = cardByKey.get(e.key)
    if (!c) return miss(e, 'no longer listed')
    ;(CHIP_FAMILY[c.chip] === 'eat' ? eats : others).push({ c, i })
  })
  // Each meal the window crosses takes the hand's best fit for its chips (the hand's order breaks a tie).
  function assignMeals(blocked: Set<string>) {
    const rest = [...eats], meals: any[] = []
    for (const meal of MEALS) {
      if (blocked.has(meal.id) || !crosses(meal)) continue
      let best = -1, fit = Infinity
      rest.forEach((it, j) => { const f = meal.chips.indexOf(it.c.chip); if (f >= 0 && f < fit) { best = j; fit = f } })
      if (best >= 0) meals.push({ meal, card: rest.splice(best, 1)[0].c })
    }
    return { meals, rest }
  }
  const handPick = (left: any[]) => ({
    meal: (sg: any, m: any) => { const f = fitMeal(sg, m, m.card); return f ? { card: m.card, alts: [m.card.key], hand: true, ...f } : null },
    see(sg: any, bound: any) {
      // Open now first, then one that would close before the next hour, then the nearest.
      const shut = (x: any) => (opensAt(x) > arrive(sg, x) ? 1 : 0)
      const soon = (x: any) => (closesAt(x) - MIN_SLOT < sg.t + SEE_MIN + GAP ? 0 : 1)
      const order = [...left].sort((a, b) => shut(a.c) - shut(b.c) || soon(a.c) - soon(b.c) || dist(sg.prev, a.c) - dist(sg.prev, b.c) || a.i - b.i)
      for (const it of order) {
        const f = fitSee(sg, it.c, bound)
        if (f) { left.splice(left.indexOf(it), 1); return { card: it.c, alts: [it.c.key], hand: true, ...f } }
      }
      return null
    },
  })
  // The day between the events, stretch by stretch.
  function plan(meals: any[], pool: any[]) {
    const out = fixed.map(f => ({ ...f }))
    const pending = [...meals], failed: any[] = [], left = [...pool]
    const pick = handPick(left)
    let cur: any = { t: start, prev: center, hasPrev: false }
    for (const f of [...fixed, null]) {
      const sg = { ...cur, T: f ? f.at : end, q: f ? f.place : null }
      fillStretch(sg, pending, failed, pick, out)
      cur = f ? { t: f.at + f.dur, prev: f.place, hasPrev: true } : sg
    }
    return { out, failed: [...failed, ...pending], left }
  }
  // A meal its card cannot reach (events fill its hours) is set aside and the day planned again,
  // so that card tries another meal or a gap. At most one round a meal.
  const blocked = new Set<string>()
  let res: any
  for (let round = 0; round <= MEALS.length; round++) {
    const { meals, rest } = assignMeals(blocked)
    res = plan(meals, [...others, ...rest].sort((a, b) => a.i - b.i))
    if (!res.failed.length) break
    res.failed.forEach((m: any) => blocked.add(m.meal.id))
  }
  const slots: any[] = res.out
  const byIndex = new Map(entries.map((e, i) => [`${e.kind}:${e.key}`, i]))
  // Left over: closed for the whole window, or open but out of time.
  const shutAll = (x: any) => Math.min(end, closesAt(x)) - Math.max(start, opensAt(x)) < MIN_SLOT
  res.left.forEach((it: any) => miss({ key: it.c.key, kind: 'card' }, shutAll(it.c) ? 'closed in these hours' : 'no time left'))
  res.failed.forEach((m: any) => miss({ key: m.card.key, kind: 'card' }, 'no time left'))

  // ── 3. Suggestions for the gaps, from cards not in the hand, drawn as the deal draws.
  if (fill) {
    const used = new Set(entries.filter(e => e.kind === 'card').map(e => e.key))
    const taken = new Set(slots.filter(s => s.meal).map(s => s.meal))
    const free = MEALS.filter(m => !taken.has(m.id) && crosses(m)).map(meal => ({ meal, card: null }))
    // Never the place the day starts from (the BYU Conference Center card at Provo): a hand may hold it.
    const pool = list.filter((c: any) => hasXY(c) && !used.has(c.key) && !(hasXY(center) && dist(c, center) < AT_START_M))
    const lean = (cs: any[]) => {
      if (!want.length) return cs
      const pref = cs.filter(c => (c.interests || []).some((t: string) => want.includes(t)))
      return pref.length >= 3 ? pref : cs
    }
    let n = 0
    function draw(sg: any, chips: string[], fit: (c: any) => any) {
      const rand = rng(seed * 7919 + n * 104729)
      const from = hasXY(sg.prev) ? sg.prev : hasXY(center) ? center : { lat: 0, lng: 0 }
      const cs = lean(pool.filter((c: any) => chips.includes(c.chip) && !used.has(c.key)))
      const ranked = rank(ring(cs, from, ALTS * 2), from, rand, want, chips === SEE_CHIPS ? [] : chips)
      const fits: any[] = []
      for (const c of ranked) {
        const f = fit(c)
        if (f) fits.push({ c, f })
        if (fits.length >= ALTS) break
      }
      if (!fits.length) return null
      n++
      const alts = fits.map(x => x.c.key)
      alts.forEach(k => used.add(k))
      return { card: fits[0].c, alts, hand: false, ...fits[0].f }
    }
    const fillPick = {
      meal: (sg: any, m: any) => draw(sg, m.meal.chips, c => fitMeal(sg, m, c)),
      see: (sg: any, bound: any) => draw(sg, SEE_CHIPS, c => fitSee(sg, c, bound)),
    }
    // One event a day, as the deal deals it: when the hand placed none, the first event that fits a
    // free stretch of the window, its alternates the events on at the same time, leaning to the
    // interests. It goes in before the sights and meals, which then fill around it.
    if (!slots.some(s => s.kind === 'event')) {
      const held = new Set(entries.filter(e => e.kind === 'event').map(e => e.key))
      const fits: any[] = []
      for (const o of occurrences(events || [], tz)) {
        const ev = evByKey.get(String(o.key))
        if (!ev || o.date !== win.date || held.has(String(o.key))) continue
        const at = Math.max(start, o.at)
        const dur = Math.min(o.at + o.dur - at, EVENT_MAX, end - at)
        if (dur < MIN_SLOT) continue
        if (slots.some(x => at < x.at + x.dur + travel(x.place, ev) && x.at < at + dur + travel(ev, x.place))) continue
        fits.push({ key: String(o.key), ev, at, dur, interests: o.interests || [] })
      }
      if (fits.length) {
        fits.sort((a, b) => a.at - b.at)
        const first = fits[0]
        const rand = rng(seed * 7919 + 7)
        const seen = new Set<string>()
        const live = fits.filter(f => f.at < first.at + first.dur && f.at + f.dur > first.at && !seen.has(f.key) && seen.add(f.key))
          .map(f => ({ f, w: (want.length && f.interests.some((t: string) => want.includes(t)) ? 2 : 1) * (0.5 + rand()) }))
          .sort((a, b) => b.w - a.w).map(x => x.f).slice(0, ALTS)
        const ev = live[0]
        slots.push({
          kind: 'event', key: ev.key, at: ev.at, dur: ev.dur, label: L.event, meal: null,
          fromHand: false, suggested: true, alts: live.map(f => f.key), idx: 0, place: ev.ev,
        })
      }
    }
    const timeline = [...slots].sort((a, b) => a.at - b.at)
    const added: any[] = []
    let cur: any = { t: start, prev: center, hasPrev: false }
    for (const s of [...timeline, null]) {
      const T = s ? s.at : end
      if (T - cur.t >= SEE_MIN) fillStretch({ ...cur, T, q: s ? s.place : null }, free, [], fillPick, added)
      if (s) cur = { t: s.at + s.dur, prev: s.place, hasPrev: true }
    }
    slots.push(...added)
  }

  // ── 4. In time order, with the walk to each slot from the one before (the center for the first).
  slots.sort((a, b) => a.at - b.at)
  let prev: any = center, walkSum = 0, mSum = 0
  const done: CoreSlot[] = slots.map((s) => {
    const w = walk(prev, s.place)
    const d = dist(prev, s.place)
    walkSum += w
    mSum += d
    prev = s.place
    return { ...s, walkMin: w, m: d }
  })
  leftOver.sort((a, b) => (byIndex.get(`${a.kind}:${a.key}`) ?? 0) - (byIndex.get(`${b.kind}:${b.key}`) ?? 0))
  return { win, tz, end, center, slots: done, leftOver, totals: { stops: done.length, walkMin: walkSum, m: Math.round(mSum) } }
}
