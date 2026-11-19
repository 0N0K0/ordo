import {
  AlarmIcon,
  ArchiveIcon,
  ArrowsClockwiseIcon,
  BankIcon,
  BasketIcon,
  CalendarBlankIcon,
  ChartBarIcon,
  CheckSquareOffsetIcon,
  ClipboardTextIcon,
  EnvelopeSimpleIcon,
  FolderOpenIcon,
  GearSixIcon,
  HouseIcon,
  ReceiptIcon,
  TimerIcon,
  UserCircleIcon,
  type Icon,
} from '@phosphor-icons/react';
import { SETTINGS_TAB_PARAM } from '../components/tabs/use-settings-tab';

/** A page of the app: its address, its name (menu, header, page title) and its icon (menu). */
interface AppPage {
  path: string;
  label: string;
  icon: Icon;
}

/** Pages of the app, one place for their names and icons (clients and projects show their own). */
export const PAGES = {
  home: { path: '/', label: 'Accueil', icon: HouseIcon },
  tasks: { path: '/tasks', label: 'Tâches', icon: CheckSquareOffsetIcon },
  routines: { path: '/routines', label: 'Routines', icon: ArrowsClockwiseIcon },
  calendar: { path: '/calendar', label: 'Agenda', icon: CalendarBlankIcon },
  time: { path: '/time', label: 'Chronos', icon: TimerIcon },
  alarms: { path: '/alarms', label: 'Alarmes', icon: AlarmIcon },
  shopping: { path: '/shopping', label: 'Achats', icon: BasketIcon },
  sheets: { path: '/sheets', label: 'Fiches', icon: ClipboardTextIcon },
  stock: { path: '/stock', label: 'Inventaire', icon: ArchiveIcon },
  accounting: { path: '/accounting', label: 'Facturation', icon: ReceiptIcon },
  treasury: { path: '/treasury', label: 'Trésorerie', icon: BankIcon },
  mail: { path: '/mail', label: 'Mails', icon: EnvelopeSimpleIcon },
  documents: { path: '/documents', label: 'Documents', icon: FolderOpenIcon },
  dashboards: { path: '/dashboards', label: 'Tableaux de bord', icon: ChartBarIcon },
  settings: { path: '/settings', label: 'Paramètres', icon: GearSixIcon },
  account: { path: '/account', label: 'Mon compte', icon: UserCircleIcon },
} satisfies Record<string, AppPage>;

/** Pages of the sign-in (outside the app), their addresses. */
// eslint-disable-next-line no-restricted-syntax -- the addresses themselves.
export const AUTH_PATHS = { login: '/login', forgotPassword: '/forgot-password', resetPassword: '/reset-password', confirmEmail: '/confirm-email' } as const;

/** Overdue invoices: their tab of the billing. */
export const OVERDUE_INVOICES_PATH = `${PAGES.accounting.path}?tab=overdue`;

/** GitHub settings: their tab of the settings. */
export const GITHUB_SETTINGS_PATH = `${PAGES.settings.path}?tab=github`;

/**
 * Route of the router for an address of the app: the address without its leading slash, and a sub-path.
 * @param {string} path Address (`PAGES.x.path`, `AUTH_PATHS.x`).
 * @param {string} [sub] Sub-path (`:id`, `imported/:id`). Optional.
 * @returns {string} Route (`accounting/:id`).
 */
export const routeOf = (path: string, sub?: string): string => [path.slice(1), sub].filter(Boolean).join('/');

/** Key of a page of the app. */
export type PageKey = keyof typeof PAGES;

const BY_SEGMENT = new Map<string, AppPage>(Object.values(PAGES).map((page) => [page.path.split('/')[1] ?? '', page]));

/**
 * Page of a path, by its first segment (a sub-page belongs to its page).
 * @param {string} pathname Path.
 * @returns {AppPage | null} Page, or null for a path without one (a client, a project, an unknown page).
 */
export function pageOfPath(pathname: string): AppPage | null {
  return BY_SEGMENT.get(pathname.split('/')[1] ?? '') ?? null;
}

/** Route of the page of a project (the router, `useMatch`). */
// eslint-disable-next-line no-restricted-syntax -- the route itself.
export const PROJECT_ROUTE = '/projects/:id';

/** Route of the page of a client (the router, `useMatch`). */
// eslint-disable-next-line no-restricted-syntax -- the route itself.
export const CLIENT_ROUTE = '/clients/:id';

/**
 * Page of a project, on a tab.
 * @param {string} id Project.
 * @param {string} [tab] Tab (« tasks », « time », « mail »…). Optional. Default = the first one.
 * @returns {string} Path.
 */
// eslint-disable-next-line no-restricted-syntax -- the address of a project.
export const projectPath = (id: string, tab?: string): string => `/projects/${id}${tab ? `?tab=${tab}` : ''}`;

/**
 * Calendar opened on a day.
 * @param {string} date Day (YYYY-MM-DD).
 * @returns {string} Path.
 */
// eslint-disable-next-line no-restricted-syntax -- the address of a day of the calendar.
export const calendarPath = (date: string): string => `/calendar?date=${date}`;

/**
 * Page of a client.
 * @param {string} id Client.
 * @returns {string} Path.
 */
// eslint-disable-next-line no-restricted-syntax -- the address of a client.
export const clientPath = (id: string): string => `/clients/${id}`;

/**
 * Page of a task: the tasks tab of its project with the task open, or « Tâches » for a task of no project.
 * @param {{ id: string, projectId: string | null }} task Task.
 * @returns {string} Path.
 */
export const taskPath = (task: { id: string; projectId: string | null }): string =>
  task.projectId ? `${projectPath(task.projectId, 'tasks')}&task=${task.id}` : `${PAGES.tasks.path}?task=${task.id}`;

/**
 * Mails page on a folder of an account, a mail open (optional).
 * @param {string} account Mail account.
 * @param {string} folder Folder (« INBOX »…).
 * @param {number} [uid] Mail open. Optional.
 * @returns {string} Path.
 */
// eslint-disable-next-line no-restricted-syntax -- the address of a mail.
export const mailPath = (account: string, folder: string, uid?: number): string => `/mail?${new URLSearchParams({ account, folder, ...(uid !== undefined && { uid: String(uid) }) })}`;

/**
 * Page of an accounting document, made in Ordo or imported.
 * @param {string} id Document.
 * @param {boolean} [imported] Whether the document is imported. Optional. Default = false.
 * @returns {string} Path.
 */
// eslint-disable-next-line no-restricted-syntax -- the address of a document.
export const documentPath = (id: string, imported = false): string => `/accounting/${imported ? 'imported/' : ''}${id}`;

/**
 * Page of a sheet.
 * @param {string} id Sheet.
 * @returns {string} Path.
 */
// eslint-disable-next-line no-restricted-syntax -- the address of a sheet.
export const sheetPath = (id: string): string => `/sheets/${id}`;

/**
 * Page of a shopping list.
 * @param {string} id Shopping list.
 * @returns {string} Path.
 */
// eslint-disable-next-line no-restricted-syntax -- the address of a shopping list.
export const shoppingListPath = (id: string): string => `/shopping/${id}`;

/** The lists tab of the shopping page. */
export const SHOPPING_LISTS_PATH = `${PAGES.shopping.path}?tab=lists`;

/**
 * Time page on the time of a task.
 * @param {string} taskId Task.
 * @returns {string} Path.
 */
export const timePath = (taskId: string): string => `${PAGES.time.path}?task=${taskId}`;

/**
 * History of a routine, on the routines page.
 * @param {string} routineId Routine.
 * @returns {string} Path.
 */
export const routineHistoryPath = (routineId: string): string => `${PAGES.routines.path}?tab=history&routine=${routineId}`;

/** Parameter of the address opening the settings of a page (closed without it). */
export const SETTINGS_PARAM = 'settings';

/**
 * Address of a page with its settings open, on a tab (optional): `/mail?settings=1`, `/accounting?settings=1&section=company`.
 * @param {string} path Page.
 * @param {string} [section] Tab of the settings. Optional. Default = the first one.
 * @returns {string} Path.
 */
export const settingsPath = (path: string, section?: string): string => `${path}?${SETTINGS_PARAM}=1${section ? `&${SETTINGS_TAB_PARAM}=${section}` : ''}`;
