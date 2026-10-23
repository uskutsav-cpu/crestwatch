import { copy } from "@/lib/copy";

/* Plain-words glossary for the Watch and Why screens. A native
   <details>, so it opens and closes with no client JS. Kept quiet:
   small dim text, no card, closed by default. */
export function Glossary() {
  return (
    <details className="mb-10 max-w-prose text-small text-dim">
      <summary className="w-fit cursor-pointer rounded-lg py-3.5 font-semibold transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg">
        {copy.glossarySummary}
      </summary>
      <dl className="mt-1 flex flex-col gap-3 border-l border-line pl-4">
        {copy.glossary.map(({ term, text }) => (
          <div key={term}>
            <dt className="font-semibold text-fg">{term}</dt>
            <dd className="mt-0.5">{text}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
