import { PURPOSE_SENTENCE } from "@/lib/config";

/* S6 · About — T12 fills in Appendix F. */
export default function AboutPage() {
  return (
    <div className="py-14">
      <h1 className="text-h2">About CrestWatch</h1>
      <p className="mt-4 max-w-prose text-body">{PURPOSE_SENTENCE}</p>
    </div>
  );
}
