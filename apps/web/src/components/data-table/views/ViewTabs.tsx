import { SortableTabs } from '../../tabs/SortableTabs';
import { confirmDestructive } from '../../dialogs/confirm-destructive';
import { openFormPanel } from '../../panels/panels';

import { Indicator, Menu, Stack, Text, TextInput } from '@mantine/core';
import { taskViewNameSchema } from '@ordo/shared';
import { ArrowCounterClockwiseIcon, CopyIcon, FloppyDiskIcon, PencilSimpleIcon, StarIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import type { SavedView, SavedViewsState } from './use-saved-views';
import { usePublishedHeight } from '../../../lib/published-height';

import { FormActions } from '../../dialogs/FormActions';

interface NameFormProps {
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

/**
 * View name prompt (create, rename).
 * @param {NameFormProps} props Component props.
 * @returns {JSX.Element} Form.
 */
function NameForm({ initial, submitLabel, onSubmit, onCancel }: NameFormProps) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validates and submits the name.
   * @returns {void}
   */
  const submit = () => {
    const result = taskViewNameSchema.safeParse(name);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Nom invalide.');
      return;
    }
    onSubmit(result.data);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      noValidate
    >
      <Stack gap="md">
        <TextInput
          label="Nom de la vue"
          required
          data-autofocus
          value={name}
          error={error}
          onChange={(event) => {
            setName(event.currentTarget.value);
            setError(null);
          }}
          onBlur={() => !taskViewNameSchema.safeParse(name).success && setError('Le nom est requis.')}
        />
        <FormActions onCancel={onCancel} submitLabel={submitLabel} />
      </Stack>
    </form>
  );
}

/**
 * Asks for a view name in the side panel.
 * @param {string} title Modal title.
 * @param {string} initial Initial name.
 * @param {string} submitLabel Submit button label.
 * @param {(name: string) => void} onSubmit Called with the name.
 * @returns {void}
 */
function promptName(title: string, initial: string, submitLabel: string, onSubmit: (name: string) => void): void {
  openFormPanel(title, (close) => (
    <NameForm
      initial={initial}
      submitLabel={submitLabel}
      onCancel={close}
      onSubmit={(name) => {
        close();
        onSubmit(name);
      }}
    />
  ));
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
   * Asks for confirmation  /**
   * Asks for confirmation before deleting a view.
   * @param {SavedView<C>} view View.
   * @returns {void}
   */
  const confirmDelete = (view: SavedView<C>) => {
    confirmDestructive({
      title: 'Supprimer la vue',
      risks: (
        <>
          <Text size="sm">La vue « {view.name} » et sa configuration (filtres, tris, colonnes) seront supprimées. Les tâches ne sont pas modifiées. Cette action est irréversible.</Text>
        </>
      ),
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
      name={(view) => `la vue ${view.name}`}
      leftSection={(view) => (view.isDefault ? <StarIcon weight="fill" aria-label="Vue par défaut" /> : undefined)}
      label={(view) => (
        <Indicator disabled={!(view.id === current?.id && dirty)} size={7} offset={-4} position="top-end" color="orange">
          {view.name}
        </Indicator>
      )}
      actions={(view) => (
        <>
          {dirty && (
            <>
              <Menu.Label>Modifications non enregistrées</Menu.Label>
              <Menu.Item leftSection={<FloppyDiskIcon aria-hidden />} onClick={state.save}>
                Enregistrer
              </Menu.Item>
              <Menu.Item leftSection={<ArrowCounterClockwiseIcon aria-hidden />} onClick={state.revert}>
                Annuler les modifications
              </Menu.Item>
              <Menu.Divider />
            </>
          )}
          <Menu.Item leftSection={<PencilSimpleIcon aria-hidden />} onClick={() => promptName('Renommer la vue', view.name, 'Renommer', (name) => state.rename(view.id, name))}>
            Renommer
          </Menu.Item>
          <Menu.Item leftSection={<CopyIcon aria-hidden />} onClick={() => state.duplicate(view)}>
            Dupliquer
          </Menu.Item>
          {!view.isDefault && (
            <Menu.Item leftSection={<StarIcon aria-hidden />} onClick={() => state.setDefault(view)}>
              Définir par défaut
            </Menu.Item>
          )}
        </>
      )}
      onDelete={confirmDelete}
      deleteDisabled={() => views.length === 1}
      add={{
        label: 'Nouvelle vue',
        menu: (
          <>
            <Menu.Item onClick={() => promptName('Nouvelle vue', 'Nouvelle vue', 'Créer', (name) => state.createView(name, false))}>Vue vierge</Menu.Item>
            <Menu.Item onClick={() => promptName('Nouvelle vue', `${current?.name ?? 'Vue'} (copie)`.slice(0, 60), 'Créer', (name) => state.createView(name, true))}>
              À partir de l’affichage actuel
            </Menu.Item>
          </>
        ),
      }}
    />
  );
}
