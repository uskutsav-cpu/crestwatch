import { STUDY_TASKS, validResult, type StudyResult } from './study';

function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
const success = (r: StudyResult) => r.outcome === 'unaided' && r.understanding === 'correct';
export function summarizeStudy(input: StudyResult[]) {
  const valid = input.filter(validResult);
  const groups = new Map<string, StudyResult[]>();
  for (const r of valid) {
    const key = JSON.stringify([r.participant, r.condition, r.task]);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  // Repeated attempts are ambiguous; do not select the best or fastest result.
  const unique = [...groups.values()].filter(g => g.length === 1).map(g => g[0]);
  const duplicateGroups = [...groups.values()].filter(g => g.length > 1).length;
  const tasks = STUDY_TASKS.map(task => {
    const conditions = (['crestwatch', 'official'] as const).map(condition => {
      const rows = unique.filter(r => r.task === task.id && r.condition === condition);
      const completed = rows.filter(success);
      return {
        condition, total: rows.length, unaidedCorrect: completed.length,
        assisted: rows.filter(r => r.outcome === 'assisted').length,
        incomplete: rows.filter(r => r.outcome === 'incomplete').length,
        notAssessed: rows.filter(r => r.understanding === 'not_assessed').length,
        partialOrIncorrect: rows.filter(r => ['partial','incorrect'].includes(r.understanding)).length,
        medianSeconds: median(completed.map(r => r.elapsedMs / 1000)),
      };
    });
    const pairedDifferences: number[] = [];
    for (const r of unique.filter(r => r.task === task.id && r.condition === 'crestwatch' && success(r))) {
      const other = unique.find(x => x.participant === r.participant && x.task === r.task && x.condition === 'official' && success(x));
      if (other) pairedDifferences.push((r.elapsedMs - other.elapsedMs) / 1000);
    }
    const codes = new Set(unique.filter(r => r.task === task.id).map(r => r.participant));
    const matched = { total: 0, both: 0, crestOnly: 0, officialOnly: 0, neither: 0, unassessedPairs: 0, unpaired: 0 };
    for (const code of codes) {
      const crest = unique.find(r => r.participant === code && r.task === task.id && r.condition === 'crestwatch');
      const official = unique.find(r => r.participant === code && r.task === task.id && r.condition === 'official');
      if (!crest || !official) { matched.unpaired++; continue; }
      matched.total++;
      if (crest.understanding === 'not_assessed' || official.understanding === 'not_assessed') matched.unassessedPairs++;
      if (success(crest) && success(official)) matched.both++;
      else if (success(crest)) matched.crestOnly++;
      else if (success(official)) matched.officialOnly++;
      else matched.neither++;
    }
    return { task: task.id, title: task.title, conditions, matched, pairedCount: pairedDifferences.length, pairedMedianDifference: median(pairedDifferences) };
  });
  const coverage = [...new Set(valid.map(r => r.participant))].map(code => ({
    code,
    missing: STUDY_TASKS.flatMap(task => (['crestwatch','official'] as const).filter(condition => !unique.some(r => r.participant === code && r.task === task.id && r.condition === condition)).map(condition => `${condition}/${task.id}`)),
  }));
  return { coverage, recorded: valid.length, rejected: input.length - valid.length, participants: new Set(valid.map(r => r.participant)).size, duplicateGroups, included: unique.length, tasks };
}
export function studyReport(input: StudyResult[]): string {
  const s = summarizeStudy(input);
  const fmt = (n: number | null) => n === null ? 'Not available' : `${n.toFixed(1)} s`;
  const lines = [
    '# CrestWatch - descriptive pilot report', '',
    s.recorded ? 'Facilitator-entered observations; not independently verified.' : 'NO STUDY EVIDENCE: no valid observations have been recorded.', '',
    `Anonymous codes: ${s.participants}. Recorded observations: ${s.recorded}. Included unique observations: ${s.included}. Rejected records: ${s.rejected}.`,
    `Repeated participant/interface/task groups excluded in full: ${s.duplicateGroups}. Preserve the raw export; resolve retests in a documented separate study.`, '',
    '## Primary comparison: all matched attempts, including failures', '',
    'Success means correct understanding AND completion without help. Missing explanations are not successes; they are not automatically incorrect. Both interfaces must be recorded for the same code and task. This is a descriptive task outcome, not proof of a causal learning effect.', '',
    '| Task | Matched pairs | Both succeed | CrestWatch only | Official only | Neither succeeds | Pairs with unassessed explanation | Unpaired codes |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...s.tasks.map(t => `| ${t.title} | ${t.matched.total} | ${t.matched.both} | ${t.matched.crestOnly} | ${t.matched.officialOnly} | ${t.matched.neither} | ${t.matched.unassessedPairs} | ${t.matched.unpaired} |`), '',
    'CrestWatch-only and official-only outcomes must both be reported. Neither includes incomplete, assisted, misunderstood or unassessed attempts; inspect the raw rows to distinguish them. Unassessed-pair counts overlap the four outcome groups. Do not count repeated tasks as independent people.', '',
    '## Condition detail and secondary timing', '',
    '| Task | Interface | Included | Unaided + correct | Assisted | Incomplete | Partial/incorrect | Not assessed | Median time: unaided + correct only |',
    '|---|---|---:|---:|---:|---:|---:|---:|---|',
  ];
  for (const task of s.tasks) {
    for (const c of task.conditions) lines.push(`| ${task.title} | ${c.condition} | ${c.total} | ${c.unaidedCorrect}/${c.total} | ${c.assisted} | ${c.incomplete} | ${c.partialOrIncorrect} | ${c.notAssessed} | ${fmt(c.medianSeconds)} |`);
    lines.push('', `Paired ${task.task}: ${task.pairedCount} participant pairs with correct, unaided completion in both interfaces; median (CrestWatch minus official) time: ${fmt(task.pairedMedianDifference)}.`, '');
  }
  lines.push('## Session coverage', '',
    ...s.coverage.map(c => `${c.code}: ${c.missing.length ? 'missing or ambiguous ' + c.missing.join(', ') : 'all six observations present'}.`),
    ...(s.coverage.length ? [] : ['No participant observations supplied.']), '',
    '## Interpretation limits', '',
    '- A negative paired difference means CrestWatch was faster for those matched successful attempts; it does not prove greater accuracy or overall superiority.',
    '- Timing excludes unsuccessful/assisted attempts from the median; report all completion counts alongside it. Do not compare unmatched condition medians as an effect.',
    '- Codes are not verified people. Small convenience samples, order effects, repeated tasks, facilitator scoring and changing live feeds limit generalization.',
    '- Record order, device, app version, live readings and any interruptions in the session sheet. The exported rows do not capture those variables.',
    '- Not assessed is missing understanding data, not a correct explanation. Assistance, incomplete status and explanation quality overlap and must not be added as separate groups.', '',
    '## Complete after reviewing real observations', '',
    'Recruitment and consent: [record actual method]',
    'Session dates, devices and order: [complete from session sheets]',
    'Most important misunderstanding: [cite anonymous task observation]',
    'Change made and retest outcome: [state actual evidence, including failures]',
    'Safe conclusion: In this small pilot, [count] of [denominator] participants [specific observed outcome]. These results do not establish property flood safety.', '',
  );
  return lines.join('\n');
}
