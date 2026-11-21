import { Fieldset, Stack, Switch, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { DEFAULT_RECURRENCE, recurrenceSchema, recurringInvoiceSchema, type Recurrence } from '@ordo/shared';
import { localToday } from '../../../lib/dates';
import { formCallbacks, useAppForm, useFieldSave } from '../../../lib/form';
import { useRecurringInvoices, useRecurringMutations, type RecurringInvoice } from '../api/documents';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
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
const FORM_SCHEMA = recurringInvoiceSchema.extend({
  recurrence: recurrenceSchema.nullable().refine((rule) => rule !== null, 'Choisissez une répétition.'),
});

/** Values of the form of a schedule. */
type RecurringValues = {
  label: string;
  startDate: string;
  recurrence: Recurrence | null;
  autoFinalize: boolean;
  active: boolean;
};

/**
 * Values of the form of a schedule, as it is (a new one: today, monthly, active).
 * @param {RecurringInvoice} [recurring] Schedule, as the cache holds it. Optional.
 * @returns {RecurringValues} Values.
 */
const recurringValues = (recurring?: RecurringInvoice): RecurringValues => {
  const stored = recurring ? recurrenceSchema.safeParse(recurring.recurrence) : null;
  return {
    label: recurring?.label ?? '',
    startDate: recurring ? recurring.startDate : localToday(),
    recurrence: stored?.success ? stored.data : { ...DEFAULT_RECURRENCE, frequency: 'MONTHLY' },
    autoFinalize: recurring?.autoFinalize ?? false,
    active: recurring?.active ?? true,
  };
};

/**
 * Schedule of a recurring invoice: label, first issue date, repetition, drafts or final invoices, active. A new one is
 * a form with « Créer »; an existing one, its panel, saves each field as soon as it changes (the label on leaving it,
 * `useFieldSave`), the one of the cache followed; archived, it is read only.
 * @param {RecurringFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function RecurringForm({ documentId, recurring, onDone }: RecurringFormProps) {
  const { create, update } = useRecurringMutations();
  const { data: schedules } = useRecurringInvoices();
  const base = useAppForm<RecurringValues>({
    initialValues: recurringValues(recurring),
    schema: FORM_SCHEMA,
  });
  const current = recurring && (schedules?.find((item) => item.id === recurring.id) ?? recurring);
  const readOnly = Boolean(current?.archived);
  const { form, saving } = useFieldSave(base, {
    save: recurring
      ? (_changes, { recurrence, ...fields }) =>
          update.mutateAsync({
            id: recurring.id,
            input: { ...fields, recurrence: recurrence! },
          })
      : null,
    schema: FORM_SCHEMA,
    saved: current && recurringValues(current),
    onBlur: ['label'],
    readOnly,
  });
  const { values } = form;

  return (
    <form
      noValidate
      // A new schedule only: an existing one is saved field by field (Enter saves the label typed).
      onSubmit={form.onSubmit(({ recurrence, ...fields }) => {
        if (!recurrence || !documentId) return;
        create.mutate({ documentId, input: { ...fields, recurrence } }, formCallbacks(form, 'Facture récurrente créée : la facture a été copiée comme modèle.', onDone));
      })}
    >
      <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
        <Stack gap="md">
          {recurring && !readOnly && <SaveStatus saving={saving} />}
          <TextInput label="Libellé" required data-autofocus={recurring ? undefined : true} placeholder="Maintenance mensuelle…" {...form.getInputProps('label')} />
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
          {!recurring && <FormActions onCancel={onDone} submitLabel="Créer" loading={create.isPending} />}
        </Stack>
      </Fieldset>
    </form>
  );
}
