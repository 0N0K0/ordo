import { Checkbox, Group, Pagination, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from '../pages/MailPage.module.css';

interface MailListPaneProps {
  /** Above the selection row (search field…). Optional. */
  top?: ReactNode;
  /** Mails ticked and mails of the page, for the « tout sélectionner » box. */
  selection: { count: number; total: number; onAll: (checked: boolean) => void };
  /** Next to the « tout sélectionner » box: the actions on the selection, or the list controls. */
  toolbar: ReactNode;
  /** Shown instead of the mails (error, skeleton, empty state). Optional. */
  status?: ReactNode;
  /** The mails shown are those of the previous query, while the next one loads: faded. */
  stale: boolean;
  /** Page shown (from 1), number of pages and the change of page. */
  page: number;
  pages: number;
  onPage: (page: number) => void;
  /** The rows (MailListItem). */
  children: ReactNode;
}

/**
 * Pane of a mail list: header (optional top, « tout sélectionner » box and toolbar), the scrolling rows, and the
 * pagination under them when there are several pages.
 * @param {MailListPaneProps} props Component props.
 * @returns {JSX.Element} Pane content.
 */
export function MailListPane({ top, selection, toolbar, status, stale, page, pages, onPage, children }: MailListPaneProps) {
  return (
    <>
      <Stack gap={6} p="xs" className={classes.listHeader}>
        {top}
        <Group justify="space-between" gap="xs" wrap="nowrap" mih={28}>
          <Checkbox
            size="xs"
            aria-label="Tout sélectionner sur la page"
            checked={selection.count > 0 && selection.count === selection.total}
            indeterminate={selection.count > 0 && selection.count < selection.total}
            disabled={!selection.total}
            onChange={(event) => selection.onAll(event.currentTarget.checked)}
          />
          {toolbar}
        </Group>
      </Stack>
      {status ?? (
        <div className={classes.paneScroll} style={{ opacity: stale ? 0.6 : 1 }}>
          {children}
        </div>
      )}
      {pages > 1 && (
        <Group justify="center" p="xs" className={classes.listFooter}>
          <Pagination size="sm" total={pages} value={page} onChange={onPage} />
        </Group>
      )}
    </>
  );
}
