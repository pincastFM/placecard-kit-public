// An instance of the moderation core on an in-memory Postgres (PGlite, Postgres 18 in WASM) running
// the shipped sql/moderation.sql as is. A fake kind keeps its content in its own table with a
// hidden flag, as Treehopper's hidden_at does; its public read is every row not hidden. Each case:
// the move table through the instance, refused moves, the rule (content public iff approved or
// reported), reports and their limit, the switch, the queue, alerts, and one event row per move.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { createModeration, shownToAll, ModError, MOVES } from '../../moderation/index.js'

const DDL = readFileSync(resolve(__dirname, '../../sql/moderation.sql'), 'utf8')
const ANA = { sub: 'sub-ana', name: 'Ana', admin: false }
const BO = { sub: 'sub-bo', name: 'Bo', admin: false }
const CY = { sub: 'sub-cy', name: 'Cy', admin: false }
const ADM = { sub: 'sub-adm', name: 'Admin', admin: true }

let pg
const calls = { why: [], after: [], alerts: [] }

function fakeKind(label, extra = {}) {
  return {
    label,
    reasons: ['not_this_tree', 'offensive', 'spam', 'other'],
    async show(c, ref) { await c.query('UPDATE fake_content SET hidden = false WHERE ref = $1', [ref]) },
    async unshow(c, ref, why) {
      calls.why.push(`${ref}:${why}`)
      await c.query('UPDATE fake_content SET hidden = true WHERE ref = $1', [ref])
    },
    async preview(c, refs) {
      const rows = (await c.query('SELECT ref, owner, body FROM fake_content WHERE ref = ANY($1::text[])', [refs])).rows
      return Object.fromEntries(rows.map(r => [r.ref, { title: r.body, where: '312 W 88 St', by: r.owner }]))
    },
    after(refs) { calls.after.push(...refs) },
    ...extra,
  }
}

function make(over = {}) {
  const alert = Object.assign(async (a) => { calls.alerts.push(a) }, { ready: true })
  return createModeration({
    instance: 'treehopper',
    db: pg,
    transaction: fn => pg.transaction(fn),
    kinds: { tree_photo: fakeKind('Photo'), tree_note: fakeKind('Note', { reasons: ['offensive', 'spam', 'private', 'other'] }) },
    alert,
    ...over,
  })
}

// The host's insert: the content row, hidden, and its item, in one transaction of the host's.
async function post(m, actor, ref, kind = 'tree_photo', body = `photo ${ref}`) {
  let res
  await pg.transaction(async (tx) => {
    await tx.query('INSERT INTO fake_content (ref, owner, body) VALUES ($1, $2, $3)', [ref, actor.name, body])
    res = await m.submit(actor, kind, ref, tx)
  })
  await res.after()
  return res
}

const pub = async () => (await pg.query('SELECT ref FROM fake_content WHERE NOT hidden ORDER BY ref')).rows.map(r => r.ref)
const items = async () => (await pg.query('SELECT * FROM moderation_items ORDER BY id')).rows
const events = async () => (await pg.query('SELECT i.ref, e.move, e.from_state, e.to_state, e.actor FROM moderation_events e JOIN moderation_items i ON i.id = e.item_id ORDER BY e.id')).rows
const setQueue = (on) => pg.query(`INSERT INTO moderation_settings (instance, queue) VALUES ('treehopper', $1) ON CONFLICT (instance) DO UPDATE SET queue = $1`, [on])
const refusal = async (p) => {
  try { await p } catch (e) { expect(e).toBeInstanceOf(ModError); return [e.code, e.status] }
  throw new Error('not refused')
}

// The rule every move must keep (the public read is exactly the items in a shown state), checked against the
// database as it stands.
async function rule() {
  const its = await items()
  expect(await pub()).toEqual(its.filter(i => shownToAll(i.state)).map(i => i.ref).sort())
  for (const i of its) {
    if (shownToAll(i.state)) expect(i.state === 'reported', `${i.ref}`).toBe(i.reports_open > 0)
    const open = (await pg.query('SELECT count(*)::int AS n FROM moderation_reports WHERE item_id = $1 AND resolved_at IS NULL', [i.id])).rows[0].n
    expect(i.reports_open, `${i.ref} open reports`).toBe(open)
  }
}

beforeAll(async () => {
  pg = new PGlite()
  await pg.waitReady
}, 60000)
afterAll(async () => { await pg?.close() })
beforeEach(async () => {
  await pg.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await pg.exec(DDL)
  await pg.exec('CREATE TABLE fake_content (ref text PRIMARY KEY, owner text, body text, hidden boolean NOT NULL DEFAULT true)')
  calls.why = []; calls.after = []; calls.alerts = []
})

describe('the DDL', () => {
  it('runs as shipped, twice (IF NOT EXISTS), and holds hidden_by to the hidden state', async () => {
    await pg.exec(DDL)
    await pg.query(`INSERT INTO moderation_items (instance, kind, ref, owner_sub, state) VALUES ('t', 'k', '1', 'u', 'pending')`)
    await expect(pg.query(`UPDATE moderation_items SET state = 'hidden'`)).rejects.toThrow(/moderation_items_hidden_chk/)
    await expect(pg.query(`UPDATE moderation_items SET state = 'gone'`)).rejects.toThrow(/moderation_items_state_chk/)
  })
})

describe('submit', () => {
  it('holds a new item while the switch is on: pending, unseen, the owner\'s own Pending', async () => {
    const m = make()
    await setQueue(true)
    const r = await post(m, ANA, 'p1')
    expect([r.move, r.from, r.to, r.item.state, r.item.decidedBy]).toEqual(['submit', 'new', 'pending', 'pending', null])
    expect(await pub()).toEqual([])
    expect((await m.mine(ANA.sub, 'tree_photo')).map(i => [i.ref, i.label])).toEqual([['p1', 'Pending']])
    expect(await m.mine(BO.sub, 'tree_photo')).toEqual([])
    expect(await events()).toEqual([{ ref: 'p1', move: 'submit', from_state: null, to_state: 'pending', actor: ANA.sub }])
    expect(calls.why).toEqual(['p1:pending'])
    expect(calls.after).toEqual(['p1'])
    expect(calls.alerts.map(a => [a.event, a.title, a.body, a.tab])).toEqual([['new', 'New photo', 'photo p1\n312 W 88 St\nBy Ana', 'waiting']])
  })

  it('shows at once while it is off (decided by auto), or for an admin\'s own (own)', async () => {
    const m = make()
    await setQueue(false)
    expect((await post(m, ANA, 'p1')).item).toMatchObject({ state: 'approved', decidedBy: 'auto' })
    await setQueue(true)
    expect((await post(m, ADM, 'p2')).item).toMatchObject({ state: 'approved', decidedBy: 'own' })
    expect(await pub()).toEqual(['p1', 'p2'])
    expect(calls.alerts.map(a => [a.ref, a.tab])).toEqual([['p1', 'latest']])
    await rule()
  })

  it('lands in the host\'s transaction: the content and its item roll back together, and after() waits for the host', async () => {
    const m = make()
    await setQueue(true)
    await expect(pg.transaction(async (tx) => {
      await tx.query(`INSERT INTO fake_content (ref, owner, body) VALUES ('p9', 'Ana', 'x')`)
      await m.submit(ANA, 'tree_photo', 'p9', tx)
      throw new Error('host failed after the insert')
    })).rejects.toThrow('host failed')
    expect(await items()).toEqual([])
    expect((await pg.query('SELECT * FROM fake_content')).rows).toEqual([])
    let res
    await pg.transaction(async (tx) => {
      await tx.query(`INSERT INTO fake_content (ref, owner, body) VALUES ('p9', 'Ana', 'x')`)
      res = await m.submit(ANA, 'tree_photo', 'p9', tx)
    })
    expect(calls.alerts).toEqual([])
    expect(calls.after).toEqual([])
    await Promise.all([res.after(), res.after()])
    expect(calls.alerts.length).toBe(1)
    expect(calls.after).toEqual(['p9'])
  })

  it('sends again a declined item, and one its owner took down, but never one an admin hid', async () => {
    const m = make()
    await setQueue(true)
    await post(m, ANA, 'p1')
    await m.move(ADM, 'tree_photo', 'p1', 'decline')
    expect((await m.submit(ANA, 'tree_photo', 'p1')).to).toBe('pending')
    await m.move(ADM, 'tree_photo', 'p1', 'approve')
    await m.takedown(ANA, 'tree_photo', 'p1')
    expect((await m.mine(ANA.sub, 'tree_photo')).map(i => i.label)).toEqual(['Hidden'])
    expect((await m.submit(ANA, 'tree_photo', 'p1')).to).toBe('pending')
    await m.move(ADM, 'tree_photo', 'p1', 'approve')
    await m.move(ADM, 'tree_photo', 'p1', 'hide')
    expect(await refusal(m.submit(ANA, 'tree_photo', 'p1'))).toEqual(['refused', 409])
    expect((await items())[0]).toMatchObject({ state: 'hidden', hidden_by: 'admin' })
    expect((await m.move(ADM, 'tree_photo', 'p1', 'restore')).to).toBe('approved')
    await rule()
  })
})

describe('the moves, row by row', () => {
  it('runs every row of the table, one event each with its actor, and keeps the rule after every move', async () => {
    const m = make()
    await setQueue(true)
    const steps = [
      ['p1', () => post(m, ANA, 'p1'), 'submit', null, 'pending', ANA.sub],
      ['p1', () => m.move(ADM, 'tree_photo', 'p1', 'decline'), 'decline', 'pending', 'declined', ADM.sub],
      ['p1', () => m.move(ADM, 'tree_photo', 'p1', 'approve'), 'approve', 'declined', 'approved', ADM.sub],
      ['p1', () => m.report(BO, 'tree_photo', 'p1', 'offensive'), 'report', 'approved', 'reported', BO.sub],
      ['p1', () => m.report(CY, 'tree_photo', 'p1', 'spam'), 'report', 'reported', 'reported', CY.sub],
      ['p1', () => m.move(ADM, 'tree_photo', 'p1', 'keep'), 'keep', 'reported', 'approved', ADM.sub],
      ['p1', () => m.edit(ANA, 'tree_photo', 'p1'), 'edit', 'approved', 'pending', ANA.sub],
      ['p1', () => m.move(ADM, 'tree_photo', 'p1', 'approve'), 'approve', 'pending', 'approved', ADM.sub],
      ['p1', () => m.move(ADM, 'tree_photo', 'p1', 'hide'), 'hide', 'approved', 'hidden', ADM.sub],
      ['p1', () => m.move(ADM, 'tree_photo', 'p1', 'restore'), 'restore', 'hidden', 'approved', ADM.sub],
      ['p1', () => m.takedown(ANA, 'tree_photo', 'p1'), 'takedown', 'approved', 'hidden', ANA.sub],
      ['p1', () => m.submit(ANA, 'tree_photo', 'p1'), 'submit', 'hidden', 'pending', ANA.sub],
      ['p1', () => m.takedown(ANA, 'tree_photo', 'p1'), 'takedown', 'pending', 'hidden', ANA.sub],
      ['p2', () => post(m, ANA, 'p2'), 'submit', null, 'pending', ANA.sub],
      ['p2', () => m.move(ADM, 'tree_photo', 'p2', 'decline'), 'decline', 'pending', 'declined', ADM.sub],
      ['p2', () => m.submit(ANA, 'tree_photo', 'p2'), 'submit', 'declined', 'pending', ANA.sub],
      ['p2', () => m.replace('tree_photo', 'p2'), 'replace', 'pending', 'hidden', 'system'],
      ['p3', () => post(m, ANA, 'p3'), 'submit', null, 'pending', ANA.sub],
      ['p3', () => m.move(ADM, 'tree_photo', 'p3', 'approve'), 'approve', 'pending', 'approved', ADM.sub],
      ['p3', () => m.report(BO, 'tree_photo', 'p3', 'offensive'), 'report', 'approved', 'reported', BO.sub],
      ['p3', () => m.edit(ANA, 'tree_photo', 'p3'), 'edit', 'reported', 'pending', ANA.sub],
      ['p3', () => m.move(ADM, 'tree_photo', 'p3', 'approve'), 'approve', 'pending', 'approved', ADM.sub],
      ['p3', () => m.report(CY, 'tree_photo', 'p3', 'spam'), 'report', 'approved', 'reported', CY.sub],
      ['p3', () => m.move(ADM, 'tree_photo', 'p3', 'hide'), 'hide', 'reported', 'hidden', ADM.sub],
      ['p4', () => post(m, ANA, 'p4'), 'submit', null, 'pending', ANA.sub],
      ['p4', () => m.move(ADM, 'tree_photo', 'p4', 'approve'), 'approve', 'pending', 'approved', ADM.sub],
      ['p4', () => m.replace('tree_photo', 'p4'), 'replace', 'approved', 'hidden', 'system'],
      ['p5', () => post(m, ANA, 'p5'), 'submit', null, 'pending', ANA.sub],
      ['p5', () => m.move(ADM, 'tree_photo', 'p5', 'approve'), 'approve', 'pending', 'approved', ADM.sub],
      ['p5', () => m.report(BO, 'tree_photo', 'p5', 'other'), 'report', 'approved', 'reported', BO.sub],
      ['p5', () => m.takedown(ANA, 'tree_photo', 'p5'), 'takedown', 'reported', 'hidden', ANA.sub],
      ['p6', () => post(m, ANA, 'p6'), 'submit', null, 'pending', ANA.sub],
      ['p6', () => m.move(ADM, 'tree_photo', 'p6', 'approve'), 'approve', 'pending', 'approved', ADM.sub],
      ['p6', () => m.report(BO, 'tree_photo', 'p6', 'spam'), 'report', 'approved', 'reported', BO.sub],
      ['p6', () => m.replace('tree_photo', 'p6'), 'replace', 'reported', 'hidden', 'system'],
    ]
    const want = []
    for (const [ref, run, move, from, to, actor] of steps) {
      const r = await run()
      expect([r.move, r.to], `${ref} ${move}`).toEqual([move, to])
      want.push({ ref, move, from_state: from, to_state: to, actor })
      expect(await events()).toEqual(want)
      await rule()
    }
    // every row of the move table ran at least once from each of its from-states
    const seen = new Set(want.map(e => `${e.move}:${e.from_state ?? 'new'}`))
    for (const k of ['submit:new', 'submit:declined', 'submit:hidden', 'edit:approved', 'edit:reported', 'approve:pending', 'approve:declined',
      'decline:pending', 'report:approved', 'report:reported', 'keep:reported', 'hide:approved', 'hide:reported', 'restore:hidden',
      'replace:pending', 'replace:approved', 'replace:reported', 'takedown:pending', 'takedown:approved', 'takedown:reported']) {
      expect(seen.has(k), k).toBe(true)
    }
    // reports close with the admin's decision: kept by keep and approve, hidden by hide and replace
    const res = (await pg.query(`SELECT i.ref, r.reason, r.resolution FROM moderation_reports r JOIN moderation_items i ON i.id = r.item_id ORDER BY r.id`)).rows
    expect(res).toEqual([
      { ref: 'p1', reason: 'offensive', resolution: 'kept' }, { ref: 'p1', reason: 'spam', resolution: 'kept' },
      { ref: 'p3', reason: 'offensive', resolution: 'kept' }, { ref: 'p3', reason: 'spam', resolution: 'hidden' },
      { ref: 'p5', reason: 'other', resolution: null }, { ref: 'p6', reason: 'spam', resolution: 'hidden' },
    ])
    expect(calls.why.filter(w => w.endsWith('replaced'))).toEqual(['p2:replaced', 'p4:replaced', 'p6:replaced'])
    expect(calls.why).toContain('p1:declined')
  })

  it('refuses every move the table does not have (409), and leaves no trace', async () => {
    const m = make()
    await setQueue(true)
    await post(m, ANA, 'p1') // pending
    const before = [await items(), await events()]
    const tries = [
      m.move(ADM, 'tree_photo', 'p1', 'keep'), m.move(ADM, 'tree_photo', 'p1', 'hide'), m.move(ADM, 'tree_photo', 'p1', 'restore'),
      m.edit(ANA, 'tree_photo', 'p1'), m.submit(ANA, 'tree_photo', 'p1'), m.report(BO, 'tree_photo', 'p1', 'spam'),
    ]
    for (const t of tries) expect(await refusal(t)).toEqual(['refused', 409])
    await m.move(ADM, 'tree_photo', 'p1', 'decline')
    for (const t of [m.move(ADM, 'tree_photo', 'p1', 'decline'), m.takedown(ANA, 'tree_photo', 'p1'), m.replace('tree_photo', 'p1'), m.report(BO, 'tree_photo', 'p1', 'spam')]) {
      expect(await refusal(t)).toEqual(['refused', 409])
    }
    await m.submit(ANA, 'tree_photo', 'p1')
    await m.replace('tree_photo', 'p1')
    for (const t of [m.submit(ANA, 'tree_photo', 'p1'), m.move(ADM, 'tree_photo', 'p1', 'restore'), m.move(ADM, 'tree_photo', 'p1', 'approve'), m.takedown(ANA, 'tree_photo', 'p1')]) {
      expect(await refusal(t)).toEqual(['refused', 409])
    }
    expect(before[1].length).toBe(1)
    expect((await events()).length).toBe(4)
    await rule()
  })

  it('answers who may not with 401, 403, 404 and 400', async () => {
    const m = make()
    await setQueue(false)
    await post(m, ANA, 'p1')
    expect(await refusal(m.report(null, 'tree_photo', 'p1', 'spam'))).toEqual(['sign_in', 401])
    expect(await refusal(m.report({ sub: '' }, 'tree_photo', 'p1', 'spam'))).toEqual(['sign_in', 401])
    expect(await refusal(m.report(ANA, 'tree_photo', 'p1', 'spam'))).toEqual(['own_item', 403])
    expect(await refusal(m.move(BO, 'tree_photo', 'p1', 'hide'))).toEqual(['admins_only', 403])
    expect(await refusal(m.move({ ...BO, admin: 'yes' }, 'tree_photo', 'p1', 'hide'))).toEqual(['admins_only', 403])
    expect(await refusal(m.queue(BO, 'waiting'))).toEqual(['admins_only', 403])
    expect(await refusal(m.saveSettings(BO, { queue: false }))).toEqual(['admins_only', 403])
    expect(await refusal(m.edit(BO, 'tree_photo', 'p1'))).toEqual(['not_yours', 403])
    expect(await refusal(m.takedown(BO, 'tree_photo', 'p1'))).toEqual(['not_yours', 403])
    expect(await refusal(m.submit(BO, 'tree_photo', 'p1'))).toEqual(['not_yours', 403])
    expect(await refusal(m.takedown(ADM, 'tree_photo', 'p1'))).toEqual(['not_yours', 403])
    expect(await refusal(m.move(ADM, 'tree_photo', 'nope', 'hide'))).toEqual(['not_found', 404])
    expect(await refusal(m.report(BO, 'tree_photo', 'nope', 'spam'))).toEqual(['not_found', 404])
    expect(await refusal(m.edit(ANA, 'tree_photo', 'nope'))).toEqual(['not_found', 404])
    expect(await refusal(m.report(BO, 'tree_photo', 'p1', 'private'))).toEqual(['bad_reason', 400])
    expect(await refusal(m.report(BO, 'studio_card', 'p1', 'spam'))).toEqual(['bad_kind', 400])
    expect(await refusal(m.report(BO, 'toString', 'p1', 'spam'))).toEqual(['bad_kind', 400])
    expect(await refusal(m.report(BO, 'tree_photo', 'x'.repeat(65), 'spam'))).toEqual(['bad_ref', 400])
    expect(await refusal(m.move(ADM, 'tree_photo', 'p1', 'replace'))).toEqual(['bad_move', 400])
    expect(await refusal(m.queue(ADM, 'everything'))).toEqual(['bad_tab', 400])
    expect(await refusal(m.queue(ADM, 'waiting', { before: 'not-a-cursor' }))).toEqual(['bad_page', 400])
    expect(await refusal(m.saveSettings(ADM, { queue: 'off' }))).toEqual(['bad_settings', 400])
    expect(await refusal(m.saveSettings(ADM, { colour: true }))).toEqual(['bad_settings', 400])
    expect((await m.submit(ANA, 'tree_photo', 'p1').catch(e => e)).status).toBe(409)
    expect((await events()).length).toBe(1)
  })
})

describe('reports', () => {
  it('limits a player to 30 a day (429), counting the last 24 hours only', async () => {
    const m = make()
    await setQueue(false)
    for (let i = 1; i <= 32; i++) await post(m, ANA, `p${i}`)
    for (let i = 1; i <= 30; i++) await m.report(BO, 'tree_photo', `p${i}`, 'spam')
    expect(await refusal(m.report(BO, 'tree_photo', 'p31', 'spam'))).toEqual(['limit', 429])
    expect((await m.report(CY, 'tree_photo', 'p31', 'spam')).to).toBe('reported')
    await pg.query(`UPDATE moderation_reports SET created_at = now() - interval '25 hours' WHERE reporter_sub = $1 AND item_id = (SELECT id FROM moderation_items WHERE ref = 'p1')`, [BO.sub])
    expect((await m.report(BO, 'tree_photo', 'p31', 'spam')).to).toBe('reported')
    expect(await refusal(m.report(BO, 'tree_photo', 'p32', 'spam'))).toEqual(['limit', 429])
    await rule()
  })

  it('takes one report per player per item: a second is a no-op that writes nothing and spends nothing', async () => {
    const m = make()
    await setQueue(false)
    await post(m, ANA, 'p1')
    await m.report(BO, 'tree_photo', 'p1', 'spam')
    const n = (await events()).length
    const again = await m.report(BO, 'tree_photo', 'p1', 'offensive')
    expect([again.already, again.to, again.item.reportsOpen]).toEqual([true, 'reported', 1])
    expect((await events()).length).toBe(n)
    expect(await m.reportedBy(BO.sub, 'tree_photo', ['p1', 'p2'])).toEqual(['p1'])
    expect(await m.reportedBy(CY.sub, 'tree_photo', ['p1'])).toEqual([])
    await m.move(ADM, 'tree_photo', 'p1', 'keep')
    expect((await m.report(BO, 'tree_photo', 'p1', 'spam')).already).toBe(true)
  })

  it('never hides by itself, and alerts once, on the first open report', async () => {
    const m = make()
    await setQueue(false)
    await post(m, ANA, 'p1')
    calls.alerts = []
    for (const p of [BO, CY, { sub: 'sub-d' }, { sub: 'sub-e' }]) await m.report(p, 'tree_photo', 'p1', 'offensive')
    expect((await items())[0]).toMatchObject({ state: 'reported', reports_open: 4 })
    expect(await pub()).toEqual(['p1'])
    expect(calls.alerts.map(a => [a.event, a.title, a.body, a.tab])).toEqual([['reported', 'Reported', 'Photo\nphoto p1\n312 W 88 St\nOffensive', 'reported']])
    await m.move(ADM, 'tree_photo', 'p1', 'keep')
    await m.report({ sub: 'sub-f' }, 'tree_photo', 'p1', 'not_this_tree')
    expect(calls.alerts.map(a => a.body.split('\n').pop())).toEqual(['Offensive', 'Not this tree'])
  })
})

describe('the approval switch', () => {
  it('governs new submissions only: turning it off leaves waiting items waiting, on leaves shown items shown', async () => {
    const m = make()
    expect(await m.settings()).toEqual({ queue: true, alerts: true, topic: true, waiting: 0 })
    await post(m, ANA, 'p1')
    expect(await m.saveSettings(ADM, { queue: false })).toEqual({ queue: false, alerts: true, topic: true, waiting: 1 })
    await post(m, ANA, 'p2')
    expect((await items()).map(i => i.state)).toEqual(['pending', 'approved'])
    expect(await m.saveSettings(ADM, { queue: true, alerts: false })).toMatchObject({ queue: true, alerts: false })
    await post(m, ANA, 'p3')
    expect((await items()).map(i => i.state)).toEqual(['pending', 'approved', 'pending'])
    expect(calls.alerts.map(a => a.ref)).toEqual(['p1', 'p2'])
    expect((await pg.query('SELECT updated_by FROM moderation_settings')).rows).toEqual([{ updated_by: ADM.sub }])
    await rule()
  })

  it('reads the instance\'s defaults when it has no row yet, and says whether an alert can reach anyone', async () => {
    expect(await make({ defaults: { queue: false } }).settings()).toMatchObject({ queue: false, alerts: true, topic: true })
    expect((await make({ alert: undefined }).settings()).topic).toBe(false)
    expect((await make({ alert: Object.assign(async () => {}, { ready: false }) }).settings()).topic).toBe(false)
    await make({ defaults: { queue: false } }).saveSettings(ADM, { alerts: false })
    expect(await make().settings()).toMatchObject({ queue: false, alerts: false })
  })
})

describe('the queue', () => {
  it('fills its four tabs, with counts, previews, open reasons and the moves each row allows', async () => {
    const m = make()
    await setQueue(true)
    for (const r of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) await post(m, ANA, r)
    await post(m, BO, 'n1', 'tree_note', 'Hollow at the base.')
    for (const r of ['p3', 'p4', 'p5', 'p6']) await m.move(ADM, 'tree_photo', r, 'approve')
    await m.report(BO, 'tree_photo', 'p4', 'offensive')
    await m.report(CY, 'tree_photo', 'p4', 'offensive')
    await m.report(CY, 'tree_photo', 'p3', 'not_this_tree')
    await m.move(ADM, 'tree_photo', 'p5', 'hide')
    await m.takedown(ANA, 'tree_photo', 'p6')
    const waiting = await m.queue(ADM, 'waiting')
    expect(waiting.counts).toEqual({ waiting: 3, reported: 2, hidden: 1 })
    expect(waiting.rows.map(r => [r.kind, r.ref, r.kindLabel, r.moves])).toEqual([
      ['tree_photo', 'p1', 'Photo', ['approve', 'decline']], ['tree_photo', 'p2', 'Photo', ['approve', 'decline']], ['tree_note', 'n1', 'Note', ['approve', 'decline']],
    ])
    expect(waiting.rows[2].preview).toEqual({ title: 'Hollow at the base.', where: '312 W 88 St', by: 'Bo' })
    expect(waiting.next).toBe(null)
    const reported = await m.queue(ADM, 'reported')
    expect(reported.rows.map(r => [r.ref, r.reasons, r.moves, r.reportsOpen])).toEqual([
      ['p4', { offensive: 2 }, ['keep', 'hide'], 2], ['p3', { not_this_tree: 1 }, ['keep', 'hide'], 1],
    ])
    expect((await m.queue(ADM, 'hidden')).rows.map(r => [r.ref, r.hiddenBy, r.moves])).toEqual([['p5', 'admin', ['restore']]])
    expect((await m.queue(ADM, 'latest')).rows.map(r => [r.ref, r.state])).toEqual([['p4', 'reported'], ['p3', 'reported']])
  })

  it('pages each tab without a row twice or a row missed, ties broken by id', async () => {
    const m = make()
    await setQueue(true)
    for (let i = 1; i <= 7; i++) await post(m, ANA, `p${i}`)
    await pg.query(`UPDATE moderation_items SET submitted_at = '2026-11-01 12:00:00+00' WHERE ref IN ('p2', 'p3', 'p4')`)
    const walk = async (tab) => {
      const seen = []
      let before = null
      for (let n = 0; n < 10; n++) {
        const page = await m.queue(ADM, tab, { before, limit: 2 })
        seen.push(...page.rows.map(r => r.ref))
        if (!page.next) break
        before = page.next
      }
      return seen
    }
    expect(await walk('waiting')).toEqual(['p2', 'p3', 'p4', 'p1', 'p5', 'p6', 'p7'])
    for (let i = 1; i <= 7; i++) await m.move(ADM, 'tree_photo', `p${i}`, 'approve')
    expect(await walk('latest')).toEqual(['p7', 'p6', 'p5', 'p1', 'p4', 'p3', 'p2'])
    expect((await m.queue(ADM, 'latest', { limit: 1000 })).rows.length).toBe(7)
  })
})

describe('mine', () => {
  it('lists the owner\'s own pending, declined and hidden items, never a replaced one or anyone else\'s', async () => {
    const m = make()
    await setQueue(true)
    for (const r of ['p1', 'p2', 'p3', 'p4', 'p5']) await post(m, ANA, r)
    await post(m, BO, 'p6')
    await m.move(ADM, 'tree_photo', 'p2', 'decline')
    await m.move(ADM, 'tree_photo', 'p3', 'approve')
    await m.move(ADM, 'tree_photo', 'p3', 'hide')
    await m.replace('tree_photo', 'p4')
    await m.move(ADM, 'tree_photo', 'p5', 'approve')
    const mine = await m.mine(ANA.sub, 'tree_photo')
    expect(mine.map(i => [i.ref, i.state, i.label]).sort()).toEqual([['p1', 'pending', 'Pending'], ['p2', 'declined', 'Declined'], ['p3', 'hidden', 'Hidden']])
    expect((await m.mine(ANA.sub, 'tree_photo', ['p2', 'p5', 'p6'])).map(i => i.ref)).toEqual(['p2'])
    expect(await m.mine(ANA.sub, 'tree_photo', [])).toEqual([])
    expect(await m.mine('', 'tree_photo')).toEqual([])
    expect(mine[0]).toEqual(expect.objectContaining({ id: expect.any(String), owner: ANA.sub, instance: 'treehopper', submittedAt: expect.stringMatching(/Z$/) }))
  })
})

describe('alerts and after() never fail a move', () => {
  it('commits the move when the alert, the preview or after() throws', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const kind = fakeKind('Photo', {
      after() { throw new Error('after broke') },
      async preview() { throw new Error('preview broke') },
    })
    const m = make({ kinds: { tree_photo: kind }, alert: async () => { throw new Error('alert broke') } })
    await setQueue(true)
    const r = await post(m, ANA, 'p1')
    expect(r.to).toBe('pending')
    expect((await items())[0].state).toBe('pending')
    expect(log.mock.calls.map(c => c.slice(1).join(' '))).toEqual(['after failed: after broke', 'preview for alert failed: preview broke', 'alert failed: alert broke'])
    log.mockRestore()
  })
})

describe('the rule, on a random walk', () => {
  it('keeps content public exactly when its item is approved or reported, across 600 moves by anyone', async () => {
    const m = make({ reportsPerDay: 1000 })
    let seed = 20261103 // mulberry32
    const rnd = (n) => {
      seed = (seed + 0x6D2B79F5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return (((t ^ (t >>> 14)) >>> 0) % n)
    }
    const people = [ANA, BO, CY, ADM, { sub: 'sub-d', name: 'D', admin: false }, null]
    const anyone = () => people[rnd(people.length)]
    const refs = ['p1', 'p2', 'p3', 'p4']
    const owners = {}
    let ok = 0
    const landed = {}
    const refused = {}
    for (let i = 0; i < 600; i++) {
      if (i % 30 === 0) refs.push(`q${i}`) // new content keeps arriving; a replaced item never comes back
      const ref = refs[rnd(refs.length)]
      // mostly the person a move is for, sometimes anyone (a guest included)
      const owner = rnd(5) ? owners[ref] || anyone() : anyone()
      const admin = rnd(5) ? ADM : anyone()
      const kind = rnd(20)
      if (i % 40 === 0) await setQueue(rnd(2) === 1)
      let p
      if (kind < 4) {
        if (!owners[ref] && owner) {
          owners[ref] = owner
          p = post(m, owner, ref)
        } else p = m.submit(owner, 'tree_photo', ref)
      } else if (kind < 6) p = m.edit(owner, 'tree_photo', ref)
      else if (kind < 7) p = m.takedown(owner, 'tree_photo', ref)
      else if (kind < 11) p = m.report(anyone(), 'tree_photo', ref, ['offensive', 'spam'][rnd(2)])
      else if (kind < 12) p = m.replace('tree_photo', ref)
      else p = m.move(admin, 'tree_photo', ref, ['approve', 'decline', 'keep', 'hide', 'restore'][rnd(5)])
      try {
        const r = await p
        if (!r.already) {
          ok++
          landed[`${r.move}:${r.from}`] = (landed[`${r.move}:${r.from}`] || 0) + 1
        }
      } catch (e) {
        if (!(e instanceof ModError)) throw e
        refused[e.status] = (refused[e.status] || 0) + 1
      }
      await rule()
    }
    expect((await events()).length).toBe(ok)
    // every row of the table landed from every one of its from-states, and every kind of refusal came up
    const rows = Object.entries(MOVES).flatMap(([mv, r]) => r.from.map(f => `${mv}:${f}`))
    expect(rows.filter(k => !landed[k])).toEqual([])
    expect(Object.keys(refused).sort()).toEqual(['401', '403', '404', '409'])
  }, 120000)
})

describe('K7 review fixes: two moves at once', () => {
  it('a report takes the reporter\'s lock before it counts the day, so two at once cannot both pass the limit', async () => {
    const seen = []
    const tap = c => ({ query: (text, params) => { seen.push(text); return c.query(text, params) } })
    const m = make({ transaction: fn => pg.transaction(tx => fn(tap(tx))) })
    await setQueue(false)
    await post(m, ANA, 'p1')
    seen.length = 0
    expect((await m.report(BO, 'tree_photo', 'p1', 'spam')).to).toBe('reported')
    const lock = seen.findIndex(t => /pg_advisory_xact_lock\(hashtext\('tt-mod-report'\), hashtext\(\$1\)\)/.test(t))
    const count = seen.findIndex(t => /count\(\*\)::int AS n FROM moderation_reports WHERE reporter_sub/.test(t))
    expect(lock).toBeGreaterThan(-1)
    expect(count).toBeGreaterThan(lock)
    await rule()
  })

  it('two first submits of one item at once: the one that finds the row taken is refused (409), not a raw error', async () => {
    const m = make()
    await setQueue(true)
    await post(m, ANA, 'p1')
    // the second submit read no row before the first committed: its load sees nothing, its insert meets the first's row
    const blind = tx => ({ query: (text, params) => (/^SELECT \* FROM moderation_items WHERE/.test(text) ? { rows: [] } : tx.query(text, params)) })
    let refused
    await pg.transaction(async (tx) => { refused = await refusal(m.submit(ANA, 'tree_photo', 'p1', blind(tx))) }).catch(() => {})
    expect(refused).toEqual(['conflict', 409])
    expect((await items()).length).toBe(1)
    await rule()
  })
})
