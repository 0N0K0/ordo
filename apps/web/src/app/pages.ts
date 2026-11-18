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
  title: string;
  icon: Icon;
}

/** Pages of the app, one place for their names and icons (clients and projects show their own). */
export const PAGES = {
  home: { path: '/', title: 'Accueil', icon: HouseIcon },
  tasks: { path: '/tasks', title: 'Tâches', icon: CheckSquareOffsetIcon },
  routines: { path: '/routines', title: 'Routines', icon: ArrowsClockwiseIcon },
  calendar: { path: '/calendar', title: 'Agenda', icon: CalendarBlankIcon },
  time: { path: '/time', title: 'Chronos', icon: TimerIcon },
  alarms: { path: '/alarms', title: 'Alarmes', icon: AlarmIcon },
  shopping: { path: '/shopping', title: 'Achats', icon: BasketIcon },
  sheets: { path: '/sheets', title: 'Fiches', icon: ClipboardTextIcon },
  stock: { path: '/stock', title: 'Inventaire', icon: ArchiveIcon },
  accounting: { path: '/accounting', title: 'Facturation', icon: ReceiptIcon },
  treasury: { path: '/treasury', title: 'Trésorerie', icon: BankIcon },
  mail: { path: '/mail', title: 'Mails', icon: EnvelopeSimpleIcon },
  documents: { path: '/documents', title: 'Documents', icon: FolderOpenIcon },
  dashboards: { path: '/dashboards', title: 'Tableaux de bord', icon: ChartBarIcon },
  settings: { path: '/settings', title: 'Paramètres', icon: GearSixIcon },
  account: { path: '/account', title: 'Mon compte', icon: UserCircleIcon },
} satisfies Record<string, AppPage>;

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
export const taskPath = (task: { id: string; projectId: string | null }): string => (task.projectId ? `${projectPath(task.projectId, 'tasks')}&task=${task.id}` : `/tasks?task=${task.id}`);

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
