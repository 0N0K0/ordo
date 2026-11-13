import { Badge, Button, CloseButton, Divider, Group, Indicator, Popover, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { ROUTINE_GROUP_BY, ROUTINE_SORT_KEYS, type RoutineFilterField, type RoutineGroupBy, type RoutineViewConfig } from '@ordo/shared';
import { ArrowCounterClockwiseIcon, CaretDownIcon, FloppyDiskIcon, FunnelIcon, MagnifyingGlassIcon, SlidersHorizontalIcon, SortAscendingIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { FieldsFilterBuilder, type FilterFields } from '../tasks/views/FilterBuilder';
import { countConditions } from '../tasks/views/filter-meta';
import { SortPanel } from '../tasks/views/ViewToolbar';
import { ROUTINE_GROUP_BY_LABELS, ROUTINE_SORT_LABELS } from './routine-view';

type Change = (change: (config: RoutineViewConfig) => RoutineViewConfig) => void;

interface RoutineViewToolbarProps {
  config: RoutineViewConfig;
  change: Change;
  fields: FilterFields<RoutineFilterField>;
  dirty: boolean;
  onSave: () => void;
  onRevert: () => void;
}

/**
 * Tools of a routine view, as those of the task views: quick search, filters (conditions and groups), multi-sort,
 * and the options (groups, flat sub-routines, archived routines, saving the changes).
 * @param {RoutineViewToolbarProps} props Component props.
 * @returns {JSX.Element} Toolbar.
 */
export function RoutineViewToolbar({ config, change, fields, dirty, onSave, onRevert }: RoutineViewToolbarProps) {
  const [filterOpened, setFilterOpened] = useState(false);
  const filterCount = countConditions(config.filter);
  // The lists open in the panel: rendered in a portal, a click in them would close it.
  const inPanel = { withinPortal: false } as const;
  return (
    <Group gap="sm" wrap="wrap">
      <TextInput
        placeholder="Rechercher (titre, description, lieu)"
        aria-label="Rechercher une routine"
        leftSection={<MagnifyingGlassIcon aria-hidden />}
        rightSection={config.search ? <CloseButton size="sm" aria-label="Effacer" onClick={() => change((current) => ({ ...current, search: '' }))} /> : null}
        value={config.search}
        onChange={(event) => {
          const search = event.currentTarget.value;
          change((current) => ({ ...current, search }));
        }}
        style={{ flex: '1 1 14rem', minWidth: 'min(100%, 14rem)' }}
      />

      <Popover opened={filterOpened} onChange={setFilterOpened} position="bottom-start" shadow="md" withinPortal trapFocus={false} closeOnClickOutside>
        <Popover.Target>
          <Button
            onClick={() => setFilterOpened(!filterOpened)}
            variant={filterCount ? 'light' : 'default'}
            leftSection={<FunnelIcon aria-hidden />}
            rightSection={
              filterCount ? (
                <Badge size="xs" circle>
                  {filterCount}
                </Badge>
              ) : undefined
            }
          >
            Filtrer
          </Button>
        </Popover.Target>
        <Popover.Dropdown maw="min(56rem, calc(100vw - 2rem))">
          <FieldsFilterBuilder filter={config.filter} fields={fields} onChange={(filter) => change((current) => ({ ...current, filter }))} />
        </Popover.Dropdown>
      </Popover>

      <Popover position="bottom-start" shadow="md" withinPortal>
        <Popover.Target>
          <Button
            variant={config.sorting.length ? 'light' : 'default'}
            leftSection={<SortAscendingIcon aria-hidden />}
            rightSection={
              config.sorting.length ? (
                <Badge size="xs" circle>
                  {config.sorting.length}
                </Badge>
              ) : undefined
            }
          >
            Trier
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <SortPanel
            sorting={config.sorting}
            onChange={(sorting) => change((current) => ({ ...current, sorting }))}
            keys={ROUTINE_SORT_KEYS}
            labels={ROUTINE_SORT_LABELS}
            manualText="Ordre manuel : les routines peuvent être réordonnées par glisser-déposer."
          />
        </Popover.Dropdown>
      </Popover>

      {/* A dot while the view has unsaved changes. */}
      <Indicator disabled={!dirty} size={8} offset={4} position="top-end" color="orange">
        <Popover position="bottom-end" shadow="md" withinPortal width={320} middlewares={{ flip: true, shift: true, size: { padding: 8 } }}>
          <Popover.Target>
            <Button
              variant="default"
              leftSection={<SlidersHorizontalIcon aria-hidden />}
              rightSection={<CaretDownIcon aria-hidden />}
              aria-label={dirty ? 'Options (modifications non enregistrées)' : 'Options'}
            >
              Options
            </Button>
          </Popover.Target>
          <Popover.Dropdown style={{ overflowY: 'auto' }}>
            <Stack gap="sm">
              {dirty && (
                <>
                  <Text size="sm" c="orange">
                    Modifications non enregistrées
                  </Text>
                  <Group gap="xs" grow>
                    <Button variant="default" leftSection={<ArrowCounterClockwiseIcon aria-hidden />} onClick={onRevert}>
                      Annuler
                    </Button>
                    <Button leftSection={<FloppyDiskIcon aria-hidden />} onClick={onSave}>
                      Enregistrer
                    </Button>
                  </Group>
                  <Divider />
                </>
              )}
              <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                Affichage
              </Text>
              <Select
                label="Grouper par"
                placeholder="Aucun groupe"
                data={ROUTINE_GROUP_BY.map((groupBy) => ({ value: groupBy, label: ROUTINE_GROUP_BY_LABELS[groupBy] }))}
                value={config.groupBy}
                onChange={(groupBy) => change((current) => ({ ...current, groupBy: (groupBy as RoutineGroupBy | null) ?? null }))}
                clearable
                comboboxProps={inPanel}
              />
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
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Indicator>
    </Group>
  );
}
