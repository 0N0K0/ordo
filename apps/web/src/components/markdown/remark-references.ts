import type { MarkdownSuggestions } from './MarkdownEditor';
import { mapById } from '@ordo/shared';

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
  /** None: a task of no project. */
  projectId: string | null;
  /** Number within its project; none without project (it is only referenced by its id). */
  number: number | null;
  label: string;
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
}

/**
 * Key of a task by its number in its project, as `ReferenceTargets.taskByNumber` holds it.
 * @param {string} projectId Project.
 * @param {number | string} number Number of the task in it.
 * @returns {string} « <projectId>:<number> ».
 */
export const taskNumberKey = (projectId: string, number: number | string): string => `${projectId}:${number}`;

/**
 * Tasks texts can reference, by id and by number in their project (`ReferenceTargets` without its project).
 * @param {readonly ReferenceTask[]} tasks Tasks.
 * @returns {Omit<ReferenceTargets, 'projectId'>} Tasks by id and by `taskNumberKey`.
 */
export function referenceTargets(tasks: readonly ReferenceTask[]): Omit<ReferenceTargets, 'projectId'> {
  return {
    taskById: mapById(tasks),
    // "#12" only names a task of a project.
    taskByNumber: new Map(tasks.flatMap((task) => (task.projectId !== null && task.number !== null ? [[taskNumberKey(task.projectId, task.number), task] as const] : []))),
  };
}

/** Targets of texts without task references. */
export const NO_TARGETS: ReferenceTargets = { projectId: null, taskById: new Map(), taskByNumber: new Map() };

/** Suggestions of an editor of a text without task nor contributor references. */
export const NO_SUGGESTIONS: MarkdownSuggestions = { projectId: null, tasks: [], contributors: [] };

/**
 * Label of a task reference seen from the project of a text: "#12" in the same project, "Client › Projet #12"
 * otherwise, its label for a task of no project.
 * @param {ReferenceTask} task Task.
 * @param {string | null} projectId Project of the text.
 * @returns {string} Label.
 */
export function referenceLabel(task: ReferenceTask, projectId: string | null): string {
  return taskShortRef(task, projectId, task.place);
}

/**
 * Short reference of a task seen from a project: "#12" in the same project, "Projet #12" otherwise (numbers are per
 * project), its label for a task of no project (it has no number).
 * @param {{ number: number | null, label: string, projectId: string | null }} task Task.
 * @param {string | null} projectId Project it is seen from.
 * @param {string} place Name of the project of the task (its path).
 * @returns {string} Reference.
 */
export function taskShortRef(task: { number: number | null; label: string; projectId: string | null }, projectId: string | null, place: string): string {
  if (task.number === null) return task.label;
  // eslint-disable-next-line no-restricted-syntax -- taskShortRef itself.
  return task.projectId === projectId ? `#${task.number}` : `${place} #${task.number}`;
}

/** Address of a task in a text: by its id (its number changes with a transfer). */
export const taskReferenceUrl = (id: string) => `?task=${encodeURIComponent(id)}`;

// "#12", not glued to a word (so "a#1" stays untouched). A mention « @handle » stays plain text.
const REFERENCE = /(^|[^\p{L}\p{N}_&/])(#(\d+))/gu;
const TASK_LINK = /^\?task=([^&]+)$/;
const SKIPPED = new Set(['link', 'linkReference', 'inlineCode', 'code', 'definition']);

/**
 * Splits a text node into text and link nodes for task references.
 * @param {string} text Text value.
 * @param {ReferenceTargets} targets Existing tasks.
 * @returns {MdNode[]} Replacement nodes.
 */
function splitText(text: string, targets: ReferenceTargets): MdNode[] {
  const nodes: MdNode[] = [];
  let last = 0;
  for (const match of text.matchAll(REFERENCE)) {
    const [, before, reference, number] = match;
    const start = match.index + before.length;
    const task = targets.projectId ? targets.taskByNumber.get(taskNumberKey(targets.projectId, number)) : undefined;
    if (!task) continue;
    const url = taskReferenceUrl(task.id);
    if (start > last) nodes.push({ type: 'text', value: text.slice(last, start) });
    nodes.push({ type: 'link', url, children: [{ type: 'text', value: reference }] });
    last = start + reference.length;
  }
  if (last === 0) return [{ type: 'text', value: text }];
  if (last < text.length) nodes.push({ type: 'text', value: text.slice(last) });
  return nodes;
}

/**
 * Remark plugin: a typed "#12" becomes a link to task 12 of the project of the text, and a link to a task by id
 * ("?task=<id>") shows its current number (with its client and project when it is of another project). Unknown
 * numbers, and mentions (« @handle »), are left as plain text.
 * @param {ReferenceTargets} targets Existing tasks, and the project of the text.
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
