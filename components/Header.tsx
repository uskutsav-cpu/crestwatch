import Link from "next/link";
import { WaveMark } from "@/components/WaveMark";
import { NavLinks } from "@/components/NavLinks";
import { HeaderPill } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { copy } from "@/lib/copy";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-current)/40 rounded-lg"
        >
          <span className="text-(--color-current)">
            <WaveMark size={28} />
          </span>
          <span className="text-h2 leading-none">{copy.appName}</span>
        </Link>
        <NavLinks />
        <div className="flex items-center gap-1">
          <span className="hidden md:inline-flex">
            <HeaderPill label={copy.headerPill} />
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
