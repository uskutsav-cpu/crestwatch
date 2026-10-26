import { Suspense } from "react";
import { PlaceWatch } from "@/components/experience/PlaceWatch";
export const metadata = { title: "Your place briefing" };
export default function Page() {
  return (
    <Suspense>
      <PlaceWatch />
    </Suspense>
  );
}
