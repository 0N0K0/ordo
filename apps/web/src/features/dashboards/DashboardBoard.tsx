import { useTabParam } from '../../components/sortable-tabs/use-tab-param';
import { SortableTabs } from '../../components/sortable-tabs/SortableTabs';
import { ActionButton } from '../../components/actions/ActionButton';
import { ActionsRow } from '../../components/actions/ActionsRow';
import { EmptyState } from '../../components/feedback/EmptyState';
import { BlockSkeleton } from '../../components/feedback/Skeletons';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../components/panels/panels';
import { ActionIcon, Alert, Group, Menu, Paper, SimpleGrid, Stack, Text, TextInput, Tooltip } from '@mantine/core';

import { chartConfigSchema, dashboardNameSchema, defaultChartConfig, type ChartConfig, type ChartSource } from '@ordo/shared';
import {
  ArrowBendUpRightIcon,
  ArrowDownIcon,
  ArrowsHorizontalIcon,
  ArrowUpIcon,
  BankIcon,
  ChartBarIcon,
  CheckSquareOffsetIcon,
  ReceiptIcon,
  CopyIcon,
  DotsSixVerticalIcon,
  DotsThreeIcon,
  FileImageIcon,
  FilePdfIcon,
  PencilSimpleIcon,
  PlusIcon,
  TableIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';

import { ErrorIcon } from '../../components/feedback-icons';
import { notifyError, notifySuccess, onMutationError } from '../../lib/notify';
import { useTaskContext, type TaskContext } from '../tasks/use-task-context';
import { useDashboardMutations, useDashboards, type Dashboard, type DashboardChart } from './api';
import { ChartEditor } from './ChartEditor';
import { chartPng, chartSizeFor, downloadChartsPdf, type ExportScheme } from './chart-image';
import { download, fileName } from '../../lib/download';
import { ImageExportForm } from './ImageExportForm';
import { chartTable, downloadChartCsv, downloadChartTablePdf } from './chart-table';
import { describeChart, useChartData, type ChartScope } from './chart-data';
import { ChartView } from './ChartView';
import { TransferChartForm } from './TransferChartForm';
import { countLabel, NEW_CHART_TITLES } from './aggregate';
import * as fmt from '../../lib/format';
import { countOf } from '../../lib/text';
import { useDragSensors } from '../../lib/drag';
import { FormActions } from '../../components/dialogs/FormActions';

/** Image of a chart as exported. */
interface Capture {
  title: string;
  description: string;
  image: string;
}
/** How a chart is captured: colors, size it is drawn at (off screen), final image size. */
interface CaptureOptions {
  scheme: ExportScheme;
  /** Size to draw the chart at, off screen; as displayed when omitted. */
  render?: { width: number; height: number };
  /** Final image size, in pixels; the drawn size when omitted. */
  frame?: { width: number; height: number };
}
type Captures = MutableRefObject<Map<string, (options: CaptureOptions) => Promise<Capture>>>;

/** Chart drawn for printing: an A4 landscape page, below the title and description. */
const PRINT_SIZE = { width: 1120, height: 600 };

/**
 * Waits for a drawn chart in an element (its size is measured after a few frames).
 * @param {() => HTMLElement | null} element Element holding the chart.
 * @returns {Promise<HTMLElement>} Element, once its chart is drawn.
 */
function drawnChart(element: () => HTMLElement | null): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    const check = () => {
      const current = element();
      const svg = current?.querySelector('svg.recharts-surface');
      if (current && svg && svg.getBoundingClientRect().width > 0) resolve(current);
      else if (performance.now() - started > 3000) reject(new Error('Le diagramme n’a pas pu être préparé pour l’impression.'));
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

/** Title of a new chart of each source. */
/**
 * Stored configuration of a chart, or the defaults when it no longer validates.
 * @param {unknown} config Stored configuration.
 * @returns {ChartConfig} Configuration.
 */
function parseConfig(config: unknown): ChartConfig {
  const result = chartConfigSchema.safeParse(config);
  return result.success ? result.data : defaultChartConfig();
}

interface ChartCardProps {
  chart: DashboardChart;
  index: number;
  count: number;
  scope: ChartScope;
  context: TaskContext;
  /** Title of the dashboard, for the file names. */
  dashboardName: string;
  captures: Captures;
  onEdit: () => void;
}

/**
 * Chart of a dashboard, moved by its handle (drag and drop, or keyboard), with its actions: edit, duplicate,
 * width, order, move to another dashboard (general or
 * of a project), image and PDF exports, its data as CSV or PDF table, delete.
 * @param {ChartCardProps} props Component props.
 * @returns {JSX.Element} Card.
 */
function ChartCard({ chart, index, count, scope, context, dashboardName, captures, onEdit }: ChartCardProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: chart.id });
  const config = parseConfig(chart.config);
  const { data, isPending, error } = useChartData(config, scope, context);
  const { updateChart, duplicateChart, removeChart, moveChart } = useDashboardMutations();
  const view = useRef<HTMLDivElement>(null);
  const printView = useRef<HTMLDivElement>(null);
  // Drawn off screen at the size of an export while it is made.
  const [printSize, setPrintSize] = useState<{ width: number; height: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const description = describeChart(config, context);

  // The dashboard export asks every chart for its image.
  useEffect(() => {
    const registry = captures.current;
    registry.set(chart.id, async ({ scheme, render, frame }) => {
      if (!view.current || !data) throw new Error(`« ${chart.title} » n’est pas encore affiché.`);
      const legend = data.series.length > 1 ? data.series : [];
      if (!render) return { title: chart.title, description, image: await chartPng(view.current, chart.title, legend, { scheme, frame }) };
      if (data.empty) throw new Error(`« ${chart.title} » est vide.`);
      setPrintSize(render);
      try {
        const element = await drawnChart(() => printView.current);
        return { title: chart.title, description, image: await chartPng(element, chart.title, legend, { scheme, frame }) };
      } finally {
        setPrintSize(null);
      }
    });
    return () => void registry.delete(chart.id);
  }, [captures, chart.id, chart.title, data, description]);

  /**
   * Exports the chart as a PDF (light colors, page format), or asks the settings of an image (colors,
   * orientation, ratio, size) and exports it.
   * @param {'png' | 'pdf'} format Format.
   * @returns {void}
   */
  const exportChart = (format: 'png' | 'pdf') => {
    const capture = captures.current.get(chart.id);
    if (!capture) return;
    if (format === 'png') {
      openFormPanel(
        `Exporter « ${chart.title} » en image`,
        (close) => (
          <ImageExportForm
            onDone={close}
            onExport={(settings) => {
              const frame = { width: settings.width, height: settings.height };
              return capture({ scheme: settings.scheme, frame, render: chartSizeFor(frame, data && data.series.length > 1 ? data.series.length : 0) })
                .then((image) => download(image.image, fileName(`${dashboardName} — ${chart.title}`, 'png')))
                .catch((exportError: Error) => notifyError(exportError.message));
            }}
          />
        ),
        { panelId: `export-image-${chart.id}` },
      );
      return;
    }
    setExporting(true);
    capture({ scheme: 'light', render: PRINT_SIZE })
      .then((image) =>
        downloadChartsPdf({
          title: chart.title,
          subtitle: `${dashboardName} · exporté le ${fmt.exportDateTime(new Date())}`,
          charts: [image],
        }),
      )
      .catch((exportError: Error) => notifyError(exportError.message))
      .finally(() => setExporting(false));
  };

  /**
   * Asks for confirmation before deleting the chart.
   * @returns {void}
   */
  const confirmDelete = () => {
    confirmDestructive({
      title: 'Supprimer le diagramme',
      risks: (
        <>
          <Text size="sm">Le diagramme « {chart.title} » sera supprimé définitivement. Les données affichées ne sont pas modifiées.</Text>
        </>
      ),
      onConfirm: () => {
        removeChart.mutate(chart.id, {
          onSuccess: () => notifySuccess('Diagramme supprimé.'),
          onError: (deleteError) => notifyError(deleteError.message),
        });
      },
    });
  };

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      radius="md"
      p="md"
      shadow={isDragging ? 'md' : undefined}
      style={{
        gridColumn: chart.wide ? '1 / -1' : undefined,
        minWidth: 0,
        transform: CSS.Translate.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Tooltip label="Déplacer">
            <ActionIcon
              ref={setActivatorNodeRef}
              variant="subtle"
              color="gray"
              aria-label={`Déplacer ${chart.title}`}
              style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', flex: 'none' }}
              {...attributes}
              {...listeners}
            >
              <DotsSixVerticalIcon weight="bold" aria-hidden />
            </ActionIcon>
          </Tooltip>
          <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
            <Text fw={600} truncate>
              {chart.title}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {description}
              {data && ` · ${countLabel(config, data.taskCount)}`}
            </Text>
          </Stack>
          <Menu position="bottom-end" shadow="md" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label={`Actions sur ${chart.title}`} loading={exporting}>
                <DotsThreeIcon weight="bold" aria-hidden />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={onEdit}>
                Modifier
              </Menu.Item>
              <Menu.Item
                leftSection={<CopyIcon aria-hidden />}
                onClick={() =>
                  duplicateChart.mutate(chart.id, {
                    onError: (copyError) => notifyError(copyError.message),
                  })
                }
              >
                Dupliquer
              </Menu.Item>
              <Menu.Item
                leftSection={<ArrowsHorizontalIcon aria-hidden />}
                onClick={() =>
                  updateChart.mutate(
                    {
                      id: chart.id,
                      input: { title: chart.title, config, wide: !chart.wide },
                    },
                    {
                      onError: (widthError) => notifyError(widthError.message),
                    },
                  )
                }
              >
                {chart.wide ? 'Demi-largeur' : 'Pleine largeur'}
              </Menu.Item>
              <Menu.Item leftSection={<ArrowUpIcon aria-hidden />} disabled={index === 0} onClick={() => moveChart.mutate({ id: chart.id, index: index - 1 })}>
                Avancer
              </Menu.Item>
              <Menu.Item leftSection={<ArrowDownIcon aria-hidden />} disabled={index === count - 1} onClick={() => moveChart.mutate({ id: chart.id, index: index + 1 })}>
                Reculer
              </Menu.Item>
              <Menu.Item
                leftSection={<ArrowBendUpRightIcon aria-hidden />}
                onClick={() => {
                  openFormPanel(`Déplacer « ${chart.title} »`, (close) => <TransferChartForm chart={chart} projectId={scope.projectId} context={context} onDone={close} />, {
                    panelId: `transfer-chart-${chart.id}`,
                  });
                }}
              >
                Déplacer vers…
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<FileImageIcon aria-hidden />} disabled={!data || data.empty} onClick={() => exportChart('png')}>
                Exporter en image…
              </Menu.Item>
              <Menu.Item leftSection={<FilePdfIcon aria-hidden />} disabled={!data || data.empty} onClick={() => exportChart('pdf')}>
                Exporter en PDF
              </Menu.Item>
              <Menu.Item leftSection={<TableIcon aria-hidden />} disabled={!data || data.empty} onClick={() => data && downloadChartCsv(chartTable(data, config), `${dashboardName} — ${chart.title}`)}>
                Exporter les données (CSV)
              </Menu.Item>
              <Menu.Item
                leftSection={<TableIcon aria-hidden />}
                disabled={!data || data.empty}
                onClick={() => {
                  if (!data) return;
                  setExporting(true);
                  downloadChartTablePdf(chartTable(data, config), chart.title, `${dashboardName} · ${description}`)
                    .catch((exportError: Error) => notifyError(exportError.message))
                    .finally(() => setExporting(false));
                }}
              >
                Exporter les données (PDF)
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<TrashIcon aria-hidden />} color="red" onClick={confirmDelete}>
                Supprimer
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
        {error ? (
          <Alert color="red" icon={<ErrorIcon />}>
            {error.message}
          </Alert>
        ) : isPending || !data ? (
          <BlockSkeleton height={12} />
        ) : (
          <ChartView ref={view} config={config} data={data} height={288} />
        )}
        {printSize &&
          data &&
          createPortal(
            <div aria-hidden style={{ position: 'fixed', left: -printSize.width * 3, top: 0, width: printSize.width, pointerEvents: 'none' }}>
              <ChartView ref={printView} config={config} data={data} height={printSize.height} />
            </div>,
            document.body,
          )}
      </Stack>
    </Paper>
  );
}

interface DashboardBoardProps {
  /** Project whose tasks (sub-projects included) are charted, or null for every task. */
  projectId: string | null;
  /** What is charted ("Tous les projets", project title), for the exports. */
  title: string;
}

/**
 * Dashboards of a scope: tabs (created, renamed, reordered by drag and drop or from their menu, deleted), grid of charts on the tasks, chart editor,
 * exports of one chart (PNG, PDF) or of a whole dashboard (PDF).
 * @param {DashboardBoardProps} props Component props.
 * @returns {JSX.Element} Board.
 */
export function DashboardBoard({ projectId, title }: DashboardBoardProps) {
  const scope = useMemo<ChartScope>(() => ({ projectId }), [projectId]);
  const { context, isPending: contextPending } = useTaskContext();
  const { data: dashboards, isPending, error } = useDashboards(projectId);
  const mutations = useDashboardMutations();
  const captures: Captures = useRef(new Map());
  const [exporting, setExporting] = useState(false);
  const [current, select] = useTabParam('dashboard', dashboards);
  const sensors = useDragSensors('sortable');

  /**
   * Moves the dropped chart to its new place.
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!current || !over || active.id === over.id) return;
    const index = current.charts.findIndex((chart) => chart.id === over.id);
    if (index >= 0) mutations.moveChart.mutate({ id: String(active.id), index }, { onError: (moveError) => notifyError(moveError.message) });
  };

  /**
   * Asks for a dashboard name, then creates or renames it.
   * @param {Dashboard} [dashboard] Dashboard to rename. Optional.
   * @returns {void}
   */
  const askName = (dashboard?: Dashboard) => {
    let name = dashboard?.name ?? (dashboards?.length ? '' : 'KPI');
    /**
     * Saves the name typed, then closes the panel.
     * @param {() => void} close Closes the panel.
     * @returns {void}
     */
    const submit = (close: () => void) => {
      const result = dashboardNameSchema.safeParse(name);
      if (!result.success) {
        notifyError(result.error.issues[0]?.message ?? 'Nom invalide.');
        return;
      }
      close();
      if (dashboard) mutations.rename.mutate({ id: dashboard.id, name: result.data }, { onError: (renameError) => notifyError(renameError.message) });
      else
        mutations.create.mutate(
          { name: result.data, projectId },
          {
            onSuccess: (id) => select(id),
            onError: (createError) => notifyError(createError.message),
          },
        );
    };
    openFormPanel(dashboard ? 'Renommer le tableau de bord' : 'Nouveau tableau de bord', (close) => (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(close);
        }}
      >
        <Stack gap="md">
          <TextInput label="Nom" required data-autofocus defaultValue={name} placeholder="KPI, Sprint, Mensuel…" onChange={(event) => (name = event.currentTarget.value)} />
          <FormActions onCancel={close} submitLabel={dashboard ? 'Renommer' : 'Créer'} />
        </Stack>
      </form>
    ));
  };

  /**
   * Asks for confirmation before deleting a dashboard.
   * @param {Dashboard} dashboard Dashboard.
   * @returns {void}
   */
  const confirmDelete = (dashboard: Dashboard) => {
    confirmDestructive({
      title: 'Supprimer le tableau de bord',
      risks: (
        <>
          <Text size="sm">
            « {dashboard.name} » et ses {dashboard.charts.length} diagramme
            {dashboard.charts.length > 1 ? 's' : ''} seront supprimés définitivement. Les données affichées ne sont pas modifiées.
          </Text>
        </>
      ),
      onConfirm: () => {
        mutations.remove.mutate(dashboard.id, {
          onSuccess: () => notifySuccess('Tableau de bord supprimé.'),
          onError: (deleteError) => notifyError(deleteError.message),
        });
      },
    });
  };

  /**
   * Opens the chart editor, for a chart or a new chart of a source.
   * @param {DashboardChart} [chart] Chart to edit. Optional.
   * @param {ChartSource} [source] Source of a new chart. Optional. Default = tasks.
   * @returns {void}
   */
  const openEditor = (chart?: DashboardChart, source: ChartSource = 'tasks') => {
    if (!context || !current) return;
    openFormPanel(
      chart ? 'Modifier le diagramme' : 'Nouveau diagramme',
      (close) => (
        <ChartEditor
          dashboardId={current.id}
          chart={chart}
          initial={
            chart
              ? {
                  title: chart.title,
                  config: parseConfig(chart.config),
                  wide: chart.wide,
                }
              : {
                  title: NEW_CHART_TITLES[source],
                  config: defaultChartConfig(source),
                  wide: false,
                }
          }
          scope={scope}
          context={context}
          onDone={close}
        />
      ),
      { size: 'lg' },
    );
  };

  /**
   * Exports every chart of the dashboard in one PDF, one chart per page.
   * @returns {void}
   */
  const exportDashboard = () => {
    if (!current) return;
    setExporting(true);
    Promise.all(
      current.charts
        .map((chart) => captures.current.get(chart.id))
        .filter((capture) => capture !== undefined)
        .map((capture) => capture({ scheme: 'light', render: PRINT_SIZE })),
    )
      .then((charts) =>
        downloadChartsPdf({
          title: `${title} — ${current.name}`,
          subtitle: `${countOf(charts.length, 'diagramme')} · exporté le ${fmt.exportDateTime(new Date())}`,
          charts,
        }),
      )
      .catch((exportError: Error) => notifyError(exportError.message))
      .finally(() => setExporting(false));
  };

  if (error) {
    return (
      <Alert color="red" icon={<ErrorIcon />}>
        {error.message}
      </Alert>
    );
  }
  if (isPending || contextPending || !context) return <BlockSkeleton height={14} />;

  if (!dashboards?.length || !current) {
    return (
      <Stack gap="md">
        <ActionsRow>
          <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => askName()}>
            Nouveau tableau de bord
          </ActionButton>
        </ActionsRow>
        <EmptyState
          icon={<ChartBarIcon aria-hidden />}
          message="Aucun tableau de bord. Créez-en un pour suivre vos indicateurs : tâches fermées par semaine, vélocité par sprint, burndown, charge par assigné…"
        />
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <SortableTabs
          items={dashboards}
          value={current.id}
          onChange={select}
          onMove={(id, index) => mutations.move.mutate({ id, index }, { onError: onMutationError })}
          name={(dashboard) => dashboard.name}
          label={(dashboard) => dashboard.name}
          actions={(dashboard) => (
            <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => askName(dashboard)}>
              Renommer
            </Menu.Item>
          )}
          onDelete={confirmDelete}
          add={{ label: 'Nouveau tableau de bord', onClick: () => askName() }}
        />
        {/* The new chart at the far right. */}
        <Group gap="xs" ml="auto">
          <ActionButton priority="secondary" icon={<FilePdfIcon aria-hidden />} loading={exporting} disabled={current.charts.length === 0} onClick={exportDashboard}>
            Exporter en PDF
          </ActionButton>
          <ActionButton
            icon={<PlusIcon aria-hidden />}
            menu={[
              { label: 'Tâches', icon: <CheckSquareOffsetIcon aria-hidden />, onClick: () => openEditor(undefined, 'tasks') },
              { label: 'Facturation (devis, factures…)', icon: <ReceiptIcon aria-hidden />, onClick: () => openEditor(undefined, 'documents') },
              { label: 'Trésorerie', icon: <BankIcon aria-hidden />, onClick: () => openEditor(undefined, 'treasury') },
            ]}
          >
            Nouveau diagramme
          </ActionButton>
        </Group>
      </Group>

      {current.charts.length === 0 ? (
        <EmptyState icon={<ChartBarIcon aria-hidden />} message="Ce tableau de bord n’a pas encore de diagramme." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={current.charts.map((chart) => chart.id)} strategy={rectSortingStrategy}>
            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              {current.charts.map((chart, chartIndex) => (
                <ChartCard
                  key={chart.id}
                  chart={chart}
                  index={chartIndex}
                  count={current.charts.length}
                  scope={scope}
                  context={context}
                  dashboardName={`${title} — ${current.name}`}
                  captures={captures}
                  onEdit={() => openEditor(chart)}
                />
              ))}
            </SimpleGrid>
          </SortableContext>
        </DndContext>
      )}
    </Stack>
  );
}
