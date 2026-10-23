import type { Metadata } from "next";
import { Suspense } from "react";
import { WhyClient } from "@/components/why/WhyClient";
import { Glossary } from "@/components/Glossary";

export const metadata: Metadata = {
  title: "Why this verdict · CrestWatch",
};

/* S4 · Why — the no-magic screen. */
export default function WhyPage() {
  return (
    <>
      <Suspense>
        <WhyClient />
      </Suspense>
      <Glossary />
    </>
  );
}
