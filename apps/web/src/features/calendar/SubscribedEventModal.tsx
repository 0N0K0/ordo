import { SidePanel } from '../../components/panels/SidePanel';
import { Anchor, Badge, Button, ColorSwatch, Group, Stack, Text } from '@mantine/core';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';
import { switchWorkspace } from '../workspaces/switch';
import type { CalendarSubscription, EventOccurrence } from './api';
import * as fmt from '../../lib/format';

/**
 * When an occurrence takes place, in words.
 * @param {EventOccurrence} occurrence Occurrence.
 * @returns {string} Date(s) and times.
 */
function when(occurrence: EventOccurrence): string {
  const text = whenLower(occurrence);
  return text.charAt(0).toUpperCase() + text.slice(1);
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

interface SubscribedEventModalProps {
  /** Occurrence shown, with the calendar it comes from; null when closed. */
  opened: { occurrence: EventOccurrence; subscription: CalendarSubscription } | null;
  onClose: () => void;
}

/**
 * Event of a calendar of another workspace, read only: it is changed in its own workspace, opened on its day.
 * @param {SubscribedEventModalProps} props Component props.
 * @returns {JSX.Element} Dialog.
 */
export function SubscribedEventModal({ opened, onClose }: SubscribedEventModalProps) {
  const occurrence = opened?.occurrence;
  const subscription = opened?.subscription;
  return (
    <SidePanel opened={opened !== null} onClose={onClose} title={occurrence?.title ?? ''}>
      {occurrence && subscription && (
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
          {occurrence.description && (
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {occurrence.description}
            </Text>
          )}
          {occurrence.links.map((link) => (
            <Anchor key={link.url} href={link.url} target="_blank" rel="noreferrer" size="sm">
              {link.label || link.url}
            </Anchor>
          ))}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose}>
              Fermer
            </Button>
            <Button leftSection={<ArrowSquareOutIcon aria-hidden />} onClick={() => switchWorkspace(subscription.workspace.id, `/calendar?date=${occurrence.startDate}`)}>
              Ouvrir dans « {subscription.workspace.name} »
            </Button>
          </Group>
        </Stack>
      )}
    </SidePanel>
  );
}
