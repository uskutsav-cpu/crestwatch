/**
 * CRESTWATCH_TEST=1 fixture router — serves the recorded fixtures instead
 * of the live federal APIs so e2e runs are deterministic and offline.
 * Never active unless the env flag is set (see routeFetchers()).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultFetchers, type Fetchers } from "@/lib/gauges";
import geoFixtures from "@/tests/fixtures/geo_fixtures.json";

const FIX = () => join(process.cwd(), "tests", "fixtures");

const readJson = (...p: string[]) =>
  JSON.parse(readFileSync(join(FIX(), ...p), "utf8")) as unknown;
const readText = (...p: string[]) => readFileSync(join(FIX(), ...p), "utf8");

export function isTestMode(): boolean {
  return process.env.CRESTWATCH_TEST === "1";
}

function fixtureJson(url: string): unknown {
  const u = new URL(url);

  if (u.hostname === "geocoding.geo.census.gov") {
    const q = (u.searchParams.get("address") ?? "").toLowerCase();
    for (const a of geoFixtures.addresses) {
      if (q === a.input.toLowerCase()) return a.census;
    }
    return geoFixtures.noMatch.census;
  }

  if (u.hostname === "epqs.nationalmap.gov") {
    const x = parseFloat(u.searchParams.get("x") ?? "0");
    const y = parseFloat(u.searchParams.get("y") ?? "0");
    let best = geoFixtures.addresses[0];
    let bestD = Infinity;
    for (const a of geoFixtures.addresses) {
      const d =
        (a.expect.lon - x) ** 2 + (a.expect.lat - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best.epqs;
  }

  if (u.hostname === "api.water.noaa.gov") {
    const m = u.pathname.match(/\/gauges\/([A-Z0-9]+)(\/stageflow)?$/);
    if (!m) return readJson("gauges", "nwps_list_test.json");
    const lid = ["YZOM6", "JACM6", "BTAM6"].includes(m[1]) ? m[1] : "YZOM6";
    return m[2]
      ? readJson("gauges", `nwps_stageflow_${lid}.json`)
      : readJson("gauges", `nwps_detail_${lid}.json`);
  }

  if (u.hostname === "waterservices.usgs.gov" && u.pathname.includes("/iv/")) {
    const site = u.searchParams.get("sites") ?? "02486000";
    const known = ["02486000", "07289730"].includes(site) ? site : "02486000";
    return readJson("gauges", `usgs_iv_${known}.json`);
  }

  if (u.hostname === "api.weather.gov") {
    return readJson("alerts_empty.json");
  }

  throw new Error(`no fixture route for ${url}`);
}

function fixtureText(url: string): string {
  const u = new URL(url);
  if (u.hostname === "waterservices.usgs.gov" && u.pathname.includes("/site/")) {
    const site = u.searchParams.get("sites") ?? "02486000";
    const known = ["02486000", "07289730"].includes(site) ? site : "02486000";
    return readText("gauges", `usgs_site_${known}.rdb`);
  }
  throw new Error(`no text fixture route for ${url}`);
}

export const testFetchers: Fetchers = {
  json: async (url) => fixtureJson(url),
  text: async (url) => fixtureText(url),
};

/** The fetchers the API routes should use for this process. */
export function routeFetchers(): Fetchers {
  return isTestMode() ? testFetchers : defaultFetchers;
}
