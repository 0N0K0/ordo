import { Progress, Stack, Text } from '@mantine/core';
import { MIN_PASSWORD_LENGTH, MIN_PASSWORD_SCORE } from '@ordo/shared';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';

type CheckPasswordStrength = typeof import('@ordo/shared/password-strength').checkPasswordStrength;

const LABELS = ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'] as const;
const COLORS = ['red', 'red', 'orange', 'teal', 'green'] as const;

let checkerPromise: Promise<CheckPasswordStrength> | null = null;

/**
 * Downloads zxcvbn and its dictionaries (~1.3 MB) once, outside the main bundle.
 * @returns {Promise<CheckPasswordStrength>} Strength checker.
 */
function loadChecker(): Promise<CheckPasswordStrength> {
  checkerPromise ??= import('@ordo/shared/password-strength').then((module) => module.checkPasswordStrength);
  checkerPromise.catch(() => {
    checkerPromise = null;
  });
  return checkerPromise;
}

/**
 * Loads the strength checker when the component mounts.
 * @returns {CheckPasswordStrength | null} Checker, or null while loading or if loading failed.
 */
function useStrengthChecker(): CheckPasswordStrength | null {
  const [checker, setChecker] = useState<CheckPasswordStrength | null>(null);

  useEffect(() => {
    let active = true;
    loadChecker()
      .then((loaded) => active && setChecker(() => loaded))
      .catch((error: unknown) => console.error('Password strength checker failed to load:', error));
    return () => {
      active = false;
    };
  }, []);

  return checker;
}

interface PasswordStrengthProps {
  /** Password being typed. */
  value: string;
  /** Username and email, rejected inside the password. */
  userInputs?: string[];
}

/**
 * Strength meter displayed under a new password field.
 * @param {PasswordStrengthProps} props Component props.
 * @param {string} props.value Password being typed.
 * @param {string[]} [props.userInputs=[]] Words tied to the user. Optional. Default = [].
 * @returns {JSX.Element | null} Meter, or nothing while the field is empty.
 */
export function PasswordStrength({ value, userInputs = [] }: PasswordStrengthProps) {
  const checker = useStrengthChecker();
  const password = useDeferredValue(value);
  const inputsKey = userInputs.join('\n');
  const strength = useMemo(
    () => (checker && password ? checker(password, inputsKey ? inputsKey.split('\n') : []) : null),
    [checker, password, inputsKey],
  );

  if (!password) return null;

  const tooShort = password.length < MIN_PASSWORD_LENGTH;
  const score = strength ? (tooShort ? Math.min(strength.score, 1) : strength.score) : null;
  const hint = tooShort
    ? `Encore ${MIN_PASSWORD_LENGTH - password.length} caractère(s) au minimum.`
    : strength && strength.score < MIN_PASSWORD_SCORE
      ? (strength.suggestions[0] ?? 'Ajoutez des mots ou des caractères peu courants.')
      : null;

  return (
    <Stack gap={4} aria-live="polite">
      <Progress
        value={score === null ? 0 : ((score + 1) / LABELS.length) * 100}
        color={score === null ? 'gray' : COLORS[score]}
        size="sm"
        aria-label="Robustesse du mot de passe"
      />
      <Text size="xs" c="dimmed">
        {score === null ? 'Analyse de la robustesse…' : LABELS[score]}
        {hint && ` — ${hint}`}
      </Text>
    </Stack>
  );
}
