import { plural } from '../../../lib/text';
import { Badge, CloseButton, Group, Text } from '@mantine/core';
import { SelectionAllIcon } from '@phosphor-icons/react';
import { ALL_COLUMNS, type BulkSelection } from './bulk-selection';

interface BulkHintProps {
  selection: BulkSelection | null;
  /** Name of a column. */
  labelOf: (column: string) => string;
  onClear: () => void;
}

/**
 * What the bulk selection of a table is: its cells, and that a change made in one applies to all.
 * @param {BulkHintProps} props Component props.
 * @returns {JSX.Element | null} Hint.
 */
export function BulkHint({ selection, labelOf, onClear }: BulkHintProps) {
  if (!selection) return null;
  const count = selection.keys.length;
  if (selection.column === ALL_COLUMNS)
    return (
      <Group gap="xs" role="status" aria-live="polite">
        <Badge variant="light" tt="none" size="lg" leftSection={<SelectionAllIcon aria-hidden />}>
          {count} {plural(count, 'ligne')} {plural(count, 'cochée')}
        </Badge>
        <Text size="xs" c="dimmed">
          Modifiez un champ de l’une d’elles : le changement s’applique à toutes (autant de champs que voulu).
        </Text>
        <CloseButton size="sm" aria-label="Tout décocher" onClick={onClear} />
      </Group>
    );
  return (
    <Group gap="xs" role="status" aria-live="polite">
      <Badge variant="light" tt="none" size="lg" leftSection={<SelectionAllIcon aria-hidden />}>
        {count} {plural(count, 'cellule')} « {labelOf(selection.column)} » {plural(count, 'sélectionnée')}
      </Badge>
      <Text size="xs" c="dimmed">
        Modifiez-en une : le changement s’applique à toutes. Ctrl / ⌘ + clic ou Maj + clic pour en ajouter, Échap pour quitter.
      </Text>
      <CloseButton size="sm" aria-label="Quitter la sélection" onClick={onClear} />
    </Group>
  );
}
