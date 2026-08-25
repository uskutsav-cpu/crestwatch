import Link from "next/link";
import { copy } from "@/lib/copy";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-small text-dim">
        <nav className="flex gap-4">
          <Link href="/places" className="hover:text-(--color-current)">
            Places
          </Link>
          <Link href="/replay" className="hover:text-(--color-current)">
            Replay
          </Link>
          <Link href="/about" className="hover:text-(--color-current)">
            About
          </Link>
        </nav>
        <p>{copy.footerLine}</p>
      </div>
    </footer>
  );
}
