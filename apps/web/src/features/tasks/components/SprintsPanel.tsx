import { plural } from '../../../lib/text';
import { ActionButton } from '../../../components/actions/ActionButton';
import { confirmPlanDelete } from '../lib/confirm-plan-delete';
import { TaskProgress } from './TaskProgress';
import { EmptyState } from '../../../components/feedback/EmptyState';

import { openFormPanel } from '../../../components/panels/panels';
import { ActionIcon, Badge, Group, Menu, Paper, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { addDays, daysBetween, sprintFormSchema, type SprintFormValues } from '@ordo/shared';
import { DotsThreeIcon, PencilSimpleIcon, PlusIcon, TimerIcon, TrashIcon } from '@phosphor-icons/react';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { localToday } from '../../../lib/dates';
import { showFormError, useAppForm } from '../../../lib/form';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useSprintMutations, type Sprint } from '../api';
import { useTaskContext, type TaskContext } from '../hooks/use-task-context';
import * as fmt from '../../../lib/format';

import { FormActions } from '../../../components/dialogs/FormActions';

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
    initialValues: sprint ? { name: sprint.name, startDate: String(sprint.startDate), endDate: String(sprint.endDate), goal: sprint.goal ?? '' } : defaults,
    schema: sprintFormSchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    const input = { name: values.name, startDate: values.startDate, endDate: values.endDate, goal: values.goal || null };
    const callbacks = {
      onSuccess: () => {
        notifySuccess(sprint ? 'Sprint modifié.' : 'Sprint créé.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (sprint) update.mutate({ id: sprint.id, input }, callbacks);
    else create.mutate({ projectId, input }, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        {/* By the width of the settings sidebar, not the window's. */}
        <SimpleGrid type="container" cols={{ base: 1, '520px': 2 }} spacing="sm">
          <DatePickerInput label="Début" required {...form.getInputProps('startDate')} />
          <DatePickerInput label="Fin" required {...form.getInputProps('endDate')} />
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
 * goal; create, edit, delete. A new sprint follows the last one, for as long.
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function SprintsPanel({ projectId }: { projectId: string }) {
  const { context } = useTaskContext();
  const { remove, update } = useSprintMutations();
  const today = localToday();
  if (!context) return null;
  const project = context.projectById.get(projectId);
  const sprints = context.sprints.filter((sprint) => sprint.projectId === projectId);

  /**
   * Opens the sprint form.
   * @param {Sprint} [sprint] Sprint to edit. Optional.
   * @returns {void}
   */
  const openForm = (sprint?: Sprint) => {
    const last = sprints[sprints.length - 1];
    const length = last ? daysBetween(String(last.startDate), String(last.endDate)) : 13;
    const start = last && String(last.endDate) >= today ? addDays(String(last.endDate), 1) : today;
    const defaults = { name: `Sprint ${sprints.length + 1}`, startDate: start, endDate: addDays(start, length), goal: '' };
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
      what: `Le sprint « ${sprint.name} »`,
      count,
      link: 'qui y sont planifiées',
      done: 'Sprint supprimé.',
      remove: () => remove.mutateAsync({ id: sprint.id }),
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Les sprints sont utilisables par les tâches du projet et de ses sous-projets.
        </Text>
        <ActionButton icon={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={project?.archived}>Nouveau sprint</ActionButton>
      </Group>
      {sprints.length === 0 ? (
        <EmptyState icon={<TimerIcon aria-hidden />} message="Aucun sprint pour ce projet." />
      ) : (
        sprints.map((sprint) => {
          const tasks = context.tasks.filter((task) => task.sprintIds.includes(sprint.id) && !task.archived);
          const done = tasks.filter((task) => context.isClosed(task));
          // Effort of the tasks without sub-tasks (a parent's effort is its sub-tasks').
          const effortOf = (items: typeof tasks) =>
            items.filter((task) => context.childrenOf(task.id).length === 0).reduce((sum, task) => sum + (task.effort ?? 0), 0);
          const effort = effortOf(tasks);
          const doneEffort = effortOf(done);
          const start = String(sprint.startDate);
          const end = String(sprint.endDate);
          const state = end < today ? { label: 'Terminé', color: 'gray' } : start > today ? { label: 'À venir', color: 'blue' } : { label: 'En cours', color: 'green' };
          const late = end < today && done.length < tasks.length;
          return (
            <Paper key={sprint.id} withBorder radius="md" p="md">
              <Stack gap="sm">
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Stack gap={2}>
                    <Group gap="xs">
                      <TimerIcon aria-hidden />
                      <Title order={3} size="h5">
                        {sprint.name}
                      </Title>
                      <Badge size="sm" variant="light" color={state.color}>
                        {state.label}
                      </Badge>
                      {late && (
                        <Badge size="sm" variant="light" color="red">
                          {tasks.length - done.length} {plural(tasks.length - done.length, 'tâche')} non {plural(tasks.length - done.length, 'terminée')}
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">
                      Du {fmt.day(start)} au {fmt.day(end)}
                    </Text>
                  </Stack>
                  <Menu position="bottom-end" withinPortal shadow="md">
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label={`Actions sur le sprint ${sprint.name}`}>
                        <DotsThreeIcon weight="bold" aria-hidden />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => openForm(sprint)}>
                        Modifier
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item leftSection={<TrashIcon aria-hidden />} color="red" onClick={() => confirmDelete(sprint, tasks.length)}>
                        Supprimer
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
                <TaskProgress
                  done={done.length}
                  total={tasks.length}
                  label={`Avancement du sprint ${sprint.name}`}
                  extra={effort > 0 && ` · effort ${fmt.number(doneEffort, 1)}/${fmt.number(effort, 1)}`}
                />
                {sprint.goal && (
                  <MarkdownView
                    targets={context.targetsFor(sprint.projectId)}
                    onChange={(goal) =>
                      update.mutate(
                        { id: sprint.id, input: { name: sprint.name, startDate: String(sprint.startDate), endDate: String(sprint.endDate), goal } },
                        { onError: onMutationError },
                      )
                    }
                  >
                    {sprint.goal}
                  </MarkdownView>
                )}
              </Stack>
            </Paper>
          );
        })
      )}
    </Stack>
  );
}
