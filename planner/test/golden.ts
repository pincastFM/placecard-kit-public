// Goldens, as NYID's (tests/tabletopGoldens.test.js): a JSON golden is JSON.stringify(value,
// null, 2) and a newline, compared byte for byte. UPDATE_GOLDENS=1 writes it instead; read the
// diff before committing it. A golden changes only on purpose.
import { expect, vi } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { PATH_CASES, MADE_AT, idFor, count } from './fixtures/path-cases'

export const GOLDENS = resolve(__dirname, 'goldens')
export const UPDATE = process.env.UPDATE_GOLDENS === '1'
export const asJson = (v: unknown) => JSON.stringify(v, null, 2) + '\n'

export function golden(file: string, text: string, dir: string = GOLDENS) {
  const path = resolve(dir, file)
  if (UPDATE) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
    return
  }
  let want: Buffer
  try { want = readFileSync(path) } catch { throw new Error(`no golden ${file}: write it once with UPDATE_GOLDENS=1 and read it`) }
  if (!Buffer.from(text, 'utf8').equals(want)) expect(text).toBe(want.toString('utf8'))
}

// Every path case through a planItinerary, with the record's id and time fixed and the
// planner's console line for a failed street service kept quiet
export async function runPathCases(planItinerary: (req: any, d: any) => Promise<any>) {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.useFakeTimers({ now: new Date(MADE_AT), toFake: ['Date'] })
  const out: { name: string; streetCalls: number; result: unknown }[] = []
  try {
    for (const [i, c] of PATH_CASES.entries()) {
      vi.stubGlobal('crypto', { randomUUID: () => idFor(i) })
      count.calls = 0
      let result: unknown
      try {
        result = await planItinerary(c.req, c.directions())
      } catch (e: any) {
        result = { error: String(e?.message || e) }
      }
      out.push({ name: c.name, streetCalls: count.calls, result })
    }
  } finally {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    quiet.mockRestore()
  }
  return out
}
