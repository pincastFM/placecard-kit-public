/**
 * Where the zone map's walk discs and event squares sit (2026-10-27). Pure JS: no Vue, no map.
 *
 * A walk disc is pinned: it stays on its stop, because the walk's route runs through it. Events that
 * would touch one another at this zoom form a row on their middle, in the order given (time). Each
 * row then takes the nearest open spot within a square and a half of its place: on it when nothing
 * is there, else sideways, down or up, so no square covers a disc or another square. A row with no
 * open spot that near folds into a stack (the first event on top, the rest just behind it), which
 * opens into its row again when the map zooms in. A lone square or a stack with no open spot that
 * near looks out to three squares. The biggest rows go first.
 */

const hasXY = p => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
const RAD = Math.PI / 180, R = 6371008.8

/**
 * items: [{ key, lat, lng, pin? }], events in time order. mpp: metres per screen px at the map's
 * zoom (metresPerPx). disc and square: a disc's and a square's width in px with its ring; gap: the
 * pitch of a row. Returns key -> { lat, lng, dx, dy }: the row's anchor (a disc's own place, or the
 * row's middle), the item's offset from it in px, and under: true for a stacked event behind the top.
 */
export function markPlaces(items, mpp, { disc = 28, square = 26, gap = 26, peek = 4 } = {}) {
  const out = new Map()
  const list = (items || []).filter(hasXY)
  if (!(mpp > 0)) {
    for (const s of list) out.set(s.key, { lat: s.lat, lng: s.lng, dx: 0, dy: 0, under: false })
    return out
  }
  if (!list.length) return out
  const k = Math.cos(list[0].lat * RAD)
  const pts = list.map((s, i) => ({ i, s, x: (s.lng * RAD * k * R) / mpp, y: -(s.lat * RAD * R) / mpp }))
  const placed = []   // { x, y, w }: discs, then each row's squares as they are set

  for (const p of pts) {
    if (!p.s.pin) continue
    out.set(p.s.key, { lat: p.s.lat, lng: p.s.lng, dx: 0, dy: 0, under: false })
    placed.push({ x: p.x, y: p.y, w: disc })
  }

  // Rows: events whose squares would touch, chained (a near b, b near c is one row).
  const evs = pts.filter(p => !p.s.pin)
  const parent = evs.map((_, j) => j)
  const find = j => (parent[j] === j ? j : (parent[j] = find(parent[j])))
  for (let a = 0; a < evs.length; a++) {
    for (let b = a + 1; b < evs.length; b++) {
      if (Math.abs(evs[a].x - evs[b].x) < square && Math.abs(evs[a].y - evs[b].y) < square) parent[find(b)] = find(a)
    }
  }
  const byRoot = new Map()
  evs.forEach((p, j) => { const r = find(j); byRoot.set(r, [...(byRoot.get(r) || []), p]) })
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length
  const rows = [...byRoot.values()]
    .map(ps => ps.sort((a, b) => a.i - b.i))
    .sort((a, b) => b.length - a.length || a[0].i - b[0].i)

  const hits = (x, y) => placed.reduce((n, q) => n + (Math.abs(x - q.x) < (square + q.w) / 2 && Math.abs(y - q.y) < (square + q.w) / 2 ? 1 : 0), 0)
  // Moves of a row's middle, nearest first (a move down or up counts a little more than sideways),
  // none further than reach squares.
  const movesTo = (reach) => {
    const ms = []
    for (let r = -Math.floor(reach); r <= Math.floor(reach); r++) {
      for (let h = 0; h <= 2 * reach; h++) {
        for (const sgn of h ? [1, -1] : [1]) {
          const sx = sgn * h * gap / 2, sy = r * gap
          if (Math.hypot(sx, sy) <= reach * gap + 0.01) ms.push({ sx, sy, cost: Math.abs(sx) + 1.25 * Math.abs(sy) })
        }
      }
    }
    return ms.sort((a, b) => a.cost - b.cost || b.sx - a.sx || b.sy - a.sy)
  }
  const NEAR = movesTo(1.5), FAR = movesTo(3)
  const nearest = (width, ax, ay, moves = NEAR) => {
    let best = null
    for (const c of moves) {
      const s = Array.from({ length: width }, (_, j) => ({ x: ax + c.sx + (j - (width - 1) / 2) * gap, y: ay + c.sy }))
      const n = s.reduce((t, q) => t + hits(q.x, q.y), 0)
      if (!best || n < best.n) best = { s, n }
      if (!n) break
    }
    return best
  }

  for (const ps of rows) {
    const n = ps.length
    const ax = mean(ps.map(p => p.x)), ay = mean(ps.map(p => p.y))
    const lat = mean(ps.map(p => p.s.lat)), lng = mean(ps.map(p => p.s.lng))
    const asRow = n === 1 ? nearest(1, ax, ay, FAR) : nearest(n, ax, ay)
    if (n === 1 || !asRow.n) {
      asRow.s.forEach((q, j) => {
        out.set(ps[j].s.key, { lat, lng, dx: q.x - ax, dy: q.y - ay, under: false })
        placed.push({ x: q.x, y: q.y, w: square })
      })
      continue
    }
    const near = nearest(1, ax, ay)
    const top = (near.n ? nearest(1, ax, ay, FAR) : near).s[0]
    ps.forEach((p, j) => out.set(p.s.key, { lat, lng, dx: top.x - ax + (j ? peek : 0), dy: top.y - ay - (j ? peek : 0), under: j > 0 }))
    placed.push({ x: top.x + peek / 2, y: top.y - peek / 2, w: square + peek })
  }
  return out
}
