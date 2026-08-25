/**
 * Copy deck (Appendix E). Every user-facing string lives here.
 * Voice (Appendix B5): a calm neighbor who happens to know the river.
 * 6th-grade reading level, contractions, zero exclamation marks. Jargon
 * gets a plain gloss on first use. Banned words: catastrophic, danger,
 * panic, guaranteed, exact. Uncertainty is always honest ("about", "~").
 * The app never says "automated" — it says "public federal data."
 */

export const copy = {
  appName: "CrestWatch",
  tagline: "Will the water reach your house? One sentence, days early.",
  headerPill: "Live federal data · no account ✓",
  footerLine: "Runs on public federal data — USGS, NOAA, Census.",
  privacyFooter:
    "Runs on public federal data. Nothing about you leaves your browser.",

  // S1 · Setup
  addressPlaceholder: "123 Main St, Vicksburg MS",
  cta: "Watch this place",
  howItWorks: [
    "We read the river gauges",
    "We read the official crest forecast",
    "We compare it to how high your ground sits",
  ],
  confirmSpot: (elev: string) => `Your spot sits at ${elev} ft.`,
  confirmGauge: (gauge: string, mi: string) =>
    `Nearest forecast gauge: ${gauge}, ${mi} mi.`,
  addPin: "+ Add the road you care about",
  done: "Done",
  addressNotFound:
    "We couldn't find that address. Try adding the city and state, like the example.",
  looking: "Reading the river…",

  // S2 · Watch
  chipLikely: "water likely",
  chipBorderline: "too close to call",
  chipUnlikely: "stays dry",
  chipCategory: "category mode",
  chipAlertOnly: "no gauge here",
  whyLink: "Why this verdict →",
  share: "Share",
  countdown: (pin: string, h: number) => `water reaches ${pin} in ~${h}h`,
  liveChip: (time: string) => `live · updated ${time}`,
  delayedChip: (n: number) => `data delayed ${n}h`,
  crestCompare: (n: string, year: number) =>
    `${n}-highest forecast here since ${year}`,
  fallingNote: "the river is coming down",

  // S3 · Places
  placesTitle: "Your places",
  addPlace: "+ Add a place",
  placesEmpty:
    "Add your home, grandma's place, or the road to work — CrestWatch checks them all, every 15 minutes.",
  deleteAll: "Delete all my data",
  deleteAllConfirm:
    "Remove every saved place from this browser? This can't be undone.",

  // S4 · Why
  whyTitle: "No magic — here's the math",
  tierFull: "FULL",
  tierCategory: "CATEGORY",
  tierAlertOnly: "ALERT-ONLY",
  noGaugeHeadline: "CrestWatch can't watch this spot",

  // S5 · Replay
  replayTitle: "Replay a real flood",
  replayResult: (pin: string, days: number) =>
    `Water above ${pin}: ${days} days`,

  // Verdict sentences (Appendix C — TEAM hand-tunes)
  verdictLikely: (river: string, day: string, time: string, pin: string, h: number) =>
    `The ${river} peaks ${day} around ${time}. Water likely reaches ${pin} about ${h} hours before that.`,
  verdictLikelyPastPeak: (river: string, pin: string) =>
    `The ${river} has peaked and is coming down, but ${pin} is likely still in the water today.`,
  verdictBorderline: (pin: string, margin: string, next: string) =>
    `${pin} sits about ${margin} ft above the forecast peak — too close to call. Check back after the next forecast (updated ~${next}).`,
  verdictUnlikely: (river: string, day: string, stage: string, pin: string, margin: string) =>
    `The ${river} peaks ${day} at ${stage} ft. ${pin} stays dry by about ${margin} ft.`,
  verdictCategory: (x: string, gauge: string, category: string) =>
    `The forecast crest is ${x} ft above flood stage at ${gauge} — the Weather Service calls that ${category} flooding for low areas nearby. CrestWatch can't do house-level math here (this gauge doesn't publish its elevation), so treat low roads as wet.`,
  verdictCategoryNoMargin: (gauge: string, category: string) =>
    `The forecast crest reaches ${category} flooding at ${gauge}. CrestWatch can't do house-level math here (this gauge doesn't publish its elevation), so treat low roads as wet.`,
  verdictCategoryAction: (gauge: string) =>
    `The forecast crest comes close to flood stage at ${gauge} — worth watching. CrestWatch can't do house-level math here (this gauge doesn't publish its elevation).`,
  verdictLikelyNow: (pin: string, river: string) =>
    `${pin} is in the water now, and the ${river} is still up. Stay off flooded roads and check back after the next forecast.`,
  verdictAlertOnly:
    "No forecast gauge watches this spot. CrestWatch works on rivers with gauges — for rain-driven flash flooding, your county alerts are the right tool.",
  staleness: (n: number) =>
    `Heads up — this data is ${n} hours old. The river may have moved.`,

  // Band labels
  bandLikely: "Water likely reaches this spot.",
  bandBorderline: "Too close to call — within the forecast's error range.",
  bandUnlikely: (margin: string) => `This spot stays dry by about ${margin} ft.`,

  // About
  aboutPrivacy:
    "Your addresses never leave your browser. We have no server memory, no accounts, no tracking.",
  honesty:
    "CrestWatch predicts river flooding — the slow kind our district gets, with days of warning. It cannot predict flash floods from sudden rain. Its numbers are estimates from public elevation data, not a survey of your property. When it's too close to call, it says so.",
} as const;
