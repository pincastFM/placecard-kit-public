// Types for core/safeStorage.js: site storage that never throws.

export interface TtSafeStore {
  /** The stored string, or null (always null on the server) */
  get(key: string): string | null
  /** true when the browser kept it, false when only this tab's memory has it */
  set(key: string, value: string): boolean
  remove(key: string): void
  /** Every key this tab can read */
  keys(): string[]
}
export declare const safeLocal: TtSafeStore
export declare const safeSession: TtSafeStore
/** The Storage shape over safeLocal */
export declare const safeLocalStorage: {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
/** Tests only: forget what memory holds */
export declare function _resetSafeStorageMemory(): void
