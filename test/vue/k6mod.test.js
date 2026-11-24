// @vitest-environment jsdom
/**
 * The moderation parts (1.1.0). TtReport (Report, the reason sheet, then Reported; guests and a 401 to signIn),
 * TtModChip (core ownerLabel's words), TtModHide (Hide, then Hidden with Restore), TtModSwitches (Approval queue and
 * Alerts, waiting and the topic, a 403 renders nothing), TtModQueue (tabs with counts, rows with their moves and the
 * row slot, a move's row out or in place, a 409 reloads, paging, the tabs' keys), the default request against the
 * host's endpoints, and css/moderation.css on its tokens only. Every request goes to a stub fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h } from 'vue'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import postcss from 'postcss'
import {
  TtReport, TtModChip, TtModHide, TtModSwitches, TtModQueue, TT_MOD_LABELS, TT_MOD_ENDPOINTS, TtModRequestError, ttModRequest,
} from '../../vue/index.js'
import { TT_MOD_TOKENS, TT_CLASSES } from '../../core/index.js'
import { ttSelectorClasses } from '../../conformance/css.js'

// ---- the stub host -------------------------------------------------------------------------------
let calls
let routes
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
beforeEach(() => {
  calls = []
  routes = []
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const method = init.method || 'GET'
    const body = init.body ? JSON.parse(init.body) : null
    calls.push({ url, method, body, init })
    const r = routes.find(x => x.method === method && (typeof x.url === 'string' ? url.startsWith(x.url) : x.url.test(url)))
    if (!r) return reply(404, { code: 'no_route' })
    const out = typeof r.fn === 'function' ? r.fn({ url, method, body }) : r.fn
    return reply(out[0], out[1])
  })
})
afterEach(() => { delete globalThis.fetch; document.body.innerHTML = ''; vi.useRealTimers() })
const route = (method, url, fn) => routes.push({ method, url, fn })

const PHOTO = { tree_photo: { not_this_tree: 'Not this tree', offensive: 'Offensive', spam: 'Spam', other: 'Other' } }
// the text a reader meets, a space between the words of separate elements
const txt = w => {
  const out = []
  const tw = document.createTreeWalker(w.element, NodeFilter.SHOW_TEXT)
  for (let n = tw.nextNode(); n; n = tw.nextNode()) out.push(n.nodeValue)
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

describe('the entry and the default request', () => {
  it('vue exports the five parts, their words and the request; core lists the tokens', () => {
    for (const c of [TtReport, TtModChip, TtModHide, TtModSwitches, TtModQueue]) expect(c).toBeTruthy()
    expect(TT_MOD_LABELS.report).toBe('Report')
    expect(TT_MOD_LABELS.queue).toBe('Approval queue')
    expect(Object.isFrozen(TT_MOD_LABELS)).toBe(true)
    expect(TT_MOD_ENDPOINTS).toEqual({ report: '/api/moderation/report', settings: '/api/admin/moderation/settings', queue: '/api/admin/moderation/queue', move: '/api/admin/moderation/move' })
    expect(TT_MOD_TOKENS.every(t => t.startsWith('--tt-mod-'))).toBe(true)
  })
  it('each op is one fetch to its endpoint, JSON both ways, the session cookie along', async () => {
    route('POST', '/x/report', [200, { ok: 1 }])
    route('GET', '/api/admin/moderation/settings', [200, { queue: true }])
    route('PUT', '/api/admin/moderation/settings', [200, { queue: false }])
    route('GET', '/q?site=1', [200, { rows: [] }])
    route('POST', '/api/admin/moderation/move', [200, {}])
    const ep = { report: '/x/report', queue: '/q?site=1' }
    expect(await ttModRequest('report', { kind: 'tree_photo', ref: 7, reason: 'spam' }, ep)).toEqual({ ok: 1 })
    await ttModRequest('settings', {}, ep)
    await ttModRequest('saveSettings', { queue: false }, ep)
    await ttModRequest('queue', { tab: 'reported', before: 'abc', limit: 5 }, ep)
    await ttModRequest('move', { kind: 'tree_note', ref: '9', move: 'hide' }, ep)
    expect(calls.map(c => [c.method, c.url, c.body])).toEqual([
      ['POST', '/x/report', { kind: 'tree_photo', ref: '7', reason: 'spam' }],
      ['GET', '/api/admin/moderation/settings', null],
      ['PUT', '/api/admin/moderation/settings', { queue: false }],
      ['GET', '/q?site=1&tab=reported&before=abc&limit=5', null],
      ['POST', '/api/admin/moderation/move', { kind: 'tree_note', ref: '9', move: 'hide' }],
    ])
    expect(calls.every(c => c.init.credentials === 'same-origin')).toBe(true)
    expect(calls[0].init.headers['content-type']).toBe('application/json')
  })
  it('a status outside 2xx throws with the status and the host code', async () => {
    route('POST', '/api/moderation/report', [429, { statusMessage: 'limit' }])
    const e = await ttModRequest('report', { kind: 'k', ref: 1, reason: 'spam' }).catch(x => x)
    expect(e).toBeInstanceOf(TtModRequestError)
    expect([e.status, e.code]).toEqual([429, 'limit'])
    await expect(ttModRequest('nope')).rejects.toThrow(TypeError)
  })
})

describe('TtModChip', () => {
  it("prints core ownerLabel's word for pending, declined and hidden, and nothing otherwise", () => {
    const at = (moderation, labels) => mount(TtModChip, { props: { moderation, labels } })
    expect(at({ state: 'pending', mine: true }).html()).toBe('<span class="tt-mod-chip" data-state="pending">Pending</span>')
    expect(at('declined').text()).toBe('Declined')
    expect(at({ state: 'hidden', mine: true }).text()).toBe('Hidden')
    expect(at({ state: 'pending', mine: true }, { pending: 'Waiting' }).text()).toBe('Waiting')
    for (const m of [null, 'approved', 'reported', { state: 'approved' }, {}]) expect(at(m).find('.tt-mod-chip').exists()).toBe(false)
  })
})

describe('TtReport', () => {
  const at = (props = {}, attrs = {}) => mount(TtReport, { props: { kind: 'tree_photo', itemRef: 41, labels: { reasons: PHOTO }, ...props }, attrs, attachTo: document.body })
  it('Report, the sheet with the kind\'s reasons in order, then Reported', async () => {
    route('POST', '/api/moderation/report', ({ body }) => [200, { item: { state: 'reported' }, already: false, body }])
    const w = at()
    expect(w.find('.tt-mod-link').text()).toBe('Report')
    expect(w.find('.tt-mod-sheet').exists()).toBe(false)
    await w.find('.tt-mod-link').trigger('click')
    expect(w.findAll('.tt-mod-reason').map(r => r.text())).toEqual(['Not this tree', 'Offensive', 'Spam', 'Other'])
    expect(document.activeElement).toBe(w.find('input[value="not_this_tree"]').element)
    const send = () => w.findAll('.tt-mod-btn').find(b => b.classes('is-primary'))
    expect(send().attributes('disabled')).toBeDefined()
    await w.find('input[value="spam"]').setValue(true)
    expect(w.find('.tt-mod-reason.is-on').text()).toBe('Spam')
    expect(send().attributes('disabled')).toBeUndefined()
    await send().trigger('click')
    await flushPromises()
    expect(calls.map(c => [c.method, c.url, c.body])).toEqual([['POST', '/api/moderation/report', { kind: 'tree_photo', ref: '41', reason: 'spam' }]])
    expect(w.find('.tt-mod-sheet').exists()).toBe(false)
    const done = w.find('.tt-mod-state')
    expect([done.text(), done.attributes('role')]).toEqual(['Reported', 'status'])
    expect(document.activeElement).toBe(done.element)
    expect(w.emitted('reported')[0][0]).toEqual({ kind: 'tree_photo', ref: 41, reason: 'spam', already: false })
  })
  it('reported (reportedByMe) starts at Reported; a repeat report says already', async () => {
    expect(at({ reported: true }).find('.tt-mod-state').text()).toBe('Reported')
    route('POST', '/api/moderation/report', [200, { already: true }])
    const w = at()
    await w.find('.tt-mod-link').trigger('click')
    await w.find('input[value="other"]').setValue(true)
    await w.find('.tt-mod-btn.is-primary').trigger('click')
    await flushPromises()
    expect(w.emitted('reported')[0][0].already).toBe(true)
  })
  it('a guest goes to signIn with no sheet and no request; a 401 also calls signIn and keeps the sheet', async () => {
    const signIn = vi.fn()
    const g = at({ guest: true, signIn })
    await g.find('.tt-mod-link').trigger('click')
    expect(signIn).toHaveBeenCalledTimes(1)
    expect(g.find('.tt-mod-sheet').exists()).toBe(false)
    route('POST', '/api/moderation/report', [401, {}])
    const w = at({ signIn })
    await w.find('.tt-mod-link').trigger('click')
    await w.find('input[value="spam"]').setValue(true)
    await w.find('.tt-mod-btn.is-primary').trigger('click')
    await flushPromises()
    expect(signIn).toHaveBeenCalledTimes(2)
    expect(w.find('.tt-mod-sheet').exists()).toBe(true)
    expect(w.find('.tt-mod-err').exists()).toBe(false)
  })
  it('429 says the limit, other failures Failed, and the sheet stays to try again', async () => {
    let st = 429
    route('POST', '/api/moderation/report', () => [st, {}])
    const w = at()
    await w.find('.tt-mod-link').trigger('click')
    await w.find('input[value="spam"]').setValue(true)
    await w.find('.tt-mod-btn.is-primary').trigger('click')
    await flushPromises()
    expect(w.find('.tt-mod-err').text()).toBe('Limit reached')
    st = 409
    await w.find('.tt-mod-btn.is-primary').trigger('click')
    await flushPromises()
    expect(w.find('.tt-mod-err').text()).toBe('Failed')
    expect(w.find('.tt-mod-err').attributes('role')).toBe('alert')
  })
  it('Cancel and Escape close the sheet and hand focus back to Report', async () => {
    const w = at()
    await w.find('.tt-mod-link').trigger('click')
    await w.findAll('.tt-mod-btn')[0].trigger('click')
    await flushPromises()
    expect(w.find('.tt-mod-sheet').exists()).toBe(false)
    expect(document.activeElement).toBe(w.find('.tt-mod-link').element)
    await w.find('.tt-mod-link').trigger('click')
    await w.find('.tt-mod-sheet').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(w.find('.tt-mod-sheet').exists()).toBe(false)
    expect(calls).toEqual([])
  })
  it('reasons: the prop\'s order, else the labels\' keys, else Other; a host request replaces fetch', async () => {
    const w = at({ reasons: ['spam', 'rude_words'] })
    await w.find('.tt-mod-link').trigger('click')
    expect(w.findAll('.tt-mod-reason').map(r => r.text())).toEqual(['Spam', 'Rude words'])
    const n = at({ labels: {} })
    await n.find('.tt-mod-link').trigger('click')
    expect(n.findAll('.tt-mod-reason').map(r => r.text())).toEqual(['Other'])
    const request = vi.fn(async () => ({ already: false }))
    await n.find('input[value="other"]').setValue(true)
    await n.setProps({ request })
    await n.find('.tt-mod-btn.is-primary').trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledWith('report', { kind: 'tree_photo', ref: 41, reason: 'other' })
    expect(calls).toEqual([])
  })
  it('a press inside the open sheet never reaches the card around it (a TtCard turns on a tap)', async () => {
    const down = vi.fn()
    const w = mount({ render: () => h('div', { onPointerdown: down }, [h(TtReport, { kind: 'tree_photo', itemRef: 1, labels: { reasons: PHOTO } })]) }, { attachTo: document.body })
    await w.find('.tt-mod-link').trigger('pointerdown')
    expect(down).toHaveBeenCalledTimes(1)
    await w.find('.tt-mod-link').trigger('click')
    await w.find('.tt-mod-sheet').trigger('pointerdown')
    await w.find('.tt-mod-reason').trigger('pointerdown')
    expect(down).toHaveBeenCalledTimes(1)
  })
})

describe('TtModHide', () => {
  it('Hide, then Hidden with Restore, each one move to the host', async () => {
    route('POST', '/api/admin/moderation/move', ({ body }) => [200, { item: { state: body.move === 'hide' ? 'hidden' : 'approved' }, move: body.move }])
    const w = mount(TtModHide, { props: { kind: 'tree_note', itemRef: 'n3' }, attachTo: document.body })
    expect(w.find('.tt-mod-link').text()).toBe('Hide')
    await w.find('.tt-mod-link').trigger('click')
    await flushPromises()
    expect(txt(w)).toBe('Hidden Restore')
    expect(document.activeElement).toBe(w.find('.tt-mod-state').element)
    await w.find('.tt-mod-link').trigger('click')
    await flushPromises()
    expect(txt(w)).toBe('Hide')
    expect(calls.map(c => c.body)).toEqual([{ kind: 'tree_note', ref: 'n3', move: 'hide' }, { kind: 'tree_note', ref: 'n3', move: 'restore' }])
    expect(w.emitted('moved').map(e => e[0].move)).toEqual(['hide', 'restore'])
  })
  it('starts hidden when told; a refusal says Failed and changes nothing', async () => {
    route('POST', '/api/admin/moderation/move', [403, {}])
    const w = mount(TtModHide, { props: { kind: 'tree_note', itemRef: 'n3', hidden: true, labels: { restore: 'Show again' } } })
    expect(txt(w)).toBe('Hidden Show again')
    await w.find('.tt-mod-link').trigger('click')
    await flushPromises()
    expect(txt(w)).toBe('Hidden Show again Failed')
    expect(w.emitted('moved')).toBeUndefined()
  })
})

describe('TtModSwitches', () => {
  const S = (o = {}) => ({ queue: true, alerts: true, topic: true, waiting: 3, ...o })
  it('reads the settings at mount: Approval queue with waiting, Alerts with the topic', async () => {
    route('GET', '/api/admin/moderation/settings', [200, S()])
    const w = mount(TtModSwitches)
    await flushPromises()
    const sw = w.findAll('[role="switch"]')
    expect(sw.map(s => [s.attributes('aria-label'), s.attributes('aria-checked'), s.text()])).toEqual([['Approval queue', 'true', 'On'], ['Alerts', 'true', 'On']])
    expect(w.findAll('.tt-mod-sw-sub').map(s => s.text())).toEqual(['3 waiting', 'ntfy'])
    expect(w.emitted('load')[0][0]).toEqual(S())
  })
  it('a switch PUTs its one key and shows the host\'s answer', async () => {
    route('GET', '/api/admin/moderation/settings', [200, S({ waiting: 0 })])
    route('PUT', '/api/admin/moderation/settings', ({ body }) => [200, { ...S({ waiting: 0 }), ...body }])
    const w = mount(TtModSwitches)
    await flushPromises()
    await w.findAll('[role="switch"]')[0].trigger('click')
    await flushPromises()
    expect(calls[1].body).toEqual({ queue: false })
    expect(w.findAll('[role="switch"]')[0].attributes('aria-checked')).toBe('false')
    expect(w.findAll('[role="switch"]')[0].text()).toBe('Off')
    expect(w.findAll('.tt-mod-sw-sub').map(s => s.text())).toEqual(['ntfy']) // queue off and none waiting: no count
    expect(w.emitted('change')[0][0].queue).toBe(false)
  })
  it('no topic says so; `settings` skips the read; `waiting` is the count shown', async () => {
    const w = mount(TtModSwitches, { props: { settings: S({ queue: false, topic: false, waiting: 2 }), waiting: 5, labels: { waiting: '{n} in line' } } })
    await flushPromises()
    expect(calls).toEqual([])
    expect(w.findAll('.tt-mod-sw-sub').map(s => s.text())).toEqual(['5 in line', 'No topic'])
  })
  it('a 403 renders nothing and emits denied; a failure offers Retry', async () => {
    route('GET', '/api/admin/moderation/settings', [403, {}])
    const d = mount(TtModSwitches)
    await flushPromises()
    expect(d.find('.tt-mod-sw').exists()).toBe(false)
    expect(d.emitted('denied')[0][0]).toBe(403)
    routes = []
    let st = 500
    route('GET', '/api/admin/moderation/settings', () => [st, S()])
    const w = mount(TtModSwitches)
    await flushPromises()
    expect(txt(w)).toBe('Failed Retry')
    st = 200
    await w.find('.tt-mod-link').trigger('click')
    await flushPromises()
    expect(w.findAll('[role="switch"]')).toHaveLength(2)
  })
})

describe('TtModQueue', () => {
  const NOW = Date.parse('2026-11-03T16:00:00Z')
  const row = (id, o = {}) => ({
    id, instance: 'treehopper', kind: 'tree_photo', ref: `p${id}`, owner: 'u1', state: 'pending', hiddenBy: null, reportsOpen: 0,
    submittedAt: '2026-11-03T15:56:00Z', decidedAt: null, decidedBy: null, updatedAt: '2026-11-03T15:56:00Z',
    kindLabel: 'Photo', preview: { title: 'London planetree', where: '312 W 88 St', img: `/img/${id}.jpg`, by: 'maya.k' }, reasons: {}, moves: ['approve', 'decline'], ...o,
  })
  const counts = { waiting: 2, reported: 1, hidden: 0 }
  let pages
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    pages = {
      waiting: { tab: 'waiting', rows: [row('1'), row('2', { kind: 'tree_note', kindLabel: 'Note', preview: { title: 'Pin oak', where: 'Riverside Dr', text: 'Hollow at the base.', by: 'dan.r' }, submittedAt: '2026-11-03T15:00:00Z' })], next: null, counts },
      reported: { tab: 'reported', rows: [row('3', { state: 'reported', reportsOpen: 3, decidedAt: '2026-10-12T15:00:00Z', reasons: { offensive: 2, not_this_tree: 1 }, moves: ['keep', 'hide'] })], next: null, counts },
      hidden: { tab: 'hidden', rows: [], next: null, counts },
      latest: { tab: 'latest', rows: [row('3', { state: 'reported', reportsOpen: 3, reasons: { offensive: 2 }, moves: ['keep', 'hide'] }), row('4', { state: 'approved', moves: ['hide'] })], next: null, counts },
    }
    route('GET', '/api/admin/moderation/queue', ({ url }) => [200, pages[new URL(url, 'http://x').searchParams.get('tab')]])
  })
  const at = (props = {}, slots = {}) => mount(TtModQueue, { props: { labels: { reasons: PHOTO }, ...props }, slots, attachTo: document.body })

  it('reads Waiting at mount; tabs carry their counts; rows show the item, by and sent, and their moves', async () => {
    const w = at()
    await flushPromises()
    expect(calls[0].url).toBe('/api/admin/moderation/queue?tab=waiting&limit=20')
    expect(w.findAll('[role="tab"]').map(t => [txt(t), t.attributes('aria-selected'), t.attributes('tabindex')])).toEqual([
      ['Waiting 2', 'true', '0'], ['Reported 1', 'false', '-1'], ['Hidden', 'false', '-1'], ['Latest', 'false', '-1']])
    const rows = w.findAll('.tt-mod-row')
    expect(rows.map(txt)).toEqual([
      'Photo London planetree 312 W 88 St By maya.k Sent 4 min Decline Approve',
      'Note Pin oak Riverside Dr Hollow at the base. By dan.r Sent 1 h Decline Approve',
    ])
    expect(rows[0].find('.tt-mod-thumb img').attributes('src')).toBe('/img/1.jpg')
    expect(rows[1].find('.tt-mod-thumb').exists()).toBe(false)
    expect(rows[0].find('.tt-mod-btn.is-primary').text()).toBe('Approve')
  })
  it('Reported rows show the open reports by reason and Keep, Hide; the figure follows the kind', async () => {
    pages.reported.rows[0].preview.figure = '3 of 9'
    const w = at({ tab: 'reported' })
    await flushPromises()
    expect(txt(w.find('.tt-mod-row'))).toBe('Photo · 3 of 9 London planetree 312 W 88 St By maya.k Shown Oct 12 Offensive 2 Not this tree 1 Keep Hide')
  })
  it('a move removes the row, moves the counts and hands focus to the next row', async () => {
    route('POST', '/api/admin/moderation/move', ({ body }) => [200, { item: { ...row('1'), state: 'approved', decidedBy: 'u9', moves: undefined }, move: body.move, from: 'pending', to: 'approved' }])
    const w = at()
    await flushPromises()
    await w.findAll('.tt-mod-row')[0].findAll('.tt-mod-btn')[1].trigger('click')
    await flushPromises()
    expect(calls[1].body).toEqual({ kind: 'tree_photo', ref: 'p1', move: 'approve' })
    expect(w.findAll('.tt-mod-row')).toHaveLength(1)
    expect(txt(w.find('[role="tab"]'))).toBe('Waiting 1')
    expect(w.emitted('counts').at(-1)[0]).toEqual({ waiting: 1, reported: 1, hidden: 0 })
    expect(w.emitted('moved')[0][0]).toMatchObject({ move: 'approve', row: { id: '1' } })
    expect(document.activeElement).toBe(w.find('.tt-mod-row .tt-mod-btn').element)
  })
  it('Keep in Latest leaves the row in place, approved, its reasons gone and Hide its one move', async () => {
    route('POST', '/api/admin/moderation/move', [200, { item: { ...row('3'), state: 'approved', reportsOpen: 0 }, from: 'reported', to: 'approved' }])
    const w = at({ tab: 'latest' })
    await flushPromises()
    await w.findAll('.tt-mod-row')[0].find('.tt-mod-btn').trigger('click')
    await flushPromises()
    const r = w.findAll('.tt-mod-row')[0]
    expect([r.attributes('data-state'), r.find('.tt-mod-why').exists(), r.findAll('.tt-mod-btn').map(b => b.text())]).toEqual(['approved', false, ['Hide']])
    expect(w.emitted('counts').at(-1)[0].reported).toBe(0)
  })
  it('a 409 reloads the tab; another failure says Failed on the row', async () => {
    let st = 409
    route('POST', '/api/admin/moderation/move', () => [st, {}])
    const w = at()
    await flushPromises()
    await w.find('.tt-mod-row .tt-mod-btn').trigger('click')
    await flushPromises()
    expect(calls.map(c => c.method)).toEqual(['GET', 'POST', 'GET'])
    st = 403
    await w.find('.tt-mod-row .tt-mod-btn').trigger('click')
    await flushPromises()
    expect(w.find('.tt-mod-row .tt-mod-err').text()).toBe('Failed')
  })
  it('the row slot sits after the moves with its row and tab (the Studio\'s Take down set)', async () => {
    const w = at({}, { row: ({ row: r, tab }) => h('button', { class: 'host-act' }, `Take down set ${r.ref} ${tab}`) })
    await flushPromises()
    const acts = w.find('.tt-mod-row .tt-mod-acts')
    expect(acts.findAll('button').map(b => b.text())).toEqual(['Decline', 'Approve', 'Take down set p1 waiting'])
  })
  it('tabs by click and by arrow keys, each one read; v-model:tab; empty says None; labels replace the words', async () => {
    const w = at({ labels: { tabHidden: 'Taken down', none: 'Empty', approve: 'Show' } })
    await flushPromises()
    await w.findAll('[role="tab"]')[2].trigger('click')
    await flushPromises()
    expect(w.emitted('update:tab')[0]).toEqual(['hidden'])
    expect(w.find('.tt-mod-none').text()).toBe('Empty')
    expect(w.findAll('[role="tab"]')[2].text()).toBe('Taken down')
    await w.find('[role="tablist"]').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(document.activeElement.dataset.tab).toBe('latest')
    await w.find('[role="tablist"]').trigger('keydown', { key: 'Home' })
    await flushPromises()
    expect(w.findAll('.tt-mod-row .tt-mod-btn.is-primary').map(b => b.text())).toEqual(['Show', 'Show'])
    expect(calls.map(c => new URL(c.url, 'http://x').searchParams.get('tab'))).toEqual(['waiting', 'hidden', 'latest', 'waiting'])
  })
  it('More reads the next page from the cursor and adds its rows', async () => {
    pages.waiting = { ...pages.waiting, rows: [row('1')], next: 'c1' }
    const w = at({ limit: 1 })
    await flushPromises()
    pages.waiting = { ...pages.waiting, rows: [row('2')], next: null }
    await w.find('.tt-mod-more').trigger('click')
    await flushPromises()
    expect(calls[1].url).toBe('/api/admin/moderation/queue?tab=waiting&before=c1&limit=1')
    expect(w.findAll('.tt-mod-row').map(r => r.attributes('data-row'))).toEqual(['1', '2'])
    expect(w.find('.tt-mod-more').exists()).toBe(false)
  })
  it('a 401 calls signIn; a 403 says Failed and emits denied', async () => {
    routes = []
    const signIn = vi.fn()
    route('GET', '/api/admin/moderation/queue', [401, {}])
    at({ signIn })
    await flushPromises()
    expect(signIn).toHaveBeenCalledTimes(1)
    routes = []
    route('GET', '/api/admin/moderation/queue', [403, {}])
    const w = at()
    await flushPromises()
    expect(w.find('.tt-mod-err').text()).toContain('Failed')
    expect(w.emitted('denied')[0][0]).toBe(403)
  })
})

describe('css/moderation.css', () => {
  const CSS = readFileSync(resolve(__dirname, '../../css/moderation.css'), 'utf8')
  it('reads its own tokens only, each in TT_MOD_TOKENS, and every one of them; no raw colour', () => {
    const read = new Set()
    postcss.parse(CSS).walkDecls(d => {
      for (const m of d.value.matchAll(/var\((--[\w-]+)/g)) read.add(m[1])
      expect(d.prop.startsWith('--')).toBe(false) // it declares no token: the host sets them
      expect(d.value).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i)
    })
    expect([...read].sort()).toEqual([...TT_MOD_TOKENS].sort())
  })
  it('every class it names is the kit\'s, in the tt-mod namespace', () => {
    const cls = new Set()
    postcss.parse(CSS).walkRules(r => r.selectors.forEach(s => ttSelectorClasses(s).forEach(c => cls.add(c))))
    const ns = [...cls].filter(c => /^(tt|ttf)-/.test(c))
    expect(ns.filter(c => !TT_CLASSES.includes(c))).toEqual([])
    expect(ns.every(c => c.startsWith('tt-mod'))).toBe(true)
    expect([...cls].filter(c => !ns.includes(c)).sort()).toEqual(['has-thumb', 'is-on', 'is-open', 'is-primary'])
  })
  it('resets a bare button in :where(.tt-mod) only, so a part class on a button keeps its type, colour and margin (1.6.2)', () => {
    const bare = []
    postcss.parse(CSS).walkRules(r => r.selectors.forEach(s => { if (/(^|[\s>+~])button$/.test(s.trim())) bare.push(s.trim()) }))
    expect(bare).toEqual([':where(.tt-mod) button'])
  })
})
