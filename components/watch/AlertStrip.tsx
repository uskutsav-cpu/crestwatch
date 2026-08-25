"use client";

/**
 * Active NWS flood watches/warnings as a strip (Appendix B3) — risewatch
 * background, official alert title + area. Additive context, never the
 * verdict itself.
 */

import type { FloodAlert } from "@/lib/alerts";

export function AlertStrip({ alerts }: { alerts: FloodAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {alerts.slice(0, 3).map((a, i) => (
        <div
          key={i}
          role="status"
          className="rounded-xl border border-risewatch/70 bg-risewatch/15 p-3 text-small"
        >
          <span className="font-semibold text-risewatch">{a.event}</span>
          {a.areaDesc ? (
            <span className="text-dim"> — {a.areaDesc}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
