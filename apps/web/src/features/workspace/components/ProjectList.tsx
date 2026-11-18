import { projectPath } from '../../../app/pages';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { ItemBadge } from '../../../components/items/ItemBadge';
import { ArchivedBadge } from '../../../components/feedback/ArchivedBadge';
import { Group, Paper, Text, UnstyledButton } from '@mantine/core';
import { mapById, lineageOf, MAX_PROJECT_DEPTH } from '@ordo/shared';

import { Link } from 'react-router';
import type { TreePlace } from '../../../components/tree/category-tree';
import { useFolded, useTreeDrop } from '../../../components/tree/tree-dnd';
import { ON_ERROR } from '../../../lib/notify';
import { useMoveProject, type Project, type ProjectStatus } from '../api';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { projectDepth, projectHeight } from '../lib/tree';
import classes from './ProjectList.module.css';

import treeRow from '../../../components/tree/tree-drop.module.css';
import { DragHandle } from '../../../components/dnd/DragHandle';
import { FoldButton } from '../../../components/actions/FoldButton';
import { unarchived } from '../../../lib/archive';

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
      className={`${treeRow.row} ${classes.row}`}
      data-first={first || undefined}
      data-drop={drop ?? undefined}
      data-dragging={isDragging || undefined}
      style={{ paddingLeft: `calc(var(--mantine-spacing-xs) + ${depth} * var(--mantine-spacing-lg))` }}
    >
      {project.archived ? (
        <span className={classes.space} />
      ) : (
        <DragHandle label={`Déplacer ${project.label}`} size="sm" activator={setActivatorNodeRef} attributes={attributes} listeners={listeners} dragging={isDragging} />
      )}
      {folded !== undefined ? <FoldButton expanded={!folded} item={project.label} onToggle={onToggle} /> : <span className={treeRow.caretSpace} />}
      <UnstyledButton component={Link} to={projectPath(project.id)} py="sm" px={4} style={{ flex: 1, minWidth: 0 }}>
        <Group gap="sm" wrap="nowrap">
          <ItemAvatar name={project.label} iconUrl={project.iconUrl} color={project.color ?? 'initials'} size="sm" radius={1000} />
          <Text size="sm" style={{ flex: 1, opacity: project.archived ? 'var(--onoko-muted-opacity)' : undefined }} truncate>
            {project.label}
          </Text>
          <ItemBadge item={status} />
          {project.archived && <ArchivedBadge />}
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
  const statusById = mapById(statuses);
  const moveProject = useMoveProject();
  const [folded, toggle] = useFolded(`projects-${rootParentId ?? clientId ?? 'none'}`);

  const byId = mapById(projects);
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
    // Not on itself nor one of its sub-projects.
    if (lineageOf(byId, target.id).some((current) => current.id === id)) return null;
    const parentId = place === 'INSIDE' ? target.id : target.parentId;
    if ((parentId ? projectDepth(allProjects, parentId) : 0) + projectHeight(allProjects, id) > MAX_PROJECT_DEPTH) return null;
    const siblings = unarchived(projects)
      .filter((project) => project.parentId === parentId)
      .sort(listOrder);
    const others = siblings.filter((project) => project.id !== id);
    const at = others.findIndex((project) => project.id === targetId);
    const index = place === 'INSIDE' ? others.length : place === 'BEFORE' ? at : at + 1;
    if (parentId === moved.parentId && siblings.findIndex((project) => project.id === id) === index) return null;
    return { parentId, index };
  };

  const { dropOn, dndProps } = useTreeDrop({
    fallback: 'INSIDE',
    destination,
    onDrop: (id, target) => moveProject.mutate({ id, parentId: target.parentId, clientId: target.parentId ? null : clientId, index: target.index }, ON_ERROR),
    taken: (id) => `${byId.get(id)?.label ?? 'Projet'} saisi.`,
    moved: 'Projet déplacé.',
  });

  return (
    <DndContext {...dndProps}>
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
            drop={dropOn(project.id)}
          />
        ))}
      </Paper>
    </DndContext>
  );
}
