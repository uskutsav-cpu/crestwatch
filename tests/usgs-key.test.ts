import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * #52: an optional USGS_API_KEY goes to api.waterdata.usgs.gov only, as
 * x-api-key, and nowhere else. Nothing requires it.
 */

const KEY = "test-key-not-real-0123456789";

interface Seen {
  url: string;
  headers: Record<string, string>;
  redirect?: RequestRedirect;
}

function capture(status = 200): Seen[] {
  const seen: Seen[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    seen.push({
      url,
      headers: { ...(init.headers as Record<string, string>) },
      redirect: init.redirect,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({}),
      text: async () => "",
    } as unknown as Response;
  });
  return seen;
}

async function net() {
  vi.resetModules();
  return import("@/lib/net");
}

const URLS = {
  waterdata:
    "https://api.waterdata.usgs.gov/ogcapi/v1/collections/monitoring-locations/items/USGS-02486000?f=json",
  legacy: "https://waterservices.usgs.gov/nwis/site/?sites=02486000&siteOutput=expanded&format=rdb",
  nwps: "https://api.water.noaa.gov/nwps/v1/gauges/JACM6",
  census: "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=x",
  lookalike: "https://api.waterdata.usgs.gov.example.com/ogcapi/v1/collections",
  plainHttp: "http://api.waterdata.usgs.gov/ogcapi/v1/collections",
};

const hasKey = (s: Seen) =>
  Object.entries(s.headers).some(
    ([k, v]) => k.toLowerCase() === "x-api-key" || v === KEY,
  );

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("USGS_API_KEY", () => {
  it("is sent as x-api-key to api.waterdata.usgs.gov when set", async () => {
    vi.stubEnv("USGS_API_KEY", KEY);
    const seen = capture();
    const { fetchJson, fetchText } = await net();
    await fetchJson(URLS.waterdata);
    await fetchText(URLS.waterdata);
    expect(seen).toHaveLength(2);
    for (const s of seen) expect(s.headers["x-api-key"]).toBe(KEY);
  });

  it("never goes anywhere else, look-alike and plain-http hosts included", async () => {
    vi.stubEnv("USGS_API_KEY", KEY);
    const seen = capture();
    const { fetchJson, fetchText } = await net();
    for (const u of [URLS.legacy, URLS.nwps, URLS.census, URLS.lookalike, URLS.plainHttp]) {
      await fetchJson(u);
      await fetchText(u);
    }
    expect(seen).toHaveLength(10);
    for (const s of seen) expect(hasKey(s)).toBe(false);
  });

  it("a keyed request won't follow a redirect, so the key can't leak to it", async () => {
    vi.stubEnv("USGS_API_KEY", KEY);
    const seen = capture(302);
    const { fetchJson } = await net();
    await expect(fetchJson(URLS.waterdata)).rejects.toThrow(/302/);
    expect(seen[0].redirect).toBe("manual");
  });

  it("is never echoed in an error message", async () => {
    vi.stubEnv("USGS_API_KEY", KEY);
    capture(429);
    const { fetchJson } = await net();
    const err = await fetchJson(URLS.waterdata).catch((e: Error) => e);
    expect(String(err)).toMatch(/429/);
    expect(String(err)).not.toContain(KEY);
  });

  it("unset (or blank) means keyless and unchanged", async () => {
    for (const value of [undefined, "", "   "]) {
      vi.unstubAllEnvs();
      vi.stubEnv("USGS_API_KEY", value);
      const seen = capture();
      const { fetchJson } = await net();
      await fetchJson(URLS.waterdata);
      expect(hasKey(seen[0])).toBe(false);
      expect(seen[0].redirect).toBeUndefined();
      expect(Object.keys(seen[0].headers).sort()).toEqual(["accept", "user-agent"]);
    }
  });
});
