import { closestCenter, pointerWithin, type CollisionDetection, type DndContextProps, type DragMoveEvent, type DragOverEvent } from '@dnd-kit/core';
import { useDragSensors } from '../../lib/drag';
import { arrayMove } from '@dnd-kit/sortable';
import { useState } from 'react';
import type { TreePlace } from './category-tree';

/**
 * Where a dragged row of a tree goes: the row under the pointer; with the keyboard, the closest.
 * @param {Parameters<CollisionDetection>[0]} args Collision arguments.
 * @returns {ReturnType<CollisionDetection>} Collisions.
 */
const treeCollision: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length ? under : closestCenter(args);
};

/**
 * Where the dragged row would go on the row under the pointer: its top third before it, its bottom third after it,
 * the middle under it (with the keyboard: under it).
 * @param {DragMoveEvent | DragOverEvent} event Drag event.
 * @param {boolean} [nested] Rows can be put under another (a tree). Optional. Default = true.
 * @returns {{ id: string, place: TreePlace } | null} Row and place, null outside the rows.
 */
function pointerPlace({ over, activatorEvent, delta }: DragMoveEvent | DragOverEvent, nested = true): { id: string; place: TreePlace } | null {
  if (!over) return null;
  const pointer = 'clientY' in activatorEvent ? (activatorEvent as PointerEvent).clientY + delta.y : null;
  const ratio = pointer === null ? 0.5 : (pointer - over.rect.top) / Math.max(1, over.rect.height);
  // A flat list: before or after, by the half of the row.
  if (!nested) return { id: String(over.id), place: ratio < 0.5 ? 'BEFORE' : 'AFTER' };
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

/** Row of a tree shown flat while dragged: its id, its parent row and its depth. */
interface FlatRow {
  id: string;
  parentId: string | null;
  depth: number;
}

/** Indent of a level of a tree dragged, in px: a horizontal move this long changes the level by one. */
const DRAG_INDENT = 20;

/**
 * Removes the rows nested under a dragged row (they move with it).
 * @param {readonly T[]} items Rows, in order.
 * @param {string} id Row whose descendants are removed.
 * @returns {T[]} Remaining rows.
 */
export function withoutDescendants<T extends FlatRow>(items: readonly T[], id: string): T[] {
  const removed = new Set([id]);
  return items.filter((item) => {
    if (item.parentId && removed.has(item.parentId)) {
      removed.add(item.id);
      return false;
    }
    return true;
  });
}

/**
 * Where a dragged row would land in a flat tree: the place from the hovered row, the level from the horizontal offset,
 * kept within the bounds the tree allows next to the rows around (at most one level below the row above…).
 * @param {readonly T[]} items Rows during the drag.
 * @param {string} activeId Dragged row.
 * @param {string} overId Hovered row.
 * @param {number} offsetX Horizontal drag offset in px.
 * @param {(active: T, previous: T | undefined, next: T | undefined) => { min: number, max: number } | null} bounds Levels allowed between the rows around (null: no place).
 * @returns {{ depth: number, parentId: string | null } | null} Level and parent row, or null when invalid.
 */
export function dropProjection<T extends FlatRow>(
  items: readonly T[],
  activeId: string,
  overId: string,
  offsetX: number,
  bounds: (active: T, previous: T | undefined, next: T | undefined) => { min: number; max: number } | null,
): { depth: number; parentId: string | null } | null {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);
  if (activeIndex < 0 || overIndex < 0) return null;
  const active = items[activeIndex];
  const moved = arrayMove([...items], activeIndex, overIndex);
  const allowed = bounds(active, moved[overIndex - 1], moved[overIndex + 1]);
  if (!allowed) return null;
  const depth = Math.max(allowed.min, Math.min(active.depth + Math.round(offsetX / DRAG_INDENT), allowed.max));
  if (depth === 0) return { depth, parentId: null };
  for (let index = overIndex - 1; index >= 0; index -= 1) {
    if (moved[index].depth === depth - 1) return { depth, parentId: moved[index].id };
  }
  return null;
}

/** Destination of a row dropped in a tree: its new parent and its index among its siblings. */
interface TreeDestination {
  parentId: string | null;
  index: number;
}

/** What `useTreeDrop` takes. */
interface TreeDropOptions {
  /** Rows can go under another one (else only before or after). Optional. Default = true. */
  nested?: boolean;
  /** Where a row dropped without a place goes. */
  fallback: TreePlace;
  /** Destination of a row dropped on another, null when refused (or changing nothing). */
  destination: (id: string, targetId: string, place: TreePlace) => TreeDestination | null;
  /** Moves the row dropped. */
  onDrop: (id: string, destination: TreeDestination) => void;
  /** Announced when a row is taken (« Ménage saisie. »). */
  taken: (id: string) => string;
  /** Announced when a row is dropped (« Catégorie déplacée. »). */
  moved: string;
}

/**
 * Drag and drop of the rows of a tree (before, after or under another one), the same in every tree: the props of its
 * `DndContext` (sensors, collisions, announcements), the row dragged, and where a row shows the drop.
 * @param {TreeDropOptions} options Options.
 * @returns {{ dragged: string | null, dropOn: (id: string) => TreePlace | null, dndProps: DndContextProps }} Drag state.
 */
export function useTreeDrop({ nested = true, fallback, destination, onDrop, taken, moved }: TreeDropOptions) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; place: TreePlace } | null>(null);
  const sensors = useDragSensors('plain');
  /**
   * Updates where the dragged row would go.
   * @param {DragMoveEvent | DragOverEvent} event Drag event.
   * @returns {void}
   */
  const handleDragMove = (event: DragMoveEvent | DragOverEvent) => {
    const next = pointerPlace(event, nested);
    setDrop((current) => (current?.id === next?.id && current?.place === next?.place ? current : next));
  };
  /**
   * Ends the drag.
   * @returns {void}
   */
  const reset = () => {
    setDragged(null);
    setDrop(null);
  };
  const dndProps: DndContextProps = {
    sensors,
    collisionDetection: treeCollision,
    onDragStart: ({ active }) => setDragged(String(active.id)),
    onDragMove: handleDragMove,
    onDragOver: handleDragMove,
    onDragEnd: ({ active, over }) => {
      const place = drop?.place ?? fallback;
      reset();
      if (!over) return;
      const target = destination(String(active.id), String(over.id), place);
      if (target) onDrop(String(active.id), target);
    },
    onDragCancel: reset,
    accessibility: {
      announcements: {
        onDragStart: ({ active }) => taken(String(active.id)),
        onDragOver: () => undefined,
        onDragMove: () => undefined,
        onDragEnd: ({ over }) => (over ? moved : 'Déplacement annulé.'),
        onDragCancel: () => 'Déplacement annulé.',
      },
    },
  };
  return {
    dragged,
    /** Place of the drop shown on a row, when allowed. */
    dropOn: (id: string): TreePlace | null => (dragged !== null && drop?.id === id && destination(dragged, id, drop.place) ? drop.place : null),
    dndProps,
  };
}
