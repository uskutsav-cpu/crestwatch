import type { Metadata } from "next";
import { PlacesClient } from "@/components/places/PlacesClient";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.pageTitlePlaces,
};

/* S3 · Places. */
export default function PlacesPage() {
  return <PlacesClient />;
}
