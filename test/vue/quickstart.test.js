// @vitest-environment jsdom
/**
 * The README's quickstart, run as written. The test reads the first js block under "## Quickstart" in README.md,
 * swaps its two imports for the kit's own modules and vue, runs it on a page with a #app element, and checks the
 * table it mounts. A change to the README's code that stops it working fails here. The quickstart declares the app's
 * own face once, in the config, and its collection names that face only through its set's meta.face: the collection
 * check reads the config's faces when the collection has none (1.6.0).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as vue from 'vue'
import * as kitVue from '../../vue/index.js'

const README = readFileSync(resolve(__dirname, '../../README.md'), 'utf8')
const MODULES = { vue, '@pincast/placecard-kit/vue': kitVue }

// The block, and each `import { a, b } from 'x'` line as a destructuring of the module given for 'x'
function quickstart() {
  const at = README.indexOf('## Quickstart')
  const block = /```js\n([\s\S]*?)```/.exec(README.slice(at))
  if (at < 0 || !block) throw new Error('README.md: no js block under "## Quickstart"')
  const used = []
  const code = block[1].replace(/^import \{([^}]+)\} from '([^']+)'$/gm, (_, names, from) => {
    if (!(from in MODULES)) throw new Error(`README.md quickstart imports ${from}, which this test does not provide`)
    used.push(from)
    return `const {${names}} = __modules[${JSON.stringify(from)}]`
  })
  return { code, used }
}

window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })
Element.prototype.getAnimations = function () { return [] }
Element.prototype.animate = function () { return { cancel() {}, finish() {}, onfinish: null, oncancel: null } }

describe('README quickstart', () => {
  let app = null
  beforeAll(() => {
    localStorage.clear()
    document.body.innerHTML = '<div id="app"></div>'
    const run = new Function('__modules', `${quickstart().code}\nreturn { tabletop }`)
    app = run(MODULES)
  })
  afterAll(() => { document.body.innerHTML = '' })

  it('imports only the package\'s vue subpath and vue itself', () => {
    expect(quickstart().used.sort()).toEqual(['@pincast/placecard-kit/vue', 'vue'])
  })

  it('declares the app\'s own face once, in the config: the collection it loads carries no faces', async () => {
    const { tabletop } = app
    expect(Object.keys(tabletop.config.faces)).toEqual(['bird'])
    expect(tabletop.config.faces.bird.base).toBe('destination')
    const loaded = await tabletop.config.source.load()
    expect('faces' in loaded).toBe(false)
    expect(loaded.sets.map(s => s.meta && s.meta.face)).toEqual(['bird'])
  })

  it('mounts the table with the bird app\'s held card out and its missing card under the Missing chip', async () => {
    await flushPromises()
    const { tabletop } = app
    expect(tabletop.error.value).toBe(null)
    expect(tabletop.contractVersion).toBe(kitVue.CONTRACT_VERSION)
    expect(tabletop.collection.value.cards.map(c => c.id)).toEqual(['robin', 'heron'])
    const root = document.querySelector('#app .tt')
    expect(root).not.toBe(null)
    expect(root.classList.contains('tt-birds')).toBe(true)
    expect(root.textContent).toContain('American Robin')
    expect(root.textContent).not.toContain('Great Blue Heron')
    const missing = [...root.querySelectorAll('button')].find(b => /^\s*Missing\s*1\s*$/.test(b.textContent))
    expect(missing, 'a Missing chip counting one card').toBeTruthy()
    missing.click()
    await flushPromises()
    expect(root.textContent).toContain('Great Blue Heron')
    // the app's own face is drawn by the destination face, under the app's own id
    const faces = [...root.querySelectorAll('.ttf[data-face]')].map(f => f.getAttribute('data-face'))
    expect(faces.length).toBeGreaterThan(0)
    expect(new Set(faces)).toEqual(new Set(['bird']))
    expect(tabletop.table.value).not.toBe(null)
  })
})
