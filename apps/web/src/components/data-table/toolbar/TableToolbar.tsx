import { CountBadge } from '../../feedback/CountBadge';
import { Button, CloseButton, Collapse, Divider, Group, Indicator, Popover, Stack, Text, TextInput, Switch } from '@mantine/core';
import { ArrowCounterClockwiseIcon, ColumnsIcon, FloppyDiskIcon, FunnelIcon, MagnifyingGlassIcon, SlidersHorizontalIcon, SortAscendingIcon } from '@phosphor-icons/react';
import { FoldHeading } from '../../actions/FoldHeading';
import { useState, type ReactNode } from 'react';
import { usePublishedHeight } from '../views/published-height';
import { SubSection } from '../../page/SubSection';
import { ActionButton } from '../../actions/ActionButton';
import { MenuCaret } from '../../actions/MenuCaret';

/** Quick search of a toolbar. */
interface ToolbarSearch {
  value: string;
  onChange: (value: string) => void;
  /** Placeholder (and label) of the field. */
  placeholder: string;
}

interface TableToolbarProps {
  /** Quick search, on all the width left. Optional. */
  search?: ToolbarSearch;
  /** Tools after the search (filters, sorts, period…). Optional. */
  children?: ReactNode;
  /** The « Options » menu, always last. Optional. */
  options?: ReactNode;
}

/**
 * Toolbar of every table, on the model of the tasks: the search on all the width left, the tools of the table, then
 * its « Options » menu (at the right end, even without search).
 * @param {TableToolbarProps} props Component props.
 * @returns {JSX.Element} Toolbar.
 */
export function TableToolbar({ search, children, options }: TableToolbarProps) {
  // Its height, that a table next to other content leaves out of its own.
  const ref = usePublishedHeight<HTMLDivElement>('--onoko-table-toolbar-height');
  return (
    <Group ref={ref} gap="sm" wrap="wrap">
      {search && (
        <TextInput
          placeholder={search.placeholder}
          aria-label={search.placeholder}
          leftSection={<MagnifyingGlassIcon aria-hidden />}
          rightSection={search.value ? <CloseButton size="sm" aria-label="Effacer" onClick={() => search.onChange('')} /> : null}
          value={search.value}
          onChange={(event) => search.onChange(event.currentTarget.value)}
          // Every width left by the buttons, but never under a minimum: without room, the buttons go to the next line.
          style={{ flex: '1 1 14rem', minWidth: 'min(100%, 14rem)' }}
        />
      )}
      {children}
      {options && <div style={search ? undefined : { marginLeft: 'auto' }}>{options}</div>}
    </Group>
  );
}

interface ToolbarFilterProps {
  /** Number of conditions: the button is highlighted with it. */
  count: number;
  /** Opened state, when also opened from elsewhere (the column menus). Optional. */
  opened?: boolean;
  onOpenedChange?: (opened: boolean) => void;
  /** Filter builder. */
  children: ReactNode;
}

/**
 * « Filtrer » button of a toolbar and its popover.
 * @param {ToolbarFilterProps} props Component props.
 * @returns {JSX.Element} Button.
 */
export function ToolbarFilter({ count, opened, onOpenedChange, children }: ToolbarFilterProps) {
  const [ownOpened, setOwnOpened] = useState(false);
  const isOpened = opened ?? ownOpened;
  const setOpened = onOpenedChange ?? setOwnOpened;
  return (
    <Popover opened={isOpened} onChange={setOpened} position="bottom-start" shadow="md" withinPortal trapFocus={false} closeOnClickOutside>
      <Popover.Target>
        <Button onClick={() => setOpened(!isOpened)} variant={count ? 'light' : 'default'} leftSection={<FunnelIcon aria-hidden />} rightSection={count ? <CountBadge count={count} /> : undefined}>
          Filtrer
        </Button>
      </Popover.Target>
      {/* No scroll container: it would clip the dropdowns rendered inside the popover. */}
      <Popover.Dropdown maw="min(56rem, calc(100vw - 2rem))">{children}</Popover.Dropdown>
    </Popover>
  );
}

/**
 * « Trier » button of a toolbar and its popover.
 * @param {{ count: number, children: ReactNode }} props Component props: number of sorts, sort panel.
 * @returns {JSX.Element} Button.
 */
export function ToolbarSort({ count, children }: { count: number; children: ReactNode }) {
  return (
    <Popover position="bottom-start" shadow="md" withinPortal>
      <Popover.Target>
        <Button variant={count ? 'light' : 'default'} leftSection={<SortAscendingIcon aria-hidden />} rightSection={count ? <CountBadge count={count} /> : undefined}>
          Trier
        </Button>
      </Popover.Target>
      <Popover.Dropdown>{children}</Popover.Dropdown>
    </Popover>
  );
}

interface TableOptionsProps {
  /** Saved view with unsaved changes: a dot on the button, saved or reverted from the top of the panel. Optional. */
  dirty?: boolean;
  onSave?: () => void;
  onRevert?: () => void;
  /** Display options (groups, switches…). Optional. */
  display?: ReactNode;
  /** Columns panel. Optional. */
  columns?: ReactNode;
  /** Export buttons. Optional. */
  exports?: ReactNode;
  /** Width of the panel. Optional. Default = 340. */
  width?: number;
  /** Footer of the table (its totals) shown or not. Optional: without, no such switch. */
  footer?: { shown: boolean; onChange: (shown: boolean) => void };
}

/**
 * « Options » menu of a table, the same everywhere: the unsaved changes of its view (at the top), its display, its
 * columns (folded under a display, the list is long), its exports.
 * @param {TableOptionsProps} props Component props.
 * @returns {JSX.Element} Menu.
 */
export function TableOptions({ dirty = false, onSave, onRevert, display, columns, exports, width = 340, footer }: TableOptionsProps) {
  // Folded only under display options: alone, the columns are what the panel is opened for.
  const [columnsOpened, setColumnsOpened] = useState(!display);
  const sections = [
    (display || footer) && (
      <SubSection key="display" title="Affichage" gap="sm">
        {display}
        {footer && (
          <Switch
            label="Pied de tableau"
            description="Un total sous chaque colonne : compte, somme, moyenne ou médiane, choisi au pied de la colonne."
            checked={footer.shown}
            onChange={(event) => footer.onChange(event.currentTarget.checked)}
          />
        )}
      </SubSection>
    ),
    columns && (
      <Stack key="columns" gap="sm">
        <FoldHeading expanded={columnsOpened} onToggle={() => setColumnsOpened((opened) => !opened)} icon={<ColumnsIcon aria-hidden />} px="xs" py={6}>
          <Text size="sm">Colonnes</Text>
        </FoldHeading>
        <Collapse expanded={columnsOpened}>{columns}</Collapse>
      </Stack>
    ),
    exports && (
      <SubSection key="exports" title="Exporter" gap="sm">
        {exports}
      </SubSection>
    ),
  ].filter(Boolean);
  return (
    // A dot while the view has unsaved changes.
    <Indicator disabled={!dirty} size={8} offset={4} position="top-end" color="orange">
      {/* Never taller than the room left in the window: its content scrolls (the columns unfolded). */}
      <Popover position="bottom-end" shadow="md" withinPortal width={width} middlewares={{ flip: true, shift: true, size: { padding: 8 } }}>
        <Popover.Target>
          {/* eslint-disable-next-line no-restricted-syntax -- target of the options panel, with its caret. */}
          <Button variant="default" leftSection={<SlidersHorizontalIcon aria-hidden />} rightSection={<MenuCaret />} aria-label={dirty ? 'Options (modifications non enregistrées)' : 'Options'}>
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
                  <ActionButton priority="secondary" icon={<ArrowCounterClockwiseIcon aria-hidden />} onClick={onRevert}>
                    Annuler
                  </ActionButton>
                  <ActionButton icon={<FloppyDiskIcon aria-hidden />} onClick={onSave}>
                    Enregistrer
                  </ActionButton>
                </Group>
                {sections.length > 0 && <Divider />}
              </>
            )}
            {sections.map((section, index) => (
              <Stack key={index} gap="sm">
                {index > 0 && <Divider />}
                {section}
              </Stack>
            ))}
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Indicator>
  );
}
