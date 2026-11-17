import { Divider, Grid, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { opensFits, readOpens, readSlotCondition, type RoutineOpens, routineSchema, type SlotCondition, type Recurrence, type RoutineCase, type RoutineSlot, subtreeOf } from '@ordo/shared';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { categoryOptions } from '../../../components/tree/category-tree';
import { localToday } from '../../../lib/dates';
import { showFormError, useAppForm } from '../../../lib/form';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { AssigneesSelect, ProjectSelect } from '../../tasks/components/task-ui';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useRoutineMutations, useRoutinesData, type Routine } from '../api';
import { DAILY, ruleOf } from '../lib/routine-format';
import { RoutineSchedule } from './RoutineSchedule';
import { treeOptions, treeSelectProps } from '../../../components/tree/tree-select';
import { BeneficiariesSelect } from '../../beneficiaries/components/BeneficiariesSelect';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { Comments } from '../../comments/components/Comments';
import { SheetsSection } from '../../sheets/components/SheetsSection';
import { useDefaultColor } from '../../workspace/hooks/use-default-color';
import { FormActions } from '../../../components/dialogs/FormActions';

interface RoutineFormValues extends Record<string, unknown> {
  title: string;
  description: string;
  categoryIds: string[];
  parentId: string | null;
  startDate: string;
  recurrence: Recurrence;
  estimate: number | null;
  fromTime: string | null;
  dueTime: string | null;
  slotCondition: SlotCondition | null;
  moments: RoutineSlot[];
  reminders: number[];
  cases: RoutineCase[];
  location: string;
  locationLat: number | null;
  locationLon: number | null;
  travelBefore: number;
  travelAfter: number;
  projectId: string | null;
  assigneeIds: string[];
  requiredIds: string[];
  opensOn: RoutineOpens | null;
  beneficiaryIds: string[];
  beneficiaryRelationIds: string[];
}

export interface RoutineFormProps {
  /** Routine edited. */
  routine?: Routine;
  /** The routine is copied into a new one (its ticks and tracked time are not). */
  copy?: boolean;
  /** Parent of a new sub-routine (its category, rule and assignees are taken by default). */
  parent?: Routine;
  /** Category of a new routine. */
  categoryId?: string | null;
  /** Project of a new routine. */
  projectId?: string | null;
  onDone: () => void;
}

/**
 * Routine, laid out as the task panel: title; description and when it comes (first date, repetition, « à partir du »)
 * on the left; project, categories, assignees, beneficiaries, time to spend, slots, parent routine and the routines it
 * depends on on the right.
 * @param {RoutineFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function RoutineForm({ routine, copy = false, parent, categoryId = null, projectId = null, onDone }: RoutineFormProps) {
  const { data } = useRoutinesData();
  const { context } = useTaskContext();
  const { create, update, createCategory, copySubRoutines } = useRoutineMutations();
  const color = useDefaultColor();
  const routines = data?.routines ?? [];
  const source = routine ?? parent;
  const form = useAppForm<RoutineFormValues>({
    initialValues: {
      title: routine ? (copy ? `${routine.title} (copie)` : routine.title) : '',
      description: routine?.description ?? '',
      categoryIds: routine ? routine.categoryIds : (parent?.categoryIds ?? (categoryId ? [categoryId] : [])),
      parentId: routine ? routine.parentId : (parent?.id ?? null),
      startDate: routine?.startDate ?? (parent && parent.startDate > localToday() ? parent.startDate : localToday()),
      recurrence: (source && ruleOf(source)) ?? DAILY,
      estimate: routine?.estimate ?? null,
      fromTime: routine?.fromTime ?? null,
      slotCondition: readSlotCondition(source?.slotCondition),
      moments: (source?.moments as RoutineSlot[] | undefined) ?? [{ fromTime: null, dueTime: null, optional: false }],
      reminders: routine?.reminders ?? [],
      cases: (source?.cases as RoutineCase[] | undefined) ?? [],
      dueTime: routine?.dueTime ?? null,
      location: routine?.location ?? '',
      locationLat: routine?.locationLat ?? null,
      locationLon: routine?.locationLon ?? null,
      travelBefore: routine?.travelBefore ?? 0,
      travelAfter: routine?.travelAfter ?? 0,
      projectId: routine ? routine.projectId : (parent?.projectId ?? projectId),
      assigneeIds: routine?.assigneeIds ?? parent?.assigneeIds ?? [],
      requiredIds: routine?.requiredIds ?? [],
      beneficiaryIds: routine?.beneficiaryIds ?? parent?.beneficiaryIds ?? [],
      beneficiaryRelationIds: routine?.beneficiaryRelationIds ?? parent?.beneficiaryRelationIds ?? [],
      opensOn: readOpens(routine?.opensOn),
    },
    schema: routineSchema,
  });
  // Neither the routine nor its sub-routines can be its parent; it cannot depend on itself.
  const excluded = routine && !copy ? subtreeOf(routines, routine.id) : new Set<string>();
  /**
   * Options of a select of routines, in tree order under their parent routine (greyed out when not offered).
   * @param {(item: Routine) => boolean} filter Routines offered (active ones only).
   * @returns {TreeOption[]} Options.
   */
  const routineOptions = (filter: (item: Routine) => boolean) =>
    treeOptions(
      [...routines].sort((a, b) => a.position - b.position).map((item) => ({ id: item.id, parentId: item.parentId, label: item.title })),
      (id) => {
        const item = routines.find((candidate) => candidate.id === id);
        return item !== undefined && !item.archived && filter(item);
      },
    );

  const handleSubmit = form.onSubmit((values) => {
    // « À partir du » of its rule (its cases have theirs): dropped when it no longer fits the repetition.
    const opensOn = values.opensOn && !values.cases.length && opensFits(values.opensOn, values.recurrence.frequency) ? values.opensOn : null;
    const input = { ...values, description: values.description || null, opensOn };
    const callbacks = {
      onSuccess: (created: unknown) => {
        // A copy takes the sub-routines of the routine with it, under itself.
        if (copy && routine && typeof created === 'string' && routines.some((item) => item.parentId === routine.id)) {
          copySubRoutines.mutate({ fromId: routine.id, toId: created }, { onError: onMutationError });
        }
        notifySuccess(copy ? 'Routine dupliquée.' : routine ? 'Routine modifiée.' : 'Routine créée.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (routine && !copy) update.mutate({ id: routine.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="lg">
        <TextInput label="Titre" required data-autofocus {...form.getInputProps('title')} />
        {/* As the task panel: the text and when it comes on the left, its properties on the right. */}
        <Grid gap="xl">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="md">
              <MarkdownEditor
                label="Description"
                value={form.values.description}
                onChange={(description) => form.setFieldValue('description', description)}
                suggestions={context?.suggestionsFor(form.values.projectId) ?? { projectId: null, tasks: [], contributors: [] }}
                minRows={3}
              />
              <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                Quand
              </Text>
              <RoutineSchedule values={form.values} errors={form.errors} onChange={(changes) => form.setValues(changes)} />
              {routine && !copy && <SheetsSection owner={{ routineId: routine.id }} occurrenceDate={routine.currentDate ? String(routine.currentDate) : null} name={routine.title} />}
              {routine && !copy && <Comments target="ROUTINE" id={routine.id} projectId={routine.projectId ?? null} />}
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              {context && (
                <ProjectSelect
                  context={context}
                  label="Projet"
                  description="Facultatif : le temps chronométré sur la routine y est compté."
                  placeholder="Aucun"
                  clearable
                  {...form.getInputProps('projectId')}
                  onChange={(projectId) => {
                    form.setFieldValue('projectId', projectId);
                    // Assignees out of the new project are dropped.
                    const allowed = new Set(context.assignableFor([projectId], routine?.assigneeIds ?? []).map((contributor) => contributor.id));
                    form.setFieldValue(
                      'assigneeIds',
                      form.values.assigneeIds.filter((id) => allowed.has(id)),
                    );
                  }}
                />
              )}
              <BatchMultiSelect
                onCreate={(name) => createCategory.mutateAsync({ name, color, parentId: null })}
                label="Catégories"
                placeholder={form.values.categoryIds.length ? undefined : 'Aucune'}
                clearable
                searchable
                {...treeSelectProps(categoryOptions(data?.routineCategories ?? []))}
                nothingFoundMessage="Aucune catégorie : tapez son nom pour la créer"
                {...form.getInputProps('categoryIds')}
              />
              {context && (
                <AssigneesSelect
                  // Of a project: its contributors only (the current assignees stay).
                  contributors={context.assignableFor([form.values.projectId], routine?.assigneeIds ?? [])}
                  value={form.values.assigneeIds}
                  onChange={(ids) => form.setFieldValue('assigneeIds', ids)}
                  error={form.errors.assigneeIds as string | undefined}
                />
              )}
              <BeneficiariesSelect
                value={{ beneficiaryIds: form.values.beneficiaryIds, beneficiaryRelationIds: form.values.beneficiaryRelationIds }}
                onChange={(beneficiaries) => form.setValues({ ...beneficiaries })}
              />
              <NumberInput
                label="Temps à y consacrer"
                description="En minutes"
                min={1}
                max={24 * 60}
                allowDecimal={false}
                suffix=" min"
                {...form.getInputProps('estimate')}
                value={form.values.estimate ?? ''}
                onChange={(value) => form.setFieldValue('estimate', value === '' ? null : Number(value))}
              />
              <Divider />
              <Select label="Routine parente" placeholder="Aucune" clearable searchable {...treeSelectProps(routineOptions((item) => !excluded.has(item.id)))} {...form.getInputProps('parentId')} />
              <BatchMultiSelect
                label="Dépend de"
                description="Routines à faire avant : tant qu’elles ne sont pas cochées, celle-ci est en attente."
                placeholder={form.values.requiredIds.length ? undefined : 'Aucune'}
                {...treeSelectProps(routineOptions((item) => copy || item.id !== routine?.id))}
                searchable
                clearable
                {...form.getInputProps('requiredIds')}
              />
            </Stack>
          </Grid.Col>
        </Grid>
        <FormActions onCancel={onDone} submitLabel={routine && !copy ? 'Enregistrer' : 'Créer'} loading={create.isPending || update.isPending} />
      </Stack>
    </form>
  );
}
