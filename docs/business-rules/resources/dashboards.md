# Règles des tableaux de bord

Règles appliquées aux tableaux de bord et à leurs diagrammes : validation de la configuration, portée, ordre, archivage, suppression, déplacement, export PDF, et règles de calcul des données (faites côté web). Sources : `apps/api/src/services/dashboards/dashboards.ts`, `apps/api/src/services/dashboards/charts-pdf.ts`, `apps/api/src/graphql/modules/dashboards.ts`, `packages/shared/src/dashboards/**`, calculs dans `apps/web/src/features/dashboards/lib/**`. Fonctionnalités : [Tableaux de bord](../../features/resources/dashboards.md).

## Modèle

- `Dashboard` : `label`, `projectId` (null : tableau général), `position`, `archivedAt`, `workspaceId`. Supprimé en cascade avec son projet ou son espace.
- `DashboardChart` : `dashboardId`, `label`, `config` (JSON validé par `chartConfigSchema`), `wide` (demi ou pleine largeur, faux par défaut), `position`. Supprimé en cascade avec son tableau.
- Chaque ligne appartient à l’espace actif ([Espaces et accès](../cross-cutting/workspaces-and-access.md)).

## Libellés

Source : `packages/shared/src/dashboards/dashboards.ts`, `packages/shared/src/core/rules.ts`.

| Élément                                   | Règle                                                       | Messages                                                |
| ----------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| Tableau (`dashboardLabelSchema`)          | Requis, rogné, 250 caractères max (`TEXT_MAX`, décision DO) | « Le libellé est requis. », « 250 caractères maximum. » |
| Diagramme (`chartLabelSchema`)            | Requis, rogné, 250 caractères max                           | « Le libellé est requis. », « 250 caractères maximum. » |
| Libellé du jeu principal (`config.label`) | Facultatif, 250 max                                         | « 250 caractères maximum. »                             |
| Jeu de données                            | Requis, 250 max                                             | « Nommez le jeu de données. »                           |
| Comparaison                               | Requis, 250 max                                             | « Nommez la comparaison. »                              |

Les libellés de tableaux ne sont pas uniques : deux tableaux peuvent porter le même nom (voir [Nommage](../cross-cutting/naming.md)).

## Tableaux

Source : `apps/api/src/services/dashboards/dashboards.ts`.

- **Portée** : la requête `dashboards(projectId)` renvoie les tableaux d’un projet, ou les tableaux généraux quand `projectId` est absent, triés par position.
- **Création** (`createDashboard`) : le projet, s’il est donné, doit exister (« Projet introuvable. ») et ne pas être archivé (« Élément archivé : restaurez-le pour le modifier. »). Le tableau va à la fin de la liste de sa portée (`nextPositionIn('dashboard', { projectId })`).
- **Renommer / déplacer** (`renameDashboard`, `moveDashboard`) : tableau existant (« Tableau de bord introuvable. ») et non archivé. Le déplacement réordonne parmi les tableaux de la même portée ([Ordre](../cross-cutting/ordering.md)).
- **Archivage** : par la mutation générique `setArchived` (kind `DASHBOARD`). Un tableau archivé est en lecture seule, ses diagrammes avec lui ([Archivage](../cross-cutting/archiving.md)).
- **Suppression** (`deleteDashboard`) : définitive, avec ses diagrammes (cascade). Elle n’est **pas** refusée pour un tableau archivé. Erreur « Tableau de bord introuvable. » s’il n’existe pas.

## Diagrammes

- **Création, modification, duplication, suppression, déplacement** : le diagramme doit exister (« Diagramme introuvable. ») et son tableau ne pas être archivé (« Élément archivé… »). La création exige un tableau non archivé.
- Le libellé et la configuration sont validés à chaque création et modification (`chartData` : `chartLabelSchema` + `chartConfigSchema`) ; la configuration est enregistrée **après** application des valeurs par défaut du schéma.
- **Position** : un nouveau diagramme va à la fin du tableau. Le déplacement réordonne dans le tableau.
- **Duplication** (`duplicateChart`) : copie du libellé suivi de « (copie) », coupé si besoin pour tenir dans 250 caractères (`copyName`), même configuration et même largeur, placée juste après l’original.
- **Transfert** (`transferChart`) vers un autre tableau :
  - un tableau donné (non archivé) ; ou bien le premier tableau non archivé d’un projet (ou des tableaux généraux sans projet), **créé sous le nom « Tableau de bord »** s’il n’y en a pas ; le projet cible doit exister et ne pas être archivé ;
  - si la cible est le tableau actuel, rien ne change ;
  - le diagramme va à la fin du tableau cible ; ses données suivent ensuite la portée du nouveau tableau.
- Une configuration enregistrée qui ne valide plus (après une évolution du schéma) est lue avec la configuration par défaut côté web (`parseConfig`).

## Configuration d’un diagramme (`chartConfigSchema`)

Source : `packages/shared/src/dashboards/dashboards.ts`.

### Champs et valeurs par défaut

| Champ             | Valeurs                                                                                                                             | Défaut      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `source`          | `tasks`, `documents`, `treasury`                                                                                                    | `tasks`     |
| `type`            | `bar`, `stackedBar`, `line`, `area`, `donut`, `burndown`                                                                            | requis      |
| `dimension` (axe) | une date ou un champ de la source                                                                                                   | requis      |
| `bucket`          | `day`, `week`, `month`, `quarter`, `year`                                                                                           | `week`      |
| `period`          | glissante (`past:28`, `past:91`, `past:182`, `past:365`, `past:730`, `next:91`, `next:182`, `next:365`, `all`) ou calendaire `month | quarter     | year:0                                 | -1  | AAAA-MM-JJ` | `past:91` |
| `measure`         | `count`, `effort`, `trackedTime`, `totalNet`, `totalGross`, `paid`, `balance`, `amount`, `income`, `expense`                        | `count`     |
| `series`          | un champ de la source, ou null                                                                                                      | null        |
| `cumulative`      | booléen                                                                                                                             | faux        |
| `sprintId`        | sprint du burndown                                                                                                                  | null        |
| `filter`          | filtre de tâches dans les termes de la table des tâches                                                                             | filtre vide |
| `search`          | texte, 250 max (`searchTextSchema`)                                                                                                 | vide        |
| `includeArchived` | tâches archivées incluses                                                                                                           | faux        |
| `documents`       | `types` (vide : tous), `clientIds`, `statusIds`, `includeDrafts` (faux), `includeImported` (vrai), `creditNotesNegative` (vrai)     |             |
| `treasury`        | `accountIds`, `categories` (chemins), `direction` `all                                                                              | in          | out` (`all`), `includeForecast` (faux) |     |
| `label`           | libellé du jeu principal                                                                                                            | vide        |
| `datasets`        | jeux supplémentaires, 8 max (« 8 jeux de données supplémentaires maximum. »)                                                        | []          |
| `comparisons`     | comparaisons, 8 max (« 8 comparaisons maximum. »)                                                                                   | []          |

### Ce que chaque source autorise

| Source      | Dates                                           | Champs                                                                                                         | Mesures                                              |
| ----------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `tasks`     | `createdAt`, `closedAt`, `startDate`, `endDate` | `sprint`, `milestone`, `project`, `status`, `statusCategory`, `priority`, `type`, `assignees`, `tags`, `state` | `count`, `effort`, `trackedTime`                     |
| `documents` | `issueDate`, `dueDate`, `sentAt`, `acceptedAt`  | `documentType`, `trackingStatus`, `client`, `project`, `payment`, `documentState`, `origin`                    | `totalNet`, `totalGross`, `paid`, `balance`, `count` |
| `treasury`  | `date`                                          | `category`, `member`, `context`, `account`, `direction`, `project`, `entryStatus`                              | `amount`, `income`, `expense`, `balance`, `count`    |

### Contrôles croisés (messages)

- Axe hors de la source : « Axe indisponible pour cette source. »
- Mesure hors de la source : « Mesure indisponible pour cette source. »
- Séries hors de la source : « Séries indisponibles pour cette source. » ; séries égales à l’axe : « Choisissez un autre champ que l’axe. »
- Burndown hors tâches : « Le burndown suit un sprint de tâches. » ; burndown sans sprint : « Choisissez le sprint. »
- Solde de trésorerie sur un axe qui n’est pas une date : « Le solde se suit dans le temps : choisissez la date comme axe. »
- Jeux ou comparaisons avec un anneau ou un burndown : « Plusieurs jeux de données se comparent en barres, courbes ou aires. »
- Pour chaque jeu supplémentaire :
  - identifiant en double (ou égal à `main`) : « Jeu de données en double. » ;
  - mesure hors de sa source : « « X » : mesure indisponible pour sa source. » ;
  - solde de trésorerie : « « X » : le solde ne se compare pas. » ;
  - séries hors de sa source ou égales à l’axe : « « X » : séries indisponibles. » ;
  - axe de dates : sa date (`dateField`, ou l’axe) doit exister dans sa source : « « X » : choisissez sa date. » ;
  - axe de champ : l’axe doit exister dans sa source : « « X » : l’axe n’existe pas pour sa source. »
- Pour chaque comparaison : A et B doivent être `main` ou un jeu existant (« « X » : jeu de données introuvable. ») et différents (« « X » : comparez deux jeux différents. »). Type de dessin par défaut : `line`.

### Configurations par défaut (`defaultChartConfig`)

- `tasks` : barres, `createdAt`, par semaine, `past:91`, `count`.
- `documents` : barres, `issueDate`, par mois, `year:0`, `totalNet`, types `INVOICE`, `DEPOSIT_INVOICE`, `CREDIT_NOTE`.
- `treasury` : barres, `date`, par mois, `year:0`, `amount`, séries `direction`.

### Anciens filtres de tâches (`taskTableFilterSchema`)

Source : `packages/shared/src/dashboards/task-filter-translation.ts`. Les filtres enregistrés avant l’unification avec la table des tâches sont traduits à la lecture : champs renommés (`dependsOn` → `blockedBy`, `blocks` → `blocking`, `relatedTo` → `related`, `trackedHours` → `trackedTime`) ; pour `project`, `parent`, `sprint`, les opérateurs `in`/`inTree` deviennent `anyOf` et `notIn` devient `noneOf` ; un sprint relatif (`current`, `previous`, `next`, `past`, `future`) devient `anyOf` de cette valeur. Un filtre déjà au bon format reste tel quel.

### Périodes calendaires (`calendarRange`)

`month:0` = mois courant, `month:-1` = mois précédent, `month:AAAA-MM-JJ` = le mois de ce jour (idem trimestre, année). Le résultat est `[premier jour, lendemain du dernier jour]`. Dans l’éditeur, un diagramme de facturation ou de trésorerie avec une période glissante est ramené à l’année courante.

## Règles de calcul (web)

Source : `apps/web/src/features/dashboards/lib/**`.

### Communes (`aggregate`)

- Axe de dates : seuls les éléments dont la date tombe dans la période (`[début, fin[`) comptent ; regroupés par jour, semaine (7 jours depuis le premier jour de semaine de l’espace), mois, trimestre ou année. Toutes les tranches de la période apparaissent, même vides.
- Un élément qui a plusieurs valeurs d’un champ (assignés, étiquettes, sprints) compte pour chacune.
- Valeur absente : une valeur « Sans … » (« Sans sprint », « Non assignées », « Sans catégorie »…) placée en dernier.
- Cumulé : total courant par série le long d’un axe de dates.
- Valeurs arrondies à 2 décimales ; les parts nulles d’un anneau sont retirées.

### Tâches (`task-records.ts`, `chart-data.ts`)

- Portée : toutes les tâches, ou celles du projet du tableau et de ses sous-projets (tâches sans projet exclues d’un tableau de projet), puis le filtre et la recherche du diagramme, comme dans les vues de tâches.
- `effort` : effort des feuilles (`leafEffort`) ; `trackedTime` : secondes suivies / 3600.
- Par sprint (axe ou séries `sprint`, hors burndown) : pour chaque sprint terminé (fin avant aujourd’hui), les tâches sont prises **avec le statut qu’elles avaient à la fin du sprint** (`sprintTaskStatuses`, côté API `apps/api/src/services/tasks/sprints.ts` : dernier changement de statut enregistré jusqu’au dernier jour du sprint, ou le premier si la tâche a été créée après ; tâches sans historique : statut actuel), puis filtrées ; une tâche compte dans chaque sprint où elle correspondait.
- Burndown : tâches du sprint correspondant au filtre ; pour chaque jour du sprint, reste = tâches (ou effort) non fermées à la fin de ce jour ; jours futurs vides ; « Idéal » : droite du total à zéro.

### Facturation (`finance-records.ts`)

- Documents d’Ordo et, si demandé, importés ; archivés exclus ; brouillons exclus sauf option ; filtres types, clients, statuts de suivi ; dans un tableau de projet, seuls les documents rattachés au projet ou à ses sous-projets.
- Avoirs : montants négatifs quand `creditNotesNegative` (le nombre reste positif).
- Paiement : brouillon ou devis « Sans objet » ; avoir avec reste « À rembourser », sinon « Soldé » ; facture sans reste « Payé », en retard « En retard », partiellement payée « Partiellement payé », sinon « À payer ». Un importé est en retard si son échéance est passée avec un reste dû.

### Trésorerie (`finance-records.ts`)

- Mouvements réels de la période ; avec `includeForecast`, les mouvements attendus de la projection (prévisions, factures à encaisser, avoirs à rembourser, documents importés à régler, factures récurrentes à venir), leur contexte étant celui planifié ce jour-là.
- Écriture ventilée : une part par ligne (sa date propre si elle en a une, sa catégorie, son projet, son membre ou sa relation, son contexte) et une part pour le reste non ventilé (contexte planifié du jour).
- Mouvements liés : entrées et sorties liées d’une même tranche (toute la période pour un anneau) se compensent, part par part (`offsetLinkedMovements`) ; un mouvement entièrement compensé disparaît. Pas de compensation pour la mesure « Nombre ».
- Filtre de catégorie : par chemin complet, une catégorie inclut ses sous-catégories ; les anciens filtres par nom restent compris.
- `income` = part positive, `expense` = part négative en positif, `amount` = montant signé.
- Solde : solde des comptes (projection) à la fin de chaque tranche, « Réel » jusqu’à aujourd’hui, « Prévu » ensuite ; il reste celui de **tous les comptes** même dans un tableau de projet.

### Plusieurs jeux (`datasets.ts`)

- Chaque jeu est une configuration complète sur l’axe du diagramme ; les lignes sont jointes par valeur d’axe, un manque vaut 0.
- Comparaisons calculées sur les totaux de chaque jeu par valeur d’axe : ratio = A / B × 100 (vide si B = 0), différence = A − B.

## Export PDF des diagrammes

Source : `apps/api/src/services/dashboards/charts-pdf.ts`, route `POST /api/exports/charts.pdf` (`apps/api/src/routes/exports.ts`, erreur « Export PDF impossible. »).

- Entrée : `title` (requis, 1 à 500), `subtitle` (500 max), `charts` de 1 à 40, chacun avec `title` (500 max), `description` (500 max) — 500 = `PRINTED_LABEL_MAX` (2 × `TEXT_MAX`) — et `image` PNG en data URL (12 Mo max, sinon « Image PNG attendue. »).
- PDF A4 paysage dans le gabarit commun des exports (logo, date, numéros de page) : un diagramme par page, la première page portant aussi le titre de l’export ; la description en petit sous l’en-tête ; l’image ajustée à la place restante.
- Le tableau de données en PDF passe par la route commune `table.pdf` ([Erreurs](../cross-cutting/errors.md) pour le format des messages).
