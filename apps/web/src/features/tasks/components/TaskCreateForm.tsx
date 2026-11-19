import { Select, SimpleGrid, Stack, TextInput } from '@mantine/core';
import { SlotRuleInput } from '../../calendar/components/SlotRuleInput';
import { DatePickerInput } from '@mantine/dates';
import { taskFormSchema, type TaskFormValues } from '@ordo/shared';
import { useTaskLink } from '../hooks/use-task-link';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { useCreateTask } from '../api';
import { inProjectTree, linkableTasks } from '../lib/task-links';
import { AssigneesSelect, LabelSelect, ProjectSelect, TagsSelect, TaskSelect } from './task-ui';
import { taskName, type TaskContext } from '../hooks/use-task-context';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { BeneficiariesSelect } from '../../beneficiaries/components/BeneficiariesSelect';
import { FormActions } from '../../../components/dialogs/FormActions';
import { defaultStatusId } from '../lib/new-task-defaults';
import { dateRangeProps, formRange } from '../../../components/inputs/date-range';
import { EffortInput } from './EffortInput';

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
  const link = useTaskLink();
  const parent = defaults?.parentId ? context.taskById.get(defaults.parentId) : undefined;

  const form = useAppForm<TaskFormValues>({
    initialValues: {
      label: '',
      projectId: parent?.projectId ?? defaults?.projectId ?? '',
      description: '',
      statusId: defaultStatusId(context),
      priorityId: null,
      typeId: null,
      assigneeIds: [],
      tagIds: [],
      effort: '',
      startDate: null,
      endDate: null,
      deadline: null,
      minDate: null,
      parentId: parent?.id ?? null,
      milestoneId: null,
      sprintIds: [],
      beneficiaryIds: [],
      beneficiaryRelationIds: [],
      slotRule: null,
    },
    schema: taskFormSchema,
  });
  const dates = dateRangeProps(formRange(form, 'startDate', 'endDate'));
  const doable = dateRangeProps(formRange(form, 'minDate', 'deadline'));

  // The parent must stay in the tree of the chosen project.
  // Without project: among the tasks of no project.
  const parentCandidates = linkableTasks(context, form.values.projectId || null, null);

  const handleSubmit = form.onSubmit((values) => {
    const parsed = taskFormSchema.parse(values);
    createTask.mutate(
      { ...parsed, description: parsed.description || null },
      formCallbacks(form, (task: Parameters<typeof taskName>[0] & { id: string }) => `Tâche ${taskName(task)} créée.`, onDone, { then: (task) => link.open(task.id) }),
    );
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Libellé" required data-autofocus {...form.getInputProps('label')} />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <ProjectSelect
            context={context}
            label="Projet"
            description="Facultatif : sans projet, la tâche n’a ni numéro, ni jalon, ni sprint."
            placeholder="Sans projet"
            clearable
            {...form.getInputProps('projectId')}
            onChange={(projectId) => {
              form.setFieldValue('projectId', projectId ?? '');
              const currentParent = form.values.parentId ? context.taskById.get(form.values.parentId) : undefined;
              if (currentParent && !inProjectTree(context, projectId)(currentParent.projectId)) {
                form.setFieldValue('parentId', null);
              }
              // The milestone must belong to the tree of the chosen project too.
              const milestone = form.values.milestoneId ? context.milestoneById.get(form.values.milestoneId) : undefined;
              if (milestone && projectId && !inProjectTree(context, projectId)(milestone.projectId)) {
                form.setFieldValue('milestoneId', null);
              }
              // So must the sprints.
              if (projectId) {
                form.setFieldValue(
                  'sprintIds',
                  form.values.sprintIds.filter((id) => {
                    const sprint = context.sprintById.get(id);
                    return sprint && inProjectTree(context, projectId)(sprint.projectId);
                  }),
                );
              }
            }}
          />
          <TaskSelect
            context={context}
            labelOf={(task) => context.taskLabel(task, form.values.projectId || null)}
            tasks={parentCandidates}
            label="Tâche parente"
            placeholder="Aucune"
            {...form.getInputProps('parentId')}
          />
        </SimpleGrid>
        <Select
          label="Jalon"
          placeholder={form.values.projectId ? 'Aucun' : 'Aucun (tâche sans projet)'}
          disabled={!form.values.projectId}
          data={(form.values.projectId ? context.milestonesFor(form.values.projectId, form.values.milestoneId) : []).map((milestone) => ({
            value: milestone.id,
            label: context.milestoneLabel(milestone),
          }))}
          clearable
          searchable
          nothingFoundMessage="Aucun jalon dans ce projet"
          {...form.getInputProps('milestoneId')}
        />
        <BatchMultiSelect
          label="Sprints"
          placeholder={!form.values.projectId ? 'Aucun (tâche sans projet)' : form.values.sprintIds.length ? undefined : 'Aucun'}
          disabled={!form.values.projectId}
          data={(form.values.projectId ? context.sprintsFor(form.values.projectId, form.values.sprintIds) : []).map((sprint) => ({ value: sprint.id, label: context.sprintLabel(sprint) }))}
          clearable
          searchable
          nothingFoundMessage="Aucun sprint dans ce projet"
          {...form.getInputProps('sprintIds')}
        />
        <MarkdownEditor
          label="Description"
          value={form.values.description}
          onChange={(description) => form.setFieldValue('description', description)}
          suggestions={context.suggestionsFor(form.values.projectId || null)}
          minRows={5}
          error={form.errors.description as string | undefined}
          onSubmitShortcut={() => handleSubmit()}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <LabelSelect kind="status" labels={context.statuses} label="Statut" {...form.getInputProps('statusId')} />
          <LabelSelect kind="priority" labels={context.priorities} label="Priorité" {...form.getInputProps('priorityId')} />
          <LabelSelect kind="type" labels={context.types} label="Type" {...form.getInputProps('typeId')} />
        </SimpleGrid>
        <AssigneesSelect
          contributors={context.assignableFor([form.values.projectId || null], form.values.assigneeIds)}
          value={form.values.assigneeIds}
          onChange={(assigneeIds) => form.setFieldValue('assigneeIds', assigneeIds)}
          error={form.errors.assigneeIds as string | undefined}
        />
        <TagsSelect tags={context.tags} value={form.values.tagIds} onChange={(tagIds) => form.setFieldValue('tagIds', tagIds)} />
        <BeneficiariesSelect
          value={{ beneficiaryIds: form.values.beneficiaryIds ?? [], beneficiaryRelationIds: form.values.beneficiaryRelationIds ?? [] }}
          onChange={(beneficiaries) => form.setValues({ ...beneficiaries })}
        />
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <EffortInput {...form.getInputProps('effort')} />
          <DatePickerInput label="Début" clearable placeholder="—" {...dates.start} />
          <DatePickerInput label="Fin" clearable placeholder="—" {...dates.end} />
          <DatePickerInput label="Date min" clearable placeholder="—" {...doable.start} />
          <DatePickerInput label="Date max" clearable placeholder="—" {...doable.end} />
        </SimpleGrid>
        <SlotRuleInput
          value={form.values.slotRule ? { inside: form.values.slotRule.inside ?? [], outside: form.values.slotRule.outside ?? [] } : null}
          onChange={(slotRule) => form.setFieldValue('slotRule', slotRule)}
          error={form.errors['slotRule.outside'] as string | undefined}
        />
        <FormActions onCancel={onDone} submitLabel="Créer la tâche" loading={createTask.isPending} />
      </Stack>
    </form>
  );
}
