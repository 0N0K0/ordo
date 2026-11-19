import { Select, Stack, Text } from '@mantine/core';
import { fetchDownload, fileName } from '../../../lib/download';
import { useState } from 'react';
import { useAsyncAction } from '../../../lib/use-async-action';
import { PERIOD_PRESETS, type PeriodPreset } from '../../../lib/periods';
import type { TreasuryAccount } from '../api';
import { FormActions } from '../../../components/dialogs/FormActions';
import { PeriodRangeFields } from '../../../components/inputs/PeriodRangeFields';
import { usePeriodRange } from '../../../components/inputs/use-period-range';
import { archivedLabel } from '../../../lib/archive';

interface StatementFormProps {
  accounts: TreasuryAccount[];
  /** Account chosen at first (null: all). */
  accountId: string | null;
  onDone: () => void;
}

/**
 * Download of the statement of the actual entries of a period (PDF), of one account or all of them; forecasts
 * are left out.
 * @param {StatementFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function StatementForm({ accounts, accountId: initialAccount, onDone }: StatementFormProps) {
  const range = usePeriodRange<PeriodPreset>('lastMonth');
  const { preset, setPreset, from, to, valid } = range;
  const [accountId, setAccountId] = useState<string | null>(initialAccount);
  const { run: download, loading } = useAsyncAction(
    async () => {
      if (!from || !to) return;
      const params = new URLSearchParams({ from, to, ...(accountId ? { accountId } : {}) });
      await fetchDownload(`/api/treasury/statement.pdf?${params}`, fileName(`Relevé du ${from} au ${to}`, 'pdf'), 'Relevé impossible.');
    },
    { success: 'Relevé téléchargé.', fallback: 'Relevé impossible.', onDone },
  );

  return (
    <Stack gap="md">
      <Select label="Période" data={PERIOD_PRESETS} value={preset} onChange={(value) => value && setPreset(value as PeriodPreset)} allowDeselect={false} data-autofocus />
      <PeriodRangeFields range={range} />
      <Select
        label="Compte"
        placeholder="Tous les comptes"
        clearable
        data={accounts.map((account) => ({ value: account.id, label: archivedLabel(account) }))}
        value={accountId}
        onChange={setAccountId}
      />
      <Text size="xs" c="dimmed">
        Mouvements réels de la période par date d’exécution, avec le solde avant, après et au fil des mouvements. Les prévisions ne sont pas incluses.
      </Text>
      <FormActions onCancel={onDone} submitLabel="Télécharger le PDF" onSubmit={() => void download()} disabled={!valid} loading={loading} />
    </Stack>
  );
}
