/**
 * "Your flood number" card with a what-if slider (package floodnumber).
 *
 * The flood number is the river stage, read on the pin's gauge, at which
 * water reaches the pin's ground: pin elevation - gauge zero. It turns the
 * crest number people hear on the news into a personal one. All math and
 * words live in lib/flood-number.ts and lib/copy.ts (floodNumber* keys).
 *
 * ---------------------------------------------------------------------
 * API (for the integration engineer)
 * ---------------------------------------------------------------------
 *
 *   import { FloodNumber } from "@/components/watch/FloodNumber";
 *   import { floodNumberInputFor } from "@/lib/flood-number";
 *
 *   const fn = floodNumberInputFor(pin, watch); // null unless FULL tier
 *   {fn && <FloodNumber key={pin.id} {...fn} onWhatIf={setWhatIfStage} />}
 *
 * Props (FloodNumberProps = FloodNumberInput & { onWhatIf? }):
 *   pinName              string   shown in the explainer and readout
 *   approximate?         boolean  Pin.approximate: "rough flood number",
 *                                 copy.approximateTag, whole feet, and the
 *                                 readout says "the approximate spot for"
 *   pinElevationFt       number
 *   gaugeZeroFt          number | null   null (or a number below the
 *                                 gauge's 0 ft) renders nothing
 *   gaugeName            string   "Mississippi River at Vicksburg"
 *   currentStageFt       number | null   latest reading, ft
 *   currentStale?        boolean  old reading: "The last reading was..."
 *                                 instead of "...now"
 *   forecastPeakStageFt  number   verdict.peak.stageFt; the slider starts here
 *   categories           FloodCategories (minor = flood stage)
 *   historicCrests       FloodNumberCrest[] ({ stageFt, time, oldDatum? });
 *                                 only oldDatum === false counts toward the
 *                                 record. lib/gauges parseHistoricCrests
 *                                 drops NWPS `olddatum` today, so until it
 *                                 maps `oldDatum: c.olddatum` no record
 *                                 line or tick shows (never a guess).
 *   onWhatIf?            (stageFt: number | null) => void
 *                                 called from the slider with the chosen
 *                                 stage (ft on the gauge, 0.5 ft steps),
 *                                 and with null on "Back to the forecast".
 *                                 Optional: the card works on its own.
 *
 * Only render it for a FULL verdict; floodNumberInputFor does that check.
 * Key it by pin id so a different place starts back at the forecast.
 *
 * Redrawing the picture (optional): keep the stage from onWhatIf in state
 * and give WaterScene
 *   crestElevFt={whatIf === null ? verdict.peak.waterElevFt : gaugeZeroFt + whatIf}
 *   crestLabel={whatIf === null ? undefined : copy.floodNumberSceneLabel}
 *
 * Places card: floodNumberShort(floodNumberFt(pin.elevationFt, zero),
 * pin.approximate) -> "floods at about 46.5 ft" (or null).
 *
 * Not a "use client" entry: import it from a client component (WatchClient
 * is one). It takes a function prop, which a server component can't pass.
 * Works at 320 px; the slider and button are 44 px tall.
 */

import { useId, useState } from "react";
import { copy } from "@/lib/copy";
import {
  floodNumberView,
  snapWhatIf,
  whatIfHandlers,
  whatIfReadout,
  type FloodNumberInput,
  type FloodNumberView,
  type WhatIfMarkKind,
} from "@/lib/flood-number";

export interface FloodNumberProps extends FloodNumberInput {
  onWhatIf?: (stageFt: number | null) => void;
}

/** Tick under the slider; the legend swatch uses the same shape. */
const TICK: Record<WhatIfMarkKind, string> = {
  yours: "h-4 w-1 rounded-sm bg-fg",
  forecast: "h-4 w-1 rounded-sm bg-(--color-current)",
  floodStage: "h-3 w-0.5 bg-dim",
  record: "mt-0.5 h-2 w-2 rounded-full bg-dim",
};

const SWATCH: Record<WhatIfMarkKind, string> = {
  yours: "h-3 w-1 rounded-sm bg-fg",
  forecast: "h-3 w-1 rounded-sm bg-(--color-current)",
  floodStage: "h-3 w-0.5 bg-dim",
  record: "h-2 w-2 rounded-full bg-dim",
};

export interface FloodNumberPanelProps {
  view: FloodNumberView;
  /** The stage the slider shows (the forecast crest until it's moved). */
  stageFt: number;
  /** Still on the forecast: "Back to the forecast" has nothing to do. */
  atForecast: boolean;
  readout: string;
  /** Base for element ids (useId in FloodNumber). */
  idBase: string;
  onSlide: (raw: string) => void;
  onBack: () => void;
}

/**
 * The card itself, stateless (no hooks), so tests can call it as a plain
 * function and poke its handlers. FloodNumber below owns the state.
 */
export function FloodNumberPanel({
  view,
  stageFt,
  atForecast,
  readout,
  idBase,
  onSlide,
  onBack,
}: FloodNumberPanelProps) {
  const titleId = `${idBase}-title`;
  const sliderId = `${idBase}-slider`;
  const { range } = view;
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-2xl bg-surface p-5"
      data-testid="flood-number"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={titleId} className="text-body font-semibold">
          {view.title}
        </h2>
        {view.rough && (
          <span
            className="inline-flex items-center rounded-full bg-risewatch/10 px-2.5 py-0.5 text-small font-semibold text-risewatch"
            data-testid="flood-number-approximate"
          >
            {copy.approximateTag}
          </span>
        )}
      </div>
      <p className="mt-1">
        <span className="tnum text-numeral">{view.value}</span>{" "}
        <span className="text-body text-dim">{view.onGauge}</span>
      </p>
      <p className="mt-3 text-body">{view.explainer}</p>
      {view.context.length > 0 && (
        <ul className="tnum mt-3 flex list-disc flex-col gap-1.5 pl-5 text-small">
          {view.context.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-small text-dim">{view.levees}</p>

      <div className="mt-5 border-t border-line pt-4">
        <label htmlFor={sliderId} className="text-small font-semibold">
          {copy.floodNumberSliderLabel}
        </label>
        <input
          id={sliderId}
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={stageFt}
          onChange={(e) => onSlide(e.currentTarget.value)}
          aria-valuetext={readout}
          className="mt-1 block h-11 w-full accent-(--color-current)"
        />
        {/* Ticks line up with the thumb's centre (about 10 px in from each
            end). The legend below carries the same marks in words. */}
        <div aria-hidden="true" className="relative h-4">
          {view.marks.map((m) => (
            <span
              key={m.kind}
              className={`absolute top-0 -translate-x-1/2 ${TICK[m.kind]}`}
              style={{ left: `calc(10px + (100% - 20px) * ${m.frac.toFixed(4)})` }}
            />
          ))}
        </div>
        <p className="tnum mt-2 text-body" data-testid="flood-number-readout">
          {readout}
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-small text-dim">
          {view.marks.map((m) => (
            <li key={m.kind} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={`inline-block ${SWATCH[m.kind]}`} />
              {m.label} <span className="tnum">{m.value}</span>
            </li>
          ))}
        </ul>
        {/* Always mounted, so a keyboard user who presses it keeps focus. */}
        <button
          type="button"
          onClick={() => {
            if (!atForecast) onBack();
          }}
          aria-disabled={atForecast || undefined}
          className="mt-3 inline-flex min-h-11 items-center rounded-xl px-4 text-small font-semibold text-fg ring-1 ring-inset ring-line transition-colors hover:text-(--color-current) hover:ring-(--color-current) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg aria-disabled:cursor-default aria-disabled:opacity-50 aria-disabled:hover:text-fg aria-disabled:hover:ring-line"
        >
          {copy.floodNumberBack}
        </button>
      </div>
    </section>
  );
}

/**
 * "Your flood number" for one place, with the what-if slider. Renders
 * nothing when there's no flood number (no gauge zero, or the ground sits
 * below the gauge's 0 ft).
 */
export function FloodNumber({ onWhatIf, ...input }: FloodNumberProps) {
  const idBase = useId();
  const [chosen, setChosen] = useState<number | null>(null);
  const view = floodNumberView(input);
  if (view === null) return null;
  const { range } = view;
  // A refresh can move the range; keep a chosen stage inside it.
  const stageFt = chosen === null ? range.start : snapWhatIf(chosen, range);
  const { slide, back } = whatIfHandlers(range, setChosen, onWhatIf);
  return (
    <FloodNumberPanel
      view={view}
      stageFt={stageFt}
      atForecast={chosen === null}
      readout={whatIfReadout(stageFt, input)}
      idBase={idBase}
      onSlide={slide}
      onBack={back}
    />
  );
}
