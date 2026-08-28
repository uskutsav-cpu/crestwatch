import Link from "next/link";
import { WaveMark } from "@/components/WaveMark";
import { NavLinks } from "@/components/NavLinks";
import { HeaderPill } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { copy } from "@/lib/copy";

export function Header() {
  return (
    <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-bold text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-current)/40 rounded-lg"
        >
          <span className="text-(--color-current)">
            <WaveMark size={24} />
          </span>
          <span className="hidden text-body font-bold leading-none min-[420px]:inline">
            {copy.appName}
          </span>
        </Link>
        <NavLinks />
        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden lg:inline-flex">
            <HeaderPill label={copy.headerPill} />
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
