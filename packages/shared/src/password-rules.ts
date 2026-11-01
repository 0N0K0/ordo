// Password rules without zxcvbn: safe to import from the main front bundle.

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
/** Minimum zxcvbn score (0–4) accepted for a password. */
export const MIN_PASSWORD_SCORE = 3;

export interface PasswordStrength {
  /** zxcvbn score, from 0 (very weak) to 4 (very strong). */
  score: 0 | 1 | 2 | 3 | 4;
  warning: string | null;
  suggestions: string[];
}
