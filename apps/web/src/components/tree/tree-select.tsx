import { Group, Text, type ComboboxItem, type ComboboxLikeRenderOptionInput, type OptionsFilter } from '@mantine/core';
import type { ReactNode } from 'react';
import { ItemAvatar } from '../settings/ItemAvatar';
import { hasAvatar } from '../settings/item-look';
import { normalize } from '../../lib/text';

/** Node of a tree offered in a select. */
export interface TreeNode {
  id: string;
  /** Parent node (null or unknown: top level). */
  parentId: string | null;
  label: string;
  /** Color shown before the label. Optional. */
  color?: string | null;
  /** Image shown as its avatar (with its color: its initials on it). Optional. */
  iconUrl?: string | null;
  /** A grouping of the list (« Sans client », « Sans projet »), left out of the paths of the nodes under it. Optional. */
  pathless?: boolean;
}

import { LEVEL } from '@ordo/shared';

/**
 * Option of a select of a tree: its full path as its label (shown once chosen, in pills, cells…), its own name indented
 * under its parent in the list.
 */
export interface TreeOption extends ComboboxItem {
  /** Name of the node alone. */
  name: string;
  /** 0 for the top level. */
  depth: number;
  /** Value of the parent option, null at the top level. */
  parent: string | null;
  color?: string | null;
  iconUrl?: string | null;
}

/**
 * Options of a tree, in tree order (each node followed by its children, in the order given): the offered nodes,
 * and their parents that are not offered, shown greyed out (not selectable) so the tree stays readable.
 * @param {readonly TreeNode[]} nodes Every node, siblings in their order.
 * @param {(id: string) => boolean} [offered] Whether a node can be selected; all when omitted. Optional.
 * @param {ReadonlySet<string>} [excluded] Nodes left out with their descendants (a node cannot be its own parent). Optional.
 * @returns {TreeOption[]} Options.
 */
export function treeOptions(nodes: readonly TreeNode[], offered: (id: string) => boolean = () => true, excluded: ReadonlySet<string> = new Set()): TreeOption[] {
  const ids = new Set(nodes.map((node) => node.id));
  const children = new Map<string | null, TreeNode[]>();
  for (const node of nodes) {
    const parent = node.parentId && ids.has(node.parentId) ? node.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), node]);
  }
  const options: TreeOption[] = [];
  /**
   * Adds the options of the children of a parent, recursively; true when one of them is offered.
   * @param {string | null} parent Parent id.
   * @param {number} depth Depth of the children.
   * @param {string[]} path Names of the parents, from the top.
   * @returns {boolean} Something offered below.
   */
  const visit = (parent: string | null, depth: number, path: string[]): boolean => {
    let any = false;
    for (const node of children.get(parent) ?? []) {
      if (excluded.has(node.id)) continue;
      const at = options.length;
      const selectable = offered(node.id);
      options.push({ value: node.id, label: [...path, node.label].join(LEVEL), name: node.label, depth, parent, color: node.color, iconUrl: node.iconUrl, ...(!selectable && { disabled: true }) });
      const below = visit(node.id, depth + 1, node.pathless ? path : [...path, node.label]);
      // A parent without anything to select below it is of no use.
      if (!selectable && !below) options.splice(at, 1);
      any ||= selectable || below;
    }
    return any;
  };
  visit(null, 0, []);
  return options;
}

/**
 * Props of a Select or MultiSelect of a tree: the options by their name, indented under their parent (their full path
 * once chosen), and a search of the names keeping the parents of the options found.
 * @param {TreeOption[]} options Options (from treeOptions).
 * @returns {{ data: TreeOption[], renderOption: (input: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode, filter: OptionsFilter }} Props.
 */
export function treeSelectProps(options: TreeOption[]): {
  data: TreeOption[];
  renderOption: (input: ComboboxLikeRenderOptionInput<ComboboxItem>) => ReactNode;
  filter: OptionsFilter;
} {
  const byValue = new Map(options.map((option) => [option.value, option]));
  return {
    data: options,
    renderOption: ({ option }) => {
      const tree = byValue.get(option.value);
      return (
        <Group gap="xs" wrap="nowrap" style={{ paddingLeft: `calc(${tree?.depth ?? 0} * var(--mantine-spacing-md))` }}>
          {tree && hasAvatar(tree) && <ItemAvatar name={tree.name} iconUrl={tree.iconUrl} color={tree.color} />}
          <Text size="sm" fw={option.disabled ? 600 : undefined} c={option.disabled ? 'dimmed' : undefined} truncate>
            {tree?.name ?? option.label}
          </Text>
        </Group>
      );
    },
    filter: ({ options: parsed, search, limit }) => {
      const query = normalize(search.trim());
      if (!query) return parsed.slice(0, limit);
      // Options found with what is under them (in tree order, a parent comes first), and their parents.
      const found = new Set<string>();
      for (const option of options) {
        if (normalize(option.name).includes(query) || (option.parent !== null && found.has(option.parent))) found.add(option.value);
      }
      const kept = new Set<string>();
      for (const value of found) {
        for (let current = byValue.get(value); current && !kept.has(current.value); current = current.parent ? byValue.get(current.parent) : undefined) kept.add(current.value);
      }
      return parsed
        .map((item) => ('items' in item ? { ...item, items: item.items.filter((option) => kept.has(option.value)) } : item))
        .filter((item) => ('items' in item ? item.items.length > 0 : kept.has(item.value)))
        .slice(0, limit);
    },
  };
}
