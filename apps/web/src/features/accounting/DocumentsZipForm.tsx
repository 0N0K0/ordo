import { Button, Checkbox, Group, Select, SimpleGrid, Stack, Switch, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import type { AccountingDocumentType } from '@ordo/shared';
import { useState } from 'react';
import { localToday } from '../../lib/dates';
import { PERIOD_PRESETS, presetRange, type PeriodPreset } from '../../lib/periods';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DOCUMENT_TYPE_LABELS } from './labels';

const TYPES: AccountingDocumentType[] = ['QUOTE', 'INVOICE', 'DEPOSIT_INVOICE', 'CREDIT_NOTE'];

/**
 * Download of the accounting documents issued over a period, as a ZIP with one folder per type: final
 * documents of Ordo as printed (PDF with Factur-X), and the files of the imported ones.
 * @param {{ onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function DocumentsZipForm({ onDone }: { onDone: () => void }) {
  const today = localToday();
  const [preset, setPreset] = useState<PeriodPreset>('lastMonth');
  const [custom, setCustom] = useState<[string | null, string | null]>(presetRange('lastMonth', today));
  const [types, setTypes] = useState<string[]>(TYPES);
  const [imported, setImported] = useState(true);
  const [loading, setLoading] = useState(false);
  const [from, to] = preset === 'custom' ? custom : presetRange(preset, today);
  const valid = Boolean(from && to && from <= to) && types.length > 0;

  /**
   * Downloads the archive (an empty period is reported, not downloaded).
   * @returns {Promise<void>}
   */
  const download = async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to, types: types.join(','), imported: imported ? '1' : '0' });
      const response = await fetch(`/api/accounting/documents/zip?${params}`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error((await response.text()) || 'Archive impossible.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `Documents comptables du ${from} au ${to}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      notifySuccess('Archive téléchargée.');
      onDone();
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Archive impossible.');
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
      <Checkbox.Group label="Documents" value={types} onChange={setTypes} error={types.length === 0 ? 'Choisissez au moins un type.' : undefined}>
        <SimpleGrid cols={2} mt="xs">
          {TYPES.map((type) => (
            <Checkbox key={type} value={type} label={DOCUMENT_TYPE_LABELS[type]} />
          ))}
        </SimpleGrid>
      </Checkbox.Group>
      <Switch label="Inclure les documents importés (leur fichier)" checked={imported} onChange={(event) => setImported(event.currentTarget.checked)} />
      <Text size="xs" c="dimmed">
        Documents validés dont la date d’émission tombe dans la période, rangés dans un dossier par type. Les brouillons ne sont pas inclus.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button onClick={() => void download()} disabled={!valid} loading={loading}>
          Télécharger le ZIP
        </Button>
      </Group>
    </Stack>
  );
}
