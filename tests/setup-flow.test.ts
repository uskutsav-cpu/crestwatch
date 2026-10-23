import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/* The setup page is server-rendered. These check what that first render
   holds, which is what a screen reader and hydration both start from.
   (No DOM library is installed, so the interactive steps are covered by
   e2e/setup.spec.ts and the pin-store unit tests.) */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

async function render(): Promise<string> {
  const { SetupFlow } = await import("@/components/setup/SetupFlow");
  return renderToString(createElement(SetupFlow));
}

describe("SetupFlow first render", () => {
  it("never touches localStorage while rendering", async () => {
    const touched: string[] = [];
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => {
        touched.push(`get ${k}`);
        return null;
      },
      setItem: (k: string) => void touched.push(`set ${k}`),
      removeItem: (k: string) => void touched.push(`remove ${k}`),
    });
    await render();
    expect(touched).toEqual([]);
  });

  it("holds both live regions, empty, from the start", async () => {
    const html = await render();
    expect(html).toMatch(/<p role="status" class="sr-only"><\/p>/);
    expect(html).toMatch(
      /<p id="lookup-note" role="alert" class="sr-only"><\/p>/,
    );
  });

  it("shows the address form with a visible field edge and no error state", async () => {
    const html = await render();
    const input = html.match(/<input[^>]*aria-label="Address, town, or ZIP"[^>]*>/)?.[0];
    expect(input).toBeDefined();
    expect(input).toContain("ring-(--color-dim)");
    expect(input).not.toContain("ring-line");
    expect(input).not.toContain("aria-invalid");
    expect(input).not.toContain("aria-describedby");
    expect(input).not.toMatch(/\sdisabled=""/);
    expect(html).toContain("Watch this place");
  });
});

describe("leaving setup", () => {
  it("Done and Skip agree: one place opens its verdict, more open the list", async () => {
    const { exitHref } = await import("@/components/setup/SetupFlow");
    expect(exitHref(1)).toBe("/watch");
    // A returning visitor's second place: /watch alone would open the
    // oldest saved place, not the one just added.
    expect(exitHref(2)).toBe("/places");
    expect(exitHref(5)).toBe("/places");
  });

  it("a place this browser won't keep opens as a watch link that says so", async () => {
    const { storageFallbackHref } = await import("@/components/setup/SetupFlow");
    const { decodeWatchLink } = await import("@/lib/watch-link");
    const pin = {
      id: "p1",
      name: "Home",
      matchedAddress: "100 E CAPITOL ST, JACKSON, MS",
      lat: 32.3004,
      lon: -90.1884,
      elevationFt: 275.5,
    };
    const url = new URL(storageFallbackHref(pin), "https://crestwatch.test");
    expect(url.pathname).toBe("/watch");
    expect(url.searchParams.get("nosave")).toBe("1");
    const linked = decodeWatchLink(url.searchParams.get("wl") ?? "");
    expect(linked?.[0]).toMatchObject({ name: "Home", elevationFt: 275.5 });
  });
});
