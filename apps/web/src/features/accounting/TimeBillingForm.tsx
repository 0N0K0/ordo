import { Button, Checkbox, Group, NumberInput, ScrollArea, SegmentedControl, Select, SimpleGrid, Skeleton, Stack, Table, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { formatDuration, formatMoney, VAT_RATES, type AccountingLineInput } from '@ordo/shared';
import { useState } from 'react';
import { useTaskContext } from '../tasks/use-task-context';
import { useTimeEntries } from '../time/api';
import { useCatalogItems } from './catalog-api';
import { timeLines, type BillableTime, type TimeGrouping } from './time-lines';

const shortDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Local day of an instant, YYYY-MM-DD.
 * @param {string} iso Instant.
 * @returns {string} Day.
 */
function localDay(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

interface TimeBillingFormProps {
  /** Project of the invoice, preselected. */
  projectId: string | null;
  /** Projects of the client. */
  projects: { value: string; label: string }[];
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
  const [projectId, setProjectId] = useState<string | null>(initialProject ?? projects[0]?.value ?? null);
  const [from, setFrom] = useState<string | null>(start);
  const [to, setTo] = useState<string | null>(end);
  const [grouping, setGrouping] = useState<TimeGrouping>('TOTAL');
  const [unit, setUnit] = useState<'HOUR' | 'DAY'>('HOUR');
  const [hoursPerDay, setHoursPerDay] = useState(7);
  const [unitPrice, setUnitPrice] = useState(0);
  const [vatRate, setVatRate] = useState(vatApplicable ? 20 : 0);
  const [title, setTitle] = useState('Prestation');
  const [roundQuarter, setRoundQuarter] = useState(false);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const entries = useTimeEntries(projectId ?? '');
  const { context } = useTaskContext();
  const { data: catalog } = useCatalogItems();
  const rates = (catalog ?? []).filter((item) => !item.archived && item.kind === 'ITEM' && (item.unit === 'HOUR' || item.unit === 'DAY'));

  const billable: BillableTime[] = (entries.data ?? [])
    .filter((entry) => entry.duration !== null && !entry.documentId && !excludeIds.includes(entry.id))
    .map((entry) => ({
      id: entry.id,
      day: localDay(entry.startedAt),
      seconds: entry.duration ?? 0,
      description: entry.description ?? null,
      tasks: entry.taskIds.map((id) => context?.taskById.get(id)?.title).filter((task): task is string => Boolean(task)),
    }))
    .filter((entry) => (!from || entry.day >= from) && (!to || entry.day <= to));
  const selected = billable.filter((entry) => !unchecked.has(entry.id));
  const lines = timeLines(selected, { grouping, unit, hoursPerDay, unitPrice, vatRate, title: title.trim() || 'Prestation', roundQuarter });
  const total = lines.reduce((sum, line) => sum + Math.round(line.quantity * Math.round(line.unitPrice * 100)), 0);
  const days = selected.map((entry) => entry.day).sort();

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <Select label="Projet" required searchable allowDeselect={false} data={projects} value={projectId} onChange={setProjectId} />
        <DatePickerInput label="Du" clearable valueFormat="D MMM YYYY" value={from} onChange={setFrom} />
        <DatePickerInput label="Au" clearable valueFormat="D MMM YYYY" value={to} onChange={setTo} />
      </SimpleGrid>

      {!projectId ? (
        <Text size="sm" c="dimmed">
          Choisissez le projet dont le temps est facturé.
        </Text>
      ) : entries.isPending ? (
        <Skeleton height={120} />
      ) : billable.length === 0 ? (
        <Text size="sm" c="dimmed">
          Aucun temps à facturer sur ce projet {from || to ? 'pour cette période' : ''} : tout le temps terminé est déjà facturé.
        </Text>
      ) : (
        <ScrollArea.Autosize mah={240} type="auto">
          <Table verticalSpacing={4} withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={32}>
                  <Checkbox
                    aria-label="Tout sélectionner"
                    checked={unchecked.size === 0}
                    indeterminate={unchecked.size > 0 && selected.length > 0}
                    onChange={() => setUnchecked(unchecked.size === 0 ? new Set(billable.map((entry) => entry.id)) : new Set())}
                  />
                </Table.Th>
                <Table.Th>Jour</Table.Th>
                <Table.Th>Temps</Table.Th>
                <Table.Th ta="right">Durée</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {billable.map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>
                    <Checkbox
                      aria-label={`Facturer le temps du ${entry.day}`}
                      checked={!unchecked.has(entry.id)}
                      onChange={() =>
                        setUnchecked((current) => {
                          const next = new Set(current);
                          if (next.has(entry.id)) next.delete(entry.id);
                          else next.add(entry.id);
                          return next;
                        })
                      }
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{shortDay.format(new Date(`${entry.day}T00:00:00Z`))}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>
                      {[entry.tasks.join(', '), entry.description].filter(Boolean).join(' — ') || <Text span c="dimmed" fs="italic">Sans description</Text>}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" ff="monospace" style={{ whiteSpace: 'nowrap' }}>
                      {formatDuration(entry.seconds)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      )}

      {rates.length > 0 && (
        <Select
          label="Tarif du catalogue"
          placeholder="Aucun"
          clearable
          data={rates.map((item) => ({ value: item.id, label: `${item.title} — ${formatMoney(Math.round(item.unitPrice * 100))} / ${item.unit === 'DAY' ? 'jour' : 'heure'}` }))}
          onChange={(id) => {
            const item = rates.find((rate) => rate.id === id);
            if (!item) return;
            setUnit(item.unit as 'HOUR' | 'DAY');
            setUnitPrice(item.unitPrice);
            setVatRate(item.vatRate);
            setTitle(item.title);
          }}
        />
      )}
      <TextInput label="Libellé des lignes" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Une ligne
          </Text>
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
        </Stack>
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Facturé à
          </Text>
          <SegmentedControl
            size="xs"
            data={[
              { value: 'HOUR', label: 'L’heure' },
              { value: 'DAY', label: 'La journée' },
            ]}
            value={unit}
            onChange={(value) => setUnit(value as 'HOUR' | 'DAY')}
          />
        </Stack>
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <NumberInput
          label={unit === 'DAY' ? 'Prix HT par jour' : 'Prix HT par heure'}
          min={0}
          decimalScale={2}
          decimalSeparator=","
          thousandSeparator=" "
          suffix=" €"
          value={unitPrice}
          onChange={(value) => setUnitPrice(typeof value === 'number' ? value : 0)}
        />
        {unit === 'DAY' ? (
          <NumberInput label="Heures par jour" min={1} max={24} decimalScale={2} decimalSeparator="," value={hoursPerDay} onChange={(value) => setHoursPerDay(typeof value === 'number' && value > 0 ? value : 7)} />
        ) : (
          <Checkbox label="Arrondir au quart d’heure supérieur" mt={28} checked={roundQuarter} onChange={(event) => setRoundQuarter(event.currentTarget.checked)} />
        )}
        {vatApplicable && (
          <Select
            label="TVA"
            allowDeselect={false}
            data={[...new Set([...VAT_RATES, vatRate])].map((rate) => ({ value: String(rate), label: `${rate.toLocaleString('fr-FR')} %` }))}
            value={String(vatRate)}
            onChange={(rate) => rate !== null && setVatRate(Number(rate))}
          />
        )}
      </SimpleGrid>

      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          {selected.length} temps, {formatDuration(selected.reduce((sum, entry) => sum + entry.seconds, 0))} → {lines.length} ligne{lines.length > 1 ? 's' : ''}, {formatMoney(total)} HT
        </Text>
        <Group gap="sm">
          <Button variant="default" onClick={onCancel}>
            Annuler
          </Button>
          <Button disabled={lines.length === 0} onClick={() => onAdd(lines, selected.map((entry) => ({ id: entry.id, seconds: entry.seconds })), { start: days[0], end: days[days.length - 1] })}>
            Ajouter les lignes
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
