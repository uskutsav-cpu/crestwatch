/**
 * Copy deck (Appendix E). Every string a visitor reads lives here.
 * Voice: a calm neighbor who knows the river, in words a kid can read.
 * Short sentences. Contractions. No exclamation marks. No em dashes.
 * Jargon gets a plain gloss the first time it appears. Banned words:
 * catastrophic, danger, panic, guaranteed, exact. Uncertainty stays
 * honest ("about", "~"). The app never says "automated" about its answers: it
 * says "public data". The one exception is the About page's "How it was
 * built", which must disclose the automated coding tool (contest rule). Keep it.
 */

/** "1 hour", "5 hours". */
const hours = (h: number) => (h === 1 ? "1 hour" : `${h} hours`);

/** Past 48 hours, an age reads better in days ("3 days", not "72 hours"). */
const age = (h: number) => (h > 48 ? `${Math.round(h / 24)} days` : hours(h));

export const copy = {
  appName: "CrestWatch",
  tagline: "Will the water reach your house? One sentence, days early.",
  headerPill: "Live river data · no account ✓",
  // Data credits. Strings are plain text; { text, href } parts render as
  // links (OpenStreetMap's ODbL and Open-Meteo's CC BY both ask for one).
  footerLine: [
    "Built on free public data from USGS, NOAA, and the Census. Address search also uses ",
    { text: "© OpenStreetMap contributors", href: "https://www.openstreetmap.org/copyright" },
    " and ",
    { text: "Open-Meteo", href: "https://open-meteo.com/" },
    ".",
  ],
  privacyFooter:
    "No accounts, no tracking, no ads. Places you save stay only in this browser. To look up an address, CrestWatch's server asks public map services. To check the river, it asks USGS and the Weather Service.",

  // S1 · Setup
  addressPlaceholder: "123 Main St, Vicksburg MS",
  addressHint: "A street address works best. A town or ZIP code works too.",
  cta: "Watch this place",
  howItWorks: [
    "We check the river gauges",
    "We read the official forecast",
    "We compare the water to how high your spot sits",
  ],
  confirmSpot: (elev: string) => `Your spot sits ${elev} ft above sea level.`,
  confirmGauge: (gauge: string, mi: string) =>
    `Closest river gauge: ${gauge}, ${mi} miles away.`,
  addPin: "+ Add the road you care about",
  done: "Done",
  addressNotFound:
    "We couldn't find that one. Try a street address, or just your town and state, like Vicksburg, MS.",
  approximateNote:
    "This is the middle of your town or street, not your house. Your own ground can sit many feet higher or lower. In hilly towns like Vicksburg it can be tens of feet. Type your full street address for an answer about your house.",
  approximateTag: "approximate spot",
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
  // Lookup progress, by time waited: 0 s, about 4 s, then lookupSlow.
  lookupFinding: "Finding your address…",
  lookupMeasuring: "Measuring how high your ground sits…",
  placesFull: (max: number) =>
    `You're watching ${max} places, the most CrestWatch keeps. Remove one on Your places to add another.`,
  skipSecond: "Skip, I'm done",
  storageBlocked:
    "This browser isn't saving places, so this one won't be here next time. Here's its answer for now.",

  // S2 · Watch
  pageTitleWatch: "Watch · CrestWatch",
  chipLikely: "water likely",
  chipBorderline: "too close to call",
  chipUnlikely: "stays dry",
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

  // Shared failure states (Watch, Places, Why use the same words)
  riverDataDown:
    "The river data didn't answer. Your places are still saved. Try again in a minute.",
  // Same, for a shared or example link: nothing is saved on this device.
  riverDataDownLinked: "The river data didn't answer. Try again in a minute.",
  brokenLink:
    "This shared link didn't open. Ask for a new link, or add your own place.",

  // S3 · Places
  placesTitle: "Your places",
  pageTitlePlaces: "Your places · CrestWatch",
  addPlace: "+ Add a place",
  placesEmpty:
    "Add your home, grandma's place, or the road to school. Open CrestWatch to see them all at once. While it's open, it checks again every 15 minutes.",
  removePlace: (name: string) =>
    `Remove ${name} from this browser? This can't be undone.`,
  renamePrompt: "What should we call this place?",
  deleteAll: "Delete all my data",
  deleteAllConfirm:
    "Remove every saved place from this browser? This can't be undone.",
  placeUnchecked: "Couldn't check right now",
  refreshFailedPlaces: (time: string) =>
    `Couldn't check the river just now. These answers are from ${time}.`,

  // S4 · Why
  whyCategoryExplain:
    "CrestWatch doesn't have a height above sea level for this gauge's zero mark that it can trust to within a foot. Some gauges don't publish one, and some publish only a rough guess. Without it, CrestWatch can't turn the gauge's readings into a water level to compare with your ground. Instead, here's what the gauge shows, with its official flood stage when one is published.",
  whyTitle: "No magic. Here's the math.",
  pageTitleWhy: "Why this verdict · CrestWatch",
  backToWatch: "← Back to the watch",
  chartLabel: (latest: string | null, high: string | null, flood: string | null) =>
    [
      "River stage chart, in feet on the gauge.",
      latest ? `Latest reading ${latest} ft.` : "No recent readings.",
      high ? `Forecast high ${high} ft.` : "No forecast.",
      flood ? `Flood stage ${flood} ft.` : null,
    ]
      .filter(Boolean)
      .join(" "),
  noGaugeHeadline: "CrestWatch can't watch this spot",

  // S5 · Replay
  replayTitle: "Replay a real flood",
  pageTitleReplay: "Replay a real flood · CrestWatch",
  replayResult: (pin: string, days: number) =>
    `Water above ${pin}: ${days} ${days === 1 ? "day" : "days"}`,
  replayEmpty:
    "Replay shows how a real past flood would have reached a place you save. Add a place, or try the example places.",
  replayNeverReached: (pin: string, ft: number) =>
    `The water never reached ${pin}. The highest it got was ${ft} ft below your spot.`,
  replayPlaceLabel: "Place",
  replayFloodLabel: "Flood",
  replayData: (gauge: string, site: string) => `Data: ${gauge} (USGS ${site}).`,
  replayWaterThatDay: (water: string, spot: string) =>
    `Water that day: ${water} ft · your spot: ${spot} ft`,
  replayTimeline: "Replay timeline",
  replaySliderValue: (date: string, water: string, pin: string, spot: string) =>
    `${date}. Water at ${water} ft. ${pin} sits at ${spot} ft.`,
  replayCrestLabel: "highest it got",
  replayPlay: "Play the flood",
  replayPause: "Pause",
  replayTooFar: (gauge: string, mi: number, pin: string) =>
    `This flood was on the ${gauge}, about ${mi} miles from ${pin}. Replay only compares places near that river gauge.`,
  replayFailed: "The flood records didn't load. Try again in a minute.",
  replayExampleCta: "Replay with the example places",
  replayExampleNote:
    "These are example places in Vicksburg, MS. Nothing was saved on this device.",

  // Verdict sentences (Appendix C). TEAM: hand-tune these.
  // Stand-ins when the gauge has no name. Templates already say "the".
  verdictGaugeFallback: "the nearest gauge",
  verdictRiverFallback: "river",
  verdictLikely: (river: string, day: string, time: string, pin: string, h: number) =>
    `The ${river} peaks ${day} around ${time}. Water likely reaches ${pin} about ${hours(h)} before that.`,
  verdictLikelyStale: (river: string, day: string, time: string, pin: string, h: number) =>
    `The last forecast had the ${river} peaking ${day} around ${time}. By that forecast, water likely reaches ${pin} about ${hours(h)} before that.`,
  verdictLikelyPastPeak: (river: string, pin: string) =>
    `The ${river} has peaked and is coming down, but ${pin} is likely still in the water today.`,
  verdictLikelyPastPeakNoHigher: (river: string, pin: string) =>
    `The forecast says the ${river} won't go any higher, but ${pin} is likely still in the water today.`,
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
  verdictUnlikelyRisingNow: (river: string, stage: string, pin: string, margin: string) =>
    `The ${river} is at ${stage} ft on the river gauge and still rising. Right now ${pin} stays dry by about ${margin} ft.`,
  verdictUnlikelyNoHigher: (river: string, stage: string, pin: string, margin: string) =>
    `The forecast says the ${river} won't go above ${stage} ft on the river gauge. ${pin} stays dry by about ${margin} ft.`,
  verdictUnlikelyStale: (river: string, day: string, stage: string, pin: string, margin: string) =>
    `The last forecast had the ${river} peaking ${day} at ${stage} ft on the river gauge. By that forecast, ${pin} stays dry by about ${margin} ft.`,
  verdictUnlikelyStaleReading: (river: string, stage: string, pin: string, margin: string) =>
    `The last reading had the ${river} at ${stage} ft on the river gauge. By that reading, ${pin} stays dry by about ${margin} ft.`,
  verdictCategory: (x: string, gauge: string, category: string) =>
    `The forecast crest is ${x} ft above flood stage at ${gauge}. The Weather Service calls that ${category} flooding for low areas nearby. CrestWatch doesn't know this gauge's height above sea level closely enough to do house-level math here. Treat low roads as wet.`,
  verdictCategoryNoMargin: (gauge: string, category: string) =>
    `The forecast crest reaches ${category} flooding at ${gauge}. CrestWatch doesn't know this gauge's height above sea level closely enough to do house-level math here. Treat low roads as wet.`,
  verdictCategoryAction: (gauge: string) =>
    `The forecast crest comes close to flood stage at ${gauge}. Keep an eye on it. CrestWatch doesn't know this gauge's height above sea level closely enough to do house-level math here.`,
  verdictCategoryUnknown: (gauge: string) =>
    `No flood stage is published for ${gauge}, so CrestWatch can't tell if this crest will flood anything. Check the official flood alerts at weather.gov.`,
  verdictCategoryNone: (gauge: string) =>
    `The forecast crest at ${gauge} stays below flood stage. Low areas near the river should stay passable.`,
  verdictLikelyPastPeakButRising: (river: string, pin: string) =>
    `The forecast says the ${river} has peaked, but the gauge still shows it rising right now. ${pin} is likely in the water today. Check back after the next forecast.`,
  verdictLikelyPastPeakButRisingStale: (river: string, pin: string) =>
    `The last forecast had the ${river} past its peak, but the gauge shows it still rising. ${pin} is likely in the water. Check back after the next forecast.`,
  verdictLikelyNow: (pin: string, river: string) =>
    `${pin} is in the water now, and the ${river} is still up. Stay off flooded roads and check back after the next forecast.`,
  verdictLikelyNowStale: (pin: string, river: string) =>
    `The gauge shows ${pin} in the water, and the ${river} is still up. Stay off flooded roads and check back after the next forecast.`,
  // LIKELY with no forecast crossing. These start with bandLikely's words.
  verdictLikelyWithinFoot: (pin: string) =>
    `Water likely reaches this spot. The forecast peak comes within a foot of ${pin}.`,
  verdictLikelyCheckBack:
    "Water likely reaches this spot. Check back after the next forecast.",
  verdictAlertOnly:
    "No forecast gauge watches this spot. CrestWatch works on rivers with gauges. For flash floods from sudden rain, your county alerts are the right tool.",
  staleness: (n: number) =>
    `Heads up: this data is ${age(n)} old. The river may have moved.`,

  // Band labels
  bandLikely: "Water likely reaches this spot.",
  bandBorderline: "Too close to call. The forecast can be off by this much.",
  bandUnlikely: (margin: string) => `This spot stays dry by about ${margin} ft.`,
  // CATEGORY place-card lines (no house-level math, so no band).
  statusCategoryAction: "close to flood stage at the nearest gauge",
  statusCategoryFlooding: (category: string) =>
    `${category} flooding forecast near the gauge`,
  statusCategoryUnknown: "no flood stage published at the nearest gauge",
  statusCategoryNone: "below flood stage at the nearest gauge",

  // About
  aboutPrivacy:
    "Your saved places live only in this browser. To look an address up, CrestWatch's server sends it to public map services: the US Census first, then OpenStreetMap (Nominatim) or Open-Meteo if the Census can't find it. Then it asks USGS and the Weather Service about that spot. Each time it checks, your browser sends your places to CrestWatch's server for that check. The server doesn't save them. It keeps lookups in short-term memory for up to a day so repeat checks are fast, and counts checks from each internet connection for an hour to stop abuse. A watch link you share has your places inside it. No accounts, no database, no tracking, no ads.",
  honesty:
    "CrestWatch predicts river flooding, the slow kind our district gets, with days of warning. It can't predict flash floods from sudden rain. Its numbers are estimates from public elevation data, not a survey of your property. When it's too close to call, it says so. It only checks the river while it's open, and it doesn't send alerts. Keep the emergency alerts on your phone turned on.",
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

  // S2 · Watch: failure states, honesty and next steps
  // (riverDataDown and brokenLink are defined once above, shared.)
  refreshFailed: (time: string) =>
    `Couldn't check the river just now. This is the answer from ${time}.`,
  chipCategoryUnknown: "flood stage unknown",
  chipCategoryNone: "below flood stage",
  chipCategoryAction: "near flood stage",
  chipCategoryMinor: "minor flooding",
  chipCategoryModerate: "moderate flooding",
  chipCategoryMajor: "major flooding",
  alertsCheckedChip: (time: string) => `alerts checked ${time}`,
  alertServiceDown:
    "CrestWatch couldn't reach the alert service just now. That is not an all-clear. Check weather.gov directly.",
  saveLinkedPins: "Save to this device",
  sharedLinkNote:
    "You're viewing a shared watch link. Nothing was saved on this device.",
  copyLink: "Copy watch link",
  linkCopied: "Link copied ✓",
  copyLinkPrompt: "Copy this link:",
  approximateShare: "This is the middle of a town or street, not this house.",
  shareFooter: (stamp: string) => `crestwatch · public federal data · ${stamp}`,
  stalenessUnknown:
    "Heads up: we can't tell how fresh this data is. The river may have moved.",
  // Kid-scale second line under the sentence. `gloss` comes from lib/kid-scale.
  glossGap: (ft: number, gloss: string) => `That ${ft} ft gap is ${gloss}.`,
  glossWater: (ft: number, gloss: string) =>
    `That could put about ${ft} ft of water here, ${gloss}.`,
  nextStepsTitle: "What to do now",
  nextSteps: [
    "Move cars, medicine, and important papers up high.",
    "Never drive or walk into water on a road. Turn around, don't drown.",
    "Follow the official alert and what local officials tell you.",
  ],
  nextStepsLinkNws: "National Weather Service, Jackson office",
  nextStepsLinkMsema: "Mississippi Emergency Management Agency",
  nextStepsLinkMdot: "Road conditions from MDOT, the state road department",
  // Glossary (Watch + Why). One or two sentences each, for a 12-year-old.
  glossarySummary: "What do these words mean?",
  glossary: [
    {
      term: "River gauge",
      text: "A measuring station in a river, often on a bridge. It checks the water every few minutes and shares the numbers with everyone.",
    },
    {
      term: "Stage",
      text: "How high the water reads on the gauge's measuring stick, in feet. It's counted up from the gauge's own zero mark, not from sea level or the river bottom.",
    },
    {
      term: "Gauge zero",
      text: "How high the gauge's 0 ft mark sits above sea level. Add the stage to it and you get how high the top of the water is.",
    },
    {
      term: "Height above sea level",
      text: "How high a spot sits compared to the ocean. CrestWatch measures your ground and the river this way, so the two can be compared.",
    },
    {
      term: "Flood stage",
      text: "The stage where the river starts to spill over its banks onto land nearby. The Weather Service sets this number for each gauge.",
    },
    {
      term: "Crest",
      text: "The highest the river gets before it starts going back down. The forecast crest is how high the Weather Service expects that peak to be.",
    },
    {
      term: "Forecast",
      text: "The Weather Service's best guess of what the river will do over the next few days. It can be off by a foot or more, so CrestWatch says when it's too close to call.",
    },
    {
      term: "Three kinds of answers",
      text: "A full answer (FULL) compares the water to how high your spot sits, and it's about your house only when CrestWatch found your full street address. If CrestWatch doesn't know a gauge's height above sea level closely enough, you get flood-stage only (CATEGORY), and if no forecast gauge is close, you get alerts only (ALERT-ONLY).",
    },
  ],

  // Package "actions": Read it to me, Send to family, Add the crest to my calendar.
  readAloud: "Read it to me",
  readAloudStop: "Stop",
  // How short forms in the sentence are said out loud ("12 ft", "12pm CT", "~").
  speechFeet: "feet",
  speechFoot: "foot",
  speechCentral: "Central time",
  speechAbout: "about",
  sendToFamily: "Send to family",
  sendToFamilyTitle: (pin: string) => `${pin} · CrestWatch`,
  addToCalendar: "Add the crest to my calendar",
  calendarSaved: "Calendar file saved ✓",
  calendarTitle: (river: string, pin: string) => `River crest: ${river} near ${pin}`,
  calendarTitleNoRiver: (pin: string) => `River crest near ${pin}`,
  // The file keeps one forecast; the river doesn't wait for it.
  calendarCheckLatest: (url: string) => `Forecasts change. Check the latest: ${url}`,
  calendarAlarm: "Check CrestWatch for the latest river forecast before the crest.",
} as const;
