import { closestCenter, pointerWithin, type CollisionDetection, type DragMoveEvent, type DragOverEvent } from '@dnd-kit/core';
import { useState } from 'react';
import type { TreePlace } from './category-tree';

/**
 * Where a dragged row of a tree goes: the row under the pointer; with the keyboard, the closest.
 * @param {Parameters<CollisionDetection>[0]} args Collision arguments.
 * @returns {ReturnType<CollisionDetection>} Collisions.
 */
export const treeCollision: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length ? under : closestCenter(args);
};

/**
 * Where the dragged row would go on the row under the pointer: its top third before it, its bottom third after it,
 * the middle under it (with the keyboard: under it).
 * @param {DragMoveEvent | DragOverEvent} event Drag event.
 * @returns {{ id: string, place: TreePlace } | null} Row and place, null outside the rows.
 */
export function pointerPlace({ over, activatorEvent, delta }: DragMoveEvent | DragOverEvent): { id: string; place: TreePlace } | null {
  if (!over) return null;
  const pointer = 'clientY' in activatorEvent ? (activatorEvent as PointerEvent).clientY + delta.y : null;
  const ratio = pointer === null ? 0.5 : (pointer - over.rect.top) / Math.max(1, over.rect.height);
  return { id: String(over.id), place: ratio < 0.3 ? 'BEFORE' : ratio > 0.7 ? 'AFTER' : 'INSIDE' };
}

/**
 * Folded rows of a tree, remembered in this browser.
 * @param {string} [storageKey] Key of the tree; not remembered when omitted. Optional.
 * @returns {[ReadonlySet<string>, (id: string) => void]} Folded ids and their toggle.
 */
export function useFolded(storageKey?: string): [ReadonlySet<string>, (id: string) => void] {
  const key = storageKey ? `ordo:folded:${storageKey}` : null;
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => {
    if (!key) return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  /**
   * Folds or unfolds a row.
   * @param {string} id Row id.
   * @returns {void}
   */
  const toggle = (id: string) =>
    setFolded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      if (key) {
        try {
          localStorage.setItem(key, JSON.stringify([...next]));
        } catch {
          // Not remembered: it stays folded until the page is left.
        }
      }
      return next;
    });
  return [folded, toggle];
}
