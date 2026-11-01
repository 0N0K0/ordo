import { createContext, useContext } from 'react';
import type { EntityRef } from '../use-entity-actions';

/** Fold / unfold actions of the tree a row belongs to. */
export interface TreeExpansion {
  /** Whether the node has children in this tree. */
  hasChildren: (entity: EntityRef) => boolean;
  /** Expands or collapses the node and all its descendants. */
  setSubtreeExpanded: (entity: EntityRef, expanded: boolean) => void;
}

export const TreeExpansionContext = createContext<TreeExpansion | null>(null);

/**
 * Fold / unfold actions of the enclosing tree, or null outside a tree (e.g. drag overlay).
 * @returns {TreeExpansion | null} Actions.
 */
export function useTreeExpansion(): TreeExpansion | null {
  return useContext(TreeExpansionContext);
}
