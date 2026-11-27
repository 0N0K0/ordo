import { Select, SimpleGrid, Stack } from '@mantine/core';
import { SlotConditionBuilder } from '../../calendar/components/SlotConditionBuilder';
import { TaskHoursField } from './TaskHoursField';
import { readSlotCondition, readTaskHours, TASK_INHERITABLE_FIELDS, taskFormSchema, type TaskFormValues, type TaskInheritableField } from '@ordo/shared';
import { useState } from 'react';
import { formInheritance } from '../../../components/inheritance/form-inheritance';
import { InheritedField } from '../../../components/inheritance/InheritedField';
import { taskParentName } from '../lib/task-inheritance';
import { useTaskLink } from '../hooks/use-task-link';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { useCreateTask, type Task } from '../api';
import { inProjectTree, linkableTasks } from '../lib/task-links';
import { AssigneesSelect, LabelSelect, ProjectSelect, TagsSelect, TaskSelect } from './task-ui';
import { taskName, type TaskContext } from '../hooks/use-task-context';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { BeneficiariesSelect } from '../../beneficiaries/components/BeneficiariesSelect';
import { FormActions } from '../../../components/dialogs/FormActions';
import { defaultStatusId } from '../lib/new-task-defaults';
import { formRange } from '../../../components/inputs/date-range';
import { PeriodField } from '../../../components/inputs/PeriodField';
import { EffortInput } from './EffortInput';
import { TaskRemindersField } from '../../../components/inputs/ItemReminders';
import { EventLocation } from '../../geo/components/EventLocation';
import { addressOf, locationOf } from '../../geo/lib/location';
import { LinksField } from '../../../components/inputs/LinksField';
import { LabelField } from '../../../components/inputs/LabelField';

/** Keys of the form showing each inherited field of a new sub-task. */
const FORM_COLUMNS: Record<TaskInheritableField, readonly (keyof TaskFormValues & string)[]> = {
  PROJECT: ['projectId'],
  PRIORITY: ['priorityId'],
  MILESTONE: ['milestoneId'],
  ASSIGNEES: ['assigneeIds'],
  BENEFICIARIES: ['beneficiaryIds', 'beneficiaryRelationIds'],
  MIN_DATE: ['minDate'],
  DEADLINE: ['deadline'],
  SLOT_CONDITION: ['slotCondition'],
  HOURS: ['hours'],
  LOCATION: ['location', 'locationLat', 'locationLon'],
};

/**
 * Values a new sub-task takes from its parent, as the form holds them (the values the parent goes by, its dates too).
 * @param {Task} parent Parent task.
 * @returns {Partial<TaskFormValues>} Values.
 */
const parentValues = (parent: Task): Partial<TaskFormValues> => ({
  projectId: parent.projectId ?? '',
  priorityId: parent.priorityId,
  milestoneId: parent.milestoneId,
  assigneeIds: parent.assigneeIds,
  beneficiaryIds: parent.beneficiaryIds,
  beneficiaryRelationIds: parent.beneficiaryRelationIds,
  minDate: parent.effectiveMinDate ?? null,
  deadline: parent.effectiveDeadline ?? null,
  slotCondition: readSlotCondition(parent.slotCondition),
  hours: readTaskHours(parent.hours),
  location: parent.location ?? '',
  locationLat: parent.locationLat ?? null,
  locationLon: parent.locationLon ?? null,
});

/** What a new task starts with: its project, its parent, and its « Ouverture » and « Échéance » (YYYY-MM-DD), all editable. */
export interface TaskCreateDefaults {
  projectId?: string;
  parentId?: string;
  minDate?: string;
  deadline?: string;
}

interface TaskCreateFormProps {
  context: TaskContext;
  /** Preselected project, parent task and dates. */
  defaults?: TaskCreateDefaults;
  onDone: () => void;
}

/**
 * New task form, displayed in a modal. Opens the created task.
 * @param {TaskCreateFormProps} props Component props.
 * @param {TaskContext} props.context Task context.
 * @param {TaskCreateDefaults} [props.defaults] Preselected project, parent, « Ouverture » and « Échéance » (a sub-task takes those of its parent). Optional.
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
      deadline: defaults?.deadline ?? null,
      minDate: defaults?.minDate ?? null,
      parentId: parent?.id ?? null,
      milestoneId: null,
      sprintIds: [],
      beneficiaryIds: [],
      beneficiaryRelationIds: [],
      slotCondition: null,
      hours: [],
      location: '',
      locationLat: null,
      locationLon: null,
      links: [],
      reminders: [],
      // A sub-task inherits from its parent: its values shown, greyed.
      ...(parent && parentValues(parent)),
    },
    schema: taskFormSchema,
  });
  // Fields of the new sub-task marked inherited (all of them, until one is given a value or emptied).
  const [inheritedList, setInheritedList] = useState<TaskInheritableField[]>(parent ? [...TASK_INHERITABLE_FIELDS] : []);
  const currentParent = form.values.parentId ? context.taskById.get(form.values.parentId) : undefined;
  const inheritance = formInheritance({
    values: form.values,
    columns: FORM_COLUMNS,
    parent: currentParent ? parentValues(currentParent) : null,
    list: inheritedList,
    apply: (patch, list) => {
      form.setValues(patch);
      setInheritedList(list);
    },
    required: ['PROJECT'],
  });
  /**
   * What an inherited field of the new sub-task shows (`InheritedField`).
   * @param {TaskInheritableField} field Field.
   * @returns {object} Props.
   */
  const inherited = (field: TaskInheritableField) => ({ ...inheritance.field(field), from: taskParentName(form.values, context.taskById) });

  // The parent must stay in the tree of the chosen project.
  // Without project: among the tasks of no project.
  const parentCandidates = linkableTasks(context, form.values.projectId || null, null);

  const handleSubmit = form.onSubmit((values) => {
    const parsed = taskFormSchema.parse(values);
    createTask.mutate(
      // Under a parent: the fields still holding its values inherit them, live.
      { ...parsed, description: parsed.description || null, ...(parsed.parentId && { inheritedFields: inheritance.inheritedFields(values) }) },
      formCallbacks(form, (task: Parameters<typeof taskName>[0] & { id: string }) => `Tâche ${taskName(task)} créée.`, onDone, { then: (task) => link.open(task.id) }),
    );
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <LabelField data-autofocus {...form.getInputProps('label')} />
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <InheritedField {...inherited('PROJECT')}>
            <ProjectSelect
              context={context}
              label="Projet"
              description="Facultatif : sans projet, la tâche n’a ni numéro, ni jalon, ni sprint."
              placeholder="Sans projet"
              clearable
              {...form.getInputProps('projectId')}
              onChange={(projectId) => {
                form.setFieldValue('projectId', projectId ?? '');
                if (currentParent && !inProjectTree(context, projectId)(currentParent.projectId)) {
                  form.setFieldValue('parentId', null);
                  setInheritedList([]);
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
          </InheritedField>
          <TaskSelect
            context={context}
            labelOf={(task) => context.taskLabel(task, form.values.projectId || null)}
            tasks={parentCandidates}
            label="Tâche parente"
            placeholder="Aucune"
            {...form.getInputProps('parentId')}
            // A new parent: every field inherits from it; none: nothing inherited.
            onChange={(parentId) => {
              form.setFieldValue('parentId', parentId);
              const next = parentId ? context.taskById.get(parentId) : undefined;
              inheritance.adopt(next ? parentValues(next) : null);
            }}
          />
        </SimpleGrid>
        <InheritedField {...inherited('MILESTONE')}>
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
        </InheritedField>
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
        <InheritedField {...inherited('LOCATION')}>
          <EventLocation value={addressOf(form.values)} error={form.errors.location} onChange={(value) => form.setValues(locationOf(value))} />
        </InheritedField>
        <LinksField form={form} />
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <LabelSelect kind="status" labels={context.statuses} label="Statut" {...form.getInputProps('statusId')} />
          <InheritedField {...inherited('PRIORITY')}>
            <LabelSelect kind="priority" labels={context.priorities} label="Priorité" {...form.getInputProps('priorityId')} />
          </InheritedField>
          <LabelSelect kind="type" labels={context.types} label="Type" {...form.getInputProps('typeId')} />
        </SimpleGrid>
        <InheritedField {...inherited('ASSIGNEES')}>
          <AssigneesSelect
            contributors={context.assignableFor([form.values.projectId || null], form.values.assigneeIds)}
            value={form.values.assigneeIds}
            onChange={(assigneeIds) => form.setFieldValue('assigneeIds', assigneeIds)}
            error={form.errors.assigneeIds as string | undefined}
          />
        </InheritedField>
        <TagsSelect tags={context.tags} value={form.values.tagIds} onChange={(tagIds) => form.setFieldValue('tagIds', tagIds)} />
        <InheritedField {...inherited('BENEFICIARIES')}>
          <BeneficiariesSelect
            value={{ beneficiaryIds: form.values.beneficiaryIds ?? [], beneficiaryRelationIds: form.values.beneficiaryRelationIds ?? [] }}
            onChange={(beneficiaries) => form.setValues({ ...beneficiaries })}
          />
        </InheritedField>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <EffortInput {...form.getInputProps('effort')} />
          <PeriodField label="Dates" {...formRange(form, 'startDate', 'endDate')} />
          <PeriodField
            label="Ouverture et échéance"
            bounds={['Ouverture', 'Échéance']}
            inheritance={[inherited('MIN_DATE'), inherited('DEADLINE')]}
            {...formRange(form, 'minDate', 'deadline')}
          />
        </SimpleGrid>
        <TaskRemindersField
          value={form.values.reminders ?? []}
          minDate={form.values.minDate}
          deadline={form.values.deadline}
          onChange={(reminders) => form.setFieldValue('reminders', reminders)}
          error={form.errors.reminders as string | undefined}
        />
        <InheritedField {...inherited('SLOT_CONDITION')}>
          <SlotConditionBuilder item="task" value={readSlotCondition(form.values.slotCondition)} onChange={(slotCondition) => form.setFieldValue('slotCondition', slotCondition)} />
        </InheritedField>
        <InheritedField {...inherited('HOURS')}>
          <TaskHoursField value={readTaskHours(form.values.hours)} onChange={(hours) => form.setFieldValue('hours', hours)} />
        </InheritedField>
        <FormActions onCancel={onDone} submitLabel="Créer la tâche" loading={createTask.isPending} />
      </Stack>
    </form>
  );
}
