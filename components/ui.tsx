import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* Core UI atoms (Appendix B3). Band colors appear ONLY on verdict
   surfaces — everything else stays ink/current so red means something. */

/* "current" is the brand cyan (Appendix B1) — referenced via CSS vars
   because Tailwind reserves bg-current for currentColor. */
const primaryClasses =
  "inline-flex h-13 items-center justify-center rounded-xl bg-(--color-current) px-6 text-body font-semibold text-ink transition-colors hover:bg-(--color-current-deep) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--color-current)/40";

const ghostClasses =
  "inline-flex h-13 items-center justify-center rounded-xl ring-1 ring-inset ring-line px-6 text-body font-semibold text-fg transition-colors hover:ring-(--color-current) hover:text-(--color-current) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--color-current)/25";

export function ButtonPrimary(
  props: ComponentProps<"button"> & { children: ReactNode },
) {
  const { className = "", children, ...rest } = props;
  return (
    <button className={`${primaryClasses} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonGhost(
  props: ComponentProps<"button"> & { children: ReactNode },
) {
  const { className = "", children, ...rest } = props;
  return (
    <button className={`${ghostClasses} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function LinkGhost(
  props: ComponentProps<typeof Link> & { children: ReactNode },
) {
  const { className = "", children, ...rest } = props;
  return (
    <Link className={`${ghostClasses} ${className}`} {...rest}>
      {children}
    </Link>
  );
}

export function HeaderPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-(--color-current)/50 px-3 py-1 text-small font-semibold text-(--color-current)">
      {label}
    </span>
  );
}

export type VerdictBand = "LIKELY" | "BORDERLINE" | "UNLIKELY";

export const BAND_COLOR: Record<VerdictBand, string> = {
  LIKELY: "var(--color-floodline)",
  BORDERLINE: "var(--color-risewatch)",
  UNLIKELY: "var(--color-dryland)",
};

export function VerdictChip({
  band,
  children,
}: {
  band: VerdictBand;
  children: ReactNode;
}) {
  return (
    <span
      className="chip-crossfade inline-flex items-center rounded-full px-3.5 py-1.5 text-small font-bold text-ink"
      style={{ backgroundColor: BAND_COLOR[band] }}
    >
      {children}
    </span>
  );
}

export function TierBadge({
  tier,
}: {
  tier: "FULL" | "CATEGORY" | "ALERT_ONLY";
}) {
  const label = tier === "ALERT_ONLY" ? "ALERT-ONLY" : tier;
  return (
    <span className="inline-flex items-center rounded-md border border-line px-2 py-0.5 text-small font-semibold tracking-wide text-dim">
      {label}
    </span>
  );
}

export function LiveDot() {
  return (
    <span
      className="animate-live-pulse inline-block h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: "var(--color-current)" }}
      aria-hidden="true"
    />
  );
}
