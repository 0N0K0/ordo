import {
  ActionIcon,
  Alert,
  Button,
  CloseButton,
  Collapse,
  Divider,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useLocalStorage, useMediaQuery } from '@mantine/hooks';
import {
  AlarmIcon,
  BankIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  ChartBarIcon,
  CheckIcon,
  CheckSquareOffsetIcon,
  EnvelopeSimpleIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  GearSixIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ReceiptIcon,
  SortAscendingIcon,
  TimerIcon,
  UserPlusIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { ErrorIcon } from '../../../components/feedback-icons';
import { useWorkspace } from '../api';
import {
  buildActiveSection,
  buildArchiveSection,
  buildFavoriteSection,
  countSectionItems,
  sectionKeys,
  noClientKeys,
  subtreeKeys,
  type SortMode,
  type TreeSection,
} from '../tree';
import { useEntityActions, type EntityRef } from '../use-entity-actions';
import { MailNavBadge } from '../../mail/MailNavBadge';
import { useActiveWorkspace } from '../../workspaces/api';
import { ActiveTree } from './ActiveTree';
import { AgendaNavBadge, TasksNavBadge, TimeNavBadge, TreasuryNavBadge } from './NavBadges';
import { SidebarSection } from './SidebarSection';
import { StaticTree } from './StaticTrees';
import { TreeExpansionContext, type TreeExpansion } from './tree-expansion';

type SectionKey = 'favorites' | 'active' | 'archives';

/**
 * Small empty state inside a section.
 * @param {object} props Component props.
 * @param {ReactNode} props.icon Icon.
 * @param {string} props.message Message.
 * @param {ReactNode} [props.action] Optional call to action.
 * @returns {JSX.Element} Empty state.
 */
function SectionEmpty({
  icon,
  message,
  action,
}: {
  icon: ReactNode;
  message: string;
  action?: ReactNode;
}) {
  return (
    <Stack align="center" gap="xs" py="md" px="sm">
      <ThemeIcon variant="light" color="gray" radius="xl" size="lg">
        {icon}
      </ThemeIcon>
      <Text size="xs" c="dimmed" ta="center">
        {message}
      </Text>
      {action}
    </Stack>
  );
}

/**
 * Skeleton rows shown while the workspace loads.
 * @returns {JSX.Element} Skeleton.
 */
function TreeSkeleton() {
  return (
    <Stack gap="xs" p="xs" aria-label="Chargement">
      {[70, 55, 80, 60, 45].map((width) => (
        <Group key={width} gap="xs" wrap="nowrap">
          <Skeleton circle height={22} />
          <Skeleton height={12} width={`${width}%`} />
        </Group>
      ))}
    </Stack>
  );
}

interface MenuLink {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
  /** First of its group: a separator above it. */
  groupStart?: boolean;
}

/** Menu below « Accueil », in groups; the first ones always show, the others fold behind « Plus ». */
const MENU_LINKS: MenuLink[] = [
  { to: '/tasks', label: 'Mes tâches', icon: <CheckSquareOffsetIcon aria-hidden />, badge: <TasksNavBadge />, groupStart: true },
  { to: '/calendar', label: 'Agenda', icon: <CalendarBlankIcon aria-hidden />, badge: <AgendaNavBadge /> },
  { to: '/time', label: 'Chronos', icon: <TimerIcon aria-hidden />, badge: <TimeNavBadge />, groupStart: true },
  { to: '/alarms', label: 'Alarmes', icon: <AlarmIcon aria-hidden /> },
  { to: '/mail', label: 'Mails', icon: <EnvelopeSimpleIcon aria-hidden />, badge: <MailNavBadge />, groupStart: true },
  { to: '/accounting', label: 'Facturation', icon: <ReceiptIcon aria-hidden />, groupStart: true },
  { to: '/treasury', label: 'Trésorerie', icon: <BankIcon aria-hidden />, badge: <TreasuryNavBadge /> },
  { to: '/documents', label: 'Documents', icon: <FolderOpenIcon aria-hidden />, groupStart: true },
  { to: '/dashboards', label: 'Tableaux de bord', icon: <ChartBarIcon aria-hidden />, groupStart: true },
];
const ALWAYS_SHOWN = 3;
/** Pages a personal workspace does not have. */
const PRO_ONLY = new Set(['/accounting']);

/**
 * Whether a menu link is the page open (or one of its sub-pages).
 * @param {string} to Link.
 * @param {string} pathname Current path.
 * @returns {boolean} True when active.
 */
const isActive = (to: string, pathname: string) => pathname === to || pathname.startsWith(`${to}/`);

/**
 * Entries of the menu, with a separator above the first of each group.
 * @param {{ links: MenuLink[], pathname: string }} props Component props.
 * @returns {JSX.Element} Entries.
 */
function MenuLinks({ links, pathname }: { links: MenuLink[]; pathname: string }) {
  return links.map((item) => (
    <Fragment key={item.to}>
      {item.groupStart && <Divider my={4} />}
      <NavLink component={Link} to={item.to} label={item.label} leftSection={item.icon} rightSection={item.badge} active={isActive(item.to, pathname)} />
    </Fragment>
  ));
}

/**
 * Sidebar with the client and project tree: search, sort, favorites, active items and archives.
 * @returns {JSX.Element} Sidebar content.
 */
export function Sidebar() {
  const workspace = useWorkspace();
  // A personal workspace has no clients nor invoicing.
  const { perso } = useActiveWorkspace();
  const links = perso ? MENU_LINKS.filter((item) => !PRO_ONLY.has(item.to)) : MENU_LINKS;
  const moreLinks = links.slice(ALWAYS_SHOWN);
  const actions = useEntityActions();
  const { pathname } = useLocation();
  const touch = useMediaQuery('(hover: none), (max-width: 48em)');
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
  const [moreOpen, setMoreOpen] = useLocalStorage<boolean>({
    key: 'ordo.sidebar.more',
    // Each window keeps its own (the last change is what a new window starts with).
    sync: false,
    defaultValue: false,
  });
  const activeMore = moreLinks.find((item) => isActive(item.to, pathname));
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
        to="/"
        label="Accueil"
        leftSection={<HouseIcon aria-hidden />}
        active={pathname === '/'}
      />
      <MenuLinks links={links.slice(0, ALWAYS_SHOWN)} pathname={pathname} />
      {/* Collapsed: the page open stays reachable. */}
      {!moreOpen && activeMore && <MenuLinks links={[{ ...activeMore, groupStart: true }]} pathname={pathname} />}
      <Collapse expanded={moreOpen} transitionDuration={150}>
        <MenuLinks links={moreLinks} pathname={pathname} />
      </Collapse>
      <NavLink
        component="button"
        label={moreOpen ? 'Moins' : 'Plus'}
        leftSection={
          <CaretDownIcon
            aria-hidden
            style={{
              transform: moreOpen ? 'rotate(180deg)' : undefined,
              transition: 'transform 150ms ease',
            }}
          />
        }
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen(!moreOpen)}
        c="dimmed"
        style={{ borderBottom: '1px solid var(--app-shell-border-color)' }}
      />
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
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Tooltip label="Trier">
              <ActionIcon variant="default" size="input-xs" aria-label="Trier">
                <SortAscendingIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Trier</Menu.Label>
            <Menu.Item
              leftSection={
                sort === 'manual' ? (
                  <CheckIcon aria-hidden />
                ) : (
                  <span style={{ width: '1.25em' }} />
                )
              }
              onClick={() => setSort('manual')}
            >
              Ordre manuel
            </Menu.Item>
            <Menu.Item
              leftSection={
                sort === 'name' ? (
                  <CheckIcon aria-hidden />
                ) : (
                  <span style={{ width: '1.25em' }} />
                )
              }
              onClick={() => setSort('name')}
            >
              Alphabétique
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Tooltip label="Créer">
              <ActionIcon
                size="input-xs"
                aria-label={perso ? 'Créer un projet' : 'Créer un client ou un projet'}
              >
                <PlusIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            {!perso && (
              <Menu.Item
                leftSection={<UserPlusIcon aria-hidden />}
                onClick={() => actions.openClientForm()}
              >
                Nouveau client
              </Menu.Item>
            )}
            <Menu.Item
              leftSection={<FolderPlusIcon aria-hidden />}
              onClick={() => actions.openProjectForm()}
            >
              Nouveau projet
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <ScrollArea style={{ flex: 1 }} px="xs" type="scroll">
        {workspace.isPending && <TreeSkeleton />}
        {workspace.isError && (
          <Alert color="red" icon={<ErrorIcon />} m="xs">
            {workspace.error.message}
          </Alert>
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
              actions={
                <>
                  {!perso && (
                    <Menu.Item
                      leftSection={<UserPlusIcon aria-hidden />}
                      onClick={() => actions.openClientForm()}
                    >
                      Nouveau client
                    </Menu.Item>
                  )}
                  <Menu.Item
                    leftSection={<FolderPlusIcon aria-hidden />}
                    onClick={() => actions.openProjectForm()}
                  >
                    Nouveau projet
                  </Menu.Item>
                </>
              }
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
                <SectionEmpty
                  icon={perso ? <FolderOpenIcon aria-hidden /> : <UsersThreeIcon aria-hidden />}
                  message={noResult ?? (perso ? 'Aucun projet pour le moment.' : 'Aucun client pour le moment.')}
                  action={
                    !searching && (
                      <Stack gap="xs" align="stretch">
                        {!perso && (
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<UserPlusIcon aria-hidden />}
                            onClick={() => actions.openClientForm()}
                          >
                            Ajouter un client
                          </Button>
                        )}
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<FolderPlusIcon aria-hidden />}
                          onClick={() => actions.openProjectForm()}
                        >
                          Ajouter un projet
                        </Button>
                      </Stack>
                    )
                  }
                />
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
        to="/settings"
        label="Paramètres"
        leftSection={<GearSixIcon aria-hidden />}
        active={pathname === '/settings'}
        style={{ borderTop: '1px solid var(--app-shell-border-color)' }}
      />
    </Stack>
  );
}
