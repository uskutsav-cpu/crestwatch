"use client";
import { SiteLink as Link } from "@/components/experience/SiteLink";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Waves, ArrowUpRight, Menu, X } from "lucide-react";
const links = [
  { href: "/", name: "Rivers" },
  { href: "/places", name: "My places" },
  { href: "/replay", name: "Past floods" },
  { href: "/methodology", name: "How it works" },
  { href: "/project", name: "The project" },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  if (path === "/test") return <>{children}</>;
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="global-header">
        <Link href="/" className="wordmark" aria-label="CrestWatch home">
          <Waves size={27} strokeWidth={1.8} /> CrestWatch
        </Link>
        <nav
          className={`global-nav ${open ? "is-open" : ""}`}
          aria-label="Main navigation"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={path === l.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {l.name}
            </Link>
          ))}
        </nav>
        <a
          href="https://water.noaa.gov"
          target="_blank"
          rel="noreferrer"
          className="header-source"
        >
          Official forecasts <ArrowUpRight size={15} />
        </a>
        <button
          className="menu-toggle"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
        >
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <div className="app-body">
        <main id="main">{children}</main>
        <footer className="site-footer">
          <Link href="/" className="footer-brand">
            <Waves size={22} /> CrestWatch
          </Link>
          <p>Mississippi rivers. A clearer perspective.</p>
          <Link href="/project">
            Project walkthrough <ArrowUpRight size={13} />
          </Link>
          <Link href="/about">
            Our story <ArrowUpRight size={13} />
          </Link>
          <Link href="/methodology">
            Sources & limitations <ArrowUpRight size={13} />
          </Link>
        </footer>
      </div>
    </div>
  );
}
