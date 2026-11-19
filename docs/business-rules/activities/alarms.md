# Règles des alarmes

Règles des alarmes (validation, programmation, occurrences, sonneries) et des rappels d’évènements et alertes de routines sonnés par le navigateur. Sources : `apps/api/src/services/tasks/alarms.ts`, `apps/api/src/graphql/modules/time.ts`, `packages/shared/src/tasks/time.ts` (section Alarms), et la logique de sonnerie côté web `apps/web/src/features/alarms/components/ring.tsx`, `lib/ring-routines.tsx`. Fonctionnalités : [Alarmes](../../features/activities/alarms.md).

## Modèle

`Alarm` (`apps/api/prisma/schema.prisma`) : `label`, `note`, `type` (`REMINDER`, `NOT_TRACKING`, `TRACKING_DURATION`), `startDate`, `time` (`HH:MM` local), anciens champs de répétition `frequency` (`ONCE`, `DAILY`, `WEEKLY`, `MONTHLY`), `interval`, `weekdays`, `endDate`, la répétition commune `recurrence` (JSON), `minutes`, `projectId`, `taskId`, `enabled`, `lastFiredAt`. Les heures sont dans le fuseau local de l’utilisateur (celui du navigateur qui sonne).

Supprimer le projet ou la tâche supprime ses alarmes (`onDelete: Cascade`).

## Validation (`alarmInputSchema`)

| Champ        | Règle                                                           | Message                                                                   |
| ------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `label`      | Requis, 200 caractères (`ALARM_LABEL_MAX`)                      | « Le libellé est requis. », « 200 caractères maximum. »                   |
| `note`       | 4 000 caractères ; vide → null                                  | « 4 000 caractères maximum. »                                             |
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

Vérification toutes les 15 secondes dans l’onglet ouvert (`AlarmCenter`) ; pour les autres espaces, les alarmes sont rechargées chaque minute (`ElsewhereNotifier`).

- Inactive : jamais.
- `REMINDER` et `NOT_TRACKING` : l’occurrence précédente (`previousOccurrence`) sonne si elle est postérieure à `lastFiredAt` (à défaut `createdAt`) et date de 6 heures au plus (`MAX_DELAY_MS`). Elle est d’abord enregistrée comme sonnée (`markAlarmFired`) ; `NOT_TRACKING` ne sonne pas si un chrono tourne (en pause compris), mais l’occurrence est quand même consommée.
- `TRACKING_DURATION` : avec un chrono en cours non en pause, palier = `floor(secondes du chrono / (minutes × 60))` ; sonne quand le palier augmente (palier > 0), pas à la première vérification d’un chrono (paliers déjà franchis ignorés, y compris après un rechargement). L’alarme ne vérifie pas que le chrono porte sur sa tâche ou son projet : tout chrono en cours compte.
- Les paliers sont gardés en mémoire de l’onglet (par alarme et par chrono), pas en base.

## Un seul onglet sonne (`claim`)

- Chaque occurrence a une clé (`ordo.alarm.<alarme>:<instant>`, `…:<chrono>:<palier>`, `ordo.alarm.event:<occurrence>:<minutes>`, `ordo.alarm.routine:<routine>:<jour>:<heure du jour>:<minutes>`), réclamée dans `localStorage` avec une expiration (10 minutes pour les alarmes ; 7 heures pour les rappels et alertes).
- Un autre onglet (de n’importe quel espace) ou le même avant rechargement qui l’a déjà réclamée gagne ; les réclamations expirées sont nettoyées au passage. Sans stockage disponible, l’onglet sonne quand même.

## Rappels d’évènements

- Occurrences d’hier à J+8 (non archivées, calendriers non archivés), rechargées toutes les 5 minutes.
- Chaque rappel sonne à « début − minutes » ; début d’une journée entière = minuit local du premier jour (« 6 h avant » = la veille à 18 h). Au plus 6 heures de retard.
- Les occurrences annulées ne sont pas filtrées par la sonnerie (`ringReminders` ne teste pas `calledOff`).
- Voir aussi les rappels exportés en `VALARM` dans [Règles de l’agenda](calendar.md#export-icalendar).

## Alertes de routines

Source : `apps/web/src/features/alarms/lib/ring-routines.tsx`.

- Seulement les routines non archivées, dont l’occurrence courante est aujourd’hui, pas encore faites, avec des rappels.
- Chaque heure du jour non cochée (ou l’unique de la routine) a son moment (`routineAlertTime` : heure de départ, sinon début de la fenêtre, sinon heure limite) ; chaque rappel sonne à « moment − minutes », au plus 6 heures en retard.
- Hors des plages permises par la règle de plages de la routine (et hors évènement occupant ses assignés), l’alerte est reportée au prochain moment permis (`nextAllowedAt`, 14 jours d’horizon) ; aucun : pas d’alerte.
- Action « Marquer comme faite » : coche cette heure du jour de la routine. Voir [Règles des routines](routines.md).

## Sonnerie

- Carillon Web Audio (880, 1 175, 1 568 Hz), silencieux tant que la page n’a reçu ni clic ni touche (règle des navigateurs).
- Notification système seulement si l’autorisation est accordée ; une par clé (`tag`).
- Toast d’information persistant (voir [Notifications](../../web/lib.md)).

## Notifications des autres espaces

Sources : `NOTIFICATION_SOURCES` (`packages/shared/src/core/workspace.ts` : `ALARMS`, `CALENDAR`, `MAILS`), `apps/api/src/services/workspaces/workspaces.ts`. Chaque espace choisit ce qu’il signale quand un autre est ouvert ; les sonneries suivent les mêmes règles, la sonnerie étant enregistrée dans l’espace de l’alarme. Voir [Espaces et accès](../cross-cutting/workspaces-and-access.md).
