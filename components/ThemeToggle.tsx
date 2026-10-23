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
        // Backup for the pre-paint script, which can run before Next has
        // added the theme-color tag to <head>.
        document
          .querySelector('meta[name="theme-color"]')
          ?.setAttribute("content", "#F4F9FB");
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
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", "#F4F9FB");
    } else {
      document.documentElement.removeAttribute("data-theme");
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", "#0A1620");
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      className="flex h-11 w-11 items-center justify-center rounded-full text-dim transition-colors hover:text-(--color-current) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
