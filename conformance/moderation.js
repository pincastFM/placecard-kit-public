/**
 * The moderation conformance suite (kit CONTRACT.md): what every moderation instance runs, in its own vitest
 * file, over its own wiring and its own public reads.
 *
 *   import { modConformance } from '@pincast/placecard-kit/conformance/moderation.js'
 *   modConformance({
 *     name: 'treehopper',
 *     moderation: ({ db, transaction }) => createModeration({ instance: 'treehopper', db, transaction, kinds }),
 *     setup: db => db.exec(CONTENT_SQL),
 *     kinds: {
 *       tree_photo: { insert: (tx, { owner, n }) => ..., shown: db => ..., all: db => ..., reason: 'offensive' },
 *       tree_note: { insert, shown, all },
 *     },
 *   })
 *
 * The instance:
 * - moderation({ db, transaction }): its createModeration over the suite's database, as its server builds it (its
 *   kinds, words, alert). The suite's actors are plain { sub, name, admin }: the admin check is the host's, outside.
 * - setup(db): its content tables, run after sql/moderation.sql on each fresh database.
 * - kinds: one entry for each kind the instance moderates, keyed as its moderation names them:
 *   - insert(tx, { owner, n }): one new content row as the host writes it before its submit (Treehopper: hidden_at
 *     set; the Studio: a draft card in a live set), inside the suite's transaction; returns its ref. `owner` is the
 *     suite's actor, `n` a number unique in the test.
 *   - shown(db): the refs the instance's public read returns for this kind (strings or numbers).
 *   - all(db), optional: every content ref of the kind, to prove each one has an item.
 *   - reason, optional: a report reason the kind takes (default 'other').
 *   - edit, takedown, optional: true when the kind's owners edit or take down (the Studio's cards).
 * - database(), optional: a fresh database, { query, exec, transaction, reset, close }. Default: PGlite in memory
 *   (`@electric-sql/pglite` in the instance's devDependencies).
 *
 * It checks, for each kind: the switch on and off; approve, decline, report, keep, hide and restore; the owner's
 * labels; resubmit after a decline and after the owner's own take-down, never after an admin's hide; edit and
 * take-down where the kind has them; every refused move (409, the item unchanged); one event per move. Once: the
 * DDL as shipped, twice; the report limit (30 a day, then 429); no report on your own item (403); a guest (401); a
 * player's admin move or settings (403). After every step it checks the public-read rule: a kind's
 * public read holds exactly its items in approved or reported.
 *
 * 1.5.0 (unreleased) adds, for each kind: the queue's revision is the same on a second read (a preview that is the
 * same whenever the content is), and an approve carrying a revision from before the owner sent it again is 409 'moved'
 * and changes nothing; for a kind with edit, an edit with { review: true } waits with the switch off. Report and hide
 * while a change waits need a kind that keeps an approved version public; the kit's own tests hold that
 * (test/moderation/k4rules.test.js).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ModError, REPORTS_PER_DAY, shownToAll } from '../moderation/index.js'

/** The DDL every instance applies (sql/moderation.sql), as text. */
export function modDDL() {
  return readFileSync(fileURLToPath(new URL('../sql/moderation.sql', import.meta.url)), 'utf8')
}

export const MOD_CONFORMANCE_ACTORS = Object.freeze({
  owner: Object.freeze({ sub: 'conformance-owner', name: 'Owner', admin: false }),
  other: Object.freeze({ sub: 'conformance-other', name: 'Other', admin: false }),
  admin: Object.freeze({ sub: 'conformance-admin', name: 'Admin', admin: true }),
})

const { owner: OWNER, other: OTHER, admin: ADMIN } = MOD_CONFORMANCE_ACTORS

async function pglite() {
  let PGlite
  try {
    ({ PGlite } = await import('@electric-sql/pglite'))
  } catch {
    throw new Error('modConformance: no database: add @electric-sql/pglite to devDependencies, or pass database()')
  }
  const pg = new PGlite()
  await pg.waitReady
  return {
    query: (text, params) => pg.query(text, params),
    exec: text => pg.exec(text),
    transaction: fn => pg.transaction(fn),
    reset: () => pg.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'),
    close: () => pg.close(),
  }
}

function instanceErrors(inst) {
  const e = []
  if (!inst || typeof inst !== 'object') return ['modConformance: an instance object']
  if (typeof inst.name !== 'string' || !inst.name) e.push('name')
  if (typeof inst.moderation !== 'function') e.push('moderation({ db, transaction })')
  if (inst.setup != null && typeof inst.setup !== 'function') e.push('setup(db)')
  if (inst.database != null && typeof inst.database !== 'function') e.push('database()')
  if (!inst.kinds || typeof inst.kinds !== 'object' || !Object.keys(inst.kinds).length) e.push('kinds')
  else {
    for (const [key, k] of Object.entries(inst.kinds)) {
      if (!k || typeof k.insert !== 'function') e.push(`kinds.${key}.insert(tx, { owner, n })`)
      if (!k || typeof k.shown !== 'function') e.push(`kinds.${key}.shown(db)`)
      if (k && k.all != null && typeof k.all !== 'function') e.push(`kinds.${key}.all(db)`)
    }
  }
  return e
}

export function modConformance(inst) {
  const bad = instanceErrors(inst)
  if (bad.length) throw new TypeError(`modConformance: ${bad.join(', ')}`)
  const kindKeys = Object.keys(inst.kinds)

  let D = null
  let m = null
  let n = 0

  const refusal = async (p) => {
    try { await p } catch (e) {
      expect(e, String(e?.message || e)).toBeInstanceOf(ModError)
      return [e.code, e.status]
    }
    throw new Error('not refused')
  }
  const item = async (kind, ref) => (await D.query(
    'SELECT * FROM moderation_items WHERE instance = $1 AND kind = $2 AND ref = $3', [m.instance, kind, String(ref)])).rows[0]
  const stateOf = async (kind, ref) => (await item(kind, ref))?.state
  const events = async () => Number((await D.query(
    `SELECT count(*)::int AS n FROM moderation_events e JOIN moderation_items i ON i.id = e.item_id WHERE i.instance = $1`,
    [m.instance])).rows[0].n)
  const setQueue = on => m.saveSettings(ADMIN, { queue: on })

  // The host's post: the content row and its item in one transaction; after() once it commits.
  async function post(kind, actor = OWNER) {
    const k = inst.kinds[kind]
    let ref
    let res
    await D.transaction(async (tx) => {
      ref = String(await k.insert(tx, { owner: actor, n: ++n }))
      res = await m.submit(actor, kind, ref, tx)
    })
    await res.after()
    return { ref, res }
  }

  // The public-read rule, against the database as it stands: each kind's public read holds exactly its items in
  // approved or reported, every content row has an item, and reported means open reports.
  async function rule() {
    for (const kind of kindKeys) {
      const k = inst.kinds[kind]
      const items = (await D.query(
        'SELECT ref, state, reports_open FROM moderation_items WHERE instance = $1 AND kind = $2', [m.instance, kind])).rows
      const want = items.filter(i => shownToAll(i.state)).map(i => i.ref).sort()
      const got = [...new Set((await k.shown(D)).map(String))].sort()
      expect(got, `${kind}: the public read against the items shown to all`).toEqual(want)
      for (const i of items) {
        if (shownToAll(i.state)) expect(i.state === 'reported', `${kind} ${i.ref}: reported iff open reports`).toBe(Number(i.reports_open) > 0)
      }
      if (k.all) {
        const have = new Set(items.map(i => i.ref))
        const missing = (await k.all(D)).map(String).filter(r => !have.has(r))
        expect(missing, `${kind}: content rows with no item`).toEqual([])
      }
    }
  }

  describe(`moderation conformance: ${inst.name}`, () => {
    beforeAll(async () => {
      D = await (inst.database || pglite)()
      for (const fn of ['query', 'exec', 'transaction', 'reset']) {
        if (typeof D?.[fn] !== 'function') throw new TypeError(`modConformance: database() gives no ${fn}`)
      }
    }, 60000)
    afterAll(async () => { await D?.close?.() })
    beforeEach(async () => {
      await D.reset()
      await D.exec(modDDL())
      if (inst.setup) await inst.setup(D)
      m = inst.moderation({ db: D, transaction: D.transaction })
      if (!m || typeof m.submit !== 'function' || typeof m.instance !== 'string') {
        throw new TypeError('modConformance: moderation() gives no createModeration instance')
      }
      for (const kind of kindKeys) await m.mine(OWNER.sub, kind) // an unknown kind throws here, by name
      n = 0
    })

    it('the DDL runs as shipped, twice (IF NOT EXISTS)', async () => {
      await D.exec(modDDL())
      expect((await D.query(
        `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name IN
          ('moderation_items', 'moderation_reports', 'moderation_settings', 'moderation_events')`)).rows[0].n).toBe(4)
    })

    for (const kind of kindKeys) {
      const k = inst.kinds[kind]
      const reason = k.reason || 'other'

      describe(kind, () => {
        it('switch on: a new item waits unseen, Pending to its owner only; approve shows it', async () => {
          await setQueue(true)
          const { ref, res } = await post(kind)
          expect([res.from, res.to]).toEqual(['new', 'pending'])
          await rule()
          expect((await m.mine(OWNER.sub, kind)).map(i => [i.ref, i.label])).toEqual([[ref, 'Pending']])
          expect(await m.mine(OTHER.sub, kind)).toEqual([])
          await m.move(ADMIN, kind, ref, 'approve')
          expect(await stateOf(kind, ref)).toBe('approved')
          expect(await m.mine(OWNER.sub, kind)).toEqual([])
          await rule()
        })

        it('decline keeps it out of view, Declined to its owner, who submits it again: it waits', async () => {
          await setQueue(true)
          const { ref } = await post(kind)
          await m.move(ADMIN, kind, ref, 'decline')
          await rule()
          expect((await m.mine(OWNER.sub, kind)).map(i => i.label)).toEqual(['Declined'])
          expect((await m.submit(OWNER, kind, ref)).to).toBe('pending')
          await rule()
          expect((await m.move(ADMIN, kind, ref, 'approve')).to).toBe('approved')
          await rule()
        })

        it("report: another player's keeps it shown, as reported, once; the owner cannot; keep closes it", async () => {
          await setQueue(false)
          const { ref } = await post(kind)
          expect(await refusal(m.report(OWNER, kind, ref, reason))).toEqual(['own_item', 403])
          expect((await m.report(OTHER, kind, ref, reason)).to).toBe('reported')
          await rule()
          const again = await m.report(OTHER, kind, ref, reason)
          expect(again.already).toBe(true)
          expect((await item(kind, ref)).reports_open).toBe(1)
          expect((await m.reportedBy(OTHER.sub, kind, [ref]))).toEqual([ref])
          expect((await m.move(ADMIN, kind, ref, 'keep')).to).toBe('approved')
          expect((await item(kind, ref)).reports_open).toBe(0)
          await rule()
        })

        it('hide takes it out of view, Hidden to its owner; restore shows it; an admin-hidden item stays down', async () => {
          await setQueue(false)
          const { ref } = await post(kind)
          await m.report(OTHER, kind, ref, reason)
          await m.move(ADMIN, kind, ref, 'hide')
          expect(await item(kind, ref)).toMatchObject({ state: 'hidden', hidden_by: 'admin', reports_open: 0 })
          await rule()
          expect((await m.mine(OWNER.sub, kind)).map(i => i.label)).toEqual(['Hidden'])
          expect(await refusal(m.submit(OWNER, kind, ref))).toEqual(['refused', 409])
          expect((await m.move(ADMIN, kind, ref, 'restore')).to).toBe('approved')
          await rule()
        })

        it("switch off: a new item shows at once (auto); switch on: an admin's own shows at once (own)", async () => {
          await setQueue(false)
          const a = await post(kind)
          expect((await item(kind, a.ref))).toMatchObject({ state: 'approved', decided_by: 'auto' })
          await setQueue(true)
          const b = await post(kind, ADMIN)
          expect((await item(kind, b.ref))).toMatchObject({ state: 'approved', decided_by: 'own' })
          await rule()
        })

        it('the switch governs new submissions only: waiting items wait, shown items stay shown', async () => {
          await setQueue(true)
          const waiting = await post(kind)
          await setQueue(false)
          const shown = await post(kind)
          expect(await stateOf(kind, waiting.ref)).toBe('pending')
          await setQueue(true)
          expect(await stateOf(kind, shown.ref)).toBe('approved')
          await rule()
        })

        it('moves the table does not allow are refused (409) and change nothing', async () => {
          await setQueue(true)
          const p = await post(kind)
          await setQueue(false)
          const a = await post(kind)
          const before = await events()
          for (const mv of ['keep', 'hide', 'restore']) expect(await refusal(m.move(ADMIN, kind, p.ref, mv)), `${mv} pending`).toEqual(['refused', 409])
          expect(await refusal(m.report(OTHER, kind, p.ref, reason))).toEqual(['refused', 409])
          for (const mv of ['approve', 'decline', 'keep', 'restore']) expect(await refusal(m.move(ADMIN, kind, a.ref, mv)), `${mv} approved`).toEqual(['refused', 409])
          await m.move(ADMIN, kind, p.ref, 'decline')
          for (const mv of ['decline', 'keep', 'hide', 'restore']) expect(await refusal(m.move(ADMIN, kind, p.ref, mv)), `${mv} declined`).toEqual(['refused', 409])
          expect(await refusal(m.report(OTHER, kind, p.ref, reason))).toEqual(['refused', 409])
          expect(await events()).toBe(before + 1)
          expect([await stateOf(kind, p.ref), await stateOf(kind, a.ref)]).toEqual(['declined', 'approved'])
          await rule()
        })

        it("a guest is sent to sign in (401); a player's admin move is 403; another's item is not theirs (403)", async () => {
          await setQueue(true)
          const { ref } = await post(kind)
          expect(await refusal(m.report(null, kind, ref, reason))).toEqual(['sign_in', 401])
          expect(await refusal(m.move(OTHER, kind, ref, 'approve'))).toEqual(['admins_only', 403])
          expect(await refusal(m.submit(OTHER, kind, ref))).toEqual(['not_yours', 403])
          expect(await stateOf(kind, ref)).toBe('pending')
          await rule()
        })

        it('every move writes one event row, naming its actor', async () => {
          await setQueue(true)
          const { ref } = await post(kind)
          await m.move(ADMIN, kind, ref, 'approve')
          await m.report(OTHER, kind, ref, reason)
          await m.move(ADMIN, kind, ref, 'hide')
          await m.move(ADMIN, kind, ref, 'restore')
          const rows = (await D.query(
            `SELECT e.move, e.from_state, e.to_state, e.actor FROM moderation_events e JOIN moderation_items i ON i.id = e.item_id
              WHERE i.instance = $1 AND i.kind = $2 AND i.ref = $3 ORDER BY e.id`, [m.instance, kind, ref])).rows
          expect(rows.map(r => [r.move, r.from_state, r.to_state, r.actor])).toEqual([
            ['submit', null, 'pending', OWNER.sub],
            ['approve', 'pending', 'approved', ADMIN.sub],
            ['report', 'approved', 'reported', OTHER.sub],
            ['hide', 'reported', 'hidden', ADMIN.sub],
            ['restore', 'hidden', 'approved', ADMIN.sub],
          ])
          await rule()
        })

        it('1.5.0, PL-056: approve carries the revision the queue showed; a version sent since is 409 moved', async () => {
          await setQueue(true)
          const { ref } = await post(kind)
          const row = async () => (await m.queue(ADMIN, 'waiting', { limit: 100 })).rows.find(r => r.kind === kind && r.ref === ref)
          const seen = (await row()).revision
          expect(typeof seen === 'string' && seen.length > 0, 'a queue row carries its revision').toBe(true)
          expect((await row()).revision, `${kind}: the same revision on a second read (its preview the same whenever the content is)`).toBe(seen)
          await m.move(ADMIN, kind, ref, 'decline')
          await m.submit(OWNER, kind, ref)
          const before = await events()
          expect(await refusal(m.move(ADMIN, kind, ref, 'approve', { seen }))).toEqual(['moved', 409])
          expect(await events()).toBe(before)
          expect(await stateOf(kind, ref)).toBe('pending')
          await rule()
          expect((await m.move(ADMIN, kind, ref, 'approve', { seen: (await row()).revision })).to).toBe('approved')
          await rule()
        })

        if (k.edit) {
          it('1.5.0, rule 3: an edit with review waits with the switch off, and approve shows it', async () => {
            await setQueue(false)
            const { ref } = await post(kind)
            expect((await m.edit(OWNER, kind, ref, undefined, { review: true })).to).toBe('pending')
            await rule()
            expect((await m.move(ADMIN, kind, ref, 'approve')).to).toBe('approved')
            await rule()
          })

          it('edit: a shown item waits again with the switch on, and stays shown with it off', async () => {
            await setQueue(false)
            const { ref } = await post(kind)
            expect((await m.edit(OWNER, kind, ref)).to).toBe('approved')
            await rule()
            await setQueue(true)
            expect((await m.edit(OWNER, kind, ref)).to).toBe('pending')
            await rule()
            expect(await refusal(m.edit(OTHER, kind, ref))).toEqual(['not_yours', 403])
          })
        }

        if (k.takedown) {
          it('take down: out of view, Hidden to its owner, who can submit it again', async () => {
            await setQueue(false)
            const { ref } = await post(kind)
            await m.takedown(OWNER, kind, ref)
            expect(await item(kind, ref)).toMatchObject({ state: 'hidden', hidden_by: 'owner' })
            await rule()
            expect((await m.mine(OWNER.sub, kind)).map(i => i.label)).toEqual(['Hidden'])
            expect(await refusal(m.takedown(OTHER, kind, ref))).toEqual(['not_yours', 403])
            expect((await m.submit(OWNER, kind, ref)).to).toBe('approved')
            await rule()
          })
        }
      })
    }

    it(`the report limit: ${REPORTS_PER_DAY} in a day, then 429; another player still reports`, async () => {
      const kind = kindKeys[0]
      const reason = inst.kinds[kind].reason || 'other'
      await setQueue(false)
      const refs = []
      for (let i = 0; i <= REPORTS_PER_DAY; i++) refs.push((await post(kind)).ref)
      for (const ref of refs.slice(0, REPORTS_PER_DAY)) await m.report(OTHER, kind, ref, reason)
      expect(await refusal(m.report(OTHER, kind, refs[REPORTS_PER_DAY], reason))).toEqual(['limit', 429])
      expect((await m.report(ADMIN, kind, refs[REPORTS_PER_DAY], reason)).to).toBe('reported')
      await rule()
    }, 60000)

    it('the settings: saved by an admin only, a bad patch is 400; the switch reads back', async () => {
      expect(await refusal(m.saveSettings(OTHER, { queue: false }))).toEqual(['admins_only', 403])
      expect(await refusal(m.saveSettings(ADMIN, { queue: 'off' }))).toEqual(['bad_settings', 400])
      expect(await refusal(m.saveSettings(ADMIN, { other: true }))).toEqual(['bad_settings', 400])
      expect((await setQueue(false)).queue).toBe(false)
      expect((await m.settings()).queue).toBe(false)
      expect((await setQueue(true)).queue).toBe(true)
    })
  })
}
