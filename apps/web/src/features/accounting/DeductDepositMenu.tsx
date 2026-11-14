import { Button, Menu, Text } from '@mantine/core';
import { type AccountingLineInput } from '@ordo/shared';
import { MinusCircleIcon } from '@phosphor-icons/react';
import { useDeductibleDeposits } from './documents-api';
import * as fmt from '../../lib/format';

interface DeductDepositMenuProps {
  clientId: string | null;
  documentId: string | null;
  lines: AccountingLineInput[];
  currency: string;
  vatApplicable: boolean;
  onAdd: (lines: AccountingLineInput[]) => void;
}

/**
 * Deducts a previous deposit invoice of the client from an invoice: its amounts excluding VAT left to deduct, one
 * deduction line per VAT rate linked to it ("Acompte F2600012 du 05/10/2026"). Deposits already deducted in full,
 * here or elsewhere, are not offered.
 * @param {DeductDepositMenuProps} props Component props.
 * @returns {JSX.Element | null} Button and its menu, nothing without deposits to deduct.
 */
export function DeductDepositMenu({ clientId, documentId, lines, currency, vatApplicable, onAdd }: DeductDepositMenuProps) {
  const { data: deposits } = useDeductibleDeposits(clientId, documentId);
  // What the lines being edited already deduct (not saved yet), per deposit and rate.
  const deducted = new Map<string, number>();
  for (const line of lines) {
    if (line.kind !== 'DEDUCTION' || !line.deductedDocumentId) continue;
    const key = `${line.deductedDocumentId}|${line.vatRate}`;
    deducted.set(key, (deducted.get(key) ?? 0) + Math.round(line.quantity * line.unitPrice * 100));
  }
  const offered = (deposits ?? []).flatMap((deposit) => {
    const remaining = deposit.remaining.map((item) => ({ rate: item.rate, cents: Math.round(item.amount * 100) - (deducted.get(`${deposit.id}|${item.rate}`) ?? 0) })).filter((item) => item.cents > 0);
    return remaining.length ? [{ ...deposit, remaining }] : [];
  });
  if (!offered.length) return null;
  return (
    <Menu position="bottom-start" withinPortal>
      <Menu.Target>
        <Button size="xs" variant="default" color="orange" leftSection={<MinusCircleIcon aria-hidden />}>
          Déduire un acompte
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Factures d’acompte du client</Menu.Label>
        {offered.map((deposit) => {
          const date = fmt.day(deposit.issueDate);
          const left = deposit.remaining.reduce((sum, item) => sum + item.cents, 0);
          return (
            <Menu.Item
              key={deposit.id}
              onClick={() =>
                onAdd(
                  deposit.remaining.map((item) => ({
                    kind: 'DEDUCTION',
                    title: `Acompte ${deposit.number} du ${date}`,
                    description: deposit.remaining.length > 1 ? `Part soumise à la TVA à ${fmt.percent(item.rate)}` : null,
                    quantity: 1,
                    unit: 'FLAT',
                    unitPrice: item.cents / 100,
                    vatRate: vatApplicable ? item.rate : 0,
                    discountType: null,
                    discountValue: null,
                    deductedDocumentId: deposit.id,
                  })),
                )
              }
            >
              <Text size="sm">
                {deposit.number} du {date}
              </Text>
              <Text size="xs" c="dimmed">
                Reste à déduire {fmt.moneyCents(left, currency)} HT sur {fmt.money(deposit.totalGross, currency)} TTC
              </Text>
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
