/**
 * Feet are hard to picture, especially for kids. Translate a height into
 * something you can see in your head. Used as a soft second line under
 * the verdict, never in place of the real number.
 */

export function heightGloss(ft: number): string | null {
  const a = Math.abs(ft);
  if (!Number.isFinite(a) || a < 0.5) return null;
  if (a < 1.5) return "about knee-high on a grown-up";
  if (a < 2.5) return "about as high as a kitchen table";
  if (a < 4) return "about chest-high on a grown-up";
  if (a < 6.5) return "about as tall as a grown-up";
  if (a < 12) return "about as tall as a basketball hoop";
  if (a < 25) return "about as tall as a two-story house";
  if (a < 60) return "taller than the trees";
  return null; // past this, the number speaks for itself
}
