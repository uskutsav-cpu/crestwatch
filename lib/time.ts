/**
 * Clock times a visitor reads. CrestWatch watches Mississippi rivers, so
 * times are Central and say so: a judge in DC must not read them as
 * Eastern.
 */

/** "1:30 PM CT". Visitors outside Central time must not misread the age. */
export function fmtTime(at: string | number): string {
  const t = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(at));
  return `${t} CT`;
}
