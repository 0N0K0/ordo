import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragOverEvent } from '@dnd-kit/core';
import { ActionIcon, Badge, Group, Paper, Text, UnstyledButton } from '@mantine/core';
import { MAX_PROJECT_DEPTH } from '@ordo/shared';
import { CaretDownIcon, CaretRightIcon, DotsSixVerticalIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { TreePlace } from '../../../components/category-tree/category-tree';
import { pointerPlace, treeCollision, useFolded } from '../../../components/category-tree/tree-dnd';
import { notifyError } from '../../../lib/notify';
import { useMoveProject, type Project, type ProjectStatus } from '../api';
import { EntityAvatar } from '../EntityAvatar';
import { projectDepth, projectHeight } from '../tree';
import classes from './ProjectList.module.css';

interface ProjectListProps {
  projects: Project[];
  /** All the projects of the workspace (depth of the parents). */
  allProjects: Project[];
  /** Id of the parent of the top-level rows (null: root projects). */
  rootParentId: string | null;
  /** Client of the top-level rows when they are root projects. */
  clientId: string | null;
  statuses: ProjectStatus[];
}

/**
 * Order of sibling projects in the list: active first, then manual order.
 * @param {Project} a Project.
 * @param {Project} b Project.
 * @returns {number} Comparison.
 */
const listOrder = (a: Project, b: Project) => Number(a.archived) - Number(b.archived) || a.position - b.position;

interface ProjectRowProps {
  project: Project;
  depth: number;
  status: ProjectStatus | undefined;
  first: boolean;
  /** Its sub-projects are folded (undefined: it has none). */
  folded: boolean | undefined;
  onToggle: () => void;
  drop: TreePlace | null;
}

/**
 * Row of a project: opens it; moved by its handle (active projects), folds its sub-projects.
 * @param {ProjectRowProps} props Component props.
 * @returns {JSX.Element} Row.
 */
function ProjectRow({ project, depth, status, first, folded, onToggle, drop }: ProjectRowProps) {
  const { setNodeRef: setDragRef, setActivatorNodeRef, attributes, listeners, isDragging } = useDraggable({ id: project.id, disabled: project.archived });
  const { setNodeRef: setDropRef } = useDroppable({ id: project.id, disabled: project.archived });
  return (
    <Group
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      gap={4}
      wrap="nowrap"
      px="xs"
      className={classes.row}
      data-first={first || undefined}
      data-drop={drop ?? undefined}
      data-dragging={isDragging || undefined}
      style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${depth} * var(--mantine-spacing-lg))` }}
    >
      {project.archived ? (
        <span className={classes.space} />
      ) : (
        <ActionIcon ref={setActivatorNodeRef} variant="subtle" color="gray" size="sm" aria-label={`Déplacer ${project.title}`} className={classes.handle} {...attributes} {...listeners}>
          <DotsSixVerticalIcon weight="bold" aria-hidden />
        </ActionIcon>
      )}
      {folded !== undefined ? (
        <ActionIcon variant="subtle" color="gray" size="xs" aria-label={`${folded ? 'Déplier' : 'Replier'} ${project.title}`} aria-expanded={!folded} onClick={onToggle}>
          {folded ? <CaretRightIcon aria-hidden /> : <CaretDownIcon aria-hidden />}
        </ActionIcon>
      ) : (
        <span className={classes.caretSpace} />
      )}
      <UnstyledButton component={Link} to={`/projects/${project.id}`} py="sm" px={4} style={{ flex: 1, minWidth: 0 }}>
        <Group gap="sm" wrap="nowrap">
          <EntityAvatar name={project.title} iconUrl={project.iconUrl} color={project.color} size="sm" />
          <Text size="sm" style={{ flex: 1 }} opacity={project.archived ? 0.6 : 1} truncate>
            {project.title}
          </Text>
          {status && (
            <Badge variant="light" color={status.color}>
              {status.name}
            </Badge>
          )}
          {project.archived && (
            <Badge variant="light" color="gray">
              Archivé
            </Badge>
          )}
        </Group>
      </UnstyledButton>
    </Group>
  );
}

/**
 * Bordered list of projects with their sub-projects indented (active first, then archived): each project folds its
 * sub-projects; active ones move by drag and drop before, after or under another one (top of a row: before, bottom:
 * after, middle: under it, last), within the depth limit.
 * @param {ProjectListProps} props Component props.
 * @returns {JSX.Element} List.
 */
export function ProjectList({ projects, allProjects, rootParentId, clientId, statuses }: ProjectListProps) {
  const statusById = new Map(statuses.map((status) => [status.id, status]));
  const moveProject = useMoveProject();
  const [folded, toggle] = useFolded(`projects-${rootParentId ?? clientId ?? 'none'}`);
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; place: TreePlace } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));

  const byId = new Map(projects.map((project) => [project.id, project]));
  const rows: { project: Project; depth: number; parent: boolean }[] = [];

  /**
   * Appends the children of a parent, recursively (not those of a folded project).
   * @param {string | null} parentId Parent id.
   * @param {number} depth Depth of the children.
   * @returns {void}
   */
  const walk = (parentId: string | null, depth: number) => {
    projects
      .filter((project) => project.parentId === parentId)
      .sort(listOrder)
      .forEach((project) => {
        const parent = projects.some((item) => item.parentId === project.id);
        rows.push({ project, depth, parent });
        if (!folded.has(project.id)) walk(project.id, depth + 1);
      });
  };
  walk(rootParentId, 0);

  /**
   * Parent and index among its new active siblings of a project dropped on another one; null when not allowed (on
   * itself, one of its sub-projects or an archived one, too deep) or when it changes nothing.
   * @param {string} id Dragged project.
   * @param {string} targetId Project dropped on.
   * @param {TreePlace} place Where.
   * @returns {{ parentId: string | null, index: number } | null} Destination.
   */
  const destination = (id: string, targetId: string, place: TreePlace) => {
    const moved = byId.get(id);
    const target = byId.get(targetId);
    if (!moved || !target || target.archived) return null;
    for (let current: Project | undefined = target; current; current = current.parentId ? byId.get(current.parentId) : undefined) {
      if (current.id === id) return null;
    }
    const parentId = place === 'INSIDE' ? target.id : target.parentId;
    if ((parentId ? projectDepth(allProjects, parentId) : 0) + projectHeight(allProjects, id) > MAX_PROJECT_DEPTH) return null;
    const siblings = projects.filter((project) => !project.archived && project.parentId === parentId).sort(listOrder);
    const others = siblings.filter((project) => project.id !== id);
    const at = others.findIndex((project) => project.id === targetId);
    const index = place === 'INSIDE' ? others.length : place === 'BEFORE' ? at : at + 1;
    if (parentId === moved.parentId && siblings.findIndex((project) => project.id === id) === index) return null;
    return { parentId, index };
  };

  /**
   * Updates where the dragged project would go.
   * @param {DragMoveEvent | DragOverEvent} event Drag event.
   * @returns {void}
   */
  const handleDragMove = (event: DragMoveEvent | DragOverEvent) => {
    const next = pointerPlace(event);
    setDrop((current) => (current?.id === next?.id && current?.place === next?.place ? current : next));
  };

  /**
   * Moves the dropped project where the pointer shows.
   * @param {DragEndEvent} event Drop.
   * @returns {void}
   */
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const place = drop?.place ?? 'INSIDE';
    setDragged(null);
    setDrop(null);
    if (!over) return;
    const target = destination(String(active.id), String(over.id), place);
    if (!target) return;
    moveProject.mutate({ id: String(active.id), parentId: target.parentId, clientId: target.parentId ? null : clientId, index: target.index }, { onError: (error) => notifyError(error.message) });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={treeCollision}
      onDragStart={({ active }) => setDragged(String(active.id))}
      onDragMove={handleDragMove}
      onDragOver={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDragged(null);
        setDrop(null);
      }}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `${byId.get(String(active.id))?.title ?? 'Projet'} saisi.`,
          onDragOver: () => undefined,
          onDragMove: () => undefined,
          onDragEnd: ({ over }) => (over ? 'Projet déplacé.' : 'Déplacement annulé.'),
          onDragCancel: () => 'Déplacement annulé.',
        },
      }}
    >
      <Paper withBorder radius="md">
        {rows.map(({ project, depth, parent }, index) => (
          <ProjectRow
            key={project.id}
            project={project}
            depth={depth}
            status={project.statusId ? statusById.get(project.statusId) : undefined}
            first={index === 0}
            folded={parent ? folded.has(project.id) : undefined}
            onToggle={() => toggle(project.id)}
            drop={dragged !== null && drop?.id === project.id && destination(dragged, project.id, drop.place) ? drop.place : null}
          />
        ))}
      </Paper>
    </DndContext>
  );
}
