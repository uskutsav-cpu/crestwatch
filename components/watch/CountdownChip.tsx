"use client";

/**
 * "water reaches {pin} in ~{h}h" — tabular numerals, re-ticks once a
 * minute (Appendix B4 animation #3).
 */

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";

export function CountdownChip({
  pinName,
  crossingIso,
}: {
  pinName: string;
  crossingIso: string;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hours = Math.max(0, Math.round((Date.parse(crossingIso) - nowMs) / 3_600_000));
  if (hours <= 0) return null;

  return (
    <span
      key={hours}
      className="animate-tick-fade tnum inline-flex items-center rounded-full border border-risewatch/60 px-3 py-1.5 text-small font-semibold text-risewatch"
    >
      {copy.countdown(pinName, hours)}
    </span>
  );
}
