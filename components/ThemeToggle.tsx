"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/config";

/**
 * Dark is the default (evening checking); light is opt-in via
 * data-theme="light". The choice is the app's only cookie-free
 * persistence besides pins. Applied pre-paint by the layout script.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.theme) === "light") {
        setTheme("light");
      }
    } catch {
      // storage blocked — stay dark
    }
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, next);
    } catch {
      // storage blocked — theme won't persist
    }
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      className="flex h-10 w-10 items-center justify-center rounded-full text-dim transition-colors hover:text-(--color-current) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-current)/40"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
