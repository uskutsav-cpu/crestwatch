import type { Metadata } from "next";
import { Suspense } from "react";
import { WatchClient } from "@/components/watch/WatchClient";
import { Glossary } from "@/components/Glossary";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.pageTitleWatch,
};

/* S2 · Watch — the money screen. The glossary sits inside the boundary
   so a hard load never paints it alone and then shoves it down. */
export default function WatchPage() {
  return (
    <Suspense>
      <WatchClient />
      <Glossary />
    </Suspense>
  );
}
