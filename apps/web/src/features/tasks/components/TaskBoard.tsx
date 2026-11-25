import { useSearchParam } from '../../../lib/search-params';
import { readOnlyCells } from '../../../components/data-table/table/data-table';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { Group, Select, Switch, Text, Tooltip } from '@mantine/core';
import { addDays, DATE_PERIOD_LABELS, EVENT_PERIODS, type EventPeriod, filterPeriod, TASK_GROUP_BY, type TaskGroupBy } from '@ordo/shared';
import { AlarmIcon, CheckSquareOffsetIcon, GithubLogoIcon, PencilSimpleIcon, PlusIcon, TreeViewIcon } from '@phosphor-icons/react';
import { useMemo, type ReactNode } from 'react';

import { DataTable, type RowMove } from '../../../components/data-table/table/DataTable';
import { RowActions } from '../../../components/data-table/cells/RowActions';
import { useDataView, useTableViews, type FirstTableView, conditionFilter } from '../../../components/data-table/views/use-data-view';
import { parisToday } from '../../../lib/dates';
import { ON_ERROR } from '../../../lib/notify';
import * as fmt from '../../../lib/format';
import { currentWeek } from '../../../lib/week';
import { useTaskAlarmCounts } from '../../alarms/api';
import { useCalendarEvents } from '../../calendar/api';
import { useCommentCounts } from '../../comments/api';
import { commentTotal } from '../../comments/lib/comment-column';
import { useShoppingLists } from '../../shopping/api';
import { useBulkTaskMutations, useMoveTask, useTasksData, type BulkChanges, type Task } from '../api';
import { eventRowKey, viewUses, isArchivedTaskRow, taskTableRows, type TaskTableRow } from '../lib/task-columns';
import { useTaskColumns } from '../hooks/use-task-columns';
import { TaskStateIcon } from './task-ui';
import { useTaskActions } from '../hooks/use-task-actions';
import { taskName, useTaskContext } from '../hooks/use-task-context';
import { TASK_PARAM, useTaskLink } from '../hooks/use-task-link';
import { useTaskSelectionActions } from './BulkBar';
import { EventBeneficiariesCell, EventPeopleCell, EventStatusCell, EventTimeCell, EventLabelCell, EventWhenCell } from './event-cells';
import { AlarmsCell, ProgressCell, ShoppingCell, SlotsCell, SubtasksCell, TimerCell, TrackedCell } from './extra-cells';
import {
  AssigneesCell,
  BlockedByCell,
  DateCell,
  EffortCell,
  LabelCell,
  MilestoneCell,
  ParentCell,
  SprintCell,
  TagsCell,
  TaskBeneficiariesCell,
  TaskLinksCell,
  TaskHoursCell,
  TaskLocationCell,
  TaskProjectCell,
  TaskLabelCell,
} from './inline-cells';
import { groupDefaults } from '../lib/new-task-defaults';
import { AddTaskRow } from './table-extras';
import classes from './TaskTable.module.css';
import { countOf, plural } from '../../../lib/text';
import { CommentCount } from '../../comments/components/CommentCount';
import { isTaskOverdue } from '../lib/task-overdue';
import { inheritedCells } from '../../../components/inheritance/inherited-cells';
import { LocationText } from '../../geo/components/LocationText';
import { TASK_CELL_FIELDS, taskParentName } from '../lib/task-inheritance';

/** Periods of the events listed with the tasks. */
const EVENT_PERIOD_LABELS: Record<EventPeriod, string> = {
  thisWeek: DATE_PERIOD_LABELS.thisWeek,
  nextWeek: DATE_PERIOD_LABELS.nextWeek,
  thisMonth: DATE_PERIOD_LABELS.thisMonth,
  nextMonth: DATE_PERIOD_LABELS.nextMonth,
  'next:7': '7 prochains jours',
  'next:30': '30 prochains jours',
  'next:90': '90 prochains jours',
  'past:30': '30 derniers jours',
};

/** Views made the first time: the open tasks, mine, all. */
const TASK_VIEWS: FirstTableView[] = [
  { label: 'En cours', config: { filter: conditionFilter('closed', 'isFalse', null, 'open') } },
  {
    label: 'Mes tâches',
    config: {
      filter: {
        type: 'group',
        id: 'root',
        combinator: 'and',
        children: [
          { type: 'condition', id: 'mine', field: 'assignees', operator: 'anyOf', value: ['me'] },
          { type: 'condition', id: 'open', field: 'closed', operator: 'isFalse', value: null },
        ],
      },
    },
  },
  { label: 'Toutes' },
];

interface TaskBoardProps {
  /** Project whose views these are (its tasks and those of its sub-projects), or null for the tasks page. */
  projectId: string | null;
  /** Projects whose tasks are listed (a project and its sub-projects); none: every task. Optional. */
  projectIds?: ReadonlySet<string>;
  /** Preselected project of new tasks. */
  createProjectId?: string;
  /** Controls shown before the view tabs. */
  header?: ReactNode;
  emptyMessage: string;
  /** What the list is, for the title of exports. */
  title: string;
  /** Days of the events listed, instead of the period chosen in the view. Dates included. Optional. */
  eventRange?: { from: string; to: string };
}

/**
 * Tasks of a scope, the data table of every table: tabs of views (« En cours », « Mes tâches », « Toutes » made at
 * first), each with its search, filters, sorts, groups and columns; sub-tasks under their parent, each field changed in
 * place (or on a selection of cells, or on the tasks checked), moved by drag and drop (to another place, level or
 * group), a row adding one at the end of the table and of each group; the calendar events of a period listed with them
 * when the view shows them.
 * @param {TaskBoardProps} props Component props.
 * @returns {JSX.Element} Board.
 */
export function TaskBoard({ projectId, projectIds, createProjectId, header, emptyMessage, title, eventRange }: TaskBoardProps) {
  const { context, isPending, error } = useTaskContext();
  const { isPending: tasksPending } = useTasksData();
  const taskActions = useTaskActions(context);
  const taskLink = useTaskLink();
  const moveTask = useMoveTask();
  const { update: bulkUpdate } = useBulkTaskMutations();
  const selectionActions = useTaskSelectionActions(context);
  const alarmCounts = useTaskAlarmCounts();
  const { data: shoppingLists } = useShoppingLists();
  const [openId] = useSearchParam(TASK_PARAM);
  const today = parisToday();
  const tasks = useMemo(
    () => taskTableRows((context?.tasks ?? []).filter((task) => !projectIds || (task.projectId && projectIds.has(task.projectId)))),
    [context, projectIds],
  );

  // Events of a period, listed with the tasks when the view shows them (its option).
  const views = useTableViews({ tableKey: 'tasks', projectId, first: TASK_VIEWS });
  const showEvents = views.config?.options.events === true;
  const period = (views.config?.options.eventPeriod as EventPeriod | undefined) ?? 'next:30';
  const range = useMemo(() => {
    if (!showEvents) return null;
    if (eventRange) return eventRange;
    const [from, end] = filterPeriod(period, today, currentWeek());
    return { from, to: addDays(end, -1) };
  }, [showEvents, eventRange, period, today]);
  const periodEvents = useCalendarEvents(range);
  const eventRows = useMemo(
    () =>
      (periodEvents.data ?? [])
        .filter((event) => !projectIds || (event.projectId && projectIds.has(event.projectId)))
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((event): TaskTableRow => ({ kind: 'event', key: eventRowKey(event), event })),
    [periodEvents.data, projectIds],
  );
  const eventComments = useCommentCounts(
    'EVENT',
    eventRows.map((row) => (row.kind === 'event' ? row.event.key : '')),
  );
  const columns = useTaskColumns(context, today, { doable: viewUses(views.config, 'doableNow'), eventComments });
  const rows = useMemo(() => (showEvents ? [...tasks, ...eventRows] : tasks), [showEvents, tasks, eventRows]);
  const view = useDataView({
    tableKey: 'tasks',
    projectId,
    columns,
    rows,
    title,
    views,
    getKey: (row) => row.key,
    archived: isArchivedTaskRow,
    archivedLabel: 'Afficher les archivées',
  });
  /**
   * Saves a task dragged to another place or level (before the task now following it, under its new parent), or into
   * another group (its status, priority, type, milestone, an assignee, a tag or a sprint replaced by the group's).
   * @param {RowMove} drop Drop.
   * @returns {void}
   */
  const handleMove = ({ key, beforeKey, parentKey, groupKey, fromGroupKey }: RowMove) => {
    const task = context?.taskById.get(key);
    // An archived task is read only: not moved.
    if (!task || task.archived) return;
    const column = view.groupColumn?.id;
    if (groupKey !== undefined && column) {
      const to = groupKey || null;
      const from = fromGroupKey || null;
      const changes: BulkChanges | null =
        column === 'status'
          ? { statusId: to }
          : column === 'priority'
            ? { priorityId: to }
            : column === 'type'
              ? { typeId: to }
              : column === 'milestone'
                ? { milestoneId: to }
                : column === 'assignees'
                  ? { addAssigneeIds: to ? [to] : [], removeAssigneeIds: from ? [from] : task.assigneeIds }
                  : column === 'tags'
                    ? { addTagIds: to ? [to] : [], removeTagIds: from ? [from] : task.tagIds }
                    : column === 'sprint'
                      ? { addSprintIds: to ? [to] : [], removeSprintIds: from ? [from] : task.sprintIds }
                      : null;
      if (changes) bulkUpdate.mutate({ ids: [task.id], changes }, ON_ERROR);
      return;
    }
    const before = beforeKey ? context?.taskById.get(beforeKey) : undefined;
    moveTask.mutate({ id: task.id, beforeId: before?.id ?? null, ...(parentKey !== undefined && { parentId: parentKey }) }, ON_ERROR);
  };

  /**
   * Cells of a task, each edited in place.
   * @param {Task} task Task.
   * @param {Record<string, ReactNode>} texts Read-only cells of its columns.
   * @returns {Record<string, ReactNode>} Cells, by column.
   */
  const taskCells = (task: Task, texts: Record<string, ReactNode>): Record<string, ReactNode> => {
    if (!context) return texts;
    return {
      ...texts,
      label: (
        <TaskLabelCell
          task={task}
          context={context}
          prefix={
            <>
              <TaskStateIcon closed={task.closed} cancelled={task.cancelled} blocked={context.isBlocked(task)} />
              {task.githubLinked && (
                <Tooltip label={task.githubNumber ? `Synchronisée avec l’issue GitHub #${task.githubNumber}` : 'Synchronisée avec un brouillon GitHub'}>
                  <GithubLogoIcon aria-label="GitHub" className={classes.recurring} />
                </Tooltip>
              )}
              {alarmCounts.has(task.id) && (
                <Tooltip label={`${countOf(alarmCounts.get(task.id) ?? 0, 'alarme')} ${plural(alarmCounts.get(task.id) ?? 0, 'active')}`}>
                  <AlarmIcon aria-label="Alarmes" className={classes.recurring} />
                </Tooltip>
              )}
            </>
          }
        />
      ),
      project: <TaskProjectCell task={task} context={context} />,
      status: <LabelCell task={task} column="status" labels={context.statuses} />,
      priority: <LabelCell task={task} column="priority" labels={context.priorities} />,
      type: <LabelCell task={task} column="type" labels={context.types} />,
      assignees: <AssigneesCell task={task} context={context} />,
      beneficiaries: <TaskBeneficiariesCell task={task} />,
      tags: <TagsCell task={task} context={context} />,
      effort: <EffortCell task={task} />,
      trackedTime: <TrackedCell task={task} />,
      minDate: <DateCell task={task} column="minDate" />,
      slots: <SlotsCell task={task} />,
      hours: <TaskHoursCell task={task} />,
      location: <TaskLocationCell task={task} />,
      timer: <TimerCell task={task} />,
      subtasks: <SubtasksCell task={task} context={context} onAdd={() => taskActions.create({ parentId: task.id, projectId: task.projectId ?? undefined })} />,
      progress: <ProgressCell task={task} context={context} />,
      alarms: <AlarmsCell task={task} context={context} count={alarmCounts.get(task.id) ?? 0} />,
      shopping: <ShoppingCell task={task} lists={shoppingLists ?? []} />,
      startDate: <DateCell task={task} column="startDate" />,
      endDate: <DateCell task={task} column="endDate" />,
      deadline: <DateCell task={task} column="deadline" alert={isTaskOverdue(task, today)} />,
      parent: <ParentCell task={task} context={context} />,
      milestone: <MilestoneCell task={task} context={context} />,
      sprint: <SprintCell task={task} context={context} />,
      blockedBy: <BlockedByCell task={task} context={context} />,
      blocking: <TaskLinksCell task={task} context={context} kind="blocking" />,
      related: <TaskLinksCell task={task} context={context} kind="related" />,
      comments: <CommentCount count={commentTotal(task.commentCount, task.description)} />,
    };
  };

  /**
   * Cells of a task, each edited in place; of an event, what it has.
   * @param {TaskTableRow} row Row.
   * @returns {Record<string, ReactNode>} Cells, by column.
   */
  const cells = (row: TaskTableRow): Record<string, ReactNode> => {
    if (!context) return {};
    const texts = readOnlyCells(columns, row);
    if (row.kind === 'event') {
      const event = row.event;
      return {
        ...texts,
        comments: <CommentCount count={commentTotal(eventComments.get(event.key), event.description)} />,
        label: <EventLabelCell event={event} context={context} />,
        assignees: <EventPeopleCell event={event} context={context} />,
        beneficiaries: <EventBeneficiariesCell event={event} />,
        status: <EventStatusCell event={event} />,
        trackedTime: <EventTimeCell event={event} />,
        startDate: <EventWhenCell event={event} side="start" />,
        endDate: <EventWhenCell event={event} side="end" />,
        location: <LocationText location={event.location} />,
      };
    }
    const task = row.task;
    // Its inherited fields greyed with their mention.
    return inheritedCells(taskCells(task, texts), task, TASK_CELL_FIELDS, taskParentName(task, context.taskById));
  };

  const config = view.config;
  // The group a new task goes in gives it its value (status, assignee…).
  const groupBy = view.groupColumn && (TASK_GROUP_BY as readonly string[]).includes(view.groupColumn.id) ? (view.groupColumn.id as TaskGroupBy) : null;

  return (
    <>
      {(error ?? view.views.error) && <ErrorAlert mb="sm">{(error ?? view.views.error)?.message}</ErrorAlert>}
      <DataTable
        view={view}
        getKey={(row) => row.key}
        loading={isPending || tasksPending || !context}
        framed
        verticalSpacing={4}
        bar={{
          searchLabel: 'Rechercher (libellé, numéro, description)',
          manualText: 'Sans tri : l’ordre choisi à la main (glissez les tâches), sous-tâches sous leur parent.',
          actions: (
            <Group gap="sm" wrap="nowrap">
              {header}
              <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => taskActions.create(createProjectId ? { projectId: createProjectId } : undefined)}>
                Nouvelle tâche
              </ActionButton>
            </Group>
          ),
          displayOptions: config && (
            <>
              <Switch
                label="Afficher les évènements"
                checked={showEvents}
                onChange={(event) => {
                  const events = event.currentTarget.checked;
                  view.change((current) => ({ ...current, options: { ...current.options, events } }));
                }}
              />
              {showEvents && !eventRange && (
                <Select
                  label="Période des évènements"
                  data={EVENT_PERIODS.map((value) => ({ value, label: EVENT_PERIOD_LABELS[value] }))}
                  value={period}
                  allowDeselect={false}
                  comboboxProps={{ withinPortal: false }}
                  onChange={(eventPeriod) => eventPeriod && view.change((current) => ({ ...current, options: { ...current.options, eventPeriod } }))}
                />
              )}
              {showEvents && range && (
                <Text size="xs" c="dimmed">
                  Du {fmt.dayShort(range.from)} au {fmt.dayShort(range.to)}
                </Text>
              )}
            </>
          ),
        }}
        empty={<EmptyState icon={<CheckSquareOffsetIcon aria-hidden />} message={emptyMessage} />}
        parentKey={(row) => (row.kind === 'task' ? (row.task.parentId ?? null) : null)}
        onMoveRow={handleMove}
        readOnly={(row) => row.kind === 'event'}
        isActive={(row) => row.kind === 'task' && row.task.id === openId}
        isArchived={(row) => row.kind === 'task' && row.task.archived}
        isDone={(row) => row.kind === 'task' && row.task.closed}
        isStruck={(row) => row.kind === 'task' && row.task.cancelled}
        cells={cells}
        actions={(row) =>
          row.kind === 'task' && (
            <RowActions
              about={`la tâche ${taskName(row.task)}`}
              primary={!row.task.archived && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => taskLink.open(row.task.id) }}
              items={[
                // An archived task is read only: no sub-task added under it.
                ...(row.task.archived
                  ? []
                  : [
                      { label: 'Ajouter une sous-tâche', icon: <TreeViewIcon aria-hidden />, onClick: () => taskActions.create({ projectId: row.task.projectId ?? undefined, parentId: row.task.id }) },
                      'divider' as const,
                    ]),
                ...taskActions.menu(row.task),
              ]}
            />
          )
        }
        addRow={
          context
            ? (group) => (
                <AddTaskRow
                  context={context}
                  defaults={group && groupBy ? groupDefaults(groupBy, group.key || 'none', context) : {}}
                  projectId={createProjectId}
                  onOpenForm={(defaults) => taskActions.create({ projectId: defaults.projectId, parentId: defaults.parentId ?? undefined })}
                />
              )
            : undefined
        }
        selectionLabel={(count) => `${countOf(count, 'tâche')} ${plural(count, 'sélectionnée')}`}
        selectionActions={(checked, clear) =>
          selectionActions(
            checked.flatMap((row): Task[] => (row.kind === 'task' ? [row.task] : [])),
            clear,
          )
        }
      />
    </>
  );
}
