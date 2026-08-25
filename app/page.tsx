import { WaveMark } from "@/components/WaveMark";
import { copy } from "@/lib/copy";
import { SetupFlow } from "@/components/setup/SetupFlow";

/* S1 · Setup — hero + address entry. The flow itself is client-side
   (T06 fills in confirm + pins); the shell and copy live here. */
export default function SetupPage() {
  return (
    <div className="flex flex-col items-center gap-10 py-14">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-(--color-current)">
          <WaveMark size={64} />
        </span>
        <h1 className="text-display">{copy.appName}</h1>
        <p className="max-w-md text-body text-dim">{copy.tagline}</p>
      </div>

      <SetupFlow />

      <ol className="grid w-full max-w-xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
        {copy.howItWorks.map((step, i) => (
          <li
            key={step}
            className="rounded-2xl border border-line bg-surface p-4"
          >
            <p className="text-small font-semibold text-(--color-current)">
              {i + 1}
            </p>
            <p className="mt-1 text-small text-dim">{step}</p>
          </li>
        ))}
      </ol>

      <p className="text-small text-dim">{copy.privacyFooter}</p>
    </div>
  );
}
