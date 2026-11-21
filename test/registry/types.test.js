// The registry subpath ships types: the values registry/index.d.ts declares (read by TypeScript's checker) must equal
// what registry/index.js exports at run time, and package.json exports ./registry with its types.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import * as registry from '../../registry/index.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

describe('registry types', () => {
  it('declares every value the subpath exports, and nothing else', () => {
    const file = resolve(root, 'registry/index.d.ts')
    const program = ts.createProgram([file], {
      module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, target: ts.ScriptTarget.ES2022,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [], noEmit: true, strict: true,
      baseUrl: root, paths: { '@pincast/placecard-kit/contract': ['./contract/index.ts'] },
    })
    const checker = program.getTypeChecker()
    const values = checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(file)))
      .filter(s => (s.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(s) : s).flags & ts.SymbolFlags.Value)
      .map(s => s.getName()).sort()
    expect(ts.getPreEmitDiagnostics(program).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([])
    expect(values).toEqual(Object.keys(registry).sort())
    expect(values).toHaveLength(16)
  })

  it('package.json exports ./registry with a types condition and ships the folder', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
    expect(pkg.exports['./registry']).toEqual({ types: './registry/index.d.ts', import: './registry/index.js' })
    expect(pkg.files).toContain('registry')
  })
})
