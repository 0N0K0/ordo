import { ActionIcon, Alert, Button, Group, Menu, Paper, SimpleGrid, Skeleton, Stack, Tabs, Text, TextInput, ThemeIcon, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { chartConfigSchema, dashboardNameSchema, defaultChartConfig, type ChartConfig, type ChartSource, type FilterGroup } from '@ordo/shared';
import {
  ArrowBendUpRightIcon,
  ArrowDownIcon,
  ArrowsHorizontalIcon,
  ArrowUpIcon,
  BankIcon,
  CaretDownIcon,
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
  TrashIcon,
} from '@phosphor-icons/react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useSearchParams } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useTaskContext, type TaskContext } from '../tasks/use-task-context';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useDashboardMutations, useDashboards, type Dashboard, type DashboardChart } from './api';
import { ChartEditor } from './ChartEditor';
import { chartPng, downloadChartsPdf, exportFileName, saveFile } from './chart-image';
import { describeChart, useChartData, type ChartScope } from './chart-data';
import { ChartView } from './ChartView';
import { TransferChartForm } from './TransferChartForm';
import { countLabel, NEW_CHART_TITLES } from './aggregate';

/** Image of a chart as exported. */
interface Capture {
  title: string;
  description: string;
  image: string;
}
type Captures = MutableRefObject<Map<string, () => Promise<Capture>>>;

let modalCount = 0;

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
 * of a project), image and PDF exports, delete.
 * @param {ChartCardProps} props Component props.
 * @returns {JSX.Element} Card.
 */
function ChartCard({ chart, index, count, scope, context, dashboardName, captures, onEdit }: ChartCardProps) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: chart.id });
  const config = parseConfig(chart.config);
  const { data, isPending, error } = useChartData(config, scope, context);
  const { updateChart, duplicateChart, removeChart, moveChart } = useDashboardMutations();
  const view = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const description = describeChart(config, context);

  // The dashboard export asks every chart for its image.
  useEffect(() => {
    const registry = captures.current;
    registry.set(chart.id, async () => {
      if (!view.current || !data) throw new Error(`« ${chart.title} » n’est pas encore affiché.`);
      return {
        title: chart.title,
        description,
        image: await chartPng(view.current, chart.title, data.series.length > 1 ? data.series : []),
      };
    });
    return () => void registry.delete(chart.id);
  }, [captures, chart.id, chart.title, data, description]);

  /**
   * Exports the chart as an image or a PDF.
   * @param {'png' | 'pdf'} format Format.
   * @returns {void}
   */
  const exportChart = (format: 'png' | 'pdf') => {
    const capture = captures.current.get(chart.id);
    if (!capture) return;
    setExporting(true);
    capture()
      .then((image) =>
        format === 'png'
          ? saveFile(image.image, exportFileName(`${dashboardName} — ${chart.title}`, 'png'))
          : downloadChartsPdf({
              title: chart.title,
              subtitle: `${dashboardName} · exporté le ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`,
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
    const modalId = `delete-chart-${chart.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le diagramme',
      children: (
        <Stack gap="md">
          <Text size="sm">Le diagramme « {chart.title} » sera supprimé définitivement. Les données affichées ne sont pas modifiées.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              removeChart.mutate(chart.id, {
                onSuccess: () => notifySuccess('Diagramme supprimé.'),
                onError: (deleteError) => notifyError(deleteError.message),
              });
            }}
          />
        </Stack>
      ),
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
                  const modalId = `transfer-chart-${chart.id}`;
                  modals.open({
                    modalId,
                    title: `Déplacer « ${chart.title} »`,
                    children: <TransferChartForm chart={chart} projectId={scope.projectId} context={context} onDone={() => modals.close(modalId)} />,
                  });
                }}
              >
                Déplacer vers…
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<FileImageIcon aria-hidden />} disabled={!data || data.empty} onClick={() => exportChart('png')}>
                Exporter en image (PNG)
              </Menu.Item>
              <Menu.Item leftSection={<FilePdfIcon aria-hidden />} disabled={!data || data.empty} onClick={() => exportChart('pdf')}>
                Exporter en PDF
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
          <Skeleton height={280} />
        ) : (
          <ChartView ref={view} config={config} data={data} height={280} />
        )}
      </Stack>
    </Paper>
  );
}

interface DashboardBoardProps {
  /** Project whose tasks (sub-projects included) are charted, or null for every task. */
  projectId: string | null;
  baseFilter: FilterGroup | null;
  /** What is charted ("Tous les projets", project title), for the exports. */
  title: string;
}

/**
 * Dashboards of a scope: tabs (created, renamed, reordered, deleted), grid of charts on the tasks, chart editor,
 * exports of one chart (PNG, PDF) or of a whole dashboard (PDF).
 * @param {DashboardBoardProps} props Component props.
 * @returns {JSX.Element} Board.
 */
export function DashboardBoard({ projectId, baseFilter, title }: DashboardBoardProps) {
  const scope = useMemo<ChartScope>(() => ({ baseFilter, projectId }), [baseFilter, projectId]);
  const { context, isPending: contextPending } = useTaskContext();
  const { data: dashboards, isPending, error } = useDashboards(projectId);
  const mutations = useDashboardMutations();
  const [params, setParams] = useSearchParams();
  const captures: Captures = useRef(new Map());
  const [exporting, setExporting] = useState(false);
  const current: Dashboard | undefined = dashboards?.find((item) => item.id === params.get('dashboard')) ?? dashboards?.[0];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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
   * Opens a dashboard (kept in the URL).
   * @param {string} id Dashboard id.
   * @returns {void}
   */
  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('dashboard', id);
    setParams(next, { replace: true });
  };

  /**
   * Asks for a dashboard name, then creates or renames it.
   * @param {Dashboard} [dashboard] Dashboard to rename. Optional.
   * @returns {void}
   */
  const askName = (dashboard?: Dashboard) => {
    const modalId = `dashboard-name-${++modalCount}`;
    let name = dashboard?.name ?? (dashboards?.length ? '' : 'KPI');
    const submit = () => {
      const result = dashboardNameSchema.safeParse(name);
      if (!result.success) {
        notifyError(result.error.issues[0]?.message ?? 'Nom invalide.');
        return;
      }
      modals.close(modalId);
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
    modals.open({
      modalId,
      title: dashboard ? 'Renommer le tableau de bord' : 'Nouveau tableau de bord',
      children: (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Stack gap="md">
            <TextInput label="Nom" required data-autofocus defaultValue={name} placeholder="KPI, Sprint, Mensuel…" onChange={(event) => (name = event.currentTarget.value)} />
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => modals.close(modalId)}>
                Annuler
              </Button>
              <Button type="submit">{dashboard ? 'Renommer' : 'Créer'}</Button>
            </Group>
          </Stack>
        </form>
      ),
    });
  };

  /**
   * Asks for confirmation before deleting a dashboard.
   * @param {Dashboard} dashboard Dashboard.
   * @returns {void}
   */
  const confirmDelete = (dashboard: Dashboard) => {
    const modalId = `delete-dashboard-${dashboard.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le tableau de bord',
      children: (
        <Stack gap="md">
          <Text size="sm">
            « {dashboard.name} » et ses {dashboard.charts.length} diagramme
            {dashboard.charts.length > 1 ? 's' : ''} seront supprimés définitivement. Les données affichées ne sont pas modifiées.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              mutations.remove.mutate(dashboard.id, {
                onSuccess: () => notifySuccess('Tableau de bord supprimé.'),
                onError: (deleteError) => notifyError(deleteError.message),
              });
            }}
          />
        </Stack>
      ),
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
    const modalId = `chart-${++modalCount}`;
    modals.open({
      modalId,
      title: chart ? 'Modifier le diagramme' : 'Nouveau diagramme',
      size: '90rem',
      children: (
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
          onDone={() => modals.close(modalId)}
        />
      ),
    });
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
        .map((capture) => capture()),
    )
      .then((charts) =>
        downloadChartsPdf({
          title: `${title} — ${current.name}`,
          subtitle: `${charts.length} diagramme${charts.length > 1 ? 's' : ''} · exporté le ${new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`,
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
  if (isPending || contextPending || !context) return <Skeleton height={320} />;

  if (!dashboards?.length || !current) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Stack align="center" gap="sm">
          <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
            <ChartBarIcon aria-hidden />
          </ThemeIcon>
          <Text size="sm" c="dimmed" ta="center">
            Aucun tableau de bord. Créez-en un pour suivre vos indicateurs : tâches fermées par semaine, vélocité par sprint, burndown, charge par assigné…
          </Text>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => askName()}>
            Créer un tableau de bord
          </Button>
        </Stack>
      </Paper>
    );
  }

  const index = dashboards.findIndex((item) => item.id === current.id);
  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Tabs value={current.id} onChange={(id) => id && select(id)}>
          <Tabs.List>
            {dashboards.map((dashboard) => (
              <Tabs.Tab key={dashboard.id} value={dashboard.id}>
                {dashboard.name}
              </Tabs.Tab>
            ))}
            <Tooltip label="Nouveau tableau de bord">
              <ActionIcon variant="subtle" color="gray" aria-label="Nouveau tableau de bord" onClick={() => askName()} style={{ alignSelf: 'center' }}>
                <PlusIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Tabs.List>
        </Tabs>
        <Group gap="xs">
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <Button leftSection={<PlusIcon aria-hidden />} rightSection={<CaretDownIcon aria-hidden />}>
                Nouveau diagramme
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<CheckSquareOffsetIcon aria-hidden />} onClick={() => openEditor(undefined, 'tasks')}>
                Tâches
              </Menu.Item>
              <Menu.Item leftSection={<ReceiptIcon aria-hidden />} onClick={() => openEditor(undefined, 'documents')}>
                Facturation (devis, factures…)
              </Menu.Item>
              <Menu.Item leftSection={<BankIcon aria-hidden />} onClick={() => openEditor(undefined, 'treasury')}>
                Trésorerie
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button variant="default" leftSection={<FilePdfIcon aria-hidden />} loading={exporting} disabled={current.charts.length === 0} onClick={exportDashboard}>
            Exporter en PDF
          </Button>
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon variant="default" size="lg" aria-label={`Actions sur ${current.name}`}>
                <DotsThreeIcon weight="bold" aria-hidden />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => askName(current)}>
                Renommer
              </Menu.Item>
              <Menu.Item leftSection={<ArrowUpIcon aria-hidden />} disabled={index === 0} onClick={() => mutations.move.mutate({ id: current.id, index: index - 1 })}>
                Déplacer avant
              </Menu.Item>
              <Menu.Item leftSection={<ArrowDownIcon aria-hidden />} disabled={index === dashboards.length - 1} onClick={() => mutations.move.mutate({ id: current.id, index: index + 1 })}>
                Déplacer après
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<TrashIcon aria-hidden />} color="red" onClick={() => confirmDelete(current)}>
                Supprimer
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      {current.charts.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <ChartBarIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Ce tableau de bord n’a pas encore de diagramme.
            </Text>
            <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openEditor()}>
              Ajouter un diagramme
            </Button>
          </Stack>
        </Paper>
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
