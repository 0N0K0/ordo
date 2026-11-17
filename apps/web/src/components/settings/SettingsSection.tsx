import { Paper, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { SectionHeader } from '../actions/SectionHeader';

interface SettingsSectionProps {
  title: ReactNode;
  /** What the section holds, under its title. Optional. */
  description?: ReactNode;
  /** Its actions, on the right of its title. Optional. */
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * Section of the settings (and of the other pages made of cards), the same everywhere: a card, its header (title,
 * description, actions on the right), then its content.
 * @param {SettingsSectionProps} props Component props.
 * @returns {JSX.Element} Section.
 */
export function SettingsSection({ title, description, actions, children }: SettingsSectionProps) {
  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <SectionHeader title={title} description={description} actions={actions} />
        {children}
      </Stack>
    </Paper>
  );
}
