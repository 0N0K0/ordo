import type { QueryClient } from '@tanstack/react-query';
import type { RoutineCategoryInput, RoutineInput } from '@ordo/shared';
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
      categoryId
      parentId
      startDate
      recurrence
      estimate
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

/** Inline changes of a routine. */
export interface RoutinePatchValues {
  title?: string;
  categoryId?: string | null;
  parentId?: string | null;
  estimate?: number | null;
  assigneeIds?: string[];
  requiredIds?: string[];
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
  };
}
