"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/watch", label: "Watch" },
  { href: "/places", label: "Places" },
  { href: "/replay", label: "Replay" },
  { href: "/about", label: "About" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0 sm:gap-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group inline-flex h-11 items-center rounded-full text-small font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-current)/40 ${
              active ? "text-(--color-current)" : "text-dim hover:text-(--color-current)"
            }`}
          >
            {/* 44px tap target on the link; the visible pill stays flat */}
            <span
              className={`rounded-full px-1 py-1 min-[360px]:px-2 sm:px-3 ${
                active ? "bg-(--color-current)/15" : ""
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
