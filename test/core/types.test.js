// ./core and vue/moderation.js ship types. The declared values (read by TypeScript's checker, so
// `export *` and every module count) must equal what each module exports at run time, so the types cannot drift.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import * as core from '../../core/index.js'
import * as vueMod from '../../vue/moderation.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function declaredValues(dts) {
  const file = resolve(root, dts)
  const program = ts.createProgram([file], {
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [], noEmit: true, strict: true,
    baseUrl: root, paths: { '@pincast/placecard-kit/contract': ['./contract/index.ts'] },
  })
  const checker = program.getTypeChecker()
  const sym = checker.getSymbolAtLocation(program.getSourceFile(file))
  const values = checker.getExportsOfModule(sym)
    .filter(s => (s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s).flags & ts.SymbolFlags.Value)
    .map(s => s.getName()).sort()
  const errors = ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
  return { values, errors }
}

describe('core types (B18)', () => {
  it('declares every value core exports, and nothing else', () => {
    const { values, errors } = declaredValues('core/index.d.ts')
    expect(errors).toEqual([])
    expect(values).toEqual(Object.keys(core).sort())
    expect(values.length).toBeGreaterThan(100)
  })

  it('each core module has its own .d.ts beside it', () => {
    const index = readFileSync(resolve(root, 'core/index.js'), 'utf8')
    const mods = [...index.matchAll(/export \* from '\.\/(\w+)\.js'/g)].map(m => m[1])
    expect(mods.length).toBe(12) // pack.js (1.5.0)
    for (const m of mods) expect(readFileSync(resolve(root, `core/${m}.d.ts`), 'utf8')).toMatch(/export declare/)
    const dts = readFileSync(resolve(root, 'core/index.d.ts'), 'utf8')
    expect([...dts.matchAll(/export \* from '\.\/(\w+)\.js'/g)].map(m => m[1])).toEqual(mods)
  })

  it('exports ./core with a types condition, the import unchanged for every other condition', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    expect(pkg.exports['./core']).toEqual({ types: './core/index.d.ts', default: './core/index.js' })
    expect(core.CONTRACT_VERSION).toBe(pkg.version)
  })
})

describe('vue/moderation.js types (N4)', () => {
  it('declares every value the module exports, and nothing else', () => {
    const { values, errors } = declaredValues('vue/moderation.d.ts')
    expect(errors).toEqual([])
    expect(values).toEqual(Object.keys(vueMod).sort())
  })

  it('TT_MOD_LABELS keys are the contract words, each set', () => {
    const contract = readFileSync(resolve(root, 'contract/moderation.ts'), 'utf8')
    const block = contract.slice(contract.indexOf('export interface TtModLabels'), contract.indexOf('export interface TtModEndpoints'))
    const words = [...block.matchAll(/(\w+)\?:/g)].map(m => m[1]).filter(w => w !== 'when' && w !== 'reasons').sort()
    expect(Object.keys(vueMod.TT_MOD_LABELS).sort()).toEqual(words)
  })
})

// Since 1.4.0: GitHub Packages drops peerDependenciesMeta, so an optional peer reached an npm host as a
// production dependency. vitest and pglite are the conformance subpath's test-only peers, named in its header.
describe('PL-055 (1.4.0): the package\'s peers', () => {
  it('vue is the one peer; the lockfile\'s root says the same', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    expect(pkg.peerDependencies).toEqual({ vue: '>=3.3.4 <4' })
    expect(pkg.peerDependenciesMeta).toBe(undefined)
    const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8')).packages['']
    expect(lock.peerDependencies).toEqual(pkg.peerDependencies)
    expect(lock.peerDependenciesMeta).toBe(undefined)
    expect(readFileSync(resolve(root, 'conformance/index.js'), 'utf8')).toMatch(/Test-only peers \(1\.4\.0, PL-055\)/)
  })
})
