import { copyName } from '../../../lib/text';
import { SortableTabs } from '../../tabs/SortableTabs';
import { confirmDestructive } from '../../dialogs/confirm-destructive';
import { openLabelForm } from '../../dialogs/open-label-form';

import { viewLabelSchema } from '@ordo/shared';
// eslint-disable-next-line no-restricted-syntax -- the star of the default view, not a favourite.
import { ArrowCounterClockwiseIcon, FloppyDiskIcon, PencilSimpleIcon, StarIcon } from '@phosphor-icons/react';
import { duplicateRowsAction, rowMenuEntry } from '../selection/selection-actions';
import type { SavedView, SavedViewsState } from './use-saved-views';
import { usePublishedHeight } from './published-height';
import { UnsavedIndicator, UNSAVED_CHANGES } from './UnsavedIndicator';

/**
 * Asks for a view name in the side panel.
 * @param {string} title Panel title.
 * @param {string} initial Initial name.
 * @param {string} submitLabel Submit button label.
 * @param {(name: string) => void} onSubmit Called with the name.
 * @returns {void}
 */
function promptLabel(title: string, initial: string, submitLabel: string, onSubmit: (name: string) => void): void {
  openLabelForm(title, { initial, fieldLabel: 'Libellé de la vue', schema: viewLabelSchema, submitLabel, onSubmit });
}

/** Words of the deletion of a view: what its configuration holds, what stays untouched. */
export interface ViewWords {
  config: string;
  untouched: string;
}

/** Words of the deletion of a view of a table. */
const TABLE_VIEW_WORDS: ViewWords = { config: 'filtres, tris, colonnes', untouched: 'Les lignes du tableau ne sont pas modifiées.' };

/**
 * Tabs of the saved views, reordered by drag and drop; the menu of the current one saves or reverts its changes
 * (also at the top of the « Options » menu).
 * @param {{ state: SavedViewsState<C>, about?: ViewWords }} props Component props: the views, and the words of the
 *   deletion of one (default: those of a table).
 * @returns {JSX.Element} Tabs.
 */
export function ViewTabs<C>({ state, about = TABLE_VIEW_WORDS }: { state: SavedViewsState<C>; about?: ViewWords }) {
  const { views, current, dirty } = state;
  // Its height, that a table next to other content leaves out of its own.
  const ref = usePublishedHeight<HTMLDivElement>('--onoko-view-tabs-height');
  /**
   * Asks for confirmation before deleting a view.
   * @param {SavedView<C>} view View.
   * @returns {void}
   */
  const confirmDelete = (view: SavedView<C>) => {
    confirmDestructive({
      title: 'Supprimer la vue',
      risks: (
        <>
          La vue « {view.label} » et sa configuration ({about.config}) seront supprimées. {about.untouched}
        </>
      ),
      run: () => state.remove(view),
      done: 'Vue supprimée.',
    });
  };

  return (
    <SortableTabs
      ref={ref}
      items={views}
      value={current?.id ?? null}
      onChange={state.select}
      onMove={state.move}
      name={(view) => view.label}
      leftSection={(view) => (view.isDefault ? <StarIcon weight="fill" aria-label="Vue par défaut" /> : undefined)}
      label={(view) => (
        <UnsavedIndicator dirty={view.id === current?.id && dirty} offset={-4}>
          {view.label}
        </UnsavedIndicator>
      )}
      actions={(view) => [
        // The unsaved changes of the view first.
        dirty && { label: 'Enregistrer les modifications', icon: <FloppyDiskIcon aria-hidden />, hint: UNSAVED_CHANGES, onClick: state.save },
        dirty && { label: 'Annuler les modifications', icon: <ArrowCounterClockwiseIcon aria-hidden />, hint: UNSAVED_CHANGES, onClick: state.revert },
        dirty && 'divider',
        { label: 'Renommer', icon: <PencilSimpleIcon aria-hidden />, onClick: () => promptLabel('Renommer la vue', view.label, 'Renommer', (name) => state.rename(view.id, name)) },
        rowMenuEntry(duplicateRowsAction([view], state.duplicate)),
        !view.isDefault && { label: 'Définir par défaut', icon: <StarIcon aria-hidden />, onClick: () => state.setDefault(view) },
      ]}
      onDelete={confirmDelete}
      deleteDisabled={() => views.length === 1}
      add={{
        label: 'Nouvelle vue',
        menu: [
          { label: 'Vue vierge', onClick: () => promptLabel('Nouvelle vue', 'Nouvelle vue', 'Créer', (name) => state.createView(name, false)) },
          { label: 'À partir de l’affichage actuel', onClick: () => promptLabel('Nouvelle vue', copyName(current?.label ?? 'Vue'), 'Créer', (name) => state.createView(name, true)) },
        ],
      }}
    />
  );
}
