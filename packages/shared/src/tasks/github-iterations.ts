import { clipText } from '../core/text';
import { addDays, daysBetween, printedDay } from '../dates/days';
import { mergeValues } from './github-merge';

/** What a sprint and an iteration of a GitHub board share: a title, a first day (YYYY-MM-DD) and a length in days. */
export interface IterationValues {
  title: string;
  startDate: string;
  duration: number;
}

/** Iteration of an iteration field of a board. */
export interface BoardIteration extends IterationValues {
  id: string;
}

/** Iteration sent to GitHub: an existing one with its id (it keeps its identity and the items their value), a new one without. */
export interface SentIteration extends IterationValues {
  id?: string;
}

/** Fields of a sprint merged with its iteration. */
const ITERATION_FIELDS = ['title', 'startDate', 'duration'] as const;

/**
 * Values a sprint gives its iteration: its label, its first day and its length (both days counted).
 * @param {{ label: string, startDate: string, endDate: string }} sprint Sprint, its days as YYYY-MM-DD (Paris days).
 * @returns {IterationValues} Values.
 */
export function sprintIterationValues(sprint: { label: string; startDate: string; endDate: string }): IterationValues {
  return { title: sprint.label, startDate: sprint.startDate, duration: daysBetween(sprint.startDate, sprint.endDate) + 1 };
}

/**
 * Last day of an iteration (its first day plus its length minus one).
 * @param {{ startDate: string, duration: number }} iteration Iteration.
 * @returns {string} Day (YYYY-MM-DD).
 */
export function iterationEndDate(iteration: { startDate: string; duration: number }): string {
  return addDays(iteration.startDate, iteration.duration - 1);
}

/**
 * Snapshot of an iteration as GitHub has it: its title cut to the rule of the sprints, as the sprint holds it.
 * @param {IterationValues} iteration Iteration.
 * @returns {IterationValues} Values to store on its sprint.
 */
export const iterationSnapshot = ({ title, startDate, duration }: IterationValues): IterationValues => ({ title: clipText(title), startDate, duration });

/**
 * Values of an iteration alone (without its id).
 * @param {IterationValues} iteration Iteration.
 * @returns {IterationValues} Title, first day, length.
 */
const valuesOf = ({ title, startDate, duration }: IterationValues): IterationValues => ({ title, startDate, duration });

/**
 * Whether two iterations have the same title, first day and length.
 * @param {IterationValues} a Iteration.
 * @param {IterationValues} b Iteration.
 * @returns {boolean} Same values.
 */
export const sameIterationValues = (a: IterationValues, b: IterationValues): boolean => a.title === b.title && a.startDate === b.startDate && a.duration === b.duration;

/** Snapshot stored on a sprint whose iteration was deleted on GitHub: the sprint is no longer sent. */
export const REMOVED_ITERATION_SNAPSHOT = { removed: true } as const;

/**
 * Values of the last sync stored on a sprint (`githubSnapshot`), when there are some.
 * @param {unknown} stored Stored snapshot.
 * @returns {IterationValues | null} Values, or null (none, or the mark of an iteration deleted on GitHub).
 */
export function iterationSnapshotOf(stored: unknown): IterationValues | null {
  if (typeof stored !== 'object' || stored === null) return null;
  const { title, startDate, duration } = stored as Partial<IterationValues>;
  return typeof title === 'string' && typeof startDate === 'string' && typeof duration === 'number' ? { title, startDate, duration } : null;
}

/**
 * Whether a sprint carries the mark of an iteration deleted on GitHub (`REMOVED_ITERATION_SNAPSHOT`).
 * @param {unknown} stored Stored snapshot.
 * @returns {boolean} Marked.
 */
export function iterationRemoved(stored: unknown): boolean {
  return typeof stored === 'object' && stored !== null && (stored as { removed?: unknown }).removed === true;
}

/** Merge of a sprint with its iteration (`mergeIteration`). */
export interface IterationMerge {
  /** Values taken from GitHub (the title already accepted by the rule of the sprints). */
  pull: Partial<IterationValues>;
  /** Values to send to GitHub. */
  push: Partial<IterationValues>;
  /** Values of the sprint once merged (its label, first day and length). */
  sprint: IterationValues;
  /** Values wanted on GitHub once merged. */
  iteration: IterationValues;
  /** Snapshot to store once the values pushed are on GitHub. */
  snapshot: IterationValues;
  /** Snapshot to store while the values pushed are not sent (the iteration as GitHub has it, `iterationSnapshot`). */
  kept: IterationValues;
}

/**
 * Three-way merge of a sprint and its iteration against the last sync, field by field (title, first day, length), with
 * the rules of the tasks (`mergeValues`): changed on one side only, the value passes to the other; changed on both
 * sides, the side changed last wins; without snapshot (first pairing), the side said newer wins. A title the rule of
 * the sprints refuses (empty once cut) is not taken: the sprint keeps its label, sent back at the next sync.
 * @param {IterationValues} local Values of the sprint.
 * @param {IterationValues} remote Values of the iteration.
 * @param {IterationValues | null} snapshot Values at the last sync, if any.
 * @param {boolean} localNewer The sprint changed after the iteration field.
 * @returns {IterationMerge} Changes on each side, values once merged, snapshots.
 */
export function mergeIteration(local: IterationValues, remote: IterationValues, snapshot: IterationValues | null, localNewer: boolean): IterationMerge {
  // Compared with the title cut to the rule of the sprints: a long title on GitHub is no change of the sprint.
  const theirs = { ...remote, title: clipText(remote.title) };
  // A title is a plain text: one starting with « ordo: » or « gh: » is a title like any other.
  const merged = mergeValues(ITERATION_FIELDS, { ...local }, theirs, snapshot ? { ...snapshot } : null, localNewer, { unmapped: false });
  const pull = merged.pull as Partial<IterationValues>;
  const push = merged.push as Partial<IterationValues>;
  // A title empty once cut is refused: the sprint keeps its label.
  if ('title' in pull && !pull.title) delete pull.title;
  const sprint = { ...local, ...pull };
  // The iteration keeps its own title unless the sprint sends one.
  const iteration = { ...remote, ...push };
  return { pull, push, sprint, iteration, snapshot: { ...theirs, ...(merged.snapshot as Partial<IterationValues>) }, kept: theirs };
}

/** A sprint by its days (YYYY-MM-DD, both counted). */
interface SprintDays {
  id: string;
  startDate: string;
  endDate: string;
}

/**
 * Whether two spans of days share a day.
 * @param {{ startDate: string, endDate: string }} a Span.
 * @param {{ startDate: string, endDate: string }} b Span.
 * @returns {boolean} Overlapping.
 */
const overlaps = (a: { startDate: string; endDate: string }, b: { startDate: string; endDate: string }) => a.startDate <= b.endDate && b.startDate <= a.endDate;

/**
 * Sprints that share a day with another sprint of the list (both are given).
 * @param {SprintDays[]} sprints Sprints.
 * @returns {Set<string>} Ids of the overlapping sprints.
 */
export function overlappingSprints(sprints: SprintDays[]): Set<string> {
  const found = new Set<string>();
  sprints.forEach((sprint, index) => {
    for (const other of sprints.slice(index + 1)) {
      if (!overlaps(sprint, other)) continue;
      found.add(sprint.id);
      found.add(other.id);
    }
  });
  return found;
}

/** A sprint to send: the iteration it is paired with (null: to create) and the values wanted on GitHub. */
export interface IterationChange {
  sprintId: string;
  iterationId: string | null;
  values: IterationValues;
}

/** List of iterations to write on a field (`planIterations`). */
export interface IterationPlan {
  /** Every iteration of the field, the changes applied, by first day. */
  iterations: SentIteration[];
  /** Changes sent. */
  sent: IterationChange[];
  /** Sprints not sent: once changed, they would share a day with another iteration of the field. */
  skipped: string[];
}

/**
 * Iterations sorted by first day, then title.
 * @param {T[]} iterations Iterations.
 * @returns {T[]} Sorted copy.
 */
const byStart = <T extends IterationValues>(iterations: T[]): T[] => [...iterations].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title));

/**
 * Whole list of iterations to write on a field (the API replaces the configuration: every existing iteration is sent,
 * with its id, completed ones included; none is left out). A change that would share a day with another iteration of
 * the list is not sent (the iteration keeps its values on GitHub), until no change overlaps another iteration.
 * @param {BoardIteration[]} current Iterations of the field as read just before the write (current, coming, completed).
 * @param {IterationChange[]} changes Sprints to send.
 * @returns {IterationPlan} List, changes sent, sprints left out.
 */
export function planIterations(current: BoardIteration[], changes: IterationChange[]): IterationPlan {
  const ids = new Set(current.map((iteration) => iteration.id));
  let applied = changes.filter((change) => change.iterationId === null || ids.has(change.iterationId));
  const skipped = changes.filter((change) => !applied.includes(change)).map((change) => change.sprintId);
  for (;;) {
    const entries = [
      ...current.map((iteration) => ({ key: iteration.id, values: applied.find((change) => change.iterationId === iteration.id)?.values ?? valuesOf(iteration) })),
      ...applied.filter((change) => change.iterationId === null).map((change) => ({ key: `new:${change.sprintId}`, values: change.values })),
    ];
    const span = (values: IterationValues) => ({ startDate: values.startDate, endDate: iterationEndDate(values) });
    const clashing = applied.filter((change) => {
      const key = change.iterationId ?? `new:${change.sprintId}`;
      return entries.some((entry) => entry.key !== key && overlaps(span(change.values), span(entry.values)));
    });
    if (!clashing.length) {
      const iterations = byStart(
        entries.map((entry): SentIteration => (entry.key.startsWith('new:') ? { ...entry.values } : { id: entry.key, ...entry.values })),
      );
      return { iterations, sent: applied, skipped };
    }
    applied = applied.filter((change) => !clashing.includes(change));
    skipped.push(...clashing.map((change) => change.sprintId));
  }
}

/**
 * Configuration written on an iteration field: the iterations by first day, the first one's day as start of the field,
 * and the field's own duration (unchanged).
 * @param {SentIteration[]} iterations Iterations to write (not empty).
 * @param {number} duration Current duration of the field, in days.
 * @returns {{ startDate: string, duration: number, iterations: SentIteration[] }} Configuration.
 */
export function iterationConfiguration(iterations: SentIteration[], duration: number): { startDate: string; duration: number; iterations: SentIteration[] } {
  const sorted = byStart(iterations);
  return { startDate: sorted[0].startDate, duration, iterations: sorted };
}

/**
 * Whether two readings of a field show the same iterations (same ids and values, in any order).
 * @param {BoardIteration[]} a Iterations.
 * @param {BoardIteration[]} b Iterations.
 * @returns {boolean} Same.
 */
export function sameIterations(a: BoardIteration[], b: BoardIteration[]): boolean {
  return a.length === b.length && a.every((iteration) => b.some((other) => other.id === iteration.id && sameIterationValues(other, iteration)));
}

/** Iterations of a field as read: all of them, and the ids of the completed ones. */
export interface IterationReading {
  iterations: BoardIteration[];
  completedIds: string[];
}

/** What a read back of a field shows of a write (`checkIterationWrite`). */
export interface IterationWriteCheck {
  /** What differs from what was sent, in words (none: the write is exactly on GitHub). */
  problems: string[];
  /** Id of each iteration sent without id (created), by its index in the list sent; null when not found. */
  createdIds: (string | null)[];
}

/**
 * Compares a field read back after a write with what was sent: every iteration sent with its id is there with the same
 * title, first day and length; each new one is there exactly (a new id); no iteration is gone or added; the completed
 * ones left as they were are still completed.
 * @param {SentIteration[]} sent Iterations sent.
 * @param {IterationReading} before Field read just before the write.
 * @param {IterationReading} after Field read back after the write.
 * @returns {IterationWriteCheck} Differences in words, ids of the new iterations.
 */
export function checkIterationWrite(sent: SentIteration[], before: IterationReading, after: IterationReading): IterationWriteCheck {
  const problems: string[] = [];
  const beforeIds = new Set(before.iterations.map((iteration) => iteration.id));
  const matched = new Set<string>();
  for (const iteration of sent) {
    if (!iteration.id) continue;
    const found = after.iterations.find((other) => other.id === iteration.id);
    if (!found) {
      problems.push(`« ${iteration.title} » : itération disparue`);
      continue;
    }
    matched.add(found.id);
    if (found.title !== iteration.title) problems.push(`« ${iteration.title} » : titre « ${found.title} »`);
    if (found.startDate !== iteration.startDate) problems.push(`« ${iteration.title} » : début le ${printedDay(found.startDate)} au lieu du ${printedDay(iteration.startDate)}`);
    if (found.duration !== iteration.duration) problems.push(`« ${iteration.title} » : ${found.duration} jours au lieu de ${iteration.duration}`);
  }
  for (const iteration of before.iterations) {
    if (!sent.some((other) => other.id === iteration.id) && !after.iterations.some((other) => other.id === iteration.id)) problems.push(`« ${iteration.title} » : itération disparue`);
    if (!sent.some((other) => other.id === iteration.id)) matched.add(iteration.id);
  }
  const createdIds = sent.map((iteration) => {
    if (iteration.id) return null;
    const found = after.iterations.find((other) => !beforeIds.has(other.id) && !matched.has(other.id) && sameIterationValues(other, iteration));
    if (!found) {
      problems.push(`« ${iteration.title} » : itération non créée telle quelle`);
      return null;
    }
    matched.add(found.id);
    return found.id;
  });
  for (const iteration of after.iterations) if (!matched.has(iteration.id)) problems.push(`« ${iteration.title} » : itération ajoutée par GitHub`);
  for (const id of before.completedIds) {
    const was = before.iterations.find((iteration) => iteration.id === id);
    const now = sent.find((iteration) => iteration.id === id);
    if (was && now && sameIterationValues(was, now) && !after.completedIds.includes(id)) problems.push(`« ${was.title} » : n’est plus terminée`);
  }
  return { problems, createdIds };
}

/**
 * Error recorded on a link whose iteration write GitHub did not keep as sent: the iterations are no longer synchronized
 * for it until the link is saved again (« Reprendre »).
 * @param {string[]} problems Differences in words (`checkIterationWrite`), or the refusal of GitHub.
 * @returns {string} Message.
 */
export function iterationWriteError(problems: string[]): string {
  const shown = problems.slice(0, 3).join(' ; ') + (problems.length > 3 ? ' ; …' : '');
  return `Écriture des itérations arrêtée : GitHub n’a pas gardé les sprints envoyés (${shown}). Les sprints d’Ordo n’ont pas pris les dates de GitHub. Remettez les itérations du tableau comme dans Ordo, puis choisissez « Reprendre » dans la section GitHub du projet.`;
}

/**
 * Refusal of an iteration write by GitHub, the field left unchanged, kept on the link: the sprints are sent again at
 * each sync.
 * @param {string} message Message of GitHub.
 * @returns {string} Message.
 */
export function iterationRefusal(message: string): string {
  return `GitHub a refusé les itérations envoyées (${message}). Les sprints gardent leurs valeurs et sont renvoyés à chaque synchronisation.`;
}
