"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/places", label: "Places" },
  { href: "/replay", label: "Replay" },
  { href: "/about", label: "About" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-small font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-current)/40 ${
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
