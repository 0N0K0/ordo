import { useMemo } from 'react';
import type { MarkdownSuggestions } from '../../components/markdown/MarkdownEditor';
import type { ReferenceTargets } from '../../components/markdown/remark-references';
import { useWorkspace, type Project } from '../workspace/api';
import { projectPath } from '../workspace/tree';
import { useTasksData, type Contributor, type Task, type TaskLabel, type TaskStatus } from './api';

export interface TaskContext {
  tasks: Task[];
  contributors: Contributor[];
  statuses: TaskStatus[];
  priorities: TaskLabel[];
  types: TaskLabel[];
  projects: Project[];
  taskById: Map<string, Task>;
  taskByNumber: Map<number, Task>;
  statusById: Map<string, TaskStatus>;
  priorityById: Map<string, TaskLabel>;
  typeById: Map<string, TaskLabel>;
  contributorById: Map<string, Contributor>;
  projectById: Map<string, Project>;
  /** "Client › Parent › Projet". */
  projectLabel: (projectId: string) => string;
  /** Root project of a project: links stay inside the same tree. */
  rootOf: (projectId: string) => string;
  /** Sub-tasks of a task, in manual order. */
  childrenOf: (taskId: string) => Task[];
  /** Whether a status is closed (done or cancelled). */
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
      taskById: new Map(tasks.map((task) => [task.id, task])),
      taskByNumber: new Map(tasks.map((task) => [task.number, task])),
      statusById,
      priorityById: new Map(data.taskPriorities.map((priority) => [priority.id, priority])),
      typeById: new Map(data.taskTypes.map((type) => [type.id, type])),
      contributorById: new Map(data.contributors.map((contributor) => [contributor.id, contributor])),
      projectById,
      projectLabel: (projectId) => {
        const project = projectById.get(projectId);
        return project ? `${projectPath(workspace, project)} › ${project.title}` : 'Projet inconnu';
      },
      rootOf,
      childrenOf: (taskId) => children.get(taskId) ?? [],
      isClosed: (task) => {
        const category = task.statusId ? statusById.get(task.statusId)?.category : undefined;
        return category === 'DONE' || category === 'CANCELLED';
      },
      suggestions: {
        tasks: tasks.map((task) => ({ number: task.number, title: task.title })),
        contributors: data.contributors.map(({ handle, name, avatarUrl }) => ({ handle, name, avatarUrl })),
      },
      targets: {
        taskNumbers: new Set(tasks.map((task) => task.number)),
        handles: new Set(data.contributors.map((contributor) => contributor.handle)),
      },
    };
  }, [data, workspace]);

  return {
    context,
    isPending: tasksQuery.isPending || workspaceQuery.isPending,
    error: tasksQuery.error ?? workspaceQuery.error,
  };
}
