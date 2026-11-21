// @vitest-environment jsdom
/**
 * 1.5.0 (unreleased): TtModQueue sends the revision a row shows as `seen` with Approve, Keep and Restore (never with
 * Decline or Hide), and a 409 reloads the tab and says Changed on a row still in it when the core refused it (moved
 * or refused), Failed for a host's own 409 (NYID's set_not_live); the default request puts `seen` in the move's body
 * only when given. A Live card's waiting change: its Waiting row has Hide among its moves. Every request goes to a
 * stub fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { TtModQueue, TT_MOD_LABELS, ttModRequest } from '../../vue/index.js'

let calls
let routes
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
beforeEach(() => {
  calls = []
  routes = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const method = init.method || 'GET'
    const body = init.body ? JSON.parse(init.body) : null
    calls.push({ url, method, body })
    const r = routes.find(x => x.method === method && url.startsWith(x.url))
    if (!r) return reply(404, { code: 'no_route' })
    const out = typeof r.fn === 'function' ? r.fn({ url, method, body }) : r.fn
    return reply(out[0], out[1])
  })
})
afterEach(() => { delete globalThis.fetch; document.body.innerHTML = '' })
const route = (method, url, fn) => routes.push({ method, url, fn })

const row = (id, o = {}) => ({
  id, instance: 'studio', kind: 'studio_card', ref: `c${id}`, owner: 'u1', state: 'pending', hiddenBy: null, reportsOpen: 0,
  submittedAt: '2026-11-20T06:00:00Z', decidedAt: null, decidedBy: null, updatedAt: '2026-11-20T06:00:00Z',
  kindLabel: 'Card', preview: { title: `Card ${id}` }, reasons: {}, moves: ['approve', 'decline'], revision: `r1:${id}seen`, ...o,
})
const counts = { waiting: 2, reported: 1, hidden: 1 }
const at = props => mount(TtModQueue, { props, attachTo: document.body })
const moveBtn = (w, i, m) => w.findAll('.tt-mod-row')[i].find(`[data-move="${m}"]`)

describe('TtModQueue: the revision the admin saw', () => {
  let pages
  beforeEach(() => {
    pages = {
      waiting: { tab: 'waiting', rows: [row('1'), row('2', { public: true, moves: ['approve', 'decline', 'hide'], reportsOpen: 1, reasons: { spam: 1 } })], next: null, counts },
      reported: { tab: 'reported', rows: [row('3', { state: 'reported', reportsOpen: 1, moves: ['keep', 'hide'] })], next: null, counts },
      hidden: { tab: 'hidden', rows: [row('4', { state: 'hidden', hiddenBy: 'admin', moves: ['restore'] })], next: null, counts },
      latest: { tab: 'latest', rows: [], next: null, counts },
    }
    // a copy each time, as a host's JSON is: the queue splices its own rows
    route('GET', '/api/admin/moderation/queue', ({ url }) => [200, JSON.parse(JSON.stringify(pages[new URL(url, 'http://x').searchParams.get('tab')]))])
  })

  it('Approve, Keep and Restore carry it as seen; Decline and Hide do not', async () => {
    route('POST', '/api/admin/moderation/move', ({ body }) => [200, { item: { ...row('x'), state: 'approved' }, move: body.move, from: 'pending', to: 'approved' }])
    for (const [tab, i, m, seen] of [['waiting', 0, 'approve', 'r1:1seen'], ['waiting', 0, 'decline', null], ['waiting', 1, 'hide', null],
      ['reported', 0, 'keep', 'r1:3seen'], ['reported', 0, 'hide', null], ['hidden', 0, 'restore', 'r1:4seen']]) {
      const w = at({ tab })
      await flushPromises()
      calls.length = 0
      await moveBtn(w, i, m).trigger('click')
      await flushPromises()
      const want = { kind: 'studio_card', ref: pages[tab].rows[i].ref, move: m, ...(seen ? { seen } : {}) }
      expect(calls[0].body, `${tab} ${m}`).toEqual(want)
      w.unmount()
    }
  })

  it('a row without a revision (a host before 1.5.0) sends no seen', async () => {
    delete pages.waiting.rows[0].revision
    route('POST', '/api/admin/moderation/move', [200, { item: { ...row('1'), state: 'approved' }, to: 'approved' }])
    const w = at({})
    await flushPromises()
    await moveBtn(w, 0, 'approve').trigger('click')
    await flushPromises()
    expect(calls.find(c => c.method === 'POST').body).toEqual({ kind: 'studio_card', ref: 'c1', move: 'approve' })
  })

  it('a 409 reloads the tab; the row, still waiting with its new version, says Changed; the next Approve sends the new revision', async () => {
    let st = 409
    route('POST', '/api/admin/moderation/move', () => (st === 409 ? [409, { code: 'moved' }] : [200, { item: { ...row('1'), state: 'approved' }, to: 'approved' }]))
    const w = at({})
    await flushPromises()
    pages.waiting.rows[0] = row('1', { preview: { title: 'Card 1, changed' }, revision: 'r1:1new' })
    await moveBtn(w, 0, 'approve').trigger('click')
    await flushPromises()
    expect(calls.map(c => c.method)).toEqual(['GET', 'POST', 'GET'])
    const r0 = w.findAll('.tt-mod-row')[0]
    expect(r0.find('.tt-mod-title').text()).toBe('Card 1, changed')
    expect(r0.find('.tt-mod-err').text()).toBe(TT_MOD_LABELS.changed)
    expect(TT_MOD_LABELS.changed).toBe('Changed')
    st = 200
    await moveBtn(w, 0, 'approve').trigger('click')
    await flushPromises()
    expect(calls.at(-1).body).toEqual({ kind: 'studio_card', ref: 'c1', move: 'approve', seen: 'r1:1new' })
    expect(w.findAll('.tt-mod-row')).toHaveLength(1)
  })

  it('a 409 for a row gone from the tab says nothing on the rows left', async () => {
    route('POST', '/api/admin/moderation/move', [409, { code: 'refused' }])
    const w = at({})
    await flushPromises()
    pages.waiting.rows = [pages.waiting.rows[1]]
    await moveBtn(w, 0, 'approve').trigger('click')
    await flushPromises()
    expect(w.findAll('.tt-mod-row').map(r => r.attributes('data-row'))).toEqual(['2'])
    expect(w.find('.tt-mod-err').exists()).toBe(false)
  })

  it('a host\'s own 409 on a row still listed says Failed, not Changed (a Restore under a taken-down set)', async () => {
    // NYID's studio_card show throws ModError('set_not_live', 409); its route sends h3's body, the code under data
    route('POST', '/api/admin/moderation/move', [409, { statusCode: 409, message: 'Set is not live', data: { code: 'set_not_live' } }])
    const w = at({ tab: 'hidden' })
    await flushPromises()
    for (let n = 0; n < 2; n++) {
      await moveBtn(w, 0, 'restore').trigger('click')
      await flushPromises()
      const r0 = w.findAll('.tt-mod-row')[0]
      expect(r0.attributes('data-row')).toBe('4')
      expect(r0.find('.tt-mod-err').text()).toBe(TT_MOD_LABELS.failed)
    }
    expect(calls.map(c => c.method)).toEqual(['GET', 'POST', 'GET', 'POST', 'GET'])
  })

  it('the core\'s refused on a row still listed says Changed, and so does a host request\'s error with code moved', async () => {
    route('POST', '/api/admin/moderation/move', [409, { code: 'refused' }])
    const w = at({})
    await flushPromises()
    await moveBtn(w, 0, 'approve').trigger('click')
    await flushPromises()
    expect(w.findAll('.tt-mod-row')[0].find('.tt-mod-err').text()).toBe(TT_MOD_LABELS.changed)
    w.unmount()
    // a host's own request: an error with status and code, as the kit's TtModRequestError has them
    const request = async (op, args) => {
      if (op === 'queue') return JSON.parse(JSON.stringify(pages[args.tab]))
      throw Object.assign(new Error('conflict'), { status: 409, code: op === 'move' ? 'moved' : null })
    }
    const v = at({ request })
    await flushPromises()
    await moveBtn(v, 1, 'approve').trigger('click')
    await flushPromises()
    expect(v.findAll('.tt-mod-row')[1].find('.tt-mod-err').text()).toBe(TT_MOD_LABELS.changed)
    expect(v.findAll('.tt-mod-row')[0].find('.tt-mod-err').exists()).toBe(false)
  })

  it('a waiting change with a public version offers Hide, in the table\'s order, with its reasons', async () => {
    const w = at({ labels: { reasons: { studio_card: { spam: 'Spam' } } } })
    await flushPromises()
    const r1 = w.findAll('.tt-mod-row')[1]
    expect(r1.findAll('.tt-mod-btn').map(b => b.text())).toEqual(['Decline', 'Approve', 'Hide'])
    expect(r1.find('.tt-mod-why').text()).toBe('Spam 1')
  })
})

describe('ttModRequest: seen in the move body', () => {
  it('only when it is a string', async () => {
    route('POST', '/m', [200, {}])
    const ep = { move: '/m' }
    await ttModRequest('move', { kind: 'k', ref: 3, move: 'approve', seen: 'r1:abc' }, ep)
    await ttModRequest('move', { kind: 'k', ref: 3, move: 'approve' }, ep)
    await ttModRequest('move', { kind: 'k', ref: 3, move: 'approve', seen: null }, ep)
    expect(calls.map(c => c.body)).toEqual([
      { kind: 'k', ref: '3', move: 'approve', seen: 'r1:abc' },
      { kind: 'k', ref: '3', move: 'approve' },
      { kind: 'k', ref: '3', move: 'approve' },
    ])
  })
})
