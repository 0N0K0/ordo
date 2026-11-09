import { Button, Group, Select, Stack } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { SENDING_CHANNEL_LABELS, SENDING_CHANNELS, type SendingChannel } from '@ordo/shared';
import { useState } from 'react';
import { localDay, localToday } from '../../lib/dates';
import { notifyError, notifySuccess } from '../../lib/notify';

interface SentFormProps {
  /** Sending already noted (corrected), if any. */
  sentAt?: string | null;
  sentVia?: string | null;
  /** Saves the sending: day and way. */
  onSubmit: (sending: { date: string; via: SendingChannel }) => Promise<unknown>;
  onDone: () => void;
}

/**
 * Sending of a document (sent by mail, deposited on Chorus Pro, posted, handed…), or its correction: the day,
 * which reminders count from, and the way.
 * @param {SentFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function SentForm({ sentAt, sentVia, onSubmit, onDone }: SentFormProps) {
  const today = localToday();
  const [date, setDate] = useState<string | null>(sentAt ? localDay(new Date(sentAt)) : today);
  const [via, setVia] = useState<SendingChannel>((SENDING_CHANNELS as readonly string[]).includes(sentVia ?? '') ? (sentVia as SendingChannel) : 'CHORUS');
  const [saving, setSaving] = useState(false);

  /**
   * Saves the sending, then closes.
   * @returns {Promise<void>}
   */
  const save = async () => {
    if (!date) return;
    setSaving(true);
    try {
      await onSubmit({ date, via });
      notifySuccess('Envoi noté.');
      onDone();
    } catch (error) {
      notifyError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="sm">
      <Select
        label="Moyen d’envoi"
        data={SENDING_CHANNELS.map((value) => ({ value, label: SENDING_CHANNEL_LABELS[value] }))}
        value={via}
        allowDeselect={false}
        onChange={(value) => value && setVia(value as SendingChannel)}
      />
      <DatePickerInput
        label="Date d’envoi"
        description="Les relances comptent à partir de cette date."
        required
        valueFormat="D MMM YYYY"
        maxDate={today}
        value={date}
        onChange={(value) => setDate(value)}
        data-autofocus
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button loading={saving} disabled={!date} onClick={() => void save()}>
          Enregistrer
        </Button>
      </Group>
    </Stack>
  );
}
