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
