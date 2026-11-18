import { PERIOD_STATES, periodState } from '../../../lib/periods';
import { SectionHeader } from '../../../components/page/SectionHeader';
import { PlanCard } from './PlanCard';

import { plural } from '../../../lib/text';
import { ActionButton } from '../../../components/actions/ActionButton';
import { confirmPlanDelete } from '../lib/confirm-plan-delete';
import { leafEffort } from '../lib/task-effort';
import { TaskProgress } from './TaskProgress';
import { EmptyState } from '../../../components/feedback/EmptyState';

import { openFormPanel } from '../../../components/panels/panels';
import { Badge, Paper, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { addDays, daysBetween, sprintFormSchema, type SprintFormValues } from '@ordo/shared';
import { PencilSimpleIcon, PlusIcon, TimerIcon, TrashIcon } from '@phosphor-icons/react';

import { archiveEntry, useSetArchived, useArchivedToggle } from '../../../lib/archive';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';

import { localToday } from '../../../lib/dates';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { ON_ERROR } from '../../../lib/notify';
import { useSprintMutations, type Sprint } from '../api';
import { useTaskContext, type TaskContext } from '../hooks/use-task-context';
import * as fmt from '../../../lib/format';

import { FormActions } from '../../../components/dialogs/FormActions';
import { dateRangeProps, formRange } from '../../../components/inputs/date-range';

interface SprintFormProps {
  projectId: string;
  sprint?: Sprint;
  /** Proposed dates and name of a new sprint. */
  defaults: SprintFormValues;
  context: TaskContext;
  onDone: () => void;
}

/**
 * Sprint creation / edition form, in the side panel.
 * @param {SprintFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function SprintForm({ projectId, sprint, defaults, context, onDone }: SprintFormProps) {
  const { create, update } = useSprintMutations();
  const form = useAppForm<SprintFormValues>({
    initialValues: sprint ? { label: sprint.label, startDate: sprint.startDate, endDate: sprint.endDate, goal: sprint.goal ?? '' } : defaults,
    schema: sprintFormSchema,
  });
  const period = dateRangeProps(formRange(form, 'startDate', 'endDate'));

  const handleSubmit = form.onSubmit((values) => {
    const input = { label: values.label, startDate: values.startDate, endDate: values.endDate, goal: values.goal || null };
    const callbacks = formCallbacks(form, sprint ? 'Sprint modifié.' : 'Sprint créé.', onDone);
    if (sprint) update.mutate({ id: sprint.id, input }, callbacks);
    else create.mutate({ projectId, input }, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('label')} />
        {/* By the width of the settings sidebar, not the window's. */}
        <SimpleGrid type="container" cols={{ base: 1, '520px': 2 }} spacing="sm">
          <DatePickerInput label="Début" required {...period.start} />
          <DatePickerInput label="Fin" required {...period.end} />
        </SimpleGrid>
        <MarkdownEditor
          label="Objectif"
          value={form.values.goal}
          onChange={(goal) => form.setFieldValue('goal', goal)}
          suggestions={context.suggestionsFor(sprint?.projectId ?? projectId)}
          minRows={3}
          onSubmitShortcut={() => handleSubmit()}
        />
        <FormActions onCancel={onDone} submitLabel={sprint ? 'Enregistrer' : 'Créer le sprint'} loading={create.isPending || update.isPending} />
      </Stack>
    </form>
  );
}

/**
 * Sprints of a project: dates, state (coming, running, over), progress of their tasks in number and effort,
 * goal; create, edit, archive (hidden until « Afficher les archivés », read only), delete. A new sprint follows the last
 * one, for as long.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function SprintsPanel({ projectId }: { projectId: string }) {
  const { context } = useTaskContext();
  const { remove, update } = useSprintMutations();
  const setArchived = useSetArchived('SPRINT');
  const today = localToday();
  // Every sprint of the project (a new one follows the last, archived or not); those shown.
  const sprints = (context?.sprints ?? []).filter((sprint) => sprint.projectId === projectId);
  const { shown, toggle: archivedToggle } = useArchivedToggle(sprints);
  if (!context) return null;
  const project = context.projectById.get(projectId);

  /**
   * Opens the sprint form.
   * @param {Sprint} [sprint] Sprint to edit. Optional.
   * @returns {void}
   */
  const openForm = (sprint?: Sprint) => {
    const last = sprints[sprints.length - 1];
    const length = last ? daysBetween(last.startDate, last.endDate) : 13;
    const start = last && last.endDate >= today ? addDays(last.endDate, 1) : today;
    const defaults = { label: `Sprint ${sprints.length + 1}`, startDate: start, endDate: addDays(start, length), goal: '' };
    openFormPanel(sprint ? 'Modifier le sprint' : 'Nouveau sprint', (close) => <SprintForm projectId={projectId} sprint={sprint} defaults={defaults} context={context} onDone={close} />);
  };

  /**
   * Asks for confirmation before deleting a sprint.
   * @param {Sprint} sprint Sprint.
   * @param {number} count Number of tasks in it.
   * @returns {void}
   */
  const confirmDelete = (sprint: Sprint, count: number) => {
    confirmPlanDelete({
      title: 'Supprimer le sprint',
      what: `Le sprint « ${sprint.label} »`,
      count,
      link: 'qui y sont planifiées',
      done: 'Sprint supprimé.',
      remove: () => remove.mutateAsync({ id: sprint.id }),
    });
  };

  return (
    <Stack gap="md">
      <SectionHeader
        description="Les sprints sont utilisables par les tâches du projet et de ses sous-projets."
        actions={
          <>
            <ShowArchivedSwitch {...archivedToggle} />
            <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={project?.archived}>
              Nouveau sprint
            </ActionButton>
          </>
        }
      />
      {shown.length === 0 ? (
        <EmptyState icon={<TimerIcon aria-hidden />} message="Aucun sprint pour ce projet." />
      ) : (
        shown.map((sprint) => {
          const tasks = context.tasks.filter((task) => task.sprintIds.includes(sprint.id) && !task.archived);
          const done = tasks.filter((task) => context.isClosed(task));
          // Effort of the tasks without sub-tasks (a parent's effort is its sub-tasks').
          const effortOf = (items: typeof tasks) => items.reduce((sum, task) => sum + leafEffort(task, context), 0);
          const effort = effortOf(tasks);
          const doneEffort = effortOf(done);
          const start = sprint.startDate;
          const end = sprint.endDate;
          const state = PERIOD_STATES[periodState(start, end, today)];
          const late = end < today && done.length < tasks.length;
          return (
            <Paper key={sprint.id} withBorder radius="md" p="md">
              <PlanCard
                icon={<TimerIcon aria-hidden />}
                title={sprint.label}
                badges={
                  <>
                    {sprint.archived && <ArchivedBadge size="sm" />}
                    <Badge size="sm" variant="light" color={state.color}>
                      {state.label}
                    </Badge>
                    {late && (
                      <Badge size="sm" variant="light" color="red">
                        {tasks.length - done.length} {plural(tasks.length - done.length, 'tâche')} non {plural(tasks.length - done.length, 'terminée')}
                      </Badge>
                    )}
                  </>
                }
                dates={`Du ${fmt.day(start)} au ${fmt.day(end)}`}
                actions={[
                  // Archived (or of an archived project): read only.
                  !sprint.archived && !project?.archived && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm(sprint) },
                  archiveEntry({ archived: sprint.archived, type: 'Sprint', name: sprint.label }, setArchived, sprint.id),
                  { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(sprint, tasks.length) },
                ]}
                progress={
                  <TaskProgress
                    done={done.length}
                    total={tasks.length}
                    label={`Avancement du sprint ${sprint.label}`}
                    extra={effort > 0 && ` · effort ${fmt.number(doneEffort, 1)}/${fmt.number(effort, 1)}`}
                  />
                }
                description={sprint.goal}
                targets={context.targetsFor(sprint.projectId)}
                onDescription={
                  sprint.archived || project?.archived
                    ? undefined
                    : (goal) => update.mutate({ id: sprint.id, input: { label: sprint.label, startDate: sprint.startDate, endDate: sprint.endDate, goal } }, ON_ERROR)
                }
              />
            </Paper>
          );
        })
      )}
    </Stack>
  );
}
