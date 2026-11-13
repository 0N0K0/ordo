import type { QueryClient } from '@tanstack/react-query';
import type { Recurrence, RoutineCategoryInput, RoutineInput } from '@ordo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moveInTree } from '../../components/category-tree/category-tree';
import { graphql } from '../../graphql';
import type { CalendarEventScope, RoutineChecksQuery, RoutineOccurrencesQuery, RoutinesDataQuery } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type RoutineCategory = RoutinesDataQuery['routineCategories'][number];
export type Routine = RoutinesDataQuery['routines'][number];

export const routinesKey = ['routines'] as const;

const RoutinesDataDocument = graphql(`
  query RoutinesData {
    routineCategories {
      id
      name
      color
      parentId
      position
    }
    routines {
      id
      title
      description
      categoryIds
      parentId
      startDate
      recurrence
      estimate
      fromTime
      dueTime
      scheduleId
      scheduleAnchor
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
      requiredIds
      currentDate
      nextDate
      doneDates
      lastDoneAt
      trackedSeconds
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

const CreateRoutineDocument = graphql(`
  mutation CreateRoutine($input: RoutineInput!) {
    createRoutine(input: $input)
  }
`);

const UpdateRoutineDocument = graphql(`
  mutation UpdateRoutine($id: ID!, $input: RoutineInput!) {
    updateRoutine(id: $id, input: $input)
  }
`);

const PatchRoutineDocument = graphql(`
  mutation PatchRoutine($id: ID!, $input: RoutinePatch!) {
    patchRoutine(id: $id, input: $input)
  }
`);

const MoveRoutineDocument = graphql(`
  mutation MoveRoutine($id: ID!, $targetId: ID!, $place: RoutinePlace!, $categoryIds: [ID!]) {
    moveRoutine(id: $id, targetId: $targetId, place: $place, categoryIds: $categoryIds)
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
  mutation BulkDeleteRoutines($ids: [ID!]!) {
    bulkDeleteRoutines(ids: $ids)
  }
`);

const SetRoutineDoneDocument = graphql(`
  mutation SetRoutineDone($id: ID!, $done: Boolean!, $date: Date, $slot: Int, $doneAt: DateTime) {
    setRoutineDone(id: $id, done: $done, date: $date, slot: $slot, doneAt: $doneAt)
  }
`);

const MoveRoutineOccurrenceDocument = graphql(`
  mutation MoveRoutineOccurrence($id: ID!, $date: Date!, $to: Date!) {
    moveRoutineOccurrence(id: $id, date: $date, to: $to)
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

const SetRoutineArchivedDocument = graphql(`
  mutation SetRoutineArchived($id: ID!, $archived: Boolean!) {
    setRoutineArchived(id: $id, archived: $archived)
  }
`);

const DeleteRoutineDocument = graphql(`
  mutation DeleteRoutine($id: ID!) {
    deleteRoutine(id: $id)
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
      movedFrom
      slots {
        index
        fromTime
        dueTime
        optional
        done
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
 * @returns {UseMutationResult} Mutation state.
 */
function useRoutineMutation<V, R>(fn: (variables: V) => Promise<R>, patch?: (data: RoutinesDataQuery, variables: V) => RoutinesDataQuery) {
  const queryClient: QueryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onMutate: async (variables: V) => {
      if (!patch) return { previous: undefined };
      await queryClient.cancelQueries({ queryKey: routinesKey });
      const previous = queryClient.getQueryData<RoutinesDataQuery>(routinesKey);
      if (previous) queryClient.setQueryData(routinesKey, patch(previous, variables));
      return { previous };
    },
    onError: (_error, _variables, context) => context?.previous && queryClient.setQueryData(routinesKey, context.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: routinesKey }),
  });
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

/** Where a routine is dropped, relative to another one. */
export type RoutinePlace = 'BEFORE' | 'AFTER' | 'INSIDE';

/** Move of a routine next to or under another one; its new categories, if they change. */
export interface RoutineMove {
  id: string;
  targetId: string;
  place: RoutinePlace;
  categoryIds?: string[] | null;
}

/**
 * Moves a routine in the cached data: next to the target (its parent and category), or last under it.
 * @param {RoutinesDataQuery} data Cached data.
 * @param {RoutineMove} move Move.
 * @returns {RoutinesDataQuery} New data.
 */
function moveInCache(data: RoutinesDataQuery, { id, targetId, place, categoryIds }: RoutineMove): RoutinesDataQuery {
  const moved = data.routines.find((routine) => routine.id === id);
  const target = data.routines.find((routine) => routine.id === targetId);
  if (!moved || !target) return data;
  const placed = { ...moved, parentId: place === 'INSIDE' ? target.id : target.parentId, categoryIds: categoryIds ?? moved.categoryIds };
  const rest = data.routines.filter((routine) => routine.id !== id);
  const index = rest.indexOf(target);
  rest.splice(place === 'INSIDE' ? rest.length : place === 'BEFORE' ? index : index + 1, 0, placed);
  return { ...data, routines: rest };
}

/** Inline changes of a routine. */
export interface RoutinePatchValues {
  title?: string;
  categoryIds?: string[];
  parentId?: string | null;
  estimate?: number | null;
  assigneeIds?: string[];
  requiredIds?: string[];
  projectId?: string | null;
  fromTime?: string | null;
  dueTime?: string | null;
  startDate?: string;
  recurrence?: Recurrence;
}

/** Same changes for several routines: values set, or ids added to and removed from their lists. */
export interface RoutineBulkChanges {
  addCategoryIds?: string[];
  removeCategoryIds?: string[];
  addAssigneeIds?: string[];
  removeAssigneeIds?: string[];
  addRequiredIds?: string[];
  removeRequiredIds?: string[];
  estimate?: number | null;
  projectId?: string | null;
  fromTime?: string | null;
  dueTime?: string | null;
  startDate?: string;
  recurrence?: Recurrence;
}

/**
 * Routine as the input of a full update (to put it back as it was).
 * @param {Routine} routine Routine.
 * @returns {RoutineInput} Input.
 */
export function routineInputOf(routine: Routine): RoutineInput {
  return {
    title: routine.title,
    description: routine.description,
    categoryIds: routine.categoryIds,
    parentId: routine.parentId,
    startDate: routine.startDate,
    recurrence: routine.recurrence as Recurrence,
    estimate: routine.estimate,
    fromTime: routine.fromTime,
    dueTime: routine.dueTime,
    scheduleId: routine.scheduleId,
    scheduleAnchor: routine.scheduleAnchor as RoutineInput['scheduleAnchor'],
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
  };
}

/**
 * List with ids added and removed.
 * @param {string[]} list Current ids.
 * @param {string[]} [added] Added ids. Optional.
 * @param {string[]} [removed] Removed ids. Optional.
 * @returns {string[]} New ids.
 */
const changedList = (list: string[], added: string[] = [], removed: string[] = []) => [...new Set([...list.filter((id) => !removed.includes(id)), ...added])];

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
    create: useRoutineMutation(async (input: RoutineInput) => (await execute(CreateRoutineDocument, { input })).createRoutine),
    update: useRoutineMutation(async (variables: { id: string; input: RoutineInput }) => (await execute(UpdateRoutineDocument, variables)).updateRoutine),
    patch: useRoutineMutation(
      async (variables: { id: string; input: RoutinePatchValues }) => (await execute(PatchRoutineDocument, variables)).patchRoutine,
      (data, { id, input }) => patchRoutine(data, id, (routine) => ({ ...routine, ...input })),
    ),
    move: useRoutineMutation(async (variables: RoutineMove) => (await execute(MoveRoutineDocument, variables)).moveRoutine, moveInCache),
    setDone: useRoutineMutation(
      async (variables: { id: string; done: boolean; date?: string | null; slot?: number | null; doneAt?: string | null }) => (await execute(SetRoutineDoneDocument, variables)).setRoutineDone,
      (data, { id, done, date, slot }) => patchRoutine(data, id, (routine) => (date && date !== routine.currentDate ? routine : withSlotsDone(routine, [slot ?? 0], done))),
    ),
    moveOccurrence: useRoutineMutation(async (variables: { id: string; date: string; to: string }) => (await execute(MoveRoutineOccurrenceDocument, variables)).moveRoutineOccurrence),
    changeOccurrence: useRoutineMutation(
      async (variables: { id: string; date: string; scope: CalendarEventScope; to: string; slot: number; fromTime: string | null; dueTime: string | null }) =>
        (await execute(ChangeRoutineOccurrenceDocument, variables as never)).changeRoutineOccurrence,
    ),
    deleteOccurrence: useRoutineMutation(
      async (variables: { id: string; date: string; scope: CalendarEventScope }) => (await execute(DeleteRoutineOccurrenceDocument, variables as never)).deleteRoutineOccurrence,
    ),
    removeMove: useRoutineMutation(async (variables: { id: string; from: string }) => (await execute(RemoveRoutineMoveDocument, variables)).removeRoutineMove),
    setArchived: useRoutineMutation(
      async (variables: { id: string; archived: boolean }) => (await execute(SetRoutineArchivedDocument, variables)).setRoutineArchived,
      (data, { id, archived }) => patchRoutine(data, id, (routine) => ({ ...routine, archived })),
    ),
    remove: useRoutineMutation(async (id: string) => (await execute(DeleteRoutineDocument, { id })).deleteRoutine),
    bulkUpdate: useRoutineMutation(
      async (variables: { ids: string[]; changes: RoutineBulkChanges }) => (await execute(BulkUpdateRoutinesDocument, variables)).bulkUpdateRoutines,
      (data, { ids, changes }) => ({ ...data, routines: data.routines.map((routine) => (ids.includes(routine.id) ? withBulkChanges(routine, changes) : routine)) }),
    ),
    bulkArchive: useRoutineMutation(
      async (variables: { ids: string[]; archived: boolean }) => (await execute(BulkSetRoutinesArchivedDocument, variables)).bulkSetRoutinesArchived,
      (data, { ids, archived }) => ({ ...data, routines: data.routines.map((routine) => (ids.includes(routine.id) ? { ...routine, archived } : routine)) }),
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
    bulkRemove: useRoutineMutation(async (ids: string[]) => (await execute(BulkDeleteRoutinesDocument, { ids })).bulkDeleteRoutines),
    /** Puts routines back as they were (undo of a bulk change). */
    restore: useRoutineMutation(async (routines: Routine[]) => {
      for (const routine of routines) await execute(UpdateRoutineDocument, { id: routine.id, input: routineInputOf(routine) });
      return routines.length;
    }),
  };
}
