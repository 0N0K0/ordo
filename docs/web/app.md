# Application web : démarrage, routes, mise en page

Squelette de l'application web : point d'entrée et fournisseurs, routeur, registre des pages et de leurs adresses, thème, mise en page de la zone connectée (en-tête, barre latérale, actions rapides, réglages de page, panneaux), invite de mise à jour, styles globaux ; puis les conventions de code du web. Sources : `apps/web/src/main.tsx`, `apps/web/src/app/**`, `apps/web/src/styles/**`, `apps/web/eslint.config.js`.

## Point d'entrée (`main.tsx`)

Charge les styles Mantine (en couches : core, notifications, dates, tiptap, charts), la langue `fr` de dayjs, puis les styles globaux (`styles/*.css`). Monte, dans cet ordre :

1. `MantineProvider` (thème `theme`, `defaultColorScheme="auto"` : suit `prefers-color-scheme`) ;
2. `QueryClientProvider` (`queryClient` de `lib/query-client`) ;
3. `WeekDatesProvider` (sélecteurs de dates en français, semaines du lundi au dimanche) ;
4. `IconContext.Provider` (`iconDefaults` des icônes Phosphor) ;
5. `Notifications` en haut à droite (toasts, voir [lib/notify](lib.md#notifytsx)), `UpdatePrompt`, puis `RouterProvider` (`router`).

Si le code d'une page n'existe plus sur le serveur (nouvelle version déployée depuis le chargement), l'évènement `vite:preloadError` recharge l'application, une seule fois par onglet (`sessionStorage`, clé `ordo-reloaded`).

Juste avant de monter l'application, `main.tsx` pose l'attribut `data-app-started` sur `<html>` : l'application a démarré, son toast de mise à jour (`UpdatePrompt`) prend le relais.

**Version cassée au chargement (`public/boot-rescue.js`).** Script classique, hors du bundle, chargé par `index.html` avant l'application (fichier séparé : la politique de sécurité refuse les scripts écrits dans la page). Une erreur avant le démarrage (évènement `error` ou `unhandledrejection` sans `data-app-started`, par exemple une erreur à l'évaluation d'un module) empêcherait le toast de jamais s'afficher, et le service worker continuerait de servir cette version. Le script passe alors à la nouvelle version : celle qui attend dans le service worker, ou celle qu'il cherche aussitôt (`registration.update()`), par le message `SKIP_WAITING` qu'écoute le service worker généré, puis recharge la page quand elle prend la main. Une seule fois par onglet (`sessionStorage`, clé `ordo-boot-rescued`) : une version encore cassée ne boucle pas.

## Routes (`router.tsx`)

`router` : routeur `createBrowserRouter` de `react-router`. Les chemins viennent de `PAGES` et `AUTH_PATHS` (`routeOf`).

Les pages sont chargées à la demande (`lazyNamed`, voir [lib/lazy](lib.md#lazytsx)) : l'application démarre avec les mises en page, la garde, `LoginPage` et `NotFoundPage` seulement ; chaque page arrive avec son code à sa première ouverture, sous le `Suspense` de sa mise en page (`DetailSkeleton` dans `AppLayout`, `FormSkeleton` dans `AuthLayout`). Le build sépare aussi `react` et `mantine` dans leurs propres fichiers (`vite.config.ts`, `codeSplitting`), pour qu'un déploiement qui ne change que l'application les laisse en cache.

Zone connectée : garde `RequireAuth` (`features/auth/pages/guards`), puis `AppLayout`.

| Route                      | Page                   | Remarque                               |
| -------------------------- | ---------------------- | -------------------------------------- |
| `/`                        | `HomePage`             | Accueil                                |
| `/tasks`                   | `TasksPage`            |                                        |
| `/tasks/automations`       | `TaskAutomationsPage`  | Automatisations des tâches             |
| `/time`                    | `TimePage`             | Chronos                                |
| `/account`                 | `AccountPage`          | Mon compte                             |
| `/alarms`                  | `AlarmsPage`           |                                        |
| `/shopping`                | `ShoppingPage`         | Achats                                 |
| `/shopping/:id`            | `ShoppingListPage`     | Liste de courses                       |
| `/sheets`                  | `SheetsPage`           | Fiches                                 |
| `/sheets/:id`              | `SheetPage`            | Fiche                                  |
| `/stock`                   | `StockPage`            | Inventaire                             |
| `/routines`                | `RoutinesPage`         |                                        |
| `/mail`                    | `MailPage`             | Mails                                  |
| `/calendar`                | `CalendarPage`         | Agenda                                 |
| `/accounting`              | `AccountingPage`       | Facturation, `ProOnly`                 |
| `/accounting/imported/:id` | `ImportedDocumentPage` | Document importé, `ProOnly`            |
| `/accounting/:id`          | `DocumentPage`         | Document de facturation, `ProOnly`     |
| `/treasury`                | `TreasuryPage`         | Trésorerie                             |
| `/dashboards`              | `DashboardsPage`       | Tableaux de bord                       |
| `/documents`               | `LibraryPage`          | Documents (bibliothèque, à réécrire)   |
| `/settings`                | `SettingsPage`         | Paramètres (`features/projects/pages`) |
| `/clients/:id`             | `ClientPage`           | Client, `ProOnly`                      |
| `/projects/:id`            | `ProjectPage`          | Projet                                 |

`ProOnly` (`features/workspaces/pages`) réserve la page aux espaces professionnels (voir [Espaces et accès](../business-rules/cross-cutting/workspaces-and-access.md)).

Hors zone connectée, dans `AuthLayout` :

- avec la garde `RequireGuest` (déconnecté seulement) : `/login` (`LoginPage`), `/forgot-password` (`ForgotPasswordPage`) ;
- accessibles connecté ou non (liens reçus par mail) : `/reset-password` (`ResetPasswordPage`), `/confirm-email` (`ConfirmEmailPage`).

Toute autre adresse : `NotFoundPage`. Voir [Fonctionnalités : authentification](../features/cross-cutting/auth.md).

## Registre des pages et adresses (`pages.ts`)

- `PAGES` : pages de l'application, un seul endroit pour leur adresse, leur nom (menu, en-tête, titre) et leur icône (menu) : `home` « Accueil » `/`, `tasks` « Tâches », `routines` « Routines », `calendar` « Agenda », `time` « Chronos », `alarms` « Alarmes », `shopping` « Achats », `sheets` « Fiches », `stock` « Inventaire », `accounting` « Facturation », `treasury` « Trésorerie », `mail` « Mails », `documents` « Documents », `dashboards` « Tableaux de bord », `settings` « Paramètres », `account` « Mon compte ». Clients et projets affichent leur propre nom. Les adresses de l’accueil, des tâches, des routines, de l’agenda, des alarmes et du compte viennent de `APP_PATHS` (`@ordo/shared` : ce sont aussi les liens des sonneries poussées par le serveur).
- `PageKey` (type) : clé d'une page.
- `AUTH_PATHS` : `login`, `forgotPassword`, `resetPassword`, `confirmEmail`.
- `OVERDUE_INVOICES_PATH` (`/accounting?tab=overdue`), `TASK_AUTOMATIONS_PATH` (`/tasks/automations`), `GITHUB_SETTINGS_PATH` (`/settings?tab=github`), `SHOPPING_LISTS_PATH` (`/shopping?tab=lists`).
- `routeOf(path, sub?)` : route du routeur (adresse sans barre initiale, plus un sous-chemin : `accounting/:id`).
- `pageOfPath(pathname)` : page d'un chemin par son premier segment (une sous-page appartient à sa page) ; `null` pour un client, un projet ou une page inconnue.
- `PROJECT_ROUTE` (`/projects/:id`), `CLIENT_ROUTE` (`/clients/:id`) : routes, aussi pour `useMatch`.
- Aides d'adresse : `projectPath(id, tab?)`, `calendarPath(date)`, `clientPath(id)`, `taskPath(task)` (onglet tâches du projet avec la tâche ouverte, ou « Tâches » pour une tâche sans projet ; `projectPath` et `taskPath` réexportés de `@ordo/shared`), `mailPath(account, folder, uid?)`, `documentPath(id, imported?)`, `sheetPath(id)`, `shoppingListPath(id)`, `timePath(taskId)`, `routineHistoryPath(routineId)`.
- `SETTINGS_PARAM` (`settings`) et `settingsPath(path, section?)` : adresse d'une page avec ses réglages ouverts, sur un onglet (`/mail?settings=1`, `/accounting?settings=1&section=company` ; nom du paramètre d'onglet : `SETTINGS_TAB_PARAM` de `components/tabs`).

eslint interdit d'écrire ces adresses à la main (voir [Conventions](#conventions)).

## Thème et fournisseurs

- `theme.ts` : `theme` (Mantine `createTheme`) : icône de visibilité des mots de passe (`VisibilityToggleIcon`) ; formats lisibles des sélecteurs de dates (`PICKER_FORMATS` de `lib/format` au lieu de « October 20, 2026 ») pour `DatePickerInput`, `DateTimePicker`, `MonthPickerInput`, `YearPickerInput` ; `TimePicker` toujours en 24 h, libellés « Heures » / « Minutes ». `iconDefaults` : props par défaut des icônes Phosphor (`size: '1.25em'`, `weight: 'regular'`).
- `VisibilityToggleIcon.tsx` : `VisibilityToggleIcon`, œil / œil barré du champ mot de passe, à la taille `--psi-icon-size`.
- `WeekDatesProvider.tsx` : `WeekDatesProvider`, `DatesProvider` en français dont les semaines commencent toujours le lundi (`firstDayOfWeek: 1`), quelle que soit la semaine de l'espace.
- `NotFoundPage.tsx` : `NotFoundPage`, page 404 : `PageMessage` code « 404 », « Page introuvable », « L'adresse demandée n'existe pas ou a été déplacée. », retour à l'accueil.
- `UpdatePrompt.tsx` : `UpdatePrompt`, enregistre le service worker (PWA, `virtual:pwa-register/react`), cherche une nouvelle version toutes les heures et, une fois téléchargée, affiche un toast d'information « Nouvelle version d'Ordo » / « Rechargez pour l'utiliser. » avec le bouton « Recharger ». Ne rend rien.

## Mise en page de la zone connectée (`layout/`)

### `AppLayout`

Mise en page de la zone connectée (`AppShell` Mantine), une fois l'espace connu (`WorkspaceGate` de `features/workspaces`). Enveloppée dans `ModalsProvider` (modales centrées, bouton « Fermer ») et `PageSettingsContext`.

- En-tête de 56 px, grille à trois colonnes (côtés égaux, milieu centré tant qu'il tient) :
  - à gauche : `Burger` (« Masquer / Afficher la barre latérale »), `HeaderClock`, et sur téléphone seulement le `WorkspaceSwitcher` ;
  - au milieu (à partir de la tablette) : `HeaderTitle` ;
  - à droite : `CountdownWidget` (minuteurs en cours) et `TimerWidget` (chronos en cours), pas sur téléphone, `SettingsButton`, `QuickActions`, puis le menu du compte (bouton tertiaire au nom d'utilisateur, ouvert au survol : « Mon compte », séparateur, « Me déconnecter »).
- Barre latérale de navigation (`AppShell.Navbar` « Clients et projets ») : `Sidebar` de `features/projects` ; redimensionnable (`useResizablePanel` + `SIDEBAR_PANEL`, poignée `ResizeHandle` à droite, pas sur téléphone) ; état ouvert gardé dans `localStorage` (`ordo.sidebar.opened`, propre à chaque fenêtre) ; sur téléphone, tiroir fermé après chaque navigation. Un seul état ouvert pour les règles mobile et bureau (au point de rupture exact, Mantine applique les deux).
- Réglages de page à droite (`AppShell.Aside`) : `SettingsAside` + `SettingsOverlay`, ouverts si le paramètre d'URL `settings=1` est présent et que la page a des réglages ; redimensionnables (`SETTINGS_PANEL`).
- Services globaux montés dans la mise en page (ne rendent rien de visible hors toasts) : `AlarmCenter` (fait sonner les alarmes et les rappels des évènements, routines et tâches de l'espace ouvert), `ElsewhereNotifier` (notifications des autres espaces : alarmes, rappels, nouveaux mails, selon leurs réglages), `MailWatcher` (nouveaux mails de l'espace ouvert), `TaskAutomationToasts` (les automatisations des tâches appliquées par un changement, avec « Annuler »). `WorkspaceGate` n'affiche la zone qu'une fois l'espace connu et les requêtes de l'onglet épinglées à lui (`pinWorkspace`).
- Contenu (`AppShell.Main`) : la page (`Outlet`, pleine largeur), puis `TaskPanel` (la tâche de `?task=…`, par-dessus toute page) et `SidePanelHost` (formulaires du panneau latéral).
- Pendant un redimensionnement : `data-resizing` (curseur `col-resize`, pas de sélection ni d'animation).

Styles (`AppLayout.module.css`) : marges horizontales de page `--page-gutter` 16 px (téléphone), 32 px (tablette, 48em), 48 px (bureau, 70em) ; l'aside des réglages se pose par-dessus la page (ombre `xl`) sans la rétrécir ; classes `phoneOnly` et `fromTablet`.

### En-tête

- `HeaderClock` : date et heure à gauche, au-dessus de la barre latérale : « Mer. 11 nov. 07:52 » (`fmt.weekday` capitalisé, `fmt.time`), rafraîchies à la minute (`useNow`) ; masquées sur téléphone.
- `HeaderTitle` : milieu de l'en-tête à partir de la tablette (`nav` « Emplacement ») : l'espace (`WorkspaceSwitcher variant="text"`, menu au survol pour changer d'espace ou les gérer), puis, chacun après « | », le nom de la page (`pageOfPath`), ou pour un projet son client et ses projets parents en liens puis son nom, ou pour un client son nom. Hook interne `useCrumbs` (arbre `useProjectTree`, parents par `ancestorsOf`, arrêt sur un cycle). Miettes longues coupées par « … ».
- `QuickActions` : menu de création de l'en-tête « Ajouter » (bouton `secondary` `xs`, « + » seul sous 29em), ouvert au survol, sur toutes les pages : « Tâche », « Évènement », « Chrono » (les chronos en cours continuent : plusieurs tournent à la fois), « Minuteur » (`openCountdownForm`), « Alarme », « Mail », « Devis » (pas en espace personnel). Sur une page projet, le projet (et son client pour un devis) est présélectionné. Désactivé tant que le contexte des tâches n'est pas chargé. Utilise `useTaskActions`, `useEventForm`, `openTimerForm`, `openCountdownForm`, `useAlarmForm`, `useMailComposer`, `openNewDocument`. Voir [Accueil et navigation](../features/cross-cutting/home.md).
- `SettingsButton` : bouton ⚙ (`IconAction` `light`, `aria-expanded`) qui ouvre ou ferme les réglages de la page, toujours au même endroit (avant « Ajouter ») ; absent sur une page sans réglages. Infobulle : le titre des réglages, ou « Fermer ».

### Réglages de page

- `page-settings.ts` :
  - `PageSettingsContext` : contexte `{ title, setTitle, container }` (titre des réglages de la page affichée, `null` sans réglages ; élément où la page dessine ses réglages) ;
  - `useSettingsOpened()` : `{ opened, setOpened }`, ouvert si `?settings=1` (fermé par défaut, un lien peut l'ouvrir : `settingsPath`) ;
  - `usePageSettings()` : lit le contexte.
- `PageSettings` : composant qu'une page rend pour déclarer ses réglages : pose le titre (retiré au démontage) et, quand ils sont ouverts, dessine `children` dans l'aside par un portail ; les réglages restent dans l'arbre de la page (son état, ses données). Utilisé par ~13 pages (projets, trésorerie, tâches, stock, achats, fiches, routines, mails, facturation…). Voir [Fonctionnalités : réglages](../features/cross-cutting/settings.md).
- `SettingsAside` : aside de droite : poignée de redimensionnement à gauche (pas sur téléphone, où il prend toute la largeur), en-tête `PanelTitle` (titre, ou « Paramètres ») + bouton « Fermer les paramètres », corps défilant où la page dessine ses réglages.
- `SettingsOverlay` : voile sur le contenu pendant que les réglages sont ouverts (l'en-tête et la navigation restent utilisables) ; un clic dessus ou Échap ferme les réglages (Échap ignoré si un dialogue, une liste ou un menu est ouvert par-dessus). Couleur `--onoko-overlay-color` (tirée des tokens de couleur), fondu de 150 ms.

### Panneaux redimensionnables

`useResizablePanel`, `ResizeHandle` et `panel-widths.ts` (`SIDEBAR_PANEL`, `SETTINGS_PANEL`) sont dans `components/panels/` (la barre de navigation, les réglages de page et le panneau latéral les utilisent) : voir [Panneau latéral et modales](components/panels.md#panneaux-redimensionnables).

## Styles globaux (`styles/`)

- `layers.css` : ordre des couches CSS : `mantine`, puis `app` (styles de l'application), puis `states` (états communs).
- `tokens.css` : variables du système de design (couche `app`) :
  - `--onoko-vertical-step` : 24 px, rythme vertical ;
  - `--onoko-dragging-opacity` : 0,5 (élément glissé) ;
  - `--onoko-muted-opacity` : 0,5 (atténué : archivé, fait, fermé ou laissé de côté ; les tâches fermées sont atténuées) ;
  - `--onoko-disabled-opacity` : 0,4 ;
  - `--onoko-planned-opacity` : 0,6 et `--onoko-planned-typed-opacity` : 0,25 (créneaux planifiés de l'agenda) ;
  - `--onoko-pulse-opacity` : 0,35 (chrono en cours) ;
  - `--onoko-stale-opacity` : 0,6 (liste en cours de rafraîchissement) ;
  - `--onoko-overlay-color` : voile sous un panneau (le neutre le plus sombre de la palette à 35 %, pas de noir pur) ;
  - `--onoko-transition` : 150 ms `ease`, les petites transitions (survol, révélation, pliage).
- `breakpoints.json` : `tablet` 48em, `desktop` 70em, `gridSm` 29em, `heightMd` 67.5em ; lu par `postcss.config.cjs` (variables `$tablet-breakpoint`, `$desktop-breakpoint`, `$grid-sm-max`) et par `useIsPhone`.
- `reveal.css` : un élément `[data-reveal]` (actions de ligne, poignée, case) reste caché jusqu'au survol, au focus ou au menu ouvert de son hôte `[data-reveal-host]` ; toujours visible sur écran tactile.
- `drop.css` (couche `states`) : futur parent d'un élément glissé (`[data-drop-target]` dans un tableau, `[data-drop='INSIDE']` dans un arbre) teinté et encadré de la couleur primaire.
- `tabs.css` : les onglets horizontaux restent sur une ligne et défilent de côté quand la place manque (sauf les onglets de page `PageTabs`) ; la ligne sous les onglets est dessinée par la liste.
- `dialogs.css` : `overflow-y: auto !important` sur le contenu des modales et le corps du panneau latéral, la partie qui y défile (les gestionnaires de mots de passe mettent `overflow: visible` en style en ligne).

## Conventions

Règles de tout changement du web, en plus de `CLAUDE.md` ; les briques communes et leur rôle sont dans `docs/web/` et `docs/shared/`, les redondances qui restent dans `docs/code-redundancies.md`.

### Dossiers

- `src/app/` : démarrage, routes, registre des pages, thème, mise en page (ce document).
- `src/features/<feature>/` : code d'une fonctionnalité, en `api/` (requêtes et mutations), `pages/`, `components/`, `hooks/`, `lib/` (fonctions pures). Features : `account`, `accounting`, `alarms`, `auth`, `beneficiaries`, `calendar`, `comments`, `dashboards`, `files`, `geo`, `github`, `home`, `library`, `mail`, `projects`, `routines`, `sheets`, `shopping`, `stock`, `tasks`, `time`, `treasury`, `workspaces`. Voir `docs/web/features/`.
- `src/components/<domaine>/` : briques communes par domaine : `actions`, `address` (vide), `comments`, `data-table` (en sous-dossiers `cells`, `selection`, `table`, `toolbar`, `views`), `dialogs`, `dnd`, `feedback`, `filters`, `inheritance`, `inputs`, `items`, `markdown`, `money`, `page`, `panels`, `people`, `recurrence`, `settings`, `tabs`, `tree`. Voir `docs/web/components/`.
- `src/lib/` : fonctions et hooks transverses (voir [lib](lib.md)).
- `src/styles/` : styles globaux ; `src/graphql/` : code généré (codegen), ignoré par eslint.
- Une brique commune (`components/`, `lib/`) ne dépend pas d'une feature (règle eslint `NO_FEATURES`), sauf exceptions déclarées : `lib/query-client.ts`, `lib/week.ts`, `components/people/people-options.ts`, `components/markdown/MarkdownView.tsx`.
- La bibliothèque de documents (`features/library`) sera réécrite : ne pas y toucher (règles `no-restricted-syntax` désactivées pour elle).

### Une brique par rôle

- Chercher ce qui existe avant d'écrire (`components/**`, `lib/**`, `@ordo/shared`) ; à la deuxième copie, extraire une brique commune dans le dossier de son domaine, dans le même changement ; étendre une brique plutôt que d'en écrire une variante.
- Chaque nouvelle brique qui remplace un motif écrit à la main reçoit la règle eslint qui interdit l'ancien motif.
- Doublons : `npm run dup` (jscpd) ne doit pas signaler plus de copies qu'avant.
- Tous les tableaux de données sont un seul `DataTable` (voir [Tableaux de données](components/data-table.md)).

### Formulaires et modales

- Tout formulaire s'ouvre dans le panneau latéral de droite : `openFormPanel(title, render)` (voir [Panneaux](components/panels.md)) ; renommer passe par `openLabelForm`.
- Le panneau de détail d'un élément existant s'enregistre champ par champ : `useFieldSave` ([Utilitaires](lib.md)) et `SaveStatus`, sans bouton « Enregistrer » ; la création garde son formulaire et son bouton. Pour un élément récurrent, la portée est choisie une fois, à l'ouverture du panneau (`askScope`). Ainsi : tâches, routines, évènements, occurrences de routine de l'agenda, temps, alarmes ; dans l'économat, produits et éléments des achats, liste (« Modifier la liste »), livraisons, champs d'une fiche ; la facturation et la trésorerie ; projets, clients, jalons, sprints, contributeurs, diagrammes, boîtes mail, signatures, dossiers de recherche, éléments des listes de réglages, créneaux (et un créneau dans l'agenda), liaison GitHub. Restent des formulaires les actions faites une fois (utiliser une fiche, enregistrer un inventaire, un paiement, une relance, réaliser une prévision, changer d'identifiant ou de mot de passe…). Un seul « Enregistrer » voulu dans un panneau de détail : celui de la numérotation des documents (changer un compteur demande une validation délibérée). Une question de portée fermée sans choix ouvre le panneau en lecture seule.
- Panneaux d'une tâche, d'une routine et d'un évènement : une seule disposition, `DetailLayout` ([Panneaux](components/panels.md#detaillayouttsx)). En-tête : état (tâche ouverte / fermée et son numéro ; routine faite / à faire), titre modifiable comme dans tout formulaire (pas de bouton « Renommer »), boutons et menu « … » (toutes les actions de l'élément, dont « Dupliquer », « Archiver », « Supprimer » : pas de boutons en bas du panneau), projet, mentions (« Archivée », « Annulé », « Reporté ») et « Enregistré ». À gauche : description (son éditeur directement quand elle est vide), « Relations », répétition, « Commentaires ». À droite : des groupes titrés (`PanelGroup`, titres de `PANEL_GROUPS`) : « Classement » (statut, priorité, type, étiquettes ; catégories ; calendrier), « Parties prenantes » (assignés, bénéficiaires), « Charge » (tâche : effort, temps passé), « Planification » (routine : première fois, temps à y consacrer, temps morts, temps passé), « Périodes » (tâche), « Dates et heures » (évènement, dans le panneau et non dans une fenêtre), « Lieu » (trajets, « Partir à … » seulement avec un trajet aller), « Alarmes » (rappels, minuteurs), « Ressources » (liens, achats, fiches). Panneau étroit ou téléphone : la colonne de droite passe sous la gauche. La création garde la même disposition, avec ses boutons en bas.
- Une modale ne sert qu'aux confirmations et questions : `openModal`, et pour toute action destructive `confirmDestructive` (risques, « Cette action est irréversible. », bouton de confirmation rouge à gauche puis « Annuler » à droite, en bas à droite).
- Boutons de bas de formulaire : `FormActions` (« Annuler » puis l'action, « Supprimer » à gauche dans `danger`).
- Dates : un seul champ par rôle, de `components/inputs` ([Champs de saisie](components/inputs.md#dates-et-périodes)) : un jour `DateField`, un jour et son heure `DateTimeField` (la journée entière : `DateField`), un mois `MonthField`, une période (un début et une fin ensemble) `PeriodField`, un seul champ « du … au … » dont chaque bout est facultatif quand il l'est ; chaque sélecteur met en avant le jour du jour et offre « Aujourd’hui » (« Ce mois-ci » pour un mois), les semaines commencent le lundi (`WeekDatesProvider`). Dans un tableau, une cellule par bout (`dateRangeProps`).
- Validation : `useAppForm` (au blur, puis à chaque changement après une première erreur ; tout le formulaire à l'envoi) ; erreurs de l'API sous les champs (`formCallbacks`, `showFormError`).
- Résultat des actions en toast (`lib/notify`) : erreurs persistantes, autres fermées seules ; archiver et restaurer avec « Annuler ».

### Boutons

| Priorité    | Aspect                                  | Usage                                                                                                                           |
| ----------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `primary`   | Plein                                   | Ajouter un élément, valider une action, soumettre un formulaire                                                                 |
| `secondary` | Clair (`light`)                         | Toute autre action : « Annuler », « Exporter », « Filtrer », un menu, une page                                                  |
| `tertiary`  | Discret (`subtle`), taille `xs`         | Petites actions d'une section ou d'un formulaire : « Ajouter une ligne » (`AddItemButton`), « Valeurs par défaut », « Retirer » |
| `danger`    | Rouge plein (texte rouge en `tertiary`) | Action destructive (« Supprimer », « Délier »), jamais clair ni contour                                                         |

Et aussi :

- tout bouton d'action a une icône et un libellé (`ActionButton`) ; un bouton icône seul garde son infobulle (`IconAction`, libellé caché « Action « Élément » ») ;
- un bouton qui ouvre un menu ou un panneau porte une flèche (`MenuCaret`, ajoutée seule par `ActionButton`) ;
- une bascule n'est pas un bouton : interrupteur `StateSwitch`, ou `SegmentedControl` pour un choix de mode (`aria-pressed` interdit) ;
- « Archiver » / « Restaurer » n'est jamais un bouton : toujours dans le menu « … » (`archiveEntry`) ;
- menus : `ActionsMenu`, trois points verticaux, `light` à côté de boutons ; « Actions de « X » ».

### Colonnes oui / non

- Toute colonne oui / non d’un tableau montre une icône, jamais les mots « Oui » / « Non » : par défaut un petit carré plein, vert avec une coche pour oui, rouge avec une croix pour non (`YesNoIcon`, couleurs de `FEEDBACK_COLORS`).
- Variantes d’icônes : une valeur qui est un avertissement (en retard, bloquée, avancé, manquant, périssable, obligatoire) montre un triangle orange avec un point d’exclamation (couleur d’avertissement) ; un oui neutre (ni bien ni mal : facultatif, pourvu, durable) montre une coche bleue (couleur d’information) au lieu de verte.
- Chaque colonne nomme ses deux valeurs (oui d’abord) : ces noms sont ceux de ses groupes, le nom de ses icônes (lecteurs d’écran, infobulle) et les choix de son filtre, chacun précédé de son icône.
- Une valeur vide (ni oui ni non) laisse la cellule vide.
- L’export de données (CSV…) et la recherche gardent les mots « Oui » / « Non » (l’export est une donnée). Un document imprimé (PDF) peut ne montrer que le oui, le non laissé vide (plus lisible sur papier : « Acheté » de l’export PDF d’une liste d’achats).
- Groupés par une telle colonne : le groupe du oui, puis celui du non, puis « Sans valeur ».

| Page                             | Colonne                 | Oui                                  | Non                                       | Icônes                         |
| -------------------------------- | ----------------------- | ------------------------------------ | ----------------------------------------- | ------------------------------ |
| Tâches                           | « Fermée »              | « Fermée »                           | « Ouverte »                               | par défaut                     |
| Tâches                           | « Archivée »            | « Archivée »                         | « Active »                                | par défaut                     |
| Tâches                           | « En retard »           | « En retard »                        | « Dans le délai »                         | triangle orange / coche verte  |
| Tâches                           | « Bloquée »             | « Bloquée »                          | « Libre »                                 | triangle orange / coche verte  |
| Tâches                           | « A des sous-tâches »   | « Avec sous-tâche(s) »               | « Sans sous-tâche »                       | par défaut                     |
| Tâches                           | « A des commentaires »  | « Commentée »                        | « Non commentée »                         | par défaut                     |
| Tâches                           | « A des alarmes »       | « Avec alarme(s) »                   | « Sans alarme »                           | par défaut                     |
| Tâches                           | « A des achats »        | « Avec liste d’achats »              | « Sans liste d’achats »                   | par défaut                     |
| Tâches, routines                 | « Faisable maintenant » | « Maintenant »                       | « Plus tard »                             | par défaut                     |
| Routines                         | « Faite »               | « Faites »                           | « À faire »                               | par défaut                     |
| Routines                         | « En attente »          | « En attente »                       | « Libre »                                 | triangle orange / coche verte  |
| Listes d’achats                  | « Payée »               | « Payée »                            | « À payer »                               | par défaut                     |
| Une liste d’achats               | « Acheté »              | « Acheté »                           | « À acheter »                             | par défaut                     |
| Une liste d’achats, fiches       | « Facultatif »          | « Facultatif »                       | « Obligatoire »                           | coche bleue / triangle orange  |
| Produits de base                 | « Manque »              | « Manquants »                        | « Pourvus »                               | triangle orange / coche bleue  |
| Produits de base                 | « Suivie en stock »     | « Suivis en stock »                  | « Non suivis en stock »                   | par défaut                     |
| Produits de base                 | « Ajout auto au stock » | « Ajoutés automatiquement au stock » | « Non ajoutés automatiquement au stock »  | par défaut                     |
| Produits, stock, fiches          | « Consommable »         | « Consommable »                      | « Permanent »                             | par défaut                     |
| Stock                            | « Périssable »          | « Périssable »                       | « Durable »                               | triangle orange / coche bleue  |
| Liste à cocher (fiches)          | « Fait »                | « Collectés »                        | « À collecter »                           | par défaut                     |
| Lignes d’un mouvement            | « Prêt »                | « Avancé »                           | « Définitif »                             | triangle orange / coche verte  |
| Prévisions (trésorerie)          | « En retard »           | « En retard »                        | « Dans le délai »                         | triangle orange / coche verte  |

Les autres colonnes filtrées en oui / non qui montrent autre chose qu’une icône (pièces jointes, liens, rappels, répétition, référence…) gardent « oui » / « non » dans leur filtre et « Oui » / « Non » comme groupes.

- Une seule brique : `booleanColumn` (voir [Tableaux de données](components/data-table.md)), ses noms `groupLabels` requis et ses variantes `icons` ; une case modifiable en place reste une case à cocher (`EditableCheck`).

### Garde-fous eslint (`apps/web/eslint.config.js`)

Les messages des règles nomment la brique à utiliser. Catégories :

- **Imports interdits** (`no-restricted-imports`) : pièces Mantine enveloppées par une brique (`MultiSelect` → `BatchMultiSelect`, `ColorInput` → `ColorField`, `Menu` → `ActionsMenu`, `TimeInput` → `TimePicker`, `DatePickerInput` / `DateInput` / `DateTimePicker` / `MonthPickerInput` / `DatePicker` → `DateField` / `DateTimeField` / `MonthField` / `PeriodField`), icônes « trois points » (→ `ActionsMenu`), chemins uniques vers le partagé (`formatMoney`, `collator`, `normalize`, `monthOfDay`, `yearOfDay`, `dayIn`, `localInstant`, `FILTER_OPERATORS` passent par `lib/format`, `lib/text`, `lib/dates`, `operatorsFor`), champs de la condition de créneaux (`SLOT_CONDITION_FIELDS`, `SLOT_CONDITION_FIELD_OPERATORS` : seulement dans `SlotConditionBuilder`) ; et dépendance d'une brique commune envers une feature.
- **Formats** : pas d'`Intl.*Format` ni de `toLocale*String` (→ `lib/format`), pas de `.slice(0, 10)` / `split('T')` sur des dates (→ `lib/dates`), séparateurs de nombres (`FRENCH_NUMBER_FORMAT`), pourcentages, centimes (`fromCents`, `round2`), quantités, comptes (`fmt.count`), retards (`fmt.daysLate`, `LateBadge`, `LATE_COLOR`).
- **Textes et accords** : pluriels (`plural`, `countOf`, `countWith`, pas de « (s) »), accords (`agreed`), noms des mois, jours et ordinaux (listes partagées), comparaison de noms (`sameName`), libellés coupés (`clipText`, `fitName`), tailles des textes (`TEXT_SIZE_RULES` de `packages/shared/eslint-rules.js` : pas de longueur écrite à la main dans `z.string().max(…)`, `optionalText(…)` ou `maxLength`, ni de message « N caractères maximum. » / « Texte trop long. » → `requiredText`, `optionalText`, `shortTextSchema`, `plainTextSchema`, `optionalPlainText`, `markdownSchema`, `markdownTextSchema`, `TEXT_MAX`, `PLAIN_TEXT_MAX`, `MARKDOWN_MAX`), constantes partagées (`NO_SUBJECT`, `END_AFTER_START`, `DEFAULT_LABEL_COLOR`, « Brouillon »…), mots selon l'espace (« Relation » / « Proche » : `relationWords`, `relationNoun` ; « Créneaux » : `schedulesTitle`).
- **Composants d'interface** : boutons (`ActionButton` par priorité, `IconAction` au lieu d'`ActionIcon`, `RemoveButton`, `StateSwitch`, `MenuCaret`, infobulle par `hint`), pliage (`FoldButton`, `FoldHeading`, `FoldChevron`, « Développer / Réduire »), alertes (`ErrorAlert`, `NoticeAlert`), légendes (`Caption`), badges (capitales, `CountBadge`, `FileBadge`), colonnes oui / non (`booleanColumn` : pas de `text` « Oui » / « Non » écrit à la main), chargement plein écran (`FullPageLoader`), libellés cachés (élément cité, `item`, `itemCellLabel`, `bulkCellLabels`), sujets des menus (`name` / `about`).
- **Retours et dialogues** : toasts (`lib/notify`, `toastCallbacks`, `formCallbacks`, `ON_ERROR`, `notifyFailure`), modales (`openModal`, `confirmDestructive` avec `run` / `done`, « irréversible » ajouté par lui), états d'attente (`useAsyncAction`).
- **Dupliquer** : « Cloner » interdit, « Dupliquer » écrit à la main interdit (→ `duplicateRowsAction`, `DuplicateButton`), pas de formulaire de copie (attributs `copy` / `copyOf`).
- **Archivage** : filtre des archivés (`unarchived`, `archivedIds`, `archivedLabel`, `itemChoices`), interrupteur (`useArchivedToggle`), entrée de menu (`archiveEntry`).
- **Adresses** : pages et routes (`PAGES`, `AUTH_PATHS`, `projectPath`, `settingsPath`, `PROJECT_ROUTE`…), paramètres d'URL (`useSearchParam`, `usePageTab`), liens externes (`EXTERNAL_LINK`).
- **Données et clés** : mutations (`useInvalidatingMutation`), ordre (`movedTo`, `moveToIndex`), ensembles (`toggledIn`, `toggledInList`), clés composées (`taggedKey`, `personKey`, `occurrenceKey`, `joinedKey`, `taskNumberKey`…), arbres (`subtreeOf`), sommes (`sumOf`).
- **Briques de features** : règles propres à un domaine (périodes en un champ `PeriodField`, pas de `DateField` étalé d'une borne `{...range.start}`, bornes des cellules via `dateRangeProps`, cellules de `data-table`, mails, facturation, trésorerie, agenda, tâches, achats, lieu d'un élément `addressOf` / `LocationCell`, liens d'un élément `LinksField` / `ItemLinks` / `linkInputs`, glisser-déposer sur `components/dnd`, panneaux d’une tâche, d’une routine et d’un évènement : ni `Grid`, `SimpleGrid`, `Divider`, ni `SaveStatus`, `DetailHeader`, `MarkdownView`, `MarkdownEditor` importés dans `TaskPanel`, `RoutineForm`, `EventForm` → `DetailLayout`, `PanelGroup`, `DescriptionSection` / `FormDescription`…).
- **Pas de référence au plan** (règle locale `ordo/no-plan-references`, `ORDO_PLUGIN` / `planReferencesConfig` de `packages/shared/eslint-rules.js`, branchée sur le web, l'API et le partagé ; son expression `PLAN_REFERENCE` sert aussi à `scripts/check-docs.mjs`, qui vérifie les pages de `docs/` dans `npm run lint`) : un commentaire, ou une chaîne `description` / `message` (descriptions GraphQL, messages des gardes), ne cite ni une décision par sa lettre ou son numéro, ni un lot, ni une passe, ni les notes de travail du dépôt : il dit le comportement ; les règles sont décrites dans `docs/`. Les commentaires `///` de `schema.prisma` et les migrations ne sont pas vus par eslint.

Exceptions déclarées en fin de fichier : `ActionsMenu.tsx` (enveloppe `Menu` et dessine les trois points), les briques de dates (`DateField`, `DateTimeField`, `MonthField`, `PeriodField`) et `app/theme.ts` (enveloppent les sélecteurs de Mantine), `filter-meta.ts` (lit `FILTER_OPERATORS`), `AddressInput.tsx` et `features/library/**` (menus propres), et les fichiers autorisés à lire une feature (ci-dessus). Une exception ponctuelle s'écrit `// eslint-disable-next-line no-restricted-syntax -- <la brique elle-même>`.

### Vérifications

`npx tsc --noEmit -p tsconfig.app.json` et `npx eslint src` dans `apps/web` ; `npx tsc --noEmit` dans l'API et le partagé ; `npm run dup`. JSDoc sur chaque fonction ; icônes `@phosphor-icons/react`.
