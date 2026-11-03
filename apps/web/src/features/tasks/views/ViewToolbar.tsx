import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  CloseButton,
  Group,
  Menu,
  Popover,
  ScrollArea,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import {
  EVENT_PERIODS,
  TASK_COLUMNS,
  TASK_GROUP_BY,
  TASK_SORT_KEYS,
  type EventPeriod,
  type TaskColumn,
  type TaskGroupBy,
  type TaskSortKey,
  type TaskViewConfig,
} from '@ordo/shared';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretDownIcon,
  ColumnsIcon,
  DownloadSimpleIcon,
  FileCsvIcon,
  FilePdfIcon,
  DotsSixVerticalIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SortAscendingIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import type { TaskContext } from '../use-task-context';
import { COLUMN_LABELS, GROUP_BY_LABELS, LOCKED_COLUMNS, SORT_LABELS } from './columns-meta';
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

interface SortPanelProps {
  sorting: TaskViewConfig['sorting'];
  onChange: (sorting: TaskViewConfig['sorting']) => void;
}

/**
 * Sort levels: column, direction, priority order. Empty means manual order.
 * @param {SortPanelProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
function SortPanel({ sorting, onChange }: SortPanelProps) {
  const used = new Set(sorting.map((sort) => sort.id));
  const available = TASK_SORT_KEYS.filter((key) => !used.has(key));
  return (
    <Stack gap="xs" w={380}>
      {sorting.length === 0 ? (
        <Text size="sm" c="dimmed">
          Ordre manuel : les tâches peuvent être réordonnées par glisser-déposer.
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
              data={[sort.id, ...available].map((key) => ({ value: key, label: SORT_LABELS[key] }))}
              value={sort.id}
              allowDeselect={false}
              onChange={(id) => id && onChange(sorting.map((item, i) => (i === index ? { ...item, id: id as TaskSortKey } : item)))}
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
      <Text size="xs" c="dimmed">
        Astuce : cliquez sur un en-tête de colonne pour trier, Maj + clic pour ajouter un niveau.
      </Text>
    </Stack>
  );
}

/**
 * Column of the visibility / order list, draggable.
 * @param {object} props Component props.
 * @param {TaskColumn} props.column Column.
 * @param {boolean} props.visible Whether it is shown.
 * @param {(visible: boolean) => void} props.onToggle Shows or hides it.
 * @returns {JSX.Element} Row.
 */
function ColumnItem({ column, visible, onToggle }: { column: TaskColumn; visible: boolean; onToggle: (visible: boolean) => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: column });
  return (
    <Group
      ref={setNodeRef}
      gap="xs"
      wrap="nowrap"
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Déplacer ${COLUMN_LABELS[column]}`} {...attributes} {...listeners} style={{ cursor: 'grab' }}>
        <DotsSixVerticalIcon aria-hidden />
      </ActionIcon>
      <Checkbox
        size="xs"
        label={COLUMN_LABELS[column]}
        checked={visible}
        disabled={LOCKED_COLUMNS.includes(column)}
        onChange={(event) => onToggle(event.currentTarget.checked)}
      />
    </Group>
  );
}

/**
 * Column visibility and order.
 * @param {object} props Component props.
 * @param {TaskViewConfig} props.config View configuration.
 * @param {Change} props.change Configuration updater.
 * @returns {JSX.Element} Panel.
 */
function ColumnsPanel({ config, change }: { config: TaskViewConfig; change: Change }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  // Columns missing from a saved order (added later) go at the end.
  const order = [...config.columnOrder, ...TASK_COLUMNS.filter((column) => !config.columnOrder.includes(column))];
  const hidden = new Set(config.hiddenColumns);

  /**
   * Moves a dragged column.
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    change((current) => ({
      ...current,
      columnOrder: arrayMove(order, order.indexOf(active.id as TaskColumn), order.indexOf(over.id as TaskColumn)),
    }));
  };

  return (
    <ScrollArea.Autosize mah={420} type="auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <Stack gap={4} w={220}>
            {order.map((column) => (
              <ColumnItem
                key={column}
                column={column}
                visible={!hidden.has(column)}
                onToggle={(visible) =>
                  change((current) => ({
                    ...current,
                    hiddenColumns: visible
                      ? current.hiddenColumns.filter((item) => item !== column)
                      : [...current.hiddenColumns, column],
                  }))
                }
              />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>
    </ScrollArea.Autosize>
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
  onExport: (format: 'csv' | 'pdf') => void;
  exporting: boolean;
  /** Something is listed. */
  canExport: boolean;
}

/**
 * Toolbar of the current view: search, filters, sorting, columns, grouping, display toggles, the events listed
 * with the tasks and their period, and the exports.
 * @param {ViewToolbarProps} props Component props.
 * @returns {JSX.Element} Toolbar.
 */
export function ViewToolbar({ config, change, context, filterOpened, onFilterOpenedChange, eventPeriodLocked, onExport, exporting, canExport }: ViewToolbarProps) {
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
        w={{ base: '100%', sm: 280 }}
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
          <SortPanel sorting={config.sorting} onChange={(sorting) => change((current) => ({ ...current, sorting }))} />
        </Popover.Dropdown>
      </Popover>

      <Popover position="bottom-start" shadow="md" withinPortal>
        <Popover.Target>
          <Button variant="default" leftSection={<ColumnsIcon aria-hidden />}>
            Colonnes
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <ColumnsPanel config={config} change={change} />
        </Popover.Dropdown>
      </Popover>

      <Select
        aria-label="Grouper par"
        placeholder="Grouper par…"
        data={TASK_GROUP_BY.map((groupBy) => ({ value: groupBy, label: `Grouper par : ${GROUP_BY_LABELS[groupBy]}` }))}
        value={config.groupBy}
        onChange={(groupBy) => change((current) => ({ ...current, groupBy: (groupBy as TaskGroupBy | null) ?? null }))}
        clearable
        w={230}
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
      {config.events.show && !eventPeriodLocked && (
        <Select
          aria-label="Période des évènements"
          data={EVENT_PERIODS.map((period) => ({ value: period, label: EVENT_PERIOD_LABELS[period] }))}
          value={config.events.period}
          allowDeselect={false}
          onChange={(period) => period && change((current) => ({ ...current, events: { ...current.events, period: period as EventPeriod } }))}
          w={190}
        />
      )}

      <Menu position="bottom-end" shadow="md">
        <Menu.Target>
          <Button
            variant="default"
            ml="auto"
            leftSection={<DownloadSimpleIcon aria-hidden />}
            rightSection={<CaretDownIcon aria-hidden />}
            loading={exporting}
            disabled={!canExport}
          >
            Exporter
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Ce que la vue liste, colonnes visibles</Menu.Label>
          <Menu.Item leftSection={<FileCsvIcon aria-hidden />} onClick={() => onExport('csv')}>
            CSV (tableur)
          </Menu.Item>
          <Menu.Item leftSection={<FilePdfIcon aria-hidden />} onClick={() => onExport('pdf')}>
            PDF
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
