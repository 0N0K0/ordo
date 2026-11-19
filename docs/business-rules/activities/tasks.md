# Règles métier — Tâches

Règles appliquées par l’API aux tâches et à ce qui les organise : statuts, priorités, types et étiquettes, sous-tâches, jalons, sprints, blocages et relations, effort, dates et retard, vues enregistrées. Sources : `apps/api/src/services/tasks/**` (`tasks.ts`, `task-labels.ts`, `milestones.ts`, `sprints.ts`, `task-views.ts`), `apps/api/src/graphql/modules/tasks.ts`, `packages/shared/src/tasks/**`, `apps/api/prisma/schema.prisma` et les migrations (déclencheurs).

Voir aussi : [Temps passé](time.md), [Commentaires](../cross-cutting/comments.md), [Archivage](../cross-cutting/archiving.md), [Personnes](../cross-cutting/people.md), [Dates](../cross-cutting/dates.md), [Ordre manuel](../cross-cutting/ordering.md), [Libellés et limites](../cross-cutting/naming.md), [Erreurs](../cross-cutting/errors.md), [GitHub](../cross-cutting/github.md).

## Modèle d’une tâche

| Champ                                      | Règle                                                                                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`                                    | Requis, texte nettoyé (`trim`), 250 caractères au plus (`TEXT_MAX`, `taskLabelSchema`, décision DO). Message : « Le libellé est requis. », « 250 caractères maximum. ».                            |
| `number`                                   | Numéro lisible `#12`, **par projet**, donné par la base (voir [Numérotation](#numérotation)). Aucun sans projet. Les liens utilisent toujours l’`id`.                                              |
| `description`                              | Markdown, 65 536 caractères au plus (« Texte trop long. ») ; un texte vide ou blanc est enregistré `null` (`markdownSchema`).                                                                      |
| `projectId`                                | Facultatif : une tâche peut n’appartenir à aucun projet (pas de numéro, ni jalon, ni sprint, ni item GitHub). Le projet ne change pas par `updateTask` mais par transfert (`bulkTransferTasks`).   |
| `statusId`, `priorityId`, `typeId`         | Une valeur des listes de paramètres, facultative. Supprimer la valeur la retire des tâches (`onDelete: SetNull`).                                                                                  |
| `tagIds`                                   | Plusieurs étiquettes.                                                                                                                                                                              |
| `assigneeIds`                              | Contributeurs assignés (voir [Assignés](#assignés-et-bénéficiaires)).                                                                                                                              |
| `beneficiaryIds`, `beneficiaryRelationIds` | « Bénéficiaires » : contributeurs et relations pour qui est la tâche.                                                                                                                              |
| `effort`                                   | Nombre ≥ 0 et ≤ 1 000 000, ou vide (`effortSchema`). Messages : « Nombre attendu. », « L’effort ne peut pas être négatif. », « Valeur trop grande. ». Pas d’unité imposée.                         |
| `startDate`, `endDate`                     | Jours (YYYY-MM-DD) ; la fin ne précède pas le début.                                                                                                                                               |
| `minDate`                                  | « Date min » : la tâche n’est pas à faire avant.                                                                                                                                                   |
| `deadline`                                 | « Date max » : au-delà, une tâche ouverte est en retard.                                                                                                                                           |
| `slotCondition`                            | Condition de plages, la même que celle des routines (décision D9) : groupes ET / OU sur des plages nommées, des types de plages (de cet espace ou d’un autre espace de l’utilisateur) et le temps libre ; `null` = n’importe quand (décision D10). Validée par `slotConditionSchema` (voir [Agenda](calendar.md)). |
| `parentId`                                 | Tâche parente (sous-tâches).                                                                                                                                                                       |
| `milestoneId`                              | Un jalon.                                                                                                                                                                                          |
| `sprintIds`                                | Plusieurs sprints (une tâche peut s’étaler sur plusieurs).                                                                                                                                         |
| `position`                                 | Ordre manuel global (voir [Ordre manuel](#ordre-manuel-et-déplacement)).                                                                                                                           |
| `closedAt`                                 | Tâche fermée (faite), **indépendamment du statut**.                                                                                                                                                |
| `archivedAt`, `archivedByCascade`          | Archivage, avec la trace d’un archivage en cascade.                                                                                                                                                |
| `github*`                                  | Synchronisation avec un item de tableau GitHub (voir [GitHub](../cross-cutting/github.md)).                                                                                                        |

Champs calculés exposés par GraphQL (`apps/api/src/graphql/modules/tasks.ts`) :

- `closed` : `closedAt !== null`.
- `githubLinked` : la tâche a un `githubItemId`.
- `blockingIds` (tâches qu’elle bloque), `blockedByIds` (tâches qui la bloquent), `relatedIds` (relations dans les deux sens).
- `commentCount` : nombre de commentaires de la tâche.
- `trackedSeconds` : temps passé, en secondes (voir [Temps passé d’une tâche](time.md#temps-passé-dune-tâche)).
- `slotCondition` lue par `readSlotCondition` (une valeur illisible devient `null`) ; un groupe vide est enregistré comme `null`.
- Plages et types de la condition : existants (« Plage », « Type de plage », « Espace » introuvable) ; une plage ou un type archivé n’est plus accepté, sauf s’il était déjà dans la condition de la tâche (`assertConditionSchedules`, voir [Agenda](calendar.md#condition-de-plages-des-tâches-et-routines)).
- Les tâches dont la règle de plages datait d’avant la condition l’ont gardée telle quelle en conditions sur les types (migration `20261119190000_task_slot_condition`, décision DX).

## Création

Source : `createTask` (`services/tasks/tasks.ts`).

- Libellé vide refusé sous le champ : « Le libellé est requis. ».
- Le projet, s’il est donné, doit exister et ne pas être archivé (« Projet introuvable. » / « Élément archivé : restaurez-le pour le modifier. » sous `projectId`).
- Statut, priorité, type, étiquettes et assignés doivent exister (« Statut introuvable. », « Priorité introuvable. », « Type introuvable. », « Étiquette introuvable. », « Assigné introuvable. »). Les bénéficiaires sont vérifiés par `assertBeneficiaries` (voir [Personnes](../cross-cutting/people.md)).
- Aucune valeur archivée ne peut être donnée à une nouvelle tâche (statut, priorité, type, jalon, sprints, assignés, bénéficiaires, étiquettes) : erreur « Élément archivé : restaurez-le pour le modifier. » sous le champ concerné.
- Parent, jalon et sprints sont vérifiés comme décrit plus bas (même arborescence de projets).
- Assignés : seuls les contributeurs du projet (voir plus bas).
- La tâche est placée **à la fin** de l’ordre manuel (`nextPositionIn('task')`).
- Aucun statut n’est imposé par l’API ; l’interface propose le premier statut « À faire » non archivé (voir [Fonctionnalités](../../features/activities/tasks.md)).

## Modification

Source : `updateTask`.

- Une tâche archivée n’est pas modifiable (« Élément archivé : restaurez-le pour le modifier. ») : la restaurer d’abord.
- Champ omis = inchangé, `null` = vidé.
- Les valeurs archivées que la tâche a **déjà** restent valides ; seules les valeurs archivées **nouvellement** données sont refusées.
- La plage de dates reste valide en tenant compte des dates actuelles (`assertDateRange`) : « La fin doit suivre le début. » sous `endDate`.
- Le schéma partagé du formulaire (`taskFormSchema`) refuse aussi une « Date max » avant la « Date min » (même message, sous `deadline`). Côté API, seule la paire début / fin est vérifiée par `assertDateRange` ; la paire « Date min » / « Date max » n’est vérifiée que par le formulaire.

## Numérotation

Source : migrations `20261107200000_task_numbers_per_project` et `20261114120000_tasks_without_project` (déclencheur `task_project_number`).

- Chaque projet et sous-projet a ses propres numéros 1, 2, 3… (`@@unique([projectId, number])`).
- Le numéro est donné **par la base**, à la création et à chaque changement de projet : le plus grand numéro du projet + 1, sous un verrou par projet (`pg_advisory_xact_lock`).
- Sans projet : pas de numéro (`number = null`). Rattachée ensuite à un projet, la tâche prend le numéro suivant de ce projet.
- Un transfert donne donc un nouveau numéro ; les « #12 » écrits dans les textes sont des liens par `id` (migration de renumérotation), ils suivent la tâche.

## Statuts, priorités, types et étiquettes

Source : `services/tasks/task-labels.ts` (via `createLabelService`, `services/core/labels.ts`), `packages/shared/src/tasks/task-columns.ts`.

- Chaque liste est une liste de paramètres : libellé requis (250 caractères au plus, `labelTextSchema`), couleur `#rrggbb` requise (« Couleur invalide (format #rrggbb). »), position manuelle, image facultative.
- Libellé unique dans sa liste ; conflit (`CONFLICT`) :
  - « Un statut porte déjà ce libellé. »
  - « Une priorité porte déjà ce libellé. »
  - « Un type porte déjà ce libellé. »
  - « Une étiquette porte déjà ce libellé. »
- Création à la fin de la liste. Modification refusée si l’élément est archivé. Suppression : les tâches qui l’utilisent le perdent (statut, priorité, type remis à vide ; étiquette retirée).
- Archivage par la mutation générique (`setArchived`, voir [Archivage](../cross-cutting/archiving.md)) : une valeur archivée reste sur les tâches qui l’ont mais n’est plus proposée ni acceptée pour d’autres.

### Catégories de statut

Un statut a une catégorie fixe (`TASK_STATUS_CATEGORIES`), `TODO` par défaut à la création :

| Catégorie     | Libellé (statut) | Libellé (tâches) | Sens   |
| ------------- | ---------------- | ---------------- | ------ |
| `TODO`        | « À faire »      | « À faire »      | ouvert |
| `IN_PROGRESS` | « En cours »     | « En cours »     | ouvert |
| `DONE`        | « Terminé »      | « Terminée »     | fermé  |
| `CANCELLED`   | « Annulé »       | « Annulée »      | fermé  |

- La catégorie donne le sens du statut quel que soit son libellé (filtres, tâches « en cours » de l’accueil, filtre « Catégorie de statut »).
- **C’est l’état ouvert / fermé (`closedAt`) qui dit si une tâche est faite**, pas le statut : changer de statut ne ferme ni ne rouvre la tâche, et inversement.

## Fermer et rouvrir

Source : `setTasksClosed`.

- Au moins une tâche (« Aucune tâche sélectionnée. »), toutes existantes, aucune archivée.
- Fermer pose `closedAt` à maintenant ; une tâche déjà fermée **garde sa date de fermeture**. Rouvrir vide `closedAt`.
- Une tâche fermée ne bloque plus les tâches qu’elle bloque, n’est jamais en retard et compte comme faite (avancement des jalons, sprints, sous-tâches).

## Historique des statuts

Source : migration `20261107120000_workspaces` (fonction de déclencheur), modèle `TaskStatusChange`, `sprintTaskStatuses` (`services/tasks/sprints.ts`).

- Un déclencheur de base enregistre une ligne `TaskStatusChange` (statut, fermée ou non, moment) à la création d’une tâche et à chaque changement de statut ou d’état ouvert / fermé ; au premier changement d’une tâche sans historique, son état initial est d’abord enregistré à sa date de création.
- Le statut enregistré reste même si le statut est supprimé ensuite.
- Sert à connaître le statut d’une tâche à la fin d’un sprint passé (voir [Sprints](#sprints)).

## Sous-tâches

Source : `assertParent`, `moveTask`, `setTaskArchived`, `bulkDeleteTasks`.

- Le parent doit exister (« Tâche parente introuvable. ») et ne pas être archivé.
- Le parent appartient à la **même arborescence de projets** (même projet racine) : « La tâche parente doit appartenir au même projet ou à l’un de ses sous-projets. ». Une tâche sans projet n’a qu’un parent sans projet : « La tâche parente doit aussi être sans projet. ». Une sous-tâche peut donc être dans un autre projet de la même arborescence.
- Pas de boucle : « Une tâche ne peut pas être placée sous l’une de ses sous-tâches. » (ni sous elle-même).
- Supprimer un parent : `onDelete: SetNull` côté base, mais l’API choisit (voir [Suppression](#suppression)).

## Ordre manuel et déplacement

Source : `moveTask`, `moveBefore` (`services/core/ordering.ts`, partagé avec les routines).

- Un seul ordre manuel global pour toutes les tâches (`position`) ; placer « avant telle tâche » fonctionne aussi dans une vue filtrée.
- `beforeId` : la tâche à précéder ; `null` : à la fin. Tâche voisine inconnue : « Tâche introuvable. ».
- `parentId` donné : change aussi de parent (vérifié comme ci-dessus) ; `null` : tâche de premier niveau ; omis : parent inchangé.
- Une tâche archivée ne se déplace pas.
- Seules les lignes dont la position change sont écrites.

## Blocages et relations

Source : `addTaskBlock`, `removeTaskBlock`, `addTaskRelation`, `removeTaskRelation`, `assertSameTree`.

- Lien « bloque » (`TaskBlock`, orienté : `blockerId` bloque `blockedId`) et lien « relative à » (`TaskRelation`, symétrique, stocké une seule fois avec `taskAId < taskBId`).
- Les deux tâches : différentes (« Une tâche ne peut pas être liée à elle-même. »), existantes, non archivées, de la même arborescence de projets (ou toutes deux sans projet) : « Les deux tâches doivent appartenir au même projet ou à ses sous-projets (ou être toutes deux sans projet). ».
- Pas de blocage circulaire (chemin de blocages entre les deux, dans l’autre sens) : « Ce lien créerait un blocage circulaire. ».
- Ajouter un lien existant ne fait rien (`upsert`). Retirer un lien est refusé si l’une des tâches est archivée.
- Une tâche **bloquée** (calcul de l’interface, `isBlocked`) est une tâche ouverte qui dépend d’au moins une tâche ouverte et non archivée.

## Jalons

Source : `services/tasks/milestones.ts`, `assertMilestone`.

- Un jalon appartient à un projet (actif à la création : « Projet introuvable. » / archivé refusé).
- Libellé requis, 250 caractères au plus (`milestoneLabelSchema`) ; description markdown facultative ; échéance (`dueDate`) facultative.
- Créé à la fin de la liste du projet ; réordonné par `moveMilestone` (index dans son projet).
- Modifier ou déplacer est refusé si le jalon ou son projet est archivé.
- Une tâche ne prend qu’un jalon de **son arborescence de projets** : « Le jalon doit appartenir au projet de la tâche ou à son arborescence. ». Sans projet : « Une tâche sans projet n’a pas de jalon. ».
- Supprimer un jalon : ses tâches le perdent simplement (aucune n’est supprimée).
- La requête `milestones` les renvoie par échéance (sans échéance en dernier), puis position.
- Archivage par la mutation générique (`MILESTONE`).

## Sprints

Source : `services/tasks/sprints.ts`, `assertSprints`, `sprintSchema` (`packages/shared/src/tasks/tasks.ts`).

- Un sprint appartient à un projet actif ; libellé requis (250 caractères au plus, `sprintLabelSchema`), début et fin requis (« La date de début est requise. », « La date de fin est requise. »), la fin ne précède pas le début (« La fin doit suivre le début. »), objectif markdown facultatif.
- Modification refusée si le sprint ou son projet est archivé.
- Une tâche ne prend que des sprints de son arborescence : « Les sprints doivent appartenir au projet de la tâche ou à son arborescence. » ; sans projet : « Une tâche sans projet n’est dans aucun sprint. ». Sprint inconnu : « Sprint introuvable. ».
- Supprimer un sprint : ses tâches le quittent simplement.
- La requête `sprints` les renvoie par date de début puis date de création.
- Un sprint peut refléter une itération d’un tableau GitHub (`githubIterationId`, voir [GitHub](../cross-cutting/github.md)).
- Archivage par la mutation générique (`SPRINT`).

### Statut des tâches en fin de sprint

`sprintTaskStatuses(today)` : pour chaque sprint terminé avant `today`, et chaque tâche qu’il contient, le dernier statut enregistré jusqu’à la fin de son dernier jour (le premier enregistré si la tâche a été créée après). Les tâches sans historique sont omises (leur statut actuel vaut). Utilisé par les tableaux de bord (voir [Tableaux de bord](../resources/dashboards.md)).

## Assignés et bénéficiaires

Source : `assertProjectContributors` (`services/projects/contributors.ts`), `assertBeneficiaries` (`services/core/beneficiaries.ts`).

- Pour une tâche d’un projet, seuls peuvent être **ajoutés** comme assignés : l’utilisateur de l’app (« Moi », contributeur lié à un utilisateur) et les contributeurs rattachés au projet ou à l’un de ses projets parents. Sinon : « Seuls les contributeurs du projet peuvent être choisis. » sous `assigneeIds`.
- Les assignés déjà présents restent valides même s’ils ne sont plus rattachés.
- Une tâche sans projet accepte tous les contributeurs.
- Un contributeur archivé n’est pas accepté comme nouvel assigné.
- Bénéficiaires : n’importe quel contributeur ou relation (règle détaillée dans [Personnes](../cross-cutting/people.md)).

## Effort

- Valeur libre ≥ 0 (voir le tableau du modèle).
- Dans les sommes (sprints, tableaux de bord), seul l’effort des tâches **sans sous-tâches** compte : l’effort d’un parent est celui de ses sous-tâches (`leafEffort`, web). L’API ne calcule pas de somme.

## Dates et retard

- Début / fin : plage valide (« La fin doit suivre le début. »).
- « Date min » / « Date max » : plage valide dans le formulaire partagé.
- **En retard** (décision DD, `isTaskOverdue` côté web) : « Date max » passée (strictement avant aujourd’hui) et tâche non fermée. La même règle partout (tableau, panneau, accueil, agenda).
- Un jalon est « en retard » quand son échéance est passée et qu’il reste des tâches non fermées ; un sprint quand sa fin est passée avec des tâches non fermées (calculs web, voir [Fonctionnalités](../../features/activities/tasks.md)).

## Tâches faisables maintenant

Source : requête `doableTaskIds(utcOffset)` (`services/calendar/slot-conditions.ts`).

Tâches ouvertes de l’espace dont la condition de plages (aucune : n’importe quand, dans les deux types d’espace) autorise le moment présent de l’utilisateur, et dont aucun évènement n’occupe les assignés (aucun : « Moi »), sauf un évènement lié à la tâche. Détail dans [Agenda](calendar.md).

## Pas de récurrence

Une tâche ne se répète pas : ce qui revient est une [routine](routines.md). La notion de tâche récurrente a été supprimée le 19 novembre 2026 : les occurrences déjà créées restent, comme tâches ordinaires ; les répétitions enregistrées ne sont plus lues (colonnes `recurrence`, `seriesId` et `occurrenceDate` retirées de `Task`) ; aucune conversion en routine.

## Archivage

Source : `setTaskArchived`, `bulkSetTasksArchived`, `archiveTree` et `cascadeArchive` (`services/core/archive.ts`), `topmostIds` (`services/core/trees.ts`).

- Archiver une tâche archive aussi ses sous-tâches actives (marquées `archivedByCascade`).
- Restaurer une tâche restaure les sous-tâches archivées avec elle, et ses ancêtres archivés (seuls : leurs autres sous-tâches archivées avec eux restent archivées, désormais pour leur propre compte).
- Une tâche archivée est en lecture seule : ni modification, ni déplacement, ni lien, ni commentaire, ni fermeture, ni transfert.
- En masse, seules les tâches du haut de la sélection sont traitées (une sous-tâche sélectionnée suit son ancêtre sélectionné).
- La requête `tasks` renvoie toutes les tâches, archivées comprises.

## Suppression

Source : `bulkDeleteTasks`, `deleteTreeItems` (`services/core/trees.ts`, partagé avec les routines).

- Suppression définitive, avec les commentaires de la tâche (`onDelete: Cascade`).
- Les sous-tâches sont, au choix (`deleteSubtasks`) : supprimées avec elle (tout le sous-arbre), ou remontées d’un niveau sous le parent de la tâche supprimée.
- En masse : les sous-tâches sélectionnées remontées par la suppression de leur parent sont supprimées aussi.
- Avant suppression : les items GitHub liés sont retirés du tableau GitHub (en tâche de fond, sans bloquer).
- Les temps passés restent (le lien entre le temps et la tâche disparaît) ; voir [Temps passé](time.md).

## Transfert vers un autre projet

Source : `bulkTransferTasks`, `moveTaskTrees` (interne, partagé avec la suppression d'un projet).

- Pas de tâche archivée (refusé avant tout déplacement en masse) ; projet cible actif ou `null` (hors de tout projet).
- La tâche part **avec toutes ses sous-tâches** ; elles prennent les numéros suivants du projet cible (base de données) ou perdent leur numéro.
- Si le projet cible est dans une autre arborescence, sont retirés :
  - les blocages et relations avec les tâches restées dans l’ancienne arborescence ;
  - la tâche parente si elle reste dehors ;
  - le jalon et les sprints d’une autre arborescence.
- Hors de tout projet : les items GitHub sont retirés (le lien passe par le projet).
- Les assignés suivent : ils sont rattachés au projet cible (`attachAssignees`).
- Le résultat compte les liens retirés (`removedLinks`). En masse, seules les tâches du haut de la sélection sont transférées, toutes ensemble : les liens entre tâches transférées restent.

## Projet supprimé

Source : `releaseProjectTasks` (par `releaseProjects`), appelé par `deleteProject` et `deleteClient(deleteProjects: true)` (décision DP).

- Les tâches d'un projet supprimé (et de ses sous-projets) **ne sont pas supprimées** : elles sortent du projet comme lors d'un transfert hors de tout projet (`moveTaskTrees`), archivées comprises. Elles perdent leur numéro, leur jalon, leurs sprints et leur lien GitHub (items retirés du tableau) ; leurs blocages et relations avec les tâches restées dans un projet sont retirés, ainsi que leur parent s'il reste dans un projet.
- Seules les tâches des projets supprimés sortent (pas leurs sous-tâches, contrairement à un transfert) : une sous-tâche rangée dans un projet de la même arborescence qui n'est pas supprimé y reste, avec son numéro, son jalon et ses sprints ; elle perd seulement son parent, sorti de tout projet (une tâche d'un projet n'a qu'un parent de la même arborescence).
- En base, `Task.projectId` est `onDelete: SetNull` (filet : le numéro est alors vidé par le déclencheur).
- Ses alarmes restent, sans projet, avec leur tâche (`Alarm.projectId` en `onDelete: SetNull`) ; les temps d'une routine restent, sans projet (`releaseRoutineTime`), avec leurs tâches, leur routine et leur évènement.
- Ce qui reste supprimé avec le projet : ses temps passés sans routine (`TimeEntry`, ceux des tâches compris : un temps sans routine doit avoir un projet), ses jalons et sprints.

## Clonage

Source : `cloneTask`.

- Copie tous les champs (libellé, description, projet, statut, priorité, type, effort, dates, « Date min »/« Date max », parent, jalon, sprints), les assignés, bénéficiaires, étiquettes et les liens de blocage et de relation de sa propre arborescence de projets (un ancien lien hors d’elle, gardé tant que la tâche ne change pas d’arborescence, n’est pas copié). **Pas** les commentaires, ni l’état fermé, ni la condition de plages, ni le lien GitHub.
- Le clone est placé sous le même parent, à la fin de l’ordre manuel ; il reçoit un nouveau numéro (base).
- Avec `includeSubtasks`, le sous-arbre est copié niveau par niveau sous le clone (les sous-tâches copiées gardent assignés, bénéficiaires, étiquettes et sprints, pas leurs liens de blocage ou de relation).
- La tâche source peut être archivée (aucune vérification d’archivage) ; l’interface ne propose le clonage que sur les tâches non archivées.

## Modification en masse

Source : `bulkUpdateTasks`.

- Champs : statut, priorité, type, jalon, effort, dates (début, fin, « Date min », « Date max »), ajout / retrait d’assignés, d’étiquettes, de sprints. Omis = inchangé, `null` = vidé.
- Au moins une tâche, toutes existantes, aucune archivée (sauf annulation).
- Valeurs archivées : refusées si nouvelles ; celles que l’une des tâches a déjà restent valides pour toutes.
- Pour chaque tâche : assignés ajoutés parmi les contributeurs de son projet, jalon et sprints de son arborescence, plage de dates valide.
- `restoring: true` (annulation d’une action) : accepte les valeurs archivées redonnées et les tâches archivées depuis ; seules ces vérifications sont sautées.

## Vues enregistrées

Source : `services/tasks/task-views.ts`, `tableViewConfigSchema` (voir [Tableaux](../../shared/cross-cutting/tables.md)).

- Une vue appartient à une portée : `projectId` (onglet d’un projet, ou `null` pour la page), `kind` et `tableKey`. Seules les vues de type `TABLE` se créent et se modifient désormais : « Ce type de vue n’existe plus : les vues sont celles des tableaux. ». Les anciens types (tâches, routines, listes d’achats) sont conservés tels quels.
- Libellé requis, 250 caractères au plus (`viewLabelSchema`) ; `tableKey` : minuscules, chiffres et « - », 64 au plus (« Tableau invalide. »).
- La configuration (filtres, tris, groupes, colonnes, options) est validée et complétée par les valeurs par défaut.
- Le projet doit être actif.
- La première vue d’une portée devient sa vue par défaut ; supprimer la vue par défaut donne ce rôle à la première vue restante.
- Dupliquer place la copie juste après l’originale. Réordonner par index dans la portée.
- La requête `taskViews` lit par défaut le type `TASKS` (ancien) ; le web utilise des vues `TABLE` avec `tableKey: 'tasks'`.

### Colonnes des nouvelles vues

Source : `taskColumnDefaults`, `setTaskColumnDefaults` (`services/workspaces/workspaces.ts`), `taskColumnDefaultsSchema`.

- Par espace : ordre des colonnes et colonnes masquées des nouvelles vues de tâches (200 colonnes au plus, identifiants de 64 caractères au plus, `TABLE_KEY_MAX`). La colonne `label` n’est jamais masquée.
- `null` ou sans colonnes : celles de l’app (colonnes masquées par défaut : `blocking`, `related`, `milestone`, `createdAt`, `updatedAt`).
- L’ancien identifiant de la colonne du libellé est relu comme `label` (décision BI).

## Contributeurs

Les contributeurs (`Contributor`) sont gérés dans le module tâches mais leurs règles sont dans [Personnes](../cross-cutting/people.md) : nom requis (250 caractères), identifiant de mention (`handleSchema` : 2 à 39 caractères, minuscules, chiffres, `-` et `_`, ni au début ni à la fin pour `-` et `_`), rattachement aux projets (hérité par les sous-projets), « Moi » rattaché à tous les projets.

## Pièces jointes

`uploadAttachment` (déclaré dans le module tâches) stocke un fichier de 10 Mo au plus, à lier depuis un texte markdown : voir [Fichiers et pièces jointes](../cross-cutting/files-and-attachments.md).

## Espace PRO / PERSO

Les règles sont les mêmes dans les deux types d’espace, condition de plages comprise (sans condition : n’importe quand, décision D10 ; voir [Agenda](calendar.md)). Toutes les données sont limitées à l’espace courant (`workspaceId`).
