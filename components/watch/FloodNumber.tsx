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
 *   import { floodNumberInputFor, floodNumberShortFor } from "@/lib/flood-number";
 *
 *   const fn = floodNumberInputFor(pin, watch); // null unless FULL tier
 *   {fn && <FloodNumber key={pin.id} {...fn} onWhatIf={setWhatIfStage} />}
 *
 * Props (FloodNumberProps = FloodNumberInput & { onWhatIf?, children? }):
 *   pinName              string   shown in the explainer and readout
 *   approximate?         boolean  Pin.approximate: "rough flood number",
 *                                 copy.approximateTag, "roughly", and the
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
 *                                 maps NWPS `olddatum` to `oldDatum`; a
 *                                 crest without it never counts (never a
 *                                 guess).
 *   onWhatIf?            (stageFt: number | null) => void
 *                                 the stage the picture should show (ft on
 *                                 the gauge, 0.5 ft steps), or null for
 *                                 the forecast. Called when the slider
 *                                 moves, on "Back to the forecast", when a
 *                                 refresh clamps the chosen stage into a
 *                                 new range, and with null when the card
 *                                 unmounts or loses its number. So while
 *                                 the card is mounted the parent holds
 *                                 exactly the stage it shows, and null
 *                                 after. Optional: the card works on its
 *                                 own.
 *   children?            ReactNode drawn between the slider's ticks and
 *                                 its readout: the what-if picture.
 *
 * Only render it for a FULL verdict; floodNumberInputFor does that check.
 * Key it by pin id so a different place starts back at the forecast.
 * The parent should also reset its what-if state to null whenever pin.id
 * or verdict.tier changes, so a stage from one gauge is never drawn on
 * another gauge's zero, even for one frame.
 *
 * The what-if picture (optional): keep the stage from onWhatIf in state
 * and, while it isn't null, pass a WaterScene as children with
 *   crestElevFt={gaugeZeroFt + whatIf}
 *   crestLabel={copy.floodNumberSceneLabel}
 * so it sits right under the slider that moves it. The page's main
 * picture stays on the forecast: it sits a screen or more above the
 * slider, next to the forecast sentence, and must never show a made-up
 * river level as if it were the forecast.
 *
 * Places card: floodNumberShortFor(pin, watch) -> "floods at about 46 ft",
 * or null unless the verdict is FULL. Use it rather than floodNumberShort on
 * a raw zero: a CATEGORY verdict can still carry a gauge zero the Surveyor
 * didn't trust.
 *
 * Not a "use client" entry: import it from a client component (WatchClient
 * is one). It takes a function prop, which a server component can't pass.
 * Works at 320 px; the slider and button are 44 px tall.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  /** Drawn under the slider, above the readout: the what-if picture. */
  children?: ReactNode;
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
  /** Drawn between the ticks and the readout (the what-if picture). */
  children?: ReactNode;
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
  children,
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
        {children && (
          <div className="mt-3" data-testid="flood-number-picture">
            {children}
          </div>
        )}
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
export function FloodNumber({ onWhatIf, children, ...input }: FloodNumberProps) {
  const idBase = useId();
  const [chosen, setChosen] = useState<number | null>(null);
  // The latest callback, so an effect or a handler never calls an old one.
  const cb = useRef(onWhatIf);
  // The stage the parent was last told (null = the forecast).
  const told = useRef<number | null>(null);

  const view = floodNumberView(input);
  // A refresh can move the range; keep a chosen stage inside it.
  const stageFt =
    view === null ? null : chosen === null ? view.range.start : snapWhatIf(chosen, view.range);
  // What the parent's picture should show: null on the forecast, or when
  // this card has no number to show.
  const whatIf = chosen === null ? null : stageFt;

  useEffect(() => {
    cb.current = onWhatIf;
  });
  // Keep the parent on the stage this card shows, even when a refresh
  // clamps it into a new range or takes the number away.
  useEffect(() => {
    if (whatIf !== told.current) {
      told.current = whatIf;
      cb.current?.(whatIf);
    }
  });
  // Gone (the tier dropped, or another place): back to the forecast, so
  // the picture never keeps a what-if line this card no longer shows.
  // Harmless under StrictMode's extra unmount and mount.
  useEffect(
    () => () => {
      told.current = null;
      cb.current?.(null);
    },
    [],
  );

  if (view === null || stageFt === null) return null;
  const { range } = view;
  // Tell the parent from the event itself, so the picture moves with the
  // slider in the same render; `told` stops the effect saying it twice.
  const report = (s: number | null) => {
    told.current = s;
    onWhatIf?.(s);
  };
  const slide = (raw: string) => whatIfHandlers(range, setChosen, report).slide(raw);
  const back = () => whatIfHandlers(range, setChosen, report).back();
  return (
    <FloodNumberPanel
      view={view}
      stageFt={stageFt}
      atForecast={chosen === null}
      readout={whatIfReadout(stageFt, input)}
      idBase={idBase}
      onSlide={slide}
      onBack={back}
    >
      {children}
    </FloodNumberPanel>
  );
}
