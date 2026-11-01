import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MAX_PROJECT_DEPTH } from '@ordo/shared';
import { useMemo, useState } from 'react';
import { notifyError } from '../../../lib/notify';
import { useMoveClient, useMoveProject, type Client, type Project } from '../api';
import { NO_CLIENT, type ProjectNode, type TreeSection } from '../tree';
import { NoClientRow } from './NoClientRow';
import { TreeRow } from './TreeRow';
import classes from './Tree.module.css';

/** Horizontal offset of one tree level, in px (matches the row indentation). */
const INDENT = 20;

type ItemKind = 'client' | 'none' | 'project';

/** One visible row of the flattened tree. */
interface FlatItem {
  /** Drag id: `client:<id>`, `none:none` or `project:<id>`. */
  id: string;
  kind: ItemKind;
  entityId: string;
  /** 0 for clients and "Sans client", 1 to MAX_PROJECT_DEPTH for projects. */
  depth: number;
  /** Drag id of the parent row (client, "Sans client" or project). */
  parentId: string | null;
  /** Levels of the sub-tree (projects only, 1 without children). */
  height: number;
  hasChildren: boolean;
}

interface Projection {
  depth: number;
  parentId: string;
}

/**
 * Height of a project sub-tree.
 * @param {ProjectNode} node Project node.
 * @returns {number} Levels, 1 without children.
 */
function nodeHeight(node: ProjectNode): number {
  return 1 + Math.max(0, ...node.children.map(nodeHeight));
}

/**
 * Flattens the visible part of the tree into ordered rows.
 * @param {TreeSection} section Active section.
 * @param {(key: string) => boolean} isExpanded Expand state by key (client id, "none" or `p:<projectId>`).
 * @param {boolean} showNone Whether to show the "Sans client" row even without orphans.
 * @returns {FlatItem[]} Rows.
 */
function flatten(section: TreeSection, isExpanded: (key: string) => boolean, showNone: boolean): FlatItem[] {
  const items: FlatItem[] = [];

  /**
   * Appends project rows recursively.
   * @param {ProjectNode[]} nodes Nodes.
   * @param {number} depth Depth of the nodes.
   * @param {string} parentId Drag id of their parent.
   * @returns {void}
   */
  const walk = (nodes: ProjectNode[], depth: number, parentId: string) => {
    for (const node of nodes) {
      const id = `project:${node.project.id}`;
      items.push({
        id,
        kind: 'project',
        entityId: node.project.id,
        depth,
        parentId,
        height: nodeHeight(node),
        hasChildren: node.children.length > 0,
      });
      if (isExpanded(`p:${node.project.id}`)) walk(node.children, depth + 1, id);
    }
  };

  for (const node of section.clients) {
    const id = `client:${node.client.id}`;
    items.push({
      id,
      kind: 'client',
      entityId: node.client.id,
      depth: 0,
      parentId: null,
      height: 0,
      hasChildren: node.projects.length > 0,
    });
    if (isExpanded(node.client.id)) walk(node.projects, 1, id);
  }
  if (section.orphans.length > 0 || showNone) {
    const id = `none:${NO_CLIENT}`;
    items.push({
      id,
      kind: 'none',
      entityId: NO_CLIENT,
      depth: 0,
      parentId: null,
      height: 0,
      hasChildren: section.orphans.length > 0,
    });
    if (isExpanded(NO_CLIENT)) walk(section.orphans, 1, id);
  }
  return items;
}

/**
 * Removes the rows nested under a row (they move with it).
 * @param {FlatItem[]} items Rows.
 * @param {string} id Drag id whose descendants are removed.
 * @returns {FlatItem[]} Remaining rows.
 */
function withoutDescendants(items: FlatItem[], id: string): FlatItem[] {
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
 * Computes where a dragged project would land: its depth from the horizontal offset, clamped by
 * the row above and the maximum depth, and the parent row at that depth.
 * @param {FlatItem[]} items Rows during the drag.
 * @param {string} activeId Dragged row.
 * @param {string} overId Hovered row.
 * @param {number} offsetX Horizontal drag offset in px.
 * @returns {Projection | null} Landing place, or null when invalid.
 */
function getProjection(items: FlatItem[], activeId: string, overId: string, offsetX: number): Projection | null {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);
  if (activeIndex < 0 || overIndex < 0) return null;
  const active = items[activeIndex];
  const moved = arrayMove(items, activeIndex, overIndex);
  const previous = moved[overIndex - 1];
  const next = moved[overIndex + 1];
  if (!previous) return null;

  const maxDepth = Math.min(previous.depth + 1, MAX_PROJECT_DEPTH - (active.height - 1));
  const minDepth = Math.min(next?.kind === 'project' ? next.depth : 1, maxDepth);
  const depth = Math.max(minDepth, Math.min(active.depth + Math.round(offsetX / INDENT), maxDepth));
  if (depth < 1) return null;

  for (let index = overIndex - 1; index >= 0; index -= 1) {
    if (moved[index].depth === depth - 1) return { depth, parentId: moved[index].id };
  }
  return null;
}

/**
 * Splits a drag id into its kind and entity id.
 * @param {string} dragId Drag id.
 * @returns {[ItemKind, string]} Kind and id.
 */
function parseId(dragId: string): [ItemKind, string] {
  const [kind, ...rest] = dragId.split(':');
  return [kind as ItemKind, rest.join(':')];
}

// Clients only meet clients and "Sans client"; projects meet every row.
const collisionDetection: CollisionDetection = (args) => {
  const draggingClient = String(args.active.id).startsWith('client:');
  return closestCenter({
    ...args,
    droppableContainers: draggingClient
      ? args.droppableContainers.filter((container) => !String(container.id).startsWith('project:'))
      : args.droppableContainers,
  });
};

/**
 * Swallows the click fired by releasing the pointer at the end of a drag (it would open the row's page).
 * @returns {void}
 */
function suppressClickAfterDrop(): void {
  const swallow = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener('click', swallow, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 100);
}

interface SortableRowProps {
  item: FlatItem;
  depth: number;
  client?: Client;
  project?: Project;
  dndEnabled: boolean;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * Draggable row of the flattened tree.
 * @param {SortableRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function SortableRow({ item, depth, client, project, dndEnabled, expanded, onToggle }: SortableRowProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !dndEnabled || item.kind === 'none',
  });
  const style = { transform: CSS.Translate.toString(transform), transition };

  if (item.kind === 'none') {
    return (
      <NoClientRow
        ref={setNodeRef}
        style={style}
        expanded={expanded}
        onToggle={onToggle}
        hasChildren={item.hasChildren}
        canAddProject
      />
    );
  }

  const entity = client ? ({ type: 'client', item: client } as const) : ({ type: 'project', item: project! } as const);
  return (
    <TreeRow
      ref={setNodeRef}
      entity={entity}
      depth={depth}
      expansion={item.hasChildren ? { expanded, onToggle } : undefined}
      draggable={dndEnabled}
      dragging={isDragging}
      style={style}
      {...attributes}
      {...listeners}
      tabIndex={-1}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={item.hasChildren ? expanded : undefined}
    />
  );
}

interface ActiveTreeProps {
  section: TreeSection;
  dndEnabled: boolean;
  isExpanded: (key: string) => boolean;
  onToggle: (key: string) => void;
}

/**
 * Active clients and project trees. Drag and drop reorders clients, and moves projects with their
 * sub-projects: vertically to choose the place, horizontally to choose the level.
 * @param {ActiveTreeProps} props Component props.
 * @returns {JSX.Element} Tree.
 */
export function ActiveTree({ section, dndEnabled, isExpanded, onToggle }: ActiveTreeProps) {
  const moveClient = useMoveClient();
  const moveProject = useMoveProject();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);

  const clientsById = useMemo(() => new Map(section.clients.map((node) => [node.client.id, node.client])), [section]);
  const projectsById = useMemo(() => {
    const map = new Map<string, Project>();
    const collect = (nodes: ProjectNode[]) =>
      nodes.forEach((node) => {
        map.set(node.project.id, node.project);
        collect(node.children);
      });
    section.clients.forEach((node) => collect(node.projects));
    collect(section.orphans);
    return map;
  }, [section]);

  const activeKind = activeId ? parseId(activeId)[0] : null;
  const items = useMemo(() => {
    const all = flatten(section, isExpanded, activeKind === 'project');
    if (activeKind === 'client') return all.filter((item) => item.kind !== 'project');
    if (activeKind === 'project' && activeId) return withoutDescendants(all, activeId);
    return all;
  }, [section, isExpanded, activeKind, activeId]);

  const projection =
    activeKind === 'project' && activeId && overId ? getProjection(items, activeId, overId, offsetX) : null;

  /**
   * Clears the drag state.
   * @returns {void}
   */
  const reset = () => {
    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
  };

  /**
   * Commits the move of a client or a project.
   * @param {DragEndEvent} event Drag event.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const currentProjection = projection;
    reset();
    suppressClickAfterDrop();
    if (!over) return;

    const dragId = String(active.id);
    const [kind, id] = parseId(dragId);
    const moved = arrayMove(
      items,
      items.findIndex((item) => item.id === dragId),
      items.findIndex((item) => item.id === over.id),
    );
    const onError = (error: Error) => notifyError(error.message);

    if (kind === 'client') {
      const index = moved.filter((item) => item.kind === 'client').findIndex((item) => item.id === dragId);
      if (index !== section.clients.findIndex((node) => node.client.id === id)) {
        moveClient.mutate({ id, index }, { onError });
      }
      return;
    }

    if (!currentProjection) return;
    const original = items.find((item) => item.id === dragId)!;
    const index = moved
      .filter((item) => item.id === dragId || item.parentId === currentProjection.parentId)
      .findIndex((item) => item.id === dragId);
    const originalIndex = items
      .filter((item) => item.parentId === original.parentId)
      .findIndex((item) => item.id === dragId);
    if (currentProjection.parentId === original.parentId && index === originalIndex) return;

    const [parentKind, parentEntityId] = parseId(currentProjection.parentId);
    moveProject.mutate(
      {
        id,
        parentId: parentKind === 'project' ? parentEntityId : null,
        clientId: parentKind === 'client' ? parentEntityId : null,
        index,
      },
      { onError },
    );
  };

  const [overlayKind, overlayEntityId] = activeId ? parseId(activeId) : [null, null];
  const overlayClient = overlayKind === 'client' ? clientsById.get(overlayEntityId!) : undefined;
  const overlayProject = overlayKind === 'project' ? projectsById.get(overlayEntityId!) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={({ active }: DragStartEvent) => {
        setActiveId(String(active.id));
        setOverId(String(active.id));
      }}
      onDragMove={({ delta }: DragMoveEvent) => setOffsetX(delta.x)}
      onDragOver={({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        reset();
        suppressClickAfterDrop();
      }}
    >
      <div role="tree" aria-label="Clients et projets">
        <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => {
            const expandKey = item.kind === 'project' ? `p:${item.entityId}` : item.entityId;
            return (
              <SortableRow
                key={item.id}
                item={item}
                depth={item.id === activeId && projection ? projection.depth : item.depth}
                client={item.kind === 'client' ? clientsById.get(item.entityId) : undefined}
                project={item.kind === 'project' ? projectsById.get(item.entityId) : undefined}
                dndEnabled={dndEnabled}
                expanded={isExpanded(expandKey)}
                onToggle={() => onToggle(expandKey)}
              />
            );
          })}
        </SortableContext>
      </div>

      <DragOverlay dropAnimation={null}>
        {overlayClient && <TreeRow entity={{ type: 'client', item: overlayClient }} className={classes.overlay} />}
        {overlayProject && <TreeRow entity={{ type: 'project', item: overlayProject }} className={classes.overlay} />}
      </DragOverlay>
    </DndContext>
  );
}
