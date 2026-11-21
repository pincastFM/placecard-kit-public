// The day solver's rules: everything NYID's handToDay (utils/tabletop/day.js) took
// from the Provo deal (components/likealocal/llZoneDeal.js, 14 symbols) and its chip families
// (llZoneChips.js CHIP_FAMILY), handed in as one object, so the day knows no app. An app builds
// its rules from its own deal: Provo's are NYID's utils/tabletop/provo.js PROVO_DAY_RULES;
// planner/test/day.test.ts builds the same object from the pinned NYID files.

export interface LatLng {
  lat: number
  lng: number
}

// A meal the day can hold: minutes past midnight on the zone's clock, and the chips that eat
// there in order of fit (breakfast: cafes, then sweets, then food)
export interface Meal {
  id: string
  label: string
  from: number
  to: number
  chips: string[]
}

// Opening hours, minutes past midnight
export interface Hours {
  from: number
  to: number
}

// One dated night of an event on the zone's clock
export interface Occurrence {
  key: string
  date: string
  at: number
  dur: number
  interests: string[]
}

export type ChipFamily = 'eat' | 'see' | 'stay'

export interface DayRules {
  tz: string                       // the zone's time zone, when a call names none
  meals: Meal[]
  gap: number                      // the least minutes between two slots
  seeMin: number                   // a place to see's slot
  alts: number                     // how many cards a suggested slot offers
  seeChips: string[]               // the chips the fill draws places to see from
  dayEnd: number                   // no day runs past this minute
  chipFamily: Record<string, ChipFamily>
  hours: Record<string, Hours>     // usual hours by chip; a call's own `hours` wins, {} turns them off
  occurrences: (events: any[], tz: string) => Occurrence[]
  walkMinutes: (a: LatLng, b: LatLng) => number
  meters: (a: LatLng, b: LatLng) => number
  rng: (seed: number) => () => number
  clock: (min: number) => string   // a minute past midnight as the app shows it
  rank: (pool: any[], from: LatLng, rand: () => number, interests: string[], chips: string[]) => any[]
  ring: (pool: any[], from: LatLng, need: number) => any[]
  eventMax?: number                // an event held to this many minutes (120)
  minSlot?: number                 // the shortest slot (30)
  mealMin?: number                 // a meal's length (60)
  step?: number                    // a start after a walk rounds up to this (5)
  atStartM?: number                // a card this close to the center is where the day starts (50)
  labels?: Partial<DayLabels>
}

export interface DayLabels {
  eat: string
  see: string
  stay: string
  event: string
}

export const DAY_DEFAULTS = Object.freeze({
  eventMax: 120,
  minSlot: 30,
  mealMin: 60,
  step: 5,
  atStartM: 50,
  labels: Object.freeze({ eat: 'Eat', see: 'See', stay: 'Stay', event: 'Event' }) as DayLabels,
})

// Usual hours by chip, for kinds that plainly close: museums, shops, and parks after dark (NYID
// h47). Food and the rest follow the meals or keep no hours. A card's own `hours` win.
export const DAY_HOURS: Readonly<Record<string, Hours>> = Object.freeze({
  museums: Object.freeze({ from: 10 * 60, to: 17 * 60 }),
  shops: Object.freeze({ from: 10 * 60, to: 20 * 60 }),
  parks: Object.freeze({ from: 7 * 60, to: 21 * 60 }),
})

export type FullDayRules = Required<Omit<DayRules, 'labels'>> & { labels: DayLabels }

// The rules with every optional number and label filled in
export function fullRules(r: DayRules): FullDayRules {
  return {
    ...r,
    eventMax: r.eventMax ?? DAY_DEFAULTS.eventMax,
    minSlot: r.minSlot ?? DAY_DEFAULTS.minSlot,
    mealMin: r.mealMin ?? DAY_DEFAULTS.mealMin,
    step: r.step ?? DAY_DEFAULTS.step,
    atStartM: r.atStartM ?? DAY_DEFAULTS.atStartM,
    labels: { ...DAY_DEFAULTS.labels, ...(r.labels || {}) },
  }
}
