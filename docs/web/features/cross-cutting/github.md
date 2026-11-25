# Code web : GitHub

Tous les fichiers de `apps/web/src/features/github/` : API GitHub, paramètres de connexion, panneau GitHub d’un projet, badge et états GitHub d’une tâche et texte du résumé de synchronisation. Fonctionnalités : [GitHub](../../../features/cross-cutting/github.md) ; règles : [Règles GitHub](../../../business-rules/cross-cutting/github.md).

## `api/`

### `api/index.ts`

| Export                     | Rôle                                                                                                                   | Utilisé par                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `GithubBoard`              | Tableau de la requête `GithubBoard` (champs avec `dataType`, options, `iterationCount`, `issueField` ; types d’issue). | `ProjectGithubPanel`                         |
| `GithubLink`               | Liaison d’un projet (`GithubProjectLink`), réglages, état de la dernière synchronisation et `linkedTaskCount`.         | `ProjectGithubPanel`                         |
| `LinkValues`               | Réglages d’une liaison = `GithubLinkInput` de `@ordo/shared`.                                                          | `ProjectGithubPanel`                         |
| `useGithubLogin()`         | Login du compte connecté, ou `null`.                                                                                   | `GithubSettings`, `ProjectGithubPanel`       |
| `useGithubContributors()`  | Contributeurs (non archivés) avec leur login GitHub.                                                                   | `GithubSettings`                             |
| `useGithubBoard(url)`      | Tableau d’une adresse, chargé quand `url` est donné, sans nouvel essai.                                                | `ProjectGithubPanel` (`EditLink` et liaison) |
| `useGithubLink(projectId)` | Liaison d’un projet.                                                                                                   | `ProjectGithubPanel`                         |
| `useGithubMutations()`     | `{ setToken, removeToken, saveLink, unlink, sync, setLogin }`.                                                         | `GithubSettings`, `ProjectGithubPanel`       |
| `useSendTasksToGithub()`   | « Envoyer sur GitHub » (`sendTasksToGithub(ids)`) : rend `{ sent, errors }`.                                           | `useTaskRowsActions` (`BulkBar`)             |

Internes : `githubKey = ['github']`, documents GraphQL, `useGithubMutation` (invalide `githubKey` et `tasksQueryKey` : une synchronisation change les tâches).

## `components/`

### `components/GithubSettings.tsx`

`GithubSettings()` : onglet « GitHub » de `SettingsPage` : section « Connexion » (`PasswordInput` du jeton, « Connecter » / « Remplacer », « Déconnecter » avec `confirmDestructive`, toast `notifySuccess`), section « Contributeurs sur GitHub » (table des logins). Squelette `FormSkeleton` au chargement. Interne : `LoginField({ id, login })` (champ « @ » enregistré au `blur`, erreur affichée sous le champ).

### `components/ProjectGithubPanel.tsx`

`ProjectGithubPanel({ projectId })` : section « GitHub » des paramètres d’un projet (`ProjectPage`) : invitation à se connecter, ou formulaire d’adresse + `LinkForm` prérempli, ou carte de la liaison (« Synchroniser » avec `toastCallbacks` et `syncSummaryText`, « Réglages » → `EditLink`, « Délier » avec `confirmDestructive`), erreur de la dernière synchronisation, arrêt de la synchronisation des itérations (`iterationWriteError`, « Reprendre » : `resumeIterations`), refus de la dernière écriture (`iterationWriteRefusal`, `NoticeAlert` d’avertissement). `LinkForm` : interrupteur « Écrire les itérations sur GitHub » (`writeIterations`) et son rappel.

Internes :

| Élément                                                            | Rôle                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SYNONYMS`                                                         | Noms anglais usuels des options pour chaque libellé Ordo normalisé (« a faire », « en cours », « en revue », « termine », « annule », « urgente », « haute », « moyenne », « basse »).                                                                                                                                                                   |
| `guessOption(name, options)`                                       | Option devinée : même nom (`sameName`) ou synonyme (`nameKey`).                                                                                                                                                                                                                                                                                          |
| `guessField(board, type, name?)`                                   | Premier champ d’un type dont le nom correspond.                                                                                                                                                                                                                                                                                                          |
| `ISSUE_TYPES`                                                      | Valeur du select « Type » qui désigne les types d’issue de l’organisation.                                                                                                                                                                                                                                                                               |
| `guessSettings(board, context)`                                    | Réglages devinés d’un tableau (champs, correspondances des statuts, priorités et types du contexte des tâches).                                                                                                                                                                                                                                          |
| `LinkForm({ projectId, board, initial, saved?, context, onDone })` | Réglages (`useAppForm` sur `githubLinkFormSchema`) ; `mappingTable` (table de correspondance) ; nouvelle liaison (sans `saved`) : « Lier » par `saveLink` ; liaison existante : enregistrée champ par champ (`useFieldSave`, la liaison entière par `saveLink`, dépôt en le quittant, `SaveStatus`, `saved` : la liaison du cache suivie). |
| `linkValues(link)`                                                 | Réglages d’une liaison tels que le formulaire les tient.                                                                                                                                                                                                                                                                                                 |
| `EditLink({ link, context })`                                      | Recharge le tableau d’une liaison puis ouvre `LinkForm` avec ses réglages (`initial` et `saved` : `linkValues`).                                                                                                                                                                                                                                         |

### `components/TaskGithubBadge.tsx`

`TaskGithubBadge({ task })` : badge GitHub de l’en-tête du panneau d’une tâche (`TaskDetail`), rien hors d’une arborescence liée (`githubState` nul) : « GitHub #n » (lien vers l’issue, `EXTERNAL_LINK`) ou « Brouillon GitHub » ; sinon le nom de l’état (`GITHUB_TASK_STATE_LABELS`) dans sa couleur, avec son infobulle (`githubStateHint`).

## `lib/`

### `lib/task-github-state.ts`

- `GITHUB_STATE_COLORS` : couleur de chaque état GitHub d’une tâche (sur GitHub vert, pas sur GitHub gris, retirée du tableau orange).
- `GITHUB_STATE_HINTS`, `GITHUB_SEND_HINT`, `GITHUB_RESTORE_HINT`, `githubStateHint(task)` : infobulle d’une tâche pas sur GitHub : ce que veut dire son état (« Pas sur GitHub », « Retirée du tableau GitHub »), suivi de la phrase qui dit ce qui l’envoie : maintenant quand elle peut l’être (`githubSendable`), une fois restaurée pour une tâche archivée retirée du tableau.
- `GITHUB_STATE_BADGES` : les états comme ceux d’une colonne d’état (`ColumnState`) : la colonne « GitHub » des tâches (`taskColumns`).

### `lib/sync-summary.ts`

- `SyncSummary` : compteurs d’une synchronisation (`pulledNew`, `pushedNew`, `pulled`, `pushed`, `unlinked`, `sprints`, `sprintsPushed`, `sprintsSkipped`, `sprintsBlocked`, `sprintsUnpaired`, `renumbered`, `comments`, `failed`), tous facultatifs.
- `syncSummaryText(summary)` : la phrase du résumé, la même dans le toast et sous la liaison (`countOf`, `plural`). Utilisé par `ProjectGithubPanel`.
