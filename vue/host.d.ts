// Types for vue/host.js, the host app's three hooks (kit CONTRACT.md).
import type { Ref } from 'vue'

/** A head entry the kit hands to the host: the table's data-tt and the fonts' stylesheet links */
export interface TtHeadEntry {
  htmlAttrs?: Record<string, string>
  link?: { key: string; rel: string; href: string }[]
}

/** The host's distance unit store: a ref of 'mi' or 'km' and a switch between them */
export interface TtDistUnit {
  unit: Ref<'mi' | 'km'>
  toggle: () => void
}

export interface TtHost {
  head?: ((entry: TtHeadEntry) => unknown) | null
  distUnit?: (() => TtDistUnit) | null
  /** Told when the open card, a day or a path starts and stops covering the table (ttHtmlLock: the Card room's) */
  lock?: ((on: boolean) => unknown) | null
}

export function setTtHost(host?: TtHost): void
export function ttHead(entry: TtHeadEntry): void
export function ttDistUnit(): TtDistUnit
export function ttLock(on: boolean): void
export function ttLocked(): boolean
export function ttHtmlLock(on: boolean): void
