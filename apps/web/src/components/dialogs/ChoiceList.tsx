import { Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { ActionButton } from '../actions/ActionButton';
import { FormActions } from './FormActions';

/** One answer of a question: its button. */
export interface Choice<T> {
  value: T;
  label: string;
  icon: ReactNode;
  /** Destructive answer (red). Optional. Default = false. */
  danger?: boolean;
}

/**
 * Answers of a question asked in a modal: the question, one button per answer (one under the other), then « Annuler »
 * bottom-right.
 * @param {{ question: ReactNode, choices: readonly Choice<T>[], onAnswer: (value: T | null) => void }} props Question, answers, and what to do with the answer (null: cancelled).
 * @returns {JSX.Element} Choices.
 */
export function ChoiceList<T>({ question, choices, onAnswer }: { question: ReactNode; choices: readonly Choice<T>[]; onAnswer: (value: T | null) => void }) {
  return (
    <Stack gap="md">
      <Text size="sm">{question}</Text>
      <Stack gap="xs">
        {choices.map((choice) => (
          <ActionButton key={String(choice.value)} danger={choice.danger} icon={choice.icon} onClick={() => onAnswer(choice.value)}>
            {choice.label}
          </ActionButton>
        ))}
      </Stack>
      <FormActions onCancel={() => onAnswer(null)} submitLabel={null} />
    </Stack>
  );
}
