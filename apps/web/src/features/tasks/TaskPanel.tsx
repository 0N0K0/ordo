import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  CloseButton,
  Divider,
  Drawer,
  Grid,
  Group,
  Menu,
  NumberInput,
  Progress,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { taskTitleSchema } from '@ordo/shared';
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  ArrowsLeftRightIcon,
  CheckCircleIcon,
  CopyIcon,
  DotsThreeIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorIcon } from '../../components/feedback-icons';
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor';
import { MarkdownView } from '../../components/markdown/MarkdownView';
import { notifyError } from '../../lib/notify';
import { useSetTasksClosed, useTaskBlock, useTaskRelation, useUpdateTask, type Task, type TaskInputValues } from './api';
import { TaskTime } from '../time/TaskTime';
import { TaskComments } from './TaskComments';
import { linkableTasks, subtreeIds } from './task-links';
import { AssigneesSelect, LabelSelect, TaskRef, TaskSelect, TaskStateIcon } from './task-ui';
import { useTaskActions } from './use-task-actions';
import { useTaskContext, type TaskContext } from './use-task-context';
import { TASK_PARAM, useTaskLink } from './use-task-link';

/**
 * Property block of the side column.
 * @param {object} props Component props.
 * @param {string} props.label Property name.
 * @param {ReactNode} props.children Content.
 * @returns {JSX.Element} Block.
 */
function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap={4}>
      <Text size="xs" fw={600} c="dimmed" tt="uppercase">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

interface LinkListProps {
  label: string;
  tasks: Task[];
  candidates: Task[];
  context: TaskContext;
  onAdd: (taskId: string) => void;
  onRemove: (taskId: string) => void;
}

/**
 * Linked tasks ("bloque", "dépend de", "relative à") with add and remove.
 * @param {LinkListProps} props Component props.
 * @returns {JSX.Element} List.
 */
function LinkList({ label, tasks, candidates, context, onAdd, onRemove }: LinkListProps) {
  const [adding, setAdding] = useState(false);
  const linked = new Set(tasks.map((task) => task.id));
  return (
    <Property label={label}>
      {tasks.length === 0 && !adding && (
        <Text size="sm" c="dimmed">
          Aucune
        </Text>
      )}
      {tasks.map((task) => (
        <Group key={task.id} gap={4} wrap="nowrap" justify="space-between">
          <TaskRef task={task} blocked={context.isBlocked(task)} />
          <CloseButton size="xs" aria-label={`Retirer #${task.number}`} onClick={() => onRemove(task.id)} />
        </Group>
      ))}
      {adding ? (
        <TaskSelect
          tasks={candidates.filter((candidate) => !linked.has(candidate.id))}
          size="xs"
          placeholder="Rechercher une tâche"
          autoFocus
          defaultDropdownOpened
          onChange={(taskId) => {
            if (taskId) onAdd(taskId);
            setAdding(false);
          }}
          onBlur={() => setAdding(false)}
        />
      ) : (
        <Button
          variant="subtle"
          size="compact-xs"
          leftSection={<PlusIcon aria-hidden />}
          onClick={() => setAdding(true)}
          style={{ alignSelf: 'flex-start' }}
        >
          Ajouter
        </Button>
      )}
    </Property>
  );
}

interface TaskDetailProps {
  task: Task;
  context: TaskContext;
}

/**
 * Detail of a task: title, description, sub-tasks and comments, with properties and links on the side.
 * @param {TaskDetailProps} props Component props.
 * @returns {JSX.Element} Detail.
 */
function TaskDetail({ task, context }: TaskDetailProps) {
  const updateTask = useUpdateTask();
  const setClosed = useSetTasksClosed();
  const taskBlock = useTaskBlock();
  const taskRelation = useTaskRelation();
  const actions = useTaskActions(context);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);

  /**
   * Saves a change right away.
   * @param {Omit<TaskInputValues, 'projectId'>} input Changed fields.
   * @param {() => void} [onSuccess] Called once saved. Optional.
   * @returns {void}
   */
  const save = (input: Omit<TaskInputValues, 'projectId'>, onSuccess?: () => void) =>
    updateTask.mutate({ id: task.id, input }, { onSuccess, onError: (error) => notifyError(error.message) });

  /**
   * Validates and saves the edited title.
   * @returns {void}
   */
  const saveTitle = () => {
    const result = taskTitleSchema.safeParse(titleDraft ?? '');
    if (!result.success) {
      setTitleError(result.error.issues[0]?.message ?? 'Titre invalide.');
      return;
    }
    if (result.data === task.title) setTitleDraft(null);
    else save({ title: result.data }, () => setTitleDraft(null));
  };

  const onLinkError = { onError: (error: Error) => notifyError(error.message) };
  const parent = task.parentId ? context.taskById.get(task.parentId) : undefined;
  const subtasks = context.childrenOf(task.id);
  const doneSubtasks = subtasks.filter((subtask) => context.isClosed(subtask)).length;
  const excluded = subtreeIds(context, task.id);
  const candidates = linkableTasks(context, task.projectId, task.id);
  const resolve = (ids: string[]) => ids.map((id) => context.taskById.get(id)).filter((item): item is Task => !!item);

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        {titleDraft === null ? (
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Title order={2} size="h3" style={{ wordBreak: 'break-word' }}>
              {task.title}{' '}
              <Text span c="dimmed" inherit fw={400}>
                #{task.number}
              </Text>
            </Title>
            <Group gap="xs" wrap="nowrap">
              <Button
                variant="default"
                size="xs"
                color={task.closed ? 'green' : 'violet'}
                leftSection={task.closed ? <ArrowCounterClockwiseIcon aria-hidden /> : <CheckCircleIcon aria-hidden />}
                loading={setClosed.isPending}
                onClick={() =>
                  setClosed.mutate(
                    { ids: [task.id], closed: !task.closed },
                    { onError: (error) => notifyError(error.message) },
                  )
                }
              >
                {task.closed ? 'Rouvrir' : 'Fermer la tâche'}
              </Button>
              <Button variant="default" size="xs" onClick={() => setTitleDraft(task.title)}>
                Modifier
              </Button>
              <Menu position="bottom-end" withinPortal shadow="md">
                <Menu.Target>
                  <ActionIcon variant="default" size="input-xs" aria-label="Actions sur la tâche">
                    <DotsThreeIcon weight="bold" aria-hidden />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item leftSection={<CopyIcon aria-hidden />} onClick={() => actions.clone(task)}>
                    Cloner
                  </Menu.Item>
                  <Menu.Item leftSection={<ArrowsLeftRightIcon aria-hidden />} onClick={() => actions.transfer(task)}>
                    Transférer
                  </Menu.Item>
                  <Menu.Item
                    leftSection={task.archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
                    onClick={() => actions.archive(task, !task.archived)}
                  >
                    {task.archived ? 'Désarchiver' : 'Archiver'}
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item leftSection={<TrashIcon aria-hidden />} color="red" onClick={() => actions.remove(task)}>
                    Supprimer
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        ) : (
          <Group gap="xs" align="flex-start" wrap="nowrap">
            <TextInput
              value={titleDraft}
              error={titleError}
              onChange={(event) => {
                setTitleDraft(event.currentTarget.value);
                setTitleError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveTitle();
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  setTitleDraft(null);
                }
              }}
              aria-label="Titre"
              autoFocus
              style={{ flex: 1 }}
            />
            <Button onClick={saveTitle} loading={updateTask.isPending}>
              Enregistrer
            </Button>
            <Button variant="default" onClick={() => setTitleDraft(null)}>
              Annuler
            </Button>
          </Group>
        )}
        <Group gap="xs">
          <TaskStateIcon closed={task.closed} blocked={context.isBlocked(task)} />
          {task.archived && (
            <Badge color="gray" variant="light" leftSection={<ArchiveIcon aria-hidden />}>
              Archivée
            </Badge>
          )}
          <Anchor component={Link} to={`/projects/${task.projectId}`} size="sm">
            {context.projectLabel(task.projectId)}
          </Anchor>
        </Group>
      </Stack>

      <Grid gap="xl">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="lg">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                  Description
                </Text>
                {description === null && (
                  <Tooltip label="Modifier la description">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      aria-label="Modifier la description"
                      onClick={() => setDescription(task.description ?? '')}
                    >
                      <PencilSimpleIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
              {description === null ? (
                <MarkdownView targets={context.targets}>{task.description}</MarkdownView>
              ) : (
                <Stack gap="xs">
                  <MarkdownEditor
                    value={description}
                    onChange={setDescription}
                    suggestions={context.suggestions}
                    autoFocus
                    onSubmitShortcut={() => save({ description: description || null }, () => setDescription(null))}
                  />
                  <Group justify="flex-end" gap="xs">
                    <Button variant="default" size="xs" onClick={() => setDescription(null)}>
                      Annuler
                    </Button>
                    <Button
                      size="xs"
                      loading={updateTask.isPending}
                      onClick={() => save({ description: description || null }, () => setDescription(null))}
                    >
                      Enregistrer
                    </Button>
                  </Group>
                </Stack>
              )}
            </Stack>

            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="xs">
                  <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                    Sous-tâches
                  </Text>
                  {subtasks.length > 0 && (
                    <Text size="xs" c="dimmed">
                      {doneSubtasks}/{subtasks.length}
                    </Text>
                  )}
                </Group>
                {!task.archived && (
                  <Button
                    variant="subtle"
                    size="compact-xs"
                    leftSection={<PlusIcon aria-hidden />}
                    onClick={() => actions.create({ parentId: task.id })}
                  >
                    Ajouter
                  </Button>
                )}
              </Group>
              {subtasks.length > 0 ? (
                <>
                  <Progress value={(doneSubtasks / subtasks.length) * 100} size="sm" aria-label="Avancement des sous-tâches" />
                  {subtasks.map((subtask) => (
                    <TaskRef key={subtask.id} task={subtask} blocked={context.isBlocked(subtask)} />
                  ))}
                </>
              ) : (
                <Text size="sm" c="dimmed">
                  Aucune sous-tâche.
                </Text>
              )}
            </Stack>

            <Divider />
            <Stack gap="xs">
              <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                Commentaires
              </Text>
              <TaskComments task={task} context={context} />
            </Stack>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            <LabelSelect
              label="Statut"
              labels={context.statuses}
              value={task.statusId}
              onChange={(statusId) => save({ statusId })}
            />
            <LabelSelect
              label="Priorité"
              labels={context.priorities}
              value={task.priorityId}
              onChange={(priorityId) => save({ priorityId })}
            />
            <LabelSelect label="Type" labels={context.types} value={task.typeId} onChange={(typeId) => save({ typeId })} />
            <AssigneesSelect
              contributors={context.assignableFor([task.projectId], task.assigneeIds)}
              value={task.assigneeIds}
              onChange={(assigneeIds) => save({ assigneeIds })}
            />
            <NumberInput
              key={`effort-${task.effort}`}
              label="Effort"
              min={0}
              decimalScale={2}
              decimalSeparator=","
              defaultValue={task.effort ?? ''}
              onBlur={(event) => {
                const raw = event.currentTarget.value.replace(',', '.').trim();
                const effort = raw === '' ? null : Number(raw);
                if (effort !== task.effort && (effort === null || Number.isFinite(effort))) save({ effort });
              }}
            />
            <TaskTime task={task} />
            <Group grow gap="xs">
              <DatePickerInput
                label="Début"
                clearable
                placeholder="—"
                value={task.startDate}
                maxDate={task.endDate ?? undefined}
                onChange={(startDate) => save({ startDate })}
              />
              <DatePickerInput
                label="Fin"
                clearable
                placeholder="—"
                value={task.endDate}
                minDate={task.startDate ?? undefined}
                onChange={(endDate) => save({ endDate })}
              />
            </Group>
            <TaskSelect
              label="Tâche parente"
              placeholder="Aucune"
              tasks={candidates.filter((candidate) => !excluded.has(candidate.id) || candidate.id === parent?.id)}
              value={task.parentId}
              onChange={(parentId) => save({ parentId })}
            />
            <Select
              label="Jalon"
              placeholder="Aucun"
              data={context.milestonesFor(task.projectId).map((milestone) => ({ value: milestone.id, label: milestone.title }))}
              value={task.milestoneId}
              onChange={(milestoneId) => save({ milestoneId })}
              clearable
              searchable
              nothingFoundMessage="Aucun jalon dans ce projet"
            />
            <Divider />
            <LinkList
              label="Bloque"
              tasks={resolve(task.blockingIds)}
              candidates={candidates}
              context={context}
              onAdd={(id) => taskBlock.mutate({ add: true, blockerId: task.id, blockedId: id }, onLinkError)}
              onRemove={(id) => taskBlock.mutate({ add: false, blockerId: task.id, blockedId: id }, onLinkError)}
            />
            <LinkList
              label="Dépend de"
              tasks={resolve(task.blockedByIds)}
              candidates={candidates}
              context={context}
              onAdd={(id) => taskBlock.mutate({ add: true, blockerId: id, blockedId: task.id }, onLinkError)}
              onRemove={(id) => taskBlock.mutate({ add: false, blockerId: id, blockedId: task.id }, onLinkError)}
            />
            <LinkList
              label="Relative à"
              tasks={resolve(task.relatedIds)}
              candidates={candidates}
              context={context}
              onAdd={(id) => taskRelation.mutate({ add: true, taskId: task.id, otherId: id }, onLinkError)}
              onRemove={(id) => taskRelation.mutate({ add: false, taskId: task.id, otherId: id }, onLinkError)}
            />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

/**
 * Side panel showing the task of the URL (?task=12) over the current page.
 * @returns {JSX.Element | null} Drawer, when a task is requested.
 */
export function TaskPanel() {
  const [params] = useSearchParams();
  const link = useTaskLink();
  const number = params.get(TASK_PARAM);
  const { context, isPending } = useTaskContext();
  if (!number) return null;
  const task = context?.taskByNumber.get(Number(number));

  return (
    <Drawer
      opened
      onClose={link.close}
      position="right"
      size="min(72rem, 100%)"
      title={
        <Text size="sm" c="dimmed">
          Tâche #{number}
        </Text>
      }
      padding="lg"
    >
      {isPending ? (
        <Stack gap="md">
          <Skeleton height={32} width="60%" />
          <Skeleton height={160} />
        </Stack>
      ) : task && context ? (
        <TaskDetail key={task.id} task={task} context={context} />
      ) : (
        <Alert color="red" icon={<ErrorIcon />} title="Tâche introuvable">
          La tâche #{number} n’existe pas ou a été supprimée.
        </Alert>
      )}
    </Drawer>
  );
}
