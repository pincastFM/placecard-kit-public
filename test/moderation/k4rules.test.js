// 1.5.0 (unreleased): three moderation rules, on the pure table and on an instance over PGlite running the shipped
// sql/moderation.sql.
// - Rule 1: while a Live card's change waits, its approved version stays public (the kind's publicWhilePending), so a
//   player can report it and an admin can hide it; the report leaves the change waiting; a restore of an item hidden
//   while its change waited puts the change back in the queue, never in view unseen.
// - Rule 3: submit and edit take { review: true } (a pin moved more than 150 m): it waits whatever the switch says.
// - Approve takes the version seen: each queue row carries the revision it shows; approve, keep and restore with that
//   `seen` answer 409 'moved' when the item changed since (content changed in place, or sent again), for every kind.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import {
  MOVES, MOD_SEEN_MOVES, ModError, adminMoves, canMove, createModeration, modRevision, nextState, shownToAll,
} from '../../moderation/index.js'

const DDL = readFileSync(resolve(__dirname, '../../sql/moderation.sql'), 'utf8')
const ANA = { sub: 'sub-ana', name: 'Ana', admin: false }
const BO = { sub: 'sub-bo', name: 'Bo', admin: false }
const ADM = { sub: 'sub-adm', name: 'Admin', admin: true }

const refusal = async (p) => {
  try { await p } catch (e) { expect(e).toBeInstanceOf(ModError); return [e.code, e.status] }
  throw new Error('not refused')
}

describe('the table, 1.5.0', () => {
  const PLACES = ['new', 'pending', 'approved', 'declined', 'reported', 'hidden:admin', 'hidden:owner', 'hidden:replaced']
  const at = (p, extra = {}) => {
    const [state, hiddenBy] = p.split(':')
    return p === 'new' ? null : { state, hiddenBy: hiddenBy || null, ...extra }
  }

  it('a public version standing opens report and hide from pending, and nothing else anywhere', () => {
    for (const move of Object.keys(MOVES)) {
      for (const p of PLACES) {
        const plain = canMove(at(p), move)
        const pub = canMove(at(p, { public: true }), move)
        expect(pub, `${move} from ${p}`).toBe(plain || (p === 'pending' && (move === 'report' || move === 'hide')))
      }
    }
    expect(MOVES.report.public).toEqual(['pending'])
    expect(MOVES.hide.public).toEqual(['pending'])
    expect(adminMoves({ state: 'pending', public: true })).toEqual(['approve', 'decline', 'hide'])
    expect(adminMoves({ state: 'pending' })).toEqual(['approve', 'decline'])
    expect(canMove({ state: 'pending', public: 'yes' }, 'report')).toBe(false)
  })

  it('a report on a waiting change keeps it waiting; a hide takes it down; without a public version, 409', () => {
    expect(nextState('pending', 'report', { public: true })).toBe('pending')
    expect(nextState('pending', 'hide', { public: true })).toBe('hidden')
    expect(nextState('approved', 'report', { public: true })).toBe('reported')
    for (const mv of ['report', 'hide']) {
      try { nextState('pending', mv); expect.unreachable() } catch (e) { expect([e.code, e.status]).toEqual(['refused', 409]) }
    }
  })

  it('a forced review waits whatever the switch says, but an admin\'s own shows', () => {
    for (const from of ['new', 'declined']) {
      expect(nextState(from, 'submit', { queue: false, review: true })).toBe('pending')
      expect(nextState(from, 'submit', { queue: false, review: true, ownerIsAdmin: true })).toBe('approved')
      expect(nextState(from, 'submit', { queue: false, review: false })).toBe('approved')
    }
    for (const from of ['approved', 'reported']) {
      expect(nextState(from, 'edit', { queue: false, review: true })).toBe('pending')
      expect(nextState(from, 'edit', { queue: false, review: true, ownerIsAdmin: true })).toBe(from)
      expect(nextState(from, 'edit', { queue: false, review: 1 })).toBe(from)
    }
  })

  it('restore puts back where the hide took it from: a waiting change waits again, anything else shows', () => {
    expect(nextState('hidden', 'restore', { hiddenBy: 'admin', hiddenFrom: 'pending' })).toBe('pending')
    for (const f of ['approved', 'reported', null, undefined]) expect(nextState('hidden', 'restore', { hiddenBy: 'admin', hiddenFrom: f })).toBe('approved')
  })

  it('the revision: one digest of when it was sent and what the admin is shown', async () => {
    expect(MOD_SEEN_MOVES).toEqual(['approve', 'keep', 'restore'])
    const a = await modRevision('2026-11-20 07:00:00.123456+00', { title: 'A' })
    expect(a).toMatch(/^r1:[0-9a-f]{32}$/)
    expect(await modRevision('2026-11-20 07:00:00.123456+00', { title: 'A' })).toBe(a)
    expect(await modRevision('2026-11-20 07:00:00.123457+00', { title: 'A' })).not.toBe(a)
    expect(await modRevision('2026-11-20 07:00:00.123456+00', { title: 'B' })).not.toBe(a)
    expect(await modRevision('2026-11-20 07:00:00.123456+00', null)).toBe(await modRevision('2026-11-20 07:00:00.123456+00', undefined))
    vi.stubGlobal('crypto', undefined)
    try {
      expect(await modRevision('t', { title: 'A' })).toBe('j:["t",{"title":"A"}]')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

// ---- an instance ------------------------------------------------------------------------------------

let pg
const calls = { why: [], alerts: [] }

// A kind over fake_content. `stand`: like the Studio's marked sets, its unshow for a waiting change leaves the approved
// version up, and publicWhilePending names those refs. `rev`: a revision hook over the body alone.
function fakeKind(label, { stand = false, rev = false } = {}) {
  const k = {
    label,
    reasons: ['offensive', 'spam', 'other'],
    async show(c, ref) { await c.query('UPDATE fake_content SET hidden = false WHERE ref = $1', [ref]) },
    async unshow(c, ref, why) {
      calls.why.push(`${ref}:${why}`)
      if (stand && why === 'pending') return
      await c.query('UPDATE fake_content SET hidden = true WHERE ref = $1', [ref])
    },
    async preview(c, refs) {
      const rows = (await c.query('SELECT ref, owner, body FROM fake_content WHERE ref = ANY($1::text[])', [refs])).rows
      return Object.fromEntries(rows.map(r => [r.ref, { title: r.body, by: r.owner }]))
    },
  }
  if (stand) {
    k.publicWhilePending = async (c, refs) => (await c.query(
      'SELECT ref FROM fake_content WHERE ref = ANY($1::text[]) AND NOT hidden', [refs])).rows.map(r => r.ref)
  }
  if (rev) {
    k.revision = async (c, refs) => Object.fromEntries((await c.query(
      'SELECT ref, body FROM fake_content WHERE ref = ANY($1::text[])', [refs])).rows.map(r => [r.ref, r.body]))
  }
  return k
}

function make(kinds) {
  const alert = Object.assign(async (a) => { calls.alerts.push(a) }, { ready: true })
  return createModeration({ instance: 'studio', db: pg, transaction: fn => pg.transaction(fn), kinds, alert })
}

async function post(m, actor, ref, kind, body = `card ${ref}`) {
  let res
  await pg.transaction(async (tx) => {
    await tx.query('INSERT INTO fake_content (ref, owner, body) VALUES ($1, $2, $3)', [ref, actor.name, body])
    res = await m.submit(actor, kind, ref, tx)
  })
  await res.after()
  return res
}

const item = async ref => (await pg.query('SELECT * FROM moderation_items WHERE ref = $1', [ref])).rows[0]
const isPublic = async ref => !(await pg.query('SELECT hidden FROM fake_content WHERE ref = $1', [ref])).rows[0].hidden
const events = async ref => (await pg.query(
  'SELECT e.move, e.from_state, e.to_state FROM moderation_events e JOIN moderation_items i ON i.id = e.item_id WHERE i.ref = $1 ORDER BY e.id',
  [ref])).rows.map(e => `${e.move}:${e.from_state}>${e.to_state}`)
const setQueue = on => pg.query(
  `INSERT INTO moderation_settings (instance, queue) VALUES ('studio', $1) ON CONFLICT (instance) DO UPDATE SET queue = $1`, [on])
const rowOf = async (m, tab, ref) => (await m.queue(ADM, tab)).rows.find(r => r.ref === ref)
const openReports = async ref => (await pg.query(
  'SELECT count(*)::int AS n FROM moderation_reports r JOIN moderation_items i ON i.id = r.item_id WHERE i.ref = $1 AND r.resolved_at IS NULL',
  [ref])).rows[0].n

beforeAll(async () => {
  pg = new PGlite()
  await pg.waitReady
}, 60000)
afterAll(async () => { await pg?.close() })
beforeEach(async () => {
  await pg.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await pg.exec(DDL)
  await pg.exec('CREATE TABLE fake_content (ref text PRIMARY KEY, owner text, body text, hidden boolean NOT NULL DEFAULT true)')
  calls.why.length = 0
  calls.alerts.length = 0
})

describe('rule 3: a forced review', () => {
  it('an edit with review waits with the switch off, unshown as a waiting change, and alerts as new', async () => {
    const m = make({ card: fakeKind('Card') })
    await setQueue(false)
    await post(m, ANA, 'c1', 'card')
    expect((await item('c1')).state).toBe('approved')
    calls.alerts.length = 0
    const res = await m.edit(ANA, 'card', 'c1', undefined, { review: true })
    expect([res.from, res.to]).toEqual(['approved', 'pending'])
    expect(await item('c1')).toMatchObject({ state: 'pending', decided_by: null })
    expect(calls.why).toEqual(['c1:pending'])
    expect(await isPublic('c1')).toBe(false)
    expect(calls.alerts.map(a => [a.event, a.tab])).toEqual([['new', 'waiting']])
    // without it, the switch decides as before
    await m.move(ADM, 'card', 'c1', 'approve')
    expect((await m.edit(ANA, 'card', 'c1')).to).toBe('approved')
  })

  it('an admin\'s own far move shows; a submit with review waits too (a first edit of an item-less card)', async () => {
    const m = make({ card: fakeKind('Card') })
    await setQueue(false)
    await post(m, ADM, 'c1', 'card')
    expect((await m.edit(ADM, 'card', 'c1', undefined, { review: true })).to).toBe('approved')
    let res
    await pg.transaction(async (tx) => {
      await tx.query("INSERT INTO fake_content (ref, owner, body) VALUES ('c2', 'Ana', 'far')")
      res = await m.submit(ANA, 'card', 'c2', tx, { review: true })
    })
    expect(res.to).toBe('pending')
    expect(await isPublic('c2')).toBe(false)
  })
})

describe('rule 1: a change that waits while its approved version stays public', () => {
  async function waiting(m) {
    await setQueue(false)
    await post(m, ANA, 'c1', 'card')
    await setQueue(true)
    await pg.query("UPDATE fake_content SET body = 'v2' WHERE ref = 'c1'")
    expect((await m.edit(ANA, 'card', 'c1')).to).toBe('pending')
    expect(await isPublic('c1')).toBe(true)
  }

  it('a player reports it: the change waits on, the report is open and alerts to Waiting; not the owner, once', async () => {
    const m = make({ card: fakeKind('Card', { stand: true }) })
    await waiting(m)
    calls.alerts.length = 0
    expect(await refusal(m.report(ANA, 'card', 'c1', 'spam'))).toEqual(['own_item', 403])
    const res = await m.report(BO, 'card', 'c1', 'offensive')
    expect([res.from, res.to]).toEqual(['pending', 'pending'])
    expect(await item('c1')).toMatchObject({ state: 'pending', reports_open: 1 })
    expect((await m.report(BO, 'card', 'c1', 'spam')).already).toBe(true)
    expect(await openReports('c1')).toBe(1)
    expect(calls.alerts.map(a => [a.event, a.tab, a.state])).toEqual([['reported', 'waiting', 'pending']])
    expect((await m.reportedBy(BO.sub, 'card', ['c1']))).toEqual(['c1'])
    // the Waiting row: public, Hide offered, the reasons shown; not in Reported
    const row = await rowOf(m, 'waiting', 'c1')
    expect(row).toMatchObject({ state: 'pending', public: true, moves: ['approve', 'decline', 'hide'], reasons: { offensive: 1 } })
    const rep = await m.queue(ADM, 'reported')
    expect([rep.rows.length, rep.counts]).toEqual([0, { waiting: 1, reported: 0, hidden: 0 }])
    expect(await events('c1')).toEqual(['submit:null>approved', 'edit:approved>pending', 'report:pending>pending'])
  })

  it('approve shows the change and closes the reports as kept, as an edited reported item\'s always did', async () => {
    const m = make({ card: fakeKind('Card', { stand: true }) })
    await waiting(m)
    await m.report(BO, 'card', 'c1', 'offensive')
    expect((await m.move(ADM, 'card', 'c1', 'approve')).to).toBe('approved')
    expect(await item('c1')).toMatchObject({ state: 'approved', reports_open: 0 })
    expect((await pg.query('SELECT resolution FROM moderation_reports')).rows.map(r => r.resolution)).toEqual(['kept'])
    expect(await isPublic('c1')).toBe(true)
  })

  it('hide takes the public version down; restore puts the change back in the queue, never in view unseen', async () => {
    const m = make({ card: fakeKind('Card', { stand: true }) })
    await waiting(m)
    await m.report(BO, 'card', 'c1', 'offensive')
    expect((await m.move(ADM, 'card', 'c1', 'hide')).to).toBe('hidden')
    expect(await item('c1')).toMatchObject({ state: 'hidden', hidden_by: 'admin', reports_open: 0 })
    expect(await isPublic('c1')).toBe(false)
    expect((await m.queue(ADM, 'hidden')).rows.map(r => [r.ref, r.moves])).toEqual([['c1', ['restore']]])
    const res = await m.move(ADM, 'card', 'c1', 'restore')
    expect([res.from, res.to]).toEqual(['hidden', 'pending'])
    expect(await item('c1')).toMatchObject({ state: 'pending', hidden_by: null, decided_by: null, decided_at: null })
    expect(calls.why.at(-1)).toBe('c1:pending')
    expect(await isPublic('c1')).toBe(false)
    // nothing public now, so no report and no hide; approve shows the change the admin sees in Waiting
    expect(await refusal(m.report(BO, 'card', 'c1', 'spam'))).toEqual(['refused', 409])
    expect(await refusal(m.move(ADM, 'card', 'c1', 'hide'))).toEqual(['refused', 409])
    expect((await rowOf(m, 'waiting', 'c1')).moves).toEqual(['approve', 'decline'])
    expect((await m.move(ADM, 'card', 'c1', 'approve')).to).toBe('approved')
    expect(await isPublic('c1')).toBe(true)
  })

  it('a hide of a shown item restores to shown, as before', async () => {
    const m = make({ card: fakeKind('Card', { stand: true }) })
    await setQueue(false)
    await post(m, ANA, 'c1', 'card')
    await m.move(ADM, 'card', 'c1', 'hide')
    expect((await m.move(ADM, 'card', 'c1', 'restore')).to).toBe('approved')
  })

  it('without the hook, or with nothing public, a waiting change still refuses report and hide (409)', async () => {
    for (const k of [fakeKind('Card'), fakeKind('Card', { stand: true })]) {
      await pg.exec('DELETE FROM moderation_items; DELETE FROM fake_content;')
      const m = make({ card: k })
      await setQueue(true)
      await post(m, ANA, 'c1', 'card') // new, never shown: nothing public
      expect(await refusal(m.report(BO, 'card', 'c1', 'spam'))).toEqual(['refused', 409])
      expect(await refusal(m.move(ADM, 'card', 'c1', 'hide'))).toEqual(['refused', 409])
      expect((await rowOf(m, 'waiting', 'c1')).public).toBeUndefined()
      expect(await item('c1')).toMatchObject({ state: 'pending', reports_open: 0 })
    }
  })

  it('a hook that is not a function is refused at createModeration', () => {
    for (const fn of ['publicWhilePending', 'revision']) {
      expect(() => make({ card: { ...fakeKind('Card'), [fn]: true } })).toThrow(TypeError)
    }
  })
})

describe('PL-056: approve takes only the version the admin saw', () => {
  // two kinds, as the Studio's cards and set labels: one with the preview as its revision, one with its own hook
  const kinds = () => ({ studio_card: fakeKind('Card'), studio_set: fakeKind('Set', { rev: true }) })

  for (const kind of ['studio_card', 'studio_set']) {
    it(`${kind}: the owner changes it while it waits; approve with the revision seen is 409 and changes nothing`, async () => {
      const m = make(kinds())
      await setQueue(true)
      await post(m, ANA, 'x1', kind, 'what the admin saw')
      const seen = (await rowOf(m, 'waiting', 'x1')).revision
      expect(seen).toMatch(/^r1:[0-9a-f]{32}$/)
      expect((await rowOf(m, 'latest', 'x1'))).toBeUndefined()
      // the host's own edit of a waiting item, no move (the old Studio's studioUpdateCard, a set's labels)
      await pg.query("UPDATE fake_content SET body = 'swapped after' WHERE ref = 'x1'")
      const before = await events('x1')
      expect(await refusal(m.move(ADM, kind, 'x1', 'approve', { seen }))).toEqual(['moved', 409])
      expect(await item('x1')).toMatchObject({ state: 'pending' })
      expect(await events('x1')).toEqual(before)
      expect(await isPublic('x1')).toBe(false)
      // the reloaded row shows the new version and its revision approves it
      const now = (await rowOf(m, 'waiting', 'x1'))
      expect(now.preview.title).toBe('swapped after')
      expect(now.revision).not.toBe(seen)
      expect((await m.move(ADM, kind, 'x1', 'approve', { seen: now.revision })).to).toBe('approved')
    })
  }

  it('a version sent again (decline, then submit) is a new revision even with the same words', async () => {
    const m = make(kinds())
    await setQueue(true)
    await post(m, ANA, 'x1', 'studio_card')
    const seen = (await rowOf(m, 'waiting', 'x1')).revision
    await m.move(ADM, 'studio_card', 'x1', 'decline')
    await m.submit(ANA, 'studio_card', 'x1')
    expect(await refusal(m.move(ADM, 'studio_card', 'x1', 'approve', { seen }))).toEqual(['moved', 409])
  })

  it('nothing changed: approve, keep and restore with the row\'s revision go through, in every tab', async () => {
    const m = make(kinds())
    await setQueue(true)
    await post(m, ANA, 'x1', 'studio_card')
    expect((await m.move(ADM, 'studio_card', 'x1', 'approve', { seen: (await rowOf(m, 'waiting', 'x1')).revision })).to).toBe('approved')
    await m.report(BO, 'studio_card', 'x1', 'spam')
    expect((await m.move(ADM, 'studio_card', 'x1', 'keep', { seen: (await rowOf(m, 'reported', 'x1')).revision })).to).toBe('approved')
    await m.move(ADM, 'studio_card', 'x1', 'hide')
    expect((await m.move(ADM, 'studio_card', 'x1', 'restore', { seen: (await rowOf(m, 'hidden', 'x1')).revision })).to).toBe('approved')
  })

  it('keep and restore check it too; decline and hide take it out of view whatever the revision', async () => {
    const m = make(kinds())
    await setQueue(false)
    await post(m, ANA, 'x1', 'studio_card')
    await m.report(BO, 'studio_card', 'x1', 'spam')
    const seen = (await rowOf(m, 'reported', 'x1')).revision
    await pg.query("UPDATE fake_content SET body = 'changed' WHERE ref = 'x1'")
    expect(await refusal(m.move(ADM, 'studio_card', 'x1', 'keep', { seen }))).toEqual(['moved', 409])
    expect((await m.move(ADM, 'studio_card', 'x1', 'hide', { seen })).to).toBe('hidden')
    const hid = (await rowOf(m, 'hidden', 'x1')).revision
    await pg.query("UPDATE fake_content SET body = 'changed again' WHERE ref = 'x1'")
    expect(await refusal(m.move(ADM, 'studio_card', 'x1', 'restore', { seen: hid }))).toEqual(['moved', 409])
    await setQueue(true)
    await post(m, ANA, 'x2', 'studio_card')
    expect((await m.move(ADM, 'studio_card', 'x2', 'decline', { seen: 'r1:stale' })).to).toBe('declined')
  })

  it('a kind\'s own revision: what it leaves out may change, what it holds may not', async () => {
    const m = make(kinds())
    await setQueue(true)
    await post(m, ANA, 'x1', 'studio_set')
    const seen = (await rowOf(m, 'waiting', 'x1')).revision
    await pg.query("UPDATE fake_content SET owner = 'Renamed' WHERE ref = 'x1'") // in the preview, not the revision
    expect((await m.move(ADM, 'studio_set', 'x1', 'approve', { seen })).to).toBe('approved')
  })

  it('without seen, approve is as before 1.5.0; a bad seen is 400', async () => {
    const m = make(kinds())
    await setQueue(true)
    await post(m, ANA, 'x1', 'studio_card')
    for (const bad of ['', 7, {}, true]) expect(await refusal(m.move(ADM, 'studio_card', 'x1', 'approve', { seen: bad }))).toEqual(['bad_seen', 400])
    await pg.query("UPDATE fake_content SET body = 'changed' WHERE ref = 'x1'")
    expect((await m.move(ADM, 'studio_card', 'x1', 'approve')).to).toBe('approved')
    expect((await m.move(ADM, 'studio_card', 'x1', 'hide', { seen: null })).to).toBe('hidden')
  })

  it('the rule holds: content public exactly when shown to all, for kinds without a standing version', async () => {
    const m = make(kinds())
    await setQueue(true)
    await post(m, ANA, 'x1', 'studio_card')
    await post(m, ANA, 'x2', 'studio_set')
    await m.move(ADM, 'studio_card', 'x1', 'approve', { seen: (await rowOf(m, 'waiting', 'x1')).revision })
    for (const ref of ['x1', 'x2']) expect(await isPublic(ref)).toBe(shownToAll((await item(ref)).state))
  })
})
