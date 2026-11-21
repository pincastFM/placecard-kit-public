/**
 * A stand-in for a Mapbox GL map and two scripted walks, run once on NYID's navFollow (the freeze)
 * and once on the kit's (the move). Each run writes one log: every camera call the follower makes,
 * every frame of its trace, every paint change on the map's own layers, and where its dot sits
 * after each fix. test/nav/navFollow.test.js compares the logs through one golden.
 */
import { vi } from 'vitest'

const r = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp
const ll = (p) => `${r(p[0], 7)},${r(p[1], 7)}`
const wrap = (b) => ((((b + 180) % 360) + 360) % 360) - 180

// Mapbox's camera methods on the prototype, as GL has them, so a hold puts its no-ops on the
// instance and Map.prototype.easeTo.call(map, ...) still reaches the real one (the VeryThere walk
// does that while the follower holds the camera).
export class FakeMap {
  constructor(log, { center, zoom = 17, bearing = 0, width = 390, height = 800, layers = [] } = {}) {
    this.log = log
    this.cam = { center: [center[0], center[1]], zoom, bearing: wrap(bearing) }
    this.layers = new Set(layers)
    this.handlers = {}
    this.w = width
    this.h = height
    const el = document.createElement('div')
    el.id = 'map'
    Object.defineProperty(el, 'offsetHeight', { value: height })
    el.getBoundingClientRect = () => ({ top: 0, left: 0, right: width, bottom: height, width, height })
    document.body.appendChild(el)
    this.el = el
  }

  getContainer() { return this.el }
  getZoom() { return this.cam.zoom }
  getBearing() { return this.cam.bearing }
  getLayer(id) { return this.layers.has(id) ? { id } : undefined }
  setPaintProperty(id, k, v) { this.log.push(`paint ${id} ${k} ${v}`) }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); this.log.push(`on ${ev}`) }
  off(ev, fn) { this.handlers[ev] = (this.handlers[ev] || []).filter((f) => f !== fn); this.log.push(`off ${ev}`) }
  fire(ev) { for (const fn of this.handlers[ev] || []) fn() }
  stop() { this.log.push('map.stop'); return this }
  jumpTo(o) { return this.move('jumpTo', o) }
  easeTo(o) { return this.move('easeTo', o) }
  flyTo(o) { return this.move('flyTo', o) }
  panTo(c) { return this.move('panTo', { center: c }) }
  setCenter(c) { return this.move('setCenter', { center: c }) }
  setZoom(z) { return this.move('setZoom', { zoom: z }) }
  setBearing(b) { return this.move('setBearing', { bearing: b }) }
  rotateTo(b) { return this.move('rotateTo', { bearing: b }) }
  fitBounds(b) { this.log.push(`fitBounds ${JSON.stringify(b)}`); return this }

  move(name, o) {
    if (o.center) this.cam.center = [o.center[0], o.center[1]]
    if (o.zoom !== undefined) this.cam.zoom = o.zoom
    if (o.bearing !== undefined) this.cam.bearing = wrap(o.bearing)
    const pad = o.padding ? ` p=${JSON.stringify(o.padding)}` : ''
    this.log.push(`${name} c=${ll(this.cam.center)} z=${this.cam.zoom} b=${r(this.cam.bearing, 4)}${pad}`)
    return this
  }

  // Web Mercator in 512 px tiles, as GL draws it, turned by the bearing
  project([lng, lat]) {
    const s = 512 * 2 ** this.cam.zoom
    const wx = (x) => ((x + 180) / 360) * s
    const wy = (y) => ((1 - Math.log(Math.tan(Math.PI / 4 + (y * Math.PI) / 360)) / Math.PI) / 2) * s
    const dx = wx(lng) - wx(this.cam.center[0])
    const dy = wy(lat) - wy(this.cam.center[1])
    const t = (-this.cam.bearing * Math.PI) / 180
    return { x: this.w / 2 + dx * Math.cos(t) - dy * Math.sin(t), y: this.h / 2 + dx * Math.sin(t) + dy * Math.cos(t) }
  }
}

// requestAnimationFrame and performance.now on a clock the test moves: a frame every `step` ms
export function fakeClock(start = 10000) {
  let now = start
  let queue = []
  let id = 0
  vi.stubGlobal('requestAnimationFrame', (fn) => { queue.push({ id: ++id, fn }); return id })
  vi.stubGlobal('cancelAnimationFrame', (n) => { queue = queue.filter((q) => q.id !== n) })
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  return {
    pending: () => queue.length,
    run(ms, step = 50) {
      const end = now + ms
      while (now + step <= end) {
        now += step
        const due = queue
        queue = []
        for (const { fn } of due) fn(now)
      }
      now = end
    },
  }
}

// The route: 150 m north, then 150 m east, near BYU in Provo
const M_PER_DEG_LAT = 111320
const A = [-111.6585, 40.233]
const NORTH = 150
const EAST = 150
const at = (n, e) => [A[0] + e / (M_PER_DEG_LAT * Math.cos((A[1] * Math.PI) / 180)), A[1] + n / M_PER_DEG_LAT]
export const ROUTE = [at(0, 0), at(NORTH, 0), at(NORTH, EAST)]
// A point d m along the route, o m to the walker's right
const onRoute = (d, o) => (d <= NORTH ? at(d, o) : at(NORTH - o, d - NORTH))

// [m along, m to the right, ms to the next fix]. 25 m off is on the route but not snapped to it;
// 2000 ms and 150 ms gaps test the animation's clamp (250 to 1200 ms).
const WALK = [
  [0, 0, 1000], [20, 3, 1000], [40, -2, 1000], [60, 4, 900], [80, -3, 1100], [100, 1, 2000],
  [120, -4, 1000], [140, 2, 150], [150, 0, 1000], [160, 3, 1000], [180, -2, 1000], [200, 25, 1000],
  [220, -1, 1000], [240, 2, 1000], [260, 0, 1000],
]

function harness(log, map, f, clock) {
  const note = (s) => log.push(`-- ${s}`)
  const dotAt = () => {
    const d = map.el.firstElementChild
    return d ? d.style.transform.replace(/-?\d+(\.\d+)?(e-?\d+)?/g, (n) => String(r(+n, 3))) : 'none'
  }
  const fix = (p, ms, label) => {
    note(`fix ${label} ${ll(p)}`)
    f.update({ lng: p[0], lat: p[1] })
    clock.run(ms)
    note(`dot ${dotAt()} active=${f.active} pending=${clock.pending()}`)
  }
  return { note, dotAt, fix }
}

// Walk 1: the route under a bottom sheet, with every option a page passes
export function walkTheRoute(createNavFollower) {
  const log = []
  const clock = fakeClock()
  document.body.innerHTML = ''
  const sheet = document.createElement('div')
  sheet.className = 'sheet'
  Object.defineProperty(sheet, 'offsetParent', { get: () => document.body })
  sheet.getBoundingClientRect = () => ({ top: 520, left: 0, right: 390, bottom: 800, width: 390, height: 280 })
  document.body.appendChild(sheet)
  const map = new FakeMap(log, { center: ROUTE[0], zoom: 17, bearing: 12, layers: ['user-location-dot', 'user-location-glow'] })
  let locked = true
  const trace = { push: (e) => log.push(`frame t=${e.t} want=${e.want} got=${e.got} x=${e.x} y=${e.y}`) }
  const f = createNavFollower(map, { getRoute: () => ROUTE, sheetSelector: '.sheet', isLocked: () => locked, trace })
  const { note, dotAt, fix } = harness(log, map, f, clock)

  note('fixes that are not fixes')
  f.update(null)
  f.update({ lng: NaN, lat: 40 })
  note(`active=${f.active} pending=${clock.pending()}`)

  note('the route, locked, a sheet at 520 of 800')
  WALK.forEach(([d, o, ms], i) => {
    fix(onRoute(d, o), ms, `d=${d} o=${o}`)
    if (i === 0) {
      const dot = map.el.firstElementChild
      note(`dot style ${dot.style.cssText} class=${dot.getAttribute('class')}`)
    }
  })

  note('the page moves the camera while the follower holds it: no-ops')
  map.easeTo({ center: at(0, 0), zoom: 12 })
  map.flyTo({ center: at(0, 0) })
  map.setBearing(180)
  map.fitBounds([[0, 0], [1, 1]])
  note(`camera c=${ll(map.cam.center)} z=${map.cam.zoom} b=${r(map.cam.bearing, 4)}`)
  note('the map prototype still moves it (the VeryThere walk does this)')
  FakeMap.prototype.easeTo.call(map, { center: at(240, 0), bearing: 0 })

  note('unlocked: the dot moves, the camera stays')
  locked = false
  fix(onRoute(270, 1), 1000, 'd=270 o=1')
  fix(onRoute(280, -2), 1000, 'd=280 o=-2')
  note('the user pans')
  map.cam.center = at(270, 40)
  map.fire('move')
  note(`dot ${dotAt()}`)
  note('recenter')
  locked = true
  f.recenter()
  note(`dot ${dotAt()}`)
  fix(onRoute(290, 0), 1000, 'd=290 o=0')
  fix(onRoute(300, 0), 1000, 'd=300 o=0')

  note('past the end of the route')
  fix(at(NORTH, EAST + 10), 1000, 'end+10')
  fix(at(NORTH + 3, EAST + 18), 1000, 'end+18')

  note('off the route: standing still, then walking west')
  fix(at(NORTH + 60, EAST), 1000, 'off')
  fix(at(NORTH + 61, EAST + 2), 1000, 'jitter')
  fix(at(NORTH + 59, EAST - 1), 1000, 'jitter')
  fix(at(NORTH + 60, EAST + 1), 1000, 'jitter')
  fix(at(NORTH + 60, EAST - 10), 1000, 'west')
  fix(at(NORTH + 60, EAST - 20), 1000, 'west')
  fix(at(NORTH + 61, EAST - 30), 1000, 'west')

  note('stop')
  f.stop()
  note(`active=${f.active} children=${map.el.children.length} move=${(map.handlers.move || []).length} pending=${clock.pending()}`)
  map.easeTo({ center: at(0, 0), zoom: 16, bearing: 0 })
  note('again, stopped mid-frame')
  f.update({ lng: ROUTE[0][0], lat: ROUTE[0][1] })
  note(`active=${f.active} pending=${clock.pending()}`)
  f.stop()
  note(`active=${f.active} children=${map.el.children.length} pending=${clock.pending()}`)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  return log
}

// Walk 2: no options at all (no route, no sheet, no trace, always locked)
export function noOptions(createNavFollower) {
  const log = []
  const clock = fakeClock()
  document.body.innerHTML = ''
  const map = new FakeMap(log, { center: at(0, 0), zoom: 16.5, bearing: 30 })
  const f = createNavFollower(map)
  const { note, fix } = harness(log, map, f, clock)
  note('no route: the first heading is the map\'s; only real movement turns it')
  fix(at(0, 0), 1000, 'start')
  fix(at(3, 1), 1000, 'jitter')
  fix(at(12, 0), 1000, 'north')
  fix(at(24, 8), 1000, 'north-east')
  fix(at(30, 20), 1000, 'east')
  f.recenter()
  f.stop()
  note(`active=${f.active} children=${map.el.children.length}`)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  return log
}
