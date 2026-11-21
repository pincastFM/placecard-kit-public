// The moderation core's pure parts (moderation/index.js): the move table, every allowed and every
// refused move, shownToAll, the owner's labels, ntfyAlert, the shipped DDL.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import * as mod from '../../moderation/index.js'
import { MOVES, MOD_STATES, ModError, nextState, canMove, adminMoves, shownToAll, ownerLabel, ntfyAlert } from '../../moderation/index.js'

const root = resolve(__dirname, '../..')

// The move table, written out again here so the module is held to it, not to itself.
const TABLE = {
  submit: { from: ['new', 'declined', 'hidden:owner'], who: 'owner' },
  edit: { from: ['approved', 'reported'], who: 'owner' },
  approve: { from: ['pending', 'declined'], who: 'admin' },
  decline: { from: ['pending'], who: 'admin' },
  report: { from: ['approved', 'reported'], who: 'player' },
  keep: { from: ['reported'], who: 'admin' },
  hide: { from: ['approved', 'reported'], who: 'admin' },
  restore: { from: ['hidden:admin'], who: 'admin' },
  replace: { from: ['pending', 'approved', 'reported'], who: 'system' },
  takedown: { from: ['pending', 'approved', 'reported'], who: 'owner' },
}
// every place an item can be: not yet in the table, each state, and hidden three ways
const PLACES = ['new', 'pending', 'approved', 'declined', 'reported', 'hidden:admin', 'hidden:owner', 'hidden:replaced']
const at = p => {
  const [state, hiddenBy] = p.split(':')
  return { state, hiddenBy: hiddenBy || null }
}
const CTX = { queue: true, ownerIsAdmin: false, reports: 0 }

describe('the move table', () => {
  it('is SPEC section 2, move for move', () => {
    expect(Object.keys(MOVES).sort()).toEqual(Object.keys(TABLE).sort())
    for (const [move, rule] of Object.entries(TABLE)) {
      expect(MOVES[move].who, move).toBe(rule.who)
      const allowed = PLACES.filter(p => canMove(p === 'new' ? null : at(p), move))
      expect(allowed, move).toEqual(PLACES.filter(p => rule.from.includes(p)))
    }
    expect(Object.isFrozen(MOVES) && Object.isFrozen(MOVES.submit) && Object.isFrozen(MOVES.submit.from)).toBe(true)
    expect(MOD_STATES).toEqual(['pending', 'approved', 'declined', 'reported', 'hidden'])
  })

  it('lands each allowed move where the table says', () => {
    const land = (from, move, ctx = CTX) => nextState(at(from).state, move, { ...ctx, hiddenBy: at(from).hiddenBy })
    // submit: pending while the switch is on, shown at once while it is off or for an admin's own
    for (const from of ['new', 'declined', 'hidden:owner']) {
      expect(land(from, 'submit')).toBe('pending')
      expect(land(from, 'submit', { queue: false })).toBe('approved')
      expect(land(from, 'submit', { queue: true, ownerIsAdmin: true })).toBe('approved')
      expect(land(from, 'submit', { queue: false, reports: 2 })).toBe('reported')
      expect(land(from, 'submit', { queue: true, reports: 2 })).toBe('pending')
    }
    for (const from of ['approved', 'reported']) {
      expect(land(from, 'edit')).toBe('pending')
      expect(land(from, 'edit', { queue: false })).toBe(from)
      expect(land(from, 'edit', { queue: true, ownerIsAdmin: true })).toBe(from)
      expect(land(from, 'report')).toBe('reported')
      expect(land(from, 'hide')).toBe('hidden')
    }
    expect(land('pending', 'approve')).toBe('approved')
    expect(land('declined', 'approve')).toBe('approved')
    expect(land('pending', 'decline')).toBe('declined')
    expect(land('reported', 'keep')).toBe('approved')
    expect(land('hidden:admin', 'restore')).toBe('approved')
    for (const from of ['pending', 'approved', 'reported']) {
      expect(land(from, 'replace')).toBe('hidden')
      expect(land(from, 'takedown')).toBe('hidden')
    }
  })

  it('refuses every move the table does not have, with 409', () => {
    let refused = 0
    for (const move of Object.keys(TABLE)) {
      for (const p of PLACES) {
        if (canMove(p === 'new' ? null : at(p), move)) continue
        const t = () => nextState(at(p).state, move, { ...CTX, hiddenBy: at(p).hiddenBy })
        expect(t, `${move} from ${p}`).toThrow(ModError)
        try { t() } catch (e) { expect([e.code, e.status]).toEqual(['refused', 409]) }
        refused++
      }
    }
    // 10 moves from 8 places, 20 of them in the table
    expect(refused).toBe(80 - 20)
  })

  it('refuses a move it does not know (400), and submit or edit without the switch', () => {
    for (const m of ['delete', 'constructor', '__proto__', 'toString', undefined]) {
      try { nextState('pending', m); expect.unreachable() } catch (e) { expect([e.code, e.status]).toEqual(['bad_move', 400]) }
      expect(canMove({ state: 'pending' }, m)).toBe(false)
    }
    expect(() => nextState('new', 'submit')).toThrow(TypeError)
    expect(() => nextState('approved', 'edit', {})).toThrow(TypeError)
  })

  it('gives the queue the admin moves each place allows', () => {
    const moves = Object.fromEntries(PLACES.slice(1).map(p => [p, adminMoves(at(p))]))
    expect(moves).toEqual({
      pending: ['approve', 'decline'],
      approved: ['hide'],
      declined: ['approve'],
      reported: ['keep', 'hide'],
      'hidden:admin': ['restore'],
      'hidden:owner': [],
      'hidden:replaced': [],
    })
  })
})

describe('shownToAll and ownerLabel', () => {
  it('shows approved and reported only', () => {
    expect(MOD_STATES.filter(shownToAll)).toEqual(['approved', 'reported'])
  })

  it('labels the owner\'s own unshown item, never a replaced one', () => {
    const labels = PLACES.slice(1).map(p => ownerLabel(at(p)))
    expect(labels).toEqual(['Pending', null, 'Declined', null, 'Hidden', 'Hidden', null])
    expect(ownerLabel({ state: 'hidden', hidden_by: 'replaced' })).toBe(null)
    expect(ownerLabel({ state: 'pending' }, { pending: 'En attente' })).toBe('En attente')
    expect(ownerLabel(null)).toBe(null)
  })
})

describe('ntfyAlert', () => {
  const A = { event: 'new', instance: 'studio', kind: 'studio_card', ref: '7', state: 'pending', title: 'New Studio card', body: 'Blue Note\nVillage Music Rooms\nBy Ana', tab: 'waiting' }
  const ok = () => vi.fn(async () => ({ ok: true, status: 200 }))

  it('sends nothing without a good topic, and says so', async () => {
    for (const topic of [undefined, null, '', '  ', 'bad topic', 'a/b', 'x'.repeat(65)]) {
      const f = ok()
      const send = ntfyAlert(topic, 'https://placecard.io/placecard/review', { fetch: f })
      expect(send.ready).toBe(false)
      expect(await send(A)).toBe(false)
      expect(f).not.toHaveBeenCalled()
    }
  })

  it('posts one message: ASCII title, the words in the body, Click at the tab', async () => {
    const f = ok()
    const send = ntfyAlert(' pc-alerts_1 ', 'https://placecard.io/placecard/review', { fetch: f, tags: 'placecard' })
    expect(send.ready).toBe(true)
    expect(await send({ ...A, title: 'New café card\r\nX-Evil: 1' })).toBe(true)
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://ntfy.sh/pc-alerts_1')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Title: 'New caf card X-Evil: 1', Tags: 'placecard', Click: 'https://placecard.io/placecard/review?tab=waiting' })
    expect(Object.values(init.headers).every(v => /^[\x20-\x7e]*$/.test(v))).toBe(true)
    expect(init.body).toBe(A.body)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('joins the tab to a query already there, takes a function, drops a bad link', async () => {
    const f = ok()
    await ntfyAlert('t', 'https://x.test/admin?s=1', { fetch: f, server: 'https://push.example/' })({ ...A, tab: 'reported' })
    expect(f.mock.calls[0][0]).toBe('https://push.example/t')
    expect(f.mock.calls[0][1].headers.Click).toBe('https://x.test/admin?s=1&tab=reported')
    await ntfyAlert('t', a => `https://x.test/q/${a.kind}`, { fetch: f })(A)
    expect(f.mock.calls[1][1].headers.Click).toBe('https://x.test/q/studio_card')
    await ntfyAlert('t', 'javascript:alert(1)', { fetch: f })(A)
    await ntfyAlert('t', null, { fetch: f })(A)
    expect(f.mock.calls[2][1].headers.Click).toBeUndefined()
    expect(f.mock.calls[3][1].headers.Click).toBeUndefined()
    await ntfyAlert('t', null, { fetch: f })({ ...A, title: 'été' })
    await ntfyAlert('t', null, { fetch: f })({ ...A, title: 'ゆき' })
    expect(f.mock.calls.slice(4).map(c => c[1].headers.Title)).toEqual(['t', 'Moderation'])
  })

  it('never throws: a refusal or a network error is logged and resolves false', async () => {
    const log = vi.fn()
    expect(await ntfyAlert('t', null, { fetch: async () => ({ ok: false, status: 429 }), log })(A)).toBe(false)
    expect(await ntfyAlert('t', null, { fetch: async () => { throw new Error('down') }, log })(A)).toBe(false)
    expect(await ntfyAlert('t', () => { throw new Error('bad click') }, { fetch: ok(), log })(A)).toBe(false)
    expect(await ntfyAlert('t', null, { fetch: ok(), log })(null)).toBe(false)
    expect(log.mock.calls.map(c => c[1])).toEqual(['ntfy 429', 'down', 'bad click'])
    const noisy = ntfyAlert('t', null, { fetch: async () => { throw new Error('x') }, log: () => { throw new Error('log broke') } })
    await expect(noisy(A)).resolves.toBe(false)
  })
})

describe('the package', () => {
  it('ships SPEC section 4\'s DDL byte for byte (sha256 pinned at K5)', () => {
    const sql = readFileSync(resolve(root, 'sql/moderation.sql'))
    expect(createHash('sha256').update(sql).digest('hex')).toBe('fe467cdaa5e815ab0f98677555153636c90756001739ad45e5228ea4ddcc7412')
    expect(sql.toString().match(/CREATE TABLE IF NOT EXISTS (\w+)/g)).toEqual([
      'CREATE TABLE IF NOT EXISTS moderation_items', 'CREATE TABLE IF NOT EXISTS moderation_reports',
      'CREATE TABLE IF NOT EXISTS moderation_settings', 'CREATE TABLE IF NOT EXISTS moderation_events',
    ])
  })

  it('exports ./moderation with types, and ships moderation and sql', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    expect(pkg.exports['./moderation']).toEqual({ types: './moderation/index.d.ts', import: './moderation/index.js' })
    expect(pkg.exports['./sql/*']).toBe('./sql/*')
    expect(pkg.files).toEqual(expect.arrayContaining(['moderation', 'sql']))
    expect(mod.CONTRACT_VERSION).toBe(pkg.version)
  })

  it('exports what its types declare, and nothing else', () => {
    const dts = readFileSync(resolve(root, 'moderation/index.d.ts'), 'utf8')
    const declared = [...dts.matchAll(/export declare (?:const|function|class) (\w+)/g)].map(m => m[1]).sort()
    expect(Object.keys(mod).sort()).toEqual(declared)
    expect(declared).toEqual(['CONTRACT_VERSION', 'MOD_ADMIN_MOVES', 'MOD_SEEN_MOVES', 'MOD_STATES', 'MOD_TABS', 'MOVES', 'ModError',
      'REPORTS_PER_DAY', 'adminMoves', 'canMove', 'createModeration', 'modRevision', 'nextState', 'ntfyAlert', 'ownerLabel', 'shownToAll'])
  })
})
