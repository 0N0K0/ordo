import { closestCenter, pointerWithin, type CollisionDetection } from '@dnd-kit/core';

/** Ids of the drag and drop: a folder or a document of the list, a folder of the tree (root: "tree:root"). */
export type DndKind = 'folder' | 'doc' | 'tree';

/**
 * Kind and id of a drag and drop id ("doc:abc").
 * @param {string | number} value Id.
 * @returns {{ kind: DndKind, id: string }} Kind and id.
 */
export function dndId(value: string | number): { kind: DndKind; id: string } {
  const [kind, ...rest] = String(value).split(':');
  return { kind: kind as DndKind, id: rest.join(':') };
}

/**
 * Where a dragged item goes: a folder of the tree under the pointer (moved into it); for a document, a folder of the
 * list under the pointer (moved into it); else the closest item of its own kind (reordered among them).
 * @param {Parameters<CollisionDetection>[0]} args Collision arguments.
 * @returns {ReturnType<CollisionDetection>} Collisions.
 */
export const libraryCollision: CollisionDetection = (args) => {
  const active = dndId(args.active.id).kind;
  const under = pointerWithin(args);
  const tree = under.filter((collision) => dndId(collision.id).kind === 'tree');
  if (tree.length) return tree;
  if (active === 'doc') {
    const folders = under.filter((collision) => dndId(collision.id).kind === 'folder');
    if (folders.length) return folders;
  }
  return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((container) => dndId(container.id).kind === active) });
};
