import type { Metadata } from "next";
import { ReplayClient } from "@/components/replay/ReplayClient";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.pageTitleReplay,
};

/* S5 · Replay. */
export default function ReplayPage() {
  return <ReplayClient />;
}
