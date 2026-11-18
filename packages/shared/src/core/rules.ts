import { z } from 'zod';

/** Message of a person's name left empty (« Nom » only for persons, decision AD). */
export const PERSON_NAME_REQUIRED = 'Le nom est requis.';

/**
 * Text that must be given (a label, a name): trimmed, at most a length.
 * @param {number} max Most characters.
 * @param {string} [required] Message when empty. Optional. Default = « Le libellé est requis. » (decision AD).
 * @returns {z.ZodString} Rule.
 */
export const requiredText = (max: number, required = 'Le libellé est requis.') => z.string().trim().min(1, required).max(max, `${max} caractères maximum.`);

/**
 * Text that may be left empty (saved as null): trimmed, at most a length.
 * @param {number} max Most characters.
 * @returns {z.ZodType<string | null>} Rule.
 */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((value) => value || null)
    .nullable();

/** Message of a period whose end comes before its start (dates, times, min / max: decision Q). */
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
