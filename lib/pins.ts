/**
 * Pin types shared by client and server. Pins persist ONLY in the
 * visitor's localStorage — the watch API receives them per-request and
 * remembers nothing.
 */

export interface Pin {
  id: string;
  name: string;
  matchedAddress: string;
  lat: number;
  lon: number;
  elevationFt: number;
}
