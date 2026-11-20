# Paquet partagé : `dates`

Calcul et affichage des jours, mois, semaines, périodes, heures et répétitions, communs au web et à l'API. Source : `packages/shared/src/dates/`. Les règles métier qui en découlent sont décrites dans [Dates](../../business-rules/cross-cutting/dates.md).

Principe : un jour de calendrier est une chaîne `YYYY-MM-DD` (un mois `YYYY-MM`), manipulée à minuit UTC, sans fuseau. Un instant (`Date`, ISO avec heure) est affiché dans le fuseau de l'environnement (celui de l'utilisateur dans le web ; l'API utilise Paris, voir `apps/api/src/today.ts`).

## `days.ts` — jours

| Export                              | Rôle                                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DAY_MS`                            | `86 400 000` : millisecondes d'un jour (arithmétique UTC).                                                        |
| `CALENDAR_DAY`                      | Expression `^\d{4}-\d{2}(-\d{2})?$` : jour ou mois de calendrier, lu tel quel quel que soit le fuseau.            |
| `parseDay(date)`                    | `Date` à minuit UTC d'un jour.                                                                                    |
| `dayIn(instant, timeZone?)`         | Jour `YYYY-MM-DD` d'un instant dans un fuseau donné (Paris pour l'API), ou dans le fuseau local.                  |
| `localInstant(day, time = '00:00')` | Instant d'un jour et d'une heure dans le fuseau local (alarme, saisie de temps) ; inverse de `dayIn` sans fuseau. |
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

## `reminders.ts` — rappels

Les rappels des tâches, routines et évènements, un seul fonctionnement (décision D16, voir [Alarmes](../../business-rules/activities/alarms.md#rappels-des-tâches-routines-et-évènements)).

| Export                                     | Rôle                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `PARIS_ZONE`                               | `'Europe/Paris'` : fuseau des heures d'Ordo (l'API le reprend en `PARIS`).                                                                |
| `REMINDERS_MAX`                            | 10 rappels au plus par élément.                                                                                                           |
| `REMINDER_MINUTES_MAX`                     | 1 440 : un rappel « avant » 24 heures au plus.                                                                                            |
| `REMINDER_KINDS` / `ReminderKind`          | `before` (« Au début », « N min avant »), `at` (« À HH:MM le jour J »).                                                                  |
| `Reminder` (type)                          | `{ before: N, at: null }` ou `{ before: null, at: 'HH:MM' }`.                                                                            |
| `ReminderValue`, `ReminderFields` (types)  | Rappel tel que GraphQL le donne (les deux clés, l'une `null`) ou le prend (clés facultatives).                                             |
| `reminderSchema`                           | Un rappel : exactement un de `before` (0 à 1 440, « Au moins 0 minute. », « 24 heures maximum. ») et `at` (`timeOfDaySchema`), sinon « Un rappel est « N min avant » ou « à HH:MM ». » ; donne un `Reminder`. |
| `remindersSchema`                          | 10 rappels au plus (« 10 rappels maximum. »), de types mêlés : évènements et routines.                                                    |
| `taskRemindersSchema`                      | Les mêmes, « À HH:MM » seulement (« Une tâche n’a que des rappels à une heure précise. ») : tâches.                                       |
| `reminderKey(reminder)` / `reminderOfKey(key)` | Clé `before:15` / `at:08:00` (choix de l'éditeur, clés de sonnerie) et son rappel (null si ce n'en est pas une).                       |
| `normalizedReminders(reminders)`           | Sans doublons, les « avant » du plus tôt au plus tard (le plus grand nombre de minutes d'abord), puis les heures : ce qui est enregistré. |
| `readReminders(value)`                     | Rappels d'un JSON stocké ou reçu (les invalides écartés).                                                                                 |
| `parisInstant(day, time = '00:00')`        | Instant d'un jour et d'une heure de Paris (`zonedInstant`).                                                                               |
| `minutesBeforeStart(reminder, startTime)`  | Minutes d'un rappel avant le début (négatif après), pour un `VALARM` relatif.                                                             |
| `PlannedReminder` (type)                   | Rappel à sonner : `key`, `at`.                                                                                                            |
| `remindersBefore(key, moment, reminders)`  | Les « avant » d'un moment, clé `<clé>:before:<minutes>`.                                                                                 |
| `remindersAt(key, day, reminders)`         | Les « À HH:MM » d'un jour de Paris, clé `<clé>:at:<HH:MM>`.                                                                              |
| `TaskReminderDays` (type)                  | « Date min » et « Date max » d'une tâche.                                                                                                 |
| `taskRemindsOn(task, day)`                 | Vrai les jours de la « Date min » à la « Date max » (le jour de la « Date max » sans « Date min » ou avec une « Date min » après elle) ; jamais sans « Date max ». |
| `taskReminders(key, task, now)`            | « À HH:MM » d'une tâche la veille et le jour de Paris de `now`, clé `<clé>:<jour>:at:<HH:MM>`.                                           |

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
| `ordinal(value)`               | « 1er », « 2e », « 3e » (décision V).                                             |
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

Formats partagés par le web et les PDF de l'API, en `fr-FR`. Un jour ou un mois de calendrier est affiché tel quel (formateur UTC) ; un instant dans le fuseau de l'environnement.

| Export               | Rôle                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DateValue`          | `string \| number \| Date`.                                                                                          |
| `dateStyle(options)` | Fabrique un formateur qui distingue jour de calendrier et instant (un mois `YYYY-MM` est lu au 1er).                 |
| `weekdayText`        | « ven. 13 nov. » : jour à planifier, quand le jour de semaine compte (agenda, routines, accueil, PDF du calendrier). |
| `monthText`          | « novembre 2026 ».                                                                                                   |
| `longDayText(value)` | « 13 novembre 2026 », « 1er juin 2026 » (décision V) : jour dans une phrase, sans jour de semaine.                   |

## `recurrence.ts` — règle de répétition

Règle de répétition d'un événement, d'une alarme, d'un créneau ou d'un moment de routine, calculée sur les jours de calendrier à partir de la première date. Les périodes en pause et les dates exclues n'ont pas lieu et ne comptent pas dans `count`.

| Export                                           | Rôle                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RECURRENCE_FREQUENCIES` / `RecurrenceFrequency` | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`.                                                                                                                                                                                                                                                                                           |
| `DURATION_UNITS` / `DurationUnit`                | Durée de chaque occurrence depuis son premier jour : `DAYS`, `WEEKS` (jusqu'à la fin de la dernière semaine), `MONTHS` (jusqu'à la fin du dernier mois), `TO_DAY` (jusqu'à un jour du mois, éventuellement d'un mois donné), `TO_WEEK` (jusqu'à une semaine ISO), `TO_MONTH` (jusqu'à un mois) ; la suivante si elle tombe avant. |
| `Duration`                                       | `{ unit, count (1 à 366, « Au moins 1. », « 366 au plus. »), day, month, week }`.                                                                                                                                                                                                                                                 |
| `ONE_DAY`                                        | Durée d'un jour.                                                                                                                                                                                                                                                                                                                  |
| `Span`                                           | Occurrence : `{ start, end }`, bornes incluses.                                                                                                                                                                                                                                                                                   |
| `spanEnd(duration, start)`                       | Dernier jour (inclus) d'une occurrence commencée à `start`.                                                                                                                                                                                                                                                                       |
| `maxSpanDays(duration)`                          | Durée maximale en jours (`DAYS` : n, `WEEKS` : 7n, `MONTHS` : 31n, sinon 372) : jusqu'où remonter pour trouver une occurrence couvrant un jour.                                                                                                                                                                                   |
| `recurrenceSchema` / `Recurrence`                | Règle (voir tableau ci-dessous). Refus si `until` et `count` sont tous deux renseignés : « Choisissez une date de fin ou un nombre d’occurrences. ».                                                                                                                                                                              |
| `DEFAULT_RECURRENCE`                             | Toutes les semaines, le jour de semaine de la première date, sans fin.                                                                                                                                                                                                                                                            |
| `occurrenceDates(rule, start, from, to)`         | Jours d'occurrence entre `from` et `to` (inclus). La première date est toujours une occurrence (sauf exclue ou en pause). Avec `count`, le parcours part de la première date pour compter.                                                                                                                                        |
| `occurrencesBefore(rule, start, date)`           | Nombre d'occurrences avant `date` (exclue) : sert à recalculer `count` quand une série est coupée à une date.                                                                                                                                                                                                                     |
| `zonedInstant(date, time, timeZone)`             | Instant d'un jour et d'une heure locaux dans un fuseau IANA (deux passes pour les changements d'heure).                                                                                                                                                                                                                           |
| `ruleValues(rule, start)`                        | Valeurs des modes mensuel / annuel utilisées : celles choisies, sinon celles de la première date.                                                                                                                                                                                                                                 |
| `withRuleValues(rule, start)`                    | Règle avec ces valeurs explicitées.                                                                                                                                                                                                                                                                                               |

Champs de `recurrenceSchema` :

| Champ                                              | Règle                                                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frequency`                                        | Fréquence.                                                                                                                                                                                        |
| `interval`                                         | Tous les n jours / semaines / mois / ans, 1 à 999 (« Au moins 1. », « 999 maximum. »).                                                                                                            |
| `weekdays`                                         | Hebdomadaire : jours 1 à 7 ; vide : le jour de la première date.                                                                                                                                  |
| `weekParity`                                       | Hebdomadaire : `EVEN` / `ODD` (semaines ISO paires ou impaires, à la place de l'intervalle) ; `null` par défaut.                                                                                  |
| `monthlyMode`                                      | `DAY` (même numéro de jour ; le dernier jour d'un mois plus court), `WEEKDAY` (n-ième jour de semaine du mois, -1 pour le dernier), `WEEK` (annuel seulement : même jour de la même semaine ISO). |
| `monthDay`, `position`, `weekday`, `month`, `week` | Valeurs choisies de ces modes (pré-remplies depuis la première date) ; absentes : celles de la première date (règles anciennes).                                                                  |
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
