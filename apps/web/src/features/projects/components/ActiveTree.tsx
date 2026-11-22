import { dropProjection, withoutDescendants } from '../../../components/tree/tree-dnd';
import { closestCenter, DndContext, DragOverlay, type CollisionDetection, type DragEndEvent, type DragMoveEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { MAX_PROJECT_DEPTH } from '@ordo/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { ON_ERROR } from '../../../lib/notify';
import { useMoveClient, useMoveProject, type Client, type Project } from '../api';
import { NO_CLIENT, type ProjectNode, type TreeSection } from '../lib/tree';
import { SidebarSection, type SidebarSectionChrome } from './SidebarSection';
import { TreeRow } from './TreeRow';
import classes from './Tree.module.css';
import { suppressClickAfterDrop, useDragSensors } from '../../../components/dnd/drag';
import { sortableStyle } from '../../../components/dnd/sortable-style';
import { CSS } from '@dnd-kit/utilities';
import { taggedKey, parseTaggedKey } from '../../../lib/tagged-key';

type ItemKind = 'client' | 'none' | 'project';

/** One visible row of the flattened tree. */
interface FlatItem {
  /** Drag id: `client:<id>`, `none:none` or `project:<id>`. */
  id: string;
  kind: ItemKind;
  entityId: string;
  /** 0 for clients and the root of the projects without client, 1 to MAX_PROJECT_DEPTH for projects. */
  depth: number;
  /** Drag id of the parent row (client, root of the projects without client, or project). */
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

/** Which parts of the main tree a flattening keeps. */
interface FlattenParts {
  /** The client rows and their projects (their section open, or nothing dragged). */
  clients: boolean;
  /** The root of the projects without client (their section shown). */
  none: boolean;
  /** The projects without client (their section open, or nothing dragged). */
  orphans: boolean;
}

/**
 * Flattens the visible part of the tree into ordered rows.
 * @param {TreeSection} section Active section.
 * @param {(key: string) => boolean} isExpanded Expand state by key (client id or `p:<projectId>`).
 * @param {FlattenParts} parts Parts kept.
 * @returns {FlatItem[]} Rows.
 */
function flatten(section: TreeSection, isExpanded: (key: string) => boolean, parts: FlattenParts): FlatItem[] {
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
      const id = taggedKey('project', node.project.id);
      items.push({
        id,
        kind: 'project',
        entityId: node.project.id,
        depth,
        parentId,
        height: nodeHeight(node),
        hasChildren: node.children.length > 0,
      });
      if (isExpanded(taggedKey('p', node.project.id))) walk(node.children, depth + 1, id);
    }
  };

  if (parts.clients) {
    for (const node of section.clients) {
      const id = taggedKey('client', node.client.id);
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
  }
  if (parts.none) {
    const id = taggedKey('none', NO_CLIENT);
    items.push({
      id,
      kind: 'none',
      entityId: NO_CLIENT,
      depth: 0,
      parentId: null,
      height: 0,
      hasChildren: section.orphans.length > 0,
    });
    if (parts.orphans) walk(section.orphans, 1, id);
  }
  return items;
}

/**
 * Rows under the root of the projects without client, the root included (shown one level less indented, straight in
 * their section). Rows come after their parent, so one pass is enough.
 * @param {FlatItem[]} items Rows.
 * @returns {Set<string>} Drag ids.
 */
function noClientRows(items: FlatItem[]): Set<string> {
  const rows = new Set<string>();
  for (const item of items) {
    if (item.kind === 'none' || (item.parentId !== null && rows.has(item.parentId))) rows.add(item.id);
  }
  return rows;
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
  const projection = dropProjection(items, activeId, overId, offsetX, (active, previous, next) => {
    if (!previous) return null;
    const max = Math.min(previous.depth + 1, MAX_PROJECT_DEPTH - (active.height - 1));
    return { min: Math.min(next?.kind === 'project' ? next.depth : 1, max), max };
  });
  return projection && projection.parentId !== null && projection.depth >= 1 ? { depth: projection.depth, parentId: projection.parentId } : null;
}

/**
 * Splits a drag id into its kind and entity id.
 * @param {string} dragId Drag id.
 * @returns {[ItemKind, string]} Kind and id.
 */
function parseId(dragId: string): [ItemKind, string] {
  const { tag, id } = parseTaggedKey(dragId) ?? { tag: '', id: dragId };
  return [tag as ItemKind, id];
}

// Clients only meet clients and the header of the projects without client; projects meet every row.
const collisionDetection: CollisionDetection = (args) => {
  const draggingClient = parseId(String(args.active.id))[0] === 'client';
  return closestCenter({
    ...args,
    droppableContainers: draggingClient ? args.droppableContainers.filter((container) => parseId(String(container.id))[0] !== 'project') : args.droppableContainers,
  });
};

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
 * Draggable row of the flattened tree (a client or a project).
 * @param {SortableRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function SortableRow({ item, depth, client, project, dndEnabled, expanded, onToggle }: SortableRowProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !dndEnabled });
  const style = sortableStyle({ transform, transition, isDragging });
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

interface NoClientRootProps {
  /** Section of the projects without client, or null for the projects straight in the sidebar. */
  chrome: SidebarSectionChrome | null;
  children: ReactNode;
}

/**
 * Root of the projects without client, never dragged: the header of their « Projets » section (a drop target), or an
 * empty mark above them when they show straight in the sidebar (no target).
 * @param {NoClientRootProps} props Component props.
 * @returns {JSX.Element} Section or projects.
 */
function NoClientRoot({ chrome, children }: NoClientRootProps) {
  const { setNodeRef, transform, transition } = useSortable({ id: taggedKey('none', NO_CLIENT), disabled: { draggable: true, droppable: !chrome } });
  if (!chrome) {
    return (
      <>
        <div ref={setNodeRef} aria-hidden />
        {children}
      </>
    );
  }
  return (
    <SidebarSection {...chrome} headerRef={setNodeRef} headerStyle={{ transform: CSS.Translate.toString(transform), transition }}>
      {children}
    </SidebarSection>
  );
}

interface ActiveTreeProps {
  section: TreeSection;
  dndEnabled: boolean;
  isExpanded: (key: string) => boolean;
  onToggle: (key: string) => void;
  /** Section of the clients and their projects; none in a personal workspace. Optional. */
  clients?: SidebarSectionChrome;
  /** Shown in the clients section without any client. Optional. */
  clientsEmpty?: ReactNode;
  /** Section of the projects without client, or null for them straight in the sidebar. */
  projects: SidebarSectionChrome | null;
  /**
   * Shown instead of the projects without client when there are none. Without it, their section only shows with
   * projects, or while a project is dragged. Optional.
   */
  projectsEmpty?: ReactNode;
}

/**
 * Active clients and project trees, in their sections: the clients with their projects, then the projects without
 * client. Drag and drop reorders clients, and moves projects with their sub-projects: vertically to choose the place
 * (on a client: attached to it; among the projects without client: detached from its client), horizontally to
 * choose the level.
 * @param {ActiveTreeProps} props Component props.
 * @returns {JSX.Element} Sections.
 */
export function ActiveTree({ section, dndEnabled, isExpanded, onToggle, clients, clientsEmpty, projects, projectsEmpty }: ActiveTreeProps) {
  const moveClient = useMoveClient();
  const moveProject = useMoveProject();
  const sensors = useDragSensors();
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
  const dragging = activeId !== null;
  const showProjects = section.orphans.length > 0 || projectsEmpty !== undefined || activeKind === 'project';
  const clientsOpened = clients?.opened ?? true;
  const projectsOpened = projects?.opened ?? true;
  const items = useMemo(() => {
    // While dragging, the rows of a folded section are no place to drop on.
    const all = flatten(section, isExpanded, { clients: clientsOpened || !dragging, none: showProjects, orphans: projectsOpened || !dragging });
    if (activeKind === 'client') return all.filter((item) => item.kind !== 'project');
    if (activeKind === 'project' && activeId) return withoutDescendants(all, activeId);
    return all;
  }, [section, isExpanded, activeKind, activeId, dragging, showProjects, clientsOpened, projectsOpened]);
  const underRoot = useMemo(() => noClientRows(items), [items]);

  const projection = activeKind === 'project' && activeId && overId ? getProjection(items, activeId, overId, offsetX) : null;

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

    if (kind === 'client') {
      const index = moved.filter((item) => item.kind === 'client').findIndex((item) => item.id === dragId);
      if (index !== section.clients.findIndex((node) => node.client.id === id)) {
        moveClient.mutate({ id, index }, ON_ERROR);
      }
      return;
    }

    if (!currentProjection) return;
    const original = items.find((item) => item.id === dragId)!;
    const index = moved.filter((item) => item.id === dragId || item.parentId === currentProjection.parentId).findIndex((item) => item.id === dragId);
    const originalIndex = items.filter((item) => item.parentId === original.parentId).findIndex((item) => item.id === dragId);
    if (currentProjection.parentId === original.parentId && index === originalIndex) return;

    const [parentKind, parentEntityId] = parseId(currentProjection.parentId);
    moveProject.mutate(
      {
        id,
        parentId: parentKind === 'project' ? parentEntityId : null,
        clientId: parentKind === 'client' ? parentEntityId : null,
        index,
      },
      ON_ERROR,
    );
  };

  const [overlayKind, overlayEntityId] = activeId ? parseId(activeId) : [null, null];
  const overlayClient = overlayKind === 'client' ? clientsById.get(overlayEntityId!) : undefined;
  const overlayProject = overlayKind === 'project' ? projectsById.get(overlayEntityId!) : undefined;

  /**
   * Row of a client or a project; the projects without client one level less indented, straight in their section.
   * @param {FlatItem} item Row.
   * @returns {JSX.Element} Row.
   */
  const renderRow = (item: FlatItem) => {
    const expandKey = item.kind === 'project' ? taggedKey('p', item.entityId) : item.entityId;
    const [depth, parentId] = item.id === activeId && projection ? [projection.depth, projection.parentId] : [item.depth, item.parentId];
    const shownDepth = depth - Number(parentId !== null && underRoot.has(parentId));
    return (
      <SortableRow
        key={item.id}
        item={item}
        depth={shownDepth}
        client={item.kind === 'client' ? clientsById.get(item.entityId) : undefined}
        project={item.kind === 'project' ? projectsById.get(item.entityId) : undefined}
        dndEnabled={dndEnabled}
        expanded={isExpanded(expandKey)}
        onToggle={() => onToggle(expandKey)}
      />
    );
  };
  const rootIndex = items.findIndex((item) => item.kind === 'none');
  const clientRows = rootIndex < 0 ? items : items.slice(0, rootIndex);
  const orphanRows = rootIndex < 0 ? [] : items.slice(rootIndex + 1);

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
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        {clients && (
          <SidebarSection {...clients}>
            {section.clients.length > 0 ? (
              <div role="tree" aria-label="Clients et leurs projets">
                {clientRows.map(renderRow)}
              </div>
            ) : (
              clientsEmpty
            )}
          </SidebarSection>
        )}
        {showProjects && (
          <NoClientRoot chrome={projects}>
            {orphanRows.length > 0 || dragging ? (
              <div role="tree" aria-label={clients ? 'Projets sans client' : 'Projets'}>
                {orphanRows.map(renderRow)}
              </div>
            ) : (
              projectsEmpty
            )}
          </NoClientRoot>
        )}
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {overlayClient && <TreeRow entity={{ type: 'client', item: overlayClient }} className={classes.overlay} />}
        {overlayProject && <TreeRow entity={{ type: 'project', item: overlayProject }} className={classes.overlay} />}
      </DragOverlay>
    </DndContext>
  );
}
