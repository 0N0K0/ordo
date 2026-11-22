import { useQuery } from '@tanstack/react-query';
import { graphql } from '../../../graphql';
import type { DocumentOptionsQuery } from '../../../graphql/graphql';
import { execute } from '../../../lib/graphql-client';
import { documentOptionsKey } from '../../../lib/query-keys';

/** Document of the app linked to an item (treasury entry or line, task, routine, event): of the library, or of a project. */
export type LinkedDocument = DocumentOptionsQuery['documentOptions'][number];

graphql(`
  fragment LinkedDocumentFields on LinkedDocument {
    id
    source
    kind
    label
    url
    projectId
    place
  }
`);

const DocumentOptionsDocument = graphql(`
  query DocumentOptions {
    documentOptions {
      ...LinkedDocumentFields
    }
  }
`);

/**
 * Documents of the app that can be linked to an item: the library, then the documents of the projects.
 * @param {boolean} [enabled] Loaded (else left aside). Optional. Default = true.
 * @returns {UseQueryResult} Query state.
 */
export function useDocumentOptions(enabled = true) {
  return useQuery({ enabled, queryKey: documentOptionsKey, queryFn: async () => (await execute(DocumentOptionsDocument)).documentOptions });
}
