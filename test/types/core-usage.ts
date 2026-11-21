// Compiled by `npm run typecheck`, never run: the core and vue/moderation types the way the
// apps call them, through the package's own exports. Each `@ts-expect-error` marks a call the types must refuse.
import {
  CONTRACT_VERSION, TT_CARDROOM_THEME, TT_ICON, TT_FACES, clock, crBar, crHead, handAdd, handToggle, safeLocal,
  _resetSafeStorageMemory, ttFilter, ttGroup, ttSort, ttRow, ttNest, ttLook, ttStamp, ttFaceCredit, ttCheckConfig, wall,
  type TtCoreCard, type TtGroup, type HandEntry,
} from '@pincast/placecard-kit/core'
import {
  TT_MOD_LABELS, TtModRequestError, ttModCall, ttModRequest, ttModWords, type TtModWords,
} from '@pincast/placecard-kit/vue/moderation.js'
import type { TabletopConfig, TtCollection, TtTheme } from '@pincast/placecard-kit/contract'

const is = <T>(v: T): T => v

// Treehopper's three imports, as lib/cards/thread.ts, tests/thread.test.ts and pages/collection.vue use them
const store: { get(key: string): string | null; set(key: string, value: string): boolean } = safeLocal
_resetSafeStorageMemory()
type BarOf = (o: { held: number, total: number, nums: Set<number> }) => { background: string } | null
const barOf: BarOf = crBar
is<string>(TT_ICON.tree)
// @ts-expect-error not one of the icons
void TT_ICON.nope

// An app's own card type, an interface with no index signature, keeps its type through the pipeline
interface AppCard { id: string; title: string; set: string; held: boolean; rarity: string; number: number; extra: { n: number } }
declare const appCards: AppCard[]
const shown: AppCard[] = ttSort(ttFilter(appCards, { missing: true, q: 'oak', only: c => c.extra.n > 0 }), 'name')
const groups: TtGroup<AppCard>[] = ttGroup(shown, 'set', { cards: appCards })
is<AppCard | null>(ttRow(shown, 'a').next)
is<string | undefined>(crHead(groups[0]).name)
// @ts-expect-error not a sort
ttSort(appCards, 'tallest')

// The contract's collection is core's data
declare const col: TtCollection
ttGroup(col.cards, 'rarity', col)
// 1.6.0 (the open kit): a look's face may be the app's own id; the kit face that draws it is `base` (null: the host's component)
is<string>(ttLook(col.cards[0], col).face)
is<'stop' | 'destination' | 'treehopper' | 'studio' | null>(ttLook(col.cards[0], col).base)
is<boolean>(TT_FACES.includes('stop'))

// One level under a card: the children's own type
interface Tree extends TtCoreCard { girth: number }
declare const species: { id: string; children: Tree[]; childTotal: number }
is<Tree[]>(ttNest(species).cards)
is<{ n: number | null; no: string; date: string; spot?: string } | null>(ttStamp({ id: 'x', number: 4, collected: '2022-04-19' }))
is<string | undefined>(ttStamp({ id: 'x', held: false, spot: '0.3 mi' })?.spot)
is<string | undefined>(ttStamp({ id: 'x', collected: '2022-04-19', dateStamp: true })?.date)
is<string>(ttFaceCredit({ id: 'x', face: 'treehopper', credit: 'Photo: alias', creditAsGiven: true }))

// The hand and the clock
const hand: HandEntry[] = handToggle(handAdd([], 'card-1'), { key: 'ev-2', kind: 'event' })
// @ts-expect-error a hand entry's kind is card or event
handAdd(hand, { key: 'x', kind: 'stop' })
is<string>(clock(450))
is<number>(wall(Date.now(), 'America/Denver').min)

// The Card room theme passes as a config's theme, and the config check hands the config back
const theme: TtTheme = TT_CARDROOM_THEME
declare const cfg: TabletopConfig
is<TabletopConfig>(ttCheckConfig(cfg, CONTRACT_VERSION))
void theme

// vue/moderation.js
is<string>(TT_MOD_LABELS.queue)
const words: TtModWords = ttModWords({ queue: 'Queue', reasons: { tree_photo: { spam: 'Spam' } } })
is<string>(words.limit)
void ttModRequest('report', { kind: 'tree_photo', ref: 12, reason: 'spam' })
void ttModRequest('move', { kind: 'tree_photo', ref: '12', move: 'hide' })
// @ts-expect-error not an admin move
void ttModRequest('move', { kind: 'tree_photo', ref: '12', move: 'submit' })
void ttModCall({ endpoints: { report: '/x' } }, 'queue', { tab: 'waiting', limit: 20 }).then((r) => {
  if ('data' in r) void r.data
  else if ('signIn' in r) is<true>(r.signIn)
  else is<number>(r.status)
})
is<number>(new TtModRequestError(429, 'limit').status)
void store
void barOf
