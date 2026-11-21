import { Box, Checkbox, Group, Text, Tooltip } from '@mantine/core';
import { CheckCircleIcon, FlagIcon, PaperclipIcon } from '@phosphor-icons/react';
import { useDraggable } from '@dnd-kit/core';
import type { ReactNode } from 'react';
import { correspondent, listDate, type Address } from '../lib/mail-format';
import classes from '../pages/MailPage.module.css';

/** What a row of a mail list shows of a mail. */
interface MailListMessage {
  subject: string;
  from: Address[];
  to: Address[];
  date: string;
  seen: boolean;
  done: boolean;
  hasAttachments: boolean;
}

interface MailListItemProps {
  message: MailListMessage;
  /** Its flags (label and color). */
  labels: readonly { id: string; label: string; color: string }[];
  /** Addresses of the accounts: a mail sent from one of them shows its recipients. */
  ownAddresses: ReadonlySet<string>;
  /** The mail is open in the reader. */
  active: boolean;
  /** The mail is ticked for the actions on the selection. */
  ticked: boolean;
  onTick: (ticked: boolean) => void;
  onOpen: () => void;
  /** Dragging the mail to a folder (`components/dnd`): its drag id and what it carries. Optional (not draggable). */
  drag?: { id: string; data: Record<string, unknown> };
  /** Under the subject (its account and folder…). Optional. */
  footer?: ReactNode;
}

/**
 * Row of a mail list: check box, « Traité » mark, correspondent, flags, paperclip, date and subject; bold while
 * unread, set back once done. A click or Enter opens it.
 * @param {MailListItemProps} props Component props.
 * @returns {JSX.Element} Row.
 */
export function MailListItem({ message, labels, ownAddresses, active, ticked, onTick, onOpen, drag, footer }: MailListItemProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: drag?.id ?? '', data: drag?.data, disabled: !drag });
  return (
    <div
      ref={setNodeRef}
      {...(drag ? listeners : {})}
      role="button"
      tabIndex={0}
      className={classes.item}
      data-active={active || undefined}
      data-unread={!message.seen || undefined}
      data-done={message.done || undefined}
      data-selected={ticked || undefined}
      // What is dragged is shown at half opacity.
      style={isDragging ? { opacity: 'var(--onoko-dragging-opacity)' } : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen();
      }}
    >
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <Checkbox
          size="xs"
          mt={3}
          aria-label={`Sélectionner « ${message.subject} »`}
          checked={ticked}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onTick(event.currentTarget.checked)}
        />
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Group gap={4} wrap="nowrap" style={{ minWidth: 0 }}>
              {message.done && <CheckCircleIcon weight="fill" color="var(--mantine-color-green-6)" aria-label="Traité" style={{ flex: 'none' }} />}
              <Text size="sm" truncate className={classes.sender}>
                {correspondent(message, ownAddresses)}
              </Text>
            </Group>
            <Group gap={4} wrap="nowrap">
              {labels.map((label) => (
                <Tooltip key={label.id} label={label.label}>
                  <FlagIcon weight="fill" color={label.color} aria-label={`Drapeau « ${label.label} »`} />
                </Tooltip>
              ))}
              {message.hasAttachments && <PaperclipIcon aria-label="Pièces jointes" />}
              <Text size="xs" c="dimmed">
                {listDate(message.date)}
              </Text>
            </Group>
          </Group>
          <Text size="sm" truncate className={classes.subject}>
            {message.subject}
          </Text>
          {footer}
        </Box>
      </Group>
    </div>
  );
}
