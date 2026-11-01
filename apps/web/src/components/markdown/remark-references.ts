/** Minimal mdast node shape used by the plugin. */
interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
}

export interface ReferenceTargets {
  /** Existing task numbers. */
  taskNumbers: Set<number>;
  /** Existing contributor handles. */
  handles: Set<string>;
}

// "#12" or "@handle", not glued to a word (so "a#1" and emails stay untouched).
const REFERENCE = /(^|[^\p{L}\p{N}_&/])(#(\d+)|@([a-z0-9](?:[a-z0-9_-]*[a-z0-9])?))/giu;
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
    const url = number
      ? targets.taskNumbers.has(Number(number))
        ? `/tasks/${number}`
        : null
      : targets.handles.has(handle.toLowerCase())
        ? `/tasks?assignee=${handle.toLowerCase()}`
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
 * Remark plugin turning "#12" into a link to task 12 and "@handle" into a link to that contributor's tasks.
 * Unknown numbers and handles are left as plain text.
 * @param {ReferenceTargets} targets Existing tasks and contributors.
 * @returns {() => (tree: MdNode) => void} Remark plugin.
 */
export function remarkReferences(targets: ReferenceTargets) {
  /**
   * Walks the tree and rewrites text nodes.
   * @param {MdNode} node Current node.
   * @returns {void}
   */
  const visit = (node: MdNode) => {
    if (!node.children || SKIPPED.has(node.type)) return;
    node.children = node.children.flatMap((child) =>
      child.type === 'text' && child.value ? splitText(child.value, targets) : [child],
    );
    node.children.forEach(visit);
  };
  return () => visit;
}
