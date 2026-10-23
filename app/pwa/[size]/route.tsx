import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/brand";

const SIZES = new Set([192, 512]);

/**
 * PNG icons for the web-app manifest. Android needs 192 and 512 to offer
 * "Install app". The mark sits inside a generous margin so the circular
 * crop on maskable icons never clips the waves.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size } = await params;
  const px = Number(size);
  if (!SIZES.has(px)) {
    return new Response("Not found", { status: 404 });
  }
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={markDataUri({ rounded: false, inset: 0.22 })}
        width={px}
        height={px}
        alt=""
      />
    ),
    {
      width: px,
      height: px,
      headers: { "cache-control": "public, max-age=31536000, immutable" },
    },
  );
}
