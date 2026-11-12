import { Button, Group, NumberInput, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { routineSchema, type Recurrence } from '@ordo/shared';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';
import { categoryOptions } from '../../components/category-tree/category-tree';
import { RecurrenceEditor } from '../../components/recurrence/RecurrenceEditor';
import { localToday } from '../../lib/dates';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { AssigneesSelect, ProjectSelect } from '../tasks/task-ui';
import { useTaskContext } from '../tasks/use-task-context';
import { useRoutineMutations, useRoutinesData, type Routine } from './api';
import { DAILY, ruleOf } from './routine-format';

interface RoutineFormValues extends Record<string, unknown> {
  title: string;
  description: string;
  categoryId: string | null;
  parentId: string | null;
  startDate: string;
  recurrence: Recurrence;
  estimate: number | null;
  projectId: string | null;
  assigneeIds: string[];
  requiredIds: string[];
}

export interface RoutineFormProps {
  /** Routine edited. */
  routine?: Routine;
  /** Parent of a new sub-routine (its category, rule and assignees are taken by default). */
  parent?: Routine;
  /** Category of a new routine. */
  categoryId?: string | null;
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
export function RoutineForm({ routine, parent, categoryId = null, onDone }: RoutineFormProps) {
  const { data } = useRoutinesData();
  const { context } = useTaskContext();
  const { create, update } = useRoutineMutations();
  const routines = data?.routines ?? [];
  const source = routine ?? parent;
  const form = useAppForm<RoutineFormValues>({
    initialValues: {
      title: routine?.title ?? '',
      description: routine?.description ?? '',
      categoryId: routine ? routine.categoryId : (parent?.categoryId ?? categoryId),
      parentId: routine ? routine.parentId : (parent?.id ?? null),
      startDate: routine?.startDate ?? (parent && parent.startDate > localToday() ? parent.startDate : localToday()),
      recurrence: (source && ruleOf(source)) ?? DAILY,
      estimate: routine?.estimate ?? null,
      projectId: routine ? routine.projectId : (parent?.projectId ?? null),
      assigneeIds: routine?.assigneeIds ?? parent?.assigneeIds ?? [],
      requiredIds: routine?.requiredIds ?? [],
    },
    schema: routineSchema,
  });
  // Neither the routine nor its sub-routines can be its parent; it cannot depend on itself.
  const excluded = routine ? subtreeOf(routines, routine.id) : new Set<string>();
  const routineOptions = (filter: (item: Routine) => boolean) =>
    routines
      .filter((item) => !item.archived && filter(item))
      .map((item) => ({ value: item.id, label: item.title }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

  const handleSubmit = form.onSubmit((values) => {
    const input = { ...values, description: values.description || null };
    const callbacks = {
      onSuccess: () => {
        notifySuccess(routine ? 'Routine modifiée.' : 'Routine créée.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (routine) update.mutate({ id: routine.id, input }, callbacks);
    else create.mutate(input, callbacks);
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Titre" required data-autofocus {...form.getInputProps('title')} />
        <Textarea label="Description" autosize minRows={2} maxRows={8} {...form.getInputProps('description')} />
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <Select
            label="Catégorie"
            placeholder="Aucune"
            clearable
            searchable
            data={categoryOptions(data?.routineCategories ?? [])}
            nothingFoundMessage="Aucune catégorie (ajoutez-en dans les paramètres)"
            {...form.getInputProps('categoryId')}
          />
          <Select label="Routine parente" placeholder="Aucune" clearable searchable data={routineOptions((item) => !excluded.has(item.id))} {...form.getInputProps('parentId')} />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <DatePickerInput label="Première fois" required valueFormat="D MMM YYYY" {...form.getInputProps('startDate')} />
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
        <RecurrenceEditor value={form.values.recurrence} onChange={(rule) => form.setFieldValue('recurrence', rule ?? DAILY)} start={form.values.startDate || localToday()} />
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
          data={routineOptions((item) => item.id !== routine?.id)}
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
            {routine ? 'Enregistrer' : 'Créer'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
