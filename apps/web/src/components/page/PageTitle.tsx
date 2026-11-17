import { Title } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './PageTitle.module.css';

/**
 * Title of a page, shown on a phone only: from the tablet on, the header shows it (after the workspace).
 * @param {{ children: ReactNode }} props Component props.
 * @param {ReactNode} props.children Name of the page.
 * @returns {JSX.Element} Title.
 */
export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <Title order={1} size="h2" className={classes.title}>
      {children}
    </Title>
  );
}
