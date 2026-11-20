# Code web des alarmes

Référence de chaque fichier de `apps/web/src/features/alarms/` (api, pages, components, hooks, lib) : composants, hooks, fonctions, constantes et types, leur rôle et où ils servent. Fonctionnalités : [Alarmes](../../../features/activities/alarms.md) ; règles : [Règles des alarmes](../../../business-rules/activities/alarms.md).

## api

### `api/index.ts`

Fragment `AlarmFields`, requête `Alarms`, mutations `CreateAlarm`, `UpdateAlarm`, `DeleteAlarm`, `MarkAlarmFired`. Clé de requête interne `alarmsQueryKey` = `['alarms']` ; toutes les mutations passent par `useAlarmMutation` (interne, `useInvalidatingMutation` qui l’invalide).

| Export                        | Rôle                                                                            | Utilisé par                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `Alarm` (type)                | Alarme (`AlarmFieldsFragment`)                                                  | tout le dossier, `ElsewhereNotifier` (via le fragment)                           |
| `AlarmInput` (type réexporté) | Entrée GraphQL d’une alarme                                                     | `AlarmForm`                                                                      |
| `useAlarms()`                 | Toutes les alarmes de l’espace                                                  | `AlarmsPage`, `TaskAlarms`, `AlarmCenter`, `ChronoCard` et `WorkCards` (accueil) |
| `useTaskAlarmCounts()`        | Nombre d’alarmes **actives** par tâche (`countBy`)                              | `TaskBoard`, `use-task-columns` (tâches)                                         |
| `useAlarmMutations()`         | `create`, `update` (`{ id, input }`), `remove` (id), `markFired` (`{ id, at }`) | `AlarmForm`, `AlarmList`, `AlarmCenter`                                          |

## pages

### `pages/AlarmsPage.tsx`

`AlarmsPage()` : page `/alarms` (route dans `app/router.tsx`, `PAGES.alarms`). `PageHeader` avec « Nouvelle alarme » (`useAlarmForm`), encart d’autorisation des notifications (état `permission` : `Notification.permission`, `Notification.requestPermission()`), `ListSkeleton`, `EmptyState` « Aucune alarme. », sinon `AlarmList`.

### `pages/AlarmsPage.module.css`

`.root` : largeur maximale de 7 colonnes de la grille (7 × 96 px + 6 × 16 px), centrée.

## components

### `components/AlarmCenter.tsx`

`AlarmCenter()` : composant sans rendu monté dans `AppLayout` (app) : fait sonner, dans l’espace ouvert, les alarmes et les rappels des évènements, des routines et des tâches.

- Données : `useAlarms`, `useRunningTimer` (temps), `useTasksData` (tâches), `useProjectTree` (projets), `useRoutinesData` + `useRoutineMutations().setDone` (routines), `useSlotRules` (agenda).
- Occurrences d’évènements d’hier à J+8 rechargées toutes les 5 minutes (`fetchCalendarEvents`), gardées dans une ref.
- `unlockAudioOnGesture()` au montage.
- Vérification toutes les `TICK_MS` = 15 s : `ringReminders` (lien « Voir l’agenda »), `ringRoutineReminders` (lien « Voir les routines », « Marquer comme faite », report via `slotRules.nextAllowedAt(routineDoable(routine), at)`), `ringTaskReminders` (lien vers la tâche, `alarmTarget`), puis `dueAlarms` + `ringAlarm` (liens `alarmTarget`, `markFired`).
- Les liens des toasts naviguent avec `useNavigate` (les toasts sont hors du routeur). Valeurs les plus récentes lues par une ref `latest`. Paliers des alarmes de chrono : ref `trackingSteps`.

### `components/ring.tsx`

| Export                                                      | Rôle                                                                                                                                         | Utilisé par                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `MAX_DELAY_MS`                                              | 6 h : au-delà, une occurrence manquée ne sonne plus                                                                                          | ici                                               |
| `RingLink` (type)                                           | Lien d’un toast (`NotifyAction`)                                                                                                             | `AlarmCenter`, `ElsewhereNotifier`, `MailWatcher` |
| `claim(key, ttlMs = 10 min)`                                | Réserve une occurrence pour cet onglet dans `localStorage` (premier arrivé), nettoie les clés `ordo.alarm.*` expirées ; sans stockage : vrai | ici, `MailWatcher`                                |
| `systemNotification(title, body, tag)`                      | Notification système si autorisée                                                                                                            | ici, `MailWatcher`                                |
| `ringAlarm(alarm, key, links, workspaceLabel?)`             | Carillon + notification + toast `notifyInfo` d’une alarme (« Espace « X » » si autre espace)                                                 | `AlarmCenter`, `ElsewhereNotifier`                |
| `ReminderToast` (type)                                      | Ce que montre le toast d’un rappel : `icon`, `title`, `lines`, `actions`                                                                     | ici, `ring-routines.tsx`                          |
| `ringPlannedReminders(planned, now, toast, workspaceLabel?)` | La seule sonnerie des rappels (générique : `toast` reçoit le rappel planifié tel que donné) (décision D16) : chaque rappel dû (≤ 6 h de retard) réservé une fois (`claim` 7 h, clé `ordo.alarm.<clé>`), carillon, notification système, toast `notifyInfo` (`id` = clé ; « Espace « X » » si autre espace). Règle eslint : `playChime()` appelé ailleurs renvoie vers elle (exceptions commentées : `ringAlarm`, `MailWatcher`) | `ringReminders`, `ringTaskReminders`, `ringRoutineReminders` |
| `ringReminders(occurrences, now, links, workspaceLabel?)`   | Rappels d’évènements (`remindersBefore` depuis le début, `remindersAt` le premier jour ; clé `event:<clé>:before:<minutes>` / `…:at:<HH:MM>`), sauf occurrences annulées                                             | `AlarmCenter`, `ElsewhereNotifier`                |
| `RemindedTask` (type), `ringTaskReminders(tasks, now, links, workspaceLabel?)` | Rappels « À HH:MM » des tâches ouvertes non archivées (`taskReminders`, clé `task:<id>:<jour>:at:<HH:MM>`) ; type minimal, celui des tâches d'un autre espace aussi | `AlarmCenter`, `ElsewhereNotifier` |
| `dueAlarms(alarms, running, now, trackingSteps, markFired)` | Alarmes à sonner maintenant, avec leur clé d’occurrence ; enregistre les occurrences planifiées comme sonnées                                | `AlarmCenter`, `ElsewhereNotifier`                |

Interne : `occurrenceStart(occurrence)` (instant, ou minuit de Paris du premier jour en journée entière, `parisInstant`).

### `components/AlarmForm.tsx`

- `AlarmForm({ context, alarm?, defaults?, onDone })` : formulaire (`useAppForm` + `alarmInputSchema`) : libellé, type (`SegmentedControl` + aide), minutes de chrono (`optionalNumberProps`) ou `RepetitionField` + `RuleEditor` (date, heure, répétition ; résumé `describeAlarmTiming`), `ProjectSelect` / `TaskSelect` (tâches `timeTasks`), description, « Active ». À l’envoi : `legacyFields(recurrence)` ajouté, `minutes` vidé hors chrono ; `formCallbacks` (« Alarme créée. », « Alarme modifiée. »). Plus de mode copie (décision D20) : « Dupliquer » de `AlarmList` (`duplicateRowsAction`) enregistre la copie (`toAlarmInput` + `copyName`), puis ouvre le formulaire sur elle (`cachedItem`, `alarmsQueryKey`, exporté).
- `AlarmDefaults` (interface) : `label`, `projectId`, `taskId` d’une nouvelle alarme.
- Internes : `TYPES` (libellés des types), `TYPE_HELP` (aides), `AlarmFormValues`, `AlarmFormProps`.
- Utilisé par `useAlarmForm`.

### `components/AlarmList.tsx`

`AlarmList({ alarms, context, openForm, showTarget = true })` : cartes d’alarmes (libellé, badge « Terminée », `describeAlarm`, « Prochaine : … » via `nextRing`, lien `alarmTarget` si `showTarget`, note), `StateSwitch` actif/inactif, `InlineActions` « Modifier », « Dupliquer », « Supprimer » (`confirmDestructive`). Interne `toAlarmInput(alarm, changes)` : renvoie l’alarme entière avec un changement (interrupteur). Utilisé par `AlarmsPage`, `TaskAlarms`.

### `components/TaskAlarms.tsx`

`TaskAlarms({ task, context })` : section « Alarmes » du panneau d’une tâche (`SubSection`) : alarmes de la tâche (`AlarmList` sans lien), état vide « Aucune alarme pour cette tâche. », « Ajouter une alarme » (défauts : titre de la tâche, de même taille qu’un libellé d’alarme, projet, tâche). Utilisé par `TaskPanel` (tâches).

## hooks

### `hooks/use-alarm-form.tsx`

- `AlarmFormOpener` (type) : `(alarm?, { defaults? }) => void`.
- `useAlarmForm(context)` : ouvre `AlarmForm` dans `openFormPanel` (« Nouvelle alarme », « Modifier l’alarme ») ; sans contexte : rien. Utilisé par `AlarmsPage`, `TaskAlarms`, `AlarmsCell` (`extra-cells`, tâches), `ChronoCard` (accueil), `QuickActions` (app).

## lib

### `lib/alarm-labels.ts`

| Export                                  | Rôle                                                                                                                          | Utilisé par                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `legacyFields(rule)`                    | Anciens champs (fréquence, intervalle, jours, fin) déduits de la répétition ; `YEARLY` → `MONTHLY` ; aucune règle → `ONCE`    | `AlarmForm`                                     |
| `AlarmTiming` (interface)               | Date, heure et répétition                                                                                                     | `AlarmForm`                                     |
| `describeAlarmTiming(timing)`           | « Le 3 nov. 2026 à 09:00 », « Tous les jours à 07:30 » (`describeRecurrence`)                                                 | `AlarmForm`, `describeAlarm`                    |
| `nextRing(alarm, now)`                  | Prochaine sonnerie (aucune si inactive ou de chrono) via `nextOccurrence`                                                     | `AlarmList`, `nextRings`                        |
| `describeAlarm(alarm)`                  | Programmation lisible, y compris « Toutes les N min de chrono » et « , si aucun chrono ne tourne »                            | `AlarmList`                                     |
| `alarmTaskLabel(task, projectLabel?)`   | « Projet #12 Libellé » (`taskNumbered`)                                                                                       | `alarmTarget`                                   |
| `alarmTarget(alarm, taskOf, projectOf)` | Lien de l’alarme : sa tâche, sinon son projet (`taskPath`, `projectPath`), ou null ; le même dans la liste et la notification | `AlarmList`, `AlarmCenter`, `ElsewhereNotifier` |
| `nextRings(alarms, now)`                | Alarmes qui sonneront encore, avec leur prochaine sonnerie, la plus proche d’abord                                            | `ChronoCard`, `WorkCards` (accueil)             |

Interface interne `AlarmTarget`.

### `lib/alarm-sound.ts`

- `unlockAudioOnGesture()` : crée/reprend l’`AudioContext` au premier `pointerdown` ou `keydown` ; renvoie le nettoyage. Utilisé par `AlarmCenter`.
- `playChime()` : carillon de trois notes (880, 1 175, 1 568 Hz) en Web Audio, silencieux tant que l’audio n’est pas débloqué. Utilisé par `ring.tsx` (`ringAlarm`, `ringPlannedReminders`) et `MailWatcher` (mails).
- Variable de module `audio` (contexte partagé).

### `lib/ring-routines.tsx`

`RemindedRoutine` (type minimal, routines d'un autre espace aussi) ; `ringRoutineReminders(routines, now, links, markDone?, defer?, workspaceLabel?)` : rappels des routines non archivées, pour chaque occurrence donnée par l'API (`reminderOccurrences` : en cours non faite, et suivante) : les « avant » pour chaque moment non coché (`remindersBefore`, clé `routine:<id>:<échéance>:<moment>:before:<minutes>`), les « À HH:MM » une fois, le premier jour (`remindersAt`, clé `routine:<id>:<échéance>:at:<HH:MM>`), reportés par `defer` hors des créneaux permis ; sonne par `ringPlannedReminders` (horaires `windowText` et lieu ; « Marquer comme faite », pour l'occurrence en cours et avec `markDone`, + liens). Utilisé par `AlarmCenter`, `ElsewhereNotifier` (sans `markDone` ni `defer`).
