import { MAX_PROJECT_DEPTH } from '@ordo/shared';
import type { Client, Project, Workspace } from './api';

export type SortMode = 'manual' | 'name';

/** Container id used for projects without client. */
export const NO_CLIENT = 'none';

export interface ProjectNode {
  project: Project;
  children: ProjectNode[];
}

export interface ClientNode {
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


const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/**
 * Lowercases and strips accents, for accent-insensitive search.
 * @param {string} value Text to normalize.
 * @returns {string} Normalized text.
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Label used for sorting and search: name of a client, title of a project.
 * @param {Client | Project} item Client or project.
 * @returns {string} Label.
 */
function labelOf(item: Client | Project): string {
  return 'title' in item ? item.title : item.name;
}

/**
 * Sorts items by manual position or alphabetically.
 * @param {T[]} items Items to sort.
 * @param {SortMode} sort Sort mode.
 * @returns {T[]} Sorted copy.
 */
function sortItems<T extends Client | Project>(items: T[], sort: SortMode): T[] {
  return [...items].sort((a, b) =>
    sort === 'name' ? collator.compare(labelOf(a), labelOf(b)) : a.position - b.position,
  );
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
    if (matches(node.project.title)) return [node];
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
 * Client name and parent titles of a project, from the client down to its parent.
 * @param {Workspace} workspace Workspace data.
 * @param {Project} project Project.
 * @returns {string} Path such as "Acme › Site › V2", or "Sans client".
 */
export function projectPath(workspace: Workspace, project: Project): string {
  const names: string[] = [];
  let parentId = project.parentId;
  while (parentId) {
    const parent = workspace.projects.find((item) => item.id === parentId);
    if (!parent) break;
    names.unshift(parent.title);
    parentId = parent.parentId;
  }
  const client = workspace.clients.find((item) => item.id === project.clientId);
  return [client?.name ?? 'Sans client', ...names].join(' › ');
}

/**
 * Full path of a project, its client first: what lists offering projects show.
 * @param {Workspace} workspace Workspace data.
 * @param {Project} project Project.
 * @returns {string} "Client › Projet › Sous-projet" ("Sans client › …" without client).
 */
export function projectFullPath(workspace: Workspace, project: Project): string {
  return `${projectPath(workspace, project)} › ${project.title}`;
}

/**
 * Options of a select of projects, each with its full path, in the order of their paths.
 * @param {Workspace | undefined} workspace Workspace data.
 * @param {Project[]} projects Projects offered.
 * @returns {{ value: string, label: string }[]} Options.
 */
export function projectOptions(workspace: Workspace | undefined, projects: Project[]): { value: string; label: string }[] {
  if (!workspace) return projects.map((project) => ({ value: project.id, label: project.title }));
  return projects.map((project) => ({ value: project.id, label: projectFullPath(workspace, project) })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

/**
 * Level of a project in its tree: 1 for a root project.
 * @param {Project[]} projects Every project.
 * @param {string} id Project id.
 * @returns {number} Depth.
 */
export function projectDepth(projects: Project[], id: string): number {
  let depth = 0;
  for (let current = projects.find((p) => p.id === id); current; current = projects.find((p) => p.id === current!.parentId)) {
    depth += 1;
  }
  return depth;
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
 * @param {Workspace} workspace Workspace data.
 * @param {SortMode} sort Sort mode.
 * @param {string} search Search text.
 * @returns {TreeSection} Active section.
 */
export function buildActiveSection(workspace: Workspace, sort: SortMode, search: string): TreeSection {
  const active = workspace.projects.filter((project) => !project.archived);
  const roots = active.filter((project) => !project.parentId);
  const section: TreeSection = {
    clients: sortItems(
      workspace.clients.filter((client) => !client.archived),
      sort,
    ).map((client) => ({
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
 * @param {Workspace} workspace Workspace data.
 * @param {SortMode} sort Sort mode.
 * @param {string} search Search text.
 * @param {ContextSeeds} seeds Section content.
 * @returns {TreeSection} Section with its context keys.
 */
function buildContextSection(
  workspace: Workspace,
  sort: SortMode,
  search: string,
  { clientIds, projectIds, keep }: ContextSeeds,
): TreeSection {
  const byId = new Map(workspace.projects.map((project) => [project.id, project]));
  const childrenOf = new Map<string, Project[]>();
  for (const project of workspace.projects) {
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
  workspace.projects
    .filter((project) => keep(project) && ((project.clientId && clientIds.has(project.clientId) && !project.parentId) || projectIds.has(project.id)))
    .forEach(addSubtree);

  // Ancestors and clients of the content are shown as context.
  const included = new Set(content);
  const contextKeys = new Set<string>();
  const shownClients = new Set(clientIds);
  for (const id of content) {
    let project = byId.get(id);
    if (project?.clientId) shownClients.add(project.clientId);
    while (project?.parentId) {
      const parent = byId.get(project.parentId);
      if (!parent) break;
      if (!content.has(parent.id)) contextKeys.add(`p:${parent.id}`);
      included.add(parent.id);
      project = parent;
    }
  }
  for (const clientId of shownClients) {
    if (!clientIds.has(clientId)) contextKeys.add(`c:${clientId}`);
  }

  const shown = workspace.projects.filter((project) => included.has(project.id));
  const roots = shown.filter((project) => !project.parentId);
  const section: TreeSection = {
    clients: sortItems(
      workspace.clients.filter((client) => shownClients.has(client.id)),
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
 * @param {Workspace} workspace Workspace data.
 * @param {SortMode} sort Sort mode.
 * @param {string} search Search text.
 * @returns {TreeSection} Favorites section.
 */
export function buildFavoriteSection(workspace: Workspace, sort: SortMode, search: string): TreeSection {
  return buildContextSection(workspace, sort, search, {
    clientIds: new Set(workspace.clients.filter((client) => client.favorite && !client.archived).map((client) => client.id)),
    projectIds: new Set(
      workspace.projects.filter((project) => project.favorite && !project.archived).map((project) => project.id),
    ),
    keep: (project) => !project.archived,
  });
}

/**
 * Builds the archive tree: archived clients with their projects, and archived projects with their
 * sub-projects, under their (possibly active) client and parents.
 * @param {Workspace} workspace Workspace data.
 * @param {SortMode} sort Sort mode.
 * @param {string} search Search text.
 * @returns {TreeSection} Archive section.
 */
export function buildArchiveSection(workspace: Workspace, sort: SortMode, search: string): TreeSection {
  return buildContextSection(workspace, sort, search, {
    clientIds: new Set(workspace.clients.filter((client) => client.archived).map((client) => client.id)),
    projectIds: new Set(workspace.projects.filter((project) => project.archived).map((project) => project.id)),
    keep: (project) => project.archived,
  });
}

/**
 * Number of items belonging to a section, context excluded.
 * @param {TreeSection} section Section.
 * @returns {number} Count.
 */
export function countSectionItems(section: TreeSection): number {
  const countForest = (nodes: ProjectNode[]): number =>
    nodes.reduce(
      (sum, node) => sum + (section.context?.has(`p:${node.project.id}`) ? 0 : 1) + countForest(node.children),
      0,
    );
  return (
    section.clients.reduce(
      (sum, node) => sum + (section.context?.has(`c:${node.client.id}`) ? 0 : 1) + countForest(node.projects),
      0,
    ) + countForest(section.orphans)
  );
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
 * Expand keys of the "Sans client" group and its projects with children.
 * @param {TreeSection} section Section.
 * @param {string} prefix Key prefix of the section.
 * @returns {string[]} Keys, empty when the group is empty.
 */
export function noClientKeys(section: TreeSection, prefix: string): string[] {
  if (section.orphans.length === 0) return [];
  return [`${prefix}${NO_CLIENT}`, ...section.orphans.flatMap((child) => projectKeys(child, prefix))];
}

/**
 * Expand keys of every foldable node of a section (clients, "Sans client" and projects with children).
 * @param {TreeSection} section Section.
 * @param {string} prefix Key prefix of the section ('' for the main tree).
 * @returns {string[]} Keys.
 */
export function sectionKeys(section: TreeSection, prefix: string): string[] {
  return [
    ...section.clients.flatMap((node) =>
      node.projects.length > 0
        ? [`${prefix}${node.client.id}`, ...node.projects.flatMap((child) => projectKeys(child, prefix))]
        : [],
    ),
    ...noClientKeys(section, prefix),
  ];
}

/**
 * Expand keys of a client or project node and its descendants, within a section.
 * @param {TreeSection} section Section.
 * @param {string} prefix Key prefix of the section.
 * @param {{ type: 'client' | 'project', id: string }} target Node to fold or unfold.
 * @returns {string[]} Keys, empty when the node has no children in the section.
 */
export function subtreeKeys(
  section: TreeSection,
  prefix: string,
  target: { type: 'client' | 'project'; id: string },
): string[] {
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
