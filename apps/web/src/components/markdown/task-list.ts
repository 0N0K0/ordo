/** Node of the markdown tree, as far as task items are concerned. */
interface TreeNode {
  type: string;
  checked?: boolean | null;
  position?: { start: { offset?: number } };
  data?: { hProperties?: Record<string, unknown> };
  children?: TreeNode[];
}

/**
 * Remark plugin: each task list item carries the offset of its start in the source (to toggle its box).
 * @returns {(tree: TreeNode) => void} Transformer.
 */
export function remarkTaskOffsets() {
  return (tree: TreeNode) => {
    const visit = (node: TreeNode) => {
      if (node.type === 'listItem' && typeof node.checked === 'boolean' && node.position?.start.offset !== undefined) {
        node.data = { ...node.data, hProperties: { ...node.data?.hProperties, dataTaskOffset: node.position.start.offset } };
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

/**
 * Source with the box of a task item toggled ("[ ]" ↔ "[x]").
 * @param {string} source Markdown.
 * @param {number} offset Start of the task item.
 * @returns {string} New markdown (unchanged when no box is found on its first line).
 */
export function toggleTask(source: string, offset: number): string {
  const lineEnd = source.indexOf('\n', offset);
  const line = source.slice(offset, lineEnd === -1 ? undefined : lineEnd);
  const match = /\[( |x|X)\]/.exec(line);
  if (!match) return source;
  const at = offset + match.index;
  return `${source.slice(0, at)}${match[1] === ' ' ? '[x]' : '[ ]'}${source.slice(at + 3)}`;
}
