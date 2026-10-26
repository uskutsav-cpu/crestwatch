# Run a useful pilot

Use https://crestwatch-river-guide.utsavsresearch.chatgpt.site/review for timing, observations, raw CSV and a descriptive report. Keep the facilitator page on your own screen; participants see only the app or official source. Paper or the blank CSV is a fallback. Do not import fabricated rows into the public tool.

## Setup and consent (2 minutes)
Recruit willing adults who resemble the intended audience; aim for 5-8 if feasible. If deadline time permits only fewer, report the exact count. Do not seek participants who are responding to a flood emergency. Participation is optional, with no penalty for stopping. Ask separately before recording; anonymous written notes are enough. Do not collect names, home addresses, health information or private emergency circumstances. Use public examples. Do not publish identifiable quotations without permission.

Read aloud: "We are testing CrestWatch, not you. Please say what you are looking for and what you think the numbers mean. You may stop whenever you want. We will keep anonymous task notes. This is an information tool, not emergency guidance. Is that okay?"

Assign a code P01, P02, etc. Record verbal consent in SESSION_SHEET.csv. Keep a consistent device/zoom/network and app version across a session. Record date, prior river-data familiarity (none/some/frequent), browser, device, interface order, observation time, forecast issue time if available, and interruptions. Never replace a failed observation with a successful retry under the same session record.

## Three timed tasks (about 6 minutes per interface)
For a comparison, P01/P03/P05 use CrestWatch first; P02/P04/P06 use the official NOAA page first. Both start at the Vicksburg gauge context. Use the same three prompts below, in the same order in each interface. Do not preload a selected threshold. The app task link starts at the timeline with no hypothetical level. Record all observations before discussing correct answers across interfaces. Repeating tasks causes learning; counterbalancing reduces but does not eliminate it.

Open the task page, let it load, read the prompt, then start the Review Lab timer. Loading after the participant navigates within a task remains part of task time. Stop at completion, give-up or 120 seconds. Record an unaided outcome before offering assistance. Use the same cap in both conditions. A feed interruption is a task obstacle, not evidence that a participant misunderstood; note it. If a feed prevents the task, record incomplete / not assessed and document why.

### Task 1 - observation
Read only: "Find the Mississippi River at Vicksburg. State its latest observed stage, the observation time, and whether that observation is recent."

Facilitator scoring: Correct requires the displayed observed value and unit, observation timestamp (including date if relevant), and a freshness judgment consistent with that timestamp. The time the page was opened is not the observation time. Partial = identifies the value but misses time or freshness. Incorrect = substitutes a forecast for an observation or confidently calls stale/unavailable data current. If no explanation was elicited, use not assessed.

### Task 2 - forecast
Read only: "Find Vicksburg's forecast high and official flood stage. Explain whether they establish that a particular home will stay dry."

Facilitator scoring: Correct identifies the actual displayed forecast high and flood stage, distinguishes a future forecast from an observed reading, and says these gauge values do not prove a home's flood safety. Partial = correct numbers but incomplete explanation. Incorrect = treats the gauge as a property all-clear or mixes incompatible elevation references. If a forecast is unavailable, acknowledging this and the property limitation is sensible, but mark not assessed for the missing numeric requirement and note the outage; do not invent a value.

### Task 3 - official impact
Read only: "Find the 36.5 ft Vicksburg impact statement. Explain whether the statement proves that a road is closed right now."

Facilitator scoring: Correct locates the note about the Long Lake Community / low road to Kings Island, recognizes that it describes a gauge-level threshold, and does not infer a current road closure from it. Actual current conditions and official instructions require a current source. Partial = finds the statement but gives an incomplete explanation. Incorrect = treats an explored threshold as today's forecast or asserts a current closure solely from the note.

## Record consistently
- Unaided: completes the requested lookup without navigation/content help.
- Assisted: completes after a hint, explanation or demonstration. Repeating the prompt verbatim is okay; pointing to an answer is help.
- Incomplete: cannot complete, gives up, reaches the time cap or a source failure prevents completion.
- Understanding is a separate field: correct / partial / incorrect / not assessed. A participant can navigate unaided and still misunderstand the result.
- Stop the timer before facilitator explanation. Note help and the participant's actual explanation without identifying detail. Export after every session. Browser data is not a server backup.

The report excludes repeated participant/interface/task groups in full. Keep the raw CSV. Use a documented new study for a retest; do not mix repeated attempts to improve the score. Counts of anonymous codes are not proof of unique real participants.

## Optional untimed exploration (3 minutes)
On CrestWatch, ask the participant to reset a hypothetical level, save a public landmark, find the original source, and open the February 2020 historical replay. Ask whether the replay is live, whether a daily mean equals an instantaneous crest, and whether a nearby gauge proves flooding at the saved place. Record qualitative observations separately; these are not part of the three-task comparison.

## Debrief (2 minutes)
Ask: "What was confusing? What would you use this for? What would you check before acting? What should change first?" Do not ask whether they liked your design before task testing. Have them identify the official emergency source themselves; clarify after recording.

## Interpret, fix, retest
Export both CSV and descriptive Markdown. For each task report numerator/denominator for correct unaided completion, assistance, incomplete tasks and unassessed explanations. Use medians of correct unaided timings only alongside all outcome counts. The paired time comparison includes only successful matches; it can hide people who could not complete a task, so never present it alone. A faster time does not establish better understanding or flood safety.

Prioritize: (1) false safety/current-closure beliefs; (2) inaccessible or failed tasks; (3) repeated navigation confusion; (4) cosmetic preferences. Preserve the original feedback, document each change and retest the affected prompt with new people where possible. Write "In this small convenience pilot..." and include failures, order effects, changing live data and facilitator involvement. If no sessions happen, say testing is prepared and not yet conducted.

## Matched outcomes before timing
The updated report begins with all matched participant/task pairs: both succeed, CrestWatch only succeeds, official pages only succeed, and neither succeeds. Success requires a correct explanation and unaided completion. Unassessed explanations and unmatched sessions remain explicitly identified. Review official-only and neither-success outcomes as carefully as favorable outcomes. Existing original CSV exports can be imported locally into /review; repeat attempts are retained in the raw rows and excluded as ambiguous from matched analysis. Record the participant's own explanation before facilitator interpretation. See the comparison folder for the completed interface walkthrough and the remaining evidence requirements.
