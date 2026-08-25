import { copy } from "@/lib/copy";

/* S3 · Places — T08 builds the pins board. */
export default function PlacesPage() {
  return (
    <div className="py-14">
      <h1 className="text-h2">{copy.placesTitle}</h1>
      <p className="mt-4 rounded-2xl border border-dashed border-line bg-surface p-6 text-dim">
        {copy.placesEmpty}
      </p>
    </div>
  );
}
