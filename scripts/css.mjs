// The Card room stylesheet. css/cardroom.css is css/themes/cardroom.css (the theme's
// tokens and the ground) then css/table.css (the mechanics tokens and every rule), joined here into one real file, so
// TtTable's <style src>, the tests that read it and every bundler get one stylesheet with no @import.
// Run by build, and so by prepack; test/css/split.test.js checks that the file on disk is the join.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
export const CARDROOM_PARTS = ['css/themes/cardroom.css', 'css/table.css']
export const CARDROOM_BANNER = '/* css/cardroom.css: css/themes/cardroom.css then css/table.css, joined by scripts/css.mjs (npm run build). Edit those two files, not this one. */\n'

export function joinCardroom (root = ROOT) {
  return CARDROOM_BANNER + CARDROOM_PARTS.map(p => readFileSync(join(root, p), 'utf8')).join('\n')
}

export function writeCardroom (root = ROOT) {
  writeFileSync(join(root, 'css/cardroom.css'), joinCardroom(root))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) writeCardroom()
