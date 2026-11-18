import { Stack, Switch, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DEFAULT_RECURRENCE, recurrenceSchema, recurringInvoiceSchema, type Recurrence } from '@ordo/shared';
import { localToday } from '../../../lib/dates';
import { formCallbacks, useAppForm } from '../../../lib/form';
import { useRecurringMutations, type RecurringInvoice } from '../api/documents';
import { RuleField } from '../../../components/recurrence/RuleField';
import { FormActions } from '../../../components/dialogs/FormActions';

interface RecurringFormProps {
  /** Invoice made recurring (new schedule). */
  documentId?: string;
  /** Schedule edited. */
  recurring?: RecurringInvoice;
  onDone: () => void;
}

/** Values of the form: a repetition may be cleared, then asked for. */
const FORM_SCHEMA = recurringInvoiceSchema.extend({ recurrence: recurrenceSchema.nullable().refine((rule) => rule !== null, 'Choisissez une répétition.') });

/**
 * Schedule of a recurring invoice: label, first issue date, repetition, drafts or final invoices, active.
 * @param {RecurringFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function RecurringForm({ documentId, recurring, onDone }: RecurringFormProps) {
  const { create, update } = useRecurringMutations();
  const stored = recurring ? recurrenceSchema.safeParse(recurring.recurrence) : null;
  const form = useAppForm<{ label: string; startDate: string; recurrence: Recurrence | null; autoFinalize: boolean; active: boolean }>({
    initialValues: {
      label: recurring?.label ?? '',
      startDate: recurring ? recurring.startDate : localToday(),
      recurrence: stored?.success ? stored.data : { ...DEFAULT_RECURRENCE, frequency: 'MONTHLY' },
      autoFinalize: recurring?.autoFinalize ?? false,
      active: recurring?.active ?? true,
    },
    schema: FORM_SCHEMA,
  });
  const { values } = form;

  return (
    <form
      noValidate
      onSubmit={form.onSubmit(({ recurrence, ...fields }) => {
        if (!recurrence) return;
        const input = { ...fields, recurrence };
        const callbacks = formCallbacks(form, recurring ? 'Facture récurrente modifiée.' : 'Facture récurrente créée : la facture a été copiée comme modèle.', onDone);
        if (recurring) update.mutate({ id: recurring.id, input }, callbacks);
        else if (documentId) create.mutate({ documentId, input }, callbacks);
      })}
    >
      <Stack gap="md">
        <TextInput label="Libellé" required data-autofocus placeholder="Maintenance mensuelle…" {...form.getInputProps('label')} />
        <DatePickerInput label="Première facture le" required {...form.getInputProps('startDate')} />
        <RuleField
          required
          weekly={false}
          value={values.recurrence}
          onChange={(recurrence) => form.setFieldValue('recurrence', recurrence)}
          start={values.startDate}
          error={form.errors.recurrence as string | undefined}
        />
        <Switch
          label="Valider automatiquement"
          description="Les factures sont numérotées dès leur création ; sinon, elles sont créées en brouillon à vérifier."
          {...form.getInputProps('autoFinalize', { type: 'checkbox' })}
        />
        <Switch label="Active" {...form.getInputProps('active', { type: 'checkbox' })} />
        <FormActions onCancel={onDone} submitLabel={recurring ? 'Enregistrer' : 'Créer'} loading={create.isPending || update.isPending} />
      </Stack>
    </form>
  );
}
