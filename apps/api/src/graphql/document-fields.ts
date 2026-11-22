import { prisma } from '../db';
import { resourceUrl } from '../services/core/attachments';
import { BY_POSITION } from '../services/core/ordering';
import { builder, type InputFields } from './builder';

/** Document of the app linked to an item (a treasury entry or line, a task, a routine, an event): of the library, or of a project. */
export interface LinkedDocument {
  id: string;
  source: 'LIBRARY' | 'PROJECT';
  kind: string;
  label: string;
  url: string;
  projectId: string | null;
  /** Library folder, or project, it belongs to. */
  place: string;
}

/** Document of the app linked to an item, as GraphQL gives it. */
export const LinkedDocumentRef = builder.objectRef<LinkedDocument>('LinkedDocument').implement({
  description: 'Document of the app linked to an item (treasury entry or line, task, routine, event): of the library, or of a project.',
  fields: (t) => ({
    id: t.exposeID('id'),
    source: t.exposeString('source', { description: 'LIBRARY or PROJECT.' }),
    kind: t.exposeString('kind', { description: 'FILE or LINK.' }),
    label: t.exposeString('label'),
    url: t.exposeString('url'),
    projectId: t.exposeID('projectId', { nullable: true }),
    place: t.exposeString('place'),
  }),
});

const documentSelect = {
  select: { id: true, kind: true, url: true, attachment: { select: { id: true, filename: true } } },
} as const;

/** Selections of the documents linked to an item: of the library (its folder), of projects (its project). */
export const LINKED_DOCUMENTS = {
  library: { select: { ...documentSelect.select, title: true, folder: { select: { name: true } } } },
  project: { select: { ...documentSelect.select, label: true, project: { select: { id: true, label: true } } } },
};

/**
 * Documents linked to an item: of the library, then of projects.
 * @param {object} owner Item with its documents (`LINKED_DOCUMENTS`).
 * @returns {LinkedDocument[]} Documents.
 */
export function linkedDocuments(owner: {
  libraryDocuments: (Parameters<typeof resourceUrl>[0] & { id: string; kind: string; title: string; folder: { name: string } | null })[];
  projectResources: (Parameters<typeof resourceUrl>[0] & { id: string; kind: string; label: string; project: { id: string; label: string } })[];
}): LinkedDocument[] {
  return [
    ...owner.libraryDocuments.map((document) => ({
      id: document.id,
      source: 'LIBRARY' as const,
      kind: document.kind,
      label: document.title,
      url: resourceUrl(document),
      projectId: null,
      place: document.folder?.name ?? 'Documents',
    })),
    ...owner.projectResources.map((resource) => ({
      id: resource.id,
      source: 'PROJECT' as const,
      kind: resource.kind,
      label: resource.label,
      url: resourceUrl(resource),
      projectId: resource.project.id,
      place: resource.project.label,
    })),
  ];
}

/**
 * Input fields of the documents linked to a task, a routine or an event.
 * @param {InputFields} t Field builder.
 * @param {string} omitted What an omitted list means.
 * @returns {object} Fields.
 */
export function linkedDocumentsInputFields(t: InputFields, omitted: string) {
  return {
    libraryDocumentIds: t.idList({ description: `Documents of the library linked to it (50 at most); ${omitted}.` }),
    projectResourceIds: t.idList({ description: `Documents of projects linked to it, of its project tree (50 at most); ${omitted}.` }),
  };
}

builder.queryField('documentOptions', (t) =>
  t.field({
    type: [LinkedDocumentRef],
    description: 'Documents of the app that can be linked to an item: the library, then the documents of the projects.',
    resolve: async () => {
      const [documents, resources] = await Promise.all([
        prisma.libraryDocument.findMany({ ...LINKED_DOCUMENTS.library, orderBy: { title: 'asc' } }),
        prisma.projectResource.findMany({ ...LINKED_DOCUMENTS.project, orderBy: [{ project: { label: 'asc' } }, ...BY_POSITION] }),
      ]);
      return linkedDocuments({ libraryDocuments: documents, projectResources: resources });
    },
  }),
);
