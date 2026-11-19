import { Anchor, Badge, ColorSwatch, Group, Stack, Text } from '@mantine/core';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { switchWorkspace } from '../../workspaces/lib/switch';
import type { CalendarSubscription, EventOccurrence } from '../api';
import * as fmt from '../../../lib/format';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { NO_TARGETS } from '../../../components/markdown/remark-references';
import { FormActions } from '../../../components/dialogs/FormActions';
import { calendarPath } from '../../../app/pages';
import { inWorkspace } from '../lib/layer-label';
import { EXTERNAL_LINK } from '../../../components/actions/link-props';
import { eventMomentText } from '../lib/event-moment';

/**
 * When an occurrence takes place, in words (`eventMomentText`).
 * @param {EventOccurrence} occurrence Occurrence.
 * @returns {string} Date(s) and times.
 */
function when(occurrence: EventOccurrence): string {
  const times = occurrence.allDay ? { startTime: null, endTime: null } : { startTime: fmt.time(new Date(occurrence.start)), endTime: fmt.time(new Date(occurrence.end)) };
  return eventMomentText({ allDay: occurrence.allDay, startDate: occurrence.startDate, endDate: occurrence.endDate, ...times });
}

interface SubscribedEventProps {
  occurrence: EventOccurrence;
  /** Calendar it comes from. */
  subscription: CalendarSubscription;
  onClose: () => void;
}

/**
 * Event of a calendar of another workspace, read only: it is changed in its own workspace, opened on its day.
 * @param {SubscribedEventProps} props Component props.
 * @returns {JSX.Element} Panel content.
 */
export function SubscribedEvent({ occurrence, subscription, onClose }: SubscribedEventProps) {
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <ColorSwatch color={subscription.color} size={12} />
        <Text size="sm">{inWorkspace(subscription.label, subscription.workspace.label)}</Text>
        <Badge size="xs" variant="light" color="gray">
          Lecture seule
        </Badge>
        {occurrence.calledOff && (
          <Badge size="xs" variant="light" color="red">
            Annulé
          </Badge>
        )}
      </Group>
      <Text size="sm">{when(occurrence)}</Text>
      {occurrence.location && <Text size="sm">{occurrence.location}</Text>}
      {/* Of another workspace: its references to tasks or projects are not followed. */}
      {occurrence.description && <MarkdownView targets={NO_TARGETS}>{occurrence.description}</MarkdownView>}
      {occurrence.links.map((link) => (
        <Anchor key={link.url} href={link.url} {...EXTERNAL_LINK} size="sm">
          {link.label || link.url}
        </Anchor>
      ))}
      <FormActions
        onCancel={onClose}
        cancelLabel="Fermer"
        submitIcon={<ArrowSquareOutIcon aria-hidden />}
        submitLabel={`Ouvrir dans « ${subscription.workspace.label} »`}
        onSubmit={() => switchWorkspace(subscription.workspace.id, calendarPath(occurrence.startDate))}
      />
    </Stack>
  );
}
