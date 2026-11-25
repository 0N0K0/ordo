# Code web — Temps passé

Tous les fichiers de `apps/web/src/features/time/` et ce qu’ils exportent : requêtes et mutations du temps et du chrono (`api`), page « Chronos », composants (tableau des temps, formulaire, chrono, widget d’en-tête, prévu / réalisé), hooks et fonctions (`lib`).

Fonctionnalités : [Temps passé](../../../features/activities/time.md). Règles : [Règles métier — Temps passé](../../../business-rules/activities/time.md). Dépend de : [Code web — Tâches](tasks.md) (`useTaskContext`, `ProjectSelect`, `TaskRef`), [Tableaux](../../components/data-table.md), [Actions](../../components/actions.md), [Panneaux](../../components/panels.md), [Arbres](../../components/tree.md), [Bibliothèque web](../../lib.md). Partagé : [shared/tasks](../../../shared/activities/tasks.md) (`entrySeconds`, `formatDuration`, `formatClock`, `parseDuration`, `timeEntryFormSchema`).

## api/

### `api/index.ts`

Documents GraphQL du temps (fragment `TimeEntryFields` avec `routines { id label }` et `events { eventId occurrenceDate label }`, requêtes `TimeEntries`, `RunningTimeEntries`, `LostOnDelete`, mutations `StartTimer`, `SetTimerPaused(id, paused)`, `StopTimer(id)`, `StopAllTimers`, `CreateTimeEntry`, `UpdateTimeEntry`, `DeleteTimeEntry`) et hooks.

| Nom                                    | Rôle                                                                                                                                                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TimeEntry` (type)                     | Fragment `TimeEntryFields` d’un temps.                                                                                                                                                                    |
| `timeQueryKey`                         | Clé `['time']` des données du temps.                                                                                                                                                                      |
| `useTimeEntries(projectId)`            | Temps d’un projet et de ses sous-projets (rien sans projet). Utilisé par `ProjectTimePanel`.                                                                                                              |
| `useTimeEntriesSince(since, enabled?, until?)` | Temps de tous les projets pas finis avant un moment (ISO), ou tous (`null`) ; avec `until`, seulement ceux commencés avant ce moment (ceux qui rencontrent une période). Utilisé par `TimePage`, `PlannedTime`, l’agenda (`CalendarPage`), l’accueil (`home-data.ts`), « Ma journée » (`useMyDay`, les temps d’un jour passé).                                         |
| `useRunningTimers()`                   | Les chronos en cours (plusieurs à la fois), le premier démarré d’abord ; relus au retour du focus et chaque minute, onglet en arrière-plan compris ; clé `runningTimersQueryKey`. |
| `runningOn(running, on)`               | Le chrono en cours sur un élément (le premier), sinon `null`. Utilisé par `TrackedTime`, `TimerCell`, `routineTimer`. |
| `onRoutine(routineId)`                 | Test d’un temps passé sur une routine. Utilisé par `routineTimer` et le chrono du panneau d’une routine (`RoutineForm`, `TrackedTime`). |
| `routineTimer(running, routine)`       | Le chrono en cours sur une routine (`runningOn`). Utilisé par `ChronoCell` (routines) et les lignes de « Ma journée ». |
| `TimeEntryValues` (interface)          | Champs d’un temps envoyés : `projectId`, `routineIds?`, `taskIds`, `description`, `startedAt`, `duration` (secondes), `events?` (plusieurs de chaque). |
| `TimerStartValues` (interface)         | Démarrage d’un chrono : `projectId?`, `routineIds?`, `taskIds`, `description?`, `events?`. |
| `TimeEventLink` (interface)            | Évènement d’un temps envoyé : `{ eventId, occurrenceDate }`. |
| `LostOnDeleteQuery` (interface)        | Éléments sur le point d’être supprimés : `taskIds?`, `routineIds?`, `withSubtree?`, `eventId?`, `scope?`, `occurrenceDate?`, `calendarId?`, `routineOccurrence?` (`{ id, date, scope }` : occurrence de routine, ou elle et les suivantes). |
| `LostOnDelete` (interface)             | `{ times, comments, checklists, links }` : temps sans projet laissés sans rattachement, commentaires, listes à cocher commencées et liens entre routines et évènements de ce qui est supprimé. |
| `fetchLostOnDelete(query)`             | Ce qu’une suppression emporte : temps sans projet, commentaires, listes à cocher commencées et liens (requête `lostOnDelete`). Utilisé par `EventForm` (les trois portées d’un récurrent) et `useCalendarEdits` (suppression d’une occurrence de routine, deux portées). |
| `useLostOnDelete(query)`               | La même chose en requête React Query. Utilisé par `LostOnDeleteRisk`. |
| `useTimeMutations()`                   | `{ start, setPaused({ id, paused }), stop(id), stopAll, create, update, remove }` ; toutes invalident `['time']` et `['tasks']` (temps passé des tâches). `start` avertit ensuite si le chrono est hors des créneaux (`warnOutOfSlots`). |

Internes : `useTimeMutation` (mutation invalidante), `warnOutOfSlots(queryClient, slotRules, input)` (toast « Hors des moments prévus » : tâches hors des heures que leur condition de créneaux ou leurs horaires permettent — ceux qu’elles suivent, `taskRow` —, « Libellé : hors de ses horaires », ou assignés d’une tâche ou d’une routine pris par un autre évènement que ceux du chrono ; lit les routines et tâches déjà en cache).

## pages/

### `pages/TimePage.tsx`

- `TimePage()` : page `/time` (« Chronos ») : `PageSettings` « Paramètres des chronos » (`TimeSettings`), `PlannedTime` (pas en espace PERSO), section « Temps passé », badge du filtre `?task=` (« Tâche : #12 Libellé », croix « Voir tous les temps »), `TimeLog` de tous les temps avec `TimeLogActions`. Dialogues via `useTimeEntryDialogs`. Utilisée par `app/router.tsx`.

## components/

### `components/TimeLog.tsx`

- `TimeLog({ entries, context, projectId, emptyMessage, onEdit, onDuplicate, onDelete, actions? })` : tableau des temps (`DataTable`, `tableKey: 'time-log'`, vues `TIME_VIEWS` « Cette semaine », « Ce mois-ci », « Tous »), groupé par jour avec totaux, édition en place et en masse (`bulkSaver`, `bulkCellLabels`), total et non facturé dans la barre, suppression des temps sélectionnés (sauf facturés), menu « Modifier » / « Dupliquer » (`duplicateRowsAction` avec `onDuplicate`) / « Supprimer ». Utilisé par `TimePage` et `ProjectTimePanel`.
  - Interne `editable(entry)` : terminé et pas sur une facture validée.
- Colonnes : `useTimeColumns(entries, context)` (`hooks/use-time-columns.tsx`).
- Internes du fichier : `finishedSeconds(entries)` (somme des temps terminés), `TIME_VIEWS`. La cellule « Projet » ne se vide que si le temps garde une routine, une tâche ou un évènement (`hasSubject`).

### `components/TimeSettings.tsx`

- `TimeSettings()` : paramètres des temps : `WeekSettings` (la semaine de l’espace, celle de « Cette semaine »), puis en dernier `ColumnDefaults` du tableau `time-log` (« Temps passé », colonnes `useTimeColumns`). Utilisé par `TimePage` et l’onglet « Temps » des paramètres d’un projet.

### `components/time-cells.tsx`

Cellules modifiables du tableau des temps ; chacune reçoit `{ entry, readOnly, label, save }` (`save` = enregistreur de masse `BulkChange`) :

| Nom                           | Rôle                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `TimeDayCell`                 | Jour à Paris (l’heure de Paris gardée, `parisParts`, `parisInstant`), pas après aujourd’hui (`maxDate` `parisToday()`). |
| `TimeStartCell`               | Heure de début (à Paris).                                                                                |
| `TimeDurationCell`            | Durée tapée (`parseDuration`) ; « Durée attendue : 1:30, 1h30, 90 (minutes) ou 1,5 h. » (`DURATION_TEXT_INVALID`, comme le formulaire).                            |
| `TimeRoutinesCell` (+ `context`) | Routines de l’arborescence du projet (`timeRoutineOptions`). |
| `TimeTasksCell` (+ `context`) | Tâches du projet (`timeTasks`, `timeTaskOptions`). |
| `TimeEventsCell`              | Évènements du jour (à l’heure de Paris, `parisDay`), chargés à l’ouverture de la liste (`DayEventsSelect`, `dayEventOptions`). |

Les trois cellules de sujets passent par l’interne `TimeSubjectCell({ kind, entry, readOnly, label, items, select, save })` : valeurs l’une sous l’autre (`StackedMultiCell`), liste `CellMultiSelect` à l’ouverture ; en masse, chaque ligne reçoit les ajouts et perd les retraits (`applyDiff` sur `TIME_SUBJECTS[kind]`). Internes : `Save`, `SubjectSelectProps`, `DayEventsSelect`.

### `components/TimeEntryForm.tsx`

- `TimeEntryForm({ context, entry?, defaultProjectId?, onDone })` : formulaire d’ajout (« Ajouter ») ou panneau d’un temps existant enregistré champ par champ (`useFieldSave` : durée et description en les quittant, le reste dès qu’il change, `SaveStatus` en tête ; entrée de l’API par `entryInput` à l’ajout, par interne `changedInput` en modification : seuls les champs changés, durée et début gardés exacts sinon) : projet (facultatif avec une tâche, une routine ou un évènement ; le changer vide routines et tâches, enregistrés ensemble), jour et début (à l’heure de Paris, `parisParts`, `parisInstant`), durée, routines, tâches et évènements du jour (le jour saisi, aujourd’hui à Paris tant qu’il n’est pas saisi, interne `entryDay` ; `TimeSubjectsFields`, valeurs `routineIds`, `taskIds`, `events` du formulaire), description ; schéma `timeEntryFormSchema` ; en modification, commentaires du temps (`Comments` cible `TIME_ENTRY`) ; le temps du cache est suivi (`useCachedItem` sur `timeQueryKey`, valeurs d’un temps : interne `timeEntryFormValues`) ; un nouveau temps commence il y a une heure à Paris, à la minute, pour 1:00 (interne `newEntryFormValues` : « Ajouter » sans rien changer est accepté ; pendant l’heure répétée de l’automne, une heure plus tôt encore). Ouvert par `useTimeEntryDialogs`. Le « Début » (`DateTimeField`) s’arrête à aujourd’hui (`maxDate` `parisToday()`) ; un temps qui finirait après maintenant est refusé par le schéma (`timeEntryFutureError`).

### `components/TimeLogActions.tsx`

- `TimeLogActions({ context, onNew, projectId?, archived? })` : boutons « Nouveau temps » et « Démarrer le chrono » (`openTimerForm` ; les chronos en cours continuent) ; désactivés sur un projet archivé.

### `components/ProjectTimePanel.tsx`

- `ProjectTimePanel({ projectId })` : onglet « Temps » d’un projet : `TimeLog` des temps du projet et de ses sous-projets, avec ses actions. Utilisé par `features/projects/pages/ProjectPage.tsx`.

### `components/PlannedTime.tsx`

- `PlannedTime()` : section « Prévu et réalisé » : temps prévu par les créneaux de travail comptés (`useWorkingHours` : ni éphémérides, ni archivés, ni d’un type archivé ; `plannedSlots`, `slotMinutes`) contre temps chronométré, aujourd’hui, la semaine (de l’espace, `weekRange`) et par jour ; en direct pendant un chrono (`useNow`) ; « aujourd’hui » change tout seul à minuit (`useToday`). Rien sans créneaux. Utilisé par `TimePage`.
- Interne : `Gauge({ label, tracked, planned })` (jauge, orange au-delà de 100 %).

### `components/TrackedTime.tsx`

- `TrackedTime({ seconds, on, start, disabled? })` : « Temps passé » d’une tâche, d’une routine ou d’un évènement dans son panneau (« Aucun » sans temps), et « Démarrer le chrono » (`start` : le chrono lancé ; ou badge et commandes du chrono qui tourne sur l’élément, `runningOn` avec `on`). Utilisé par `TaskPanel` (« Charge »), `RoutineForm` (« Planification ») et `EventForm` (« Dates et heures »).

### `components/TimerCard.tsx`

| Nom                                                                                     | Rôle                                                                                                                                                            | Utilisé par                             |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `TimerStartForm({ context, defaultProjectId?, defaultTaskIds?, popover?, onStarted? })` | Démarre un chrono : projet, routines, tâches, évènements du jour (`TimeSubjectsFields` ; au moins l’un d’eux), description. | `openTimerForm`, accueil (`ChronoCard`) |
| `RunningTimer({ entry, context, popover? })`                                            | Chrono en cours : horloge, état, lien vers le projet / les routines (sinon le sujet sans lien), `TimerControls`, « Abandonner » (confirmation), projet / routines / tâches / évènements (`TimeSubjectsFields`) / description modifiables. | `TimerWidget`, accueil                  |

Interne : `inPopover` (listes déroulantes gardées dans la bulle).

### `components/TimerCard.module.css`

Classes `clock` (horloge, en couleur atténuée quand `data-paused`) et `fields` (champs projet, routines, tâches, évènements côte à côte, l’un sous l’autre faute de place).

### `components/TimerControls.tsx`

- `TimerControls({ entry, size?, look? })` : « Pause » / « Reprendre » puis arrêt (`StopTimerButton`) de ce chrono, les mêmes partout ; `look` `header` (discret) ou `card`.

### `components/TimerStop.tsx`

- `TIMER_RUNNING` : « Chrono en cours ».
- `StopTimerButton({ entry, name?, size? })` : bouton rouge « Arrêter le chrono » (toast du temps enregistré ; arrêté par l’API après 24 heures juste avant : `notifyTimerCap` avec ce sur quoi il portait, `entrySubject`).
- `TimerRunningBadge()` : badge « Chrono en cours ».

### `components/TimerToggle.tsx`

- `TimerToggle({ name, mine, input, disabled?, size? })` : démarre un chrono sur un élément (les autres continuent), ou arrête celui qui tourne dessus (`mine`). Utilisé par la colonne « Chrono » des tâches (`TimerCell`), d’autres tableaux (routines…) et `EventTimerToggle` (agenda).

### `components/TimerWidget.tsx`

- `TimerWidget()` : chronos en cours dans l’en-tête de l’app (rien sans chrono), en pastille `RunningPill` (`components/feedback`). Monté par `app/layout/AppLayout.tsx` (pas sur téléphone).
- Internes : `RunningControls({ entry })` (un seul chrono : sujet et horloge, bulle « Détails du chrono » avec `RunningTimer`, `TimerControls`) ; `SeveralRunning({ entries })` (plusieurs : « 2 chronos » et l’horloge du plus long, bulle « Chronos en cours » : une ligne `RunningRow` par chrono, puis « Arrêter tout ») ; `RunningRow({ entry })` (sujet, horloge, `TimerControls`). ; `useTimerCapNotice(entries)` (notification « Chrono arrêté après 24 heures » quand un chrono disparaît des chronos en cours après 24 heures, `reachedDurationMax`, `notifyTimerCap`, sauf arrêté ou abandonné à la main dans l’onglet, `wasStoppedByHand`) ; `useTimerCapRefresh(entries)` (au moment où un chrono qui tourne atteint 24 heures, recharge les temps, `timeQueryKey`, et les tâches, `tasksQueryKey` : l’API l’arrête en les lisant).

Ses styles (`TimerWidget.module.css`) sont devenus ceux de `RunningPill` (`components/feedback/RunningPill.module.css`), commune aux chronos et aux minuteurs.

### `components/TimeTasksSelect.tsx`

- `TimeTasksSelect({ context, projectId, value, onChange, ...MultiSelectProps })` : multi-sélection des tâches d’un temps (arbre, fermées marquées) ; sans projet, les tâches sans projet (« Sans projet : tâches sans projet. ») ; « Le temps est réparti à parts égales entre les n tâches. ». Utilisé par `TimeSubjectsFields`.

### `components/TimeSubjectsFields.tsx`

- `TimeSubjectsFields({ context, projectId, day, entry?, value, onChange, errors?, comboboxProps? })` : ce sur quoi porte un temps, le même dans son formulaire et le chrono : « Routines » (`timeRoutineOptions` ; « Le temps est réparti à parts égales entre les n routines. »), « Tâches » (`TimeTasksSelect`), « Évènements » du jour (`dayEventOptions`, ceux du temps gardés). Utilisé par `TimeEntryForm`, `TimerStartForm`, `RunningTimer`.
- `TimeSubjectsValue` (type) : `{ routineIds, taskIds, events }` (clés d’occurrence).

### `components/LostOnDeleteRisk.tsx`

- `LostOnDeleteRisk({ query })` : phrases de la confirmation d’une suppression de tâches, de routines, d’un évènement ou d’un calendrier : « 2 temps sans projet, qui ne portent sur rien d’autre, seront aussi supprimés (les temps facturés sont gardés). » , « 3 commentaires seront aussi supprimés. », « 2 listes à cocher commencées seront aussi supprimées. » et « 4 liens entre routines et évènements seront aussi supprimés. » (`useLostOnDelete`, `lostOnDeleteText` ; rien sans aucun). Seule brique de ce rôle. Utilisé par `DeleteTasksDialog`, `DeleteRoutinesDialog`, `EventForm`, `CalendarsManager`.

### `lib/lost-on-delete.ts`

- `lostOnDeleteText(lost)` : les phrases ci-dessus (vide sans rien ; listes et liens absents : aucun).
- `withLossConfirmation(run, dialog?)` (`lib/confirm-loss.tsx`) : lance un changement sans confirmation (`run(false)`) ; si l'API répond `CONFIRMATION_REQUIRED`, demande la confirmation destructive faite de son extension `lost` — par défaut « Occurrences supprimées » (« Ce changement fait disparaître des occurrences qui ne reviendront pas. » puis `lostOnDeleteText(lost)`, bouton « Supprimer et enregistrer ») ; `dialog(lost)` en donne une autre (transformation tâche ↔ routine : `conversionDialog`)  — et relance confirmé (`run(true)`) ; une extension `lost.merge` (occurrence d'une routine déplacée sur un jour qui a la sienne) n'est pas une perte : l'erreur passe, pour `withSameDayChoice` (routines) ; refusé : `ActionDeclined`. Type `LossDialog` (options de `confirmedDestructive`). Utilisé par les mutations `update` des évènements, `update`, `patch`, `bulkUpdate`, `changeOccurrence`, `convertTask`, `convertToTask` des routines, et celles des créneaux.
- `scopeLostNote(lost)` : note de la question de portée d’une suppression : « Temps sans projet supprimés avec : cette occurrence 1, celle-ci et les suivantes 2, toutes 3 (les temps facturés sont gardés). Commentaires supprimés avec : cette occurrence 1, … », de même « Listes à cocher commencées supprimées avec » et « Liens entre routines et évènements supprimés avec » (seulement les choix proposés ; rien sans aucun). Utilisé par `EventForm` et `useCalendarEdits`.

## hooks/

### `hooks/use-time-columns.tsx`

- `useTimeColumns(entries, context)` : colonnes du tableau des temps (« Date », « Mois », « Heure de début », « Heure de fin », « Durée », « Projet », « Routines », « Tâches », « Évènements », « Facture », « Commentaires » ; routines et évènements en filtre `choices`, groupables), avec les routines proposées par le filtre et les commentaires des temps (sans temps : aucun compté). Utilisé par `TimeLog` et `TimeSettings`.
- `labelsText(items)` (libellés des routines ou évènements d’un temps, joints pour le texte, le tri et l’export ; les cellules les montrent l’un sous l’autre), `billedText(entry)` (« Facturé : F-… » ou « Brouillon », aussi lu par les cellules de `TimeLog`).
- Internes : `events(entries)` (évènements des temps, options du filtre), `timeColumns(context, comments, routines, entries)`.

### `hooks/use-start-timer.ts`

- `useStartTimer()` : `{ startTimer(input, onStarted?), isPending }` : démarre un chrono, les autres continuent ; toast « Chrono démarré. ».

### `hooks/use-stop-timer.ts`

- `savedTimeMessage(stopped)` : « Temps enregistré : 1 h 05. », la somme des durées enregistrées par l’API (`duration` renvoyé par `stopTimer` / `stopAllTimers`).
- `notifyTimerCap(id, subject?)` : notification « Chrono arrêté après 24 heures » (ce sur quoi il portait, quand il est donné, puis « Sa durée est de 24 heures, le maximum d’un temps. »), une fois par chrono (`timer-cap-<id>`) : `useTimerCapNotice`, et « Arrêter » / « Arrêter tout » sur un chrono que l’API venait d’arrêter après 24 heures.
- `wasStoppedByHand(id)` : le chrono a été arrêté ou abandonné à la main dans cet onglet (« Arrêter », « Arrêter tout », « Abandonner », « Supprimer le temps ») : `useTimerCapNotice` ne le dit pas arrêté après 24 heures. Un arrêt qui échoue (réseau) l’oublie : son arrêt après 24 heures reste annoncé.
- `endTimerByHand(id, run)` : met fin à un chrono à la main autrement qu'en l'arrêtant (abandonné, temps supprimé) : `wasStoppedByHand` le dit fini à la main ; en cas d'échec, il est oublié.
- `useStopTimer(subjectOf?)` : `{ stopTimer(entry), stopAll(entries), isPending }` : arrête ce chrono (les autres continuent), ou tous (« Arrêter tout » : « 2 chronos arrêtés. Temps enregistré : 1 h 40. ») ; le toast compte les chronos que l’API dit avoir arrêtés et leur durée enregistrée, ceux inconnus de l’onglet compris. Un chrono qu’elle n’a pas arrêté et qui avait passé 24 heures (`reachedDurationMax` sur sa durée rechargée, à défaut sur celle de l’onglet : l’API venait de l’arrêter) : `notifyTimerCap`, avec ce sur quoi il portait quand `subjectOf` est donné (`SeveralRunning`, `StopTimerButton`) ; un chrono que « Arrêter tout » a laissé en cours (toujours dans les chronos en cours rechargés, `runningTimersQueryKey` : changé deux fois ailleurs) : « Ce chrono vient d’être modifié : réessayez. » / « Ces chronos viennent d’être modifiés : réessayez. » ; les autres : toast d'information « Ce chrono était déjà arrêté. » / « Ces chronos étaient déjà arrêtés. » (s’il n’y a rien d’autre à dire). Une erreur (« Ce chrono vient d’être modifié : réessayez. », réseau) : toast d’erreur, et les chronos ne sont plus comptés arrêtés à la main.

### `hooks/use-time-dialogs.tsx`

- `useTimeEntryDialogs(context, defaultProjectId?)` : `{ openForm(entry?), duplicate, confirmDelete(entry) }` : formulaire d’un temps dans le panneau (« Ajouter un temps », ou « Temps » pour un temps existant), « Dupliquer » (`DuplicateOptions` de `duplicateRowsAction` : copie enregistrée tout de suite, jamais facturée, durée ramenée de `DURATION_MIN_SECONDS` à `DURATION_MAX_SECONDS`, début reculé quand la copie finirait après maintenant, puis son formulaire ouvert via `cachedItem`) et confirmation de suppression. Utilisé par `TimePage`, `ProjectTimePanel`, l’agenda.

## lib/

### `lib/open-timer-form.tsx`

- `openTimerForm(context, defaultProjectId?)` : ouvre « Nouveau chrono » (`TimerStartForm`) dans le panneau (`panelId: 'new-timer'`), fermé une fois le chrono lancé. Utilisé par `TimeLogActions` et le menu « Ajouter » (`QuickActions`).

### `lib/entry-subject.ts`

- `entrySubject(entry, context)` : sujet d’un temps : le libellé de son projet, sinon de sa première routine, de son premier évènement ou de sa première tâche, suivi de « + N » pour les autres (« Projet » / « Temps » inconnus). Utilisé par l’agenda, le widget, la carte du chrono.

### `lib/time-events.ts`

- `entryEventKeys(entry)` : clés (`occurrenceKey`) des évènements d’un temps.
- `parseEventKeys(keys)` : clés → `TimeEventLink[]` (`{ eventId, occurrenceDate }`).
- `dayEventOptions(events, day, entry?)` : options des évènements d’un jour (« 09:00–10:00 · Titre », « Journée · … », « (annulé) »), plus ceux du temps qui n’y sont pas (sous leur libellé).

### `lib/time-subjects.ts`

- `TIME_SUBJECTS` : pour chaque sorte de sujet (`routines`, `tasks`, `events`), comment la lire d’un temps (`ids`) et l’écrire (`change`) ; l’unique endroit qui le dit. Utilisé par `time-cells.tsx`.
- `TimeSubjectKind` (type) : `'routines' | 'tasks' | 'events'`.
- `hasSubject(entry)` : le temps garde une routine, une tâche ou un évènement. Utilisé par `TimeLog`.

### `lib/time-tasks.ts`

- `timeTasks(context, projectId, keep?)` : tâches sur lesquelles passer du temps dans un projet (projet et sous-projets, et sans projet ; non archivées sauf `keep` ; ouvertes d’abord) ; sans projet, les tâches sans projet (la règle de l’API).
- `timeTaskOptions(context, tasks)` : options d’arbre, les fermées marquées « (fermée) ».
- `timeRoutineOptions(context, routines, projectId, keep?)` : options d’arbre des routines d’un temps, même règle que les tâches.
- Interne : `inTimeProject(context, projectId, keep)` (la règle de l’arborescence, commune aux tâches et aux routines).
