export const STATIONS = [
  {
    lid: "VCKM6",
    name: "Mississippi River",
    city: "Vicksburg",
    lat: 32.315,
    lon: -90.905833,
    usgs: "07289000",
    label: "01",
  },
  {
    lid: "GEEM6",
    name: "Mississippi River",
    city: "Greenville",
    lat: 33.28711,
    lon: -91.15393,
    usgs: "07265450",
    label: "02",
  },
  {
    lid: "YZOM6",
    name: "Yazoo River",
    city: "Yazoo City",
    lat: 32.8579,
    lon: -90.4368,
    usgs: "07287000",
    label: "03",
  },
  {
    lid: "JACM6",
    name: "Pearl River",
    city: "Jackson",
    lat: 32.28138,
    lon: -90.17888,
    usgs: "02486000",
    label: "04",
  },
] as const;
export type Station = (typeof STATIONS)[number];
export function isFresh(
  iso: string | null | undefined,
  hours = 2,
  now = Date.now(),
) {
  const t = Date.parse(iso ?? "");
  return Number.isFinite(t) && t <= now + 300000 && now - t <= hours * 3600000;
}
export function timeLabel(iso: string | null | undefined) {
  return iso && Number.isFinite(Date.parse(iso))
    ? new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Chicago",
        timeZoneName: "short",
      }).format(new Date(iso))
    : "Time unavailable";
}
