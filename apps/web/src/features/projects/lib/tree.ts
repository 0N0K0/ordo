import { unarchived, archivedIds } from '../../../lib/archive';
import { treeOptions, type TreeNode, type TreeOption } from '../../../components/tree/tree-select';
import { ancestorsOf, lineageOf, mapById, LEVEL, MAX_PROJECT_DEPTH } from '@ordo/shared';
import type { Client, Project, ProjectTree } from '../api';
import { collator, normalize } from '../../../lib/text';
import { taggedKey } from '../../../lib/tagged-key';

export type SortMode = 'manual' | 'name';

/**
 * Clients as the items of a select (listSelectProps): a client keeps its name, offered as the label of its option.
 * @param {readonly Client[]} clients Clients.
 * @returns {(Client & { label: string })[]} Items.
 */
export const clientItems = (clients: readonly Client[]): (Client & { label: string })[] => clients.map((client) => ({ ...client, label: client.name }));

/** Id of the root of the projects without client, in the drag and drop of the main tree. */
export const NO_CLIENT = 'none';

export interface ProjectNode {
  project: Project;
  children: ProjectNode[];
}

interface ClientNode {
  client: Client;
  projects: ProjectNode[];
}

export interface TreeSection {
  clients: ClientNode[];
  /** Projects without client. */
  orphans: ProjectNode[];
  /**
   * Items shown only to locate the content of the section (e.g. the active client of an archived
   * project), as `c:<clientId>` and `p:<projectId>` keys.
   */
  context?: Set<string>;
}

/**
 * Label used for sorting and search: name of a client, label of a project.
 * @param {Client | Project} item Client or project.
 * @returns {string} Label.
 */
function labelOf(item: Client | Project): string {
  return 'name' in item ? item.name : item.label;
}

/**
 * Sorts items by manual position or alphabetically.
 * @param {T[]} items Items to sort.
 * @param {SortMode} sort Sort mode.
 * @returns {T[]} Sorted copy.
 */
function sortItems<T extends Client | Project>(items: T[], sort: SortMode): T[] {
  return [...items].sort((a, b) => (sort === 'name' ? collator.compare(labelOf(a), labelOf(b)) : a.position - b.position));
}

/**
 * Builds the sub-trees of the given roots, keeping only the children accepted by `keep`.
 * @param {Project[]} roots Root projects.
 * @param {Project[]} projects Every candidate project.
 * @param {SortMode} sort Sort mode.
 * @returns {ProjectNode[]} Nodes.
 */
function buildForest(roots: Project[], projects: Project[], sort: SortMode): ProjectNode[] {
  return sortItems(roots, sort).map((project) => ({
    project,
    children: buildForest(
      projects.filter((child) => child.parentId === project.id),
      projects,
      sort,
    ),
  }));
}

/**
 * Keeps the nodes matching the search, with all the children of a matching node.
 * @param {ProjectNode[]} nodes Nodes.
 * @param {(label: string) => boolean} matches Label matcher.
 * @returns {ProjectNode[]} Filtered nodes.
 */
function filterForest(nodes: ProjectNode[], matches: (label: string) => boolean): ProjectNode[] {
  return nodes.flatMap((node) => {
    if (matches(node.project.label)) return [node];
    const children = filterForest(node.children, matches);
    return children.length > 0 ? [{ ...node, children }] : [];
  });
}

/**
 * Keeps the nodes matching the search: a matching client keeps all its projects.
 * @param {TreeSection} section Section to filter.
 * @param {string} search Search text.
 * @returns {TreeSection} Filtered section.
 */
function filterSection(section: TreeSection, search: string): TreeSection {
  const query = normalize(search.trim());
  if (!query) return section;
  const matches = (label: string) => normalize(label).includes(query);

  return {
    clients: section.clients.flatMap((node) => {
      if (matches(node.client.name)) return [node];
      const projects = filterForest(node.projects, matches);
      return projects.length > 0 ? [{ ...node, projects }] : [];
    }),
    orphans: filterForest(section.orphans, matches),
  };
}

/**
 * Client name and parent labels of a project, from the client down to its parent.
 * @param {ProjectTree} tree Clients, projects, categories and statuses.
 * @param {Project} project Project.
 * @returns {string} Path such as "Acme › Site › V2" (without client: its parents alone, empty for a root project).
 */
function projectAncestry(tree: ProjectTree, project: Project): string {
  const names = lineageOf(mapById(tree.projects), project.parentId)
    .reverse()
    .map((parent) => parent.label);
  const client = tree.clients.find((item) => item.id === project.clientId);
  return [...(client ? [client.name] : []), ...names].join(LEVEL);
}

/**
 * Full path of a project, its client first: what lists offering projects show.
 * @param {ProjectTree} tree Clients, projects, categories and statuses.
 * @param {Project} project Project.
 * @returns {string} "Client › Projet › Sous-projet" (without client: "Projet › Sous-projet").
 */
export function projectFullPath(tree: ProjectTree, project: Project): string {
  return [projectAncestry(tree, project), project.label].filter(Boolean).join(LEVEL);
}

/**
 * Options of a select of projects, in the order of the tree: under their client (greyed out, not selectable), each
 * project followed by its sub-projects, indented; parents not offered are greyed out too.
 * @param {ProjectTree | undefined} tree Clients, projects, categories and statuses.
 * @param {Project[]} projects Projects offered.
 * @returns {TreeOption[]} Options.
 */
export function projectOptions(tree: ProjectTree | undefined, projects: Project[]): TreeOption[] {
  const offered = new Set(projects.map((project) => project.id));
  if (!tree) return treeOptions(projects.map((project) => ({ id: project.id, parentId: null, label: project.label })));
  return treeOptions(projectNodes(tree), (id) => offered.has(id));
}

/**
 * Options of a select of the projects of a client (projectOptions), archived ones left out unless asked.
 * @param {ProjectTree | undefined} tree Clients, projects, categories and statuses.
 * @param {string | null} clientId Client (null: the projects without client, or every project with `anyWhenNoClient`).
 * @param {object} [options] Options. Optional.
 * @param {boolean} [options.archived=false] Offers the archived projects too. Optional. Default = false.
 * @param {string | null} [options.keepId] Project offered whatever its client and state (the one chosen). Optional.
 * @param {boolean} [options.anyWhenNoClient=false] Without client, offers the projects of every client. Optional. Default = false.
 * @returns {TreeOption[]} Options.
 */
export function clientProjectOptions(
  tree: ProjectTree | undefined,
  clientId: string | null,
  { archived = false, keepId = null, anyWhenNoClient = false }: { archived?: boolean; keepId?: string | null; anyWhenNoClient?: boolean } = {},
): TreeOption[] {
  const projects = tree?.projects ?? [];
  const offered = (archived ? projects : unarchived(projects, keepId)).filter(
    (project) => (keepId != null && project.id === keepId) || (anyWhenNoClient && !clientId) || project.clientId === clientId,
  );
  return projectOptions(tree, offered);
}

/**
 * Tree of the clients (ids "client:<id>", "client:none" for the projects without client) and of their projects,
 * siblings in their manual order (archived last).
 * @param {ProjectTree} tree Clients, projects, categories and statuses.
 * @returns {TreeNode[]} Nodes.
 */
export function projectNodes(tree: ProjectTree): TreeNode[] {
  const byOrder = <T extends { archived: boolean; position: number }>(a: T, b: T) => Number(a.archived) - Number(b.archived) || a.position - b.position;
  return [
    ...[...tree.clients].sort(byOrder).map((client) => ({ id: taggedKey('client', client.id), parentId: null, label: client.name, color: client.color, iconUrl: client.iconUrl })),
    { id: 'client:none', parentId: null, label: 'Sans client', pathless: true },
    ...[...tree.projects]
      .sort(byOrder)
      .map((project) => ({ id: project.id, parentId: project.parentId ?? taggedKey('client', project.clientId ?? 'none'), label: project.label, color: project.color, iconUrl: project.iconUrl })),
  ];
}

/**
 * Level of a project in its tree: 1 for a root project.
 * @param {Project[]} projects Every project.
 * @param {string} id Project id.
 * @returns {number} Depth.
 */
export function projectDepth(projects: Project[], id: string): number {
  return lineageOf(mapById(projects), id).length;
}

/**
 * Number of levels of the sub-tree rooted at a project (1 without children).
 * @param {Project[]} projects Every project.
 * @param {string} id Project id.
 * @returns {number} Height.
 */
export function projectHeight(projects: Project[], id: string): number {
  const children = projects.filter((project) => project.parentId === id);
  return 1 + Math.max(0, ...children.map((child) => projectHeight(projects, child.id)));
}

/**
 * Whether a project can still receive sub-projects.
 * @param {Project[]} projects Every project.
 * @param {string} id Project id.
 * @returns {boolean} True below the maximum depth.
 */
export function canHaveChildren(projects: Project[], id: string): boolean {
  return projectDepth(projects, id) < MAX_PROJECT_DEPTH;
}

/**
 * Builds the main tree: active clients with their active project trees, and active trees without client.
 * @param {ProjectTree} tree Clients, projects, categories and statuses.
 * @param {SortMode} sort Sort mode.
 * @param {string} search Search text.
 * @returns {TreeSection} Active section.
 */
export function buildActiveSection(tree: ProjectTree, sort: SortMode, search: string): TreeSection {
  const active = unarchived(tree.projects);
  const roots = active.filter((project) => !project.parentId);
  const section: TreeSection = {
    clients: sortItems(unarchived(tree.clients), sort).map((client) => ({
      client,
      projects: buildForest(
        roots.filter((project) => project.clientId === client.id),
        active,
        sort,
      ),
    })),
    orphans: buildForest(
      roots.filter((project) => !project.clientId),
      active,
      sort,
    ),
  };
  return filterSection(section, search);
}

interface ContextSeeds {
  /** Clients shown with their whole tree (of kept projects). */
  clientIds: Set<string>;
  /** Projects shown with their sub-tree (of kept projects). */
  projectIds: Set<string>;
  /** Projects that belong to the section content (active ones for favorites, archived ones for archives). */
  keep: (project: Project) => boolean;
}

/**
 * Builds a section showing some clients and projects with their sub-trees, plus their client and
 * parent projects as context so the hierarchy stays readable.
 * @param {ProjectTree} tree Clients, projects, categories and statuses.
 * @param {SortMode} sort Sort mode.
 * @param {string} search Search text.
 * @param {ContextSeeds} seeds Section content.
 * @returns {TreeSection} Section with its context keys.
 */
function buildContextSection(tree: ProjectTree, sort: SortMode, search: string, { clientIds, projectIds, keep }: ContextSeeds): TreeSection {
  const byId = mapById(tree.projects);
  const childrenOf = new Map<string, Project[]>();
  for (const project of tree.projects) {
    if (!project.parentId) continue;
    childrenOf.set(project.parentId, [...(childrenOf.get(project.parentId) ?? []), project]);
  }

  const content = new Set<string>();
  /**
   * Adds a project and its kept descendants to the content.
   * @param {Project} project Project.
   * @returns {void}
   */
  const addSubtree = (project: Project) => {
    content.add(project.id);
    (childrenOf.get(project.id) ?? []).filter(keep).forEach(addSubtree);
  };
  tree.projects.filter((project) => keep(project) && ((project.clientId && clientIds.has(project.clientId) && !project.parentId) || projectIds.has(project.id))).forEach(addSubtree);

  // Ancestors and clients of the content are shown as context.
  const included = new Set(content);
  const contextKeys = new Set<string>();
  const shownClients = new Set(clientIds);
  for (const id of content) {
    const project = byId.get(id);
    if (project?.clientId) shownClients.add(project.clientId);
    for (const parent of ancestorsOf(byId, id)) {
      if (!content.has(parent.id)) contextKeys.add(taggedKey('p', parent.id));
      included.add(parent.id);
    }
  }
  for (const clientId of shownClients) {
    if (!clientIds.has(clientId)) contextKeys.add(taggedKey('c', clientId));
  }

  const shown = tree.projects.filter((project) => included.has(project.id));
  const roots = shown.filter((project) => !project.parentId);
  const section: TreeSection = {
    clients: sortItems(
      tree.clients.filter((client) => shownClients.has(client.id)),
      sort,
    ).map((client) => ({
      client,
      projects: buildForest(
        roots.filter((project) => project.clientId === client.id),
        shown,
        sort,
      ),
    })),
    orphans: buildForest(
      roots.filter((project) => !project.clientId),
      shown,
      sort,
    ),
  };
  return { ...filterSection(section, search), context: contextKeys };
}

/**
 * Builds the favorites tree: favorite clients with their active projects, and favorite projects with
 * their active sub-projects, under their client and parents.
 * @param {ProjectTree} tree Clients, projects, categories and statuses.
 * @param {SortMode} sort Sort mode.
 * @param {string} search Search text.
 * @returns {TreeSection} Favorites section.
 */
export function buildFavoriteSection(tree: ProjectTree, sort: SortMode, search: string): TreeSection {
  return buildContextSection(tree, sort, search, {
    clientIds: new Set(
      unarchived(tree.clients)
        .filter((client) => client.favorite)
        .map((client) => client.id),
    ),
    projectIds: new Set(
      unarchived(tree.projects)
        .filter((project) => project.favorite)
        .map((project) => project.id),
    ),
    keep: (project) => !project.archived,
  });
}

/**
 * Builds the archive tree: archived clients with their projects, and archived projects with their
 * sub-projects, under their (possibly active) client and parents.
 * @param {ProjectTree} tree Clients, projects, categories and statuses.
 * @param {SortMode} sort Sort mode.
 * @param {string} search Search text.
 * @returns {TreeSection} Archive section.
 */
export function buildArchiveSection(tree: ProjectTree, sort: SortMode, search: string): TreeSection {
  return buildContextSection(tree, sort, search, {
    clientIds: archivedIds(tree.clients),
    projectIds: archivedIds(tree.projects),
    keep: (project) => project.archived,
  });
}

/**
 * Whether a section shows nothing (its context only comes with content).
 * @param {TreeSection} section Section.
 * @returns {boolean} True without clients nor projects.
 */
export function isEmptySection(section: TreeSection): boolean {
  return section.clients.length === 0 && section.orphans.length === 0;
}

/**
 * Expand keys of a project node and its descendants that have children.
 * @param {ProjectNode} node Project node.
 * @param {string} prefix Key prefix of the section.
 * @returns {string[]} Keys.
 */
function projectKeys(node: ProjectNode, prefix: string): string[] {
  if (node.children.length === 0) return [];
  return [`${prefix}p:${node.project.id}`, ...node.children.flatMap((child) => projectKeys(child, prefix))];
}

/**
 * Expand keys of the clients of a section and of their projects with children.
 * @param {TreeSection} section Section.
 * @param {string} prefix Key prefix of the section ('' for the main tree).
 * @returns {string[]} Keys, empty when no client has projects.
 */
export function clientKeys(section: TreeSection, prefix: string): string[] {
  return section.clients.flatMap((node) => (node.projects.length > 0 ? [`${prefix}${node.client.id}`, ...node.projects.flatMap((child) => projectKeys(child, prefix))] : []));
}

/**
 * Expand keys of the projects without client of a section that have children.
 * @param {TreeSection} section Section.
 * @param {string} prefix Key prefix of the section ('' for the main tree).
 * @returns {string[]} Keys, empty when none has children.
 */
export function orphanKeys(section: TreeSection, prefix: string): string[] {
  return section.orphans.flatMap((child) => projectKeys(child, prefix));
}

/**
 * Expand keys of every foldable node of a section (clients and projects with children).
 * @param {TreeSection} section Section.
 * @param {string} prefix Key prefix of the section ('' for the main tree).
 * @returns {string[]} Keys.
 */
export function sectionKeys(section: TreeSection, prefix: string): string[] {
  return [...clientKeys(section, prefix), ...orphanKeys(section, prefix)];
}

/**
 * Expand keys of a client or project node and its descendants, within a section.
 * @param {TreeSection} section Section.
 * @param {string} prefix Key prefix of the section.
 * @param {{ type: 'client' | 'project', id: string }} target Node to fold or unfold.
 * @returns {string[]} Keys, empty when the node has no children in the section.
 */
export function subtreeKeys(section: TreeSection, prefix: string, target: { type: 'client' | 'project'; id: string }): string[] {
  if (target.type === 'client') {
    const node = section.clients.find((item) => item.client.id === target.id);
    if (!node || node.projects.length === 0) return [];
    return [`${prefix}${node.client.id}`, ...node.projects.flatMap((child) => projectKeys(child, prefix))];
  }

  /**
   * Finds the project node in a forest.
   * @param {ProjectNode[]} nodes Nodes to search.
   * @returns {ProjectNode | undefined} Node.
   */
  const find = (nodes: ProjectNode[]): ProjectNode | undefined => {
    for (const node of nodes) {
      if (node.project.id === target.id) return node;
      const found = find(node.children);
      if (found) return found;
    }
    return undefined;
  };
  const node = find([...section.clients.flatMap((item) => item.projects), ...section.orphans]);
  return node ? projectKeys(node, prefix) : [];
}
