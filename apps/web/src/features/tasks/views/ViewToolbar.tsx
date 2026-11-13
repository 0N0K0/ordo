import { arrayMove } from '@dnd-kit/sortable';
import {
  ActionIcon,
  Badge,
  Button,
  CloseButton,
  Indicator,
  Collapse,
  Divider,
  Group,
  Popover,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import {
  EVENT_PERIODS,
  TASK_GROUP_BY,
  TASK_SORT_KEYS,
  type EventPeriod,
  type TaskGroupBy,
  type TaskViewConfig,
} from '@ordo/shared';
import {
  ArrowCounterClockwiseIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CaretDownIcon,
  ColumnsIcon,
  FileCsvIcon,
  FilePdfIcon,
  FloppyDiskIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  SortAscendingIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useState } from 'react';
import type { TaskContext } from '../use-task-context';
import { GROUP_BY_LABELS, SORT_LABELS } from './columns-meta';
import { FilterBuilder } from './FilterBuilder';
import { countConditions } from './filter-meta';
import { ColumnsPanel } from './ColumnsPanel';

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
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label="Monter"
              disabled={index === 0}
              onClick={() => onChange(arrayMove(sorting, index, index - 1))}
            >
              <ArrowUpIcon aria-hidden />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label="Descendre"
              disabled={index === sorting.length - 1}
              onClick={() => onChange(arrayMove(sorting, index, index + 1))}
            >
              <ArrowDownIcon aria-hidden />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label="Retirer ce tri"
              onClick={() => onChange(sorting.filter((_, i) => i !== index))}
            >
              <TrashIcon aria-hidden />
            </ActionIcon>
          </Group>
        ))
      )}
      <Group justify="space-between">
        <Button
          size="compact-sm"
          variant="subtle"
          leftSection={<PlusIcon aria-hidden />}
          disabled={available.length === 0}
          onClick={() => onChange([...sorting, { id: available[0], desc: false }])}
        >
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

/**
 * Column visibility and order of a view.
 * @param {object} props Component props.
 * @param {TaskViewConfig} props.config View configuration.
 * @param {Change} props.change Configuration updater.
 * @returns {JSX.Element} Panel.
 */
function ViewColumnsPanel({ config, change }: { config: TaskViewConfig; change: Change }) {
  // The options panel scrolls as a whole: no scroll of its own.
  return <ColumnsPanel columnOrder={config.columnOrder} hiddenColumns={config.hiddenColumns} onChange={(columns) => change((current) => ({ ...current, ...columns }))} />;
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
 * Options of a view, in one panel: its unsaved changes to save or revert (at the top), display (grouping, sub-tasks
 * flat, archived tasks, events and their period), columns (folded: the list is long) and exports.
 * @param {Omit<ViewToolbarProps, 'context' | 'filterOpened' | 'onFilterOpenedChange'>} props Component props.
 * @returns {JSX.Element} Panel.
 */
function ViewOptions({ config, change, eventPeriodLocked, eventPeriodLabel, onExport, exporting, canExport, dirty, onSave, onRevert }: Omit<ViewToolbarProps, 'context' | 'filterOpened' | 'onFilterOpenedChange'>) {
  const [columnsOpened, setColumnsOpened] = useState(false);
  // The lists open in the panel: rendered in a portal, a click in them would close it.
  const inPanel = { withinPortal: false } as const;
  return (
    <Stack gap="sm">
      {dirty && (
        <>
          <Text size="sm" c="orange">
            Modifications non enregistrées
          </Text>
          <Group gap="xs" grow>
            <Button variant="default" leftSection={<ArrowCounterClockwiseIcon aria-hidden />} onClick={onRevert}>
              Annuler
            </Button>
            <Button leftSection={<FloppyDiskIcon aria-hidden />} onClick={onSave}>
              Enregistrer
            </Button>
          </Group>
          <Divider />
        </>
      )}
      <Text size="xs" fw={600} c="dimmed" tt="uppercase">
        Affichage
      </Text>
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

      <Divider />
      <Button
        variant="subtle"
        color="gray"
        justify="space-between"
        leftSection={<ColumnsIcon aria-hidden />}
        rightSection={<CaretDownIcon aria-hidden style={{ transform: columnsOpened ? 'rotate(180deg)' : undefined }} />}
        onClick={() => setColumnsOpened((opened) => !opened)}
        aria-expanded={columnsOpened}
        fullWidth
      >
        Colonnes
      </Button>
      <Collapse expanded={columnsOpened}>
        <ViewColumnsPanel config={config} change={change} />
      </Collapse>

      <Divider />
      <Text size="xs" fw={600} c="dimmed" tt="uppercase">
        Exporter
      </Text>
      <Group gap="xs" grow>
        <Button variant="default" leftSection={<FileCsvIcon aria-hidden />} onClick={() => onExport('csv')} loading={exporting} disabled={!canExport}>
          CSV
        </Button>
        <Button variant="default" leftSection={<FilePdfIcon aria-hidden />} onClick={() => onExport('pdf')} loading={exporting} disabled={!canExport}>
          PDF
        </Button>
      </Group>
    </Stack>
  );
}

/**
 * Toolbar of the current view: the search on all the width left, filters, sorting, and one « Options » menu (a dot
 * on it while the view has unsaved changes) with those changes to save or revert, the display (grouping, sub-tasks
 * flat, archived tasks, events and their period), the columns and the exports.
 * @param {ViewToolbarProps} props Component props.
 * @returns {JSX.Element} Toolbar.
 */
export function ViewToolbar({ config, change, context, filterOpened, onFilterOpenedChange, eventPeriodLocked, eventPeriodLabel, onExport, exporting, canExport, dirty, onSave, onRevert }: ViewToolbarProps) {
  const filterCount = countConditions(config.filter);
  return (
    <Group gap="sm" wrap="wrap">
      <TextInput
        placeholder="Rechercher (#12, titre, description)"
        aria-label="Rechercher une tâche"
        leftSection={<MagnifyingGlassIcon aria-hidden />}
        rightSection={
          config.search ? (
            <CloseButton size="sm" aria-label="Effacer" onClick={() => change((current) => ({ ...current, search: '' }))} />
          ) : null
        }
        value={config.search}
        onChange={(event) => {
          const search = event.currentTarget.value;
          change((current) => ({ ...current, search }));
        }}
        // Every width left by the buttons, but never under a minimum: without room, the buttons go to the next line.
        style={{ flex: '1 1 14rem', minWidth: 'min(100%, 14rem)' }}
      />

      <Popover
        opened={filterOpened}
        onChange={onFilterOpenedChange}
        position="bottom-start"
        shadow="md"
        withinPortal
        trapFocus={false}
        closeOnClickOutside
      >
        <Popover.Target>
          <Button
            onClick={() => onFilterOpenedChange(!filterOpened)}
            variant={filterCount ? 'light' : 'default'}
            leftSection={<FunnelIcon aria-hidden />}
            rightSection={filterCount ? <Badge size="xs" circle>{filterCount}</Badge> : undefined}
          >
            Filtrer
          </Button>
        </Popover.Target>
        <Popover.Dropdown maw="min(56rem, calc(100vw - 2rem))">
          {/* No scroll container: it would clip the dropdowns rendered inside the popover. */}
          <FilterBuilder
            filter={config.filter}
            context={context}
            onChange={(filter) => change((current) => ({ ...current, filter }))}
          />
        </Popover.Dropdown>
      </Popover>

      <Popover position="bottom-start" shadow="md" withinPortal>
        <Popover.Target>
          <Button
            variant={config.sorting.length ? 'light' : 'default'}
            leftSection={<SortAscendingIcon aria-hidden />}
            rightSection={config.sorting.length ? <Badge size="xs" circle>{config.sorting.length}</Badge> : undefined}
          >
            Trier
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <SortPanel
            sorting={config.sorting}
            onChange={(sorting) => change((current) => ({ ...current, sorting }))}
            keys={TASK_SORT_KEYS}
            labels={SORT_LABELS}
            manualText="Ordre manuel : les tâches peuvent être réordonnées par glisser-déposer."
            hint="Astuce : cliquez sur un en-tête de colonne pour trier, Maj + clic pour ajouter un niveau."
          />
        </Popover.Dropdown>
      </Popover>

      {/* A dot while the view has unsaved changes. */}
      <Indicator disabled={!dirty} size={8} offset={4} position="top-end" color="orange">
        {/* Never taller than the room left in the window: its content scrolls (the columns unfolded). */}
        <Popover position="bottom-end" shadow="md" withinPortal width={340} middlewares={{ flip: true, shift: true, size: { padding: 8 } }}>
          <Popover.Target>
            <Button variant="default" leftSection={<SlidersHorizontalIcon aria-hidden />} rightSection={<CaretDownIcon aria-hidden />} aria-label={dirty ? 'Options (modifications non enregistrées)' : 'Options'}>
              Options
            </Button>
          </Popover.Target>
          <Popover.Dropdown style={{ overflowY: 'auto' }}>
            <ViewOptions
              dirty={dirty}
              onSave={onSave}
              onRevert={onRevert}
              config={config}
              change={change}
              eventPeriodLocked={eventPeriodLocked}
              eventPeriodLabel={eventPeriodLabel}
              onExport={onExport}
              exporting={exporting}
              canExport={canExport}
            />
          </Popover.Dropdown>
        </Popover>
      </Indicator>
    </Group>
  );
}
