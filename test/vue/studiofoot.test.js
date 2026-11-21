// @vitest-environment jsdom
// The Studio foot: it always prints the app's name and site, the site without its scheme, and on an open card the
// app's name links to the app in a new tab. On the table the name stays text.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { TtFace, TtTable, setTtHost } from '../../vue/index.js'

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.scrollIntoView = function () {}
window.scrollTo = () => {}
beforeEach(() => {
  Element.prototype.animate = function () { return { onfinish: null, oncancel: null, cancel() {}, finish() {} } }
  setTtHost({ head: vi.fn(), distUnit: null })
  try { localStorage.clear() } catch { /* none */ }
})
afterEach(() => { setTtHost({ head: null, distUnit: null }); document.body.innerHTML = '' })

const CARD = (o = {}) => ({ id: 'b:hawk', app: 'bird-walk', set: 'park', face: 'studio', title: 'Red-tailed Hawk', held: true, ...o })
const DATA = (site = 'https://birdwalk.example/', name = 'Bird Walk') => ({
  apps: [{ id: 'bird-walk', name, color: '#B4432F', site }],
  sets: [{ id: 'park', app: 'bird-walk', name: 'Prospect Park', short: 'PARK', total: 1 }],
  cards: [CARD()],
})
const face = (data, appLink, card = CARD()) => mount(TtFace, { props: { card, data, fonts: false, appLink } })

describe('the Studio foot', () => {
  it('prints the app and its site on a card with no photo, credit or number', () => {
    const w = face(DATA(), false)
    expect(w.find('.ttf-pc-line').text()).toBe('BIRD WALK · BIRDWALK.EXAMPLE')
    w.unmount()
  })

  it.each([
    ['https://birdwalk.example', 'BIRDWALK.EXAMPLE'],
    ['HTTP://birdwalk.example/', 'BIRDWALK.EXAMPLE'],
    ['birdwalk.example', 'BIRDWALK.EXAMPLE'],
    ['https://birdwalk.example/app/', 'BIRDWALK.EXAMPLE/APP'],
  ])('writes the site %s as %s', (site, word) => {
    const w = face(DATA(site), false)
    expect(w.find('.ttf-pc-site').text()).toBe(`· ${word}`)
    w.unmount()
  })

  it('links the app name to the app in a new tab when asked', () => {
    const w = face(DATA(), true)
    const a = w.find('a.ttf-pc-app')
    expect(a.text()).toBe('BIRD WALK')
    expect(a.attributes()).toMatchObject({ href: 'https://birdwalk.example/', target: '_blank', rel: 'noopener' })
    expect(w.find('.ttf-pc-line').text()).toBe('BIRD WALK · BIRDWALK.EXAMPLE')
    w.unmount()
  })

  it('gives a bare host https', () => {
    const w = face(DATA('birdwalk.example'), true)
    expect(w.find('a.ttf-pc-app').attributes('href')).toBe('https://birdwalk.example/')
    w.unmount()
  })

  it.each(['javascript:alert(1)', 'data:text/html,x', 'mailto:a@b.example', 'https://name:secret@birdwalk.example', ''])('never links the site %s', site => {
    const w = face(DATA(site), true)
    expect(w.find('a').exists()).toBe(false)
    expect(w.find('.ttf-pc-line').text()).toContain('BIRD WALK')
    w.unmount()
  })

  it('prints no link without the ask, and none for an app with no record', () => {
    const a = face(DATA(), false)
    expect(a.find('a').exists()).toBe(false)
    a.unmount()
    const b = face({ apps: [] }, true)
    expect(b.find('a').exists()).toBe(false)
    expect(b.find('.ttf-pc-line').text()).toBe('STUDIO')
    b.unmount()
  })

  it('on a table the name is text; the open card links it', async () => {
    const w = mount(TtTable, { props: { collection: DATA(), options: { key: 'foot' } }, attachTo: document.body })
    await flushPromises()
    expect(document.querySelector('.tt-cell a.ttf-pc-app')).toBe(null)
    document.querySelector('.tt-hit').click()
    await flushPromises()
    const a = document.querySelector('.tt-st-card a.ttf-pc-app')
    expect(a && a.getAttribute('href')).toBe('https://birdwalk.example/')
    w.unmount()
  })
})
