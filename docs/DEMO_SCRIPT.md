# Demo video script (about 2:50; the rules allow 1 to 3 minutes)

This script is built for what you can film this week. The rivers are low
right now (the Mississippi at Vicksburg read about 15 ft on its gauge on
Oct 23), so the live answers will say the places stay dry. That's the honest
answer, so film it as it is. The flood drama comes from Replay.

Text in "quotes" is copied from `lib/copy.ts` and appears on screen exactly
like that. A `__` is a number to read off the screen on filming day. Never
script a number in advance.

## What the rules say the video must include

| Required | Where it is in this script |
|---|---|
| The name of each participant | 0:00 |
| The name of the app | 0:00 |
| The purpose, in one clear sentence | 0:00 |
| The target audience | 0:15 |
| The tools and coding languages used | 2:20 |
| The app working | 0:35 to 2:20 |

The tools line moved to 2:20 to make room for the flood number beat
(1:05). Keep each beat short; the whole video must stay under 3:00.

Also say that automated wrote the code (2:20). The rules want automated use disclosed in
the submission materials, and the video is one of them.

## Shot list

| Time | Shot | Script and action |
|---|---|---|
| 0:00–0:15 | Talking head | "We're TEAM: `NAME 1`, `NAME 2`, `NAME 3`, `NAME 4`, and this is CrestWatch." Then the purpose sentence, word for word (below). |
| 0:15–0:35 | Talking head, or flood photos you have the right to use | Audience: "CrestWatch is for families in the Mississippi Delta and around Jackson who live near the Yazoo, the Pearl or the Mississippi, and want to know if a river flood will reach their house." Then the problem in your own words: the river forecasts are public, but they're written for engineers. TEAM: only use 2019 numbers you have checked (see `docs/SUBMISSION.md`). |
| 0:35–1:05 | Screen: home page | Show the line under the name: "Will the water reach your house? One sentence, days early." Tap "Just looking? See a live example from Vicksburg →". The Watch screen opens. Near the bottom of the page is the note "This is an example: two spots in Vicksburg, MS, checked against today's real river data. Parts of Levee St sit behind Vicksburg's floodwall, which CrestWatch doesn't count. Nothing was saved on this device." Point at the chip, "stays dry", and read the verdict sentence on screen. It ends "Levee St stays dry by about `__` ft." Say: "The river is low this week, so that's today's real answer." |
| 1:05–1:35 | Screen: Watch, the "Your flood number" card | Read the card: "Your flood number" "about `__` ft on the Mississippi River gauge at Vicksburg." Say in your own words: when the news gives a crest number for Vicksburg, this is the number to compare it with. Under "Try a river level", drag the slider to the "highest crest" mark. The dashed line in the picture is now labelled "what if". Read the line under the slider: "If the river reaches `__` ft on the gauge, water would be about `__` ft deep at Levee St." Tap "Back to the forecast". Then tap the "Past floods here" line and point at the row for the 2011 crest, "about `__` ft of water here". Read the line under the list: "Levees, floodwalls and the river itself have changed since many of these floods, and CrestWatch doesn't count levees or floodwalls. Treat this as a rough guide." |
| 1:35–1:50 | Screen | Tap "Why this verdict →". The page reads "No magic. Here's the math." Walk through it out loud, in your own words: the gauge's zero mark plus today's river stage gives how high the water is above sea level, and CrestWatch compares that with how high Levee St sits. Point at the links to the official USGS and NOAA pages. |
| 1:50–2:10 | Screen: Replay | Open Replay ("Replay a real flood"). Choose the 2019 Yazoo backwater flood and Levee St. If no place is saved, use the button that replays the example places. Drag the slider slowly to the highest point and let the water cover the marker. Read the result: "Water above Levee St: `__` days". |
| 2:10–2:20 | Screen: About page, "What it can't do" | Read two lines from it: "It can't predict flash floods from sudden rain." and "CrestWatch doesn't count levees or floodwalls." |
| 2:20–2:45 | Talking head, URL on screen | Tools and languages: "CrestWatch is written in TypeScript with Next.js, React and Tailwind CSS. It's tested with Vitest and Playwright and hosted on Vercel. The data comes from USGS, NOAA's National Weather Service and the Census, plus OpenStreetMap and Open-Meteo for address search. An automated coding tool, development tools by the software provider, wrote almost all of the code. The app itself uses no automated." Then TEAM: say in your own words what you did yourselves. Say only things that are true. End on the URL and "Check your own place →". |

## The purpose sentence, word for word

From `lib/config.ts` (also on /about):

> "CrestWatch turns the government's river forecasts, written for engineers, into one plain sentence about your own house: when the water is coming, how high, and whether it reaches your door, in a district that once stayed flooded for six months while the forecasts sat unread."

TEAM: it says "six months". Check that figure before you say it on camera.

## Before filming

- Film after the current fixes are merged and deployed. Open the Why
  screen for the example and check that the Vicksburg gauge zero reads
  46.2 ft, USGS's 46.22 rounded (see Known quirks in `docs/SUBMISSION.md`).
- Open the live example once and check that "Your flood number" and
  "Past floods here" show under the sentence. They need Vicksburg's gauge
  zero. If either is missing that day, skip the 1:05 beat rather than
  explain it. Read the 2011 row's numbers off the screen. NOAA's crest
  list, not this script, decides which crests appear.
- The live example doesn't need an address lookup, so it loads even when
  the USGS elevation service is slow. If you also show a typed address,
  look it up once on the live site beforehand so it loads fast.
- Levee Street and the river museum are public places, not anyone's home.
  Don't film a real family's address without their permission.
- Get consent from anyone who appears on camera.
- Keep it between 1 and 3 minutes. Upload to YouTube or Vimeo and set it to
  public.
