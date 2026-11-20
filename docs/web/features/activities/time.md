# Code web — Temps passé

Tous les fichiers de `apps/web/src/features/time/` et ce qu’ils exportent : requêtes et mutations du temps et du chrono (`api`), page « Chronos », composants (tableau des temps, formulaire, chrono, widget d’en-tête, prévu / réalisé), hooks et fonctions (`lib`).

Fonctionnalités : [Temps passé](../../../features/activities/time.md). Règles : [Règles métier — Temps passé](../../../business-rules/activities/time.md). Dépend de : [Code web — Tâches](tasks.md) (`useTaskContext`, `ProjectSelect`, `TaskRef`), [Tableaux](../../components/data-table.md), [Actions](../../components/actions.md), [Panneaux](../../components/panels.md), [Arbres](../../components/tree.md), [Bibliothèque web](../../lib.md). Partagé : [shared/tasks](../../../shared/activities/tasks.md) (`entrySeconds`, `formatDuration`, `formatClock`, `parseDuration`, `timeEntryFormSchema`).

## api/

### `api/index.ts`

Documents GraphQL du temps (fragment `TimeEntryFields` avec `routines { id label }` et `events { eventId occurrenceDate label }`, requêtes `TimeEntries`, `RunningTimeEntry`, `TimeLostOnDelete`, mutations `StartTimer`, `SetTimerPaused`, `StopTimer`, `CreateTimeEntry`, `UpdateTimeEntry`, `DeleteTimeEntry`) et hooks.

| Nom                                    | Rôle                                                                                                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TimeEntry` (type)                     | Fragment `TimeEntryFields` d’un temps.                                                                                                                                                                    |
| `timeQueryKey`                         | Clé `['time']` des données du temps.                                                                                                                                                                      |
| `useTimeEntries(projectId)`            | Temps d’un projet et de ses sous-projets (rien sans projet). Utilisé par `ProjectTimePanel`.                                                                                                              |
| `useTimeEntriesSince(since, enabled?)` | Temps de tous les projets depuis un moment (ISO), ou tous (`null`). Utilisé par `TimePage`, `PlannedTime`, l’agenda (`CalendarPage`), l’accueil (`home-data.ts`).                                         |
| `useRunningTimer()`                    | Le chrono en cours ou `null` ; relu au retour du focus.                                                                                                                                                   |
| `TimeEntryValues` (interface)          | Champs d’un temps envoyés : `projectId`, `routineIds?`, `taskIds`, `description`, `startedAt`, `duration` (secondes), `events?` (plusieurs de chaque, décision D18). |
| `TimerStartValues` (interface)         | Démarrage d’un chrono : `projectId?`, `routineIds?`, `taskIds`, `description?`, `events?`. |
| `TimeEventLink` (interface)            | Évènement d’un temps envoyé : `{ eventId, occurrenceDate }`. |
| `TimeLostQuery` (interface)            | Éléments sur le point d’être supprimés : `taskIds?`, `routineIds?`, `withSubtree?`, `eventId?`, `scope?`, `occurrenceDate?`. |
| `fetchTimeLost(query)`                 | Nombre de temps sans projet qu’une suppression emporte (requête `timeLostOnDelete` ; `TimeLostQuery` : tâches, routines, évènement, ou `calendarId`). Utilisé par `EventForm` (les trois portées d’un récurrent). |
| `useTimeLost(query)`                   | Le même nombre en requête React Query. Utilisé par `TimeLostRisk`. |
| `useTimeMutations()`                   | `{ start, setPaused, stop, create, update, remove }` ; toutes invalident `['time']` et `['tasks']` (temps passé des tâches). `start` avertit ensuite si le chrono est hors des créneaux (`warnOutOfSlots`). |

Internes : `useTimeMutation` (mutation invalidante), `warnOutOfSlots(queryClient, slotRules, input)` (toast « Hors des moments prévus » : tâches hors des heures que leur condition de créneaux permet, ou assignés d’une tâche ou d’une routine pris par un autre évènement que ceux du chrono ; lit les routines et tâches déjà en cache).

## pages/

### `pages/TimePage.tsx`

- `TimePage()` : page `/time` (« Chronos ») : `PlannedTime` (pas en espace PERSO), section « Temps passé », badge du filtre `?task=` (« Tâche : #12 Libellé », croix « Voir tous les temps »), `TimeLog` de tous les temps avec `TimeLogActions`. Dialogues via `useTimeEntryDialogs`. Utilisée par `app/router.tsx`.

## components/

### `components/TimeLog.tsx`

- `TimeLog({ entries, context, projectId, emptyMessage, onEdit, onDuplicate, onDelete, actions? })` : tableau des temps (`DataTable`, `tableKey: 'time-log'`, vues `TIME_VIEWS` « Cette semaine », « Ce mois-ci », « Tous »), groupé par jour avec totaux, édition en place et en masse (`bulkSaver`, `bulkCellLabels`), total et non facturé dans la barre, suppression des temps sélectionnés (sauf facturés), menu « Modifier » / « Dupliquer » / « Supprimer ». Utilisé par `TimePage` et `ProjectTimePanel`.
  - Interne `editable(entry)` : terminé et pas sur une facture validée.
- Internes du fichier : `finishedSeconds(entries)` (somme des temps terminés), `events(entries)` (évènements des temps, options du filtre), `labelsText(items)` (libellés des routines ou évènements d’un temps), `billedText(entry)` (« Facturé : F-… » ou « Brouillon »), `TIME_VIEWS`, `timeColumns(context, comments, routines, entries)` (colonnes « Date », « Mois », « Heure de début », « Heure de fin », « Durée », « Projet », « Routines », « Tâches », « Évènements », « Facture », « Commentaires » ; routines et évènements en filtre `choices`, groupables). La cellule « Projet » ne se vide que si le temps garde une routine, une tâche ou un évènement (`hasSubject`).

### `components/time-cells.tsx`

Cellules modifiables du tableau des temps ; chacune reçoit `{ entry, readOnly, label, save }` (`save` = enregistreur de masse `BulkChange`) :

| Nom                           | Rôle                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `TimeDayCell`                 | Jour (l’heure gardée).                                                                                   |
| `TimeStartCell`               | Heure de début.                                                                                          |
| `TimeDurationCell`            | Durée tapée (`parseDuration`) ; « Durée attendue : 1:30, 1h30, 90 ou 1,5h. ».                            |
| `TimeRoutinesCell` (+ `context`) | Routines de l’arborescence du projet (`timeRoutineOptions`). |
| `TimeTasksCell` (+ `context`) | Tâches du projet (`timeTasks`, `timeTaskOptions`). |
| `TimeEventsCell`              | Évènements du jour, chargés à l’ouverture de la liste (`DayEventsSelect`, `dayEventOptions`). |

Les trois cellules de sujets passent par l’interne `TimeSubjectCell({ kind, entry, readOnly, label, items, select, save })` : valeurs l’une sous l’autre (`StackedMultiCell`), liste `CellMultiSelect` à l’ouverture ; en masse, chaque ligne reçoit les ajouts et perd les retraits (`applyDiff` sur `TIME_SUBJECTS[kind]`). Internes : `Save`, `SubjectSelectProps`, `DayEventsSelect`.

### `components/TimeEntryForm.tsx`

- `TimeEntryForm({ context, entry?, defaultProjectId?, copy?, onDone })` : formulaire d’un temps (ajout, modification, duplication avec `copy`) : projet (facultatif avec une tâche, une routine ou un évènement, décision D17 ; le changer vide routines et tâches), jour, début, durée, routines, tâches et évènements du jour (`TimeSubjectsFields`, valeurs `routineIds`, `taskIds`, `events` du formulaire), description ; schéma `timeEntryFormSchema` ; en modification, commentaires du temps (`Comments` cible `TIME_ENTRY`). Ouvert par `useTimeEntryDialogs`.

### `components/TimeLogActions.tsx`

- `TimeLogActions({ context, onNew, projectId?, archived? })` : boutons « Nouveau temps » et « Démarrer le chrono » (`openTimerForm`, info-bulle `useTimerHint`) ; désactivés sur un projet archivé.

### `components/ProjectTimePanel.tsx`

- `ProjectTimePanel({ projectId })` : onglet « Temps » d’un projet : `TimeLog` des temps du projet et de ses sous-projets, avec ses actions. Utilisé par `features/projects/pages/ProjectPage.tsx`.

### `components/PlannedTime.tsx`

- `PlannedTime()` : section « Prévu et réalisé » : temps prévu par les créneaux de travail (`plannedSlots`, `slotMinutes`) contre temps chronométré, aujourd’hui, la semaine (de l’espace, `weekRange`) et par jour ; en direct pendant un chrono (`useNow`). Rien sans créneaux. Utilisé par `TimePage`.
- Interne : `Gauge({ label, tracked, planned })` (jauge, orange au-delà de 100 %).

### `components/TaskTime.tsx`

- `TaskTime({ task })` : « Temps passé » d’une tâche dans son panneau, et « Démarrer le chrono » (ou badge et commandes du chrono s’il tourne sur elle). Utilisé par `TaskPanel`.

### `components/TimerCard.tsx`

| Nom                                                                                     | Rôle                                                                                                                                                            | Utilisé par                             |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `TimerStartForm({ context, defaultProjectId?, defaultTaskIds?, popover?, onStarted? })` | Démarre un chrono : projet, routines, tâches, évènements du jour (`TimeSubjectsFields` ; au moins l’un d’eux, décision D17), description. | `openTimerForm`, accueil (`ChronoCard`) |
| `RunningTimer({ entry, context, popover? })`                                            | Chrono en cours : horloge, état, lien vers le projet / les routines (sinon le sujet sans lien), `TimerControls`, « Abandonner » (confirmation), projet / routines / tâches / évènements (`TimeSubjectsFields`) / description modifiables. | `TimerWidget`, accueil                  |

Interne : `inPopover` (listes déroulantes gardées dans la bulle).

### `components/TimerCard.module.css`

Classes `clock` (horloge, en couleur atténuée quand `data-paused`) et `fields` (champs projet, routines, tâches, évènements côte à côte, l’un sous l’autre faute de place).

### `components/TimerControls.tsx`

- `TimerControls({ entry, size?, look? })` : « Pause » / « Reprendre » puis arrêt (`StopTimerButton`), les mêmes partout ; `look` `header` (discret) ou `card`.

### `components/TimerStop.tsx`

- `TIMER_RUNNING` : « Chrono en cours » (décision S).
- `StopTimerButton({ entry, name?, size? })` : bouton rouge « Arrêter le chrono » (toast du temps enregistré).
- `TimerRunningBadge()` : badge « Chrono en cours ».

### `components/TimerToggle.tsx`

- `TimerToggle({ name, mine, input, disabled?, size? })` : démarre le chrono sur un élément, ou l’arrête s’il tourne dessus (`mine`). Utilisé par la colonne « Chrono » des tâches (`TimerCell`) et d’autres tableaux (routines…).

### `components/TimerWidget.tsx`

- `TimerWidget()` : chrono en cours dans l’en-tête de l’app (rien sans chrono). Monté par `app/layout/AppLayout.tsx` (pas sur téléphone).
- Interne : `RunningControls({ entry })` : sujet et horloge (bulle « Détails du chrono » avec `RunningTimer`), `TimerControls`.

### `components/TimerWidget.module.css`

Classes `running` (bloc du chrono dans l’en-tête), `summary` (bouton sujet + horloge), `dot` (point qui pulse, immobile quand `data-paused`).

### `components/TimeTasksSelect.tsx`

- `TimeTasksSelect({ context, projectId, value, onChange, ...MultiSelectProps })` : multi-sélection des tâches d’un temps (arbre, fermées marquées) ; sans projet, les tâches sans projet (« Sans projet : tâches sans projet. ») ; « Le temps est réparti à parts égales entre les n tâches. ». Utilisé par `TimeSubjectsFields`.

### `components/TimeSubjectsFields.tsx`

- `TimeSubjectsFields({ context, projectId, day, entry?, value, onChange, errors?, comboboxProps? })` : ce sur quoi porte un temps, le même dans son formulaire et le chrono (décision D18) : « Routines » (`timeRoutineOptions` ; « Le temps est réparti à parts égales entre les n routines. »), « Tâches » (`TimeTasksSelect`), « Évènements » du jour (`dayEventOptions`, ceux du temps gardés). Utilisé par `TimeEntryForm`, `TimerStartForm`, `RunningTimer`.
- `TimeSubjectsValue` (type) : `{ routineIds, taskIds, events }` (clés d’occurrence).

### `components/TimeLostRisk.tsx`

- `TimeLostRisk({ query })` : phrase de la confirmation d’une suppression de tâches, de routines, d’un évènement ou d’un calendrier : « 2 temps sans projet, qui ne portent sur rien d’autre, seront aussi supprimés (les temps facturés sont gardés). » (`useTimeLost` ; rien sans aucun). Utilisé par `DeleteTasksDialog`, `DeleteRoutinesDialog`, `EventForm`, `CalendarsManager`.
- Interne : `timeLostText(count)`.

## hooks/

### `hooks/use-start-timer.ts`

- `useTimerHint()` : info-bulle d’un bouton de démarrage quand un autre chrono tourne (« Le chrono en cours s’arrête (son temps est enregistré). »), décision Y.
- `useStartTimer()` : `{ startTimer(input, onStarted?), isPending, hint }` : démarre et annonce l’arrêt du chrono précédent dans le toast.
- Interne : `TIMER_REPLACED_HINT`.

### `hooks/use-stop-timer.ts`

- `savedTimeMessage(entry)` : « Temps enregistré : 1 h 05. ».
- `useStopTimer()` : `{ stopTimer(entry), isPending }`.

### `hooks/use-time-dialogs.tsx`

- `useTimeEntryDialogs(context, defaultProjectId?)` : `{ openForm(entry?, { copy? }), duplicate(entry), confirmDelete(entry) }` : formulaire d’un temps dans le panneau, et confirmation de suppression. Utilisé par `TimePage`, `ProjectTimePanel`, l’agenda.

## lib/

### `lib/open-timer-form.tsx`

- `openTimerForm(context, defaultProjectId?)` : ouvre « Nouveau chrono » (`TimerStartForm`) dans le panneau (`panelId: 'new-timer'`), fermé une fois le chrono lancé. Utilisé par `TimeLogActions` et le menu « Ajouter » (`QuickActions`).

### `lib/entry-subject.ts`

- `entrySubject(entry, context)` : sujet d’un temps : le libellé de son projet, sinon de sa première routine, de son premier évènement ou de sa première tâche, suivi de « + N » pour les autres (« Projet » / « Temps » inconnus, décisions D17 et D18). Utilisé par l’agenda, le widget, la carte du chrono.

### `lib/time-events.ts`

- `entryEventKeys(entry)` : clés (`occurrenceKey`) des évènements d’un temps.
- `parseEventKeys(keys)` : clés → `TimeEventLink[]` (`{ eventId, occurrenceDate }`).
- `dayEventOptions(events, day, entry?)` : options des évènements d’un jour (« 09:00–10:00 · Titre », « Journée · … », « (annulé) »), plus ceux du temps qui n’y sont pas (sous leur libellé).

### `lib/time-subjects.ts`

- `TIME_SUBJECTS` : pour chaque sorte de sujet (`routines`, `tasks`, `events`), comment la lire d’un temps (`ids`) et l’écrire (`change`) ; l’unique endroit qui le dit. Utilisé par `time-cells.tsx`.
- `TimeSubjectKind` (type) : `'routines' | 'tasks' | 'events'`.
- `hasSubject(entry)` : le temps garde une routine, une tâche ou un évènement (décision D17). Utilisé par `TimeLog`.

### `lib/time-tasks.ts`

- `timeTasks(context, projectId, keep?)` : tâches sur lesquelles passer du temps dans un projet (projet et sous-projets, et sans projet ; non archivées sauf `keep` ; ouvertes d’abord) ; sans projet, les tâches sans projet (la règle de l’API, décision D17).
- `timeTaskOptions(context, tasks)` : options d’arbre, les fermées marquées « (fermée) ».
- `timeRoutineOptions(context, routines, projectId, keep?)` : options d’arbre des routines d’un temps, même règle que les tâches (décision D18).
- Interne : `inTimeProject(context, projectId, keep)` (la règle de l’arborescence, commune aux tâches et aux routines).
