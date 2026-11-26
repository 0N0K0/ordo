import { readDeadTimes, readReminders, type DeadTime, type Reminder } from '@ordo/shared';
import { removedLinksNote } from '../../../lib/text';
import { NO_SUGGESTIONS, NO_TARGETS } from '../../../components/markdown/remark-references';
import { Group, NumberInput, Select } from '@mantine/core';
import { ArrowSquareInIcon } from '@phosphor-icons/react';
import { ActionButton } from '../../../components/actions/ActionButton';
import {
  opensFits,
  readOpens,
  readSlotCondition,
  type ItemLink,
  type Recurrence,
  type RoutineCase,
  type RoutineInheritableField,
  type RoutineInput,
  type RoutineOpens,
  ROUTINE_REQUIRED_FIELDS,
  routineSchema,
  type RoutineSlot,
  type SlotCondition,
  subtreeOf,
} from '@ordo/shared';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { categoryOptions } from '../../../components/tree/category-tree';
import { unarchived, unarchivedOffered } from '../../../lib/archive';
import { parisToday } from '../../../lib/dates';
import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { notifySuccess } from '../../../lib/notify';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { AddItemButton } from '../../../components/actions/AddItemButton';
import { DateField } from '../../../components/inputs/DateField';
import { FormDescription } from '../../../components/markdown/DescriptionSection';
import { DetailLayout, PanelGroup } from '../../../components/panels/DetailLayout';
import { PANEL_GROUPS } from '../../../components/panels/panel-groups';
import { TrackedTime } from '../../time/components/TrackedTime';
import { onRoutine } from '../../time/api';
import { RoutineDoneToggles } from './DoneToggle';
import { openRoutineForm } from '../lib/open-routine-form';
import { AssigneesSelect, LabelSelect, ProjectSelect } from '../../tasks/components/task-ui';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useRoutineMutations, useRoutinesData, type Routine } from '../api';
import { blockedRoutineIds, DAILY, linkableRoutine, panelOccurrence, routineTreeOptions, ruleOf } from '../lib/routine-format';
import * as fmt from '../../../lib/format';
import { RoutinePlace, RoutineReminders, RoutineRepetition } from './RoutineSchedule';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { BeneficiariesSelect } from '../../beneficiaries/components/BeneficiariesSelect';
import { Comments } from '../../comments/components/Comments';
import { SheetsSection } from '../../sheets/components/SheetsSection';
import { useRoutineCategoryItems } from '../hooks/use-category-items';
import { itemCreator } from '../../../components/settings/create-settings-item';
import { FormActions } from '../../../components/dialogs/FormActions';
import { SubSection } from '../../../components/page/SubSection';
import { optionalNumberProps } from '../../../components/inputs/number-format';
import { LinksField } from '../../../components/inputs/LinksField';
import { DocumentsField } from '../../documents/components/DocumentsField';
import { inProjectTree } from '../../tasks/lib/task-links';
import { linkInputs } from '../../../lib/links';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { useConvertActivity } from '../hooks/use-convert-activity';
import { useSetBlockedRoutines } from '../hooks/use-routine-blocks';
import { useRoutineRowsActions } from './RoutineBulkBar';
import { rowMenuEntry } from '../../../components/data-table/selection/selection-actions';
import type { RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { DeadTimesField } from '../../countdowns/components/DeadTimesField';
import { useCountdownMenuEntries } from '../../countdowns/hooks/use-saved-countdowns';
import { SavedCountdownsField } from '../../countdowns/components/SavedCountdownsField';
import { routinesKey } from '../../../lib/query-keys';
import { routineCountdownItem } from '../lib/routine-countdowns';
import { formInheritance } from '../../../components/inheritance/form-inheritance';
import { InheritedField } from '../../../components/inheritance/InheritedField';
import { ROUTINE_FIELD_LABELS, ROUTINE_REPETITION_FIELDS, ROUTINE_REPETITION_KEYS, routineParentName } from '../lib/routine-inheritance';

interface RoutineFormValues extends Record<string, unknown> {
  label: string;
  description: string;
  categoryIds: string[];
  priorityId: string | null;
  typeId: string | null;
  parentId: string | null;
  startDate: string;
  recurrence: Recurrence;
  estimate: number | null;
  fromTime: string | null;
  dueTime: string | null;
  slotCondition: SlotCondition | null;
  moments: RoutineSlot[];
  reminders: Reminder[];
  deadTimes: DeadTime[];
  cases: RoutineCase[];
  location: string;
  locationLat: number | null;
  locationLon: number | null;
  links: ItemLink[];
  /** Documents linked: of the library, and of its project tree (not inherited). */
  libraryDocumentIds: string[];
  projectResourceIds: string[];
  travelBefore: number;
  travelAfter: number;
  projectId: string | null;
  assigneeIds: string[];
  requiredIds: string[];
  relatedIds: string[];
  opensOn: RoutineOpens | null;
  beneficiaryIds: string[];
  beneficiaryRelationIds: string[];
  /** Fields it takes from its parent. */
  inheritedFields: RoutineInheritableField[];
}

/** Keys of the form showing each inherited field of a sub-routine (its exceptions are not in the form). */
const FORM_COLUMNS: Partial<Record<RoutineInheritableField, readonly (keyof RoutineFormValues & string)[]>> = {
  PROJECT: ['projectId'],
  CATEGORIES: ['categoryIds'],
  PRIORITY: ['priorityId'],
  ASSIGNEES: ['assigneeIds'],
  BENEFICIARIES: ['beneficiaryIds', 'beneficiaryRelationIds'],
  LOCATION: ['location', 'locationLat', 'locationLon'],
  START_DATE: ['startDate'],
  RECURRENCE: ['recurrence'],
  CASES: ['cases'],
  MOMENTS: ['moments', 'fromTime', 'dueTime'],
  SLOT_CONDITION: ['slotCondition'],
  OPENS_ON: ['opensOn'],
};

/** Fields of the form showing an inherited field. */
const FORM_FIELDS = Object.keys(FORM_COLUMNS) as RoutineInheritableField[];

/**
 * Fields of a new sub-routine inherited from its parent, until one is given a value or emptied: those of the form, and
 * its exceptions (not in the form: changed from the agenda, « Vider » in « Héritage… »).
 */
const NEW_SUB_ROUTINE_FIELDS: RoutineInheritableField[] = [...FORM_FIELDS, 'MOVES'];

/**
 * Values of the inherited fields among values of the form (those of a parent).
 * @param {RoutineFormValues} values Values.
 * @returns {Partial<RoutineFormValues>} Values of its inherited fields.
 */
const pickParent = (values: RoutineFormValues): Partial<RoutineFormValues> => Object.fromEntries(FORM_FIELDS.flatMap((field) => (FORM_COLUMNS[field] ?? []).map((key) => [key, values[key]])));

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
    priorityId: routine.priorityId ?? null,
    typeId: routine.typeId ?? null,
    parentId: routine.parentId,
    startDate: routine.startDate,
    recurrence: ruleOf(routine) ?? DAILY,
    estimate: routine.estimate ?? null,
    fromTime: routine.fromTime ?? null,
    slotCondition: readSlotCondition(routine.slotCondition),
    moments: (routine.moments as RoutineSlot[] | undefined) ?? [{ fromTime: null, dueTime: null, optional: false }],
    reminders: readReminders(routine.reminders),
    deadTimes: readDeadTimes(routine.deadTimes),
    cases: (routine.cases as RoutineCase[] | undefined) ?? [],
    dueTime: routine.dueTime ?? null,
    location: routine.location ?? '',
    locationLat: routine.locationLat ?? null,
    locationLon: routine.locationLon ?? null,
    links: linkInputs(routine.links),
    libraryDocumentIds: routine.libraryDocumentIds,
    projectResourceIds: routine.projectResourceIds,
    travelBefore: routine.travelBefore ?? 0,
    travelAfter: routine.travelAfter ?? 0,
    projectId: routine.projectId,
    assigneeIds: routine.assigneeIds,
    requiredIds: routine.requiredIds,
    relatedIds: routine.relatedIds,
    beneficiaryIds: routine.beneficiaryIds,
    beneficiaryRelationIds: routine.beneficiaryRelationIds,
    opensOn: readOpens(routine.opensOn),
    inheritedFields: routine.inheritedFields as RoutineInheritableField[],
  };
}

/**
 * Input of the API from the values of the form: « Ouverture » of its rule (its cases have theirs) dropped when it no
 * longer fits the repetition; the fields it inherits.
 * @param {RoutineFormValues} values Values.
 * @param {RoutineInheritableField[]} inheritedFields Fields still inherited.
 * @returns {RoutineInput} Input.
 */
function formInput(values: RoutineFormValues, inheritedFields: RoutineInheritableField[]): RoutineInput {
  const opensOn = values.opensOn && !values.cases.length && opensFits(values.opensOn, values.recurrence.frequency) ? values.opensOn : null;
  return { ...values, description: values.description || null, opensOn, inheritedFields };
}

/**
 * Fields of a routine saved on leaving them, in its panel: texts, numbers, its links and its place; its repetition once
 * a value is chosen or an hour, a number left (`RoutineRepetition`'s `onCommit`), never on each key typed.
 */
const ON_BLUR = ['label', 'description', 'estimate', 'links', 'location', 'locationLat', 'locationLon', 'travelBefore', 'travelAfter', ...ROUTINE_REPETITION_KEYS] as const;

export interface RoutineFormProps {
  /** Routine edited. */
  routine?: Routine;
  /** Parent of a new sub-routine (its category, rule and assignees are taken by default). */
  parent?: Routine;
  /** Category of a new routine. */
  categoryId?: string | null;
  /** Project of a new routine. */
  projectId?: string | null;
  /** « Première fois » of a new routine (the day it is added on). Optional. Default = today, or the first time of its parent when later. */
  startDate?: string;
  /** Occurrence open in the panel (chosen in the calendar), whose comments it shows; none: `panelOccurrence`. Optional. */
  occurrenceDate?: string | null;
  onDone: () => void;
}

/**
 * Routine, laid out as the task and event panels (`DetailLayout`): its done switch, its label and its « … » menu, then
 * its project; on the left its description, « Relations » (parent routine, sub-routines, the routines it depends on,
 * those that depend on it — written in theirs — and those it is related to, of its project tree as the tasks), its repetition and the comments of the occurrence open;
 * on the right « Classement » (categories, priority and type, the lists of the tasks), « Parties prenantes », « Planification » (first time, time to spend, dead
 * times, time tracked), « Lieu », « Alarmes » (reminders, saved timers) and « Ressources » (links, documents, sheets). A new
 * routine is a form with « Créer »; an existing one saves each field as soon as it changes (texts and numbers on
 * leaving them, its repetition right in the panel once a value is chosen or a number left, `useFieldSave`), « Enregistrement… » / « Enregistré » in its header.
 * @param {RoutineFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
export function RoutineForm({ routine, parent, categoryId = null, projectId = null, startDate, occurrenceDate = null, onDone }: RoutineFormProps) {
  const { data } = useRoutinesData();
  const { context } = useTaskContext();
  const { create, update } = useRoutineMutations();
  const categoryItems = useRoutineCategoryItems();
  const convert = useConvertActivity();
  const rowActionsOf = useRoutineRowsActions();
  const countdownEntries = useCountdownMenuEntries();
  const routines = data?.routines ?? [];
  const setBlocked = useSetBlockedRoutines(routines);
  const base = useAppForm<RoutineFormValues>({
    initialValues: routine
      ? routineFormValues(routine)
      : {
          label: '',
          description: '',
          categoryIds: parent?.categoryIds ?? (categoryId ? [categoryId] : []),
          priorityId: parent?.priorityId ?? null,
          // Its type is its own (not inherited, as a sub-task's).
          typeId: null,
          parentId: parent?.id ?? null,
          startDate: startDate ?? (parent && parent.startDate > parisToday() ? parent.startDate : parisToday()),
          recurrence: (parent && ruleOf(parent)) ?? DAILY,
          estimate: null,
          fromTime: null,
          slotCondition: readSlotCondition(parent?.slotCondition),
          moments: (parent?.moments as RoutineSlot[] | undefined) ?? [{ fromTime: null, dueTime: null, optional: false }],
          reminders: [],
          deadTimes: [],
          cases: (parent?.cases as RoutineCase[] | undefined) ?? [],
          dueTime: null,
          location: '',
          locationLat: null,
          locationLon: null,
          // A new sub-routine takes no link of its parent (nor its place, nor its documents).
          links: [],
          libraryDocumentIds: [],
          projectResourceIds: [],
          travelBefore: 0,
          travelAfter: 0,
          projectId: parent?.projectId ?? projectId,
          assigneeIds: parent?.assigneeIds ?? [],
          requiredIds: [],
          relatedIds: [],
          beneficiaryIds: parent?.beneficiaryIds ?? [],
          beneficiaryRelationIds: parent?.beneficiaryRelationIds ?? [],
          opensOn: null,
          // A new sub-routine inherits from its parent: its values shown greyed (also sent; the API
          // computes its occurrences from its parent's while it inherits them).
          ...(parent && pickParent(routineFormValues(parent))),
          inheritedFields: parent ? NEW_SUB_ROUTINE_FIELDS : [],
        },
    schema: routineSchema,
  });
  // An existing routine: each field saved as soon as it changes, the routine of the cache followed.
  const current = routine && (routines.find((item) => item.id === routine.id) ?? routine);
  // Archived (elsewhere too, the panel open): read only.
  const readOnly = Boolean(current?.archived);
  /**
   * Values a sub-routine takes from a parent, as the form holds them (those the parent goes by); none without parent.
   * @param {string | null} parentId Parent.
   * @returns {Partial<RoutineFormValues> | null} Values.
   */
  const parentValuesOf = (parentId: string | null) => {
    const parentRow = parentId ? routines.find((item) => item.id === parentId) : undefined;
    return parentRow ? pickParent(routineFormValues(parentRow)) : null;
  };
  /**
   * Inheritance of the fields of the form: greyed while they hold the parent's values.
   * @param {RoutineFormValues} values Values.
   * @param {(patch: Partial<RoutineFormValues>, list: RoutineInheritableField[]) => void} apply Puts a change in the form.
   * @returns {FormInheritance<RoutineFormValues, RoutineInheritableField>} Inheritance.
   */
  const inheritanceOf = (values: RoutineFormValues, apply: (patch: Partial<RoutineFormValues>, list: RoutineInheritableField[]) => void = () => undefined) =>
    formInheritance({ values, columns: FORM_COLUMNS, parent: parentValuesOf(values.parentId), list: values.inheritedFields, apply, required: ROUTINE_REQUIRED_FIELDS });
  /**
   * Input of the API from values of the form, with the fields still inherited.
   * @param {RoutineFormValues} values Values.
   * @returns {RoutineInput} Input.
   */
  const inputOf = (values: RoutineFormValues) => formInput(values, inheritanceOf(values).inheritedFields(values));
  const { form, saving, commit, fieldProps } = useFieldSave(base, {
    save: routine ? (_changes, values) => update.mutateAsync({ id: routine.id, input: inputOf(values) }) : null,
    schema: routineSchema,
    saved: current && routineFormValues(current),
    onBlur: ON_BLUR,
    readOnly,
    // Moved to another project tree: the links left out of it are removed, and told (as for a task transferred).
    onSaved: (result) => {
      const { removedLinks } = result as { removedLinks: number };
      if (removedLinks > 0) notifySuccess(`Routine déplacée.${removedLinksNote(removedLinks)}`);
    },
  });
  // Its fields greyed while inherited, « Vider » / « Rétablir l'héritage » saved at once in its panel.
  const inheritance = inheritanceOf(form.values, (patch, list) => {
    form.setValues({ ...patch, inheritedFields: list });
    commit([...(Object.keys(patch) as (keyof RoutineFormValues & string)[]), 'inheritedFields']);
  });
  const parentName = routineParentName(form.values, new Map(routines.map((item) => [item.id, item])));
  /**
   * What an inherited field of the form shows (`InheritedField`).
   * @param {RoutineInheritableField} field Field.
   * @returns {object} Props.
   */
  const inherited = (field: RoutineInheritableField) => ({ ...inheritance.field(field), from: parentName, readOnly });
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

  /**
   * Its « … » menu, as the task's: « Dupliquer », « Transformer en tâche » (refused with sub-routines),
   * « Archiver », « Supprimer » (the actions of its row, `useRoutineRowsActions`); archived: « Restaurer »,
   * « Supprimer »; then « Lancer » each of its dead times, for the occurrence open. Deleted or transformed,
   * its panel closes (`closeRoutinePanels`).
   * @param {Routine} item Routine of the panel (of the cache).
   * @returns {RowMenuEntry[]} Entries.
   */
  const menu = (item: Routine): RowMenuEntry[] => {
    const { duplicate, inheritance, archive, remove } = rowActionsOf([item]);
    if (item.archived) return [archive, remove].map(rowMenuEntry);
    return [
      rowMenuEntry(duplicate),
      ...(item.parentId ? [rowMenuEntry(inheritance)] : []),
      convert.toTask(item, routines.some((other) => other.parentId === item.id)),
      rowMenuEntry(archive),
      rowMenuEntry(remove),
      ...countdownEntries(item, routineCountdownItem(item, occurrenceDate ?? panelOccurrence(item))),
    ];
  };

  // A new routine only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit((values) => create.mutate(inputOf(values), formCallbacks(form, 'Routine créée.', onDone)));

  // « Bloque »: the routines that depend on this one.
  const blocked = current ? blockedRoutineIds(routines, current.id) : [];
  const subRoutines = routine ? routines.filter((item) => item.parentId === routine.id) : [];
  const commentsDate = routine ? (occurrenceDate ?? panelOccurrence(routine)) : null;
  // The fields of its « quand » and its place, with the inheritance of a sub-routine.
  const scheduleProps = { values: form.values, errors: form.errors, onChange: (changes: Partial<RoutineFormValues>) => form.setValues(changes), onCommit: commit };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <DetailLayout
        readOnly={readOnly}
        status={
          current && (
            <Group h={36} wrap="nowrap">
              <RoutineDoneToggles routine={current} disabled={readOnly} />
            </Group>
          )
        }
        title={form.getInputProps('label')}
        focusTitle={!routine}
        // Archived (read only), its menu still offers « Restaurer » and « Supprimer ».
        menu={current && <ActionsMenu about="la routine" items={menu(current)} variant="light" size="input-xs" />}
        project={
          context && (
            <InheritedField {...inherited('PROJECT')}>
              <ProjectSelect
                context={context}
                label="Projet"
                description="Facultatif : le temps chronométré sur la routine y est compté."
                placeholder="Aucun"
                clearable
                // The assignees stay: on saving, they are attached to the new project.
                {...form.getInputProps('projectId')}
              />
            </InheritedField>
          )
        }
        mentions={readOnly && <ArchivedBadge feminine />}
        saving={current && !readOnly ? saving : undefined}
        main={
          <>
            <FormDescription field={fieldProps('description')} commit={() => commit(['description'])} targets={context?.targetsFor(form.values.projectId) ?? NO_TARGETS} suggestions={context?.suggestionsFor(form.values.projectId) ?? NO_SUGGESTIONS} readOnly={readOnly} />
            <PanelGroup title={PANEL_GROUPS.relations}>
              <Select
                label="Routine parente"
                placeholder="Aucune"
                clearable
                searchable
                {...treeSelectProps(routineOptions((item) => !excluded.has(item.id)))}
                {...form.getInputProps('parentId')}
                // A new parent: a new routine inherits every field from it, an existing one keeps inheriting what it
                // inherited (from the new one; the API makes its empty fields inherit).
                onChange={(parentId) => {
                  const next = parentValuesOf(parentId);
                  form.setValues({ parentId, ...(next ? {} : { inheritedFields: [] }) });
                  if (next) inheritance.adopt(next, routine ? (form.values.parentId ? form.values.inheritedFields : []) : NEW_SUB_ROUTINE_FIELDS);
                }}
              />
              {current && (
                <SubSection title="Sous-routines" gap="xs">
                  {subRoutines.length ? (
                    subRoutines.map((item) => (
                      <div key={item.id}>
                        <ActionButton priority="tertiary" icon={<ArrowSquareInIcon aria-hidden />} onClick={() => openRoutineForm({ routine: item })}>
                          {item.label}
                        </ActionButton>
                      </div>
                    ))
                  ) : (
                    <EmptyState compact message="Aucune sous-routine." />
                  )}
                  {!readOnly && <AddItemButton onClick={() => openRoutineForm({ parent: current })}>Ajouter une sous-routine</AddItemButton>}
                </SubSection>
              )}
              <BatchMultiSelect
                label="Dépend de"
                description="Routines à faire avant : tant qu’elles ne sont pas cochées, celle-ci est en attente."
                placeholder={form.values.requiredIds.length ? undefined : 'Aucune'}
                {...treeSelectProps(linkOptions(form.values.requiredIds))}
                searchable
                clearable
                {...form.getInputProps('requiredIds')}
              />
              {current && (
                <BatchMultiSelect
                  label="Bloque"
                  description="Routines qui attendent celle-ci : les choisir ici leur ajoute la dépendance."
                  placeholder={blocked.length ? undefined : 'Aucune'}
                  {...treeSelectProps(linkOptions(blocked))}
                  searchable
                  clearable
                  value={blocked}
                  // Written in the « Dépend de » of the routines chosen or removed, saved at once.
                  onChange={(next) => setBlocked(blocked, next, [current.id])}
                />
              )}
              <BatchMultiSelect
                label="Relative à"
                description="Routines liées, sans ordre entre elles."
                placeholder={form.values.relatedIds.length ? undefined : 'Aucune'}
                {...treeSelectProps(linkOptions(form.values.relatedIds))}
                searchable
                clearable
                {...form.getInputProps('relatedIds')}
              />
            </PanelGroup>
            <PanelGroup>
              <RoutineRepetition {...scheduleProps} inherited={{ from: parentName, state: inheritance.group(ROUTINE_REPETITION_FIELDS, ROUTINE_FIELD_LABELS), readOnly }} />
            </PanelGroup>
          </>
        }
        comments={
          routine &&
          commentsDate && (
            <PanelGroup title={`${PANEL_GROUPS.comments} du ${fmt.day(commentsDate)}`}>
              <Comments target="ROUTINE" id={routine.id} occurrenceDate={commentsDate} title={null} projectId={routine.projectId ?? null} readOnly={routine.archived} />
            </PanelGroup>
          )
        }
        side={
          <>
            <PanelGroup title={PANEL_GROUPS.ranking}>
              <InheritedField {...inherited('CATEGORIES')}>
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
              </InheritedField>
              {context && (
                <>
                  <InheritedField {...inherited('PRIORITY')}>
                    <LabelSelect kind="priority" label="Priorité" labels={context.priorities} {...form.getInputProps('priorityId')} />
                  </InheritedField>
                  <LabelSelect kind="type" label="Type" labels={context.types} {...form.getInputProps('typeId')} />
                </>
              )}
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.people}>
              {context && (
                <InheritedField {...inherited('ASSIGNEES')}>
                  <AssigneesSelect
                    // Of a project: its contributors only (the chosen assignees stay, even when the project changes).
                    contributors={context.assignableFor([form.values.projectId], form.values.assigneeIds)}
                    value={form.values.assigneeIds}
                    onChange={(ids) => form.setFieldValue('assigneeIds', ids)}
                    error={form.errors.assigneeIds as string | undefined}
                  />
                </InheritedField>
              )}
              <InheritedField {...inherited('BENEFICIARIES')}>
                <BeneficiariesSelect
                  value={{ beneficiaryIds: form.values.beneficiaryIds, beneficiaryRelationIds: form.values.beneficiaryRelationIds }}
                  onChange={(beneficiaries) => form.setValues({ ...beneficiaries })}
                />
              </InheritedField>
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.planning}>
              <InheritedField {...inherited('START_DATE')}>
                <DateField label="Première fois" required value={form.values.startDate || null} onChange={(date) => date && form.setFieldValue('startDate', date)} error={form.errors.startDate} />
              </InheritedField>
              <NumberInput label="Temps à y consacrer" description="En minutes" min={1} max={24 * 60} allowDecimal={false} suffix=" min" {...optionalNumberProps(form, 'estimate')} />
              <DeadTimesField
                value={form.values.deadTimes}
                onChange={(deadTimes) => form.setFieldValue('deadTimes', deadTimes)}
                item={current ? routineCountdownItem(current, occurrenceDate ?? panelOccurrence(current)) : null}
                disabled={readOnly}
              />
              {current && (
                <TrackedTime
                  seconds={current.trackedSeconds}
                  on={onRoutine(current.id)}
                  start={{ projectId: current.projectId, routineIds: [current.id], taskIds: [] }}
                  disabled={readOnly}
                />
              )}
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.place}>
              <RoutinePlace {...scheduleProps} inherited={{ from: parentName, state: inheritance.field('LOCATION'), readOnly }} />
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.alarms}>
              <RoutineReminders {...scheduleProps} />
              <SavedCountdownsField target="ROUTINE" id={current?.id ?? null} value={current?.savedCountdownIds ?? []} invalidate={[routinesKey]} readOnly={readOnly} />
            </PanelGroup>
            <PanelGroup title={PANEL_GROUPS.resources}>
              <LinksField form={form} onRemoved={() => commit(['links'])} />
              <DocumentsField
                value={{ libraryDocumentIds: form.values.libraryDocumentIds, projectResourceIds: form.values.projectResourceIds }}
                projectId={form.values.projectId}
                inTree={context ? inProjectTree(context, form.values.projectId) : () => false}
                readOnly={readOnly}
                error={form.errors.libraryDocumentIds ?? form.errors.projectResourceIds}
                onChange={(documents) => form.setValues({ ...documents })}
              />
              {routine && <SheetsSection owner={{ routineId: routine.id }} occurrenceDate={routine.currentDate || null} label={routine.label} />}
            </PanelGroup>
          </>
        }
        footer={!routine && <FormActions onCancel={onDone} submitLabel="Créer" loading={create.isPending} />}
      />
    </form>
  );
}
