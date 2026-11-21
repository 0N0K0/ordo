# Règles des alarmes

Règles des alarmes (validation, programmation, occurrences, sonneries) et des rappels des tâches, routines, évènements, éphémérides et anniversaires sonnés par le navigateur. Sources : `apps/api/src/services/tasks/alarms.ts`, `apps/api/src/graphql/modules/time.ts`, `packages/shared/src/tasks/time.ts` (section Alarms), `packages/shared/src/dates/reminders.ts` (rappels), `packages/shared/src/dates/ringing.ts` (réglages et état des sonneries), `apps/api/src/services/tasks/alarm-rings.ts`, `packages/shared/src/dates/countdowns.ts` et `apps/api/src/services/tasks/countdowns.ts` (minuteurs et temps morts), ce qui sonne et ses textes, communs à l’app et au serveur (`packages/shared/src/dates/reminder-rings.ts`), la logique de sonnerie côté web `apps/web/src/features/alarms/components/ring.tsx`, `lib/ring-routines.tsx`, `lib/ringing.tsx`, et les notifications push (`apps/api/src/services/tasks/push.ts`, `outside-rings.ts`, `apps/web/src/features/alarms/lib/push.ts`, `apps/web/public/push-sw.js`). Fonctionnalités : [Alarmes](../../features/activities/alarms.md).

## Modèle

`Alarm` (`apps/api/prisma/schema.prisma`) : `label`, `note`, `type` (`REMINDER`, `NOT_TRACKING`, `TRACKING_DURATION`), `startDate`, `time` (`HH:MM` de Paris), anciens champs de répétition `frequency` (`ONCE`, `DAILY`, `WEEKLY`, `MONTHLY`), `interval`, `weekdays`, `endDate`, la répétition commune `recurrence` (JSON), `minutes`, `projectId`, `taskId`, `enabled`, `lastFiredAt`. Les dates et heures sont celles de **Paris**, pour l’app comme pour le serveur qui sonne hors de l’app : mêmes instants, mêmes clés.

Supprimer la tâche supprime ses alarmes (`onDelete: Cascade`) ; la transformer en routine les garde, sans tâche (une routine n'a pas d'alarme) ; supprimer le projet les garde, sans projet, avec leur tâche (`onDelete: SetNull`).

## Validation (`alarmInputSchema`)

| Champ        | Règle                                                           | Message                                                                   |
| ------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `label`      | Requis, 250 caractères (`TEXT_MAX`)                            | « Le libellé est requis. », « 250 caractères maximum. »                   |
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
- `previousOccurrence(schedule, moment, lookBackDays = 2)` : dernière occurrence au plus tard au moment, en remontant jusqu’à 2 jours, à l’heure de Paris.
- `nextOccurrence(schedule, moment)` : prochaine occurrence après le moment, cherchée sur 800 jours, à l’heure de Paris ; null une fois passée la fin de la règle (ou le premier jour sans règle).
- Côté web, `nextRing` : aucune prochaine sonnerie pour une alarme inactive ou de type `TRACKING_DURATION` ; une alarme active planifiée sans prochaine sonnerie est « Terminée ».

## Enregistrement d’une sonnerie (`markAlarmFired`)

- Refus d’un moment plus d’une minute dans le futur : « Moment invalide. ».
- Sans effet si `lastFiredAt` est déjà à ce moment ou après ; sinon `lastFiredAt` = le moment de l’occurrence.

## Quand une alarme sonne (`dueAlarms`)

Vérification toutes les 15 secondes dans l’onglet ouvert (`AlarmCenter`) ; les alarmes des autres espaces sonnent aussi, rechargées chaque minute (`ElsewhereNotifier`).

- Inactive : jamais.
- `REMINDER` et `NOT_TRACKING` : l’occurrence précédente (`previousOccurrence`) sonne si elle est postérieure à `lastFiredAt` (à défaut `createdAt`) et date de 6 heures au plus (`RING_LATE_MS`, `dueAlarmOccurrence`). Elle est d’abord enregistrée comme sonnée (`markAlarmFired`) ; `NOT_TRACKING` ne sonne pas si un chrono au moins tourne (en pause compris ; plusieurs peuvent tourner), mais l’occurrence est quand même consommée.
- `TRACKING_DURATION` : pour **chaque** chrono en cours non en pause, palier = `floor(secondes du chrono / (minutes × 60))` ; sonne quand le palier augmente (palier > 0), pas à la première vérification d’un chrono (paliers déjà franchis ignorés, y compris après un rechargement). L’alarme ne vérifie pas que le chrono porte sur sa tâche ou son projet : tout chrono en cours compte, chacun avec ses paliers.
- Les paliers sont gardés en mémoire de l’onglet (par alarme et par chrono), pas en base.

## Un seul onglet sonne (`claim`)

- Chaque occurrence a une clé (`ordo.alarm.<alarme>:<instant>`, `…:<chrono>:<palier>`, `ordo.alarm.event:<occurrence>:before:<minutes>` ou `…:at:<HH:MM>`, `ordo.alarm.routine:<routine>:<échéance>:<moment>:before:<minutes>` ou `ordo.alarm.routine:<routine>:<échéance>:at:<HH:MM>`, `ordo.alarm.task:<tâche>:<jour>:at:<HH:MM>`, `ordo.alarm.task:<tâche>:<échéance>:days:<N>:<HH:MM>`, `ordo.alarm.ephemeris:<éphéméride>:<premier jour>:…`, `ordo.alarm.birthday:<contributor|relation>:<id>:<jour>:…`, `ordo.alarm.countdown:<minuteur>` ; un « N jours avant » finit par `:days:<N>:<HH:MM>`), réclamée dans `localStorage` avec une expiration (10 minutes pour les alarmes ; 7 heures pour les rappels).
- Un autre onglet (de n’importe quel espace) ou le même avant rechargement qui l’a déjà réclamée gagne ; les réclamations expirées sont nettoyées au passage. Sans stockage disponible, l’onglet sonne quand même.
- Un rappel compté depuis un autre repère que le début a ce repère devant son type dans sa clé (`…:end:before:15`, `…:end:at:18:00`, `…:end:days:2:09:00`, `…:openEnd:before:30`, `…:dueStart:before:0`). Une répétition est réclamée par `ordo.alarm.<clé>:again` pour la durée d’une sonnerie : un seul onglet la fait entendre, les autres montrent le toast.

## Rappels des tâches, routines et évènements

Un seul fonctionnement pour tous, éphémérides et anniversaires compris : schéma partagé (`packages/shared/src/dates/reminders.ts`), 10 rappels au plus par élément (« 10 rappels maximum. »), de types mêlés, dédoublonnés et triés à l’enregistrement (`normalizedReminders` : les « avant » du plus tôt au plus tard, puis les heures), stockés en JSON (`[{ before, at, days, anchor?, ringtone? }]`, l’un de `before` et `at` à `null`, `days` avec `at` seulement ; `anchor` (`end`, `openEnd`, `dueStart`) et `ringtone` seulement quand ils sont donnés), heures de **Paris** (`parisInstant`), planifiés par des briques partagées par l’app et le serveur (`eventRings`, `taskRings`, `routineRings`, `ephemerisRings`, `birthdayRings` : mêmes clés, instants et textes) et sonnés par une seule brique du navigateur (`ringPlannedReminders`, `apps/web/src/features/alarms/components/ring.tsx`) : chaque rappel dû sonne une fois, au plus 6 heures en retard (`RING_LATE_MS`, `isRingDue`), par la sonnerie de l’app (voir [Sonnerie](#sonnerie)), **quel que soit l’espace ouvert**. App fermée, le serveur les envoie en notifications push à qui l’a choisi (voir [Hors de l’app](#hors-de-lapp-notifications-push) et [Tâches de fond](../cross-cutting/background-jobs.md)).

Quatre types de rappel (`reminderSchema` : exactement un de `before` et `at`, sinon « Un rappel est « N min avant », « à HH:MM » ou « N jours avant, à HH:MM ». » ; `days` avec `at` seulement, sinon « Un rappel « N jours avant » a une heure (HH:MM). ») :

| Type                       | Valeur                                  | Évènement                                          | Routine                                                                                                        | Tâche                                                                                         | Éphéméride                                                      | Anniversaire                 |
| -------------------------- | --------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------- |
| « Au début »               | `{ before: 0 }`                         | À son début                                        | Le premier jour de l’occurrence (« Ouverture ») à l’heure « dès » de chaque moment non coché, sinon son heure maximale | Non                                                                                           | Au début de chaque suite de jours (minuit pour une journée entière) | Non                          |
| « N min avant »            | `{ before: N }`, 1 à 1 440              | N minutes avant son début (24 heures au plus)      | N minutes avant ce même moment, pour chaque moment non coché                                                    | Non (« Une tâche n’a que des rappels à une heure précise. »)                                   | N minutes avant ce début                                        | Non (« Un anniversaire n’a que des rappels à une heure précise. ») |
| « À HH:MM le jour J »      | `{ at: 'HH:MM' }`                       | À cette heure, le premier jour de l’occurrence     | À cette heure, le premier jour de l’occurrence (« Ouverture »), **une fois par occurrence**                   | À cette heure, chaque jour de l’ouverture à l’échéance (le jour de l’échéance sans ouverture) | À cette heure, le premier jour de chaque suite de jours          | À cette heure, le jour même  |
| « N jours avant, à HH:MM » | `{ at: 'HH:MM', days: N }`, 1 à 30 jours | À cette heure, N jours avant le premier jour       | À cette heure, N jours avant le premier jour (« Ouverture »), une fois par occurrence                          | À cette heure, N jours avant l’échéance, une fois                                             | À cette heure, N jours avant le premier jour de la suite         | À cette heure, N jours avant |

### Depuis le début ou la fin

Un rappel compte depuis un **repère** (`anchor`), avec les mêmes types :

- **Évènement** (`EVENT_REMINDER_ANCHORS`) : son **début** (`anchor` absent ou `start`, comme ci-dessus) ou sa **fin** (`end`).
- **Routine** (`ROUTINE_REMINDER_ANCHORS`), pour chaque occurrence : le **début de l’ouverture** (`start`, absent), la **fin de l’ouverture** (`openEnd`), le **début de l’échéance** (`dueStart`), la **fin de l’échéance** (`end`). Le début et la fin sont ceux de chaque moment non coché, comme l’agenda du jour les montre (`routineSlotSpan`, `routineSlotAnchors`) : « dès » et « jusqu’à » ; sans « jusqu’à », la fin est « dès » + le temps estimé de la routine ; sans « dès », le début est « jusqu’à » − ce temps (00:00 au plus tôt). Sans temps estimé (ou 0) : 30 min, comme à l’affichage (`ROUTINE_DEFAULT_MINUTES`). Un moment sans aucune heure n’a pas de rappel « avant » ; une routine sans aucune heure n’offre et n’accepte que les rappels à une heure (voir [Règles des routines](routines.md#départ-retour-rappels-routineschedule-routineslotspan-reminderoccurrences)).
- Un rappel à une heure (« À HH:MM », « N jours avant, à HH:MM ») ne dit que le jour : le premier jour (`start`) ou le dernier jour (`end`) de l’évènement ; l’ouverture (`start`) ou l’échéance (`end`) de la routine. `openEnd` et `dueStart` y sont enregistrés `start` et `end`.

| Type                               | Valeur                                      | Évènement                                                                  | Routine                                                                                                   |
| ---------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| « À la fin »                       | `{ before: 0, anchor: 'end' }`              | À sa fin (journée entière : minuit après le dernier jour)                  | Le jour de l’échéance, à la fin de chaque moment non coché                                                |
| « N min avant la fin »             | `{ before: N, anchor: 'end' }`, 1 à 1 440   | N minutes avant sa fin                                                     | N minutes avant ce même moment                                                                            |
| « N min avant la fin de l’ouverture » | `{ before: N, anchor: 'openEnd' }`      | Refusé                                                                     | N minutes avant la fin de chaque moment non coché, le jour de l’ouverture                                 |
| « N min avant le début de l’échéance » | `{ before: N, anchor: 'dueStart' }`    | Refusé                                                                     | N minutes avant le début de chaque moment non coché, le jour de l’échéance                                |
| « À HH:MM le jour de la fin »      | `{ at: 'HH:MM', anchor: 'end' }`            | À cette heure, son dernier jour                                            | À cette heure, le jour de l’échéance, une fois par occurrence                                             |
| « N jours avant la fin, à HH:MM »  | `{ at: 'HH:MM', days: N, anchor: 'end' }`   | À cette heure, N jours avant son dernier jour                              | À cette heure, N jours avant l’échéance, une fois par occurrence                                          |

- Seuls les évènements et les routines en ont (`remindersSchema` pour les routines, `eventRemindersSchema` pour les évènements, qui refuse `openEnd` et `dueStart` : « Seules les routines ont des rappels depuis la fin de l’ouverture ou le début de l’échéance. ») ; les éphémérides (`startRemindersSchema`), les tâches et les anniversaires les refusent : « Seuls les évènements et les routines ont des rappels avant la fin. ». Une valeur inconnue : « Un rappel compte depuis un début ou une fin. ».
- Un rappel de routine sans repère compte depuis le début de l’ouverture ; `end` est la fin de l’échéance.
- L’API donne pour chaque moment non coché ses heures (`reminderOccurrences` : `slots { slot, fromTime, dueTime }`), sur le « quand » que la routine suit (celui de sa parente quand elle en hérite, voir [Héritage](routines.md#héritage)), pour l’app comme pour les notifications hors de l’app ; les instants sont calculés par la brique partagée (`routineSlotAnchors`), pour l’app et le serveur.
- Une routine convertie en tâche garde ses rappels « À HH:MM » et « N jours avant » sans leur repère (une tâche les compte depuis son échéance) ; une tâche convertie en routine garde ses « N jours avant » depuis l’échéance (`end`), ses « À HH:MM » depuis l’ouverture.
- Dédoublonnés par leur clé (`reminderKey`, repère devant) ; triés par repère (début de l’ouverture, fin de l’ouverture, début de l’échéance, fin).
- Export iCalendar des évènements : `TRIGGER;RELATED=END` (voir [Règles de l’agenda](calendar.md#export-icalendar)) ; les routines ne sont pas exportées.
- Éditeur : une ligne par rappel (voir [Composants de saisie](../../web/components/inputs.md#remindersselect)).

### Sonnerie d’un rappel

Chaque rappel peut nommer une sonnerie de la banque (`ringtone`) ; sans elle, celle des réglages de l’utilisateur. Une sonnerie inconnue (retirée de la banque) compte comme absente, sans erreur. Elle ne fait pas partie de la clé : changer de sonnerie ne refait pas sonner un rappel.

Le « N jours avant » dépasse la limite de 24 heures des « avant » (30 jours au plus). Il vaut partout où il y a des rappels ; l’éditeur le saisit sur une ligne (nombre de jours et heure), sans préréglage.

- Le début d’une journée entière est minuit (Paris) de son premier jour.
- Ne sonnent pas : une occurrence d’évènement annulée (`calledOff`), un évènement ou un calendrier archivé ; une routine archivée, une occurrence de routine annulée ou que sa condition de créneaux ne programme pas, un moment coché (pour les « avant »), une occurrence faite ; une tâche fermée ou archivée, ou sans échéance (champ désactivé ; les rappels restent enregistrés sans sonner). Un moment de routine sans aucune heure compte de 0 h à minuit ; les rappels « À HH:MM » d’une routine sans horaire sonnent comme les autres.
- Évènements : occurrences d’hier à J+31 (non archivées, calendriers non archivés, `reminderDayRange` : de quoi sonner un « N jours avant »), rechargées toutes les 5 minutes. Toast : libellé, « ven. 13 nov., 14:05 · lieu » (jour et heure de Paris de son début) ou « Journée entière · lieu ». Les rappels sont exportés en `VALARM` relatifs au début (voir [Règles de l’agenda](calendar.md#export-icalendar)).
- Routines : l’API donne, pour chaque routine qui a des rappels, les occurrences où ils sonnent (`reminderOccurrences`, `services/routines/routines.ts`) : l’occurrence en cours tant qu’elle n’est pas faite et la suivante (un rappel jusqu’à 24 heures avant peut sonner avant qu’elle s’ouvre), et, avec des « N jours avant », les suivantes qui s’ouvrent d’ici là, chacune avec son premier jour et ses moments non cochés avec leurs heures. Pendant un évènement occupant ses assignés (aucun : « Moi »), le rappel est reporté au prochain moment libre, à l’heure de Paris (`nextAllowedMoment`, 14 jours d’horizon, `NEXT_ALLOWED_DAYS`) : dans l’app pour l’espace ouvert, et par le serveur hors de l’app ; aucun : pas de rappel. Action « Marquer comme faite » (occurrence en cours, espace ouvert seulement) : coche le moment (le premier non coché pour un « À HH:MM »). Voir [Règles des routines](routines.md).
- Tâches : rappels « À HH:MM » du jour et de la veille (un rappel de 23 h 30 peut encore sonner après minuit) et « N jours avant » l’échéance des tâches ouvertes et non archivées (`taskReminders`, `taskRemindsOn`), sur l’« Ouverture » et l’« Échéance » qu’elles suivent (`effectiveMinDate`, `effectiveDeadline` : les leurs, sinon celles de leur parent, de leur jalon, de leur projet ou de leur premier sprint, `effectiveTask`). Une ouverture après l’échéance (possible par l’API seule) compte comme absente. Toast : libellé, « Échéance », lien vers la tâche.
- Éphémérides : seules les éphémérides ont des rappels (`WorkSchedule.reminders`, un créneau n'en sonne aucun ; ceux d'une éphéméride convertie en créneau restent enregistrés sans sonner) ; une éphéméride archivée n'en sonne pas. Ils comptent depuis le premier jour de chaque **suite de jours consécutifs** qu'elle couvre (`scheduleRuns` : des vacances de deux semaines sonnent une fois, des jours fériés répétés chaque année une fois par jour), à l'heure de son premier horaire ce jour-là (minuit pour une journée entière) ; suites d’hier à J+31, des éphémérides de la requête `workSchedules`. Toast : libellé, jour (et heure).
- Anniversaires : rappels de la personne (`birthdayRemindersSchema`), sur les anniversaires d'hier à J+31 de la requête `birthdays` (personnes non archivées). Toast : « Anniversaire de Paul — 40 ans » (l'âge ce jour-là quand l'année de naissance est connue), le jour, « Ouvrir la fiche » (le panneau du contributeur ou de la relation ; d'un autre espace : son agenda).
- Les rappels sont **à côté** des alarmes, qui restent telles quelles (objets à part, avec leur propre répétition, sur une tâche ou un projet, et les alarmes de chrono). Une alarme `REMINDER` sur une tâche peut faire le même office qu’un rappel de tâche ; rien ne les relie.

## Sonnerie

Une seule brique pour tout ce qui sonne, alarmes et rappels, espace ouvert et autres (`startRinging`, `apps/web/src/features/alarms/lib/ringing.tsx`) :

- La sonnerie (celle du rappel, sinon celle des réglages) sonne pendant la **durée** des réglages, en boucle ou une fois ; silencieuse tant que la page n’a reçu ni clic ni touche (règle des navigateurs). Six sonneries générées par l’app (Web Audio, aucun fichier) : `carillon` (880, 1 175, 1 568 Hz), `bip`, `marimba`, `cloche`, `reveil`, `harpe` (`RINGTONES`).
- Notification système seulement si l’autorisation est accordée ; une par clé (`tag`), à chaque sonnerie entendue dans l’onglet.
- Toast qui reste (`notifyAlarm`), sans bouton de fermeture : « Arrêter » (pour de bon), « Répéter dans N min » (N = la répétition des réglages, 5 sans répétition : `snoozeMinutes`), puis ses liens (un lien suivi garde le toast). En attente, il indique « Sonne à nouveau à HH:MM » et n’offre plus que « Arrêter » et les liens.
- Fin de la durée sans réponse : silence ; avec une répétition, elle resonne N minutes après la fin (`repeatedRingAt` : début + durée + répétition), jusqu’à « Arrêter » ; sans répétition, le toast reste silencieux jusqu’à « Arrêter ».
- Plusieurs sonneries à la fois : chacune son toast, ses boutons et son son.

### Réglages (`User.ringSettings`)

Globaux pour l’utilisateur, valables dans tous les espaces (`ringSettingsSchema`, `readRingSettings` : un champ absent ou invalide prend la valeur par défaut) :

| Champ           | Règle                                                   | Défaut       | Message                                       |
| --------------- | ------------------------------------------------------- | ------------ | --------------------------------------------- |
| `ringMinutes`   | Entier 1 à 30 (`RING_MINUTES_MAX`)                     | 1            | « Au moins 1 minute. », « 30 minutes maximum. » |
| `loop`          | Booléen : la sonnerie se répète pendant la durée        | oui          | —                                             |
| `repeatMinutes` | Entier 0 à 60 (`REPEAT_MINUTES_MAX`) ; 0 : pas de répétition | 5       | « Au moins 0 minute. », « 60 minutes maximum. » |
| `ringtone`      | Une sonnerie de la banque                               | `carillon`   | « Sonnerie inconnue. »                        |
| `outside`       | Booléen : sonner hors de l’app (notifications push aux appareils de l’utilisateur) | non | —                                 |

Mutation `updateRingSettings(input)` (champ GraphQL `User.ringSettings`).

### État d’une sonnerie (`AlarmRing`)

L’API garde chaque sonnerie de l’utilisateur (modèle `AlarmRing`, partagé par tous les espaces, une ligne par `(userId, key)`) : ce que montre son toast (`title`, `lines`, `path` et `linkLabel` du premier lien qui a une page, `ringtone`, `workspaceId`), `dueAt`, `ringingSince` (sonnerie en cours ; null : silencieuse), `nextAt` (prochaine sonnerie ; null : aucune), `stoppedAt`. Ainsi un rechargement, un autre onglet ou un autre appareil la montre telle qu’elle est, et le serveur sait quand la renvoyer en notification push.

- `ringAlarm(input)` : appelée à chaque sonnerie entendue (première ou répétition) ; crée la ligne ou la met à jour : `ringingSince` = maintenant, `nextAt` = `repeatedRingAt` des réglages ; une sonnerie déjà arrêtée reste telle quelle (l’onglet s’arrête alors). Les lignes de plus de 6 heures (`RING_KEPT_MS`, depuis leur dernier changement) sont supprimées au passage.
- `snoozeAlarmRing(key)` : `ringingSince` = null, `nextAt` = maintenant + `snoozeMinutes` ; null si inconnue ou arrêtée.
- `stopAlarmRing(key)` : `stoppedAt` = maintenant, plus de prochaine sonnerie.
- `ringOutside(input)` (serveur) : première sonnerie par le serveur, enregistrée seulement si aucune ligne n’existe pour la clé (un onglet ou un appareil l’a déjà sonnée : rien) ; `ringAgainOutside(ring)` : répétition par le serveur, seulement si la sonnerie n’a été ni arrêtée, ni mise en attente, ni resonnée entre-temps (`nextAt` inchangé).
- `alarmRings` : sonneries changées depuis 6 heures, arrêtées comprises, les plus récentes d’abord ; chaque onglet les suit au montage puis chaque minute (`loadRings`) : une arrêtée s’arrête, une inconnue de l’onglet s’affiche (sans son tant qu’une répétition n’est pas due). Entre onglets du même navigateur, « Arrêter » et « Répéter » passent aussitôt (`BroadcastChannel` `ordo.alarm`).
- Une sonnerie affichée par un rechargement (ou venue d’un autre onglet ou appareil) garde son lien vers une page et retrouve ses autres actions, refaites depuis sa clé (`routineRingOf`, `birthdayRingOf`) : « Marquer comme faite » pour un rappel de l’occurrence en cours d’une routine de l’espace ouvert (le moment de la clé ; un « À HH:MM » : le premier moment non coché), « Ouvrir la fiche » pour un anniversaire de l’espace ouvert ; une fois les routines et les anniversaires chargés.
- Une sonnerie déjà affichée suit un arrêt **et** une répétition demandée ailleurs (autre appareil, notification) : silencieuse, elle attend sa prochaine sonnerie (à 5 secondes près). Hors ligne, elle sonne quand même, sans état gardé.

## Hors de l’app (notifications push)

Web Push par le service worker de la PWA : chaque envoi sonne une fois le son de notification du système avec vibration, avec « Arrêter » et « Répéter dans N min » ; le serveur renvoie toutes les N minutes jusqu’à l’arrêt. La boucle et la sonnerie choisie ne valent qu’app ouverte. Android Chrome est visé ; il n’y a pas d’app native.

### Appareils (`PushSubscription`)

- Un appareil (navigateur) par adresse de service push (`endpoint`, unique), avec ses clés (`p256dh`, `auth`), son libellé (« Chrome · Android », d’après l’agent utilisateur), `createdAt`, `lastSuccessAt` (dernier message accepté). Partagé par les espaces (`SHARED` de `db.ts`), supprimé avec l’utilisateur.
- `registerPushSubscription(input)` (`pushSubscriptionInputSchema` : adresse https de 2 000 caractères au plus, d’un service push connu — `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `push.apple.com`, `notify.windows.com` ou un de leurs sous-domaines, sans port ni identifiants, sinon « Service de notifications inconnu. » ; revérifiée avant chaque envoi, pour que le serveur n’envoie jamais de requête à une adresse choisie par l’utilisateur — clés de 200 au plus, libellé de 120 au plus, vide : « Appareil ») : crée l’appareil ou le reprend (un appareil abonné par un autre utilisateur passe à celui-ci). `removePushSubscription(id)`, `testPushSubscription(id)` (« Tester » : une notification « Ordo — Les notifications de cet appareil fonctionnent. », sans boutons ; faux si le service push la refuse). Un appareil d’un autre utilisateur : « Appareil » introuvable.
- Un appareil que le service push dit expiré (404, 410) est supprimé ; un autre échec est journalisé (« Notification push en échec (X). »).
- Clés VAPID (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` facultatif, sinon `APP_URL` ; voir `docs/deployment.md`) : sans elles, le push est désactivé : `pushPublicKey` est null, l’abonnement et le test sont refusés (« Les notifications push ne sont pas configurées sur le serveur (clés VAPID manquantes). »), la tâche de fond ne fait rien.
- « Sonner hors de l’app » allumé : l’app demande l’autorisation des notifications et abonne cet appareil ; éteint : elle désabonne cet appareil. Le réglage est celui de l’utilisateur : éteint, plus rien n’est envoyé à **aucun** de ses appareils (les autres restent enregistrés).

### Ce qui est envoyé (`ringOutsideTheApp`, toutes les 30 secondes)

Pour chaque utilisateur qui a « Sonner hors de l’app » et au moins un appareil, dans **tous** les espaces, avec les mêmes briques que l’app (mêmes clés, instants, titres et lignes) :

- les rappels des évènements (occurrences non archivées, calendriers non archivés), des tâches ouvertes non archivées, des routines non archivées, des éphémérides non archivées et des anniversaires (personnes non archivées) ;
- les alarmes planifiées (`REMINDER`, `NOT_TRACKING`), leur heure lue à Paris, comme dans l’app ; l’occurrence est enregistrée comme sonnée (`markAlarmFired`), et une `NOT_TRACKING` pendant qu’un chrono tourne est consommée sans rien envoyer, comme dans l’app ;
- les alarmes de durée de chrono (`TRACKING_DURATION`) : le palier atteint par chaque chrono en cours non en pause (`trackingStep`, clé `<alarme>:<chrono>:<palier>`), à l’instant où il l’a été ; les paliers précédents ne sont pas rattrapés ;
- la fin des minuteurs de l’utilisateur (`endsAt` passé, `rungAt` vide), puis le minuteur est marqué sonné (`ringCountdown`).

Un élément est envoyé quand il est dû depuis **30 secondes** au moins (`PUSH_GRACE_MS`) et 6 heures au plus (`RING_LATE_MS` : au réveil du serveur, ce qui est devenu dû pendant son sommeil est rattrapé), et que sa clé n’a pas encore de sonnerie (`AlarmRing`) : il est alors enregistré (`ringOutside`, comme l’aurait fait l’app : titre, lignes, lien, sonnerie, espace) et poussé à tous les appareils de l’utilisateur. Une sonnerie (de l’app ou du serveur) non arrêtée dont la prochaine sonnerie (`nextAt`) est passée de 30 secondes est renvoyée (`ringAgainOutside`, puis poussée), et ainsi de suite jusqu’à « Arrêter » ; sans répétition dans les réglages, un seul envoi.

- Avec plusieurs espaces, la première ligne dit l’espace (« Espace « X » »). Liens : la tâche (« Projet #12 Libellé »), l’agenda (« Voir l’agenda », « Voir l’agenda de « X » » avec plusieurs espaces), les routines, le projet de l’alarme ; sinon l’accueil de l’espace.
- Un rappel de routine attend le prochain moment libre comme dans l’app (`nextAllowedMoment`) : évènements non archivés de l’espace, « Moi » de chaque utilisateur (`meContributorId`), heure de Paris ; ses sonneries sont donc par utilisateur.
- Une sonnerie refusée (un texte trop long…) est journalisée (« Sonnerie hors de l’app en échec (clé). ») sans arrêter les autres.

### Avec l’app ouverte (pas de double sonnerie)

- L’app vérifie toutes les 15 secondes : elle sonne avant la fin des 30 secondes et enregistre sa sonnerie ; le serveur voit la clé et n’envoie rien. Une répétition sonnée par l’app déplace `nextAt` : le serveur ne la renvoie pas.
- Quand un message arrive et qu’un onglet de l’app est **visible**, le service worker ne montre pas de notification : il prévient l’onglet, qui charge la sonnerie (`loadRings`) et la fait sonner lui-même (`ringPushed` : sa sonnerie, en boucle comme réglé ; un seul onglet par `claim`).
- Sinon, une notification système : titre, lignes, étiquette `ordo.alarm.<clé>` (un renvoi remplace la précédente, comme la notification de l’app), `renotify`, `requireInteraction`, vibration, boutons « Arrêter » et « Répéter dans N min » (`pushRingActions`). Un bouton appelle l’API avec le cookie de session (`stopAlarmRing`, `snoozeAlarmRing`) et les onglets ouverts suivent ; toucher la notification ouvre la page de son lien dans son espace (fenêtre de l’app existante, sinon nouvelle fenêtre `?ordo-workspace=<id>`).
- Le service push garde un message 10 minutes au plus pour un appareil injoignable (`TTL`) ; un message en attente d’une même sonnerie est remplacé par le suivant (`topic`).

### Limites

- Un seul son système par envoi (ni boucle ni sonnerie de la banque) ; la vibration et l’affichage suivent les réglages du téléphone.
- Délai : 30 secondes au moins après l’heure, plus le temps que le serveur soit éveillé (sur o2switch, Passenger l’endort sans visite ; la tâche cron l’appelle toutes les 5 minutes : voir [Tâches de fond](../cross-cutting/background-jobs.md#hébergement--garder-lapp-éveillée)).
- Pas de service worker en développement (`vite dev`) : le push s’essaie sur l’app construite.
- Dans l’app, un rappel de routine d’un autre espace que celui ouvert n’attend pas le prochain moment libre (ses évènements ne sont pas chargés) : app ouverte sur un autre espace, il sonne à son heure, et le serveur ne le renvoie pas (sa clé a déjà une sonnerie). C’est voulu.

## Minuteurs

Un **minuteur** compte à rebours une durée et sonne à sa fin. Il appartient à l’utilisateur, comme ses sonneries : modèle `Countdown` partagé par tous les espaces (`SHARED` de `db.ts`), service `apps/api/src/services/tasks/countdowns.ts`, schémas `packages/shared/src/dates/countdowns.ts`.

| Champ                     | Règle                                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `label`                   | Nom facultatif, 250 caractères (vide : « Minuteur »).                                                                                  |
| `durationSeconds`         | Durée programmée, minutes ajoutées comprises. Au lancement : de 1 minute à 24 heures (`durationSchema` : « Au moins 1 minute. », « 24 heures maximum. »). |
| `endsAt`                  | Fin tant qu’il tourne ; null : en pause. C’est l’instant que le serveur pousse hors de l’app.                                      |
| `remainingSeconds`        | Secondes restantes pendant la pause ; null : il tourne.                                                                                |
| `ringtone`                | Sonnerie de la banque ; aucune (ou inconnue) : celle des réglages.                                                                    |
| `taskId`, `routineId`, `occurrenceDate`, `subject` | Élément du temps mort pour lequel il a été lancé (tâche, ou routine et occurrence) et son nom : de simples identifiants, sans relation (le minuteur traverse les espaces). |
| `workspaceId`, `path`, `linkLabel` | Espace et page du lien de sa sonnerie (la tâche, les routines).                                                               |
| `rungAt`                  | Sa fin a sonné : il n’est plus montré ; supprimé 6 heures après (`RING_KEPT_MS`), au lancement d’un autre.                            |

- **Plusieurs à la fois** : en lancer un ne touche pas aux autres. `countdowns` : ceux qui n’ont pas sonné, la fin la plus proche d’abord, ceux en pause ensuite.
- `startCountdown(input)` (`countdownInputSchema`) ; `setCountdownPaused(id, paused)` : la pause garde les secondes restantes, la reprise repart d’elles ; demander l’état en place ne fait rien ; `extendCountdown(id, minutes)` : de 1 à 60 minutes de plus (« Au moins 1 minute. », « 60 minutes maximum. »), 24 heures restantes au plus (`COUNTDOWN_MAX_SECONDS`), en pause comme en marche ; `cancelCountdown(id)` : supprimé, il ne sonnera pas (sans effet sur un inconnu) ; « Annuler » le fait **sans confirmation** (exception justifiée à la confirmation des actions destructives, rien de durable n’est perdu, un minuteur se relance en deux gestes) ; `ringCountdown(id)` : sa fin a sonné (`rungAt`), une seule fois. Un minuteur d’un autre utilisateur est « Minuteur introuvable. ». Un minuteur déjà sonné ne change plus.
- **À sa fin**, l’app ouverte le fait sonner (`useCountdownRinger`, dans n’importe quel espace) par la sonnerie commune (`startRinging`, clé `countdown:<id>`, réclamée comme les rappels) : titre = son nom, lignes = son élément et « Minuteur de 1 h 30 terminé », lien vers son élément ; puis `ringCountdown`. La sonnerie continue comme les autres (`AlarmRing` : « Arrêter », « Répéter dans N min », répétition des réglages). Un minuteur fini pendant que l’app était fermée sonne à l’ouverture, s’il a fini depuis 6 heures au plus (`RING_LATE_MS`).
- Ce n’est **pas du temps passé** : un minuteur ne crée aucun temps (`TimeEntry`).

### Temps morts

Une tâche ou une routine a une liste de **temps morts** (`deadTimes`, JSON, liste vide par défaut) : des attentes pendant lesquelles on fait autre chose (« Lave-linge, 1 h 30 »), avec une alarme à la fin du temps estimé.

| Champ      | Règle                                                                                                     | Message                                          |
| ---------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `label`    | Requis, 250 caractères                                                                                    | « Le libellé est requis. », « 250 caractères maximum. » |
| `minutes`  | Temps estimé, entier de 1 à 1 440                                                                         | « Durée attendue. », « Au moins 1 minute. », « 24 heures maximum. » |
| `ringtone` | Sonnerie de la banque, gardée seulement quand elle est choisie ; inconnue : aucune (celle des réglages) | —                                                |

- 20 temps morts au plus (`DEAD_TIMES_MAX` : « 20 temps morts au plus. »). Lus par `readDeadTimes` (les invalides écartés).
- « Lancer » un temps mort lance un minuteur rattaché à l’élément (la tâche ; la routine et son occurrence : celle en cours, celle ouverte dans son panneau, celle de l’agenda du jour), de la durée du temps mort, modifiable au lancement, avec sa sonnerie.
- Un temps mort n’est **pas du temps passé** (aucun `TimeEntry`), ni compté dans « Temps à y consacrer ».
- Copiés par « Dupliquer » ; gardés par la transformation tâche ↔ routine. Une routine les envoie toujours en entier (`deadTimes` requis, comme `links` : un champ omis ne les efface jamais) ; une tâche : champ omis = inchangé, `null` = aucun.

## Alarmes et rappels des autres espaces

Les alarmes et les rappels des tâches, routines, évènements, éphémérides et anniversaires de **tous** les espaces de l’utilisateur sonnent quel que soit l’espace ouvert (`ElsewhereNotifier`) : ce n’est pas un choix de l’espace. Les sonneries suivent les mêmes règles, la sonnerie d’une alarme étant enregistrée dans l’espace de l’alarme ; le toast indique « Espace « X » ». Seuls les nouveaux mails restent un choix (`NOTIFICATION_SOURCES = ['MAILS']`, `packages/shared/src/core/workspace.ts` ; `apps/api/src/services/workspaces/workspaces.ts`). Voir [Espaces et accès](../cross-cutting/workspaces-and-access.md).
