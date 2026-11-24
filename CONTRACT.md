# The Placecard kit contract

This page is what `@pincast/placecard-kit` promises the apps that use it: what goes in and what comes out, the faces, the theme tokens, the events, what the kit never does, and how versions move. The version number protects everything listed here. For the full detail, read the types in `contract/` and the `.d.ts` file beside each module.

## 1. What the kit is

- One card table that every app shares: piles, filters, sorts, the card-size slider, the hand, the open card and the planner. It behaves the same everywhere, and each app brings its own data, faces, theme and words.
- Pincast's own apps use the kit exactly as any other app does, through `createTabletop(config)`.
- It's plain Vue and JavaScript with TypeScript types, and it brings no Nuxt, router, auto-imports, mapbox-gl or keys. It sets nothing on `<head>` or `<html>` except through the host hooks (section 2).

## 2. The entry: `createTabletop(config)`

```js
import { createTabletop, Tabletop } from '@pincast/placecard-kit/vue'

const tabletop = createTabletop(config)   // throws one TypeError that lists every config problem
// <Tabletop :tabletop="tabletop" />, with TtTable's slots
```

It returns:

- `contractVersion`, and `config` as given.
- `collection`: a shallow ref, null until loaded. `loading` and `error` are refs.
- `load()`: runs `config.source.load()`, one call at a time (a second call while one runs gets the same promise). It checks the collection, and on a problem it sets `error` and returns null. Otherwise it adds `faces: config.faces` when the collection has none, then keeps the collection and returns it.
- `table`: a shallow ref of the mounted table's handle (`t`, `T`, `change`, `openCard`, `deal`, `openNest`, `closeNest`, `over`, `pop`). `Tabletop` sets it on mount and clears it on unmount.
- `hand`: the hand under `config.hand`: `hand`, `ready`, `key`, `count`, `has`, `add`, `remove`, `move`, `toggle`, `restore`, `clear`.
- `plan(input, meta)`: the planning mode's solver. `day` returns a plan record (meta gives `id`, `set` and `madeAt`); `path` returns a promise of `{ record, geometry, timingError }`. It throws when the config has no planning mode.
- `Tabletop`: the component. Its props are `tabletop` and `autoload` (default true: `load()` on mount when there's no collection yet). Its root is `TtTable`, so a class, listeners and any `TtTable` prop the config doesn't hold reach the table, and every slot passes through.
- `dispose()`: stops the hand's watchers. Inside a component's setup they stop with the component anyway.

### Config keys

`ttConfigErrors` refuses an unknown key at any level below, and a value of the wrong kind.

| Key | Required | What it is |
|---|---|---|
| `contract` | yes | The contract major the app was built for, a whole number. A different major from the kit's throws. |
| `app` | yes | The app's id: lowercase letters, digits and hyphens, 1 to 32 (`TT_APP_ID_RE`, `/^[a-z0-9-]{1,32}$/`), the shape of a Placecard registry id. `TT_APP_IDS` (`treehopper`, `verythere`, `studio`) names Pincast's own apps as examples and gates nothing. |
| `source` | yes | `{ load }`: returns the collection, or a promise of it. The kit fetches nothing itself. |
| `faces` | yes | The faces the cards may take: an object keyed by face id, or a list of `{ id }`. A kit face (`TT_FACES`: `stop`, `destination`, `treehopper`, `studio`) takes `{}`, and never a `base` or a `component`. The app's own face, under an id of `TT_FACE_ID_RE` (`/^[a-z][a-z0-9-]{0,31}$/`), gives `base` (a kit face draws it) or `component` (the app's Vue component draws it); given both, the component draws. Any entry may set `print` (a boolean), the open card's print motion for that face. Every face the cards take goes here, the default included: `stop` for a card that names none and whose set names none, `destination` for a card from the `registry` subpath unless its set or app names another. `createTabletop` refuses an empty `faces`, and `load()` refuses a card whose face isn't here, so an app whose registry cards all take the default still writes one line: `faces: { destination: {} }`. Declare them once; the collection doesn't need to repeat them. See section 6. |
| `theme` | yes | `{ class, fonts?, htmlAttrs? }`: the class on the table root that supplies the theme tokens (section 5; never `tt`), its font stylesheets (https URLs, or `{ key, href }`) and its `<html>` attributes. Left out, `fonts` is the Card room's, the fonts the theme tokens name; `fonts: []` turns them off. The table hands the fonts and attributes to the host's `head`. `TT_CARDROOM_THEME` is the Card room's. |
| `hand` | yes | `{ key, scope, store? }`: the storage key and the hand's scope (each a string, a ref or a getter), and a `{ get, set, remove }` store (default `safeLocal`, localStorage that never throws). The kit keeps the stored shape, `{ v: HAND_V, zone, entries }`. |
| `modes` | yes | `collection: true`, `planning`, or both. `planning` is `{ solver: 'day', rules }` (rules: the app's `DayRules`) or `{ solver: 'path', directions? }`. |
| `table` | no | `{ key, widths: { phone, laptop }, stacked, only }`: the storage key of the remembered view, the starting card widths in px, whether piles open stacked, and the table's own filter (a function of a card). |
| `labels` | no | The table's words, each a string, and `groups`: `{ [group id]: label }`. Unset, the kit's English. |
| `links` | no | `{ back: { label, href }, empty: [{ label, href }] }`. |
| `groups` | no | The groupings offered, from `TT_GROUP_IDS` (`set`, `app`, `kind`, `rarity`, `none`). The first is the starting one. |
| `sorts` | no | The sorts offered, from `TT_SORT_IDS` (`newest`, `rarest`, `name`, `number`). `newest` starts when offered, else the first. |
| `filters` | no | `{ facets, missing, search }`: which of `TT_FACET_IDS` (`from`, `set`, `rarity`, `kind`, `interests`) get chips; `missing: false` drops the Missing chip; `search: false` drops the search. |
| `map` | no | A component that draws a day or the cards' marks from the kit's query. |

### The collection

`source.load()` returns:

```js
{
  apps: [{ id, name, color, site }],         // color: the app's mark, any CSS color
  sets: [{ id, app, name, meta: { face } }],
  rarities: { [appId]: ['Common', 'Rare'] }, // each app's rarity names, in order
  cards: [{ id, app, set, face, title, rarity, number, held }],
  faces,                                     // optional: the faces, as in config.faces
}
```

- A card's face is its own `face` when that names a kit face or one of the app's own faces, else its set's `meta.face` by the same test, else `stop` (`ttFaceOf`). The app's own faces are the collection's `faces`, which `load()` fills from `config.faces` when the collection has none.
- `load()` checks the lists, `rarities`, and that every card's face and every set's `meta.face` is in `config.faces` (`ttCollectionErrors`, at most 20 lines and a count of the rest). It reads each card's face the way the table will, so a card that takes the app's own face from its set passes with that face declared only in the config.
- `held: false` is a missing card. The table counts it under the Missing chip once the person holds another card from its set.
- The card fields the kit reads are typed in `core/core.d.ts` (`TtCoreCard`). The Studio face also reads `find`, `place` and `inset`.
- An app's mark is its `color` in `apps`. The Studio face always prints the app's `name` and `site` on its foot, the site without `https://`. On an open card the name links to the site, in a new tab.

### Host hooks

Once per app, before the first table renders, `setTtHost({ head, distUnit, lock })` (from `vue`) gives the kit:

- `head(entry)`: your app's way to add a link or `<html>` attributes to the page. The table hands it the theme's fonts and attributes, and each face's fonts once a card that needs them is on the table. A collection that arrives after the table renders, as `Tabletop`'s does, brings those face fonts in one more entry. The kit calls `head` while one of its components is the current instance (in its setup or a lifecycle hook), so `useHead` works as your `head`.
- `distUnit`: `{ unit, toggle }`, your app's stored distance unit and its toggle.
- `lock(on)`: your page lock, called while an open card, a day or a path covers the table. `ttHtmlLock` is the Card room's: it sets `data-tt-locked` on `<html>`, which `table.css` reads.

With no host, there are no head entries, the distance unit is `mi` for the page, and nothing locks.

## 3. The subpaths

| Subpath | Holds |
|---|---|
| `core` | Framework-free ESM: the table's logic, piles, filters, the hand, face logic, map marks, the config and collection checks, the token and class lists, safe storage, the pack's look. Runs in Node. |
| `vue` | `createTabletop`, `Tabletop`, `TtTable`, `TtFace`, `TtCard`, `TtStage`, `TtRail`, `TtRuler`, `TtSearch`, `TtDay`, `TtPath`, `TtPack`, the moderation parts (`TtReport`, `TtModChip`, `TtModHide`, `TtModSwitches`, `TtModQueue`), `useTtTable`, `useTtHand` and the host hooks. Vue `>=3.3.4 <4` is the one peer; the `.vue` files ship as source. `vue/*.vue` and `vue/*.js` import one file at a time. |
| `css/*` | `table.css` (the mechanics tokens and every rule; reads tokens only), `themes/cardroom.css` (the Card room theme), `cardroom.css` (the two joined; `TtTable` loads it), `moderation.css` (the moderation parts, `--tt-mod-*` tokens only). |
| `planner` | The plan record (version 2), its validator and `upgradeV1()`, the `path` and `day` solvers, `planInput`, `DayRules`, the Directions adapter's interface. Server-safe, no map library. |
| `contract` | TypeScript types: the config, the collection, the record, theme token names, the moderation shapes. |
| `nav` | `createNavFollower(map, opts)`: a walking camera that turns the map to the route ahead and moves the camera and the person's dot in the same frame. Its only dependencies are seven `@turf/*` packages. |
| `arrival` | One arrival check for every app, with each app's rule as config: `checkArrival`, `holdArrival`, `arrivalStep`, `observeArrival`, and Placecard's own rule (`placecardRule`, `pcCollectCheck`). Server-safe. |
| `conformance` | `ttConformance`, the shared vitest suite every app runs, its framework-free checks, and `modConformance` for an app's moderation wiring. |
| `moderation` | Framework-free ESM for your server: the moves and states, `createModeration`, `ntfyAlert`, with types. |
| `registry` | Framework-free ESM with types: Placecard registry data mapped into the kit's cards and collections (below). Fetches nothing. |
| `sql/*` | `moderation.sql`, the moderation core's Postgres tables, as text. |

Every JavaScript subpath exports `CONTRACT_VERSION`, and a kit test fails when any of them differs from `package.json`'s version.

What stays in each app: its source adapters (for registry data, its `registry` options), its `DayRules` values, its map, its theme, its words, the numbers in its arrival rules, and the code that reads its own routes.

### The `registry` subpath

`@pincast/placecard-kit/registry` turns Placecard registry data into the kit's cards and collections. It's plain JavaScript with types and runs anywhere. It never fetches and never signs anyone in: you fetch the data, and it maps it.

- `ttFromAppSet(set, collects, options)` is where an outside app starts. `set` is your set as you sent it to `PUT /v1/sets/:set`, with its `id` and your `app` id added. `collects` is the answer of `GET /v1/sets/:set/collects` for one person, or `null` when no one is signed in. Out comes `{ apps, sets, rarities, cards }`, ready for `source.load()` to return. The person's cards are held (`collected` is the day of the first collect, and `added` counts the order they came in), and once they hold one, the rest of the set waits under the Missing chip. A retired card shows only when it's held, and an `experience` card never shows.
- `ttFromRegistry`, `ttSetFromRegistry` and `ttFromMeCards` map one registry row or `/me/cards` tile, one set, or a whole `/me/cards` response.
- The options, none of them required:
  - `apps`: your app's record, `{ id, name, color, site, face }`. Its `color` is your cards' accent and your mark on the table; its `face` is the face your cards take when their set names none.
  - `faces`: your own faces, the ones a set's `meta.face` may name. Pass your config's `faces`.
  - `face`: the face when nothing else names one.
  - `photo(url, fields)`: the address the table shows for a card's image.
  - `rarities` (`{ [kind]: words }`, low to high) and `ladder` (the words a card ranks on when its set's kind has no list).
  - `rules`: hooks per app id (`face`, `set`, `card`, `offTable`) for whatever your app does differently.
  - `base`: Placecard's home, `TT_PLACECARD_BASE` (`https://placecard.io`) unless you pass another.
- By default, a card takes its set's `meta.face` when that's a kit face or one you declared, else your app's `face`, else `destination` (`TT_REG_DEFAULT_FACE`). A `rules[app].face` hook that answers comes before all three. The card's accent is your app's color, its rarity ranks on Placecard's order (`TT_PLACECARD_RARITIES`, Widespread to Unique) unless you pass `rarities` or `ladder`, and its link is its Placecard card page, `<base>/card/<app>/<set>/<key>`.
- A set keeps its `meta.face` only when that's a kit face or one you declared, and `load()` then checks it against `config.faces`. So pass the subpath and `createTabletop` the same faces.
- Bad input throws one `TypeError` that lists every problem, and a field the subpath doesn't read is never a problem. `ttAppSetErrors` and `ttRegOptionsErrors` return the same list without throwing. Lookups by app id or kind read only the options' own keys, so an app called `constructor` is an app like any other.

## 4. What apps override, and what they never override

**Apps override:** the data (`source`, and the `registry` options that map it), the faces (the kit's, or their own by `base` or `component`), the theme tokens, the map, the labels, the links, the solver rules (`DayRules`), the arrival rules (`ArrivalRule`), what is offered (modes, groups, sorts, filters, starting widths), and the hand's store and key.

**Apps never override:**

- the mechanics and motion: piles, the deal, the flip, the slider's stops and snap, gestures, reduced motion, the layout breakpoint
- the card and hand shapes, and the record's shape
- what a filter means (an app may hide a facet, never redefine it)
- the `tt-` and `ttf-` class names (`TT_CLASSES`), and the 15 mechanics tokens (section 5)

A new app keeps its own classes out of the `tt-` and `ttf-` namespaces. Conformance's `own` option lists any it already has there.

## 5. Theme tokens

A theme is a set of CSS custom properties on the table root: `.tt` together with the theme's class.

- **Theme tokens (22, `TT_THEME_TOKENS`; a theme supplies every one):**
  - ground and lines: `--ground`, `--ground-2`, `--surface`, `--backdrop`, `--line`, `--line-2`
  - chrome: `--chrome`, `--chrome-2`, `--chrome-3`
  - accents: `--gold`, `--gold-2`, `--spot`, `--grain`, `--grain-a`
  - type: `--font-display`, `--font-text`, `--font-mono`
  - shape: `--r-1`, `--r-2`, `--r-3`, `--r-pill`, `--shadow-card`
- **Mechanics tokens (15, `TT_MECHANICS_TOKENS`; the kit's, never set by a theme):**
  - motion: `--e-out`, `--e-in`, `--e-end`, `--e-settle`, `--d-fast`, `--d-med`
  - layout: `--card-w`, `--gap`, `--sat`, `--sab`, `--padl`, `--padr`, `--top-h`, `--strip-h`, `--dock-h`
- **Tokens with a default (`TT_DEFAULTED_TOKENS`):** every other token the kit reads. Each has a default equal to the value it replaced, so a theme may set it or leave it. They cover the table (`--tt-ground`, `--tt-scheme`, the pile, edge and shadow tokens, chip and segment padding), the print face (`--pc-*`) and the Treehopper face (`--thf-*`).
- **Moderation tokens (14, `TT_MOD_TOKENS`, `--tt-mod-*`):** read by `moderation.css`, with defaults. Set them where you mount the moderation parts.
- **Legacy app marks:** `--mark-th`, `--mark-vt` and `--mark-pc` (`TT_LEGACY_MARK_TOKENS`). The Card room theme still declares them, so CSS that reads them keeps working, but no theme needs to supply them. An app's mark is its `color` in the collection's `apps`.

Faces read no table token, with one exception: the print face's `--pc-*` and the Treehopper face's `--thf-*` tokens, which an app's theme sets on its table.

`css/themes/cardroom.css` is the Card room theme. `css/cardroom.css` is that theme followed by `table.css`, and `TtTable` loads it, so every table has the Card room tokens underneath an app's own. An app that supplies all 22 tokens itself can build on `table.css` alone. Either way, a theme missing a token fails conformance (`base: 'cardroom'` or `base: 'table'`).

## 6. Faces

A face draws a card, front and back. `TtFace` draws every face, and `TtTable`, `TtStage` and `TtCard` use it.

- **The kit's faces (`TT_FACES`):** `stop` and `destination` (a typographic card, or one with a photograph), `treehopper` (a printed species card) and `studio` (Placecard's board card).
- **An app's own face, by `base`:** the named kit face draws it, and the card is that kit face in every respect (theme, print motion, foot, classes, fonts) except its root's `data-face`, which is the app's face id. Restyle it under `.ttf[data-face="<id>"]`.
- **An app's own face, by `component`:** the app's Vue component draws inside the kit's card, on both sides. It gets the props `card`, `side` (`'front'` or `'back'`), `data`, `labels` and `look` (`ttLook`, whose `base` is null and whose `theme` is `'own'`), and the slots `art`, `head`, `foot` and `more` pass through. The root carries the class `ttf-own`.
- **Reading a face in code:** `core` has `ttFaceEntry` (a face's entry), `ttFaceBase` (the kit face that draws it, or null for a component) and `ttFaceComponent`. `ttLook(card).base` is the same drawing face. In the types, `TtAppId` and `TtFaceId` are any string, and `TtKitFaceId` is the four kit faces.
- **The print motion** (`ttPrintOn`): on by default for faces drawn by `treehopper` or `studio` and for the `studio` app's cards. The card's own `print` wins over everything; its face entry's `print` comes next.
- **Fonts:** the table hands the host's `head` `TT_FACE_FONTS` with the table, and `TT_TH_FONTS` or `TT_PC_FONTS` when the collection holds a card drawn by the Treehopper or Studio face.
- **The pack** (`TtPack`, `ttPackLook`), the pack a collected card comes out of: its band is the `tint` you pass, so pass your app's `color`. With no tint, Pincast's three apps get their own colors (`TT_PACK_TINTS`) and any other app gets the Studio's green, `#006638`.

## 7. Events

| Component | Emits |
|---|---|
| `Tabletop`, `TtTable` | `nest` (the open set's parent id, or null), `landed` (the id of the `landing` card, once it has dropped onto its pile) |
| `TtStage` | `closed` (the closed card's id) |
| `TtCard` | `update:side` (`'front'` or `'back'`) |
| `TtRail` | `group`, `chip`, `missing`, `query`, `opening` |
| `TtSearch` | `query`, `opening` |
| `TtRuler` | `preview`, `commit` (the card width) |
| `TtDay` | `close`, `deal`, `map`, `card` (a card's key) |
| `TtPath` | `close`, `home`, `minutes`, `start`, `end`, `card` (a card's key) |
| `TtPack` | `done`, once, when the card is out of the pack |
| `TtReport` | `reported` (`{ kind, ref, reason, already }`) |
| `TtModHide` | `moved` (`{ move, kind, ref, result }`) |
| `TtModQueue` | `update:tab`, `counts`, `moved` (`{ move, row, result }`), `denied` |
| `TtModSwitches` | `load`, `change`, `denied` |

## 8. The plan record, version 2

A plan is a plain object, the same for both solvers, with its keys in this order. The validator checks the exact key sets on the record, on each stop and on the totals.

```
{ id, app, set, madeBy, madeAt, planVersion: 2,
  solver: { id: 'path' | 'day' },
  clock: { tz, date, startAt } | null,
  start, end, mode, minutes, order,
  stops, finish, totals, leftOver, ext }
```

- `solver.id`: `path` is a walk through places; `day` is a timed day from a hand of cards.
- `clock`: the wall clock a timed day runs on (an IANA `tz`, `date` as YYYY-MM-DD, `startAt` in minutes past midnight). Every minute in the record counts from `startAt`. A path has no clock.
- A stop is `{ n, kind, card, place, leg, arriveMin, dwellMin, status, label, meal, fromHand, alts }`, with `kind` one of `see`, `eat` or `event`, and `place` either `{ id, lat, lon }` or null.
- `totals` is `{ stops, m, walkMin, totalMin, timing, leftOver }`. `timing` is `mapbox`, `route` (an app's own router) or `estimate`.
- `leftOver` lists `{ key, kind, reason }` for each card wanted and not placed.
- `ext` holds app-only fields. The kit never reads them.
- Version 1 records stay as they were written and are read through `upgradeV1()`.

## 9. What the kit never does

- **Fetch your data.** `source.load()` hands the table its collection, and the `registry` subpath maps data you fetched yourself. Two parts make requests, and only when your app uses them: the moderation components call your own endpoints (`TT_MOD_ENDPOINTS`, or your `request` function), and `ntfyAlert` posts to ntfy when your server calls it with a topic.
- **Hold a key or sign anyone in.** The person, their session and every key stay with your app. A call that needs a key goes through your server.
- **Write to the page on its own.** Fonts, `<html>` attributes and the page lock go through the host hooks.
- **Read a plan's `ext`**, or any field an app keeps for itself.
- **Refuse an arrival.** `arrival` returns verdicts. It never refuses, throws, stores or fetches; what a verdict does is the app's call.
- **Bring a server framework or a database driver.** The `moderation` core takes your database client, does no sign-in and never reads your content tables.

## 10. Versions

- `CONTRACT_VERSION` is the package's semver, exported by every JavaScript subpath and returned by `createTabletop` as `contractVersion`.
- An app's config names the contract major it was built for (`contract: 1`). `createTabletop` throws on a different major.
- **Major:** a config key removed or renamed, a record field changed, a `tt-` class or a token renamed, a golden that changes because a mechanic changed, or a change a host must act on to keep what it had.
- **Minor:** a new subpath or component, a new optional key, prop or label (its default is today's word), a new token with a default, a new solver, a new face. A host that passes nothing new renders what the version before rendered.
- **Patch:** a fix that leaves every golden as it is.
- The plan record carries its own `planVersion`: 1 is the original path record, 2 is this page's.

What each version added:

- **1.0.0:** the first stable contract: `createTabletop` as the one entry, the conformance suite, and the page lock moved to the host (`setTtHost({ lock })`).
- **1.1.0:** the `moderation` subpath and its components, `TtCard`, and the table's fixed words as labels.
- **1.2.0:** opt-in card fields, props, slots, labels and tokens for the Treehopper face and the table; declaration files for `core`.
- **1.3.0:** a back that fades while there's more to read (`card.backFade`), the newest find dropping onto its pile (`landing`, `landed`), and the planner's home button (`labels.home`).
- **1.4.0:** the `studio` face. `vitest` and `@electric-sql/pglite` are no longer peers: an app that runs conformance installs them as dev dependencies.
- **1.5.0:** the pack a collected card comes out of (`TtPack`, `ttPackLook`), the `arrival` subpath, a Studio card's accent, and three moderation additions: a report while a change waits, a forced review, and an approve that checks the version the admin saw.
- **1.6.0:** the open kit and the registry.
  - Any app id of the registry's shape, and an app's own faces by `base` or `component`.
  - An app's mark from its `color` in the collection's `apps`, so `TT_THEME_TOKENS` lists 22 tokens where it listed 25.
  - The collection check reads `config.faces` when the collection has none, so an app declares its own faces once, in the config.
  - The `registry` subpath.
  - A theme with no `fonts` gets the Card room's, the fonts its tokens name; `fonts: []` turns them off.
  - A face's fonts reach the head once a card that needs them arrives, so a Studio or Treehopper card on a `createTabletop` table gets its own type.
  - A registry card with its own `url` (http or https) opens that page, in a new tab, and its button reads "Open in" and the app's name. With no `url` it opens Placecard's card page. A set's own `action` still wins.
  - The Studio foot always prints the app's name and site, drops the site's `https://`, and links the name to the app on an open card.
- **1.6.1:** the table's head says "1 Card" at one card, where it said "1 Cards" (`labels.card`; an app that sets `labels.cards` alone keeps its word). No face changes.
- **1.6.2:** the moderation parts' buttons take their own type again: Report, Hide, Restore and Retry at .8125em and weight 600, the sheet's and the queue's buttons at .875em, all in `--tt-mod-font-label`. A tab not chosen and a switch at Off read `--tt-mod-ink-2`, and a tab sits on the tabs' rule. `css/moderation.css` only. No face changes.
