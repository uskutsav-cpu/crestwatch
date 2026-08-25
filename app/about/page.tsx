import type { Metadata } from "next";
import { PURPOSE_SENTENCE } from "@/lib/config";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: "About · CrestWatch",
  description: PURPOSE_SENTENCE,
};

/* S6 · About (T12, Appendix F). ⚠ story stats: TEAM re-verify before
   shipping — see docs/VALIDATION.md checklist. */
export default function AboutPage() {
  return (
    <div className="flex flex-col gap-10 py-12">
      {/* 1 · Purpose */}
      <section>
        <h1 className="text-h2">About CrestWatch</h1>
        <p className="mt-3 max-w-prose text-body leading-relaxed">
          {PURPOSE_SENTENCE}
        </p>
      </section>

      {/* 2 · The problem */}
      <section className="max-w-prose">
        <h2 className="text-h2">The problem</h2>
        <p className="mt-3 text-body leading-relaxed text-dim">
          In 1927 the levee broke at Mounds Landing near Greenville and put
          much of our district under water — the most destructive river flood
          in American history. In 2019, the Yazoo backwater flood kept over
          half a million acres of the south Delta underwater for about six
          months. In August 2022 the Pearl River flooded Jackson and knocked
          out the city&apos;s water plant (
          <a
            className="text-(--color-current)"
            href="https://www.cnn.com/2022/09/02/us/jackson-mississippi-water-crisis-what-we-know/index.html"
            target="_blank"
            rel="noreferrer"
          >
            CNN
          </a>
          ). Every one of these floods was forecast days ahead — on
          government pages written for engineers.
        </p>
      </section>

      {/* 3 · What CrestWatch does — the 3-box diagram */}
      <section>
        <h2 className="text-h2">What CrestWatch does</h2>
        <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["📡", "Read the gauges", "River gauges and the official NWS crest forecasts, straight from USGS and NOAA."],
            ["📐", "Compare to YOUR ground", "Your address becomes an elevation. The gauge's forecast becomes a water level. One subtraction."],
            ["🗣", "Say it in one sentence", "When the water is coming, how high, and whether it reaches your door."],
          ].map(([icon, title, body]) => (
            <li key={title} className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-h2">{icon}</p>
              <p className="mt-1 text-body font-semibold">{title}</p>
              <p className="mt-1 text-small text-dim">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 4 · Honesty (verbatim) */}
      <section className="max-w-prose">
        <h2 className="text-h2">What it can&apos;t do</h2>
        <p className="mt-3 rounded-2xl border border-line bg-surface p-5 text-body leading-relaxed">
          {copy.honesty}
        </p>
      </section>

      {/* 5 · Privacy */}
      <section className="max-w-prose">
        <h2 className="text-h2">Privacy</h2>
        <p className="mt-3 text-body text-dim">{copy.aboutPrivacy}</p>
      </section>

      {/* 6 · Disclosure */}
      <section className="max-w-prose">
        <h2 className="text-h2">How it was built</h2>
        <p className="mt-3 text-body text-dim">
          automated-assisted build, fully disclosed — the product itself uses no automated,
          only public federal data and arithmetic. Next.js + TypeScript on
          free, keyless federal APIs: USGS, NOAA, Census. See{" "}
          <a
            className="text-(--color-current)"
            href="https://github.com/shashankmadala/crestwatch/blob/main/docs/VALIDATION.md"
            target="_blank"
            rel="noreferrer"
          >
            docs/VALIDATION.md
          </a>
          .
        </p>
      </section>

      {/* 7 · Team */}
      <section className="max-w-prose">
        <h2 className="text-h2">Who we are</h2>
        <p className="mt-3 text-body text-dim">
          Built by students in Mississippi&apos;s Second Congressional
          District. A Congressional App Challenge 2026 entry.
          {/* TEAM: add names before submission. */}
        </p>
      </section>
    </div>
  );
}
