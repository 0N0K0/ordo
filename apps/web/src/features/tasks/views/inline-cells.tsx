import { Combobox, Select, Text, UnstyledButton, useCombobox } from '@mantine/core';
import { ItemAvatar } from '../../../components/settings/ItemAvatar';
import { listSelectProps } from '../../../components/settings/item-look';
import { DatePickerInput } from '@mantine/dates';
import { CheckIcon, HourglassMediumIcon } from '@phosphor-icons/react';
import { taskTitleSchema, type TaskColumn } from '@ordo/shared';
import { type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { onMutationError } from '../../../lib/notify';
import { useBulkTaskMutations, useTaskBlock, useTaskRelation, useTransferTask, type Task, type TaskLabel } from '../api';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { notifySuccess } from '../../../lib/notify';
import { TaskSelect } from '../task-ui';
import { subtreeIds } from '../task-links';
import { linkableTasks } from '../task-links';
import { LabelBadge } from '../task-ui';
import { taskName, taskRef, type TaskContext } from '../use-task-context';
import { useTaskLink } from '../use-task-link';
import { useCellEdit } from './cell-edit';
import { applyDiff } from '../../../components/data-table/bulk-edit';
import classes from '../../../components/data-table/EditableCells.module.css';
import { BatchMultiSelect } from '../../../components/BatchMultiSelect';
import { StackedMultiCell } from '../../../components/data-table/StackedMultiCell';
import { BeneficiariesCell } from '../../beneficiaries/BeneficiariesSelect';
import { cellCombobox as sharedCombobox, cellMulti as sharedMulti } from '../../../components/data-table/cell-field';
import { EditableNumber } from '../../../components/data-table/EditableCells';
import { EditableTitle } from '../../../components/data-table/EditableTitle';
import { AssigneesCell as SharedAssigneesCell, ProjectCell as SharedProjectCell } from './context-cells';
import { countOf, plural } from '../../../lib/text';

/**
 * Stops the click from reaching the row.
 * @param {MouseEvent} event Click event.
 * @returns {void}
 */
const stop = (event: MouseEvent) => event.stopPropagation();

/** Select fields of the cells, a click kept from the row. */
const cellCombobox = { ...sharedCombobox, onClick: stop } as const;

/** Multi-select fields of the cells, a click kept from the row. */
const cellMulti = { ...sharedMulti, onClick: stop } as const;

/**
 * Accessible label of a cell field, mentioning the bulk edit.
 * @param {string} name Field name.
 * @param {Task} task Task.
 * @param {number} count Number of tasks the edit applies to.
 * @returns {string} Label.
 */
function fieldLabel(name: string, task: Task, count: number): string {
  return count > 1 ? `${name} (appliqué aux ${count} cellules sélectionnées)` : `${name} de la tâche ${taskName(task)}`;
}

/**
 * Title cell: clicking "#12 Title" opens the task; double-clicking elsewhere in the cell renames it in place.
 * @param {{ task: Task, context: TaskContext, prefix?: ReactNode }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TitleCell({ task, context, prefix }: { task: Task; context: TaskContext; prefix?: ReactNode }) {
  const link = useTaskLink();
  const { apply } = useCellEdit(task, 'title');
  const children = context.childrenOf(task.id);
  return (
    <EditableTitle
      value={task.title}
      label={`Titre de la tâche ${taskName(task)}`}
      schema={taskTitleSchema}
      to={link.to(task.id)}
      before={
        <>
          {prefix}
          <Text component={Link} to={link.to(task.id)} size="sm" c="dimmed" onClick={stop} style={{ flex: 'none' }}>
            {taskRef(task).trim()}
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
      onSave={(title) => apply({ title })}
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
 * Status, priority or type cell: a colored chip; clicking the cell opens the list of chips.
 * Choosing the current value again clears it.
 * @param {LabelCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function LabelCell({ task, column, labels }: LabelCellProps) {
  const { apply, count } = useCellEdit(task, column);
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const field = LABEL_FIELDS[column];
  const current = labels.find((label) => label.id === task[field]);

  /**
   * Saves the chosen label (or clears it when it is the current one).
   * @param {string} id Label id.
   * @returns {void}
   */
  const choose = (id: string) => {
    const value = id === task[field] ? null : id;
    apply({ [field]: value }, { [field]: value });
    combobox.closeDropdown();
  };

  return (
    <Combobox store={combobox} onOptionSubmit={choose} withinPortal position="bottom-start" width="max-content">
      <Combobox.Target>
        <UnstyledButton
          className={classes.chipTrigger}
          aria-label={fieldLabel(LABEL_NAMES[column], task, count)}
          aria-haspopup="listbox"
          aria-expanded={combobox.dropdownOpened}
          data-expanded={combobox.dropdownOpened || undefined}
          onClick={(event) => {
            stop(event);
            combobox.toggleDropdown();
          }}
        >
          {current ? <LabelBadge label={current} /> : <span className={classes.placeholder}>—</span>}
        </UnstyledButton>
      </Combobox.Target>
      <Combobox.Dropdown onClick={stop}>
        <Combobox.Options>
          {labels.length === 0 && <Combobox.Empty>Aucune valeur définie dans les paramètres</Combobox.Empty>}
          {labels.map((label) => (
            <Combobox.Option key={label.id} value={label.id} active={label.id === current?.id}>
              <LabelBadge label={label} />
            </Combobox.Option>
          ))}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
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
      {...cellCombobox}
      aria-label={fieldLabel('Jalon', task, count)}
      data={context.milestonesFor(task.projectId).map((milestone) => ({ value: milestone.id, label: context.milestoneLabel(milestone) }))}
      value={task.milestoneId}
      onChange={(milestoneId) => apply({ milestoneId }, { milestoneId })}
      placeholder="—"
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
    <StackedMultiCell
      label={fieldLabel('Étiquettes', task, count)}
      items={task.tagIds.flatMap((id) => {
        const tag = context.tagById.get(id);
        return tag ? [{ id, label: tag.name, icon: <ItemAvatar name={tag.name} iconUrl={tag.iconUrl} color={tag.color} size={14} /> }] : [];
      })}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellMulti}
          aria-label={fieldLabel('Étiquettes', task, count)}
          {...listSelectProps(context.tags)}
          value={task.tagIds}
          onChange={(tagIds) => {
            const added = tagIds.filter((id) => !task.tagIds.includes(id));
            const removed = task.tagIds.filter((id) => !tagIds.includes(id));
            apply({ tagIds }, { addTagIds: added, removeTagIds: removed });
          }}
          onDropdownClose={onDropdownClose}
          placeholder={task.tagIds.length ? undefined : '—'}
          searchable
          nothingFoundMessage="Aucune étiquette (Paramètres › Tâches)"
        />
      )}
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
  const sprints = context.sprintsFor(task.projectId);
  return (
    <StackedMultiCell
      label={fieldLabel('Sprints', task, count)}
      items={task.sprintIds.flatMap((id) => {
        const sprint = sprints.find((item) => item.id === id) ?? context.sprints.find((item) => item.id === id);
        return sprint ? [{ id, label: context.sprintLabel(sprint) }] : [];
      })}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellMulti}
          aria-label={fieldLabel('Sprints', task, count)}
          data={sprints.map((sprint) => ({ value: sprint.id, label: context.sprintLabel(sprint) }))}
          value={task.sprintIds}
          onChange={(sprintIds) => {
            const added = sprintIds.filter((id) => !task.sprintIds.includes(id));
            const removed = task.sprintIds.filter((id) => !sprintIds.includes(id));
            apply({ sprintIds }, { addSprintIds: added, removeSprintIds: removed });
          }}
          onDropdownClose={onDropdownClose}
          placeholder={task.sprintIds.length ? undefined : '—'}
          searchable
          nothingFoundMessage="Aucun sprint dans ce projet"
        />
      )}
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
  const { apply, count } = useCellEdit(task, 'assignees');
  return (
    <SharedAssigneesCell
      value={task.assigneeIds}
      projectId={task.projectId}
      context={context}
      label={fieldLabel('Assignés', task, count)}
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
  const onError = { onError: onMutationError };
  const label = count > 1 ? `Tâches dont dépendent les ${count} tâches sélectionnées` : `Tâches dont dépend la tâche ${taskName(task)}`;
  return (
    <StackedMultiCell
      label={label}
      items={task.blockedByIds.flatMap((id) => {
        const blocker = context.taskById.get(id);
        return blocker
          ? [
              {
                id,
                label: `${context.taskLabel(blocker, task.projectId)}`,
                title: `${context.taskLabel(blocker, task.projectId)}${blocker.closed ? ' (fermée)' : ' (ouverte : bloque la tâche)'}`,
                icon: blocker.closed ? (
                  <CheckIcon aria-hidden color="var(--mantine-color-green-6)" style={{ flexShrink: 0 }} />
                ) : (
                  <HourglassMediumIcon aria-hidden color="var(--mantine-color-orange-6)" style={{ flexShrink: 0 }} />
                ),
              },
            ]
          : [];
      })}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellMulti}
          aria-label={label}
          data={[...candidates, ...extra].map((item) => ({ value: item.id, label: `${context.taskLabel(item, task.projectId)}` }))}
          value={task.blockedByIds}
          onChange={(ids) => {
            // On a selection, each selected task gets (or loses) the same blockers.
            for (const target of targets) {
              for (const id of ids.filter((item) => !task.blockedByIds.includes(item) && item !== target)) {
                taskBlock.mutate({ add: true, blockerId: id, blockedId: target }, onError);
              }
              for (const id of task.blockedByIds.filter((item) => !ids.includes(item))) {
                taskBlock.mutate({ add: false, blockerId: id, blockedId: target }, onError);
              }
            }
          }}
          onDropdownClose={onDropdownClose}
          placeholder={task.blockedByIds.length ? undefined : '—'}
          searchable
          nothingFoundMessage="Aucune tâche"
        />
      )}
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
  return <EditableNumber value={task.effort} label={fieldLabel('Effort', task, count)} min={0} nullable saveUnchanged={count > 1} onSave={(effort) => apply({ effort }, { effort })} />;
}

interface DateCellProps {
  task: Task;
  column: 'startDate' | 'endDate' | 'deadline' | 'minDate';
  /** Shown in red (overdue: past its "Date max"). */
  alert?: boolean;
}

const DATE_LABELS = { startDate: 'Début', endDate: 'Fin', deadline: 'Date max', minDate: 'Date min' } as const;

/**
 * Start, end or "Date max" cell: date picker.
 * @param {DateCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function DateCell({ task, column, alert }: DateCellProps) {
  const { apply, count } = useCellEdit(task, column);
  return (
    <DatePickerInput
      variant="unstyled"
      size="xs"
      classNames={{ root: classes.root, input: classes.input, section: classes.section }}
      onClick={stop}
      aria-label={fieldLabel(DATE_LABELS[column], task, count)}
      value={task[column]}
      // A single task keeps a valid range; with several, the API checks every task.
      minDate={column === 'endDate' && count < 2 ? (task.startDate ?? undefined) : undefined}
      maxDate={column === 'startDate' && count < 2 ? (task.endDate ?? undefined) : undefined}
      onChange={(date) => apply({ [column]: date }, { [column]: date })}
      clearable
      placeholder="—"
      popoverProps={{ withinPortal: true }}
      c={alert ? 'red' : undefined}
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
      onSave={(beneficiaries) =>
        apply((target) => ({
          beneficiaryIds: applyDiff(target.beneficiaryIds, task.beneficiaryIds, beneficiaries.beneficiaryIds),
          beneficiaryRelationIds: applyDiff(target.beneficiaryRelationIds, task.beneficiaryRelationIds, beneficiaries.beneficiaryRelationIds),
        }))
      }
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
  const onError = { onError: onMutationError };
  const label =
    count > 1
      ? `${kind === 'blocking' ? 'Tâches que bloquent' : 'Tâches relatives aux'} ${count} tâches sélectionnées`
      : kind === 'blocking'
        ? `Tâches que bloque la tâche ${taskName(task)}`
        : `Tâches relatives à la tâche ${taskName(task)}`;
  /**
   * Adds or removes a link, on the edited task or each task of the selection.
   * @param {string} id Other task.
   * @param {boolean} add Added or removed.
   * @returns {void}
   */
  const link = (id: string, add: boolean) => {
    for (const target of targets.filter((item) => item !== id)) {
      if (kind === 'blocking') taskBlock.mutate({ add, blockerId: target, blockedId: id }, onError);
      else taskRelation.mutate({ add, taskId: target, otherId: id }, onError);
    }
  };
  return (
    <StackedMultiCell
      label={label}
      items={ids.flatMap((id) => {
        const other = context.taskById.get(id);
        return other ? [{ id, label: `${context.taskLabel(other, task.projectId)}`, title: `${context.taskLabel(other, task.projectId)}${other.closed ? ' (fermée)' : ''}` }] : [];
      })}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellMulti}
          aria-label={label}
          data={[...candidates, ...extra].map((item) => ({ value: item.id, label: `${context.taskLabel(item, task.projectId)}` }))}
          value={ids}
          onChange={(next) => {
            for (const id of next.filter((item) => !ids.includes(item))) link(id, true);
            for (const id of ids.filter((item) => !next.includes(item))) link(id, false);
          }}
          onDropdownClose={onDropdownClose}
          placeholder={ids.length ? undefined : '—'}
          searchable
          nothingFoundMessage="Aucune tâche"
        />
      )}
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
  const excluded = subtreeIds(context, task.id);
  const candidates = linkableTasks(context, task.projectId, task.id, (candidate) => !excluded.has(candidate.id));
  return (
    <TaskSelect
      context={context}
      tasks={candidates}
      variant="unstyled"
      size="xs"
      aria-label={fieldLabel('Tâche parente', task, count)}
      placeholder="—"
      value={task.parentId}
      // A task is not its own parent (the API refuses the other loops).
      onChange={(parentId) => apply((target) => (target.id === parentId ? {} : { parentId }))}
      onClick={stop}
      comboboxProps={{ withinPortal: true }}
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
  const transferTask = useTransferTask();
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
      count > 1
        ? bulkTransfer.mutate(
            { ids: targets, projectId },
            {
              onSuccess: ({ removedLinks }) => notifySuccess(`${count} tâches déplacées.${removedLinks ? ` ${countOf(removedLinks, 'lien')} ${plural(removedLinks, 'retiré')}.` : ''}`),
              onError: onMutationError,
            },
          )
        : transferTask.mutate(
        { id: task.id, projectId },
        {
          onSuccess: ({ removedLinks }) => notifySuccess(`Tâche déplacée.${removedLinks ? ` ${countOf(removedLinks, 'lien')} ${plural(removedLinks, 'retiré')}.` : ''}`),
          onError: onMutationError,
        },
      );
    const linked = (item: Task) =>
      item.parentId !== null || item.blockingIds.length + item.blockedByIds.length + item.relatedIds.length > 0 || item.milestoneId !== null || item.sprintIds.length > 0;
    if (!moved.some((item) => linked(item) && context.rootOf(projectId) !== context.rootOf(item.projectId))) return transfer();
    confirmDestructive({
      title: 'Changer de projet',
      risks: 'La tâche (et ses sous-tâches) passe dans une autre arborescence : sa tâche parente, ses blocages et relations avec les tâches restées, son jalon et ses sprints seront retirés.',
      confirmLabel: 'Changer de projet',
      onConfirm: transfer,
    });
  };
  return (
    <SharedProjectCell value={task.projectId} context={context} label={fieldLabel('Projet', task, count)} placeholder="Sans projet" onSave={move} />
  );
}
