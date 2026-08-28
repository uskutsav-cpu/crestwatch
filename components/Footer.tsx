import { copy } from "@/lib/copy";

export function Footer() {
  return (
    <footer className="mt-auto">
      <div className="mx-auto max-w-3xl px-4 py-8 text-center text-small text-dim">
        <p>{copy.footerLine}</p>
        <p className="mt-1">{copy.privacyFooter}</p>
      </div>
    </footer>
  );
}
