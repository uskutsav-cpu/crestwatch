"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/watch", label: "Watch" },
  { href: "/places", label: "Places" },
  { href: "/replay", label: "Replay" },
  { href: "/about", label: "About" },
];

/** /why explains the Watch verdict, so it lights the Watch pill. */
export function isNavActive(pathname: string | null, href: string): boolean {
  return pathname === href || (href === "/watch" && pathname === "/why");
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0 sm:gap-1">
      {LINKS.map(({ href, label }) => {
        const active = isNavActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group inline-flex h-11 items-center rounded-full text-small font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg ${
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
