/**
 * Copy deck (Appendix E). Every string a visitor reads lives here.
 * Voice: a calm neighbor who knows the river, in words a kid can read.
 * Short sentences. Contractions. No exclamation marks. No em dashes.
 * Jargon gets a plain gloss the first time it appears. Banned words:
 * catastrophic, danger, panic, guaranteed, exact. Uncertainty stays
 * honest ("about", "~"). The app never says "automated". It says "public data".
 */

/** "1 hour", "5 hours". */
const hours = (h: number) => (h === 1 ? "1 hour" : `${h} hours`);

/** Past 48 hours, an age reads better in days ("3 days", not "72 hours"). */
const age = (h: number) => (h > 48 ? `${Math.round(h / 24)} days` : hours(h));

export const copy = {
  appName: "CrestWatch",
  tagline: "Will the water reach your house? One sentence, days early.",
  headerPill: "Live river data · no account ✓",
  footerLine: "Built on free public data from USGS, NOAA, and the Census.",
  privacyFooter:
    "Runs on public data. Nothing about you leaves your browser.",

  // S1 · Setup
  addressPlaceholder: "123 Main St, Vicksburg MS",
  addressHint: "A street address works best. A town or ZIP code works too.",
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
  exampleLink: "Just looking? See a live example from Vicksburg →",
  exampleNote:
    "This is an example: two spots in Vicksburg, MS, checked against today's real river data. Nothing was saved on this device.",
  exampleCta: "Check your own place →",
  lookupSlow:
    "Still working. The government map service is slow right now, so this can take up to a minute.",
  rateLimited:
    "That's a lot of lookups in a short time. Wait a few minutes, then try again.",
  lookupOffline:
    "We couldn't reach CrestWatch. Check your internet connection and try again.",

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
  delayedChip: (n: number) =>
    n > 48 ? `data delayed ${age(n)}` : `data delayed ${n}h`,
  crestCompare: (n: string, year: number) =>
    `${n}-highest forecast here since ${year}`,

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

  // Verdict sentences (Appendix C). TEAM: hand-tune these.
  verdictLikely: (river: string, day: string, time: string, pin: string, h: number) =>
    `The ${river} peaks ${day} around ${time}. Water likely reaches ${pin} about ${hours(h)} before that.`,
  verdictLikelyStale: (river: string, day: string, time: string, pin: string, h: number) =>
    `The last forecast had the ${river} peaking ${day} around ${time}. By that forecast, water likely reaches ${pin} about ${hours(h)} before that.`,
  verdictLikelyPastPeak: (river: string, pin: string) =>
    `The ${river} has peaked and is coming down, but ${pin} is likely still in the water today.`,
  verdictLikelyPastPeakStale: (river: string, pin: string) =>
    `The last forecast had the ${river} coming down from its peak, with ${pin} likely still in the water. Check back after the next forecast.`,
  verdictBorderline: (pin: string, margin: string, nextTime: string | null) =>
    `${pin} sits about ${margin} ft above the forecast peak. That's too close to call. ${
      nextTime === null
        ? "Check back after the next update."
        : `Check back after the next forecast, around ${nextTime}.`
    }`,
  verdictUnlikely: (river: string, day: string, stage: string, pin: string, margin: string) =>
    `The ${river} peaks ${day} at ${stage} ft on the river gauge. ${pin} stays dry by about ${margin} ft.`,
  verdictUnlikelyFalling: (river: string, stage: string, pin: string, margin: string) =>
    `The ${river} is at ${stage} ft on the river gauge and coming down. ${pin} stays dry by about ${margin} ft.`,
  verdictUnlikelyStale: (river: string, day: string, stage: string, pin: string, margin: string) =>
    `The last forecast had the ${river} peaking ${day} at ${stage} ft on the river gauge. By that forecast, ${pin} stays dry by about ${margin} ft.`,
  verdictUnlikelyStaleReading: (river: string, stage: string, pin: string, margin: string) =>
    `The last reading had the ${river} at ${stage} ft on the river gauge. By that reading, ${pin} stays dry by about ${margin} ft.`,
  verdictCategory: (x: string, gauge: string, category: string) =>
    `The forecast crest is ${x} ft above flood stage at ${gauge}. The Weather Service calls that ${category} flooding for low areas nearby. This gauge doesn't share its height above sea level, so CrestWatch can't do house-level math here. Treat low roads as wet.`,
  verdictCategoryNoMargin: (gauge: string, category: string) =>
    `The forecast crest reaches ${category} flooding at ${gauge}. This gauge doesn't share its height above sea level, so CrestWatch can't do house-level math here. Treat low roads as wet.`,
  verdictCategoryAction: (gauge: string) =>
    `The forecast crest comes close to flood stage at ${gauge}. Keep an eye on it. This gauge doesn't share its height above sea level, so CrestWatch can't do house-level math here.`,
  verdictLikelyPastPeakButRising: (river: string, pin: string) =>
    `The forecast says the ${river} has peaked, but the gauge still shows it rising right now. ${pin} is likely in the water today. Check back after the next forecast.`,
  verdictLikelyPastPeakButRisingStale: (river: string, pin: string) =>
    `The last forecast had the ${river} past its peak, but the gauge shows it still rising. ${pin} is likely in the water. Check back after the next forecast.`,
  verdictLikelyNow: (pin: string, river: string) =>
    `${pin} is in the water now, and the ${river} is still up. Stay off flooded roads and check back after the next forecast.`,
  verdictAlertOnly:
    "No forecast gauge watches this spot. CrestWatch works on rivers with gauges. For flash floods from sudden rain, your county alerts are the right tool.",
  staleness: (n: number) =>
    `Heads up: this data is ${age(n)} old. The river may have moved.`,

  // Band labels
  bandLikely: "Water likely reaches this spot.",
  bandBorderline: "Too close to call. The forecast can be off by this much.",
  bandUnlikely: (margin: string) => `This spot stays dry by about ${margin} ft.`,

  // About
  aboutPrivacy:
    "Your addresses never leave your browser. We have no server memory, no accounts, no tracking.",
  honesty:
    "CrestWatch predicts river flooding, the slow kind our district gets, with days of warning. It can't predict flash floods from sudden rain. Its numbers are estimates from public elevation data, not a survey of your property. When it's too close to call, it says so.",
  // 404 + error pages
  notFoundTitle: "We couldn't find that page.",
  notFoundBody:
    "The link may be old or typed wrong. Your saved places are still safe in this browser.",
  checkAPlace: "Check a place",
  errorTitle: "Something went wrong on our end.",
  errorBody:
    "Your saved places are safe. Try again, or come back in a minute.",
  tryAgain: "Try again",
  goHome: "Go home",
} as const;
