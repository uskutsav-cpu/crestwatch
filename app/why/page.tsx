import { copy } from "@/lib/copy";

/* S4 · Why — T09 builds the no-magic screen. */
export default function WhyPage() {
  return (
    <div className="py-14">
      <h1 className="text-h2">{copy.whyTitle}</h1>
      <p className="mt-2 text-dim">The arithmetic lands here at T09.</p>
    </div>
  );
}
