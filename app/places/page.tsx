import type { Metadata } from "next";
import { PlacesClient } from "@/components/places/PlacesClient";

export const metadata: Metadata = {
  title: "Your places · CrestWatch",
};

/* S3 · Places. */
export default function PlacesPage() {
  return <PlacesClient />;
}
