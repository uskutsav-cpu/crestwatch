import type { Metadata } from "next";
import { Suspense } from "react";
import { WhyClient } from "@/components/why/WhyClient";
import { Glossary } from "@/components/Glossary";
import { copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.pageTitleWhy,
};

/* S4 · Why — the no-magic screen. The glossary sits inside the boundary
   so a hard load never paints it alone and then shoves it down. */
export default function WhyPage() {
  return (
    <Suspense>
      <WhyClient />
      <Glossary />
    </Suspense>
  );
}
