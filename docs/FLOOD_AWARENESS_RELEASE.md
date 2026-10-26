# Flood awareness release

## Delivered scope

- A gauge briefing combines the highest future official forecast sample, flood stage, first future threshold sample, original impact text, forecast issue time, actual cached fetch time, and next app-check time. It never labels that check time as NOAA's next issuance.
- Same-gauge comparisons use NWPS historical instantaneous crests. Old-datum and unspecified-datum entries are excluded. Daily means remain separately labeled in replay.
- The Jackson map preserves all 39,381 WGS84 vertices across 649 polygons in USGS's documented February 2020 flood boundary. It does not infer flooding at a property or create arbitrary stage scenarios. Other gauges explicitly report that no validated layer has been integrated. NWS Jackson’s map collection is linked separately. Its prototype stage viewers for Jackson, Vicksburg and Greenville are explicitly described as approximate and non-operational; they are not relabeled as validated operational layers.
- English and Spanish household checklists support local checkmarks and printing. Spanish river guidance and official Spanish CDC/NWS references are available. This is a Spanish guidance area, not a claim that every app page or official advisory has been translated. Independent bilingual usability review remains to do.
- Keyboard controls, existing screen-reader labels, reduced motion, high-contrast viewing, and non-color comparison labels support accessibility. A formal accessibility audit remains to do.
- Study v2 adds 1–5 confidence ratings to task completion, timing, explanations, help and failures. New nullable storage preserves earlier records; v1 clients remain compatible. Do not pool versions without reporting the interface/protocol change. Accuracy still requires independent rubric scoring. No human results have been generated.

## Browser push architecture

Browser users explicitly opt in, select one supported gauge and a tenth-foot threshold, and can queue a delivery test or unsubscribe. The browser service worker receives encrypted Web Push on the production origin. Registration crosses a restricted same-origin Vercel bridge to the existing Sites D1 service. Endpoint, browser encryption keys, threshold and delivery state are private; no names, emails, locations or study responses are needed. Watches expire after 90 days unless renewed.

A GitHub Actions workflow runs on a best-effort quarter-hour schedule with a read-only GitHub token. Separate Actions secrets hold VAPID private/public values and a 256-bit monitor credential. Source contains the public VAPID key and a SHA-256 monitor-token verifier only. The protected service never provides subscription lists publicly. Only known HTTPS push-provider hosts and bounded browser keys are accepted. The public bridge cannot call monitor/ack operations and forwards no cookies or authorization credentials.

The monitor fetches fresh feet-based NWPS forecasts once per selected gauge, ignores past samples and unknown/stale forecasts, and sends on a below-to-at-or-above transition. It rearms after a fresh forecast falls below the threshold. Failed sends are retried on later runs, expired push subscriptions are removed on 404/410, and logs contain counts only. Queue delivery tests are labeled test messages. The initial already-above state can produce a heads-up after subscribing.

This is supplementary awareness, not emergency-grade monitoring. GitHub scheduling, upstream feeds, browser vendors, OS settings and networks can delay or prevent delivery. Keep official emergency alerts enabled. Alerts are not property inundation predictions.

## Source references

- NOAA NWPS API: https://api.water.noaa.gov/about/api
- USGS Jackson map release: https://doi.org/10.5066/P90YKHP3
- NWS Jackson scenario maps: https://www.weather.gov/jan/riverfloodextents
- NWS flood preparation: https://www.weather.gov/safety/flood-before
- CDC flood preparation: https://www.cdc.gov/floods/safety/index.html
- Official Spanish CDC guidance: https://www.cdc.gov/floods/es/safety/como-prepararse-para-las-inundaciones.html
- Official Spanish NWS flood safety sheet: https://www.weather.gov/media/owlie/FLYER-Safety-Tips-FLOOD-spanish.pdf

To reproduce the map conversion, download `2020_Pearl_Flood_GIS2.zip` from the USGS data release and run `python3 scripts/import-jackson-map.py /path/to/archive.zip`. The conversion verifies WGS84 range, polygon type and hole assignment; its source shapefile SHA-256 is recorded in public/maps/PROVENANCE.md.
