# Code web de l’agenda

Référence de chaque fichier de `apps/web/src/features/calendar/` (api, pages, components, hooks, lib) : composants, hooks, fonctions, constantes et types, leur rôle et où ils servent. Fonctionnalités : [Agenda](../../../features/activities/calendar.md) ; règles : [Règles de l’agenda](../../../business-rules/activities/calendar.md).

## api

### `api/index.ts`

Documents GraphQL (fragment `CalendarEventOccurrenceFields`, requêtes `WorkSchedules`, `ForeignScheduleKinds`, `SubscribedWorkSchedules`, `CalendarCategories`, `CalendarEvents`, `Calendars`, `SubscribableCalendars`, `SubscribedCalendarEvents`, mutations des calendriers, catégories, évènements, plages, types de plages, abonnements) et hooks TanStack Query. Toutes les mutations passent par `useCalendarMutation` (interne) : `useInvalidatingMutation` qui invalide `calendarQueryKey`, et les requêtes `also` données (`tasksQueryKey` pour `update` et `postpone` des évènements : un changement de projet y rattache les contributeurs).

| Export                                                             | Rôle                                                                                                                                                                       | Utilisé par                                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `EventOccurrence` (type)                                           | Occurrence d’évènement (fragment)                                                                                                                                          | partout : agenda, tâches, temps, accueil, alarmes                                 |
| `WorkSchedule`, `ScheduleType` (types)                             | Plage et type de plage (requête `WorkSchedules`)                                                                                                                           | gestionnaires, `calendar-events.ts`                                               |
| `CalendarEventInput`, `CalendarEventScope` (types réexportés)      | Entrée d’évènement, portée                                                                                                                                                 | formulaires, cellules d’évènements des tâches                                     |
| `calendarQueryKey`                                                 | Clé racine `['calendar']` de toutes les requêtes de l’agenda                                                                                                               | invalidations, `useSetArchived`                                                   |
| `CalendarCategory` (type)                                          | Catégorie d’agenda                                                                                                                                                         | `use-settings-items`, formulaires                                                 |
| `useCalendarCategories()`                                          | Catégories, ordre manuel                                                                                                                                                   | `CalendarPage`, `EventForm`, `CalendarCategoriesManager`                          |
| `useCalendarEvents(range, includeArchived?)`                       | Occurrences d’une période (`null` : désactivé) ; archivées (et celles des calendriers archivés) exclues sauf demande ; garde les données précédentes pendant le chargement | `CalendarPage` (avec archivées), `useSlotRules`, tâches, temps, accueil, routines |
| `fetchCalendarEvents(range, workspace?)`                           | Même chose hors React, dans l’espace courant ou un autre (`executeIn`)                                                                                                     | `AlarmCenter`, `ElsewhereNotifier`                                                |
| `Calendar`, `CalendarSubscription`, `SubscribableCalendar` (types) | Calendrier, abonnement, calendrier abonnable                                                                                                                               | composants                                                                        |
| `useCalendars()`                                                   | Calendriers de l’espace et abonnements (`calendars`, `calendarSubscriptions`)                                                                                              | `CalendarPage`, `EventForm`, `CalendarsManager`, routines                         |
| `useSubscribableCalendars(enabled)`                                | Calendriers des autres espaces avec `subscribed`                                                                                                                           | `CalendarsManager`                                                                |
| `useSubscribedCalendarEvents(range)`                               | Occurrences des calendriers abonnés (`null` : désactivé)                                                                                                                   | `CalendarPage`, `RoutineDayAgenda`                                                |
| `useCalendarMutations()`                                           | `create`, `update`, `remove`, `subscribe`, `unsubscribe` des calendriers                                                                                                   | `CalendarsManager`                                                                |
| `useCalendarCategoryMutations()`                                   | `create`, `update`, `remove`, `move` des catégories                                                                                                                        | `CalendarCategoriesManager`, `use-settings-items`                                 |
| `useCalendarEventMutations()`                                      | `create`, `update` (id, input, scope, occurrenceDate), `remove`, `setCalledOff`, `postpone`                                                                                | `CalendarPage`, `EventForm`, cellules d’évènements des tâches                     |
| `useWorkSchedules()`                                               | Plages (sélection de `WorkSchedules`)                                                                                                                                      | gestionnaires, `AvailabilityHint`, routines, tâches, temps                        |
| `useScheduleTypes()`                                               | Types de plages (même requête)                                                                                                                                             | gestionnaires, `useScheduleSources`                                               |
| `useDefaultScheduleKind()`                                         | Type par défaut (plages sans type)                                                                                                                                         | `ScheduleSettings`, `WorkSchedulesManager`                                        |
| `useForeignScheduleKinds()`                                        | Types des autres espaces avec abonnement                                                                                                                                   | `ScheduleSettings`, `useSlotRules`                                                |
| `useSubscribedSchedules()`                                         | Plages des types abonnés                                                                                                                                                   | `useScheduleSources`, routines                                                    |
| `useScheduleSources()`                                             | `{ schedules, foreign, types, defaultKind }` (undefined pendant le chargement)                                                                                             | `CalendarPage`, `useSlotRules`, `RoutineDayAgenda`                                |
| `useWorkScheduleMutations()`                                       | `create`, `update`, `remove` des plages ; `createType`, `updateType`, `removeType` ; `subscribe`, `unsubscribe`, `setLook` des abonnements ; `saveDefaultKind`             | gestionnaires, `calendar-edits`, `use-settings-items`                             |
| `scheduleRules(schedules)`                                         | Plages (de l’espace ou abonnées) en `WorkScheduleRule` (cas et exceptions validés, invalides ignorés)                                                                      | `AvailabilityHint`, `useSlotRules`, `calendar-events.ts`, `PlannedTime` (temps)   |
| `calendarIcsUrl(calendarId)`                                       | Adresse `/api/exports/calendar.ics[?calendar=…]`                                                                                                                           | `CalendarsManager`, `CalendarsIcsButton`                                          |

Interne : `fetchCategories`, `occurrencesOf(data, includeArchived)` (filtre des archivées via `archivedIds`/`unarchived`), `useCalendarMutation`.

## pages

### `pages/CalendarPage.tsx`

`CalendarPage()` : la page `/calendar` (route dans `app/router.tsx`). FullCalendar (`dayGrid`, `timeGrid`, `interaction`, locale `fr`).

- État : vue (`useLocalStorage` `ordo.calendar.view`, défaut `timeGridWeek`), filtres (`ordo.calendar.filters`, type interne `Filters` : `tasks`, `routines`, `workHours`, `timers`, `hiddenCalendarIds`, `hiddenScheduleIds`, `fineSlots`, `archived`), dépliage de la ligne journée entière (`ordo.calendar.allDayExpanded`), période (`range`), titre, mode `editingSlots`.
- Paramètre `?date=` : `gotoDate` puis retiré (`useSetParams`).
- Effets : `materialize.mutate(range)` à chaque période ; `changeView` à chaque vue.
- `items` (mémo) : construit les `EventInput` FullCalendar, chacun avec `extendedProps.kind` : `event`, `travel`, `subscribed`, `time`, `editSlot`, `slot` (bandeau), fonds de plages (sans kind, `display: 'background'`, `slotLane`, `slotColumn`/`slotColumns`), `task` (`part` : `dates`, `open`, `deadline`), `routine`, `routineTravel`. Utilise `occurrenceSpan`, `isArchivedOccurrence`, `scheduleSources`, `slotBarLook`, `slotColumns`, `taskPlacement`, `placeRoutineBlocks`, `manualOrder` (routines), `entryEventKey`/`entrySubject` (temps), `taggedKey`.
- `handleChange(info)` (interne) : glisser/étirer selon le kind (plage → `edits.changeSlot`, routine → `edits.changeRoutine`, tâche → `useUpdateTask`, évènement → `askScope` puis `update`) ; `revert()` en cas d’annulation ou d’erreur.
- `select` : ouvre `useEventForm` pré-rempli ; `eventClick` : selon le kind (tâche → `useTaskLink`, temps → `useTimeEntryDialogs`, abonné → `SubscribedEvent` dans `openFormPanel`, plage → `edits.openSlot`, routine → `edits.openRoutine`, sinon `EventForm`).
- `eventDidMount` : variables CSS `--slot-lane`, `--slot-column`, `--slot-columns`.
- Paramètres : `PageSettings` « Paramètres de l’agenda » avec `SettingsTabs` (`SETTINGS_TABS` = `display`, `settings`, `useSettingsTab`) : `HiddenChecklist` (calendriers, plages), interrupteurs, `ShowArchivedSwitch`, export PDF (`useAsyncAction` + `downloadCalendarPdf(pdfItems(items, classes.closed))`), `CalendarsIcsButton` ; `CalendarsManager`, `CalendarCategoriesManager`, `ScheduleSettings`.
- Constantes internes : `VIEWS`, `DEFAULT_COLOR`, `LATE_BORDER` (couleur de retard `LATE_COLOR`, décision DC), `ALL_DAY_ROWS` = 2 ; semaine `timeGridWeek` de `weekLength(currentWeek())` jours, `firstDay` = `pickerFirstDay(week)`.

### `pages/CalendarPage.module.css`

Classes de la page et de FullCalendar : `fill` (semaine/jour pleine hauteur), `calendar`, `calendarStripe` (bordure de calendrier), `recurring`, `closed` (barré), `archived`, `travel` (hachuré), `subscribed`, `timer`, `workHours`, `typedSlot`, `subscribedSlot` (hachuré), `slotBar`, `slotBorderLeft`, `slotBorderBottom`, `slotColumn`, `task`, `deadline`, `routine`, `moved`, `editSlot`. Réutilisé par `RoutineDayAgenda` (routines) et `lib/calendar-events.ts`.

## components

### `components/EventForm.tsx`

- `EventForm({ context, occurrence?, defaults?, onDone, onDuplicate? })` : formulaire d’évènement (création, modification d’une occurrence), `useAppForm` + `calendarEventInputSchema`. Champs : libellé, `EventRepetition`, `TravelField` ×2 + `TravelCalculator` (geo), `AvailabilityHint`, `EventLocation` (geo), liens, calendrier (`itemSelectProps`), `ProjectSelect`, `AssigneesSelect`, `BeneficiariesSelect`, relations (`BatchMultiSelect`, `relationNoun`), catégories (`treeSelectProps` + `categoryOptions`, création `itemCreator`), tâches (`timeTaskOptions`/`timeTasks`, `sharePeople`), routines (`useRoutineOccurrences`, `routineLinkKey`/`routineLinkOf`), `RemindersSelect` (`EVENT_REMINDERS`), `MarkdownEditor`. Sections `SheetsSection`, `Comments`. Actions : enregistrer (`chooseScope`, `allowThis` faux si la règle change), supprimer (`askScope` ou `confirmDestructive`), dupliquer, annuler/rétablir (`setCalledOff`), reporter (`PostponePanel`), démarrer le chrono (`useStartTimer`), archiver (`archiveEntry`, `useSetArchived('CALENDAR_EVENT')`). Lecture seule si l’évènement ou son calendrier est archivé (`ArchivedNotice`). Utilisé par `useEventForm`.
- Interne `PostponeForm({ fields, label, loading, onCancel, onConfirm })` : nouvelle date et libellé d’un report (« Report de l’évènement « X » » tenu en `TEXT_MAX` par `fitName`, saisie limitée à `TEXT_MAX`), durée conservée, lendemain par défaut.
- Interne `PostponePanel({ fields, occurrence, onCancel, onDone })` : `PostponeForm` + mutation `postpone`.
- Type interne `FormValues`.

### `components/EventRepetition.tsx`

`EventRepetition({ value, onChange, ruleStart, error? })` : champ « Date et répétition » (`RepetitionField` + `RuleEditor` communs, voir [Répétition](../../components/recurrence.md)) : résumé (`eventMomentText`, `describeRecurrence`, `describeDuration`), journée entière, dates (`dateRangeProps`), heures, durée des occurrences (journée entière répétée, `DURATION_UNITS`, `spanEnd`). Type interne `EventTiming`. Utilisé par `EventForm`.

### `components/AvailabilityHint.tsx`

`AvailabilityHint({ allDay, startDate, startTime, endDate, endTime })` : avertissement (`NoticeAlert`) quand un évènement à heures d’un jour sort des plages de l’espace (PRO seulement) ; utilise `plannedSlots`, `withinSlots`, `plannedPauses`. Utilisé par `EventForm`, `PostponeForm`.

### `components/ScopeChoices.tsx`

- `ScopeQuestion` (interface) : `action` (`update`, `delete`, `cancel`, `restore`), `allowThis`, `allowFollowing`, `allowAll`, `title`.
- `ScopeChoices({ …question, onAnswer })` : texte et boutons « Cette occurrence », « Celle-ci et les suivantes », « Toutes les occurrences » (rouges pour une suppression, décision CN), « Annuler ». Utilisé par `askScope`.

### `components/CalendarEditForms.tsx`

- `SlotEditForm({ label, slot, onSave, onDelete, onClose })` : jour, journée entière, heures (`rangeProps`) d’un créneau de plage ; supprimer.
- `RoutineOccurrenceForm({ occurrence, onSave, onDelete, onClose })` : jour (pas avant le début de la routine), « À partir de », « Avant » (`rangeProps`, `rangeError`) d’une occurrence de routine ; supprimer ; « Ouvrir la routine » (`openRoutineForm`).

Utilisés par `useCalendarEdits`.

### `components/CalendarsManager.tsx`

- `CalendarsManager()` : sections `OwnCalendars` + `OtherCalendars`. Utilisé par `CalendarPage` (onglet Paramètres).
- Interne `OwnCalendars()` : `SettingsList` genre `CALENDAR` (`calendarFormSchema`, `listMutations`), export ICS par ligne (`IconAction` + `calendarIcsUrl`) et global (`CalendarsIcsButton`), `undeletable` pour le dernier.
- Interne `OtherCalendars()` : `SettingsSection` « Calendriers des autres espaces », `ByWorkspace` + `SubscriptionRow`, état vide.

### `components/CalendarCategoriesManager.tsx`

`CalendarCategoriesManager()` : `SettingsList` imbriquée (`nested`, `storageKey` `calendar-categories`) des catégories, avec `useCalendarCategoryItems`, `remove`, `move`, message de suppression (sous-catégories qui remontent). Utilisé par `CalendarPage`.

### `components/CalendarsIcsButton.tsx`

`CalendarsIcsButton({ disabled? })` : bouton « Tout exporter (.ics) » (`calendarIcsUrl(null)`), le même dans `CalendarsManager` et la section Exporter de `CalendarPage`.

### `components/SubscriptionRow.tsx`

`SubscriptionRow({ label, color, workspaceLabel, hint?, subscribed, onChange, actions?, pl? })` : ligne avatar + libellé + interrupteur « Abonné » d’un élément d’un autre espace (calendrier, type de plage). Utilisé par `CalendarsManager`, `ScheduleSettings`.

### `components/ByWorkspace.tsx`

`ByWorkspace<T>({ items, workspaceOf, children })` : groupe des éléments d’autres espaces par espace (titre + `WorkspaceKindIcon`), dans l’ordre des éléments. Utilisé par `CalendarsManager`, `ScheduleSettings`.

### `components/SubscribedEvent.tsx`

`SubscribedEvent({ occurrence, subscription, onClose })` : fiche en lecture seule d’un évènement d’un calendrier abonné (moment, lieu, `MarkdownView` sans cibles `NO_TARGETS`, liens `EXTERNAL_LINK`), bouton « Ouvrir dans « Espace » » (`switchWorkspace` vers `calendarPath`). Interne `when(occurrence)`. Utilisé par `CalendarPage`.

### `components/HiddenChecklist.tsx`

`HiddenChecklist({ label, empty, choices, hidden, disabled?, onChange })` : cases à cocher de ce qui s’affiche (cochée = affiché), conservées comme liste des masqués (`toggledIn`). Utilisé par `CalendarPage`.

### `components/LookToggle.tsx`

- `LookToggle({ label, ariaLabel, opened, onToggle })` : bouton icône ouvrant les réglages d’affichage d’un type.
- `LookPanel({ opened, children })` : panneau repliable teinté de ces réglages.

Utilisés par `ScheduleSettings`.

### `components/ScheduleLookEditor.tsx`

`ScheduleLookEditor({ value, onChange, name })` : affichage d’un type (semaine/jour `DAY_DISPLAYS`, « Bandeau en haut », mois `MONTH_DISPLAYS`), lu par `readScheduleDisplay`. Utilisé par `ScheduleSettings`, `useScheduleTypeItems`.

### `components/ScheduleSettings.tsx`

- `ScheduleSettings()` : `DefaultScheduleKind` + `ScheduleTypes` + `ForeignSchedules`. Utilisé par `CalendarPage`.
- Interne `DefaultScheduleKind()` : couleur (`ColorField`), libellé (badge « Par défaut »), affichage des plages sans type (`saveDefaultKind`).
- Interne `ScheduleTypes()` : `SettingsList` des types (`useScheduleTypeItems`, `removeType`).
- Interne `ForeignSchedules()` : abonnements aux types des autres espaces (`ByWorkspace`, `SubscriptionRow`, `LookToggle`/`LookPanel`, `setLook`, « Reprendre ceux du type ») ; rien sans autre espace ayant des plages.

### `components/ScheduleRepetition.tsx`

- `ScheduleRepetition({ value, onChange, error? })` : champ « Période et horaires » d’une plage (`RepetitionField`), résumé (`describeScheduleCase`, `exceptionPeriod`). Utilisé par `ScheduleForm` (`WorkSchedulesManager`).
- Interne `ScheduleRepetitionEditor({ draft, setDraft })` : période (`dateRangeProps`), cas, exceptions (dates, motif, pause, cas propres).
- Interne `ScheduleCases({ cases, onChange, start })` : `RepetitionEditor` commun (modes `RULE`/`CASES`, `multiple`, `DURATION_UNITS`, `SCHEDULE_TIMES`).
- Interne `ScheduleTimesFields({ value, onChange, index })` : journée entière ou tranches horaires (`rangeProps`), « Ajouter des horaires » (propose 14:00–18:00 après une matinée).
- Constante interne `SCHEDULE_TIMES` (`RepetitionTimes<ScheduleTimes>` : rendu, `describeScheduleTimes`, `defaultScheduleTimes`) ; type interne `ScheduleRepetitionValue`.

### `components/WorkSchedulesManager.tsx`

- `WorkSchedulesManager()` : gestionnaire des plages (panneau ouvert par `CalendarPage`) : `SectionHeader` (description PRO/PERSO), « Nouvelles plages », `DataTable` (`useDataView` clé `work-schedules`, colonnes `label`, `type`, `start`, `end`, `hours`, `state`, `commentColumn`), cellules éditables (`EditableText`, `EditableSelect`, `EditableDate`, `followBounds` décision Q), édition groupée (`bulkSaver`, `bulkCellLabels`), sélection (`archiveRowsAction`, `deleteItemsAction`), `RowActions` (modifier, dupliquer, archiver `archiveEntry`, supprimer). Lignes archivées en lecture seule (`readOnlyCells`).
- Interne `ScheduleForm({ schedule?, copyOf?, onDone })` : formulaire (`workScheduleSchema`) : libellé, type (`CreatableSelect` + `itemCreator`), `ScheduleRepetition`, `Comments` (`SCHEDULE`).
- Interne `scheduleState(schedule, today)` : `CURRENT`/`UPCOMING`/`PAST` (`periodState`).
- Interne `ScheduleHours({ schedule })` : une ligne par cas.
- Constantes et types internes : `ScheduleValues`, `ScheduleState`, `PERIOD_OF`, `STATE_OF`, `STATE_LABELS`, `STATE_COLORS`, `STATE_ORDER`, `ScheduleRow`, `NO_KIND` = `none`.
- Interne au composant : `saveSchedule` (valide avec `workScheduleSchema`, ignore les archivées, toast « … Rien n’a été modifié. »), `openForm`, `deleteSchedules`, `kindLabel`.

### `components/SlotRuleInput.tsx`

`SlotRuleInput({ value, onChange, error?, disabled? })` : champ « Plages » d’une tâche ou routine (« Par défaut de l’espace (…) » / « Choisies », « Pendant », « Hors de »), options groupées par espace, archivées exclues sauf choisies (`unarchived`). Utilise `useSlotRules`. Utilisé par `TaskPanel`, `TaskCreateForm`, `extra-cells` (tâches), routines.

## hooks

### `hooks/use-event-form.tsx`

`useEventForm(context)` : renvoie `open({ occurrence?, defaults?, copy? })` qui ouvre `EventForm` dans `openFormPanel` (taille `lg`) ; « Dupliquer » ferme et rouvre une copie. Sans contexte : rien. Utilisé par `CalendarPage`, `QuickActions` (app), `event-cells` (tâches).

### `hooks/calendar-edits.tsx`

- `RoutineOccurrenceRef` (interface) : `{ routine, date, slot: { index, fromTime, dueTime } }`.
- `useCalendarEdits()` : renvoie `{ changeSlot, changeRoutine, openSlot, openRoutine }` :
  - `changeSlot(schedule, slot, change | null, revert?)` : demande la portée, calcule `changedScheduleSlot`, enregistre (`useWorkScheduleMutations().update`), toasts ;
  - `changeRoutine(occurrence, to, times, revert?)` : portée puis `changeOccurrence` (routines) ;
  - `openSlot(schedule, label, slot)` : panneau `SlotEditForm` ;
  - `openRoutine(occurrence, movedFrom)` : panneau `RoutineOccurrenceForm`.
  - Interne `removeRoutine(occurrence, movedFrom)` : portée (`THIS`/`FOLLOWING`), `deleteOccurrence`, annulation via `removeMove`.
- Type interne `RoutineSlotTimes`. Utilisé par `CalendarPage`.

### `hooks/use-settings-items.tsx`

- `useCalendarCategoryItems()` : `SettingsItemKind` des catégories (`CALENDAR_CATEGORY`, couleur requise, `calendarCategoryFormSchema`, `itemMutations` + `treeItemInput`). Utilisé par `CalendarCategoriesManager`, `EventForm` (création depuis la liste).
- `useScheduleTypeItems()` : `SettingsItemKind` des types (`SCHEDULE_TYPE`, `labelFormSchema`, champ supplémentaire `ScheduleLookEditor`, initial `DEFAULT_SCHEDULE_DISPLAY`). Utilisé par `ScheduleSettings`, `ScheduleForm`.

### `hooks/use-slot-rules.ts`

- `Doable` (interface) : `slotRule`, `assigneeIds`, `taskId`, `routineId`.
- `routineDoable(routine)` : une routine en `Doable`. Utilisé par `AlarmCenter`, `RoutinesPage`, `LifeCards` (accueil).
- `SlotRules` (interface) : `kinds`, `defaultRule`, `ruleOf`, `allowed`, `inSlots`, `blocking`, `nextAllowedAt`, `describe`.
- `useSlotRules()` : règles de plages de l’espace, recalculées chaque minute (`useNow`) : genres proposés (cet espace + abonnés), créneaux d’hier à J+14 (`kindedSlots`), occupation par les évènements (`blockingEvent`, `meId`), prochain moment permis (20 tours max, `busyUntil`). Utilisé par `SlotRuleInput`, `AlarmCenter`, temps (`features/time/api`), routines, accueil, cellules des tâches.
- Constante interne `LOOKAHEAD_DAYS` = 14 ; interface interne `SlotKindOption`.

## lib

### `lib/ask-scope.tsx`

- `askScope(question)` : ouvre `ScopeChoices` dans une modale (`openModal`, au-dessus du panneau), résout la portée ou `null` (fermée). Utilisé par `CalendarPage`, `EventForm`, `calendar-edits`, `event-cells` (tâches).
- `chooseScope(recurring, question)` : `ALL` pour un évènement unique, sinon `askScope`.

### `lib/scope-title.ts`

`scopeTitle(action)` : titre de la question (« Modifier un évènement récurrent », « Supprimer… », « Annuler… », « Rétablir… »). Constante interne `TITLES`.

### `lib/calendar-events.ts`

- `occurrenceSpan(occurrence)` : début/fin FullCalendar (fin exclusive en journée entière). Utilisé par `CalendarPage`, `RoutineDayAgenda`.
- `isArchivedOccurrence(occurrence, archivedCalendarIds)` : archivée par son évènement ou son calendrier.
- `scheduleLayerLabel(label, type, workspace?)` : « Libellé (Type) · Espace ». Utilisé ici et par `use-agenda-layers` (routines).
- `scheduleSources(own, foreign, types, defaultKind)` : plages de l’espace puis abonnées, avec règle, couleur, libellé, `foreign`, affichage. Utilisé par `CalendarPage`, `RoutineDayAgenda`.
- `slotBarLook({ color, foreign })` : apparence du bandeau d’une plage. Utilisé par `CalendarPage`, `RoutineDayAgenda`.
- Types internes `ForeignSchedule`, `DefaultKind`, `ScheduleSource`.

### `lib/calendar-pdf.ts`

- `pdfItems(items, closedClass)` : éléments FullCalendar en éléments du PDF (dates locales, fins journée entière incluses, couleurs résolues ; bandeaux et trajets exclus ; fonds et plages éditées en `work`).
- `downloadCalendarPdf(view)` : `postExport('/api/exports/calendar.pdf', …)`, fichier « Agenda — <titre>.pdf ».
- Internes : types `PdfKind`, `PdfItem`, `hexColor(color, fallback)` (couleur CSS calculée en `#rrggbb`), `localDateTime(value)`.

### `lib/event-input.ts`

- `routineLinkKey(link)` / `routineLinkOf(key)` : clé `routineId|date` d’un lien de routine (option de liste) et inverse.
- `LOCAL_TIME_ZONE` : fuseau du navigateur, celui des nouveaux évènements.
- `occurrenceInput(occurrence)` : champs d’une occurrence en `CalendarEventInput`. Utilisé par `CalendarPage`, `EventForm`, `event-cells` (tâches).
- Type interne `RoutineLink`.

### `lib/event-moment.ts`

- `EventMoment` (interface) : jours et heures.
- `eventMomentText(moment)` : « Lundi 3 novembre 2026, 09:00 – 10:00 », « …, journée entière », « Du … au … ». Utilisé par `EventRepetition`, `SubscribedEvent`.

### `lib/layer-label.ts`

`inWorkspace(label, workspace?)` : « Libellé · Espace » (décision BG). Utilisé par la page, les abonnements, `useSlotRules`, `calendar-events.ts`, `use-agenda-layers` (routines).

### `lib/routine-layout.ts`

- `RoutineBlock` (interface) : occurrence à heures d’une routine à placer (jour, assignés, fenêtre, minutes, position, routines requises, trajets, `travelWithin`).
- `placeRoutineBlocks(blocks)` : places (`start`, `end`, `leave`, `back`) jour par jour, une chose à la fois par personne, dépendances puis ordre manuel ; au plus tôt dans la fenêtre, ou au plus tard avec seulement une heure limite. Utilisé par `CalendarPage`.
- Internes : `BlockPlace`, `Interval`, `toTime`, `NOBODY`, `inOrder`.

### `lib/slot-columns.ts`

`slotColumns(slots)` : découpe les créneaux en fond d’un jour là où les créneaux simultanés changent, chaque morceau avec sa colonne et le nombre de colonnes. Types internes `DaySlot`, `SlotPart`. Utilisé par `CalendarPage`.

### `lib/schedule-text.ts`

- `schedulesTitle(perso)` : « Plages » / « Plages de travail » (brique imposée par une règle eslint). Utilisé par `CalendarPage`, `WorkSchedulesManager`, `PlannedTime` (temps).
- `describeScheduleTimes(times)` : « journée entière », « 09:00–12:30, 14:00–18:00 ».
- `defaultScheduleTimes()` : 09:00–17:00.
- `newScheduleCase(start)` : lundi–vendredi 09:00–17:00.
- `describeScheduleCase(item, start)` : « Toutes les semaines du lundi au vendredi · … » (`describeCase`).
- `exceptionPeriod(exception)` : « le … » ou « du … au … ».

### `lib/schedule-choices.ts`

`scheduleChoices(schedules, keep?)` : options d’une liste de plages (archivées exclues sauf gardées) et noms par id. Utilisé par les routines (`SlotConditionBuilder`, `routine-cells`, `RoutinesPage`, `RoutineSchedule`) et `use-task-columns` (tâches).

### `lib/task-calendar.ts`

- `TaskSpanKind` (type) : `dates` ou `open`.
- `taskPlacement(task, today)` : période, échéance à part et retard d’une tâche dans l’agenda (`isTaskOverdue`). Utilisé par `CalendarPage`.
- Types internes `TaskDates`, `TaskSpan`, `TaskPlacement`.
