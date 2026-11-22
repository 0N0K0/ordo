import { unarchived } from '../../../lib/archive';
import { mapById } from '@ordo/shared';
import { Anchor, Box, Group, Select, Text, Tooltip, type SelectProps } from '@mantine/core';
import { PeopleSelect } from '../../../components/people/PeopleSelect';

import { listSelectProps, itemSelectProps } from '../../../components/items/item-look';
import { CheckCircleIcon, CircleIcon, LockIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useTaskLink } from '../hooks/use-task-link';
import { type Contributor, type Task, type TaskLabel, type TaskLabelKind } from '../api';
import { useTaskLabelItems, useTaskStatusItems } from '../hooks/use-label-items';
import { itemCreator } from '../../../components/settings/create-settings-item';
import { type TaskContext, taskNumber, taskNumbered } from '../hooks/use-task-context';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { personName } from '../../../components/people/people-options';
import { personOptionRenderer } from '../../../components/people/person-option';

/**
 * Link to a task, "#12 Title".
 * @param {object} props Component props.
 * @param {Task} props.task Task.
 * @param {boolean} [props.closed] Shown struck through. Optional.
 * @returns {JSX.Element} Link.
 */
export function TaskRef({ task, closed, blocked }: { task: Task; closed?: boolean; blocked?: boolean }) {
  // Opens the task in the side panel, over the current page.
  const link = useTaskLink();
  return (
    <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
      <TaskStateIcon closed={closed ?? task.closed} blocked={blocked} />
      <Anchor component={Link} to={link.to(task.id)} size="sm" truncate>
        <Text span c="dimmed" size="sm">
          {taskNumber(task)}
        </Text>{' '}
        {task.label}
      </Anchor>
    </Group>
  );
}

interface LabelSelectProps extends Omit<SelectProps, 'data'> {
  labels: TaskLabel[];
  /** Kind of label: given, what is typed and is none of them can be created. Optional. */
  kind?: Exclude<TaskLabelKind, 'tag'>;
}

/** Titles of the panel creating a label. */
const NEW_LABEL_TITLES: Record<TaskLabelKind, string> = { status: 'Nouveau statut', priority: 'Nouvelle priorité', type: 'Nouveau type', tag: 'Nouvelle étiquette' };

/**
 * Creates a task label named as typed: its settings form (color, image…) in the side panel, resolving its id.
 * @param {TaskLabelKind} kind Kind of label.
 * @returns {(name: string) => Promise<string | null>} Creator.
 */
function useLabelCreator(kind: TaskLabelKind) {
  const status = useTaskStatusItems();
  const label = useTaskLabelItems(kind === 'status' ? 'tag' : kind);
  return kind === 'status' ? itemCreator(NEW_LABEL_TITLES.status, status) : itemCreator(NEW_LABEL_TITLES[kind], label);
}

/**
 * Select of a status, priority or type.
 * @param {LabelSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function LabelSelect({ labels, value, onChange, kind, ...props }: LabelSelectProps) {
  const create = useLabelCreator(kind ?? 'status');
  return <CreatableSelect onCreate={kind ? create : undefined} {...itemSelectProps(labels, value)} value={value} onChange={onChange} clearable placeholder="Aucun" {...props} />;
}

interface TagsSelectProps {
  tags: TaskLabel[];
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * Multi-select of tags, with their color.
 * @param {TagsSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function TagsSelect({ tags, value, onChange }: TagsSelectProps) {
  const create = useLabelCreator('tag');
  return (
    <BatchMultiSelect
      onCreate={create}
      label="Étiquettes"
      placeholder={value.length ? undefined : 'Aucune'}
      {...listSelectProps(tags, undefined, value)}
      value={value}
      onChange={onChange}
      searchable
      clearable
      nothingFoundMessage="Aucune étiquette : tapez son libellé pour la créer"
    />
  );
}

interface AssigneesSelectProps {
  contributors: Contributor[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  /** Help under the field. Optional. */
  description?: string;
  error?: string;
}

/**
 * Multi-select of contributors, with their avatar and handle (assignees of a task, a routine).
 * @param {AssigneesSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function AssigneesSelect({ contributors, value, onChange, label = 'Assignés', description, error }: AssigneesSelectProps) {
  const byId = mapById(contributors);
  return (
    <PeopleSelect
      label={label}
      description={description}
      data={contributors.map((contributor) => ({ value: contributor.id, label: personName(contributor) }))}
      renderOption={personOptionRenderer(byId)}
      value={value}
      onChange={onChange}
      error={error}
      nothingFoundMessage="Aucun contributeur"
    />
  );
}

interface ProjectSelectProps extends Omit<SelectProps, 'data'> {
  context: TaskContext;
}

/**
 * Select of an active project, in tree order under its client.
 * @param {ProjectSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function ProjectSelect({ context, ...props }: ProjectSelectProps) {
  const options = context.projectOptions(unarchived(context.projects, props.value));
  return <Select {...treeSelectProps(options)} searchable nothingFoundMessage="Aucun projet" {...props} />;
}

interface TaskSelectProps extends Omit<SelectProps, 'data'> {
  /** Candidate tasks. */
  tasks: Task[];
  /** Label of a task (its number is only unique in its project); "#12 Title" by default. */
  labelOf?: (task: Task) => string;
  /** Context of the tasks: given, the tasks show in tree order under their parent task, project and client. Optional. */
  context?: TaskContext;
}

/**
 * Searchable select of a task, "#12 Title" (or the label given, with the project of the task); with the context, in
 * tree order under their parent task, project and client.
 * @param {TaskSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function TaskSelect({ tasks, labelOf = (task) => taskNumbered(task), context, ...props }: TaskSelectProps) {
  return (
    <Select
      {...(context ? treeSelectProps(context.taskOptions(tasks)) : { data: tasks.map((task) => ({ value: task.id, label: labelOf(task) })) })}
      searchable
      clearable
      nothingFoundMessage="Aucune tâche"
      {...props}
    />
  );
}

/**
 * Task state icon, shown before task titles: open (green), closed (violet), or blocked by an open task
 * (red padlock), like issues on GitHub.
 * @param {{ closed: boolean, blocked?: boolean }} props Component props.
 * @returns {JSX.Element} Icon with its tooltip.
 */
export function TaskStateIcon({ closed, blocked = false }: { closed: boolean; blocked?: boolean }) {
  const [label, color, icon] = closed
    ? ['Fermée', 'violet', <CheckCircleIcon weight="fill" key="i" />]
    : blocked
      ? ['Bloquée : dépend d’au moins une tâche encore ouverte', 'red', <LockIcon weight="fill" key="i" />]
      : ['Ouverte', 'green', <CircleIcon weight="bold" key="i" />];
  return (
    <Tooltip label={label} withArrow>
      <Box component="span" c={`${color}.6`} aria-label={label} role="img" style={{ display: 'inline-flex', flex: 'none' }}>
        {icon}
      </Box>
    </Tooltip>
  );
}
