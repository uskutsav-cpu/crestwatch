import type { Metadata } from "next";
import { Suspense } from "react";
import { WatchClient } from "@/components/watch/WatchClient";
import { Glossary } from "@/components/Glossary";

export const metadata: Metadata = {
  title: "Watch · CrestWatch",
};

/* S2 · Watch — the money screen. */
export default function WatchPage() {
  return (
    <>
      <Suspense>
        <WatchClient />
      </Suspense>
      <Glossary />
    </>
  );
}
