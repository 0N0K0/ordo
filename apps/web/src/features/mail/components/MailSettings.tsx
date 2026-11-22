import { Stack } from '@mantine/core';
import { MailAccountsManager } from './MailAccountsManager';
import { MailLabelsManager } from './MailLabelsManager';

/**
 * Settings of the mails: the mail accounts and the flags. In the settings of the mail page and in the mail tab of a
 * project.
 * @returns {JSX.Element} Settings.
 */
export function MailSettings() {
  return (
    <Stack gap="md">
      <MailAccountsManager />
      <MailLabelsManager />
    </Stack>
  );
}
