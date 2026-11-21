// Compiled by `npm run typecheck`, never run: the registry subpath's types the way an app calls them, through the
// package's own exports. Each `@ts-expect-error` marks a call the types must refuse.
import {
  TT_PLACECARD_BASE, ttFromAppSet, ttFromMeCards, ttFromRegistry, ttRegFace, ttRegFields, ttSetFromRegistry,
  type TtRegCard, type TtRegCollection, type TtRegRules, type TtRegSet,
} from '@pincast/placecard-kit/registry'
import type { TtCollection } from '@pincast/placecard-kit/contract'

const is = <T>(v: T): T => v
is<string>(TT_PLACECARD_BASE)

const rules: TtRegRules = {
  apps: [{ id: 'bird-walk', name: 'Bird walk', color: '#B4432F', face: 'studio' }],
  faces: { bird: { base: 'studio' } },
  photo: (url) => `${url}?w=480`,
  rules: { 'bird-walk': { face: (f) => (f.type === 'bird' ? 'bird' : null), card: (card, f, ctx) => ({ href: f.url || ctx.page, ref: { id: f.key } }) } },
}
const set: TtRegSet = ttSetFromRegistry({ app_id: 'bird-walk', id: 'prospect-park', name: 'Prospect Park' }, { ...rules, total: 40 })
const card: TtRegCard = ttFromRegistry({ app_id: 'bird-walk', set_id: 'prospect-park', card_key: 'robin' }, { ...rules, set, holding: { collected: '2026-11-01', added: 1 } })
is<string>(ttRegFace(ttRegFields({ app: 'bird-walk', set: 'prospect-park', key: 'robin' }), set, rules))
const me: TtRegCollection = ttFromMeCards(null, { ...rules, sort: 'newest' })
const outside: TtCollection = ttFromAppSet({ id: 'prospect-park', app: 'bird-walk', name: 'Birds', cards: [{ key: 'robin', type: 'bird', title: 'Robin' }] }, { cards: [{ key: 'robin', collectedAt: '2026-11-01T00:00:00Z' }] }, rules)
is<boolean>(card.held)
is<number>(me.cards.length + outside.cards.length)
// @ts-expect-error a card needs its key
ttFromRegistry({ app_id: 'bird-walk', set_id: 'prospect-park' })
// @ts-expect-error the set needs its name
ttFromAppSet({ id: 'p', app: 'bird-walk' }, null)
