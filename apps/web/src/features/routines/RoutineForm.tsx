import { Button, Group, NumberInput, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { opensOnFits, readSlotRule, routineSchema, type Recurrence, type RoutineAnchor, type RoutineCase, type SlotRule } from '@ordo/shared';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { categoryOptions } from '../../components/category-tree/category-tree';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { AssigneesSelect, ProjectSelect } from '../tasks/task-ui';
import { useTaskContext } from '../tasks/use-task-context';
import { useRoutineMutations, useRoutinesData, type Routine } from './api';
import { DAILY, ruleOf } from './routine-format';
import { RoutineSchedule } from './RoutineSchedule';
import { OpensOnInput } from './OpensOnInput';
import { SlotRuleInput } from '../slot-rules/SlotRuleInput';
import { treeOptions, treeSelectProps } from '../../components/tree-select/tree-select';

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
  scheduleId: string | null;
  scheduleAnchor: RoutineAnchor | null;
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
  opensOn: string | null;
  slotRule: SlotRule | null;
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
 * Ids of a routine and of all its sub-routines.
 * @param {Routine[]} routines All routines.
 * @param {string} id Routine id.
 * @returns {Set<string>} Ids.
 */
function subtreeOf(routines: Routine[], id: string): Set<string> {
  const ids = new Set([id]);
  for (let added = true; added;) {
    added = false;
    for (const routine of routines) {
      if (routine.parentId && ids.has(routine.parentId) && !ids.has(routine.id)) {
        ids.add(routine.id);
        added = true;
      }
    }
  }
  return ids;
}

/**
 * Routine: title, description, category, parent routine, repetition from a first date, time to spend on it, assignees,
 * routines it depends on, and project its tracked time goes to.
 * @param {RoutineFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function RoutineForm({ routine, copy = false, parent, categoryId = null, projectId = null, onDone }: RoutineFormProps) {
  const { data } = useRoutinesData();
  const { context } = useTaskContext();
  const { create, update } = useRoutineMutations();
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
      scheduleId: routine?.scheduleId ?? null,
      reminders: routine?.reminders ?? [],
      cases: (source?.cases as RoutineCase[] | undefined) ?? [],
      scheduleAnchor: (routine?.scheduleAnchor as RoutineAnchor | null | undefined) ?? null,
      dueTime: routine?.dueTime ?? null,
      location: routine?.location ?? '',
      locationLat: routine?.locationLat ?? null,
      locationLon: routine?.locationLon ?? null,
      travelBefore: routine?.travelBefore ?? 0,
      travelAfter: routine?.travelAfter ?? 0,
      projectId: routine ? routine.projectId : (parent?.projectId ?? projectId),
      assigneeIds: routine?.assigneeIds ?? parent?.assigneeIds ?? [],
      requiredIds: routine?.requiredIds ?? [],
      opensOn: routine?.opensOn ?? null,
      slotRule: readSlotRule(routine?.slotRule ?? parent?.slotRule),
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
    // « À partir du » only for a monthly or yearly rule: dropped when the repetition changed.
    const opensOn = values.opensOn && opensOnFits(values.opensOn, values) ? values.opensOn : null;
    const input = { ...values, description: values.description || null, opensOn };
    const callbacks = {
      onSuccess: () => {
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
      <Stack gap="md">
        <TextInput label="Titre" required data-autofocus {...form.getInputProps('title')} />
        <Textarea label="Description" autosize minRows={2} maxRows={8} {...form.getInputProps('description')} />
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <BatchMultiSelect
            label="Catégories"
            placeholder={form.values.categoryIds.length ? undefined : 'Aucune'}
            clearable
            searchable
            {...treeSelectProps(categoryOptions(data?.routineCategories ?? []))}
            nothingFoundMessage="Aucune catégorie (ajoutez-en dans les paramètres)"
            {...form.getInputProps('categoryIds')}
          />
          <Select label="Routine parente" placeholder="Aucune" clearable searchable {...treeSelectProps(routineOptions((item) => !excluded.has(item.id)))} {...form.getInputProps('parentId')} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <DatePickerInput label="Première fois" required {...form.getInputProps('startDate')} />
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
        </SimpleGrid>
        <RoutineSchedule values={form.values} errors={form.errors} onChange={(changes) => form.setValues(changes)} />
        {!form.values.cases.length && !form.values.scheduleId && (form.values.recurrence.frequency === 'MONTHLY' || form.values.recurrence.frequency === 'YEARLY') && (
          <OpensOnInput
            frequency={form.values.recurrence.frequency}
            value={form.values.opensOn}
            onChange={(opensOn) => form.setFieldValue('opensOn', opensOn)}
            error={form.errors.opensOn as string | undefined}
          />
        )}
        <SlotRuleInput value={form.values.slotRule} onChange={(slotRule) => form.setFieldValue('slotRule', slotRule)} error={form.errors['slotRule.kinds'] as string | undefined} />
        {context && (
          <AssigneesSelect
            contributors={context.contributors}
            value={form.values.assigneeIds}
            onChange={(ids) => form.setFieldValue('assigneeIds', ids)}
            error={form.errors.assigneeIds as string | undefined}
          />
        )}
        <BatchMultiSelect
          label="Dépend de"
          description="Routines à faire avant : tant qu’elles ne sont pas cochées, celle-ci est en attente."
          placeholder={form.values.requiredIds.length ? undefined : 'Aucune'}
          {...treeSelectProps(routineOptions((item) => copy || item.id !== routine?.id))}
          searchable
          clearable
          {...form.getInputProps('requiredIds')}
        />
        {context && (
          <ProjectSelect
            context={context}
            label="Projet"
            description="Facultatif : le temps chronométré sur la routine y est compté."
            placeholder="Aucun"
            clearable
            {...form.getInputProps('projectId')}
          />
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {routine && !copy ? 'Enregistrer' : 'Créer'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
