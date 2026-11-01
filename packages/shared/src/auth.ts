import { z } from 'zod';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './password-rules';

const REQUIRED = 'Champ requis.';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Au moins 3 caractères.')
  .max(32, '32 caractères maximum.')
  .regex(/^[a-z0-9._-]+$/, 'Lettres, chiffres, « . », « _ » et « - » uniquement.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, REQUIRED)
  .max(254, 'Adresse trop longue.')
  .pipe(z.email({ error: 'Adresse email invalide.' }));

/** Identifier typed at login: a username or an email address. */
export const identifierSchema = z.string().trim().toLowerCase().min(1, REQUIRED);

/**
 * New password length rule. The zxcvbn score is checked by `strongPasswordSchema`
 * (`@ordo/shared/password-strength`), kept out of this entry because of its size.
 */
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Au moins ${MIN_PASSWORD_LENGTH} caractères.`)
  .max(MAX_PASSWORD_LENGTH, `${MAX_PASSWORD_LENGTH} caractères maximum.`);

const currentPasswordSchema = z.string().min(1, REQUIRED);

/**
 * Adds the "confirmation must match" rule to a form schema.
 * @param {T} schema Object schema holding `password` and `confirmation`.
 * @returns {T} Schema rejecting a mismatched confirmation.
 */
function withConfirmation<T extends z.ZodObject<{ password: z.ZodType<string>; confirmation: z.ZodString }>>(
  schema: T,
) {
  return schema.refine((values) => values.password === values.confirmation, {
    path: ['confirmation'],
    error: 'Les mots de passe ne correspondent pas.',
  });
}

export const loginFormSchema = z.object({
  identifier: identifierSchema,
  password: currentPasswordSchema,
});
export type LoginFormValues = z.input<typeof loginFormSchema>;

export const forgotPasswordFormSchema = z.object({
  identifier: identifierSchema,
});
export type ForgotPasswordFormValues = z.input<typeof forgotPasswordFormSchema>;

export const resetPasswordFormSchema = withConfirmation(
  z.object({
    password: passwordSchema,
    confirmation: z.string().min(1, REQUIRED),
  }),
);
export type ResetPasswordFormValues = z.input<typeof resetPasswordFormSchema>;

export const changePasswordFormSchema = withConfirmation(
  z.object({
    currentPassword: currentPasswordSchema,
    password: passwordSchema,
    confirmation: z.string().min(1, REQUIRED),
  }),
);
export type ChangePasswordFormValues = z.input<typeof changePasswordFormSchema>;

export const changeUsernameFormSchema = z.object({
  username: usernameSchema,
  currentPassword: currentPasswordSchema,
});
export type ChangeUsernameFormValues = z.input<typeof changeUsernameFormSchema>;

export const changeEmailFormSchema = z.object({
  email: emailSchema,
  currentPassword: currentPasswordSchema,
});
export type ChangeEmailFormValues = z.input<typeof changeEmailFormSchema>;
