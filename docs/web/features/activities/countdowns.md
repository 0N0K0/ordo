# Code web des minuteurs et des temps morts

Tous les fichiers de `apps/web/src/features/countdowns/` (lot 17b, décision FT) : les minuteurs de l’utilisateur (comptes à rebours, dans tous ses espaces) et les temps morts des tâches et des routines. Fonctionnalités : [Alarmes](../../../features/activities/alarms.md#minuteurs). Règles : [Règles des alarmes](../../../business-rules/activities/alarms.md#minuteurs-décision-ft). Partagé : `packages/shared/src/dates/countdowns.ts` ([Dates](../../../shared/cross-cutting/dates.md)).

## api

### `api/index.ts`

Fragments `DeadTimeFields` (`label`, `minutes`, `ringtone` : repris par les fragments des tâches et des routines) et `CountdownFields` ; requête `Countdowns` ; mutations `StartCountdown`, `SetCountdownPaused`, `ExtendCountdown`, `RingCountdown`, `CancelCountdown`.

| Export                         | Rôle                                                                                                                         | Utilisé par                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `Countdown`, `DeadTimeOutput`, `CountdownInput` (types) | Un minuteur ; un temps mort tel que l’API le donne ; un minuteur lancé                              | ici, `features/tasks`, `features/routines`     |
| `countdownsQueryKey`           | Clé `['countdowns']` (les minuteurs de l’utilisateur, les mêmes dans tous les espaces)                                       | ici                                            |
| `useCountdowns()`              | Minuteurs pas encore sonnés, la fin la plus proche d’abord ; relus chaque minute et au retour du focus                        | `CountdownList`, `CountdownWidget`, `DeadTimesField`, `useCountdownRinger` |
| `sendCountdownRung(id)`        | La fin d’un minuteur a sonné (`ringCountdown`)                                                                                 | `useCountdownRinger`                           |
| `useCountdownMutations()`      | `{ start, setPaused({ id, paused }), extend({ id, minutes }), cancel(id) }`, qui relisent les minuteurs                        | `CountdownForm`, `CountdownControls`           |

Interne : `useCountdownMutation`.

## components

### `components/CountdownForm.tsx`

- `CountdownForm({ item?, deadTimes?, deadTime?, onDone })` : « Nouveau minuteur » / « Lancer un temps mort » (`countdownFormSchema`) : « Temps mort » (choix parmi ceux de l’élément, s’il en a plusieurs), « Nom » (« Minuteur » par défaut), « Durée » (`parseDuration`), durées proposées (`COUNTDOWN_PRESETS`, `Chip`), « Sonnerie » (`RingtoneSelect`), « Lancer » ; toast « Minuteur lancé : 10 min. ». Lancé pour un élément, le minuteur garde l’élément, son nom, son lien et l’espace ouvert.
- `CountdownFormProps` (type). Interne : `valuesOf(deadTime)`.

### `components/CountdownRow.tsx`

- `CountdownControls({ countdown, size? })` : « Pause » / « Reprendre », « + 1 min », « + 5 min » (`COUNTDOWN_EXTENSIONS`), « Annuler » (`RemoveButton` `variant="field"`, sans confirmation : rien de durable n’est perdu, décision FV ; `toastCallbacks` « Minuteur annulé. »).
- `CountdownRow({ countdown, withSubject? })` : nom, élément, temps restant en direct (`countdownRemaining`, `useNow`), barre de progression, `CountdownControls`.

### `components/CountdownList.tsx`

- `CountdownList({ compact?, bare? })` : les minuteurs (`CountdownRow`), « Aucun minuteur en cours. » (pas en `compact` ni `bare`), « Lancer un minuteur » (`openCountdownForm`, le formulaire de « Ajouter › Minuteur » ; petit en `compact`). Utilisé par la page « Alarmes », la bulle de `CountdownWidget` (`compact`) et la carte « Chrono et alarmes » de l’accueil (`bare`, décision FV).

### `components/CountdownWidget.tsx`

- `CountdownWidget()` : pastille `RunningPill` (`tone="countdown"`) de l’en-tête : nom du premier à sonner ou « 2 minuteurs », temps restant ; bulle : `CountdownList`. Rien sans minuteur. Monté par `app/layout/AppLayout.tsx`.

### `components/DeadTimesField.tsx`

- `DeadTimesField({ value, onChange, item, disabled? })` : champ « Temps morts » d’une tâche (`TaskPanel`) ou d’une routine (`RoutineForm`) : une ligne par temps mort (libellé, durée tapée `durationText` / `parseDuration`, `RingtoneSelect`, « Lancer », « Retirer »), « Ajouter un temps mort » (`DEAD_TIMES_MAX`) ; les lignes valides sont enregistrées en quittant leurs champs (`onChange`, décision D22) ; une ligne quittée invalide (son erreur dessous) retient l’enregistrement jusqu’à être corrigée ou retirée, une nouvelle ligne pas encore quittée reste à part ; un enregistrement d’ailleurs remplace les lignes enregistrées. Les minuteurs lancés pour l’élément (`countdownOf`) dessous.
- Internes : `DeadTimeRow`, `rowOf`, `deadTimeOf`, `LABEL_REQUIRED`.

### `components/DeadTimeLaunchButtons.tsx`

- `DeadTimeLaunchButtons({ value, item })` : un bouton « Lancer « Lave-linge (1 h 30) » » par temps mort, là où il n’y a pas de menu (panneau d’un moment de l’agenda du jour des routines).

## hooks

### `hooks/use-countdown-ringer.ts`

- `useCountdownRinger()` : appelé par `AlarmCenter` ; une minuterie par minuteur en marche, à sa fin (un fini depuis 6 heures au plus, `RING_LATE_MS`, sonne tout de suite ; app fermée, le serveur l’envoie en push, lot 17c) ; replanifié quand les minuteurs changent.
- Interne : `ringCountdownEnd(countdown, rung)` : réservé une fois (`claim`), sonne par `startRinging` (clé `countdownRingKey`, titre et lignes `countdownRingText` (partagé avec le serveur : nom, élément, « Minuteur de 10 min terminé »), lien `openRingTarget`, sa sonnerie), puis `sendCountdownRung`.

## lib

### `lib/countdowns.ts`

- `COUNTDOWN_DEFAULT_NAME` (« Minuteur »), `countdownName(countdown)` : réexportés de `@ordo/shared` (lot 17c).
- `DeadTimeItem` (type) : élément d’un temps mort tel que le minuteur le garde (`taskId` ou `routineId` + `occurrenceDate`, `subject`, `path`, `linkLabel`, `workspaceId`).
- `deadTimeLabel(deadTime)` : « Lave-linge (1 h 30) ».
- `countdownOf(countdown, item)` : le minuteur a été lancé pour l’élément (pour une routine : l’occurrence quand elle est donnée).

### `lib/dead-time-menu.tsx`

- `deadTimeMenuEntries(value, item)` : section « Temps morts » du menu « … » d’une tâche (`useTaskActions`) ou d’une routine (`RoutinesPage`, `RoutineForm`), une entrée « Lancer « … » » par temps mort ; rien sans temps mort.

### `lib/open-countdown-form.tsx`

- `openCountdownForm(props?)` : ouvre `CountdownForm` dans le panneau (`panelId: 'new-countdown'`), « Nouveau minuteur » ou « Lancer un temps mort · Lessive ». Utilisé par « Ajouter › Minuteur » (`QuickActions`), `CountdownList`, `DeadTimesField`, `deadTimeMenuEntries`, `DeadTimeLaunchButtons`.

## Ailleurs

- `features/tasks/lib/task-dead-times.ts` : `taskDeadTimeItem(task, context)` (lien vers la tâche, `alarmTarget`).
- `features/routines/lib/routine-dead-times.ts` : `routineDeadTimeItem(routine, occurrenceDate)` (lien « Voir les routines », `routinesRingPage` partagé).
