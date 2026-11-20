import { readReminders, type Reminder } from '@ordo/shared';
import { removedLinksNote } from '../../../lib/text';
import { NO_SUGGESTIONS } from '../../../components/markdown/remark-references';
import { Divider, Grid, NumberInput, Select, Stack, TextInput } from '@mantine/core';
import {
  opensFits,
  readOpens,
  readSlotCondition,
  type ItemLink,
  type Recurrence,
  type RoutineCase,
  type RoutineInput,
  type RoutineOpens,
  routineSchema,
  type RoutineSlot,
  type SlotCondition,
  subtreeOf,
} from '@ordo/shared';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { categoryOptions } from '../../../components/tree/category-tree';
import { unarchived, unarchivedOffered } from '../../../lib/archive';
import { localToday } from '../../../lib/dates';
import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { notifySuccess } from '../../../lib/notify';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { AssigneesSelect, ProjectSelect } from '../../tasks/components/task-ui';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useRoutineMutations, useRoutinesData, type Routine } from '../api';
import { DAILY, linkableRoutine, panelOccurrence, routineTreeOptions, ruleOf } from '../lib/routine-format';
import * as fmt from '../../../lib/format';
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
import { LinksField } from '../../../components/inputs/LinksField';
import { linkInputs } from '../../../lib/links';

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
  reminders: Reminder[];
  cases: RoutineCase[];
  location: string;
  locationLat: number | null;
  locationLon: number | null;
  links: ItemLink[];
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

/**
 * Values of the form of an existing routine (also those its panel follows in the cache).
 * @param {Routine} routine Routine.
 * @returns {RoutineFormValues} Values.
 */
function routineFormValues(routine: Routine): RoutineFormValues {
  return {
    label: routine.label,
    description: routine.description ?? '',
    categoryIds: routine.categoryIds,
    parentId: routine.parentId,
    startDate: routine.startDate,
    recurrence: ruleOf(routine) ?? DAILY,
    estimate: routine.estimate ?? null,
    fromTime: routine.fromTime ?? null,
    slotCondition: readSlotCondition(routine.slotCondition),
    moments: (routine.moments as RoutineSlot[] | undefined) ?? [{ fromTime: null, dueTime: null, optional: false }],
    reminders: readReminders(routine.reminders),
    cases: (routine.cases as RoutineCase[] | undefined) ?? [],
    dueTime: routine.dueTime ?? null,
    location: routine.location ?? '',
    locationLat: routine.locationLat ?? null,
    locationLon: routine.locationLon ?? null,
    links: linkInputs(routine.links),
    travelBefore: routine.travelBefore ?? 0,
    travelAfter: routine.travelAfter ?? 0,
    projectId: routine.projectId,
    assigneeIds: routine.assigneeIds,
    requiredIds: routine.requiredIds,
    relatedIds: routine.relatedIds,
    beneficiaryIds: routine.beneficiaryIds,
    beneficiaryRelationIds: routine.beneficiaryRelationIds,
    opensOn: readOpens(routine.opensOn),
  };
}

/**
 * Input of the API from the values of the form: « Ouverture » of its rule (its cases have theirs) dropped when it no
 * longer fits the repetition.
 * @param {RoutineFormValues} values Values.
 * @returns {RoutineInput} Input.
 */
function formInput(values: RoutineFormValues): RoutineInput {
  const opensOn = values.opensOn && !values.cases.length && opensFits(values.opensOn, values.recurrence.frequency) ? values.opensOn : null;
  return { ...values, description: values.description || null, opensOn };
}

/** Fields of a routine saved on leaving them, in its panel (decision D22): texts, numbers, its links and its place. */
const ON_BLUR = ['label', 'description', 'estimate', 'links', 'location', 'locationLat', 'locationLon', 'travelBefore', 'travelAfter'] as const;

export interface RoutineFormProps {
  /** Routine edited. */
  routine?: Routine;
  /** Parent of a new sub-routine (its category, rule and assignees are taken by default). */
  parent?: Routine;
  /** Category of a new routine. */
  categoryId?: string | null;
  /** Project of a new routine. */
  projectId?: string | null;
  /** Occurrence open in the panel (chosen in the calendar), whose comments it shows; none: `panelOccurrence`. Optional. */
  occurrenceDate?: string | null;
  onDone: () => void;
}

/**
 * Routine, laid out as the task panel: title; description and when it comes (first date, repetition, « Ouverture »)
 * on the left; project, categories, assignees, beneficiaries, time to spend, slots, parent routine, the routines it
 * depends on and those it is related to (of its project tree, as the tasks) on the right. A new routine is a form with
 * « Créer »; an existing one, its panel, saves each field as soon as it changes (texts and numbers on leaving them,
 * decision D22, `useFieldSave`), « Enregistrement… » / « Enregistré » at its top.
 * @param {RoutineFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function RoutineForm({ routine, parent, categoryId = null, projectId = null, occurrenceDate = null, onDone }: RoutineFormProps) {
  const { data } = useRoutinesData();
  const { context } = useTaskContext();
  const { create, update } = useRoutineMutations();
  const categoryItems = useRoutineCategoryItems();
  const routines = data?.routines ?? [];
  const base = useAppForm<RoutineFormValues>({
    initialValues: routine
      ? routineFormValues(routine)
      : {
          label: '',
          description: '',
          categoryIds: parent?.categoryIds ?? (categoryId ? [categoryId] : []),
          parentId: parent?.id ?? null,
          startDate: parent && parent.startDate > localToday() ? parent.startDate : localToday(),
          recurrence: (parent && ruleOf(parent)) ?? DAILY,
          estimate: null,
          fromTime: null,
          slotCondition: readSlotCondition(parent?.slotCondition),
          moments: (parent?.moments as RoutineSlot[] | undefined) ?? [{ fromTime: null, dueTime: null, optional: false }],
          reminders: [],
          cases: (parent?.cases as RoutineCase[] | undefined) ?? [],
          dueTime: null,
          location: '',
          locationLat: null,
          locationLon: null,
          // A new sub-routine takes no link of its parent (nor its place).
          links: [],
          travelBefore: 0,
          travelAfter: 0,
          projectId: parent?.projectId ?? projectId,
          assigneeIds: parent?.assigneeIds ?? [],
          requiredIds: [],
          relatedIds: [],
          beneficiaryIds: parent?.beneficiaryIds ?? [],
          beneficiaryRelationIds: parent?.beneficiaryRelationIds ?? [],
          opensOn: null,
        },
    schema: routineSchema,
  });
  // An existing routine: each field saved as soon as it changes (decision D22), the routine of the cache followed.
  const current = routine && (routines.find((item) => item.id === routine.id) ?? routine);
  const { form, saving, commit, fieldProps } = useFieldSave(base, {
    save: routine ? (_changes, values) => update.mutateAsync({ id: routine.id, input: formInput(values) }) : null,
    schema: routineSchema,
    saved: current && routineFormValues(current),
    onBlur: ON_BLUR,
    readOnly: routine?.archived,
    // Moved to another project tree: the links left out of it are removed, and told (as for a task transferred).
    onSaved: (result) => {
      const { removedLinks } = result as { removedLinks: number };
      if (removedLinks > 0) notifySuccess(`Routine déplacée.${removedLinksNote(removedLinks)}`);
    },
  });
  // Neither the routine nor its sub-routines can be its parent; it cannot depend on itself.
  const excluded = routine ? subtreeOf(routines, routine.id) : new Set<string>();
  /**
   * Options of a select of routines, in tree order under their parent routine (greyed out when not offered).
   * @param {(item: Routine) => boolean} filter Routines offered (active ones only).
   * @returns {TreeOption[]} Options.
   */
  const routineOptions = (filter: (item: Routine) => boolean) => routineTreeOptions(routines, (item) => !item.archived && filter(item));
  /**
   * Options of a link with other routines (« Dépend de », « Relative à »): those of its project tree, not itself;
   * those linked already stay.
   * @param {string[]} linked Routines linked already.
   * @returns {TreeOption[]} Options.
   */
  const linkOptions = (linked: string[]) => routineTreeOptions(routines, context ? linkableRoutine(context, form.values.projectId, routine?.id ?? null, linked) : () => false);

  // A new routine only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit((values) => create.mutate(formInput(values), formCallbacks(form, 'Routine créée.', onDone)));

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="lg">
        {routine && <SaveStatus saving={saving} />}
        <TextInput label="Libellé" required data-autofocus={routine ? undefined : true} {...form.getInputProps('label')} />
        {/* As the task panel: the text and when it comes on the left, its properties on the right. */}
        <Grid gap="xl">
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="md">
              <MarkdownEditor label="Description" {...fieldProps('description')} suggestions={context?.suggestionsFor(form.values.projectId) ?? NO_SUGGESTIONS} minRows={3} />
              <LinksField form={form} onRemoved={() => commit(['links'])} />
              <SubSection title="Quand" gap="md">
                <RoutineSchedule values={form.values} errors={form.errors} onChange={(changes) => form.setValues(changes)} onCommit={commit} />
              </SubSection>
              {routine && <SheetsSection owner={{ routineId: routine.id }} occurrenceDate={routine.currentDate || null} label={routine.label} />}
              {routine && <RoutineComments routine={routine} occurrenceDate={occurrenceDate ?? panelOccurrence(routine)} />}
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
        {!routine && <FormActions onCancel={onDone} submitLabel="Créer" loading={create.isPending} />}
      </Stack>
    </form>
  );
}

/**
 * Comments of the occurrence of a routine open in its panel (decision D19), titled with its day; nothing without any
 * occurrence.
 * @param {{ routine: Routine, occurrenceDate: string | null }} props Routine and its occurrence.
 * @returns {JSX.Element | null} Comments.
 */
function RoutineComments({ routine, occurrenceDate }: { routine: Routine; occurrenceDate: string | null }) {
  if (!occurrenceDate) return null;
  return (
    <Comments target="ROUTINE" id={routine.id} occurrenceDate={occurrenceDate} title={`Commentaires du ${fmt.day(occurrenceDate)}`} projectId={routine.projectId ?? null} readOnly={routine.archived} />
  );
}
