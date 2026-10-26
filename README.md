# CrestWatch · Know your river

A Mississippi river field guide built from official NOAA/NWS and USGS data. This Sites edition redesigns the public CrestWatch project into a responsive application with real maps, station timelines, official local impact thresholds, saved places, and historical river records.

## Run

Node 22.13 or newer. Run `npm ci`, then `npm run dev`. The local app serves on http://127.0.0.1:5173.

- `npm run typecheck`: TypeScript check
- `npm test`: recorded-data unit tests and rendered safety tests
- `npm run build`: production Vinext / Cloudflare Worker build
- `node scripts/verify-source-data.mjs`: recheck official station metadata and stored historical readings against live sources; writes a dated report to `docs/DATA_CHECK.json`

The `.openai/hosting.json` file binds this checkout to its Sites project. Use the Sites workflow for publishing. There are no required API keys. A USGS API key can optionally increase the newer USGS API's rate limit.

## Current experience

- Live NOAA stage, trend, flood stage, forecast high, and timelines for Vicksburg, Greenville, Yazoo City, and Jackson.
- Interactive geographic map using Leaflet and OpenStreetMap tiles.
- Official NOAA impact notes tied to gauge-stage thresholds. The explorer distinguishes forecast data from hypothetical levels and supports searching for roads and neighborhoods.
- Search a Mississippi place, confirm or move the map marker, name the place, and save it in browser storage. Ground height is optional: a service outage produces an explicit unavailable value, not a blocked save or a fabricated zero. Keyboard coordinate inputs are available.
- Nearby river briefings, source links, estimated ground heights, official weather alerts, shareable links, and read-aloud support.
- Rename/remove saved places, with undo for removal.
- Historical daily readings for the 2019 Yazoo Backwater flood and 2020/2022 Pearl River floods, with playback, scrubbing, and a high-point jump.
- Explicit freshness, outage, datum, geocoding, and hydrological limitations.

## Scientific scope

The app does not predict property inundation. A nearby gauge is selected by distance; its waterway connection to a property is not verified. River stage and estimated ground height are presented separately. A pure arithmetic engine from the original app is retained and tested, but its historical labels are not used as property predictions in the new UI. The `/why` route explains these limitations.

The optional educational elevation comparison is gated on NAVD88, fresh forecast data, a usable gauge zero, and a non-approximate location. It remains a hypothetical elevation subtraction, not a flood model. New geocoded points are treated as approximate, including Census interpolated addresses.

Official impact notes describe thresholds near a gauge, not live road closures or a guarantee for any address. Daily historical means differ from instantaneous crests.

## Architecture

`components/experience/` contains the current application. Original UI components and their regression coverage are retained for provenance; the App Router routes render the redesigned experience. `lib/` retains the upstream adapters, parsers, caching, browser storage, and calculation core. `lib/impacts.ts` adds official threshold parsing. `lib/upstream-scope.ts` isolates request concurrency queues for the Worker runtime. Completed cache values are shared; pending I/O promises are not shared across requests.

The old `e2e/` scripts document the previous UI and are not a passing browser suite for this version. Browser verification of this version uses the actual rendered application, including 390px and 1440px layouts. See `docs/RELEASE_NOTES.md` for the checks actually performed.

## Privacy

Places are saved only in localStorage. Address text goes to Census and, if needed, Nominatim or Open-Meteo. Coordinates go through the server to USGS/NOAA. Map tile requests go directly to OpenStreetMap and disclose the viewed area. Hosting and source services may maintain operational logs. No app analytics, ad tracking or participant account is required. The self-guided comparison at `/test` stores anonymous task responses centrally in the Site’s private D1 database; it uses a seven-day session cookie for resume and withdrawal. See `docs/competition/SELF_GUIDED_STUDY.md`. Saved places remain browser-local. Shared watch links include place names, addresses, coordinates, and elevation estimates.

## Provenance and submission

Based on https://github.com/shashankmadala/crestwatch (MIT). automated tools contributed substantially to the original code and this redesign. The app itself uses no automated for forecasts. Student names and actual contributions must be supplied truthfully before competition submission. No field validation, resident study, or expert endorsement is claimed. See `docs/VALIDATION.md`, `docs/SUBMISSION.md`, and `docs/VALIDATION.md`.

## Current public edition and deployment

- App: https://crestwatch-river-guide.utsavsresearch.chatgpt.site
- Judge walkthrough: /project
- Self-guided comparison: /test
- Automated audit: /evidence#automated-audit

This source is the Vinext / Cloudflare Worker edition, including a D1 binding named `DB` and versioned Drizzle migrations. It is not a drop-in Next.js deployment for the older Vercel project. The existing Vercel URL does not automatically receive this edition. Use the supported Sites publishing workflow with the existing project, or provision a separate Worker and D1 environment with the migrations before deploying elsewhere. Never copy local `.wrangler` data, credentials or participant records into Git.

The supplied audit has 1,000 records marked PASS (960 slider scenarios and 40 other checks), four reused NOAA reference captures and zero human participants. Its original date-display limitation is preserved; the current shared timestamps include the full calendar date. See `docs/audit/README.md`.
