import { SiteLink as Link } from "@/components/experience/SiteLink";
import verification from "@/docs/DATA_CHECK.json";
import { AutomatedEvidence } from "@/components/experience/AutomatedEvidence";
export const metadata = { title: "Evidence & field notes" };
export default function Page() {
  return (
    <div className="article-page">
      <div className="page-title">
        <span className="eyebrow">EVIDENCE, NOT ASSUMPTIONS</span>
        <h1>
          What we know.
          <br />
          <em>What we’re still checking.</em>
        </h1>
        <p>An honest account of the app’s scope and the evidence it needs.</p>
      </div>
      <section className="article-section">
        <h2>Where the evidence comes from.</h2>
        <p>
          Current river observations and forecasts come from NOAA/NWS, and the
          historical explorer uses recorded USGS daily values from three
          Mississippi floods. Every briefing links to its official station.
          Historical records are clearly distinguished from live data.
        </p>
      </section>
      <AutomatedEvidence />
      <section className="article-section">
        <h2>Separate official-source verification record.</h2>
        <p>
          Checked{" "}
          {new Intl.DateTimeFormat("en-US", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "America/Chicago",
          }).format(new Date(verification.checkedAt))}{" "}
          Central time. {verification.totals.passed} checks passed,{" "}
          {verification.totals.mismatch} mismatches,{" "}
          {verification.totals.unavailable} unavailable sources.
        </p>
        <div className="table-scroll">
          <table className="source-table">
            <thead>
              <tr>
                <th>CHECK</th>
                <th>RESULT</th>
                <th>OFFICIAL EVIDENCE</th>
              </tr>
            </thead>
            <tbody>
              {verification.checks.map((check) => (
                <tr key={check.id}>
                  <td>{check.id}</td>
                  <td>
                    {check.status === "passed"
                      ? "Matched official source"
                      : check.status === "mismatch"
                        ? "Mismatch found"
                        : "Not verified"}
                  </td>
                  <td>
                    <p>{check.summary}</p>
                    <a href={check.source} target="_blank" rel="noreferrer">
                      Open source response ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The three historical records contain 280 daily means in total. The
          automated check compares dates and values with fresh USGS daily-mean
          responses and records the result, including failures. It can be rerun
          with <code>node scripts/verify-source-data.mjs</code>. This
          establishes source-data agreement at the check time, not the accuracy
          of a property flood prediction.
        </p>
      </section>
      <section className="article-section">
        <h2>What software tests can establish.</h2>
        <p>
          Recorded fixtures exercise the data adapters, timestamp checks,
          unavailable data, forecast calculations, and storage behavior. Focused
          safety tests verify that the new user experience does not turn stale
          readings, a nearby gauge, or an elevation subtraction into an
          all-clear about a house.
        </p>
        <p>
          Test results for this delivered version are included in its release
          notes. A green test suite is evidence about the software, not proof of
          real-world flood accuracy.
        </p>
      </section>
      <section className="article-section">
        <h2>What is not established.</h2>
        <p>
          No independent property inundation validation is claimed. The original
          validation log has unfilled field-test rows. No resident usability
          study, specialist endorsement, forecast probability calibration, or
          levee modeling is claimed in this version.
        </p>
      </section>
      <section className="article-section">
        <h2>The next field study.</h2>
        <p>
          Check known flooded and known dry public sites against official
          event-specific inundation products and documented observations. Record
          how the location was determined, which gauge applies, datum
          compatibility, levee protection, and any disagreement. Keep
          calibration sites separate from evaluation sites.
        </p>
        <p>
          Ask local residents to find a place, explain a stage reading, identify
          an older forecast, and name the correct source of emergency
          instructions. Record the misunderstandings and revise the product
          around those findings. A specialist review should assess the
          gauge-to-location relationship before any property prediction is
          introduced.
        </p>
      </section>
      <p><Link href="/test" className="secondary-button">Take the self-guided comparison →</Link></p>
      <Link href="/methodology" className="secondary-button">
        Read the methodology →
      </Link>
    </div>
  );
}
