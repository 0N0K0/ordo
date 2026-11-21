/**
 * Addresses of the pages of the web app that the API needs too (the link of a ring pushed by the server, opened
 * from its notification): the pages of the lists, the page of a project and of a task. The web app builds its menu on
 * them (`app/pages.ts`).
 */

/** Pages of the lists the rings link to. */
export const APP_PATHS = {
  home: '/',
  tasks: '/tasks',
  routines: '/routines',
  calendar: '/calendar',
  alarms: '/alarms',
  account: '/account',
} as const;

/**
 * Page of a project, on a tab.
 * @param {string} id Project.
 * @param {string} [tab] Tab (« tasks », « time », « mail »…). Optional. Default = the first one.
 * @returns {string} Path.
 */
export const projectPath = (id: string, tab?: string): string => `/projects/${id}${tab ? `?tab=${tab}` : ''}`;

/**
 * Page of a task: the tasks tab of its project with the task open, or « Tâches » for a task of no project.
 * @param {{ id: string, projectId: string | null }} task Task.
 * @returns {string} Path.
 */
export const taskPath = (task: { id: string; projectId: string | null }): string =>
  task.projectId ? `${projectPath(task.projectId, 'tasks')}&task=${task.id}` : `${APP_PATHS.tasks}?task=${task.id}`;
