import { ActionIcon, Badge, Button, Group, Menu, Paper, Progress, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { modals } from '@mantine/modals';
import { addDays, sprintFormSchema, type SprintFormValues } from '@ordo/shared';
import { DotsThreeIcon, PencilSimpleIcon, PlusIcon, TimerIcon, TrashIcon } from '@phosphor-icons/react';
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor';
import { MarkdownView } from '../../components/markdown/MarkdownView';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useSprintMutations, type Sprint } from './api';
import { useTaskContext, type TaskContext } from './use-task-context';

const dayFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const numberFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

/**
 * Printed day.
 * @param {string} day YYYY-MM-DD.
 * @returns {string} "3 novembre 2026".
 */
const printedDay = (day: string) => dayFormat.format(new Date(`${day}T00:00:00Z`));

interface SprintFormProps {
  projectId: string;
  sprint?: Sprint;
  /** Proposed dates and name of a new sprint. */
  defaults: SprintFormValues;
  context: TaskContext;
  onDone: () => void;
}

/**
 * Sprint creation / edition form, in a modal.
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
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <DatePickerInput label="Début" required valueFormat="D MMM YYYY" {...form.getInputProps('startDate')} />
          <DatePickerInput label="Fin" required valueFormat="D MMM YYYY" {...form.getInputProps('endDate')} />
        </SimpleGrid>
        <MarkdownEditor
          label="Objectif"
          value={form.values.goal}
          onChange={(goal) => form.setFieldValue('goal', goal)}
          suggestions={context.suggestions}
          minRows={3}
          onSubmitShortcut={() => handleSubmit()}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {sprint ? 'Enregistrer' : 'Créer le sprint'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

let modalCount = 0;

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
    const length = last ? Math.round((Date.parse(String(last.endDate)) - Date.parse(String(last.startDate))) / 86_400_000) : 13;
    const start = last && String(last.endDate) >= today ? addDays(String(last.endDate), 1) : today;
    const defaults = { name: `Sprint ${sprints.length + 1}`, startDate: start, endDate: addDays(start, length), goal: '' };
    const modalId = `sprint-${++modalCount}`;
    modals.open({
      modalId,
      title: sprint ? 'Modifier le sprint' : 'Nouveau sprint',
      size: 'lg',
      children: <SprintForm projectId={projectId} sprint={sprint} defaults={defaults} context={context} onDone={() => modals.close(modalId)} />,
    });
  };

  /**
   * Asks for confirmation before deleting a sprint.
   * @param {Sprint} sprint Sprint.
   * @param {number} count Number of tasks in it.
   * @returns {void}
   */
  const confirmDelete = (sprint: Sprint, count: number) => {
    const modalId = `delete-sprint-${sprint.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le sprint',
      children: (
        <Stack gap="md">
          <Text size="sm">
            Le sprint « {sprint.name} » sera supprimé définitivement
            {count > 0 ? ` et retiré des ${count} tâche${count > 1 ? 's' : ''} qui y sont planifiées` : ''}. Les tâches ne sont pas supprimées.
            Cette action est irréversible.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate({ id: sprint.id }, { onSuccess: () => notifySuccess('Sprint supprimé.'), onError: (error) => notifyError(error.message) });
            }}
          />
        </Stack>
      ),
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Les sprints sont utilisables par les tâches du projet et de ses sous-projets.
        </Text>
        <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={project?.archived}>
          Nouveau sprint
        </Button>
      </Group>
      {sprints.length === 0 ? (
        <Paper withBorder radius="md" p="xl">
          <Stack align="center" gap="sm">
            <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
              <TimerIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucun sprint pour ce projet.
            </Text>
            <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()} disabled={project?.archived}>
              Planifier un premier sprint
            </Button>
          </Stack>
        </Paper>
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
                          {tasks.length - done.length} tâche{tasks.length - done.length > 1 ? 's' : ''} non terminée{tasks.length - done.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">
                      Du {printedDay(start)} au {printedDay(end)}
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
                <Group gap="sm" wrap="nowrap">
                  <Progress value={tasks.length ? (done.length / tasks.length) * 100 : 0} style={{ flex: 1 }} aria-label={`Avancement du sprint ${sprint.name}`} />
                  <Text size="xs" c="dimmed" style={{ flex: 'none' }}>
                    {done.length}/{tasks.length} tâche{tasks.length > 1 ? 's' : ''}
                    {effort > 0 && ` · effort ${numberFormat.format(doneEffort)}/${numberFormat.format(effort)}`}
                  </Text>
                </Group>
                {sprint.goal && (
                  <MarkdownView
                    targets={context.targets}
                    onChange={(goal) =>
                      update.mutate(
                        { id: sprint.id, input: { name: sprint.name, startDate: String(sprint.startDate), endDate: String(sprint.endDate), goal } },
                        { onError: (error) => notifyError(error.message) },
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
