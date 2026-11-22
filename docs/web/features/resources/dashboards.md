# Code web des tableaux de bord

Tous les fichiers de `apps/web/src/features/dashboards/` : requêtes GraphQL, page, composants (tableau, carte, éditeur, filtres, exports) et calculs des données des diagrammes. Fonctionnalités : [Tableaux de bord](../../../features/resources/dashboards.md) ; règles : [Règles des tableaux de bord](../../../business-rules/resources/dashboards.md) ; schémas partagés : [shared/dashboards](../../../shared/resources/dashboards.md).

## Vue d’ensemble

```text
DashboardsPage / ProjectPage (onglet overview)
└─ DashboardBoard (onglets, barre d’actions, grille)
   ├─ ChartCard (interne) ── useChartData ── ChartView
   │                          ├─ task-records (taskChartData)
   │                          ├─ finance-records (documentChartData, treasuryChartData)
   │                          └─ datasets (datasetParts, mergeDatasets) ── aggregate
   ├─ ChartEditor ── SourceFilters, CalendarPeriodPicker, DatasetsEditor, ChartView
   ├─ TransferChartForm
   └─ ImageExportForm ── chart-image (chartPng, downloadChartsPdf), chart-table
```

## api/

### `api/index.ts`

| Export                                  | Rôle                                                                                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sprintTaskKey(sprintId, taskId)`       | Clé « sprint\|task » (`joinedKey`) de la map de `useSprintTaskStatuses`. Utilisée par `chart-data.ts` et `task-records.ts`.                                                                           |
| `type Dashboard`                        | Un tableau de la requête `Dashboards` (`id`, `projectId`, `archived`, `label`, `position`, `charts`).                                                                                                 |
| `type DashboardChart`                   | Un diagramme (`id`, `dashboardId`, `label`, `config` JSON, `wide`, `position`).                                                                                                                       |
| `dashboardsKey`                         | Clé racine `['dashboards']` des requêtes ; invalidée par toutes les mutations et par l’archivage (`useSetArchived('DASHBOARD', [dashboardsKey])`).                                                    |
| `type SprintTaskStatus`                 | Statut d’une tâche à la fin d’un sprint terminé (`sprintId`, `taskId`, `statusId`, `closed`).                                                                                                         |
| `useSprintTaskStatuses(today, enabled)` | Requête `sprintTaskStatuses(today)` sous la clé des tâches (`[...tasksQueryKey, 'sprint-statuses', today]`), renvoie une `Map` par `sprintTaskKey`. Chargée seulement pour les diagrammes par sprint. |
| `useDashboards(projectId)`              | Requête `dashboards(projectId)` avec leurs diagrammes ; clé `[...dashboardsKey, projectId]`.                                                                                                          |
| `useDashboardMutations()`               | Objet de mutations : `create`, `rename`, `remove`, `move` (optimiste), `createChart`, `updateChart`, `duplicateChart`, `transferChart`, `removeChart`, `moveChart` (optimiste).                       |

Internes : documents GraphQL `SprintTaskStatusesDocument`, `DashboardsDocument`, `CreateDashboard`, `RenameDashboard`, `DeleteDashboard`, `MoveDashboard`, `CreateChart`, `UpdateChart`, `DuplicateChart`, `TransferChart`, `DeleteChart`, `MoveChart` ; `useDashboardMutation(fn)` (mutation qui invalide `dashboardsKey`, via `useInvalidatingMutation`) ; `interface ChartValues` (`label`, `config`, `wide`) ; `useMoveDashboard()` et `useMoveChart()` (réordonnent le cache aussitôt avec `moveToIndex`).

## pages/

### `pages/DashboardsPage.tsx`

| Export             | Rôle                                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DashboardsPage()` | Page `/dashboards` : `PageHeader` « Tableaux de bord » et `DashboardBoard projectId={null} title="Tous les projets"`. Routée dans `app/router.tsx`. |

## components/

### `components/DashboardBoard.tsx`

| Export                                 | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DashboardBoard({ projectId, title })` | Tableaux d’une portée (null : généraux ; sinon le projet et ses sous-projets) : onglets `SortableTabs` (créer, renommer, réordonner, archiver, supprimer), onglet courant dans `?dashboard=` (`useTabParam`), « Afficher les archivés » (`useArchivedToggle`), export PDF du tableau, menu « Nouveau diagramme » par source, grille triable (`SortableArea`, `SimpleGrid` 1/2 colonnes), état vide, bannière d’archivage. `title` sert aux exports. Utilisé par `DashboardsPage` et `features/projects/pages/ProjectPage.tsx`. |

Internes :

| Nom                                                                                             | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `interface Capture`, `interface CaptureOptions`, `type Captures`                                | Image exportée d’un diagramme (titre, description, PNG) ; options (schéma de couleurs, taille de dessin hors écran, taille finale) ; registre `ref` des fonctions de capture par diagramme.                                                                                                                                                                                                                                                             |
| `PRINT_SIZE`                                                                                    | Taille de dessin pour l’impression (1120 × 600).                                                                                                                                                                                                                                                                                                                                                                                                        |
| `drawnChart(element)`                                                                           | Attend qu’un SVG Recharts soit dessiné dans l’élément (3 s max, sinon « Le diagramme n’a pas pu être préparé pour l’impression. »).                                                                                                                                                                                                                                                                                                                     |
| `ChartCard(props)`                                                                              | Carte d’un diagramme : poignée (`useSortableItem`), titre, description (`describeChart`) et compte (`countLabel`), `ActionsMenu` (modifier, renommer via `openLabelForm`, dupliquer (`duplicateRowsAction` : copie enregistrée puis son éditeur ouvert par `onEdit(copie)`, `cachedItem`), largeur, `moveEntries`, « Déplacer vers… », exports image/PDF/CSV/PDF de données, supprimer via `confirmDestructive`) ; enregistre sa fonction de capture dans `captures` (dessin hors écran par portail à la taille demandée). `readOnly` sur un tableau archivé. |
| `moveTab`, `askLabel`, `confirmDelete`, `openEditor`, `exportDashboard` (dans `DashboardBoard`) | Déplacement d’onglet (index parmi tous les tableaux, archivé refusé avec `notifyError(ARCHIVED_MESSAGE)`), création/renommage, suppression confirmée, ouverture de `ChartEditor` dans `openFormPanel` (taille `lg` ; un diagramme, ou la source d’un nouveau), PDF de tous les diagrammes.                                                                                                                                                                                                        |

### `components/ChartEditor.tsx`

| Export                                                                  | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ChartEditor({ dashboardId, chart?, source, scope, context, onDone })` | Éditeur dans le panneau latéral : source (Facturation masquée en PERSO), type, sprint et « Reste à faire » d’un burndown, axe, mesure, « Regrouper par », période (`Select` glissant pour les tâches, `CalendarPeriodPicker` sinon), séries, cumulé, pleine largeur, `SourceFilters`, `DatasetsEditor`, erreur de validation, aperçu `ChartView`. Formulaire `useAppForm` sur `chartFormSchema` (titre, configuration, largeur). Nouveau diagramme (de la source `source`) : `FormActions` « Ajouter le diagramme » (`createChart`, `formCallbacks`). Diagramme existant : enregistré dès qu’il change (`useFieldSave`, le diagramme entier par `updateChart`, `SaveStatus` en haut des réglages) ; `change(changes, typing?)` met la configuration dans le formulaire et l’enregistre aussitôt, ou en quittant le texte en cours de saisie (`typing` ; `change({})` en le quittant) ; une configuration qui ne valide pas n’est pas enregistrée (son erreur en alerte) ; le diagramme du cache (`useDashboards`) suivi ; tableau archivé : lecture seule. Changer de source repart de `defaultChartConfig` et fait suivre le titre par défaut (`NEW_CHART_LABELS`), enregistrés ensemble. |

Internes : `TYPE_LABELS` (libellés des types), `interface ChartEditorProps`, `type ChartValues`, `chartValues(chart)` (valeurs d’un diagramme ; facturation et trésorerie sur une période calendaire).

### `components/DatasetsEditor.tsx`

| Export                                        | Rôle                                                                                                                                                                                                                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DatasetsEditor({ config, change, context })` | `change(changes, typing?)` : comme celui de `ChartEditor` (les libellés tapés : `typing`, enregistrés en les quittant). Jeux de données supplémentaires (accordéon : libellé, source, mesure, date, type de dessin, séries, filtres, retrait) et comparaisons (libellé, ratio/différence, type, A, B) ; boutons « Dupliquer le jeu principal », « Nouveau jeu », « Comparer deux jeux ». Utilisé par `ChartEditor`. |

Internes : `COMPARISON_LABELS`, compteur `datasetCount` et `newId(prefix)` (identifiants `d…` / `c…`), `interface DatasetsEditorProps`, fonctions `setDataset`, `addDataset(source | null)`, `removeDataset`, `addComparison`, `setComparison`.

### `components/source-filters.tsx`

| Export                                               | Rôle                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SourceFilters({ source, config, context, change })` | Filtres des éléments comptés selon la source : tâches (recherche, tapée puis enregistrée en la quittant (`change(…, true)`, puis `change({})`), `TaskFilterBuilder`, tâches archivées), facturation (`DocumentFilters`), trésorerie (`TreasuryFilters`). Utilisé par `ChartEditor` et `DatasetsEditor`. |

Internes : `type SourceFilterFields`, `type SourceFilterChange`, `DocumentFilters` (types, clients avec avatars via `listSelectProps`, statuts de suivi, avoirs en négatif, importés, brouillons), `TreasuryFilters` (comptes, catégories en arbre sous Entrées/Sorties par chemin via `treeOptions`/`categoryTree`/`categoryPaths`, sens, prévisionnel). Les valeurs archivées déjà choisies restent proposées (`unarchived`).

### `components/CalendarPeriodPicker.tsx`

| Export                                      | Rôle                                                                                                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CalendarPeriodPicker({ value, onChange })` | Période calendaire : échelle (mois, trimestre, année), courante / précédente / choisie, et sélecteur `MonthField` ou `YearPickerInput` pour une période choisie. Utilisé par `ChartEditor` (facturation, trésorerie). |

Internes : `CHOSEN` (noms « Mois choisi »…), `which(scale)` (options de la liste).

### `components/ChartView.tsx`

| Export                                                       | Rôle                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChartView` (`forwardRef`, props `config`, `data`, `height`) | Dessin Mantine Charts : `CompositeChart` pour plusieurs jeux (axe de droite en % pour les ratios, piles par jeu), `DonutChart`, `LineChart` (burndown linéaire), `AreaChart`, `BarChart` (empilé, valeurs négatives sous zéro). État vide `EmptyState`. Le `ref` contient le SVG lu par les exports. Utilisé par `ChartCard` et `ChartEditor`. |

Interne : `MixedTooltip` (infobulle des diagrammes mixtes, chaque série dans son unité), `interface ChartViewProps`.

### `components/TransferChartForm.tsx`

| Export                                                     | Rôle                                                                                                                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TransferChartForm({ chart, projectId, context, onDone })` | Déplacement vers un autre tableau : destination (général ou projet non archivé, arbre `treeSelectProps`), tableau cible non archivé (ou message de création), mutation `transferChart`. Ouvert depuis `ChartCard`. |

Interne : `GENERAL` (valeur de la destination générale), `interface TransferChartFormProps`.

### `components/ImageExportForm.tsx`

| Export                                  | Rôle                                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ImageExportForm({ onExport, onDone })` | Réglages de l’image PNG : thème, orientation, format, taille ; affiche la taille finale ; choix retenus dans `localStorage` (clé `ordo.dashboards.imageExport`). Ouvert depuis `ChartCard`. |

Internes : `interface ImageExportSettings`, `RATIOS` (16:9, 4:3, 3:2, A4, 1:1), `SIZES` (1280, 1920, 2560, 3840).

## lib/

### `lib/aggregate.ts`

| Export                              | Rôle                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `SERIES_TYPE_LABELS`                | Libellés « Barres », « Courbe », « Aire ».                                                                        |
| `DIMENSION_LABELS`                  | Libellé de chaque axe ou champ.                                                                                   |
| `MEASURE_LABELS`                    | Libellé de chaque mesure.                                                                                         |
| `measureLabel(source, measure)`     | Libellé d’une mesure dans une source (« Solde » pour le solde de trésorerie).                                     |
| `countLabel(config, count)`         | « 3 tâches », « 3 documents », « 3 mouvements », « 3 points ».                                                    |
| `NEW_CHART_LABELS`                  | Titre d’un nouveau diagramme par source.                                                                          |
| `parseConfig(config)`               | Configuration enregistrée validée par `chartConfigSchema`, ou `defaultChartConfig()` si elle ne valide plus (cartes de `DashboardBoard`, `ChartEditor`). |
| `MONEY_MEASURES`                    | Mesures en euros.                                                                                                 |
| `PALETTE`                           | Couleurs Mantine des séries.                                                                                      |
| `interface ChartSeries`             | Série : nom, couleur, pointillés, type, axe Y, pile.                                                              |
| `interface ChartData`               | Données dessinées : lignes, séries, parts d’anneau, nombre compté (`taskCount`), `empty`, `mixed`, `percentAxis`. |
| `interface Key`                     | Valeur d’un champ (clé, libellé, ordre, couleur).                                                                 |
| `interface ChartRecord`             | Ce que l’agrégation demande d’un élément : `day`, `keys`, `value`.                                                |
| `none(label)`                       | Valeur « aucune » (grise, triée en dernier).                                                                      |
| `bucketOf(day, bucket)`             | Premier jour de la tranche (semaine depuis le premier jour de semaine de l’espace, `currentWeek`).                |
| `nextBucket(start, bucket)`         | Tranche suivante.                                                                                                 |
| `bucketLabel(start, bucket)`        | « 3 nov. », « sem. 3 nov. », « nov. 2026 », « T4 2026 », « 2026 ».                                                |
| `periodRange(period, today)`        | Bornes `[début, fin[` d’une période (calendaire, glissante via `filterPeriod`, ou nulles pour « all »).           |
| `periodLabel(period)`               | Nom d’une période (« 12 derniers mois », « Ce mois-ci », « mars 2026 »…).                                         |
| `aggregate(records, config, today)` | Répartit les éléments sur l’axe et les séries, mesure, cumule, complète les tranches vides ; produit `ChartData`. |
| `calendarParts(period)`             | Échelle et ancre d’une période calendaire (année courante pour une période glissante).                            |

Internes : `SERIES_NAMES` (nom de la série unique par mesure), `NONE_ORDER`, `ROLLING_LABELS`, `compareKeys`.

### `lib/chart-data.ts`

| Export                                 | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SOURCE_LABELS`                        | « Tâches », « Facturation », « Trésorerie ».                                                                                                                                                                                                                                                                                                                                                                                                       |
| `describeChart(config, context)`       | Description en mots (sous-titre des cartes et des exports).                                                                                                                                                                                                                                                                                                                                                                                        |
| `interface ChartScope`                 | Portée du tableau (`projectId`).                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `useChartData(config, scope, context)` | Hook central : découpe en jeux (`datasetParts`), charge ce que demandent les sources (colonnes de tâches `useTaskColumns`, statuts de fin de sprint, documents et importés, écritures, projection, comptes et réglages de trésorerie), filtre les tâches de la portée (`matchTasks`, avec un délai de 250 ms), calcule chaque jeu puis fusionne (`mergeDatasets`). Renvoie `{ data, isPending, error }`. Utilisé par `ChartCard` et `ChartEditor`. |

Interne : `BUCKET_LABELS`.

### `lib/datasets.ts`

| Export                           | Rôle                                                                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `datasetParts(config)`           | Jeu principal puis jeux supplémentaires, chacun en configuration complète sur l’axe du diagramme.                                      |
| `mergeDatasets(results, config)` | Un seul `ChartData` mixte : séries de chaque jeu (noms rendus uniques), lignes jointes par axe, comparaisons calculées sur les totaux. |

Internes : `interface DatasetPart`, `compare(kind, a, b)`.

### `lib/task-records.ts`

| Export                                                    | Rôle                                                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `interface SprintView`                                    | Tâches telles qu’à la fin des sprints terminés (correspondances, statuts, tâches en plus).                                            |
| `taskChartData(tasks, config, context, today, bySprint?)` | Données d’un diagramme de tâches (burndown à part) ; par sprint, une entrée par sprint correspondant avec le statut de fin de sprint. |

Internes : `CATEGORY_LABELS`, `taskDay`, `groupKeys` (valeurs de chaque champ), `valueOf` (1, `leafEffort`, heures suivies), `burndown`.

### `lib/finance-records.ts`

| Export                                                                     | Rôle                                                                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `documentChartData(documents, imported, config, context, projects, today)` | Données d’un diagramme de facturation.                                                                                                           |
| `treasuryChartData(input)`                                                 | Données d’un diagramme de trésorerie (mouvements réels et attendus, ventilation, compensation des liés ; contexte proposé des attendus et du non réparti par `contextPlanner` sur `ephemerides`, aucun un jour couvert par plusieurs contextes) ; délègue le solde à `balanceChartData`. |

Internes : `TYPE_ORDER`, `TYPE_COLORS`, `PROJECTION_KINDS`, `interface ChartDocument`, `paymentKeys`, `chartDocuments` (filtres et portée), `interface ChartMovement`, `balanceChartData` (solde par tranche, Réel / Prévu).

### `lib/chart-table.ts`

| Export                                          | Rôle                                                                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `chartTable(data, config)`                      | Tableau des données (axe, séries ou parts), avec ligne de total quand elle a du sens (pas de cumul, de solde, de burndown ni de pourcentage). |
| `downloadChartCsv(table, title)`                | CSV (via `downloadCsv` de `lib/download`).                                                                                                    |
| `downloadChartTablePdf(table, title, subtitle)` | PDF du tableau via `postTablePdf` (route `table.pdf`).                                                                                        |

Interne : `interface ChartTable`.

### `lib/chart-image.ts`

| Export                                         | Rôle                                                                                                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type ExportScheme`                            | `current`, `light` ou `dark`.                                                                                                                                                         |
| `chartSizeFor(frame, legendItems)`             | Taille de dessin pour qu’une image remplisse un cadre donné (titre et légende compris).                                                                                               |
| `chartPng(container, title, legend, options?)` | PNG d’un diagramme dessiné : copie le SVG avec ses styles calculés (dans le schéma demandé, sans repeindre la page), dessine titre, diagramme et légende sur un canvas à l’échelle 2. |
| `downloadChartsPdf(input)`                     | Envoie les images à `/api/exports/charts.pdf` (`postExport`) et télécharge le PDF.                                                                                                    |

Internes : `STYLES`, `SCALE`, `PAD`, `TITLE_HEIGHT`, `LEGEND_LINE`, `resolveColor`, `loadImage`, `withScheme`.

## Briques partagées utilisées

`SortableTabs`, `SortableArea`, `useSortableItem`, `DragHandle`, `ActionsMenu`, `moveEntries`, `ActionButton`, `ActionsRow`, `AddItemButton`, `RemoveButton`, `EmptyState`, `ErrorAlert`, `ArchivedNotice`, `ArchivedBadge`, `ShowArchivedSwitch`, `BlockSkeleton`, `confirmDestructive`, `openFormPanel`, `openLabelForm`, `FormActions`, `LabeledField`, `BatchMultiSelect`, `treeSelectProps`/`treeOptions`, `listSelectProps`, `lib/archive`, `lib/notify`, `lib/download`, `lib/format`, `lib/periods`, `useAsyncAction`. Côté features : `TaskFilterBuilder`, `useTaskContext`, `useTaskColumns`, `matchTasks`, `leafEffort` (tâches), API facturation et trésorerie.
