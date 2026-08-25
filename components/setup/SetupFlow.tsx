"use client";

/* S1 setup flow placeholder — T06 builds address → confirm → pins.
   For T01 the shell renders the address field and CTA. */

import { copy } from "@/lib/copy";
import { ButtonPrimary } from "@/components/ui";

export function SetupFlow() {
  return (
    <form
      className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="text"
        autoComplete="off"
        placeholder={copy.addressPlaceholder}
        className="h-13 flex-1 rounded-xl border border-line bg-surface px-4 text-body text-fg placeholder:text-dim focus:border-(--color-current) focus:outline-none"
        aria-label="Street address"
      />
      <ButtonPrimary type="submit">{copy.cta}</ButtonPrimary>
    </form>
  );
}
