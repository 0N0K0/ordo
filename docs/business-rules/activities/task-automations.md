# Règles métier — Automatisations des tâches

Règles « quand … alors … » qui changent les tâches toutes seules : quand une « date de début » est renseignée, le statut passe à « En cours ». Sources : `packages/shared/src/tasks/task-automations.ts` (schémas, champs, messages), `apps/api/src/services/tasks/task-automations.ts` (CRUD), `apps/api/src/services/tasks/task-automation-engine.ts` (moteur), `apps/api/src/graphql/modules/task-automations.ts`, `apps/api/src/graphql/task-automation-extension.ts`, modèle `TaskAutomation`.

Voir aussi : [Tâches](tasks.md), [Héritage](tasks.md#héritage), [Archivage](../cross-cutting/archiving.md), [Ordre manuel](../cross-cutting/ordering.md), [GitHub](../cross-cutting/github.md), [Filtres des tableaux](../../shared/cross-cutting/tables.md).

## Portée et liste

- Les règles sont **propres à chaque espace** et valent pour **toutes les tâches de tous les projets** de l’espace (et les tâches sans projet).
- Une règle est un élément d’une liste de réglages comme les autres (`createLabelService('taskAutomation', …)`, type `TASK_AUTOMATION` de `SETTINGS_LISTS`) : nom, couleur, image, **ordre manuel**, archivage, suppression ; schéma `taskAutomationSchema`.
- Les règles s’appliquent **dans l’ordre de la liste**. Une règle **désactivée** (`enabled: false`) ou **archivée** est gardée mais ne s’applique jamais.
- Requête `taskAutomations` (ordre manuel, archivées comprises) ; mutations `createTaskAutomation`, `updateTaskAutomation` (champs omis inchangés, `condition: null` = toutes les tâches), `deleteTaskAutomation`, et les mutations communes des listes de réglages (`setSettingsItemLook`, `reorderSettingsItems`, `setArchived`).

| Champ       | Règle                                                                                   | Message                                                          |
| ----------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `label`     | Nom requis, 250 caractères, unique dans l’espace                                        | « Le nom est requis. », « Une règle porte déjà ce nom. »         |
| `color`     | Couleur `#rrggbb`, comme toute liste de réglages                                        | « Couleur invalide (format #rrggbb). »                           |
| `enabled`   | Active ou non ; active par défaut                                                       | —                                                                |
| `trigger`   | Déclencheur (voir [Déclencheurs](#déclencheurs))                                        | « Choisissez le déclencheur. », « Choisissez le champ. », « Choisissez le changement. », « Choisissez la valeur. », « Une valeur précise se choisit pour un champ à liste de choix. » |
| `condition` | Facultative : un filtre du tableau des tâches (voir [Condition](#condition)) ; vide = toutes les tâches | « Une condition est incomplète. », « Une condition porte sur une colonne qu’une règle ne lit pas. » |
| `actions`   | 1 à 20 actions, dans l’ordre (voir [Actions](#actions))                                  | « Ajoutez au moins une action. », « 20 actions au plus. », « Choisissez l’action. », « Choisissez le champ. », « Choisissez la valeur. », « Choisissez au moins une valeur. », « Date invalide. », « Nombre attendu. », « Ajouter ou retirer se fait dans une liste (étiquettes, assignés, sprints). » |

## Champs

Champs d’une tâche qu’une règle surveille ou change (`TASK_AUTOMATION_FIELDS`) : statut, priorité, type, étiquettes, assignés, jalon, sprints, projet, « Ouverture », « Échéance », début, fin, effort. Étiquettes, assignés et sprints sont des **listes** ; « Ouverture », « Échéance », début et fin des **jours** ; l’effort un **nombre** ; les autres une valeur d’une liste.

## Déclencheurs

`trigger` (`taskAutomationTriggerSchema`) : `{ event, field, change, value }`.

| `event`           | Quand                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `FIELD_CHANGED`   | Un champ change (`field`), selon `change` : `CHANGED` (tout changement), `SET` (« est renseigné » : il n’avait pas de valeur, il en a une), `CLEARED` (« est vidé » : il en avait une, il n’en a plus), `IS` (« prend la valeur » `value` : la valeur d’une liste qu’il prend, l’élément qu’une liste reçoit ; seulement pour les champs à liste de choix) |
| `CREATED`         | La tâche est créée (copie, item reçu de GitHub et routine convertie compris)              |
| `CLOSED`          | La tâche est fermée (terminée ou annulée)                                                 |
| `CLOSED_COMPLETED` | La tâche est fermée comme terminée (aussi une tâche annulée fermée ensuite comme terminée) |
| `CLOSED_NOT_PLANNED` | La tâche est fermée comme annulée (aussi une tâche terminée annulée ensuite)            |
| `REOPENED`        | La tâche est rouverte                                                                     |
| `ARCHIVED`        | La tâche est archivée                                                                     |
| `SUBTASKS_CLOSED` | Toutes ses sous-tâches (non archivées, au moins une) sont fermées, alors que ce n’était pas le cas |
| `TIMER_STARTED`   | Un chrono démarre sur elle                                                                |

- Un champ est lu sur la valeur que la tâche **suit** : une valeur héritée de sa tâche parente, une « Ouverture » ou une « Échéance » prise de son jalon, de son projet ou de son sprint (voir [Héritage](tasks.md#héritage) et [Dates suivies](tasks.md#dates-suivies)). Une tâche dont la valeur suivie change parce que son parent, son jalon, son sprint ou son projet a changé déclenche donc les règles comme si elle avait été changée.
- Une tâche **créée** (à la main, par « Dupliquer », par la synchronisation GitHub, par la conversion d’une routine) déclenche les règles « La tâche est créée » et, pour **chaque champ qui a une valeur** à sa création (propre ou héritée), les règles « est renseigné », « change » et « prend la valeur » de ce champ, comme s’il passait de vide à cette valeur. « est vidé » ne se déclenche jamais à la création. Les autres déclencheurs (fermée, fermée comme terminée ou comme annulée, rouverte, archivée, sous-tâches fermées, chrono) ne valent pas pour une tâche qui vient d’être créée.
- **Aucune écriture n’échappe aux règles** : tout ce qui change les tâches ou les valeurs qu’elles suivent les déclenche : création, modification, modification en masse, déplacement, transfert, fermeture (comme terminée ou annulée) et réouverture, archivage, copie, suppression (les sous-tâches restantes d’un parent), conversion d’une tâche en routine et d’une routine en tâche, synchronisation GitHub (les valeurs reçues), « Annuler », chrono démarré ; la modification, l’archivage, la restauration ou la suppression d’un jalon ou d’un sprint (mutation commune `setArchived` comprise) ; la modification, le déplacement (`moveProject` : l’arborescence et ce qu’en héritent ses tâches) ou la suppression d’un projet ; la suppression d’un client avec ses projets ; la suppression d’un contributeur (les tâches perdent cet assigné) ; la suppression d’un statut, d’une priorité, d’un type ou d’une étiquette (les tâches perdent cette valeur).
- **Une écriture à la fois** : quand l’espace a des règles actives, ses écritures de tâches passent l’une après l’autre (une synchronisation GitHub de fond attend la requête en cours, et inversement) : ce qui change entre les deux lectures est celui de l’écriture seule, aucune règle ne s’applique deux fois pour un changement fait ailleurs.

## Condition

- `condition` (`taskAutomationConditionSchema`) est un filtre du tableau des tâches, écrit avec le même éditeur et appliqué par le même moteur (`matchesFilter`, `meetsCondition`) : groupes ET / OU, 5 niveaux au plus, mêmes opérateurs et mêmes valeurs (dates relatives à aujourd’hui, périodes de la semaine de l’espace, « Moi », sprints relatifs).
- Colonnes qu’une règle lit (`TASK_AUTOMATION_FILTER_KINDS`) : libellé, description, numéro, projet (et ceux au-dessus), statut, catégorie de statut, priorité, type, assignés, étiquettes, jalon, sprint, tâche parente (et celles au-dessus), effort, début, fin, « Échéance », « Ouverture », fermée, « Fermeture » (terminée ou annulée ; vide pour une tâche ouverte), archivée, a des sous-tâches. Une condition sur une autre colonne, ou incomplète, est refusée à l’enregistrement.
- La condition est lue sur les valeurs que la tâche **suit** (héritées comprises), au moment où la règle s’applique (après les règles précédentes). Aujourd’hui est le jour de Paris ; « Moi » est le contributeur de l’utilisateur de l’app.

## Actions

`actions` (`taskAutomationActionSchema`), dans l’ordre ; sur le même élément, la dernière l’emporte.

| `kind`    | Ce qu’elle fait                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------- |
| `SET`     | Donne une valeur à un champ : une valeur de sa liste, des éléments (une liste prend exactement ceux-là), un jour (une date, aujourd’hui, dans ou il y a N jours, compté le jour où elle s’applique), un nombre |
| `ADD`     | Ajoute des éléments à une liste (étiquettes, assignés, sprints)                                           |
| `REMOVE`  | Retire des éléments d’une liste                                                                           |
| `CLEAR`   | Vide un champ (le projet : la tâche sort de tout projet)                                                  |
| `CLOSE`   | Ferme la tâche comme terminée (« Fermer comme terminée »)                                                 |
| `CLOSE_NOT_PLANNED` | Ferme la tâche comme annulée (« Fermer comme annulée ») ; une tâche déjà fermée garde sa date et devient annulée |
| `REOPEN`  | Rouvre la tâche                                                                                           |
| `ARCHIVE` | Archive la tâche (avec ses sous-tâches, comme à la main)                                                  |

- Les actions passent par les écritures ordinaires des tâches, avec leurs vérifications : le projet par le transfert (`bulkTransferTasks`), les champs par la modification en masse (`bulkUpdateTasks`), puis la fermeture ou la réouverture (`setTasksClosed`), puis l’archivage. Mêmes règles qu’à la main : valeurs archivées refusées si nouvelles, assignés parmi les contributeurs du projet, jalon et sprints de l’arborescence, dates valides…
- Un champ hérité que change une action devient **propre** à la tâche, comme par toute écriture ; vidé, il reste vide (il n’hérite plus).
- Une action refusée n’empêche pas le changement qui a déclenché la règle (déjà fait) : la règle n’est pas appliquée à cette tâche et la réponse dit pourquoi. Ce qu’elle avait déjà changé avant le refus reste.
- Une tâche archivée est en lecture seule : seules les règles « La tâche est archivée » s’y appliquent, et leurs actions sur ses champs, sa fermeture ou sa réouverture passent (comme une annulation) ; un changement de projet y est refusé.

## Enchaînements

- Ce qu’une règle change peut déclencher d’autres règles, sur la tâche et sur celles qui suivent ses valeurs (ses sous-tâches) : au plus **5 tours** de suite (`TASK_AUTOMATION_CHAIN_MAX`), le premier étant celui du changement de départ.
- Une règle ne s’applique **jamais deux fois à la même tâche** dans un même enchaînement : pas de boucle.
- Le moteur passe une seule fois par changement (`automated`, autour de chaque écriture de tâches) : les écritures faites à l’intérieur (une action, une synchronisation qui crée des tâches) n’appliquent pas de règles à part.
- **Pas de transaction commune** : les règles s’appliquent juste après l’écriture, dans la même requête, chacune par ses propres écritures. Une action refusée garde l’écriture de départ et ce que la règle avait déjà fait ; la notification « Règle non appliquée » le signale, avec la raison. Une erreur imprévue du moteur ne défait pas non plus l’écriture.

## Suivi et annulation

- Chaque règle appliquée pendant une requête est renvoyée dans les `extensions` de sa réponse, sous `taskAutomations` (`TaskAutomationReport` : règle, ce qu’elle a fait, tâches changées, ce qui les remet comme avant ; ou pourquoi elle a été refusée), quelle que soit la mutation. Une règle qui ne change rien n’est pas signalée.
- L’app en fait une notification par règle : « Règle « Démarrage » : statut « En cours » » (« (3 tâches) » pour plusieurs), avec « Annuler » ; une règle refusée : « Règle non appliquée », avec la raison et « Le changement qui l’a déclenchée est gardé. ».
- « Annuler » (`TaskAutomationRevert`) restaure la tâche si la règle l’a archivée, la remet dans son projet, redonne ses champs (héritage rétabli, champ vidé à nouveau, ou sa valeur ; les éléments d’une liste ajoutés retirés et inversement), puis son état ouvert / fermé et sa façon d’être fermée (terminée ou annulée) ; comme toute annulation, ses valeurs archivées et une tâche archivée depuis sont acceptées (son état ouvert / fermé lui est rendu même archivée, `setTasksClosed` avec `restoring`), et elle peut à son tour déclencher des règles. Remise dans son ancien projet, la tâche retrouve ce que le changement de projet a retiré, comme l’annulation d’un transfert (`links` du `TaskAutomationRevert`, `restoreTaskLinks`) : blocages et relations avec les tâches restées dans l’autre arborescence, parent resté dehors, jalons, sprints et documents de projet, les siens et ceux de ses sous-tâches.
- Pas d’historique : une synchronisation GitHub de fond (hors requête de l’app) applique les règles sans notification.

## Règles du statut « Annulé »

Une catégorie de statut ne ferme ni ne rouvre aucune tâche (voir [Catégories de statut](tasks.md#catégories-de-statut)) : le lien entre un statut « Annulé » et une tâche annulée est fait par des règles ordinaires, modifiables, désactivables ou supprimables. La migration `20261122160000_task_close_reason` les a créées dans chaque espace qui avait un statut de catégorie « Annulé », après ses règles, actives (une règle dont le nom était déjà pris n’a pas été créée) ; elles valent pour tous les statuts « Annulé », présents et à venir, par leur condition sur la catégorie. Un espace créé ensuite n’a **aucune règle par défaut** : ces règles s’y créent à la main si on les veut. Les règles créées par la migration :

| Règle                                    | Quand                                | Condition                                                                                          | Alors                                                                                   |
| ---------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| « Statut annulé : fermer comme annulée » | Le statut change (création comprise) | Catégorie de statut est « Annulé »                                                                 | Fermer comme annulée                                                                    |
| « Fermée comme annulée : statut annulé » | La tâche est fermée comme annulée    | Catégorie de statut n’est pas « Annulé »                                                           | Statut : le premier statut « Annulé » non archivé (règle créée seulement s’il y en a un) |
| « Statut non annulé : rouvrir »          | Le statut change                     | « Fermeture » est « Annulée » et catégorie de statut n’est pas « Annulé » (aucun statut compris)    | Rouvrir                                                                                 |
| « Rouverte : statut à faire »            | La tâche est rouverte                | Catégorie de statut est « Annulé »                                                                 | Statut : le premier statut « À faire » non archivé (vider s’il n’y en a pas)            |

- Ensemble : un statut « Annulé » ferme la tâche comme annulée, le quitter (pour un autre statut ou aucun) la rouvre, annuler une tâche lui donne le statut « Annulé », rouvrir une tâche « Annulé » lui donne le premier statut « À faire ». Aucune ne boucle : une règle ne s’applique qu’une fois par tâche dans un enchaînement, et leurs conditions s’excluent.
- Changer la catégorie d’un statut ne déclenche aucune d’elles (le statut des tâches ne change pas) : ses tâches restent comme elles sont.
- Un espace créé ensuite, ou sans statut « Annulé », n’en a pas : on les crée à la main si on le veut.
