import { Switch, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { ROUTINE_GROUP_BY, ROUTINE_SORT_KEYS, type RoutineFilterField, type RoutineViewConfig } from '@ordo/shared';
import type { FilterFields } from '../tasks/views/FilterBuilder';
import { SavedViewToolbar } from '../tasks/views/SavedViewToolbar';
import { ROUTINE_GROUP_BY_LABELS, ROUTINE_SORT_LABELS } from './routine-view';

interface RoutineViewToolbarProps {
  config: RoutineViewConfig;
  change: (change: (config: RoutineViewConfig) => RoutineViewConfig) => void;
  fields: FilterFields<RoutineFilterField>;
  dirty: boolean;
  onSave: () => void;
  onRevert: () => void;
  /** Columns panel of the table. */
  columns: ReactNode;
  /** Filter popover state (also opened from the column menus). */
  filterOpened: boolean;
  onFilterOpenedChange: (opened: boolean) => void;
}

/**
 * Tools of a routine view, as those of the task views: quick search, filters, multi-sort, and the options (groups,
 * flat sub-routines, archived routines, columns, saving the changes).
 * @param {RoutineViewToolbarProps} props Component props.
 * @returns {JSX.Element} Toolbar.
 */
export function RoutineViewToolbar({ config, change, fields, dirty, onSave, onRevert, columns, filterOpened, onFilterOpenedChange }: RoutineViewToolbarProps) {
  return (
    <SavedViewToolbar
      config={config}
      change={change}
      fields={fields}
      searchLabel="Rechercher (titre, description, lieu)"
      sortKeys={ROUTINE_SORT_KEYS}
      sortLabels={ROUTINE_SORT_LABELS}
      manualText="Ordre manuel : les routines peuvent être réordonnées par glisser-déposer."
      groupBy={ROUTINE_GROUP_BY}
      groupLabels={ROUTINE_GROUP_BY_LABELS}
      dirty={dirty}
      onSave={onSave}
      onRevert={onRevert}
      columns={columns}
      filterOpened={filterOpened}
      onFilterOpenedChange={onFilterOpenedChange}
      options={
        <>
          <Switch
            label="Sous-routines à plat"
            checked={config.flat}
            onChange={(event) => {
              const flat = event.currentTarget.checked;
              change((current) => ({ ...current, flat }));
            }}
          />
          <Switch
            label="Archivées"
            checked={config.includeArchived}
            onChange={(event) => {
              const includeArchived = event.currentTarget.checked;
              change((current) => ({ ...current, includeArchived }));
            }}
          />
          {(config.sorting.length > 0 || config.flat || (config.groupBy !== 'category' && config.groupBy !== null)) && (
            <Text size="xs" c="dimmed">
              {config.sorting.length > 0 || config.flat
                ? 'Glisser-déposer désactivé : il demande l’ordre manuel et les sous-routines sous leur parente.'
                : 'Une routine déposée dans un autre groupe n’en change pas : seul le groupement par catégorie le permet.'}
            </Text>
          )}
        </>
      }
    />
  );
}
