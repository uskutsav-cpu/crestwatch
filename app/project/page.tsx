import { SiteLink as Link } from "@/components/experience/SiteLink";
import {
  ArrowRight,
  ArrowUpRight,
  Waves,
  CheckCircle2,
  Download,
  Code2,
} from "lucide-react";
import audit from "@/docs/audit/summary.json";
import verification from "@/docs/DATA_CHECK.json";
export const metadata = {
  title: "The project",
  description:
    "A hands-on walkthrough of CrestWatch, its engineering decisions, official data checks, and the validation still to do.",
};
const steps = [
  {
    n: "01",
    label: "READ THE RIVER",
    title: "Find the current picture.",
    body: "Choose Vicksburg on the live map. Read the observation time, forecast high, and flood stage. Each number belongs to that gauge’s own reference.",
    href: "/#rivers",
    action: "Open live rivers",
    check: "Can you tell an observation from a forecast?",
  },
  {
    n: "02",
    label: "CONNECT THE CONTEXT",
    title: "Explore a documented impact.",
    body: "Open the 36.5 ft Vicksburg threshold. Compare that what-if level with the official forecast and read the Weather Service’s local impact statement. Reset to return to the forecast.",
    href: "/?station=VCKM6&level=36.5#impact-explorer",
    action: "Try the impact explorer",
    check: "Can you explain why a threshold is not a current road closure?",
  },
  {
    n: "03",
    label: "LOOK BACK",
    title: "Replay the rise and return.",
    body: "Play the February 2020 Pearl River record. Jump to the highest daily mean, then look at how long the river stayed above flood stage. These are recorded USGS values, not a forecast.",
    href: "/replay",
    action: "Replay a real flood",
    check: "What does a daily mean leave out?",
  },
];
export default function Page() {
  return (
    <div className="project-page page-enter">
      <section className="project-hero">
        <span className="eyebrow">CRESTWATCH · PROJECT WALKTHROUGH</span>
        <h1>
          Public data.
          <br />
          <em>Human understanding.</em>
        </h1>
        <p>
          A river gauge gives you a number. CrestWatch helps you place it in
          context: what was observed, what is forecast, and what the official
          impact notes actually say.
        </p>
        <div className="project-hero-actions">
          <a className="primary-button" href="#walkthrough">
            Take the three-minute tour <ArrowRight size={17} />
          </a>
          <Link className="text-button" href="/evidence">
            Inspect the evidence <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
      <div className="project-facts">
        <div>
          <strong>4</strong>
          <span>Mississippi gauges</span>
        </div>
        <div>
          <strong>3</strong>
          <span>historical flood records</span>
        </div>
        <div>
          <strong>280</strong>
          <span>stored USGS daily means</span>
        </div>
        <div>
          <Waves size={31} />
          <span>
            Official forecasts.
            <br />
            No automated predictions.
          </span>
        </div>
      </div>
      <section className="project-question">
        <span className="eyebrow">THE DESIGN QUESTION</span>
        <h2>“What does this river reading mean?”</h2>
        <div>
          <p>
            NOAA and USGS already publish the underlying data. CrestWatch’s
            contribution is the connection between the reading, its timing,
            published local thresholds, and a place someone recognizes.
          </p>
          <p>
            The design keeps uncertainty visible. A nearby gauge provides
            context; it does not establish that a river can flood a property. A
            polished interface should make that distinction easier to
            understand.
          </p>
        </div>
      </section>
      <section id="walkthrough" className="project-walkthrough">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TRY IT YOURSELF</span>
            <h2>Three steps. One connected picture.</h2>
          </div>
          <span className="tour-duration">ABOUT 3 MINUTES</span>
        </div>
        {steps.map((s) => (
          <article className="tour-step" key={s.n}>
            <span className="tour-number">{s.n}</span>
            <div>
              <span className="eyebrow">{s.label}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <span className="tour-check">
                <CheckCircle2 size={15} />
                {s.check}
              </span>
            </div>
            <Link href={s.href} className="secondary-button">
              {s.action}
              <ArrowUpRight size={16} />
            </Link>
          </article>
        ))}
      </section>
      <section className="project-engineering">
        <div>
          <span className="eyebrow">
            <Code2 size={15} /> THE ENGINEERING
          </span>
          <h2>
            Useful decisions.
            <br />
            Visible consequences.
          </h2>
          <p>
            TypeScript and React power the interface. Data adapters read
            official NOAA/NWS and USGS responses. The Sites edition runs on
            Vinext and Cloudflare Workers.
          </p>
        </div>
        <div className="engineering-decisions">
          <article>
            <span>01 / FRESHNESS</span>
            <h3>Issue time matters.</h3>
            <p>
              A forecast can contain future points even when it was issued long
              ago. Current threshold comparisons require an issue time within 24
              hours and use only samples still in the future.
            </p>
          </article>
          <article>
            <span>02 / INTERPRETATION</span>
            <h3>Show the source, preserve its meaning.</h3>
            <p>
              The threshold explorer uses the Weather Service’s stage-specific
              statements. It reports the first forecast sample at or above a
              threshold without inventing the time local flooding begins.
            </p>
          </article>
          <article>
            <span>03 / RESILIENCE</span>
            <h3>Missing is a real state.</h3>
            <p>
              An unavailable elevation stays null through saving and sharing. A
              place can still open its nearby river briefing. Failed refreshes
              retain prior observations with an older-data notice.
            </p>
          </article>
          <article>
            <span>04 / VERIFICATION</span>
            <h3>Test the failure paths, too.</h3>
            <p>
              Regression tests cover parsers, stale forecasts, malformed shared
              links, optional elevation, and request isolation. A separate
              source check compares all stored historical dates and values with
              official USGS responses.
            </p>
          </article>
        </div>
      </section>
      <section className="project-evidence">
        <div>
          <span className="eyebrow">CHECKABLE EVIDENCE</span>
          <h2>
            {verification.totals.passed} official-source checks.
            <br />A dated, inspectable record.
          </h2>
          <p>
            The source check covers four NOAA/NWS station records and all 280
            daily means in the three historical replays. This establishes
            agreement with source data at the check time.
          </p>
          <p>A separate supplied browser audit records {audit.total.toLocaleString("en-US")} checks marked PASS across four gauges: {audit.slider} slider scenarios and {audit.other} other checks. It includes a date-display finding addressed in this update. These are automated checks, with zero human participants in that audit.</p>
          <Link className="inline-link" href="/evidence#automated-audit">
            Open the verification report <ArrowRight size={16} />
          </Link>
        </div>
        <div className="evidence-boundary">
          <span className="eyebrow">WHAT REMAINS TO BE ESTABLISHED</span>
          <h3>Real-world understanding needs real people.</h3>
          <p>
            Scored resident usability results and specialist review are not
            included in this evidence record. Property flood accuracy and
            official endorsement are not claimed.
          </p>
          <a
            className="secondary-button"
            href="/crestwatch-review-kit.md"
            download
          >
            <Download size={15} /> Download the review kit
          </a>
          <Link className="inline-link" href="/test">
            Take the self-guided comparison <ArrowRight size={15} />
          </Link>
          <p className="kit-caption">
            A task script, results sheet, and specialist checklist. Blank
            results stay blank until testing happens.
          </p>
        </div>
      </section>
      <section className="project-authorship">
        <h2>Built with assistance. Explained honestly.</h2>
        <p>
          automated coding tools contributed substantially to the original
          implementation and this redesign. They do not generate CrestWatch’s
          river forecasts. Competition materials should identify the students’
          actual work and demonstrate their understanding of the code, data, and
          tradeoffs.
        </p>
        <Link href="/about" className="inline-link">
          Read the project story <ArrowUpRight size={15} />
        </Link>
      </section>
      <div className="project-return">
        <Link href="/" className="primary-button">
          Explore CrestWatch <ArrowRight size={16} />
        </Link>
        <Link href="/methodology" className="text-button">
          Sources & limitations <ArrowUpRight size={15} />
        </Link>
      </div>
    </div>
  );
}
