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

- `ActiveTree({ section, dndEnabled, isExpanded, onToggle, clients?, clientsEmpty?, projects, projectsEmpty? })` : arbre principal de la barre latérale, rendu dans ses sections (`SidebarSection`) : `clients` (en-tête `SidebarSectionChrome` de « Clients », PRO) avec les clients actifs et leurs projets, `clientsEmpty` sans client ; puis les projets sans client au premier niveau, sous l’en-tête `projects` (« Projets ») ou, avec `projects = null`, directement dans la barre ; `projectsEmpty` à la place des projets quand il n’y en a pas (sans lui, la section « Projets » ne s’affiche qu’avec des projets ou pendant le glisser d’un projet). Un seul glisser-déposer `@dnd-kit` pour les deux sections : réordonne les clients, déplace les projets avec leurs sous-projets (verticalement la place : sous un client = rattaché, dans « Projets » = détaché ; horizontalement le niveau, limité par `MAX_PROJECT_DEPTH`). Appelle `useMoveClient` / `useMoveProject` ; rend un `DragOverlay`. Utilisé par `Sidebar`.
- Internes : `FlatItem` (ligne aplatie, id de glisser `client:<id>`, `none:none` pour la racine des projets sans client, `project:<id>`), `nodeHeight`, `FlattenParts`, `flatten` (aplatit la partie visible ; pendant un glisser, sans les lignes d’une section repliée), `noClientRows` (lignes sous la racine des projets sans client, montrées un niveau moins en retrait), `getProjection` (profondeur visée selon le décalage horizontal, via `dropProjection` de `components/tree/tree-dnd`), `parseId`, `collisionDetection` (un client ne rencontre que les clients et l’en-tête « Projets »), `SortableRow` (`TreeRow` triable), `NoClientRoot` (racine des projets sans client, jamais glissée : l’en-tête de la section « Projets », cible du glisser, ou une marque vide quand les projets sont directement dans la barre).

### `components/ClientForm.tsx`

`ClientForm({ client?, onDone? })` : formulaire de création d’un client (« Créer le client ») ou panneau d’un client existant enregistré champ par champ (`useFieldSave` : nom en le quittant, couleur par `commitProps` (choisie : aussitôt, tapée : en la quittant), seuls les champs changés envoyés à `useUpdateClient`, `SaveStatus` ; le client du cache `useProjectTree` suivi ; archivé : lecture seule) : « Nom », `ColorField`, `IconField` en mode `contain` (`formIconProps` : fichier `icon` et retrait `removeIcon`, valeurs du formulaire), `clientFormSchema` ; sans `onDone` (panneau des paramètres de la page), pas de bouton « Annuler ». Utilisé par `useEntityActions.openClientForm` et `ClientPage`.

### `components/ClientSelect.tsx`

`ClientSelect(props)` : `Select` « Client » cherchable avec l’avatar de chaque client (`itemSelectProps`) : clients actifs, plus celui choisi même archivé. Utilisé par `ProjectForm` et par la facturation (`NewDocumentForm`, `ImportedDocumentForm`, `DepositInvoiceForm`, `DocumentEditor`).

### `components/DeleteDialogs.tsx`

- `DeleteClientDialog({ client, projectCount, onDone })` : confirmation de suppression d’un client, avec `CascadeChoice` « Que faire de ses N projets ? » (détacher par défaut, ou supprimer : un second `DestructiveRisks` dit que leurs tâches sortent des projets) ; `DestructiveRisks` / `DestructiveActions`.
- `DeleteProjectDialog({ project, subProjectCount, onDone })` : confirmation de suppression d’un projet et de ses sous-projets, qui dit que leurs tâches ne sont pas supprimées mais sortent du projet.

Ouverts par `useEntityActions.confirmDelete` dans `openModal`.

### `components/EntityHeader.tsx`

`EntityHeader({ entity, subtitle?, extraActions? })` : en-tête des pages client et projet sur `DetailHeader` : `ItemAvatar` taille xl, titre, `ArchivedBadge`, bouton d’état `StateButton` « Favori » (`FAVORITE_STATES`, taille `input-sm` : aussi haut que le menu « … », élément actif : étoile vide / jaune pleine), actions en plus, menu « … » (`lifecycleEntries`).

### `components/EntityMenu.tsx`

`EntityMenu({ entity, opened, onChange })` : menu « … » d’une ligne de l’arbre (aussi ouvert au clic droit) : ajouter un projet ou un sous-projet, plier / déplier le sous-arbre (`useTreeExpansion`), modifier, favori (« Ajouter aux favoris » / « Retirer des favoris » par `nextStateLabel(FAVORITE_STATES, …)`, icône étoile `YesNoIcon` vide ou jaune pleine), archiver, supprimer. Utilisé par `TreeRow`.

### `components/EntityState.tsx`

`EntitySkeleton()` : squelette d’une page de détail pendant le chargement (avatar 84 px, titre, bloc). Utilisé par `ClientPage` et `ProjectPage`.

### `components/labels.tsx`

- `CategoriesInput({ categories, value, onChange, error? })` : `BatchMultiSelect` « Catégories » avec création à la volée (`itemCreator('Nouvelle catégorie', …)`).
- `StatusInput({ statuses, value, onChange, error? })` : `CreatableSelect` « Statut » trié par position, avec création à la volée (« Nouveau statut »).

Utilisés par `ProjectForm`.

### `components/NavBadges.tsx`

Pastilles du menu, chacune son composant pour que le chrono ne rafraîchisse que la sienne, chacune calculée par le code de la page ou de l’accueil (jamais recalculée). Utilisées par `Sidebar`. Règle eslint : une pastille passée à `pageLink` est un composant `*NavBadge`.

- `NavBadge({ value, label, color?, variant? })` : la pastille commune (`Badge` `sm`, clair par défaut), avec son libellé pour les lecteurs d’écran ; rien sans valeur.
- `TasksNavBadge()` : nombre de tâches faisables maintenant, la section « Maintenant » de la carte « Tâches » de l’accueil (`useHomeTasks` : vue par défaut de la page « Tâches », sans vue mes tâches du jour `useMyTodayTasks`), pleine en `LATE_COLOR` si certaines sont en retard ; « 5 tâches faisables maintenant ».
- `RoutinesNavBadge()` : moments faits sur prévus aujourd’hui (« 3/7 », `ProgressBadge`), ceux que « Ma journée » liste (`useRoutineDayCount` : routines en retard comprises, occurrences annulées, routines archivées et parentes à part), verte quand tout est fait ; « 3 routines faites sur 7 prévues aujourd’hui ».
- `AgendaNavBadge()` : évènements du jour, journée entière comprise, hors annulés (`useHeldEvents`) ; « 2 évènements aujourd’hui ».
- `TimeNavBadge()` : temps du jour, chronos en cours comptés en direct (`useWeekTime`, format `formatDuration`), rouge quand un chrono au moins tourne (`useRunningTimers`) ; rien sous une minute.
- `AlarmsNavBadge()` : temps jusqu’à la prochaine sonnerie (`useNextRing`, `fmt.countdown`), recalculé chaque minute ; « Prochaine sonnerie dans 12 min ».
- `TreasuryNavBadge()` : solde des comptes ouverts (`useTreasuryAccounts`), rouge si négatif.

### `components/ProjectForm.tsx`

`ProjectForm({ project?, defaults?, onDone? })` : formulaire de création ou modification d’un projet (`projectFormSchema`) : libellé, projet parent (`treeSelectProps(projectOptions(...))` limité aux projets actifs hors du sous-arbre et laissant la place à sa hauteur), client (masqué en PERSO, hérité et désactivé avec un parent), `StatusInput`, couleur, `CategoriesInput`, période (`dateRangeProps` / `formRange`), description, icône (`formIconProps`). Un nouveau projet : « Créer le projet » ; à l’envoi, le client d’un sous-projet est celui du parent. Un projet existant : panneau enregistré champ par champ (`useFieldSave` : libellé et description en les quittant, couleur par `commitProps` ; seuls les champs changés envoyés à `useUpdateProject` ; `SaveStatus` ; le projet du cache suivi ; archivé : lecture seule). Utilisé par `useEntityActions.openProjectForm` et le panneau des paramètres de `ProjectPage`.

### `components/ProjectList.tsx` (+ `ProjectList.module.css`)

`ProjectList({ projects, allProjects, rootParentId, clientId, statuses })` : liste encadrée des projets (ou sous-projets) avec retrait par niveau, actifs puis archivés ; chaque ligne (`ProjectRow` interne) a une poignée (`DragHandle`, projets actifs), un bouton de pliage (`FoldButton`, pliage gardé par `useFolded('projects-…')`), l’avatar, le libellé, le statut (`ItemBadge`) et `ArchivedBadge`. Le glisser-déposer passe par `useTreeDrop` (`components/tree/tree-dnd`) : avant, après ou dedans, refusé sur soi, un descendant, un archivé ou trop profond (fonction interne `destination`). Utilisé par `ClientPage` (projets du client) et `ProjectPage` (sous-projets). Interne aussi : `listOrder`.

### `components/Sidebar.tsx`

`Sidebar()` : barre latérale de l’application (montée par `app/layout/AppLayout.tsx`) : « Accueil », groupes de menu, recherche, tri (`useLocalStorage` `ordo.sidebar.sort`, non synchronisé entre fenêtres), création, sections (`ordo.sidebar.sections`, une section absente de ce qui est gardé prend son état de départ `SECTIONS_OPENED`) : « Favoris », puis en PRO « Clients » et « Projets » (projets sans client, s’il y en a), en PERSO « Projets » s’il y a des favoris ou des archives (sinon les projets directement dans la barre), puis « Archives » ; « Paramètres ». Pas de compteur sur les en-têtes. Pliage des nœuds par `useFoldedIds('ordo.sidebar.collapsed')` ; glisser-déposer actif en ordre manuel, hors recherche et hors tactile (`PHONE_QUERY`).

Internes : `SectionKey`, `SECTIONS_OPENED`, `TreeSkeleton`, `TreeEmpty` (état vide d’une partie de l’arbre avec les boutons de ses créations), `MenuLink`, `MenuGroup`, `pageLink` (lien depuis `PAGES`), `MENU_GROUPS` (« Activités », « Économat », « Finances », « Ressources » et leurs pastilles), `PRO_ONLY` (facturation masquée en PERSO), `isActive`, `MenuGroups` (groupes repliables, état `ordo.sidebar.openGroups`, groupe de la page ouverte déplié), et dans `Sidebar` : `expansionFor` (fournit `TreeExpansionContext`), `allExpandedHandler`, `chrome` (en-tête d’une section : titre, ouverture, menu), `setKeysExpanded`.

### `components/SidebarSection.tsx` (+ `SidebarSection.module.css`)

`SidebarSection({ title, opened, onToggle, onSetAllExpanded?, actions?, headerRef?, headerStyle?, children })` : section repliable (`FoldHeading` + `Collapse`), sans compteur, avec menu « … » (actions puis « Tout développer » / « Tout réduire ») ; `headerRef` / `headerStyle` font de l’en-tête une cible du glisser-déposer. `SidebarSectionChrome` : le type de son en-tête (titre, ouverture, menu). Utilisé par `Sidebar` et `ActiveTree`.

### `components/StaticTrees.tsx`

`StaticTree({ section, label, keyPrefix, isExpanded, onToggle })` : arbre en lecture seule (favoris, archives), éléments de contexte grisés, projets sans client au premier niveau après les clients, sans glisser-déposer. Interne : `ProjectBranch` (ligne de projet récursive). Utilisé par `Sidebar`.

### `components/TreeRow.tsx` (+ `TreeRow.module.css`, `Tree.module.css`)

`TreeRow` (`forwardRef`, props `entity`, `depth?`, `subtitle?`, `muted?`, `expansion?`, `draggable?`, `dragging?` et attributs HTML) : ligne de l’arbre : bouton de pliage, lien vers la page (surligné si ouverte), double-clic = renommer, avatar, nom, `EntityMenu` révélé au survol, clic droit = menu. Utilisé par `ActiveTree`, `StaticTree` et le `DragOverlay`. `Tree.module.css` porte le style de la ligne en cours de glisser.

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

- `foldEntries(setExpanded)` : entrées « Tout développer » / « Tout réduire ».
- `newEntityEntries(actions, perso)` : entrées « Nouveau client » (pas en PERSO) et « Nouveau projet ».

Utilisés par `Sidebar`, `SidebarSection`, `EntityMenu`.

### `lib/tree-expansion.ts`

- `TreeExpansion` : interface des actions de pliage d’un arbre (`hasChildren`, `setSubtreeExpanded`).
- `TreeExpansionContext` : contexte React fourni par `Sidebar` pour chaque section.
- `useTreeExpansion()` : lit le contexte (null hors arbre, par exemple dans le `DragOverlay`).

### `lib/tree.ts`

Construction des sections de l’arbre et helpers de projets réutilisés ailleurs.

| Export                                                                        | Rôle                                                                                                                         | Utilisé par                                                               |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `SortMode`                                                                    | `'manual'` ou `'name'`.                                                                                                      | `Sidebar`                                                                 |
| `clientItems(clients)`                                                        | Clients avec `label = name`, pour les selects d’éléments.                                                                    | `ClientSelect`, `dashboards/source-filters`                               |
| `NO_CLIENT`                                                                   | Id de la racine des projets sans client dans le glisser-déposer (`'none'`).                                                  | `ActiveTree`                                                              |
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
| `isEmptySection(section)`                                                     | Section sans client ni projet (son contexte ne vient qu’avec du contenu).                                                    | `Sidebar`                                                                 |
| `clientKeys(section, prefix)`                                                 | Clés de pliage des clients et de leurs projets (« Tout développer » de « Clients »).                                            | `Sidebar`                                                                 |
| `orphanKeys(section, prefix)`                                                 | Clés de pliage des projets sans client (« Tout développer » de « Projets » en PRO).                                             | `Sidebar`                                                                 |
| `sectionKeys(section, prefix)`                                                | Clés de tous les nœuds pliables (`clientKeys` puis `orphanKeys`).                                                            | `Sidebar`                                                                 |
| `subtreeKeys(section, prefix, target)`                                        | Clés d’un nœud et de ses descendants.                                                                                        | `Sidebar`                                                                 |

Internes : `labelOf`, `sortItems`, `buildForest`, `filterForest`, `filterSection` (recherche sans accents), `projectAncestry`, `ContextSeeds`, `buildContextSection` (contenu + ancêtres et clients en contexte), `projectKeys`.

## `pages/`

### `pages/ClientPage.tsx`

`ClientPage()` : route `/clients/:id` (dans `ProOnly`). En-tête, `PageSettings` « Paramètres du client » (onglets `billing` → `ClientBillingSection`, en lecture seule si le client est archivé, `client` → `ClientForm`, via `useSettingsTab`), section « Projets » (`ProjectList` ou `EmptyState`), `ProjectBillingPanel` du client et de ses projets. Constante interne `SETTINGS_TABS`.

### `pages/ProjectPage.tsx`

`ProjectPage()` : route `/projects/:id`. En-tête avec fil d’Ariane, `PageTabs` (`usePageTab`, onglet `billing` retiré en PERSO) : aperçu (`SubSection`, `ItemBadge`, `ProjectList`, `MarkdownView`, `DashboardBoard`), `TaskBoard`, `RoutinesPanel`, `ListsPanel`, `SheetsTable`, `ProjectTimePanel`, `ProjectBillingPanel`, `ProjectMailsPanel`, `ProjectResourcesPanel` (ressources, dans `features/accounting`). `PageSettings` « Paramètres du projet ».

Internes : `formatDate`, `PROJECT_TABS`, `ProjectTab` (type), `TAB_LOOK` (libellé et icône de chaque onglet, repris par l’onglet de ses paramètres), `TAB_SETTINGS` (paramètres de l’espace propres à un onglet : `tasks` → `TaskSettings`, `routines` → `RoutineSettings`, `shopping` → `ShoppingSettings`, `sheets` → `SheetsSettings`, `time` → `TimeSettings`, `billing` → `DocumentStatusSettings`, `CompanySettings` et `ProjectDocumentsColumnDefaults`, `mail` → `MailSettings` ; les mêmes composants que sur la page de chaque feature), `tabSettingsOf(tab)`, `TASK_SECTIONS` (`milestones`, `sprints` : depuis l’onglet « Tâches » seulement), `PROJECT_SECTIONS` (`contributors`, `github`, `project` : depuis tous les onglets), `ProjectSection` (type), `LEGACY_SECTIONS`, `TASKS_TAB_SECTIONS` (anciens onglets qui ouvrent aussi l’onglet « Tâches »), `SettingsSection` (type), `PROJECT_SECTION_LOOK` (libellé et icône des sections du projet), `projectSectionsOf(tab)`, `sectionsOf(tab)`, `ProjectSettings({ project, tab, section, onSection })` (onglets : d’abord ceux de l’onglet affiché, précédés de `SettingsScopeNote`, puis `MilestonesPanel` et `SprintsPanel` depuis l’onglet « Tâches », `ProjectContributors`, `ProjectGithubPanel`, `ProjectForm`). Le panneau s’ouvre sur la première section de l’onglet affiché ; changer d’onglet garde une section du projet quand le nouvel onglet la montre, et passe sinon à la première section du nouvel onglet. Un effet redirige les anciens onglets de paramètres vers le panneau (`SETTINGS_PARAM`, `SETTINGS_TAB_PARAM` ; `taskSettings`, `milestones` et `sprints` ouvrent aussi l’onglet « Tâches »).

### `pages/SettingsPage.tsx`

`SettingsPage()` : route `/settings`, onglets `projects` (deux `SettingsList` : statuts et catégories, avec usage compté par `countBy`), `contributors` (`TeamMembers`, `TeamRelations`, `ContributorsManager`), `places` (`PlacesManager`), `github` (`GithubSettings`), `workspaces` (`WorkspacesManager`). Redirige les anciens onglets (`tracking`, `company`, `calendar`, `mail`, `tasks`) vers les paramètres de leur vue (`settingsPath`). Constante interne `SETTINGS_PAGE_TABS`. Elle se trouve dans `features/projects` bien qu’elle couvre tout l’espace : voir [Paramètres](../../../features/cross-cutting/settings.md).
