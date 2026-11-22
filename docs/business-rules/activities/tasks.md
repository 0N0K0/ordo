# Règles métier — Tâches

Règles appliquées par l’API aux tâches et à ce qui les organise : statuts, priorités, types et étiquettes, sous-tâches, jalons, sprints, blocages et relations, effort, dates et retard, vues enregistrées. Sources : `apps/api/src/services/tasks/**` (`tasks.ts`, `task-labels.ts`, `milestones.ts`, `sprints.ts`, `task-views.ts`), `apps/api/src/graphql/modules/tasks.ts`, `packages/shared/src/tasks/**`, `apps/api/prisma/schema.prisma` et les migrations (déclencheurs).

Voir aussi : [Temps passé](time.md), [Commentaires](../cross-cutting/comments.md), [Archivage](../cross-cutting/archiving.md), [Personnes](../cross-cutting/people.md), [Dates](../cross-cutting/dates.md), [Ordre manuel](../cross-cutting/ordering.md), [Libellés et limites](../cross-cutting/naming.md), [Erreurs](../cross-cutting/errors.md), [GitHub](../cross-cutting/github.md).

## Modèle d’une tâche

| Champ                                      | Règle                                                                                                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`                                    | Requis, texte nettoyé (`trim`), 250 caractères au plus (`TEXT_MAX`, `taskLabelSchema`). Message : « Le libellé est requis. », « 250 caractères maximum. ». Pas unique : deux tâches peuvent porter le même libellé.                            |
| `number`                                   | Numéro lisible `#12`, **par projet**, donné par la base (voir [Numérotation](#numérotation)). Aucun sans projet. Les liens utilisent toujours l’`id`.                                              |
| `description`                              | Markdown, 65 536 caractères au plus (« Texte trop long. ») ; un texte vide ou blanc est enregistré `null` (`markdownSchema`).                                                                      |
| `projectId`                                | Facultatif : une tâche peut n’appartenir à aucun projet (pas de numéro, ni jalon, ni sprint, ni item GitHub). Le projet ne change pas par `updateTask` mais par transfert (`bulkTransferTasks`).   |
| `statusId`, `priorityId`, `typeId`         | Une valeur des listes de paramètres, facultative. Supprimer la valeur la retire des tâches (`onDelete: SetNull`).                                                                                  |
| `tagIds`                                   | Plusieurs étiquettes.                                                                                                                                                                              |
| `assigneeIds`                              | Contributeurs assignés (voir [Assignés](#assignés-et-bénéficiaires)).                                                                                                                              |
| `beneficiaryIds`, `beneficiaryRelationIds` | « Bénéficiaires » : contributeurs et relations pour qui est la tâche.                                                                                                                              |
| `effort`                                   | Nombre ≥ 0 et ≤ 1 000 000, ou vide (`effortSchema`). Messages : « Nombre attendu. », « L’effort ne peut pas être négatif. », « Valeur trop grande. ». Pas d’unité imposée.                         |
| `startDate`, `endDate`                     | Jours (YYYY-MM-DD) ; la fin ne précède pas le début.                                                                                                                                               |
| `minDate`                                  | « Ouverture » : la tâche n’est pas à faire avant. Sans elle, celle de son parent, sinon celle de son jalon, de son projet ou de son premier sprint (voir [Dates suivies](#dates-suivies)).            |
| `deadline`                                 | « Échéance » : au-delà, une tâche ouverte est en retard. Sans elle, celle de son parent, sinon celle de son jalon ou de son premier sprint.                                                         |
| `slotCondition`                            | Condition de créneaux, la même que celle des routines : groupes ET / OU sur des créneaux nommés, des types de créneaux (de cet espace ou d’un autre espace de l’utilisateur), éphémérides et types d’éphémérides compris, et le temps libre (qui ignore les éphémérides) ; `null` = n’importe quand. Validée par `slotConditionSchema` (voir [Agenda](calendar.md)). |
| `location`, `locationLat`, `locationLon`   | Lieu, le champ des évènements et des routines : texte libre facultatif, 250 caractères au plus (`optionalText`, vide → `null`), et son point quand il est choisi sur la carte ou dans une recherche (voir [Lieux](../cross-cutting/geo.md#durées-saisies-sur-un-élément)). Ni trajet, ni heure de départ ou de retour : une tâche n’a pas d’heures. Un point va avec un lieu, ses deux coordonnées ou aucune (`storedLocation`). |
| `links`                                    | Liens, ceux des évènements : 20 au plus (« 20 liens maximum. »), adresse http ou https (« Lien invalide (http ou https). »), libellé facultatif de 250 caractères (`itemLinksSchema`). Aucun par défaut. |
| `reminders`                                | Rappels : seulement à une heure (heure de Paris ; « Une tâche n’a que des rappels à une heure précise. ») : « À HH:MM » (`{ at }`) et « N jours avant, à HH:MM » (`{ at, days }`, 1 à 30 jours), 10 au plus (« 10 rappels maximum. », « Heure attendue (HH:MM). », `taskRemindersSchema`), dédoublonnés et triés (`normalizedReminders`) ; « À HH:MM » sonnés chaque jour de l’ouverture à l’échéance (celles qu’elle suit : voir [Dates suivies](#dates-suivies)), le jour de l’échéance seulement sans ouverture ; « N jours avant » une fois, N jours avant l’échéance ; jamais sans échéance, sans limite de 24 heures. Aucun par défaut. Voir [Alarmes](alarms.md#rappels-des-tâches-routines-et-évènements). |
| `deadTimes`                                | Temps morts : `[{ label, minutes, ringtone? }]`, 20 au plus ; « Lancer » l’un d’eux lance un minuteur rattaché à la tâche ; ce n’est pas du temps passé. Aucun par défaut. Voir [Alarmes](alarms.md#temps-morts). |
| `parentId`                                 | Tâche parente (sous-tâches).                                                                                                                                                                       |
| `inheritedFields`                          | Champs que la sous-tâche prend de son parent, en direct (voir [Héritage](#héritage)) ; vide pour une tâche du premier niveau.                                                          |
| `milestoneId`                              | Un jalon.                                                                                                                                                                                          |
| `sprintIds`                                | Plusieurs sprints (une tâche peut s’étaler sur plusieurs).                                                                                                                                         |
| `position`                                 | Ordre manuel global (voir [Ordre manuel](#ordre-manuel-et-déplacement)).                                                                                                                           |
| `closedAt`                                 | Tâche fermée (faite). Seul un statut de catégorie « Annulé » y touche : il la ferme, le quitter la rouvre (voir [Catégories de statut](#catégories-de-statut)).                       |
| `archivedAt`, `archivedByCascade`          | Archivage, avec la trace d’un archivage en cascade.                                                                                                                                                |
| `github*`                                  | Synchronisation avec un item de tableau GitHub (voir [GitHub](../cross-cutting/github.md)).                                                                                                        |

Champs calculés exposés par GraphQL (`apps/api/src/graphql/modules/tasks.ts`) :

- `closed` : `closedAt !== null`.
- `cancelled` : son statut est de catégorie « Annulé » (la tâche est alors fermée et s’affiche barrée).
- `effectiveMinDate`, `effectiveDeadline` : « Ouverture » et « Échéance » que la tâche suit ; `minDateSource`, `deadlineSource` : d’où elles viennent quand ce ne sont pas les siennes (`PARENT`, `MILESTONE`, `PROJECT`, `SPRINT`), voir [Dates suivies](#dates-suivies).
- `inheritedFields`, `effective` (valeurs suivies : projet, priorité, jalon, assignés, bénéficiaires, condition, lieu, dates) et `inheritance` (état et source de chaque champ hérité), voir [Héritage](#héritage).
- `githubLinked` : la tâche a un `githubItemId`.
- `blockingIds` (tâches qu’elle bloque), `blockedByIds` (tâches qui la bloquent), `relatedIds` (relations dans les deux sens).
- `commentCount` : nombre de commentaires de la tâche.
- `trackedSeconds` : temps passé, en secondes (voir [Temps passé d’une tâche](time.md#temps-passé-dune-tâche-dune-routine-dun-évènement)).
- `slotCondition` lue par `readSlotCondition` (une valeur illisible devient `null`) ; un groupe vide est enregistré comme `null`.
- Créneaux, types et anniversaires de la condition (anniversaire d’une personne ou tous) : existants (« Créneau », « Type de créneau », « Espace », « Contributeur », « Relation » introuvable) ; un créneau, un type ou une personne archivé n’est pas accepté, sauf s’il est déjà dans la condition de la tâche (`assertConditionSchedules`, voir [Agenda](calendar.md#condition-de-créneaux-des-tâches-et-routines)) ; gardé, il ne donne aucun moment : la tâche n’est pas faisable par lui.
- Un type sans aucun créneau ne permet aucun moment : une tâche limitée à ce type (« sur l’un des types ») n’est jamais faisable tant qu’aucun créneau de ce type n’existe (comportement voulu).

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
- Un lieu donné remplace aussi son point (`null` : aucun) ; `links: null` retire tous les liens ; `reminders: null` retire tous les rappels ; `deadTimes: null` retire tous les temps morts.
- Les valeurs archivées que la tâche a **déjà** restent valides ; seules les valeurs archivées **nouvellement** données sont refusées.
- La période de dates reste valide en tenant compte des dates actuelles (`assertDateRange`) : « La fin doit suivre le début. » sous `endDate`.
- L’« Échéance » ne précède pas l’« Ouverture » : « La fin doit suivre le début. » sous `deadline`, refusé par le formulaire (`taskFormSchema`) et par l’API (`assertDateRange` sur les valeurs propres, voir [Dates et retard](#dates-et-retard)).

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
- **C’est l’état ouvert / fermé (`closedAt`) qui dit si une tâche est faite.** Une seule catégorie y touche (`statusClosing`, `closeOnStatus`) :
  - passer à un statut « Annulé » (création, modification, modification en masse, annulation d’une modification en masse, copie) **ferme** la tâche (une tâche déjà fermée garde sa date de fermeture) ; elle s’affiche alors barrée ;
  - quitter un statut « Annulé » pour un autre statut, ou pour aucun, **rouvre** la tâche ;
  - les autres changements de statut, « Terminé » compris, ne ferment ni ne rouvrent rien ;
  - rouvrir à la main une tâche « Annulé » lui donne le premier statut « À faire » non archivé (aucun s'il n'y en a pas) ; « Annuler » de son toast lui rend aussi son statut « Annulé », qui la referme ; fermer à la main ne change pas le statut ;
  - changer la catégorie d'un statut dans les paramètres applique la règle à ses tâches, archivées comprises : vers « Annulé », ses tâches ouvertes sont fermées ; hors de « Annulé », ses tâches fermées sont rouvertes (`taskStatuses`, `afterUpdate`) ; le web le confirme d'abord avec leur nombre (la catégorie, enregistrée dès qu'elle change dans le panneau du statut, revient à la précédente si la confirmation est refusée) ;
  - la synchronisation GitHub suit la même règle (voir [GitHub](../cross-cutting/github.md#correspondances-et-cas-particuliers)).

## Fermer et rouvrir

Source : `setTasksClosed`.

- Au moins une tâche (« Aucune tâche sélectionnée. »), toutes existantes, aucune archivée.
- Fermer pose `closedAt` à maintenant ; une tâche déjà fermée **garde sa date de fermeture**. Rouvrir vide `closedAt` ; une tâche au statut « Annulé » passe alors au premier statut « À faire » non archivé, ou à aucun.
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

## Héritage

Source : `effectiveTask` (`packages/shared/src/tasks/task-inheritance.ts`, sur `resolveInheritance` de `core/inheritance.ts`), `services/tasks/task-inheritance.ts`, colonne `Task.inheritedFields`. Les routines suivent la même règle ([Routines](routines.md#héritage)).

- **Champs hérités** d’une sous-tâche : projet (`PROJECT`), assignés (`ASSIGNEES`), bénéficiaires, contributeurs et relations ensemble (`BENEFICIARIES`), condition de créneaux (`SLOT_CONDITION`), « Ouverture » (`MIN_DATE`), « Échéance » (`DEADLINE`), lieu avec son point (`LOCATION`), priorité (`PRIORITY`), jalon (`MILESTONE`). Le reste (statut, type, étiquettes, sprints, effort, rappels…) n’est jamais hérité.
- **Trois états par champ** : hérité (la valeur suivie est celle du parent, en direct, en remontant la chaîne des parents ; une boucle s’arrête au dernier élément vu) ; valeur propre ; vidé exprès (« aucun », même si le parent en a un ; une date vidée exprès se comporte comme celle d’une tâche du premier niveau : sans celle du parent, avec le repli jalon / projet / sprint, voir [Dates suivies](#dates-suivies)). Un champ est hérité quand il est dans `inheritedFields` ; sinon c’est la valeur de la tâche (vide : vidé exprès).
- **Seule une sous-tâche hérite** : une tâche du premier niveau n’a que ses valeurs (vide = vide) ; sa liste est toujours vide.
- **Vivant** : changer le parent, ou une valeur du parent, change aussitôt ce que suit l’enfant ; rien n’est recopié, sauf le projet (ci-dessous). Ranger la tâche sous un autre parent ne demande rien : elle suit le nouveau.
- **Placée sous un parent après coup** (une tâche du premier niveau rangée sous une autre : panneau, cellule « Tâche parente », glisser dans l’arbre) : ses champs **vides** héritent aussitôt, comme à la création ; ses valeurs propres restent (`adoptedTaskFields` sur `emptyTaskFields`, dans `updateTask` et `moveTask`). Une tâche qui change de parent garde sa liste : ses champs hérités suivent le nouveau, un champ vidé exprès reste vidé.
- **Projet** : hérité, il est aussi recopié dans `projectId` (numéros, jalons, sprints, GitHub, temps en dépendent). La règle de l’arborescence le garde dans celle du parent ; une sous-tâche héritant son projet, rangée sous un parent d’un autre projet de l’arborescence, part dans ce projet avec ses sous-tâches (comme un transfert) ; transférée seule dans un autre projet de l’arborescence, son projet devient le sien. Le projet ne se vide pas (« Le projet d’une sous-tâche ne se vide pas : elle reste dans l’arborescence de projets de sa tâche parente. » sous `clear`).
- **Perdre son parent** (mise au premier niveau, parent hors de l’arborescence après un transfert, parent supprimé, parent retiré par GitHub) : chaque champ hérité devient propre, avec la valeur qu’elle suivait ; rien ne change à l’écran (`freezeTaskInheritance`). Une date qui venait du jalon, du projet ou du sprint n’est pas recopiée : elle en vient toujours.
- **Écritures** :
  - `createTask` : `inheritedFields` donne les champs hérités ; omis, sous un parent, la tâche hérite de tout champ que l’entrée ne donne pas (les valeurs données pour un champ hérité ne sont pas prises ; le projet est celui du parent).
  - `updateTask` : `inherit` (champs hérités à nouveau, « Rétablir l’héritage ») et `clear` (champs vidés exprès, « Vider ») ; un champ auquel une valeur est donnée (`null` compris) devient propre.
  - `bulkUpdateTasks` : `inheritFields`, `clearFields`, même règle ; des assignés ajoutés ou retirés à des assignés hérités partent de ceux que la tâche suit, qui deviennent propres.
  - GitHub reçoit les valeurs suivies (priorité, échéance, jalon, assignés, héritées comprises) ; une valeur reçue de GitHub devient propre ; une sous-tâche détachée de son parent par GitHub perd son parent (ci-dessus), une tâche placée sous un parent par GitHub hérite de ses champs vides (voir [GitHub](../cross-cutting/github.md#correspondances-et-cas-particuliers)).
- **Écrans** :
  - Partout (cellules du tableau, panneau, formulaire de création), un champ hérité montre la valeur suivie, **grisée**, avec « Hérité de « #12 … » » sous le champ (en infobulle dans une cellule). Les dates héritées montrent celle du parent ; sans date du parent, la date du jalon, du projet ou du sprint reste affichée à la place du champ vide (« 12 nov. 2026 (jalon) »).
  - Taper ou choisir une valeur rend le champ propre. « Vider » (sous un champ hérité, sauf le projet) le vide exprès : « Vidé exprès », sans valeur, pas grisé. « Rétablir l’héritage » (sous un champ propre ou vidé d’une sous-tâche) le refait hériter. Chaque action est enregistrée aussitôt, comme tout champ du panneau.
  - Tableau : le menu « … » d’une sous-tâche et la barre des tâches cochées offrent « Héritage… » : un formulaire du panneau latéral donne, champ par champ, « Inchangé », « Rétablir l’héritage » ou « Vider » (`inheritFields` / `clearFields`), avec « Annuler » dans le toast (« Héritage changé pour 3 tâches. ») ; les tâches sans parent restent comme elles sont. Annuler une modification en masse d’un champ qui était hérité ou vidé le remet hérité ou vidé.
  - Nouvelle sous-tâche : le formulaire montre les valeurs du parent grisées et envoie la liste des champs encore hérités (`inheritedFields`) ; choisir un autre parent reprend les siennes.
  - Filtres, tris, groupes et export lisent la valeur suivie (`taskRow`).
- **Validation** sur les valeurs suivies : arborescence de projets du parent, jalon et sprints de l’arborescence du projet suivi, assignés propres parmi les contributeurs du projet suivi.
- **Lu partout où le champ compte** : « faisable maintenant » (ouverture, condition, assignés), rappels et notifications hors de l’app (dates), liens avec un évènement (assignés en commun), transformation en routine, dates suivies. La copie (« Dupliquer ») garde la liste : la copie hérite comme sa source.

## Effort

- Valeur libre ≥ 0 (voir le tableau du modèle).
- Dans les sommes (sprints, tableaux de bord), seul l’effort des tâches **sans sous-tâches** compte : l’effort d’un parent est celui de ses sous-tâches (`leafEffort`, web). L’API ne calcule pas de somme.

## Dates et retard

- Début / fin : créneau valide (« La fin doit suivre le début. »).
- « Ouverture » / « Échéance » : l’« Échéance » ne précède pas l’« Ouverture » (« La fin doit suivre le début. », sous `deadline`), dans le formulaire (`taskFormSchema`) comme dans l’API (création, modification, modification en masse). L’API compare les valeurs propres de la tâche une fois changées (celles envoyées, sinon celles qu’elle a) : une date héritée ou vidée exprès n’est pas comparée, ni une date suivie venue du jalon, du projet ou du sprint (voir [Dates suivies](#dates-suivies)).
- **En retard** (`isTaskOverdue` côté web) : « Échéance » suivie (`effectiveDeadline`, voir [Dates suivies](#dates-suivies)) passée (strictement avant aujourd’hui) et tâche non fermée. La même règle partout (tableau, panneau, accueil, agenda).

### Dates suivies

Source : `effectiveTask` (`packages/shared/src/tasks/task-inheritance.ts`), lu par l’API sur `loadTaskInheritance` (`services/tasks/task-inheritance.ts`), champs GraphQL `effectiveMinDate`, `effectiveDeadline`, `minDateSource`, `deadlineSource`.

- Chaque date est prise à part, dans cet ordre : la sienne ; puis, si elle l’hérite, celle que suit son parent (qui peut elle-même venir du parent, du jalon, du projet ou du sprint du parent) ; puis son jalon, son projet ou son sprint.
- **Ouverture** sans valeur propre ni héritée, la première qui existe : l’échéance du jalon qui précède le sien (même projet que son jalon, non archivé, d’échéance strictement avant la sienne, le plus proche), l’ouverture (début) de son projet, le premier jour de son premier sprint.
- **Échéance** sans valeur propre ni héritée : celle de son jalon, sinon le dernier jour de son premier sprint.
- Le premier sprint : celui qui commence le premier (puis qui finit le premier). Jalon et projet : ceux que la tâche suit (hérités compris).
- Vidée exprès, la date ne prend pas celle du parent, mais garde le repli jalon / projet / sprint, comme une tâche du premier niveau.
- La valeur suivie n’est pas enregistrée : elle est calculée à chaque lecture et suit donc le parent, le jalon, le projet et les sprints quand ils changent.
- Elle compte partout où compte la date : retard, « faisable maintenant » (pas avant l’ouverture), rappels (« À HH:MM », de l’ouverture à l’échéance ; « N jours avant » l’échéance), notifications hors de l’app, tri et filtres des colonnes « Ouverture » et « Échéance », export, accueil, agenda, transformation en routine. Elle s’affiche « 12 nov. 2026 (parent) », « (jalon) », « (projet) » ou « (sprint) » à la place du champ vide (`inheritedDateHint`, web).
- Les champs `minDate` / `deadline` restent ceux de la tâche (modification, copie) ; GitHub reçoit l’« Échéance » suivie.
- Un jalon est « en retard » quand son échéance est passée et qu’il reste des tâches non fermées ; un sprint quand sa fin est passée avec des tâches non fermées (calculs web, voir [Fonctionnalités](../../features/activities/tasks.md)).

## Tâches faisables maintenant

Source : requête `doableTaskIds(utcOffset)` (`services/calendar/slot-conditions.ts`).

Tâches ouvertes de l’espace dont l’« Ouverture » suivie (`effectiveTask`, voir [Dates suivies](#dates-suivies)) n’est pas après le jour de l’utilisateur (avant elle, la tâche n’est pas à faire), dont la condition de créneaux (la sienne ou héritée ; aucune : n’importe quand, dans les deux types d’espace) autorise le moment présent de l’utilisateur, et dont aucun évènement n’occupe les assignés (les siens ou hérités ; aucun : « Moi »), sauf un évènement lié à la tâche. Détail dans [Agenda](calendar.md).

## Pas de récurrence

Une tâche ne se répète pas : ce qui revient est une [routine](routines.md). Une tâche n’a ni répétition, ni série, ni date d’occurrence, et l’agenda ne crée aucune tâche. Une tâche se transforme en routine à la main : voir [Transformer en routine](#transformer-en-routine).

## Archivage

Source : `setTaskArchived`, `bulkSetTasksArchived`, `archiveTree` et `cascadeArchive` (`services/core/archive.ts`), `topmostIds` (`services/core/trees.ts`).

- Archiver une tâche archive aussi ses sous-tâches actives (marquées `archivedByCascade`).
- Restaurer une tâche restaure les sous-tâches archivées avec elle, et ses ancêtres archivés (seuls : leurs autres sous-tâches archivées avec eux restent archivées, pour leur propre compte).
- Une tâche archivée est en lecture seule : ni modification, ni déplacement, ni lien, ni commentaire, ni fermeture, ni transfert.
- En masse, seules les tâches du haut de la sélection sont traitées (une sous-tâche sélectionnée suit son ancêtre sélectionné).
- La requête `tasks` renvoie toutes les tâches, archivées comprises.

## Suppression

Source : `bulkDeleteTasks`, `deleteTreeItems` (`services/core/trees.ts`, partagé avec les routines).

- Suppression définitive, avec les commentaires de la tâche (`onDelete: Cascade`).
- Les sous-tâches sont, au choix (`deleteSubtasks`) : supprimées avec elle (tout le sous-arbre), ou remontées d’un niveau sous le parent de la tâche supprimée.
- En masse : les sous-tâches sélectionnées remontées par la suppression de leur parent sont supprimées aussi.
- Avant suppression : les items GitHub liés sont retirés du tableau GitHub (en tâche de fond, sans bloquer).
- Les temps passés restent (le lien entre le temps et la tâche disparaît), sauf ceux sans projet qui ne portent plus sur rien : ils sont supprimés avec elle, et la confirmation en donne le nombre ; un temps facturé est toujours gardé ; voir [Temps passé](time.md#suppression-de-ce-sur-quoi-porte-le-temps).

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

Source : `releaseProjectTasks` (par `releaseProjects`), appelé par `deleteProject` et `deleteClient(deleteProjects: true)`.

- Les tâches d'un projet supprimé (et de ses sous-projets) **ne sont pas supprimées** : elles sortent du projet comme lors d'un transfert hors de tout projet (`moveTaskTrees`), archivées comprises. Elles perdent leur numéro, leur jalon, leurs sprints et leur lien GitHub (items retirés du tableau) ; leurs blocages et relations avec les tâches restées dans un projet sont retirés, ainsi que leur parent s'il reste dans un projet.
- Seules les tâches des projets supprimés sortent (pas leurs sous-tâches, contrairement à un transfert) : une sous-tâche rangée dans un projet de la même arborescence qui n'est pas supprimé y reste, avec son numéro, son jalon et ses sprints ; elle perd seulement son parent, sorti de tout projet (une tâche d'un projet n'a qu'un parent de la même arborescence).
- En base, `Task.projectId` est `onDelete: SetNull` (filet : le numéro est alors vidé par le déclencheur).
- Ses alarmes restent, sans projet, avec leur tâche (`Alarm.projectId` en `onDelete: SetNull`) ; ses temps restent, sans projet (`releaseProjectTime`, `TimeEntry.projectId` en `onDelete: SetNull`), avec leurs tâches, leurs routines et leurs évènements.
- Ce qui reste supprimé avec le projet : ses temps passés sans tâche, ni routine, ni évènement (un temps a au moins un rattachement), sauf les temps facturés, gardés même sans rien de rattaché ; ses jalons et sprints.

## Duplication

Source : `duplicateTask` (« Dupliquer » : la copie est enregistrée tout de suite, puis son panneau s’ouvre).

- Copie tous les champs (libellé, description, projet, statut, priorité, type, effort, dates, « Ouverture » / « Échéance », rappels, temps morts, condition de créneaux, lieu et son point, liens, parent, jalon, sprints), les assignés, bénéficiaires, étiquettes et les liens de blocage et de relation de sa propre arborescence de projets (un ancien lien hors d’elle, gardé tant que la tâche ne change pas d’arborescence, n’est pas copié). **Pas** les commentaires, ni l’état fermé, ni le lien GitHub.
- Une copie dont le statut est « Annulé » est fermée, comme toute tâche qui reçoit ce statut.
- La copie s’appelle « … (copie) » (`copyName`, 250 caractères au plus) ; elle est placée sous le même parent, à la fin de l’ordre manuel ; elle reçoit un nouveau numéro (base).
- Avec `includeSubtasks`, le sous-arbre est copié niveau par niveau sous la copie (les sous-tâches copiées gardent leur libellé, assignés, bénéficiaires, étiquettes et sprints, pas leurs liens de blocage ou de relation).
- Une tâche archivée n’est pas copiée (« Élément archivé : restaurez-le pour le modifier. ») : l’interface ne propose la duplication que sur les tâches non archivées. Ses sous-tâches archivées, elles, sont copiées avec elle.

## Transformer en routine

Source : `convertTaskToRoutine(id, confirm)` (`services/routines/conversion.ts`, mutation GraphQL du même nom). Le sens inverse est dans [Routines](routines.md#transformer-en-tâche).

- Refusée pour une tâche archivée (« Élément archivé : restaurez-le pour le modifier. ») et pour une tâche qui a des sous-tâches, archivées comprises : « Une tâche qui a des sous-tâches ne devient pas une routine : déplacez ou supprimez d’abord ses sous-tâches. ».
- Sans `confirm`, rien ne change : `CONFIRMATION_REQUIRED` (« Transformer la tâche en routine lui fait perdre ce qu’une routine n’a pas : confirmez pour continuer. »), extension `lost` : ce qui est perdu, par sorte (`ConversionLoss`, `packages/shared/src/routines/conversion.ts`), toujours demandé, même vide.
- Une seule transaction : une nouvelle routine est créée (à la fin de l’ordre manuel), la tâche supprimée ; l’identifiant n’est pas gardé.
- Gardés : libellé, description, projet, assignés, bénéficiaires (contributeurs et relations), liens, lieu et son point, condition de créneaux, temps morts, rappels « À HH:MM » (comptés ensuite depuis l’« Ouverture » de l’occurrence) et « N jours avant » (toujours depuis l’« Échéance », repère `end`). Les valeurs déjà sur la tâche restent, même archivées ou plus rattachées au projet (comme une valeur déjà en place).
- Valeurs : celles que la tâche suit : un champ hérité de son parent est gardé avec la valeur héritée, la routine n’ayant pas de parent.
- Dates : l’« Échéance » suivie (voir [Dates suivies](#dates-suivies)) devient la première fois de la routine (sans échéance : l’« Ouverture » suivie, sinon aujourd’hui, heure de Paris) ; une « Ouverture » avant l’échéance devient l’« Ouverture » de la routine, « N jours avant » (366 au plus). La routine se répète chaque jour (`DAILY_RECURRENCE`), sans moment ; la répétition se choisit ensuite dans son panneau.
- Repris par la routine : ses temps passés (le temps porte sur la routine au lieu de la tâche), ses fiches (`SheetLink`), sa liste à cocher et ses commentaires, placés sur la première occurrence programmée (la condition de créneaux peut la décaler ; dates et textes des commentaires gardés, leur lien GitHub non) ; un évènement non récurrent lié à la tâche est lié à la routine le jour du début de l’évènement.
- Tâche fermée (`closedAt`, annulée comprise) : la première occurrence est cochée, chacun de ses moments (`RoutineCheck`, fait à la date de fermeture), pour qu’elle ne soit pas en retard. Une première occurrence à venir n’est pas cochée (une occurrence à venir ne se coche pas) ; une tâche ouverte ne coche rien.
- Perdus (comptés dans `lost`) : numéro (`number`), statut, priorité, type, étiquettes, jalon, sprints, item GitHub (retiré du tableau GitHub, en tâche de fond, comme à la suppression), effort, dates de début et de fin, liens « bloque » et « relative à » (`taskLinks`), listes d’achats liées, lien de ses alarmes (gardées, sans tâche : `alarms`), liens avec des évènements récurrents (`events`), une autre liste à cocher que la première (`checklists`), la tâche parente (`parent` : la routine est au premier niveau). Son historique de statuts part avec elle. Les liens « #12 » ou `?task=` écrits vers elle dans les textes ne mènent plus nulle part, comme après une suppression.

## Modification en masse

Source : `bulkUpdateTasks`.

- Champs : statut, priorité, type, jalon, effort, dates (début, fin, « Ouverture », « Échéance »), ajout / retrait d’assignés, d’étiquettes, de sprints. Omis = inchangé, `null` = vidé.
- Au moins une tâche, toutes existantes, aucune archivée (sauf annulation).
- Valeurs archivées : refusées si nouvelles ; celles que l’une des tâches a déjà restent valides pour toutes.
- Pour chaque tâche : assignés ajoutés parmi les contributeurs de son projet, jalon et sprints de son arborescence, créneau de dates valide.
- `restoring: true` (annulation d’une action) : accepte les valeurs archivées redonnées et les tâches archivées depuis ; seules ces vérifications sont sautées.

## Vues enregistrées

Source : `services/tasks/task-views.ts`, `tableViewConfigSchema` (voir [Tableaux](../../shared/cross-cutting/tables.md)).

- Une vue appartient à une portée : `projectId` (onglet d’un projet, ou `null` pour la page), `kind` et `tableKey`. Seules les vues de type `TABLE` se créent et se modifient : « Ce type de vue n’existe plus : les vues sont celles des tableaux. ». Les vues des autres types (tâches, routines, listes d’achats) sont conservées telles quelles.
- Libellé requis, 250 caractères au plus (`viewLabelSchema`) ; `tableKey` : minuscules, chiffres et « - », 64 au plus (« Tableau invalide. »).
- La configuration (filtres, tris, groupes, colonnes, options) est validée et complétée par les valeurs par défaut.
- Le projet doit être actif.
- La première vue d’une portée devient sa vue par défaut ; supprimer la vue par défaut donne ce rôle à la première vue restante.
- Dupliquer place la copie juste après l’originale. Réordonner par index dans la portée.
- La requête `taskViews` lit par défaut le type `TASKS` ; le web utilise des vues `TABLE` avec `tableKey: 'tasks'`.

### Colonnes des nouvelles vues

Source : `taskColumnDefaults`, `setTaskColumnDefaults` (`services/workspaces/workspaces.ts`), `taskColumnDefaultsSchema`.

- Par espace : ordre des colonnes et colonnes masquées des nouvelles vues de tâches (200 colonnes au plus, identifiants de 64 caractères au plus, `TABLE_KEY_MAX`). La colonne `label` n’est jamais masquée.
- `null` ou sans colonnes : celles de l’app (colonnes masquées par défaut : `location`, `blocking`, `related`, `milestone`, `createdAt`, `updatedAt`).
- L’identifiant `title` de la colonne du libellé, dans une vue enregistrée, est relu comme `label` (`LEGACY_LABEL_COLUMNS`).

## Contributeurs

Les contributeurs (`Contributor`) sont gérés dans le module tâches mais leurs règles sont dans [Personnes](../cross-cutting/people.md) : nom requis (250 caractères), identifiant de mention (`handleSchema` : 2 à 39 caractères, minuscules, chiffres, `-` et `_`, ni au début ni à la fin pour `-` et `_`), rattachement aux projets (hérité par les sous-projets), « Moi » rattaché à tous les projets.

## Pièces jointes

`uploadAttachment` (déclaré dans le module tâches) stocke un fichier de 10 Mo au plus, à lier depuis un texte markdown : voir [Fichiers et pièces jointes](../cross-cutting/files-and-attachments.md).

## Espace PRO / PERSO

Les règles sont les mêmes dans les deux types d’espace, condition de créneaux comprise (sans condition : n’importe quand ; voir [Agenda](calendar.md)). Toutes les données sont limitées à l’espace courant (`workspaceId`).
