import { copy } from "@/lib/copy";

/* S5 · Replay — T10 builds the historical replay. */
export default function ReplayPage() {
  return (
    <div className="py-14">
      <h1 className="text-h2">{copy.replayTitle}</h1>
      <p className="mt-2 text-dim">Historical floods land here at T10.</p>
    </div>
  );
}
