import { ancestorsOf, byPosition, changedList, mapById, movedTo, subtreeOf } from '@ordo/shared';
import type { RoutineBulkChanges } from '@ordo/shared';
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
import { useQuery, type QueryKey } from '@tanstack/react-query';
import { tasksQueryKey } from '../../tasks/api';
import { moveInTree } from '../../../components/tree/category-tree';
import { graphql } from '../../../graphql';
import type { CalendarEventScope, RoutineChecksQuery, RoutineOccurrencesQuery, RoutinesDataQuery } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';

export type RoutineCategory = RoutinesDataQuery['routineCategories'][number];
export type Routine = RoutinesDataQuery['routines'][number];

export const routinesKey = ['routines'] as const;

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
      parentId
      startDate
      recurrence
      estimate
      fromTime
      dueTime
      slotCondition
      moments
      reminders
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
      travelBefore
      travelAfter
      projectId
      position
      archived
      assigneeIds
      beneficiaryIds
      beneficiaryRelationIds
      requiredIds
      relatedIds
      currentDate
      firstDate
      nextDate
      doneDates
      lastDoneAt
      trackedSeconds
      opensOn
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

const CreateRoutineDocument = graphql(`
  mutation CreateRoutine($input: RoutineInput!) {
    createRoutine(input: $input)
  }
`);

const UpdateRoutineDocument = graphql(`
  mutation UpdateRoutine($id: ID!, $input: RoutineInput!, $restoring: Boolean) {
    updateRoutine(id: $id, input: $input, restoring: $restoring)
  }
`);

const PatchRoutineDocument = graphql(`
  mutation PatchRoutine($id: ID!, $input: RoutinePatch!) {
    patchRoutine(id: $id, input: $input)
  }
`);

const MoveRoutineDocument = graphql(`
  mutation MoveRoutine($id: ID!, $beforeId: ID, $parentId: ID, $categoryIds: [ID!]) {
    moveRoutine(id: $id, beforeId: $beforeId, parentId: $parentId, categoryIds: $categoryIds)
  }
`);

const BulkUpdateRoutinesDocument = graphql(`
  mutation BulkUpdateRoutines($ids: [ID!]!, $changes: RoutineBulkChanges!) {
    bulkUpdateRoutines(ids: $ids, changes: $changes)
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
  mutation MoveRoutineOccurrence($id: ID!, $date: Date!, $to: Date!, $times: JSON) {
    moveRoutineOccurrence(id: $id, date: $date, to: $to, times: $times)
  }
`);

const ChangeRoutineOccurrenceDocument = graphql(`
  mutation ChangeRoutineOccurrence($id: ID!, $date: Date!, $scope: CalendarEventScope!, $to: Date!, $slot: Int!, $fromTime: String, $dueTime: String) {
    changeRoutineOccurrence(id: $id, date: $date, scope: $scope, to: $to, slot: $slot, fromTime: $fromTime, dueTime: $dueTime)
  }
`);

const DeleteRoutineOccurrenceDocument = graphql(`
  mutation DeleteRoutineOccurrence($id: ID!, $date: Date!, $scope: CalendarEventScope!) {
    deleteRoutineOccurrence(id: $id, date: $date, scope: $scope)
  }
`);

const RemoveRoutineMoveDocument = graphql(`
  mutation RemoveRoutineMove($id: ID!, $from: Date!) {
    removeRoutineMove(id: $id, from: $from)
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
 * Occurrences of the routines (not archived) in a period, with their times of the day ticked: refreshed with the
 * routines.
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
 * Routines and their categories. Refreshed when the window gets the focus back (the current occurrences move with the
 * day).
 * @returns {UseQueryResult<RoutinesDataQuery>} Query state.
 */
export function useRoutinesData() {
  return useQuery({ queryKey: routinesKey, queryFn: () => execute(RoutinesDataDocument), refetchOnWindowFocus: true });
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
    parentId: input.parentId ?? null,
    startDate: input.startDate,
    recurrence: input.recurrence,
    estimate: input.estimate ?? null,
    fromTime: input.fromTime ?? null,
    dueTime: input.dueTime ?? null,
    slotCondition: input.slotCondition ?? null,
    moments: input.moments ?? [],
    reminders: input.reminders ?? [],
    cases: input.cases ?? [],
    moves: [],
    done: false,
    windowFrom: input.fromTime ?? null,
    windowTo: input.dueTime ?? null,
    location: input.location ?? null,
    locationLat: input.locationLat ?? null,
    locationLon: input.locationLon ?? null,
    travelBefore: input.travelBefore ?? 0,
    travelAfter: input.travelAfter ?? 0,
    projectId: input.projectId ?? null,
    position: Math.max(-1, ...routines.map((routine) => routine.position)) + 1,
    archived: false,
    assigneeIds: input.assigneeIds ?? [],
    beneficiaryIds: input.beneficiaryIds ?? [],
    beneficiaryRelationIds: input.beneficiaryRelationIds ?? [],
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
  reminders?: number[];
  opensOn?: RoutineOpens | null;
  fromTime?: string | null;
  dueTime?: string | null;
  startDate?: string;
  recurrence?: Recurrence;
  /** Whole repetition (with recurrence): its cases (empty: its rule), moments and condition. */
  cases?: RoutineCaseInput[];
  moments?: RoutineSlot[];
  slotCondition?: SlotCondition | null;
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
    parentId: routine.parentId,
    startDate: routine.startDate,
    recurrence: routine.recurrence as Recurrence,
    estimate: routine.estimate,
    fromTime: routine.fromTime,
    dueTime: routine.dueTime,
    slotCondition: readSlotCondition(routine.slotCondition),
    moments: routine.moments as RoutineInput['moments'],
    reminders: routine.reminders,
    cases: routine.cases as RoutineInput['cases'],
    location: routine.location,
    locationLat: routine.locationLat,
    locationLon: routine.locationLon,
    travelBefore: routine.travelBefore,
    travelAfter: routine.travelAfter,
    projectId: routine.projectId,
    assigneeIds: routine.assigneeIds,
    requiredIds: routine.requiredIds,
    relatedIds: routine.relatedIds,
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
    ...routine,
    categoryIds: changedList(routine.categoryIds, changes.addCategoryIds, changes.removeCategoryIds),
    assigneeIds: changedList(routine.assigneeIds, changes.addAssigneeIds, changes.removeAssigneeIds),
    requiredIds: changedList(routine.requiredIds, changes.addRequiredIds, changes.removeRequiredIds).filter((id) => id !== routine.id),
    ...(changes.estimate !== undefined && { estimate: changes.estimate }),
    ...(changes.projectId !== undefined && { projectId: changes.projectId }),
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
    // Shown at once, as typed, until the saved routine (its occurrences computed) replaces it.
    create: useRoutineMutation(
      async (input: RoutineInput) => (await execute(CreateRoutineDocument, { input })).createRoutine,
      (data, input) => ({ ...data, routines: [...data.routines, draftRoutine(input, data.routines)] }),
    ),
    // A change of project attaches the assignees to it: the contributors (task data) are refreshed too.
    update: useRoutineMutation(async (variables: { id: string; input: RoutineInput }) => (await execute(UpdateRoutineDocument, variables)).updateRoutine, undefined, [tasksQueryKey]),
    /** Copies the sub-routines of a routine under its copy (theirs too). */
    copySubRoutines: useRoutineMutation(async (variables: { fromId: string; toId: string }) => (await execute(CopySubRoutinesDocument, variables)).copySubRoutines),
    patch: useRoutineMutation(
      async (variables: { id: string; input: RoutinePatchValues }) => (await execute(PatchRoutineDocument, variables)).patchRoutine,
      (data, { id, input }) => patchRoutine(data, id, (routine) => ({ ...routine, ...input })),
      [tasksQueryKey],
    ),
    move: useRoutineMutation(async (variables: RoutineMove) => (await execute(MoveRoutineDocument, variables)).moveRoutine, moveInCache),
    setDone: useRoutineMutation(
      async (variables: { id: string; done: boolean; date?: string | null; slot?: number | null; doneAt?: string | null }) => (await execute(SetRoutineDoneDocument, variables)).setRoutineDone,
      (data, { id, done, date, slot }) => patchRoutine(data, id, (routine) => (date && date !== routine.currentDate ? routine : withSlotsDone(routine, [slot ?? 0], done))),
    ),
    moveOccurrence: useRoutineMutation(
      async (variables: { id: string; date: string; to: string; times?: RoutineMoveTimes }) => (await execute(MoveRoutineOccurrenceDocument, variables)).moveRoutineOccurrence,
    ),
    changeOccurrence: useRoutineMutation(
      async (variables: { id: string; date: string; scope: CalendarEventScope; to: string; slot: number; fromTime: string | null; dueTime: string | null }) =>
        (await execute(ChangeRoutineOccurrenceDocument, variables as never)).changeRoutineOccurrence,
    ),
    deleteOccurrence: useRoutineMutation(
      async (variables: { id: string; date: string; scope: CalendarEventScope }) => (await execute(DeleteRoutineOccurrenceDocument, variables as never)).deleteRoutineOccurrence,
    ),
    removeMove: useRoutineMutation(async (variables: { id: string; from: string }) => (await execute(RemoveRoutineMoveDocument, variables)).removeRoutineMove),
    bulkUpdate: useRoutineMutation(
      async (variables: { ids: string[]; changes: RoutineBulkChanges }) => (await execute(BulkUpdateRoutinesDocument, variables)).bulkUpdateRoutines,
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
