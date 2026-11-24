import { normalize } from '../core/text';
import { sumOf } from '../core/collections';
import { z } from 'zod';
import { endAfter, markdownTextSchema, optionalText, personNameSchema, requiredText } from '../core/rules';
import { locationPointFields } from '../core/geo';
import { itemLinksSchema, type ItemLink } from '../core/links';
import { dateSchema } from '../core/workspace';
import { slotConditionSchema, type SlotCondition } from '../calendar/slot-conditions';
import type { ScheduleCase } from '../calendar/work-schedules';
import { taskHoursSchema } from './task-hours';
import { endDaySchema, startDaySchema } from '../dates/times';
import { taskRemindersSchema, type ReminderFields } from '../dates/reminders';
import { deadTimesSchema, type DeadTimeInput } from '../dates/countdowns';
import { contributorLinkSchema } from '../people/contributor-link';
import { TASK_INHERITABLE_FIELDS, type TaskInheritableField } from './task-inheritance';

export const taskLabelSchema = requiredText();

export const effortSchema = z.number({ error: 'Nombre attendu.' }).min(0, 'L’effort ne peut pas être négatif.').max(1_000_000, 'Valeur trop grande.').nullable();
/** Effort as a number input holds it (empty: none), checked as `effortSchema`. */
export const effortFieldSchema = z
  .union([z.number(), z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .pipe(effortSchema);
/** Label and effort of a task, the texts of its panel saved on leaving them. */
export const taskPanelFormSchema = z.object({ label: taskLabelSchema, effort: effortFieldSchema });

export const commentBodySchema = markdownTextSchema.refine((value) => value.trim().length > 0, 'Le commentaire est vide.');

/** Most characters of a mention handle (as GitHub logins). */
// eslint-disable-next-line no-restricted-syntax -- the maximum itself.
export const HANDLE_MAX = 39;

/** Identifier used in @mentions: lowercase letters, digits, "-" and "_". */
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Au moins 2 caractères.')
  .max(HANDLE_MAX, `${HANDLE_MAX} caractères maximum.`)
  .regex(/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/, 'Lettres, chiffres, « - » et « _ » ; ni au début ni à la fin pour « - » et « _ ».');

/**
 * Suggests a mention handle from a name ("Noémie Koelblen" → "noemie-koelblen").
 * @param {string} name Contributor name.
 * @returns {string} Handle candidate.
 */
export function suggestHandle(name: string): string {
  return (
    normalize(name)
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, HANDLE_MAX)
      // Trimmed after the cut too: a handle never ends with « - ».
      .replace(/^-+|-+$/g, '')
  );
}

/** A contributor: name, mention handle and its details (birth date, birthday reminders, email addresses, phones). */
export const contributorFormSchema = z.object({
  name: personNameSchema,
  handle: handleSchema,
  /** What its details come from (membership, relation, contact, nothing). */
  link: contributorLinkSchema,
});
export type ContributorFormValues = z.input<typeof contributorFormSchema>;

export const taskFormSchema = z
  .object({
    label: taskLabelSchema,
    /** Empty: a task of no project. */
    projectId: z.string().transform((value) => value || null),
    description: z.string(),
    statusId: z.string().nullable(),
    priorityId: z.string().nullable(),
    typeId: z.string().nullable(),
    assigneeIds: z.array(z.string()),
    tagIds: z.array(z.string()),
    effort: effortFieldSchema,
    startDate: dateSchema,
    endDate: dateSchema,
    deadline: dateSchema,
    /** « Ouverture »: not to be done before. */
    minDate: dateSchema,
    parentId: z.string().nullable(),
    milestoneId: z.string().nullable(),
    sprintIds: z.array(z.string()),
    /** « Bénéficiaires »: contributors and relations the task is for. */
    beneficiaryIds: z.array(z.string()).default([]),
    beneficiaryRelationIds: z.array(z.string()).default([]),
    /** On or out of calendar schedules, or on the free time, in groups (and / or); null: any time. */
    slotCondition: slotConditionSchema.nullable().default(null),
    /** « Horaires »: days and hours it can be done (as the cases of a créneau); none: any time. */
    hours: taskHoursSchema.default([]),
    /** Where it is done: free text, and its point when chosen from the map or a search (no travel time). */
    location: optionalText().default(null),
    ...locationPointFields,
    /** Links, as those of the events. */
    links: itemLinksSchema.default([]),
    /** Reminders « À HH:MM » (Paris time), rung every day from « Ouverture » to « Échéance ». */
    reminders: taskRemindersSchema.default([]),
    /** « Temps morts »: waits a timer is launched for; not time spent. */
    deadTimes: deadTimesSchema.default([]),
  })
  .refine(...endAfter('startDate', 'endDate'))
  .refine(...endAfter('minDate', 'deadline'));
export type TaskFormValues = z.input<typeof taskFormSchema>;

export const milestoneLabelSchema = requiredText();

export const milestoneFormSchema = z.object({
  label: milestoneLabelSchema,
  dueDate: dateSchema,
  description: z.string(),
});
export type MilestoneFormValues = z.input<typeof milestoneFormSchema>;

export const sprintLabelSchema = requiredText();

/**
 * Schema of a sprint: its label, its days (the end not before the start) and its goal.
 * @param {G} goal Schema of the goal (plain text in the form, markdown for the API).
 * @returns {z.ZodObject} Schema.
 */
export function sprintSchema<G extends z.ZodType>(goal: G) {
  return z.object({ label: sprintLabelSchema, startDate: startDaySchema, endDate: endDaySchema, goal }).refine(...endAfter('startDate', 'endDate'));
}

export const sprintFormSchema = sprintSchema(z.string());
export type SprintFormValues = z.input<typeof sprintFormSchema>;

/** Fields of a task sent to create or change it: undefined leaves a field unchanged, null clears it. */
export interface TaskInput {
  label?: string | null;
  description?: string | null;
  projectId?: string | null;
  statusId?: string | null;
  priorityId?: string | null;
  typeId?: string | null;
  assigneeIds?: string[] | null;
  tagIds?: string[] | null;
  effort?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  deadline?: string | null;
  /** « Ouverture »: not to be done before. */
  minDate?: string | null;
  parentId?: string | null;
  milestoneId?: string | null;
  sprintIds?: string[] | null;
  /** « Bénéficiaires »: contributors and relations the task is for. */
  beneficiaryIds?: string[] | null;
  beneficiaryRelationIds?: string[] | null;
  /** On or out of calendar schedules, or on the free time, in groups (and / or); null: any time. */
  slotCondition?: SlotCondition | null;
  /** « Horaires »: days and hours it can be done (as the cases of a créneau); null or none: any time. */
  hours?: ScheduleCase[] | null;
  /** Where it is done (null: nowhere, its point too), and its point when chosen from the map or a search. */
  location?: string | null;
  locationLat?: number | null;
  locationLon?: number | null;
  /** Links (null: none). */
  links?: ItemLink[] | null;
  /** Documents linked to it: of the library, and of its project tree (not inherited). */
  libraryDocumentIds?: string[] | null;
  projectResourceIds?: string[] | null;
  /** Reminders « À HH:MM » (null: none); they ring only with an « Échéance ». */
  reminders?: ReminderFields[] | null;
  /** « Temps morts » (null: none). */
  deadTimes?: DeadTimeInput[] | null;
  /** Creation under a parent: the fields it inherits; omitted: every field left out. */
  inheritedFields?: TaskInheritableField[] | null;
  /** Update: fields made inherited again (« Rétablir l'héritage »). */
  inherit?: TaskInheritableField[] | null;
  /** Update: fields emptied on purpose (« Vider »; never the project). */
  clear?: TaskInheritableField[] | null;
}

/**
 * Number of a task followed by a space ("#12 "), empty for a task of no project (it has none).
 * @param {{ number: number | null }} task Task.
 * @returns {string} Text.
 */
export const taskRef = (task: { number: number | null }): string => (task.number === null ? '' : `#${task.number} `);

/**
 * Label of a task after its number ("#12 Écrire le devis"), the label alone for a task of no project (the web app and
 * the rings pushed by the API).
 * @param {{ number: number | null, label: string }} task Task.
 * @returns {string} Text.
 */
export const taskNumbered = (task: { number: number | null; label: string }): string => `${taskRef(task)}${task.label}`;

/** Same changes made to several tasks (the bulk edit of the tables, its undo, the undo of an automation). */
export interface TaskBulkChanges {
  statusId?: string | null;
  priorityId?: string | null;
  typeId?: string | null;
  milestoneId?: string | null;
  addSprintIds?: string[];
  removeSprintIds?: string[];
  effort?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  deadline?: string | null;
  minDate?: string | null;
  addAssigneeIds?: string[];
  removeAssigneeIds?: string[];
  addTagIds?: string[];
  removeTagIds?: string[];
  /** Fields made inherited again (« Rétablir l'héritage »). */
  inheritFields?: TaskInheritableField[];
  /** Fields emptied on purpose (« Vider »; never the project). */
  clearFields?: TaskInheritableField[];
}

const idList = z.array(z.string().min(1));

/**
 * Links a transfer of tasks removed because they left the project tree, as the transfer tells them, to put them back
 * (« Annuler »): blocks and relations with the tasks left behind, the parent left behind (with the fields the task
 * inherited from it), milestones, sprints and project documents of another tree. Also what the undo needs to give
 * the moved tasks back as they were: the sub-tasks in another project than their parent (each put back in its own,
 * parents first), and the tasks that stopped inheriting their project (left in another project than their parent).
 */
export const taskLinksLostSchema = z.object({
  blocks: z.array(z.object({ blockerId: z.string().min(1), blockedId: z.string().min(1) })),
  relations: z.array(z.object({ taskAId: z.string().min(1), taskBId: z.string().min(1) })),
  parents: z.array(z.object({ id: z.string().min(1), parentId: z.string().min(1), inheritedFields: z.array(z.enum(TASK_INHERITABLE_FIELDS)) })),
  milestones: z.array(z.object({ id: z.string().min(1), milestoneId: z.string().min(1) })),
  sprints: z.array(z.object({ id: z.string().min(1), sprintIds: idList })),
  resources: z.array(z.object({ id: z.string().min(1), resourceIds: idList })),
  projects: z.array(z.object({ id: z.string().min(1), projectId: z.string().min(1).nullable() })).default([]),
  inheritedProjects: idList.default([]),
});
export type TaskLinksLost = z.infer<typeof taskLinksLostSchema>;

/** No link removed (a transfer that kept them all, an undo with no link to put back). */
export const NO_TASK_LINKS_LOST: TaskLinksLost = { blocks: [], relations: [], parents: [], milestones: [], sprints: [], resources: [], projects: [], inheritedProjects: [] };

/**
 * Links several transfers removed, put together in their order (one undo putting back several transfers).
 * @param {readonly TaskLinksLost[]} lists Links each transfer removed.
 * @returns {TaskLinksLost} All of them.
 */
export function mergeTaskLinksLost(lists: readonly TaskLinksLost[]): TaskLinksLost {
  const merged: TaskLinksLost = { ...NO_TASK_LINKS_LOST };
  for (const lost of lists) {
    for (const key of Object.keys(merged) as (keyof TaskLinksLost)[]) (merged[key] as unknown[]) = [...merged[key], ...(lost[key] ?? [])];
  }
  return merged;
}

/**
 * Whether a transfer removed something its undo gives back: a link, a sub-task in another project than its parent,
 * a project that stopped being inherited.
 * @param {TaskLinksLost} lost Links removed.
 * @returns {boolean} True when there is something to give back.
 */
export const hasTaskLinksLost = (lost: TaskLinksLost): boolean => Object.values(lost).some((list) => list.length > 0);

/** A task of a tree as `subtaskProjects` reads it. */
interface ProjectedTask {
  id: string;
  parentId: string | null;
  projectId: string | null;
}

/**
 * Sub-tasks (at any depth) of the tasks given whose project is not their parent's, parents first: a transfer moves a
 * task with its whole sub-tree, so its undo puts each of them back in its own project, level by level (the sub-tasks
 * in their parent's project follow it).
 * @param {readonly ProjectedTask[]} tasks Tasks of the trees, as they are before the move.
 * @param {readonly string[]} rootIds Tasks moved with their sub-trees.
 * @returns {{ id: string, projectId: string | null }[]} Sub-tasks and their project.
 */
export function subtaskProjects(tasks: readonly ProjectedTask[], rootIds: readonly string[]): { id: string; projectId: string | null }[] {
  const children = new Map<string, ProjectedTask[]>();
  for (const task of tasks) if (task.parentId) children.set(task.parentId, [...(children.get(task.parentId) ?? []), task]);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const found: { id: string; projectId: string | null }[] = [];
  const seen = new Set<string>(rootIds);
  let level = rootIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  while (level.length) {
    const next = level.flatMap((task) => (children.get(task.id) ?? []).filter((child) => !seen.has(child.id)));
    for (const child of next) {
      seen.add(child.id);
      if (child.projectId !== byId.get(child.parentId!)!.projectId) found.push({ id: child.id, projectId: child.projectId });
    }
    level = next;
  }
  return found;
}

/**
 * Number of links a transfer removed (each sprint and each document counted).
 * @param {TaskLinksLost} lost Links removed.
 * @returns {number} Count.
 */
export const taskLinksLostCount = (lost: TaskLinksLost): number =>
  lost.blocks.length + lost.relations.length + lost.parents.length + lost.milestones.length + sumOf(lost.sprints, (item) => item.sprintIds.length) + sumOf(lost.resources, (item) => item.resourceIds.length);
