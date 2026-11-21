/**
 * navFollow: the real-GPS navigation camera, shared by every walk player.
 *
 * The kit's `nav` subpath (CONTRACT.md). Moved from NYID lib/map/navFollow.js with its behavior
 * unchanged: test/nav freezes NYID's file and this one gives the same frames. Two changes only:
 * the modular turf 7.2 packages in place of @turf/turf (the same functions it re-exports), and
 * the dot's look and the map's own dot layers as options, defaulting to NYID's values.
 *
 * Why it exists. The old path re-aimed the camera only every 1.5 s, skipped updates under a
 * 5 degree heading change (so straight streets never recentered), took its heading from the
 * tiny route segment underfoot (jittery on sidewalk geometry, and late at corners), moved
 * with a 1.5 s flyTo that overlapped the next one, and let the GeoJSON dot jump once per fix
 * while the camera drifted. The demo glide solved each of these; this carries the same
 * answers to real GPS:
 *
 *   - Heading: the direction to the point 25 m ahead ALONG THE ROUTE from where the walker
 *     snaps onto it, eased on a time constant. Off route, the direction of actual movement,
 *     but only once the walker has moved for real (GPS noise at a standstill never spins the
 *     map).
 *   - Motion: between fixes the walker's position is animated at constant speed over the
 *     real interval between fixes, and camera and dot move in the same frame.
 *   - Dot: an HTML dot placed at the projected point every frame; the GeoJSON dot updates
 *     through Mapbox's worker a frame or two late, so it goes transparent while following.
 *   - Placement: the walker sits 62% down the map area the page's bottom sheet leaves
 *     visible (measured, not guessed), with map padding cleared so nothing stacks.
 *   - Ownership: while following, every other camera call is a no-op (competing easeTo /
 *     flyTo calls caused the bounce and the bearing jumps). The page releases the camera
 *     with stop() before any move of its own, such as the arrival framing.
 *
 * Usage:
 *   const follower = createNavFollower(map, { getRoute, sheetSelector, isLocked })
 *   follower.update({ lng, lat })   // on every real GPS fix while navigating
 *   follower.stop()                 // before the page moves the camera itself, and on exit
 *
 * Options beyond those three:
 *   trace      an array that collects one entry per frame (or ?navtrace=1 on the page URL)
 *   dotStyle   the HTML dot's inline CSS (default: NYID's white dot in a blue ring). The dot has
 *              no class, so a page can also restyle it with `#map > div:not([class])`
 *   dotLayers  the map's own walker layers to hide while following and show again on stop:
 *              [{ id, hide: [[paintProperty, value], ...], show: [[paintProperty, value], ...] }]
 *              (default: NYID's user-location-dot and user-location-glow)
 */
import { along } from '@turf/along'
import { bearing } from '@turf/bearing'
import { destination } from '@turf/destination'
import { distance } from '@turf/distance'
import { lineString, point } from '@turf/helpers'
import { length } from '@turf/length'
import { nearestPointOnLine } from '@turf/nearest-point-on-line'

// The functions navFollow used from @turf/turf 7.2, which re-exports each from these packages
const turf = { along, bearing, destination, distance, length, lineString, nearestPointOnLine, point }

const CAMERA_METHODS = ['easeTo', 'flyTo', 'jumpTo', 'setBearing', 'rotateTo', 'panTo', 'setCenter', 'setZoom', 'fitBounds']
const DOT_CSS = 'position:absolute;left:0;top:0;z-index:2;pointer-events:none;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:#fff;border:3px solid #4287f5;box-sizing:border-box;box-shadow:0 0 0 12px rgba(66,135,245,.18);will-change:transform'
const DOT_LAYERS = [
  { id: 'user-location-dot', hide: [['circle-opacity', 0], ['circle-stroke-opacity', 0]], show: [['circle-opacity', 1], ['circle-stroke-opacity', 1]] },
  { id: 'user-location-glow', hide: [['circle-opacity', 0]], show: [['circle-opacity', 0.2]] },
]
const angle = (a, b) => ((b - a + 540) % 360) - 180
const metersBetween = (a, b) => turf.distance(turf.point(a), turf.point(b), { units: 'kilometers' }) * 1000

export function createNavFollower(map, opts = {}) {
  const getRoute = opts.getRoute || (() => null)
  const sheetSelector = opts.sheetSelector || null
  const isLocked = opts.isLocked || (() => true)
  const dotStyle = opts.dotStyle || DOT_CSS
  const dotLayers = opts.dotLayers || DOT_LAYERS
  const LOOK_AHEAD_M = 25
  const SNAP_M = 20          // show the walker on the route when the fix is this close to it
  const HEADING_TAU = 450    // ms; how quickly the map turns toward a new heading (peak about 320 deg/s on a 145 deg corner)
  // Frame trace for verification: pass opts.trace, or add ?navtrace=1 to any page URL.
  const trace = opts.trace || (typeof window !== 'undefined' && (window.__navTraceOn || /[?&]navtrace=1\b/.test(window.location.search)) ? (window.__navTrace ||= []) : null)

  let own = null
  let dot = null
  let shown = null
  let heading = null
  let anim = null
  let raf = null
  let lastFixAt = 0
  let lastFrame = 0
  let lastMovedFrom = null

  const setOp = (layer, props) => {
    try { if (map.getLayer(layer)) for (const [k, v] of props) map.setPaintProperty(layer, k, v) } catch (e) {}
  }
  const onMove = () => { if (dot && shown) place(shown) }

  function hold() {
    if (own) return
    try { map.stop() } catch (e) {}
    own = {}
    for (const k of CAMERA_METHODS) { own[k] = map[k].bind(map); map[k] = () => map }
    dot = document.createElement('div')
    dot.style.cssText = dotStyle
    map.getContainer().appendChild(dot)
    for (const l of dotLayers) setOp(l.id, l.hide)
    map.on('move', onMove)
  }

  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = null }
    anim = null
    if (!own) return
    for (const k of CAMERA_METHODS) map[k] = own[k]
    own = null
    try { map.off('move', onMove) } catch (e) {}
    if (dot) { dot.remove(); dot = null }
    for (const l of dotLayers) setOp(l.id, l.show)
    shown = null
    heading = null
    lastFixAt = 0
    lastMovedFrom = null
  }

  function place(lngLat) {
    const pt = map.project(lngLat)
    dot.style.transform = `translate(${pt.x}px, ${pt.y}px)`
  }

  // Where the map centre goes so the walker lands 62% down the visible map, heading-up.
  function cameraFor(lngLat, bearing) {
    const el = map.getContainer()
    const h = el.offsetHeight
    let visible = h
    if (sheetSelector) {
      const top = el.getBoundingClientRect().top
      const sheets = [...document.querySelectorAll(sheetSelector)].filter(n => n.offsetParent)
      if (sheets.length) visible = Math.min(...sheets.map(n => n.getBoundingClientRect().top)) - top
    }
    visible = Math.max(120, Math.min(h, visible))
    const dotY = visible * 0.62
    const metersPerPx = 78271.51696 * Math.cos(lngLat[1] * Math.PI / 180) / Math.pow(2, map.getZoom())
    const c = turf.destination(turf.point(lngLat), ((dotY - h / 2) * metersPerPx) / 1000, bearing, { units: 'kilometers' }).geometry.coordinates
    return { center: c, bearing, padding: { top: 0, bottom: 0, left: 0, right: 0 } }
  }

  // Snap to the route and look ahead along it. Returns { pos, heading } or null off route.
  function onRoute(fix) {
    const coords = getRoute()
    if (!Array.isArray(coords) || coords.length < 2) return null
    const line = turf.lineString(coords)
    const snapped = turf.nearestPointOnLine(line, turf.point(fix), { units: 'kilometers' })
    if (snapped.properties.dist * 1000 > SNAP_M * 1.5) return null
    const along = snapped.properties.location
    const total = turf.length(line, { units: 'kilometers' })
    const here = snapped.geometry.coordinates
    let ahead = turf.along(line, Math.min(total, along + LOOK_AHEAD_M / 1000), { units: 'kilometers' }).geometry.coordinates
    if (metersBetween(here, ahead) < 3) {
      // At the end of the route: face along its last stretch.
      const back = turf.along(line, Math.max(0, total - LOOK_AHEAD_M / 1000), { units: 'kilometers' }).geometry.coordinates
      return { pos: snapped.properties.dist * 1000 <= SNAP_M ? here : fix, heading: turf.bearing(turf.point(back), turf.point(here)) }
    }
    return { pos: snapped.properties.dist * 1000 <= SNAP_M ? here : fix, heading: turf.bearing(turf.point(here), turf.point(ahead)) }
  }

  function update(fixIn) {
    if (!fixIn || !isFinite(fixIn.lng) || !isFinite(fixIn.lat)) return
    hold()
    const fix = [fixIn.lng, fixIn.lat]
    const now = performance.now()
    // Animate over the real gap between fixes (clamped), so motion is continuous at 1 Hz GPS.
    const dur = lastFixAt ? Math.min(1200, Math.max(250, now - lastFixAt)) : 500
    lastFixAt = now
    const r = onRoute(fix)
    const target = r ? r.pos : fix
    let want = r ? r.heading : null
    if (want === null) {
      // Off route: turn toward real movement only, never toward standing-still GPS noise.
      if (!lastMovedFrom) lastMovedFrom = target
      if (metersBetween(lastMovedFrom, target) > 6) { want = turf.bearing(turf.point(lastMovedFrom), turf.point(target)); lastMovedFrom = target }
    } else {
      lastMovedFrom = target
    }
    if (heading === null) heading = want ?? map.getBearing()
    anim = { from: shown || target, to: target, t0: now, dur, want }
    if (!raf) raf = requestAnimationFrame(tick)
  }

  function tick(now) {
    raf = null
    if (!anim || !own) return
    const k = Math.min(1, (now - anim.t0) / anim.dur)
    const pos = [anim.from[0] + (anim.to[0] - anim.from[0]) * k, anim.from[1] + (anim.to[1] - anim.from[1]) * k]
    shown = pos
    const dt = lastFrame ? Math.max(0, Math.min(100, now - lastFrame)) : 16
    lastFrame = now
    if (anim.want !== null && anim.want !== undefined) heading = heading + angle(heading, anim.want) * (1 - Math.exp(-dt / HEADING_TAU))
    if (isLocked()) own.jumpTo(cameraFor(pos, heading))
    place(pos)
    if (trace) {
      const pt = map.project(pos)
      trace.push({ t: Math.round(now), want: Math.round(heading * 10) / 10, got: Math.round(map.getBearing() * 10) / 10, x: Math.round(pt.x), y: Math.round(pt.y) })
    }
    // Keep turning after the position lands, until the heading has settled.
    const settling = anim.want !== null && anim.want !== undefined && Math.abs(angle(heading, anim.want)) > 0.3
    if (k < 1 || settling) raf = requestAnimationFrame(tick)
    else lastFrame = 0
  }

  return {
    update,
    stop,
    get active() { return !!own },
    // Recenter after the person panned: the next frame puts the camera back on the walker.
    recenter() { if (own && shown) { own.jumpTo(cameraFor(shown, heading ?? map.getBearing())); place(shown) } },
  }
}
