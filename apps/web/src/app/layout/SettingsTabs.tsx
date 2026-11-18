import { Tabs } from '@mantine/core';
import type { ReactNode } from 'react';

/** Tab of the settings of a page. */
export interface SettingsTabItem<T extends string> {
  value: T;
  label: ReactNode;
  /** Icon before the label. Optional. */
  icon?: ReactNode;
}

interface SettingsTabsProps<T extends string> {
  /** Tab shown. */
  value: T;
  onChange: (value: T) => void;
  tabs: SettingsTabItem<T>[];
  /** The hidden tabs stay mounted. Optional. Default = true. */
  keepMounted?: boolean;
  /** Their panels (SettingsTabPanel). */
  children: ReactNode;
}

/**
 * Tabs of the settings of a page, in the settings sidebar (PageSettings): the same tabs everywhere, one section at a time.
 * @param {SettingsTabsProps<T>} props Component props.
 * @returns {JSX.Element} Tabs.
 */
export function SettingsTabs<T extends string>({ value, onChange, tabs, keepMounted = true, children }: SettingsTabsProps<T>) {
  return (
    <Tabs value={value} onChange={(next) => next && onChange(next as T)} keepMounted={keepMounted}>
      <Tabs.List mb="md">
        {tabs.map((tab) => (
          <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {children}
    </Tabs>
  );
}

/**
 * Panel of a tab of SettingsTabs.
 * @param {{ value: string, children: ReactNode }} props Component props: the value of its tab, and its content.
 * @returns {JSX.Element} Panel.
 */
export function SettingsTabPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <Tabs.Panel value={value} style={{ minWidth: 0 }}>
      {children}
    </Tabs.Panel>
  );
}
