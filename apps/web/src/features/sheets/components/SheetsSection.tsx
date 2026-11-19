import { Stack } from '@mantine/core';
import { ActionButton } from '../../../components/actions/ActionButton';
import { ClipboardTextIcon } from '@phosphor-icons/react';
import { openFormPanel } from '../../../components/panels/panels';
import * as fmt from '../../../lib/format';
import type { SheetOwner } from '../api';
import { ChecklistPanel } from './ChecklistPanel';
import { SheetLinksField } from './SheetLinksField';

/**
 * Sheets of a routine, an event or a task, and its checklist (of an occurrence) opened in the side panel.
 * @param {{ owner: SheetOwner, occurrenceDate?: string | null, label: string }} props Owner, occurrence (routine, event), its label in the title.
 * @returns {JSX.Element} Section.
 */
export function SheetsSection({ owner, occurrenceDate = null, label }: { owner: SheetOwner; occurrenceDate?: string | null; label: string }) {
  return (
    <Stack gap="xs">
      <SheetLinksField owner={owner} />
      <div>
        <ActionButton
          priority="secondary"
          size="xs"
          icon={<ClipboardTextIcon aria-hidden />}
          onClick={() =>
            openFormPanel(`Liste à cocher · ${label}${occurrenceDate ? ` · ${fmt.day(occurrenceDate)}` : ''}`, () => <ChecklistPanel owner={owner} occurrenceDate={occurrenceDate} />, 'lg')
          }
        >
          {occurrenceDate ? `Liste à cocher du ${fmt.day(occurrenceDate)}` : 'Liste à cocher'}
        </ActionButton>
      </div>
    </Stack>
  );
}
