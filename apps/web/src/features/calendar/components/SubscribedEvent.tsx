import { Anchor, Badge, ColorSwatch, Group, Stack, Text } from '@mantine/core';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { switchWorkspace } from '../../workspaces/lib/switch';
import type { CalendarSubscription, EventOccurrence } from '../api';
import * as fmt from '../../../lib/format';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { NO_TARGETS } from '../../../components/markdown/remark-references';
import { FormActions } from '../../../components/dialogs/FormActions';

/**
 * When an occurrence takes place, in words.
 * @param {EventOccurrence} occurrence Occurrence.
 * @returns {string} Date(s) and times.
 */
function when(occurrence: EventOccurrence): string {
  return fmt.capitalize(whenLower(occurrence));
}

/**
 * When an occurrence takes place, in words, as formatted (lowercase day names).
 * @param {EventOccurrence} occurrence Occurrence.
 * @returns {string} Date(s) and times.
 */
function whenLower(occurrence: EventOccurrence): string {
  const day = (date: string) => fmt.dayLong(date);
  if (occurrence.allDay) return occurrence.startDate === occurrence.endDate ? `${day(occurrence.startDate)}, journée entière` : `Du ${day(occurrence.startDate)} au ${day(occurrence.endDate)}`;
  const start = new Date(occurrence.start);
  const end = new Date(occurrence.end);
  return occurrence.startDate === occurrence.endDate
    ? `${day(occurrence.startDate)}, ${fmt.time(start)} – ${fmt.time(end)}`
    : `Du ${day(occurrence.startDate)} ${fmt.time(start)} au ${day(occurrence.endDate)} ${fmt.time(end)}`;
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
        <Text size="sm">
          {subscription.name} · espace « {subscription.workspace.name} »
        </Text>
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
        <Anchor key={link.url} href={link.url} target="_blank" rel="noreferrer" size="sm">
          {link.label || link.url}
        </Anchor>
      ))}
      <FormActions
        onCancel={onClose}
        cancelLabel="Fermer"
        submitIcon={<ArrowSquareOutIcon aria-hidden />}
        submitLabel={`Ouvrir dans « ${subscription.workspace.name} »`}
        onSubmit={() => switchWorkspace(subscription.workspace.id, `/calendar?date=${occurrence.startDate}`)}
      />
    </Stack>
  );
}
