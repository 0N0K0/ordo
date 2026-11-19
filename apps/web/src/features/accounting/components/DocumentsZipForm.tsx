import { Checkbox, Group, Select, SimpleGrid, Stack, Switch, Text } from '@mantine/core';
import { FileZipIcon } from '@phosphor-icons/react';
import { fetchDownload, fileName } from '../../../lib/download';
import { ACCOUNTING_DOCUMENT_TYPES, type AccountingDocumentType } from '@ordo/shared';
import { useState } from 'react';
import { localToday, yearOfDay } from '../../../lib/dates';
import { PERIOD_PRESETS, type PeriodPreset } from '../../../lib/periods';
import { useAsyncAction } from '../../../lib/use-async-action';
import { PeriodRangeFields } from '../../../components/inputs/PeriodRangeFields';
import { usePeriodRange } from '../../../components/inputs/use-period-range';
import { DOCUMENT_TYPE_LABELS } from '../lib/labels';
import { FormActions } from '../../../components/dialogs/FormActions';

const TYPES: AccountingDocumentType[] = [...ACCOUNTING_DOCUMENT_TYPES];

/** Periods offered: the presets, and a calendar year to choose (before the custom dates). */
type ZipPeriod = PeriodPreset | 'calendarYear';
const ZIP_PERIODS: { value: ZipPeriod; label: string }[] = [
  ...PERIOD_PRESETS.filter((item) => item.value !== 'custom'),
  { value: 'calendarYear', label: 'Année civile…' },
  ...PERIOD_PRESETS.filter((item) => item.value === 'custom'),
];

/**
 * Download of the accounting documents issued over a period, as a ZIP with one folder per type: final
 * documents of Ordo as printed (PDF with Factur-X), and the files of the imported ones.
 * A calendar year can be chosen among those of the documents (the one shown in the list, when given).
 * @param {{ onDone: () => void, year?: string | null, years?: string[] }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function DocumentsZipForm({ onDone, year: initialYear = null, years = [] }: { onDone?: () => void; year?: string | null; years?: string[] }) {
  const [year, setYear] = useState(initialYear ?? String(yearOfDay(localToday())));
  const range = usePeriodRange<ZipPeriod>(initialYear ? 'calendarYear' : 'lastMonth', (period) => (period === 'calendarYear' ? [`${year}-01-01`, `${year}-12-31`] : null));
  const { today, preset, setPreset, from, to } = range;
  const yearOptions = [...new Set([...years, String(yearOfDay(today)), year])].sort().reverse();
  const [types, setTypes] = useState<string[]>(TYPES);
  const [imported, setImported] = useState(true);
  const valid = range.valid && types.length > 0;
  const { run: download, loading } = useAsyncAction(
    async () => {
      if (!from || !to) return;
      const params = new URLSearchParams({ from, to, types: types.join(','), imported: imported ? '1' : '0' });
      await fetchDownload(
        `/api/accounting/documents/zip?${params}`,
        fileName(preset === 'calendarYear' ? `Documents comptables ${year}` : `Documents comptables du ${from} au ${to}`, 'zip'),
        'Archive impossible.',
      );
    },
    { success: 'Archive téléchargée.', fallback: 'Archive impossible.', onDone: () => onDone?.() },
  );

  return (
    <Stack gap="md">
      <Group grow align="flex-end">
        <Select label="Période" data={ZIP_PERIODS} value={preset} onChange={(value) => value && setPreset(value as ZipPeriod)} allowDeselect={false} />
        {preset === 'calendarYear' && <Select label="Année" data={yearOptions} value={year} onChange={(value) => value && setYear(value)} allowDeselect={false} />}
      </Group>
      <PeriodRangeFields range={range} />
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
      <FormActions onCancel={onDone} submitLabel="Télécharger le ZIP" submitIcon={<FileZipIcon aria-hidden />} onSubmit={() => void download()} disabled={!valid} loading={loading} />
    </Stack>
  );
}
