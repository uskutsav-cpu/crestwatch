# Submission kit + validation (Appendix H)

## Accuracy validation — DO THIS BEFORE FILMING

Pick 10 real addresses (5 near gauges in the Delta, 5 edge cases). For
each, compare the CrestWatch verdict against:

- NWS flood-inundation maps for the gauge, where published
- FEMA flood zones (msc.fema.gov)
- For the 2019 replay: news photos of known-flooded roads
  (Mississippi Today, MPB, Clarion-Ledger archives)

Record every comparison in `docs/VALIDATION.md`. Then hand-tune the
verdict thresholds in `lib/config.ts` (`BANDS`) until the misses are
explainable. **This document is your best answer to any skeptical judge.**

Known quirks to validate personally (found during the build):

- The Redwood gauge (07288800) publishes gage height already referenced
  to NGVD29 elevation — the replay treats stage as elevation directly.
  Confirm against the official gauge page.
- Big Black nr Bentonia's gauge zero is NGVD29, not NAVD88 (differs by
  under half a foot here — inside the BORDERLINE band, but say so if asked).
- Yazoo City (YZOM6) and the Sunflower gauges publish no gauge-zero
  elevation at all — those areas run in CATEGORY tier by design.

## Checklist

- [ ] Register at congressionalappchallenge.us for the correct district —
      **at least half the team must live or attend school in the district
      entered; confirm rosters before registering**
- [ ] Video ≤3:00, public YouTube; states names/app/purpose/audience/
      tools & languages; shows real functionality (`docs/DEMO_SCRIPT.md`)
- [ ] Written responses reuse the purpose sentence + About-page stats +
      the Surveyor explanation (gauge zero + stage vs your elevation)
- [ ] Re-verify the ⚠ story stats (2019 acreage/duration) against
      Mississippi Today / MPB coverage
- [ ] Repo public with README + docs/VALIDATION.md ✓ (already is)
- [ ] Consent for anyone filmed
- [ ] All code written after Oct 30, 2025 — fresh repo history is the proof ✓
- [ ] automated tools allowed with full disclosure; they cannot be the entire
      technical work — own the Surveyor thresholds and the validation pass
- [ ] **Deadline Mon Oct 26, 2026 12:00pm ET — submit by Fri Oct 24**

## Human checklist (things the build agent can't do)

- Run the validation pass above; hand-tune `BANDS`; own the math personally
- Pilot with 3–5 real families near the Yazoo or Pearl
- Add team names to /about
- Film, edit, submit
