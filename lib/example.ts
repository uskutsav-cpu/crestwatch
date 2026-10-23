/**
 * The "see an example" place: two spots in downtown Vicksburg on the
 * Mississippi River gauge, about 24 ft apart in height. They travel as a
 * Watch Link, so trying the example saves nothing on the visitor's device
 * and never waits on the elevation service. The verdict is live.
 *
 * Elevations are USGS 3DEP readings taken Oct 2026 (same source the app
 * uses). Both are public places, not anyone's home.
 */

import { encodeWatchLink } from "@/lib/watch-link";
import type { Pin } from "@/lib/pins";

export const EXAMPLE_PINS: Pin[] = [
  {
    id: "ex0",
    name: "Levee Street",
    matchedAddress: "LEVEE ST, VICKSBURG, MS",
    lat: 32.354,
    lon: -90.8825,
    elevationFt: 92.7,
  },
  {
    id: "ex1",
    name: "River museum",
    matchedAddress: "910 WASHINGTON ST, VICKSBURG, MS, 39183",
    lat: 32.35399,
    lon: -90.88152,
    elevationFt: 117.0,
  },
];

export const EXAMPLE_HREF = `/watch?wl=${encodeWatchLink(EXAMPLE_PINS)}&ex=1`;
