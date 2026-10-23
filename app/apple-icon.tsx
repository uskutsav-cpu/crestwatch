import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/* iOS rounds the corners itself, so the tile is drawn square. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={markDataUri({ rounded: false, inset: 0.16 })}
        width={180}
        height={180}
        alt=""
      />
    ),
    { ...size },
  );
}
