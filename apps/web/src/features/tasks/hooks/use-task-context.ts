import { mapById, byPosition, LEVEL, lineageOf, taskNumbered, taskRef } from '@ordo/shared';
import { useMemo } from 'react';
import type { MarkdownSuggestions } from '../../../components/markdown/MarkdownEditor';
import type { ReferenceTargets, ReferenceTask } from '../../../components/markdown/remark-references';
import { useProjectTree, type Project } from '../../projects/api';
import { treeOptions, type TreeOption } from '../../../components/tree/tree-select';
import { projectFullPath, projectNodes, projectOptions } from '../../projects/lib/tree';
import { useMe } from '../../auth/api';
import { unarchived } from '../../../lib/archive';
import { sortMilestones, useMilestoneOrder, type MilestoneOrder } from '../lib/milestone-order';
import { useTasksData, type Contributor, type Milestone, type Sprint, type Task, type TaskLabel, type TaskStatus } from '../api';
import { personName } from '../../../components/people/people-options';
import { referenceTargets } from '../../../components/markdown/remark-references';

export interface TaskContext {
  tasks: Task[];
  contributors: Contributor[];
  statuses: TaskStatus[];
  priorities: TaskLabel[];
  types: TaskLabel[];
  /** Tags, several per task. */
  tags: TaskLabel[];
  projects: Project[];
  /** Milestones, in the order chosen by the user. */
  milestones: Milestone[];
  /** Order chosen by the user for the milestones. */
  milestoneOrder: MilestoneOrder;
  /** Rank of a milestone in the chosen order (to sort and group tasks by milestone). */
  milestoneRank: Map<string, number>;
  milestoneById: Map<string, Milestone>;
  /** Sprints, by start date. */
  sprints: Sprint[];
  sprintById: Map<string, Sprint>;
  /** Contributor profile of the logged-in user ("Moi"). */
  meId: string | null;
  taskById: Map<string, Task>;
  /**
   * Label of a task, its full path: "#3 Parent › #12 Titre" in its own project, "Client › Projet › #3 Parent › #12 Titre"
   * seen from elsewhere (its number is only unique in its project), "Titre" alone for a task of no project.
   */
  taskLabel: (task: Task, fromProjectId?: string | null) => string;
  /** Full path of a milestone: "Client › Projet › Jalon". */
  milestoneLabel: (milestone: { projectId: string; label: string }) => string;
  /** Full path of a sprint: "Client › Projet › Sprint". */
  sprintLabel: (sprint: { projectId: string; label: string }) => string;
  statusById: Map<string, TaskStatus>;
  priorityById: Map<string, TaskLabel>;
  typeById: Map<string, TaskLabel>;
  tagById: Map<string, TaskLabel>;
  contributorById: Map<string, Contributor>;
  projectById: Map<string, Project>;
  /** "Client › Parent › Projet"; "Sans projet" for none. */
  projectLabel: (projectId: string | null) => string;
  /** Options of a select of projects, in tree order under their client. */
  projectOptions: (projects: Project[]) => TreeOption[];
  /** Options of a select of tasks ("#12 Titre"), in tree order under their parent task, project and client. */
  taskOptions: (tasks: Task[]) => TreeOption[];
  /** Root project of a project: links stay inside the same tree (null: the tasks of no project, a tree of their own). */
  rootOf: (projectId: string | null) => string | null;
  /** Sub-tasks of a task, in manual order. */
  childrenOf: (taskId: string) => Task[];
  /**
   * Milestones usable by the tasks of a project: those of its whole project tree (none without project), the archived
   * ones left out except the `keep` one(s) (current value).
   */
  milestonesFor: (projectId: string | null, keep?: string | readonly (string | null)[] | null) => Milestone[];
  /**
   * Sprints usable by the tasks of a project: those of its whole project tree (none without project), the archived
   * ones left out except the `keep` ones (current values).
   */
  sprintsFor: (projectId: string | null, keep?: readonly string[]) => Sprint[];
  /**
   * Contributors that can be assigned to items of all these projects at once: "Moi" and those attached to each
   * project or to one of its parents, plus the `keep` ones (current assignees, attached or not). An item without
   * project allows everyone (none given, or all null: every contributor). Archived contributors are left out, except
   * the `keep` ones (or all of them with `withArchived`: those shown attached to a project).
   */
  assignableFor: (projectIds: (string | null)[], keep?: string[], withArchived?: boolean) => Contributor[];
  /** Display name of a contributor ("Moi" for the logged-in user). */
  contributorName: (contributor: Contributor) => string;
  /** Whether an open task is blocked by at least one open, non-archived task. */
  isBlocked: (task: Task) => boolean;
  /** Whether a task is closed (done). */
  isClosed: (task: Task) => boolean;
  /** Items offered when typing "#" and "@" in a text of a project (none: tasks of every project). */
  suggestionsFor: (projectId: string | null) => MarkdownSuggestions;
  /** References of a text of a project: "#12" is task 12 of it. */
  targetsFor: (projectId: string | null) => ReferenceTargets;
}

/** Label of the tasks of no project. */
const NO_PROJECT_LABEL = 'Sans projet';
/** Heading of the tasks of no project in a select of tasks. */
const NO_PROJECT_NODE = 'project:none';

/** Number of a task (« #12 »), its label after its number: the shared bricks. */
export { taskNumbered, taskRef };

/**
 * Number of a task without the space ("#12"), empty for a task of no project.
 * @param {{ number: number | null }} task Task.
 * @returns {string} Text.
 */
// eslint-disable-next-line no-restricted-syntax -- taskNumber itself.
export const taskNumber = (task: { number: number | null }): string => taskRef(task).trim();

/**
 * Mark of a closed task after its name (« (fermée) »), nothing for an open one.
 * @param {{ closed: boolean }} task Task.
 * @returns {string} Mark, with its space before.
 */
// eslint-disable-next-line no-restricted-syntax -- closedMark itself.
export const closedMark = (task: { closed: boolean }): string => (task.closed ? ' (fermée)' : '');

/**
 * Name of a task in a message: its number ("#12"), or its title for a task of no project.
 * @param {{ number: number | null, title: string }} task Task.
 * @returns {string} Name.
 */
// eslint-disable-next-line no-restricted-syntax -- taskName itself.
export const taskName = (task: { number: number | null; label: string }) => (task.number === null ? `« ${task.label} »` : `#${task.number}`);

/**
 * Task data with the lookups shared by the task screens.
 * @returns {{ context: TaskContext | null, isPending: boolean, error: Error | null }} Context, once loaded.
 */
export function useTaskContext() {
  const tasksQuery = useTasksData();
  const workspaceQuery = useProjectTree();
  const { data: me } = useMe();
  const meId = me?.contributorId ?? null;
  const data = tasksQuery.data;
  const workspace = workspaceQuery.data;
  const [milestoneOrder] = useMilestoneOrder();

  const context = useMemo<TaskContext | null>(() => {
    if (!data || !workspace) return null;
    const inOrder = <T extends { position: number }>(items: T[]) => [...items].sort(byPosition);
    const tasks = inOrder(data.tasks);
    const projectById = mapById(workspace.projects);
    const milestones = sortMilestones(data.milestones, milestoneOrder);
    const statusById = mapById(data.taskStatuses);
    const children = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.parentId) children.set(task.parentId, [...(children.get(task.parentId) ?? []), task]);
    }

    /**
     * Root project of a project.
     * @param {string | null} projectId Project id; none: the tasks of no project.
     * @returns {string | null} Root project id; null without project.
     */
    const rootOf = (projectId: string | null) => (projectId === null ? null : (lineageOf(projectById, projectId).at(-1)?.id ?? projectId));

    /**
     * Client and project path of a project.
     * @param {string | null} projectId Project; none: « Sans projet ».
     * @returns {string} "Client › Projet › Sous-projet" (without client: "Projet › Sous-projet").
     */
    const placeOf = (projectId: string | null) => {
      if (projectId === null) return NO_PROJECT_LABEL;
      const project = projectById.get(projectId);
      return project ? projectFullPath(workspace, project) : 'Projet inconnu';
    };
    const taskIndex = mapById(tasks);

    /**
     * Full path of a task: its project path (unless it is the one given), its parent tasks, then itself (« #12 Titre »;
     * a task of no project: its title alone).
     * @param {Task} task Task.
     * @param {string | null} [fromProjectId] Project the task is seen from (left out of the path). Optional.
     * @returns {string} "Client › Projet › #3 Parent › #12 Titre".
     */
    const taskPath = (task: Task, fromProjectId: string | null = null) => {
      const names = lineageOf(new Map([...taskIndex, [task.id, task]]), task.id)
        .reverse()
        .map((item) => taskNumbered(item));
      return [...(task.projectId && task.projectId !== fromProjectId ? [placeOf(task.projectId)] : []), ...names].join(LEVEL);
    };
    // Tasks texts can reference, by id and by "<projectId>:<number>".
    const referenceTasks: ReferenceTask[] = tasks.map((task) => ({ id: task.id, projectId: task.projectId, number: task.number, label: task.label, place: placeOf(task.projectId) }));
    const references = referenceTargets(referenceTasks);
    // Archived contributors are not offered by « @ ».
    const contributors = unarchived(data.contributors).map(({ handle, name, avatarUrl }) => ({ handle, name, avatarUrl }));
    return {
      tasks,
      contributors: data.contributors,
      statuses: inOrder(data.taskStatuses),
      priorities: inOrder(data.taskPriorities),
      types: inOrder(data.taskTypes),
      projects: workspace.projects,
      milestones,
      milestoneOrder,
      milestoneRank: new Map(milestones.map((milestone, index) => [milestone.id, index])),
      milestoneById: mapById(data.milestones),
      sprints: data.sprints,
      sprintById: mapById(data.sprints),
      meId,
      milestonesFor: (projectId, keep) => (projectId ? unarchived(milestones, keep).filter((milestone) => rootOf(milestone.projectId) === rootOf(projectId)) : []),
      sprintsFor: (projectId, keep) => (projectId ? unarchived(data.sprints, keep).filter((sprint) => rootOf(sprint.projectId) === rootOf(projectId)) : []),
      assignableFor: (projectIds, keep = [], withArchived = false) => {
        const offered = withArchived ? data.contributors : unarchived(data.contributors, keep);
        const scopes = [...new Set(projectIds.filter((id): id is string => id !== null))].map((projectId) => new Set(lineageOf(projectById, projectId).map((project) => project.id)));
        if (scopes.length === 0) return offered;
        return offered.filter((contributor) => contributor.isMe || keep.includes(contributor.id) || scopes.every((scope) => contributor.projectIds.some((id) => scope.has(id))));
      },
      contributorName: personName,
      taskById: mapById(tasks),
      taskLabel: taskPath,
      milestoneLabel: (milestone) => `${placeOf(milestone.projectId)}${LEVEL}${milestone.label}`,
      sprintLabel: (sprint) => `${placeOf(sprint.projectId)}${LEVEL}${sprint.label}`,
      statusById,
      priorityById: mapById(data.taskPriorities),
      typeById: mapById(data.taskTypes),
      tags: [...data.taskTags].sort(byPosition),
      tagById: mapById(data.taskTags),
      contributorById: mapById(data.contributors),
      projectById,
      projectLabel: placeOf,
      projectOptions: (offered: Project[]) => projectOptions(workspace, offered),
      taskOptions: (offered: Task[]) => {
        const ids = new Set(offered.map((task) => task.id));
        const taskNodes = [...mapById([...tasks, ...offered]).values()]
          .sort(byPosition)
          .map((task) => ({ id: task.id, parentId: task.parentId ?? task.projectId ?? NO_PROJECT_NODE, label: taskNumbered(task) }));
        const withoutProject = taskNodes.some((node) => node.parentId === NO_PROJECT_NODE) ? [{ id: NO_PROJECT_NODE, parentId: null, label: NO_PROJECT_LABEL, pathless: true }] : [];
        return treeOptions([...projectNodes(workspace), ...withoutProject, ...taskNodes], (id) => ids.has(id));
      },
      rootOf,
      childrenOf: (taskId) => children.get(taskId) ?? [],
      // The open / closed state says whether a task is done, whatever its status.
      isClosed: (task) => task.closed,
      isBlocked: (task) =>
        !task.closed &&
        task.blockedByIds.some((id) => {
          const blocker = unarchived(tasks).find((item) => item.id === id);
          return blocker !== undefined && !blocker.closed;
        }),
      suggestionsFor: (projectId) => ({ projectId, tasks: referenceTasks, contributors }),
      targetsFor: (projectId) => ({ projectId, ...references }),
    };
  }, [data, workspace, meId, milestoneOrder]);

  return {
    context,
    isPending: tasksQuery.isPending || workspaceQuery.isPending,
    error: tasksQuery.error ?? workspaceQuery.error,
  };
}
