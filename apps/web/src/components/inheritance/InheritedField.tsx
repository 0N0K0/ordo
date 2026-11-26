import { Group, Stack, Text, Tooltip } from '@mantine/core';
import { ArrowUUpLeftIcon, EraserIcon, TreeViewIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { ActionButton } from '../actions/ActionButton';
import { INHERITANCE_WORDS, type FieldOriginValue } from './inheritance';
import classes from './InheritedField.module.css';

/** What a field shows of its inheritance and the actions it offers (`InheritedField`). */
export interface InheritedFieldState {
  /** Origin of the field; null: the item has no parent (nothing shown). */
  origin: Pick<FieldOriginValue, 'state'> | null;
  /** « Vider »: emptied on purpose (offered on an inherited field that can be emptied). Optional. */
  onClear?: () => void;
  /** « Rétablir l'héritage »: inherited again (offered on an own or emptied field). Optional. */
  onInherit?: () => void;
  /** Fields of a group inherited, when not all of them are (« En partie hérité de … »). Optional. */
  parts?: readonly string[];
}

interface InheritedFieldProps extends InheritedFieldState {
  /** Name of the parent the value comes from (« #12 Écrire le devis »). */
  from: string;
  /** In a table cell: greyed, the mention as a tooltip, no action (they are in the row menu and the selection). Optional. Default = false. */
  compact?: boolean;
  /** Read only (archived…): no action. Optional. Default = false. */
  readOnly?: boolean;
  children: ReactNode;
}

/**
 * A field of a sub-task or a sub-routine that may come from its parent, the same in every form,
 * panel and table cell: an inherited value is shown greyed, « Hérité de <parent> » under it (a tooltip in a cell), with
 * « Vider »; an emptied one says « Vidé exprès », with « Rétablir l'héritage », as an own one. Typing or choosing a value
 * makes it own (the field does it). Without parent, the field as it is.
 * @param {InheritedFieldProps} props Component props.
 * @returns {JSX.Element} Field.
 */
export function InheritedField({ origin, from, onClear, onInherit, parts, compact = false, readOnly = false, children }: InheritedFieldProps) {
  if (!origin) return <>{children}</>;
  const inherited = origin.state === 'INHERITED';
  const mention = inherited ? INHERITANCE_WORDS.inherited(from, parts) : origin.state === 'CLEARED' ? INHERITANCE_WORDS.cleared : null;
  if (compact) {
    return inherited ? (
      <Tooltip label={mention} openDelay={400} withinPortal>
        <div className={classes.inherited}>{children}</div>
      </Tooltip>
    ) : (
      <>{children}</>
    );
  }
  return (
    <Stack gap={4}>
      <div className={inherited ? classes.inherited : undefined}>{children}</div>
      <InheritanceNote origin={origin} from={from} onClear={onClear} onInherit={onInherit} parts={parts} readOnly={readOnly} />
    </Stack>
  );
}

/** Props of `InheritanceNote`. */
interface InheritanceNoteProps extends InheritedFieldState {
  /** Name of the parent the value comes from. */
  from: string;
  /** What the note is about, before it (« Ouverture : »), for a field of several values. Optional. */
  about?: string;
  /** Read only: no action. Optional. Default = false. */
  readOnly?: boolean;
}

/**
 * Line under a field that may come from its parent: « Hérité de <parent> » with « Vider », or « Vidé exprès » with
 * « Rétablir l'héritage » (as an own value); nothing when there is nothing to say. Under every `InheritedField`, and
 * under each bound of a `PeriodField`.
 * @param {InheritanceNoteProps} props Component props.
 * @returns {JSX.Element | null} Line.
 */
export function InheritanceNote({ origin, from, onClear, onInherit, parts, about, readOnly = false }: InheritanceNoteProps) {
  if (!origin) return null;
  const inherited = origin.state === 'INHERITED';
  const mention = inherited ? INHERITANCE_WORDS.inherited(from, parts) : origin.state === 'CLEARED' ? INHERITANCE_WORDS.cleared : null;
  const action = readOnly ? null : inherited && !parts?.length ? onClear && { label: INHERITANCE_WORDS.clear, icon: <EraserIcon aria-hidden />, onClick: onClear } : onInherit && { label: INHERITANCE_WORDS.inherit, icon: <ArrowUUpLeftIcon aria-hidden />, onClick: onInherit };
  if (!mention && !action) return null;
  return (
    <Group gap="xs" wrap="nowrap">
      {(about || mention) && (
        <Text size="xs" c="dimmed">
          {[about, mention].filter(Boolean).join(' : ')}
        </Text>
      )}
      {action && (
        <ActionButton priority="tertiary" size="xs" icon={action.icon} onClick={action.onClick}>
          {action.label}
        </ActionButton>
      )}
    </Group>
  );
}

/**
 * A value of a parent item that its sub-items inherit, in a table cell: the value as it is, and under it its mention in
 * small dimmed text, after a small tree icon (« Hérité par ses sous-routines »). The value stays editable: changing it
 * changes theirs.
 * @param {{ mention: string, children: ReactNode }} props Component props.
 * @param {string} props.mention What it says.
 * @param {ReactNode} props.children Value.
 * @returns {JSX.Element} Value with its mark.
 */
export function HeirsMark({ mention, children }: { mention: string; children: ReactNode }) {
  return (
    <Stack gap={0}>
      {children}
      <Group gap={4} wrap="nowrap">
        <TreeViewIcon aria-hidden size={12} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
        <Text size="xs" c="dimmed">
          {mention}
        </Text>
      </Group>
    </Stack>
  );
}
