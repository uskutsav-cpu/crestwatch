import { Suspense } from "react";
import { WatchClient } from "@/components/watch/WatchClient";

/* S2 · Watch — the money screen. */
export default function WatchPage() {
  return (
    <Suspense>
      <WatchClient />
    </Suspense>
  );
}
