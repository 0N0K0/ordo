/** Name of each page of the app, by the first segment of its path (clients and projects show their own). */
const PAGE_TITLES: Record<string, string> = {
  '': 'Accueil',
  tasks: 'Mes tâches',
  calendar: 'Agenda',
  time: 'Chronos',
  alarms: 'Alarmes',
  shopping: 'Achats',
  routines: 'Routines',
  accounting: 'Facturation',
  treasury: 'Trésorerie',
  mail: 'Mails',
  documents: 'Documents',
  dashboards: 'Tableaux de bord',
  settings: 'Paramètres',
  account: 'Mon compte',
};

/**
 * Name of the page of a path, for the header.
 * @param {string} pathname Path.
 * @returns {string | null} Name, or null for a path without one (a client, a project, an unknown page).
 */
export function pageTitle(pathname: string): string | null {
  return PAGE_TITLES[pathname.split('/')[1] ?? ''] ?? null;
}
