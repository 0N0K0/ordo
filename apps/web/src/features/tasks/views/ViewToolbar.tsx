import { arrayMove } from '@dnd-kit/sortable';
import { ActionIcon, Button, Group, SegmentedControl, Select, Stack, Switch, Text } from '@mantine/core';
import { defaultTaskViewConfig, EVENT_PERIODS, TASK_GROUP_BY, TASK_SORT_KEYS, type EventPeriod, type TaskGroupBy, type TaskViewConfig } from '@ordo/shared';
import { ArrowDownIcon, ArrowUpIcon, FileCsvIcon, FilePdfIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { TableOptions, TableToolbar, ToolbarFilter, ToolbarSort } from '../../../components/data-table/TableToolbar';
import { useTaskColumnDefaults } from '../api';
import type { TaskContext } from '../use-task-context';
import { ColumnsPanel } from './ColumnsPanel';
import { GROUP_BY_LABELS, SORT_LABELS } from './columns-meta';
import { FilterBuilder } from './FilterBuilder';
import { countConditions } from './filter-meta';

type Change = (change: (config: TaskViewConfig) => TaskViewConfig) => void;

const EVENT_PERIOD_LABELS: Record<EventPeriod, string> = {
  thisWeek: 'Cette semaine',
  nextWeek: 'La semaine prochaine',
  thisMonth: 'Ce mois-ci',
  nextMonth: 'Le mois prochain',
  'next:7': '7 prochains jours',
  'next:30': '30 prochains jours',
  'next:90': '90 prochains jours',
  'past:30': '30 derniers jours',
};

interface SortPanelProps<K extends string> {
  sorting: { id: K; desc: boolean }[];
  onChange: (sorting: { id: K; desc: boolean }[]) => void;
  /** Sort keys offered. */
  keys: readonly K[];
  labels: Record<K, string>;
  /** What the manual order allows. */
  manualText: string;
  /** Tip under the sorts. Optional. */
  hint?: string;
}

/**
 * Sort levels: column, direction, priority order. Empty means manual order.
 * @param {SortPanelProps<K>} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function SortPanel<K extends string>({ sorting, onChange, keys, labels, manualText, hint }: SortPanelProps<K>) {
  const used = new Set(sorting.map((sort) => sort.id));
  const available = keys.filter((key) => !used.has(key));
  return (
    <Stack gap="xs" w={380}>
      {sorting.length === 0 ? (
        <Text size="sm" c="dimmed">
          {manualText}
        </Text>
      ) : (
        sorting.map((sort, index) => (
          <Group key={sort.id} gap="xs" wrap="nowrap">
            <Text size="xs" c="dimmed" w={48}>
              {index === 0 ? 'Trier par' : 'puis'}
            </Text>
            <Select
              comboboxProps={{ withinPortal: false }}
              size="xs"
              aria-label="Colonne"
              data={[sort.id, ...available].map((key) => ({ value: key, label: labels[key] }))}
              value={sort.id}
              allowDeselect={false}
              onChange={(id) => id && onChange(sorting.map((item, i) => (i === index ? { ...item, id: id as K } : item)))}
              style={{ flex: 1 }}
            />
            <SegmentedControl
              size="xs"
              value={sort.desc ? 'desc' : 'asc'}
              onChange={(value) => onChange(sorting.map((item, i) => (i === index ? { ...item, desc: value === 'desc' } : item)))}
              data={[
                { value: 'asc', label: '↑' },
                { value: 'desc', label: '↓' },
              ]}
              aria-label="Sens"
            />
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Monter" disabled={index === 0} onClick={() => onChange(arrayMove(sorting, index, index - 1))}>
              <ArrowUpIcon aria-hidden />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Descendre" disabled={index === sorting.length - 1} onClick={() => onChange(arrayMove(sorting, index, index + 1))}>
              <ArrowDownIcon aria-hidden />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Retirer ce tri" onClick={() => onChange(sorting.filter((_, i) => i !== index))}>
              <TrashIcon aria-hidden />
            </ActionIcon>
          </Group>
        ))
      )}
      <Group justify="space-between">
        <Button size="compact-sm" variant="subtle" leftSection={<PlusIcon aria-hidden />} disabled={available.length === 0} onClick={() => onChange([...sorting, { id: available[0], desc: false }])}>
          Ajouter un tri
        </Button>
        {sorting.length > 0 && (
          <Button size="compact-sm" variant="subtle" color="gray" onClick={() => onChange([])}>
            Revenir à l’ordre manuel
          </Button>
        )}
      </Group>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Stack>
  );
}

interface ViewToolbarProps {
  config: TaskViewConfig;
  change: Change;
  context: TaskContext;
  /** Filter popover state (also opened from the column menus). */
  filterOpened: boolean;
  onFilterOpenedChange: (opened: boolean) => void;
  /** The page sets the period of the events (home): no period choice. */
  eventPeriodLocked: boolean;
  /** What sets the period of the events when locked (the sprints filtered), told in place of its choice. */
  eventPeriodLabel?: string;
  onExport: (format: 'csv' | 'pdf') => void;
  exporting: boolean;
  /** Something is listed. */
  canExport: boolean;
  /** The current view has unsaved changes: saved or reverted from the top of the options. */
  dirty: boolean;
  onSave: () => void;
  onRevert: () => void;
}

/**
 * Display options of a task view: grouping, sub-tasks flat, archived tasks, events and their period.
 * @param {Pick<ViewToolbarProps, 'config' | 'change' | 'eventPeriodLocked' | 'eventPeriodLabel'>} props Component props.
 * @returns {JSX.Element} Options.
 */
function DisplayOptions({ config, change, eventPeriodLocked, eventPeriodLabel }: Pick<ViewToolbarProps, 'config' | 'change' | 'eventPeriodLocked' | 'eventPeriodLabel'>) {
  // The lists open in the panel: rendered in a portal, a click in them would close it.
  const inPanel = { withinPortal: false } as const;
  return (
    <>
      <Select
        label="Grouper par"
        placeholder="Aucun groupe"
        data={TASK_GROUP_BY.map((groupBy) => ({ value: groupBy, label: GROUP_BY_LABELS[groupBy] }))}
        value={config.groupBy}
        onChange={(groupBy) => change((current) => ({ ...current, groupBy: (groupBy as TaskGroupBy | null) ?? null }))}
        clearable
        comboboxProps={inPanel}
      />
      <Switch
        label="Sous-tâches à plat"
        checked={config.flat}
        onChange={(event) => {
          const flat = event.currentTarget.checked;
          change((current) => ({ ...current, flat }));
        }}
      />
      <Switch
        label="Archivées"
        checked={config.includeArchived}
        onChange={(event) => {
          const includeArchived = event.currentTarget.checked;
          change((current) => ({ ...current, includeArchived }));
        }}
      />
      <Switch
        label="Évènements"
        checked={config.events.show}
        onChange={(event) => {
          const show = event.currentTarget.checked;
          change((current) => ({ ...current, events: { ...current.events, show } }));
        }}
      />
      {config.events.show && eventPeriodLocked && eventPeriodLabel && (
        <Text size="sm" c="dimmed">
          {eventPeriodLabel}
        </Text>
      )}
      {config.events.show && !eventPeriodLocked && (
        <Select
          label="Période des évènements"
          data={EVENT_PERIODS.map((period) => ({ value: period, label: EVENT_PERIOD_LABELS[period] }))}
          value={config.events.period}
          allowDeselect={false}
          onChange={(period) => period && change((current) => ({ ...current, events: { ...current.events, period: period as EventPeriod } }))}
          comboboxProps={inPanel}
        />
      )}
    </>
  );
}

/**
 * Toolbar of the current view (the one of every table): the search on all the width left, filters, sorting, and the
 * « Options » menu (a dot on it while the view has unsaved changes) with those changes to save or revert, the display
 * (grouping, sub-tasks flat, archived tasks, events and their period), the columns and the exports.
 * @param {ViewToolbarProps} props Component props.
 * @returns {JSX.Element} Toolbar.
 */
export function ViewToolbar({
  config,
  change,
  context,
  filterOpened,
  onFilterOpenedChange,
  eventPeriodLocked,
  eventPeriodLabel,
  onExport,
  exporting,
  canExport,
  dirty,
  onSave,
  onRevert,
}: ViewToolbarProps) {
  const { data: columnDefaults } = useTaskColumnDefaults();
  return (
    <TableToolbar
      search={{ value: config.search, onChange: (search) => change((current) => ({ ...current, search })), placeholder: 'Rechercher (#12, titre, description)' }}
      options={
        <TableOptions
          dirty={dirty}
          onSave={onSave}
          onRevert={onRevert}
          display={<DisplayOptions config={config} change={change} eventPeriodLocked={eventPeriodLocked} eventPeriodLabel={eventPeriodLabel} />}
          columns={
            <ColumnsPanel
              columnOrder={config.columnOrder}
              hiddenColumns={config.hiddenColumns}
              onChange={(columns) => change((current) => ({ ...current, ...columns }))}
              onReset={() => {
                const defaults = defaultTaskViewConfig(columnDefaults ?? undefined);
                change((current) => ({ ...current, columnOrder: defaults.columnOrder, hiddenColumns: defaults.hiddenColumns, columnSizing: {} }));
              }}
            />
          }
          exports={
            <Group gap="xs" grow>
              <Button variant="default" leftSection={<FileCsvIcon aria-hidden />} onClick={() => onExport('csv')} loading={exporting} disabled={!canExport}>
                CSV
              </Button>
              <Button variant="default" leftSection={<FilePdfIcon aria-hidden />} onClick={() => onExport('pdf')} loading={exporting} disabled={!canExport}>
                PDF
              </Button>
            </Group>
          }
        />
      }
    >
      <ToolbarFilter count={countConditions(config.filter)} opened={filterOpened} onOpenedChange={onFilterOpenedChange}>
        <FilterBuilder filter={config.filter} context={context} onChange={(filter) => change((current) => ({ ...current, filter }))} />
      </ToolbarFilter>
      <ToolbarSort count={config.sorting.length}>
        <SortPanel
          sorting={config.sorting}
          onChange={(sorting) => change((current) => ({ ...current, sorting }))}
          keys={TASK_SORT_KEYS}
          labels={SORT_LABELS}
          manualText="Ordre manuel : les tâches peuvent être réordonnées par glisser-déposer."
          hint="Astuce : cliquez sur un en-tête de colonne pour trier, Maj + clic pour ajouter un niveau."
        />
      </ToolbarSort>
    </TableToolbar>
  );
}
