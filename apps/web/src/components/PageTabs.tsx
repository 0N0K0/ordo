import { Tabs, type TabsProps } from '@mantine/core';
import classes from './PageTabs.module.css';

/**
 * Tabs of a page (its sections), told apart from the tabs of the views of a table: on all the width of the page
 * (beyond its margins), shared out evenly with their titles centered, bordered, the active one open on its content
 * like the tab of a folder; they scroll sideways when the window is too narrow for them, and stay at the top of the
 * window while the page scrolls on a large screen. Its parts are those of Mantine's tabs.
 * @param {Omit<TabsProps, 'classNames' | 'variant' | 'unstyled' | 'orientation'>} props Tabs props (their look is the page's).
 * @returns {JSX.Element} Tabs.
 */
export function PageTabs(props: Omit<TabsProps, 'classNames' | 'variant' | 'unstyled' | 'orientation'>) {
  return (
    <Tabs {...props} unstyled data-page-tabs classNames={{ root: classes.root, list: classes.list, tab: classes.tab, tabSection: classes.section, tabLabel: classes.label, panel: classes.panel }} />
  );
}

/* Its parts: those of Mantine's tabs. */
PageTabs.List = Tabs.List;
PageTabs.Tab = Tabs.Tab;
PageTabs.Panel = Tabs.Panel;
