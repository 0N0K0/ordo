// zxcvbn and its dictionaries weigh ~1.3 MB: exposed as `@ordo/shared/password-strength`,
// imported directly by the API and lazy-loaded by the front.
import { ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as common from '@zxcvbn-ts/language-common';
import * as fr from '@zxcvbn-ts/language-fr';
import { passwordSchema } from './auth';
import { MIN_PASSWORD_LENGTH, MIN_PASSWORD_SCORE, type PasswordStrength } from './password-rules';

let zxcvbn: ZxcvbnFactory | null = null;

/**
 * Returns the shared zxcvbn instance, built on first use.
 * @returns {ZxcvbnFactory} Configured zxcvbn instance.
 */
function getZxcvbn(): ZxcvbnFactory {
  zxcvbn ??= new ZxcvbnFactory({
    translations: fr.translations,
    graphs: common.adjacencyGraphs,
    dictionary: { ...common.dictionary, ...fr.dictionary },
  });
  return zxcvbn;
}

/**
 * Estimates how hard a password is to guess.
 * @param {string} password Password to evaluate.
 * @param {string[]} [userInputs=[]] User-specific words (username, email) to penalize. Optional. Default = [].
 * @returns {PasswordStrength} Score and French feedback.
 */
export function checkPasswordStrength(password: string, userInputs: string[] = []): PasswordStrength {
  const { score, feedback } = getZxcvbn().check(password, userInputs.filter(Boolean));
  return { score, warning: feedback.warning, suggestions: feedback.suggestions };
}

/**
 * Builds the full strong password rule: length and zxcvbn score.
 * @param {string[]} [userInputs=[]] Words tied to the user (username, email), rejected inside the password. Optional. Default = [].
 * @returns {z.ZodType<string>} Password schema.
 */
export function strongPasswordSchema(userInputs: string[] = []) {
  return passwordSchema.superRefine((password, ctx) => {
    if (password.length < MIN_PASSWORD_LENGTH) return;
    const { score, warning } = checkPasswordStrength(password, userInputs);
    if (score < MIN_PASSWORD_SCORE) {
      ctx.addIssue({ code: 'custom', message: warning ?? 'Mot de passe trop facile à deviner.' });
    }
  });
}
