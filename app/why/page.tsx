import { Suspense } from "react";
import { WhyClient } from "@/components/why/WhyClient";

/* S4 · Why — the no-magic screen. */
export default function WhyPage() {
  return (
    <Suspense>
      <WhyClient />
    </Suspense>
  );
}
