import { SiteLink as Link } from "@/components/experience/SiteLink";
import { Waves, ArrowRight } from "lucide-react";
export const metadata = { title: "Our story" };
export default function Page() {
  return (
    <div className="article-page page-enter">
      <div className="page-title">
        <span className="eyebrow">MADE FOR THE PLACES WE CALL HOME</span>
        <h1>
          The river is part
          <br />
          <em>of the story here.</em>
        </h1>
        <p>
          So the information about it should be understandable to everyone who
          lives alongside it.
        </p>
      </div>
      <div className="story-pullquote">
        <Waves size={30} />
        <blockquote>
          “What does that river reading mean for the place I care about?”
        </blockquote>
        <p>The question behind CrestWatch.</p>
      </div>
      <section className="article-section">
        <h2>A field guide for Mississippi.</h2>
        <p>
          CrestWatch began as a Congressional App Challenge project focused on
          Mississippi’s Second Congressional District. It brings together
          official river forecasts, public ground-elevation data, and historical
          records in a calmer, more understandable interface.
        </p>
        <p>
          There are good reasons not to turn a gauge reading into a confident
          answer about a home. River connections, levees, local drainage, survey
          precision, and vertical references all matter. The app makes those
          limits visible while giving people a useful starting point for
          understanding their nearby rivers.
        </p>
      </section>
      <section className="article-section">
        <h2>Small decisions, deliberately made.</h2>
        <p>
          No account wall before the river information. A real map to confirm a
          location. Source links beside the readings. Clear labels when a feed
          is old or unavailable. Historical observations that are never passed
          off as today’s forecast.
        </p>
        <p>
          Those choices are the product: helping people find context without
          creating false confidence.
        </p>
      </section>
      <section className="article-section">
        <h2>How this version was built.</h2>
        <p>
          The original CrestWatch repository uses TypeScript, React, and
          Next.js, with USGS, NOAA, and public geocoding services. This redesign
          retains its data adapters and test cases and adds a new interface,
          map-based location confirmation, river timelines, and a historical
          gauge explorer. It is deployed through Sites using the Vinext runtime.
        </p>
        <p>
          automated coding tools contributed substantially to the original
          implementation and this redesign. The app itself uses no automated to produce
          river forecasts. The repository’s automated disclosure should accompany any
          competition submission, alongside the students’ actual contributions
          and technical understanding.
        </p>
      </section>
      <section className="article-section">
        <h2>Work that still needs people.</h2>
        <p>
          Local resident testing, specialist review, and independent real-world
          validation cannot be replaced by a polished interface. These remain
          explicit next steps. The project does not claim a partnership,
          official endorsement, proven flood-prediction accuracy, or a
          guaranteed competition result.
        </p>
        <Link href="/evidence" className="inline-link">
          See the evidence and next steps <ArrowRight size={14} />
        </Link>
      </section>
      <Link href="/" className="primary-button">
        Explore CrestWatch <ArrowRight size={15} />
      </Link>
    </div>
  );
}
