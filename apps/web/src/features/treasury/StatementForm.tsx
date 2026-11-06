import { Button, Group, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useState } from 'react';
import { localToday } from '../../lib/dates';
import { notifyError, notifySuccess } from '../../lib/notify';
import { PERIOD_PRESETS, presetRange, type PeriodPreset } from '../../lib/periods';
import type { TreasuryAccount } from './api';

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
  const today = localToday();
  const [preset, setPreset] = useState<PeriodPreset>('lastMonth');
  const [custom, setCustom] = useState<[string | null, string | null]>(presetRange('lastMonth', today));
  const [accountId, setAccountId] = useState<string | null>(initialAccount);
  const [loading, setLoading] = useState(false);
  const [from, to] = preset === 'custom' ? custom : presetRange(preset, today);
  const valid = Boolean(from && to && from <= to);

  /**
   * Downloads the statement.
   * @returns {Promise<void>}
   */
  const download = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, ...(accountId ? { accountId } : {}) });
      const response = await fetch(`/api/treasury/statement.pdf?${params}`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error((await response.text()) || 'Relevé impossible.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `Relevé du ${from} au ${to}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      notifySuccess('Relevé téléchargé.');
      onDone();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Relevé impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="md">
      <Select label="Période" data={PERIOD_PRESETS} value={preset} onChange={(value) => value && setPreset(value as PeriodPreset)} allowDeselect={false} data-autofocus />
      <SimpleGrid cols={2}>
        <DatePickerInput label="Du" value={from} disabled={preset !== 'custom'} onChange={(value) => setCustom([value, custom[1]])} valueFormat="D MMM YYYY" />
        <DatePickerInput
          label="Au"
          value={to}
          disabled={preset !== 'custom'}
          onChange={(value) => setCustom([custom[0], value])}
          valueFormat="D MMM YYYY"
          error={from && to && from > to ? 'Avant la date de début.' : undefined}
        />
      </SimpleGrid>
      <Select
        label="Compte"
        placeholder="Tous les comptes"
        clearable
        data={accounts.map((account) => ({ value: account.id, label: account.archived ? `${account.name} (archivé)` : account.name }))}
        value={accountId}
        onChange={setAccountId}
      />
      <Text size="xs" c="dimmed">
        Mouvements réels de la période par date d’exécution, avec le solde avant, après et au fil des mouvements. Les prévisions ne sont pas incluses.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button onClick={() => void download()} disabled={!valid} loading={loading}>
          Télécharger le PDF
        </Button>
      </Group>
    </Stack>
  );
}
