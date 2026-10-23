# Demo video script (about 2:45; the rules allow 1 to 3 minutes)

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

Also say that automated wrote the code (2:20). The rules want automated use disclosed in
the submission materials, and the video is one of them.

## Shot list

| Time | Shot | Script and action |
|---|---|---|
| 0:00–0:15 | Talking head | "We're TEAM: `NAME 1`, `NAME 2`, `NAME 3`, `NAME 4`, and this is CrestWatch." Then the purpose sentence, word for word (below). |
| 0:15–0:35 | Talking head, or flood photos you have the right to use | Audience: "CrestWatch is for families in the Mississippi Delta and around Jackson who live near the Yazoo, the Pearl or the Mississippi, and want to know if a river flood will reach their house." Then the problem in your own words: the river forecasts are public, but they're written for engineers. TEAM: only use 2019 numbers you have checked (see `docs/SUBMISSION.md`). |
| 0:35–1:05 | Screen: home page | Show the line under the name: "Will the water reach your house? One sentence, days early." Tap "Just looking? See a live example from Vicksburg →". The Watch screen opens with the note "This is an example: two spots in Vicksburg, MS, checked against today's real river data. Nothing was saved on this device." Point at the chip, "stays dry", and read the verdict sentence on screen. It ends "Levee St stays dry by about `__` ft." Say: "The river is low this week, so that's today's real answer." |
| 1:05–1:30 | Screen | Tap "Why this verdict →". The page reads "No magic. Here's the math." Walk through it out loud, in your own words: the gauge's zero mark plus today's river stage gives how high the water is above sea level, and CrestWatch compares that with how high Levee St sits. Point at the links to the official USGS and NOAA pages. |
| 1:30–2:05 | Screen: Replay | Open Replay ("Replay a real flood"). Choose the 2019 Yazoo backwater flood and Levee St. If no place is saved, use the button that replays the example places. Drag the slider slowly to the highest point and let the water cover the marker. Read the result: "Water above Levee St: `__` days". |
| 2:05–2:20 | Screen: About page, "What it can't do" | Read two lines from it: "It can't predict flash floods from sudden rain." and "It only checks the river while it's open, and it doesn't send alerts." |
| 2:20–2:45 | Talking head, URL on screen | Tools and languages: "CrestWatch is written in TypeScript with Next.js, React and Tailwind CSS. It's tested with Vitest and Playwright and hosted on Vercel. The data comes from USGS, NOAA's National Weather Service and the Census, plus OpenStreetMap and Open-Meteo for address search. An automated coding tool, development tools by the software provider, wrote almost all of the code. The app itself uses no automated." Then TEAM: say in your own words what you did yourselves. Say only things that are true. End on the URL and "Check your own place →". |

## The purpose sentence, word for word

From `lib/config.ts` (also on /about):

> "CrestWatch turns the government's river forecasts, written for engineers, into one plain sentence about your own house: when the water is coming, how high, and whether it reaches your door, in a district that once stayed flooded for six months while the forecasts sat unread."

TEAM: it says "six months". Check that figure before you say it on camera.

## Before filming

- Film after the current fixes are merged and deployed. Open the Why
  screen for the example and check that the Vicksburg gauge zero reads
  46.22 ft (see Known quirks in `docs/SUBMISSION.md`).
- The live example doesn't need an address lookup, so it loads even when
  the USGS elevation service is slow. If you also show a typed address,
  look it up once on the live site beforehand so it loads fast.
- Levee Street and the river museum are public places, not anyone's home.
  Don't film a real family's address without their permission.
- Get consent from anyone who appears on camera.
- Keep it between 1 and 3 minutes. Upload to YouTube or Vimeo and set it to
  public.
