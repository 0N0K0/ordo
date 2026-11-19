# Paquet partagé : `dashboards`

Configuration des graphiques des tableaux de bord (sources, axes, mesures, séries, périodes, jeux de données, comparaisons) et traduction des anciens filtres de tâches. Source : `packages/shared/src/dashboards/`.

Voir aussi : [Fonctionnalités : tableaux de bord](../../features/resources/dashboards.md), [Règles : tableaux de bord](../../business-rules/resources/dashboards.md), [tables](../cross-cutting/tables.md).

## `dashboards.ts` — graphiques

| Export                                                                 | Rôle                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ChartSource`                                                          | Source : `tasks`, `documents` (devis, factures…), `treasury` (mouvements).                                                                                                                                                                       |
| `SERIES_TYPES` / `SeriesType`                                          | Tracé d'une série d'un graphique mixte : `bar`, `line`, `area`.                                                                                                                                                                                  |
| `ChartType`                                                            | `bar`, `stackedBar`, `line`, `area`, `donut`, `burndown` (sprint de tâches).                                                                                                                                                                     |
| `ChartDimension`, `ChartGroupDimension`                                | Axes possibles : dates (`createdAt`, `closedAt`, `startDate`, `endDate`, `issueDate`, `dueDate`, `sentAt`, `acceptedAt`, `date`) et champs de regroupement (tableau ci-dessous).                                                                 |
| `ChartMeasure`                                                         | `count`, `effort`, `trackedTime`, `totalNet`, `totalGross`, `paid`, `balance`, `amount`, `income`, `expense`.                                                                                                                                    |
| `SOURCE_TIME_DIMENSIONS`, `SOURCE_GROUP_DIMENSIONS`, `SOURCE_MEASURES` | Dates, champs et mesures permis par source (tableau ci-dessous).                                                                                                                                                                                 |
| `CHART_BUCKETS` / `ChartBucket`                                        | Pas de l'axe temporel : `day`, `week`, `month`, `quarter`, `year`.                                                                                                                                                                               |
| `CHART_PERIODS`                                                        | Périodes glissantes : `past:28`, `past:91`, `past:182`, `past:365`, `past:730`, `next:91`, `next:182`, `next:365`, `all`.                                                                                                                        |
| `CALENDAR_PERIOD`                                                      | Période calendaire `month\|quarter\|year:` suivi de `0` (en cours), `-1` (précédente) ou d'un premier jour `YYYY-MM-DD`.                                                                                                                         |
| `ChartPeriod`                                                          | Période glissante ou calendaire.                                                                                                                                                                                                                 |
| `calendarRange(period, today)`                                         | `[premier jour, lendemain du dernier]` d'une période calendaire, ou `null`.                                                                                                                                                                      |
| `isTimeDimension(dimension)`                                           | Vrai pour une date.                                                                                                                                                                                                                              |
| `documentChartFilterSchema` / `DocumentChartFilter`                    | Documents comptés : `types` (vide : tous), `clientIds`, `statusIds` (statuts de suivi), `includeDrafts` (faux), `includeImported` (vrai : documents émis avant Ordo), `creditNotesNegative` (vrai : les avoirs diminuent les montants).          |
| `TreasuryChartFilter`                                                  | Mouvements comptés : `accountIds`, `categories`, `direction` (`all`, `in`, `out`), `includeForecast` (prévisions, factures à échoir, factures récurrentes à venir).                                                                              |
| `MAIN_DATASET`                                                         | `'main'` : id du jeu de données principal.                                                                                                                                                                                                       |
| `ChartDataset`                                                         | Jeu de données supplémentaire : `id` (1 à 40), `label` (« Nommez le jeu de données. », 60), `source`, `measure`, `dateField` (date propre sur un axe temporel), `series`, `type` (tracé ; celui du graphique si `null`), et les filtres communs. |
| `CHART_COMPARISON_KINDS`                                               | `ratio` (part de a dans b, en %, axe de droite), `difference` (a − b).                                                                                                                                                                           |
| `ChartComparison`                                                      | `id`, `label` (« Nommez la comparaison. »), `kind`, `a`, `b` (ids de jeux), `type` (`line` par défaut).                                                                                                                                          |
| `chartConfigSchema` / `ChartConfig`                                    | Configuration complète (tableau ci-dessous).                                                                                                                                                                                                     |
| `CHART_LABEL_MAX` / `chartLabelSchema`                                 | Libellé de graphique : requis, 120.                                                                                                                                                                                                              |
| `DASHBOARD_LABEL_MAX` / `dashboardLabelSchema`                         | Libellé de tableau de bord : requis, 60.                                                                                                                                                                                                         |
| `defaultChartConfig(source = 'tasks')`                                 | Nouveau graphique : tâches créées par semaine (barres) ; documents : CA HT facturé par mois sur l'année en cours (factures, acomptes, avoirs) ; trésorerie : montants par mois de l'année en cours, séries par sens.                             |

Champs et mesures par source :

| Source      | Dates                                           | Regroupements                                                                                                  | Mesures                                              |
| ----------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `tasks`     | `createdAt`, `closedAt`, `startDate`, `endDate` | `sprint`, `milestone`, `project`, `status`, `statusCategory`, `priority`, `type`, `assignees`, `tags`, `state` | `count`, `effort`, `trackedTime`                     |
| `documents` | `issueDate`, `dueDate`, `sentAt`, `acceptedAt`  | `documentType`, `trackingStatus`, `client`, `project`, `payment`, `documentState`, `origin`                    | `totalNet`, `totalGross`, `paid`, `balance`, `count` |
| `treasury`  | `date`                                          | `category`, `member`, `context`, `account`, `direction`, `project`, `entryStatus`                              | `amount`, `income`, `expense`, `balance`, `count`    |

Champs de `chartConfigSchema` : `source` (`tasks`), `type`, `dimension` (axe ; catégories d'un donut), `bucket` (`week`), `period` (`past:91`), `measure` (`count`), `series`, `cumulative` (cumul le long d'un axe temporel), `sprintId` (burndown), `filter` (filtre de tâches, voir plus bas), `search`, `includeArchived`, `documents`, `treasury`, `label` (60 max, jeu principal), `datasets` (8 max : « 8 jeux de données supplémentaires maximum. »), `comparisons` (8 max : « 8 comparaisons maximum. »).

Contrôles de cohérence (`superRefine`) :

- « Axe indisponible pour cette source. », « Mesure indisponible pour cette source. », « Séries indisponibles pour cette source. » ;
- burndown : « Le burndown suit un sprint de tâches. », « Choisissez le sprint. » ;
- « Choisissez un autre champ que l’axe. » (série égale à l'axe) ;
- trésorerie, solde : « Le solde se suit dans le temps : choisissez la date comme axe. » ;
- plusieurs jeux ou comparaisons avec un donut ou un burndown : « Plusieurs jeux de données se comparent en barres, courbes ou aires. » ;
- jeux : « Jeu de données en double. », « « X » : mesure indisponible pour sa source. », « « X » : le solde ne se compare pas. », « « X » : séries indisponibles. », « « X » : choisissez sa date. », « « X » : l’axe n’existe pas pour sa source. » ;
- comparaisons : « « X » : jeu de données introuvable. », « « X » : comparez deux jeux différents. ».

Internes : `CHART_SOURCES`, `CHART_TYPES`, `CHART_TIME_DIMENSIONS`, `CHART_GROUP_DIMENSIONS`, `CHART_DIMENSIONS`, `CHART_MEASURES`, `treasuryChartFilterSchema`, `chartFilterFields`, `chartDatasetSchema`, `chartComparisonSchema`.

## `task-filter-translation.ts` — anciens filtres de tâches

| Export                  | Rôle                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `taskTableFilterSchema` | Filtre de tâches (graphiques…) exprimé avec les colonnes du tableau des tâches ; les anciens filtres sont traduits à la lecture puis validés par `tableFilterSchema`. |

Traduction (internes `translateCondition`, `translateTaskFilter`) : champs renommés `dependsOn` → `blockedBy`, `blocks` → `blocking`, `relatedTo` → `related`, `trackedHours` → `trackedTime` ; pour `project`, `parent`, `sprint` : `in` / `inTree` → `anyOf`, `notIn` → `noneOf` ; un opérateur de sprint relatif (`current`, `previous`, `next`, `past`, `future`) devient `anyOf` avec cette valeur. Une condition déjà dans la nouvelle forme reste inchangée.
