import { z } from 'zod';

/** Most documents linked to an item (a task, a routine, an event, a treasury entry or line), of each source. */
export const LINKED_DOCUMENTS_MAX = 50;

/** Ids of documents linked to an item, of one source: `LINKED_DOCUMENTS_MAX` at most. */
export const linkedDocumentIdsSchema = z.array(z.string()).max(LINKED_DOCUMENTS_MAX, `${LINKED_DOCUMENTS_MAX} documents maximum.`);

/**
 * Documents linked to an item: of the library (`libraryDocumentIds`) and of the projects (`projectResourceIds`, of the
 * project tree of the item); omitted: none.
 */
export const linkedDocumentsFields = {
  libraryDocumentIds: linkedDocumentIdsSchema.default([]),
  projectResourceIds: linkedDocumentIdsSchema.default([]),
};

/** Documents linked to an item: of the library, and of the projects. */
export interface LinkedDocumentIds {
  libraryDocumentIds: string[];
  projectResourceIds: string[];
}
