/** Minimal mdast node shape used by the plugin. */
interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
}

/** A task that texts can reference. */
export interface ReferenceTask {
  id: string;
  projectId: string;
  /** Number within its project. */
  number: number;
  title: string;
  /** Client and project path of its project ("Client › Projet › Sous-projet"). */
  place: string;
}

export interface ReferenceTargets {
  /** Project of the text: a typed "#12" is task 12 of this project (none: "#12" stays plain text). */
  projectId: string | null;
  /** Tasks by id (links "?task=<id>"). */
  taskById: ReadonlyMap<string, ReferenceTask>;
  /** Tasks by "<projectId>:<number>". */
  taskByNumber: ReadonlyMap<string, ReferenceTask>;
  /** Existing contributor handles. */
  handles: Set<string>;
}

/** Targets of texts without task nor contributor references. */
export const NO_TARGETS: ReferenceTargets = { projectId: null, taskById: new Map(), taskByNumber: new Map(), handles: new Set() };

/**
 * Label of a task reference seen from the project of a text: "#12" in the same project, "Client › Projet #12"
 * otherwise.
 * @param {ReferenceTask} task Task.
 * @param {string | null} projectId Project of the text.
 * @returns {string} Label.
 */
export function referenceLabel(task: ReferenceTask, projectId: string | null): string {
  return task.projectId === projectId ? `#${task.number}` : `${task.place} #${task.number}`;
}

/** Address of a task in a text: by its id (its number changes with a transfer). */
export const taskReferenceUrl = (id: string) => `?task=${encodeURIComponent(id)}`;

// "#12" or "@handle", not glued to a word (so "a#1" and emails stay untouched).
const REFERENCE = /(^|[^\p{L}\p{N}_&/])(#(\d+)|@([a-z0-9](?:[a-z0-9_-]*[a-z0-9])?))/giu;
const TASK_LINK = /^\?task=([^&]+)$/;
const SKIPPED = new Set(['link', 'linkReference', 'inlineCode', 'code', 'definition']);

/**
 * Splits a text node into text and link nodes for task and mention references.
 * @param {string} text Text value.
 * @param {ReferenceTargets} targets Existing tasks and contributors.
 * @returns {MdNode[]} Replacement nodes.
 */
function splitText(text: string, targets: ReferenceTargets): MdNode[] {
  const nodes: MdNode[] = [];
  let last = 0;
  for (const match of text.matchAll(REFERENCE)) {
    const [, before, reference, number, handle] = match;
    const start = match.index + before.length;
    const task = number && targets.projectId ? targets.taskByNumber.get(`${targets.projectId}:${number}`) : undefined;
    const url = number
      ? task
        ? taskReferenceUrl(task.id)
        : null
      : targets.handles.has(handle.toLowerCase())
        ? `/?assignee=${handle.toLowerCase()}`
        : null;
    if (!url) continue;
    if (start > last) nodes.push({ type: 'text', value: text.slice(last, start) });
    nodes.push({ type: 'link', url, children: [{ type: 'text', value: reference }] });
    last = start + reference.length;
  }
  if (last === 0) return [{ type: 'text', value: text }];
  if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) });
  return nodes;
}

/**
 * Remark plugin: a typed "#12" becomes a link to task 12 of the project of the text, "@handle" a link to that
 * contributor's tasks, and a link to a task by id ("?task=<id>") shows its current number (with its client and
 * project when it is of another project). Unknown numbers and handles are left as plain text.
 * @param {ReferenceTargets} targets Existing tasks and contributors, and the project of the text.
 * @returns {() => (tree: MdNode) => void} Remark plugin.
 */
export function remarkReferences(targets: ReferenceTargets) {
  /**
   * Walks the tree and rewrites text nodes and task links.
   * @param {MdNode} node Current node.
   * @returns {void}
   */
  const visit = (node: MdNode) => {
    if (node.type === 'link' && node.url) {
      const id = TASK_LINK.exec(node.url)?.[1];
      const task = id ? targets.taskById.get(decodeURIComponent(id)) : undefined;
      if (task) node.children = [{ type: 'text', value: referenceLabel(task, targets.projectId) }];
      return;
    }
    if (!node.children || SKIPPED.has(node.type)) return;
    node.children = node.children.flatMap((child) => (child.type === 'text' && child.value ? splitText(child.value, targets) : [child]));
    node.children.forEach(visit);
  };
  return () => visit;
}
