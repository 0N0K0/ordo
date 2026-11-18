import { ActionIcon, Badge, Collapse, Group, Text, UnstyledButton } from '@mantine/core';
import { CaretRightIcon, DotsThreeIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ActionsMenu, type RowMenuEntry } from '../../../components/data-table/cells/RowActions';
import { foldEntries } from '../lib/fold-entries';
import classes from './SidebarSection.module.css';

interface SidebarSectionProps {
  title: string;
  count: number;
  opened: boolean;
  onToggle: () => void;
  /** Expands or collapses every node of the section; omitted when nothing can be folded. */
  onSetAllExpanded?: (expanded: boolean) => void;
  /** Extra menu entries, shown above the fold options. */
  actions?: RowMenuEntry[];
  children: ReactNode;
}

/**
 * Collapsible sidebar section (Favoris, Clients, Archives) with a menu to fold or unfold its whole tree.
 * @param {SidebarSectionProps} props Component props.
 * @param {string} props.title Section title.
 * @param {number} props.count Number of items, shown next to the title.
 * @param {boolean} props.opened Whether the section is open.
 * @param {() => void} props.onToggle Toggles the section.
 * @param {(expanded: boolean) => void} [props.onSetAllExpanded] Folds or unfolds every node. Optional.
 * @param {RowMenuEntry[]} [props.actions] Extra menu entries. Optional.
 * @param {ReactNode} props.children Section content.
 * @returns {JSX.Element} Section.
 */
export function SidebarSection({
  title,
  count,
  opened,
  onToggle,
  onSetAllExpanded,
  actions,
  children,
}: SidebarSectionProps) {
  return (
    <section className={classes.section}>
      <div className={classes.header}>
        <UnstyledButton className={classes.toggle} onClick={onToggle} aria-expanded={opened}>
          <Group gap={6} wrap="nowrap">
            <CaretRightIcon className={classes.chevron} data-opened={opened || undefined} aria-hidden />
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              {title}
            </Text>
          </Group>
          {count > 0 && (
            <Badge size="xs" variant="light" color="gray">
              {count}
            </Badge>
          )}
        </UnstyledButton>
        <ActionsMenu
          name={`la section ${title}`}
          target={
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Actions sur la section ${title}`}>
              <DotsThreeIcon weight="bold" aria-hidden />
            </ActionIcon>
          }
          items={[...(actions ?? []), 'divider', ...(onSetAllExpanded ? foldEntries(onSetAllExpanded) : [])]}
        />
      </div>
      <Collapse expanded={opened} transitionDuration={150}>
        {children}
      </Collapse>
    </section>
  );
}
