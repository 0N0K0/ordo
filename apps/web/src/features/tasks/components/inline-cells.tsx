import { Select, Text, UnstyledButton } from '@mantine/core';
import { ArrowsLeftRightIcon } from '@phosphor-icons/react';
import { removedLinksNote } from '../../../lib/text';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { listSelectProps } from '../../../components/items/item-look';
import { DateField } from '../../../components/inputs/DateField';
import { readTaskHours, taskLabelSchema, type TaskColumn, subtreeOf } from '@ordo/shared';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ON_ERROR, toastCallbacks } from '../../../lib/notify';
import { useBulkTaskMutations, useTaskBlock, useTaskRelation, type Task, type TaskLabel } from '../api';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { TaskSelect } from './task-ui';

import { hasTreeLinks, inProjectTree, linkableTasks } from '../lib/task-links';
import { closedMark, type TaskContext, taskName, taskNumber } from '../hooks/use-task-context';
import { useTaskLink } from '../hooks/use-task-link';
import { useCellEdit } from '../lib/cell-edit';
import { listDiff } from '../../../components/data-table/selection/bulk-edit';

import { BeneficiariesCell } from '../../beneficiaries/components/BeneficiariesSelect';
import { stoppedCellCombobox, stoppedCellField, cellLabel, itemCellLabel, cellPicker, stopClick } from '../../../components/data-table/cells/cell-field';
import { EditableMultiSelect, EditableNumber } from '../../../components/data-table/cells/EditableCells';
import { EditableLabel } from '../../../components/data-table/cells/EditableLabel';
import { AssigneesCell as SharedAssigneesCell, ProjectCell as SharedProjectCell } from './context-cells';
import { DependencyIcon } from '../../../components/data-table/cells/DependencyIcon';
import { ChipChoiceCell } from '../../../components/data-table/cells/ChipChoiceCell';
import { dateRangeProps } from '../../../components/inputs/date-range';
import { beneficiariesDiff } from '../../beneficiaries/lib/beneficiaries-diff';
import { LATE_COLOR } from '../../../components/feedback/feedback-colors';
import { inheritedDateHint } from '../lib/inherited-dates';
import { LocationCell } from '../../geo/components/LocationCell';
import { localToday } from '../../../lib/dates';
import { taskHoursLines } from '../lib/task-hours-text';
import { StackedLines } from '../../../components/data-table/cells/StackedValues';
import { tasksLabel } from '../lib/bulk-label';
import { TaskHoursModal } from './TaskHoursField';

/**
 * Accessible label of a cell field, mentioning the bulk edit.
 * @param {string} name Field name.
 * @param {Task} task Task.
 * @param {number} count Number of tasks the edit applies to.
 * @returns {string} Label.
 */
function fieldLabel(name: string, task: Task, count: number): string {
  return itemCellLabel(name, `la tâche ${taskName(task)}`, count);
}

/**
 * Title cell: clicking "#12 Title" opens the task; double-clicking elsewhere in the cell renames it in place (not an
 * archived task: every cell of an archived task is read only).
 * @param {{ task: Task, context: TaskContext, prefix?: ReactNode }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TaskLabelCell({ task, context, prefix }: { task: Task; context: TaskContext; prefix?: ReactNode }) {
  const link = useTaskLink();
  const { apply } = useCellEdit(task, 'label');
  const children = context.childrenOf(task.id);
  return (
    <EditableLabel
      value={task.label}
      label={fieldLabel('Libellé', task, 1)}
      schema={taskLabelSchema}
      to={link.to(task.id)}
      before={
        <>
          {prefix}
          <Text component={Link} to={link.to(task.id)} size="sm" c="dimmed" onClick={stopClick} style={{ flex: 'none' }}>
            {taskNumber(task)}
          </Text>
        </>
      }
      after={
        children.length > 0 && (
          <Text size="xs" c="dimmed" style={{ flex: 'none' }}>
            {children.filter((child) => context.isClosed(child)).length}/{children.length}
          </Text>
        )
      }
      readOnly={task.archived}
      onSave={(label) => apply({ label })}
    />
  );
}

interface LabelCellProps {
  task: Task;
  column: Extract<TaskColumn, 'status' | 'priority' | 'type'>;
  labels: TaskLabel[];
}

const LABEL_FIELDS = { status: 'statusId', priority: 'priorityId', type: 'typeId' } as const;
const LABEL_NAMES = { status: 'Statut', priority: 'Priorité', type: 'Type' } as const;

/**
 * Status, priority or type cell: a colored chip; clicking the cell opens the list of chips (`ChipChoiceCell`).
 * Choosing the current value again clears it.
 * @param {LabelCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function LabelCell({ task, column, labels }: LabelCellProps) {
  const { apply, count } = useCellEdit(task, column);
  const field = LABEL_FIELDS[column];
  // An archived task is read only: its chip only.
  return (
    <ChipChoiceCell
      value={task[field]}
      items={labels}
      label={fieldLabel(LABEL_NAMES[column], task, count)}
      readOnly={task.archived}
      onChoose={(value) => apply({ [field]: value }, { [field]: value })}
    />
  );
}

/**
 * Milestone cell: select among the milestones of the task's project tree.
 * @param {{ task: Task, context: TaskContext }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function MilestoneCell({ task, context }: { task: Task; context: TaskContext }) {
  const { apply, count } = useCellEdit(task, 'milestone');
  return (
    <Select
      {...stoppedCellCombobox}
      aria-label={fieldLabel('Jalon', task, count)}
      data={context.milestonesFor(task.projectId, task.milestoneId).map((milestone) => ({ value: milestone.id, label: context.milestoneLabel(milestone) }))}
      value={task.milestoneId}
      onChange={(milestoneId) => apply({ milestoneId }, { milestoneId })}
      placeholder={task.archived ? undefined : '—'}
      readOnly={task.archived}
      nothingFoundMessage="Aucun jalon dans ce projet"
    />
  );
}

/**
 * Tags cell: multi-select. On a column selection, adding a tag adds it to every selected task and removing
 * one removes it.
 * @param {{ task: Task, context: TaskContext }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TagsCell({ task, context }: { task: Task; context: TaskContext }) {
  const { apply, count } = useCellEdit(task, 'tags');
  return (
    <EditableMultiSelect
      label={fieldLabel('Étiquettes', task, count)}
      items={task.tagIds.flatMap((id) => {
        const tag = context.tagById.get(id);
        return tag ? [{ id, label: tag.label, icon: <ItemAvatar name={tag.label} iconUrl={tag.iconUrl} color={tag.color} size={14} /> }] : [];
      })}
      {...listSelectProps(context.tags, undefined, task.tagIds)}
      value={task.tagIds}
      readOnly={task.archived}
      onSave={(tagIds) => {
        const { added, removed } = listDiff(task.tagIds, tagIds);
        apply({ tagIds }, { addTagIds: added, removeTagIds: removed });
      }}
      nothingFoundMessage="Aucune étiquette (Paramètres › Tâches)"
    />
  );
}

/**
 * Sprints cell: multi-select among the sprints of the task's project tree. On a column selection, adding a
 * sprint adds it to every selected task and removing one removes it.
 * @param {{ task: Task, context: TaskContext }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function SprintCell({ task, context }: { task: Task; context: TaskContext }) {
  const { apply, count } = useCellEdit(task, 'sprint');
  const sprints = context.sprintsFor(task.projectId, task.sprintIds);
  return (
    <EditableMultiSelect
      label={fieldLabel('Sprints', task, count)}
      items={task.sprintIds.flatMap((id) => {
        const sprint = sprints.find((item) => item.id === id) ?? context.sprints.find((item) => item.id === id);
        return sprint ? [{ id, label: context.sprintLabel(sprint) }] : [];
      })}
      data={sprints.map((sprint) => ({ value: sprint.id, label: context.sprintLabel(sprint) }))}
      value={task.sprintIds}
      readOnly={task.archived}
      onSave={(sprintIds) => {
        const { added, removed } = listDiff(task.sprintIds, sprintIds);
        apply({ sprintIds }, { addSprintIds: added, removeSprintIds: removed });
      }}
      nothingFoundMessage="Aucun sprint dans ce projet"
    />
  );
}

/**
 * Assignees cell: multi-select. On a column selection, adding a contributor adds them to every selected
 * task and removing one removes them.
 * @param {{ task: Task, context: TaskContext }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function AssigneesCell({ task, context }: { task: Task; context: TaskContext }) {
  const { apply, count, targets } = useCellEdit(task, 'assignees');
  return (
    <SharedAssigneesCell
      value={task.assigneeIds}
      projectId={task.projectId}
      // A selection: the contributors of all its projects.
      projectIds={targets.length > 1 ? targets.map((id) => context.taskById.get(id)?.projectId ?? null) : undefined}
      context={context}
      label={fieldLabel('Assignés', task, count)}
      readOnly={task.archived}
      onSave={(assigneeIds, { added, removed }) => apply({ assigneeIds }, { addAssigneeIds: added, removeAssigneeIds: removed })}
    />
  );
}

/**
 * "Dépend de" cell: multi-select of the tasks (one or several) of the same project tree it depends on.
 * The task stays blocked until all of them are closed. Single task edit.
 * @param {{ task: Task, context: TaskContext }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function BlockedByCell({ task, context }: { task: Task; context: TaskContext }) {
  const taskBlock = useTaskBlock();
  const { targets, count } = useCellEdit(task, 'blockedBy');
  const candidates = linkableTasks(context, task.projectId, task.id);
  // Archived blockers stay listed so they can be removed.
  const extra = task.blockedByIds
    .filter((id) => !candidates.some((candidate) => candidate.id === id))
    .map((id) => context.taskById.get(id))
    .filter((item) => item !== undefined);
  const label = cellLabel('Tâches dont dépend', `la tâche ${taskName(task)}`, count);
  return (
    <EditableMultiSelect
      label={label}
      items={task.blockedByIds.flatMap((id) => {
        const blocker = context.taskById.get(id);
        return blocker
          ? [
              {
                id,
                label: `${context.taskLabel(blocker, task.projectId)}`,
                hint: `${context.taskLabel(blocker, task.projectId)}${blocker.closed ? closedMark(blocker) : ' (ouverte : bloque la tâche)'}`,
                icon: <DependencyIcon done={blocker.closed} />,
              },
            ]
          : [];
      })}
      data={[...candidates, ...extra].map((item) => ({ value: item.id, label: `${context.taskLabel(item, task.projectId)}` }))}
      value={task.blockedByIds}
      readOnly={task.archived}
      onSave={(ids) => {
        // On a selection, each selected task gets (or loses) the same blockers.
        for (const target of targets) {
          for (const id of ids.filter((item) => !task.blockedByIds.includes(item) && item !== target)) {
            taskBlock.mutate({ add: true, blockerId: id, blockedId: target }, ON_ERROR);
          }
          for (const id of task.blockedByIds.filter((item) => !ids.includes(item))) {
            taskBlock.mutate({ add: false, blockerId: id, blockedId: target }, ON_ERROR);
          }
        }
      }}
      nothingFoundMessage="Aucune tâche"
    />
  );
}

/**
 * Effort cell: number field, saved on blur or Enter (on a selection, given to every task of it).
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EffortCell({ task }: { task: Task }) {
  const { apply, count } = useCellEdit(task, 'effort');
  return (
    <EditableNumber
      value={task.effort}
      label={fieldLabel('Effort', task, count)}
      min={0}
      nullable
      saveUnchanged={count > 1}
      readOnly={task.archived}
      onSave={(effort) => apply({ effort }, { effort })}
    />
  );
}

interface DateCellProps {
  task: Task;
  column: 'startDate' | 'endDate' | 'deadline' | 'minDate';
  /** Shown in the lateness colour (overdue: `isTaskOverdue`). */
  alert?: boolean;
}

const DATE_LABELS = { startDate: 'Début', endDate: 'Fin', deadline: 'Échéance', minDate: 'Ouverture' } as const;

/** Period each date column bounds: its start and end columns. */
const DATE_RANGES = { startDate: ['startDate', 'endDate'], endDate: ['startDate', 'endDate'], minDate: ['minDate', 'deadline'], deadline: ['minDate', 'deadline'] } as const;

/**
 * Start, end or « Échéance » cell: date picker.
 * @param {DateCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function DateCell({ task, column, alert }: DateCellProps) {
  const { apply, count } = useCellEdit(task, column);
  const [startKey, endKey] = DATE_RANGES[column];
  const side = column === startKey ? 'start' : 'end';
  // A single task keeps a valid period (the other bound follows); with several, the API checks every task.
  const bounds = dateRangeProps({ value: [task[startKey], task[endKey]], onChange: ([start, end]) => apply({ [startKey]: start, [endKey]: end }) })[side];
  // Without its own « Ouverture » / « Échéance »: the one it goes by (parent, milestone, project, sprint), shown in place (a date typed wins).
  const inherited = column === 'minDate' || column === 'deadline' ? inheritedDateHint(task, column) : null;
  return (
    <DateField
      {...stoppedCellField}
      aria-label={fieldLabel(DATE_LABELS[column], task, count)}
      value={task[column]}
      minDate={count < 2 ? bounds.minDate : undefined}
      onChange={(date) => (count < 2 ? bounds.onChange(date) : apply({ [column]: date }, { [column]: date }))}
      readOnly={task.archived}
      clearable={!task.archived}
      placeholder={inherited ?? (task.archived ? undefined : '—')}
      popoverProps={{ withinPortal: true }}
      c={alert ? LATE_COLOR : undefined}
      fw={alert ? 600 : undefined}
    />
  );
}

/**
 * « Bénéficiaires » cell of a task: contributors and relations it is for.
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TaskBeneficiariesCell({ task }: { task: Task }) {
  const { apply, count } = useCellEdit(task, 'beneficiaries');
  // On a selection, those added here are added to each task, those removed here removed.
  return (
    <BeneficiariesCell
      label={fieldLabel('Bénéficiaires', task, count)}
      value={task}
      readOnly={task.archived}
      onSave={(beneficiaries) => apply((target) => beneficiariesDiff(target, task, beneficiaries))}
    />
  );
}

/**
 * Links of a task with others, edited in place: those it depends on, those it blocks, those it is related to.
 * @param {{ task: Task, context: TaskContext, kind: 'blocking' | 'related' }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TaskLinksCell({ task, context, kind }: { task: Task; context: TaskContext; kind: 'blocking' | 'related' }) {
  const taskBlock = useTaskBlock();
  const { targets, count } = useCellEdit(task, kind);
  const taskRelation = useTaskRelation();
  const ids = kind === 'blocking' ? task.blockingIds : task.relatedIds;
  const candidates = linkableTasks(context, task.projectId, task.id);
  const extra = ids.filter((id) => !candidates.some((candidate) => candidate.id === id)).flatMap((id) => (context.taskById.get(id) ? [context.taskById.get(id)!] : []));
  const label = kind === 'blocking' ? cellLabel('Tâches que bloque', `la tâche ${taskName(task)}`, count) : cellLabel('Tâches relatives', `à la tâche ${taskName(task)}`, count);
  /**
   * Adds or removes a link, on the edited task or each task of the selection.
   * @param {string} id Other task.
   * @param {boolean} add Added or removed.
   * @returns {void}
   */
  const link = (id: string, add: boolean) => {
    for (const target of targets.filter((item) => item !== id)) {
      if (kind === 'blocking') taskBlock.mutate({ add, blockerId: target, blockedId: id }, ON_ERROR);
      else taskRelation.mutate({ add, taskId: target, otherId: id }, ON_ERROR);
    }
  };
  return (
    <EditableMultiSelect
      label={label}
      items={ids.flatMap((id) => {
        const other = context.taskById.get(id);
        return other ? [{ id, label: `${context.taskLabel(other, task.projectId)}`, hint: `${context.taskLabel(other, task.projectId)}${closedMark(other)}` }] : [];
      })}
      data={[...candidates, ...extra].map((item) => ({ value: item.id, label: `${context.taskLabel(item, task.projectId)}` }))}
      value={ids}
      readOnly={task.archived}
      onSave={(next) => {
        for (const id of next.filter((item) => !ids.includes(item))) link(id, true);
        for (const id of ids.filter((item) => !next.includes(item))) link(id, false);
      }}
      nothingFoundMessage="Aucune tâche"
    />
  );
}

/**
 * Parent task cell: chosen in place among the tasks of its project tree (not itself nor its sub-tasks).
 * @param {{ task: Task, context: TaskContext }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function ParentCell({ task, context }: { task: Task; context: TaskContext }) {
  const { apply, count } = useCellEdit(task, 'parent');
  const excluded = subtreeOf(context.tasks, task.id);
  const candidates = linkableTasks(context, task.projectId, task.id, (candidate) => !excluded.has(candidate.id));
  return (
    <TaskSelect
      context={context}
      tasks={candidates}
      {...cellPicker(task.archived)}
      aria-label={fieldLabel('Tâche parente', task, count)}
      value={task.parentId}
      // A task is not its own parent (the API refuses the other loops).
      onChange={(parentId) => apply((target) => (target.id === parentId ? {} : { parentId }))}
    />
  );
}

/**
 * Project cell: the task moved to another project (or out of any) in place; leaving its tree, asked first (its links,
 * milestone and sprints are lost).
 * @param {{ task: Task, context: TaskContext }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TaskProjectCell({ task, context }: { task: Task; context: TaskContext }) {
  const { transfer: bulkTransfer } = useBulkTaskMutations();
  const { targets, count } = useCellEdit(task, 'project');
  /**
   * Moves the task.
   * @param {string | null} projectId Target project; null: none.
   * @returns {void}
   */
  const move = (projectId: string | null) => {
    if (projectId === task.projectId && count < 2) return;
    const moved = targets.map((id) => context.taskById.get(id)).filter((item) => item !== undefined);
    const transfer = () =>
      bulkTransfer.mutate(
        { ids: targets, projectId },
        toastCallbacks(({ removedLinks }: { removedLinks: number }) => `${count > 1 ? `${count} tâches déplacées` : 'Tâche déplacée'}.${removedLinksNote(removedLinks)}`),
      );
    if (!moved.some((item) => hasTreeLinks(item) && !inProjectTree(context, projectId)(item.projectId))) return transfer();
    confirmDestructive({
      title: 'Changer de projet',
      risks: 'La tâche (et ses sous-tâches) passe dans une autre arborescence : sa tâche parente, ses blocages et relations avec les tâches restées, son jalon, ses sprints et ses documents de projet seront retirés.',
      confirmLabel: 'Changer de projet',
      confirmIcon: <ArrowsLeftRightIcon aria-hidden />,
      onConfirm: transfer,
    });
  };
  return <SharedProjectCell value={task.projectId} context={context} label={fieldLabel('Projet', task, count)} placeholder="Sans projet" readOnly={task.archived} onSave={move} />;
}

/**
 * Location cell of a task (`LocationCell`), on the selection of its table: an address chosen in place, or none.
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TaskLocationCell({ task }: { task: Task }) {
  const { apply, count } = useCellEdit(task, 'location');
  return <LocationCell item={task} label={fieldLabel('Lieu', task, count)} readOnly={task.archived} count={count} onSave={(change) => apply(change)} />;
}

/**
 * « Horaires » cell of a task: its hours in words, a case a line (none: « N’importe quand »); a click opens their settings in the
 * repetition modal, applied on « Appliquer » to it, or to every task selected (each takes these hours whole).
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TaskHoursCell({ task }: { task: Task }) {
  const { apply, count } = useCellEdit(task, 'hours');
  const [opened, setOpened] = useState(false);
  const hours = readTaskHours(task.hours);
  const anytime = (
    <Text component="div" size="sm" c="dimmed">
      N’importe quand
    </Text>
  );
  // A case a line.
  const lines = taskHoursLines(hours, localToday());
  if (task.archived) return <StackedLines lines={lines} empty={anytime} />;
  return (
    <>
      <StackedLines
        lines={lines}
        empty={anytime}
        wrap={(shown) => (
          <UnstyledButton
            onClick={(event) => {
              stopClick(event);
              setOpened(true);
            }}
            aria-label={fieldLabel('Modifier les horaires', task, count)}
            style={{ maxWidth: '100%' }}
          >
            {shown}
          </UnstyledButton>
        )}
      />
      {/* Its clicks kept from the row (the modal bubbles through the cell). */}
      {opened && (
        <span onClick={stopClick}>
        <TaskHoursModal
          value={hours}
          title={`Horaires de « ${taskName(task)} »`}
          onClose={() => setOpened(false)}
          header={
            count > 1 && (
              <Text size="sm" c="dimmed">
                S’applique à {tasksLabel(count)} : chacune prend ces horaires entiers.
              </Text>
            )
          }
          onApply={(value) => apply({ hours: value })}
        />
        </span>
      )}
    </>
  );
}
