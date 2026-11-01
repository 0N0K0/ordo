import {
  ActionIcon,
  Alert,
  Button,
  CloseButton,
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
  CheckIcon,
  CheckSquareOffsetIcon,
  FolderPlusIcon,
  GearSixIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SortAscendingIcon,
  UserPlusIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import { useMemo, useState, type ReactNode } from 'react';
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
import { ActiveTree } from './ActiveTree';
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
function SectionEmpty({ icon, message, action }: { icon: ReactNode; message: string; action?: ReactNode }) {
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

/**
 * Sidebar with the client and project tree: search, sort, favorites, active items and archives.
 * @returns {JSX.Element} Sidebar content.
 */
export function Sidebar() {
  const workspace = useWorkspace();
  const actions = useEntityActions();
  const { pathname } = useLocation();
  const touch = useMediaQuery('(hover: none), (max-width: 48em)');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useLocalStorage<SortMode>({ key: 'ordo.sidebar.sort', defaultValue: 'manual' });
  const [sections, setSections] = useLocalStorage<Record<SectionKey, boolean>>({
    key: 'ordo.sidebar.sections',
    defaultValue: { favorites: true, active: true, archives: false },
  });
  const [collapsed, setCollapsed] = useLocalStorage<string[]>({ key: 'ordo.sidebar.collapsed', defaultValue: [] });

  const searching = search.trim().length > 0;
  const data = workspace.data;
  const favorites = useMemo(() => (data ? buildFavoriteSection(data, sort, search) : null), [data, sort, search]);
  const active = useMemo(() => (data ? buildActiveSection(data, sort, search) : null), [data, sort, search]);
  const archives = useMemo(() => (data ? buildArchiveSection(data, sort, search) : null), [data, sort, search]);

  // While searching, every branch is open so matches are visible.
  const isExpanded = (key: string) => searching || !collapsed.includes(key);
  const toggleNode = (key: string) =>
    setCollapsed((current) => (current.includes(key) ? current.filter((id) => id !== key) : [...current, key]));
  const toggleSection = (key: SectionKey) => setSections((current) => ({ ...current, [key]: !current[key] }));

  /**
   * Expands or collapses a set of nodes.
   * @param {string[]} keys Expand keys.
   * @param {boolean} expanded Target state.
   * @returns {void}
   */
  const setKeysExpanded = (keys: string[], expanded: boolean) =>
    setCollapsed((current) =>
      expanded ? current.filter((key) => !keys.includes(key)) : [...new Set([...current, ...keys])],
    );

  /**
   * Fold / unfold actions of one tree, for the menus of its rows.
   * @param {TreeSection} section Tree content.
   * @param {string} prefix Expand key prefix of the tree.
   * @returns {TreeExpansion} Actions.
   */
  const expansionFor = (section: TreeSection, prefix: string): TreeExpansion => {
    const keysOf = (entity: EntityRef) => subtreeKeys(section, prefix, { type: entity.type, id: entity.item.id });
    const groupKeys = noClientKeys(section, prefix);
    return {
      hasChildren: (entity) => keysOf(entity).length > 0,
      setSubtreeExpanded: (entity, expanded) => setKeysExpanded(keysOf(entity), expanded),
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
    return keys.length > 0 ? (expanded: boolean) => setKeysExpanded(keys, expanded) : undefined;
  };

  const activeCount = active ? active.clients.length + active.orphans.length : 0;
  const favoriteCount = favorites ? countSectionItems(favorites) : 0;
  const archiveCount = archives ? countSectionItems(archives) : 0;
  const noResult = searching ? 'Aucun résultat.' : null;

  return (
    <Stack h="100%" gap={0}>
      <Group gap="xs" p="sm" wrap="nowrap">
        <TextInput
          size="xs"
          placeholder="Rechercher"
          aria-label="Rechercher un client ou un projet"
          leftSection={<MagnifyingGlassIcon aria-hidden />}
          rightSection={
            searching ? <CloseButton size="xs" aria-label="Effacer la recherche" onClick={() => setSearch('')} /> : null
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
              leftSection={sort === 'manual' ? <CheckIcon aria-hidden /> : <span style={{ width: '1.25em' }} />}
              onClick={() => setSort('manual')}
            >
              Ordre manuel
            </Menu.Item>
            <Menu.Item
              leftSection={sort === 'name' ? <CheckIcon aria-hidden /> : <span style={{ width: '1.25em' }} />}
              onClick={() => setSort('name')}
            >
              Alphabétique
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Tooltip label="Créer">
              <ActionIcon size="input-xs" aria-label="Créer un client ou un projet">
                <PlusIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<UserPlusIcon aria-hidden />} onClick={() => actions.openClientForm()}>
              Nouveau client
            </Menu.Item>
            <Menu.Item leftSection={<FolderPlusIcon aria-hidden />} onClick={() => actions.openProjectForm()}>
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
                <TreeExpansionContext.Provider value={expansionFor(favorites, 'fav:')}>
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
              title="Clients"
              count={active.clients.length}
              opened={sections.active}
              onToggle={() => toggleSection('active')}
              onSetAllExpanded={allExpandedHandler(active, '')}
              actions={
                <>
                  <Menu.Item leftSection={<UserPlusIcon aria-hidden />} onClick={() => actions.openClientForm()}>
                    Nouveau client
                  </Menu.Item>
                  <Menu.Item leftSection={<FolderPlusIcon aria-hidden />} onClick={() => actions.openProjectForm()}>
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
                  icon={<UsersThreeIcon aria-hidden />}
                  message={noResult ?? 'Aucun client pour le moment.'}
                  action={
                    !searching && (
                      <Stack gap="xs" align="stretch">
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<UserPlusIcon aria-hidden />}
                          onClick={() => actions.openClientForm()}
                        >
                          Ajouter un client
                        </Button>
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
                <TreeExpansionContext.Provider value={expansionFor(archives, 'archive:')}>
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
        to="/tasks"
        label="Tâches"
        leftSection={<CheckSquareOffsetIcon aria-hidden />}
        active={pathname.startsWith('/tasks')}
        style={{ borderTop: '1px solid var(--app-shell-border-color)' }}
      />
      <NavLink
        component={Link}
        to="/settings"
        label="Paramètres"
        leftSection={<GearSixIcon aria-hidden />}
        active={pathname === '/settings'}
      />
    </Stack>
  );
}
