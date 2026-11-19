# Code web : projets et clients

Tous les fichiers de `apps/web/src/features/projects/` : API (requêtes et mutations des clients, projets, statuts, catégories), barre latérale et arbre, pages client, projet et « Paramètres », formulaires et helpers d’arbre. Fonctionnalités : [Projets](../../../features/cross-cutting/projects.md) ; règles : [Règles des projets](../../../business-rules/cross-cutting/projects.md).

## `api/`

### `api/index.ts`

Requête unique `ProjectTree` (clients, projets, catégories, statuts) mise en cache sous `projectTreeQueryKey = ['workspace']`, et mutations qui l’invalident.

| Export                                                                                   | Rôle                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Client`, `Project`, `ProjectCategory`, `ProjectStatus`, `ProjectTree`                   | Types issus des fragments GraphQL `ClientFields`, `ProjectFields`, `LabelFields` (catégorie), `ProjectStatusFields` et de la requête `ProjectTree`.                 |
| `projectTreeQueryKey`                                                                    | Clé de cache `['workspace']` ; lue aussi par `use-entity-actions` (comptes de projets dans les dialogues) et `features/treasury/api`.                               |
| `useProjectTree()`                                                                       | Requête de tout l’arbre ; utilisée par la barre latérale, les pages, les formulaires et une vingtaine de fichiers d’autres features (tâches, trésorerie, alarmes…). |
| `useCreateClient()`                                                                      | Crée un client (`{ name, color?, icon? }`).                                                                                                                         |
| `useUpdateClient()`                                                                      | Modifie un client (`{ id, input: { name?, color?, icon?, removeIcon? } }`), avec mise à jour optimiste du nom et de la couleur.                                     |
| `useSetClientFavorite()`                                                                 | Favori d’un client, optimiste.                                                                                                                                      |
| `useSetClientArchived()`                                                                 | Archive / restaure un client ; en optimiste, archiver marque aussi ses projets (la restauration est réglée par le rechargement).                                    |
| `useDeleteClient()`                                                                      | Supprime un client (`deleteProjects` : supprime ses projets ou les détache), optimiste.                                                                             |
| `useMoveClient()`                                                                        | Déplace un client parmi les clients actifs, optimiste (renumérotation des positions).                                                                               |
| `useCreateProject()`                                                                     | Crée un projet.                                                                                                                                                     |
| `useUpdateProject()`                                                                     | Modifie un projet, optimiste sur le libellé.                                                                                                                        |
| `useSetProjectFavorite()`                                                                | Favori d’un projet, optimiste.                                                                                                                                      |
| `useSetProjectArchived()`                                                                | Archive / restaure ; archiver marque tout le sous-arbre en optimiste.                                                                                               |
| `useDeleteProject()`                                                                     | Supprime un projet et son sous-arbre, optimiste.                                                                                                                    |
| `useMoveProject()`                                                                       | Déplace un projet (`{ id, parentId, clientId, index }`), optimiste : nouvelle place parmi les frères actifs, client hérité du parent et propagé aux descendants.    |
| `useCreateProjectCategory()`, `useUpdateProjectCategory()`, `useDeleteProjectCategory()` | CRUD des catégories (`LabelColorInput` / `LabelColorPatch`).                                                                                                        |
| `useCreateProjectStatus()`, `useUpdateProjectStatus()`, `useDeleteProjectStatus()`       | CRUD des statuts.                                                                                                                                                   |

Internes : `useProjectTreeMutation` (mutation invalidant l’arbre, et les requêtes `also` données — `tasksQueryKey` pour `useDeleteProject` et `useDeleteClient`, dont les tâches sortent des projets —, avec un patch optimiste annulé en cas d’erreur, via `useInvalidatingMutation` et `patchQuery` de `lib/mutation`), `patch` (change un élément d’une liste), `reposition` (place un élément à un index parmi des frères et renumérote), `ProjectInputValues`.

## `components/`

### `components/ActiveTree.tsx`

- `ActiveTree({ section, dndEnabled, isExpanded, onToggle })` : arbre principal de la barre latérale (clients actifs, « Sans client » et leurs projets) avec glisser-déposer `@dnd-kit` : réordonne les clients, déplace les projets avec leurs sous-projets (verticalement la place, horizontalement le niveau, limité par `MAX_PROJECT_DEPTH`). Appelle `useMoveClient` / `useMoveProject` ; rend un `DragOverlay`. Utilisé par `Sidebar`.
- Internes : `FlatItem` (ligne aplatie, id de glisser `client:<id>`, `none:none`, `project:<id>`), `nodeHeight`, `flatten` (aplatit la partie visible ; montre « Sans client » pendant le glisser d’un projet même vide), `getProjection` (profondeur visée selon le décalage horizontal, via `dropProjection` de `components/tree/tree-dnd`), `parseId`, `collisionDetection` (un client ne rencontre que les clients et « Sans client »), `SortableRow` (ligne triable : `TreeRow` ou `NoClientRow`).

### `components/ClientForm.tsx`

`ClientForm({ client?, onDone? })` : formulaire de création ou modification d’un client (« Nom », `ColorField`, `IconField` en mode `contain`) avec `clientFormSchema` ; sans `onDone` (panneau des paramètres de la page), pas de bouton « Annuler ». Utilisé par `useEntityActions.openClientForm` et `ClientPage`.

### `components/ClientSelect.tsx`

`ClientSelect(props)` : `Select` « Client » cherchable avec l’avatar de chaque client (`itemSelectProps`) : clients actifs, plus celui choisi même archivé. Utilisé par `ProjectForm` et par la facturation (`NewDocumentForm`, `ImportedDocumentForm`, `DepositInvoiceForm`, `DocumentEditor`).

### `components/DeleteDialogs.tsx`

- `DeleteClientDialog({ client, projectCount, onDone })` : confirmation de suppression d’un client, avec `CascadeChoice` « Que faire de ses N projets ? » (détacher par défaut, ou supprimer : un second `DestructiveRisks` dit que leurs tâches sortent des projets) ; `DestructiveRisks` / `DestructiveActions`.
- `DeleteProjectDialog({ project, subProjectCount, onDone })` : confirmation de suppression d’un projet et de ses sous-projets, qui dit que leurs tâches ne sont pas supprimées mais sortent du projet.

Ouverts par `useEntityActions.confirmDelete` dans `openModal`.

### `components/EntityHeader.tsx`

`EntityHeader({ entity, subtitle?, extraActions? })` : en-tête des pages client et projet sur `DetailHeader` : `ItemAvatar` taille xl, titre, `ArchivedBadge`, interrupteur `StateSwitch` « Favori » (élément actif), actions en plus, menu « … » (`lifecycleEntries`).

### `components/EntityMenu.tsx`

`EntityMenu({ entity, opened, onChange })` : menu « … » d’une ligne de l’arbre (aussi ouvert au clic droit) : ajouter un projet ou un sous-projet, plier / déplier le sous-arbre (`useTreeExpansion`), modifier, favori, archiver, supprimer. Utilisé par `TreeRow`.

### `components/EntityState.tsx`

`EntitySkeleton()` : squelette d’une page de détail pendant le chargement (avatar 84 px, titre, bloc). Utilisé par `ClientPage` et `ProjectPage`.

### `components/labels.tsx`

- `CategoriesInput({ categories, value, onChange, error? })` : `BatchMultiSelect` « Catégories » avec création à la volée (`itemCreator('Nouvelle catégorie', …)`).
- `StatusInput({ statuses, value, onChange, error? })` : `CreatableSelect` « Statut » trié par position, avec création à la volée (« Nouveau statut »).

Utilisés par `ProjectForm`.

### `components/NavBadges.tsx`

Pastilles du menu, chacune son composant pour que le chrono ne rafraîchisse que la sienne. Utilisées par `Sidebar`.

- `TasksNavBadge()` : nombre de mes tâches du jour (`useMyTodayTasks`), pleine en `LATE_COLOR` s’il y en a en retard.
- `AgendaNavBadge()` : évènements du jour hors annulés (`useHeldEvents`).
- `TimeNavBadge()` : temps du jour (`useWeekTime`), rouge quand un chrono tourne (`useRunningTimer`) ; rien sans temps ni chrono.
- `TreasuryNavBadge()` : solde des comptes ouverts (`useTreasuryAccounts`), rouge si négatif.

### `components/NoClientRow.tsx`

`NoClientRow` (`forwardRef`, props `expanded`, `onToggle`, `hasChildren`, `canAddProject?`, `style?`) : en-tête repliable du groupe « Sans client » (« Tous les projets » en PERSO), avec menu « … » / clic droit (« Ajouter un projet », plier / déplier). Utilisé par `ActiveTree` et `StaticTree`.

### `components/ProjectForm.tsx`

`ProjectForm({ project?, defaults?, onDone? })` : formulaire de création ou modification d’un projet (`projectFormSchema`) : libellé, projet parent (`treeSelectProps(projectOptions(...))` limité aux projets actifs hors du sous-arbre et laissant la place à sa hauteur), client (masqué en PERSO, hérité et désactivé avec un parent), `StatusInput`, couleur, `CategoriesInput`, période (`dateRangeProps` / `formRange`), description, icône. À l’envoi, le client d’un sous-projet est celui du parent. Utilisé par `useEntityActions.openProjectForm` et le panneau des paramètres de `ProjectPage`.

### `components/ProjectList.tsx` (+ `ProjectList.module.css`)

`ProjectList({ projects, allProjects, rootParentId, clientId, statuses })` : liste encadrée des projets (ou sous-projets) avec retrait par niveau, actifs puis archivés ; chaque ligne (`ProjectRow` interne) a une poignée (`DragHandle`, projets actifs), un bouton de pliage (`FoldButton`, pliage gardé par `useFolded('projects-…')`), l’avatar, le libellé, le statut (`ItemBadge`) et `ArchivedBadge`. Le glisser-déposer passe par `useTreeDrop` (`components/tree/tree-dnd`) : avant, après ou dedans, refusé sur soi, un descendant, un archivé ou trop profond (fonction interne `destination`). Utilisé par `ClientPage` (projets du client) et `ProjectPage` (sous-projets). Interne aussi : `listOrder`.

### `components/Sidebar.tsx`

`Sidebar()` : barre latérale de l’application (montée par `app/layout/AppLayout.tsx`) : « Accueil », groupes de menu, recherche, tri (`useLocalStorage` `ordo.sidebar.sort`, non synchronisé entre fenêtres), création, sections « Favoris », « Clients » / « Projets », « Archives » (`ordo.sidebar.sections`), « Paramètres ». Pliage des nœuds par `useFoldedIds('ordo.sidebar.collapsed')` ; glisser-déposer actif en ordre manuel, hors recherche et hors tactile (`PHONE_QUERY`).

Internes : `TreeSkeleton`, `MenuLink`, `MenuGroup`, `pageLink` (lien depuis `PAGES`), `MENU_GROUPS` (« Activités », « Économat », « Finances », « Ressources » et leurs pastilles), `PRO_ONLY` (facturation masquée en PERSO), `isActive`, `MenuGroups` (groupes repliables, état `ordo.sidebar.openGroups`, groupe de la page ouverte déplié), et dans `Sidebar` : `expansionFor` (fournit `TreeExpansionContext`), `allExpandedHandler`, `setKeysExpanded`.

### `components/SidebarSection.tsx` (+ `SidebarSection.module.css`)

`SidebarSection({ title, count, opened, onToggle, onSetAllExpanded?, actions?, children })` : section repliable (`FoldHeading` + `Collapse`) avec menu « … » (actions puis « Tout déplier » / « Tout replier »). Utilisé par `Sidebar`.

### `components/StaticTrees.tsx`

`StaticTree({ section, label, keyPrefix, isExpanded, onToggle })` : arbre en lecture seule (favoris, archives), éléments de contexte grisés, sans glisser-déposer. Interne : `ProjectBranch` (ligne de projet récursive). Utilisé par `Sidebar`.

### `components/TreeRow.tsx` (+ `TreeRow.module.css`, `Tree.module.css`)

`TreeRow` (`forwardRef`, props `entity`, `depth?`, `subtitle?`, `muted?`, `expansion?`, `draggable?`, `dragging?` et attributs HTML) : ligne de l’arbre : bouton de pliage, lien vers la page (surligné si ouverte), double-clic = renommer, avatar, nom, `EntityMenu` révélé au survol, clic droit = menu. Utilisé par `ActiveTree`, `StaticTree` et le `DragOverlay`. `Tree.module.css` porte les styles du groupe « Sans client » et de la ligne en cours de glisser.

## `hooks/`

### `hooks/use-entity-actions.tsx`

| Export                | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EntityRef`           | `{ type: 'client', item: Client }` ou `{ type: 'project', item: Project }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `entityLabel(entity)` | Nom du client ou libellé du projet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `useEntityActions()`  | Toutes les actions sur clients et projets, rendues par un objet : `setFavorite(entity, favorite, notify?)` (toast avec annulation), `archiver(entity)` (mutation pour `archiveEntry`), `rename(entity)` (`openLabelForm` « Renommer le client / projet »), `openClientForm(client?)`, `openProjectForm(project?, defaults?)` (panneau `openFormPanel`, taille `lg` pour le projet), `confirmDelete(entity)` (ouvre le dialogue, puis quitte la page de l’élément supprimé), `lifecycleEntries(entity)` (entrées « Archiver / Restaurer » et « Supprimer » d’un menu). Utilisé par l’arbre, les pages, `HomePage`. |

Interne : `leaveIfOn` (retour à l’accueil si la page ouverte est celle de l’élément supprimé).

### `hooks/use-label-items.tsx`

- `useProjectStatusItems()` : liste `PROJECT_STATUS` pour `SettingsList` et la création à la volée (`listMutations`, schéma `labelFormSchema`), plus `remove`.
- `useProjectCategoryItems()` : idem pour `PROJECT_CATEGORY`.

Utilisés par `labels.tsx` et `SettingsPage`.

## `lib/`

### `lib/fold-entries.tsx`

- `foldEntries(setExpanded)` : entrées « Tout déplier » / « Tout replier ».
- `newEntityEntries(actions, perso)` : entrées « Nouveau client » (pas en PERSO) et « Nouveau projet ».

Utilisés par `Sidebar`, `SidebarSection`, `EntityMenu`, `NoClientRow`.

### `lib/tree-expansion.ts`

- `TreeExpansion` : interface des actions de pliage d’un arbre (`hasChildren`, `setSubtreeExpanded`, `noClientFoldable`, `setNoClientExpanded`).
- `TreeExpansionContext` : contexte React fourni par `Sidebar` pour chaque section.
- `useTreeExpansion()` : lit le contexte (null hors arbre, par exemple dans le `DragOverlay`).

### `lib/tree.ts`

Construction des sections de l’arbre et helpers de projets réutilisés ailleurs.

| Export                                                                        | Rôle                                                                                                                         | Utilisé par                                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `SortMode`                                                                    | `'manual'` ou `'name'`.                                                                                                      | `Sidebar`                                                                 |
| `clientItems(clients)`                                                        | Clients avec `label = name`, pour les selects d’éléments.                                                                    | `ClientSelect`, `dashboards/source-filters`                               |
| `NO_CLIENT`                                                                   | Id du groupe « Sans client » (`'none'`).                                                                                     | `ActiveTree`, `StaticTree`                                                |
| `ProjectNode`, `TreeSection`                                                  | Nœud de projet ; section (clients, `orphans`, clés de `context` `c:<id>` / `p:<id>`).                                        | arbre                                                                     |
| `projectFullPath(tree, project)`                                              | « Client › Projet › Sous-projet ».                                                                                           | contexte des tâches, trésorerie, documents                                |
| `projectOptions(tree, projects)`                                              | Options d’un select de projets dans l’ordre de l’arbre, sous leur client grisé, parents non proposés grisés (`treeOptions`). | formulaires de tâches, routines, contributeurs, trésorerie, `ProjectForm` |
| `clientProjectOptions(tree, clientId, { archived, keepId, anyWhenNoClient })` | Options des projets d’un client (archivés exclus sauf demande ; le projet choisi gardé).                                     | formulaires de facturation                                                |
| `projectNodes(tree)`                                                          | Nœuds `TreeNode` clients (`client:<id>`, `client:none` « Sans client ») et projets, archivés en dernier.                     | `use-task-context`                                                        |
| `projectDepth(projects, id)`                                                  | Niveau (1 = racine).                                                                                                         | `ProjectForm`, `ProjectList`                                              |
| `projectHeight(projects, id)`                                                 | Niveaux du sous-arbre.                                                                                                       | `ProjectForm`, `ProjectList`                                              |
| `canHaveChildren(projects, id)`                                               | Profondeur < `MAX_PROJECT_DEPTH`.                                                                                            | `EntityMenu`, `ProjectPage`                                               |
| `buildActiveSection(tree, sort, search)`                                      | Section principale (actifs).                                                                                                 | `Sidebar`                                                                 |
| `buildFavoriteSection(tree, sort, search)`                                    | Section des favoris avec contexte.                                                                                           | `Sidebar`                                                                 |
| `buildArchiveSection(tree, sort, search)`                                     | Section des archives avec contexte.                                                                                          | `Sidebar`                                                                 |
| `countSectionItems(section)`                                                  | Éléments d’une section hors contexte.                                                                                        | `Sidebar`                                                                 |
| `noClientKeys(section, prefix)`                                               | Clés de pliage du groupe « Sans client ».                                                                                    | `Sidebar`                                                                 |
| `sectionKeys(section, prefix)`                                                | Clés de tous les nœuds pliables.                                                                                             | `Sidebar`                                                                 |
| `subtreeKeys(section, prefix, target)`                                        | Clés d’un nœud et de ses descendants.                                                                                        | `Sidebar`                                                                 |

Internes : `labelOf`, `sortItems`, `buildForest`, `filterForest`, `filterSection` (recherche sans accents), `projectAncestry`, `ContextSeeds`, `buildContextSection` (contenu + ancêtres et clients en contexte), `projectKeys`.

## `pages/`

### `pages/ClientPage.tsx`

`ClientPage()` : route `/clients/:id` (dans `ProOnly`). En-tête, `PageSettings` « Paramètres du client » (onglets `billing` → `ClientBillingSection`, `client` → `ClientForm`, via `useSettingsTab`), section « Projets » (`ProjectList` ou `EmptyState`), `ProjectBillingPanel` du client et de ses projets. Constante interne `SETTINGS_TABS`.

### `pages/ProjectPage.tsx`

`ProjectPage()` : route `/projects/:id`. En-tête avec fil d’Ariane, `PageTabs` (`usePageTab`, onglet `billing` retiré en PERSO) : aperçu (`SubSection`, `ItemBadge`, `ProjectList`, `MarkdownView`, `DashboardBoard`), `TaskBoard`, `RoutinesPanel`, `ListsPanel`, `SheetsTable`, `ProjectTimePanel`, `ProjectBillingPanel`, `ProjectMailsPanel`, `ProjectResourcesPanel` (ressources, dans `features/accounting`). `PageSettings` « Paramètres du projet ».

Internes : `formatDate`, `PROJECT_TABS`, `SETTINGS_SECTIONS`, `SettingsSection` (type), `ProjectSettings` (onglets `TaskSettings`, `MilestonesPanel`, `SprintsPanel`, `ProjectContributors`, `ProjectGithubPanel`, `ProjectForm`). Un effet redirige les anciens onglets de paramètres vers le panneau (`SETTINGS_PARAM`, `SETTINGS_TAB_PARAM`).

### `pages/SettingsPage.tsx`

`SettingsPage()` : route `/settings`, onglets `projects` (deux `SettingsList` : statuts et catégories, avec usage compté par `countBy`), `contributors` (`TeamMembers`, `TeamRelations`, `ContributorsManager`), `places` (`PlacesManager`), `github` (`GithubSettings`), `workspaces` (`WorkspacesManager`). Redirige les anciens onglets (`tracking`, `company`, `calendar`, `mail`, `tasks`) vers les paramètres de leur vue (`settingsPath`). Constante interne `SETTINGS_PAGE_TABS`. Elle se trouve dans `features/projects` bien qu’elle couvre tout l’espace : voir [Paramètres](../../../features/cross-cutting/settings.md).
