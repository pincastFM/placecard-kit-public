// @vitest-environment jsdom
/**
 * The pack (for 1.5.0, unreleased), moved in from NYID. The pure part (core/pack.js) and TtPack, with Web
 * Animations stubbed or missing. Ported from NYID's tests/placecardReveal.test.js (its pcnPackLook, pcnPackSteps
 * and pcnPackTear, and PcnPack describes, each expectation as it was, under the kit's names), plus the kit's own:
 * a host's tint, gold refused as a tint or an accent, the plain buttons, and the exports.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  TT_PACK_GOLD, TT_PACK_MS, TT_PACK_STRIPE, TT_PACK_TAP_PX, TT_PACK_TEAR_AT, TT_PACK_TINTS, ttPackLook, ttPackSteps,
  ttPackTap, ttPackTear,
} from '../../core/pack.js'
import { ttContrast } from '../../core/face.js'
import * as core from '../../core/index.js'
import * as vue from '../../vue/index.js'
import TtPack from '../../vue/TtPack.vue'

const LOOK = ttPackLook({ app: 'studio', name: 'Times Square in five stops', city: 'New York' })

describe('ttPackLook', () => {
  it('prints the chip word, else the city, else the name, in capitals', () => {
    expect(ttPackLook({ name: 'Times Square', chip: 'Broadway', city: 'New York' }).word).toBe('BROADWAY')
    expect(LOOK.word).toBe('NEW YORK')
    expect(ttPackLook({ name: 'Disco balls' }).word).toBe('DISCO BALLS')
    expect(LOOK.title).toBe('Times Square in five stops')
  })
  it('a Studio pack is Studio green with white words; each app its own mark color, with a word color that reads', () => {
    expect(LOOK.tint).toBe('#006638')
    expect(LOOK.onTint).toBe('#FFFFFF')
    for (const app of ['studio', 'treehopper', 'verythere', 'nope']) {
      const l = ttPackLook({ app, name: 'x' })
      expect(ttContrast(l.tint, l.onTint)).toBeGreaterThanOrEqual(4.5)
    }
    expect(ttPackLook({ app: 'verythere' }).onTint).toBe('#12261C')
    expect(ttPackLook({ app: 'nope' }).tint).toBe('#006638')
    expect(ttPackLook({ app: 'treehopper' }).tint).toBe(TT_PACK_TINTS.treehopper)
  })
  it("the stripe is the card's accent, else Cornflower; never gold", () => {
    expect(LOOK.stripe).toBe(TT_PACK_STRIPE)
    expect(ttPackLook({ accent: '#f2553d' }).stripe).toBe('#F2553D')
    expect(ttPackLook({ accent: '#abc' }).stripe).toBe('#AABBCC')
    expect(ttPackLook({ accent: 'sky' }).stripe).toBe(TT_PACK_STRIPE)
    const all = ['studio', 'treehopper', 'verythere'].map((app) => ttPackLook({ app }))
    for (const l of all) expect([l.tint, l.onTint, l.stripe].map((c) => c.toUpperCase())).not.toContain(TT_PACK_GOLD)
  })
  it('counts the cards inside', () => {
    expect(LOOK.count).toBe('1 card')
    expect(ttPackLook({ count: 3 }).count).toBe('3 cards')
    expect(ttPackLook({ count: 0 }).count).toBe('1 card')
  })
  it("the kit's own: a host's tint over the app's, with a word color that reads; gold refused as a tint or an accent", () => {
    const t = ttPackLook({ app: 'treehopper', tint: '#1e3a8a' })
    expect(t.tint).toBe('#1E3A8A')
    expect(t.onTint).toBe('#FFFFFF')
    expect(ttPackLook({ tint: '#ffe08a' }).onTint).toBe('#12261C')
    expect(ttPackLook({ app: 'verythere', tint: 'sky' }).tint).toBe('#FFB61E')
    expect(ttPackLook({ tint: '#e8cd8c' }).tint).toBe('#006638')
    expect(ttPackLook({ accent: TT_PACK_GOLD.toLowerCase() }).stripe).toBe(TT_PACK_STRIPE)
    expect(ttPackLook()).toEqual({ word: '', title: '', tint: '#006638', onTint: '#FFFFFF', stripe: TT_PACK_STRIPE, count: '1 card' })
  })
})

describe('ttPackSteps, ttPackTear and ttPackTap', () => {
  it('runs tear, rise, land, stamp and hold; reduced motion is one short fade', () => {
    expect(ttPackSteps(false).map((s) => s.step)).toEqual(['tear', 'rise', 'land', 'stamp', 'hold'])
    expect(ttPackSteps(false).find((s) => s.step === 'land').ms).toBe(160)
    expect(ttPackSteps(false).find((s) => s.step === 'stamp').ms).toBe(100)
    expect(ttPackSteps(true)).toEqual([{ step: 'fade', ms: TT_PACK_MS.fade }])
    expect(ttPackSteps(false).reduce((n, s) => n + s.ms, 0)).toBeLessThan(2000)
  })
  it('tears at six tenths of the width, rightward only', () => {
    expect(TT_PACK_TEAR_AT).toBe(0.6)
    expect(ttPackTear(150, 240)).toEqual({ progress: 0.625, torn: true })
    expect(ttPackTear(100, 240).torn).toBe(false)
    expect(ttPackTear(-200, 240)).toEqual({ progress: 0, torn: false })
    expect(ttPackTear(999, 240).progress).toBe(1)
    expect(ttPackTear(10, 0)).toEqual({ progress: 0, torn: false })
  })
  it('a tap barely moves; a drag left, or up and down, is not one', () => {
    expect(TT_PACK_TAP_PX).toBe(6)
    expect(ttPackTap(0, 0)).toBe(true)
    expect(ttPackTap(5, -5)).toBe(true)
    expect(ttPackTap(-40, 0)).toBe(false)
    expect(ttPackTap(0, 60)).toBe(false)
    expect(ttPackTap(3, -20)).toBe(false)
    expect(ttPackTap(undefined, undefined)).toBe(true)
  })
  it('core and vue export the pack', () => {
    for (const k of ['TT_PACK_MS', 'TT_PACK_TEAR_AT', 'TT_PACK_TAP_PX', 'TT_PACK_STRIPE', 'TT_PACK_GOLD', 'TT_PACK_TINTS',
      'ttPackLook', 'ttPackSteps', 'ttPackTear', 'ttPackTap']) expect(core[k]).toBeDefined()
    expect(vue.TtPack).toBe(TtPack)
    expect(Object.isFrozen(TT_PACK_MS) && Object.isFrozen(TT_PACK_TINTS)).toBe(true)
  })
})

describe('TtPack', () => {
  const realAnimate = Element.prototype.animate
  const realMatch = window.matchMedia
  let calls
  afterEach(() => {
    Element.prototype.animate = realAnimate
    window.matchMedia = realMatch
  })
  function stubAnimate({ hang = false } = {}) {
    calls = []
    Element.prototype.animate = function (frames, opts) {
      let reject
      const finished = hang ? new Promise((_, r) => { reject = r }) : Promise.resolve()
      const a = { finished, cancel: vi.fn(() => reject?.(new Error('AbortError'))), el: this, frames, opts }
      calls.push(a)
      return a
    }
  }
  const mountPack = (props = {}) => mount(TtPack, { props: { look: LOOK, width: 240, ...props }, slots: { default: '<template #default="{ width }"><i class="card" :data-w="width" /></template>' } })

  it('sealed: the print, the card hidden inside at 86 percent of the width, Open and Skip', () => {
    const w = mountPack()
    expect(w.find('.tt-pk').classes()).toContain('is-sealed')
    expect(w.find('.tt-pk-word').text()).toBe('NEW YORK')
    expect(w.find('.tt-pk-title').text()).toBe('Times Square in five stops')
    expect(w.find('.tt-pk-count').text()).toBe('1 card')
    expect(w.find('.card').attributes('data-w')).toBe('206')
    expect(w.find('.tt-pk-card').attributes('aria-hidden')).toBe('true')
    const b = w.findAll('.tt-pk-calls button').map((x) => x.text())
    expect(b).toEqual(['Open', 'Skip'])
    expect(w.find('[data-focus]').text()).toBe('Open')
    expect(w.find('[data-focus]').attributes('aria-label')).toBe('Open the pack')
    const style = w.find('.tt-pk').attributes('style')
    expect(style).toContain('--tt-pk-tint: #006638')
    expect(style).toContain('--tt-pk-on: #FFFFFF')
    expect(style).toContain(`--tt-pk-stripe: ${TT_PACK_STRIPE}`)
    expect(style).toContain('--tt-pk-w: 240px')
  })

  it("the kit's plain buttons unset; a host's own classes when it passes them", () => {
    const a = mountPack()
    expect(a.find('[data-focus]').classes()).toEqual(['tt-pk-open'])
    expect(a.findAll('.tt-pk-calls button')[1].classes()).toEqual(['tt-pk-skip'])
    const b = mountPack({ openClass: 'pcn-btn pcn-btn-call pcn-btn-l', skipClass: 'pcn-link' })
    expect(b.find('[data-focus]').classes()).toEqual(['pcn-btn', 'pcn-btn-call', 'pcn-btn-l'])
    expect(b.findAll('.tt-pk-calls button')[1].classes()).toEqual(['pcn-link'])
  })

  it('with no Web Animations (or the server) Open goes straight to the card and says done', async () => {
    Element.prototype.animate = undefined
    const w = mountPack()
    await w.find('[data-focus]').trigger('click')
    await flushPromises()
    expect(w.find('.tt-pk').classes()).toContain('is-out')
    expect(w.emitted('done')).toHaveLength(1)
    expect(w.find('.tt-pk-body').exists()).toBe(false)
    expect(w.find('.tt-pk-strip').exists()).toBe(false)
    expect(w.find('.tt-pk-card').attributes('aria-hidden')).toBeUndefined()
  })

  it('plays tear, rise (card and pack), land, stamp and hold in order, then done once', async () => {
    stubAnimate()
    window.matchMedia = () => ({ matches: false })
    const w = mountPack()
    await w.find('.tt-pk-body').trigger('click')
    await flushPromises()
    const who = calls.map((a) => a.el.className.split(' ')[0])
    expect(who).toEqual(['tt-pk-strip', 'tt-pk-card', 'tt-pk-body', 'tt-pk-card', 'tt-pk-card', 'tt-pk-card'])
    expect(calls.map((a) => a.opts.duration)).toEqual([280, 520, 520, 160, 100, 520])
    expect(w.emitted('done')).toHaveLength(1)
    await w.find('.tt-pk-card').trigger('click')
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('reduced motion: the pack only fades, nothing moves', async () => {
    stubAnimate()
    window.matchMedia = (q) => ({ matches: q.includes('reduce') })
    const w = mountPack()
    await w.find('[data-focus]').trigger('click')
    await flushPromises()
    expect(calls).toHaveLength(2)
    for (const a of calls) {
      expect(a.opts.duration).toBe(200)
      expect(a.frames.every((f) => !('transform' in f))).toBe(true)
    }
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('a tap while it plays skips to the end and cancels what runs', async () => {
    stubAnimate({ hang: true })
    window.matchMedia = () => ({ matches: false })
    const w = mountPack()
    await w.find('[data-focus]').trigger('click')
    expect(w.find('.tt-pk').classes()).toContain('is-opening')
    expect(calls).toHaveLength(1)
    await w.find('.tt-pk').trigger('click')
    await flushPromises()
    expect(calls[0].cancel).toHaveBeenCalled()
    expect(w.find('.tt-pk').classes()).toContain('is-out')
    expect(w.emitted('done')).toHaveLength(1)
    expect(calls).toHaveLength(1)
  })

  it('Skip before it starts goes to the card; a short drag springs back; a long one tears', async () => {
    Element.prototype.animate = undefined
    const a = mountPack()
    await a.findAll('.tt-pk-calls button')[1].trigger('click')
    expect(a.emitted('done')).toHaveLength(1)

    const b = mountPack()
    const strip = b.find('.tt-pk-strip')
    await strip.trigger('pointerdown', { clientX: 10 })
    await strip.trigger('pointermove', { clientX: 60 })
    expect(strip.element.style.transform).toContain('rotate')
    await strip.trigger('pointerup', { clientX: 60 })
    expect(b.find('.tt-pk').classes()).toContain('is-sealed')
    expect(strip.element.style.transform).toBe('')
    await strip.trigger('pointerdown', { clientX: 10 })
    await strip.trigger('pointerup', { clientX: 200 })
    await flushPromises()
    expect(b.emitted('done')).toHaveLength(1)
  })

  it('a leftward drag or an up and down swipe on the strip springs back; a tap opens', async () => {
    Element.prototype.animate = undefined
    const w = mountPack()
    const strip = w.find('.tt-pk-strip')
    await strip.trigger('pointerdown', { clientX: 200, clientY: 10 })
    await strip.trigger('pointermove', { clientX: 120, clientY: 10 })
    await strip.trigger('pointerup', { clientX: 120, clientY: 10 })
    await flushPromises()
    expect(w.find('.tt-pk').classes()).toContain('is-sealed')
    await strip.trigger('pointerdown', { clientX: 50, clientY: 10 })
    await strip.trigger('pointerup', { clientX: 52, clientY: 90 })
    await flushPromises()
    expect(w.find('.tt-pk').classes()).toContain('is-sealed')
    expect(w.emitted('done')).toBeUndefined()
    await strip.trigger('pointerdown', { clientX: 50, clientY: 10 })
    await strip.trigger('pointerup', { clientX: 52, clientY: 12 })
    await flushPromises()
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('open, skip and state on the ref, as PcnPack had them', async () => {
    Element.prototype.animate = undefined
    const w = mountPack()
    expect(w.vm.state).toBe('sealed')
    w.vm.skip()
    await flushPromises()
    expect(w.vm.state).toBe('out')
    expect(w.emitted('done')).toHaveLength(1)
    w.vm.open()
    expect(w.emitted('done')).toHaveLength(1)
  })
})
