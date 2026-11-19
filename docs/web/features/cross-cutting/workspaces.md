# Code web : espaces

Tous les fichiers de `apps/web/src/features/workspaces/` : requête des espaces, espace actif, changement d’espace par fenêtre, sélecteur, gestion, notifications des autres espaces et garde des pages PRO. Fonctionnalités : [Espaces](../../../features/cross-cutting/workspaces.md) ; règles : [Règles des espaces](../../../business-rules/cross-cutting/workspaces.md).

## `api/`

### `api/index.ts`

| Export                                | Rôle                                                                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Workspace`                           | Type d’un espace de la requête `Workspaces` (`id`, `label`, `kind`, `position`, `notifyElsewhere`, `weekStart`, `weekEnd`).                                                                                                                |
| `NotificationSource`, `WorkspaceKind` | Types GraphQL réexportés (`ALARMS` / `CALENDAR` / `MAILS`, `PRO` / `PERSO`).                                                                                                                                                               |
| `workspacesQueryKey`                  | Clé `['workspaces']` ; lue aussi par `lib/week.ts` (semaine de l’espace actif).                                                                                                                                                            |
| `useWorkspaces()`                     | Requête `Workspaces` + `currentWorkspaceId`, `staleTime: Infinity` ; à la réception, appelle `rememberWorkspace(currentWorkspaceId)` pour épingler les requêtes de l’onglet.                                                               |
| `useActiveWorkspace()`                | `{ workspace, perso }` : l’espace affiché et s’il est personnel. Utilisé par toutes les vues qui diffèrent en PERSO (barre latérale, formulaires de projet, accueil, agenda, trésorerie, achats, tableaux de bord, bénéficiaires…).        |
| `useWorkspaceMutations()`             | `{ create, update, setNotifications, setWeek, move, remove }` (`useInvalidatingMutation`) ; toutes invalident `workspacesQueryKey`, sauf `setWeek` qui invalide tout le cache (« cette semaine » change partout). `create` rend l’id créé. |

## `components/`

### `components/ElsewhereNotifier.tsx`

- `ElsewhereNotifier()` : ne rend rien de visible ; monte un `ElsewhereWorkspace` (interne) par autre espace dont `notifyElsewhere` n’est pas vide. Monté dans `app/layout/AppLayout.tsx`.
- `ElsewhereWorkspace({ workspace })` (interne) : pour un espace fermé, via `executeIn(id, …)` (requêtes dans un autre espace) :
  - `ALARMS` : requête `ElsewhereAlarms` (alarmes avec tâche et projet, projets, chrono en cours) toutes les 60 s (`ALARMS_MS`) ; `dueAlarms` / `ringAlarm` (de `features/alarms/components/ring`) toutes les 15 s (`TICK_MS`) ; `ElsewhereMarkAlarmFired` marque l’occurrence sonnée ; liens via `alarmTarget`.
  - `CALENDAR` : `fetchCalendarEvents` de J-1 à J+8 toutes les 5 min (`CALENDAR_MS`) ; `ringReminders`.
  - `MAILS` : rend `MailWatcher` (de `features/mail`) pour cet espace.
  - Chaque lien de notification appelle `switchWorkspace(id, path)`.

### `components/WorkspaceGate.tsx`

`WorkspaceGate({ children })` : n’affiche les pages qu’une fois `useWorkspaces` chargé (pages différentes en PERSO, requêtes épinglées d’abord) ; sinon `FullPageLoader` « Chargement de l’espace » ou `ErrorAlert`. Utilisé par `AppLayout`.

### `components/WorkspaceKindIcon.tsx`

`WorkspaceKindIcon({ kind })` : mallette (`BriefcaseIcon`, « Professionnel ») ou maison (`HouseLineIcon`, « Personnel »). Utilisé par le sélecteur et la gestion.

### `components/WorkspacesManager.tsx`

- `WorkspacesManager()` : `SettingsGrid` avec la section « Espaces » (une ligne par espace) et « Nouvel espace » (libellé limité à `TEXT_MAX`, type par défaut `PERSO`, toast « Espace créé. »). Utilisé par `SettingsPage` (onglet `workspaces`) et le panneau ouvert depuis le sélecteur.
- `WorkspaceRow({ workspace, index, count, current, fallbackId })` (interne) : type (`SegmentedControl`), menu `InlineActions` (« Renommer » via `openLabelForm` + `workspaceLabelSchema`, `moveEntries`, « Ouvrir »), `RemoveButton` + `confirmDestructive` (bascule sur `fallbackId` si l’espace ouvert est supprimé), puces des notifications (`Chip.Group`), semaine (deux `Select` sur `WEEKDAY_LABELS`, `readWeek`, `weekLength`).
- Constantes internes : `KINDS`, `SOURCES`, `WEEKDAYS`.

### `components/WorkspaceSwitcher.tsx` (+ `WorkspaceSwitcher.module.css`)

`WorkspaceSwitcher({ variant = 'button' | 'text' })` : menu `ActionsMenu` (au survol) des espaces, l’actuel coché, et « Gérer les espaces… » ; cible bouton (`AppLayout`, téléphone) ou texte (`app/layout/HeaderTitle.tsx`). Interne : `openWorkspacesManager()` (`openFormPanel('Espaces', …, 'lg')`).

## `lib/`

### `lib/switch.ts`

Mémoire de l’espace de la fenêtre. Effets de bord au chargement du module : épingle les requêtes sur l’espace de la fenêtre (`sessionStorage`) dès la première requête, et remet le cookie sur cet espace quand la fenêtre reprend le focus ou redevient visible (`reclaimCookie`).

| Export                       | Rôle                                                                                                                                                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rememberWorkspace(id)`      | Mémorise l’espace de la fenêtre (`sessionStorage` `ordo.workspace`), pose le cookie `ordo_workspace` (un an, `samesite=lax`, lu par l’API pour les liens et téléchargements) et épingle les requêtes (`pinWorkspace` de `lib/graphql-client`). Appelé par `useWorkspaces`. |
| `switchWorkspace(id, path?)` | Ouvre un autre espace dans cette fenêtre seulement : mémorise puis recharge sur `path`, par défaut la même page vue depuis l’autre espace (`samePageElsewhere`). Utilisé par le sélecteur, la gestion, `ElsewhereNotifier`, `MailWatcher`, `SubscribedEvent` (agenda).     |

Internes : `COOKIE`, `WINDOW_KEY`, `windowWorkspace`, `setCookie`, `ITEM_PAGES` (pages d’un élément → page de leur liste : projet et client → accueil, document comptable → `/accounting`, liste d’achats → `/shopping`), `KEPT_PARAMS` (`tab` seulement), `samePageElsewhere`, `reclaimCookie`.

## `pages/`

### `pages/ProOnly.tsx`

`ProOnly({ children })` : garde de route ; en PERSO, `PageMessage` « Indisponible dans un espace personnel ». Utilisé par `app/router.tsx` pour `/accounting`, `/accounting/imported/:id`, `/accounting/:id` et `/clients/:id`.
