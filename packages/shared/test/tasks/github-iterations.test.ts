import { describe, expect, it } from 'vitest';
import {
  checkIterationWrite,
  iterationConfiguration,
  iterationEndDate,
  iterationRemoved,
  iterationSnapshot,
  iterationSnapshotOf,
  iterationRefusal,
  iterationWriteError,
  mergeIteration,
  overlappingSprints,
  planIterations,
  REMOVED_ITERATION_SNAPSHOT,
  sameIterations,
  sprintIterationValues,
  type BoardIteration,
  type IterationValues,
} from '../../src/tasks/github-iterations';

const base: IterationValues = { title: 'Sprint 1', startDate: '2026-11-02', duration: 14 };

describe('values of a sprint and of an iteration', () => {
  it('a sprint gives its label, first day and length, both days counted', () => {
    expect(sprintIterationValues({ label: 'Sprint 1', startDate: '2026-11-02', endDate: '2026-11-15' })).toEqual(base);
    expect(sprintIterationValues({ label: 'Jour', startDate: '2026-11-02', endDate: '2026-11-02' }).duration).toBe(1);
  });

  it('the last day of an iteration is its first day plus its length minus one, across a change of time', () => {
    expect(iterationEndDate(base)).toBe('2026-11-15');
    expect(iterationEndDate({ startDate: '2026-10-19', duration: 14 })).toBe('2026-11-01');
  });

  it('a stored snapshot is read when complete; the mark of an iteration deleted on GitHub is no snapshot', () => {
    expect(iterationSnapshotOf(base)).toEqual(base);
    expect(iterationSnapshotOf(null)).toBeNull();
    expect(iterationSnapshotOf({ title: 'x' })).toBeNull();
    expect(iterationSnapshotOf(REMOVED_ITERATION_SNAPSHOT)).toBeNull();
    expect(iterationRemoved(REMOVED_ITERATION_SNAPSHOT)).toBe(true);
    expect(iterationRemoved(base)).toBe(false);
  });
});

describe('merge of a sprint and its iteration', () => {
  it('the same on both sides: nothing written', () => {
    const merge = mergeIteration(base, base, base, true);
    expect(merge.pull).toEqual({});
    expect(merge.push).toEqual({});
    expect(merge.snapshot).toEqual(base);
  });

  it('renamed in Ordo: sent to GitHub, whichever side changed last', () => {
    const merge = mergeIteration({ ...base, title: 'Lancement' }, base, base, false);
    expect(merge.push).toEqual({ title: 'Lancement' });
    expect(merge.iteration).toEqual({ ...base, title: 'Lancement' });
    expect(merge.snapshot).toEqual({ ...base, title: 'Lancement' });
    expect(merge.kept).toEqual(base);
  });

  it('re-dated in Ordo: first day and length sent', () => {
    const merge = mergeIteration({ ...base, startDate: '2026-11-09', duration: 7 }, base, base, false);
    expect(merge.push).toEqual({ startDate: '2026-11-09', duration: 7 });
    expect(merge.pull).toEqual({});
  });

  it('renamed or re-dated on GitHub: taken in Ordo, whichever side changed last', () => {
    const merge = mergeIteration(base, { title: 'Lancement', startDate: '2026-11-09', duration: 10 }, base, true);
    expect(merge.pull).toEqual({ title: 'Lancement', startDate: '2026-11-09', duration: 10 });
    expect(merge.sprint).toEqual({ title: 'Lancement', startDate: '2026-11-09', duration: 10 });
    expect(merge.push).toEqual({});
  });

  it('changed on both sides: the side changed last wins, field by field', () => {
    const local = { ...base, title: 'Ordo', duration: 7 };
    const remote = { ...base, title: 'GitHub', startDate: '2026-11-03' };
    const ordoLast = mergeIteration(local, remote, base, true);
    expect(ordoLast.push).toEqual({ title: 'Ordo', duration: 7 });
    expect(ordoLast.pull).toEqual({ startDate: '2026-11-03' });
    expect(ordoLast.iteration).toEqual({ title: 'Ordo', startDate: '2026-11-03', duration: 7 });
    expect(ordoLast.sprint).toEqual(ordoLast.iteration);
    const githubLast = mergeIteration(local, remote, base, false);
    expect(githubLast.pull).toEqual({ title: 'GitHub', startDate: '2026-11-03' });
    expect(githubLast.push).toEqual({ duration: 7 });
  });

  it('first pairing (no snapshot): the side said newer wins', () => {
    const remote = { ...base, startDate: '2026-11-09' };
    expect(mergeIteration(base, remote, null, true).push).toEqual({ startDate: '2026-11-02' });
    expect(mergeIteration(base, remote, null, false).pull).toEqual({ startDate: '2026-11-09' });
  });

  it('a title refused by the rule of the sprints (empty once cut) is not taken; it is sent back at the next sync', () => {
    const merge = mergeIteration(base, { ...base, title: '   ' }, base, false);
    expect(merge.pull).toEqual({});
    expect(merge.sprint.title).toBe('Sprint 1');
    expect(merge.snapshot.title).toBe('');
    const next = mergeIteration(base, { ...base, title: '   ' }, merge.snapshot, false);
    expect(next.push).toEqual({ title: 'Sprint 1' });
  });

  it('a title starting with « ordo: » or « gh: » is a title like any other, sent and taken', () => {
    expect(mergeIteration({ ...base, title: 'ordo: refonte' }, base, base, false).push).toEqual({ title: 'ordo: refonte' });
    expect(mergeIteration(base, { ...base, title: 'gh: import' }, base, true).pull).toEqual({ title: 'gh: import' });
  });

  it('a long title is cut to the rule of the sprints; once taken, it is no change of the sprint and is never cut on GitHub', () => {
    const long = { ...base, title: 'x'.repeat(300) };
    const merge = mergeIteration(base, long, base, false);
    expect(merge.pull.title).toHaveLength(250);
    expect(merge.snapshot.title).toHaveLength(250);
    const next = mergeIteration(merge.sprint, long, merge.snapshot, true);
    expect(next.pull).toEqual({});
    expect(next.push).toEqual({});
    const redated = mergeIteration({ ...merge.sprint, duration: 7 }, long, merge.snapshot, true);
    expect(redated.push).toEqual({ duration: 7 });
    expect(redated.iteration.title).toHaveLength(300);
    expect(iterationSnapshot(long).title).toHaveLength(250);
  });
});

describe('overlapping sprints', () => {
  it('a shared day overlaps, both are given; next to each other or apart (a gap) they do not', () => {
    const found = overlappingSprints([
      { id: 'a', startDate: '2026-11-02', endDate: '2026-11-15' },
      { id: 'b', startDate: '2026-11-15', endDate: '2026-11-20' },
      { id: 'c', startDate: '2026-11-21', endDate: '2026-11-30' },
      { id: 'd', startDate: '2026-12-10', endDate: '2026-12-20' },
    ]);
    expect([...found].sort()).toEqual(['a', 'b']);
  });
});

const current: BoardIteration[] = [
  { id: 'i3', title: 'Sprint 3', startDate: '2026-11-30', duration: 14 },
  { id: 'i1', title: 'Sprint 1', startDate: '2026-11-02', duration: 14 },
  { id: 'i2', title: 'Sprint 2', startDate: '2026-11-16', duration: 14 },
];

describe('list of iterations written', () => {
  it('every iteration is sent with its id, completed ones included, sorted by first day, the changes applied', () => {
    const plan = planIterations(current, [{ sprintId: 's2', iterationId: 'i2', values: { title: 'Deux', startDate: '2026-11-16', duration: 10 } }]);
    expect(plan.iterations).toEqual([
      { id: 'i1', title: 'Sprint 1', startDate: '2026-11-02', duration: 14 },
      { id: 'i2', title: 'Deux', startDate: '2026-11-16', duration: 10 },
      { id: 'i3', title: 'Sprint 3', startDate: '2026-11-30', duration: 14 },
    ]);
    expect(plan.skipped).toEqual([]);
  });

  it('a new sprint is added without id; gaps and varied lengths are kept as they are', () => {
    const plan = planIterations(current, [{ sprintId: 's4', iterationId: null, values: { title: 'Sprint 4', startDate: '2027-01-04', duration: 5 } }]);
    expect(plan.iterations.at(-1)).toEqual({ title: 'Sprint 4', startDate: '2027-01-04', duration: 5 });
    expect(plan.sent).toHaveLength(1);
  });

  it('a change sharing a day with another iteration is not sent; the iteration keeps its values', () => {
    const plan = planIterations(current, [
      { sprintId: 's2', iterationId: 'i2', values: { title: 'Sprint 2', startDate: '2026-11-16', duration: 20 } },
      { sprintId: 's5', iterationId: null, values: { title: 'Sprint 5', startDate: '2026-11-20', duration: 3 } },
      { sprintId: 's6', iterationId: null, values: { title: 'Sprint 6', startDate: '2027-02-01', duration: 7 } },
    ]);
    expect(plan.skipped.sort()).toEqual(['s2', 's5']);
    expect(plan.sent.map((change) => change.sprintId)).toEqual(['s6']);
    expect(plan.iterations.find((iteration) => iteration.id === 'i2')?.duration).toBe(14);
  });

  it('a change of an iteration gone since is not sent', () => {
    const plan = planIterations(current, [{ sprintId: 's9', iterationId: 'gone', values: base }]);
    expect(plan.skipped).toEqual(['s9']);
    expect(plan.sent).toEqual([]);
  });

  it('the field starts on the first day of its first iteration and keeps its duration', () => {
    const configuration = iterationConfiguration(current, 14);
    expect(configuration.startDate).toBe('2026-11-02');
    expect(configuration.duration).toBe(14);
    expect(configuration.iterations.map((iteration) => iteration.id)).toEqual(['i1', 'i2', 'i3']);
  });

  it('two readings are the same with the same ids and values, in any order', () => {
    expect(sameIterations(current, [...current].reverse())).toBe(true);
    expect(sameIterations(current, [{ ...current[0], duration: 7 }, current[1], current[2]])).toBe(false);
    expect(sameIterations(current, current.slice(1))).toBe(false);
  });
});

describe('read back of a write', () => {
  const before = { iterations: current, completedIds: ['i1'] };
  const sent = [
    { id: 'i1', title: 'Sprint 1', startDate: '2026-11-02', duration: 14 },
    { id: 'i2', title: 'Deux', startDate: '2026-11-16', duration: 10 },
    { id: 'i3', title: 'Sprint 3', startDate: '2026-11-30', duration: 14 },
    { title: 'Sprint 4', startDate: '2027-01-04', duration: 5 },
  ];

  it('exactly as sent: no problem, the new iteration found with its id', () => {
    const after = { iterations: [...sent.slice(0, 3), { id: 'i4', ...sent[3] }] as BoardIteration[], completedIds: ['i1'] };
    expect(checkIterationWrite(sent, before, after)).toEqual({ problems: [], createdIds: [null, null, null, 'i4'] });
  });

  it('dates recomputed by GitHub (laid end to end with the duration of the field): each difference told', () => {
    const after = {
      iterations: [sent[0], { ...sent[1], duration: 14 }, { ...sent[2], startDate: '2026-11-30' }, { id: 'i4', title: 'Sprint 4', startDate: '2026-12-14', duration: 14 }] as BoardIteration[],
      completedIds: ['i1'],
    };
    const { problems, createdIds } = checkIterationWrite(sent, before, after);
    expect(problems).toContain('« Deux » : 14 jours au lieu de 10');
    expect(problems).toContain('« Sprint 4 » : itération non créée telle quelle');
    expect(problems).toContain('« Sprint 4 » : itération ajoutée par GitHub');
    expect(createdIds[3]).toBeNull();
  });

  it('a start moved, a title changed, an iteration gone, a completed one no longer completed', () => {
    const after = {
      iterations: [{ ...sent[0], startDate: '2026-11-03' }, { ...sent[1], title: 'Autre' }, { id: 'i4', ...sent[3] }] as BoardIteration[],
      completedIds: [],
    };
    const { problems } = checkIterationWrite(sent, before, after);
    expect(problems).toEqual([
      '« Sprint 1 » : début le 03/11/2026 au lieu du 02/11/2026',
      '« Deux » : titre « Autre »',
      '« Sprint 3 » : itération disparue',
      '« Sprint 1 » : n’est plus terminée',
    ]);
  });

  it('the error recorded on the link shows the first differences and how to resume', () => {
    const message = iterationWriteError(['a', 'b', 'c', 'd']);
    expect(message).toContain('(a ; b ; c ; …)');
    expect(message).toContain('choisissez « Reprendre »');
  });

  it('a refusal with the field unchanged is told, the sprints sent again at each sync', () => {
    expect(iterationRefusal('invalid duration')).toBe('GitHub a refusé les itérations envoyées (invalid duration). Les sprints gardent leurs valeurs et sont renvoyés à chaque synchronisation.');
  });
});
