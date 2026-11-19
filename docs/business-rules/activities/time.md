# Règles métier — Temps passé et chrono

Règles appliquées par l’API aux temps passés (`TimeEntry`) : chrono (démarrer, mettre en pause, arrêter), temps saisis à la main, rattachement à un projet, une routine, des tâches et un évènement, facturation. Sources : `apps/api/src/services/tasks/time-entries.ts`, `apps/api/src/graphql/modules/time.ts`, `packages/shared/src/tasks/time.ts`, `apps/api/src/services/accounting/accounting-documents.ts` (facturation), `apps/api/prisma/schema.prisma`.

Voir aussi : [Tâches](tasks.md), [Facturation](../finances/accounting.md), [Routines](routines.md), [Agenda](calendar.md), [Commentaires](../cross-cutting/comments.md), [Alarmes](alarms.md), [Archivage](../cross-cutting/archiving.md).

## Modèle d’un temps

| Champ                                       | Règle                                                                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectId`                                 | Projet sur lequel le temps est passé ; `null` seulement pour le temps d’une routine sans projet. Supprimer le projet supprime ses temps (`onDelete: Cascade`). |
| `routineId`                                 | Routine sur laquelle le temps est passé, facultative. Supprimer la routine la retire du temps (`SetNull`).                                                     |
| `tasks`                                     | Tâches (plusieurs). Le temps est réparti à parts égales entre elles.                                                                                           |
| `description`                               | Texte libre multiligne, 4 000 caractères au plus (« 4 000 caractères maximum. »), nettoyé ; vide = `null`.                                                     |
| `startedAt`                                 | Début (date et heure).                                                                                                                                         |
| `endedAt`                                   | Fin ; `null` tant que le chrono tourne.                                                                                                                        |
| `pausedAt`                                  | Début de la pause en cours.                                                                                                                                    |
| `pausedSeconds`                             | Pauses précédentes, en secondes.                                                                                                                               |
| `duration`                                  | Durée effective en secondes, pauses exclues ; posée à l’arrêt (`null` tant que le chrono tourne).                                                              |
| `documentId`                                | Facture (brouillon ou validée) sur laquelle le temps est facturé. Supprimer la facture libère le temps (`SetNull`).                                            |
| `calendarEventId`, `calendarOccurrenceDate` | Évènement de l’agenda pendant lequel le temps a été passé (et son occurrence pour un évènement récurrent).                                                     |

Champs calculés (GraphQL) : `routineLabel`, `calendarEventLabel`, `documentNumber` (numéro de la facture, `null` tant qu’elle est un brouillon).

## Ce sur quoi le temps est passé

Source : `placeOf`, `assertProjectAndTasks`, `assertActiveLinks`, `eventLinkData`.

- Un temps a un projet, une routine, ou les deux. Sans routine, le projet est requis : « Le projet est requis. » (sous `projectId`).
- Avec une routine et sans projet donné, le temps prend **le projet de la routine** (éventuellement aucun). Routine inconnue : « Routine introuvable. ».
- Projet inconnu : « Projet introuvable. ». Un projet archivé est refusé, sauf s’il est déjà celui du temps.
- Tâches : toutes doivent exister (« Tâche introuvable. ») et appartenir au projet **ou à l’un de ses sous-projets** : « Les tâches doivent appartenir au projet ou à ses sous-projets. ». Les tâches sans projet vont avec n’importe quel projet.
- Sans projet (temps d’une routine) : seules des tâches sans projet sont acceptées : « Choisissez d’abord le projet des tâches. ».
- Routine, tâches et évènement **nouvellement** choisis ne doivent pas être archivés (« Élément archivé : restaurez-le pour le modifier. » sous le champ, décision AA) ; ceux que le temps avait déjà restent valides.
- Évènement : il doit exister (« Évènement introuvable. »). Pour un évènement récurrent, l’occurrence est requise : « Choisissez l’occurrence de l’évènement. ». Pour un évènement simple, la date d’occurrence est ignorée.
- L’agenda ne montre que la part du temps **hors** de l’évènement choisi (voir [Agenda](calendar.md)).

## Chrono

Un seul chrono tourne à la fois dans un espace (le temps sans `endedAt`).

### Démarrer

Source : `startTimer`.

- Mêmes vérifications que ci-dessus (projet / routine, tâches, éléments archivés, évènement), description validée.
- **Le chrono en cours, s’il y en a un, est arrêté d’abord** (son temps est enregistré) : décision Y.
- Le nouveau temps commence maintenant.
- Côté web, un avertissement « Hors des moments prévus » signale une routine ou des tâches hors de leurs plages, ou des assignés occupés par un évènement (autre que celui du chrono) ; le chrono tourne quand même (voir [Fonctionnalités](../../features/activities/time.md)).

### Pause et reprise

Source : `setTimerPaused`.

- Sans chrono en cours : « Aucun chrono en cours. ».
- Demander l’état déjà en place ne fait rien.
- Pause : `pausedAt` = maintenant. Reprise : la durée de la pause (en secondes entières) s’ajoute à `pausedSeconds`, `pausedAt` est vidé.

### Arrêter

Source : `stopTimer`.

- Sans chrono en cours : ne fait rien (renvoie `null`).
- Un chrono en pause s’arrête **au début de sa pause**.
- Durée = (fin − début) en secondes entières − `pausedSeconds`, jamais négative.

### Abandonner

Supprimer le temps en cours (`deleteTimeEntry`) abandonne le chrono sans rien enregistrer.

### Durée en direct

`entrySeconds` (`packages/shared/src/tasks/time.ts`) : la durée enregistrée une fois arrêté ; sinon (fin, ou début de la pause en cours, ou maintenant) − début − pauses précédentes, jamais négative.

## Temps saisi à la main

Source : `createTimeEntry`, `timeEntryFormSchema`, `parseDuration`.

- Début et durée requis ; durée en secondes entières, **de 1 minute à 24 heures** (`durationSchema` : « Durée attendue. », « Au moins 1 minute. », « 24 heures maximum. »).
- La fin est calculée : début + durée.
- Formulaire (schéma partagé) : jour requis (« La date est requise. »), heure de début `HH:MM` (« Heure attendue (HH:MM). »), durée tapée, projet requis sauf pour le temps d’une routine (« Le projet est requis. »), description de 4 000 caractères au plus.
- Durées acceptées par `parseDuration` : « 1:30 », « 1h30 », « 1 h », « 45 min » (ou « mn », « m »), « 90 » (minutes), « 1,5h » ou « 1.5 h » (heures) ; hors de 1 min à 24 h ou illisible : « Durée attendue : 1:30, 1h30, 90 (minutes) ou 1,5 h. ».

## Modification

Source : `updateTimeEntry`.

- Refusée si le temps est sur une **facture validée** (voir plus bas).
- Champ omis = inchangé ; `routineId` et `event` à `null` les retirent.
- Chrono en cours : sa durée ne se modifie pas (« La durée d’un chrono en cours ne se modifie pas. ») et son début ne peut pas être dans le futur (« Le début ne peut pas être dans le futur. »). Il continue de tourner.
- Temps terminé : changer le début ou la durée recalcule la fin (début + durée).
- Les tâches données remplacent celles du temps.

## Suppression

Source : `deleteTimeEntry`.

- Refusée si le temps est sur une facture validée.
- Suppression définitive ; le temps est retiré du temps passé de ses tâches ; ses commentaires sont supprimés (`onDelete: Cascade`).

## Temps passé d’une tâche

Source : champ `trackedSeconds` (`graphql/modules/tasks.ts`).

- Somme, sur les temps **terminés** de la tâche, de la durée divisée par le nombre de tâches du temps (au moins 1), arrondie à la seconde : un temps passé sur trois tâches compte pour un tiers à chacune.
- Le chrono en cours ne compte qu’une fois arrêté.

## Facturation du temps

Source : `assertNotInvoiced` (`time-entries.ts`), `assertBillableTime` (`accounting-documents.ts`).

- Seule une facture (`INVOICE`) peut facturer du temps : « Seule une facture peut facturer du temps. ». Un modèle de facture récurrente non plus : « Un modèle de facture récurrente ne facture pas de temps. ».
- Le temps doit être terminé : « Arrêtez le chrono avant de facturer son temps. ».
- Un temps n’est facturé qu’une fois : « Une partie de ce temps est déjà facturée (« … »). ».
- Les temps facturés sur un document sont ceux rattachés par `documentId` ; modifier la liste des temps d’un brouillon détache les autres.
- Un temps sur une **facture validée** (`FINAL`) fait partie de ce qu’elle énonce : il ne peut plus être modifié ni supprimé : « Ce temps est facturé sur `<numéro>` : il ne peut plus être modifié ni supprimé. » (avec le numéro de la facture). Sur un brouillon, il reste modifiable.
- Détails de la facture : voir [Facturation](../finances/accounting.md).

## Lecture

Source : requêtes `timeEntries`, `runningTimeEntry`.

- `timeEntries(projectId?, routineId?, since?)` : les temps du projet **et de ses sous-projets**, ou d’une routine, ou tous ; éventuellement depuis un moment ; du plus récent au plus ancien.
- `runningTimeEntry` : le chrono en cours, ou `null`.

## Commentaires d’un temps

Un temps prend des commentaires (cible `TIME_ENTRY`, voir [Commentaires](../cross-cutting/comments.md)). Aucun verrou d’archivage ne s’applique à un temps (il n’est pas archivable).

## Alarmes liées au temps

Les alarmes « pas de chrono » et « durée de chrono » (`NOT_TRACKING`, `TRACKING_DURATION`) sont décrites dans [Alarmes](alarms.md).

## Espace PRO / PERSO

Les règles sont les mêmes. Côté web, la comparaison « Prévu et réalisé » avec les heures de travail n’est montrée qu’en espace PRO (en PERSO, les plages ne sont pas des heures de travail).
