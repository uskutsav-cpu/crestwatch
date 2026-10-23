import { copy } from "@/lib/copy";

export function Footer() {
  return (
    <footer className="mt-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-small text-dim">
        <p>
          {copy.footerLine.map((part) =>
            typeof part === "string" ? (
              part
            ) : (
              <a
                key={part.href}
                className="underline underline-offset-2"
                href={part.href}
                target="_blank"
                rel="noreferrer"
              >
                {part.text}
              </a>
            ),
          )}
        </p>
        <p className="mt-1">{copy.privacyFooter}</p>
      </div>
    </footer>
  );
}
