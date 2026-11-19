import { useSearchParam } from '../../../lib/search-params';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { IconAction } from '../../../components/actions/IconAction';
import { PAGES, projectPath } from '../../../app/pages';
import { TaskProgress } from './TaskProgress';
import { SubSection } from '../../../components/page/SubSection';
import { FormActions } from '../../../components/dialogs/FormActions';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';

import { EmptyState } from '../../../components/feedback/EmptyState';
import { DetailSkeleton } from '../../../components/feedback/Skeletons';
import { SidePanel } from '../../../components/panels/SidePanel';
import { Anchor, Badge, Divider, Fieldset, Grid, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { readSlotRule, taskLabelSchema, subtreeOf } from '@ordo/shared';
import { ArrowCounterClockwiseIcon, CheckCircleIcon, GithubLogoIcon, PencilSimpleIcon, ArrowsLeftRightIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';

import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { localToday } from '../../../lib/dates';
import { ON_ERROR, onMutationError, toastCallbacks } from '../../../lib/notify';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { useBulkTaskMutations, useSetTasksClosed, useTaskBlock, useTaskRelation, useUpdateTask, type Task, type TaskInputValues } from '../api';
import { TaskAlarms } from '../../alarms/components/TaskAlarms';
import { TaskShopping } from '../../shopping/components/TaskShopping';
import { SheetsSection } from '../../sheets/components/SheetsSection';
import { TaskTime } from '../../time/components/TaskTime';
import { TaskComments } from './TaskComments';
import { TaskRecurrence } from './TaskRecurrence';
import { linkableTasks } from '../lib/task-links';
import { AssigneesSelect, LabelSelect, ProjectSelect, TagsSelect, TaskRef, TaskSelect, TaskStateIcon } from './task-ui';
import { useTaskActions } from '../hooks/use-task-actions';

import { type TaskContext, taskName, taskNumber, useTaskContext } from '../hooks/use-task-context';
import { TASK_PARAM, useTaskLink } from '../hooks/use-task-link';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { SlotRuleInput } from '../../calendar/components/SlotRuleInput';
import { BeneficiariesSelect } from '../../beneficiaries/components/BeneficiariesSelect';
import { removedLinksNote } from '../lib/bulk-label';
import { dateRangeProps } from '../../../components/inputs/date-range';
import { DetailHeader } from '../../../components/page/DetailHeader';
import { EffortInput } from './EffortInput';
import { DetailNotFound } from '../../../components/feedback/DetailNotFound';
import { ActionButton } from '../../../components/actions/ActionButton';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { EXTERNAL_LINK } from '../../../components/actions/link-props';

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
    <SubSection title={label}>
      {tasks.length === 0 && !adding && (
        <Text size="sm" c="dimmed">
          Aucune
        </Text>
      )}
      {tasks.map((task) => (
        <Group key={task.id} gap={4} wrap="nowrap" justify="space-between">
          <TaskRef task={task} blocked={context.isBlocked(task)} />
          <RemoveButton variant="field" size="xs" label="Retirer" item={taskName(task)} onClick={() => onRemove(task.id)} />
        </Group>
      ))}
      {adding ? (
        <TaskSelect
          context={context}
          labelOf={(candidate) => context.taskLabel(candidate)}
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
        <AddItemButton onClick={() => setAdding(true)}>Ajouter une tâche</AddItemButton>
      )}
    </SubSection>
  );
}

interface TaskDetailProps {
  task: Task;
  context: TaskContext;
}

/**
 * Detail of a task: title, description, sub-tasks and comments, with properties and links on the side. An archived
 * task is read only (its fields disabled; « Restaurer » in its menu).
 * @param {TaskDetailProps} props Component props.
 * @returns {JSX.Element} Detail.
 */
function TaskDetail({ task, context }: TaskDetailProps) {
  const updateTask = useUpdateTask();
  const setClosed = useSetTasksClosed();
  const { transfer: transferTask } = useBulkTaskMutations();
  const taskBlock = useTaskBlock();
  const taskRelation = useTaskRelation();
  const actions = useTaskActions(context);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const locked = task.archived;

  /**
   * Saves a change right away.
   * @param {Omit<TaskInputValues, 'projectId'>} input Changed fields.
   * @param {() => void} [onSuccess] Called once saved. Optional.
   * @returns {void}
   */
  const save = (input: Omit<TaskInputValues, 'projectId'>, onSuccess?: () => void) => updateTask.mutate({ id: task.id, input }, { onSuccess, onError: onMutationError });
  const dates = dateRangeProps({ value: [task.startDate, task.endDate], onChange: ([startDate, endDate]) => save({ startDate, endDate }) });
  const overdue = task.deadline && task.deadline < localToday() && !task.closed ? 'En retard' : undefined;
  const doable = dateRangeProps({ value: [task.minDate, task.deadline], onChange: ([minDate, deadline]) => save({ minDate, deadline }), errors: [undefined, overdue] });

  /**
   * Validates and saves the edited title.
   * @returns {void}
   */
  const saveTitle = () => {
    const result = taskLabelSchema.safeParse(titleDraft ?? '');
    if (!result.success) {
      setTitleError(result.error.issues[0]?.message ?? 'Libellé invalide.');
      return;
    }
    if (result.data === task.label) setTitleDraft(null);
    else save({ label: result.data }, () => setTitleDraft(null));
  };

  const parent = task.parentId ? context.taskById.get(task.parentId) : undefined;
  const subtasks = context.childrenOf(task.id);
  const doneSubtasks = subtasks.filter((subtask) => context.isClosed(subtask)).length;
  const excluded = subtreeOf(context.tasks, task.id);
  const candidates = linkableTasks(context, task.projectId, task.id);
  const resolve = (ids: string[]) => ids.map((id) => context.taskById.get(id)).filter((item): item is Task => !!item);

  /**
   * Moves the task (and its sub-tasks) to another project, or out of any. Leaving the project tree removes the links
   * with the tasks left there, the milestone and the sprints: asked first.
   * @param {string | null} projectId Target project; null: none.
   * @returns {void}
   */
  const changeProject = (projectId: string | null) => {
    if (projectId === task.projectId) return;
    const transfer = () =>
      transferTask.mutate(
        { ids: [task.id], projectId },
        toastCallbacks(
          ({ removedLinks }: { removedLinks: number }) => `Tâche déplacée ${projectId ? `dans « ${context.projectLabel(projectId)} »` : 'hors de tout projet'}.${removedLinksNote(removedLinks)}`,
        ),
      );
    const linked =
      task.parentId !== null || task.blockingIds.length + task.blockedByIds.length + task.relatedIds.length > 0 || task.milestoneId !== null || task.sprintIds.length > 0 || subtasks.length > 0;
    if (context.rootOf(projectId) === context.rootOf(task.projectId) || !linked) return transfer();
    confirmDestructive({
      title: 'Changer de projet',
      risks: (
        <>
          La tâche{subtasks.length ? ' et ses sous-tâches' : ''} {projectId ? `passent dans « ${context.projectLabel(projectId)} »` : 'sortent de tout projet'}, une autre arborescence : la tâche
          parente, les blocages et les relations avec des tâches restées dans l’arborescence actuelle, le jalon et les sprints seront retirés.
          {projectId ? ' Elle prend le numéro suivant du projet.' : ' Elle perd son numéro et son lien GitHub.'}
        </>
      ),
      confirmLabel: 'Changer de projet',
      confirmIcon: <ArrowsLeftRightIcon aria-hidden />,
      onConfirm: transfer,
    });
  };

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        {titleDraft === null ? (
          <DetailHeader
            compact
            title={
              <>
                {task.label}{' '}
                <Text span c="dimmed" inherit fw={400}>
                  {taskNumber(task)}
                </Text>
              </>
            }
            badges={
              <>
                {task.githubLinked && (
                  <Badge variant="light" color="dark" leftSection={<GithubLogoIcon aria-hidden />} {...(task.githubUrl ? { component: 'a' as const, href: task.githubUrl, ...EXTERNAL_LINK } : {})}>
                    {task.githubNumber ? `GitHub #${task.githubNumber}` : 'Brouillon GitHub'}
                  </Badge>
                )}
                {task.archived && <ArchivedBadge feminine />}
              </>
            }
            actions={
              !locked && (
                <>
                  <ActionButton
                    priority="secondary"
                    size="xs"
                    icon={task.closed ? <ArrowCounterClockwiseIcon aria-hidden /> : <CheckCircleIcon aria-hidden />}
                    loading={setClosed.isPending}
                    onClick={() => setClosed.mutate({ ids: [task.id], closed: !task.closed }, ON_ERROR)}
                  >
                    {task.closed ? 'Rouvrir' : 'Fermer la tâche'}
                  </ActionButton>
                  <ActionButton priority="secondary" size="xs" icon={<PencilSimpleIcon aria-hidden />} onClick={() => setTitleDraft(task.label)}>
                    Modifier
                  </ActionButton>
                </>
              )
            }
            menu={{ about: 'la tâche', items: actions.menu(task) }}
          />
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
              aria-label="Libellé"
              autoFocus
              style={{ flex: 1 }}
            />
            <FormActions onCancel={() => setTitleDraft(null)} onSubmit={saveTitle} loading={updateTask.isPending} />
          </Group>
        )}
        <Group gap="xs">
          <TaskStateIcon closed={task.closed} blocked={context.isBlocked(task)} />
          <Anchor component={Link} to={task.projectId ? projectPath(task.projectId) : PAGES.tasks.path} size="sm">
            {context.projectLabel(task.projectId)}
          </Anchor>
        </Group>
      </Stack>

      <Grid gap="xl">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="lg">
            <SubSection
              title="Description"
              gap="xs"
              action={
                description === null &&
                !locked && (
                  <IconAction label="Modifier la description" size="sm" onClick={() => setDescription(task.description ?? '')}>
                    <PencilSimpleIcon aria-hidden />
                  </IconAction>
                )
              }
            >
              {description === null ? (
                <MarkdownView targets={context.targetsFor(task.projectId)} onChange={locked ? undefined : (next) => save({ description: next })}>
                  {task.description}
                </MarkdownView>
              ) : (
                <Stack gap="xs">
                  <MarkdownEditor
                    value={description}
                    onChange={setDescription}
                    suggestions={context.suggestionsFor(task.projectId)}
                    autoFocus
                    onSubmitShortcut={() => save({ description: description || null }, () => setDescription(null))}
                  />
                  <FormActions size="xs" onCancel={() => setDescription(null)} onSubmit={() => save({ description: description || null }, () => setDescription(null))} loading={updateTask.isPending} />
                </Stack>
              )}
            </SubSection>

            <SubSection
              title={
                <>
                  Sous-tâches
                  {subtasks.length > 0 && (
                    <Text span inherit fw={400} ml="xs">
                      {doneSubtasks}/{subtasks.length}
                    </Text>
                  )}
                </>
              }
              gap="xs"
            >
              {subtasks.length > 0 ? (
                <>
                  <TaskProgress done={doneSubtasks} total={subtasks.length} size="sm" label="Avancement des sous-tâches" />
                  {subtasks.map((subtask) => (
                    <TaskRef key={subtask.id} task={subtask} blocked={context.isBlocked(subtask)} />
                  ))}
                </>
              ) : (
                <EmptyState compact message="Aucune sous-tâche." />
              )}
              {!task.archived && <AddItemButton onClick={() => actions.create({ parentId: task.id })}>Ajouter une sous-tâche</AddItemButton>}
            </SubSection>

            <Divider />
            <SubSection title="Commentaires" gap="xs">
              <TaskComments task={task} context={context} />
            </SubSection>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          {/* An archived task: every field and action of the side disabled. */}
          <Fieldset variant="unstyled" disabled={locked}>
            <Stack gap="md">
              <ProjectSelect context={context} label="Projet" placeholder="Sans projet" clearable value={task.projectId} onChange={changeProject} disabled={transferTask.isPending} />
              <LabelSelect kind="status" label="Statut" labels={context.statuses} value={task.statusId} onChange={(statusId) => save({ statusId })} />
              <LabelSelect kind="priority" label="Priorité" labels={context.priorities} value={task.priorityId} onChange={(priorityId) => save({ priorityId })} />
              <LabelSelect kind="type" label="Type" labels={context.types} value={task.typeId} onChange={(typeId) => save({ typeId })} />
              <AssigneesSelect contributors={context.assignableFor([task.projectId], task.assigneeIds)} value={task.assigneeIds} onChange={(assigneeIds) => save({ assigneeIds })} />
              <TagsSelect tags={context.tags} value={task.tagIds} onChange={(tagIds) => save({ tagIds })} />
              <BeneficiariesSelect value={{ beneficiaryIds: task.beneficiaryIds, beneficiaryRelationIds: task.beneficiaryRelationIds }} onChange={(beneficiaries) => save(beneficiaries)} />
              <EffortInput
                key={`effort-${task.effort}`}
                defaultValue={task.effort ?? ''}
                onBlur={(event) => {
                  const raw = event.currentTarget.value.replace(',', '.').trim();
                  const effort = raw === '' ? null : Number(raw);
                  if (effort !== task.effort && (effort === null || Number.isFinite(effort))) save({ effort });
                }}
              />
              <TaskTime task={task} />
              <TaskRecurrence task={task} context={context} />
              <Group grow gap="xs">
                <DatePickerInput label="Début" clearable placeholder="—" {...dates.start} />
                <DatePickerInput label="Fin" clearable placeholder="—" {...dates.end} />
              </Group>
              <DatePickerInput label="Date min" description="Avant, la tâche n’est pas à faire." clearable placeholder="—" {...doable.start} />
              <DatePickerInput label="Date max" description="Au-delà, la tâche ouverte est en retard." clearable placeholder="—" {...doable.end} />
              <TaskSelect
                context={context}
                labelOf={(candidate) => context.taskLabel(candidate, task.projectId)}
                label="Tâche parente"
                placeholder="Aucune"
                tasks={candidates.filter((candidate) => !excluded.has(candidate.id) || candidate.id === parent?.id)}
                value={task.parentId}
                onChange={(parentId) => save({ parentId })}
              />
              <Select
                label="Jalon"
                placeholder="Aucun"
                data={context.milestonesFor(task.projectId, task.milestoneId).map((milestone) => ({ value: milestone.id, label: context.milestoneLabel(milestone) }))}
                value={task.milestoneId}
                onChange={(milestoneId) => save({ milestoneId })}
                clearable
                searchable
                nothingFoundMessage="Aucun jalon dans ce projet"
              />
              <BatchMultiSelect
                label="Sprints"
                placeholder={task.sprintIds.length ? undefined : 'Aucun'}
                data={context.sprintsFor(task.projectId, task.sprintIds).map((sprint) => ({ value: sprint.id, label: context.sprintLabel(sprint) }))}
                value={task.sprintIds}
                onChange={(sprintIds) => save({ sprintIds })}
                clearable
                searchable
                nothingFoundMessage="Aucun sprint dans ce projet"
              />
              <SlotRuleInput value={readSlotRule(task.slotRule)} onChange={(slotRule) => save({ slotRule })} />
              <Divider />
              <LinkList
                label="Bloque"
                tasks={resolve(task.blockingIds)}
                candidates={candidates}
                context={context}
                onAdd={(id) => taskBlock.mutate({ add: true, blockerId: task.id, blockedId: id }, ON_ERROR)}
                onRemove={(id) => taskBlock.mutate({ add: false, blockerId: task.id, blockedId: id }, ON_ERROR)}
              />
              <LinkList
                label="Dépend de"
                tasks={resolve(task.blockedByIds)}
                candidates={candidates}
                context={context}
                onAdd={(id) => taskBlock.mutate({ add: true, blockerId: id, blockedId: task.id }, ON_ERROR)}
                onRemove={(id) => taskBlock.mutate({ add: false, blockerId: id, blockedId: task.id }, ON_ERROR)}
              />
              <LinkList
                label="Relative à"
                tasks={resolve(task.relatedIds)}
                candidates={candidates}
                context={context}
                onAdd={(id) => taskRelation.mutate({ add: true, taskId: task.id, otherId: id }, ON_ERROR)}
                onRemove={(id) => taskRelation.mutate({ add: false, taskId: task.id, otherId: id }, ON_ERROR)}
              />
              <Divider />
              <TaskAlarms task={task} context={context} />
              <Divider />
              <TaskShopping task={task} />
              <Divider />
              <SheetsSection owner={{ taskId: task.id }} name={task.label} />
            </Stack>
          </Fieldset>
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
  const [taskId] = useSearchParam(TASK_PARAM);
  const link = useTaskLink();
  const { context, isPending } = useTaskContext();
  if (!taskId) return null;
  const task = taskId ? context?.taskById.get(taskId) : undefined;

  return (
    <SidePanel opened onClose={link.close} size="lg" title={task && context ? `${context.projectLabel(task.projectId)} · Tâche ${taskName(task)}` : 'Tâche'}>
      {isPending ? <DetailSkeleton fields={5} /> : task && context ? <TaskDetail key={task.id} task={task} context={context} /> : <DetailNotFound what="Cette tâche" feminine />}
    </SidePanel>
  );
}
