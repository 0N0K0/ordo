import { useMemo } from 'react';
import type { MarkdownSuggestions } from '../../components/markdown/MarkdownEditor';
import type { ReferenceTargets, ReferenceTask } from '../../components/markdown/remark-references';
import { useWorkspace, type Project } from '../workspace/api';
import { treeOptions, type TreeOption } from '../../components/tree-select/tree-select';
import { projectNodes, projectOptions, projectPath } from '../workspace/tree';
import { useMe } from '../auth/api';
import { sortMilestones, useMilestoneOrder, type MilestoneOrder } from './milestone-order';
import { useTasksData, type Contributor, type Milestone, type Sprint, type Task, type TaskLabel, type TaskStatus } from './api';

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
   * Label of a task: "#12 Titre" in its own project, "Client › Projet #12 Titre" seen from elsewhere (its number is
   * only unique in its project), "Titre" for a task of no project seen among them, "Sans projet › Titre" elsewhere.
   */
  taskLabel: (task: Task, fromProjectId?: string | null) => string;
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
  /** Milestones usable by the tasks of a project: those of its whole project tree (none without project). */
  milestonesFor: (projectId: string | null) => Milestone[];
  /** Sprints usable by the tasks of a project: those of its whole project tree (none without project). */
  sprintsFor: (projectId: string | null) => Sprint[];
  /**
   * Contributors that can be assigned to tasks of these projects: "Moi" and those attached to one of the
   * projects or to a parent project, plus the `keep` ones (current assignees, attached or not). Without project
   * (none given, or one of them null): every contributor.
   */
  assignableFor: (projectIds: (string | null)[], keep?: string[]) => Contributor[];
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
export const NO_PROJECT_LABEL = 'Sans projet';
/** Heading of the tasks of no project in a select of tasks. */
const NO_PROJECT_NODE = 'project:none';

/**
 * Number of a task followed by a space ("#12 "), empty for a task of no project (it has none).
 * @param {{ number: number | null }} task Task.
 * @returns {string} Text.
 */
export const taskRef = (task: { number: number | null }) => (task.number === null ? '' : `#${task.number} `);

/**
 * Name of a task in a message: its number ("#12"), or its title for a task of no project.
 * @param {{ number: number | null, title: string }} task Task.
 * @returns {string} Name.
 */
export const taskName = (task: { number: number | null; title: string }) => (task.number === null ? `« ${task.title} »` : `#${task.number}`);

/**
 * Task data with the lookups shared by the task screens.
 * @returns {{ context: TaskContext | null, isPending: boolean, error: Error | null }} Context, once loaded.
 */
export function useTaskContext() {
  const tasksQuery = useTasksData();
  const workspaceQuery = useWorkspace();
  const { data: me } = useMe();
  const meId = me?.contributorId ?? null;
  const data = tasksQuery.data;
  const workspace = workspaceQuery.data;
  const [milestoneOrder] = useMilestoneOrder();

  const context = useMemo<TaskContext | null>(() => {
    if (!data || !workspace) return null;
    const byPosition = <T extends { position: number }>(items: T[]) => [...items].sort((a, b) => a.position - b.position);
    const tasks = byPosition(data.tasks);
    const projectById = new Map(workspace.projects.map((project) => [project.id, project]));
    const milestones = sortMilestones(data.milestones, milestoneOrder);
    const statusById = new Map(data.taskStatuses.map((status) => [status.id, status]));
    const children = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.parentId) children.set(task.parentId, [...(children.get(task.parentId) ?? []), task]);
    }

    /**
     * Root project of a project.
     * @param {string | null} projectId Project id; none: the tasks of no project.
     * @returns {string | null} Root project id; null without project.
     */
    const rootOf = (projectId: string | null) => {
      if (projectId === null) return null;
      let current = projectId;
      for (let parent = projectById.get(current)?.parentId; parent; parent = projectById.get(current)?.parentId) {
        current = parent;
      }
      return current;
    };

    /**
     * Client and project path of a project.
     * @param {string | null} projectId Project; none: « Sans projet ».
     * @returns {string} "Client › Projet › Sous-projet".
     */
    const placeOf = (projectId: string | null) => {
      if (projectId === null) return NO_PROJECT_LABEL;
      const project = projectById.get(projectId);
      return project ? `${projectPath(workspace, project)} › ${project.title}` : 'Projet inconnu';
    };
    // Tasks texts can reference, by id and by "<projectId>:<number>".
    const referenceTasks: ReferenceTask[] = tasks.map((task) => ({ id: task.id, projectId: task.projectId, number: task.number, title: task.title, place: placeOf(task.projectId) }));
    const referenceById = new Map(referenceTasks.map((task) => [task.id, task]));
    // "#12" only names a task of a project.
    const referenceByNumber = new Map(referenceTasks.filter((task) => task.number !== null).map((task) => [`${task.projectId}:${task.number}`, task]));
    const contributors = data.contributors.map(({ handle, name, avatarUrl }) => ({ handle, name, avatarUrl }));
    const handles = new Set(data.contributors.map((contributor) => contributor.handle));
    return {
      tasks,
      contributors: data.contributors,
      statuses: byPosition(data.taskStatuses),
      priorities: byPosition(data.taskPriorities),
      types: byPosition(data.taskTypes),
      projects: workspace.projects,
      milestones,
      milestoneOrder,
      milestoneRank: new Map(milestones.map((milestone, index) => [milestone.id, index])),
      milestoneById: new Map(data.milestones.map((milestone) => [milestone.id, milestone])),
      sprints: data.sprints,
      sprintById: new Map(data.sprints.map((sprint) => [sprint.id, sprint])),
      meId,
      milestonesFor: (projectId) => (projectId ? milestones.filter((milestone) => rootOf(milestone.projectId) === rootOf(projectId)) : []),
      sprintsFor: (projectId) => (projectId ? data.sprints.filter((sprint) => rootOf(sprint.projectId) === rootOf(projectId)) : []),
      assignableFor: (projectIds, keep = []) => {
        if (projectIds.length === 0 || projectIds.includes(null)) return data.contributors;
        const scope = new Set<string>();
        for (const projectId of projectIds) {
          for (let current: string | null | undefined = projectId; current; current = projectById.get(current)?.parentId) {
            scope.add(current);
          }
        }
        return data.contributors.filter((contributor) => contributor.isMe || keep.includes(contributor.id) || contributor.projectIds.some((id) => scope.has(id)));
      },
      contributorName: (contributor) => (contributor.isMe ? `${contributor.name} (moi)` : contributor.name),
      taskById: new Map(tasks.map((task) => [task.id, task])),
      taskLabel: (task, fromProjectId = null) => `${task.projectId === fromProjectId ? '' : task.projectId ? `${placeOf(task.projectId)} ` : `${NO_PROJECT_LABEL} › `}${taskRef(task)}${task.title}`,
      statusById,
      priorityById: new Map(data.taskPriorities.map((priority) => [priority.id, priority])),
      typeById: new Map(data.taskTypes.map((type) => [type.id, type])),
      tags: [...data.taskTags].sort((a, b) => a.position - b.position),
      tagById: new Map(data.taskTags.map((tag) => [tag.id, tag])),
      contributorById: new Map(data.contributors.map((contributor) => [contributor.id, contributor])),
      projectById,
      projectLabel: placeOf,
      projectOptions: (offered: Project[]) => projectOptions(workspace, offered),
      taskOptions: (offered: Task[]) => {
        const ids = new Set(offered.map((task) => task.id));
        const taskNodes = [...new Map([...tasks, ...offered].map((task) => [task.id, task])).values()]
          .sort((a, b) => a.position - b.position)
          .map((task) => ({ id: task.id, parentId: task.parentId ?? task.projectId ?? NO_PROJECT_NODE, label: `${taskRef(task)}${task.title}` }));
        const withoutProject = taskNodes.some((node) => node.parentId === NO_PROJECT_NODE) ? [{ id: NO_PROJECT_NODE, parentId: null, label: NO_PROJECT_LABEL }] : [];
        return treeOptions([...projectNodes(workspace), ...withoutProject, ...taskNodes], (id) => ids.has(id));
      },
      rootOf,
      childrenOf: (taskId) => children.get(taskId) ?? [],
      // The open / closed state says whether a task is done, whatever its status.
      isClosed: (task) => task.closed,
      isBlocked: (task) =>
        !task.closed &&
        task.blockedByIds.some((id) => {
          const blocker = tasks.find((item) => item.id === id);
          return blocker !== undefined && !blocker.archived && !blocker.closed;
        }),
      suggestionsFor: (projectId) => ({ projectId, tasks: referenceTasks, contributors }),
      targetsFor: (projectId) => ({ projectId, taskById: referenceById, taskByNumber: referenceByNumber, handles }),
    };
  }, [data, workspace, meId, milestoneOrder]);

  return {
    context,
    isPending: tasksQuery.isPending || workspaceQuery.isPending,
    error: tasksQuery.error ?? workspaceQuery.error,
  };
}
