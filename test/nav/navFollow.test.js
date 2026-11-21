// @vitest-environment jsdom
/**
 * The nav subpath: NYID's real-GPS navigation camera, lib/map/navFollow.js at commit 811e9962,
 * moved into the kit.
 *
 * NYID has no tests for it, so its behavior is frozen first from its own file, read with git
 * show into .pinned/ and run on NYID's own @turf/turf 7.2.0, over the two scripted walks in
 * scenario.js: goldens/navfollow.json. The kit's copy must give that file back byte for byte.
 * Then the two new options (dotStyle, dotLayers), and the fences: core stays dependency-free.
 *
 * The freeze reads NYID from a local clone named by NYID_REPO. Unset, without that commit, or without
 * @turf/turf 7.2.0 in its node_modules, the freeze test is skipped; the kit's copy is still checked
 * against the golden.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync, readdirSync, symlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { hasPin, pinFiles } from '../../planner/test/pinned'
import { asJson, golden } from '../../planner/test/golden'
import { FakeMap, ROUTE, fakeClock, noOptions, walkTheRoute } from './scenario.js'
import { createNavFollower } from '../../nav/index.js'

const NYID_MAIN = {
  name: 'nyid-811e9962',
  repo: process.env.NYID_REPO || '',
  commit: '811e9962b8dd9bf853cba3dacc8f5d957b24828e',
}
const FILE = 'lib/map/navFollow.js'
const GOLDENS = resolve(__dirname, 'goldens')
const ROOT = resolve(__dirname, '..', '..')
const SOURCE = `NYID ${NYID_MAIN.commit.slice(0, 8)} ${FILE} on @turf/turf 7.2.0`
const turfIn = (repo) => {
  try { return JSON.parse(readFileSync(resolve(repo, 'node_modules/@turf/turf/package.json'), 'utf8')).version } catch { return null }
}
const haveNyid = hasPin(NYID_MAIN) && turfIn(NYID_MAIN.repo) === '7.2.0'
const run = (create) => asJson({ source: SOURCE, walkTheRoute: walkTheRoute(create), noOptions: noOptions(create) })
const importsOf = (file) => [...readFileSync(file, 'utf8').matchAll(/^\s*(?:import|export)[^'"\n]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1])

describe('nav: NYID at 811e9962 (the freeze)', () => {
  it.skipIf(!haveNyid)('its navFollow gives goldens/navfollow.json', async () => {
    const dir = pinFiles(NYID_MAIN, [FILE])
    // NYID's own node_modules beside the pinned file, so it runs on the @turf/turf NYID ships
    const nm = resolve(dir, 'node_modules')
    if (!existsSync(nm)) symlinkSync(resolve(NYID_MAIN.repo, 'node_modules'), nm, 'dir')
    const { createNavFollower: theirs } = await import(/* @vite-ignore */ `${dir}/${FILE}`)
    golden('navfollow.json', run(theirs), GOLDENS)
  })
})

describe('nav: moved into the kit', () => {
  it('the kit\'s navFollow gives goldens/navfollow.json', () => {
    golden('navfollow.json', run(createNavFollower), GOLDENS)
  })
})

describe('nav: the two new options', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
  const LAYERS = ['user-location-dot', 'user-location-glow', 'user-core', 'user-pulse']
  const setup = (opts = {}) => {
    const log = []
    const clock = fakeClock()
    document.body.innerHTML = ''
    const map = new FakeMap(log, { center: ROUTE[0], layers: LAYERS })
    const f = createNavFollower(map, { getRoute: () => ROUTE, ...opts })
    f.update({ lng: ROUTE[0][0], lat: ROUTE[0][1] })
    clock.run(500)
    const paints = () => log.filter((l) => l.startsWith('paint '))
    return { log, map, f, paints }
  }

  it('by default the dot is NYID\'s and has no class (the VeryThere walk restyles div:not([class]))', () => {
    const { map } = setup()
    const dot = map.el.firstElementChild
    expect(dot.getAttribute('class')).toBe(null)
    expect(map.el.querySelector(':scope > div:not([class])')).toBe(dot)
    expect(dot.style.cssText).toMatch(/#4287f5|rgb\(66, 135, 245\)/)
    expect(dot.style.width).toBe('22px')
  })

  it('dotStyle replaces the dot\'s inline CSS', () => {
    const { map } = setup({ dotStyle: 'position:absolute;width:30px;height:30px;background:rgb(10, 20, 30)' })
    const dot = map.el.firstElementChild
    expect(dot.style.width).toBe('30px')
    expect(dot.style.background).toContain('rgb(10, 20, 30)')
    expect(dot.style.cssText).not.toMatch(/4287f5|rgb\(66, 135, 245\)/)
    expect(dot.getAttribute('class')).toBe(null)
  })

  it('by default it hides and shows NYID\'s two layers', () => {
    const { f, paints } = setup()
    f.stop()
    expect(paints()).toEqual([
      'paint user-location-dot circle-opacity 0',
      'paint user-location-dot circle-stroke-opacity 0',
      'paint user-location-glow circle-opacity 0',
      'paint user-location-dot circle-opacity 1',
      'paint user-location-dot circle-stroke-opacity 1',
      'paint user-location-glow circle-opacity 0.2',
    ])
  })

  it('dotLayers names the map\'s own walker layers: hidden while following, shown on stop', () => {
    // Treehopper's walker layers (composables/useMapNavigation.ts)
    const dotLayers = [
      { id: 'user-core', hide: [['circle-opacity', 0], ['circle-stroke-opacity', 0]], show: [['circle-opacity', 1], ['circle-stroke-opacity', 1]] },
      { id: 'user-pulse', hide: [['circle-opacity', 0]], show: [['circle-opacity', 0.2]] },
    ]
    const { f, paints } = setup({ dotLayers })
    expect(paints()).toEqual([
      'paint user-core circle-opacity 0',
      'paint user-core circle-stroke-opacity 0',
      'paint user-pulse circle-opacity 0',
    ])
    f.stop()
    expect(paints().slice(3)).toEqual([
      'paint user-core circle-opacity 1',
      'paint user-core circle-stroke-opacity 1',
      'paint user-pulse circle-opacity 0.2',
    ])
  })

  it('a layer the map lacks is skipped, and dotLayers: [] leaves every layer alone', () => {
    const missing = setup({ dotLayers: [{ id: 'no-such-layer', hide: [['circle-opacity', 0]], show: [['circle-opacity', 1]] }] })
    missing.f.stop()
    expect(missing.paints()).toEqual([])
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    const none = setup({ dotLayers: [] })
    none.f.stop()
    expect(none.paints()).toEqual([])
  })
})

describe('nav: the fences', () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
  const jsIn = (dir) => readdirSync(resolve(ROOT, dir)).filter((f) => f.endsWith('.js')).map((f) => resolve(ROOT, dir, f))

  it('core imports nothing from outside itself, so it stays dependency-free and Node-safe', () => {
    for (const f of jsIn('core')) for (const p of importsOf(f)) expect(p.startsWith('./'), `${f}: ${p}`).toBe(true)
  })

  it('nav imports only itself and turf\'s modular packages, each one a dependency at 7.2', () => {
    const deps = pkg.dependencies || {}
    for (const f of jsIn('nav')) {
      for (const p of importsOf(f)) {
        if (p.startsWith('./')) continue
        expect(p.startsWith('@turf/'), `${f}: ${p}`).toBe(true)
        expect(deps[p], p).toBe('~7.2.0')
      }
    }
    expect(Object.keys(deps).every((d) => d.startsWith('@turf/'))).toBe(true)
  })

  it('the package exports ./nav with its types and ships the folder', () => {
    expect(pkg.exports['./nav']).toEqual({ types: './nav/index.d.ts', import: './nav/index.js' })
    expect(pkg.files).toContain('nav')
  })
})
