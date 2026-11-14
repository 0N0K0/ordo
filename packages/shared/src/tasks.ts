import { z } from 'zod';
import { dateSchema } from './workspace';
import { slotRuleSchema } from './slot-rules';

export const taskTitleSchema = z
  .string()
  .trim()
  .min(1, 'Le titre est requis.')
  .max(256, '256 caractères maximum.');

/** Markdown text (description, comment); empty becomes null. */
export const markdownSchema = z
  .string()
  .max(65_536, 'Texte trop long.')
  .transform((value) => (value.trim() ? value : null))
  .nullable();

export const effortSchema = z
  .number({ error: 'Nombre attendu.' })
  .min(0, 'L’effort ne peut pas être négatif.')
  .max(1_000_000, 'Valeur trop grande.')
  .nullable();

export const commentBodySchema = z
  .string()
  .max(65_536, 'Texte trop long.')
  .refine((value) => value.trim().length > 0, 'Le commentaire est vide.');

/** Identifier used in @mentions: lowercase letters, digits, "-" and "_". */
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, 'Au moins 2 caractères.')
  .max(39, '39 caractères maximum.')
  .regex(/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/, 'Lettres, chiffres, « - » et « _ » ; ni au début ni à la fin pour « - » et « _ ».');

export const contributorNameSchema = z.string().trim().min(1, 'Le nom est requis.').max(120, '120 caractères maximum.');

/**
 * Suggests a mention handle from a name ("Noémie Koelblen" → "noemie-koelblen").
 * @param {string} name Contributor name.
 * @returns {string} Handle candidate.
 */
export function suggestHandle(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 39);
}

export const contributorFormSchema = z.object({
  name: contributorNameSchema,
  handle: handleSchema,
});
export type ContributorFormValues = z.input<typeof contributorFormSchema>;

export const taskFormSchema = z
  .object({
    title: taskTitleSchema,
    projectId: z.string({ error: 'Le projet est requis.' }).min(1, 'Le projet est requis.'),
    description: z.string(),
    statusId: z.string().nullable(),
    priorityId: z.string().nullable(),
    typeId: z.string().nullable(),
    assigneeIds: z.array(z.string()),
    tagIds: z.array(z.string()),
    effort: z.union([z.number(), z.literal('')]).transform((value) => (value === '' ? null : value)).pipe(effortSchema),
    startDate: dateSchema,
    endDate: dateSchema,
    deadline: dateSchema,
    parentId: z.string().nullable(),
    milestoneId: z.string().nullable(),
    sprintIds: z.array(z.string()),
    /** Slots it is done on or out of; null: the default of the workspace. */
    slotRule: slotRuleSchema.nullable().default(null),
  })
  .refine((values) => !values.startDate || !values.endDate || values.endDate >= values.startDate, {
    path: ['endDate'],
    error: 'La date de fin doit suivre la date de début.',
  });
export type TaskFormValues = z.input<typeof taskFormSchema>;

export const milestoneTitleSchema = z
  .string()
  .trim()
  .min(1, 'Le titre est requis.')
  .max(120, '120 caractères maximum.');

export const milestoneFormSchema = z.object({
  title: milestoneTitleSchema,
  dueDate: dateSchema,
  description: z.string(),
});
export type MilestoneFormValues = z.input<typeof milestoneFormSchema>;

export const sprintNameSchema = z.string().trim().min(1, 'Le nom est requis.').max(120, '120 caractères maximum.');

export const sprintFormSchema = z
  .object({
    name: sprintNameSchema,
    startDate: z.iso.date({ error: 'La date de début est requise.' }),
    endDate: z.iso.date({ error: 'La date de fin est requise.' }),
    goal: z.string(),
  })
  .refine((values) => values.endDate >= values.startDate, { path: ['endDate'], error: 'La fin doit suivre le début.' });
export type SprintFormValues = z.input<typeof sprintFormSchema>;
