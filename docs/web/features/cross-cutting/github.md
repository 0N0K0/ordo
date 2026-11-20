# Code web : GitHub

Tous les fichiers de `apps/web/src/features/github/` : API GitHub, paramètres de connexion, panneau GitHub d’un projet et texte du résumé de synchronisation. Fonctionnalités : [GitHub](../../../features/cross-cutting/github.md) ; règles : [Règles GitHub](../../../business-rules/cross-cutting/github.md).

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

Internes : `githubKey = ['github']`, documents GraphQL, `useGithubMutation` (invalide `githubKey` et `tasksQueryKey` : une synchronisation change les tâches).

## `components/`

### `components/GithubSettings.tsx`

`GithubSettings()` : onglet « GitHub » de `SettingsPage` : section « Connexion » (`PasswordInput` du jeton, « Connecter » / « Remplacer », « Déconnecter » avec `confirmDestructive`, toast `notifySuccess`), section « Contributeurs sur GitHub » (table des logins). Squelette `FormSkeleton` au chargement. Interne : `LoginField({ id, login })` (champ « @ » enregistré au `blur`, erreur affichée sous le champ).

### `components/ProjectGithubPanel.tsx`

`ProjectGithubPanel({ projectId })` : section « GitHub » des paramètres d’un projet (`ProjectPage`) : invitation à se connecter, ou formulaire d’adresse + `LinkForm` prérempli, ou carte de la liaison (« Synchroniser » avec `toastCallbacks` et `syncSummaryText`, « Réglages » → `EditLink`, « Délier » avec `confirmDestructive`), erreur de la dernière synchronisation.

Internes :

| Élément                                                            | Rôle                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SYNONYMS`                                                         | Noms anglais usuels des options pour chaque libellé Ordo normalisé (« a faire », « en cours », « en revue », « termine », « annule », « urgente », « haute », « moyenne », « basse »).                                                                                                                                                                   |
| `guessOption(name, options)`                                       | Option devinée : même nom (`sameName`) ou synonyme (`nameKey`).                                                                                                                                                                                                                                                                                          |
| `guessField(board, type, name?)`                                   | Premier champ d’un type dont le nom correspond.                                                                                                                                                                                                                                                                                                          |
| `ISSUE_TYPES`                                                      | Valeur du select « Type » qui désigne les types d’issue de l’organisation.                                                                                                                                                                                                                                                                               |
| `guessSettings(board, context)`                                    | Réglages devinés d’un tableau (champs, correspondances des statuts, priorités et types du contexte des tâches).                                                                                                                                                                                                                                          |
| `LinkForm({ projectId, board, initial, saved?, context, onDone })` | Réglages (`useAppForm` sur `githubLinkFormSchema`) ; `mappingTable` (table de correspondance) ; nouvelle liaison (sans `saved`) : « Lier » par `saveLink` ; liaison existante : enregistrée champ par champ (décision D22, `useFieldSave`, la liaison entière par `saveLink`, dépôt en le quittant, `SaveStatus`, `saved` : la liaison du cache suivie). |
| `linkValues(link)`                                                 | Réglages d’une liaison tels que le formulaire les tient.                                                                                                                                                                                                                                                                                                 |
| `EditLink({ link, context })`                                      | Recharge le tableau d’une liaison puis ouvre `LinkForm` avec ses réglages (`initial` et `saved` : `linkValues`).                                                                                                                                                                                                                                         |

## `lib/`

### `lib/sync-summary.ts`

- `SyncSummary` : compteurs d’une synchronisation (`pulledNew`, `pushedNew`, `pulled`, `pushed`, `unlinked`, `sprints`, `sprintsSkipped`, `renumbered`, `comments`), tous facultatifs.
- `syncSummaryText(summary)` : la phrase du résumé, la même dans le toast et sous la liaison (`countOf`, `plural`). Utilisé par `ProjectGithubPanel`.
