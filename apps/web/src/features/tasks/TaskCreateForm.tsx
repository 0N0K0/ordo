import { Button, Group, NumberInput, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { taskFormSchema, type TaskFormValues } from '@ordo/shared';
import { useNavigate } from 'react-router';
import { MarkdownEditor } from '../../components/markdown/MarkdownEditor';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useCreateTask } from './api';
import { linkableTasks } from './task-links';
import { AssigneesSelect, LabelSelect, ProjectSelect, TaskSelect } from './task-ui';
import type { TaskContext } from './use-task-context';

interface TaskCreateFormProps {
  context: TaskContext;
  /** Preselected project and parent task. */
  defaults?: { projectId?: string; parentId?: string };
  onDone: () => void;
}

/**
 * New task form, displayed in a modal. Opens the created task.
 * @param {TaskCreateFormProps} props Component props.
 * @param {TaskContext} props.context Task context.
 * @param {{ projectId?: string, parentId?: string }} [props.defaults] Preselected project and parent. Optional.
 * @param {() => void} props.onDone Called after saving or cancelling.
 * @returns {JSX.Element} Form.
 */
export function TaskCreateForm({ context, defaults, onDone }: TaskCreateFormProps) {
  const createTask = useCreateTask();
  const navigate = useNavigate();
  const parent = defaults?.parentId ? context.taskById.get(defaults.parentId) : undefined;
  const firstStatus = context.statuses.find((status) => status.category === 'TODO') ?? context.statuses[0];

  const form = useAppForm<TaskFormValues>({
    initialValues: {
      title: '',
      projectId: parent?.projectId ?? defaults?.projectId ?? '',
      description: '',
      statusId: firstStatus?.id ?? null,
      priorityId: null,
      typeId: null,
      assigneeIds: [],
      effort: '',
      startDate: null,
      endDate: null,
      parentId: parent?.id ?? null,
    },
    schema: taskFormSchema,
  });

  // The parent must stay in the tree of the chosen project.
  const parentCandidates = form.values.projectId ? linkableTasks(context, form.values.projectId, null) : [];

  const handleSubmit = form.onSubmit((values) => {
    const parsed = taskFormSchema.parse(values);
    createTask.mutate(
      { ...parsed, description: parsed.description || null },
      {
        onSuccess: (task) => {
          notifySuccess(`Tâche #${task.number} créée.`);
          onDone();
          navigate(`/tasks/${task.number}`);
        },
        onError: (error) => showFormError(form, error),
      },
    );
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Titre" required data-autofocus {...form.getInputProps('title')} />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <ProjectSelect
            context={context}
            label="Projet"
            required
            {...form.getInputProps('projectId')}
            onChange={(projectId) => {
              form.setFieldValue('projectId', projectId ?? '');
              const currentParent = form.values.parentId ? context.taskById.get(form.values.parentId) : undefined;
              if (currentParent && projectId && context.rootOf(currentParent.projectId) !== context.rootOf(projectId)) {
                form.setFieldValue('parentId', null);
              }
            }}
          />
          <TaskSelect
            tasks={parentCandidates}
            label="Tâche parente"
            placeholder={form.values.projectId ? 'Aucune' : 'Choisissez d’abord un projet'}
            disabled={!form.values.projectId}
            {...form.getInputProps('parentId')}
          />
        </SimpleGrid>
        <MarkdownEditor
          label="Description"
          value={form.values.description}
          onChange={(description) => form.setFieldValue('description', description)}
          suggestions={context.suggestions}
          minRows={5}
          error={form.errors.description as string | undefined}
          onSubmitShortcut={() => handleSubmit()}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <LabelSelect labels={context.statuses} label="Statut" {...form.getInputProps('statusId')} />
          <LabelSelect labels={context.priorities} label="Priorité" {...form.getInputProps('priorityId')} />
          <LabelSelect labels={context.types} label="Type" {...form.getInputProps('typeId')} />
        </SimpleGrid>
        <AssigneesSelect
          contributors={context.contributors}
          value={form.values.assigneeIds}
          onChange={(assigneeIds) => form.setFieldValue('assigneeIds', assigneeIds)}
          error={form.errors.assigneeIds as string | undefined}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <NumberInput label="Effort" min={0} decimalScale={2} decimalSeparator="," {...form.getInputProps('effort')} />
          <DatePickerInput label="Début" clearable placeholder="—" {...form.getInputProps('startDate')} />
          <DatePickerInput
            label="Fin"
            clearable
            placeholder="—"
            minDate={form.values.startDate ?? undefined}
            {...form.getInputProps('endDate')}
          />
        </SimpleGrid>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={createTask.isPending}>
            Créer la tâche
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
