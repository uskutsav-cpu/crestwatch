import { SiteLink as Link } from "@/components/experience/SiteLink";
import { ArrowRight, ArrowUpRight, Info, ShieldCheck } from "lucide-react";
export const metadata = { title: "How it works" };
export default function Page() {
  return (
    <div className="article-page page-enter">
      <div className="page-title">
        <span className="eyebrow">Sources & methods</span>
        <h1>
          How CrestWatch works
        </h1>
        <p>
          Where the readings come from, what they mean, and what they can
          tell you about a place.
        </p>
      </div>
      <section className="article-section">
        <h2>Three pieces of the picture.</h2>
        <div className="process-grid">
          <div>
            <span className="step-num">01</span>
            <h3>Locate your place</h3>
            <p>
              Census, OpenStreetMap, and Open-Meteo locate an approximate point.
              Confirm it on the map. A matched address is not a surveyed
              building location.
            </p>
          </div>
          <div>
            <span className="step-num">02</span>
            <h3>Read the river</h3>
            <p>
              NOAA’s National Water Prediction Service provides gauge readings,
              flood stages, and official forecasts. A nearby gauge adds context;
              proximity alone does not prove a waterway connection.
            </p>
          </div>
          <div>
            <span className="step-num">03</span>
            <h3>Keep the context</h3>
            <p>
              USGS ground height helps explain local terrain. We keep river
              stage and estimated ground height distinct rather than claim
              whether water reaches a house.
            </p>
          </div>
        </div>
      </section>
      <section className="article-section">
        <h2>Stage is not depth at your house.</h2>
        <p>
          A river stage of 43 feet means 43 feet above that gauge’s own zero
          mark. It does not mean 43 feet of water in the neighborhood. Each
          gauge has its own reference, so readings from different gauges are not
          directly comparable.
        </p>
        <p>
          At the gauge, water-surface elevation can be calculated by adding
          stage to a verified gauge-zero elevation. A comparison with ground
          requires the same vertical reference, an accurate location, and a
          suitable relationship between the gauge and the landscape. NAVD88 and
          NGVD29 are different references. This version does not apply an
          assumed conversion.
        </p>
        <div className="notice">
          <Info size={18} />
          <p>
            Even with matching elevations, subtraction does not model whether
            water can reach a point. River slope, levees, floodwalls, backwater,
            and local drainage all affect actual flooding. CrestWatch has not
            validated property inundation or calibrated a probability model. It
            does not label a home “safe,” forecast doorway depth, or calculate
            an evacuation route.
          </p>
        </div>
      </section>
      <section className="article-section">
        <h2>What fresh means here.</h2>
        <p>
          River observations older than two hours are labeled older. Forecasts
          issued more than 24 hours ago are not used for the current forecast
          summary. An unsuccessful refresh keeps any previous answer visible
          with a failure notice; it never turns an outage into an all-clear.
        </p>
        <p>
          River data refreshes every 15 minutes while the app is open. Saved
          place briefings can remain readable for up to 12 hours if the
          connection drops. If the optional ground-elevation service fails, the
          place still saves and its nearby river briefing remains available;
          missing height is never replaced with zero. The app does not run in
          the background or send push alerts. Keep official emergency
          notifications enabled.
        </p>
      </section>
      <section className="article-section">
        <h2>Meet the sources.</h2>
        <div className="table-scroll">
          <table className="source-table">
            <thead>
              <tr>
                <th>THE INFORMATION</th>
                <th>THE SOURCE</th>
                <th>WHAT TO REMEMBER</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>River readings & forecasts</td>
                <td>
                  <a
                    href="https://water.noaa.gov/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    NOAA / NWS ↗
                  </a>
                </td>
                <td>Forecasts change. Readings describe a gauge location.</td>
              </tr>
              <tr>
                <td>Gauge metadata & historical readings</td>
                <td>
                  <a
                    href="https://waterdata.usgs.gov/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    USGS Water Data ↗
                  </a>
                </td>
                <td>Daily means differ from instantaneous crests.</td>
              </tr>
              <tr>
                <td>Estimated ground elevation</td>
                <td>
                  <a
                    href="https://apps.nationalmap.gov/epqs/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    USGS 3DEP / EPQS ↗
                  </a>
                </td>
                <td>Terrain model, not a floor survey.</td>
              </tr>
              <tr>
                <td>Address location</td>
                <td>
                  <a
                    href="https://www.census.gov/programs-surveys/geography/technical-documentation/complete-technical-documentation/census-geocoder.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    U.S. Census Geocoder ↗
                  </a>
                </td>
                <td>Interpolated along address ranges; approximate.</td>
              </tr>
              <tr>
                <td>Address & town fallback</td>
                <td>
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                  >
                    OpenStreetMap
                  </a>{" "}
                  /{" "}
                  <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open-Meteo
                  </a>
                </td>
                <td>Town and street matches can be far from a building.</td>
              </tr>
              <tr>
                <td>Base maps</td>
                <td>
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                  >
                    OpenStreetMap
                  </a>
                </td>
                <td>Map tiles are for orientation, not flood extent.</td>
              </tr>
              <tr>
                <td>Official weather alerts</td>
                <td>
                  <a
                    href="https://www.weather.gov/jan/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    National Weather Service ↗
                  </a>
                </td>
                <td>No returned alert is not an all-clear.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="article-section">
        <h2>Designed for honesty.</h2>
        <p>
          The app’s calculations are deterministic: public data, arithmetic, and
          explicit freshness checks. No language model generates the river
          readings or interprets the forecast. The source repository includes
          recorded-data tests for parsing, stale data, fallbacks, and
          calculation edge cases.
        </p>
        <p>
          Automated tests check software behavior. They do not prove
          hydrological accuracy. Real-world property validation and an
          independent specialist review remain outstanding; we don’t present a
          test count as evidence that a flood prediction is correct.
        </p>
        <Link href="/evidence" className="inline-link">
          Read the evidence & remaining work <ArrowRight size={14} />
        </Link>
      </section>
      <section className="article-section" id="privacy">
        <h2>Your places are yours.</h2>
        <p>
          Saved place names, approximate addresses, coordinates, and the last
          successful briefing live in your browser’s local storage. There are no
          user accounts, advertising trackers, or analytics. Remove a place from
          My places to remove it from the saved board.
        </p>
        <p>
          Address search sends your text to Census first, then OpenStreetMap
          Nominatim or Open-Meteo if needed. The server asks USGS and NOAA for
          location-based data and keeps short-lived caches in memory. Request
          counters limit excessive traffic by IP address. The hosting provider
          and upstream services may keep their own standard operational logs.
        </p>
        <p>
          Map tiles are requested directly from OpenStreetMap’s tile servers and
          reveal the viewed map area. Copying a watch link places your selected
          names, addresses, coordinates, and ground estimates inside the link.
          Only share locations you’re comfortable including.
        </p>
      </section>
      <div className="action-row">
        <Link href="/" className="primary-button">
          Back to the river <ArrowRight size={15} />
        </Link>
        <a
          href="https://github.com/shashankmadala/crestwatch"
          target="_blank"
          rel="noreferrer"
          className="secondary-button"
        >
          Original source repository <ArrowUpRight size={14} />
        </a>
      </div>
    </div>
  );
}
