"use client";

/**
 * One-tap share image (T11): renders the ShareCard offscreen, rasterizes
 * it with html-to-image, then hands it to the native share sheet (or
 * downloads it where share isn't available).
 */

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { copy } from "@/lib/copy";
import { ButtonGhost } from "@/components/ui";

/** "Oct 23, 2:09 PM CT": the card leaves the app, so it names its zone. */
export function shareStamp(at: Date): string {
  const t = at.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${t} CT`;
}

export function ShareButton({ card }: { card: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function share() {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "crestwatch.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "crestwatch.png";
        a.dataset.testid = "share-download";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      // user cancelled the share sheet — nothing to clean up
    }
    setBusy(false);
  }

  return (
    <>
      {/* Same name while the picture is made (aria-busy, no ellipsis), and
          focusable throughout (aria-disabled, not disabled). */}
      <ButtonGhost
        onClick={() => void share()}
        aria-busy={busy || undefined}
        aria-disabled={busy || undefined}
        className="!h-10 !px-4 !text-small aria-disabled:cursor-wait aria-disabled:opacity-50"
      >
        {copy.share}
      </ButtonGhost>
      {/* Offscreen render target for the rasterizer */}
      <div
        aria-hidden="true"
        style={{ position: "fixed", left: "-2000px", top: 0 }}
      >
        <div
          ref={ref}
          data-testid="share-card"
          style={{
            width: 640,
            padding: 28,
            background: "#0A1620",
            color: "#EAF6FB",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {card}
          <p
            style={{
              marginTop: 18,
              fontSize: 12,
              color: "#8FA8BA",
              letterSpacing: "0.02em",
            }}
          >
            {copy.shareFooter(shareStamp(new Date()))}
          </p>
        </div>
      </div>
    </>
  );
}
