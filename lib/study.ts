import { makeCsv } from "./csv";
export const STUDY_TASKS = [
  {
    id: "observation",
    title: "Find the latest observation",
    prompt:
      "Find the Mississippi River at Vicksburg. State its latest observed stage, the observation time, and whether that observation is recent.",
    check:
      "A correct explanation distinguishes the observation time from the time the page was opened.",
    app: "/?station=VCKM6#river-timeline",
  },
  {
    id: "forecast",
    title: "Explain the forecast",
    prompt:
      "Find Vicksburg’s forecast high and official flood stage. Explain whether they establish that a particular home will stay dry.",
    check:
      "A correct explanation identifies the forecast high and gauge flood stage, and does not treat them as a property all-clear.",
    app: "/?station=VCKM6#river-timeline",
  },
  {
    id: "threshold",
    title: "Interpret a local impact",
    prompt:
      "Find the 36.5 ft Vicksburg impact statement. Explain whether the statement proves that a road is closed right now.",
    check:
      "A correct explanation treats the statement as a stage-specific impact description and checks current observations/forecasts rather than inferring a live closure.",
    app: "/?station=VCKM6#river-timeline",
  },
] as const;
export type StudyCondition = "crestwatch" | "official";
export type StudyOutcome = "unaided" | "assisted" | "incomplete";
export type StudyUnderstanding =
  "correct" | "partial" | "incorrect" | "not_assessed";
export interface StudyResult {
  id: string;
  participant: string;
  condition: StudyCondition;
  task: string;
  elapsedMs: number;
  outcome: StudyOutcome;
  understanding: StudyUnderstanding;
  note: string;
  recordedAt: string;
}
export const STUDY_KEY = "crestwatch.study.v1";
export function validResult(raw: unknown): raw is StudyResult {
  const r = raw as StudyResult;
  return (
    !!r &&
    typeof r.id === "string" &&
    r.id.length <= 100 &&
    typeof r.participant === "string" &&
    /^[A-Za-z0-9_-]{1,20}$/.test(r.participant) &&
    ["crestwatch", "official"].includes(r.condition) &&
    STUDY_TASKS.some((t) => t.id === r.task) &&
    Number.isFinite(r.elapsedMs) &&
    r.elapsedMs >= 0 &&
    r.elapsedMs <= 86400000 &&
    ["unaided", "assisted", "incomplete"].includes(r.outcome) &&
    ["correct", "partial", "incorrect", "not_assessed"].includes(
      r.understanding,
    ) &&
    typeof r.note === "string" &&
    r.note.length <= 500 &&
    typeof r.recordedAt === "string" &&
    Number.isFinite(Date.parse(r.recordedAt))
  );
}
export function readStudy(raw: string | null): StudyResult[] {
  try {
    const value = JSON.parse(raw ?? "null");
    return Array.isArray(value) ? value.filter(validResult).slice(-300) : [];
  } catch {
    return [];
  }
}
export function studyCsv(rows: StudyResult[]) {
  return makeCsv(
    [
      "participant_code",
      "condition",
      "task",
      "elapsed_seconds",
      "completion",
      "understanding",
      "facilitator_note",
      "recorded_at_utc",
    ],
    rows
      .filter(validResult)
      .map((r) => [
        r.participant,
        r.condition,
        r.task,
        Number((r.elapsedMs / 1000).toFixed(1)),
        r.outcome,
        r.understanding,
        r.note,
        r.recordedAt,
      ]),
  );
}
