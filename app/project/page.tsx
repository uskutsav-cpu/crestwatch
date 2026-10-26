import { SiteLink as Link } from "@/components/experience/SiteLink";
import { ArrowRight, ArrowUpRight, Activity, BookOpen, Layers3, MapPin } from "lucide-react";
import audit from "@/docs/audit/summary.json";
import verification from "@/docs/DATA_CHECK.json";
import "./project.css";

export const metadata = {
  title: "The project",
  description: "Explore how CrestWatch brings official river information into context, and see the evidence and limitations behind it.",
};

const steps = [
  { number: "01", label: "THE LIVE PICTURE", title: "Start with the river.", body: "Choose Vicksburg and compare the latest observation, forecast high, and flood stage. Check when each reading was issued.", href: "/#rivers", action: "View the river", icon: Activity },
  { number: "02", label: "LOCAL CONTEXT", title: "Connect a level to a place.", body: "Explore the 36.5 ft threshold and read the Weather Service’s published impact note. A threshold is not a live road closure.", href: "/?station=VCKM6&level=36.5#impact-explorer", action: "Explore an impact", icon: MapPin },
  { number: "03", label: "PAST FLOODS", title: "See how a flood unfolded.", body: "Replay the February 2020 Pearl River record and jump to its highest daily mean. The recorded daily values are not a forecast.", href: "/replay", action: "Open the replay", icon: Layers3 },
];

export default function Page() {
  return (
    <div className="project-redesign">
      <section className="pr-hero">
        <div className="pr-hero-copy">
          <span className="pr-kicker"><span aria-hidden="true" /> THE CRESTWATCH PROJECT</span>
          <h1>Know the river.<br /><em>Understand the story.</em></h1>
          <p>River levels are more than numbers. CrestWatch brings official forecasts, local context, and past floods together so you can see the bigger picture.</p>
          <div className="pr-actions">
            <a className="pr-primary" href="#walkthrough">Take the tour <ArrowRight size={17} /></a>
            <Link className="pr-text-link" href="/evidence">See the evidence <ArrowUpRight size={16} /></Link>
          </div>
        </div>
        <div className="pr-hero-art" aria-hidden="true">
          <div className="pr-art-top"><span>THE RIVER, IN CONTEXT</span><span>01 / 03</span></div>
          <div className="pr-art-title">A clearer picture<br />of your river.</div>
          <svg viewBox="0 0 500 240" preserveAspectRatio="none" focusable="false">
            <path d="M0 187 C65 168 92 191 152 152 S230 156 279 112 S355 126 405 78 S462 80 500 47 V240 H0Z" fill="#8eb9a5" opacity=".32" />
            <path d="M0 187 C65 168 92 191 152 152 S230 156 279 112 S355 126 405 78 S462 80 500 47" fill="none" stroke="#c9e6d4" strokeWidth="3" />
            <path d="M0 214 C80 195 108 218 172 188 S249 190 307 154 S396 164 455 122 S487 119 500 112" fill="none" stroke="#b4d5c0" strokeWidth="1" opacity=".55" />
            <circle cx="279" cy="112" r="6" fill="#e6f4e9" />
          </svg>
          <div className="pr-art-bottom"><span>OBSERVE</span><span>UNDERSTAND</span><span>PREPARE</span></div>
        </div>
      </section>
      <div className="pr-facts" aria-label="CrestWatch at a glance">
        <div><strong>4</strong><span>Mississippi gauges</span></div>
        <div><strong>3</strong><span>historical flood records</span></div>
        <div><strong>280</strong><span>recorded daily means</span></div>
        <div className="pr-facts-note"><span>Built around public data from</span><strong>NOAA &amp; USGS</strong></div>
      </div>
      <section className="pr-intro">
        <span className="pr-label">THE IDEA</span>
        <div><h2>A reading is a starting point.</h2><p>Official sources tell us what the river is doing. CrestWatch helps connect a gauge reading with its timing, published local impacts, and a place you recognize.</p><p className="pr-note">A nearby gauge provides context. It cannot tell you whether a particular property will flood.</p></div>
      </section>
      <section className="pr-tour" id="walkthrough">
        <div className="pr-heading"><div><span className="pr-label">EXPLORE CRESTWATCH</span><h2>Three ways to understand the river.</h2><p>Follow the information from today’s reading to a flood in the past.</p></div><span className="pr-duration">ABOUT 3 MINUTES</span></div>
        <div className="pr-cards">{steps.map(({icon: Icon, ...s}) => <article className="pr-card" key={s.number}><div className="pr-card-top"><span>{s.number} / {s.label}</span><Icon size={20} aria-hidden="true" /></div><h3>{s.title}</h3><p>{s.body}</p><Link href={s.href}>{s.action}<ArrowUpRight size={16} /></Link></article>)}</div>
      </section>
      <section className="pr-method">
        <div><span className="pr-label">HOW IT WORKS</span><h2>Good information.<br /><em>Clear boundaries.</em></h2><p>Built with TypeScript, React, and Next.js on Vercel, CrestWatch reads official NOAA/NWS and USGS data and makes its limits visible.</p><Link href="/methodology">Explore sources &amp; limitations <ArrowUpRight size={16} /></Link></div>
        <div className="pr-method-list">
          <article><span>01</span><div><h3>Time matters.</h3><p>Observations and forecasts have different timestamps. Threshold comparisons use fresh forecast issue times and future samples.</p></div></article>
          <article><span>02</span><div><h3>Source context stays intact.</h3><p>Impact notes come from the Weather Service. A forecast crossing a threshold does not establish when local flooding begins.</p></div></article>
          <article><span>03</span><div><h3>Missing data stays missing.</h3><p>A place can still show a nearby river briefing when ground elevation is unavailable. Older information is labeled.</p></div></article>
        </div>
      </section>
      <section className="pr-evidence" id="evidence">
        <div><span className="pr-label">THE EVIDENCE</span><h2>Check the work.<br />See what comes next.</h2><p>We compare stored records with their official sources and test the interface. Those checks do not establish property flood accuracy or prove that the app improves understanding.</p><Link className="pr-primary pr-primary-dark" href="/evidence">Explore the evidence <ArrowRight size={17} /></Link></div>
        <div className="pr-evidence-card"><BookOpen size={22} aria-hidden="true" /><div className="pr-evidence-stat"><strong>{verification.totals.passed}</strong><span>official-source checks</span></div><p>Four station records and 280 recorded daily means checked against their sources.</p><div className="pr-evidence-divider"/><div className="pr-evidence-stat"><strong>{audit.total.toLocaleString("en-US")}</strong><span>automated browser checks</span></div><p>These are software checks, with zero human participants in the audit.</p></div>
      </section>
      <section className="pr-next"><div><span className="pr-label">WHAT COMES NEXT</span><h2>Understanding needs real people.</h2><p>Resident usability results and specialist review are not yet included in the evidence record. Explore the study or review the project’s approach.</p></div><div className="pr-next-links"><Link href="/test">Take the self-guided comparison <ArrowUpRight size={17}/></Link><a href="/crestwatch-review-kit.md" download>Download the review kit <ArrowUpRight size={17}/></a><Link href="/about">Read the project story <ArrowUpRight size={17}/></Link></div></section>
    </div>
  );
}
