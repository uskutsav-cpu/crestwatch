"use client";

/**
 * S4 · Why (T09) — the "no magic" screen. Every number on the verdict
 * traced to its source, the subtraction written out like homework, and
 * the degraded tiers explained in plain words.
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { copy } from "@/lib/copy";
import { decodeWatchLink } from "@/lib/watch-link";
import { useWatches } from "@/lib/use-watch";
import { StatChart } from "@/components/why/StatChart";
import { LiveDot, TierBadge } from "@/components/ui";

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function Row({ label, value, op }: { label: string; value: string; op?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="min-w-0 text-small text-dim">
        {op && <span className="mr-2 inline-block w-3 text-fg">{op}</span>}
        {label}
      </span>
      <span className="tnum text-numeral shrink-0 whitespace-nowrap">{value}</span>
    </div>
  );
}

export function WhyClient() {
  const params = useSearchParams();
  // A shared watch link keeps working on the Why hop.
  const linkedPins = useMemo(() => {
    const wl = params.get("wl");
    return wl ? decodeWatchLink(wl) : null;
  }, [params]);
  const { pins, watches, loading } = useWatches(linkedPins);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const pin = pins.find((p) => p.id === params.get("pin")) ?? pins[0];
  const watch = watches.find((w) => w.pinId === pin?.id);

  if (loading && !watch) {
    return (
      <div className="flex items-center gap-2 py-14 text-dim">
        <LiveDot /> {copy.looking}
      </div>
    );
  }
  if (!pin || !watch) {
    return (
      <div className="py-14">
        <p className="text-dim">{copy.placesEmpty}</p>
        <Link href="/" className="mt-3 inline-block font-semibold text-(--color-current)">
          {copy.addPlace}
        </Link>
      </div>
    );
  }

  const { verdict, gauge, alerts } = watch;
  const lastObs = gauge?.observed.at(-1) ?? null;

  return (
    <div className="flex flex-col gap-6 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h2">{copy.whyTitle}</h1>
        <TierBadge
          tier={verdict.tier === "ALERT_ONLY" ? "ALERT_ONLY" : verdict.tier}
        />
      </div>

      {/* ---------- ALERT-ONLY ---------- */}
      {verdict.tier === "ALERT_ONLY" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-surface p-5">
            <p className="text-h2">{copy.noGaugeHeadline}</p>
            <p className="mt-2 text-body text-dim">
              CrestWatch needs a river gauge with an official crest forecast
              within 25 miles, and {pin.name} doesn&apos;t have one. That
              usually means the risk here is flash flooding from sudden
              rain, which gives minutes of warning instead of days. Your
              county alerts are the right tool for that.
            </p>
          </div>
          {alerts.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {alerts.map((a, i) => (
                <li key={i} className="rounded-xl bg-risewatch/10 p-3 text-small">
                  <span className="font-semibold">{a.event}</span>
                  {a.areaDesc ? ` · ${a.areaDesc}` : ""}
                </li>
              ))}
            </ul>
          ) : watch.alertsOk ? (
            <p className="text-small text-dim">
              No flood alerts are active for this spot right now.
            </p>
          ) : (
            <p className="rounded-xl bg-risewatch/10 p-3 text-small">
              CrestWatch couldn&apos;t reach the alert service just now.
              That is not an all-clear. Check weather.gov directly.
            </p>
          )}
          <a
            className="font-semibold text-(--color-current)"
            href="https://www.weather.gov/alerts"
            target="_blank"
            rel="noreferrer"
          >
            Official alerts at weather.gov →
          </a>
        </div>
      )}

      {/* ---------- CATEGORY ---------- */}
      {verdict.tier === "CATEGORY" && gauge && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-surface p-5">
            <p className="text-body">
              <span className="font-semibold">{gauge.name}</span>
              {" · "}
              <span className="tnum">{gauge.distanceMi.toFixed(1)} mi away</span>
            </p>
            <p className="mt-2 text-body text-dim">
              This gauge doesn&apos;t publish its own elevation (the USGS
              field called <span className="tnum">alt_va</span>), so
              CrestWatch can&apos;t turn its stage readings into a
              water-surface elevation to compare with your ground. Instead,
              here&apos;s the official flood-category picture for areas near
              the gauge.
            </p>
          </div>
          <StatChart
            observed={gauge.observed}
            forecast={gauge.forecast}
            floodStageFt={gauge.categories.minor ?? null}
          />
          <div className="rounded-2xl bg-surface p-5">
            <Row label="forecast crest (stage)" value={`${verdict.peakStageFt.toFixed(1)} ft`} />
            {typeof gauge.categories.minor === "number" && (
              <Row op="−" label="flood stage" value={`${gauge.categories.minor.toFixed(1)} ft`} />
            )}
            {verdict.aboveFloodFt !== null && (
              <>
                <div className="my-2 border-t border-line" />
                <Row
                  op="="
                  label={verdict.aboveFloodFt >= 0 ? "above flood stage" : "below flood stage"}
                  value={`${Math.abs(verdict.aboveFloodFt).toFixed(1)} ft`}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------- FULL ---------- */}
      {verdict.tier === "FULL" && gauge && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-surface p-5">
            <p className="text-body">
              <span className="font-semibold">{gauge.name}</span>
              {" · "}
              <span className="tnum">{gauge.distanceMi.toFixed(1)} mi from {pin.name}</span>
            </p>
          </div>

          <StatChart
            observed={gauge.observed}
            forecast={gauge.forecast}
            floodStageFt={gauge.categories.minor ?? null}
          />

          {/* The homework arithmetic, one card */}
          <div className="rounded-2xl bg-surface p-5">
            <p className="mb-3 text-small font-semibold text-dim">
              The water side
            </p>
            <Row
              label={`gauge zero (how high the gauge's 0 ft sits${gauge.gaugeDatum ? `, ${gauge.gaugeDatum}` : ""})`}
              value={`${gauge.gaugeZeroFt!.toFixed(1)} ft`}
            />
            <Row op="+" label="forecast crest, the river's high point (stage)" value={`${verdict.peak.stageFt.toFixed(1)} ft`} />
            <div className="my-2 border-t border-line" />
            <Row op="=" label="forecast water surface" value={`${verdict.peak.waterElevFt.toFixed(1)} ft`} />

            <div className="my-4 border-t border-line" />
            <p className="mb-3 text-small font-semibold text-dim">
              Your side
            </p>
            <Row label={`${pin.name} sits at`} value={`${pin.elevationFt.toFixed(1)} ft`} />
            <Row op="−" label="forecast water surface" value={`${verdict.peak.waterElevFt.toFixed(1)} ft`} />
            <div className="my-2 border-t border-line" />
            <Row
              op="="
              label={verdict.marginFt >= 0 ? "margin of dry ground" : "depth over this spot at the crest"}
              value={`${Math.abs(verdict.marginFt).toFixed(1)} ft`}
            />
          </div>

          <p className="text-small text-dim">
            Observed {lastObs ? `updated ${fmtWhen(lastObs.t)}` : "unavailable"}
            {gauge.forecastIssued
              ? ` · forecast issued ${fmtWhen(gauge.forecastIssued)}`
              : ""}
            {" · times Central"}
          </p>
        </div>
      )}

      {/* Source links — every number traceable */}
      {gauge && (
        <div className="flex flex-wrap gap-4 text-small">
          <a
            className="font-semibold text-(--color-current)"
            href={`https://water.noaa.gov/gauges/${gauge.lid}`}
            target="_blank"
            rel="noreferrer"
          >
            Official forecast page (NWS) →
          </a>
          {gauge.usgsId && (
            <a
              className="font-semibold text-(--color-current)"
              href={`https://waterdata.usgs.gov/monitoring-location/${gauge.usgsId}`}
              target="_blank"
              rel="noreferrer"
            >
              Official gauge data (USGS) →
            </a>
          )}
        </div>
      )}

      <Link
        href={
          linkedPins
            ? `/watch?pin=${pin.id}&wl=${params.get("wl")}`
            : `/watch?pin=${pin.id}`
        }
        className="text-dim hover:text-(--color-current)"
      >
        ← Back to the watch
      </Link>
    </div>
  );
}
