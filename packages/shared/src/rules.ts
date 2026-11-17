import { z } from 'zod';

/**
 * Text that must be given (a name, a title, a label): trimmed, at most a length.
 * @param {number} max Most characters.
 * @param {string} [required] Message when empty. Optional. Default = « Le nom est requis. ».
 * @returns {z.ZodString} Rule.
 */
export const requiredText = (max: number, required = 'Le nom est requis.') => z.string().trim().min(1, required).max(max, `${max} caractères maximum.`);

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
