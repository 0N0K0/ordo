import { FoldHeading } from '../../../components/actions/FoldHeading';
import { Collapse } from '@mantine/core';
import { Caption } from '../../../components/page/Caption';
import type { CSSProperties, ReactNode, Ref } from 'react';
import { ActionsMenu, type RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { foldEntries } from '../lib/fold-entries';
import classes from './SidebarSection.module.css';

export interface SidebarSectionChrome {
  title: string;
  opened: boolean;
  onToggle: () => void;
  /** Expands or collapses every node of the section; omitted when nothing can be folded. */
  onSetAllExpanded?: (expanded: boolean) => void;
  /** Extra menu entries, shown above the fold options. */
  actions?: RowMenuEntry[];
}

interface SidebarSectionProps extends SidebarSectionChrome {
  /** Ref of the header (a drop target of the drag and drop of the tree). Optional. */
  headerRef?: Ref<HTMLDivElement>;
  /** Style of the header (its move while a row is dragged). Optional. */
  headerStyle?: CSSProperties;
  children: ReactNode;
}

/**
 * Collapsible sidebar section (« Favoris », « Clients », « Projets », « Archives ») with a menu to fold or unfold its
 * whole tree; no count on its title.
 * @param {SidebarSectionProps} props Component props.
 * @param {string} props.title Section title.
 * @param {boolean} props.opened Whether the section is open.
 * @param {() => void} props.onToggle Toggles the section.
 * @param {(expanded: boolean) => void} [props.onSetAllExpanded] Folds or unfolds every node. Optional.
 * @param {RowMenuEntry[]} [props.actions] Extra menu entries. Optional.
 * @param {Ref<HTMLDivElement>} [props.headerRef] Ref of the header. Optional.
 * @param {CSSProperties} [props.headerStyle] Style of the header. Optional.
 * @param {ReactNode} props.children Section content.
 * @returns {JSX.Element} Section.
 */
export function SidebarSection({ title, opened, onToggle, onSetAllExpanded, actions, headerRef, headerStyle, children }: SidebarSectionProps) {
  return (
    <section className={classes.section}>
      <div ref={headerRef} style={headerStyle} className={classes.header}>
        <FoldHeading className={classes.toggle} expanded={opened} onToggle={onToggle}>
          <Caption>{title}</Caption>
        </FoldHeading>
        <ActionsMenu about={`la section « ${title} »`} size="sm" items={[...(actions ?? []), 'divider', ...(onSetAllExpanded ? foldEntries(onSetAllExpanded) : [])]} />
      </div>
      <Collapse expanded={opened} transitionDuration={150}>
        {children}
      </Collapse>
    </section>
  );
}
