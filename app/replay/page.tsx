import type { Metadata } from "next";
import { ReplayClient } from "@/components/replay/ReplayClient";

export const metadata: Metadata = {
  title: "Replay a flood · CrestWatch",
};

/* S5 · Replay. */
export default function ReplayPage() {
  return <ReplayClient />;
}
