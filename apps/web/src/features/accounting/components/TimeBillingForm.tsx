import { toggledIn } from '../../../lib/sets';
import { LabeledField } from '../../../components/inputs/LabeledField';
import { countOf } from '../../../lib/text';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { TableSkeleton } from '../../../components/feedback/Skeletons';
import { Checkbox, Group, NumberInput, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { type AccountingLineInput, formatDuration, toCents, sumOf } from '@ordo/shared';
import { useState } from 'react';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useTimeEntries } from '../../time/api';
import { useCatalogItems } from '../api/catalog';
import { timeLines, type BillableTime, type TimeGrouping } from '../lib/time-lines';
import { treeSelectProps, type TreeOption } from '../../../components/tree/tree-select';
import * as fmt from '../../../lib/format';
import { AmountInput } from '../../../components/inputs/AmountInput';
import { DataTable } from '../../../components/data-table/table/DataTable';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { useDataView } from '../../../components/data-table/views/use-data-view';
import { localDay } from '../../../lib/dates';
import { FormActions } from '../../../components/dialogs/FormActions';
import { PeriodField } from '../../../components/inputs/PeriodField';
import { vatRateOptions } from '../lib/labels';
import { unarchived } from '../../../lib/archive';
import { FRENCH_NUMBER_FORMAT } from '../../../components/inputs/number-format';

/**
 * What a time was spent on: its tasks, then its description.
 * @param {BillableTime} entry Time.
 * @returns {string} Text.
 */
const workOf = (entry: BillableTime) => [entry.tasks.join(', '), entry.description].filter(Boolean).join(' — ');

/** Columns of the time to bill. */
const BILLING_COLUMNS: DataColumn<BillableTime>[] = [
  { id: 'day', required: true, label: 'Jour', size: 110, sortValue: (entry) => entry.day, text: (entry) => fmt.dayShort(entry.day), filter: { kind: 'date', value: (entry) => entry.day } },
  { id: 'work', label: 'Temps', size: 320, locked: true, sortValue: workOf, text: workOf },
  {
    id: 'duration',
    required: true,
    label: 'Durée',
    size: 100,
    numeric: true,
    sortValue: (entry) => entry.seconds,
    text: (entry) => formatDuration(entry.seconds),
    formatTotal: (seconds) => formatDuration(Math.round(seconds)),
  },
];

interface TimeBillingFormProps {
  /** Project of the invoice, preselected. */
  projectId: string | null;
  /** Projects of the client. */
  projects: TreeOption[];
  /** Time already on the invoice. */
  excludeIds: string[];
  /** Service period of the invoice, preselected. */
  start: string | null;
  end: string | null;
  vatApplicable: boolean;
  /** Lines, the time they bill (with its duration) and its period. */
  onAdd: (lines: AccountingLineInput[], time: { id: string; seconds: number }[], period: { start: string; end: string }) => void;
  onCancel: () => void;
}

/**
 * Tracked time not billed yet of a project (and its sub-projects) over a period, turned into invoice lines:
 * one line, per day, per task or per time, at a price per hour or per day (from the catalogue or typed).
 * @param {TimeBillingFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function TimeBillingForm({ projectId: initialProject, projects, excludeIds, start, end, vatApplicable, onAdd, onCancel }: TimeBillingFormProps) {
  const [projectId, setProjectId] = useState<string | null>(initialProject ?? projects.find((option) => !option.disabled)?.value ?? null);
  const [from, setFrom] = useState<string | null>(start);
  const [to, setTo] = useState<string | null>(end);
  const [grouping, setGrouping] = useState<TimeGrouping>('TOTAL');
  const [unit, setUnit] = useState<'HOUR' | 'DAY'>('HOUR');
  const [hoursPerDay, setHoursPerDay] = useState(7);
  const [unitPrice, setUnitPrice] = useState(0);
  const [vatRate, setVatRate] = useState(vatApplicable ? 20 : 0);
  const [lineLabel, setLineLabel] = useState('Prestation');
  const [roundQuarter, setRoundQuarter] = useState(false);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const entries = useTimeEntries(projectId ?? '');
  const { context } = useTaskContext();
  const { data: catalog } = useCatalogItems();
  const rates = unarchived(catalog ?? []).filter((item) => item.kind === 'ITEM' && (item.unit === 'HOUR' || item.unit === 'DAY'));

  const billable: BillableTime[] = (entries.data ?? [])
    .filter((entry) => entry.duration !== null && !entry.documentId && !excludeIds.includes(entry.id))
    .map((entry) => ({
      id: entry.id,
      day: localDay(entry.startedAt),
      seconds: entry.duration ?? 0,
      description: entry.description ?? null,
      tasks: entry.taskIds.map((id) => context?.taskById.get(id)?.label).filter((task): task is string => Boolean(task)),
    }))
    .filter((entry) => (!from || entry.day >= from) && (!to || entry.day <= to));
  const selected = billable.filter((entry) => !unchecked.has(entry.id));
  const lines = timeLines(selected, { grouping, unit, hoursPerDay, unitPrice, vatRate, label: lineLabel.trim() || 'Prestation', roundQuarter });
  const total = sumOf(lines, (line) => toCents(line.quantity * line.unitPrice));
  const days = selected.map((entry) => entry.day).sort();
  const view = useDataView({ tableKey: 'time-billing', columns: BILLING_COLUMNS, rows: billable, title: 'Temps à facturer', getKey: (entry) => entry.id });

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Select label="Projet" required searchable allowDeselect={false} {...treeSelectProps(projects)} value={projectId} onChange={setProjectId} />
        <PeriodField
          label="Période"
          value={[from, to]}
          onChange={([first, last]) => {
            setFrom(first);
            setTo(last);
          }}
        />
      </SimpleGrid>

      {!projectId ? (
        <Text size="sm" c="dimmed">
          Choisissez le projet dont le temps est facturé.
        </Text>
      ) : entries.isPending ? (
        <TableSkeleton rows={3} />
      ) : billable.length === 0 ? (
        <EmptyState compact message={`Aucun temps à facturer sur ce projet ${from || to ? 'pour cette période' : ''} : tout le temps terminé est déjà facturé.`} />
      ) : (
        <DataTable
          view={view}
          getKey={(entry) => entry.id}
          toolbar={false}
          maxHeight={240}
          verticalSpacing={4}
          leading={{
            width: 36,
            header: (
              <Checkbox
                size="xs"
                aria-label="Tout sélectionner"
                checked={unchecked.size === 0}
                indeterminate={unchecked.size > 0 && selected.length > 0}
                onChange={() => setUnchecked(unchecked.size === 0 ? new Set(billable.map((entry) => entry.id)) : new Set())}
              />
            ),
            cell: (entry) => (
              <Checkbox size="xs" aria-label={`Facturer le temps du ${entry.day}`} checked={!unchecked.has(entry.id)} onChange={() => setUnchecked((current) => toggledIn(current, entry.id))} />
            ),
          }}
          cells={(entry) => ({
            day: <Text size="sm">{fmt.dayShort(entry.day)}</Text>,
            work: (
              <Text size="sm" lineClamp={1}>
                {workOf(entry) || (
                  <Text span c="dimmed" fs="italic">
                    Sans description
                  </Text>
                )}
              </Text>
            ),
            duration: (
              <Text size="sm" ff="monospace" style={{ whiteSpace: 'nowrap' }}>
                {formatDuration(entry.seconds)}
              </Text>
            ),
          })}
          actions={() => null}
          actionsWidth={8}
        />
      )}

      {rates.length > 0 && (
        <Select
          label="Tarif du catalogue"
          placeholder="Aucun"
          clearable
          data={rates.map((item) => ({ value: item.id, label: `${item.label} — ${fmt.money(item.unitPrice)} / ${item.unit === 'DAY' ? 'jour' : 'heure'}` }))}
          onChange={(id) => {
            const item = rates.find((rate) => rate.id === id);
            if (!item) return;
            setUnit(item.unit as 'HOUR' | 'DAY');
            setUnitPrice(item.unitPrice);
            setVatRate(item.vatRate);
            setLineLabel(item.label);
          }}
        />
      )}
      <TextInput label="Libellé des lignes" value={lineLabel} onChange={(event) => setLineLabel(event.currentTarget.value)} />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <LabeledField label="Une ligne">
          <SegmentedControl
            size="xs"
            data={[
              { value: 'TOTAL', label: 'En tout' },
              { value: 'DAY', label: 'Par jour' },
              { value: 'TASK', label: 'Par tâche' },
              { value: 'ENTRY', label: 'Par temps' },
            ]}
            value={grouping}
            onChange={(value) => setGrouping(value as TimeGrouping)}
          />
        </LabeledField>
        <LabeledField label="Facturé à">
          <SegmentedControl
            size="xs"
            data={[
              { value: 'HOUR', label: 'L’heure' },
              { value: 'DAY', label: 'La journée' },
            ]}
            value={unit}
            onChange={(value) => setUnit(value as 'HOUR' | 'DAY')}
          />
        </LabeledField>
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <AmountInput label={unit === 'DAY' ? 'Prix HT par jour' : 'Prix HT par heure'} min={0} value={unitPrice} onChange={(value) => setUnitPrice(typeof value === 'number' ? value : 0)} />
        {unit === 'DAY' ? (
          <NumberInput
            label="Heures par jour"
            min={1}
            max={24}
            decimalScale={2}
            {...FRENCH_NUMBER_FORMAT}
            value={hoursPerDay}
            onChange={(value) => setHoursPerDay(typeof value === 'number' && value > 0 ? value : 7)}
          />
        ) : (
          <Checkbox label="Arrondir au quart d’heure supérieur" mt={28} checked={roundQuarter} onChange={(event) => setRoundQuarter(event.currentTarget.checked)} />
        )}
        {vatApplicable && <Select label="TVA" allowDeselect={false} data={vatRateOptions(vatRate)} value={String(vatRate)} onChange={(rate) => rate !== null && setVatRate(Number(rate))} />}
      </SimpleGrid>

      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          {selected.length} temps, {formatDuration(sumOf(selected, (entry) => entry.seconds))} → {countOf(lines.length, 'ligne')}, {fmt.moneyCents(total)} HT
        </Text>
        <FormActions
          onCancel={onCancel}
          submitLabel="Ajouter les lignes"
          disabled={lines.length === 0}
          onSubmit={() =>
            onAdd(
              lines,
              selected.map((entry) => ({ id: entry.id, seconds: entry.seconds })),
              { start: days[0], end: days[days.length - 1] },
            )
          }
        />
      </Group>
    </Stack>
  );
}
