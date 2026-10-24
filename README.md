# 🌊 CrestWatch

**CrestWatch turns the government's river forecasts, written for engineers,
into one plain sentence about your own house: when the water is coming, how
high, and whether it reaches your door, in a district that once stayed
flooded for six months while the forecasts sat unread.**

A Congressional App Challenge 2026 entry from Mississippi's Second
Congressional District.

**Live:** https://crestwatch-kalamadalas-projects.vercel.app

## Try it in one click

On the home page, tap **"Just looking? See a live example from Vicksburg →"**.
It opens two public spots in downtown Vicksburg, Levee Street and the river
museum, checked against today's real river data. Nothing is saved on your
device and you don't have to type an address.

## What you get

- **One sentence and one picture.** Whether the forecast crest reaches your
  spot, by about how much, and roughly when, over a side view of your ground
  and the river.
- **Your flood number.** The reading on your river gauge at which water
  reaches your ground, like "about 46.5 ft on the Mississippi River gauge at
  Vicksburg". When the news says "the river will crest at 48 ft", you can
  compare. A what-if slider tries other river levels and redraws the
  picture. Only for house-level (FULL) answers.
- **Past floods here.** The gauge's highest recorded crests, each measured
  against your ground: "if one of these crests came back today". Opens from
  one summary line.
- **Right now on our rivers.** The home page shows the Mississippi at
  Vicksburg and Greenville, the Yazoo at Yazoo City and the Pearl at
  Jackson before you type anything.
- **Pass it on.** Read it to me (your browser's own voice), Share (a
  picture), Send to family (your phone's share sheet), Copy watch link, and
  Add the crest to my calendar (a calendar file made in your browser, only
  while a fresh forecast crest is still ahead). Anything that leaves the
  screen carries the same warnings the screen shows.
- **Works when the signal drops.** The last answer stays in your browser for
  up to 12 hours and shows as an older answer, never as a live one.
- **Your places, the Why screen and Replay.** Up to five places on one
  board, every number traced to its source, and real past floods replayed
  against your places.

## Run it

No API keys, no database, no accounts. Clone it and run it.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and type a Mississippi address, or use the live
example.

One environment variable is **optional and never required**:
`USGS_API_KEY`, a free api.data.gov key that only raises the rate limits of
the USGS Water Data API. Without it the app calls that API without a key. When
it is set, the key is sent only to `api.waterdata.usgs.gov`. See
[.env.example](.env.example). Setting it on Vercel **before Jan 11, 2027** is
recommended: from that date the new API goes first, and USGS says anonymous
use is limited to "a few queries per hour", so busy days could fall back to
flood-stage answers without a key.

## How it works

1. **📍 Find your spot.** Your address becomes coordinates (see the three
   tiers below), and the coordinates become ground height above sea level
   (USGS Elevation Point Query Service).
2. **📡 Read the river.** CrestWatch picks a nearby river gauge that has an
   official crest forecast (NOAA National Water Prediction Service) and reads
   its latest levels and its gauge zero from USGS.
3. **📐 Compare.** Gauge zero plus the forecast stage gives the height of the
   water surface above sea level. CrestWatch subtracts that from your ground
   height.
4. **🗣 Say it plainly.** One sentence: does the forecast crest reach your
   spot, by how much, and roughly when. The Why screen shows every number and
   links to the official pages, so you can check the math.
5. **🔢 Turn it around.** Your ground height minus the gauge zero is your
   flood number: the river reading at which water reaches your ground. The
   same subtraction, run on each of the gauge's recorded crests (NOAA's
   historic crest list), gives Past floods here. Both need a gauge zero
   CrestWatch trusts, so a flood-stage (CATEGORY) answer shows neither. A
   town or street point gets a rough flood number in whole feet, labelled
   approximate.

If a gauge doesn't publish its gauge zero, CrestWatch can only say how the
forecast compares to flood stage (CATEGORY). The same happens when USGS
says a gauge zero is only known to within more than 1 ft
(`MAX_GAUGE_ZERO_ACCURACY_FT` in `lib/config.ts`, a number the team owns).
The Greenville, Sarah and Lambert gauges are like that today, so a place
checked against one of them gets a flood-stage answer, not house-level
math. If no forecast gauge is close, it shows only the Weather Service's
flood alerts (ALERT-ONLY).

### Address search: three tiers

1. **US Census geocoder.** Street addresses. A match here is house-level.
   The Census file stores address ranges, so some real houses are missing.
2. **OpenStreetMap Nominatim.** Tried only when the Census misses and the
   text looks like a street address. If it finds the house, the result is
   house-level. If it finds only the street, the result is approximate.
3. **Open-Meteo place search.** The town inside the address, or a bare town
   or ZIP code. Always approximate.

An approximate result is the middle of a town or a street, not your house,
and the app says so on the confirm card and the verdict screen. That matters
in a hilly town: the middle of Vicksburg and a house downtown can be tens of
feet apart in height, which is the whole gap between dry and flooded.

## Data sources

| What | Service | Run by |
|---|---|---|
| Address to coordinates (tier 1) | [Census Geocoder](https://geocoding.geo.census.gov/) | US Census Bureau |
| Address to coordinates (tier 2) | [Nominatim](https://nominatim.openstreetmap.org/) | OpenStreetMap Foundation. Data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL |
| Town or ZIP to coordinates (tier 3) | [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) | [Open-Meteo](https://open-meteo.com/), CC BY 4.0, based on GeoNames |
| Ground height | [Elevation Point Query Service](https://epqs.nationalmap.gov/) (3DEP) | USGS |
| Crest forecasts, flood stages, historic crests, the home page river levels | [National Water Prediction Service](https://water.noaa.gov/) | NOAA / National Weather Service |
| Gauge readings, gauge zero | [USGS Water Services](https://waterservices.usgs.gov/) (legacy) and the [USGS Water Data API](https://api.waterdata.usgs.gov/) | USGS |
| Flood watches and warnings | [api.weather.gov](https://www.weather.gov/documentation/services-web-api) | National Weather Service |
| Replay of past floods | USGS daily river levels | USGS |

USGS is shutting down the legacy Water Services. It adds a delay to every
call from Nov 16, 2026, has planned outages in early 2027, and switches off
for good on **Feb 22, 2027**. CrestWatch already reads the same gauges from
the newer USGS Water Data API: it is the fallback today and takes over as the
main source as the legacy service shuts down.

## Privacy

- Your saved places live only in your browser (localStorage). So does
  CrestWatch's last answer, kept to show for up to 12 hours if your signal
  drops. Deleting your places deletes it too.
- To look an address up, CrestWatch's server sends it to public map services:
  the US Census first, then OpenStreetMap Nominatim or Open-Meteo if the
  Census can't find it. Then it asks USGS and the Weather Service about that
  spot.
- Each time it checks (when a page opens, every 15 minutes while it stays
  open, and when you come back online), your browser sends your saved
  places (names, addresses and coordinates) to CrestWatch's server for that
  check. The server answers and doesn't save them.
- The server keeps lookups in short-term memory for up to a day so repeat
  checks are fast. It also counts requests per IP address for an hour, in
  memory, to stop one runaway client.
- A watch link you share carries your places (names and addresses) inside
  the link.
- No accounts, no database, no tracking, no ads.

## What it can't do

- It predicts slow river flooding with days of warning. It can't predict
  flash floods from sudden rain.
- Its numbers are estimates from public elevation data, not a survey of your
  property. When it's too close to call, it says so.
- It doesn't count levees or floodwalls. A place behind one can stay dry
  when the numbers say water would reach it, and a levee can also fail.
  Parts of Levee Street in the Vicksburg example sit behind the city's
  floodwall.
- It checks the river again every 15 minutes, but only while CrestWatch is
  open in a browser. Nothing runs in the background. It doesn't send alerts,
  so keep the emergency alerts on your phone turned on.

## Built with

- **Languages:** TypeScript (with React's JSX), CSS through Tailwind CSS
- **Framework and libraries:** Next.js 16, React 19, Tailwind CSS 4,
  html-to-image (the Share picture)
- **Testing and tooling:** Vitest, Playwright, ESLint, TypeScript, yaml (test
  cases)
- **Hosting:** Vercel (hobby plan)
- **automated:** development tools by the software provider wrote essentially all of the code, tests
  and docs in this repository. See [Disclosure](#disclosure).

## Scripts

- `npm run dev`: dev server
- `npm run build`: production build
- `npm test`: unit tests (Vitest)
- `npm run test:e2e`: end-to-end tests (Playwright, recorded fixtures)

## Deploy

1. Fork or clone this repo to your GitHub account.
2. [vercel.com](https://vercel.com) → Add New Project → import the repo.
   Framework auto-detects as Next.js. No environment variables are needed.
   You can add `USGS_API_KEY` if you have one.
3. Deploy. Every push to `main` redeploys production.

Monthly cost: $0 (Vercel hobby plan and free public data). Open-Meteo's free
tier is for non-commercial use, which this is.

## Disclosure

development tools (the software provider) wrote essentially all of the application code, tests
and docs in this repository. Commits it wrote are tagged ``,
except eight merge commits from Oct 23, 2026 titled "Merge branch 'cw/…'
into integration". development tools made those too, while it combined its work
packages. The product itself uses no automated: it is public data and arithmetic.
The student team still has to do and commit its own work before
submission. The full record and the list of that work is in
[docs/VALIDATION.md](docs/VALIDATION.md).

MIT licensed.

## Measured

- 818 unit tests in 37 files (Vitest), all passing on Oct 24, 2026.
- 45 end-to-end tests (Playwright). The 36 older ones passed on Oct 23,
  2026. The 9 in `e2e/features.spec.ts`, for this week's features, have
  not had their first run yet. `npm test` and `npm run test:e2e` rerun
  them.

No map library: the water scene and the stage chart are hand-drawn SVG. The
end-to-end tests run against recorded copies of the public data, so no
network is needed.
