import { Avatar, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { PaperclipIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { addressLabel, fullDate, senderName, type Address } from './mail-format';
import { FileLink } from '../files/FileLink';
import * as fmt from '../../lib/format';

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
        <Avatar name={senderName(from)} color="initials" />
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text size="sm" fw={600} style={{ overflowWrap: 'anywhere' }}>
            {from.map(addressLabel).join(', ')}
          </Text>
          <Text size="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            À : {to.map(addressLabel).join(', ') || '—'}
            {cc.length > 0 && ` · Cc : ${cc.map(addressLabel).join(', ')}`}
          </Text>
          <Text size="xs" c="dimmed">
            {fullDate(date)}
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
      {files.map((file) => (
        <Paper key={file.key} withBorder px="xs" py={4} radius="sm">
          <Group gap={6} wrap="nowrap">
            <PaperclipIcon aria-hidden />
            <FileLink url={file.url} name={file.name} size="sm">
              {file.name}
            </FileLink>
            <Text size="xs" c="dimmed">
              {fmt.fileSize(file.size)}
            </Text>
          </Group>
        </Paper>
      ))}
    </Group>
  );
}
