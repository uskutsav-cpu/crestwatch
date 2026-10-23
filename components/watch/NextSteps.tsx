/**
 * "What to do now" (finding #80). Static and math-free: three calm lines
 * and the official places to look, shown only when there is something to
 * act on. It never replaces the verdict or the official alert.
 */

import { copy } from "@/lib/copy";
import type { PinWatch } from "@/lib/watch-service";

/** Checked to return 200 (MDOT's root redirects to its landing page). */
export const NEXT_STEP_LINKS = [
  { href: "https://www.weather.gov/jan/", label: copy.nextStepsLinkNws },
  { href: "https://www.msema.org/", label: copy.nextStepsLinkMsema },
  { href: "https://www.mdottraffic.com/", label: copy.nextStepsLinkMdot },
] as const;

/**
 * FULL: water likely or too close to call. CATEGORY: minor flooding or
 * worse. Any tier: an active flood alert.
 */
export function needsNextSteps(w: Pick<PinWatch, "verdict" | "alerts">): boolean {
  if (w.alerts.length > 0) return true;
  const v = w.verdict;
  if (v.tier === "FULL") return v.band === "LIKELY" || v.band === "BORDERLINE";
  if (v.tier === "CATEGORY") {
    return (
      v.category === "minor" ||
      v.category === "moderate" ||
      v.category === "major"
    );
  }
  return false;
}

export function NextSteps() {
  return (
    <section
      aria-labelledby="next-steps-title"
      className="rounded-2xl bg-surface p-5"
      data-testid="next-steps"
    >
      <h2 id="next-steps-title" className="text-body font-semibold">
        {copy.nextStepsTitle}
      </h2>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-body">
        {copy.nextSteps.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <ul className="mt-3 flex flex-col text-small">
        {NEXT_STEP_LINKS.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center font-semibold text-(--color-current)"
            >
              {l.label} →
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
