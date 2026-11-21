// The moderation conformance suite (conformance/moderation.js) run as an instance would run it: the kit's own
// createModeration over two fake kinds whose content sits in a table with a hidden flag, as Treehopper's hidden_at,
// on the suite's default database (PGlite). The second kind has the Studio's edit and take-down.
import { modConformance } from '../../conformance/moderation.js'
import { createModeration } from '../../moderation/index.js'

const kind = (label, reasons) => ({
  label,
  reasons,
  async show(c, ref) { await c.query('UPDATE conf_content SET hidden = false WHERE ref = $1', [ref]) },
  async unshow(c, ref) { await c.query('UPDATE conf_content SET hidden = true WHERE ref = $1', [ref]) },
  async preview(c, refs) {
    const rows = (await c.query('SELECT ref, body FROM conf_content WHERE ref = ANY($1::text[])', [refs])).rows
    return Object.fromEntries(rows.map(r => [r.ref, { title: r.body }]))
  },
})

const insert = kindKey => async (tx, { owner, n }) => {
  const ref = `${kindKey}-${n}`
  await tx.query('INSERT INTO conf_content (ref, kind, owner, body) VALUES ($1, $2, $3, $4)', [ref, kindKey, owner.sub, `item ${n}`])
  return ref
}
const shown = kindKey => async db => (await db.query('SELECT ref FROM conf_content WHERE kind = $1 AND NOT hidden', [kindKey])).rows.map(r => r.ref)
const all = kindKey => async db => (await db.query('SELECT ref FROM conf_content WHERE kind = $1', [kindKey])).rows.map(r => r.ref)

modConformance({
  name: 'kit-fake',
  moderation: ({ db, transaction }) => createModeration({
    instance: 'kit-fake',
    db,
    transaction,
    kinds: { fake_photo: kind('Photo', ['offensive', 'other']), fake_card: kind('Card', ['wrong_place', 'other']) },
  }),
  setup: db => db.exec('CREATE TABLE conf_content (ref text PRIMARY KEY, kind text NOT NULL, owner text, body text, hidden boolean NOT NULL DEFAULT true)'),
  kinds: {
    fake_photo: { insert: insert('fake_photo'), shown: shown('fake_photo'), all: all('fake_photo'), reason: 'offensive' },
    fake_card: { insert: insert('fake_card'), shown: shown('fake_card'), all: all('fake_card'), edit: true, takedown: true },
  },
})
