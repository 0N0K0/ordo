import { Button, Group, Stack, Switch, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DEFAULT_RECURRENCE, recurrenceSchema, type Recurrence } from '@ordo/shared';
import { useState } from 'react';
import { RecurrenceEditor } from '../../components/recurrence/RecurrenceEditor';
import { localToday } from '../../lib/dates';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useRecurringMutations, type RecurringInvoice } from './documents-api';

interface RecurringFormProps {
  /** Invoice made recurring (new schedule). */
  documentId?: string;
  /** Schedule edited. */
  recurring?: RecurringInvoice;
  onDone: () => void;
}

/**
 * Schedule of a recurring invoice: name, first issue date, repetition, drafts or final invoices, active.
 * @param {RecurringFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function RecurringForm({ documentId, recurring, onDone }: RecurringFormProps) {
  const { create, update } = useRecurringMutations();
  const stored = recurring ? recurrenceSchema.safeParse(recurring.recurrence) : null;
  const [name, setName] = useState(recurring?.name ?? '');
  const [startDate, setStartDate] = useState<string>(recurring ? String(recurring.startDate) : localToday());
  const [rule, setRule] = useState<Recurrence | null>(stored?.success ? stored.data : { ...DEFAULT_RECURRENCE, frequency: 'MONTHLY' });
  const [autoFinalize, setAutoFinalize] = useState(recurring?.autoFinalize ?? false);
  const [active, setActive] = useState(recurring?.active ?? true);

  /**
   * Saves the schedule.
   * @returns {void}
   */
  const submit = () => {
    if (!rule || !name.trim()) return;
    const input = { name, startDate, recurrence: rule, autoFinalize, active };
    const callbacks = {
      onSuccess: () => {
        notifySuccess(recurring ? 'Facture récurrente modifiée.' : 'Facture récurrente créée : la facture a été copiée comme modèle.');
        onDone();
      },
      onError: (error: Error) => notifyError(error.message),
    };
    if (recurring) update.mutate({ id: recurring.id, input }, callbacks);
    else if (documentId) create.mutate({ documentId, input }, callbacks);
  };

  return (
    <Stack gap="md">
      <TextInput label="Nom" required data-autofocus placeholder="Maintenance mensuelle…" value={name} onChange={(event) => setName(event.currentTarget.value)} />
      <DatePickerInput label="Première facture le" required valueFormat="D MMM YYYY" value={startDate} onChange={(value) => value && setStartDate(value)} />
      <RecurrenceEditor value={rule} onChange={setRule} start={startDate} />
      {!rule && (
        <Text size="xs" c="red">
          Choisissez une répétition.
        </Text>
      )}
      <Switch
        label="Valider automatiquement"
        description="Les factures sont numérotées dès leur création ; sinon, elles sont créées en brouillon à vérifier."
        checked={autoFinalize}
        onChange={(event) => setAutoFinalize(event.currentTarget.checked)}
      />
      <Switch label="Active" checked={active} onChange={(event) => setActive(event.currentTarget.checked)} />
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button onClick={submit} disabled={!rule || !name.trim()} loading={create.isPending || update.isPending}>
          {recurring ? 'Enregistrer' : 'Créer'}
        </Button>
      </Group>
    </Stack>
  );
}
