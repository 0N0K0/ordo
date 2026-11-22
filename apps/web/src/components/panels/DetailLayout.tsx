import { Fieldset, Group, TextInput, Title, type TextInputProps } from '@mantine/core';
import type { ReactNode } from 'react';
import { SaveStatus } from '../feedback/SaveStatus';
import classes from './DetailLayout.module.css';

interface DetailLayoutProps {
  /** Before the title: the state of the item (open or closed, done or to do), its number. Optional. */
  status?: ReactNode;
  /** Props of the title field (« Libellé », required), edited as in every other form. */
  title: TextInputProps;
  /** The title takes the focus when the panel opens (a creation form). Optional. Default = false. */
  focusTitle?: boolean;
  /** Buttons after the title, before the menu (« Fermer la tâche »). Optional. */
  actions?: ReactNode;
  /** « … » menu of the item (`ActionsMenu`): kept usable when the item is read only. Optional. */
  menu?: ReactNode;
  /** Project field, under the title. Optional. */
  project?: ReactNode;
  /** Mentions of the header (« Archivée », « Annulé », where it was postponed to…). Optional. */
  mentions?: ReactNode;
  /** Lines under the header (where it was postponed to, why it is read only…). Optional. */
  notes?: ReactNode;
  /** Whether a save runs (« Enregistrement… » / « Enregistré »); none: no mention (a new item, read only). Optional. */
  saving?: boolean;
  /** Read only (archived…): every field disabled, the menu and the comments excepted. Optional. Default = false. */
  readOnly?: boolean;
  /** Main column: the description, then its groups (`PanelGroup`). */
  main: ReactNode;
  /** Last group of the main column, out of the read-only part (comments stay readable). Optional. */
  comments?: ReactNode;
  /** Right column: its groups (`PanelGroup`). */
  side: ReactNode;
  /** Under the columns: the buttons of a creation form. Optional. */
  footer?: ReactNode;
}

/**
 * Part of a panel made read only by a fieldset that has no box of its own.
 * @param {{ readOnly: boolean, children: ReactNode }} props Read only, content.
 * @returns {JSX.Element} Fieldset.
 */
function Locked({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  return (
    <Fieldset variant="unstyled" disabled={readOnly} className={classes.locked}>
      {children}
    </Fieldset>
  );
}

/**
 * Layout of the panel of a task, a routine or an event, the same for the three: a header (its state, the editable
 * title, its buttons and « … » menu; then the project, its mentions and « Enregistré »), a main column (description,
 * relations, comments) and a column of titled groups on the right, which goes under the main one when the panel is
 * narrow (a phone, a panel made narrow).
 * @param {DetailLayoutProps} props Component props.
 * @returns {JSX.Element} Layout.
 */
export function DetailLayout({ status, title, focusTitle = false, actions, menu, project, mentions, notes, saving, readOnly = false, main, comments, side, footer }: DetailLayoutProps) {
  return (
    <div className={classes.root}>
      <header className={classes.header}>
        <div className={classes.line}>
          <Locked readOnly={readOnly}>
            {status}
            <TextInput label="Libellé" required className={classes.grow} data-autofocus={focusTitle || undefined} {...title} />
          </Locked>
          {(actions || menu) && (
            <div className={classes.end}>
              {!readOnly && actions}
              {menu}
            </div>
          )}
        </div>
        {(project || mentions || saving !== undefined) && (
          <div className={classes.line}>
            {project && (
              <div className={classes.grow}>
                <Locked readOnly={readOnly}>{project}</Locked>
              </div>
            )}
            {(mentions || saving !== undefined) && (
              <div className={classes.end}>
                {mentions}
                {saving !== undefined && <SaveStatus saving={saving} />}
              </div>
            )}
          </div>
        )}
        {notes}
      </header>
      <div className={classes.columns}>
        <div className={classes.column}>
          <Locked readOnly={readOnly}>{main}</Locked>
          {comments}
        </div>
        <div className={classes.column}>
          <Locked readOnly={readOnly}>{side}</Locked>
        </div>
      </div>
      {footer}
    </div>
  );
}

interface PanelGroupProps {
  /** Title of the group (« Classement », « Parties prenantes »…). Optional: a field alone (the place of a task). */
  title?: ReactNode;
  /** Action on the right of the title. Optional. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Group of fields of a panel laid out by `DetailLayout`: a rule above it, its title, then its fields.
 * @param {PanelGroupProps} props Component props.
 * @returns {JSX.Element} Group.
 */
export function PanelGroup({ title, action, children }: PanelGroupProps) {
  return (
    <section className={classes.group}>
      {title && (
        <Group justify="space-between" gap="xs" wrap="nowrap">
          <Title order={3} size="h5">
            {title}
          </Title>
          {action}
        </Group>
      )}
      {children}
    </section>
  );
}
