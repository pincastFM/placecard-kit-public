# Contributing

Thanks for helping. Bugs and small fixes are welcome as issues or pull requests. For a new feature, please open an issue first, so we can agree where it sits in [the contract](CONTRACT.md) before you build it.

A vulnerability goes through [SECURITY.md](SECURITY.md), never a public issue.

## Run the checks

You'll need Node 22 and npm.

```sh
npm ci
npm run typecheck
npm test
npm pack --dry-run
```

CI runs these steps twice: once on Vue 3.3.4, the oldest Vue the kit supports and the one in the lockfile, and once on the latest Vue. To run the second pass yourself:

```sh
npm i --no-save vue@latest @vue/compiler-sfc@latest
npm run typecheck
npm test
npm ci
```

The last `npm ci` puts Vue 3.3.4 back.

Two files are generated. Run the script and commit what it writes:

- `npm run css` after you edit `css/table.css` or `css/themes/cardroom.css`. It joins them into `css/cardroom.css`, which nobody edits by hand.
- `npm run classes` after you add or remove a class. It rewrites `core/classes.js` (`TT_CLASSES`), and a test fails while that list is out of date.

## Goldens

A golden is a saved output (rendered HTML, a solved plan, a grid of arrival verdicts) that a test compares byte for byte. Goldens are how the kit keeps its promise that a minor version renders what the version before it rendered.

- A golden changes only on purpose, and the pull request says which output changed and what the change is for.
- A golden that changes because a mechanic changed (a pile, the flip, the deal, a gesture) means a major version. See [Versions](CONTRACT.md#10-versions).
- To rewrite one after an intended change, run its test with the variable its file names. That's `UPDATE_GOLDENS=1` for the planner, arrival and conformance goldens. The component goldens under `test/vue/goldens/` each name their own (`K1_WRITE`, `K2_WRITE`, `U2_WRITE`, `U3_WRITE`, `V13_WRITE`, `PL035_WRITE`). Read the diff before you commit it.

## Tests that need Pincast's private repos

A few tests check the kit against the code it came from, in Pincast's own app repos, read with `git show` at a fixed commit. Each one needs a local clone of its repo, named by an environment variable:

| Variable | Repo | Tests |
|---|---|---|
| `NYID_REPO` | Pincast's main app (Placecard and VeryThere) | `planner/test/day.test.ts`, `arrival/test/arrival.test.ts`, `test/nav/navFollow.test.js` |
| `TREEHOPPER_REPO` | Treehopper | `planner/test/path.test.ts`, `arrival/test/arrival.test.ts` |

Without the variable, or without the pinned commit, those tests skip and say so. That's how CI runs them, and how you'll run them too. The files they read are cached in `.pinned/`, which git ignores. Every other test runs with no private code at all.

## Commits and pull requests

- One change per pull request, with its tests.
- Commit subjects follow `type(scope): what it does`, for example `feat(table): prop landing, the newest find drops onto its stack once` or `fix(moderation): the queue says Changed only on the core's own 409`. The types are `feat`, `fix`, `docs`, `test`, `chore`, and `release` for a version commit.
- In the body, say whether the change is a patch, a minor or a major by the rules in [CONTRACT.md](CONTRACT.md#10-versions), and list any golden it changes.
- Leave `CONTRACT_VERSION` and `package.json`'s version alone. A release commit moves both.

By sending a pull request, you agree that your contribution is licensed under the [MIT License](LICENSE), like the rest of the kit.
