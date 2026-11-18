import { ActionsMenu } from '../../../components/data-table/cells/RowActions';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { ActionsRow } from '../../../components/actions/ActionsRow';
import { ActionButton } from '../../../components/actions/ActionButton';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { ActionIcon, CloseButton, Box, Group, NavLink, ScrollArea, Stack, TextInput, Tooltip } from '@mantine/core';
import { useLocalStorage, useMediaQuery } from '@mantine/hooks';
import { PackageIcon, ArchiveIcon, FolderOpenIcon, MagnifyingGlassIcon, PlusIcon, SortAscendingIcon, SquaresFourIcon, UsersThreeIcon, WalletIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

import { useWorkspace } from '../api';
import { buildActiveSection, buildArchiveSection, buildFavoriteSection, countSectionItems, sectionKeys, noClientKeys, subtreeKeys, type SortMode, type TreeSection } from '../lib/tree';
import { useEntityActions, type EntityRef } from '../hooks/use-entity-actions';
import { MailNavBadge } from '../../mail/components/MailNavBadge';
import { useActiveWorkspace } from '../../workspaces/api';
import { ActiveTree } from './ActiveTree';
import { AgendaNavBadge, TasksNavBadge, TimeNavBadge, TreasuryNavBadge } from './NavBadges';
import { SidebarSection } from './SidebarSection';
import { PAGES, type PageKey } from '../../../app/pages';
import { newEntityEntries } from '../lib/fold-entries';
import { StaticTree } from './StaticTrees';
import { TreeExpansionContext, type TreeExpansion } from '../lib/tree-expansion';
import { PHONE_QUERY } from '../../../lib/use-is-phone';
import { EmptyState } from '../../../components/feedback/EmptyState';

type SectionKey = 'favorites' | 'active' | 'archives';

/**
 * Skeleton rows shown while the workspace loads.
 * @returns {JSX.Element} Skeleton.
 */
function TreeSkeleton() {
  return (
    <div style={{ padding: 'var(--mantine-spacing-xs)' }}>
      <ListSkeleton items={5} dense avatar />
    </div>
  );
}

interface MenuLink {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
}

interface MenuGroup {
  label: string;
  icon: ReactNode;
  links: MenuLink[];
}

/**
 * Link of the menu to a page of the app (its address, name and icon from the registry).
 * @param {PageKey} key Page.
 * @param {ReactNode} [badge] Count after its name. Optional.
 * @returns {MenuLink} Link.
 */
function pageLink(key: PageKey, badge?: ReactNode): MenuLink {
  const { path, title, icon: PageIcon } = PAGES[key];
  return { to: path, label: title, icon: <PageIcon aria-hidden />, badge };
}

/** Menu below « Accueil »: groups folding and unfolding their pages. */
const MENU_GROUPS: MenuGroup[] = [
  {
    label: 'Activités',
    icon: <SquaresFourIcon aria-hidden />,
    links: [
      pageLink('tasks', <TasksNavBadge />),
      pageLink('routines'),
      pageLink('calendar', <AgendaNavBadge />),
      pageLink('time', <TimeNavBadge />),
      pageLink('alarms'),
    ],
  },
  {
    label: 'Économat',
    icon: <PackageIcon aria-hidden />,
    links: [
      pageLink('shopping'),
      pageLink('sheets'),
      pageLink('stock'),
    ],
  },
  {
    label: 'Finances',
    icon: <WalletIcon aria-hidden />,
    links: [
      pageLink('accounting'),
      pageLink('treasury', <TreasuryNavBadge />),
    ],
  },
  {
    label: 'Ressources',
    icon: <ArchiveIcon aria-hidden />,
    links: [
      pageLink('mail', <MailNavBadge />),
      pageLink('documents'),
      pageLink('dashboards'),
    ],
  },
];
/** Pages a personal workspace does not have. */
const PRO_ONLY = new Set([PAGES.accounting.path]);

/**
 * Whether a menu link is the page open (or one of its sub-pages).
 * @param {string} to Link.
 * @param {string} pathname Current path.
 * @returns {boolean} True when active.
 */
const isActive = (to: string, pathname: string) => pathname === to || pathname.startsWith(`${to}/`);

/**
 * Groups of the menu, folded or unfolded from their own item: their pages show below it, indented. They start
 * folded; the state of each group is kept per window; the group of the page open is unfolded, and highlighted
 * while folded.
 * @param {{ groups: MenuGroup[], pathname: string }} props Component props.
 * @param {MenuGroup[]} props.groups Groups.
 * @param {string} props.pathname Current path.
 * @returns {JSX.Element} Groups.
 */
function MenuGroups({ groups, pathname }: { groups: MenuGroup[]; pathname: string }) {
  const [unfolded, setUnfolded] = useLocalStorage<string[]>({
    key: 'ordo.sidebar.openGroups',
    // Each window keeps its own (the last change is what a new window starts with).
    sync: false,
    defaultValue: [],
    // A value of another shape (an older version, edited by hand) is dropped.
    deserialize: (value) => {
      try {
        const parsed: unknown = value === undefined ? [] : JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((label): label is string => typeof label === 'string') : [];
      } catch {
        return [];
      }
    },
  });
  const current = groups.find((group) => group.links.some((item) => isActive(item.to, pathname)))?.label;
  // Going to a page of a folded group unfolds it.
  useEffect(() => {
    if (current) setUnfolded((labels) => (labels.includes(current) ? labels : [...labels, current]));
  }, [current, setUnfolded]);

  return groups.map((group) => {
    const opened = unfolded.includes(group.label);
    return (
      <NavLink
        key={group.label}
        label={group.label}
        leftSection={group.icon}
        opened={opened}
        onChange={(next) => setUnfolded((labels) => (next ? [...labels, group.label] : labels.filter((label) => label !== group.label)))}
        active={!opened && group.label === current}
        childrenOffset="md"
      >
        {group.links.map((item) => (
          <NavLink key={item.to} component={Link} to={item.to} label={item.label} leftSection={item.icon} rightSection={item.badge} active={isActive(item.to, pathname)} />
        ))}
      </NavLink>
    );
  });
}

/**
 * Sidebar with the client and project tree: search, sort, favorites, active items and archives.
 * @returns {JSX.Element} Sidebar content.
 */
export function Sidebar() {
  const workspace = useWorkspace();
  // A personal workspace has no clients nor invoicing.
  const { perso } = useActiveWorkspace();
  const groups = MENU_GROUPS.map((group) => ({ ...group, links: perso ? group.links.filter((item) => !PRO_ONLY.has(item.to)) : group.links })).filter((group) => group.links.length > 0);
  const actions = useEntityActions();
  const { pathname } = useLocation();
  const touch = useMediaQuery(`(hover: none), ${PHONE_QUERY}`);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useLocalStorage<SortMode>({
    key: 'ordo.sidebar.sort',
    // Each window keeps its own (the last change is what a new window starts with).
    sync: false,
    defaultValue: 'manual',
  });
  const [sections, setSections] = useLocalStorage<Record<SectionKey, boolean>>({
    key: 'ordo.sidebar.sections',
    // Each window keeps its own (the last change is what a new window starts with).
    sync: false,
    defaultValue: { favorites: true, active: true, archives: false },
  });
  const [collapsed, setCollapsed] = useLocalStorage<string[]>({
    key: 'ordo.sidebar.collapsed',
    // Each window keeps its own (the last change is what a new window starts with).
    sync: false,
    defaultValue: [],
  });

  const searching = search.trim().length > 0;
  const data = workspace.data;
  const favorites = useMemo(
    () => (data ? buildFavoriteSection(data, sort, search) : null),
    [data, sort, search],
  );
  const active = useMemo(
    () => (data ? buildActiveSection(data, sort, search) : null),
    [data, sort, search],
  );
  const archives = useMemo(
    () => (data ? buildArchiveSection(data, sort, search) : null),
    [data, sort, search],
  );

  // While searching, every branch is open so matches are visible.
  const isExpanded = (key: string) => searching || !collapsed.includes(key);
  const toggleNode = (key: string) =>
    setCollapsed((current) =>
      current.includes(key)
        ? current.filter((id) => id !== key)
        : [...current, key],
    );
  const toggleSection = (key: SectionKey) =>
    setSections((current) => ({ ...current, [key]: !current[key] }));

  /**
   * Expands or collapses a set of nodes.
   * @param {string[]} keys Expand keys.
   * @param {boolean} expanded Target state.
   * @returns {void}
   */
  const setKeysExpanded = (keys: string[], expanded: boolean) =>
    setCollapsed((current) =>
      expanded
        ? current.filter((key) => !keys.includes(key))
        : [...new Set([...current, ...keys])],
    );

  /**
   * Fold / unfold actions of one tree, for the menus of its rows.
   * @param {TreeSection} section Tree content.
   * @param {string} prefix Expand key prefix of the tree.
   * @returns {TreeExpansion} Actions.
   */
  const expansionFor = (
    section: TreeSection,
    prefix: string,
  ): TreeExpansion => {
    const keysOf = (entity: EntityRef) =>
      subtreeKeys(section, prefix, { type: entity.type, id: entity.item.id });
    const groupKeys = noClientKeys(section, prefix);
    return {
      hasChildren: (entity) => keysOf(entity).length > 0,
      setSubtreeExpanded: (entity, expanded) =>
        setKeysExpanded(keysOf(entity), expanded),
      noClientFoldable: groupKeys.length > 0,
      setNoClientExpanded: (expanded) => setKeysExpanded(groupKeys, expanded),
    };
  };

  /**
   * Section menu handler folding or unfolding a whole tree, or undefined when it has nothing to fold.
   * @param {TreeSection} section Tree content.
   * @param {string} prefix Expand key prefix of the tree.
   * @returns {((expanded: boolean) => void) | undefined} Handler.
   */
  const allExpandedHandler = (section: TreeSection, prefix: string) => {
    const keys = sectionKeys(section, prefix);
    return keys.length > 0
      ? (expanded: boolean) => setKeysExpanded(keys, expanded)
      : undefined;
  };

  const activeCount = active
    ? active.clients.length + active.orphans.length
    : 0;
  const favoriteCount = favorites ? countSectionItems(favorites) : 0;
  const archiveCount = archives ? countSectionItems(archives) : 0;
  const noResult = searching ? 'Aucun résultat.' : null;

  return (
    <Stack h="100%" gap={0}>
      <NavLink
        component={Link}
        to={PAGES.home.path}
        label={PAGES.home.title}
        leftSection={<PAGES.home.icon aria-hidden />}
        active={pathname === '/'}
      />
      <Box pb="xs" style={{ borderBottom: '1px solid var(--app-shell-border-color)' }}>
        <MenuGroups groups={groups} pathname={pathname} />
      </Box>
      <Group gap="xs" p="sm" wrap="nowrap">
        <TextInput
          size="xs"
          placeholder="Rechercher"
          aria-label="Rechercher un client ou un projet"
          leftSection={<MagnifyingGlassIcon aria-hidden />}
          rightSection={
            searching ? (
              <CloseButton
                size="xs"
                aria-label="Effacer la recherche"
                onClick={() => setSearch('')}
              />
            ) : null
          }
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <ActionsMenu
          name="la barre latérale"
          target={
            <Tooltip label="Trier">
              <ActionIcon variant="default" size="input-xs" aria-label="Trier">
                <SortAscendingIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          }
          items={[
            { section: 'Trier' },
            { label: 'Ordre manuel', checked: sort === 'manual', onClick: () => setSort('manual') },
            { label: 'Alphabétique', checked: sort === 'name', onClick: () => setSort('name') },
          ]}
        />
        <ActionsMenu
          name="la barre latérale"
          target={
            <Tooltip label="Créer">
              <ActionIcon size="input-xs" aria-label={perso ? 'Créer un projet' : 'Créer un client ou un projet'}>
                <PlusIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          }
          items={newEntityEntries(actions, perso)}
        />
      </Group>

      <ScrollArea style={{ flex: 1 }} px="xs" type="scroll">
        {workspace.isPending && <TreeSkeleton />}
        {workspace.isError && (
          <ErrorAlert m="xs">
            {workspace.error.message}
          </ErrorAlert>
        )}
        {data && favorites && active && archives && (
          <>
            {/* Favorites and archives only show when they have content (or matches while searching). */}
            {favoriteCount > 0 && (
              <SidebarSection
                title="Favoris"
                count={favoriteCount}
                opened={sections.favorites}
                onToggle={() => toggleSection('favorites')}
                onSetAllExpanded={allExpandedHandler(favorites, 'fav:')}
              >
                <TreeExpansionContext.Provider
                  value={expansionFor(favorites, 'fav:')}
                >
                  <StaticTree
                    section={favorites}
                    label="Favoris"
                    keyPrefix="fav:"
                    isExpanded={isExpanded}
                    onToggle={toggleNode}
                  />
                </TreeExpansionContext.Provider>
              </SidebarSection>
            )}

            <SidebarSection
              title={perso ? 'Projets' : 'Clients'}
              count={active.clients.length}
              opened={sections.active}
              onToggle={() => toggleSection('active')}
              onSetAllExpanded={allExpandedHandler(active, '')}
              actions={newEntityEntries(actions, perso)}
            >
              {activeCount > 0 ? (
                <TreeExpansionContext.Provider value={expansionFor(active, '')}>
                  <ActiveTree
                    section={active}
                    dndEnabled={sort === 'manual' && !searching && !touch}
                    isExpanded={isExpanded}
                    onToggle={toggleNode}
                  />
                </TreeExpansionContext.Provider>
              ) : (
                <Stack gap="xs" px="sm" py="xs">
                  <EmptyState compact icon={perso ? <FolderOpenIcon aria-hidden /> : <UsersThreeIcon aria-hidden />} message={noResult ?? (perso ? 'Aucun projet pour le moment.' : 'Aucun client pour le moment.')} />
                  {
                    !searching && (
                      <ActionsRow>
                        {newEntityEntries(actions, perso).map(
                          (entry) =>
                            entry &&
                            entry !== 'divider' &&
                            'label' in entry && (
                              <ActionButton key={entry.label} priority="secondary" size="xs" icon={entry.icon} onClick={entry.onClick}>
                                {entry.label}
                              </ActionButton>
                            ),
                        )}
                      </ActionsRow>
                    )
                  }
                </Stack>
              )}
            </SidebarSection>

            {archiveCount > 0 && (
              <SidebarSection
                title="Archives"
                count={archiveCount}
                opened={sections.archives}
                onToggle={() => toggleSection('archives')}
                onSetAllExpanded={allExpandedHandler(archives, 'archive:')}
              >
                <TreeExpansionContext.Provider
                  value={expansionFor(archives, 'archive:')}
                >
                  <StaticTree
                    section={archives}
                    label="Archives"
                    keyPrefix="archive:"
                    isExpanded={isExpanded}
                    onToggle={toggleNode}
                  />
                </TreeExpansionContext.Provider>
              </SidebarSection>
            )}
          </>
        )}
      </ScrollArea>

      <NavLink
        component={Link}
        to={PAGES.settings.path}
        label={PAGES.settings.title}
        leftSection={<PAGES.settings.icon aria-hidden />}
        active={pathname === PAGES.settings.path}
        style={{ borderTop: '1px solid var(--app-shell-border-color)' }}
      />
    </Stack>
  );
}
