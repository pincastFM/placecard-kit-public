import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const src = p => fileURLToPath(new URL(p, import.meta.url))

// The planner's tests (planner/test), arrival's (arrival/test), core's and vue's (test/): .vue files through plugin-vue.
// vue/ imports the planner and the contract by the package's own name (consumers resolve it to dist/, which
// prepack builds); here, with no build, the TypeScript subpaths' names point at their sources.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^@pincast\/placecard-kit\/planner$/, replacement: src('./planner/index.ts') },
      { find: /^@pincast\/placecard-kit\/contract$/, replacement: src('./contract/index.ts') },
      { find: /^@pincast\/placecard-kit\/arrival$/, replacement: src('./arrival/index.ts') },
    ],
  },
  test: { include: ['planner/test/**/*.test.ts', 'arrival/test/**/*.test.ts', 'test/**/*.test.js'] },
})
