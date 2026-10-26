import { Suspense } from "react";
import { Dashboard } from "@/components/experience/Dashboard";
export default function Page() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
