import { z } from 'zod';
import { endAfter, optionalText, personNameSchema, requiredText } from './rules';
import { daySchema } from '../dates/times';

export const MAX_ICON_BYTES = 1024 * 1024;
/** Maximum size of a file attached to a markdown text. */
// eslint-disable-next-line no-restricted-syntax -- MAX_ATTACHMENT_BYTES itself.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Messages of a refused icon, the same in the web and the API. */
export const ICON_ERRORS = {
  // eslint-disable-next-line no-restricted-syntax -- the messages themselves.
  tooLarge: 'Image trop lourde (1 Mo maximum).',
  format: 'Format non pris en charge (JPG, PNG, WebP ou SVG).',
} as const;

/**
 * Message of a file over `MAX_ATTACHMENT_BYTES`, the same in the web and the API.
 * @param {string} name File name.
 * @returns {string} « « x.pdf » est trop lourd (10 Mo maximum). »
 */
// eslint-disable-next-line no-restricted-syntax -- the messages themselves.
export const fileTooLarge = (name: string): string => `« ${name} » est trop lourd (10 Mo maximum).`;
/** Maximum nesting of projects: a root project is level 1. */
export const MAX_PROJECT_DEPTH = 5;
export const ICON_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;

/** Label of a project (not unique). */
export const projectLabelSchema = requiredText(120);

/** Link of a project (a mock-up, a repository…): its label, address and note; a file has no address. */
export const projectLinkSchema = z.object({
  label: requiredText(200),
  url: z.url({ protocol: /^https?$/, error: 'Lien invalide (http ou https).' }),
  note: optionalText(1000),
});
export type ProjectLinkInput = z.input<typeof projectLinkSchema>;

/** Kinds of workspace: professional (invoicing, clients, company) or personal. */
export const WORKSPACE_KINDS = ['PRO', 'PERSO'] as const;

/** Kinds of notification a workspace can give while another one is open. */
export const NOTIFICATION_SOURCES = ['ALARMS', 'CALENDAR', 'MAILS'] as const;

/** Kinds of resource of a project: an uploaded file or a link. */
export const PROJECT_RESOURCE_KINDS = ['FILE', 'LINK'] as const;

/** Longest label of a workspace. */
export const WORKSPACE_LABEL_MAX = 60;

/** Label of a workspace. */
export const workspaceLabelSchema = requiredText(WORKSPACE_LABEL_MAX);

/** Longest label of a configurable label item. */
export const LABEL_MAX = 50;

/** Label of a configurable label item (category, status…). */
export const labelTextSchema = requiredText(LABEL_MAX);

/** Colour of a label made without one (a GitHub label, a default status): Mantine's gray. */
// eslint-disable-next-line no-restricted-syntax -- the color itself.
export const DEFAULT_LABEL_COLOR = '#868e96';

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
export const dateSchema = daySchema().nullable();

export const clientFormSchema = z.object({
  name: personNameSchema,
  color: optionalColorSchema,
});
export type ClientFormValues = z.input<typeof clientFormSchema>;

export const projectFormSchema = z
  .object({
    label: projectLabelSchema,
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
  .refine(...endAfter('startDate', 'endDate'));
export type ProjectFormValues = z.input<typeof projectFormSchema>;

/** Configurable label (project category, project status…): unique label and color. */
// eslint-disable-next-line no-restricted-syntax -- the schema itself.
export const labelFormSchema = z.object({
  label: labelTextSchema,
  color: colorSchema,
});
export type LabelFormValues = z.input<typeof labelFormSchema>;
