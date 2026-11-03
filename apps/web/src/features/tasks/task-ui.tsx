import {
  Anchor,
  Box,
  Avatar,
  Badge,
  ColorSwatch,
  Group,
  MultiSelect,
  Select,
  Text,
  Tooltip,
  type ComboboxItem,
  type SelectProps,
} from '@mantine/core';
import { CheckCircleIcon, CircleIcon, LockIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useTaskLink } from './use-task-link';
import type { Contributor, Task, TaskLabel } from './api';
import type { TaskContext } from './use-task-context';

/**
 * Colored badge of a status, priority or type.
 * @param {object} props Component props.
 * @param {TaskLabel | undefined} props.label Label, or undefined for none.
 * @returns {JSX.Element | null} Badge.
 */
export function LabelBadge({ label }: { label: TaskLabel | undefined }) {
  if (!label) return null;
  return (
    <Badge variant="light" color={label.color} radius="sm" style={{ textTransform: 'none' }}>
      {label.name}
    </Badge>
  );
}

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
      <Anchor component={Link} to={link.to(task.number)} size="sm" truncate>
        <Text span c="dimmed" size="sm">
          #{task.number}
        </Text>{' '}
        {task.title}
      </Anchor>
    </Group>
  );
}

/**
 * Option renderer showing the label color.
 * @param {{ option: ComboboxItem }} props Option props.
 * @returns {JSX.Element} Option.
 */
function ColorOption({ option }: { option: ComboboxItem }) {
  const color = (option as ComboboxItem & { color?: string }).color;
  return (
    <Group gap="xs" wrap="nowrap">
      {color && <ColorSwatch color={color} size={10} />}
      {option.label}
    </Group>
  );
}

interface LabelSelectProps extends Omit<SelectProps, 'data'> {
  labels: TaskLabel[];
}

/**
 * Select of a status, priority or type.
 * @param {LabelSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function LabelSelect({ labels, value, onChange, ...props }: LabelSelectProps) {
  const current = labels.find((label) => label.id === value);
  return (
    <Select
      data={labels.map((label) => ({ value: label.id, label: label.name, color: label.color }))}
      renderOption={({ option }) => <ColorOption option={option} />}
      leftSection={current ? <ColorSwatch color={current.color} size={10} /> : undefined}
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
  return (
    <MultiSelect
      label="Étiquettes"
      placeholder={value.length ? undefined : 'Aucune'}
      data={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
      renderOption={({ option }) => (
        <Group gap="xs" wrap="nowrap">
          <ColorSwatch color={tags.find((tag) => tag.id === option.value)?.color ?? 'gray'} size={10} />
          <Text size="sm">{option.label}</Text>
        </Group>
      )}
      value={value}
      onChange={onChange}
      searchable
      clearable
      nothingFoundMessage="Aucune étiquette : créez-en dans Paramètres › Tâches"
    />
  );
}

interface AssigneesSelectProps {
  contributors: Contributor[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  error?: string;
}

/**
 * Multi-select of contributors.
 * @param {AssigneesSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function AssigneesSelect({ contributors, value, onChange, label = 'Assignés', error }: AssigneesSelectProps) {
  return (
    <MultiSelect
      label={label}
      placeholder={value.length ? undefined : 'Personne'}
      data={contributors.map((contributor) => ({
        value: contributor.id,
        label: contributor.isMe ? `${contributor.name} (moi)` : contributor.name,
      }))}
      renderOption={({ option }) => {
        const contributor = contributors.find((item) => item.id === option.value);
        return (
          <Group gap="xs" wrap="nowrap">
            <Avatar src={contributor?.avatarUrl} name={option.label} color="initials" size={20} />
            <Text size="sm">{option.label}</Text>
            <Text size="xs" c="dimmed">
              @{contributor?.handle}
            </Text>
          </Group>
        );
      }}
      value={value}
      onChange={onChange}
      searchable
      clearable
      error={error}
      nothingFoundMessage="Aucun contributeur"
    />
  );
}

interface ProjectSelectProps extends Omit<SelectProps, 'data'> {
  context: TaskContext;
}

/**
 * Select of an active project, labelled with its full path.
 * @param {ProjectSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function ProjectSelect({ context, ...props }: ProjectSelectProps) {
  const data = context.projects
    .filter((project) => !project.archived || project.id === props.value)
    .map((project) => ({ value: project.id, label: context.projectLabel(project.id) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  return <Select data={data} searchable nothingFoundMessage="Aucun projet" {...props} />;
}

interface TaskSelectProps extends Omit<SelectProps, 'data'> {
  /** Candidate tasks. */
  tasks: Task[];
}

/**
 * Searchable select of a task, "#12 Title".
 * @param {TaskSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function TaskSelect({ tasks, ...props }: TaskSelectProps) {
  return (
    <Select
      data={tasks.map((task) => ({ value: task.id, label: `#${task.number} ${task.title}` }))}
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
