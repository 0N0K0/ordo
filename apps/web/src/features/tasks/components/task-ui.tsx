import { Anchor, Box, Avatar, Group, Select, Text, Tooltip, type SelectProps } from '@mantine/core';
import { PeopleSelect } from '../../../components/people/PeopleSelect';
import { PersonOption } from '../../../components/people/PersonOption';
import { ItemAvatar } from '../../../components/settings/ItemAvatar';
import { listSelectProps } from '../../../components/settings/item-look';
import { CheckCircleIcon, CircleIcon, LockIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useTaskLink } from '../hooks/use-task-link';
import { useTaskLabelMutations, type Contributor, type Task, type TaskLabel, type TaskLabelKind } from '../api';
import { taskRef, type TaskContext } from '../hooks/use-task-context';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { CreatableSelect } from '../../../components/inputs/CreatableSelect';
import { useDefaultColor } from '../../workspace/hooks/use-default-color';

/**
 * Stacked avatars of the assignees.
 * @param {object} props Component props.
 * @param {Contributor[]} props.contributors Assignees.
 * @param {number} [props.max=3] Avatars shown before "+N". Optional. Default = 3.
 * @returns {JSX.Element | null} Avatars.
 */
export function Assignees({ contributors, max = 3 }: { contributors: Contributor[]; max?: number }) {
  if (contributors.length === 0) return null;
  const shown = contributors.slice(0, max);
  return (
    <Tooltip label={contributors.map((contributor) => (contributor.isMe ? `${contributor.name} (moi)` : contributor.name)).join(', ')} withArrow>
      <Avatar.Group spacing="xs">
        {shown.map((contributor) => (
          <Avatar key={contributor.id} src={contributor.avatarUrl} name={contributor.name} color="initials" size="sm" />
        ))}
        {contributors.length > max && <Avatar size="sm">+{contributors.length - max}</Avatar>}
      </Avatar.Group>
    </Tooltip>
  );
}

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
          {taskRef(task).trim()}
        </Text>{' '}
        {task.title}
      </Anchor>
    </Group>
  );
}

interface LabelSelectProps extends Omit<SelectProps, 'data'> {
  labels: TaskLabel[];
  /** Kind of label: given, what is typed and is none of them can be created. Optional. */
  kind?: Exclude<TaskLabelKind, 'tag'>;
}

/**
 * Creates a task label named as typed (the default color), resolving its id.
 * @param {TaskLabelKind} kind Kind of label.
 * @returns {(name: string) => Promise<string | null>} Creator.
 */
function useLabelCreator(kind: TaskLabelKind) {
  const { create } = useTaskLabelMutations(kind);
  const color = useDefaultColor();
  return async (name: string) => {
    const result = (await create.mutateAsync({ name, color })) as Record<string, { id: string } | undefined>;
    return Object.values(result)[0]?.id ?? null;
  };
}

/**
 * Select of a status, priority or type.
 * @param {LabelSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function LabelSelect({ labels, value, onChange, kind, ...props }: LabelSelectProps) {
  const current = labels.find((label) => label.id === value);
  const create = useLabelCreator(kind ?? 'status');
  return (
    <CreatableSelect
      onCreate={kind ? create : undefined}
      {...listSelectProps(labels)}
      leftSection={current ? <ItemAvatar name={current.name} iconUrl={current.iconUrl} color={current.color} /> : undefined}
      value={value}
      onChange={onChange}
      clearable
      placeholder="Aucun"
      {...props}
    />
  );
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
      {...listSelectProps(tags)}
      value={value}
      onChange={onChange}
      searchable
      clearable
      nothingFoundMessage="Aucune étiquette : tapez son nom pour la créer"
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
 * Multi-select of contributors, with their avatar and handle (assignees of a task, a routine, people of an event).
 * @param {AssigneesSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function AssigneesSelect({ contributors, value, onChange, label = 'Assignés', description, error }: AssigneesSelectProps) {
  const byId = new Map(contributors.map((contributor) => [contributor.id, contributor]));
  return (
    <PeopleSelect
      label={label}
      description={description}
      data={contributors.map((contributor) => ({ value: contributor.id, label: contributor.isMe ? `${contributor.name} (moi)` : contributor.name }))}
      renderOption={({ option }) => {
        const contributor = byId.get(option.value);
        return <PersonOption name={contributor?.name ?? option.label} label={option.label} avatarUrl={contributor?.avatarUrl} hint={contributor?.handle ? `@${contributor.handle}` : undefined} />;
      }}
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
  const options = context.projectOptions(context.projects.filter((project) => !project.archived || project.id === props.value));
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
export function TaskSelect({ tasks, labelOf = (task) => `${taskRef(task)}${task.title}`, context, ...props }: TaskSelectProps) {
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
