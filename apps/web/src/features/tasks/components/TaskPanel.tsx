import { useSearchParam } from '../../../lib/search-params';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { TaskProgress } from './TaskProgress';
import { SubSection } from '../../../components/page/SubSection';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { useAppForm, useFieldSave } from '../../../lib/form';

import { EmptyState } from '../../../components/feedback/EmptyState';
import { DetailSkeleton } from '../../../components/feedback/Skeletons';
import { SidePanel } from '../../../components/panels/SidePanel';
import { Group, Select, Text } from '@mantine/core';
import { taskPanelFormSchema, readSlotCondition, readTaskHours, subtreeOf, type TaskInheritableField, isTaskOverdue } from '@ordo/shared';
import { ArrowsLeftRightIcon } from '@phosphor-icons/react';
import { TaskGithubBadge } from '../../github/components/TaskGithubBadge';
import { useState } from 'react';

import { parisToday } from '../../../lib/dates';
import { ON_ERROR, onMutationError } from '../../../lib/notify';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { useTaskBlock, useTaskRelation, useUpdateTask, type Task, type TaskInputValues } from '../api';
import { TaskShopping } from '../../shopping/components/TaskShopping';
import { SheetsSection } from '../../sheets/components/SheetsSection';
import { TrackedTime } from '../../time/components/TrackedTime';
import { DetailLayout, PanelGroup } from '../../../components/panels/DetailLayout';
import { PANEL_GROUPS } from '../../../components/panels/panel-groups';
import { DocumentsField } from '../../documents/components/DocumentsField';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { TaskComments } from './TaskComments';
import { hasTreeLinks, inProjectTree, linkableTasks } from '../lib/task-links';
import { AssigneesSelect, LabelSelect, ProjectSelect, TagsSelect, TaskRef, TaskSelect } from './task-ui';
import { useTaskActions } from '../hooks/use-task-actions';

import { type TaskContext, taskName, taskNumber, useTaskContext } from '../hooks/use-task-context';
import { TASK_PARAM, useTaskLink } from '../hooks/use-task-link';
import { useTransferTasks } from '../hooks/use-transfer-tasks';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { SlotConditionBuilder } from '../../calendar/components/SlotConditionBuilder';
import { TaskHoursField } from './TaskHoursField';
import { BeneficiariesSelect } from '../../beneficiaries/components/BeneficiariesSelect';
import { PeriodField } from '../../../components/inputs/PeriodField';
import { EffortInput } from './EffortInput';
import { TaskLinks } from './TaskLinks';
import { TaskDescription } from './TaskDescription';
import { TaskLocation } from './TaskLocation';
import { TaskRemindersField } from '../../../components/inputs/ItemReminders';
import { DeadTimesField } from '../../countdowns/components/DeadTimesField';
import { taskCountdownItem } from '../lib/task-countdowns';
import { SavedCountdownsField } from '../../countdowns/components/SavedCountdownsField';
import { tasksQueryKey } from '../../../lib/query-keys';
import { inheritedDateHint } from '../lib/inherited-dates';
import { taskExcludedDay } from '../lib/task-due';
import { TaskDueNotice } from './TaskDueNotice';
import { DetailNotFound } from '../../../components/feedback/DetailNotFound';
import { TaskDoneButton } from './TaskDoneButton';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { LATE_COLOR } from '../../../components/feedback/feedback-colors';
import { InheritedField } from '../../../components/inheritance/InheritedField';
import { taskFieldState, taskParentName } from '../lib/task-inheritance';

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
 * Detail of a task, laid out as the routine and event panels (`DetailLayout`): its state button (`TaskDoneButton`),
 * number, label and « … » menu, then its project and mentions; on the left its description, « Relations »
 * (parent, sub-tasks, « Dépend de », « Bloque », « Relative à ») and its comments; on the right « Classement »,
 * « Parties prenantes », « Charge », « Périodes », « Alarmes » (reminders, saved timers), its place and « Ressources »
 * (links, documents, shopping lists, sheets). Each field saved as soon as it changes (its label and effort on leaving them). An
 * archived task is read only (its fields disabled; « Restaurer » in its menu).
 * @param {TaskDetailProps} props Component props.
 * @returns {JSX.Element} Detail.
 */
function TaskDetail({ task, context }: TaskDetailProps) {
  const updateTask = useUpdateTask();
  const transferTask = useTransferTasks(context);
  const taskBlock = useTaskBlock();
  const taskRelation = useTaskRelation();
  const actions = useTaskActions(context);
  const locked = task.archived;

  /**
   * Saves a change right away.
   * @param {Omit<TaskInputValues, 'projectId'>} input Changed fields.
   * @param {() => void} [onSuccess] Called once saved. Optional.
   * @returns {void}
   */
  const save = (input: Omit<TaskInputValues, 'projectId'>, onSuccess?: () => void) => updateTask.mutate({ id: task.id, input }, { onSuccess, onError: onMutationError });
  /**
   * Saves a change and tells when it is done (the description and the links: their failure is told by useFieldSave).
   * @param {Omit<TaskInputValues, 'projectId'>} input Changed fields.
   * @returns {Promise<unknown>} Saved task.
   */
  const saveNow = (input: Omit<TaskInputValues, 'projectId'>) => updateTask.mutateAsync({ id: task.id, input });
  const overdue = isTaskOverdue(task, parisToday());
  // The label and the effort: saved on leaving them, also when the panel closes while they are typed.
  const texts: { label: string; effort: number | '' } = { label: task.label, effort: task.effort ?? '' };
  const textBase = useAppForm<typeof texts>({ initialValues: texts, schema: taskPanelFormSchema });
  const text = useFieldSave(textBase, {
    save: (changes) => saveNow({ ...(changes.label !== undefined && { label: changes.label }), ...(changes.effort !== undefined && { effort: typeof changes.effort === 'number' ? changes.effort : null }) }),
    schema: taskPanelFormSchema,
    saved: texts,
    onBlur: ['label', 'effort'],
    readOnly: locked,
  });
  /**
   * What an inherited field shows of its inheritance: greyed « Hérité de … », « Vider », « Rétablir
   * l'héritage », saved at once.
   * @param {TaskInheritableField} field Field.
   * @returns {object} Props of `InheritedField`.
   */
  const inherited = (field: TaskInheritableField) => ({ ...taskFieldState(task, field, save), from: taskParentName(task, context.taskById), readOnly: locked });
  /**
   * What a bound of « Ouverture et échéance » shows of its inheritance (under the field, bound by bound).
   * @param {TaskInheritableField} field Field of the bound.
   * @returns {object} Inheritance of the bound.
   */
  const inheritedBound = (field: TaskInheritableField) => ({ ...taskFieldState(task, field, save), from: taskParentName(task, context.taskById) });

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
    // « Annuler » in its toast.
    const transfer = () => transferTask.transfer([task], projectId, `Tâche déplacée ${projectId ? `dans « ${context.projectLabel(projectId)} »` : 'hors de tout projet'}.`);
    const linked = hasTreeLinks(task) || subtasks.length > 0;
    if (inProjectTree(context, projectId)(task.projectId) || !linked) return transfer();
    confirmDestructive({
      title: 'Changer de projet',
      risks: (
        <>
          La tâche{subtasks.length ? ' et ses sous-tâches' : ''} {projectId ? `passent dans « ${context.projectLabel(projectId)} »` : 'sortent de tout projet'}, une autre arborescence : la tâche
          parente, les blocages et les relations avec des tâches restées dans l’arborescence actuelle, le jalon, les sprints et les documents de projet de l’arborescence actuelle seront retirés.
          {projectId ? ' Elle prend le numéro suivant du projet.' : ' Elle perd son numéro et son lien GitHub.'}
        </>
      ),
      confirmLabel: 'Changer de projet',
      confirmIcon: <ArrowsLeftRightIcon aria-hidden />,
      onConfirm: transfer,
    });
  };

  /**
   * Linked tasks of the « Relations » group, with their add and remove.
   * @param {string} label Label (« Dépend de »…).
   * @param {string[]} ids Tasks linked.
   * @param {(id: string) => void} add Adds a task.
   * @param {(id: string) => void} remove Removes a task.
   * @returns {JSX.Element} List.
   */
  const linkList = (label: string, ids: string[], add: (id: string) => void, remove: (id: string) => void) => (
    <LinkList label={label} tasks={resolve(ids)} candidates={candidates} context={context} onAdd={add} onRemove={remove} />
  );

  return (
    <form onSubmit={text.form.onSubmit(() => undefined)} noValidate>
      <DetailLayout
        readOnly={locked}
        status={
          <Group gap={6} wrap="nowrap" h={36}>
            {/* As the routine panel: its state button, one click closes it as done or reopens it (toast with « Annuler »); cancelling is in the menu. */}
            <TaskDoneButton task={task} context={context} />
            <Text c="dimmed" fw={600}>
              {taskNumber(task)}
            </Text>
          </Group>
        }
        // Cancelled: struck through.
        title={{ ...text.form.getInputProps('label'), styles: task.cancelled ? { input: { textDecoration: 'line-through' } } : undefined }}
        menu={<ActionsMenu about="la tâche" items={actions.menu(task)} variant="light" size="input-xs" />}
        project={
          <InheritedField {...inherited('PROJECT')}>
            <ProjectSelect context={context} label="Projet" placeholder="Sans projet" clearable value={task.projectId} onChange={changeProject} disabled={transferTask.isPending} />
          </InheritedField>
        }
        mentions={
          <>
            <TaskGithubBadge task={task} />
            {task.archived && <ArchivedBadge feminine />}
          </>
        }
        // Each field saved as soon as it changes: the state of the saves.
        saving={locked ? undefined : updateTask.isPending || transferTask.isPending || text.saving}
        main={
          <>
            <TaskDescription task={task} context={context} locked={locked} save={saveNow} />
            <PanelGroup title={PANEL_GROUPS.relations}>
              <TaskSelect
                context={context}
                labelOf={(candidate) => context.taskLabel(candidate, task.projectId)}
                label="Tâche parente"
                placeholder="Aucune"
                tasks={candidates.filter((candidate) => !excluded.has(candidate.id) || candidate.id === parent?.id)}
                value={task.parentId}
                onChange={(parentId) => save({ parentId })}
              />
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
              {linkList(
                'Dépend de',
                task.blockedByIds,
                (id) => taskBlock.mutate({ add: true, blockerId: id, blockedId: task.id }, ON_ERROR),
                (id) => taskBlock.mutate({ add: false, blockerId: id, blockedId: task.id }, ON_ERROR),
              )}
              {linkList(
                'Bloque',
                task.blockingIds,
                (id) => taskBlock.mutate({ add: true, blockerId: task.id, blockedId: id }, ON_ERROR),
                (id) => taskBlock.mutate({ add: false, blockerId: task.id, blockedId: id }, ON_ERROR),
              )}
              {linkList(
                'Relative à',
                task.relatedIds,
                (id) => taskRelation.mutate({ add: true, taskId: task.id, otherId: id }, ON_ERROR),
                (id) => taskRelation.mutate({ add: false, taskId: task.id, otherId: id }, ON_ERROR),
              )}
            </PanelGroup>
          </>
        }
        comments={
          <PanelGroup title={PANEL_GROUPS.comments}>
            <TaskComments task={task} context={context} />
          </PanelGroup>
        }
        side={
          <>
            <PanelGroup title={PANEL_GROUPS.ranking}>
              <LabelSelect kind="status" label="Statut" labels={context.statuses} value={task.statusId} onChange={(statusId) => save({ statusId })} />
              <InheritedField {...inherited('PRIORITY')}>
                <LabelSelect kind="priority" label="Priorité" labels={context.priorities} value={task.priorityId} onChange={(priorityId) => save({ priorityId })} />
              </InheritedField>
              <LabelSelect kind="type" label="Type" labels={context.types} value={task.typeId} onChange={(typeId) => save({ typeId })} />
              <TagsSelect tags={context.tags} value={task.tagIds} onChange={(tagIds) => save({ tagIds })} />
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.people}>
              <InheritedField {...inherited('ASSIGNEES')}>
                <AssigneesSelect contributors={context.assignableFor([task.projectId], task.assigneeIds)} value={task.assigneeIds} onChange={(assigneeIds) => save({ assigneeIds })} />
              </InheritedField>
              <InheritedField {...inherited('BENEFICIARIES')}>
                <BeneficiariesSelect value={{ beneficiaryIds: task.beneficiaryIds, beneficiaryRelationIds: task.beneficiaryRelationIds }} onChange={(beneficiaries) => save(beneficiaries)} />
              </InheritedField>
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.workload}>
              <EffortInput {...text.form.getInputProps('effort')} />
              <TrackedTime seconds={task.trackedSeconds} on={(entry) => entry.taskIds.includes(task.id)} start={{ projectId: task.projectId, taskIds: [task.id] }} disabled={locked} />
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.periods}>
              <InheritedField {...inherited('MILESTONE')}>
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
              </InheritedField>
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
              <PeriodField label="Dates" readOnly={locked} value={[task.startDate, task.endDate]} onChange={([startDate, endDate]) => save({ startDate, endDate })} />
              <PeriodField
                label="Ouverture et échéance"
                bounds={['Ouverture', 'Échéance']}
                description={
                  <>
                    Avant l’ouverture, la tâche n’est pas à faire ; au-delà de l’échéance, la tâche ouverte est en retard.
                    {overdue && (
                      <Text span inherit c={LATE_COLOR} fw={600}>
                        {' '}
                        En retard.
                      </Text>
                    )}
                    <TaskDueNotice task={task} />
                  </>
                }
                readOnly={locked}
                excluded={[undefined, taskExcludedDay(task)]}
                value={[task.minDate, task.deadline]}
                hints={[inheritedDateHint(task, 'minDate'), inheritedDateHint(task, 'deadline')]}
                inheritance={[inheritedBound('MIN_DATE'), inheritedBound('DEADLINE')]}
                onChange={([minDate, deadline]) => save({ minDate, deadline })}
              />
              <DeadTimesField value={task.deadTimes} item={taskCountdownItem(task, context)} disabled={locked} onChange={(deadTimes) => save({ deadTimes })} />
              <InheritedField {...inherited('SLOT_CONDITION')}>
                <SlotConditionBuilder item="task" value={readSlotCondition(task.slotCondition)} onChange={(slotCondition) => save({ slotCondition })} />
              </InheritedField>
              <InheritedField {...inherited('HOURS')}>
                <TaskHoursField value={readTaskHours(task.hours)} onChange={(hours) => save({ hours })} readOnly={locked} />
              </InheritedField>
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.alarms}>
              <TaskRemindersField value={task.reminders} minDate={task.effectiveMinDate} deadline={task.effectiveDeadline} disabled={locked} onChange={(reminders) => save({ reminders })} />
              <SavedCountdownsField target="TASK" id={task.id} value={task.savedCountdownIds} invalidate={[tasksQueryKey]} readOnly={locked} />
            </PanelGroup>
            <PanelGroup>
              <InheritedField {...inherited('LOCATION')}>
                <TaskLocation task={task} save={save} />
              </InheritedField>
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.resources}>
              <TaskLinks task={task} locked={locked} save={saveNow} />
              <DocumentsField
                value={{ libraryDocumentIds: task.libraryDocumentIds, projectResourceIds: task.projectResourceIds }}
                projectId={task.projectId}
                inTree={inProjectTree(context, task.projectId)}
                readOnly={locked}
                onChange={(documents) => save(documents)}
              />
              <TaskShopping task={task} />
              <SheetsSection owner={{ taskId: task.id }} label={task.label} />
            </PanelGroup>
          </>
        }
      />
    </form>
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
