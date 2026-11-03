import { useMemo } from 'react';
import type { MarkdownSuggestions } from '../../components/markdown/MarkdownEditor';
import type { ReferenceTargets } from '../../components/markdown/remark-references';
import { useWorkspace, type Project } from '../workspace/api';
import { projectPath } from '../workspace/tree';
import { useMe } from '../auth/api';
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
  milestones: Milestone[];
  milestoneById: Map<string, Milestone>;
  /** Sprints, by start date. */
  sprints: Sprint[];
  sprintById: Map<string, Sprint>;
  /** Contributor profile of the logged-in user ("Moi"). */
  meId: string | null;
  taskById: Map<string, Task>;
  taskByNumber: Map<number, Task>;
  statusById: Map<string, TaskStatus>;
  priorityById: Map<string, TaskLabel>;
  typeById: Map<string, TaskLabel>;
  tagById: Map<string, TaskLabel>;
  contributorById: Map<string, Contributor>;
  projectById: Map<string, Project>;
  /** "Client › Parent › Projet". */
  projectLabel: (projectId: string) => string;
  /** Root project of a project: links stay inside the same tree. */
  rootOf: (projectId: string) => string;
  /** Sub-tasks of a task, in manual order. */
  childrenOf: (taskId: string) => Task[];
  /** Milestones usable by the tasks of a project: those of its whole project tree. */
  milestonesFor: (projectId: string) => Milestone[];
  /** Sprints usable by the tasks of a project: those of its whole project tree. */
  sprintsFor: (projectId: string) => Sprint[];
  /**
   * Contributors that can be assigned to tasks of these projects: "Moi" and those attached to one of the
   * projects or to a parent project, plus the `keep` ones (current assignees, attached or not).
   */
  assignableFor: (projectIds: string[], keep?: string[]) => Contributor[];
  /** Display name of a contributor ("Moi" for the logged-in user). */
  contributorName: (contributor: Contributor) => string;
  /** Whether an open task is blocked by at least one open, non-archived task. */
  isBlocked: (task: Task) => boolean;
  /** Whether a task is closed (done). */
  isClosed: (task: Task) => boolean;
  suggestions: MarkdownSuggestions;
  targets: ReferenceTargets;
}

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

  const context = useMemo<TaskContext | null>(() => {
    if (!data || !workspace) return null;
    const byPosition = <T extends { position: number }>(items: T[]) => [...items].sort((a, b) => a.position - b.position);
    const tasks = byPosition(data.tasks);
    const projectById = new Map(workspace.projects.map((project) => [project.id, project]));
    const statusById = new Map(data.taskStatuses.map((status) => [status.id, status]));
    const children = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.parentId) children.set(task.parentId, [...(children.get(task.parentId) ?? []), task]);
    }

    /**
     * Root project of a project.
     * @param {string} projectId Project id.
     * @returns {string} Root project id.
     */
    const rootOf = (projectId: string) => {
      let current = projectId;
      for (let parent = projectById.get(current)?.parentId; parent; parent = projectById.get(current)?.parentId) {
        current = parent;
      }
      return current;
    };

    return {
      tasks,
      contributors: data.contributors,
      statuses: byPosition(data.taskStatuses),
      priorities: byPosition(data.taskPriorities),
      types: byPosition(data.taskTypes),
      projects: workspace.projects,
      milestones: data.milestones,
      milestoneById: new Map(data.milestones.map((milestone) => [milestone.id, milestone])),
      sprints: data.sprints,
      sprintById: new Map(data.sprints.map((sprint) => [sprint.id, sprint])),
      meId,
      milestonesFor: (projectId) => data.milestones.filter((milestone) => rootOf(milestone.projectId) === rootOf(projectId)),
      sprintsFor: (projectId) => data.sprints.filter((sprint) => rootOf(sprint.projectId) === rootOf(projectId)),
      assignableFor: (projectIds, keep = []) => {
        const scope = new Set<string>();
        for (const projectId of projectIds) {
          for (let current: string | null | undefined = projectId; current; current = projectById.get(current)?.parentId) {
            scope.add(current);
          }
        }
        return data.contributors.filter(
          (contributor) => contributor.isMe || keep.includes(contributor.id) || contributor.projectIds.some((id) => scope.has(id)),
        );
      },
      contributorName: (contributor) => (contributor.isMe ? `${contributor.name} (moi)` : contributor.name),
      taskById: new Map(tasks.map((task) => [task.id, task])),
      taskByNumber: new Map(tasks.map((task) => [task.number, task])),
      statusById,
      priorityById: new Map(data.taskPriorities.map((priority) => [priority.id, priority])),
      typeById: new Map(data.taskTypes.map((type) => [type.id, type])),
      tags: [...data.taskTags].sort((a, b) => a.position - b.position),
      tagById: new Map(data.taskTags.map((tag) => [tag.id, tag])),
      contributorById: new Map(data.contributors.map((contributor) => [contributor.id, contributor])),
      projectById,
      projectLabel: (projectId) => {
        const project = projectById.get(projectId);
        return project ? `${projectPath(workspace, project)} › ${project.title}` : 'Projet inconnu';
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
      suggestions: {
        tasks: tasks.map((task) => ({ number: task.number, title: task.title })),
        contributors: data.contributors.map(({ handle, name, avatarUrl }) => ({ handle, name, avatarUrl })),
      },
      targets: {
        taskNumbers: new Set(tasks.map((task) => task.number)),
        handles: new Set(data.contributors.map((contributor) => contributor.handle)),
      },
    };
  }, [data, workspace, meId]);

  return {
    context,
    isPending: tasksQuery.isPending || workspaceQuery.isPending,
    error: tasksQuery.error ?? workspaceQuery.error,
  };
}
