import { Alert, Badge, Button, Checkbox, FileInput, Group, NumberInput, ScrollArea, SegmentedControl, Select, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { addDays, daysBetween, occurrenceDates, parseCsv, readStatement, recurrenceSchema, statementMappingSchema, type StatementMapping, type StatementRow } from '@ordo/shared';
import { FileCsvIcon, InfoIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useForecastEntries, useImportStatement, useTreasuryEntries, type TreasuryAccount } from './api';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import * as fmt from '../../lib/format';

/** Days between a bank operation and an entry or forecast of the same amount for them to match. */
const DUPLICATE_DAYS = 3;
const FORECAST_DAYS = 7;

/**
 * Text of a file, in UTF-8 unless it is not (then Windows-1252, the usual encoding of French bank exports).
 * @param {File} file File.
 * @param {StatementMapping['encoding'] | null} encoding Encoding chosen, or null to detect it.
 * @returns {Promise<{ text: string, encoding: StatementMapping['encoding'] }>} Text and encoding.
 */
async function readText(file: File, encoding: StatementMapping['encoding'] | null): Promise<{ text: string; encoding: StatementMapping['encoding'] }> {
  const bytes = await file.arrayBuffer();
  if (encoding) return { text: new TextDecoder(encoding).decode(bytes), encoding };
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  return utf8.includes('�') ? { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' } : { text: utf8, encoding: 'utf-8' };
}

/**
 * Column mapping guessed from a statement: separator by count, columns by their header (date, libellé, montant,
 * débit, crédit).
 * @param {string} text Statement.
 * @param {StatementMapping['encoding']} encoding Encoding.
 * @returns {StatementMapping} Mapping.
 */
function guessMapping(text: string, encoding: StatementMapping['encoding']): StatementMapping {
  const sample = text.split(/\r?\n/).slice(0, 20).join('\n');
  const separator = ([';', ',', '\t'] as const).reduce((best, candidate) => (sample.split(candidate).length > sample.split(best).length ? candidate : best), ';' as StatementMapping['separator']);
  const rows = parseCsv(text, separator);
  const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const headerIndex = Math.max(
    0,
    rows.slice(0, 20).findIndex((cells) => cells.some((cell) => /date/.test(normalize(cell))) && cells.some((cell) => /libel|montant|debit|credit/.test(normalize(cell)))),
  );
  const header = (rows[headerIndex] ?? []).map(normalize);
  const find = (pattern: RegExp) => {
    const index = header.findIndex((cell) => pattern.test(cell));
    return index >= 0 ? index : null;
  };
  const debit = find(/debit/);
  const credit = find(/credit/);
  return {
    separator,
    encoding,
    skipRows: rows[headerIndex] && header.some((cell) => /date/.test(cell)) ? headerIndex + 1 : 0,
    dateColumn: find(/date/) ?? 0,
    dateFormat: 'DD/MM/YYYY',
    labelColumns: [find(/libel|description|operation/) ?? 1],
    amountColumn: debit !== null || credit !== null ? null : (find(/montant|amount/) ?? 2),
    debitColumn: debit,
    creditColumn: credit,
  };
}

/** Operation of the preview: imported or not, as a new entry or realizing a forecast. */
interface PreviewRow extends StatementRow {
  key: number;
  /** An actual entry of the account looks the same (left out by default). */
  duplicate: string | null;
  /** Forecast of the same amount around that day. */
  forecast: { id: string; occurrence: string; label: string } | null;
}

interface StatementImportProps {
  accounts: TreasuryAccount[];
  onDone: () => void;
}

/**
 * Import of a bank statement (CSV): file and account, then the columns (guessed, or as mapped at the last import
 * of the account), then a preview where duplicates of entries already there are unticked and forecasts of the
 * same amount are realized. Imported operations are then categorized or split like any entry (a deferred debit
 * card total is split into its purchases, each with its own day).
 * @param {StatementImportProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function StatementImport({ accounts, onDone }: StatementImportProps) {
  const open = accounts.filter((account) => !account.archived);
  const [accountId, setAccountId] = useState<string | null>(open[0]?.id ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [mapping, setMapping] = useState<StatementMapping | null>(null);
  const [step, setStep] = useState<'file' | 'columns' | 'preview'>('file');
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [notRealized, setNotRealized] = useState<Set<number>>(new Set());
  const importStatement = useImportStatement();
  const account = open.find((item) => item.id === accountId);

  const raw = useMemo(() => (mapping ? parseCsv(text, mapping.separator).slice(0, 12) : []), [text, mapping]);
  const columns = Math.max(0, ...raw.map((cells) => cells.length));
  const columnOptions = Array.from({ length: columns }, (_, index) => ({
    value: String(index),
    label: `Colonne ${index + 1}${raw[mapping?.skipRows ? mapping.skipRows - 1 : -1]?.[index] ? ` — ${raw[(mapping?.skipRows ?? 1) - 1][index]}` : ''}`,
  }));
  const rows = useMemo(() => (mapping && step !== 'file' ? readStatement(text, mapping) : []), [text, mapping, step]);
  // Days of the statement, widened for the duplicates.
  const range = useMemo(
    () =>
      rows.length
        ? {
            from: addDays(
              rows.reduce((min, row) => (row.date < min ? row.date : min), rows[0].date),
              -DUPLICATE_DAYS,
            ),
            to: addDays(
              rows.reduce((max, row) => (row.date > max ? row.date : max), rows[0].date),
              DUPLICATE_DAYS,
            ),
          }
        : null,
    [rows],
  );
  const existing = useTreasuryEntries({ from: range?.from ?? '2000-01-01', to: range?.to ?? '2000-01-01', accountId }, step === 'preview' && range !== null);
  const forecasts = useForecastEntries();

  // Duplicates (an actual entry of the same amount a few days apart, each used once) and forecasts to realize.
  const preview: PreviewRow[] = useMemo(() => {
    const used = new Set<string>();
    const forecastUsed = new Set<string>();
    const actual = (existing.data ?? []).filter((entry) => entry.status === 'ACTUAL');
    const expected = (forecasts.data ?? [])
      .filter((entry) => entry.status === 'FORECAST' && entry.accountId === accountId)
      .flatMap((entry) => {
        const rule = recurrenceSchema.safeParse(entry.recurrence);
        const start = String(entry.date);
        const dates = rule.success && range ? occurrenceDates(rule.data, start, addDays(range.from, -FORECAST_DAYS), addDays(range.to, FORECAST_DAYS)) : [start];
        return dates.map((occurrence) => ({ id: entry.id, occurrence, label: entry.label, amount: entry.amount }));
      });
    return rows.map((row, key) => {
      const twin = actual.find((entry) => !used.has(entry.id) && Math.abs(entry.amount - row.amount) < 0.005 && Math.abs(daysBetween(String(entry.date), row.date)) <= DUPLICATE_DAYS);
      if (twin) used.add(twin.id);
      const planned = twin
        ? undefined
        : expected.find(
            (item) => !forecastUsed.has(`${item.id}|${item.occurrence}`) && Math.abs(item.amount - row.amount) < 0.005 && Math.abs(daysBetween(item.occurrence, row.date)) <= FORECAST_DAYS,
          );
      if (planned) forecastUsed.add(`${planned.id}|${planned.occurrence}`);
      return { ...row, key, duplicate: twin ? twin.label : null, forecast: planned ? { id: planned.id, occurrence: planned.occurrence, label: planned.label } : null };
    });
  }, [rows, existing.data, forecasts.data, accountId, range]);
  const chosen = preview.filter((row) => (row.duplicate ? excluded.has(row.key) : !excluded.has(row.key)));

  /**
   * Reads the file chosen, with the mapping of the account (or a guessed one).
   * @param {File | null} chosenFile File.
   * @returns {Promise<void>}
   */
  const load = async (chosenFile: File | null) => {
    setFile(chosenFile);
    if (!chosenFile) return;
    const saved = statementMappingSchema.safeParse(account?.csvMapping);
    const read = await readText(chosenFile, saved.success ? saved.data.encoding : null);
    setText(read.text);
    setMapping(saved.success ? saved.data : guessMapping(read.text, read.encoding));
  };

  /**
   * Changes the mapping (and re-reads the file when the encoding changes).
   * @param {Partial<StatementMapping>} changes Changes.
   * @returns {void}
   */
  const remap = (changes: Partial<StatementMapping>) => {
    if (!mapping) return;
    const next = { ...mapping, ...changes };
    setMapping(next);
    if (changes.encoding && file) void readText(file, changes.encoding).then((read) => setText(read.text));
  };

  /**
   * Imports the operations ticked.
   * @returns {void}
   */
  const submit = () => {
    if (!accountId || !chosen.length) return;
    importStatement.mutate(
      {
        accountId,
        mapping,
        rows: chosen.map((row) => ({
          date: row.date,
          label: row.label,
          amount: row.amount,
          forecastId: row.forecast && !notRealized.has(row.key) ? row.forecast.id : null,
          occurrence: row.forecast && !notRealized.has(row.key) ? row.forecast.occurrence : null,
        })),
      },
      {
        onSuccess: ({ created, realized }) => {
          notifySuccess(
            `${created} opération${created > 1 ? 's' : ''} importée${created > 1 ? 's' : ''}${realized ? `, ${realized} prévision${realized > 1 ? 's' : ''} réalisée${realized > 1 ? 's' : ''}` : ''}.`,
          );
          onDone();
        },
        onError: (error) => notifyError(error.message),
      },
    );
  };

  if (step === 'file' || !mapping) {
    return (
      <Stack gap="sm">
        <Select label="Compte" required data={open.map((item) => ({ value: item.id, label: item.name }))} value={accountId} onChange={setAccountId} allowDeselect={false} />
        <FileInput
          label="Relevé (CSV)"
          placeholder="Choisir le fichier exporté par la banque"
          accept=".csv,text/csv,text/plain"
          leftSection={<FileCsvIcon aria-hidden />}
          value={file}
          onChange={(chosen) => void load(chosen)}
          clearable
        />
        <Text size="xs" c="dimmed">
          Les colonnes sont devinées, ou reprises du dernier import de ce compte. Une carte à débit différé n’apparaît qu’en une ligne par mois : importez-la, puis répartissez-la en achats, chacun à
          sa date.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button disabled={!accountId || !file || !mapping} onClick={() => setStep('columns')}>
            Suivant
          </Button>
        </Group>
      </Stack>
    );
  }

  if (step === 'columns') {
    const single = mapping.amountColumn !== null;
    return (
      <Stack gap="sm">
        <ScrollArea type="auto" offsetScrollbars>
          <Table withTableBorder withColumnBorders fz="xs" verticalSpacing={2} miw={columns * 110}>
            <Table.Thead>
              <Table.Tr>
                {Array.from({ length: columns }, (_, index) => (
                  <Table.Th key={index}>{index + 1}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {raw.map((cells, rowIndex) => (
                <Table.Tr key={rowIndex} opacity={rowIndex < mapping.skipRows ? 0.4 : 1}>
                  {Array.from({ length: columns }, (_, index) => (
                    <Table.Td key={index}>{cells[index] ?? ''}</Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <Select
            label="Séparateur"
            data={[
              { value: ';', label: 'Point-virgule' },
              { value: ',', label: 'Virgule' },
              { value: '\t', label: 'Tabulation' },
            ]}
            value={mapping.separator}
            onChange={(value) => value && remap({ separator: value as StatementMapping['separator'] })}
            allowDeselect={false}
          />
          <Select
            label="Encodage"
            description="Accents mal affichés : essayez l’autre."
            data={[
              { value: 'utf-8', label: 'UTF-8' },
              { value: 'windows-1252', label: 'Windows (ANSI)' },
            ]}
            value={mapping.encoding}
            onChange={(value) => value && remap({ encoding: value as StatementMapping['encoding'] })}
            allowDeselect={false}
          />
          <NumberInput label="Lignes à ignorer au début" min={0} max={50} value={mapping.skipRows} onChange={(value) => remap({ skipRows: typeof value === 'number' ? value : 0 })} />
          <Select label="Date" data={columnOptions} value={String(mapping.dateColumn)} onChange={(value) => value && remap({ dateColumn: Number(value) })} allowDeselect={false} />
          <Select
            label="Format de date"
            data={['DD/MM/YYYY', 'DD/MM/YY', 'DD-MM-YYYY', 'YYYY-MM-DD'].map((value) => ({ value, label: value.replace('DD', 'JJ').replace('YYYY', 'AAAA').replace('YY', 'AA') }))}
            value={mapping.dateFormat}
            onChange={(value) => value && remap({ dateFormat: value as StatementMapping['dateFormat'] })}
            allowDeselect={false}
          />
          <BatchMultiSelect
            label="Libellé"
            description="Plusieurs colonnes sont mises bout à bout."
            data={columnOptions}
            value={mapping.labelColumns.map(String)}
            onChange={(values) => remap({ labelColumns: values.map(Number) })}
          />
        </SimpleGrid>
        <SegmentedControl
          data={[
            { value: 'single', label: 'Une colonne montant (signé)' },
            { value: 'split', label: 'Colonnes débit et crédit' },
          ]}
          value={single ? 'single' : 'split'}
          onChange={(value) =>
            remap(
              value === 'single'
                ? { amountColumn: mapping.debitColumn ?? 0, debitColumn: null, creditColumn: null }
                : { amountColumn: null, debitColumn: mapping.amountColumn ?? 0, creditColumn: null },
            )
          }
        />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {single ? (
            <Select label="Montant" data={columnOptions} value={String(mapping.amountColumn)} onChange={(value) => value && remap({ amountColumn: Number(value) })} allowDeselect={false} />
          ) : (
            <>
              <Select
                label="Débit"
                clearable
                data={columnOptions}
                value={mapping.debitColumn === null ? null : String(mapping.debitColumn)}
                onChange={(value) => remap({ debitColumn: value === null ? null : Number(value) })}
              />
              <Select
                label="Crédit"
                clearable
                data={columnOptions}
                value={mapping.creditColumn === null ? null : String(mapping.creditColumn)}
                onChange={(value) => remap({ creditColumn: value === null ? null : Number(value) })}
              />
            </>
          )}
        </SimpleGrid>
        <Text size="sm" c={rows.length ? 'dimmed' : 'red'}>
          {rows.length ? `${rows.length} opération${rows.length > 1 ? 's' : ''} lue${rows.length > 1 ? 's' : ''}.` : 'Aucune opération lue : vérifiez les colonnes et le format de date.'}
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setStep('file')}>
            Retour
          </Button>
          <Button disabled={!rows.length || !mapping.labelColumns.length} onClick={() => setStep('preview')}>
            Aperçu
          </Button>
        </Group>
      </Stack>
    );
  }

  const duplicates = preview.filter((row) => row.duplicate).length;
  return (
    <Stack gap="sm">
      {duplicates > 0 && (
        <Alert color="yellow" icon={<InfoIcon />}>
          {duplicates} opération{duplicates > 1 ? 's' : ''} semble{duplicates > 1 ? 'nt' : ''} déjà saisie{duplicates > 1 ? 's' : ''} (même montant à {DUPLICATE_DAYS} jours près) : décochée
          {duplicates > 1 ? 's' : ''}.
        </Alert>
      )}
      <ScrollArea.Autosize mah="55vh" type="auto">
        <Table verticalSpacing={4} stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={1}>
                <Checkbox
                  aria-label="Tout cocher"
                  checked={chosen.length === preview.length}
                  indeterminate={chosen.length > 0 && chosen.length < preview.length}
                  onChange={(event) =>
                    setExcluded(
                      event.currentTarget.checked ? new Set(preview.filter((row) => row.duplicate).map((row) => row.key)) : new Set(preview.filter((row) => !row.duplicate).map((row) => row.key)),
                    )
                  }
                />
              </Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Libellé</Table.Th>
              <Table.Th ta="right">Montant</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {preview.map((row) => {
              const ticked = row.duplicate ? excluded.has(row.key) : !excluded.has(row.key);
              return (
                <Table.Tr key={row.key} opacity={ticked ? 1 : 0.5}>
                  <Table.Td>
                    <Checkbox
                      aria-label={`Importer ${row.label}`}
                      checked={ticked}
                      onChange={() =>
                        setExcluded((current) => {
                          const next = new Set(current);
                          if (next.has(row.key)) next.delete(row.key);
                          else next.add(row.key);
                          return next;
                        })
                      }
                    />
                  </Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>{fmt.day(row.date)}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{row.label}</Text>
                    {row.duplicate && (
                      <Badge size="xs" variant="light" color="yellow">
                        Déjà saisie ? « {row.duplicate} »
                      </Badge>
                    )}
                    {row.forecast && (
                      <Checkbox
                        size="xs"
                        mt={4}
                        label={`Réalise la prévision « ${row.forecast.label} » du ${fmt.day(row.forecast.occurrence)}`}
                        checked={!notRealized.has(row.key)}
                        onChange={() =>
                          setNotRealized((current) => {
                            const next = new Set(current);
                            if (next.has(row.key)) next.delete(row.key);
                            else next.add(row.key);
                            return next;
                          })
                        }
                      />
                    )}
                  </Table.Td>
                  <Table.Td ta="right" ff="monospace" c={row.amount < 0 ? 'red' : 'green'} style={{ whiteSpace: 'nowrap' }}>
                    {row.amount > 0 ? '+' : ''}
                    {fmt.money(row.amount)}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      <Group justify="flex-end">
        <Button variant="default" onClick={() => setStep('columns')}>
          Retour
        </Button>
        <Button loading={importStatement.isPending || existing.isFetching} disabled={!chosen.length} onClick={submit}>
          Importer {chosen.length} opération{chosen.length > 1 ? 's' : ''}
        </Button>
      </Group>
    </Stack>
  );
}
