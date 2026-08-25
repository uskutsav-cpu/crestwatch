# 🌊 CrestWatch

**CrestWatch turns the government's river forecasts — written for engineers —
into one plain sentence about your own house: when the water is coming, how
high, and whether it reaches your door, in a district that once stayed
flooded for six months while the forecasts sat unread.**

A Congressional App Challenge 2026 entry.

## No API keys required

None. Zero. Every data source is a free, keyless federal API — USGS, NOAA,
Census. No database, no accounts, no env vars. Clone it, run it.

```bash
npm install
npm run dev
```

Open http://localhost:3000, type a Mississippi address, get a verdict.

## How it works

1. **📡 Read the gauges** — nearby river gauges with official NWS crest
   forecasts (NOAA NWPS + USGS Water Services).
2. **📐 Compare to your ground** — your address becomes coordinates
   (Census), coordinates become ground elevation (USGS EPQS), and the
   gauge's stage becomes water-surface elevation (gauge zero + stage).
3. **🗣 Say it plainly** — one sentence: does the forecast crest reach your
   spot, by how much, and roughly when.

Saved places live in your own browser's localStorage. Nothing about you
touches a server we control — we don't have one worth the name.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm test` — unit tests (Vitest)
- `npm run test:e2e` — end-to-end tests (Playwright, recorded fixtures)

## Deploy

One Vercel hobby project, no env vars. Full steps land here at T13.

## Disclosure

automated-assisted build, fully disclosed — see [docs/VALIDATION.md](docs/VALIDATION.md).
The product itself uses no automated. MIT licensed.
