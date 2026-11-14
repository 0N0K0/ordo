import {
  Avatar,
  ColorSwatch,
  Combobox,
  Group,
  NumberInput,
  Select,
  Text,
  TextInput,
  UnstyledButton,
  useCombobox,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { CheckIcon, HourglassMediumIcon } from '@phosphor-icons/react';
import { taskTitleSchema, type TaskColumn } from '@ordo/shared';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { notifyError } from '../../../lib/notify';
import { useTaskBlock, type Task, type TaskLabel } from '../api';
import { linkableTasks } from '../task-links';
import { LabelBadge } from '../task-ui';
import type { TaskContext } from '../use-task-context';
import { useTaskLink } from '../use-task-link';
import { useCellEdit } from './cell-edit';
import classes from '../../../components/data-table/EditableCells.module.css';
import { BatchMultiSelect } from '../../../components/BatchMultiSelect';
import { StackedMultiCell } from './StackedMultiCell';

/**
 * Stops the click from reaching the row.
 * @param {MouseEvent} event Click event.
 * @returns {void}
 */
const stop = (event: MouseEvent) => event.stopPropagation();

/** Borderless field filling the cell; a border shows on hover and focus. */
const cellField = {
  variant: 'unstyled',
  size: 'xs',
  classNames: { root: classes.root, input: classes.input, section: classes.section },
  onClick: stop,
} as const;

/** Select and multi-select fields: dropdown as wide as its options. */
const cellCombobox = {
  ...cellField,
  comboboxProps: { withinPortal: true, width: 'max-content', position: 'bottom-start' },
} as const;

/**
 * Accessible label of a cell field, mentioning the bulk edit.
 * @param {string} name Field name.
 * @param {Task} task Task.
 * @param {number} count Number of tasks the edit applies to.
 * @returns {string} Label.
 */
function fieldLabel(name: string, task: Task, count: number): string {
  return count > 1 ? `${name} (appliqué aux ${count} cellules sélectionnées)` : `${name} de la tâche #${task.number}`;
}

/**
 * Title cell: clicking "#12 Title" opens the task; double-clicking elsewhere in the cell renames it in place.
 * @param {{ task: Task, context: TaskContext, prefix?: ReactNode }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function TitleCell({ task, context, prefix }: { task: Task; context: TaskContext; prefix?: ReactNode }) {
  const link = useTaskLink();
  const { apply } = useCellEdit(task, 'title');
  const [draft, setDraft] = useState<string | null>(null);
  const children = context.childrenOf(task.id);

  /**
   * Saves the new title when valid.
   * @returns {void}
   */
  const save = () => {
    const result = taskTitleSchema.safeParse(draft ?? '');
    if (!result.success) {
      notifyError(`${result.error.issues[0]?.message ?? 'Titre invalide.'} Le titre n’a pas été modifié.`);
    } else if (result.data !== task.title) {
      apply({ title: result.data });
    }
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <TextInput
        size="xs"
        value={draft}
        autoFocus
        aria-label={`Titre de la tâche #${task.number}`}
        onClick={stop}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') save();
          if (event.key === 'Escape') setDraft(null);
        }}
        onBlur={save}
        style={{ flex: 1 }}
      />
    );
  }

  return (
    // The group fills the cell so a double-click on its empty part starts renaming.
    <Group
      gap={6}
      wrap="nowrap"
      className={classes.titleArea}
      title="Double-cliquez pour renommer"
      onDoubleClick={(event) => {
        // A double-click on the links already opened the task.
        if ((event.target as HTMLElement).closest('a')) return;
        setDraft(task.title);
      }}
    >
      {prefix}
      <Text component={Link} to={link.to(task.id)} size="sm" c="dimmed" onClick={stop} style={{ flex: 'none' }}>
        #{task.number}
      </Text>
      <Text
        component={Link}
        to={link.to(task.id)}
        size="sm"
        fw={500}
        c="inherit"
        onClick={stop}
        truncate
        className={classes.titleLink}
      >
        {task.title}
      </Text>
      {children.length > 0 && (
        <Text size="xs" c="dimmed" style={{ flex: 'none' }}>
          {children.filter((child) => context.isClosed(child)).length}/{children.length}
        </Text>
      )}
    </Group>
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
      data={context.milestonesFor(task.projectId).map((milestone) => ({ value: milestone.id, label: milestone.title }))}
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
        return tag ? [{ id, label: tag.name, icon: <ColorSwatch color={tag.color} size={8} style={{ flexShrink: 0 }} /> }] : [];
      })}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellCombobox}
          classNames={{ ...cellField.classNames, pillsList: classes.pills }}
          aria-label={fieldLabel('Étiquettes', task, count)}
          data={context.tags.map((tag) => ({ value: tag.id, label: tag.name }))}
          renderOption={({ option }) => (
            <Group gap="xs" wrap="nowrap">
              <ColorSwatch color={context.tagById.get(option.value)?.color ?? 'gray'} size={10} />
              {option.label}
            </Group>
          )}
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
        return sprint ? [{ id, label: sprint.name }] : [];
      })}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellCombobox}
          classNames={{ ...cellField.classNames, pillsList: classes.pills }}
          aria-label={fieldLabel('Sprints', task, count)}
          data={sprints.map((sprint) => ({ value: sprint.id, label: sprint.name }))}
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
    <StackedMultiCell
      label={fieldLabel('Assignés', task, count)}
      items={task.assigneeIds.flatMap((id) => {
        const contributor = context.contributorById.get(id);
        return contributor
          ? [{ id, label: context.contributorName(contributor), icon: <Avatar src={contributor.avatarUrl} name={contributor.name} color="initials" size={16} style={{ flexShrink: 0 }} /> }]
          : [];
      })}
      renderSelect={({ onDropdownClose }) => (
        <BatchMultiSelect
          {...cellCombobox}
          classNames={{ ...cellField.classNames, pillsList: classes.pills }}
          aria-label={fieldLabel('Assignés', task, count)}
          data={context.assignableFor([task.projectId], task.assigneeIds).map((contributor) => ({
            value: contributor.id,
            label: context.contributorName(contributor),
          }))}
          renderOption={({ option }) => {
            const contributor = context.contributorById.get(option.value);
            return (
              <Group gap="xs" wrap="nowrap">
                <Avatar src={contributor?.avatarUrl} name={contributor?.name} color="initials" size={20} />
                {option.label}
              </Group>
            );
          }}
          value={task.assigneeIds}
          onChange={(assigneeIds) => {
            const added = assigneeIds.filter((id) => !task.assigneeIds.includes(id));
            const removed = task.assigneeIds.filter((id) => !assigneeIds.includes(id));
            apply({ assigneeIds }, { addAssigneeIds: added, removeAssigneeIds: removed });
          }}
          onDropdownClose={onDropdownClose}
          placeholder={task.assigneeIds.length ? undefined : '—'}
          searchable
        />
      )}
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
  const candidates = linkableTasks(context, task.projectId, task.id);
  // Archived blockers stay listed so they can be removed.
  const extra = task.blockedByIds
    .filter((id) => !candidates.some((candidate) => candidate.id === id))
    .map((id) => context.taskById.get(id))
    .filter((item) => item !== undefined);
  const onError = { onError: (error: Error) => notifyError(error.message) };
  const label = `Tâches dont dépend la tâche #${task.number}`;
  return (
    <StackedMultiCell
      label={label}
      items={task.blockedByIds.flatMap((id) => {
        const blocker = context.taskById.get(id);
        return blocker
          ? [
              {
                id,
                label: `#${blocker.number} ${blocker.title}`,
                title: `#${blocker.number} ${blocker.title}${blocker.closed ? ' (fermée)' : ' (ouverte : bloque la tâche)'}`,
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
          {...cellCombobox}
          classNames={{ ...cellField.classNames, pillsList: classes.pills }}
          aria-label={label}
          data={[...candidates, ...extra].map((item) => ({ value: item.id, label: `#${item.number} ${item.title}` }))}
          value={task.blockedByIds}
          onChange={(ids) => {
            for (const id of ids.filter((item) => !task.blockedByIds.includes(item))) {
              taskBlock.mutate({ add: true, blockerId: id, blockedId: task.id }, onError);
            }
            for (const id of task.blockedByIds.filter((item) => !ids.includes(item))) {
              taskBlock.mutate({ add: false, blockerId: id, blockedId: task.id }, onError);
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
 * Effort cell: number field, saved on blur or Enter.
 * @param {{ task: Task }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function EffortCell({ task }: { task: Task }) {
  const { apply, count } = useCellEdit(task, 'effort');
  const [draft, setDraft] = useState<number | string | null>(null);

  /**
   * Saves the typed effort when it changed and is valid.
   * @returns {void}
   */
  const save = () => {
    if (draft === null) return;
    const effort = draft === '' ? null : Number(draft);
    setDraft(null);
    if (effort === task.effort || (effort !== null && (!Number.isFinite(effort) || effort < 0))) return;
    apply({ effort }, { effort });
  };

  return (
    <NumberInput
      {...cellField}
      aria-label={fieldLabel('Effort', task, count)}
      min={0}
      decimalScale={2}
      decimalSeparator=","
      hideControls
      value={draft ?? task.effort ?? ''}
      onChange={setDraft}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraft(null);
          event.currentTarget.blur();
        }
      }}
      placeholder="—"
    />
  );
}

interface DateCellProps {
  task: Task;
  column: 'startDate' | 'endDate' | 'deadline';
  /** Shown in red (overdue: past its "Date max"). */
  alert?: boolean;
}

const DATE_LABELS = { startDate: 'Début', endDate: 'Fin', deadline: 'Date max' } as const;

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
