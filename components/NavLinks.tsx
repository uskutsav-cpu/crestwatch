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
    <nav className="flex items-center gap-0.5 sm:gap-1">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-2 py-1.5 text-small font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-current)/40 sm:px-3 ${
              active
                ? "bg-(--color-current)/15 text-(--color-current)"
                : "text-dim hover:text-(--color-current)"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
