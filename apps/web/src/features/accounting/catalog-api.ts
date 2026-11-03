import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CatalogItemInput } from '@ordo/shared';
import { graphql } from '../../graphql';
import type { CatalogItemsQuery } from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';
import { accountingQueryKey } from './api';

export type CatalogItem = CatalogItemsQuery['catalogItems'][number];

const CatalogItemsDocument = graphql(`
  query CatalogItems {
    catalogItems {
      id
      kind
      title
      description
      unit
      unitPrice
      vatRate
      archived
    }
  }
`);

const CreateCatalogItem = graphql(`
  mutation CreateCatalogItem($input: CatalogItemInput!) {
    createCatalogItem(input: $input)
  }
`);
const UpdateCatalogItem = graphql(`
  mutation UpdateCatalogItem($id: ID!, $input: CatalogItemInput!) {
    updateCatalogItem(id: $id, input: $input)
  }
`);
const DeleteCatalogItem = graphql(`
  mutation DeleteCatalogItem($id: ID!) {
    deleteCatalogItem(id: $id)
  }
`);

const catalogKey = [...accountingQueryKey, 'catalog'];

/**
 * Catalogue of products and services, by title.
 * @returns {UseQueryResult} Query state.
 */
export function useCatalogItems() {
  return useQuery({ queryKey: catalogKey, queryFn: async () => (await execute(CatalogItemsDocument)).catalogItems });
}

/**
 * Mutation refreshing the catalogue once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useCatalogMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: catalogKey }) });
}

/**
 * Catalogue edition.
 * @returns {object} Mutations.
 */
export function useCatalogMutations() {
  return {
    create: useCatalogMutation(async (input: CatalogItemInput) => (await execute(CreateCatalogItem, { input: { ...input, description: input.description ?? null } })).createCatalogItem),
    update: useCatalogMutation(
      async ({ id, input }: { id: string; input: CatalogItemInput }) =>
        (await execute(UpdateCatalogItem, { id, input: { ...input, description: input.description ?? null } })).updateCatalogItem,
    ),
    remove: useCatalogMutation(async (id: string) => (await execute(DeleteCatalogItem, { id })).deleteCatalogItem),
  };
}
