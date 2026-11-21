import { openFormPanel } from '../../../components/panels/panels';
import { WorkSchedulesManager } from '../components/WorkSchedulesManager';
import { EPHEMERIDES_TITLE, schedulesTitle } from './schedule-text';

/**
 * Opens the table of the créneaux, or of the éphémérides, in the side panel: from the calendar, and the
 * éphémérides from the contexts of the treasury too (they are their periods).
 * @param {boolean} ephemeris The éphémérides.
 * @param {boolean} perso Personal workspace (its créneaux are not « de travail »).
 * @returns {void}
 */
export function openSchedulesManager(ephemeris: boolean, perso: boolean): void {
  openFormPanel(ephemeris ? EPHEMERIDES_TITLE : schedulesTitle(perso), () => <WorkSchedulesManager ephemeris={ephemeris} />, 'lg');
}
