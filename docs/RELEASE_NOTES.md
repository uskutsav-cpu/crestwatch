# Animated historical replay

The Vercel edition restores a rising-water replay inspired by the original app. A responsive gauge illustration follows the selected USGS daily mean, with a synchronized chart view, timeline, previous/next controls, milestones, restart, and 1×/2×/4× playback. Playback pauses when the tab is hidden and respects reduced motion. The record completes in about 16 seconds at 1×. Missing observations remain gaps in the chart and are skipped in playback.

The scene illustrates gauge stage, not terrain or property inundation. Original daily readings, units, source links, and CSV downloads remain available. Home-page descriptions and replay copy were shortened, and the illustrative river has subtle current motion with reduced-motion support.

Validation: all 892 existing tests and the native Next.js production build passed. Browser checks covered all three events, exact high-point readings (100.19, 36.62, and 35.19 ft), chart switching, playback completion, and a 390px mobile layout without horizontal overflow.

---

# Vercel compatibility branch

The native Next.js production build and all 892 tests pass. The existing private study service remains the persistence backend. A local six-task integration check verified saves, retries, validation, response isolation, resume and withdrawal through the bridge; its software QA records were removed. A Suspense boundary allows historical replay query parameters to prerender under Next.js. See `docs/VERCEL_DEPLOYMENT.md` for the backend dependency. Vercel deployment is a separate authenticated operation and is not established merely by this source commit.

---

# Complete GitHub synchronization

This update synchronizes the public Sites edition at https://crestwatch-river-guide.utsavsresearch.chatgpt.site with GitHub. It includes the redesigned river dashboard, impact explorer, saved places, historical replay, judge walkthrough, self-guided comparison with private D1 collection, the supplied 1,000-record automated audit browser/download and the full-date timestamp fix.

The app source matches Sites commit `2ce679fd7f7b34432562c336d8dc5f1885836b76`; this synchronization additionally updates README deployment/privacy guidance, automated disclosure and CI. The architecture is Vinext / Cloudflare Workers with D1, not the original Vercel Next.js deployment. Read README before changing production hosting.

Validation on this GitHub copy: 887 tests passed, TypeScript passed and the production build passed. The same app source was built and browser-verified on the public Site, including the audit filters/download and dated observations on all four gauges. Automated audit records remain distinct from human study results. No credentials, local database state or private participant responses are included.

---

# CrestWatch Sites edition · October 25, 2026

## Delivered product

A visual design in midnight, electric blue, and ice with a simple top navigation, an original illustrative river landscape, larger live map and readings, responsive mobile charts, map-based place confirmation, live official station timelines, searchable NWS impact thresholds, saved place briefings, and a historical river explorer. Current app routes are implemented by `components/experience`.

## Accuracy and trust changes

- Removes the unsupported “stays dry” property verdict from current user flows.
- Separates river stage from estimated ground height and rejects assumed datum conversions in the educational comparison.
- Treats address matches as approximate, with an adjustable map pin and keyboard coordinate entry.
- Presents NOAA's own stage-specific local impact statements. Hypothetical stages are explicitly distinguished from the official forecast high.
- Uses historical gauge records without inventing days of inundation at a property.
- Explains source freshness, unavailable alerts, background-monitoring limits, privacy, and remaining validation gaps.
- Isolates network concurrency waiters by request for Cloudflare Workers.
- Preserves calendar dates in historical chart labels.

## Verification record

TypeScript check and 836 tests in 41 files passed after the impact explorer and request-isolation changes. Tests include live-briefing safety claims, stale data, malformed shared links, impact threshold parsing, request isolation, and retained adapters/core regression cases.

Browser QA verified live NOAA readings and timeline, visible OpenStreetMap tiles, historical event switching and high-point jump, rendered 390px mobile and 1440px desktop compositions, mobile navigation, public-place lookup, map confirmation, local save and live briefing, and hypothetical impact search for Levee Street at 54 ft. Subsequent refinements are verified before final packaging; final check output accompanies the delivery.

No independent field validation, resident usability study, or hydrologist endorsement is claimed. The previous UI's Playwright scripts have not been claimed as passing for this redesigned UI. Deployment verification is recorded by the Sites publication response.

## Second pass: source evidence and graceful missing data

- Ground elevation is optional in the saved-place schema. A service outage no longer blocks saving a location or reading its nearby river context. Missing height is represented as null through persistence, share links, API input, and rendering, never as zero.
- The deterministic calculation engine falls back to gauge-category context when ground height is missing; educational comparisons stay hidden.
- Coordinate edits outside supported bounds are rejected before saving; cancellation does not save a fallback location.
- Seven live official-source checks passed on October 25, 2026: four NOAA/NWS station records and all 280 stored USGS daily means across the three historical floods. The dated report, official URLs, and replay hashes are published on the Evidence page and can be regenerated by the included script. This is source integrity, not property flood validation.
- Current interface and new helper source have been formatted for review.
- TypeScript and 836 tests in 41 files passed before final packaging.
- Browser QA confirmed that a shared place with null elevation loads the live river briefing and can be saved without inventing a ground height.

## Visual edition

Replaced the fixed sidebar and small green field-guide styling with a simpler top navigation and larger typography. The opening river landscape is explicitly illustrative; the live map retains real OpenStreetMap geography. Official thresholds use warm orange, while station selections and observed timelines use blue. Phone charts redraw on a narrower coordinate system so labels remain readable. Reduced-motion preferences disable decorative transitions and smooth scrolling. Browser review covered 320px, 390px, 765px, and 1440px widths, live station selection, mobile navigation, public-place search confirmation, and the historical high-point control.

## Competition-strengthening pass

- The home page now names its Mississippi scope and explains the product directly. A real selected-station reading, source, freshness state, and observation time appear in the hero.
- The impact workbench compares observed, official forecast-high, and explored gauge levels on a common scale. Published threshold buttons, road/landmark search results, and the range control update a hypothetical reference line on the station timeline. Reset removes the reference and returns to the current forecast.
- Current threshold comparisons require a recent issue time, discard expired or invalid samples, and report the first future sample at or above a threshold without interpolating local flood onset. Unavailable and older forecasts cannot supply a current comparison.
- Exploration links preserve a supported station and numeric level. The address tracks changes and reset. Opening a threshold link scrolls to the workbench after live data arrives. Place-briefing timeline links preserve the original place link.
- Live station detail now refreshes alongside the 15-minute river summary; freshness is reevaluated every minute while the page is open.
- The Project page provides a hands-on walkthrough, scope, architecture decisions, source evidence, honest automated disclosure, and an explicit boundary around missing human validation.
- A downloadable resident/specialist review kit and a proposed competition recording script are included. Neither is represented as completed testing or a submitted video.

Verification: TypeScript and 842 tests in 42 files passed, including six new tests of temporal forecast/threshold behavior. Browser QA verified desktop, 390px, and 320px layouts; direct threshold-link restoration and scrolling; Levee Street search and 54 ft selection; forecast chart reference; sharing; reset and URL state; station changes; the same workbench in place briefings; and the project walkthrough. Publication is verified separately by the Sites deployment response.

A production-only client routing failure was caught during final verification. Current routes now use ordinary document links, and saving a place uses document navigation after persistence, so navigation does not depend on the hosted runtime's RSC transition transport. The initial production check caught this before handoff; the corrected publication is checked through actual link clicks.

## Inspectable data and real usability evidence

- Live station and place charts now support tapping a plotted sample, a keyboard-accessible inspection slider, and CSV export of the plotted values. Exports retain gauge identity, original timestamps, observed/forecast labels, units, and forecast issue times. The artificial 100-point forecast cap was removed so the chart and export retain the complete returned forecast series.
- Historical replay now has previous/next-reading controls, first/highest/last daily-mean milestones, slower playback, source-record CSV download, and explicit record completeness. Missing daily dates break the plotted line and fill instead of visually connecting across the gap. Counts describe recorded readings rather than presumed uninterrupted days.
- A facilitator-only Review Lab is linked from the Project page. It records anonymous-code task observations, monotonic elapsed time, interface condition, unaided/assisted/incomplete completion, and separately assessed understanding. Records remain browser-local and can be exported, removed, or restored with Undo. No outcomes are prefilled, auto-scored, or published as resident testing. The protocol explains counterbalancing and small-sample limits.
- User-entered CSV text is quoted and formula-prefixed content is neutralized. Corrupt or invalid stored review records are rejected. The lab stops accepting new observations at its cap rather than silently discarding older evidence.
- While an optional ground-height lookup is pending, users can explicitly continue to their river briefing without it. Cancellation still saves nothing. Coordinates, map adjustment, and the place name are locked while a save is in progress.

Verification: 857 tests in 45 files and TypeScript passed. New tests cover review-record validation and CSV formula handling, daily-record gaps/counts, and explicit skip versus cancellation of ground lookup. Browser QA verified keyboard and pointer inspection, 184-row chart export with gauge/series/issue metadata, review timing and assisted/partial outcome export, removal of the QA-only observation, historical milestone navigation, 390px/320px layouts, and skipping elevation to a saved briefing with unavailable height. QA records and places were removed after verification. No resident study or specialist review is claimed.

## River journal visual redesign

Replaced the blue glow presentation with a warm paper, forest green and terracotta palette. Instrument Serif display type pairs with Manrope body type. An original SVG river study adds field patterns, tributaries and cartographic annotation, explicitly labeled as illustration rather than a flood map. The homepage uses a split composition on desktop and a stacked, readable layout on phones. Navigation, river station readings, charts, replay tabs and project pages share the updated visual system. All source and forecast limitations remain visible.

Verified desktop rendering and mobile layouts at 390px and 320px, including the native navigation menu and chart colors. TypeScript validation passes.

## Competition preparation and study reporting

Added a six-page printable facilitator packet, neutral task prompts, anchored scoring, blank session/observation sheets, a 2:45 demo plan, submission answer drafts, and genuine-contribution/automated-disclosure worksheets. These materials record no human-study results and do not constitute a completed video or submission.

Corrected study starting links so participants are no longer handed a preselected threshold answer. The Review Lab now exports a descriptive report alongside raw observations. Reports separate completion from understanding, exclude ambiguous duplicate participant/interface/task attempts in full, restrict successful timing medians to correct unaided attempts, and report matched differences only with stated limitations. Downloads are available directly from /review.

Verified report logic with focused tests and browser export QA, including an assisted/partial practice attempt removed after checking. PDF rendered and reviewed across all six pages. Official 2026 rulebook checked October 25: public 1-3 minute video, full automated disclosure, significant student contributions and technical understanding; national listed deadline October 26 at noon EDT / 11 a.m. Central. Students must confirm the actual portal/district requirements and supply their genuine details.

## Field guide interface refinement

Added four homepage section shortcuts, stronger reading typography, a more compact desktop hero, and a three-card visual archive built from the actual stored USGS daily readings. Archive previews preserve date gaps, explain independent scales, and link to the exact replay through validated event URLs. The map now offers an All gauges overview control. Saved places has an original landscape illustration and clearer touch targets.

Live timeline charts now offer Full context and Reading detail scales. Full context retains the official flood threshold; Reading detail keeps all plotted readings and any explored reference in view and explicitly labels an off-screen flood threshold. Switching scales never changes the source readings or exported data. Focus is reset on gauge changes. Added regression tests for range behavior and supported historical links.

Unified comparison-bar colors, improved mobile link labels, and retained reduced-motion behavior, source attribution, forecast freshness indicators and property-level limitations. Desktop and 320px layouts reviewed in the browser; archive-to-2022 navigation, chart scale/reset and map overview exercised.

Tablet review additionally exposed chart labels shrinking inside the two-column briefing. Charts now measure their actual container with ResizeObserver and switch to a readable narrow view even on larger screens. Decorative illustration callouts hide before they can be cropped on narrow split layouts.

## Matched understanding comparison

Inspected CrestWatch and NOAA's Vicksburg interface directly and documented observed differences, baseline advantages and the distinction between interface inspection and human evidence. No participant observations were supplied or found in the task workspace; a connected Drive search for CrestWatch returned no files. This does not establish that no observations exist elsewhere.

The Review Lab's descriptive report now starts with all matched participant/task outcomes, including official-only success and neither-interface success. It exposes partial/incorrect explanations, unassessed pairs, unpaired codes, duplicate exclusions and six-observation session coverage. Successful-only timing is secondary. Added validated browser-local CSV import for original exports from multiple sessions/devices; malformed files are rejected atomically, and repeated observations are not silently overwritten or selected for favorable results.

Verified opposite-direction outcomes and incomplete attempts with clearly labeled synthetic software fixtures in the local browser, then removed the fixtures. Those records are not included in human evidence or downloadable materials. Actual participant responses are still required before claiming improved understanding.
