import { copyName } from '../../../lib/text';
import { SortableTabs } from '../../tabs/SortableTabs';
import { confirmDestructive } from '../../dialogs/confirm-destructive';
import { openNameForm } from '../../dialogs/open-name-form';

import { Indicator } from '@mantine/core';
import { taskViewLabelSchema } from '@ordo/shared';
import { ArrowCounterClockwiseIcon, CopyIcon, FloppyDiskIcon, PencilSimpleIcon, StarIcon } from '@phosphor-icons/react';
import type { SavedView, SavedViewsState } from './use-saved-views';
import { usePublishedHeight } from './published-height';

/**
 * Asks for a view name in the side panel.
 * @param {string} title Panel title.
 * @param {string} initial Initial name.
 * @param {string} submitLabel Submit button label.
 * @param {(name: string) => void} onSubmit Called with the name.
 * @returns {void}
 */
function promptName(title: string, initial: string, submitLabel: string, onSubmit: (name: string) => void): void {
  openNameForm(title, { initial, label: 'Nom de la vue', schema: taskViewLabelSchema, submitLabel, onSubmit });
}

/**
 * Tabs of the saved views, reordered by drag and drop; the menu of the current one saves or reverts its changes
 * (also at the top of the « Options » menu).
 * @param {{ state: SavedViewsState<C> }} props Component props.
 * @returns {JSX.Element} Tabs.
 */
export function ViewTabs<C>({ state }: { state: SavedViewsState<C> }) {
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
      risks: <>La vue « {view.label} » et sa configuration (filtres, tris, colonnes) seront supprimées. Les tâches ne sont pas modifiées.</>,
      onConfirm: () => {
        state.remove(view);
      },
    });
  };

  return (
    <SortableTabs
      ref={ref}
      items={views}
      value={current?.id ?? null}
      onChange={state.select}
      onMove={state.move}
      name={(view) => `la vue ${view.label}`}
      leftSection={(view) => (view.isDefault ? <StarIcon weight="fill" aria-label="Vue par défaut" /> : undefined)}
      label={(view) => (
        <Indicator disabled={!(view.id === current?.id && dirty)} size={7} offset={-4} position="top-end" color="orange">
          {view.label}
        </Indicator>
      )}
      actions={(view) => [
        // The unsaved changes of the view first.
        dirty && { label: 'Enregistrer les modifications', icon: <FloppyDiskIcon aria-hidden />, hint: 'Modifications non enregistrées', onClick: state.save },
        dirty && { label: 'Annuler les modifications', icon: <ArrowCounterClockwiseIcon aria-hidden />, hint: 'Modifications non enregistrées', onClick: state.revert },
        dirty && 'divider',
        { label: 'Renommer', icon: <PencilSimpleIcon aria-hidden />, onClick: () => promptName('Renommer la vue', view.label, 'Renommer', (name) => state.rename(view.id, name)) },
        { label: 'Dupliquer', icon: <CopyIcon aria-hidden />, onClick: () => state.duplicate(view) },
        !view.isDefault && { label: 'Définir par défaut', icon: <StarIcon aria-hidden />, onClick: () => state.setDefault(view) },
      ]}
      onDelete={confirmDelete}
      deleteDisabled={() => views.length === 1}
      add={{
        label: 'Nouvelle vue',
        menu: [
          { label: 'Vue vierge', onClick: () => promptName('Nouvelle vue', 'Nouvelle vue', 'Créer', (name) => state.createView(name, false)) },
          { label: 'À partir de l’affichage actuel', onClick: () => promptName('Nouvelle vue', copyName(current?.label ?? 'Vue', 60), 'Créer', (name) => state.createView(name, true)) },
        ],
      }}
    />
  );
}
