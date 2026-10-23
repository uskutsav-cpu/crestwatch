import Link from "next/link";
import { WaveMark } from "@/components/WaveMark";
import { copy } from "@/lib/copy";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <span className="text-(--color-current)">
        <WaveMark size={48} />
      </span>
      <h1 className="text-h2">{copy.notFoundTitle}</h1>
      <p className="max-w-sm text-body text-dim">{copy.notFoundBody}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-(--color-current) px-6 text-body font-semibold text-ink transition-colors hover:bg-(--color-current-deep)"
        >
          {copy.checkAPlace}
        </Link>
        <Link
          href="/places"
          className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-body font-semibold text-fg ring-1 ring-inset ring-line transition-colors hover:text-(--color-current)"
        >
          {copy.placesTitle}
        </Link>
      </div>
    </div>
  );
}
