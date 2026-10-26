import { Suspense } from "react";
import { RiverReplay } from "@/components/experience/RiverReplay";
export const metadata = { title: "Past floods" };
export default function Page() {
  return <Suspense><RiverReplay /></Suspense>;
}
