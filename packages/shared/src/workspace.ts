import { z } from 'zod';

export const MAX_ICON_BYTES = 1024 * 1024;
/** Maximum size of a file attached to a markdown text. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Maximum nesting of projects: a root project is level 1. */
export const MAX_PROJECT_DEPTH = 5;
export const ICON_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;

/** Name of a client (not unique). */
export const entityNameSchema = z
  .string()
  .trim()
  .min(1, 'Le nom est requis.')
  .max(120, '120 caractères maximum.');

/** Title of a project (not unique). */
export const projectTitleSchema = z
  .string()
  .trim()
  .min(1, 'Le titre est requis.')
  .max(120, '120 caractères maximum.');

/** Name of a configurable label (category, status…). */
export const labelNameSchema = z
  .string()
  .trim()
  .min(1, 'Le nom est requis.')
  .max(50, '50 caractères maximum.');

export const colorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'Couleur invalide (format #rrggbb).')
  .transform((color) => color.toLowerCase());

/** Optional color: null or empty clears it. */
export const optionalColorSchema = z.union([colorSchema, z.literal('').transform(() => null)]).nullable();

export const descriptionSchema = z
  .string()
  .trim()
  .max(5000, '5000 caractères maximum.')
  .transform((value) => value || null)
  .nullable();

/** Calendar date, YYYY-MM-DD. */
export const dateSchema = z.iso.date({ error: 'Date invalide.' }).nullable();

export const clientFormSchema = z.object({
  name: entityNameSchema,
  color: optionalColorSchema,
});
export type ClientFormValues = z.input<typeof clientFormSchema>;

export const projectFormSchema = z
  .object({
    title: projectTitleSchema,
    clientId: z.string().nullable(),
    /** Parent project; the client is then inherited from it. */
    parentId: z.string().nullable(),
    categoryIds: z.array(z.string()),
    statusId: z.string().nullable(),
    description: descriptionSchema,
    startDate: dateSchema,
    endDate: dateSchema,
    color: optionalColorSchema,
  })
  .refine((values) => !values.startDate || !values.endDate || values.endDate >= values.startDate, {
    path: ['endDate'],
    error: 'La date de fin doit suivre la date de début.',
  });
export type ProjectFormValues = z.input<typeof projectFormSchema>;

/** Configurable label (project category, project status…): unique name and color. */
export const labelFormSchema = z.object({
  name: labelNameSchema,
  color: colorSchema,
});
export type LabelFormValues = z.input<typeof labelFormSchema>;
