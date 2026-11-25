import {
  checkIterationWrite,
  clipText,
  formatDay,
  iterationConfiguration,
  iterationEndDate,
  iterationRemoved,
  iterationSnapshot,
  iterationSnapshotOf,
  iterationRefusal,
  iterationWriteError,
  mapById,
  mergeIteration,
  overlappingSprints,
  parseDay,
  planIterations,
  REMOVED_ITERATION_SNAPSHOT,
  sameIterations,
  sameIterationValues,
  sameName,
  sprintIterationValues,
  type IterationChange,
  type IterationReading,
  type SentIteration,
  type IterationMerge,
  type BoardIteration,
  type IterationValues,
} from '@ordo/shared';
import { prisma } from '../../db';
import { Prisma, type GithubProjectLink, type Sprint } from '../../generated/prisma/client';
import { errorMessage } from '../../graphql/errors';
import { toJson } from '../core/json';
import { iterationField, setIterations, type Board, type BoardField } from './board';
import { stopsSync } from './client';

/** What the mirror of the sprints and iterations did. */
export interface IterationSyncResult {
  /** Sprints created, paired or changed in Ordo. */
  changed: number;
  /** Iterations created or changed on GitHub. */
  pushed: number;
  /** Sprints not sent: they share a day with another sprint of the tree or another iteration of the field. */
  skipped: number;
  /** Sprints not sent: the iteration writes of the link are stopped (`iterationWriteError`) or refused by GitHub. */
  blocked: number;
  /** Sprints without iteration while the iterations are not written (`writeIterations` off). */
  unpaired: number;
}

/** A write of the iterations sent, until its read back is checked (`iterationWritePending` of the link). */
interface PendingWrite {
  /** Iterations sent. */
  sent: SentIteration[];
  /** Field read just before the write. */
  before: IterationReading;
  /** Sprints sent. */
  changes: IterationChange[];
}

/**
 * Values a sprint gives its iteration (its days as Paris days).
 * @param {Sprint} sprint Sprint.
 * @returns {IterationValues} Values.
 */
const valuesOfSprint = (sprint: Sprint): IterationValues => sprintIterationValues({ label: sprint.label, startDate: formatDay(sprint.startDate), endDate: formatDay(sprint.endDate) });

/**
 * Iteration ids stored on a link (`iterationIds`).
 * @param {GithubProjectLink} link Link.
 * @returns {Set<string>} Ids.
 */
const knownIterations = (link: GithubProjectLink) => new Set(Array.isArray(link.iterationIds) ? link.iterationIds.filter((id): id is string => typeof id === 'string') : []);

/**
 * Writes the state of the iteration writes on a link, in the database and on the link read by the sync.
 * @param {GithubProjectLink} link Board link (updated in place).
 * @param {Pick<Prisma.GithubProjectLinkUpdateInput, 'iterationWriteError' | 'iterationWritePending' | 'iterationWriteRefusal' | 'iterationIds'>} data State to write.
 * @returns {Promise<void>}
 */
async function updateLink(link: GithubProjectLink, data: Pick<Prisma.GithubProjectLinkUpdateInput, 'iterationWriteError' | 'iterationWritePending' | 'iterationWriteRefusal' | 'iterationIds'>): Promise<void> {
  Object.assign(link, await prisma.githubProjectLink.update({ where: { id: link.id }, data }));
}

/**
 * Writes the GitHub link of a sprint (its iteration, its snapshot), keeping its last change: that write is no change of
 * the sprint (the merge compares that date with the last change of the field). Changed meanwhile by a user, the sprint
 * is not written when `required` is false (the next sync takes it again), or written with the date of now.
 * @param {Sprint} sprint Sprint, as read by the sync (updated in place).
 * @param {Prisma.SprintUpdateManyMutationInput} data GitHub link to write.
 * @param {boolean} required Written even when the sprint changed meanwhile.
 * @returns {Promise<void>}
 */
async function writeSprintLink(sprint: Sprint, data: Prisma.SprintUpdateManyMutationInput, required: boolean): Promise<void> {
  const { count } = await prisma.sprint.updateMany({ where: { id: sprint.id, updatedAt: sprint.updatedAt }, data: { ...data, updatedAt: sprint.updatedAt } });
  if (!count && !required) return;
  Object.assign(sprint, count ? await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } }) : await prisma.sprint.update({ where: { id: sprint.id }, data }));
}

/**
 * Stores the snapshot of a sprint when it changed (`writeSprintLink`: not when the sprint changed meanwhile).
 * @param {Sprint} sprint Sprint.
 * @param {IterationValues} snapshot Values of the iteration synchronized.
 * @returns {Promise<void>}
 */
async function storeSnapshot(sprint: Sprint, snapshot: IterationValues): Promise<void> {
  const stored = iterationSnapshotOf(sprint.githubSnapshot);
  if (stored && sameIterationValues(stored, snapshot)) return;
  await writeSprintLink(sprint, { githubSnapshot: toJson(snapshot) }, false);
}

/**
 * Stops the iteration writes of a link after a write GitHub did not keep as sent: the error is recorded on the link, and
 * the snapshot of each paired sprint takes what GitHub shows now, so that the values of the sprints win once the writes
 * resume (the dates GitHub chose are never copied into Ordo).
 * @param {GithubProjectLink} link Board link.
 * @param {Sprint[]} sprints Sprints of the tree.
 * @param {BoardIteration[]} iterations Iterations as GitHub shows them after the write.
 * @param {string[]} problems Differences in words.
 * @returns {Promise<void>}
 */
async function stopWrites(link: GithubProjectLink, sprints: Sprint[], iterations: BoardIteration[], problems: string[]): Promise<void> {
  console.warn('Synchronisation GitHub : écriture des itérations arrêtée.', problems);
  await updateLink(link, { iterationWriteError: iterationWriteError(problems), iterationWritePending: Prisma.DbNull });
  const onBoard = mapById(iterations);
  for (const sprint of sprints) {
    const iteration = sprint.githubIterationId ? onBoard.get(sprint.githubIterationId) : undefined;
    if (iteration) await storeSnapshot(sprint, iterationSnapshot(iteration));
  }
}

/**
 * Records a write found on GitHub exactly as sent: each new iteration pairs its sprint, each sprint sent stores the values
 * sent as its snapshot.
 * @param {SentIteration[]} sentList Iterations sent.
 * @param {(string | null)[]} createdIds Id of each new iteration, by its index in the list sent.
 * @param {IterationChange[]} changes Sprints sent.
 * @param {Sprint[]} sprints Sprints of the tree.
 * @returns {Promise<Set<string>>} Sprints whose values are on GitHub now.
 */
async function recordWrite(sentList: SentIteration[], createdIds: (string | null)[], changes: IterationChange[], sprints: Sprint[]): Promise<Set<string>> {
  const sent = new Set<string>();
  for (const [index, iteration] of sentList.entries()) {
    const id = iteration.id ?? createdIds[index];
    const change = changes.find((item) => (item.iterationId ? item.iterationId === id : !iteration.id && sameIterationValues(item.values, iteration)));
    const sprint = change && sprints.find((item) => item.id === change.sprintId);
    if (!sprint || !id) continue;
    if (!sprint.githubIterationId) await writeSprintLink(sprint, { githubIterationId: id }, true);
    await storeSnapshot(sprint, iterationSnapshot(change.values));
    sent.add(sprint.id);
  }
  return sent;
}

/**
 * Checks a write sent at a former sync whose read back was not done (the sync stopped in between): the field as read
 * now is compared with what was sent, before anything is merged. Found as sent: recorded; nothing written (the field as
 * before): forgotten, the next write sends it again; otherwise the iteration writes stop.
 * @param {GithubProjectLink} link Board link, with a pending write.
 * @param {BoardField} field Iteration field, as read at the start of this sync.
 * @param {Sprint[]} sprints Sprints of the tree.
 * @param {IterationSyncResult} result Counts.
 * @returns {Promise<boolean>} The sync of the iterations goes on (false: stopped).
 */
async function checkPendingWrite(link: GithubProjectLink, field: BoardField, sprints: Sprint[], result: IterationSyncResult): Promise<boolean> {
  const pending = link.iterationWritePending as unknown as PendingWrite;
  const now: IterationReading = { iterations: field.iterations, completedIds: field.completedIterationIds };
  const check = checkIterationWrite(pending.sent, pending.before, now);
  if (!check.problems.length) {
    result.pushed += (await recordWrite(pending.sent, check.createdIds, pending.changes, sprints)).size;
  } else if (!sameIterations(now.iterations, pending.before.iterations)) {
    result.blocked += pending.changes.length;
    await stopWrites(link, sprints, now.iterations, check.problems);
    return false;
  }
  await updateLink(link, { iterationWritePending: Prisma.DbNull });
  return true;
}

/**
 * Remembers the iterations paired with a sprint of the tree, and those deleted in Ordo still on GitHub, so that an
 * iteration whose sprint is gone is never made a sprint again.
 * @param {GithubProjectLink} link Board link.
 * @param {BoardField} field Iteration field (its iterations as they are now).
 * @param {Sprint[]} sprints Sprints of the tree.
 * @param {Set<string>} known Iterations remembered at the last sync.
 * @returns {Promise<void>}
 */
async function rememberPaired(link: GithubProjectLink, field: BoardField, sprints: Sprint[], known: Set<string>): Promise<void> {
  const ids = new Set(field.iterations.map((iteration) => iteration.id));
  const paired = [...sprints.flatMap((sprint) => (sprint.githubIterationId ? [sprint.githubIterationId] : [])), ...known].filter((id) => ids.has(id));
  const next = [...new Set(paired)].sort();
  if (next.join() !== [...known].sort().join()) await updateLink(link, { iterationIds: next });
}

/**
 * Mirrors the sprints of a project tree and the iterations of the board's iteration field.
 *
 * Pairing (always): a sprint keeps its iteration by id. An iteration deleted on GitHub unpairs its sprint, marked so that
 * it is not sent again. An iteration paired at the last sync whose sprint is gone (deleted in Ordo) stays on GitHub and
 * is not made a sprint again (a new sprint of the same name takes it). A sprint paired before the mirror (no snapshot) gives way, with its tasks, to an unpaired
 * sprint of the same name (it was created from the iteration by a former sync). Another iteration without sprint takes
 * the unpaired sprint of the same name (`sameName`, one marked as deleted on GitHub included), or becomes a new sprint of
 * the linked project.
 *
 * Without `writeIterations`, that is all (iterations read only, Ordo the reference for the names and dates of paired
 * sprints; a link stopped with the writes on still pairs once they are turned off). With it:
 *
 * Merge: each paired sprint is merged with its iteration against its snapshot (title, first day, length): changed on
 * one side, the value passes; changed on both sides, or without snapshot, Ordo wins (the reference for project
 * management). Unpaired sprints are created on GitHub. A sprint sharing a day
 * with another sprint of the tree, or that would share one with another iteration, is not sent.
 *
 * Writing: the field is read again, then the whole list is written (every iteration with its id, by first day), read
 * back and compared with what was sent; the write is recorded as pending on the link until then (a sync stopped in
 * between checks it at the next one, before any merge). On any difference, the iteration sync of the link stops (its
 * `iterationWriteError`): the snapshots take what GitHub shows, so that the sprints never take the dates GitHub chose.
 * While it is stopped, nothing passes either way. Refused by GitHub with the field unchanged: the refusal is kept on the
 * link (`iterationWriteRefusal`) and tried again at the next sync.
 * @param {string} token Token.
 * @param {Board} board Board, as read at the start of the sync (the iterations of its field follow the write).
 * @param {GithubProjectLink} link Board link.
 * @param {string[]} tree Projects of the tree.
 * @returns {Promise<IterationSyncResult>} Counts.
 */
export async function syncIterations(token: string, board: Board, link: GithubProjectLink, tree: string[]): Promise<IterationSyncResult> {
  const result: IterationSyncResult = { changed: 0, pushed: 0, skipped: 0, blocked: 0, unpaired: 0 };
  const field = board.fields.find((item) => item.id === link.iterationFieldId);
  if (!field || field.dataType !== 'ITERATION') return result;
  const sprints = await prisma.sprint.findMany({ where: { projectId: { in: tree } }, orderBy: { createdAt: 'asc' } });
  const onBoard = mapById(field.iterations);

  if (link.iterationWriteError && link.writeIterations) {
    // Stopped: only counted, what would be sent (with the writes turned off, the pairing below goes on).
    result.blocked = sprints.filter((sprint) => {
      if (iterationRemoved(sprint.githubSnapshot)) return false;
      const iteration = sprint.githubIterationId ? onBoard.get(sprint.githubIterationId) : undefined;
      return !iteration || !sameIterationValues(valuesOfSprint(sprint), iteration);
    }).length;
    return result;
  }
  // A write whose read back was not done: checked first, nothing merged from an unchecked write.
  if (link.iterationWritePending && !(await checkPendingWrite(link, field, sprints, result))) return result;

  const known = knownIterations(link);
  // Iterations deleted on GitHub: their sprints are unpaired, marked so that they are not sent again.
  for (const sprint of sprints.filter((item) => item.githubIterationId && !onBoard.has(item.githubIterationId))) {
    await writeSprintLink(sprint, { githubIterationId: null, githubSnapshot: REMOVED_ITERATION_SNAPSHOT }, true);
    result.changed += 1;
  }

  const created = new Set<string>();
  for (const iteration of field.iterations) {
    const paired = sprints.find((sprint) => sprint.githubIterationId === iteration.id);
    // A sprint marked as deleted on GitHub is paired again by its name too: Ordo is the reference, its values win.
    const twin = sprints.find((sprint) => !sprint.githubIterationId && sameName(sprint.label, iteration.title));
    if (paired && paired.githubSnapshot === null && twin) {
      // Paired before the mirror (no snapshot), with an unpaired sprint of the same name: it was created from the
      // iteration by a former sync, its tasks join the sprint written in Ordo, which takes the iteration.
      const tasks = await prisma.task.findMany({ where: { sprints: { some: { id: paired.id } } }, select: { id: true } });
      if (tasks.length) await prisma.sprint.update({ where: { id: twin.id }, data: { tasks: { connect: tasks } } });
      await prisma.sprint.delete({ where: { id: paired.id } });
      sprints.splice(sprints.indexOf(paired), 1);
    } else if (paired) continue;
    if (twin) {
      // Paired by its name (an empty snapshot, not that of a sprint paired before the mirror): no values yet, the sprint
      // wins; also an iteration whose sprint was deleted in Ordo, taken by a new sprint of the same name.
      await writeSprintLink(twin, { githubIterationId: iteration.id, githubSnapshot: toJson({}) }, true);
    } else if (known.has(iteration.id)) {
      // Paired at the last sync, its sprint deleted in Ordo since: the iteration stays on GitHub, not made a sprint again.
      continue;
    } else {
      const sprint = await prisma.sprint.create({
        data: {
          projectId: link.projectId,
          label: clipText(iteration.title),
          startDate: parseDay(iteration.startDate),
          endDate: parseDay(iterationEndDate(iteration)),
          githubIterationId: iteration.id,
          githubSnapshot: toJson(iterationSnapshot(iteration)),
        },
      });
      sprints.push(sprint);
      created.add(sprint.id);
    }
    result.changed += 1;
  }

  if (!link.writeIterations) {
    // Iterations read only: the sprints without iteration are to be created on GitHub.
    result.unpaired = sprints.filter((sprint) => !sprint.githubIterationId).length;
    await rememberPaired(link, field, sprints, known);
    return result;
  }

  // Paired sprints merged with their iteration; the values taken from GitHub are written at once, unless a user changed
  // the sprint meanwhile (the next sync merges it again).
  const merges = new Map<string, IterationMerge>();
  for (const sprint of sprints) {
    const iteration = sprint.githubIterationId ? onBoard.get(sprint.githubIterationId) : undefined;
    if (!iteration || created.has(sprint.id)) continue;
    const snapshot = iterationSnapshotOf(sprint.githubSnapshot);
    // Ordo is the reference for project management: changed on both sides (or never synchronized), the sprint wins.
    const merge = mergeIteration(valuesOfSprint(sprint), iteration, snapshot, true);
    if (Object.keys(merge.pull).length) {
      const { title, startDate } = merge.sprint;
      const { count } = await prisma.sprint.updateMany({
        where: { id: sprint.id, updatedAt: sprint.updatedAt },
        data: { label: title, startDate: parseDay(startDate), endDate: parseDay(iterationEndDate(merge.sprint)) },
      });
      if (!count) continue;
      Object.assign(sprint, await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } }));
      result.changed += 1;
    }
    merges.set(sprint.id, merge);
  }

  // Sprints sharing a day with another sprint of the tree are not sent (those marked as deleted on GitHub, never sent,
  // are left out; archived ones are sent).
  const overlapping = overlappingSprints(
    sprints.filter((sprint) => !iterationRemoved(sprint.githubSnapshot)).map((sprint) => ({ id: sprint.id, startDate: formatDay(sprint.startDate), endDate: formatDay(sprint.endDate) })),
  );
  const changes: IterationChange[] = [];
  for (const sprint of sprints) {
    const merge = merges.get(sprint.id);
    const unpaired = !sprint.githubIterationId && !iterationRemoved(sprint.githubSnapshot);
    if (!unpaired && !(merge && Object.keys(merge.push).length)) continue;
    if (overlapping.has(sprint.id)) result.skipped += 1;
    else changes.push({ sprintId: sprint.id, iterationId: sprint.githubIterationId, values: merge ? merge.iteration : valuesOfSprint(sprint) });
  }

  let sent = new Set<string>();
  if (changes.length) sent = await writeIterations(token, link, field, changes, sprints, result);
  else if (link.iterationWriteRefusal) await updateLink(link, { iterationWriteRefusal: null });
  // Snapshots of the merged sprints: what is now on both sides; for a change not sent, the iteration as GitHub has it.
  for (const sprint of sprints) {
    const merge = merges.get(sprint.id);
    if (merge && sprint.githubIterationId && onBoard.has(sprint.githubIterationId) && !link.iterationWriteError) {
      await storeSnapshot(sprint, Object.keys(merge.push).length && !sent.has(sprint.id) ? merge.kept : merge.snapshot);
    }
  }
  await rememberPaired(link, field, sprints, known);
  return result;
}

/**
 * Writes the changes of the sprints on the iteration field: read again just before (changed since the start of the
 * sync: nothing written, tried again at the next one), recorded as pending on the link, whole list written, read back
 * and compared. Refused by GitHub with the field unchanged: the refusal kept on the link, tried again at the next sync.
 * On any difference (or a refusal that changed something), the iteration sync of the link stops and the snapshots of
 * its sprints take what GitHub shows. The iterations of the field follow what was read back.
 * @param {string} token Token.
 * @param {GithubProjectLink} link Board link (its state updated).
 * @param {BoardField} field Iteration field, as read at the start of the sync.
 * @param {IterationChange[]} changes Sprints to send.
 * @param {Sprint[]} sprints Sprints of the tree (the new iterations paired with theirs).
 * @param {IterationSyncResult} result Counts (iterations written, sprints left out or blocked).
 * @returns {Promise<Set<string>>} Sprints whose values are on GitHub now.
 */
async function writeIterations(token: string, link: GithubProjectLink, field: BoardField, changes: IterationChange[], sprints: Sprint[], result: IterationSyncResult): Promise<Set<string>> {
  const before = await iterationField(token, field.id);
  if (!sameIterations(before.iterations, field.iterations)) {
    console.warn('Synchronisation GitHub : itérations changées pendant la synchronisation, écriture remise à la suivante.');
    return new Set();
  }
  const plan = planIterations(before.iterations, changes);
  result.skipped += plan.skipped.length;
  if (!plan.sent.length) return new Set();
  // Pending until checked: a sync stopped before the read back (GitHub out of reach…) checks it at the next one.
  const pending: PendingWrite = { sent: plan.iterations, before: { iterations: before.iterations, completedIds: before.completedIds }, changes: plan.sent };
  await updateLink(link, { iterationWritePending: toJson(pending) });
  let refusal: string | null = null;
  try {
    await setIterations(token, field.id, iterationConfiguration(plan.iterations, before.duration));
  } catch (error) {
    if (stopsSync(error)) throw error;
    refusal = errorMessage(error);
  }
  const after = await iterationField(token, field.id);
  field.iterations = after.iterations;
  field.completedIterationIds = after.completedIds;
  field.updatedAt = after.updatedAt;
  if (refusal && sameIterations(after.iterations, before.iterations)) {
    // Refused with nothing written: kept on the link, tried again at the next sync.
    console.warn('Synchronisation GitHub : itérations refusées, réessayées à la prochaine synchronisation.', refusal);
    result.blocked += plan.sent.length;
    await updateLink(link, { iterationWritePending: Prisma.DbNull, iterationWriteRefusal: iterationRefusal(refusal) });
    return new Set();
  }
  const check = checkIterationWrite(plan.iterations, before, after);
  const problems = refusal ? [`refus de GitHub : ${refusal}`, ...check.problems] : check.problems;
  if (problems.length) {
    result.blocked += plan.sent.length;
    await stopWrites(link, sprints, after.iterations, problems);
    return new Set();
  }
  const sent = await recordWrite(plan.iterations, check.createdIds, plan.sent, sprints);
  await updateLink(link, { iterationWritePending: Prisma.DbNull, iterationWriteRefusal: null });
  result.pushed += sent.size;
  return sent;
}
