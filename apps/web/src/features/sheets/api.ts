import type { SheetInput, SheetItemInput, SheetLinkInput } from '@ordo/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { ChecklistQuery, SheetLinksQuery, SheetsQuery } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type Sheet = SheetsQuery['sheets'][number];
export type SheetItem = Sheet['items'][number];
export type SheetLink = SheetLinksQuery['sheetLinks'][number];
export type Checklist = NonNullable<ChecklistQuery['checklist']>;
export type ChecklistItem = Checklist['items'][number];

/** Owner of sheets and checklists: a routine or an event (an occurrence for its checklist), or a task. */
export type SheetOwner = { routineId: string } | { eventId: string } | { taskId: string };

const sheetsKey = ['sheets'] as const;

/**
 * Variables of an owner: one of a routine, an event and a task.
 * @param {SheetOwner} owner Owner.
 * @returns {{ routineId: string | null, eventId: string | null, taskId: string | null }} Variables.
 */
const ownerVariables = (owner: SheetOwner) => ({
  routineId: 'routineId' in owner ? owner.routineId : null,
  eventId: 'eventId' in owner ? owner.eventId : null,
  taskId: 'taskId' in owner ? owner.taskId : null,
});

const SheetsDocument = graphql(`
  query Sheets($projectId: ID) {
    sheets(projectId: $projectId) {
      id
      name
      note
      projectId
      position
      createdAt
      updatedAt
      usedBy
      items {
        id
        productId
        label
        categoryId
        quantity
        unit
        note
        position
      }
    }
  }
`);

const SheetLinksDocument = graphql(`
  query SheetLinks($routineId: ID, $eventId: ID, $taskId: ID) {
    sheetLinks(routineId: $routineId, eventId: $eventId, taskId: $taskId) {
      id
      sheetId
      multiplier
    }
  }
`);

const ChecklistDocument = graphql(`
  query Checklist($routineId: ID, $eventId: ID, $taskId: ID, $occurrenceDate: Date) {
    checklist(routineId: $routineId, eventId: $eventId, taskId: $taskId, occurrenceDate: $occurrenceDate) {
      id
      routineId
      eventId
      taskId
      occurrenceDate
      items {
        id
        productId
        label
        categoryId
        quantity
        unit
        note
        checkedAt
        position
        sources {
          sheetId
          name
          quantity
        }
      }
    }
  }
`);

const CreateSheet = graphql(`
  mutation CreateSheet($input: SheetInput!) {
    createSheet(input: $input)
  }
`);
const UpdateSheet = graphql(`
  mutation UpdateSheet($id: ID!, $input: SheetInput!) {
    updateSheet(id: $id, input: $input)
  }
`);
const DuplicateSheet = graphql(`
  mutation DuplicateSheet($id: ID!) {
    duplicateSheet(id: $id)
  }
`);
const DeleteSheet = graphql(`
  mutation DeleteSheet($id: ID!) {
    deleteSheet(id: $id)
  }
`);
const AddSheetToShoppingList = graphql(`
  mutation AddSheetToShoppingList($listId: ID!, $sheetId: ID!, $multiplier: Float!) {
    addSheetToShoppingList(listId: $listId, sheetId: $sheetId, multiplier: $multiplier)
  }
`);
const RemoveSheetFromShoppingList = graphql(`
  mutation RemoveSheetFromShoppingList($listId: ID!, $sheetId: ID!) {
    removeSheetFromShoppingList(listId: $listId, sheetId: $sheetId)
  }
`);
const SetSheetLinks = graphql(`
  mutation SetSheetLinks($routineId: ID, $eventId: ID, $taskId: ID, $links: [SheetLinkInput!]!) {
    setSheetLinks(routineId: $routineId, eventId: $eventId, taskId: $taskId, links: $links)
  }
`);
const ResetChecklist = graphql(`
  mutation ResetChecklist($id: ID!) {
    resetChecklist(id: $id)
  }
`);
const AddSheetToChecklist = graphql(`
  mutation AddSheetToChecklist($id: ID!, $sheetId: ID!, $multiplier: Float!) {
    addSheetToChecklist(id: $id, sheetId: $sheetId, multiplier: $multiplier)
  }
`);
const AddChecklistItem = graphql(`
  mutation AddChecklistItem($listId: ID!, $input: SheetItemInput!) {
    addChecklistItem(listId: $listId, input: $input)
  }
`);
const UpdateChecklistItem = graphql(`
  mutation UpdateChecklistItem($id: ID!, $input: SheetItemInput!) {
    updateChecklistItem(id: $id, input: $input)
  }
`);
const SetChecklistItemsChecked = graphql(`
  mutation SetChecklistItemsChecked($ids: [ID!]!, $checked: Boolean!) {
    setChecklistItemsChecked(ids: $ids, checked: $checked)
  }
`);
const DeleteChecklistItem = graphql(`
  mutation DeleteChecklistItem($id: ID!) {
    deleteChecklistItem(id: $id)
  }
`);

/**
 * Sheets, in their order: all, or those of a project.
 * @param {string | null} [projectId] Project. Optional.
 * @returns {object} Query.
 */
export function useSheets(projectId: string | null = null) {
  return useQuery({ queryKey: [...sheetsKey, 'all', projectId], queryFn: async () => (await execute(SheetsDocument, { projectId })).sheets });
}

/**
 * Sheets of a routine, an event or a task.
 * @param {SheetOwner | null} owner Owner (none: not loaded).
 * @returns {object} Query.
 */
export function useSheetLinks(owner: SheetOwner | null) {
  return useQuery({ enabled: owner !== null, queryKey: [...sheetsKey, 'links', owner], queryFn: async () => (await execute(SheetLinksDocument, ownerVariables(owner!))).sheetLinks });
}

/**
 * Checklist of a routine or an event occurrence, or of a task: made of its sheets the first time (none without sheets).
 * @param {(SheetOwner & { occurrenceDate?: string | null }) | null} owner Owner and occurrence (none: not loaded).
 * @returns {object} Query.
 */
export function useChecklist(owner: (SheetOwner & { occurrenceDate?: string | null }) | null) {
  return useQuery({
    enabled: owner !== null,
    queryKey: [...sheetsKey, 'checklist', owner],
    queryFn: async () => (await execute(ChecklistDocument, { ...ownerVariables(owner!), occurrenceDate: owner?.occurrenceDate ?? null })).checklist,
  });
}

/**
 * Mutation refreshing the sheets, the checklists and the shopping lists once done.
 * @param {(variables: V) => Promise<R>} fn Mutation.
 * @returns {object} Mutation.
 */
function useSheetMutation<V, R>(fn: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: sheetsKey });
      await queryClient.invalidateQueries({ queryKey: ['shopping'] });
    },
  });
}

/**
 * Changes of the sheets and checklists, and sheets added to shopping lists.
 * @returns {object} Mutations.
 */
export function useSheetMutations() {
  return {
    create: useSheetMutation(async (input: SheetInput) => (await execute(CreateSheet, { input })).createSheet),
    update: useSheetMutation(async (variables: { id: string; input: SheetInput }) => (await execute(UpdateSheet, variables)).updateSheet),
    duplicate: useSheetMutation(async (id: string) => (await execute(DuplicateSheet, { id })).duplicateSheet),
    remove: useSheetMutation(async (id: string) => (await execute(DeleteSheet, { id })).deleteSheet),
    addToShoppingList: useSheetMutation(async (variables: { listId: string; sheetId: string; multiplier: number }) => (await execute(AddSheetToShoppingList, variables)).addSheetToShoppingList),
    removeFromShoppingList: useSheetMutation(async (variables: { listId: string; sheetId: string }) => (await execute(RemoveSheetFromShoppingList, variables)).removeSheetFromShoppingList),
    setLinks: useSheetMutation(async ({ owner, links }: { owner: SheetOwner; links: SheetLinkInput[] }) => (await execute(SetSheetLinks, { ...ownerVariables(owner), links })).setSheetLinks),
    resetChecklist: useSheetMutation(async (id: string) => (await execute(ResetChecklist, { id })).resetChecklist),
    addToChecklist: useSheetMutation(async (variables: { id: string; sheetId: string; multiplier: number }) => (await execute(AddSheetToChecklist, variables)).addSheetToChecklist),
    addChecklistItem: useSheetMutation(async (variables: { listId: string; input: SheetItemInput }) => (await execute(AddChecklistItem, variables)).addChecklistItem),
    updateChecklistItem: useSheetMutation(async (variables: { id: string; input: SheetItemInput }) => (await execute(UpdateChecklistItem, variables)).updateChecklistItem),
    setChecked: useSheetMutation(async (variables: { ids: string[]; checked: boolean }) => (await execute(SetChecklistItemsChecked, variables)).setChecklistItemsChecked),
    removeChecklistItem: useSheetMutation(async (id: string) => (await execute(DeleteChecklistItem, { id })).deleteChecklistItem),
  };
}
