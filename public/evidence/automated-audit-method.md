# CrestWatch automated browser audit

Published evidence: a user-supplied CSV, CrestWatch_NOAA_1000_Automated_Checks.csv, with its record-origin labels normalized. Summary preparation does not execute tests or independently certify the original runner. All 1,000 supplied records are marked PASS. One also carries a LOW-severity limitation.

## Scope and units
- Four gauges: VCKM6 (Vicksburg), GEEM6 (Greenville), YZOM6 (Yazoo City), JACM6 (Jackson).
- 250 check records per gauge: 240 impact-slider scenarios and 10 other behavior checks.
- 960 impact-slider scenarios in total; 40 other checks.
- One captured NOAA reference per gauge, reused across scenarios. Four reference captures in total, not 1,000 independently refreshed NOAA observations.
- Recorded execution period: October 25, 2026, 22:19:28.868–22:23:27.402 UTC (5:19–5:23 p.m. CDT).
- Every record identifies its automated provenance, human_participant_count=0 and study_submission=false. The audit did not open /test.

The published file includes the expected and recorded results, evidence references, captured text, reproduction steps where supplied, and per-record limitations. The website's lighter search index omits full captured text and some original columns; use the published CSV for the full detail. An evidence reference is an identifier supplied by the audit, not an independently hosted screenshot or trace.

## Finding and response
YZOM6-003 passed the limited clock/timezone check, while noting that the observation summary lacked a calendar date. The current app now formats observation and forecast issue labels with month, day, year, time and the America/Chicago timezone (CDT/CST as applicable). Invalid or missing timestamps stay unavailable. Separate regression tests exercise day/year transitions, missing timestamps and daylight-saving transitions. Original audit rows have not been relabeled, amended or described as a full rerun of this updated release.

## What this evidence supports
Recorded interface behavior and source comparisons under the audit's scenarios and capture times. It does not establish independent human task success, better understanding, faster use by residents, continuous accuracy, property inundation prediction, emergency readiness or NOAA endorsement. These records are related scenarios from four sessions, not independent participants. A 100% recorded pass rate does not establish complete test coverage.

Human comparison responses are collected separately at /test. Raw answers require scoring, including incorrect, assisted, skipped, timed-out and incomplete attempts. No human results are implied by this audit.

## Reproducible summary
The source repository includes scripts/prepare-automated-audit.py. Run it against the published CSV to regenerate docs/audit/summary.json and public/evidence/automated-audit-index.json. This derives counts and search records; it does not rerun the browser audit. Retain the source audit CSV and the runner/traces if they become available for independent reproduction.

SHA-256: 77a9b5323bec3300da90d0e821f49dce95f69250ec14290d9dfa7e96f111fd7b
