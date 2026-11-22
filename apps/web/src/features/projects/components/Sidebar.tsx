import { IconAction } from '../../../components/actions/IconAction';
import { ActionsMenu, type RowMenuEntry } from '../../../components/actions/ActionsMenu';
import { ErrorAlert } from '../../../components/feedback/ErrorAlert';
import { ActionsRow } from '../../../components/actions/ActionsRow';
import { ActionButton } from '../../../components/actions/ActionButton';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { CloseButton, Box, Group, NavLink, ScrollArea, Stack, TextInput } from '@mantine/core';
import { useLocalStorage, useMediaQuery } from '@mantine/hooks';
import { PackageIcon, ArchiveIcon, FolderOpenIcon, MagnifyingGlassIcon, PlusIcon, SortAscendingIcon, SquaresFourIcon, UsersThreeIcon, WalletIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

import { useProjectTree } from '../api';
import { buildActiveSection, buildArchiveSection, buildFavoriteSection, clientKeys, isEmptySection, orphanKeys, sectionKeys, subtreeKeys, type SortMode, type TreeSection } from '../lib/tree';
import { useEntityActions, type EntityRef } from '../hooks/use-entity-actions';
import { MailNavBadge } from '../../mail/components/MailNavBadge';
import { useActiveWorkspace } from '../../workspaces/api';
import { ActiveTree } from './ActiveTree';
import { AgendaNavBadge, AlarmsNavBadge, RoutinesNavBadge, TasksNavBadge, TimeNavBadge, TreasuryNavBadge } from './NavBadges';
import { SidebarSection, type SidebarSectionChrome } from './SidebarSection';
import { PAGES, type PageKey } from '../../../app/pages';
import { newEntityEntries } from '../lib/fold-entries';
import { StaticTree } from './StaticTrees';
import { TreeExpansionContext, type TreeExpansion } from '../lib/tree-expansion';
import { PHONE_QUERY } from '../../../lib/use-is-phone';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { useFoldedIds } from '../../../components/tree/use-folded-ids';

/** Sections of the sidebar: « Clients » (« Projets » in a personal workspace) is `active`, the projects without client `projects`. */
type SectionKey = 'favorites' | 'active' | 'projects' | 'archives';

/** Sections open at first: all but the archives. */
const SECTIONS_OPENED: Record<SectionKey, boolean> = { favorites: true, active: true, projects: true, archives: false };

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

/**
 * Empty part of the tree: its message, and the buttons of its creations (not while searching).
 * @param {{ icon: ReactNode, message: string, entries?: RowMenuEntry[] }} props Component props.
 * @param {ReactNode} props.icon Icon.
 * @param {string} props.message Message.
 * @param {RowMenuEntry[]} [props.entries] Creations offered as buttons. Optional.
 * @returns {JSX.Element} Empty state.
 */
function TreeEmpty({ icon, message, entries }: { icon: ReactNode; message: string; entries?: RowMenuEntry[] }) {
  return (
    <Stack gap="xs" px="sm" py="xs">
      <EmptyState compact icon={icon} message={message} />
      {entries && (
        <ActionsRow>
          {entries.map(
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
      )}
    </Stack>
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
  const { path, label, icon: PageIcon } = PAGES[key];
  return { to: path, label, icon: <PageIcon aria-hidden />, badge };
}

/** Menu below « Accueil »: groups folding and unfolding their pages. */
const MENU_GROUPS: MenuGroup[] = [
  {
    label: 'Activités',
    icon: <SquaresFourIcon aria-hidden />,
    links: [pageLink('tasks', <TasksNavBadge />), pageLink('routines', <RoutinesNavBadge />), pageLink('calendar', <AgendaNavBadge />), pageLink('time', <TimeNavBadge />), pageLink('alarms', <AlarmsNavBadge />)],
  },
  {
    label: 'Économat',
    icon: <PackageIcon aria-hidden />,
    links: [pageLink('shopping'), pageLink('sheets'), pageLink('stock')],
  },
  {
    label: 'Finances',
    icon: <WalletIcon aria-hidden />,
    links: [pageLink('accounting'), pageLink('treasury', <TreasuryNavBadge />)],
  },
  {
    label: 'Ressources',
    icon: <ArchiveIcon aria-hidden />,
    links: [pageLink('mail', <MailNavBadge />), pageLink('documents'), pageLink('dashboards')],
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
  const { ids: unfolded, set: setUnfolded } = useFoldedIds('ordo.sidebar.openGroups');
  const current = groups.find((group) => group.links.some((item) => isActive(item.to, pathname)))?.label;
  // Going to a page of a folded group unfolds it.
  useEffect(() => {
    if (current) setUnfolded([current], true);
  }, [current, setUnfolded]);

  return groups.map((group) => {
    const opened = unfolded.has(group.label);
    return (
      <NavLink
        key={group.label}
        label={group.label}
        leftSection={group.icon}
        opened={opened}
        onChange={(next) => setUnfolded([group.label], next)}
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
  const workspace = useProjectTree();
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
    defaultValue: SECTIONS_OPENED,
  });
  const collapsed = useFoldedIds('ordo.sidebar.collapsed');

  const searching = search.trim().length > 0;
  const data = workspace.data;
  const favorites = useMemo(() => (data ? buildFavoriteSection(data, sort, search) : null), [data, sort, search]);
  const active = useMemo(() => (data ? buildActiveSection(data, sort, search) : null), [data, sort, search]);
  const archives = useMemo(() => (data ? buildArchiveSection(data, sort, search) : null), [data, sort, search]);
  // Without favorites nor archives (whatever the search), a personal workspace shows its projects straight in the sidebar.
  const projectsSection = useMemo(() => !perso || (data !== undefined && !(isEmptySection(buildFavoriteSection(data, 'manual', '')) && isEmptySection(buildArchiveSection(data, 'manual', '')))), [perso, data]);

  // While searching, every branch is open so matches are visible.
  const isExpanded = (key: string) => searching || !collapsed.ids.has(key);
  const toggleNode = collapsed.toggle;
  // A section missing from what was kept (added since) takes its first state.
  const isOpened = (key: SectionKey) => sections[key] ?? SECTIONS_OPENED[key];
  const toggleSection = (key: SectionKey) => setSections((current) => ({ ...current, [key]: !(current[key] ?? SECTIONS_OPENED[key]) }));

  /**
   * Expands or collapses a set of nodes.
   * @param {string[]} keys Expand keys.
   * @param {boolean} expanded Target state.
   * @returns {void}
   */
  const setKeysExpanded = (keys: string[], expanded: boolean) => collapsed.set(keys, !expanded);

  /**
   * Fold / unfold actions of one tree, for the menus of its rows.
   * @param {TreeSection} section Tree content.
   * @param {string} prefix Expand key prefix of the tree.
   * @returns {TreeExpansion} Actions.
   */
  const expansionFor = (section: TreeSection, prefix: string): TreeExpansion => {
    const keysOf = (entity: EntityRef) => subtreeKeys(section, prefix, { type: entity.type, id: entity.item.id });
    return {
      hasChildren: (entity) => keysOf(entity).length > 0,
      setSubtreeExpanded: (entity, expanded) => setKeysExpanded(keysOf(entity), expanded),
    };
  };

  /**
   * Section menu handler folding or unfolding the given nodes, or undefined when there is nothing to fold.
   * @param {string[]} keys Expand keys of the section.
   * @returns {((expanded: boolean) => void) | undefined} Handler.
   */
  const allExpandedHandler = (keys: string[]) => (keys.length > 0 ? (expanded: boolean) => setKeysExpanded(keys, expanded) : undefined);

  /**
   * Header of a section: its title, its open state and its menu.
   * @param {SectionKey} key Section.
   * @param {string} title Title.
   * @param {string[]} keys Expand keys of its nodes (« Tout déplier » / « Tout replier »).
   * @param {RowMenuEntry[]} [entries] Creations of its menu. Optional.
   * @returns {SidebarSectionChrome} Header.
   */
  const chrome = (key: SectionKey, title: string, keys: string[], entries?: RowMenuEntry[]): SidebarSectionChrome => ({
    title,
    opened: isOpened(key),
    onToggle: () => toggleSection(key),
    onSetAllExpanded: allExpandedHandler(keys),
    actions: entries,
  });

  const hasFavorites = favorites !== null && !isEmptySection(favorites);
  const hasArchives = archives !== null && !isEmptySection(archives);
  const noResult = searching ? 'Aucun résultat.' : null;
  const projectEntries = newEntityEntries(actions, true);

  return (
    <Stack h="100%" gap={0}>
      <NavLink component={Link} to={PAGES.home.path} label={PAGES.home.label} leftSection={<PAGES.home.icon aria-hidden />} active={pathname === '/'} />
      <Box pb="xs" style={{ borderBottom: '1px solid var(--app-shell-border-color)' }}>
        <MenuGroups groups={groups} pathname={pathname} />
      </Box>
      <Group gap="xs" p="sm" wrap="nowrap">
        <TextInput
          size="xs"
          placeholder="Rechercher"
          aria-label="Rechercher un client ou un projet"
          leftSection={<MagnifyingGlassIcon aria-hidden />}
          rightSection={searching ? <CloseButton size="xs" aria-label="Effacer la recherche" onClick={() => setSearch('')} /> : null}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <ActionsMenu
          about="la barre latérale"
          target={
            <IconAction label="Trier" variant="light" size="input-xs">
              <SortAscendingIcon aria-hidden />
            </IconAction>
          }
          items={[
            { section: 'Trier' },
            { label: 'Ordre manuel', checked: sort === 'manual', onClick: () => setSort('manual') },
            { label: 'Alphabétique', checked: sort === 'name', onClick: () => setSort('name') },
          ]}
        />
        <ActionsMenu
          about="la barre latérale"
          target={
            <IconAction label="Créer" size="input-xs" aria-label={perso ? 'Créer un projet' : 'Créer un client ou un projet'}>
              <PlusIcon aria-hidden />
            </IconAction>
          }
          items={newEntityEntries(actions, perso)}
        />
      </Group>

      <ScrollArea style={{ flex: 1 }} px="xs" type="scroll">
        {workspace.isPending && <TreeSkeleton />}
        {workspace.isError && <ErrorAlert m="xs">{workspace.error.message}</ErrorAlert>}
        {data && favorites && active && archives && (
          <>
            {/* Favorites and archives only show when they have content (or matches while searching). */}
            {hasFavorites && (
              <SidebarSection {...chrome('favorites', 'Favoris', sectionKeys(favorites, 'fav:'))}>
                <TreeExpansionContext.Provider value={expansionFor(favorites, 'fav:')}>
                  <StaticTree section={favorites} label="Favoris" keyPrefix="fav:" isExpanded={isExpanded} onToggle={toggleNode} />
                </TreeExpansionContext.Provider>
              </SidebarSection>
            )}

            {/*
              PRO: « Clients » with their projects, then « Projets » with the projects without client (when there are).
              PERSO: « Projets », or the projects straight in the sidebar without favorites nor archives.
            */}
            <TreeExpansionContext.Provider value={expansionFor(active, '')}>
              <ActiveTree
                section={active}
                dndEnabled={sort === 'manual' && !searching && !touch}
                isExpanded={isExpanded}
                onToggle={toggleNode}
                {...(perso
                  ? {
                      projects: projectsSection ? chrome('active', 'Projets', sectionKeys(active, ''), projectEntries) : null,
                      projectsEmpty: <TreeEmpty icon={<FolderOpenIcon aria-hidden />} message={noResult ?? 'Aucun projet pour le moment.'} entries={searching ? undefined : projectEntries} />,
                    }
                  : {
                      // While searching, « Clients » without match hides when projects without client match.
                      clients: searching && active.clients.length === 0 && active.orphans.length > 0 ? undefined : chrome('active', 'Clients', clientKeys(active, ''), newEntityEntries(actions, false)),
                      clientsEmpty: (
                        <TreeEmpty icon={<UsersThreeIcon aria-hidden />} message={noResult ?? 'Aucun client pour le moment.'} entries={searching ? undefined : newEntityEntries(actions, false)} />
                      ),
                      projects: chrome('projects', 'Projets', orphanKeys(active, ''), projectEntries),
                    })}
              />
            </TreeExpansionContext.Provider>

            {hasArchives && (
              <SidebarSection {...chrome('archives', 'Archives', sectionKeys(archives, 'archive:'))}>
                <TreeExpansionContext.Provider value={expansionFor(archives, 'archive:')}>
                  <StaticTree section={archives} label="Archives" keyPrefix="archive:" isExpanded={isExpanded} onToggle={toggleNode} />
                </TreeExpansionContext.Provider>
              </SidebarSection>
            )}
          </>
        )}
      </ScrollArea>

      <NavLink
        component={Link}
        to={PAGES.settings.path}
        label={PAGES.settings.label}
        leftSection={<PAGES.settings.icon aria-hidden />}
        active={pathname === PAGES.settings.path}
        style={{ borderTop: '1px solid var(--app-shell-border-color)' }}
      />
    </Stack>
  );
}
