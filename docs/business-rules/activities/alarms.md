# Règles des alarmes

Règles des alarmes (validation, programmation, occurrences, sonneries) et des rappels des tâches, routines et évènements sonnés par le navigateur. Sources : `apps/api/src/services/tasks/alarms.ts`, `apps/api/src/graphql/modules/time.ts`, `packages/shared/src/tasks/time.ts` (section Alarms), `packages/shared/src/dates/reminders.ts` (rappels), et la logique de sonnerie côté web `apps/web/src/features/alarms/components/ring.tsx`, `lib/ring-routines.tsx`. Fonctionnalités : [Alarmes](../../features/activities/alarms.md).

## Modèle

`Alarm` (`apps/api/prisma/schema.prisma`) : `label`, `note`, `type` (`REMINDER`, `NOT_TRACKING`, `TRACKING_DURATION`), `startDate`, `time` (`HH:MM` local), anciens champs de répétition `frequency` (`ONCE`, `DAILY`, `WEEKLY`, `MONTHLY`), `interval`, `weekdays`, `endDate`, la répétition commune `recurrence` (JSON), `minutes`, `projectId`, `taskId`, `enabled`, `lastFiredAt`. Les heures sont dans le fuseau local de l’utilisateur (celui du navigateur qui sonne).

Supprimer la tâche supprime ses alarmes (`onDelete: Cascade`) ; supprimer le projet les garde, sans projet, avec leur tâche (`onDelete: SetNull`, décision DP).

## Validation (`alarmInputSchema`)

| Champ        | Règle                                                           | Message                                                                   |
| ------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `label`      | Requis, 250 caractères (`TEXT_MAX`, décision DO)                | « Le libellé est requis. », « 250 caractères maximum. »                   |
| `note`       | Texte multiligne, 4 000 caractères ; vide → null                | « 4 000 caractères maximum. »                                             |
| `interval`   | Entier 1 à 365                                                  | « Au moins 1. », « 365 maximum. »                                         |
| `weekdays`   | 0 à 7 valeurs de 1 (lundi) à 7                                  | —                                                                         |
| `recurrence` | Règle commune ou null (voir [Dates](../cross-cutting/dates.md)) | —                                                                         |
| `minutes`    | Entier 1 à 1 440, requis pour `TRACKING_DURATION`               | « Au moins 1 minute. », « 24 heures maximum. », « La durée est requise. » |
| `startDate`  | Requise hors `TRACKING_DURATION`                                | « La date est requise. »                                                  |
| `time`       | `HH:MM`, requise hors `TRACKING_DURATION`                       | « L’heure est requise. »                                                  |
| `endDate`    | Après `startDate`                                               | « La fin doit suivre le début. »                                          |

## Enregistrement (`parseAlarm`)

- Projet : existant et non archivé, sauf s’il est déjà celui de l’alarme (`assertActive`, voir [Archivage](../cross-cutting/archiving.md)).
- Tâche : doit exister (« Tâche » introuvable).
- Les champs qui ne s’appliquent pas au type sont effacés : pour `TRACKING_DURATION`, date, heure, fin et répétition à vide ; pour les autres, `minutes` à vide.
- `weekdays` : gardés (dédoublonnés et triés) seulement pour `frequency = WEEKLY`.
- `recurrence` : null pour `TRACKING_DURATION` ou sans répétition.
- L’interface envoie aussi les anciens champs dérivés de la répétition (`legacyFields` : fréquence, intervalle, jours, fin ; `YEARLY` envoyé comme `MONTHLY`) pour les anciens clients.
- Modification (`updateAlarm`) : `lastFiredAt` remis à maintenant : une programmation changée repart de zéro, les occurrences déjà passées ne sonnent pas.
- Suppression : définitive (« Alarme » introuvable sinon).
- Liste (`alarms`) : triée par `startDate`, `time`, `createdAt` croissants.

## Occurrences

Source : `packages/shared/src/tasks/time.ts`.

- Règle d’une alarme (`alarmRule`) : sa répétition commune si elle est valide ; sinon ses anciens champs (`ONCE` : aucune, sonne une fois ; sinon fréquence, intervalle ≥ 1, jours pour l’hebdomadaire, fin `endDate`).
- Sans règle, elle sonne le jour de `startDate` seulement, à `time`.
- `previousOccurrence(schedule, moment, lookBackDays = 2)` : dernière occurrence au plus tard au moment, en remontant jusqu’à 2 jours.
- `nextOccurrence(schedule, moment)` : prochaine occurrence après le moment, cherchée sur 800 jours ; null une fois passée la fin de la règle (ou le premier jour sans règle).
- Côté web, `nextRing` : aucune prochaine sonnerie pour une alarme inactive ou de type `TRACKING_DURATION` ; une alarme active planifiée sans prochaine sonnerie est « Terminée ».

## Enregistrement d’une sonnerie (`markAlarmFired`)

- Refus d’un moment plus d’une minute dans le futur : « Moment invalide. ».
- Sans effet si `lastFiredAt` est déjà à ce moment ou après ; sinon `lastFiredAt` = le moment de l’occurrence.

## Quand une alarme sonne (`dueAlarms`)

Vérification toutes les 15 secondes dans l’onglet ouvert (`AlarmCenter`) ; les alarmes des autres espaces sonnent aussi, rechargées chaque minute (`ElsewhereNotifier`, décision EO).

- Inactive : jamais.
- `REMINDER` et `NOT_TRACKING` : l’occurrence précédente (`previousOccurrence`) sonne si elle est postérieure à `lastFiredAt` (à défaut `createdAt`) et date de 6 heures au plus (`MAX_DELAY_MS`). Elle est d’abord enregistrée comme sonnée (`markAlarmFired`) ; `NOT_TRACKING` ne sonne pas si un chrono tourne (en pause compris), mais l’occurrence est quand même consommée.
- `TRACKING_DURATION` : avec un chrono en cours non en pause, palier = `floor(secondes du chrono / (minutes × 60))` ; sonne quand le palier augmente (palier > 0), pas à la première vérification d’un chrono (paliers déjà franchis ignorés, y compris après un rechargement). L’alarme ne vérifie pas que le chrono porte sur sa tâche ou son projet : tout chrono en cours compte.
- Les paliers sont gardés en mémoire de l’onglet (par alarme et par chrono), pas en base.

## Un seul onglet sonne (`claim`)

- Chaque occurrence a une clé (`ordo.alarm.<alarme>:<instant>`, `…:<chrono>:<palier>`, `ordo.alarm.event:<occurrence>:before:<minutes>` ou `…:at:<HH:MM>`, `ordo.alarm.routine:<routine>:<échéance>:<moment>:before:<minutes>` ou `ordo.alarm.routine:<routine>:<échéance>:at:<HH:MM>`, `ordo.alarm.task:<tâche>:<jour>:at:<HH:MM>`), réclamée dans `localStorage` avec une expiration (10 minutes pour les alarmes ; 7 heures pour les rappels).
- Un autre onglet (de n’importe quel espace) ou le même avant rechargement qui l’a déjà réclamée gagne ; les réclamations expirées sont nettoyées au passage. Sans stockage disponible, l’onglet sonne quand même.

## Rappels des tâches, routines et évènements

Un seul fonctionnement pour les trois (décision D16) : schéma partagé (`packages/shared/src/dates/reminders.ts`), 10 rappels au plus par élément (« 10 rappels maximum. »), de types mêlés, dédoublonnés et triés à l’enregistrement (`normalizedReminders` : les « avant » du plus tôt au plus tard, puis les heures), stockés en JSON (`[{ before, at }]`, l’un des deux à `null`), heures de **Paris** (`parisInstant`, décision D7), sonnés par une seule brique du navigateur (`ringPlannedReminders`, `apps/web/src/features/alarms/components/ring.tsx`) : chaque rappel dû sonne une fois, au plus 6 heures en retard (`MAX_DELAY_MS`), carillon, notification système et toast. Il n’y a pas de tâche de fond de l’API pour les rappels : ils sonnent tant qu’Ordo est ouvert, **quel que soit l’espace ouvert** (décision EO, voir [Tâches de fond](../cross-cutting/background-jobs.md)).

Trois types de rappel (`reminderSchema` : exactement un de `before` et `at`, sinon « Un rappel est « N min avant » ou « à HH:MM ». ») :

| Type                    | Valeur                        | Évènement                                          | Routine                                                                                                        | Tâche                                                                                         |
| ----------------------- | ----------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| « Au début »            | `{ before: 0 }`               | À son début                                        | Le premier jour de l’occurrence (« Ouverture ») à l’heure « dès » de chaque moment non coché, sinon son heure maximale | Non                                                                                           |
| « N min avant »         | `{ before: N }`, 1 à 1 440    | N minutes avant son début (24 heures au plus)      | N minutes avant ce même moment, pour chaque moment non coché                                                    | Non (« Une tâche n’a que des rappels à une heure précise. »)                                   |
| « À HH:MM le jour J »   | `{ at: 'HH:MM' }`             | À cette heure, le premier jour de l’occurrence     | À cette heure, le premier jour de l’occurrence (« Ouverture »), **une fois par occurrence**                   | À cette heure, chaque jour de l’ouverture à l’échéance (le jour de l’échéance sans ouverture) |

- Le début d’une journée entière est minuit (Paris) de son premier jour.
- Ne sonnent pas : une occurrence d’évènement annulée (`calledOff`), un évènement ou un calendrier archivé ; une routine archivée, un moment coché (pour les « avant »), une occurrence faite ; une tâche fermée ou archivée, ou sans échéance (Q2 : champ désactivé ; les rappels restent enregistrés sans sonner). Un moment de routine sans aucune heure n’a pas de rappel « avant » ; les rappels « À HH:MM » d’une routine sans horaire sonnent quand même.
- Évènements : occurrences d’hier à J+8 (non archivées, calendriers non archivés), rechargées toutes les 5 minutes. Les rappels sont exportés en `VALARM` relatifs au début (voir [Règles de l’agenda](calendar.md#export-icalendar)).
- Routines : l’API donne, pour chaque routine qui a des rappels, les occurrences où ils sonnent (`reminderOccurrences`, `services/routines/routines.ts`) : l’occurrence en cours tant qu’elle n’est pas faite et la suivante (un rappel jusqu’à 24 heures avant peut sonner avant qu’elle s’ouvre), chacune avec son premier jour et, pour chaque moment non coché, l’instant d’où comptent les « avant ». Pendant un évènement occupant ses assignés, le rappel est reporté au prochain moment libre (`nextAllowedAt`, 14 jours d’horizon ; espace ouvert seulement) ; aucun : pas de rappel. Action « Marquer comme faite » (occurrence en cours, espace ouvert seulement) : coche le moment (le premier non coché pour un « À HH:MM »). Voir [Règles des routines](routines.md).
- Tâches : rappels du jour et de la veille (un rappel de 23 h 30 peut encore sonner après minuit) des tâches ouvertes et non archivées (`taskReminders`, `taskRemindsOn`). Une ouverture après l’échéance (possible par l’API seule) compte comme absente. Toast : libellé, « Échéance », lien vers la tâche.
- Les rappels sont **à côté** des alarmes, qui restent telles quelles (objets à part, avec leur propre répétition, sur une tâche ou un projet, et les alarmes de chrono). Une alarme `REMINDER` sur une tâche peut faire le même office qu’un rappel de tâche ; rien ne les relie.

## Sonnerie

- Carillon Web Audio (880, 1 175, 1 568 Hz), silencieux tant que la page n’a reçu ni clic ni touche (règle des navigateurs).
- Notification système seulement si l’autorisation est accordée ; une par clé (`tag`).
- Toast d’information persistant (voir [Notifications](../../web/lib.md)).

## Alarmes et rappels des autres espaces

Les alarmes et les rappels des tâches, routines et évènements de **tous** les espaces de l’utilisateur sonnent quel que soit l’espace ouvert (décision EO, `ElsewhereNotifier`) : ce n’est plus un choix de l’espace. Les sonneries suivent les mêmes règles, la sonnerie d’une alarme étant enregistrée dans l’espace de l’alarme ; le toast indique « Espace « X » ». Seuls les nouveaux mails restent un choix (`NOTIFICATION_SOURCES = ['MAILS']`, `packages/shared/src/core/workspace.ts` ; `apps/api/src/services/workspaces/workspaces.ts`). Voir [Espaces et accès](../cross-cutting/workspaces-and-access.md).
