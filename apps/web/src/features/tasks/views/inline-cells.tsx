import { Avatar, Checkbox, ColorSwatch, Group, Menu, Popover, Stack, Text, UnstyledButton } from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { CheckIcon } from '@phosphor-icons/react';
import { forwardRef, useState, type MouseEvent, type ReactNode } from 'react';
import { notifyError } from '../../../lib/notify';
import { useUpdateTask, type Task, type TaskInputValues, type TaskLabel } from '../api';
import { Assignees, LabelBadge } from '../task-ui';
import type { TaskContext } from '../use-task-context';
import classes from './inline-cells.module.css';

/**
 * Stops the row click (which opens the panel) when interacting with a cell editor.
 * @param {MouseEvent} event Click event.
 * @returns {void}
 */
const stop = (event: MouseEvent) => event.stopPropagation();

/**
 * Saves a single task change and reports errors.
 * @returns {(task: Task, input: Omit<TaskInputValues, 'projectId'>) => void} Saver.
 */
function useSave() {
  const updateTask = useUpdateTask();
  return (task: Task, input: Omit<TaskInputValues, 'projectId'>) =>
    updateTask.mutate({ id: task.id, input }, { onError: (error) => notifyError(error.message) });
}

/**
 * Button filling the cell, opening its editor (the menu / popover target passes its ref and handlers).
 * @param {object} props Component props.
 * @param {ReactNode} props.children Displayed value, or null for an empty cell.
 * @param {string} props.label Accessible name.
 * @returns {JSX.Element} Trigger.
 */
const CellTrigger = forwardRef<HTMLButtonElement, { children: ReactNode; label: string }>(function CellTrigger(
  { children, label, ...props },
  ref,
) {
  return (
    <UnstyledButton
      ref={ref}
      className={classes.trigger}
      aria-label={label}
      {...props}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        (props as { onClick?: (event: MouseEvent<HTMLButtonElement>) => void }).onClick?.(event);
      }}
    >
      {children ?? <span className={classes.empty}>—</span>}
    </UnstyledButton>
  );
});

interface LabelCellProps {
  task: Task;
  field: 'statusId' | 'priorityId' | 'typeId';
  labels: TaskLabel[];
  /** "Statut", "Priorité", "Type". */
  name: string;
}

/**
 * Status, priority or type cell, editable from a menu.
 * @param {LabelCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function LabelCell({ task, field, labels, name }: LabelCellProps) {
  const save = useSave();
  const current = labels.find((label) => label.id === task[field]);
  return (
    <Menu position="bottom-start" withinPortal shadow="md">
      <Menu.Target>
        <CellTrigger label={`${name} de la tâche #${task.number}`}>{current ? <LabelBadge label={current} /> : null}</CellTrigger>
      </Menu.Target>
      <Menu.Dropdown onClick={stop}>
        {labels.map((label) => (
          <Menu.Item
            key={label.id}
            leftSection={<ColorSwatch color={label.color} size={10} />}
            rightSection={label.id === current?.id ? <CheckIcon aria-hidden /> : undefined}
            onClick={() => label.id !== current?.id && save(task, { [field]: label.id })}
          >
            {label.name}
          </Menu.Item>
        ))}
        {labels.length > 0 && <Menu.Divider />}
        <Menu.Item disabled={!current} onClick={() => save(task, { [field]: null })}>
          Aucun
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/**
 * Assignees cell, editable from a checklist.
 * @param {{ task: Task, context: TaskContext }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function AssigneesCell({ task, context }: { task: Task; context: TaskContext }) {
  const save = useSave();
  const assigned = task.assigneeIds.map((id) => context.contributorById.get(id)).filter((item) => item !== undefined);
  return (
    <Popover position="bottom-start" withinPortal shadow="md">
      <Popover.Target>
        <CellTrigger label={`Assignés de la tâche #${task.number}`}>
          {assigned.length ? <Assignees contributors={assigned} /> : null}
        </CellTrigger>
      </Popover.Target>
      <Popover.Dropdown onClick={stop}>
        {context.contributors.length === 0 ? (
          <Text size="sm" c="dimmed">
            Aucun contributeur (voir Paramètres).
          </Text>
        ) : (
          <Stack gap={6}>
            {context.contributors.map((contributor) => (
              <Checkbox
                key={contributor.id}
                checked={task.assigneeIds.includes(contributor.id)}
                onChange={(event) =>
                  save(task, {
                    assigneeIds: event.currentTarget.checked
                      ? [...task.assigneeIds, contributor.id]
                      : task.assigneeIds.filter((id) => id !== contributor.id),
                  })
                }
                label={
                  <Group gap={6} wrap="nowrap">
                    <Avatar src={contributor.avatarUrl} name={contributor.name} color="initials" size={20} />
                    {contributor.name}
                  </Group>
                }
              />
            ))}
          </Stack>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

interface DateCellProps {
  task: Task;
  field: 'startDate' | 'endDate';
  /** Shown in red (overdue end date). */
  alert?: boolean;
}

/**
 * Start or end date cell, editable from a calendar.
 * @param {DateCellProps} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function DateCell({ task, field, alert }: DateCellProps) {
  const save = useSave();
  const [opened, setOpened] = useState(false);
  const value = task[field];
  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" withinPortal shadow="md">
      <Popover.Target>
        <CellTrigger label={`${field === 'startDate' ? 'Début' : 'Fin'} de la tâche #${task.number}`}>
          {value ? (
            <Text span size="sm" c={alert ? 'red' : undefined} fw={alert ? 600 : undefined}>
              {dateFormat.format(new Date(`${value}T00:00:00Z`))}
            </Text>
          ) : null}
        </CellTrigger>
      </Popover.Target>
      <Popover.Dropdown onClick={stop}>
        <Stack gap="xs">
          <DatePicker
            value={value}
            minDate={field === 'endDate' ? (task.startDate ?? undefined) : undefined}
            maxDate={field === 'startDate' ? (task.endDate ?? undefined) : undefined}
            onChange={(date) => {
              save(task, { [field]: date });
              setOpened(false);
            }}
          />
          {value && (
            <UnstyledButton
              className={classes.clear}
              onClick={() => {
                save(task, { [field]: null });
                setOpened(false);
              }}
            >
              Effacer la date
            </UnstyledButton>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
