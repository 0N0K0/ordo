import { Badge, Button, CloseButton, Divider, Group, Indicator, Popover, Select, Stack, Text, TextInput } from '@mantine/core';
import type { FilterGroupOf } from '@ordo/shared';
import { ArrowCounterClockwiseIcon, CaretDownIcon, FloppyDiskIcon, FunnelIcon, MagnifyingGlassIcon, SlidersHorizontalIcon, SortAscendingIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { FieldsFilterBuilder, type FilterFields } from './FilterBuilder';
import { countConditions } from './filter-meta';
import { SortPanel } from './ViewToolbar';

/** What the toolbar edits of a view configuration. */
export interface ToolbarConfig<F extends string, K extends string, G extends string> {
  filter: FilterGroupOf<F>;
  search: string;
  sorting: { id: K; desc: boolean }[];
  groupBy: G | null;
}

interface SavedViewToolbarProps<F extends string, K extends string, G extends string, C extends ToolbarConfig<F, K, G>> {
  config: C;
  change: (change: (config: C) => C) => void;
  fields: FilterFields<F>;
  /** Placeholder of the search. */
  searchLabel: string;
  sortKeys: readonly K[];
  sortLabels: Record<K, string>;
  /** What the order without sort is. */
  manualText: string;
  groupBy: readonly G[];
  groupLabels: Record<G, string>;
  /** More options, under the groups. Optional. */
  options?: ReactNode;
  dirty: boolean;
  onSave: () => void;
  onRevert: () => void;
}

/**
 * Tools of a saved view (routines, shopping lists…), as those of the task views: quick search, filters (conditions and
 * groups), multi-sort, and the options (groups, more options, saving the changes).
 * @param {SavedViewToolbarProps<F, K, G, C>} props Component props.
 * @returns {JSX.Element} Toolbar.
 */
export function SavedViewToolbar<F extends string, K extends string, G extends string, C extends ToolbarConfig<F, K, G>>({
  config,
  change,
  fields,
  searchLabel,
  sortKeys,
  sortLabels,
  manualText,
  groupBy,
  groupLabels,
  options,
  dirty,
  onSave,
  onRevert,
}: SavedViewToolbarProps<F, K, G, C>) {
  const [filterOpened, setFilterOpened] = useState(false);
  const filterCount = countConditions(config.filter);
  // The lists open in the panel: rendered in a portal, a click in them would close it.
  const inPanel = { withinPortal: false } as const;
  return (
    <Group gap="sm" wrap="wrap">
      <TextInput
        placeholder={searchLabel}
        aria-label={searchLabel}
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
          <SortPanel sorting={config.sorting} onChange={(sorting) => change((current) => ({ ...current, sorting }))} keys={sortKeys} labels={sortLabels} manualText={manualText} />
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
                data={groupBy.map((value) => ({ value, label: groupLabels[value] }))}
                value={config.groupBy}
                onChange={(value) => change((current) => ({ ...current, groupBy: (value as G | null) ?? null }))}
                clearable
                comboboxProps={inPanel}
              />
              {options}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Indicator>
    </Group>
  );
}
