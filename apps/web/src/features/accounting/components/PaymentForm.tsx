import { unarchived } from '../../../lib/archive';
import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import { FormSkeleton } from '../../../components/feedback/Skeletons';
import { itemSelectProps } from '../../../components/items/item-look';
import { Anchor, Select, Stack } from '@mantine/core';
import { DateField } from '../../../components/inputs/DateField';
import { documentPaymentSchema } from '@ordo/shared';
import { Link } from 'react-router';
import { localToday } from '../../../lib/dates';
import { useAppForm, formCallbacks } from '../../../lib/form';

import { useTreasuryAccounts, useTreasurySettings, type TreasuryAccount, type TreasuryPaymentMethod } from '../../treasury/api';
import { useTrackingMutations } from '../api/tracking';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { FormActions } from '../../../components/dialogs/FormActions';
import { PAGES } from '../../../app/pages';

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
  const open = unarchived(accounts);
  const form = useAppForm<PaymentValues>({
    initialValues: {
      accountId: open[0]?.id ?? '',
      date: localToday(),
      amount: document.balance ?? 0,
      // The first method named in the payment terms of the document.
      methodId: methods.find((method) => document.paymentMethods?.toLowerCase().includes(method.label.toLowerCase()))?.id ?? null,
    },
    schema: documentPaymentSchema,
  });
  if (open.length === 0) {
    return (
      <NoticeAlert kind="info">
        Créez d’abord un compte dans la{' '}
        <Anchor component={Link} to={PAGES.treasury.path} onClick={onDone}>
          trésorerie
        </Anchor>
        .
      </NoticeAlert>
    );
  }
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) =>
        recordPayment.mutate({ id: document.id, input }, formCallbacks(form, document.type === 'CREDIT_NOTE' ? 'Remboursement enregistré.' : 'Paiement enregistré.', onDone)),
      )}
    >
      <Stack gap="sm">
        <Select label="Compte" required {...itemSelectProps(open, form.values.accountId)} allowDeselect={false} {...form.getInputProps('accountId')} />
        <DateField label="Date" required {...form.getInputProps('date')} />
        <AmountInput label="Montant" required min={0} {...form.getInputProps('amount')} />
        <Select
          label="Moyen de paiement"
          clearable
          placeholder={methods.length ? '—' : 'Aucun : ajoutez-en dans les paramètres de la trésorerie'}
          {...itemSelectProps(methods, form.values.methodId)}
          {...form.getInputProps('methodId')}
        />
        <FormActions onCancel={onDone} loading={recordPayment.isPending} />
      </Stack>
    </form>
  );
}
