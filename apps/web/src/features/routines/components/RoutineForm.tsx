import { copyName, removedLinksNote } from '../../../lib/text';
import { NO_SUGGESTIONS } from '../../../components/markdown/remark-references';
import { Divider, Grid, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import {
  opensFits,
  readOpens,
  readSlotCondition,
  type Recurrence,
  type RoutineCase,
  type RoutineOpens,
  routineSchema,
  type RoutineSlot,
  type SlotCondition,
  subtreeOf,
  mapById,
} from '@ordo/shared';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { categoryOptions } from '../../../components/tree/category-tree';
import { unarchived, unarchivedOffered } from '../../../lib/archive';
import { localToday } from '../../../lib/dates';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { ON_ERROR } from '../../../lib/notify';
import { AssigneesSelect, ProjectSelect } from '../../tasks/components/task-ui';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useRoutineMutations, useRoutinesData, type Routine } from '../api';
import { copiedLinks, DAILY, linkableRoutine, routineTreeOptions, ruleOf } from '../lib/routine-format';
import { RoutineSchedule } from './RoutineSchedule';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { BeneficiariesSelect } from '../../beneficiaries/components/BeneficiariesSelect';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { Comments } from '../../comments/components/Comments';
import { SheetsSection } from '../../sheets/components/SheetsSection';
import { useRoutineCategoryItems } from '../hooks/use-category-items';
import { itemCreator } from '../../../components/settings/create-settings-item';
import { FormActions } from '../../../components/dialogs/FormActions';
import { SubSection } from '../../../components/page/SubSection';
import { optionalNumberProps } from '../../../components/inputs/number-format';

interface RoutineFormValues extends Record<string, unknown> {
  label: string;
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
  relatedIds: string[];
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
 * on the left; project, categories, assignees, beneficiaries, time to spend, slots, parent routine, the routines it
 * depends on and those it is related to (of its project tree, as the tasks) on the right.
 * @param {RoutineFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function RoutineForm({ routine, copy = false, parent, categoryId = null, projectId = null, onDone }: RoutineFormProps) {
  const { data } = useRoutinesData();
  const { context } = useTaskContext();
  const { create, update, copySubRoutines } = useRoutineMutations();
  const categoryItems = useRoutineCategoryItems();
  const routines = data?.routines ?? [];
  const source = routine ?? parent;
  const form = useAppForm<RoutineFormValues>({
    initialValues: {
      label: routine ? (copy ? copyName(routine.label) : routine.label) : '',
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
      // A copy leaves out the former links out of its project tree.
      ...(routine && copy ? copiedLinks(routine, context, mapById(routines)) : { requiredIds: routine?.requiredIds ?? [], relatedIds: routine?.relatedIds ?? [] }),
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
  const routineOptions = (filter: (item: Routine) => boolean) => routineTreeOptions(routines, (item) => !item.archived && filter(item));
  /**
   * Options of a link with other routines (« Dépend de », « Relative à »): those of its project tree, not itself (a
   * copy may link to it); those linked already stay.
   * @param {string[]} linked Routines linked already.
   * @returns {TreeOption[]} Options.
   */
  const linkOptions = (linked: string[]) =>
    routineTreeOptions(routines, context ? linkableRoutine(context, form.values.projectId, copy ? null : (routine?.id ?? null), linked) : () => false);

  const handleSubmit = form.onSubmit((values) => {
    // « À partir du » of its rule (its cases have theirs): dropped when it no longer fits the repetition.
    const opensOn = values.opensOn && !values.cases.length && opensFits(values.opensOn, values.recurrence.frequency) ? values.opensOn : null;
    const input = { ...values, description: values.description || null, opensOn };
    // Moved to another project tree: the links left out of it are removed, and told (as for a task transferred).
    if (routine && !copy) update.mutate({ id: routine.id, input }, formCallbacks(form, ({ removedLinks }) => `Routine modifiée.${removedLinksNote(removedLinks)}`, onDone));
    else
      create.mutate(
        input,
        formCallbacks(form, copy ? 'Routine dupliquée.' : 'Routine créée.', (created) => {
          // A copy takes the sub-routines of the routine with it, under itself.
          if (copy && routine && routines.some((item) => item.parentId === routine.id)) copySubRoutines.mutate({ fromId: routine.id, toId: created }, ON_ERROR);
          onDone();
        }),
      );
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="lg">
        <TextInput label="Libellé" required data-autofocus {...form.getInputProps('label')} />
        {/* As the task panel: the text and when it comes on the left, its properties on the right. */}
        <Grid gap="xl">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="md">
              <MarkdownEditor
                label="Description"
                value={form.values.description}
                onChange={(description) => form.setFieldValue('description', description)}
                suggestions={context?.suggestionsFor(form.values.projectId) ?? NO_SUGGESTIONS}
                minRows={3}
              />
              <SubSection title="Quand" gap="md">
                <RoutineSchedule values={form.values} errors={form.errors} onChange={(changes) => form.setValues(changes)} />
              </SubSection>
              {routine && !copy && <SheetsSection owner={{ routineId: routine.id }} occurrenceDate={routine.currentDate || null} label={routine.label} />}
              {routine && !copy && <Comments target="ROUTINE" id={routine.id} projectId={routine.projectId ?? null} readOnly={routine.archived} />}
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
                  // The assignees stay: on saving, they are attached to the new project.
                  {...form.getInputProps('projectId')}
                />
              )}
              <BatchMultiSelect
                onCreate={itemCreator('Nouvelle catégorie', categoryItems, { tree: unarchived(data?.routineCategories ?? []) })}
                label="Catégories"
                placeholder={form.values.categoryIds.length ? undefined : 'Aucune'}
                clearable
                searchable
                // Archived categories are no longer offered, but those of the routine stay.
                {...treeSelectProps(categoryOptions(data?.routineCategories ?? [], undefined, unarchivedOffered(data?.routineCategories ?? [], form.values.categoryIds)))}
                nothingFoundMessage="Aucune catégorie : tapez son libellé pour la créer"
                {...form.getInputProps('categoryIds')}
              />
              {context && (
                <AssigneesSelect
                  // Of a project: its contributors only (the chosen assignees stay, even when the project changes).
                  contributors={context.assignableFor([form.values.projectId], form.values.assigneeIds)}
                  value={form.values.assigneeIds}
                  onChange={(ids) => form.setFieldValue('assigneeIds', ids)}
                  error={form.errors.assigneeIds as string | undefined}
                />
              )}
              <BeneficiariesSelect
                value={{ beneficiaryIds: form.values.beneficiaryIds, beneficiaryRelationIds: form.values.beneficiaryRelationIds }}
                onChange={(beneficiaries) => form.setValues({ ...beneficiaries })}
              />
              <NumberInput label="Temps à y consacrer" description="En minutes" min={1} max={24 * 60} allowDecimal={false} suffix=" min" {...optionalNumberProps(form, 'estimate')} />
              <Divider />
              <Select label="Routine parente" placeholder="Aucune" clearable searchable {...treeSelectProps(routineOptions((item) => !excluded.has(item.id)))} {...form.getInputProps('parentId')} />
              <BatchMultiSelect
                label="Dépend de"
                description="Routines à faire avant : tant qu’elles ne sont pas cochées, celle-ci est en attente."
                placeholder={form.values.requiredIds.length ? undefined : 'Aucune'}
                {...treeSelectProps(linkOptions(form.values.requiredIds))}
                searchable
                clearable
                {...form.getInputProps('requiredIds')}
              />
              <BatchMultiSelect
                label="Relative à"
                description="Routines liées, sans ordre entre elles."
                placeholder={form.values.relatedIds.length ? undefined : 'Aucune'}
                {...treeSelectProps(linkOptions(form.values.relatedIds))}
                searchable
                clearable
                {...form.getInputProps('relatedIds')}
              />
            </Stack>
          </Grid.Col>
        </Grid>
        <FormActions onCancel={onDone} submitLabel={routine && !copy ? 'Enregistrer' : 'Créer'} loading={create.isPending || update.isPending} />
      </Stack>
    </form>
  );
}
