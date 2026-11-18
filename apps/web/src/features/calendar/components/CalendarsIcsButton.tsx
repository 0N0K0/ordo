import { Tooltip } from '@mantine/core';
import { DownloadSimpleIcon } from '@phosphor-icons/react';
import { calendarIcsUrl } from '../api';
import { ActionButton } from '../../../components/actions/ActionButton';

/**
 * Button downloading every calendar of the workspace as one .ics file (for another calendar app), the same in the
 * calendars settings and the export section of the agenda.
 * @param {{ disabled?: boolean }} props Component props: disabled (no calendar). Optional.
 * @returns {JSX.Element} Button.
 */
export function CalendarsIcsButton({ disabled = false }: { disabled?: boolean }) {
  return (
    <Tooltip label="Tous les calendriers de l’espace, dans un fichier pour un autre agenda (Google, Apple, Outlook…)">
      {/* eslint-disable-next-line no-restricted-syntax -- the one button of the whole export. */}
      <ActionButton priority="secondary" href={calendarIcsUrl(null)} download icon={<DownloadSimpleIcon aria-hidden />} disabled={disabled}>
        Tout exporter (.ics)
      </ActionButton>
    </Tooltip>
  );
}
