// Builds dist/ for the three TypeScript subpaths (CONTRACT.md): planner, contract and arrival.
// esbuild bundles each entry to one ESM file, so Node and every bundler load it without extension
// rules (planner/path stays Treehopper's files byte for byte, extensionless imports and all);
// tsc writes the types beside it. core, vue and css ship as source; css/cardroom.css is first joined from its theme
// and table parts (scripts/css.mjs).
import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { writeCardroom } from './css.mjs'

writeCardroom()

rmSync('dist', { recursive: true, force: true })
for (const entry of ['planner', 'contract', 'arrival']) {
  await build({
    entryPoints: [`${entry}/index.ts`],
    outfile: `dist/${entry}/index.js`,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2020',
    logLevel: 'warning',
  })
}
execFileSync('npx', ['tsc', '-p', 'tsconfig.build.json'], { stdio: 'inherit' })
