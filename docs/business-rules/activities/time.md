# Règles métier — Temps passé et chrono

Règles appliquées par l’API aux temps passés (`TimeEntry`) : chrono (démarrer, mettre en pause, arrêter), temps saisis à la main, rattachement à un projet, des routines, des tâches et des évènements, facturation. Sources : `apps/api/src/services/tasks/time-entries.ts`, `apps/api/src/graphql/modules/time.ts`, `packages/shared/src/tasks/time.ts`, `apps/api/src/services/accounting/accounting-documents.ts` (facturation), `apps/api/prisma/schema.prisma`.

Voir aussi : [Tâches](tasks.md), [Facturation](../finances/accounting.md), [Routines](routines.md), [Agenda](calendar.md), [Commentaires](../cross-cutting/comments.md), [Alarmes](alarms.md), [Archivage](../cross-cutting/archiving.md).

## Modèle d’un temps

| Champ                                       | Règle                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectId`                                 | Projet sur lequel le temps est passé, facultatif (un temps a au moins un projet, une tâche, une routine ou un évènement). Supprimer le projet garde ses temps, sans projet, avec leurs tâches, leurs routines et leurs évènements (`releaseProjectTime`, `onDelete: SetNull`) ; seuls ceux qui ne gardent aucun rattachement (ni tâche, ni routine, ni évènement) et ne sont pas facturés sont supprimés. |
| `routines`                                  | Routines (plusieurs ; table `_RoutineToTimeEntry`, comme les tâches). Le temps est réparti à parts égales entre elles.                                                                                                                                                                                                                                                                                          |
| `tasks`                                     | Tâches (plusieurs). Le temps est réparti à parts égales entre elles.                                                                                                                                                                                                                                                                                                                                                          |
| `events`                                    | Évènements de l’agenda pendant lesquels le temps a été passé (plusieurs ; `TimeEntryEvent` : `eventId`, et `occurrenceDate` pour l’occurrence d’un évènement récurrent). Le temps est réparti à parts égales entre eux.                                                                                                                                                                                         |
| `description`                               | Markdown (éditeur markdown), 65 536 caractères au plus (« Texte trop long. ») ; blanc = `null`.                                                                                                                                                                                                                                                                                                                  |
| `startedAt`                                 | Début (date et heure).                                                                                                                                                                                                                                                                                                                                                                                                        |
| `endedAt`                                   | Fin ; `null` tant que le chrono tourne.                                                                                                                                                                                                                                                                                                                                                                                       |
| `pausedAt`                                  | Début de la pause en cours.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `pausedSeconds`                             | Pauses précédentes, en secondes.                                                                                                                                                                                                                                                                                                                                                                                              |
| `duration`                                  | Durée effective en secondes, pauses exclues ; posée à l’arrêt (`null` tant que le chrono tourne).                                                                                                                                                                                                                                                                                                                             |
| `documentId`                                | Facture (brouillon ou validée) sur laquelle le temps est facturé. Supprimer la facture libère le temps (`SetNull`).                                                                                                                                                                                                                                                                                                           |

Champs GraphQL : `routines` (`id`, `label`…), `taskIds`, `events` (`TimeEntryEvent` : `eventId`, `occurrenceDate`, `label`), `documentNumber` (numéro de la facture, `null` tant qu’elle est un brouillon).

## Ce sur quoi le temps est passé

Source : `checkedSubjects` (`placeOf`, `assertProjectTree`, `assertActiveLinks`, `eventLinksData`).

- Un temps porte sur **plusieurs tâches, plusieurs routines et plusieurs évènements**, chacun une fois.
- Un temps a **au moins un projet, une tâche, une routine ou un évènement** : sinon « Choisissez un projet, une tâche, une routine ou un évènement. » (sous `projectId`, `TIME_SUBJECT_REQUIRED`). Un temps sur un évènement, sur des tâches ou sur des routines n’a donc pas besoin de projet. Retirer le dernier d’un temps sans projet (formulaire, cellule, chrono) est refusé ainsi : le temps n’est pas supprimé.
- Avec des routines et sans projet donné, le temps prend **le projet de sa première routine qui en a un** (éventuellement aucun). Routine inconnue : « Routine introuvable. ». À la modification, seulement quand le projet ou les routines du temps sont changés : changer un autre champ (description, début, durée, tâches, évènements) d’un temps sans projet le laisse sans projet.
- Projet inconnu : « Projet introuvable. ». Un projet archivé est refusé, sauf s’il est déjà celui du temps.
- Tâches et routines : toutes doivent exister (« Tâche introuvable. », « Routine introuvable. ») et appartenir au projet **ou à l’un de ses sous-projets** : « Les tâches doivent appartenir au projet ou à ses sous-projets. », « Les routines doivent appartenir au projet ou à ses sous-projets. ». Celles sans projet vont avec n’importe quel projet. À la modification d’un temps dont le projet ne change pas, seules les tâches et routines ajoutées sont vérifiées : celles qu’il avait déjà restent valides, même passées depuis dans un autre projet (comme pour l’archivage).
- Sans projet : seules des tâches et des routines sans projet sont acceptées : « Choisissez d’abord le projet des tâches. », « Choisissez d’abord le projet des routines. ».
- Routines, tâches et évènements **nouvellement** choisis ne doivent pas être archivés (« Élément archivé : restaurez-le pour le modifier. » sous le champ) ; ceux que le temps avait déjà restent valides.
- Évènements : chacun doit exister (« Évènement introuvable. »). Pour un évènement récurrent, l’occurrence est requise : « Choisissez l’occurrence de l’évènement. ». Pour un évènement simple, la date d’occurrence est ignorée. Deux occurrences d’un même évènement récurrent peuvent être choisies.
- L’agenda ne montre que la part du temps **hors** des évènements choisis (voir [Agenda](calendar.md)).

### Suppression de ce sur quoi porte le temps

Source : `timeLeftEmpty`, `releaseSubjectTime` (`time-entries.ts`), appelés par `bulkDeleteTasks`, `bulkDeleteRoutines`, `deleteCalendarEvent`, `deleteCalendar`.

- Supprimer des tâches (avec ou sans leurs sous-tâches), des routines (avec ou sans leurs sous-routines), un évènement (une occurrence, celle-ci et les suivantes, toute la série) ou un calendrier (ses évènements) les retire de leurs temps.
- Un temps **sans projet** dont tout ce qu’il porte (tâches, routines, évènements) est supprimé est **supprimé avec eux** : un temps a au moins un projet, une tâche, une routine ou un évènement.
- Les temps des occurrences supprimées d’un évènement récurrent (« cette occurrence », « celle-ci et les suivantes ») perdent ces occurrences.
- Série coupée ou déplacée : les temps des occurrences suivantes (ou de toutes) suivent leur occurrence vers le nouvel évènement ou leur nouveau jour ; une occurrence reportée emmène ses temps vers son report (voir [Agenda](calendar.md)).
- Une tâche transformée en routine, ou une routine en tâche, n'est pas une suppression pour ses temps : ils portent sur le nouvel élément au lieu de l'ancien, aucun n'est supprimé (voir [Tâches](tasks.md#transformer-en-routine), [Routines](routines.md#transformer-en-tâche)).
- La confirmation de la suppression dit combien de temps seront supprimés, et combien de commentaires (requête `lostOnDelete`, mêmes arguments que la suppression).
- **Exception :** un temps **facturé** (`documentId` posé, brouillon ou facture validée) n’est **jamais** supprimé, ni ainsi ni avec son projet : il fait partie de sa facture. Il reste, même sans rien de rattaché ; c’est le seul cas d’un temps sans projet, ni tâche, ni routine, ni évènement.

## Chrono

**Plusieurs chronos tournent à la fois** : chaque temps sans `endedAt` est un chrono en cours, montré et arrêté à part ; chacun compte en entier dans les totaux (deux tâches menées en parallèle pendant 1 h font 2 h).

### Démarrer

Source : `startTimer`.

- Mêmes vérifications que ci-dessus (projet, routines, tâches, évènements, éléments archivés), description validée.
- **Les chronos en cours continuent de tourner** : démarrer un chrono n’en arrête aucun.
- Le nouveau temps commence maintenant.
- Côté web, un avertissement « Hors des moments prévus » signale des routines ou des tâches hors de leurs créneaux ou de leurs horaires (une tâche, ceux qu’elle suit : les siens ou hérités), ou des assignés occupés par un évènement (autre que ceux du chrono) ; le chrono tourne quand même (voir [Fonctionnalités](../../features/activities/time.md)).

### Pause et reprise

Source : `setTimerPaused(id, paused)`.

- Le chrono est désigné par son temps ; s’il ne tourne pas (arrêté, inconnu) : « Ce chrono ne tourne plus. ».
- Demander l’état déjà en place ne fait rien.
- Pause : `pausedAt` = maintenant. Reprise : la durée de la pause (en secondes entières) s’ajoute à `pausedSeconds`, `pausedAt` est vidé.
- Écrit seulement si le chrono tourne encore tel qu’il a été lu : changé ailleurs entre-temps, il est relu ; arrêté entre-temps : « Ce chrono ne tourne plus. ». Un temps terminé ne garde jamais de pause.

### Arrêter

Source : `stopTimer(id)`, `stopAllTimers` (« Arrêter tout »).

- Le chrono est désigné par son temps ; s’il ne tourne plus, ou s’il est arrêté, mis en pause ou repris ailleurs pendant l’arrêt : ne fait rien (renvoie `null`). Les autres continuent.
- « Arrêter tout » arrête chacun des chronos en cours de l’espace (mêmes règles) et ne renvoie que ceux qu’il a arrêtés.
- Un chrono en pause s’arrête **au début de sa pause**.
- Durée = (fin − début) en secondes entières − `pausedSeconds`, jamais négative, **24 heures au plus** : un chrono arrêté après avoir passé 24 heures (avant le passage de l’arrêt automatique) finit au moment où il les a atteintes, sa durée vaut 24 heures.

### Arrêt après 24 heures

Source : `capRunningTimers`, `scheduleTimerCap` (tâche de fond « Chronos de plus de 24 heures », voir [Tâches de fond](../cross-cutting/background-jobs.md)).

- Un chrono qui a tourné **24 heures** (pauses déduites, `DURATION_MAX_SECONDS`, la durée maximale d’un temps) est **arrêté tout seul** par l’API, même app fermée : sa fin est posée au moment où il atteint 24 heures (début + pauses + 24 h), sa durée vaut 24 heures. Un chrono en pause avant d’atteindre 24 heures n’est pas arrêté (sa durée n’avance plus).
- Vérifié toutes les 5 minutes dans chaque espace, et à chaque lecture des temps (`timeEntries`, `runningTimeEntries` arrêtent d’abord ceux qui ont passé 24 heures) : sa durée reste 24 heures.
- Chaque chrono n’est écrit que s’il tourne encore tel qu’il a été lu (comme « Arrêter ») : un chrono arrêté, mis en pause, repris ou abandonné au même moment est laissé tel quel, les autres sont arrêtés.
- L’app le montre au moment où il atteint 24 heures, sans attendre le retour du focus : elle recharge alors les temps (pastille, accueil, « Prévu et réalisé », journal) et les tâches ; le chrono disparaît des chronos en cours (rechargés aussi chaque minute) avec la notification « Chrono arrêté après 24 heures » (ce sur quoi il portait, « Sa durée est de 24 heures, le maximum d’un temps. »).

### Abandonner

Supprimer un temps en cours (`deleteTimeEntry`) abandonne ce chrono sans rien enregistrer.

### Durée en direct

`entrySeconds` (`packages/shared/src/tasks/time.ts`) : la durée enregistrée une fois arrêté ; sinon (fin, ou début de la pause en cours, ou maintenant) − début − pauses précédentes, jamais négative.

## Temps saisi à la main

Source : `createTimeEntry`, `timeEntryFormSchema`, `parseDuration`.

- Début et durée requis ; durée en secondes entières, **de 1 minute à 24 heures** (`durationSchema` : « Durée attendue. », « Au moins 1 minute. », « 24 heures maximum. »).
- La fin est calculée : début + durée.
- Formulaire (schéma partagé, `routineIds`, `taskIds`, `events` en listes) : jour requis (« La date est requise. »), heure de début `HH:MM` (« Heure attendue (HH:MM). »), durée tapée, au moins un projet, une tâche, une routine ou un évènement (« Choisissez un projet, une tâche, une routine ou un évènement. »), description markdown de 65 536 caractères au plus.
- Durées acceptées par `parseDuration` : « 1:30 », « 1h30 », « 1 h », « 45 min » (ou « mn », « m »), « 90 » (minutes), « 1,5h » ou « 1.5 h » (heures) ; hors de 1 min à 24 h ou illisible : « Durée attendue : 1:30, 1h30, 90 (minutes) ou 1,5 h. ».

## Modification

Source : `updateTimeEntry`.

- Refusée si le temps est sur une **facture validée** (voir plus bas).
- Champ omis (ou `null` pour `taskIds`, `routineIds`, `events`) = inchangé ; une liste vide les retire tous.
- Les tâches, routines et évènements donnés remplacent ceux du temps.
- Chrono en cours : sa durée ne se modifie pas (« La durée d’un chrono en cours ne se modifie pas. ») et son début ne peut pas être dans le futur (« Le début ne peut pas être dans le futur. ») ; en pause, son début doit précéder la pause, ses pauses passées déduites (« Le début doit précéder la pause. »). Il continue de tourner.
- Temps terminé : changer le début ou la durée recalcule la fin (début + durée).
- Le jour d’un temps est celui de son début à l’heure de Paris, pour l’API comme pour l’app (les évènements et routines de son jour proposés, `parisDay`), quel que soit le fuseau du navigateur.
- Début changé de jour (heure de Paris) sans que ses évènements soient donnés : le temps quitte les évènements qui ne sont pas ce jour-là (une occurrence d’un autre jour, un évènement unique qui ne couvre pas ce jour) ; ceux de ce jour restent. S’il n’a plus rien (sans projet, ni tâche, ni routine), le changement est refusé comme un retrait du dernier (« Choisissez un projet, une tâche, une routine ou un évènement. »).

## Suppression

Source : `deleteTimeEntry`.

- Refusée si le temps est sur une facture validée.
- Suppression définitive ; le temps est retiré du temps passé de ses tâches ; ses commentaires sont supprimés (`onDelete: Cascade`).

## Temps passé d’une tâche, d’une routine, d’un évènement

Source : champs `trackedSeconds` (`graphql/modules/tasks.ts`, `graphql/modules/routines.ts`, `toOccurrence` de `calendar-events.ts`).

- Tâche : somme, sur les temps **terminés** de la tâche, de la durée divisée par le nombre de tâches du temps (au moins 1), arrondie à la seconde : un temps passé sur trois tâches compte pour un tiers à chacune.
- Routine : de même, la durée des temps terminés divisée par le nombre de routines du temps.
- Occurrence d’un évènement : la durée des temps de l’occurrence (chronos en cours compris, en direct) divisée par le nombre d’évènements du temps.
- Pour une tâche et une routine, un chrono en cours ne compte qu’une fois arrêté.
- Des chronos en parallèle comptent chacun en entier : rien n’est retiré pour un chevauchement.

## Facturation du temps

Source : `assertNotInvoiced` (`time-entries.ts`), `assertBillableTime` (`accounting-documents.ts`).

- Seule une facture (`INVOICE`) peut facturer du temps : « Seule une facture peut facturer du temps. ». Un modèle de facture récurrente non plus : « Un modèle de facture récurrente ne facture pas de temps. ».
- Le temps doit être terminé : « Arrêtez le chrono avant de facturer son temps. ».
- Un temps n’est facturé qu’une fois : « Une partie de ce temps est déjà facturée (« … »). ».
- Les temps facturés sur un document sont ceux rattachés par `documentId` ; modifier la liste des temps d’un brouillon détache les autres.
- Un temps sur une **facture validée** (`FINAL`) fait partie de ce qu’elle énonce : il ne peut plus être modifié ni supprimé : « Ce temps est facturé sur `<numéro>` : il ne peut plus être modifié ni supprimé. » (avec le numéro de la facture). Sur un brouillon, il reste modifiable.
- Détails de la facture : voir [Facturation](../finances/accounting.md).

## Lecture

Source : requêtes `timeEntries`, `runningTimeEntries`.

- `timeEntries(projectId?, routineId?, since?)` : les temps du projet **et de ses sous-projets**, ou ceux qui portent sur une routine, ou tous ; avec `since`, ceux qui ne sont pas finis avant ce moment (commencés depuis, en cours, ou finis depuis : un chrono lancé la veille au soir compte) ; du plus récent au plus ancien. Les totaux par jour et par semaine de l’app comptent la part de chaque temps dans la période (`entrySecondsWithin`).
- `lostOnDelete(taskIds?, routineIds?, withSubtree?, eventId?, scope?, occurrenceDate?, calendarId?, routineOccurrence?)` : `{ times, comments }`, ce qu’une suppression de tâches, de routines, d’occurrences d’une routine, d’un évènement ou d’un calendrier (tous ses évènements, `calendarEventsGone`) supprimera avec eux : les temps (voir plus haut) et les commentaires des routines, évènements et occurrences supprimés (`commentsLostOnDelete` ; les commentaires de tâche ne sont pas comptés).
- `runningTimeEntries` : les chronos en cours, le premier démarré d’abord (liste vide : aucun).

## Commentaires d’un temps

Un temps prend des commentaires (cible `TIME_ENTRY`, voir [Commentaires](../cross-cutting/comments.md)). Aucun verrou d’archivage ne s’applique à un temps (il n’est pas archivable).

## Alarmes liées au temps

Les alarmes « pas de chrono » et « durée de chrono » (`NOT_TRACKING`, `TRACKING_DURATION`) sont décrites dans [Alarmes](alarms.md). Les **temps morts** et les **minuteurs** ne sont pas du temps passé : ils ne créent aucun temps (voir [Alarmes](alarms.md#minuteurs)).

## Espace PRO / PERSO

Les règles sont les mêmes. Côté web, la comparaison « Prévu et réalisé » avec les heures de travail n’est montrée qu’en espace PRO (en PERSO, les créneaux ne sont pas des heures de travail) ; les éphémérides n’y comptent jamais (`slotSchedules`).
