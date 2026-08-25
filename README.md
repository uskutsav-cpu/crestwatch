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

**Live:** https://crestwatch-kalamadalas-projects.vercel.app

Self-deploy in under 10 minutes — there is nothing to configure:

1. Fork or clone this repo to your GitHub account.
2. [vercel.com](https://vercel.com) → Add New Project → import the repo.
   Framework auto-detects as Next.js. **No environment variables. None.**
3. Deploy. Every push to `main` redeploys production automatically.

Total monthly cost: $0 (Vercel hobby + free federal APIs).

## Disclosure

automated-assisted build, fully disclosed — see [docs/VALIDATION.md](docs/VALIDATION.md).
The product itself uses no automated. MIT licensed.

## Measured

- Lighthouse (desktop, production build): **performance 100 · accessibility
  100 · best-practices 100** on both the setup shell and the Why screen.
- Total JS: ~155–170 KB gzip per page load — no map library; the water
  scene and the stage chart are hand-rolled SVG.
- 133 unit tests (Vitest) · 13 end-to-end tests (Playwright, recorded
  federal-API fixtures — no network needed).

Screenshots of every screen live in [docs/screenshots](docs/screenshots)
(regenerate with `npm run screenshots`).
