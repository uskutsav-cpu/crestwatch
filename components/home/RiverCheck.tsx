"use client";

/**
 * "Right now on our rivers" (package rivers): the district's main rivers
 * on the home page, before anyone types an address. One quiet row per
 * river. Reads GET /api/rivers. Whatever happens upstream, the home page
 * keeps working: a failure is one line and a Check again button.
 *
 * Honesty rules here: a green chip only for a fresh reading below flood
 * stage whose forecast stays below it too. An old reading, an unknown
 * flood stage, or a forecast that reaches flood stage is never green.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { fmtTime } from "@/lib/time";
import { dayWord } from "@/lib/sentences";
import { VerdictChip, type VerdictBand } from "@/components/ui";
// Types only: the client bundle must not pull in the server fetch code.
import type { RiverNow, RiversAnswer } from "@/lib/rivers";
import type { CategoryLevel } from "@/lib/surveyor";
import type { Trend } from "@/lib/trend";

/**
 * Older than this, a reading isn't "right now": no trend arrow, never a
 * green chip, and the row says how old it is. NWPS posts these gauges
 * about hourly and about 40 minutes late, so a normal reading is up to
 * about 2 hours old.
 */
export const RIVER_STALE_H = 6;

/** Matches the server cache, so an open page stays current. */
const REFRESH_MS = 15 * 60 * 1000;

/** Same as lib/sentences.ts: a smaller forecast bump is noise, not a crest. */
const MIN_RISE_FT = 0.3;

export interface RiverChip {
  band: VerdictBand;
  label: string;
}

/** Same colour language as the Watch CATEGORY chips. */
const NOW_CHIPS: Record<CategoryLevel, RiverChip> = {
  none: { band: "UNLIKELY", label: copy.chipCategoryNone },
  action: { band: "BORDERLINE", label: copy.chipCategoryAction },
  minor: { band: "BORDERLINE", label: copy.chipCategoryMinor },
  moderate: { band: "LIKELY", label: copy.chipCategoryModerate },
  major: { band: "LIKELY", label: copy.chipCategoryMajor },
};
const UNKNOWN_CHIP: RiverChip = { band: "BORDERLINE", label: copy.chipCategoryUnknown };

/** How bad, for "which is worse". Unknown sits just above calm (lib/severity.ts order). */
const RANK: Record<CategoryLevel, number> = { none: 0, action: 2, minor: 3, moderate: 4, major: 5 };
const rank = (c: CategoryLevel | null) => (c === null ? 1 : (RANK[c] ?? 1));

const nowChip = (c: CategoryLevel | null): RiverChip =>
  c === null ? UNKNOWN_CHIP : (NOW_CHIPS[c] ?? UNKNOWN_CHIP);

function forecastChip(c: CategoryLevel | null): RiverChip {
  if (c === null) return UNKNOWN_CHIP;
  if (c === "none") return NOW_CHIPS.none;
  if (c === "action") return { band: "BORDERLINE", label: copy.riversChipNearing };
  return { band: NOW_CHIPS[c].band, label: copy.riversChipForecast(c) };
}

const TREND_ARROW: Record<Trend, string> = { rising: "↑", falling: "↓", steady: "→" };
const TREND_TEXT: Record<Trend, string> = {
  rising: copy.trendRising,
  falling: copy.trendFalling,
  steady: copy.trendSteady,
};

/** Flood stages are usually whole feet: "43", or "28.5" when they aren't. */
const fmtFt = (ft: number) => (Number.isInteger(ft) ? String(ft) : ft.toFixed(1));

export interface RiverView {
  /** "15.0" (ft on the gauge). */
  stage: string;
  /** Null when the reading is old or the series can't tell. */
  trend: Trend | null;
  chip: RiverChip;
  /** The quiet second line, or null when there's nothing to add. */
  detail: string | null;
}

/** What one row shows, judged against the viewer's clock. Pure. */
export function riverView(r: RiverNow, nowMs: number): RiverView {
  const ageMs = nowMs - Date.parse(r.observedAt);
  const ageKnown = Number.isFinite(ageMs);
  const stale = !ageKnown || ageMs > RIVER_STALE_H * 3_600_000;
  const delayed = ageKnown
    ? copy.delayedChip(Math.max(1, Math.round(ageMs / 3_600_000)))
    : copy.riversReadingUnknown;

  // A forecast high that has already gone by says nothing about what's next.
  const high =
    r.forecastHigh && Date.parse(r.forecastHigh.t) > nowMs ? r.forecastHigh : null;
  // The worse of now and the forecast high: a river below flood stage
  // today but forecast over it must not wear the green chip.
  let chip =
    high && rank(r.forecastCategory) > rank(r.category)
      ? forecastChip(r.forecastCategory)
      : nowChip(r.category);
  let staleNote: string | null = null;
  if (stale) {
    if (chip.band === "UNLIKELY") chip = { band: "BORDERLINE", label: delayed };
    else staleNote = delayed;
  }

  const forecastPart =
    high === null
      ? null
      : high.stageFt - r.stageFt >= MIN_RISE_FT - 1e-6
        ? copy.riversExpectedHigh(
            high.stageFt.toFixed(1),
            dayWord(high.t, new Date(nowMs).toISOString()),
          )
        : copy.riversNoBigRise;
  const parts = [
    staleNote,
    r.floodStageFt === null ? null : copy.riversFloodStage(fmtFt(r.floodStageFt)),
    forecastPart,
  ].filter((p): p is string => p !== null);

  return {
    stage: r.stageFt.toFixed(1),
    trend: stale ? null : r.trend,
    chip,
    detail: parts.length > 0 ? parts.join(" · ") : null,
  };
}

export type RiverPhase =
  | { kind: "loading" }
  /** No answer to show. `retrying` keeps the button mounted (and focused) while it asks again. */
  | { kind: "failed"; retrying: boolean }
  /** `nowMs` is the viewer's clock at the last check, for judging reading age. */
  | { kind: "ok"; rivers: RiverNow[]; checkedAt: string; nowMs: number };

/** GET /api/rivers. Null on any failure, including an empty answer. */
export async function loadRivers(
  fetchImpl: typeof fetch = fetch,
): Promise<{ rivers: RiverNow[]; checkedAt: string } | null> {
  try {
    const res = await fetchImpl("/api/rivers");
    const json = (await res.json()) as Partial<Extract<RiversAnswer, { ok: true }>> & {
      ok?: boolean;
    };
    if (json.ok && Array.isArray(json.rivers) && json.rivers.length > 0 && json.checkedAt) {
      return { rivers: json.rivers, checkedAt: json.checkedAt };
    }
  } catch {
    // fall through: the strip shows its one quiet failure line
  }
  return null;
}

function RiverRow({ river, nowMs }: { river: RiverNow; nowMs: number }) {
  const v = riverView(river, nowMs);
  return (
    <li className="flex flex-col gap-1 py-3" data-testid="river-row">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="min-w-0 text-body font-semibold [overflow-wrap:anywhere]">
          {river.name}
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="tnum whitespace-nowrap text-body font-semibold">
            {v.stage} ft
            {v.trend && (
              <>
                {" "}
                <span aria-hidden="true">{TREND_ARROW[v.trend]}</span>
                <span className="sr-only">{TREND_TEXT[v.trend]}</span>
              </>
            )}
          </span>
          <VerdictChip band={v.chip.band}>{v.chip.label}</VerdictChip>
        </div>
      </div>
      {v.detail && <p className="tnum text-small text-dim">{v.detail}</p>}
    </li>
  );
}

/** The strip for a given phase. Exported so each state renders in tests. */
export function RiverCheckView({
  phase,
  onRetry,
  className = "",
}: {
  phase: RiverPhase;
  onRetry: () => void;
  className?: string;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={`w-full rounded-2xl bg-surface p-4 text-left ${className}`}
      data-testid="river-check"
    >
      <h2 id={titleId} className="text-body font-semibold">
        {copy.riversTitle}
      </h2>

      {phase.kind === "loading" && (
        <ul aria-busy="true" className="mt-1 flex flex-col divide-y divide-line">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} aria-hidden="true" className="flex flex-col gap-2 py-3">
              <div className="h-5 w-3/4 rounded-md bg-line motion-safe:animate-pulse" />
              <div className="h-4 w-1/2 rounded-md bg-line motion-safe:animate-pulse" />
            </li>
          ))}
        </ul>
      )}

      {phase.kind === "failed" && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3">
          <p className="text-small text-dim">{copy.riverDataDownLinked}</p>
          {/* Stays focusable while it asks again (aria-disabled, not disabled). */}
          <button
            type="button"
            onClick={() => {
              if (!phase.retrying) onRetry();
            }}
            aria-disabled={phase.retrying || undefined}
            className="inline-flex min-h-11 items-center text-small font-semibold text-(--color-current) aria-disabled:cursor-wait aria-disabled:opacity-50"
          >
            {copy.refresh}
          </button>
        </div>
      )}

      {phase.kind === "ok" && (
        <>
          <ul className="mt-1 flex flex-col divide-y divide-line">
            {phase.rivers.map((r) => (
              <RiverRow key={r.lid} river={r} nowMs={phase.nowMs} />
            ))}
          </ul>
          <p className="mt-1 text-small text-dim">{copy.riversSource(fmtTime(phase.checkedAt))}</p>
        </>
      )}
    </section>
  );
}

/**
 * The home page strip. Fetches on mount, then every 15 minutes while the
 * page is open. A failed refresh keeps the last good rows (their age is
 * still judged against the current clock, so old rows lose their green).
 */
export function RiverCheck({ className = "" }: { className?: string }) {
  const [phase, setPhase] = useState<RiverPhase>({ kind: "loading" });
  // Only the newest request may write; unmounting retires them all.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const req = ++latest.current;
    const data = await loadRivers();
    if (req !== latest.current) return;
    const nowMs = Date.now();
    setPhase((prev) => {
      if (data) return { kind: "ok", ...data, nowMs };
      return prev.kind === "ok" ? { ...prev, nowMs } : { kind: "failed", retrying: false };
    });
  }, []);

  useEffect(() => {
    const requests = latest;
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      clearInterval(id);
      requests.current++;
    };
  }, [load]);

  return (
    <RiverCheckView
      phase={phase}
      className={className}
      onRetry={() => {
        setPhase({ kind: "failed", retrying: true });
        void load();
      }}
    />
  );
}
