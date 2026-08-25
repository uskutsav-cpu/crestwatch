/**
 * NWS active alerts for a point (D6). Filtered to flood-family events —
 * this is also the whole product in ALERT-ONLY tier.
 */

import { fetchJson, type FetchJson } from "@/lib/net";

export interface FloodAlert {
  event: string;
  headline: string | null;
  severity: string | null;
  areaDesc: string | null;
  expires: string | null;
}

export function alertsUrl(lat: number, lon: number): string {
  return `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`;
}

const FLOOD_RE = /flood/i;

export async function fetchFloodAlerts(
  lat: number,
  lon: number,
  json: FetchJson = fetchJson,
): Promise<FloodAlert[]> {
  let data: unknown;
  try {
    data = await json(alertsUrl(lat, lon));
  } catch {
    return []; // alerts are additive — an outage must not sink a verdict
  }
  const features = (
    data as {
      features?: Array<{
        properties?: {
          event?: string;
          headline?: string;
          severity?: string;
          areaDesc?: string;
          expires?: string;
        };
      }>;
    }
  )?.features;
  const out: FloodAlert[] = [];
  for (const f of features ?? []) {
    const p = f.properties;
    if (!p?.event || !FLOOD_RE.test(p.event)) continue;
    out.push({
      event: p.event,
      headline: p.headline ?? null,
      severity: p.severity ?? null,
      areaDesc: p.areaDesc ?? null,
      expires: p.expires ?? null,
    });
  }
  return out;
}
