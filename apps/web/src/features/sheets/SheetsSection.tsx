import { Button, Stack } from '@mantine/core';
import { ClipboardTextIcon } from '@phosphor-icons/react';
import { openFormPanel } from '../../components/panels/panels';
import * as fmt from '../../lib/format';
import type { SheetOwner } from './api';
import { ChecklistPanel } from './ChecklistPanel';
import { SheetLinksField } from './SheetLinksField';

/**
 * Sheets of a routine, an event or a task, and its checklist (of an occurrence) opened in the side panel.
 * @param {{ owner: SheetOwner, occurrenceDate?: string | null, name: string }} props Owner, occurrence (routine, event), name in the title.
 * @returns {JSX.Element} Section.
 */
export function SheetsSection({ owner, occurrenceDate = null, name }: { owner: SheetOwner; occurrenceDate?: string | null; name: string }) {
  return (
    <Stack gap="xs">
      <SheetLinksField owner={owner} />
      <div>
        <Button
          size="xs"
          variant="light"
          leftSection={<ClipboardTextIcon aria-hidden />}
          onClick={() =>
            openFormPanel(`Liste à cocher · ${name}${occurrenceDate ? ` · ${fmt.day(occurrenceDate)}` : ''}`, () => <ChecklistPanel owner={owner} occurrenceDate={occurrenceDate} />, 'lg')
          }
        >
          {occurrenceDate ? `Liste à cocher du ${fmt.day(occurrenceDate)}` : 'Liste à cocher'}
        </Button>
      </div>
    </Stack>
  );
}
