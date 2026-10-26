/** Quote CSV fields and neutralize formulas in user-entered text. Numbers stay numeric. */
export function csvCell(value: string | number) {
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "";
  const safe = /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
}
export function makeCsv(headers: string[], rows: (string | number)[][]) {
  return (
    [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}
