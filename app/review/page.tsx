import { ReviewLab } from "@/components/experience/ReviewLab";
export const metadata = {
  title: "Usability review lab",
  description:
    "A browser-local facilitator tool for recording real CrestWatch usability observations. No results are prefilled or sent to a server.",
};
export default function Page() {
  return <ReviewLab />;
}
