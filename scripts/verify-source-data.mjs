/** Reproducible live source-integrity audit. This is not property inundation validation. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = process.cwd();
const output = process.argv[2] ?? "docs/DATA_CHECK.json";
const now = new Date().toISOString();
async function get(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "CrestWatch source verification (https://github.com/shashankmadala/crestwatch)",
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  return response.json();
}
const checks = [];
for (const lid of ["VCKM6", "GEEM6", "YZOM6", "JACM6"]) {
  const url = `https://api.water.noaa.gov/nwps/v1/gauges/${lid}`;
  try {
    const data = await get(url);
    const impacts = (data.flood?.impacts ?? []).filter(
      (n) =>
        typeof n.stage === "number" &&
        Number.isFinite(n.stage) &&
        typeof n.statement === "string" &&
        n.statement.trim(),
    );
    const categories = data.flood?.categories;
    const valid =
      data.lid === lid &&
      data.flood?.stageUnits === "ft" &&
      typeof categories?.minor?.stage === "number" &&
      impacts.length > 0;
    checks.push({
      kind: "official_station",
      id: lid,
      status: valid ? "passed" : "mismatch",
      source: url,
      summary: `${data.name}: flood stage ${categories?.minor?.stage ?? "unpublished"} ft, ${impacts.length} published impact notes.`,
      latitude: data.latitude,
      longitude: data.longitude,
      datumReferences: data.datums ?? null,
      lowestPublishedImpact: impacts.length
        ? Math.min(...impacts.map((n) => n.stage))
        : null,
    });
  } catch (error) {
    checks.push({
      kind: "official_station",
      id: lid,
      status: "unavailable",
      source: url,
      summary: `Source could not be checked: ${error.message}`,
    });
  }
}
const events = [
  {
    id: "backwater2019",
    site: "07288800",
    start: "2019-01-01",
    end: "2019-08-31",
    file: "dv_backwater2019.json",
  },
  {
    id: "pearl2020",
    site: "02486000",
    start: "2020-02-01",
    end: "2020-03-05",
    file: "dv_pearl2020.json",
  },
  {
    id: "pearl2022",
    site: "02486000",
    start: "2022-08-15",
    end: "2022-09-15",
    file: "dv_pearl2022.json",
  },
];
function readings(data) {
  const series = (data.value?.timeSeries ?? []).find(
    (s) =>
      s.variable?.variableCode?.some((c) => c.value === "00065") &&
      s.variable?.options?.option?.some((o) => o.optionCode === "00003"),
  );
  if (!series) throw Error("No daily mean gage-height series in source");
  return (series.values ?? [])
    .flatMap((group) => group.value ?? [])
    .filter((p) => Number.isFinite(Number(p.value)) && Number(p.value) > -100)
    .map((p) => [p.dateTime.slice(0, 10), Number(p.value)])
    .sort((a, b) => a[0].localeCompare(b[0]));
}
for (const event of events) {
  const source = `https://waterservices.usgs.gov/nwis/dv/?format=json&sites=${event.site}&startDT=${event.start}&endDT=${event.end}&parameterCd=00065&statCd=00003`;
  const stored = JSON.parse(
    await readFile(path.join(root, "lib/replay-data", event.file), "utf8"),
  );
  const expected = readings(stored);
  try {
    const actual = readings(await get(source));
    const byDay = new Map(actual);
    const mismatches = expected.filter(
      ([date, value]) => byDay.get(date) !== value,
    );
    const extra = actual.filter(
      ([date]) => !expected.some((row) => row[0] === date),
    );
    const pass =
      expected.length > 0 && mismatches.length === 0 && extra.length === 0;
    checks.push({
      kind: "historical_record",
      id: event.id,
      status: pass ? "passed" : "mismatch",
      source,
      summary: `${expected.length} stored daily means checked; ${mismatches.length} missing or different readings; ${extra.length} extra source dates.`,
      storedDays: expected.length,
      sourceDays: actual.length,
      storedPeakDailyMean: Math.max(...expected.map((r) => r[1])),
      mismatches: mismatches.slice(0, 10),
      normalizedStoredSha256: createHash("sha256")
        .update(JSON.stringify(expected))
        .digest("hex"),
    });
  } catch (error) {
    checks.push({
      kind: "historical_record",
      id: event.id,
      status: "unavailable",
      source,
      summary: `Live recheck unavailable: ${error.message}. Stored records are not independently confirmed by this run.`,
      storedDays: expected.length,
    });
  }
}
const report = {
  checkedAt: now,
  method:
    "Automated comparison with official NOAA/NWS metadata and USGS daily-mean responses. No manual field study or property flood validation.",
  checks,
  totals: {
    passed: checks.filter((c) => c.status === "passed").length,
    mismatch: checks.filter((c) => c.status === "mismatch").length,
    unavailable: checks.filter((c) => c.status === "unavailable").length,
  },
};
await writeFile(
  path.resolve(root, output),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      output,
      checkedAt: now,
      totals: report.totals,
      checks: checks.map((c) => ({
        id: c.id,
        status: c.status,
        summary: c.summary,
      })),
    },
    null,
    2,
  ),
);
if (report.totals.mismatch) process.exitCode = 1;
