"use client";

/**
 * Active NWS flood watches/warnings as a strip (Appendix B3) — risewatch
 * background, official alert title + area. Additive context, never the
 * verdict itself.
 */

import type { FloodAlert } from "@/lib/alerts";

const alertKey = (a: FloodAlert) => `${a.event}|${a.areaDesc ?? ""}`;

/** The same warning (same event, same area) shows once, in first-seen order. */
export function dedupeAlerts(alerts: FloodAlert[]): FloodAlert[] {
  const seen = new Set<string>();
  return alerts.filter((a) => {
    const k = alertKey(a);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function AlertStrip({ alerts }: { alerts: FloodAlert[] }) {
  const shown = dedupeAlerts(alerts).slice(0, 3);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {shown.map((a) => (
        <div
          key={alertKey(a)}
          role="status"
          className="rounded-xl bg-risewatch/15 p-3 text-small"
        >
          <span className="font-semibold text-risewatch">{a.event}</span>
          {a.areaDesc ? (
            <span className="text-fg"> · {a.areaDesc}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
