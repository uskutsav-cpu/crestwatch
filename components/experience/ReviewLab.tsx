"use client";
import { useEffect, useState } from "react";
import {
  Play,
  Square,
  Download,
  ArrowUpRight,
  ArrowRight,
  Trash2,
  RotateCcw,
  ClipboardCheck,
} from "lucide-react";
import { SiteLink as Link } from "./SiteLink";
import {
  STUDY_KEY,
  STUDY_TASKS,
  readStudy,
  studyCsv,
  validResult,
  type StudyResult,
  type StudyCondition,
  type StudyOutcome,
  type StudyUnderstanding,
} from "@/lib/study";
import { parseStudyCsv } from "@/lib/study-import";
import { studyReport } from "@/lib/study-report";
import { downloadText } from "@/lib/download";
export function ReviewLab() {
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<StudyResult[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [participant, setParticipant] = useState("");
  const [condition, setCondition] = useState<StudyCondition>("crestwatch");
  const [taskIndex, setTaskIndex] = useState(0);
  const [started, setStarted] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const [outcome, setOutcome] = useState<StudyOutcome | "">("");
  const [understanding, setUnderstanding] =
    useState<StudyUnderstanding>("not_assessed");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [removed, setRemoved] = useState<StudyResult | null>(null);
  const task = STUDY_TASKS[taskIndex];
  const codeValid = /^[A-Za-z0-9_-]{1,20}$/.test(participant);
  const seconds = (elapsed ?? clock) / 1000;
  useEffect(() => {
    try {
      setRows(readStudy(localStorage.getItem(STUDY_KEY)));
    } catch {
      setStorageError(true);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STUDY_KEY, JSON.stringify(rows));
    } catch {
      setStorageError(true);
    }
  }, [rows, ready]);
  useEffect(() => {
    if (started === null) return;
    const id = setInterval(
      () => setClock(Math.max(0, performance.now() - started)),
      250,
    );
    return () => clearInterval(id);
  }, [started]);
  function resetTiming() {
    setStarted(null);
    setElapsed(null);
    setClock(0);
    setOutcome("");
    setUnderstanding("not_assessed");
    setNote("");
  }
  async function importObservations(file: File) {
    if (importing) return;
    setImporting(true);
    try {
      if (file.size > 1000000) throw Error("CSV is too large. Maximum size is 1 MB.");
      const imported = parseStudyCsv(await file.text(), crypto.randomUUID());
      if (rows.length + imported.length > 300) throw Error("Import would exceed 300 observations. Export this browser’s records first; nothing was imported.");
      setRows(r => [...r, ...imported]);
      setNotice(`Imported ${imported.length} observations locally. Repeated participant/interface/task attempts remain in the raw data and are excluded from matched analysis.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Import failed. No records imported."); }
    finally { setImporting(false); }
  }
  function record() {
    if (!outcome || elapsed === null) return;
    if (rows.length >= 300) {
      setNotice(
        "This browser has 300 observations. Export and remove reviewed records before adding more.",
      );
      return;
    }
    const result: StudyResult = {
      id: crypto.randomUUID(),
      participant,
      condition,
      task: task.id,
      elapsedMs: Math.round(elapsed),
      outcome,
      understanding,
      note: note.trim(),
      recordedAt: new Date().toISOString(),
    };
    if (!validResult(result)) {
      setNotice(
        "Check the participant code and timing before recording. Restart timings longer than 24 hours.",
      );
      return;
    }
    setRows((r) => [...r, result]);
    setNotice(`Recorded ${task.title.toLowerCase()} for ${participant}.`);
    resetTiming();
    setTaskIndex((i) => (i + 1) % STUDY_TASKS.length);
  }
  const busy = started !== null || elapsed !== null || importing;
  return (
    <div className="review-page page-enter">
      <div className="page-title">
        <span className="eyebrow">
          <ClipboardCheck size={15} /> FOR STUDY FACILITATORS
        </span>
        <h1>
          Test understanding.
          <br />
          <em>Keep the evidence.</em>
        </h1>
        <p>
          A small, consistent task study can reveal where CrestWatch helps and
          where it confuses. Record real observations here; export them for
          review.
        </p>
      </div>
      <div className="study-export-actions" style={{ marginBottom: 24 }}>
        <a className="secondary-button" href="/crestwatch-facilitator.pdf" download>
          <Download size={15} /> Printable facilitator packet
        </a>
        <a className="secondary-button" href="/crestwatch-competition-kit.zip" download>
          <Download size={15} /> Testing & demo materials
        </a>
      </div>
      <a className="text-button" href="/crestwatch-comparison.zip" download>
        <Download size={15}/> Download the interface comparison & analysis guide
      </a>
      <section className="comparison-plan" aria-labelledby="comparison-plan-title">
        <p><Link href="/test" className="secondary-button">Open the self-guided participant link <ArrowUpRight size={16} /></Link></p>
        <p>Share /test for private central submission without a facilitator. This Review Lab stores its own records in this browser.</p>
        <span className="eyebrow">THE QUESTION WE ARE TESTING</span>
        <h2 id="comparison-plan-title">Does the explanation help?</h2>
        <p>Use the same three tasks on CrestWatch and the official NOAA page. Keep both successful and unsuccessful attempts. A faster lookup alone does not establish better understanding.</p>
        <div className="comparison-outcomes"><span>Both succeed</span><span>CrestWatch only</span><span>Official only</span><span>Neither succeeds</span></div>
        <p>The report compares matched participant/task pairs first. Assisted, incomplete, incorrect and unassessed attempts remain visible. A missing response is not proof of a misconception.</p>
        <label className="study-import-label">Import an existing observation CSV
          <input type="file" accept=".csv,text/csv" disabled={busy || !ready} onChange={e => {const file=e.target.files?.[0]; if(file) void importObservations(file); e.target.value="";}} />
        </label>
        <small>Local to this browser. Append original exports without editing outcomes; duplicate attempts are flagged rather than silently overwritten. No participant results are supplied with this tool.</small>
      </section>
      <div className="review-privacy">
        <strong>Local to this browser.</strong>
        <p>
          No responses are sent to a server. Use anonymous codes such as P01,
          public examples, and no private addresses or identifying notes.
          Storage can be cleared by the browser; export your records to keep
          them.
        </p>
      </div>
      <details className="study-protocol">
        <summary>Read the study protocol before starting</summary>
        <div>
          <p>
            Recruit willing participants and explain that you are testing the
            app, not them. Do not coach until you have recorded the unaided
            outcome. Record help separately from correct understanding.
          </p>
          <p>
            To compare with official pages, use the same tasks and device
            conditions. Have half the participants use official sources first;
            reverse the order for the others. Record both conditions under the
            same anonymous code. Learning effects and a small convenience sample
            limit any conclusions. Use a two-minute task limit, read only the
            task prompt aloud, and keep scoring guidance out of the participant’s
            view. Open the task page before starting the timer so page-loading
            delays are handled consistently in both interfaces.
          </p>
          <p>
            The timer includes time spent consulting source pages. Stop it when
            the participant finishes or gives up, then assess the explanation. A
            recorded result is a facilitator observation, not an independently
            verified outcome.
          </p>
          <a href="/crestwatch-review-kit.md" download className="text-button">
            Download the full protocol <Download size={13} />
          </a>
        </div>
      </details>
      <section className="review-workspace">
        <div className="review-setup">
          <span className="eyebrow">SESSION SETUP</span>
          <label>
            Anonymous participant code
            <input
              aria-label="Anonymous participant code"
              placeholder="P01"
              maxLength={20}
              value={participant}
              disabled={busy}
              onChange={(e) => setParticipant(e.target.value.trim())}
            />
          </label>
          <small>Letters, numbers, underscores, and hyphens only.</small>
          <label>
            Interface being tested
            <select
              aria-label="Interface being tested"
              value={condition}
              disabled={busy}
              onChange={(e) => setCondition(e.target.value as StudyCondition)}
            >
              <option value="crestwatch">CrestWatch</option>
              <option value="official">Official NOAA pages</option>
            </select>
          </label>
          <label>
            Task
            <select
              aria-label="Study task"
              value={taskIndex}
              disabled={busy}
              onChange={(e) => setTaskIndex(Number(e.target.value))}
            >
              {STUDY_TASKS.map((t, i) => (
                <option key={t.id} value={i}>
                  {i + 1}. {t.title}
                </option>
              ))}
            </select>
          </label>
          <div className="study-counter">
            <strong>{rows.length}</strong>
            <span>
              task observations recorded
              <br />
              {new Set(rows.map((r) => r.participant)).size} anonymous
              participant codes
            </span>
          </div>
        </div>
        <div className="review-task">
          <span className="eyebrow">
            TASK {taskIndex + 1} OF {STUDY_TASKS.length} ·{" "}
            {condition === "crestwatch" ? "CRESTWATCH" : "OFFICIAL SOURCES"}
          </span>
          <h2>{task.title}.</h2>
          <blockquote>{task.prompt}</blockquote>
          <div className="study-timer" aria-label="Task timer">
            <strong>{seconds.toFixed(1)}</strong>
            <span>seconds</span>
            <i>
              {started !== null
                ? "Timing in progress"
                : elapsed !== null
                  ? "Timing stopped"
                  : "Ready to start"}
            </i>
          </div>
          <p className="study-timing-tip">
            Keep this page open while timing. Task links open in a separate tab.
          </p>
          <div className="study-actions">
            {started === null && elapsed === null ? (
              <button
                className="primary-button"
                disabled={!codeValid || importing}
                onClick={() => {
                  setClock(0);
                  setStarted(performance.now());
                  setNotice("");
                }}
              >
                <Play size={15} /> Start task
              </button>
            ) : started !== null ? (
              <button
                className="primary-button"
                onClick={() => {
                  setElapsed(Math.max(0, performance.now() - started));
                  setStarted(null);
                }}
              >
                <Square size={14} /> Stop timer
              </button>
            ) : null}
            <a
              className="secondary-button"
              href={
                condition === "crestwatch"
                  ? task.app
                  : "https://water.noaa.gov/gauges/VCKM6"
              }
              target="_blank"
              rel="noreferrer"
            >
              Open{" "}
              {condition === "crestwatch"
                ? "CrestWatch task"
                : "official source"}{" "}
              <ArrowUpRight size={15} />
            </a>
          </div>
          {elapsed !== null && (
            <div className="study-assessment">
              <h3>Record what actually happened.</h3>
              <p className="assessor-guide">{task.check}</p>
              <div className="assessment-fields">
                <label>
                  Task completion
                  <select
                    aria-label="Task completion"
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value as StudyOutcome)}
                  >
                    <option value="">Select an outcome</option>
                    <option value="unaided">Completed without help</option>
                    <option value="assisted">Completed with help</option>
                    <option value="incomplete">Incomplete / gave up</option>
                  </select>
                </label>
                <label>
                  Explanation quality
                  <select
                    aria-label="Explanation quality"
                    value={understanding}
                    onChange={(e) =>
                      setUnderstanding(e.target.value as StudyUnderstanding)
                    }
                  >
                    <option value="not_assessed">Not assessed</option>
                    <option value="correct">Correct</option>
                    <option value="partial">Partly correct</option>
                    <option value="incorrect">Incorrect</option>
                  </select>
                </label>
              </div>
              <label className="study-note">
                Anonymous facilitator note
                <textarea
                  aria-label="Anonymous facilitator note"
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Participant’s own explanation first; then note any help, misunderstanding or interruption"
                />
              </label>
              <button
                className="primary-button"
                disabled={!outcome}
                onClick={record}
              >
                Record result & next task <ArrowRight size={15} />
              </button>
            </div>
          )}
          {busy && (
            <button
              className="text-button"
              onClick={() => {
                resetTiming();
                setNotice("Current timing discarded. No result was recorded.");
              }}
            >
              <RotateCcw size={13} /> Discard current timing
            </button>
          )}
        </div>
      </section>
      {notice && (
        <p className="study-notice" role="status">
          {notice}
        </p>
      )}
      {storageError && (
        <p className="inline-warning" role="status">
          Browser storage is unavailable. Records remain in this open page;
          export before closing it.
        </p>
      )}
      <section className="study-results">
        <div className="section-heading">
          <div>
            <span className="eyebrow">RECORDED OBSERVATIONS</span>
            <h2>Your evidence starts here.</h2>
          </div>
          <div className="study-export-actions">
          <button className="secondary-button" disabled={!rows.length}
            onClick={() => downloadText("crestwatch-pilot-report.md", studyReport(rows), "text/markdown")}>
            <Download size={15} /> Export descriptive report
          </button>
          <button
            className="secondary-button"
            disabled={!rows.length}
            onClick={() =>
              downloadText(
                "crestwatch-usability-observations.csv",
                studyCsv(rows),
                "text/csv",
              )
            }
          >
            <Download size={15} /> Export observations
          </button>
          </div>
        </div>
        {!ready ? (
          <p className="muted">Opening browser-local records…</p>
        ) : !rows.length ? (
          <div className="study-empty">
            No observations recorded. Starting the tool does not count as a
            participant test.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="source-table study-table">
              <thead>
                <tr>
                  <th>CODE / INTERFACE</th>
                  <th>TASK</th>
                  <th>TIME</th>
                  <th>COMPLETION</th>
                  <th>UNDERSTANDING</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.participant}
                      <small>
                        {r.condition === "crestwatch"
                          ? "CrestWatch"
                          : "Official sources"}
                      </small>
                    </td>
                    <td>{STUDY_TASKS.find((t) => t.id === r.task)?.title}</td>
                    <td>{(r.elapsedMs / 1000).toFixed(1)} s</td>
                    <td>{r.outcome}</td>
                    <td>{r.understanding.replace("_", " ")}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Remove observation ${r.id}`}
                        onClick={() => {
                          setRemoved(r);
                          setRows((rows) => rows.filter((x) => x.id !== r.id));
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {removed && (
          <div className="undo-note">
            <span>Observation removed.</span>
            <button
              onClick={() => {
                if (rows.length >= 300) {
                  setNotice(
                    "Export and remove a reviewed record before restoring this observation.",
                  );
                  return;
                }
                setRows((r) => [...r, removed]);
                setRemoved(null);
              }}
            >
              Undo
            </button>
            <button className="text-button" onClick={() => setRemoved(null)}>
              Dismiss
            </button>
          </div>
        )}
        <p className="study-boundary">
          These are local facilitator records. The public Evidence page does not
          automatically claim or publish them. Report your sample, failures,
          help given, and study limitations alongside any findings.
        </p>
      </section>
      <Link href="/project" className="return-live">
        Back to the project walkthrough <ArrowRight size={15} />
      </Link>
    </div>
  );
}
