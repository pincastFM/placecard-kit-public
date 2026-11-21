// Sources the tests compare against, read from git at a fixed commit (git show, never a
// checkout switch) into .pinned/ (gitignored). Each repo is named only by an environment
// variable (TREEHOPPER_REPO, NYID_REPO): a local clone of that app's private repo. Unset, or
// without the commit, the tests that need it are skipped and say so.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export interface Pin {
  name: string
  repo: string
  commit: string
}

// Treehopper's release candidate: the planner as it is today (lib/placecard/itinerary)
export const TREEHOPPER: Pin = {
  name: 'treehopper-1947477',
  repo: process.env.TREEHOPPER_REPO || '',
  commit: '1947477c724b5ee4614beca70354fcc669219409',
}

// NYID with its tabletop goldens: the Provo code the day solver came from, plus the frozen outputs
export const NYID: Pin = {
  name: 'nyid-02292349',
  repo: process.env.NYID_REPO || '',
  commit: '022923491937efaeeeb48bf531fc997e4cf1484d',
}

const ROOT = resolve(__dirname, '..', '..', '.pinned')

export function gitShow(pin: Pin, path: string): Buffer {
  return execFileSync('git', ['-C', pin.repo, 'show', `${pin.commit}:${path}`], { maxBuffer: 64 << 20 })
}

export function hasPin(pin: Pin): boolean {
  if (!pin.repo) return false
  try {
    execFileSync('git', ['-C', pin.repo, 'cat-file', '-e', `${pin.commit}^{commit}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// Writes each path as it is at the pin's commit under .pinned/<name>/, and returns that folder
export function pinFiles(pin: Pin, paths: string[]): string {
  const dir = resolve(ROOT, pin.name)
  for (const p of paths) {
    const out = resolve(dir, p)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, gitShow(pin, p))
  }
  return dir
}
