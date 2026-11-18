import { arrayMove } from '@dnd-kit/sortable';
import { ActionIcon, Button, Group, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';

interface SortPanelProps<K extends string> {
  sorting: { id: K; desc: boolean }[];
  onChange: (sorting: { id: K; desc: boolean }[]) => void;
  /** Sort keys offered. */
  keys: readonly K[];
  labels: Record<K, string>;
  /** What the manual order allows. */
  manualText: string;
  /** Tip under the sorts. Optional. */
  hint?: string;
}

/**
 * Sort levels: column, direction, priority order. Empty means manual order.
 * @param {SortPanelProps<K>} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function SortPanel<K extends string>({ sorting, onChange, keys, labels, manualText, hint }: SortPanelProps<K>) {
  const used = new Set(sorting.map((sort) => sort.id));
  const available = keys.filter((key) => !used.has(key));
  return (
    <Stack gap="xs" w={380}>
      {sorting.length === 0 ? (
        <Text size="sm" c="dimmed">
          {manualText}
        </Text>
      ) : (
        sorting.map((sort, index) => (
          <Group key={sort.id} gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed" w={48}>
              {index === 0 ? 'Trier par' : 'puis'}
            </Text>
            <Select
              comboboxProps={{ withinPortal: false }}
              size="xs"
              aria-label="Colonne"
              data={[sort.id, ...available].map((key) => ({ value: key, label: labels[key] }))}
              value={sort.id}
              allowDeselect={false}
              onChange={(id) => id && onChange(sorting.map((item, i) => (i === index ? { ...item, id: id as K } : item)))}
              style={{ flex: 1 }}
            />
            <SegmentedControl
              size="xs"
              value={sort.desc ? 'desc' : 'asc'}
              onChange={(value) => onChange(sorting.map((item, i) => (i === index ? { ...item, desc: value === 'desc' } : item)))}
              data={[
                { value: 'asc', label: '↑' },
                { value: 'desc', label: '↓' },
              ]}
              aria-label="Sens"
            />
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Monter" disabled={index === 0} onClick={() => onChange(arrayMove(sorting, index, index - 1))}>
              <ArrowUpIcon aria-hidden />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Descendre" disabled={index === sorting.length - 1} onClick={() => onChange(arrayMove(sorting, index, index + 1))}>
              <ArrowDownIcon aria-hidden />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Retirer ce tri" onClick={() => onChange(sorting.filter((_, i) => i !== index))}>
              <TrashIcon aria-hidden />
            </ActionIcon>
          </Group>
        ))
      )}
      <Group justify="space-between">
        <Button size="compact-sm" variant="subtle" leftSection={<PlusIcon aria-hidden />} disabled={available.length === 0} onClick={() => onChange([...sorting, { id: available[0], desc: false }])}>
          Ajouter un tri
        </Button>
        {sorting.length > 0 && (
          <Button size="compact-sm" variant="subtle" color="gray" leftSection={<ArrowCounterClockwiseIcon aria-hidden />} onClick={() => onChange([])}>
            Revenir à l’ordre manuel
          </Button>
        )}
      </Group>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Stack>
  );
}
