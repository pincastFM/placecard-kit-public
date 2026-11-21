// Types for core/print.js: the shared card's light and finger tilt. Does nothing without a window.

export declare const TT_PRINT_SKIP: string
export interface TtPrintOptions {
  /** default true */
  light?: boolean
  /** default true; off under reduced motion */
  tilt?: boolean
  /** default <html> */
  root?: HTMLElement
  /** the holder a press leans, default '.tt-st-card' */
  card?: string
  /** controls and text left alone, default TT_PRINT_SKIP */
  skip?: string
}
/** Starts it; the function returned stops it and removes all it set */
export declare function ttPrint(o?: TtPrintOptions): () => void
