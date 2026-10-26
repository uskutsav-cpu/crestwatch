# Submission answer drafts
Review against the actual portal's prompts and limits. These are factual project descriptions, not personal testimony. No student names, inspiration story, learning claims or contributions have been invented.

## App title
CrestWatch

## Short purpose (under 350 characters)
CrestWatch helps Mississippi residents interpret official river observations, forecasts and historical floods. It connects gauge readings with published impact thresholds, keeps source times visible, and explains why a river reading cannot determine flood safety at a home.

## Audience
Mississippi residents and community members who want understandable river information, plus students exploring historical flood records. The app is an interpretation tool, not an emergency alert service or a property inundation model.

## Technical challenge - project description for adaptation
A forecast can include future timestamps even when the forecast was issued long ago. A display that checks only those future timestamps can create false confidence. CrestWatch checks observation freshness separately from forecast issue time, limits forecast comparisons to future valid samples, and labels unavailable or older information. Tests cover threshold comparisons and failure paths. A second challenge is preserving missing ground elevation as unavailable through saving and sharing rather than turning it into a false zero. Students should state which parts they actually implemented, tested or independently understood, and disclose assistance.

## What makes the idea useful
Official sources provide authoritative information, but a resident may still need to connect a gauge value, forecast window and stage-specific local statement. CrestWatch puts these in one explorable view and lets people compare a hypothetical stage with the official forecast. Its historical replay explains recorded change over time. Whether this improves real-user understanding remains a question for the prepared pilot; no effectiveness claim is made yet.

## Version 2.0 (under 750 characters)
The next version would be guided by resident task testing and specialist feedback. Priorities include clearer explanations wherever users confuse observed, forecast and explored levels; improved accessibility; and a carefully validated approach to local context. Property-level inundation would require suitable terrain and hydraulic modeling, consistent vertical references, and independent validation. More nearby data alone would not justify a property safety prediction.

## Personal inspiration - student to write
[Describe the actual experience or question that motivated you. If you have no personal flood experience, do not invent one. Explain why the information problem interested you.]

## Learning and takeaway - student to write
[Name one thing you actually learned, a specific example and how your understanding changed. Include the assistance you used and what you independently verified.]

## Contributions and automated disclosure
Use OWNERSHIP_AND_REVIEW.md. The known history includes substantial automated coding assistance in the original implementation and the redesigned Sites edition, including interface work, debugging, tests and materials. The app does not use automated to create river forecasts. A general "used automated for help" statement is insufficient if it conceals substantial implementation assistance. Students must add all other tools/assistance and their genuine technical work. Do not claim compliance based solely on this draft.

## Evidence wording
Safe now: "The project includes automated tests and dated comparisons of four station records and 280 stored USGS daily means against official responses. Human testing is prepared and has not yet been conducted."

After real testing only: "In a convenience pilot with [N] consenting participants on [dates], [x/y] completed [task] unaided with a correct explanation. [Describe failures and limitations]. We changed [specific behavior] after observing [finding]."

Do not claim the app predicts flooding at a house, provides verified road closures, is endorsed by NOAA/USGS, or has proven resident benefit without matching evidence.

## Source and publication
Use the public Sites link and the source archive that matches that edition. The original GitHub/Vercel URLs may show an earlier version. Preserve the submitted code state, video and answers before the applicable deadline; the rules state submissions cannot be modified after the period ends.
