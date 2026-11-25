# Paquet partagé : `dates`

Calcul et affichage des jours, mois, semaines, périodes, heures et répétitions, communs au web et à l'API. Source : `packages/shared/src/dates/`. Les règles métier qui en découlent sont décrites dans [Dates](../../business-rules/cross-cutting/dates.md).

Principe : un jour de calendrier est une chaîne `YYYY-MM-DD` (un mois `YYYY-MM`), manipulée à minuit UTC, sans fuseau. Un instant (`Date`, ISO avec heure) est lu et affiché à l'heure de Paris (`PARIS_ZONE`), dans le web comme dans l'API, quel que soit le fuseau du navigateur ou du serveur.

## `days.ts` — jours

| Export                              | Rôle                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DAY_MS`                            | `86 400 000` : millisecondes d'un jour (arithmétique UTC).                                                        |
| `CALENDAR_DAY`                      | Expression `^\d{4}-\d{2}(-\d{2})?$` : jour ou mois de calendrier, lu tel quel quel que soit le fuseau.            |
| `PARIS_ZONE`                        | `'Europe/Paris'` : fuseau de tous les jours et heures d'Ordo (l'API le reprend en `PARIS`).                       |
| `parseDay(date)`                    | `Date` à minuit UTC d'un jour.                                                                                    |
| `dayIn(instant, timeZone?)`         | Jour `YYYY-MM-DD` d'un instant dans un fuseau (Paris par défaut).                                                 |
| `timeIn(instant, timeZone)`         | Heure `HH:MM` d'un instant dans un fuseau (l'inverse de `zonedInstant` avec `dayIn`) : report d'un rappel de routine à l'heure de Paris. |
| `parisParts(instant)`               | `{ date, time }` d'un instant à Paris (`dayIn` et `timeIn`) : moment présent des tâches faisables (API), aides du web (`lib/dates`), archive ZIP. |
| `parseOptionalDay(date)`            | `parseDay` qui conserve `null` (champ effacé) et `undefined` (inchangé).                                          |
| `formatDay(date)`                   | `YYYY-MM-DD` d'une date UTC.                                                                                      |
| `formatOptionalDay(date)`           | Miroir de `parseOptionalDay`.                                                                                     |
| `monthOfDay(day)`                   | `YYYY-MM` d'un jour.                                                                                              |
| `dayPart(value)`                    | Jour d'une date-heure ISO lue telle qu'écrite (10 premiers caractères) ; `null` conservé.                         |
| `monthOfDate(date)`                 | `YYYY-MM` d'une `Date` à minuit UTC.                                                                              |
| `monthOfYear(day)`                  | Numéro du mois (1 à 12).                                                                                          |
| `quarterOf(day)`                    | Trimestre (1 à 4).                                                                                                |
| `yearOfDay(day)`                    | Année.                                                                                                            |
| `printedDay(day)`                   | `DD/MM/YYYY`, format des documents et des emails.                                                                 |
| `addDays(date, days)`               | Ajoute des jours (négatif possible).                                                                              |
| `daysBetween(from, to)`             | Nombre de jours de `from` à `to` (négatif si avant).                                                              |
| `isoWeekday(date)`                  | Jour ISO d'une `Date` UTC : 1 (lundi) à 7 (dimanche).                                                             |
| `isoWeek(date)`                     | Numéro de semaine ISO (1 à 53 ; la semaine du 4 janvier est la première, son jeudi donne l'année).                |
| `weekdayOfDate(date)`               | Jour ISO d'un `YYYY-MM-DD`.                                                                                       |

## `times.ts` — heures et champs de jour

| Export                    | Rôle                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `TIME_OF_DAY_PATTERN`     | `HH:MM` de `00:00` à `23:59`.                                                                               |
| `DAY_PATTERN`             | Forme `YYYY-MM-DD` (sans vérifier l'existence du jour).                                                     |
| `LOCAL_DATE_TIME_PATTERN` | `YYYY-MM-DDTHH:MM` (valeur d'un champ `datetime-local`).                                                    |
| `timeOfDaySchema`         | Heure `HH:MM` (« Heure attendue (HH:MM). »).                                                                |
| `daySchema(message?)`     | Jour `YYYY-MM-DD` qui existe (pas le 31 février), via `z.iso.date` ; message par défaut « Date invalide. ». |
| `isRealDay(date)`         | Vrai si le texte est un jour existant.                                                                      |
| `startDaySchema`          | Jour requis, message « La date de début est requise. ».                                                     |
| `endDaySchema`            | Jour requis, message « La date de fin est requise. ».                                                       |
| `timeToMinutes(time)`     | Minutes depuis minuit (secondes ignorées).                                                                  |
| `minutesToTime(minutes)`  | `HH:MM` depuis des minutes.                                                                                 |

## `ringing.ts` — sonnerie

| Export | Rôle |
| --- | --- |
| `RINGTONES`, `RingtoneId`, `RINGTONE_IDS`, `isRingtone(value)`, `ringtoneLabel(id)` | La banque de sonneries générées par l'app : Carillon, Bip, Marimba, Cloche, Réveil, Harpe. |
| `RingSettings` (type), `DEFAULT_RING_SETTINGS` | Réglages de l'utilisateur : `ringMinutes` (1), `loop` (oui), `repeatMinutes` (5), `ringtone` (`carillon`), `outside` (non). |
| `RING_MINUTES_MAX` (30), `REPEAT_MINUTES_MAX` (60), `ringSettingsSchema` | Validation des réglages (« Au moins 1 minute. », « 30 minutes maximum. », « Au moins 0 minute. », « 60 minutes maximum. », « Sonnerie inconnue. »). |
| `readRingSettings(value)` | Réglages d'un JSON stocké : la valeur par défaut pour un champ absent ou invalide. |
| `SNOOZE_FALLBACK_MINUTES` (5), `snoozeMinutes(settings)` | Minutes de « Répéter dans N min » : la répétition, sinon 5. |
| `repeatedRingAt(settings, ringingSince)` | Prochaine sonnerie : début + durée + répétition ; null sans répétition. |
| `RING_LATE_MS` (6 h), `isRingDue(at, now)` | Au-delà de 6 h de retard (app fermée, serveur endormi), une alarme ou un rappel ne sonne plus ; dû et en retard de 6 h au plus. |
| `RING_KEPT_MS` (6 h), `RING_KEY_MAX`, `RING_LINES_MAX` | Durée de vie d'une sonnerie gardée par l'API ; tailles d'une clé, nombre de lignes. |
| `workspaceRingLine(label)` | « Espace « Perso » » : la ligne de l'espace d'une sonnerie (autre espace, envoi du serveur, nouveau mail). |
| `PUSH_GRACE_MS` (30 s) | Attente du serveur après l'heure (ou la répétition) avant d'envoyer en push : l'app ouverte sonne d'abord. |
| `pushSubscriptionInputSchema`, `PushSubscriptionInput`, `PUSH_LABEL_MAX` (120), `PUSH_ENDPOINT_MAX` (2 000), `PUSH_KEY_MAX` (200), `PUSH_SERVICE_HOSTS`, `isPushServiceEndpoint` | Un appareil qui s'abonne : adresse https d'un service push connu (`PUSH_SERVICE_HOSTS` ou un sous-domaine, sans port ni identifiants : « Service de notifications inconnu. » ; `isPushServiceEndpoint`, revérifié par l'API avant chaque envoi), clés `p256dh` et `auth`, libellé (vide : « Appareil »). |
| `PushPayload`, `PushAction` (types), `pushRingActions(settings)` | Message poussé (lu par `public/push-sw.js`) : clé (null pour un test), titre, lignes, page, espace, boutons ; « Arrêter », « Répéter dans N min ». |
| `alarmRingInputSchema`, `AlarmRingInput` | Une sonnerie envoyée à l'API quand elle commence (clé, espace, titre, lignes, page et libellé du lien, sonnerie, instant dû). |

## `countdowns.ts` — minuteurs et temps morts

| Export | Rôle |
| --- | --- |
| `COUNTDOWN_PRESETS` | Durées proposées pour lancer un minuteur, en minutes : 1, 3, 5, 10, 15, 30, 60. |
| `COUNTDOWN_EXTENSIONS`, `countdownExtensionSchema` | « + 1 min », « + 5 min » ; minutes ajoutées, 1 à 60 (« Au moins 1 minute. », « 60 minutes maximum. »). |
| `COUNTDOWN_MAX_SECONDS` | 24 h : temps restant le plus long. |
| `COUNTDOWN_RING_TAG`, `countdownRingKey(id)` | Clé de la sonnerie d’un minuteur : `countdown:<id>`. |
| `DeadTime` (type), `DeadTimeInput` (type), `deadTimeSchema`, `deadTimesSchema`, `DEAD_TIMES_MAX` (20) | Temps mort d’une tâche ou d’une routine : `label` (requis), `minutes` (1 à 1 440 : « Durée attendue. », « Au moins 1 minute. », « 24 heures maximum. »), `ringtone` (inconnue : aucune) ; 20 au plus (« 20 temps morts au plus. »). |
| `readDeadTimes(value)`, `storedDeadTimes(deadTimes)` | Temps morts d’un JSON stocké (`readStoredList`) ; forme stockée : la sonnerie seulement quand elle est choisie. |
| `countdownInputSchema`, `CountdownInput` | Minuteur lancé : `label` (facultatif), `seconds` (`durationSchema` : 1 min à 24 h), `ringtone`, et l’élément d’un temps mort (`taskId`, `routineId`, `occurrenceDate`, `subject`, `workspaceId`, `path`, `linkLabel`). |
| `countdownFormSchema`, `CountdownFormValues` | Formulaire « Nouveau minuteur » : `label`, `duration` (texte, `durationTextSchema`), `ringtone`. |
| `CountdownTiming` (type), `countdownRemaining(countdown, now?)` | Secondes restantes : jusqu’à `endsAt` en marche, `remainingSeconds` en pause (0 une fois fini). |
| `recordRingAgain(rang, current, now?)` | La sonnerie d’un minuteur que l’API n’a pas notée (horloge de l’appareil en avance) est à noter à nouveau : il est encore montré avec la fin à laquelle il a sonné (ni mis en pause, ni prolongé, ni sonné ou annulé ailleurs), fini depuis 6 heures au plus (`RING_LATE_MS`). |
| `COUNTDOWN_DEFAULT_NAME`, `countdownName(countdown)` | « Minuteur » ; nom d’un minuteur, le sien sinon « Minuteur » (aussi pour le serveur ; le web les réexporte). |
| `countdownRingText(countdown)` | Ce que montre la sonnerie de sa fin : son nom, son élément et « Minuteur de 1 h 30 terminé » (app et serveur). |

## `reminders.ts` — rappels

Les rappels des tâches, routines, évènements, éphémérides et anniversaires, un seul fonctionnement (voir [Alarmes](../../business-rules/activities/alarms.md#rappels-des-tâches-routines-et-évènements)).

| Export                                     | Rôle                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `REMINDERS_MAX`                            | 10 rappels au plus par élément.                                                                                                           |
| `REMINDER_MINUTES_MAX`                     | 1 440 : un rappel « avant » 24 heures au plus.                                                                                            |
| `REMINDER_DAYS_MAX`                        | 30 : un rappel « N jours avant, à HH:MM » 30 jours au plus.                                                                 |
| `REMINDER_KINDS` / `ReminderKind`          | `before` (« Au début », « N min avant »), `at` (« À HH:MM le jour J »), `days` (« N jours avant, à HH:MM »).                              |
| `DAY_REMINDER_KINDS`                      | `at` et `days` : les genres d’un élément sans heure (tâche, anniversaire, routine sans aucune heure), passés à `RemindersSelect`. |
| `Reminder` (type)                          | `{ before: N, at: null, days: null }` ou `{ before: null, at: 'HH:MM', days: N \| null }`, avec `ReminderOptions` : `anchor?` (`end`, `openEnd`, `dueStart`), `ringtone?` (sonnerie de la banque). |
| `REMINDER_ANCHORS` / `ReminderAnchor`      | `start` (défaut, rien d'enregistré), `end`, `openEnd`, `dueStart`. `EVENT_REMINDER_ANCHORS` : `start`, `end` ; `ROUTINE_REMINDER_ANCHORS` : `start` (début de l'ouverture), `openEnd`, `dueStart`, `end` (fin de l'échéance). Un rappel à une heure ne garde que le jour : `openEnd` → `start`, `dueStart` → `end`. |
| `reminderAnchorOf(reminder)`               | Le repère d'un rappel (`start` sans repère ; un rappel à une heure : `start` ou `end`).                                                  |
| `ReminderValue`, `ReminderFields` (types)  | Rappel tel que GraphQL le donne (`before` et `at`, l'un `null` ; `days` avec `at` ; `anchor`, `ringtone`) ou le prend (clés facultatives). |
| `ReminderOutput` (type), `readReminderOutputs(value)` | Rappels tels que GraphQL les donne, chaque champ rempli (`anchor` `start` / `end`, `ringtone` ou null) : un élément dessiné dans le cache avant la réponse de l'API. |
| `reminderSchema`                           | Un rappel : exactement un de `before` (0 à 1 440, « Au moins 0 minute. », « 24 heures maximum. ») et `at` (`timeOfDaySchema`), sinon « Un rappel est « N min avant », « à HH:MM » ou « N jours avant, à HH:MM ». » ; `days` (1 à 30, « Au moins 1 jour. », « 30 jours maximum. ») seulement avec `at` (« Un rappel « N jours avant » a une heure (HH:MM). ») ; `anchor` `start` / `end` (« Un rappel compte depuis le début ou la fin. »), `ringtone` (inconnue : retirée sans erreur) ; donne un `Reminder` (`anchor` et `ringtone` seulement quand donnés). |
| `remindersSchema`                          | 10 rappels au plus (« 10 rappels maximum. »), de types mêlés, depuis les quatre repères : routines. `eventRemindersSchema` : les mêmes sans `openEnd` ni `dueStart` (« Seules les routines ont des rappels depuis la fin de l’ouverture ou le début de l’échéance. ») : évènements. |
| `startRemindersSchema`                     | Les mêmes depuis le début seulement (« Seuls les évènements et les routines ont des rappels avant la fin. ») : éphémérides ; base des deux suivants. |
| `taskRemindersSchema`                      | Les mêmes, à une heure seulement (« À HH:MM », « N jours avant ») (« Une tâche n’a que des rappels à une heure précise. ») : tâches.      |
| `birthdayRemindersSchema`                  | Les mêmes pour un anniversaire (« Un anniversaire n’a que des rappels à une heure précise. »).                                           |
| `reminderKindOf(reminder)`                 | Sorte d'un rappel (`before`, `at`, `days`).                                                                                               |
| `reminderKey(reminder)` / `reminderOfKey(key)` | Clé `before:15` / `at:08:00` / `days:3:08:00`, le repère devant quand ce n'est pas le début (`end:before:15`, `openEnd:before:30`) (clés de sonnerie, de l'éditeur) et son rappel (null si ce n'en est pas une). |
| `normalizedReminders(reminders)`           | Sans doublons (le dernier gardé, avec sa sonnerie), par repère (début de l'ouverture, fin de l'ouverture, début de l'échéance, fin), chacun dans l'ordre où ils sonnent : les « jours avant » (le plus de jours d'abord, puis par heure), les « avant » (le plus grand nombre de minutes d'abord), puis les heures du jour : ce qui est enregistré. |
| `readReminders(value)`                     | Rappels d'un JSON stocké ou reçu (les invalides écartés).                                                                                 |
| `parisInstant(day, time = '00:00')`        | Instant d'un jour et d'une heure de Paris (`zonedInstant`).                                                                               |
| `minutesBeforeMoment(reminder, time)`      | Minutes d'un rappel avant un moment d'un jour, son début ou sa fin (`HH:MM`, ou minutes depuis minuit : 1 440 pour la fin d'une journée entière ; négatif après ; un « N jours avant » compte ses jours), pour un `VALARM` relatif. |
| `PlannedReminder` (type)                   | Rappel à sonner : `key`, `at`, `ringtone?`.                                                                                               |
| `remindersBefore(key, moment, reminders, anchor = 'start')` | Les « avant » d'un moment comptés depuis ce repère, clé `<clé>:before:<minutes>` (`<clé>:end:before:<minutes>` depuis la fin). |
| `remindersAt(key, day, reminders, onDay = true, anchor = 'start')` | Les « À HH:MM » d'un jour de Paris (clé `<clé>:at:<HH:MM>`) et les « N jours avant » de ce jour (clé `<clé>:days:<N>:<HH:MM>`) comptés depuis ce repère (le premier jour, ou le dernier depuis la fin) ; `onDay` faux : ces derniers seulement. |
| `OccurrenceEnd` (type), `occurrenceReminders(key, day, start, reminders, end?)` | Tous les rappels d'une occurrence (évènement, suite de jours d'une éphéméride) : « avant » son début, « À HH:MM » et « N jours avant » son premier jour ; avec `end` (`day` : dernier jour, `at` : fin), les mêmes depuis la fin (évènements). |
| `REMINDER_LOOKAHEAD_DAYS`                  | 31 : jours à regarder devant pour les « N jours avant » (occurrences, éphémérides, anniversaires chargés).                                |
| `reminderDayRange(now, ahead?)`            | Jours dont les rappels peuvent sonner : d'hier (Paris) à `ahead` jours (défaut `REMINDER_LOOKAHEAD_DAYS`).                               |
| `reminderDaysAhead(reminders)`             | Le plus de jours d'un « N jours avant » parmi des rappels (0 sans).                                                                       |
| `TaskReminderDays` (type)                  | « Ouverture » et « Échéance » d'une tâche.                                                                                                 |
| `taskRemindsOn(task, day)`                 | Vrai les jours de l’ouverture à l’échéance (le jour de l’échéance sans ouverture ou avec une ouverture après elle) ; jamais sans échéance. |
| `taskReminders(key, task, now)`            | « À HH:MM » d'une tâche la veille et le jour de Paris de `now` (clé `<clé>:<jour>:at:<HH:MM>`) et ses « N jours avant » son échéance, une fois (clé `<clé>:<échéance>:days:<N>:<HH:MM>`). |

## `reminder-rings.ts` — ce qui sonne et ses textes

Ce que l'app ouverte (`ringPlannedReminders`, `dueAlarms`) et le serveur qui sonne hors de l'app (`services/tasks/outside-rings.ts`) calculent de la même façon : mêmes clés (une sonnerie par clé : jamais deux fois), instants, titres et lignes. Garde eslint du web : `occurrenceReminders`, `taskReminders`, `remindersAt`, `remindersBefore` appelés à la main renvoient ici.

| Export | Rôle |
| --- | --- |
| `RingText`, `PlannedRing`, `RingPage` (types) | Titre et lignes ; un rappel planifié (`PlannedReminder` + texte) ; un lien (`label`, `path`). |
| `calendarRingPage(espace?)`, `routinesRingPage(espace?)`, `workspaceRingPage(espace)` | « Voir l’agenda » (« … de « X » » pour un autre espace), « Voir les routines », « Ouvrir « X » ». |
| `RemindedOccurrence`, `eventRings(occurrences)` | Rappels des occurrences d’évènements (non annulées ; journée entière : minuit de Paris, fin à minuit après le dernier jour) ; ligne « ven. 13 nov., 14:05 · lieu » (heure de Paris de son début) ou « Journée entière · lieu ». |
| `RemindedTask`, `taskRings(tasks, now)` | Rappels des tâches ouvertes non archivées (`taskReminders`) ; ligne « Échéance : 13 nov. 2026 ». |
| `RemindedRoutine`, `RemindedRoutineOccurrence`, `RemindedRoutineSlot`, `RoutineRing`, `routineRings(routines, defer?)` | Rappels des routines non archivées (avec leur temps estimé, `estimate`), par occurrence donnée par l’API et moment non coché (avec ses heures), depuis les quatre repères (`routineSlotAnchors`), reportés par `defer` (`nextAllowedMoment` dans l'app et sur le serveur) ; ligne fenêtre (`windowText`) · lieu ; avec le moment et si l’occurrence est celle en cours. |
| `routineSlotAnchors(occurrence, slot, minutes)` | Instants des quatre repères d'un moment d'une occurrence : son début et sa fin (`routineSlotSpan` avec le temps estimé de la routine, 30 min sans lui) le jour de l'ouverture et celui de l'échéance (`dueDate` de l'occurrence quand elle est gardée à part, sinon `date`), heure de Paris (fin absente : minuit après le jour) ; null pour un moment sans aucune heure (pas de rappel « avant »). |
| `routineRingPrefix(routineId, date)`, `routineRingOf(key)` | Début de clé des rappels d'une occurrence de routine (`routine:<id>\|<échéance>`) ; routine, échéance et moment (null : « À HH:MM ») d'une clé de sonnerie : les actions d'une sonnerie remontrée. |
| `RemindedSchedule`, `ephemerisRings(schedules, ruleOf, now)` | Rappels des éphémérides non archivées par suite de jours (`scheduleRuns`) ; ligne jour (· heure). |
| `RemindedBirthday`, `birthdayRings(birthdays, now)` | Rappels des anniversaires d’hier à J+31 ; titre `birthdayLabel`, ligne le jour. |
| `birthdayRingPrefix(birthdayId, date?)`, `birthdayRingOf(key, birthdays)` | Début de clé des rappels d'un anniversaire (`birthday:<contributor\|relation>:<id>:<jour>`) ; l'anniversaire d'une clé de sonnerie (« Ouvrir la fiche » d'une sonnerie remontrée). |
| `DueAlarmFields`, `dueAlarmOccurrence(alarm, now)`, `alarmRingKey(id, occurrence)` | Occurrence d’une alarme planifiée due (après `lastFiredAt`, 6 h au plus ; heure de Paris pour l'app et le serveur) ; sa clé `<alarme>:<instant>`. |
| `trackingStep(minutes, entry, now)`, `trackingRingKey(alarme, chrono, palier)` | Palier d’un chrono en cours pour une alarme de durée ; clé `<alarme>:<chrono>:<palier>`. |
| `timerCountsForAlarm(alarm, timer, projects)` | Un chrono en cours compte-t-il pour une alarme de durée : celle d’une tâche compte les chronos de cette tâche, celle d’un projet (sans tâche) ceux de ce projet et de ses sous-projets (`subtreeOf` sur `projects`, chaque projet avec son parent), une alarme sans tâche ni projet tous les chronos. |
| `alarmTaskLabel(task, projectLabel?)`, `AlarmTarget`, `alarmTarget(alarm, taskOf, projectOf)` | « Projet #12 Libellé » ; lien d’une alarme : sa tâche, sinon son projet (aussi pour le serveur). |
| `alarmRingText(alarm)` | Titre (libellé) et ligne (note) de la sonnerie d’une alarme. |

## `weeks.ts` — semaine de l'espace

La semaine est un réglage de l'espace (`weekStart`, `weekEnd`) : du lundi au dimanche par défaut. Le même jour deux fois (mercredi à mercredi) donne des semaines de 8 jours qui se chevauchent sur ce jour ; un intervalle plus court (lundi à vendredi) laisse des jours hors de toute semaine.

| Export                             | Rôle                                                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `weekSpanSchema` / `WeekSpan`      | `{ start, end }`, jours ISO 1 à 7.                                                                                                                                                    |
| `DEFAULT_WEEK`                     | `{ start: 1, end: 7 }`.                                                                                                                                                               |
| `WEEKDAY_LABELS`                   | « lundi » … « dimanche ».                                                                                                                                                             |
| `WEEKDAY_SHORT_LABELS`             | « lun. », « mar. »…                                                                                                                                                                   |
| `weekdayOptions`                   | Options `{ value: '1'…'7', label }` d'un choix de jour (répétitions, routines).                                                                                                       |
| `weekLength(week)`                 | Nombre de jours de la semaine (8 d'un jour au même jour).                                                                                                                             |
| `weekStartOf(date, week?, shift?)` | Premier jour de la semaine contenant `date` (dernier début à ou avant elle ; avec chevauchement, le jour partagé appartient à la semaine qu'il commence), décalé de `shift` semaines. |
| `weekRange(date, week?, shift?)`   | `[premier jour, lendemain du dernier jour]`.                                                                                                                                          |
| `readWeek(workspace)`              | Semaine d'un espace depuis `weekStart` / `weekEnd` ; valeurs invalides : lundi à dimanche.                                                                                            |

## `months.ts` — mois

| Export                         | Rôle                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `MONTH_LABELS`                 | « janvier » … « décembre ».                                                       |
| `monthOptions`                 | Options `{ value: '1'…'12', label }`.                                             |
| `ofMonth(month)`               | « d’avril », « de mai ».                                                          |
| `lastDayWords(month)`          | « dernier jour du mois » (`null`), « dernier jour de février », « dernier jour d’avril » (sans article) : textes des règles, durées et « Ouverture » le dernier jour. |
| `ordinal(value)`               | « 1er », « 2e », « 3e » : la seule écriture des ordinaux.                                   |
| `dayOfMonthText(day)`          | « 1er » pour le 1, le nombre sinon.                                               |
| `dayOfMonthOf(day)`            | Jour du mois (1 à 31).                                                            |
| `POSITION_LABELS`              | Position d'un jour dans le mois : « 1er » à « 4e », `-1` « dernier ».             |
| `positionOptions`              | Options de position (1, 2, 3, 4, puis -1).                                        |
| `daysInMonth(year, month)`     | Nombre de jours du mois.                                                          |
| `dayInMonth(year, month, day)` | Jour borné au mois (le 31 d'un mois de 30 jours devient le 30, 0 devient le 1er). |
| `lastDayOfMonth(date)`         | Dernier jour du mois d'un jour ou d'un `YYYY-MM`.                                 |
| `monthIndex(date)`             | Numéro de mois compté depuis l'an 0 (pour compter ou décaler des mois).           |
| `monthFromIndex(index)`        | `YYYY-MM` d'un numéro de mois.                                                    |
| `shiftMonth(date, months)`     | Premier jour du mois décalé de `months`.                                          |

## `periods.ts` — périodes calendaires

| Export                               | Rôle                                                        |
| ------------------------------------ | ----------------------------------------------------------- |
| `CALENDAR_SCALES` / `CalendarScale`  | `month`, `quarter`, `year`.                                 |
| `SCALE_LABELS`                       | « Jour », « Semaine », « Mois », « Trimestre », « Année ».  |
| `CALENDAR_SCALE_OPTIONS`             | Options des trois échelles (`SegmentedControl`).            |
| `calendarStart(scale, day)`          | Premier jour du mois, du trimestre ou de l'année d'un jour. |
| `shiftCalendar(scale, start, delta)` | Premier jour de la période décalée de `delta`.              |
| `calendarEnd(scale, start)`          | Dernier jour de la période commençant à `start`.            |

## `format.ts` — affichage des dates

Formats partagés par le web et les PDF de l'API, en `fr-FR`. Un jour ou un mois de calendrier est affiché tel quel (formateur UTC) ; un instant à l'heure de Paris, quel que soit le fuseau du navigateur ou du serveur.

| Export               | Rôle                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DateValue`          | `string \| number \| Date`.                                                                                          |
| `dayText`            | « 13 nov. 2026 » : une date dans un tableau, une liste, un texte (le `fmt.day` du web, les sonneries poussées). |
| `dateStyle(options)` | Fabrique un formateur qui distingue jour de calendrier et instant (un mois `YYYY-MM` est lu au 1er).                 |
| `weekdayText`        | « ven. 13 nov. » : jour à planifier, quand le jour de semaine compte (agenda, routines, accueil, PDF du calendrier). |
| `monthText`          | « novembre 2026 ».                                                                                                   |
| `longDayText(value)` | « 13 novembre 2026 », « 1er juin 2026 » : jour dans une phrase, sans jour de semaine.                   |

## `recurrence.ts` — règle de répétition

Règle de répétition d'un événement, d'une alarme, d'un créneau ou d'un moment de routine, calculée sur les jours de calendrier à partir de la première date. Les périodes en pause et les dates exclues n'ont pas lieu et ne comptent pas dans `count`.

| Export                                           | Rôle                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RECURRENCE_FREQUENCIES` / `RecurrenceFrequency` | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`.                                                                                                                                                                                                                                                                                           |
| `DURATION_UNITS` / `DurationUnit`                | Durée de chaque occurrence depuis son premier jour : `DAYS`, `WEEKS` (jusqu'à la fin de la dernière semaine), `MONTHS` (jusqu'à la fin du dernier mois, celui du premier jour pour 1 mois), `TO_DAY` (jusqu'à un jour du mois, éventuellement d'un mois donné ; `day` -1, `LAST_DAY` : son dernier jour, calculé comme le 31), `TO_WEEK` (jusqu'à une semaine ISO), `TO_MONTH` (jusqu'à un mois) ; la suivante si elle tombe avant. |
| `Duration`                                       | `{ unit, count (1 à 366, « Au moins 1. », « 366 au plus. »), day, month, week }`.                                                                                                                                                                                                                                                 |
| `ONE_DAY`                                        | Durée d'un jour.                                                                                                                                                                                                                                                                                                                  |
| `Span`                                           | Occurrence : `{ start, end }`, bornes incluses.                                                                                                                                                                                                                                                                                   |
| `spanEnd(duration, start)`                       | Dernier jour (inclus) d'une occurrence commencée à `start`.                                                                                                                                                                                                                                                                       |
| `maxSpanDays(duration)`                          | Durée maximale en jours (`DAYS` : n, `WEEKS` : 7n, `MONTHS` : 31n, sinon 372) : jusqu'où remonter pour trouver une occurrence couvrant un jour.                                                                                                                                                                                   |
| `recurrenceSchema` / `Recurrence`                | Règle (voir tableau ci-dessous). Refus si `until` et `count` sont tous deux renseignés : « Choisissez une date de fin ou un nombre d’occurrences. ».                                                                                                                                                                              |
| `storedRecurrence(value)` | Règle enregistrée en JSON validée par `recurrenceSchema`, `null` sans règle ou si elle est invalide (évènements, routines, alarmes, trésorerie, factures récurrentes). |
| `DEFAULT_RECURRENCE`                             | Toutes les semaines, le jour de semaine de la première date, sans fin.                                                                                                                                                                                                                                                            |
| `DAILY_RECURRENCE`                               | Tous les jours : la règle d'une nouvelle routine (web `DAILY`) et d'une tâche transformée en routine.
| `occurrenceDates(rule, start, from, to)`         | Jours d'occurrence entre `from` et `to` (inclus). La première date est toujours une occurrence (sauf exclue ou en pause). Avec `count`, le parcours part de la première date pour compter.                                                                                                                                        |
| `ruleCountsFromDay(rule)` | Les occurrences d'une règle dépendent-elles du jour d'où elle compte : tous les n jours / semaines / mois / ans (n > 1, hors semaines paires ou impaires) ou un nombre d'occurrences. Sert aux horaires d'une tâche (`hoursCaseNeedsStart`). |
| `occurrencesBefore(rule, start, date)`           | Nombre d'occurrences avant `date` (exclue) : sert à recalculer `count` quand une série est coupée à une date.                                                                                                                                                                                                                     |
| `zonedInstant(date, time, timeZone)`             | Instant d'un jour et d'une heure locaux dans un fuseau IANA (deux passes pour les changements d'heure).                                                                                                                                                                                                                           |
| `ruleValues(rule, start)`                        | Valeurs des modes mensuel / annuel utilisées : celles choisies, sinon celles de la première date.                                                                                                                                                                                                                                 |
| `withRuleValues(rule, start)`                    | Règle avec ces valeurs explicitées.                                                                                                                                                                                                                                                                                               |
| `ruleMovedTo(rule, to)`                          | Règle dont les valeurs mensuelles et annuelles sont celles d’un autre jour (jour du mois, jour de semaine, rang, mois, semaine). Refuse une règle le dernier jour du mois (`UserError` `LAST_DAY_MOVE_REFUSAL`) : sa nouvelle règle est choisie par l’utilisateur, jamais décidée ici. |
| `LAST_DAY`                                       | Numéro de jour d’une règle mensuelle ou annuelle le dernier jour du mois (`-1` : le 31, 30, 29 ou 28 ; en annuelle, celui de son mois). |
| `monthDaySchema`                                 | Jour du mois d’une règle, d’une durée « Jusqu’au jour » ou d’une « Ouverture » `DAY` : 1 à 31, ou -1 (`LAST_DAY`). |
| `isLastDayRule(rule)`                            | Règle mensuelle ou annuelle en mode `DAY` sur `LAST_DAY`. |
| `LAST_DAY_MOVE_REFUSAL`                          | « Cette répétition tombe le dernier jour du mois : choisissez sa nouvelle règle pour la déplacer. » |
| `lastDayStandIn(rule)`                           | La même règle sur le 31 au lieu du dernier jour (mêmes occurrences : un jour manquant tombe le dernier du mois), pour la décaler comme une autre et en tirer la règle proposée ; inchangée sinon. |
| `proposedMovedRule(moved, to)`                   | Règle proposée pour une règle le dernier jour du mois déplacée : `moved` (fin, dates supprimées, pauses, nombre d’occurrences déjà décalés) sur les valeurs du jour `to` où va l’occurrence (interne `valuesOfDay`) ; le dernier jour du mois quand `to` est le dernier de son mois. |
| `RuleChoiceRequired`                             | `UserError` d’un déplacement d’une règle le dernier jour du mois sans sa nouvelle règle : `proposal` (la règle proposée) et `start` (le jour d’où la montrer). L’API la rend en `RULE_CHOICE_REQUIRED` (`sharedRefusal`) ; le web la demande (`withMovedRuleChoice`). |
| `shiftedDates(rule, days)`                       | Règle dont la date de fin, les dates supprimées et les pauses sont décalées de `days` jours. Sert à `shiftedRulePieces` (interne `shiftedRecurrence`) et aux routines (`shiftedRoutineRule`, `shiftedPieces`).                                                                                                                    |
| `shiftedRulePieces(rule, first, days, anchor, chosen?, to?)` | Règle déplacée avec toute sa série de `days` jours, pour tomber encore sur ses jours (interne `shiftedRecurrence`) : fin, dates supprimées et pauses décalées (`shiftedDates`), jours de la semaine tournés (des jours qui passent à une autre semaine emmènent leurs semaines : semaines paires et impaires échangées pour un nombre impair de semaines, rythme toutes les n semaines suivant), valeurs mensuelles et annuelles de sa première occurrence (`first`, aussi le jour d’une règle hebdomadaire sans jours) décalée ; en un ou deux morceaux (`RulePiece` : `rule`, `anchor`, le jour d’où compte son rythme, `null` : l’ancien décalé). Hebdomadaire avec ses semaines comptées, les jours qui changent de semaine et ceux qui n’en changent pas font chacun un morceau sur ses propres semaines (`movedWeekdays`) ; coupée ainsi, un nombre d’occurrences devient la date de la dernière, décalée, pour garder les mêmes occurrences. Sert aux créneaux (`shiftedCases`) et aux séries d’évènements (`shiftedSeries`, `cutSeries`). Le dernier jour du mois décalé : la règle choisie (`chosen`, un morceau) ; sans elle, refus `RuleChoiceRequired` avec la règle proposée pour le jour `to` (défaut : la première occurrence, ou l’ancre, décalée). |
| `movedWeekdays(rule, anchor, weekdays, days)`    | Règle hebdomadaire réduite à certains de ses jours, qui changent tous du même nombre de semaines, décalés de `days` jours : jours tournés, semaines paires / impaires échangées pour un nombre impair de semaines, et jour d’où compte son rythme (`anchor` ; `null` : non cherché) : le premier de ces jours sur son rythme, décalé, pour que toutes les n semaines suive. Sert à `shiftedRulePieces`, au déplacement d’un horaire (`movedCase`) et à celui d’une occurrence de routine. |
| `crossedWeeks(weekday, days)` / `weeksChange(rule, weeks)` | Semaines dont un jour de la semaine change décalé de `days` jours ; une règle hebdomadaire déplacée d’autant de semaines compte-t-elle ses semaines autrement (nombre impair pour les semaines paires / impaires, pas un multiple de n pour toutes les n semaines). |
| `shiftedSeries(rule, start, days, chosen?, to?)` | Séries (`MovedSeries` : `rule`, `start`, son premier jour) que devient une série d’évènements commençant à `start` décalée de `days` jours (`shiftedRulePieces`, sa première occurrence cherchée sur 400 jours) : une, depuis son premier jour décalé, ou, quand seuls certains jours d’une série toutes les n semaines ou des semaines paires / impaires changent de semaine, une par groupe de jours, depuis sa première occurrence décalée, rangées par premier jour ; un groupe qui n’a plus aucune occurrence (son premier jour après la fin de la série ; ses jours seulement supprimés ou en pause comptent encore, ils peuvent être rendus) ne fait aucune série (une au moins reste). Dans l’API et dans le panneau. Le dernier jour du mois : la règle choisie (`chosen`, depuis `start` décalé) ; sans elle, refus avec la règle proposée sur `to`, le jour où va l’occurrence déplacée (défaut : la première décalée). |
| `cutSeries(rule, before, seriesStart, date, days, chosen?)` | Séries de la suite d’une coupure (« Celle-ci et les suivantes ») : comme `shiftedSeries` depuis l’occurrence ; un nombre d’occurrences laissé tel que la série l’avait est diminué de celles avant la coupure (au moins 1). Dans l’API (`updateCalendarEvent`) et dans le panneau (règle reprise après l’enregistrement). Le dernier jour du mois : la règle choisie telle quelle (son nombre d’occurrences déjà diminué dans la règle proposée). |
| `seriesOn(series, day)`                          | Série, parmi des `MovedSeries`, qui tient un jour (celle de son jour de la semaine ; la première sinon) : celle de l’occurrence modifiée, que l’évènement garde (API) et que le panneau continue. |
| `seriesHolding(series, day, span?)`              | Série, parmi des `MovedSeries`, qui a une occurrence commençant ce jour (ou dans les `span` jours avant : une occurrence qui dure) ; aucune quand aucune ne l’a (une occurrence perdue par le décalage : ses liens de routines partent avec elle, comme ses commentaires). Utilisée par l’API pour la série où va ce que garde une occurrence (`followSeries`). |

Champs de `recurrenceSchema` :

| Champ                                              | Règle                                                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frequency`                                        | Fréquence.                                                                                                                                                                                        |
| `interval`                                         | Tous les n jours / semaines / mois / ans, 1 à 999 (« Au moins 1. », « 999 maximum. »).                                                                                                            |
| `weekdays`                                         | Hebdomadaire : jours 1 à 7 ; vide : le jour de la première date.                                                                                                                                  |
| `weekParity`                                       | Hebdomadaire : `EVEN` / `ODD` (semaines ISO paires ou impaires, à la place de l'intervalle) ; `null` par défaut.                                                                                  |
| `monthlyMode`                                      | `DAY` (même numéro de jour ; le dernier jour d'un mois plus court), `WEEKDAY` (n-ième jour de semaine du mois, -1 pour le dernier), `WEEK` (annuel seulement : même jour de la même semaine ISO). |
| `monthDay`, `position`, `weekday`, `month`, `week` | Valeurs choisies de ces modes (pré-remplies depuis la première date) ; absentes : celles de la première date (règles anciennes). `monthDay` : 1 à 31 (un jour manquant tombe le dernier du mois), ou `-1` (`LAST_DAY`) le dernier jour du mois.                                                                  |
| `until`                                            | Dernière date incluse.                                                                                                                                                                            |
| `count`                                            | Nombre d'occurrences, 1 à 9999 (« 9 999 maximum. »).                                                                                                                                              |
| `exceptions`                                       | Dates supprimées une à une (5000 max).                                                                                                                                                            |
| `duration`                                         | Durée de chaque occurrence (absente : un jour, ou la durée de l'événement).                                                                                                                       |
| `pauses`                                           | Périodes en pause `{ from, to }` incluses, fin après début, 100 max.                                                                                                                              |

Internes : `endOfIsoWeek`, `weekOfYear`, `weekdayPosition` (position 1 à 4 ou -1 si dernier du mois), `dayOfMonthMatches`, `matches` (motif sans fin, exceptions ni pauses ; l'annuel `WEEK` compte en années ISO), `zoneOffset`.

## `repetition.ts` — répétition par cas

Une répétition peut être faite de plusieurs « cas », chacun avec sa période, sa règle et ses horaires (événement, horaires d'un créneau, moments d'une routine, heure d'une alarme).

| Export                                             | Rôle                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `repetitionCaseSchema(times)`                      | Schéma d'un cas : `since`, `until` (période d'application, fin après début), `anchor` (jour de départ du rythme quand ce n'est pas le premier jour : cas convertis d'une ancienne forme), `rule` (`null` : une seule occurrence le premier jour), `times` (schéma fourni). |
| `RepetitionCase<T>`                                | Type d'un cas.                                                                                                                                                                                                                                                             |
| `caseSpans(item, start, from, to)`                 | Occurrences d'un cas qui chevauchent une période, bornées à la période du cas ; une occurrence couvrant `from` peut avoir commencé avant. Rythme compté depuis `anchor`, sinon `since`, sinon `start`.                                                                     |
| `caseSpanOn(item, start, date)`                    | Occurrence couvrant un jour, ou `null`.                                                                                                                                                                                                                                    |
