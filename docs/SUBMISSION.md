# Submission kit + validation (Appendix H)

**Deadline: Monday, Oct 26, 2026, 12:00 pm EDT. Submit by Saturday,
Oct 24.** After the deadline the submission can't be changed in any way.

Lines marked **TEAM:** are things only the students can do or decide. Don't
submit while any of them is still open.

## Accuracy validation (do this before filming)

Pick 10 real addresses (5 near gauges in the Delta, 5 edge cases). For
each, compare the CrestWatch verdict against:

- NWS flood-inundation maps for the gauge, where published
- FEMA flood zones (msc.fema.gov)
- For the 2019 replay: news photos of known-flooded roads
  (Mississippi Today, MPB, Clarion-Ledger archives)

Record every comparison in `docs/VALIDATION.md`. Then decide the verdict
thresholds in `lib/config.ts` (`BANDS`): change them until the misses are
explainable, or write down why 0.5 ft and 3.5 ft stay. **This document is
your best answer to any skeptical judge.**

TEAM: do this pass yourselves and commit it under your own names, with no
`` tag and no automated co-author line. See `docs/VALIDATION.md` for why.

## Known quirks

Check these personally. Judges may ask about them.

- **Vicksburg's gauge zero is on NGVD29.** USGS lists gauge zero for the
  Mississippi at Vicksburg (07289000) as 46.22 ft on the old NGVD29 datum.
  Ground heights from USGS are on NAVD88. Around Vicksburg the two differ by
  under a foot, which is inside the "too close to call" band, but say so if
  asked. The same USGS page also lists a 73 ft Army Corps row; that is not
  gauge zero. Open the Why screen for a Vicksburg place and confirm the
  gauge zero it shows is 46.2 ft (the screen rounds USGS's 46.22).
- **The USGS elevation service can be slow.** The service that gives ground
  height (EPQS) sometimes fails at once and sometimes takes 15 to 30 seconds
  to answer. CrestWatch retries, and a new address can take up to about a
  minute. Before filming, and again before judging, look up the addresses
  you will show on the live site so they are already in the one-day memory.
  The live example on the home page doesn't need this service.
- **USGS is shutting down its legacy Water Services** (waterservices.usgs.gov)
  on a fixed schedule from its Sept 18, 2026 announcement:
  - Nov 16, 2026: every request gets 2 seconds slower
  - Jan 11, 2027: 10 seconds slower
  - Jan 25, 2027: 30 seconds slower
  - Jan 27, 2027: about a 24-hour outage
  - Feb 1, 2027: 60 seconds slower
  - Feb 15 to 17, 2027: about a 48-hour outage
  - **Feb 22, 2027: switched off for good**

  CrestWatch reads the same gauges from the newer USGS Water Data API as a
  fallback, and that API takes over as the main source as the legacy
  service slows down. Replay uses recorded USGS daily values for its three
  floods. The rules embargo results until Jan 15, 2027, so judges may well
  open the app after the slowdown starts. The new API is first from Jan 11,
  2027, and USGS limits anonymous use to "a few queries per hour", so get
  the free key (https://api.waterdata.usgs.gov/signup/) and set
  `USGS_API_KEY` in the Vercel project settings before then.
- **A gauge with no published flood stage** gets "flood stage unknown",
  never a green "below flood stage". A gauge whose gauge zero USGS lists
  as accurate only to worse than 1 ft (Greenville, Sarah, Lambert today)
  gives flood-stage answers instead of house-level math.
- The Redwood gauge (07288800) publishes gage height already referenced to
  NGVD29 elevation, so the replay treats stage as elevation directly.
  Confirm against the official gauge page.
- Big Black nr Bentonia's gauge zero is NGVD29, not NAVD88 (differs by
  under half a foot here, inside the BORDERLINE band, but say so if asked).
- Yazoo City (YZOM6) and the Sunflower gauges publish no gauge-zero
  elevation at all, so those areas run in CATEGORY tier by design.
- **Loose gauge zeros give flood-stage answers.** USGS also says how
  accurate each gauge zero is. When it is only known to within more than
  1 ft, CrestWatch treats it as missing and gives a flood-stage (CATEGORY)
  answer instead of house-level math. Today that is Greenville (GEEM6),
  Sarah (SARM6) and Lambert (LMGM6), so a Greenville address gets no
  house-level answer. The 1 ft limit is `MAX_GAUGE_ZERO_ACCURACY_FT` in
  `lib/config.ts`. TEAM: this number is yours to own. Check it during the
  validation pass and be ready to explain it.
- **Spec deviation:** the spec prefers the nearest gauge on the SAME
  waterbody "when resolvable". A pin's waterbody isn't resolvable from any
  keyless source (it would need NHD flowline queries), so CrestWatch uses
  straight distance and always names the chosen gauge on the Why screen.
  TEAM: during validation, check whether any test address gets a
  wrong-river gauge and note it in `docs/VALIDATION.md`.

## How address search works (and its limits)

Three tiers, best precision first. No database, no keys:

1. **US Census geocoder.** Authoritative street addresses. Its TIGER file
   stores address *ranges*, so some real houses are simply missing.
2. **Nominatim (OpenStreetMap).** A second street-level opinion, tried
   only when Census misses and only when the query really is a street
   address. If it finds only the street and not the house, the result is
   approximate. Volunteer-run: results are cached for a day and any
   failure falls through to tier 3.
3. **Open-Meteo place search.** The town inside the address
   ("1234 Main St, Yazoo City, MS" -> "Yazoo City"), or a bare town or ZIP.
   Always approximate.

An approximate result says so on the confirm card and the verdict screen.
That matters: the Vicksburg town center reads about 242 ft while a house on
Washington St reads about 193 ft. That is a 48 ft difference, easily the gap
between dry and underwater.

TEAM: during validation, note any test address that comes back approximate
and whether the answer was still useful.

## Checklist

### Eligibility and team

- [ ] Every member is in middle school or high school on Oct 26, 2026.
- [ ] Team of 4 or fewer. At least half the team lives or goes to school in
      the district you enter. Confirm the roster before registering.
- [ ] No teammate is on another 2026 entry (one app per person per year).
- [ ] TEAM: participant names: `________`, `________`, `________`,
      `________` (fill in; the same names go on /about, in the video and in
      `LICENSE`).

### Registration (congressionalappchallenge.us)

- [ ] Each member has: a personal email that is not a school account; home
      address with 9-digit ZIP, Congressional District and Member of
      Congress; school address with 9-digit ZIP, district and Member; a
      parent or guardian's name and email. A coding teacher or mentor is
      optional.
- [ ] One teammate creates the team profile and invites the others (up to
      three).
- [ ] Every member completes a personal profile and the eligibility quiz.
- [ ] The eligibility email arrives, so the team can open the application.

### Student work (see `docs/VALIDATION.md`)

- [ ] Validation pass done and committed by students (`docs/VALIDATION.md`).
- [ ] `BANDS` decision made and recorded by students.
- [ ] About page 2019 stats ("over half a million acres", "about six
      months") checked against Mississippi Today or MPB and given a source
      link.
- [ ] Team names added to /about (`app/about/page.tsx`) and `LICENSE`.
- [ ] Every teammate can explain gauge zero + stage vs ground height
      without notes.

### Video

- [ ] 1 to 3 minutes long (`docs/DEMO_SCRIPT.md`).
- [ ] Says each participant's name, the app name, the purpose in one clear
      sentence, the target audience, and the tools and coding languages
      used (including development tools).
- [ ] Shows the app working.
- [ ] Says that automated wrote the code.
- [ ] Consent from anyone filmed.
- [ ] Uploaded to YouTube or Vimeo and set to **public**.

### Written questions

TEAM: answer these in your own words. Don't paste automated-written answers.

1. What is the title of your app?
2. Explain the app's purpose. (The purpose sentence in `lib/config.ts` is
   the official one.)
3. What inspired you to create this app?
4. What technical/coding difficulty did you face in programming your app,
   and how did you address it? **Put the automated disclosure here:** development tools
   (the software provider) wrote essentially all of the code; say what you did
   yourselves.
5. What did you learn while participating in the CAC? What was your biggest
   takeaway?
6. What would you change about your app if you were to create a 2.0
   version?

### Before you press submit

- [ ] The repo is public with `README.md` and `docs/VALIDATION.md`. Judges
      may ask to see the app and the source code.
- [ ] All code was written after Oct 30, 2025 (the repo history starts
      Aug 25, 2026).
- [ ] The automated disclosure is in the written answers and the video, not only
      in the repo.
- [ ] Look up the demo addresses on the live site so they load fast.
- [ ] Regenerate `docs/screenshots`. The PNGs there are from Aug 28 and
      still show old privacy wording and out-of-state test alerts. On a
      computer that can run Playwright, run `npm run screenshots`, check
      every image, and commit all of `docs/screenshots/*.png`. Then link
      the folder from `README.md` again. If you can't, delete the folder
      before you submit, so judges don't see the old screens.
- [ ] Fix the GitHub repo description. It still says "Free federal data",
      which is wrong now that address search also uses OpenStreetMap and
      Open-Meteo, and the homepage link points at an old URL. After you
      have read it and agree, run:
      `gh repo edit shashankmadala/crestwatch --description "Will the water reach your house? One sentence, days early. Free public data, no keys, no accounts." --homepage https://crestwatch-kalamadalas-projects.vercel.app --add-topic congressional-app-challenge,flood,nextjs,usgs,noaa`
- [ ] Submitted by **Sat Oct 24** (deadline Mon Oct 26, 12:00 pm EDT).
      Nothing can be changed after the deadline.

### After the deadline

- [ ] Every team member completes the Exit Questionnaire **individually**
      (the link comes by email after the deadline).

## Human checklist (things the build agent can't do)

- Run the validation pass above; decide `BANDS`; own the math personally
- Pilot with 3 to 5 real families near the Yazoo or Pearl
- Add team names to /about and `LICENSE`
- Film, edit, submit
