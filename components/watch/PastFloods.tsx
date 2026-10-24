/**
 * "Past floods here" (package history): the gauge's biggest crests, each
 * measured against this place's ground, under one summary line. No state
 * and no hooks. Compact mode is a native <details>, so it opens with no
 * client JS. The math lives in lib/flood-history.ts, the words in
 * lib/copy.ts.
 *
 * Renders nothing without a trusted gauge zero or a usable crest. Pass
 * gaugeZeroFt only for a FULL verdict: a CATEGORY gauge's zero failed
 * the Surveyor's checks.
 */

import { copy } from "@/lib/copy";
import { pastFloods, type PastFloodRow } from "@/lib/flood-history";
import type { HistoricCrest } from "@/lib/gauges";

export interface PastFloodsProps {
  pinName: string;
  /** Town or street point: shows the approximate tag and says "this spot". */
  approximate?: boolean;
  pinElevationFt: number;
  /** verdict.tier === "FULL" ? gauge.gaugeZeroFt : null */
  gaugeZeroFt: number | null;
  gaugeName: string;
  historicCrests: HistoricCrest[];
  /** gauge.categories.minor: a "most recent big one" must reach it. */
  floodStageFt?: number | null;
  /** ISO "now" for the last-15-years rule. Defaults to the clock. */
  now?: string | null;
  /**
   * Just the summary line as a <summary>; the list opens under it.
   * Default false: a full card with a heading and the list showing.
   */
  compact?: boolean;
}

function Row({ row }: { row: PastFloodRow }) {
  return (
    <li
      className="flex items-start gap-3 border-t border-line py-3 first:border-t-0"
      data-testid="past-flood-row"
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
          row.reached ? "bg-(--color-current)" : "ring-1 ring-inset ring-dim"
        }`}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-semibold">{row.monthYear}</span>
          <span className="tnum text-small text-dim">{row.stageLabel}</span>
        </p>
        {/* Only a clear miss is quiet: a close call keeps full contrast. */}
        <p
          className={`text-small ${
            row.reached ? "font-semibold" : row.outcome === "tooClose" ? "" : "text-dim"
          }`}
        >
          {row.atPin}
        </p>
        {row.recent && <p className="text-small text-dim">{copy.pastFloodsRecent}</p>}
      </div>
    </li>
  );
}

export function PastFloods({
  pinName,
  approximate = false,
  pinElevationFt,
  gaugeZeroFt,
  gaugeName,
  historicCrests,
  floodStageFt,
  now,
  compact = false,
}: PastFloodsProps) {
  const data = pastFloods({
    pinName,
    approximate,
    pinElevationFt,
    gaugeZeroFt,
    historicCrests,
    floodStageFt,
    now: now ?? new Date().toISOString(),
  });
  if (!data) return null;

  const gauge = gaugeName.trim() || copy.verdictGaugeFallback;

  const tag = approximate ? (
    <span className="inline-flex items-center rounded-full bg-risewatch/10 px-2.5 py-1 text-small font-semibold text-risewatch">
      {copy.approximateTag}
    </span>
  ) : null;

  const list = (
    <>
      <p className="text-small text-dim">
        {approximate ? copy.pastFloodsIntroSpot : copy.pastFloodsIntro}
      </p>
      <ul className="mt-1 flex flex-col">
        {data.rows.map((r) => (
          <Row key={`${r.time}-${r.recent}`} row={r} />
        ))}
      </ul>
      {data.leftOutNote && (
        <p className="mt-2 text-small text-dim">{data.leftOutNote}</p>
      )}
      <p className="mt-3 text-small">{copy.pastFloodsCaveat}</p>
      <p className="mt-2 text-small text-dim [overflow-wrap:anywhere]">
        {copy.pastFloodsSource(gauge)}
      </p>
    </>
  );

  if (compact) {
    return (
      <details className="group rounded-2xl bg-surface" data-testid="past-floods">
        <summary className="block cursor-pointer list-none rounded-2xl p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg [&::-webkit-details-marker]:hidden">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-small font-semibold text-dim">{copy.pastFloodsTitle}</span>
            {tag}
          </span>
          <span
            className="mt-1 block font-semibold [overflow-wrap:anywhere]"
            data-testid="past-floods-summary"
          >
            {data.summary}
          </span>
          {data.noneNote && (
            <span className="mt-1 block text-small text-dim">{data.noneNote}</span>
          )}
          <span className="mt-1 inline-flex min-h-11 items-center gap-1 text-small font-semibold text-(--color-current)">
            <span className="group-open:hidden">{copy.pastFloodsShow}</span>
            <span className="hidden group-open:inline">{copy.pastFloodsHide}</span>
            <span aria-hidden="true" className="inline-block group-open:rotate-180">
              ↓
            </span>
          </span>
        </summary>
        <div className="px-4 pb-4">{list}</div>
      </details>
    );
  }

  return (
    <section
      aria-labelledby="past-floods-title"
      className="rounded-2xl bg-surface p-5"
      data-testid="past-floods"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="past-floods-title" className="text-body font-semibold">
          {copy.pastFloodsTitle}
        </h2>
        {tag}
      </div>
      <p
        className="mt-2 text-h2 [overflow-wrap:anywhere]"
        data-testid="past-floods-summary"
      >
        {data.summary}
      </p>
      {data.noneNote && <p className="mt-1 text-small text-dim">{data.noneNote}</p>}
      <div className="mt-4">{list}</div>
    </section>
  );
}
