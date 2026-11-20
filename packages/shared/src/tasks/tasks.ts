import { normalize } from '../core/text';
import { z } from 'zod';
import { endAfter, markdownTextSchema, optionalText, personNameSchema, requiredText } from '../core/rules';
import { locationPointFields } from '../core/geo';
import { itemLinksSchema, type ItemLink } from '../core/links';
import { dateSchema } from '../core/workspace';
import { slotConditionSchema, type SlotCondition } from '../calendar/slot-conditions';
import { endDaySchema, startDaySchema } from '../dates/times';
import { taskRemindersSchema, type ReminderFields } from '../dates/reminders';
import { personDetailsShape } from '../people/person-details';

export const taskLabelSchema = requiredText();

export const effortSchema = z.number({ error: 'Nombre attendu.' }).min(0, 'L’effort ne peut pas être négatif.').max(1_000_000, 'Valeur trop grande.').nullable();
/** Effort as a number input holds it (empty: none), checked as `effortSchema`. */
export const effortFieldSchema = z
  .union([z.number(), z.literal('')])
  .transform((value) => (value === '' ? null : value))
  .pipe(effortSchema);
/** Effort of a task alone, saved on leaving it in the task panel (decision D22). */
export const effortFormSchema = z.object({ effort: effortFieldSchema });

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

/** A contributor: name, mention handle and its details (birth date, birthday reminders, email, phones; lot 16). */
export const contributorFormSchema = z.object({
  name: personNameSchema,
  handle: handleSchema,
  ...personDetailsShape,
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
    /** Where it is done: free text, and its point when chosen from the map or a search (decision D6, no travel time). */
    location: optionalText().default(null),
    ...locationPointFields,
    /** Links, as those of the events (decision D5). */
    links: itemLinksSchema.default([]),
    /** Reminders « À HH:MM » (Paris time), rung every day from « Ouverture » to « Échéance » (decision D16). */
    reminders: taskRemindersSchema.default([]),
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
  /** Where it is done (null: nowhere, its point too), and its point when chosen from the map or a search. */
  location?: string | null;
  locationLat?: number | null;
  locationLon?: number | null;
  /** Links (null: none). */
  links?: ItemLink[] | null;
  /** Reminders « À HH:MM » (null: none); they ring only with an « Échéance ». */
  reminders?: ReminderFields[] | null;
}

/** Own « Ouverture » / « Échéance » of a task, and the sprints it is planned in (YYYY-MM-DD). */
export interface TaskOwnDates {
  minDate: string | null;
  deadline: string | null;
  sprintIds: readonly string[];
}

/** Days of a sprint a task may take its dates from. */
export interface SprintDays {
  startDate: string;
  endDate: string;
}

/** « Ouverture » / « Échéance » a task goes by, and whether each comes from its sprint. */
export interface TaskDueDates {
  minDate: string | null;
  deadline: string | null;
  minDateFromSprint: boolean;
  deadlineFromSprint: boolean;
}

/**
 * « Ouverture » and « Échéance » a task goes by: its own; without one, that of its sprint when it is in exactly one
 * (its start, its end; several sprints: none taken). A date typed on the task wins.
 * @param {TaskOwnDates} task Task.
 * @param {(id: string) => SprintDays | null | undefined} sprintOf Sprint by id.
 * @returns {TaskDueDates} Dates.
 */
export function taskDueDates(task: TaskOwnDates, sprintOf: (id: string) => SprintDays | null | undefined): TaskDueDates {
  const sprint = task.sprintIds.length === 1 ? sprintOf(task.sprintIds[0]) : null;
  const minDateFromSprint = task.minDate === null && Boolean(sprint);
  const deadlineFromSprint = task.deadline === null && Boolean(sprint);
  return {
    minDate: minDateFromSprint ? sprint!.startDate : task.minDate,
    deadline: deadlineFromSprint ? sprint!.endDate : task.deadline,
    minDateFromSprint,
    deadlineFromSprint,
  };
}
