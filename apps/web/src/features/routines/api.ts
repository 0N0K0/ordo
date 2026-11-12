import type { QueryClient } from '@tanstack/react-query';
import type { Recurrence, RoutineCategoryInput, RoutineInput } from '@ordo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { RoutinesDataQuery } from '../../graphql/graphql';
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
  mutation MoveRoutineCategory($id: ID!, $parentId: ID) {
    moveRoutineCategory(id: $id, parentId: $parentId)
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
  mutation SetRoutineDone($id: ID!, $done: Boolean!, $date: Date) {
    setRoutineDone(id: $id, done: $done, date: $date)
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
      async (variables: { id: string; parentId: string | null }) => (await execute(MoveCategoryDocument, variables)).moveRoutineCategory,
      (data, { id, parentId }) => ({ ...data, routineCategories: data.routineCategories.map((category) => (category.id === id ? { ...category, parentId } : category)) }),
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
      async (variables: { id: string; done: boolean; date?: string | null }) => (await execute(SetRoutineDoneDocument, variables)).setRoutineDone,
      (data, { id, done, date }) =>
        patchRoutine(data, id, (routine) => {
          const day = date ?? routine.currentDate;
          if (!day) return routine;
          const others = routine.doneDates.filter((value) => value !== day);
          return { ...routine, doneDates: done ? [day, ...others].sort().reverse() : others };
        }),
    ),
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
        routines: data.routines.map((routine) => {
          const day = routine.currentDate;
          if (!ids.includes(routine.id) || !day) return routine;
          const others = routine.doneDates.filter((value) => value !== day);
          return { ...routine, doneDates: done ? [day, ...others].sort().reverse() : others };
        }),
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
