import { describe, it, expect } from "vitest";
import { makeCsv, csvCell } from "@/lib/csv";
import {
  readStudy,
  studyCsv,
  validResult,
  type StudyResult,
} from "@/lib/study";
const result: StudyResult = {
  id: "test-1",
  participant: "P01",
  condition: "crestwatch",
  task: "observation",
  elapsedMs: 12500,
  outcome: "assisted",
  understanding: "partial",
  note: "Needed help, then explained it.",
  recordedAt: "2026-10-25T18:00:00Z",
};
describe("Local study evidence", () => {
  it("preserves assisted completion and partial understanding separately", () => {
    const rows = readStudy(JSON.stringify([result]));
    expect(rows).toEqual([result]);
    expect(studyCsv(rows)).toContain('12.5,"assisted","partial"');
  });
  it("rejects corrupt storage, private identifiers, invalid timings, and unknown tasks", () => {
    expect(readStudy("broken")).toEqual([]);
    expect(readStudy("{}")).toEqual([]);
    for (const change of [
      { participant: "person@example.com" },
      { elapsedMs: -1 },
      { elapsedMs: Infinity },
      { elapsedMs: 86400001 },
      { task: "unknown" },
      { understanding: "excellent" },
      { outcome: "" },
      { recordedAt: "invalid" },
    ])
      expect(validResult({ ...result, ...change })).toBe(false);
  });
  it("does not turn an empty study into participant evidence", () => {
    expect(readStudy(null)).toEqual([]);
    expect(studyCsv([]).split("\r\n").filter(Boolean)).toHaveLength(1);
  });
  it("neutralizes formula-bearing notes while preserving numeric measurements", () => {
    expect(studyCsv([{ ...result, note: '=HYPERLINK("bad")' }])).toContain(
      '"\'=HYPERLINK(""bad"")"',
    );
    expect(csvCell(-1.2)).toBe("-1.2");
    expect(csvCell(" @SUM(1)")).toBe('"\' @SUM(1)"');
  });
  it("escapes delimiters, quotes, and newlines without dropping observations", () => {
    const csv = makeCsv(["note"], [['A,"B"\nC']]);
    expect(csv).toBe('"note"\r\n"A,""B""\nC"\r\n');
  });
  it("filters individual invalid records while retaining valid observations", () => {
    expect(
      readStudy(JSON.stringify([result, { ...result, elapsedMs: null }, null])),
    ).toEqual([result]);
  });
});
