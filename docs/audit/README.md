# Automated browser audit evidence

The original supplied CSV is public/evidence/CrestWatch_NOAA_1000_Automated_Checks.csv. Its original 1,000 PASS statuses and the LOW-severity date note are preserved. Run `python3 scripts/prepare-automated-audit.py` to derive summary.json and the lighter public search index. Derivation validates unique IDs and the declared zero-human/zero-study scope. It does not execute or independently reproduce the browser checks. Record identifiers do not substitute for separately available browser traces or screenshots.

The public evidence section is /evidence#automated-audit and is linked from /project. It separates 960 slider scenarios, 40 other checks, four reused NOAA source captures and zero human participants. The separate seven-source verification report remains separate and is not added to the audit count.

Date finding YZOM6-003: clock/timezone matched, calendar date missing. The shared timeLabel now emits month, day, year, clock and Central timezone for observation summaries, place records, saved-answer notices and forecast issue labels. Tests exercise invalid/missing values, Central day/year rollover and the duplicated autumn DST hour. The old browser audit is not presented as a rerun of this release.

Suggested submission wording:
“An automated browser audit recorded 1,000 passing checks across four river gauges, including 960 impact-slider scenarios, using one captured NOAA reference per gauge. A low-severity date-display finding led us to add full dated timestamps. This is software QA evidence; human understanding remains a separate evaluation.”

The audit does not establish usability improvement, continuous reliability, property inundation accuracy or official endorsement. Do not count software checks as people or study submissions. Do not include the unrelated CommonGarden dataset in CrestWatch evidence.
