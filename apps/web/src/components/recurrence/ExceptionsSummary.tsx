import { Group, Stack, Text } from '@mantine/core';
import { PencilSimpleIcon } from '@phosphor-icons/react';
import { ActionButton } from '../actions/ActionButton';
import { LabeledField } from '../inputs/LabeledField';
import type { ExceptionLine } from './exceptions';
import { useFoldedExceptions } from './use-folded-exceptions';

interface ExceptionsSummaryProps {
  /** Exceptions in words, in any order (sorted by day). */
  lines: readonly ExceptionLine[];
  /** Opens their modal (« Modifier les exceptions »); none: read only. Optional. */
  onEdit?: () => void;
  /** Shown without any exception (« Aucune exception »), to add one. Optional. Default = nothing shown. */
  showEmpty?: boolean;
}

/**
 * Exceptions of a repetition, under it, the same everywhere: 5 of them, or 4 and « + X exceptions » unfolding the
 * others in place (`useFoldedExceptions`); a button opening their modal.
 * @param {ExceptionsSummaryProps} props Component props.
 * @returns {JSX.Element | null} Summary, nothing without exceptions (unless `showEmpty`).
 */
export function ExceptionsSummary({ lines, onEdit, showEmpty = false }: ExceptionsSummaryProps) {
  const { sorted, shown, more } = useFoldedExceptions(lines);
  if (!sorted.length && !showEmpty) return null;
  return (
    <LabeledField label="Exceptions">
      <Group justify="space-between" gap="sm" wrap="nowrap" align="flex-start">
        <Stack gap={2} style={{ minWidth: 0 }}>
          {shown.map((line) => (
            <Text key={line.key} size="sm">
              {line.text}
            </Text>
          ))}
          {!sorted.length && (
            <Text size="sm" c="dimmed">
              Aucune exception
            </Text>
          )}
          {more}
        </Stack>
        {onEdit && (
          <ActionButton priority="secondary" size="xs" icon={<PencilSimpleIcon aria-hidden />} style={{ flex: 'none' }} onClick={onEdit}>
            Modifier les exceptions
          </ActionButton>
        )}
      </Group>
    </LabeledField>
  );
}
