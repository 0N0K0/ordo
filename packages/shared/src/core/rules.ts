import { z } from 'zod';

/** Message of a person's name left empty (« Nom » only for persons, decision AD). */
export const PERSON_NAME_REQUIRED = 'Le nom est requis.';

/** Most characters of a short free text: label, name, title, location, reason… (decision DO). */
export const TEXT_MAX = 250;
/** Most characters of a markdown text: description, comment, objective… (decision DO). */
export const MARKDOWN_MAX = 65_536;
/** Most characters of a plain multi-line text (a textarea without markdown, decision DO). */
export const PLAIN_TEXT_MAX = 4000;

/**
 * Most characters of a legal mention of the company or of a document: VAT mention, payment terms, late interest,
 * registration (decision DO, amended).
 */
export const LEGAL_TEXT_MAX = 500;

/** Message of a short text over `TEXT_MAX`. */
export const TEXT_TOO_LONG = `${TEXT_MAX} caractères maximum.`;
/** Message of a legal mention over `LEGAL_TEXT_MAX`. */
export const LEGAL_TEXT_TOO_LONG = `${LEGAL_TEXT_MAX} caractères maximum.`;
/** Message of a markdown text over `MARKDOWN_MAX`. */
// eslint-disable-next-line no-restricted-syntax -- the message itself.
export const MARKDOWN_TOO_LONG = 'Texte trop long.';
/** Message of a plain multi-line text over `PLAIN_TEXT_MAX`. */
// eslint-disable-next-line no-restricted-syntax -- the message itself.
export const PLAIN_TEXT_TOO_LONG = '4 000 caractères maximum.';

/** Short free text (decision DO): trimmed, at most `TEXT_MAX`, may be empty. */
export const shortTextSchema = z.string().trim().max(TEXT_MAX, TEXT_TOO_LONG);

/**
 * Short free text that must be given (a label, a name): trimmed, at most `TEXT_MAX` (decision DO).
 * @param {string} [required] Message when empty. Optional. Default = « Le libellé est requis. » (decision AD).
 * @returns {z.ZodString} Rule.
 */
export const requiredText = (required = 'Le libellé est requis.') => z.string().trim().min(1, required).max(TEXT_MAX, TEXT_TOO_LONG);

/** Name of a person, physical or legal (contributor, relation, contact, client, counterparty, company): required, at most `TEXT_MAX`. */
// eslint-disable-next-line no-restricted-syntax -- the schema itself.
export const personNameSchema = requiredText(PERSON_NAME_REQUIRED);

/**
 * Short free text that may be left empty (saved as null): trimmed, at most `TEXT_MAX` (decision DO). A field with a
 * format of its own (VAT number, activity code, phone) passes its named maximum instead.
 * @param {number} [max] Most characters, for a field with a format only. Optional. Default = `TEXT_MAX`.
 * @returns {z.ZodType<string | null>} Rule.
 */
export const optionalText = (max: number = TEXT_MAX) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((value) => value || null)
    .nullable();

/** Legal mention (VAT mention, payment terms, late interest, registration): trimmed, at most `LEGAL_TEXT_MAX`, may be empty. */
export const legalTextSchema = z.string().trim().max(LEGAL_TEXT_MAX, LEGAL_TEXT_TOO_LONG);

/**
 * Legal mention that may be left empty (saved as null): trimmed, at most `LEGAL_TEXT_MAX`.
 * @returns {z.ZodType<string | null>} Rule.
 */
export const optionalLegalText = () => legalTextSchema.transform((value) => value || null).nullable();

/** Plain multi-line text (a textarea without markdown, decision DO): trimmed, at most `PLAIN_TEXT_MAX`, may be empty. */
export const plainTextSchema = z.string().trim().max(PLAIN_TEXT_MAX, PLAIN_TEXT_TOO_LONG);

/**
 * Plain multi-line text that may be left empty (saved as null): trimmed, at most `PLAIN_TEXT_MAX` (decision DO).
 * @returns {z.ZodType<string | null>} Rule.
 */
export const optionalPlainText = () => plainTextSchema.transform((value) => value || null).nullable();

/** Markdown text as written (spaces kept), at most `MARKDOWN_MAX` (decision DO). */
export const markdownTextSchema = z.string().max(MARKDOWN_MAX, MARKDOWN_TOO_LONG);

/** Markdown text (description, comment, note…); blank becomes null. */
export const markdownSchema = markdownTextSchema.transform((value) => (value.trim() ? value : null)).nullable();

/** Message of a period whose end comes before its start (dates, times, min / max: decision Q). */
// eslint-disable-next-line no-restricted-syntax -- the message itself.
export const END_AFTER_START = 'La fin doit suivre le début.';

/**
 * Whether the end of a period follows its start; a missing bound always does.
 * @param {string | number | null | undefined} start Start (day, time, minimum…).
 * @param {string | number | null | undefined} end End (day, time, maximum…).
 * @param {boolean} [strict=false] The end must come strictly after (not on the start). Optional. Default = false.
 * @returns {boolean} Whether it does.
 */
export function endsAfter(start: string | number | null | undefined, end: string | number | null | undefined, strict = false): boolean {
  if (start === null || start === undefined || start === '' || end === null || end === undefined || end === '') return true;
  return strict ? end > start : end >= start;
}

/**
 * Refinement of an object with a start and an end: the end follows the start (see `endsAfter`), else
 * « La fin doit suivre le début. » on the end. Spread into `.refine(...endAfter('from', 'to'))`.
 * @param {string} startKey Field of the start.
 * @param {string} endKey Field of the end.
 * @param {boolean} [strict=false] The end must come strictly after. Optional. Default = false.
 * @returns {[(value: object) => boolean, { path: string[], message: string }]} Check and its issue.
 */
export function endAfter<S extends string, E extends string>(startKey: S, endKey: E, strict = false) {
  const check = (value: { [key in S | E]?: string | number | null }) => endsAfter(value[startKey], value[endKey], strict);
  const issue: { path: PropertyKey[]; message: string } = { path: [endKey], message: END_AFTER_START };
  return [check, issue] as const;
}
