import { routinesKey } from '../../../lib/query-keys';
import { linkInputs } from '../../../lib/links';
import { ancestorsOf, byPosition, changedList, mapById, movedTo, readReminderOutputs, routineBulkValues, routineFieldsGiven, subtreeOf, type RoutineInheritableField } from '@ordo/shared';
import { ownedFields } from '../../../components/inheritance/inheritance';
import { routineRow } from '../lib/routine-inheritance';
import type { Reminder, RoutineBulkChanges } from '@ordo/shared';
import { patchQuery, useInvalidatingMutation } from '../../../lib/mutation';
import {
  readSlotCondition,
  type Recurrence,
  type RoutineCategoryInput,
  type RoutineInput,
  type RoutineMoveTimes,
  type RoutineOpens,
  type RoutineCaseInput,
  type RoutineSlot,
  type SlotCondition,
} from '@ordo/shared';
import { useQuery, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { tasksQueryKey } from '../../tasks/api';
import { moveInTree } from '../../../components/tree/category-tree';
import { graphql } from '../../../graphql';
import type { CalendarEventScope, DeleteRoutineOccurrenceMutation, RoutineChecksQuery, RoutineOccurrencesQuery, RoutinesDataQuery } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';
import { withLossConfirmation } from '../../time/lib/confirm-loss';
import { timeQueryKey } from '../../time/api';
import { conversionDialog } from '../lib/conversion-loss';
import type { ConversionLoss } from '@ordo/shared';

export type RoutineCategory = RoutinesDataQuery['routineCategories'][number];
export type Routine = RoutinesDataQuery['routines'][number];

export { routinesKey };

const RoutinesDataDocument = graphql(`
  query RoutinesData {
    routineCategories {
      id
      archived
      label
      color
      iconUrl
      parentId
      position
    }
    routines {
      id
      label
      description
      categoryIds
      priorityId
      typeId
      parentId
      startDate
      recurrence
      estimate
      fromTime
      dueTime
      slotCondition
      moments
      reminders {
        ...ReminderFields
      }
      deadTimes {
        ...DeadTimeFields
      }
      savedCountdownIds
      reminderOccurrences {
        date
        day
        slots {
          slot
          fromTime
          dueTime
        }
      }
      cases
      moves
      done
      slots {
        index
        fromTime
        dueTime
        optional
        done
        windows
      }
      windowFrom
      windowTo
      location
      locationLat
      locationLon
      links {
        url
        label
      }
      travelBefore
      travelAfter
      projectId
      position
      archived
      assigneeIds
      beneficiaryIds
      beneficiaryRelationIds
      libraryDocumentIds
      projectResourceIds
      requiredIds
      relatedIds
      currentDate
      firstDate
      nextDate
      doneDates
      lastDoneAt
      trackedSeconds
      opensOn
      inheritedFields
      inheritance {
        ...FieldOriginFields
      }
      effective {
        projectId
        assigneeIds
        beneficiaryIds
        beneficiaryRelationIds
        categoryIds
        priorityId
        slotCondition
        opensOn
        location
        locationLat
        locationLon
        startDate
        recurrence
        cases
        moments
        moves
      }
    }
  }
`);

const CreateCategoryDocument = graphql(`
  mutation CreateRoutineCategory($input: RoutineCategoryInput!) {
    createRoutineCategory(input: $input)
  }
`);

const UpdateCategoryDocument = graphql(`
  mutation UpdateRoutineCategory($id: ID!, $input: RoutineCategoryInput!) {
    updateRoutineCategory(id: $id, input: $input)
  }
`);

const MoveCategoryDocument = graphql(`
  mutation MoveRoutineCategory($id: ID!, $parentId: ID, $index: Int) {
    moveRoutineCategory(id: $id, parentId: $parentId, index: $index)
  }
`);

const DeleteCategoryDocument = graphql(`
  mutation DeleteRoutineCategory($id: ID!) {
    deleteRoutineCategory(id: $id)
  }
`);

const CopySubRoutinesDocument = graphql(`
  mutation CopySubRoutines($fromId: ID!, $toId: ID!) {
    copySubRoutines(fromId: $fromId, toId: $toId)
  }
`);

const ConvertTaskToRoutineDocument = graphql(`
  mutation ConvertTaskToRoutine($id: ID!, $confirm: Boolean) {
    convertTaskToRoutine(id: $id, confirm: $confirm)
  }
`);

const ConvertRoutineToTaskDocument = graphql(`
  mutation ConvertRoutineToTask($id: ID!, $confirm: Boolean) {
    convertRoutineToTask(id: $id, confirm: $confirm)
  }
`);

const CreateRoutineDocument = graphql(`
  mutation CreateRoutine($input: RoutineInput!, $copyOf: ID) {
    createRoutine(input: $input, copyOf: $copyOf)
  }
`);

const UpdateRoutineDocument = graphql(`
  mutation UpdateRoutine($id: ID!, $input: RoutineInput!, $restoring: Boolean, $confirmLoss: Boolean) {
    updateRoutine(id: $id, input: $input, restoring: $restoring, confirmLoss: $confirmLoss) {
      removedLinks
    }
  }
`);

const PatchRoutineDocument = graphql(`
  mutation PatchRoutine($id: ID!, $input: RoutinePatch!, $confirmLoss: Boolean) {
    patchRoutine(id: $id, input: $input, confirmLoss: $confirmLoss) {
      removedLinks
    }
  }
`);

const MoveRoutineDocument = graphql(`
  mutation MoveRoutine($id: ID!, $beforeId: ID, $parentId: ID, $categoryIds: [ID!], $confirmLoss: Boolean) {
    moveRoutine(id: $id, beforeId: $beforeId, parentId: $parentId, categoryIds: $categoryIds, confirmLoss: $confirmLoss)
  }
`);

const BulkUpdateRoutinesDocument = graphql(`
  mutation BulkUpdateRoutines($ids: [ID!]!, $changes: RoutineBulkChanges!, $confirmLoss: Boolean) {
    bulkUpdateRoutines(ids: $ids, changes: $changes, confirmLoss: $confirmLoss) {
      removedLinks
    }
  }
`);

const BulkSetRoutinesArchivedDocument = graphql(`
  mutation BulkSetRoutinesArchived($ids: [ID!]!, $archived: Boolean!) {
    bulkSetRoutinesArchived(ids: $ids, archived: $archived)
  }
`);

const BulkSetRoutinesDoneDocument = graphql(`
  mutation BulkSetRoutinesDone($ids: [ID!]!, $done: Boolean!) {
    bulkSetRoutinesDone(ids: $ids, done: $done)
  }
`);

const BulkDeleteRoutinesDocument = graphql(`
  mutation BulkDeleteRoutines($ids: [ID!]!, $deleteSubRoutines: Boolean!) {
    bulkDeleteRoutines(ids: $ids, deleteSubRoutines: $deleteSubRoutines)
  }
`);

const SetRoutineDoneDocument = graphql(`
  mutation SetRoutineDone($id: ID!, $done: Boolean!, $date: Date, $slot: Int, $doneAt: DateTime) {
    setRoutineDone(id: $id, done: $done, date: $date, slot: $slot, doneAt: $doneAt)
  }
`);

const MoveRoutineOccurrenceDocument = graphql(`
  mutation MoveRoutineOccurrence($id: ID!, $date: Date!, $to: Date!, $times: JSON, $confirmMerge: Boolean) {
    moveRoutineOccurrence(id: $id, date: $date, to: $to, times: $times, confirmMerge: $confirmMerge)
  }
`);

const ChangeRoutineOccurrenceDocument = graphql(`
  mutation ChangeRoutineOccurrence($id: ID!, $date: Date!, $scope: CalendarEventScope!, $to: Date!, $slot: Int!, $fromTime: String, $dueTime: String, $confirmLoss: Boolean) {
    changeRoutineOccurrence(id: $id, date: $date, scope: $scope, to: $to, slot: $slot, fromTime: $fromTime, dueTime: $dueTime, confirmLoss: $confirmLoss)
  }
`);

const DeleteRoutineOccurrenceDocument = graphql(`
  mutation DeleteRoutineOccurrence($id: ID!, $date: Date!, $scope: CalendarEventScope!) {
    deleteRoutineOccurrence(id: $id, date: $date, scope: $scope) {
      archived
      comments {
        body
        createdAt
        updatedAt
      }
    }
  }
`);

const RemoveRoutineMoveDocument = graphql(`
  mutation RemoveRoutineMove($id: ID!, $from: Date!, $comments: [CommentSnapshotInput!]) {
    removeRoutineMove(id: $id, from: $from, comments: $comments)
  }
`);

const RoutineChecksDocument = graphql(`
  query RoutineChecks($from: Date!, $to: Date!) {
    routineChecks(from: $from, to: $to) {
      routineId
      date
      slot
      doneAt
      fromTime
      dueTime
    }
  }
`);

export type RoutineCheck = RoutineChecksQuery['routineChecks'][number];

/** Comment deleted with an occurrence, given back by « Annuler ». */
export type CommentSnapshot = DeleteRoutineOccurrenceMutation['deleteRoutineOccurrence']['comments'][number];

/**
 * Times of the day ticked in a period.
 * @param {string} from First day (YYYY-MM-DD).
 * @param {string} to Last day (YYYY-MM-DD).
 * @returns {Promise<RoutineCheck[]>} Ticks, latest first.
 */
const fetchChecks = async (from: string, to: string): Promise<RoutineCheck[]> => (await execute(RoutineChecksDocument, { from, to })).routineChecks;

/**
 * Times of the day ticked as done in a period (both days included), latest first: refreshed with the routines.
 * @param {string} from First day (YYYY-MM-DD).
 * @param {string} to Last day (YYYY-MM-DD).
 * @returns {UseQueryResult<RoutineCheck[]>} Query state.
 */
export function useRoutineChecks(from: string, to: string) {
  return useQuery({ queryKey: [...routinesKey, 'checks', from, to], queryFn: () => fetchChecks(from, to) });
}

const RoutineOccurrencesDocument = graphql(`
  query RoutineOccurrences($from: Date!, $to: Date!) {
    routineOccurrences(from: $from, to: $to) {
      routineId
      date
      startDate
      shownDate
      movedFrom
      cancelled
      archived
      slots {
        index
        fromTime
        dueTime
        optional
        done
        windows
      }
    }
  }
`);

export type RoutineOccurrence = RoutineOccurrencesQuery['routineOccurrences'][number];

/**
 * Occurrences of the routines in a period, with their times of the day ticked: refreshed with the routines. The
 * cancelled ones are there too (`cancelled`, shown struck through) and, for an archived routine, those due before its
 * archiving (`archived`, read only).
 * @param {{ from: string, to: string } | null} range Period (both days included), or null: none.
 * @param {boolean} [enabled] Loaded. Optional. Default = true.
 * @returns {UseQueryResult<RoutineOccurrence[]>} Query state.
 */
export function useRoutineOccurrences(range: { from: string; to: string } | null, enabled = true) {
  return useQuery({
    queryKey: [...routinesKey, 'occurrences', range?.from, range?.to],
    queryFn: async (): Promise<RoutineOccurrence[]> => (await execute(RoutineOccurrencesDocument, { from: range!.from, to: range!.to })).routineOccurrences,
    enabled: enabled && range !== null,
  });
}

/**
 * Routines and their categories, each routine as the screens read it (`routineRow`: its inherited fields with the values
 * it follows).
 * @returns {Promise<RoutinesDataQuery>} Data.
 */
async function fetchRoutinesData(): Promise<RoutinesDataQuery> {
  const data = await execute(RoutinesDataDocument);
  return { ...data, routines: data.routines.map(routineRow) };
}

/**
 * Routines and their categories. Refreshed when the window gets the focus back (the current occurrences move with the
 * day).
 * @returns {UseQueryResult<RoutinesDataQuery>} Query state.
 */
export function useRoutinesData() {
  return useQuery({ queryKey: routinesKey, queryFn: fetchRoutinesData, refetchOnWindowFocus: true });
}

/**
 * A routine as the routines read now (fetched again, from wherever the routines are not loaded): one just created
 * elsewhere, to open its panel.
 * @param {QueryClient} queryClient Query client.
 * @param {string} id Routine.
 * @returns {Promise<Routine | undefined>} Routine, none when not found.
 */
export async function fetchRoutine(queryClient: QueryClient, id: string): Promise<Routine | undefined> {
  const data = await queryClient.fetchQuery({ queryKey: routinesKey, queryFn: fetchRoutinesData, staleTime: 0 });
  return data.routines.find((routine) => routine.id === id);
}

/**
 * Mutation refreshing the routines afterwards, with an optional optimistic change rolled back on error.
 * @param {(variables: V) => Promise<R>} fn Request.
 * @param {(data: RoutinesDataQuery, variables: V) => RoutinesDataQuery} [patch] Immediate cache change. Optional.
 * @param {readonly QueryKey[]} [also] Other queries refreshed too. Optional. Default = none.
 * @returns {UseMutationResult} Mutation state.
 */
function useRoutineMutation<V, R>(fn: (variables: V) => Promise<R>, patch?: (data: RoutinesDataQuery, variables: V) => RoutinesDataQuery, also: readonly QueryKey[] = []) {
  return useInvalidatingMutation(fn, {
    invalidate: [routinesKey, ...also],
    optimistic: patch && ((queryClient, variables) => patchQuery<RoutinesDataQuery>(queryClient, routinesKey, (data) => patch(data, variables))),
    // Refreshed in the background: the change (shown at once) is not held up by the reload of every routine.
    background: true,
  });
}

let draftCount = 0;

/** Start of the id of a routine being created (not saved yet). */
const DRAFT = 'draft-';

/**
 * Tells whether a routine is being created (shown as typed, not saved yet).
 * @param {{ id: string }} routine Routine.
 * @returns {boolean} Whether it is a draft.
 */
export const isDraftRoutine = (routine: { id: string }) => routine.id.startsWith(DRAFT);

/**
 * Routine being created, as typed (shown until the saved one replaces it): last of the manual order, nothing computed yet.
 * @param {RoutineInput} input Routine.
 * @param {readonly Routine[]} routines Routines in the cache.
 * @returns {Routine} Draft.
 */
function draftRoutine(input: RoutineInput, routines: readonly Routine[]): Routine {
  return {
    id: `${DRAFT}${(draftCount += 1)}`,
    label: input.label,
    description: input.description ?? null,
    categoryIds: input.categoryIds ?? [],
    priorityId: input.priorityId ?? null,
    typeId: input.typeId ?? null,
    parentId: input.parentId ?? null,
    startDate: input.startDate,
    recurrence: input.recurrence,
    estimate: input.estimate ?? null,
    fromTime: input.fromTime ?? null,
    dueTime: input.dueTime ?? null,
    slotCondition: input.slotCondition ?? null,
    moments: input.moments ?? [],
    reminders: readReminderOutputs(input.reminders),
    deadTimes: input.deadTimes.map((deadTime) => ({ ...deadTime, ringtone: deadTime.ringtone ?? null })),
    savedCountdownIds: [],
    reminderOccurrences: [],
    cases: input.cases ?? [],
    moves: [],
    done: false,
    windowFrom: input.fromTime ?? null,
    windowTo: input.dueTime ?? null,
    location: input.location ?? null,
    locationLat: input.locationLat ?? null,
    locationLon: input.locationLon ?? null,
    links: input.links,
    travelBefore: input.travelBefore ?? 0,
    travelAfter: input.travelAfter ?? 0,
    projectId: input.projectId ?? null,
    position: Math.max(-1, ...routines.map((routine) => routine.position)) + 1,
    archived: false,
    assigneeIds: input.assigneeIds ?? [],
    beneficiaryIds: input.beneficiaryIds ?? [],
    beneficiaryRelationIds: input.beneficiaryRelationIds ?? [],
    libraryDocumentIds: input.libraryDocumentIds ?? [],
    projectResourceIds: input.projectResourceIds ?? [],
    requiredIds: input.requiredIds ?? [],
    relatedIds: input.relatedIds ?? [],
    currentDate: null,
    firstDate: null,
    nextDate: null,
    doneDates: [],
    lastDoneAt: null,
    trackedSeconds: 0,
    opensOn: input.opensOn ?? null,
    slots: [],
    inheritedFields: input.inheritedFields ?? [],
    // Nothing shown as inherited until saved (the API gives its origins).
    inheritance: [],
    effective: {
      projectId: input.projectId ?? null,
      assigneeIds: input.assigneeIds ?? [],
      beneficiaryIds: input.beneficiaryIds ?? [],
      beneficiaryRelationIds: input.beneficiaryRelationIds ?? [],
      categoryIds: input.categoryIds ?? [],
      priorityId: input.priorityId ?? null,
      slotCondition: input.slotCondition ?? null,
      opensOn: input.opensOn ?? null,
      location: input.location ?? null,
      locationLat: input.locationLat ?? null,
      locationLon: input.locationLon ?? null,
      startDate: input.startDate,
      recurrence: input.recurrence,
      cases: input.cases ?? [],
      moments: input.moments ?? [],
      moves: [],
    },
  };
}

/**
 * A routine with times of the day of its current occurrence ticked or not (for the cache).
 * @param {Routine} routine Routine.
 * @param {number[]} indexes Times of the day.
 * @param {boolean} done Ticked.
 * @returns {Routine} Changed routine.
 */
function withSlotsDone(routine: Routine, indexes: number[], done: boolean): Routine {
  if (!routine.currentDate) return routine;
  const slots = routine.slots.map((slot) => (indexes.includes(slot.index) ? { ...slot, done } : slot));
  const day = routine.currentDate;
  const others = routine.doneDates.filter((value) => value !== day);
  const any = slots.some((slot) => slot.done);
  return {
    ...routine,
    slots,
    done: slots.length > 0 && slots.every((slot) => slot.done || slot.optional),
    doneDates: any ? [day, ...others].sort().reverse() : others,
  };
}

/**
 * Changes a routine in the cached data.
 * @param {RoutinesDataQuery} data Cached data.
 * @param {string} id Routine id.
 * @param {(routine: Routine) => Routine} change Change.
 * @returns {RoutinesDataQuery} New data.
 */
const patchRoutine = (data: RoutinesDataQuery, id: string, change: (routine: Routine) => Routine): RoutinesDataQuery => ({
  ...data,
  routines: data.routines.map((routine) => (routine.id === id ? change(routine) : routine)),
});

/** Move of a routine in the global manual order (before another one, or at the end), under a new parent and in new categories when they change. */
export interface RoutineMove {
  id: string;
  /** Routine it goes before; null: at the end. */
  beforeId: string | null;
  /** New parent (null: top level); omitted: unchanged. */
  parentId?: string | null;
  categoryIds?: string[] | null;
}

/**
 * Moves a routine in the cached data, as a task: before another one in the global order (at the end without one), under
 * its new parent and in its new categories.
 * @param {RoutinesDataQuery} data Cached data.
 * @param {RoutineMove} move Move.
 * @returns {RoutinesDataQuery} New data.
 */
function moveInCache(data: RoutinesDataQuery, { id, beforeId, parentId, categoryIds }: RoutineMove): RoutinesDataQuery {
  const ordered = [...data.routines].sort(byPosition);
  const moved = ordered.find((routine) => routine.id === id);
  const others = ordered.filter((routine) => routine.id !== id);
  const index = beforeId ? others.findIndex((routine) => routine.id === beforeId) : others.length;
  if (!moved || index < 0) return data;
  const placed = { ...moved, ...(parentId !== undefined && { parentId }), categoryIds: categoryIds ?? moved.categoryIds };
  return { ...data, routines: movedTo(others, placed, index).map((routine, position) => ({ ...routine, position })) };
}

/**
 * Routines archived or restored in the cached data, as the API does: archiving takes their sub-routines along,
 * restoring brings back their archived parents (the sub-routines archived along come back with the refresh).
 * @param {RoutinesDataQuery} data Cached data.
 * @param {readonly string[]} ids Routines.
 * @param {boolean} archived Archived (else restored).
 * @returns {RoutinesDataQuery} New data.
 */
function archiveInCache(data: RoutinesDataQuery, ids: readonly string[], archived: boolean): RoutinesDataQuery {
  const byId = mapById(data.routines);
  const touched = new Set(
    ids.flatMap((id) => (archived ? [...subtreeOf(data.routines, id)] : [id, ...ancestorsOf(byId, id).map((ancestor) => ancestor.id)])),
  );
  return { ...data, routines: data.routines.map((routine) => (touched.has(routine.id) ? { ...routine, archived } : routine)) };
}

/** Inline changes of a routine. */
export interface RoutinePatchValues {
  label?: string;
  categoryIds?: string[];
  priorityId?: string | null;
  typeId?: string | null;
  parentId?: string | null;
  estimate?: number | null;
  assigneeIds?: string[];
  beneficiaryIds?: string[];
  beneficiaryRelationIds?: string[];
  requiredIds?: string[];
  relatedIds?: string[];
  projectId?: string | null;
  location?: string | null;
  locationLat?: number | null;
  locationLon?: number | null;
  travelBefore?: number;
  travelAfter?: number;
  reminders?: Reminder[];
  opensOn?: RoutineOpens | null;
  fromTime?: string | null;
  dueTime?: string | null;
  startDate?: string;
  recurrence?: Recurrence;
  /** Whole repetition (with recurrence): its cases (empty: its rule), moments and condition. */
  cases?: RoutineCaseInput[];
  moments?: RoutineSlot[];
  slotCondition?: SlotCondition | null;
  /** Fields made inherited again (« Rétablir l'héritage »). */
  inherit?: RoutineInheritableField[];
  /** Fields emptied on purpose (« Vider »; never its first time nor its repetition). */
  clear?: RoutineInheritableField[];
}

export type { RoutineBulkChanges };

/**
 * Routine as the input of a full update (to put it back as it was).
 * @param {Routine} routine Routine.
 * @returns {RoutineInput} Input.
 */
export function routineInputOf(routine: Routine): RoutineInput {
  return {
    label: routine.label,
    description: routine.description,
    categoryIds: routine.categoryIds,
    priorityId: routine.priorityId,
    typeId: routine.typeId,
    parentId: routine.parentId,
    startDate: routine.startDate,
    recurrence: routine.recurrence as Recurrence,
    estimate: routine.estimate,
    fromTime: routine.fromTime,
    dueTime: routine.dueTime,
    slotCondition: readSlotCondition(routine.slotCondition),
    moments: routine.moments as RoutineInput['moments'],
    reminders: routine.reminders,
    deadTimes: routine.deadTimes,
    cases: routine.cases as RoutineInput['cases'],
    location: routine.location,
    locationLat: routine.locationLat,
    locationLon: routine.locationLon,
    links: linkInputs(routine.links),
    travelBefore: routine.travelBefore,
    travelAfter: routine.travelAfter,
    projectId: routine.projectId,
    assigneeIds: routine.assigneeIds,
    beneficiaryIds: routine.beneficiaryIds,
    beneficiaryRelationIds: routine.beneficiaryRelationIds,
    libraryDocumentIds: routine.libraryDocumentIds,
    projectResourceIds: routine.projectResourceIds,
    requiredIds: routine.requiredIds,
    relatedIds: routine.relatedIds,
    opensOn: routine.opensOn as RoutineInput['opensOn'],
    // Its inheritance given back too (an undo, a copy under the same parent).
    inheritedFields: routine.inheritedFields as RoutineInheritableField[],
    // Its own exceptions, given back by an undo (a new routine, a copy, takes none).
    moves: routine.moves as RoutineInput['moves'],
  };
}

/**
 * A routine with bulk changes applied (for the cache).
 * @param {Routine} routine Routine.
 * @param {RoutineBulkChanges} changes Changes.
 * @returns {Routine} Changed routine.
 */
function withBulkChanges(routine: Routine, changes: RoutineBulkChanges): Routine {
  return {
    // Fields given a value are its own at once.
    ...ownedFields(routine, routineFieldsGiven(changes)),
    categoryIds: changedList(routine.categoryIds, changes.addCategoryIds, changes.removeCategoryIds),
    assigneeIds: changedList(routine.assigneeIds, changes.addAssigneeIds, changes.removeAssigneeIds),
    requiredIds: changedList(routine.requiredIds, changes.addRequiredIds, changes.removeRequiredIds).filter((id) => id !== routine.id),
    relatedIds: changedList(routine.relatedIds, changes.addRelatedIds, changes.removeRelatedIds).filter((id) => id !== routine.id),
    ...routineBulkValues(changes),
    ...(changes.fromTime !== undefined && { fromTime: changes.fromTime }),
    ...(changes.dueTime !== undefined && { dueTime: changes.dueTime }),
    ...(changes.startDate !== undefined && { startDate: changes.startDate }),
    ...(changes.recurrence !== undefined && { recurrence: changes.recurrence }),
  };
}

/**
 * Mutations of the routines and their categories.
 * @returns {object} Mutations.
 */
export function useRoutineMutations() {
  return {
    createCategory: useRoutineMutation(async (input: RoutineCategoryInput) => (await execute(CreateCategoryDocument, { input })).createRoutineCategory),
    updateCategory: useRoutineMutation(async (variables: { id: string; input: RoutineCategoryInput }) => (await execute(UpdateCategoryDocument, variables)).updateRoutineCategory),
    moveCategory: useRoutineMutation(
      async (variables: { id: string; parentId: string | null; index: number }) => (await execute(MoveCategoryDocument, variables)).moveRoutineCategory,
      (data, { id, parentId, index }) => ({ ...data, routineCategories: moveInTree(data.routineCategories, id, parentId, index) }),
    ),
    deleteCategory: useRoutineMutation(async (id: string) => (await execute(DeleteCategoryDocument, { id })).deleteRoutineCategory),
    // Shown at once, as typed, until the saved routine (its occurrences computed) replaces it. A copy (copyOf) leaves
    // out the former links of the routine copied out of its project tree (the API does).
    create: useRoutineMutation(
      async ({ copyOf, ...input }: RoutineInput & { copyOf?: string | null }) => (await execute(CreateRoutineDocument, { input, copyOf })).createRoutine,
      (data, input) => ({ ...data, routines: [...data.routines, draftRoutine(input, data.routines)] }),
    ),
    // A change of project attaches the assignees to it: the contributors (task data) are refreshed too.
    update: useRoutineMutation(async (variables: { id: string; input: RoutineInput }) => withLossConfirmation(async (confirmLoss) => (await execute(UpdateRoutineDocument, { ...variables, confirmLoss })).updateRoutine), undefined, [tasksQueryKey]),
    /** Copies the sub-routines of a routine under its copy (theirs too). */
    copySubRoutines: useRoutineMutation(async (variables: { fromId: string; toId: string }) => (await execute(CopySubRoutinesDocument, variables)).copySubRoutines),
    /**
     * Turns a task into a routine, once what it loses is confirmed (`conversionDialog`); gives the routine id.
     * The tasks and the times are refreshed too (the task is gone, its times are the routine's).
     */
    convertTask: useRoutineMutation(
      async (id: string) =>
        withLossConfirmation(
          async (confirm) => (await execute(ConvertTaskToRoutineDocument, { id, confirm })).convertTaskToRoutine,
          (lost: ConversionLoss) => conversionDialog('TASK_TO_ROUTINE', lost),
        ),
      undefined,
      [tasksQueryKey, timeQueryKey],
    ),
    /** Turns a routine into a task, once what it loses is confirmed; gives the task id. */
    convertToTask: useRoutineMutation(
      async (id: string) =>
        withLossConfirmation(
          async (confirm) => (await execute(ConvertRoutineToTaskDocument, { id, confirm })).convertRoutineToTask,
          (lost: ConversionLoss) => conversionDialog('ROUTINE_TO_TASK', lost),
        ),
      undefined,
      [tasksQueryKey, timeQueryKey],
    ),
    patch: useRoutineMutation(
      async (variables: { id: string; input: RoutinePatchValues }) => withLossConfirmation(async (confirmLoss) => (await execute(PatchRoutineDocument, { ...variables, confirmLoss })).patchRoutine),
      (data, { id, input }) =>
        patchRoutine(data, id, (routine) => ({
          // Its values given are its own at once; inherited again or emptied, the refresh tells their values.
          ...ownedFields(routine, routineFieldsGiven(input)),
          ...(Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'inherit' && key !== 'clear')) as Partial<Routine>),
          reminders: input.reminders ? readReminderOutputs(input.reminders) : routine.reminders,
        })),
      [tasksQueryKey],
    ),
    // Under another parent, the occurrences its « quand » inherited loses are confirmed, as in the panel; declined, nothing moves.
    move: useRoutineMutation(
      async (variables: RoutineMove) => withLossConfirmation(async (confirmLoss) => (await execute(MoveRoutineDocument, { ...variables, confirmLoss })).moveRoutine),
      moveInCache,
    ),
    setDone: useRoutineMutation(
      async (variables: { id: string; done: boolean; date?: string | null; slot?: number | null; doneAt?: string | null }) => (await execute(SetRoutineDoneDocument, variables)).setRoutineDone,
      (data, { id, done, date, slot }) => patchRoutine(data, id, (routine) => (date && date !== routine.currentDate ? routine : withSlotsDone(routine, [slot ?? 0], done))),
    ),
    // Onto a day that has its own occurrence: merging both is asked first; declined, nothing moves.
    moveOccurrence: useRoutineMutation(
      async (variables: { id: string; date: string; to: string; times?: RoutineMoveTimes }) =>
        withLossConfirmation(async (confirmMerge) => (await execute(MoveRoutineOccurrenceDocument, { ...variables, confirmMerge })).moveRoutineOccurrence),
    ),
    changeOccurrence: useRoutineMutation(
      async (variables: { id: string; date: string; scope: CalendarEventScope; to: string; slot: number; fromTime: string | null; dueTime: string | null }) =>
        withLossConfirmation(async (confirmLoss) => (await execute(ChangeRoutineOccurrenceDocument, { ...variables, confirmLoss } as never)).changeRoutineOccurrence),
    ),
    deleteOccurrence: useRoutineMutation(
      async (variables: { id: string; date: string; scope: CalendarEventScope }) => (await execute(DeleteRoutineOccurrenceDocument, variables as never)).deleteRoutineOccurrence,
    ),
    removeMove: useRoutineMutation(
      async (variables: { id: string; from: string; comments?: CommentSnapshot[] }) => (await execute(RemoveRoutineMoveDocument, variables as never)).removeRoutineMove,
    ),
    bulkUpdate: useRoutineMutation(
      async (variables: { ids: string[]; changes: RoutineBulkChanges }) =>
        withLossConfirmation(async (confirmLoss) => (await execute(BulkUpdateRoutinesDocument, { ...variables, confirmLoss })).bulkUpdateRoutines),
      (data, { ids, changes }) => ({ ...data, routines: data.routines.map((routine) => (ids.includes(routine.id) ? withBulkChanges(routine, changes) : routine)) }),
      [tasksQueryKey],
    ),
    bulkArchive: useRoutineMutation(
      async (variables: { ids: string[]; archived: boolean }) => (await execute(BulkSetRoutinesArchivedDocument, variables)).bulkSetRoutinesArchived,
      (data, { ids, archived }) => archiveInCache(data, ids, archived),
    ),
    bulkDone: useRoutineMutation(
      async (variables: { ids: string[]; done: boolean }) => (await execute(BulkSetRoutinesDoneDocument, variables)).bulkSetRoutinesDone,
      (data, { ids, done }) => ({
        ...data,
        routines: data.routines.map((routine) =>
          ids.includes(routine.id) && routine.currentDate
            ? withSlotsDone(
                routine,
                routine.slots.map((slot) => slot.index),
                done,
              )
            : routine,
        ),
      }),
    ),
    bulkRemove: useRoutineMutation(
      async (variables: { ids: string[]; deleteSubRoutines: boolean }) => (await execute(BulkDeleteRoutinesDocument, variables)).bulkDeleteRoutines,
    ),
    /** Puts routines back as they were (undo of a bulk change: the archived values given back accepted). */
    restore: useRoutineMutation(async (routines: Routine[]) => {
      for (const routine of routines) await execute(UpdateRoutineDocument, { id: routine.id, input: routineInputOf(routine), restoring: true });
      return routines.length;
    }),
  };
}
