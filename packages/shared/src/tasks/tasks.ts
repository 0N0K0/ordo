import { normalize } from '../core/text';
import { z } from 'zod';
import { endAfter, personNameSchema, requiredText } from '../core/rules';
import { dateSchema } from '../core/workspace';
import { slotRuleSchema, type SlotRule } from '../calendar/slot-rules';
import { endDaySchema, startDaySchema } from '../dates/times';

/** Longest label of a task. */
export const TASK_LABEL_MAX = 256;

export const taskLabelSchema = requiredText(TASK_LABEL_MAX);

/** Markdown text (description, comment); empty becomes null. */
export const markdownSchema = z
  .string()
  .max(65_536, 'Texte trop long.')
  .transform((value) => (value.trim() ? value : null))
  .nullable();

export const effortSchema = z.number({ error: 'Nombre attendu.' }).min(0, 'L’effort ne peut pas être négatif.').max(1_000_000, 'Valeur trop grande.').nullable();

export const commentBodySchema = z
  .string()
  .max(65_536, 'Texte trop long.')
  .refine((value) => value.trim().length > 0, 'Le commentaire est vide.');

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

export const contributorFormSchema = z.object({
  name: personNameSchema,
  handle: handleSchema,
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
    effort: z
      .union([z.number(), z.literal('')])
      .transform((value) => (value === '' ? null : value))
      .pipe(effortSchema),
    startDate: dateSchema,
    endDate: dateSchema,
    deadline: dateSchema,
    /** « Date min »: not to be done before. */
    minDate: dateSchema,
    parentId: z.string().nullable(),
    milestoneId: z.string().nullable(),
    sprintIds: z.array(z.string()),
    /** « Bénéficiaires »: contributors and relations the task is for. */
    beneficiaryIds: z.array(z.string()).default([]),
    beneficiaryRelationIds: z.array(z.string()).default([]),
    /** Slots it is done on or out of; null: the default of the workspace. */
    slotRule: slotRuleSchema.nullable().default(null),
  })
  .refine(...endAfter('startDate', 'endDate'))
  .refine(...endAfter('minDate', 'deadline'));
export type TaskFormValues = z.input<typeof taskFormSchema>;

/** Longest label of a milestone. */
export const MILESTONE_LABEL_MAX = 120;

export const milestoneLabelSchema = requiredText(MILESTONE_LABEL_MAX);

export const milestoneFormSchema = z.object({
  label: milestoneLabelSchema,
  dueDate: dateSchema,
  description: z.string(),
});
export type MilestoneFormValues = z.input<typeof milestoneFormSchema>;

/** Longest label of a sprint. */
export const SPRINT_LABEL_MAX = 120;

export const sprintLabelSchema = requiredText(SPRINT_LABEL_MAX);

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
  /** « Date min »: not to be done before. */
  minDate?: string | null;
  parentId?: string | null;
  milestoneId?: string | null;
  sprintIds?: string[] | null;
  /** « Bénéficiaires »: contributors and relations the task is for. */
  beneficiaryIds?: string[] | null;
  beneficiaryRelationIds?: string[] | null;
  /** Slots the task is done on or out of; null: the default of the workspace. */
  slotRule?: SlotRule | null;
}
