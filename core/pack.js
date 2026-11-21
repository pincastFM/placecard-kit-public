// The pack (for 1.5.0, unreleased): a collected card comes out of a sealed foil pack before the host's own
// collected screen shows. The pure part; the component is vue/TtPack.vue. Ported from NYID's
// utils/placecardReveal.js, where it is the default collect on Placecard's Trek play and the Studio's Walk test
// (2026-11-20). Placecard only for now: VeryThere and Treehopper each decide for themselves before either turns it
// on. The pack is silver foil in the experience's own colors and never gold: gold is the top rarity's alone.
// Framework-free; runs in Node.
import { ttContrast, ttHex } from './face.js'

// Each app's mark color, the band across its pack (NYID's --pc-st, --pc-th and --pc-vt).
export const TT_PACK_TINTS = Object.freeze({ studio: '#006638', treehopper: '#5048E5', verythere: '#FFB61E' })
// The line under the band when the card has no accent: the Studio face's waterline, Cornflower (TtFace .ttf-pc-wl).
export const TT_PACK_STRIPE = '#3E9BE9'
// Gold is the top rarity's alone: the pack never prints it.
export const TT_PACK_GOLD = '#E8CD8C'
const INK = '#12261C'
const WHITE = '#FFFFFF'

// How long each step runs, in ms. The land and the stamp follow Treehopper's collect beat (160 ms and 100 ms). With
// reduced motion there is one short fade and nothing moves.
export const TT_PACK_MS = Object.freeze({ tear: 280, rise: 520, land: 160, stamp: 100, hold: 520, fade: 200 })

// How far a drag along the top strip must travel, as a share of the pack's width, to tear it open.
export const TT_PACK_TEAR_AT = 0.6
// A press on the strip that moves less than this, in px each way, is a tap (it opens the pack).
export const TT_PACK_TAP_PX = 6

// ttHex in upper case, refusing gold: the colors the pack prints, as NYID's stand-in wrote them.
function packHex(c) {
  const h = ttHex(c)
  if (!h) return null
  const u = h.toUpperCase()
  return u === TT_PACK_GOLD ? null : u
}

// The pack's print, from the experience and the card inside: { word, title, tint, onTint, stripe, count }.
// - word: the experience's chip word as its face prints it (the chip, else the city, else its name), in capitals.
// - tint: the band across the pack: the host's own `tint` when ttHex reads it, else the app's mark color
//   (TT_PACK_TINTS; Studio green for an app it doesn't know).
// - onTint: the word's color on the band, ink or white, whichever reads better.
// - stripe: the line under the band, in the card's accent when ttHex reads it (the color the Studio face's waterline
//   draws), else Cornflower.
// - count: '1 card', or 'n cards'.
// A tint or accent that is the top rarity's gold is refused like a bad hex.
// 1.6.0 (the open kit): an app is any registry id, so a tint is looked up as the table's own key only (an id such as
// 'constructor' names no color); a fourth app's host passes its app's color from the collection's apps as `tint`.
export function ttPackLook({ app = 'studio', tint = null, name = '', chip = '', city = '', accent = null, count = 1 } = {}) {
  const known = typeof app === 'string' && Object.prototype.hasOwnProperty.call(TT_PACK_TINTS, app)
  const band = packHex(tint) || (known ? TT_PACK_TINTS[app] : '') || TT_PACK_TINTS.studio
  const onTint = ttContrast(band, WHITE) >= ttContrast(band, INK) ? WHITE : INK
  const word = String(chip || city || name || '').trim().toUpperCase()
  const n = Math.max(1, Math.floor(Number(count) || 1))
  return {
    word,
    title: String(name || '').trim(),
    tint: band,
    onTint,
    stripe: packHex(accent) || TT_PACK_STRIPE,
    count: n === 1 ? '1 card' : `${n} cards`,
  }
}

// The steps of the opening, in order, with their lengths: the full run, or one fade with reduced motion.
export function ttPackSteps(reduced) {
  if (reduced) return [{ step: 'fade', ms: TT_PACK_MS.fade }]
  return ['tear', 'rise', 'land', 'stamp', 'hold'].map((step) => ({ step, ms: TT_PACK_MS[step] }))
}

// A drag along the top strip: how far it has gone (0 to 1) and whether that tears the pack open. Only a rightward drag
// counts (the strip tears from its notch at the left).
export function ttPackTear(dx, width) {
  const w = Number(width) || 0
  const p = w > 0 ? Math.min(1, Math.max(0, (Number(dx) || 0) / w)) : 0
  return { progress: p, torn: p >= TT_PACK_TEAR_AT }
}

// A press on the strip that barely moved is a tap; a drag left, or up and down, is not.
export function ttPackTap(dx, dy) {
  return Math.abs(Number(dx) || 0) < TT_PACK_TAP_PX && Math.abs(Number(dy) || 0) < TT_PACK_TAP_PX
}
