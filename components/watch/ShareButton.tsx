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
      <ButtonGhost
        onClick={() => void share()}
        disabled={busy}
        className="!h-10 !px-4 !text-small"
      >
        {busy ? "…" : copy.share}
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
            crestwatch · public federal data ·{" "}
            {new Date().toLocaleString("en-US", {
              timeZone: "America/Chicago",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </>
  );
}
