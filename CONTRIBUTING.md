# Working on CrestWatch together

This is the guide for everyone on the CrestWatch team. Read it once before
your first change.

## Joining the team

The Congressional App Challenge allows up to 4 students per team, and at
least half must live in or go to school in the district. The repo owner
confirms that before adding anyone.

1. Make a free GitHub account if you don't have one, and send your GitHub
   username to the repo owner.
2. The owner adds you: **Settings → Collaborators → Add people** on
   https://github.com/shashankmadala/crestwatch. You'll get an email.
3. Accept the invite within 7 days. After that you can push branches and
   open pull requests.

## Setting up your computer

You need [Git](https://git-scm.com/downloads) and
[Node.js](https://nodejs.org/) 22 or newer.

```bash
git clone https://github.com/shashankmadala/crestwatch.git
cd crestwatch
npm ci
npm run dev
```

Open http://localhost:3000. No API keys or accounts are needed: every data
source is free and public.

Before you open a pull request, run the tests:

```bash
npm test
```

`npm run test:e2e` runs the slower browser tests (it builds the app first).

## Making a change

1. Start from the newest `main`:
   ```bash
   git switch main
   git pull
   git switch -c yourname/short-description
   ```
2. Make small commits with messages that say what changed, for example
   `Tune the verdict sentence for flooded roads`.
3. Push your branch and open a pull request on GitHub:
   ```bash
   git push -u origin yourname/short-description
   ```
4. GitHub runs the build and tests on your pull request. Ask a teammate to
   look it over.
5. The repo owner merges it with **Create a merge commit**. That keeps your
   commits in the history under your name. On Vercel's free plan only the
   owner's merge deploys the live site, so please don't push straight to
   `main`.

## Honest commits (contest rules)

The 2026 rules say automated "must not constitute the entirety of the technical
development" and that students must show real contributions. Judges can
ask for the code and look at the history. So:

- Commit from **your own** GitHub account, with your real name in Git:
  ```bash
  git config user.name "Your Name"
  git config user.email "the-email-on-your-github-account"
  ```
- Write your own commit messages.
- If an automated tool wrote code in a commit, put `` in the message and
  add a line to [docs/VALIDATION.md](docs/VALIDATION.md). If you wrote it
  yourself, don't tag it.
- Be ready to explain anything you commit, out loud, without notes.

## Where to start

These are the parts the team owns. Each one is real work a judge will ask
about:

| Task | Where |
|---|---|
| The validation pass: check 10 real addresses against NWS flood maps and 2019 photos | `docs/VALIDATION.md` |
| Decide the verdict thresholds (how close counts as "too close to call") | `BANDS` in `lib/config.ts` |
| Decide how precise a gauge's zero must be for house-level math | `MAX_GAUGE_ZERO_ACCURACY_FT` in `lib/config.ts` |
| Decide when a forecast bump counts as a crest | `MIN_RISE_FOR_PEAK_FT` in `lib/sentences.ts` |
| Read every verdict sentence and make it sound like you | `lib/copy.ts` |
| Check the 2019 numbers on the About page against a source | `app/about/page.tsx` |
| Put your names in | About page, `LICENSE`, `docs/DEMO_SCRIPT.md` |
| Film the demo video | `docs/DEMO_SCRIPT.md` |

## How the code is laid out

- `lib/copy.ts`: every word a visitor reads. Calm, short sentences a
  12-year-old can follow. No exclamation marks, no em dashes.
- `lib/config.ts`: the numbers the team owns.
- `lib/surveyor.ts`: the math. Gauge zero plus river stage gives the water's
  height above sea level, compared with the ground at an address.
- `lib/gauges.ts`, `lib/geo.ts`: fetching public data from USGS, NOAA and
  the Census.
- `components/`: the screens.
- `tests/` and `e2e/`: unit tests and browser tests.

Questions about the code? Open an issue on GitHub, or ask the team.
