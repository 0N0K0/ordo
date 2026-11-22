# Code web des minuteurs et des temps morts

Tous les fichiers de `apps/web/src/features/countdowns/` : les minuteurs de l’utilisateur (comptes à rebours, dans tous ses espaces), les temps morts des tâches et des routines, et les minuteurs enregistrés de l’espace (liés aux tâches, routines, évènements et fiches). Fonctionnalités : [Alarmes](../../../features/activities/alarms.md#minuteurs). Règles : [Règles des alarmes](../../../business-rules/activities/alarms.md#minuteurs). Partagé : `packages/shared/src/dates/countdowns.ts` ([Dates](../../../shared/cross-cutting/dates.md)).

## api

### `api/index.ts`

Fragments `DeadTimeFields` (`label`, `minutes`, `ringtone` : repris par les fragments des tâches et des routines), `CountdownFields` (dont `eventId`, `sheetId`) et `SavedCountdownFields` ; requêtes `Countdowns`, `SavedCountdowns` ; mutations `StartCountdown`, `SetCountdownPaused`, `ExtendCountdown`, `RingCountdown`, `CancelCountdown`, `CreateSavedCountdown`, `UpdateSavedCountdown`, `DeleteSavedCountdown`, `SetSavedCountdownLinks`. Les fragments des tâches, des routines, d’une fiche et des occurrences d’évènement prennent `savedCountdownIds`.

| Export                         | Rôle                                                                                                                         | Utilisé par                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `Countdown`, `DeadTimeOutput`, `CountdownInput` (types) | Un minuteur ; un temps mort tel que l’API le donne ; un minuteur lancé                              | ici, `features/tasks`, `features/routines`     |
| `countdownsQueryKey`           | Clé `['countdowns']` (les minuteurs de l’utilisateur, les mêmes dans tous les espaces)                                       | ici                                            |
| `useCountdowns()`              | Minuteurs pas encore sonnés, la fin la plus proche d’abord ; relus chaque minute et au retour du focus                        | `CountdownList`, `CountdownWidget`, `DeadTimesField`, `useCountdownRinger` |
| `sendCountdownRung(id)`        | La fin d’un minuteur a sonné (`ringCountdown`)                                                                                 | `useCountdownRinger`                           |
| `useCountdownMutations()`      | `{ start, setPaused({ id, paused }), extend({ id, minutes }), cancel(id) }`, qui relisent les minuteurs                        | `CountdownForm`, `CountdownControls`, `useStartSavedCountdown` |
| `SavedCountdown`, `SavedCountdownTarget` (types) | Un minuteur enregistré ; l’élément qui en cite (`TASK`, `ROUTINE`, `EVENT`, `SHEET`)                         | ici, les éléments                              |
| `savedCountdownsQueryKey`, `useSavedCountdowns()` | Clé `['savedCountdowns']` ; les minuteurs enregistrés de l’espace, dans leur ordre (archivés compris)        | `CountdownForm`, `CountdownList`, `SavedCountdownsField`, `SavedCountdownsSettings`, `useItemLaunchers` |
| `useSavedCountdownMutations()` | `{ create, update({ id, input }), remove({ id }) }` (la suppression relit tout : les éléments le perdent)                       | `useSavedCountdownItems`, `SavedCountdownsSettings` |
| `useSetSavedCountdownLinks(invalidate)` | Les minuteurs enregistrés d’un élément (`setSavedCountdownLinks`), puis les requêtes données relues                  | `SavedCountdownsField`, `EventForm` (copie d’un évènement dupliqué) |

Interne : `useCountdownMutation`.

## components

### `components/CountdownForm.tsx`

- `CountdownForm({ item?, deadTimes?, deadTime?, onDone })` : « Nouveau minuteur » / « Lancer un temps mort » (`countdownFormSchema`) : « Minuteur enregistré » (sans élément, quand l’espace en a de non archivés : reprend nom, durée et sonnerie), « Temps mort » (choix parmi ceux de l’élément, s’il en a plusieurs), « Nom » (« Minuteur » par défaut), « Durée » (`parseDuration`), durées proposées (`COUNTDOWN_PRESETS`, `Chip`), « Sonnerie » (`RingtoneSelect`), « Lancer » ; toast « Minuteur lancé : 10 min. » (`countdownStartedMessage`). Lancé pour un élément, le minuteur garde l’élément, son nom, son lien et l’espace ouvert (`countdownItemInput`).
- `CountdownFormProps` (type). Interne : `valuesOf(deadTime)`.

### `components/CountdownRow.tsx`

- `CountdownControls({ countdown, size? })` : « Pause » / « Reprendre », « + 1 min », « + 5 min » (`COUNTDOWN_EXTENSIONS`), « Annuler » (`RemoveButton` `variant="field"`, sans confirmation : rien de durable n’est perdu ; `toastCallbacks` « Minuteur annulé. »).
- `CountdownRow({ countdown, withSubject? })` : nom, élément, temps restant en direct (`countdownRemaining`, `useNow`), barre de progression, `CountdownControls`.

### `components/CountdownList.tsx`

- `CountdownList({ compact?, bare? })` : les minuteurs (`CountdownRow`), « Aucun minuteur en cours. » (pas en `compact` ni `bare`), « Lancer un minuteur » (`openCountdownForm`, le formulaire de « Ajouter › Minuteur » ; petit en `compact`), un bouton par minuteur enregistré non archivé (`useStartSavedCountdown`, en un clic) et « Minuteurs enregistrés » (`settingsPath` de la page « Alarmes »). Utilisé par la page « Alarmes », la bulle de `CountdownWidget` (`compact`) et la carte « Chrono et alarmes » de l’accueil (`bare`).

### `components/CountdownWidget.tsx`

- `CountdownWidget()` : pastille `RunningPill` (`tone="countdown"`) de l’en-tête : nom du premier à sonner ou « 2 minuteurs », temps restant ; bulle : `CountdownList`. Rien sans minuteur. Monté par `app/layout/AppLayout.tsx`.

### `components/DeadTimesField.tsx`

- `DeadTimesField({ value, onChange, item, disabled? })` : champ « Temps morts » d’une tâche (`TaskPanel`) ou d’une routine (`RoutineForm`) : une ligne par temps mort (libellé, durée tapée `durationText` / `parseDuration`, `RingtoneSelect`, « Lancer », « Retirer »), « Ajouter un temps mort » (`DEAD_TIMES_MAX`) ; les lignes valides sont enregistrées en quittant leurs champs (`onChange`) ; une ligne quittée invalide (son erreur dessous) retient l’enregistrement jusqu’à être corrigée ou retirée, une nouvelle ligne pas encore quittée reste à part ; un enregistrement d’ailleurs remplace les lignes enregistrées. Les minuteurs lancés pour l’élément (`countdownOf`) dessous.
- Internes : `DeadTimeRow`, `rowOf`, `deadTimeOf`, `LABEL_REQUIRED`.

### `components/CountdownLaunchButtons.tsx`

- `CountdownLaunchButtons({ deadTimes?, savedCountdownIds?, item })` : un bouton « Lancer « Lave-linge (1 h 30) » » par temps mort (le formulaire) et par minuteur enregistré (aussitôt), là où il n’y a pas de menu (panneau d’un moment de l’agenda du jour des routines) ; `useItemLaunchers`.

### `components/SavedCountdownsField.tsx`

- `SavedCountdownsField({ target, id, value, invalidate, readOnly?, description?, onSaved? })` : champ « Minuteurs » d’une tâche (`TaskPanel`), d’une routine (`RoutineForm`), d’un évènement (`EventForm`, toute la série) et d’une fiche (`SheetPage`) : `BatchMultiSelect` des minuteurs enregistrés (`listSelectProps`, les archivés non proposés sauf ceux déjà là, `timerLabel`), enregistré dès qu’il change (`useSetSavedCountdownLinks`), montré aussitôt et remis comme il était sur un échec ; « Enregistrez d’abord l’élément. » sans `id`.

### `components/SavedCountdownsSettings.tsx`

- `SavedCountdownsSettings()` : liste de réglages « Minuteurs enregistrés » (`SettingsList` `SAVED_COUNTDOWN`, `useSavedCountdownItems`, durée en badge, message de suppression propre), dans les réglages de la page « Alarmes » (`PageSettings`).

## hooks

### `hooks/use-saved-countdowns.tsx`

- `ItemLaunchers` (type) : ce qu’un élément lance (`deadTimes`, `savedCountdownIds`).
- `linkedSavedCountdowns(all, ids)` : les minuteurs enregistrés d’un élément, dans l’ordre de la liste, sans les archivés.
- `useStartSavedCountdown()` : lance un minuteur enregistré aussitôt (nom, durée, sonnerie), seul ou pour un élément ; toast « Minuteur lancé : 9 min. ».
- `useItemLaunchers()` : les lanceurs d’un élément (libellé `timerLabel`, action) : les temps morts ouvrent le formulaire, les minuteurs enregistrés démarrent aussitôt. Utilisé par `useCountdownMenuEntries`, `CountdownLaunchButtons`.
- `useCountdownMenuEntries()` : entrées du menu « … » d’un élément, sections « Temps morts » et « Minuteurs », « Lancer « … » » ; rien sans eux. Utilisé par `useTaskActions`, `RoutinesPage`, `RoutineForm`, `EventForm`, `SheetPage`.
- `SavedCountdownExtra` (type), `useSavedCountdownItems()` : la liste et le formulaire des minuteurs enregistrés (`SettingsItemKind` : « Nom », « Durée » tapée enregistrée en la quittant, « Sonnerie » `RingtoneSelect` ; `savedCountdownFormSchema`, minutes par `parseDuration`).

### `hooks/use-countdown-ringer.ts`

- `useCountdownRinger()` : appelé par `AlarmCenter` ; une minuterie par minuteur en marche, à sa fin (un fini depuis 6 heures au plus, `RING_LATE_MS`, sonne tout de suite ; app fermée, le serveur l’envoie en push) ; replanifié quand les minuteurs changent.
- Interne : `ringCountdownEnd(countdown, rung)` : réservé une fois (`claim`), sonne par `startRinging` (clé `countdownRingKey`, titre et lignes `countdownRingText` (partagé avec le serveur : nom, élément, « Minuteur de 10 min terminé »), lien `openRingTarget`, sa sonnerie), puis `sendCountdownRung`.

## lib

### `lib/countdowns.ts`

- `COUNTDOWN_DEFAULT_NAME` (« Minuteur »), `countdownName(countdown)` : réexportés de `@ordo/shared`.
- `CountdownItem` (type) : élément pour lequel un minuteur est lancé (temps mort, minuteur enregistré), tel que le minuteur le garde (`taskId`, `routineId`, `eventId` ou `sheetId`, `occurrenceDate` d’une routine ou d’un évènement qui se répète, `subject`, `path`, `linkLabel`, `workspaceId`).
- `timerLabel(timer)` : « Lave-linge (1 h 30) », d’un temps mort ou d’un minuteur enregistré.
- `countdownStartedMessage(seconds)` : « Minuteur lancé : 10 min. ».
- `countdownItemInput(item, workspaceId)` : ce que le minuteur lancé garde de l’élément.
- `countdownOf(countdown, item)` : le minuteur a été lancé pour l’élément (pour une routine ou un évènement : l’occurrence quand elle est donnée).

### `lib/open-countdown-form.tsx`

- `openCountdownForm(props?)` : ouvre `CountdownForm` dans le panneau (`panelId: 'new-countdown'`), « Nouveau minuteur » ou « Lancer un temps mort · Lessive ». Utilisé par « Ajouter › Minuteur » (`QuickActions`), `CountdownList`, `DeadTimesField`, `useItemLaunchers`.

## Ailleurs

- `features/tasks/lib/task-countdowns.ts` : `taskCountdownItem(task, context)` (lien vers la tâche, `alarmTarget`).
- `features/routines/lib/routine-countdowns.ts` : `routineCountdownItem(routine, occurrenceDate)` (lien « Voir les routines », `routinesRingPage` partagé).
- `features/calendar/lib/event-countdowns.ts` : `eventCountdownItem(event, occurrenceDate)` (lien « Voir l’agenda », `calendarRingPage` partagé).
- `features/sheets/lib/sheet-countdowns.ts` : `sheetCountdownItem(sheet)` (lien « Ouvrir la fiche », `sheetPath`).
- `lib/alarm-sound.ts` : `previewRingtone` (« Écouter » de `RingtoneSelect`).
