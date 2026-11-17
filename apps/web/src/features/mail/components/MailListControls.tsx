import { Group, SegmentedControl, Select } from '@mantine/core';
import { DONE_FILTERS, type DoneFilter } from '../lib/mail-list';

interface MailListControlsProps {
  sorts: { value: string; label: string }[];
  sort: string;
  onSort: (sort: string) => void;
  done: DoneFilter;
  /** Changes the done state shown (none: not offered, an advanced search has its own). Optional. */
  onDone?: (done: DoneFilter) => void;
}

/**
 * Order and done state of a list of mails (the page Mails, the mails of a project).
 * @param {MailListControlsProps} props Component props.
 * @returns {JSX.Element} Controls.
 */
export function MailListControls({ sorts, sort, onSort, done, onDone }: MailListControlsProps) {
  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      <Select size="xs" w={150} aria-label="Trier" data={sorts} value={sort} allowDeselect={false} onChange={(value) => value && onSort(value)} />
      {onDone && <SegmentedControl size="xs" aria-label="Mails traités" data={DONE_FILTERS} value={done} onChange={(value) => onDone(value as DoneFilter)} />}
    </Group>
  );
}
