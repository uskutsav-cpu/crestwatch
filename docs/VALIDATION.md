# Verification and field-validation log

## Automated official-source agreement

Checked by automated source verification, not a student field study.
Date: 2026-10-25T17:33:18.201Z

The repeatable command `node scripts/verify-source-data.mjs` fetched NOAA/NWS station metadata for Vicksburg, Greenville, Yazoo City, and Jackson, then fetched the USGS daily means for each of the three stored historical records. All seven checks passed on this run. The 217 + 33 + 30 stored readings (280 total) matched the source by date and value, with no extra source dates. Full source URLs, checks, timestamp, and normalized record hashes are in `docs/DATA_CHECK.json` and the app's Evidence page.

These checks establish source-data agreement at a recorded time. They do not establish that a gauge represents a particular property, reconstruct flooding, prove prediction accuracy, or substitute for a hydrologist's review.

## Independent field study: not performed

Student names and actual contributions are deferred at the user's request. No resident study or expert endorsement is claimed. The field-test rows below remain unfilled until the work is actually performed.

| Public site | Why this gauge applies | Location precision | Datum compatibility | Levee/drainage context | Independent event-specific evidence | Disagreement and follow-up |
|---|---|---|---|---|---|---|
| | | | | | | |
| | | | | | | |
| | | | | | | |
| | | | | | | |
| | | | | | | |

Record known flooded and known dry public sites; use separate calibration and evaluation sites if any prediction model is introduced. FEMA zones provide context, not ground truth for a particular event. Never backfill this table with invented users, observations, or approvals.

## Usability study: not performed

Ask local residents to find a public place, explain gauge stage versus ground elevation, recognize an older forecast, and identify the official source of emergency instructions. Record actual completion, misunderstandings, and changes made. Do not claim a pilot until it happens.

## Thresholds and scope

The current UI does not use the inherited arithmetic bands as property-flood predictions. Official impact thresholds are displayed as NOAA/NWS notes at the gauge, clearly separated from hypothetical slider values. Any future property model requires verified waterway relationships, compatible vertical references, measured location accuracy, and independent validation.
