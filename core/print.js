/**
 * The shared card's motion, as the approved design moves it. Framework-free:
 * plain DOM, nothing at import, so Node can load it; it does nothing without a window.
 *
 * ttPrint({ light = true, tilt = true, root, card = '.tt-st-card', skip }) starts it and returns stop(), which removes
 * every listener, attribute, inline variable and lean it set. Only cards that print take it (a face root carrying
 * data-print, TtFace's `.ttf[data-print]`), and only inside root (default <html>).
 * - Light that follows the phone: root gets data-tt-light ("on"; "phone" once the phone's tilt arrives; "still" under
 *   reduced motion). The phone sets --pc-lx and --pc-ly on root (one light in the room, smoothed by a frame loop); while
 *   the phone gives nothing, the finger sets them on the face under it. On iOS the permission is asked once, inside the
 *   first click on a button or a print card anywhere on the page (a newcomer's Start, a veteran's first tap). The CSS
 *   (TtFace) draws it on the open card only.
 * - Finger tilt with weight: pressing a print face inside a `card` holder (TtStage's .tt-st-card) leans the face toward
 *   the finger, 8 deg at most, by its `rotate` (so the stage's flip and quiver on the holder compose with it), and marks
 *   the holder data-tt-held (the shadow spreads; a class would be lost to Vue's own on the holder). Release springs back
 *   (K 220, C 16: a slight overshoot). Controls and a back's text (`skip`) are left alone, and a holder mid-flip
 *   (is-lifted) is not leaned. A holder a swipe is turning (TtCard's is-drag) lets go of the press at the next
 *   move, as a release would. root gets data-tt-tilt.
 * - Reduced motion: the light holds still, no tilt, no listeners.
 */
export const TT_PRINT_SKIP = 'a, button, input, select, textarea, label, .ttf-bk-body'
const FACE = '.ttf[data-print]'
const MAX = 8
const K = 220
const C = 16
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const pct = v => v.toFixed(1) + '%'

export function ttPrint(o = {}) {
  const G = typeof window !== 'undefined' ? window : null
  if (!G || !G.document) return () => {}
  const D = G.document
  const root = o.root || D.documentElement
  const holderSel = o.card || '.tt-st-card'
  const skip = o.skip || TT_PRINT_SKIP
  const reduced = !!(G.matchMedia && G.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const light = o.light !== false
  const tilt = o.tilt !== false && !reduced
  const raf = fn => (G.requestAnimationFrame ? G.requestAnimationFrame(fn) : G.setTimeout(() => fn(Date.now()), 16))
  const caf = id => (G.cancelAnimationFrame ? G.cancelAnimationFrame(id) : G.clearTimeout(id))
  const offs = []
  const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); offs.push(() => t.removeEventListener(ev, fn, opt)) }
  const faceAt = el => {
    const f = el && el.closest ? el.closest(FACE) : null
    return f && root.contains(f) ? f : null
  }
  let stopped = false
  let lraf = 0
  let traf = 0
  const lit = new Set()
  const live = new Map() // face -> { rx, ry, vx, vy, tx, ty, down, id, holder }

  if (light) root.setAttribute('data-tt-light', reduced ? 'still' : 'on')
  if (tilt) root.setAttribute('data-tt-tilt', 'on')

  // ── light ──
  let motionOn = false
  const unlight = f => { f.style.removeProperty('--pc-lx'); f.style.removeProperty('--pc-ly'); lit.delete(f) }
  if (light && !reduced) {
    let tx = 30
    let ty = 20
    let x = 30
    let y = 20
    const step = () => {
      x += (tx - x) * 0.18
      y += (ty - y) * 0.18
      root.style.setProperty('--pc-lx', pct(x))
      root.style.setProperty('--pc-ly', pct(y))
      lraf = !stopped && Math.abs(tx - x) + Math.abs(ty - y) > 0.1 ? raf(step) : 0
    }
    const onTilt = (e) => {
      if (e.beta == null || e.gamma == null) return
      if (!motionOn) { motionOn = true; root.setAttribute('data-tt-light', 'phone'); [...lit].forEach(unlight) }
      // held upright at about 45 deg; the highlight slides against the tilt, as a fixed light over the shoulder would
      tx = 50 - clamp(e.gamma, -30, 30) / 30 * 40
      ty = 50 - clamp(e.beta - 45, -30, 30) / 30 * 40
      if (!lraf) lraf = raf(step)
    }
    let listening = false
    const listen = () => { if (!listening && !stopped) { listening = true; on(G, 'deviceorientation', onTilt, { passive: true }) } }
    const DOE = G.DeviceOrientationEvent
    if (DOE && typeof DOE.requestPermission === 'function') {
      let asked = false
      on(D, 'click', (e) => {
        if (asked) return
        const b = e.target && e.target.closest ? e.target.closest('button, ' + FACE) : null
        if (!b) return
        asked = true
        try {
          Promise.resolve(DOE.requestPermission()).then((s) => { if (s === 'granted') listen() }).catch(() => {})
        } catch (_) { /* not inside a gesture: no light from the phone */ }
      }, true)
    } else if (DOE) listen()
    // the finger, while the phone gives nothing: the highlight sits where the finger (or the pointer) is on that face
    on(D, 'pointermove', (e) => {
      if (motionOn) return
      const f = faceAt(e.target)
      if (!f) return
      const r = f.getBoundingClientRect()
      if (!r.width) return
      f.style.setProperty('--pc-lx', pct(clamp((e.clientX - r.left) / r.width * 100, -10, 110)))
      f.style.setProperty('--pc-ly', pct(clamp((e.clientY - r.top) / r.height * 100, -10, 110)))
      lit.add(f)
    }, { passive: true })
    on(D, 'pointerout', (e) => { const f = faceAt(e.target); if (f && !f.contains(e.relatedTarget)) unlight(f) }, { passive: true })
  }

  // ── finger tilt ──
  const lean = (f, s) => {
    const a = Math.hypot(s.rx, s.ry)
    f.style.rotate = a < 0.02 ? '' : (s.rx / a).toFixed(4) + ' ' + (s.ry / a).toFixed(4) + ' 0 ' + a.toFixed(3) + 'deg'
  }
  if (tilt) {
    let last = 0
    const frame = (t) => {
      const dt = Math.min(0.032, last ? (t - last) / 1000 : 0.016)
      last = t
      for (const [f, s] of live) {
        s.vx += (K * (s.tx - s.rx) - C * s.vx) * dt; s.rx += s.vx * dt
        s.vy += (K * (s.ty - s.ry) - C * s.vy) * dt; s.ry += s.vy * dt
        lean(f, s)
        if (!s.down && Math.abs(s.rx) + Math.abs(s.ry) + Math.abs(s.vx) + Math.abs(s.vy) < 0.01) {
          s.rx = s.ry = 0
          lean(f, s)
          live.delete(f)
        }
      }
      traf = live.size && !stopped ? raf(frame) : 0
      if (!traf) last = 0
    }
    const kick = () => { if (!traf && !stopped) traf = raf(frame) }
    const aim = (f, s, e) => {
      const r = f.getBoundingClientRect()
      if (!r.width) return
      const dx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1)
      const dy = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1)
      // the side under the finger goes down, away from the eye
      s.tx = -dy * MAX
      s.ty = dx * MAX
    }
    on(D, 'pointerdown', (e) => {
      if (e.button > 0 || !e.target || !e.target.closest) return
      const h = e.target.closest(holderSel)
      if (!h || !root.contains(h) || e.target.closest(skip) || h.classList.contains('is-lifted')) return
      const f = [...h.children].find(x => x.matches(FACE) && !x.classList.contains('is-under'))
      if (!f) return
      const s = live.get(f) || { rx: 0, ry: 0, vx: 0, vy: 0, tx: 0, ty: 0 }
      s.down = true
      s.id = e.pointerId
      s.holder = h
      live.set(f, s)
      h.setAttribute('data-tt-held', '')
      aim(f, s, e)
      kick()
    }, { passive: true })
    on(D, 'pointermove', (e) => {
      for (const [f, s] of live) {
        if (!s.down || s.id !== e.pointerId) continue
        // A holder a swipe is turning (TtCard's is-drag) lets go of the press, as a release would
        if (s.holder.classList.contains('is-drag')) { s.down = false; s.tx = s.ty = 0; s.holder.removeAttribute('data-tt-held') } else aim(f, s, e)
        kick()
      }
    }, { passive: true })
    const up = (e) => {
      for (const s of live.values()) {
        if (s.down && s.id === e.pointerId) { s.down = false; s.tx = s.ty = 0; s.holder.removeAttribute('data-tt-held'); kick() }
      }
    }
    on(D, 'pointerup', up, { passive: true })
    on(D, 'pointercancel', up, { passive: true })
  }

  return function stop() {
    if (stopped) return
    stopped = true
    offs.splice(0).forEach(off => off())
    if (lraf) caf(lraf)
    if (traf) caf(traf)
    lraf = traf = 0
    root.removeAttribute('data-tt-light')
    root.removeAttribute('data-tt-tilt')
    root.style.removeProperty('--pc-lx')
    root.style.removeProperty('--pc-ly')
    ;[...lit].forEach(unlight)
    for (const [f, s] of live) { f.style.rotate = ''; if (s.holder) s.holder.removeAttribute('data-tt-held') }
    live.clear()
  }
}
