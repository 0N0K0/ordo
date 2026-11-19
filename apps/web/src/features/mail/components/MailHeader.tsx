import * as fmt from '../../../lib/format';
import { PersonAvatar } from '../../../components/people/people-rows';
import { Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { addressLabel, senderName, type Address } from '../lib/mail-format';
import { FileBadge } from '../../../components/items/FileBadge';
import { handleFileClick } from '../../files/lib/open-file';
import { downloadUrl, viewableKind } from '../../files/lib/viewable';

interface MailHeaderProps {
  subject: string;
  from: Address[];
  to: Address[];
  cc: Address[];
  date: string;
  /** Actions, on the right of the subject. */
  actions?: ReactNode;
  /** Extra line under the recipients (linked projects…). */
  extra?: ReactNode;
}

/**
 * Header of an open mail: subject, sender, recipients and date.
 * @param {MailHeaderProps} props Component props.
 * @returns {JSX.Element} Header.
 */
export function MailHeader({ subject, from, to, cc, date, actions, extra }: MailHeaderProps) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Title order={2} size="h4" style={{ overflowWrap: 'anywhere' }}>
          {subject}
        </Title>
        {actions}
      </Group>
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <PersonAvatar name={senderName(from)} size="md" />
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>
            {from.map(addressLabel).join(', ')}
          </Text>
          <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            À : {to.map(addressLabel).join(', ') || '—'}
            {cc.length > 0 && ` · Cc : ${cc.map(addressLabel).join(', ')}`}
          </Text>
          <Text size="xs" c="dimmed">
            {fmt.dateTime(date)}
          </Text>
          {extra}
        </Stack>
      </Group>
    </Stack>
  );
}

/**
 * Files of a mail, as download links.
 * @param {{ files: { key: string, name: string, size: number, url: string }[] }} props Component props.
 * @returns {JSX.Element | null} Files.
 */
export function MailFiles({ files }: { files: { key: string; name: string; size: number; url: string }[] }) {
  if (files.length === 0) return null;
  return (
    <Group gap="xs">
      {files.map((file) => {
        // A PDF or an image opens in the app's viewer, another file downloads.
        const viewable = Boolean(viewableKind({ url: file.url, filename: file.name }));
        return (
          <FileBadge
            key={file.key}
            filename={file.name}
            size={file.size}
            href={viewable ? file.url : downloadUrl(file.url)}
            external={viewable}
            onClick={(event) => handleFileClick(event, { url: file.url, filename: file.name })}
          />
        );
      })}
    </Group>
  );
}
