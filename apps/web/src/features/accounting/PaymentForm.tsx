import { FormSkeleton } from '../../components/feedback/Skeletons';
import { Alert, Anchor, Button, Group, Select, Stack } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { documentPaymentSchema } from '@ordo/shared';
import { Link } from 'react-router';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useTreasuryAccounts, useTreasurySettings, type TreasuryAccount, type TreasuryPaymentMethod } from '../treasury/api';
import { useTrackingMutations } from './tracking-api';
import { AmountInput } from '../../components/AmountInput';

/** Document a payment (or refund) is recorded on: what the form needs of it. */
export interface PayableDocument {
  id: string;
  type: string;
  /** Still due, the amount offered. */
  balance?: number | null;
  /** Payment terms, whose first method named is chosen. */
  paymentMethods?: string | null;
}

interface PaymentValues extends Record<string, unknown> {
  accountId: string;
  date: string;
  amount: number;
  methodId: string | null;
}

/**
 * Payment of an invoice, or refund of a credit note: an actual treasury entry settling it.
 * @param {{ document: PayableDocument, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function PaymentForm({ document, onDone }: { document: PayableDocument; onDone: () => void }) {
  const { data: accounts } = useTreasuryAccounts();
  const { data: settings } = useTreasurySettings();
  // The form starts once the accounts and methods are known, so that the first account and the usual method are chosen.
  if (!accounts || !settings) return <FormSkeleton fields={4} />;
  const refund = document.type === 'CREDIT_NOTE';
  const methods = settings.treasuryPaymentMethods.filter((method) => (refund ? method.outgoing : method.incoming));
  return <PaymentFields document={document} accounts={accounts} methods={methods} onDone={onDone} />;
}

interface PaymentFieldsProps {
  document: PayableDocument;
  accounts: TreasuryAccount[];
  /** Payment methods of the direction of the payment. */
  methods: TreasuryPaymentMethod[];
  onDone: () => void;
}

/**
 * Fields of a payment, the accounts loaded.
 * @param {PaymentFieldsProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function PaymentFields({ document, accounts, methods, onDone }: PaymentFieldsProps) {
  const { recordPayment } = useTrackingMutations();
  const open = accounts.filter((account) => !account.archived);
  const form = useAppForm<PaymentValues>({
    initialValues: {
      accountId: open[0]?.id ?? '',
      date: localToday(),
      amount: document.balance ?? 0,
      // The first method named in the payment terms of the document.
      methodId: methods.find((method) => document.paymentMethods?.toLowerCase().includes(method.name.toLowerCase()))?.id ?? null,
    },
    schema: documentPaymentSchema,
  });
  if (open.length === 0) {
    return (
      <Alert color="blue">
        Créez d’abord un compte dans la{' '}
        <Anchor component={Link} to="/treasury" onClick={onDone}>
          trésorerie
        </Anchor>
        .
      </Alert>
    );
  }
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) =>
        recordPayment.mutate(
          { id: document.id, input },
          {
            onSuccess: () => {
              notifySuccess(document.type === 'CREDIT_NOTE' ? 'Remboursement enregistré.' : 'Paiement enregistré.');
              onDone();
            },
            onError: (error) => showFormError(form, error),
          },
        ),
      )}
    >
      <Stack gap="sm">
        <Select label="Compte" required data={open.map((account) => ({ value: account.id, label: account.name }))} allowDeselect={false} {...form.getInputProps('accountId')} />
        <DatePickerInput label="Date" required {...form.getInputProps('date')} />
        <AmountInput label="Montant" required min={0} suffix=" €" {...form.getInputProps('amount')} />
        <Select
          label="Moyen de paiement"
          clearable
          placeholder={methods.length ? '—' : 'Aucun : ajoutez-en dans les paramètres de la trésorerie'}
          data={methods.map((method) => ({ value: method.id, label: method.name }))}
          {...form.getInputProps('methodId')}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={recordPayment.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
