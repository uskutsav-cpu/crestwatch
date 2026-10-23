/**
 * The CrestWatch wave-mark as an SVG string, for the generated icons and
 * the link-preview image. Same three crest lines as components/WaveMark,
 * drawn on the ink background so it reads on light and dark tabs alike.
 */

export const BRAND = {
  ink: "#0A1620",
  current: "#4FC3E8",
  foam: "#EAF6FB",
  mist: "#8FA8BA",
} as const;

/**
 * @param inset fraction of the square left as margin around the mark.
 *   Maskable app icons need ~0.2 so Android's circle crop never clips it.
 */
export function markSvg({
  rounded = true,
  inset = 0.14,
}: { rounded?: boolean; inset?: number } = {}): string {
  const s = 1 - inset * 2;
  const t = 48 * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
<rect width="48" height="48" rx="${rounded ? 11 : 0}" fill="${BRAND.ink}"/>
<g transform="translate(${t} ${t}) scale(${s})" fill="none" stroke="${BRAND.current}" stroke-width="4.5" stroke-linecap="round">
<path d="M4 16c5-7 10-7 15 0s10 7 15 0 8-5 10-2"/>
<path d="M4 27c5-6 10-6 15 0s10 6 15 0 8-4 10-2" opacity="0.65"/>
<path d="M4 38c5-5 10-5 15 0s10 5 15 0 8-3 10-2" opacity="0.35"/>
</g>
</svg>`;
}

export function markDataUri(opts?: Parameters<typeof markSvg>[0]): string {
  return `data:image/svg+xml;base64,${Buffer.from(markSvg(opts)).toString("base64")}`;
}
