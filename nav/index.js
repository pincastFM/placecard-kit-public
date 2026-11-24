// The kit's nav (kit CONTRACT.md): the real-GPS navigation camera, moved from NYID
// lib/map/navFollow.js. Framework-free ESM; the map comes in, and the DOM and
// requestAnimationFrame are used only when it runs. Its one dependency is turf's modular packages.
export { createNavFollower } from './navFollow.js'
export const CONTRACT_VERSION = '1.6.2'
