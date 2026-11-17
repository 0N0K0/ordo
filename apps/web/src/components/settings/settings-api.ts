import { useMutation, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type { SettingsListKind } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type { SettingsListKind };

const SetSettingsItemLookDocument = graphql(`
  mutation SetSettingsItemLook($kind: SettingsListKind!, $id: ID!, $input: SettingsItemLookInput!) {
    setSettingsItemLook(kind: $kind, id: $id, input: $input)
  }
`);

const ReorderSettingsItemsDocument = graphql(`
  mutation ReorderSettingsItems($kind: SettingsListKind!, $ids: [ID!]!) {
    reorderSettingsItems(kind: $kind, ids: $ids)
  }
`);

/** Look of an item of a settings list: its color and its image (replaced or removed). */
interface SettingsItemLook {
  color?: string | null;
  icon?: File | null;
  removeIcon?: boolean;
}

/**
 * Changes the color and / or the image of an item of a settings list; the lists showing it are reloaded.
 * @returns {UseMutationResult} Mutation state.
 */
export function useSettingsItemLook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, id, input }: { kind: SettingsListKind; id: string; input: SettingsItemLook }) => (await execute(SetSettingsItemLookDocument, { kind, id, input })).setSettingsItemLook,
    // The item shows in many lists (selects, tables, filters…): all of them are reloaded.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/**
 * Puts the items of a flat settings list in the order given; the lists showing them are reloaded.
 * @returns {UseMutationResult} Mutation state.
 */
export function useReorderSettingsItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, ids }: { kind: SettingsListKind; ids: string[] }) => (await execute(ReorderSettingsItemsDocument, { kind, ids })).reorderSettingsItems,
    onSettled: () => queryClient.invalidateQueries(),
  });
}

/**
 * Id of the item a creation gave: its result (`{ id }`), or the result of the mutation (`{ createX: { id } }`).
 * @param {unknown} result Result of a creation.
 * @returns {string} Id.
 */
export function createdId(result: unknown): string {
  const record = (result ?? {}) as Record<string, unknown>;
  if (typeof record.id === 'string') return record.id;
  const value = Object.values(record)[0];
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id);
  throw new Error('L’élément créé est introuvable.');
}

/** Mutation of a list, as TanStack Query gives it (only its promise is used). */
interface AsyncMutation<V> {
  mutateAsync: (variables: V) => Promise<unknown>;
}

/**
 * Props of a SettingsList from the mutations of a list (create `{ input }`-less values, update `{ id, input }`, delete
 * `{ id }`, move `{ id, index }`): only the fields of the list are sent (its name and color by default).
 * @param {object} mutations Mutations of the list.
 * @param {AsyncMutation<I>} mutations.create Creation, from its input.
 * @param {AsyncMutation<{ id: string, input: I }>} mutations.update Update.
 * @param {AsyncMutation<{ id: string }>} mutations.remove Deletion.
 * @param {AsyncMutation<{ id: string, index: number }>} [mutations.move] Move in a flat list. Optional.
 * @param {(values: V) => I} [toInput] Input of the list from the form values. Optional. Default = its name and color.
 * @returns {{ create: (values: V) => Promise<string>, update: (id: string, values: V) => Promise<unknown>, remove: (id: string) => Promise<unknown>, move?: (id: string, parentId: string | null, index: number) => Promise<unknown> }} Props.
 */
export function listMutations<V extends { name: string; color: string }, I = { name: string; color: string }>(
  mutations: { create: AsyncMutation<I>; update: AsyncMutation<{ id: string; input: I }>; remove: AsyncMutation<{ id: string }>; move?: AsyncMutation<{ id: string; index: number }> },
  toInput: (values: V) => I = (values) => ({ name: values.name, color: values.color }) as I,
) {
  const { move } = mutations;
  return {
    create: async (values: V) => createdId(await mutations.create.mutateAsync(toInput(values))),
    update: (id: string, values: V) => mutations.update.mutateAsync({ id, input: toInput(values) }),
    remove: (id: string) => mutations.remove.mutateAsync({ id }),
    move: move ? (id: string, _parentId: string | null, index: number) => move.mutateAsync({ id, index }) : undefined,
  };
}
