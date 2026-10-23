"use client";

/**
 * Catches a crash anywhere below the root layout so a visitor sees a calm
 * message and a way back, never a blank screen. `retry` is the Next 16.3
 * stable API: it re-fetches and re-renders the segment that failed.
 */

import Link from "next/link";
import { useEffect } from "react";
import { copy } from "@/lib/copy";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-h2">{copy.errorTitle}</h1>
      <p className="max-w-sm text-body text-dim">{copy.errorBody}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => retry()}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-(--color-current) px-6 text-body font-semibold text-ink transition-colors hover:bg-(--color-current-deep)"
        >
          {copy.tryAgain}
        </button>
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-body font-semibold text-fg ring-1 ring-inset ring-line transition-colors hover:text-(--color-current)"
        >
          {copy.goHome}
        </Link>
      </div>
    </div>
  );
}
