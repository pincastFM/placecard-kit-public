# Placecard kit

The Placecard kit puts a collection of cards on a table that people can sort, filter, flip and plan a walk from. Pincast's apps (Placecard, VeryThere and Treehopper) draw their cards with it, and any other app can too, in its own faces and colors.

## Install

```sh
npm install @pincast/placecard-kit
```

- The one peer is `vue` `>=3.3.4 <4`.
- The Vue parts ship as `.vue` source files, so your build needs a Vue compiler: Vite with `@vitejs/plugin-vue`, or Nuxt.
- `core`, `planner`, `arrival`, `moderation` and `registry` have no Vue in them, so they run in Node as well.

## Quickstart

Here's a bird-walk app with two cards, built with Vite and Vue:

```js
import { createApp, h } from 'vue'
import { createTabletop, Tabletop } from '@pincast/placecard-kit/vue'

const birds = {
  apps: [{ id: 'birds', name: 'Bird walk', color: '#B4432F' }],
  sets: [{ id: 'ramble', app: 'birds', name: 'The Ramble', meta: { face: 'bird' } }],
  rarities: { birds: ['Everyday', 'Seasonal', 'Lucky'] },
  cards: [
    { id: 'robin', app: 'birds', set: 'ramble', title: 'American Robin', rarity: 'Everyday', number: 1, held: true },
    { id: 'heron', app: 'birds', set: 'ramble', title: 'Great Blue Heron', rarity: 'Lucky', number: 2, held: false },
  ],
}

const tabletop = createTabletop({
  contract: 1,                                  // the contract major this app is built for
  app: 'birds',                                 // lowercase letters, digits and hyphens
  source: { load: async () => birds },          // you hand the kit its cards; it fetches nothing
  faces: { bird: { base: 'destination' } },     // your own face, drawn by one of the kit's
  theme: { class: 'tt-birds' },                 // your class on the table, over the Card room theme
  hand: { key: 'birds_hand', scope: 'ramble' }, // where the hand is kept (localStorage unless you pass a store)
  modes: { collection: true },
})

createApp({ render: () => h(Tabletop, { tabletop }) }).mount('#app')
```

The robin is on the table. The heron isn't collected yet, so it waits under the Missing chip until someone taps it.

The face is declared once, in the config, and the set picks it with `meta.face`. The kit's `destination` face draws it under the id `bird`, so your CSS can restyle it under `.ttf[data-face="bird"]`. This exact block runs in the kit's own tests (`test/vue/quickstart.test.js`).

Every face your cards take goes in `config.faces`, the default included. A card that names no face, from a set that names none, takes `stop`; a card from the `registry` subpath takes `destination` unless its set or your app names another. `createTabletop` refuses an empty `faces`, and `load()` refuses a card whose face isn't declared, so an app whose registry cards all take the default still writes one line: `faces: { destination: {} }`.

Two things stay with your app:

- **Fonts and the page.** The kit never writes to `<head>` or `<html>` itself. Call `setTtHost({ head, distUnit, lock })` once to hand it your head function, your distance unit and your page lock (see [the contract](CONTRACT.md#host-hooks)). Through `head`, the table asks for the Card room's fonts, the ones its theme tokens name, unless your theme lists its own `fonts`; `fonts: []` turns them off.
- **Your data.** `source.load()` returns your collection from wherever you keep it: your API, a file, the Placecard registry. For registry data, the `registry` subpath turns the rows into cards. Keys stay on your server.

## Subpaths

| Import | What it holds |
|---|---|
| `@pincast/placecard-kit/core` | The table's logic with no framework: piles, filters, sorts, the hand, the faces' logic, map marks, safe storage, the config and collection checks. |
| `@pincast/placecard-kit/vue` | `createTabletop`, `Tabletop` and the components (`TtTable`, `TtFace`, `TtCard`, `TtStage`, `TtDay`, `TtPath`, `TtPack`, the moderation parts), the composables and `setTtHost`. Single files as `vue/*.vue` and `vue/*.js`. |
| `@pincast/placecard-kit/css/*` | `cardroom.css` (the Card room theme and the table, loaded by `TtTable`), `table.css`, `themes/cardroom.css`, `moderation.css`. |
| `@pincast/placecard-kit/planner` | The plan record (version 2) with its validator, and the two solvers: `day` (a timed day from a hand of cards) and `path` (a walk through places). |
| `@pincast/placecard-kit/contract` | TypeScript types: the config, the collection, the record, the moderation shapes. |
| `@pincast/placecard-kit/nav` | `createNavFollower(map, opts)`, a walking camera for a map that follows a phone's GPS along a route. |
| `@pincast/placecard-kit/arrival` | One arrival check (is the person at the place?), with each app's own rule passed in. It returns a verdict and never refuses anything. |
| `@pincast/placecard-kit/conformance` | `ttConformance`, the shared test suite every app runs against its own config. |
| `@pincast/placecard-kit/moderation` | A moderation core for your server: reports, the review queue, the moves between states. |
| `@pincast/placecard-kit/registry` | Placecard registry data as the kit's cards: one registry row, a whole `/me/cards` response, or your app's own set with one person's collects, mapped into a collection that `source.load()` can return. You fetch the data, and it maps it. |
| `@pincast/placecard-kit/sql/*` | `moderation.sql`, the moderation core's Postgres tables, as text. |

Every subpath exports `CONTRACT_VERSION`.

## Versioning

The package follows semver, and `CONTRACT_VERSION` is the package's version. Your config names the contract major it was built for (`contract: 1`), and `createTabletop` throws when the kit's major is different.

- **Major:** a config key removed or renamed, a record field changed, a `tt-` class or a token renamed, a golden that changes because a mechanic changed, or anything a host must act on to keep what it had.
- **Minor:** a new subpath or component, a new optional key, prop or label (its default is today's word), a new token with a default, a new solver, a new face. With nothing new passed, a minor renders what the version before it rendered.
- **Patch:** a fix that leaves every golden as it is.

A saved plan carries its own `planVersion`, so plans written by older versions still read. [CONTRACT.md](CONTRACT.md#10-versions) has the full rules.

## Conformance

Each app proves its own config against the kit with one vitest file:

```js
// @vitest-environment jsdom
import { resolve } from 'node:path'
import { ttConformance } from '@pincast/placecard-kit/conformance'
import { config, collection } from '../src/tabletop.js'

ttConformance({ name: 'birds', config, collection, base: 'cardroom', goldens: resolve(__dirname, 'goldens') })
```

It checks the config and the collection, every theme token, the class names, the hand's stored shape, every plan record, and the rendered table at phone and laptop widths against your goldens (`UPDATE_GOLDENS=1` writes them). You'll need `vitest` (`>=1.6.0 <3`) and `@electric-sql/pglite` (`>=0.2.0 <1`) as dev dependencies, and the kit run through Vite: `test.server.deps.inline: [/@pincast\/placecard-kit/]` in your vitest config.

## More

- [CONTRACT.md](CONTRACT.md): every config key, face, token and event the kit promises.
- [SECURITY.md](SECURITY.md): how to report a vulnerability.
- [CONTRIBUTING.md](CONTRIBUTING.md): how to run the checks and send a change.

## License

MIT. See [LICENSE](LICENSE).
