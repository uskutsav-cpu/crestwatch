/**
 * Copy deck (Appendix E). Every string a visitor reads lives here.
 * Voice: a calm neighbor who knows the river, in words a kid can read.
 * Short sentences. Contractions. No exclamation marks. No em dashes.
 * Jargon gets a plain gloss the first time it appears. Banned words:
 * catastrophic, danger, panic, guaranteed, exact. Uncertainty stays
 * honest ("about", "~"). The app never says "automated". It says "public data".
 */

export const copy = {
  appName: "CrestWatch",
  tagline: "Will the water reach your house? One sentence, days early.",
  headerPill: "Live river data · no account ✓",
  footerLine: "Built on free public data from USGS, NOAA, and the Census.",
  privacyFooter:
    "Runs on public data. Nothing about you leaves your browser.",

  // S1 · Setup
  addressPlaceholder: "123 Main St, Vicksburg MS (or just your town)",
  cta: "Watch this place",
  howItWorks: [
    "We check the river gauges",
    "We read the official forecast",
    "We compare the water to how high your spot sits",
  ],
  confirmSpot: (elev: string) => `Your spot sits at ${elev} ft.`,
  confirmGauge: (gauge: string, mi: string) =>
    `Closest river gauge: ${gauge}, ${mi} miles away.`,
  addPin: "+ Add the road you care about",
  done: "Done",
  addressNotFound:
    "We couldn't find that one. Try a street address, or just your town and state, like Vicksburg, MS.",
  approximateNote:
    "This is the middle of town, not your house. Your own street can sit a few feet higher or lower. Type your street address to get an answer for your house.",
  approximateTag: "town center",
  elevationUnavailable:
    "We found your spot, but the map service that tells us how high the ground sits didn't answer. Wait a moment and try again.",
  lookupUpstream:
    "The public map service is slow right now. Try again in a minute. Your address is fine.",
  looking: "Reading the river…",

  // S2 · Watch
  chipLikely: "water likely",
  chipBorderline: "too close to call",
  chipUnlikely: "stays dry",
  chipCategory: "category mode",
  chipAlertOnly: "no gauge here",
  trendRising: "river rising",
  trendFalling: "river falling",
  trendSteady: "river steady",
  refresh: "Check again",
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
    "Add your home, grandma's place, or the road to school. CrestWatch checks them all every 15 minutes.",
  removePlace: (name: string) =>
    `Remove ${name} from this browser? This can't be undone.`,
  renamePrompt: "What should we call this place?",
  deleteAll: "Delete all my data",
  deleteAllConfirm:
    "Remove every saved place from this browser? This can't be undone.",

  // S4 · Why
  whyTitle: "No magic. Here's the math.",
  tierFull: "FULL",
  tierCategory: "CATEGORY",
  tierAlertOnly: "ALERT-ONLY",
  noGaugeHeadline: "CrestWatch can't watch this spot",

  // S5 · Replay
  replayTitle: "Replay a real flood",
  replayResult: (pin: string, days: number) =>
    `Water above ${pin}: ${days} days`,

  // Verdict sentences (Appendix C, hand-tuned by the team)
  verdictLikely: (river: string, day: string, time: string, pin: string, h: number) =>
    `The ${river} peaks ${day} around ${time}. Water likely reaches ${pin} about ${h} hours before that.`,
  verdictLikelyPastPeak: (river: string, pin: string) =>
    `The ${river} has peaked and is coming down, but ${pin} is likely still in the water today.`,
  verdictBorderline: (pin: string, margin: string, next: string) =>
    `${pin} sits about ${margin} ft above the forecast peak. That's too close to call. Check back after the next forecast, around ${next}.`,
  verdictUnlikely: (river: string, day: string, stage: string, pin: string, margin: string) =>
    `The ${river} peaks ${day} at ${stage} ft. ${pin} stays dry by about ${margin} ft.`,
  verdictCategory: (x: string, gauge: string, category: string) =>
    `The forecast crest is ${x} ft above flood stage at ${gauge}. The Weather Service calls that ${category} flooding for low areas nearby. This gauge doesn't share its height above sea level, so CrestWatch can't do house-level math here. Treat low roads as wet.`,
  verdictCategoryNoMargin: (gauge: string, category: string) =>
    `The forecast crest reaches ${category} flooding at ${gauge}. This gauge doesn't share its height above sea level, so CrestWatch can't do house-level math here. Treat low roads as wet.`,
  verdictCategoryAction: (gauge: string) =>
    `The forecast crest comes close to flood stage at ${gauge}. Keep an eye on it. This gauge doesn't share its height above sea level, so CrestWatch can't do house-level math here.`,
  verdictLikelyPastPeakButRising: (river: string, pin: string) =>
    `The forecast says the ${river} has peaked, but the gauge still shows it rising right now. ${pin} is likely in the water today. Check back after the next forecast.`,
  verdictLikelyNow: (pin: string, river: string) =>
    `${pin} is in the water now, and the ${river} is still up. Stay off flooded roads and check back after the next forecast.`,
  verdictAlertOnly:
    "No forecast gauge watches this spot. CrestWatch works on rivers with gauges. For flash floods from sudden rain, your county alerts are the right tool.",
  staleness: (n: number) =>
    `Heads up: this data is ${n} hours old. The river may have moved.`,

  // Band labels
  bandLikely: "Water likely reaches this spot.",
  bandBorderline: "Too close to call. The forecast can be off by this much.",
  bandUnlikely: (margin: string) => `This spot stays dry by about ${margin} ft.`,

  // About
  aboutPrivacy:
    "Your addresses never leave your browser. We have no server memory, no accounts, no tracking.",
  honesty:
    "CrestWatch predicts river flooding, the slow kind our district gets, with days of warning. It can't predict flash floods from sudden rain. Its numbers are estimates from public elevation data, not a survey of your property. When it's too close to call, it says so.",
} as const;
