import { validResult, type StudyResult } from './study';
/** Parse quoted CSV locally. Reject malformed files rather than silently changing observations. */
export function parseStudyCsv(raw: string, prefix: string) {
  if (raw.length > 1000000) throw Error('CSV is too large. Maximum size is 1 MB.');
  const grid: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  const text = raw.replace(/^\uFEFF/, '');
  function endCell() { row.push(cell); cell = ''; closed = false; }
  function endRow() { endCell(); if (row.some(v => v !== '')) grid.push(row); row = []; }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw Error('Malformed quoted CSV field.');
      quoted = true;
    } else if (c === ',') endCell();
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; endRow(); }
    else { if (closed) throw Error('Unexpected text after a quoted CSV field.'); cell += c; }
  }
  if (quoted) throw Error('Unterminated quoted CSV field.');
  if (cell || row.length || closed) endRow();
  const expected = ['participant_code','condition','task','elapsed_seconds','completion','understanding','facilitator_note','recorded_at_utc'];
  const headers = grid.shift() ?? [];
  if (new Set(headers).size !== headers.length || expected.some(h => !headers.includes(h))) throw Error('Use the original Review Lab observation CSV headers.');
  if (grid.length > 300) throw Error('Import at most 300 observations at a time.');
  const rows: StudyResult[] = [];
  for (let i = 0; i < grid.length; i++) {
    const values = grid[i];
    if (values.length !== headers.length) throw Error(`Row ${i + 2} has an unexpected column count. No records imported.`);
    const get = (key: string) => values[headers.indexOf(key)];
    const seconds = get('elapsed_seconds');
    if (!/^\d+(\.\d+)?$/.test(seconds)) throw Error(`Row ${i + 2} has an invalid elapsed time. No records imported.`);
    const r = {
      id: `${prefix}-${i}`, participant:get('participant_code'), condition:get('condition'), task:get('task'),
      elapsedMs:Number(seconds)*1000, outcome:get('completion'), understanding:get('understanding'),
      note:get('facilitator_note'),recordedAt:get('recorded_at_utc'),
    };
    if (!validResult(r)) throw Error(`Row ${i + 2} has invalid observation fields. No records imported.`);
    rows.push(r);
  }
  return rows;
}
