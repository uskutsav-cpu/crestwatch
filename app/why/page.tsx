import { SiteLink as Link } from "@/components/experience/SiteLink";
export const metadata = { title: "Behind the numbers" };
export default function Page() {
  return (
    <div className="article-page">
      <div className="page-title">
        <span className="eyebrow">BEHIND THE NUMBERS</span>
        <h1>Every number has a source.</h1>
        <p>
          A forecast describes the river at its gauge. Ground elevation
          describes a point on land. Combining them requires more than a
          subtraction.
        </p>
      </div>
      <section className="article-section">
        <h2>The arithmetic is simple. The landscape isn’t.</h2>
        <p>
          Water-surface elevation at a gauge equals its zero elevation plus the
          stage reading, when those values share a verified vertical datum.
          Comparing that value with ground elsewhere does not model waterway
          connectivity, levees, drainage, river slope, or a building’s floor
          height.
        </p>
        <p>
          CrestWatch therefore shows nearby river context and estimated ground
          elevation separately. It does not call a property safe or predict that
          water reaches a doorway.
        </p>
        <Link href="/methodology" className="primary-button">
          Read the full methodology →
        </Link>
      </section>
      <Link href="/watch" className="secondary-button">
        Back to my briefing →
      </Link>
    </div>
  );
}
