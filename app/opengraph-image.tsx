import { ImageResponse } from "next/og";
import { BRAND, markDataUri } from "@/lib/brand";

export const alt =
  "CrestWatch: Will the water reach your house? One sentence, days early.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* The card people see when a CrestWatch link is texted or posted. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 88px",
          background: BRAND.ink,
          color: BRAND.foam,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={markDataUri({ rounded: true, inset: 0.12 })}
            width={112}
            height={112}
            alt=""
          />
          <div style={{ fontSize: 72, fontWeight: 700 }}>CrestWatch</div>
        </div>
        <div style={{ marginTop: 56, fontSize: 60, fontWeight: 700, lineHeight: 1.15 }}>
          Will the water reach your house?
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 60,
            fontWeight: 700,
            color: BRAND.current,
          }}
        >
          One sentence, days early.
        </div>
        <div style={{ marginTop: 56, fontSize: 30, color: BRAND.mist }}>
          Free public river data from USGS and NOAA · no account
        </div>
      </div>
    ),
    { ...size },
  );
}
