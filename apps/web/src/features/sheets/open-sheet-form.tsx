import { openFormPanel } from '../../components/panels/panels';
import type { Sheet } from './api';
import { SheetForm } from './SheetForm';

/**
 * Opens the form of a sheet in the side panel.
 * @param {Sheet} [sheet] Sheet to edit (none: a new one). Optional.
 * @param {string | null} [projectId] Project of a new one. Optional.
 * @returns {void}
 */
export function openSheetForm(sheet?: Sheet, projectId: string | null = null): void {
  openFormPanel(sheet ? 'Modifier la fiche' : 'Nouvelle fiche', (close) => <SheetForm sheet={sheet} projectId={projectId} onDone={close} />, 'lg');
}
