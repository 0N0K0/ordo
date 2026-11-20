# Code web de l’agenda

Référence de chaque fichier de `apps/web/src/features/calendar/` (api, pages, components, hooks, lib) : composants, hooks, fonctions, constantes et types, leur rôle et où ils servent. Fonctionnalités : [Agenda](../../../features/activities/calendar.md) ; règles : [Règles de l’agenda](../../../business-rules/activities/calendar.md).

## api

### `api/index.ts`

Documents GraphQL (fragment `CalendarEventOccurrenceFields`, requêtes `WorkSchedules`, `ForeignScheduleKinds`, `SubscribedWorkSchedules`, `CalendarCategories`, `CalendarEvents`, `Calendars`, `SubscribableCalendars`, `SubscribedCalendarEvents`, mutations des calendriers, catégories, évènements, créneaux, types de créneaux, abonnements) et hooks TanStack Query. Toutes les mutations passent par `useCalendarMutation` (interne) : `useInvalidatingMutation` qui invalide `calendarQueryKey`, et les requêtes `also` données (`tasksQueryKey` pour `update` et `postpone` des évènements : un changement de projet y rattache les contributeurs).

| Export                                                             | Rôle                                                                                                                                                                       | Utilisé par                                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `EventOccurrence` (type)                                           | Occurrence d’évènement (fragment)                                                                                                                                          | partout : agenda, tâches, temps, accueil, alarmes                                 |
| `WorkSchedule`, `ScheduleType` (types)                             | Créneau et type de créneau (requête `WorkSchedules`)                                                                                                                           | gestionnaires, `calendar-events.ts`                                               |
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
| `useWorkSchedules()`                                               | Créneaux (sélection de `WorkSchedules`, avec les `reminders` des éphémérides)                                                                                                | gestionnaires, `AvailabilityHint`, routines, tâches, temps, `AlarmCenter`         |
| `PersonBirthday` (type), `birthdaysQueryKey`, `useBirthdays()` (lot 16) | Anniversaires des personnes (requête `Birthdays` : `id`, `contributorId`, `relationId`, `name`, `birthDate`, `reminders`) ; clé sous celle des tâches (un contributeur changé les recharge ; une relation changée ou archivée aussi, `saveRelation`, `TeamRelations`) | `CalendarPage`, `AlarmCenter`, `lib/calendar-events.ts` |
| `useScheduleTypes()`                                               | Types de créneaux (même requête)                                                                                                                                             | gestionnaires, `useScheduleSources`                                               |
| `useDefaultScheduleKind()`                                         | Type par défaut (créneaux sans type)                                                                                                                                         | `ScheduleSettings`, `WorkSchedulesManager`                                        |
| `useForeignScheduleKinds()`                                        | Types des autres espaces avec abonnement et `archived`                                                                                                                      | `ScheduleSettings`, `useSlotSources`                                              |
| `useOtherWorkspaceSchedules()`                                     | Tous les créneaux des autres espaces de l’utilisateur, archivés compris (`otherWorkspaceSchedules`), abonné ou non                                                      | `useSlotSources`                                                                  |
| `useSubscribedSchedules()`                                         | Créneaux des types abonnés                                                                                                                                                   | `useScheduleSources`, routines                                                    |
| `useScheduleSources()`                                             | `{ schedules, foreign, types, defaultKind }` (undefined pendant le chargement)                                                                                             | `CalendarPage`, `RoutineDayAgenda`                                                |
| `useWorkScheduleMutations()`                                       | `create`, `update`, `remove` des créneaux (dans `withLossConfirmation` : occurrences de routines qui disparaissent confirmées ; les routines rechargées) ; `setEphemeris`, `setTypeEphemeris` (conversions, lot 16, même confirmation) ; `createType`, `updateType`, `removeType` (`ScheduleTypeFields`, la trésorerie rechargée : un type peut être un contexte) ; `subscribe`, `unsubscribe`, `setLook` des abonnements ; `saveDefaultKind`             | gestionnaires, `calendar-edits`, `use-settings-items`                             |
| `scheduleRules(schedules)`                                         | Créneaux (de l’espace ou abonnés) en `WorkScheduleRule` (cas et exceptions validés, invalides ignorés)                                                                      | `AvailabilityHint`, `useSlotRules`, `calendar-events.ts`, `PlannedTime` (temps)   |
| `ruleScheduleInput(rule, change)`                                  | Entrée d’un créneau depuis sa règle et de nouveaux cas/exceptions, type et nature gardés (garde eslint, décision FM)                                                       | `calendar-edits`, `CalendarEditForms`                                             |
| `ScheduleTypeFields` (type)                                        | Champs enregistrés d’un type : libellé, couleur, affichage, `ephemeris`, `budgetContext`, `sharedContext`                                                                  | `use-settings-items`                                                              |
| `calendarIcsUrl(calendarId)`                                       | Adresse `/api/exports/calendar.ics[?calendar=…]`                                                                                                                           | `CalendarsManager`, `CalendarsIcsButton`                                          |

Interne : `fetchCategories`, `occurrencesOf(data, includeArchived)` (filtre des archivées via `archivedIds`/`unarchived`), `useCalendarMutation`.

## pages

### `pages/CalendarPage.tsx`

`CalendarPage()` : la page `/calendar` (route dans `app/router.tsx`). FullCalendar (`dayGrid`, `timeGrid`, `interaction`, locale `fr`).

- État : vue (`useLocalStorage` `ordo.calendar.view`, défaut `timeGridWeek`), filtres (`ordo.calendar.filters`, type interne `Filters` : `tasks`, `routines`, `workHours`, `timers`, `hiddenCalendarIds`, `hiddenScheduleIds`, `fineSlots`, `archived`), dépliage de la ligne journée entière (`ordo.calendar.allDayExpanded`), période (`range`), titre, mode `editingSlots`.
- Paramètre `?date=` : `gotoDate` puis retiré (`useSetParams`).
- Effets : `materialize.mutate(range)` à chaque période ; `changeView` à chaque vue.
- `items` (mémo) : construit les `EventInput` FullCalendar, chacun avec `extendedProps.kind` : `event`, `travel`, `subscribed`, `time`, `editSlot`, `slot` (bandeau), `birthday` (barre d’un anniversaire, lot 16 : un clic ouvre la personne, `usePersonOpener`), fonds de créneaux (sans kind, `display: 'background'`, `slotLane`, `slotColumn`/`slotColumns`), `task` (`part` : `dates`, `open`, `deadline`), `routine`, `routineTravel`. Utilise `occurrenceSpan`, `isArchivedOccurrence`, `scheduleSources`, `slotBarLook`, `slotColumns`, `taskPlacement`, `placeRoutineBlocks`, `manualOrder` (routines), `entryEventKeys`/`entrySubject` (temps : part hors de chacun de ses évènements, rien à côté d’un évènement d’une journée entière), `taggedKey`.
- `handleChange(info)` (interne) : glisser/étirer selon le kind (créneau → `edits.changeSlot`, routine → `edits.changeRoutine`, tâche → `useUpdateTask`, évènement → `askScope` puis `update`) ; `revert()` en cas d’annulation ou d’erreur.
- `select` : ouvre `useEventForm` pré-rempli ; `eventClick` : selon le kind (tâche → `useTaskLink`, temps → `useTimeEntryDialogs`, abonné → `SubscribedEvent` dans `openFormPanel`, créneau → `edits.openSlot`, routine → `edits.openRoutine`, sinon `EventForm`).
- `eventDidMount` : variables CSS `--slot-lane`, `--slot-column`, `--slot-columns`.
- Paramètres : `PageSettings` « Paramètres de l’agenda » avec `SettingsTabs` (`SETTINGS_TABS` = `display`, `settings`, `useSettingsTab`) : `HiddenChecklist` (calendriers, créneaux), interrupteurs, `ShowArchivedSwitch`, export PDF (`useAsyncAction` + `downloadCalendarPdf(pdfItems(items, classes.closed))`), `CalendarsIcsButton` ; `CalendarsManager`, `CalendarCategoriesManager`, `ScheduleSettings`.
- Constantes internes : `VIEWS`, `DEFAULT_COLOR`, `LATE_BORDER` (couleur de retard `LATE_COLOR`, décision DC), `ALL_DAY_ROWS` = 2 ; semaine `timeGridWeek` de `weekLength(currentWeek())` jours, `firstDay` = `pickerFirstDay(week)`.

### `pages/CalendarPage.module.css`

Classes de la page et de FullCalendar : `fill` (semaine/jour pleine hauteur), `calendar`, `calendarStripe` (bordure de calendrier), `recurring`, `closed` (barré), `archived`, `travel` (hachuré), `subscribed`, `timer`, `workHours`, `typedSlot`, `subscribedSlot` (hachuré), `slotBar`, `slotBorderLeft`, `slotBorderBottom`, `slotColumn`, `task`, `deadline`, `routine`, `moved`, `editSlot`. Réutilisé par `RoutineDayAgenda` (routines) et `lib/calendar-events.ts`.

## components

### `components/EventForm.tsx`

- `EventForm({ context, occurrence?, defaults?, onDone, onDuplicated?, scope? })` : formulaire de création (« Créer l’évènement ») ou panneau d’une occurrence enregistré champ par champ (décision D22, `useFieldSave` : textes, liens, lieu et trajets en les quittant, le reste dès qu’il change ; `SaveStatus` en tête), pour la portée choisie à l’ouverture (`scope`, défaut `ALL` ; `null` : question fermée sans choix, lecture seule — `Fieldset` désactivé, texte « Lecture seule : aucune portée n’a été choisie à l’ouverture… », commentaires ouverts, seul « Fermer » en bas). Interne `SaveTarget` : où vont les enregistrements (`eventId`, `occurrenceDate`, `scope`, `ruleStart`), lu dans une référence par chaque enregistrement : après « celle-ci et les suivantes », la nouvelle série (id renvoyé par `update`) est modifiée en entier ; après « toutes », l’occurrence suit son nouveau jour ; « cette occurrence » reste l’exception de son jour. Avec « cette occurrence », les champs de la série (répétition : `EventRepetition` `ruleLocked`, calendrier, projet, contributeurs, bénéficiaires, relations, catégories, tâches, rappels) sont en lecture seule (`Fieldset` `display="contents"`), avec « Cette occurrence seulement : … ». Commentaires de l’occurrence ; commentaires de l’occurrence, `Comments` avec `occurrenceDate`, décision D19), `useAppForm` + `calendarEventInputSchema`. Champs : libellé, `EventRepetition`, `TravelField` ×2 + `TravelCalculator` (geo), `AvailabilityHint`, `EventLocation` (geo, `useFormLocation`), liens (`LinksField`), calendrier (`itemSelectProps`), `ProjectSelect`, `AssigneesSelect`, `BeneficiariesSelect`, relations (`BatchMultiSelect`, `relationNoun`), catégories (`treeSelectProps` + `categoryOptions`, création `itemCreator`), tâches (`timeTaskOptions`/`timeTasks`, `sharePeople`), routines (`useRoutineOccurrences`, `routineLinkKey`/`routineLinkOf`), `RemindersSelect` (préréglages communs, aide selon la journée entière), `MarkdownEditor`. Sections `SheetsSection`, `Comments`. Actions (en bas, plus de bouton « Enregistrer ») : supprimer (`askScope` posée à part pour un récurrent, avec les comptes de chaque portée, quelle que soit la portée de l’ouverture ; sinon `confirmDestructive`), dupliquer (`DuplicateButton` : la copie, champs du formulaire et `copyName`, enregistrée tout de suite par `create`, puis `onDuplicated(id, fields)` ; décision D20), annuler/rétablir (`setCalledOff`, pour la portée choisie à l’ouverture), reporter (`PostponePanel`), démarrer le chrono (`useStartTimer`, sur `events: [occurrence]`), supprimer (temps sans projet emportés : `LostOnDeleteRisk` pour un évènement simple, `fetchTimeLost` des trois portées dans la `note` d’`askScope` pour un récurrent), archiver (`archiveEntry`, `useSetArchived('CALENDAR_EVENT')`). Lecture seule si l’évènement ou son calendrier est archivé (`ArchivedNotice`). Utilisé par `useEventForm`.
- Interne `PostponeForm({ fields, label, loading, onCancel, onConfirm })` : nouvelle date et libellé d’un report (« Report de l’évènement « X » » tenu en `TEXT_MAX` par `fitName`, saisie limitée à `TEXT_MAX`), durée conservée, lendemain par défaut.
- Interne `PostponePanel({ fields, occurrence, onCancel, onDone })` : `PostponeForm` + mutation `postpone`.
- Type interne `FormValues`.

### `components/EventRepetition.tsx`

`EventRepetition({ value, onChange, ruleStart, error?, ruleLocked? })` : champ « Date et répétition » (`RepetitionField` + `RuleEditor` communs, voir [Répétition](../../components/recurrence.md)) : résumé (`eventMomentText`, `describeRecurrence`, `describeDuration`), journée entière, dates (`dateRangeProps`), heures, durée des occurrences (journée entière répétée, `DURATION_UNITS`, `spanEnd`). `ruleLocked` (une occurrence modifiée seule) : la fenêtre ne montre que journée entière, jours et heures, sans la règle. Type interne `EventTiming`. Utilisé par `EventForm`.

### `components/AvailabilityHint.tsx`

`AvailabilityHint({ allDay, startDate, startTime, endDate, endTime })` : avertissement (`NoticeAlert`) quand un évènement à heures d’un jour sort des créneaux de l’espace (PRO seulement ; éphémérides exclues par `slotSchedules`, lot 16) ; utilise `plannedSlots`, `withinSlots`, `plannedPauses`. Utilisé par `EventForm`, `PostponeForm`.

### `components/ScopeChoices.tsx`

- `ScopeQuestion` (interface) : `action` (`update`, `delete`, `cancel`, `restore`, `cancelOrDelete` : une occurrence de routine, « Annuler cette occurrence » ou « Supprimer celle-ci et les suivantes », décision D23), `allowThis`, `allowFollowing`, `allowAll`, `title`, `note` (ce que la modification emporte aussi, après la question : les temps supprimés avec les occurrences).
- `ScopeChoices({ …question, onAnswer })` : texte et boutons « Cette occurrence », « Celle-ci et les suivantes », « Toutes les occurrences » (rouges pour une suppression, décision CN), « Annuler ». Utilisé par `askScope`.

### `components/CalendarEditForms.tsx`

- `SlotEditForm({ label, schedule, slot, scope, onDelete, onClose })` : panneau des horaires d’un créneau un jour donné enregistré champ par champ (décision D22, `useFieldSave` sur `scheduleSlotTimeSchema`, `SaveStatus`) pour la portée choisie à l’ouverture (`null` : lecture seule, texte interne `SLOT_READING_NOTE`, « Fermer » ; textes internes `SLOT_SCOPE_NOTES` : « Ce jour seulement : c’est une exception, les autres jours du créneau ne changent pas. », « Ce jour et les suivants. », « Tous les jours de ces horaires. ») : jour, journée entière, heures (`rangeProps`) ; chaque changement calcule `changedScheduleSlot` depuis le créneau et les horaires tels que le dernier enregistrement les a laissés (référence interne) et enregistre le créneau entier (`useWorkScheduleMutations().update`, qui confirme les occurrences de routines perdues : `withLossConfirmation`, refusée : remis sans toast) ; un changement impossible (hors de la période…) est remis, son message en toast ; plus de bouton « Enregistrer… » ; supprimer (`onDelete(créneau, horaires)` tels qu’ils sont, avec sa propre question de portée).
- `RoutineOccurrenceForm({ occurrence, movedFrom, scope, onDelete, onRestore, onClose })` : panneau d’une occurrence de routine enregistré champ par champ (décision D22, `useFieldSave` sur `routineSlotSchema`, `SaveStatus`) pour la portée choisie à l’ouverture (`null` : question fermée sans choix, champs en lecture seule, texte interne `READING_NOTE`, « Ouvrir la routine » et « Fermer ») (texte interne `SCOPE_NOTES` : « Cette occurrence seulement : c’est une exception, la règle ne change pas. », « Cette occurrence et les suivantes. », « Toutes les occurrences. ») : jour (pas avant le début de la routine), « À partir de », « Avant » (`rangeProps`), enregistrés par `changeOccurrence` depuis le jour où l’occurrence est maintenant (référence interne) ; l’occurrence du cache est suivie (`useCachedItem` sur les requêtes `occurrences` des routines, retrouvée par son jour dans la règle : `movedFrom` ou son jour), y compris déplacée ailleurs ; plus de bouton « Enregistrer… » ; supprimer (portée : annuler celle-ci ou arrêter avant) ; « Ouvrir la routine » (`openRoutineForm`, sur l’occurrence cliquée : `occurrenceDate`). Occurrence annulée (`occurrence.cancelled`, décision D23) : texte, « Fermer », « Rétablir » (`onRestore`) ; d’une routine archivée (`occurrence.archived`, D21, ou routine du cache archivée, `useRoutinesData` : aussi archivée ailleurs, le panneau ouvert, alors qu’une occurrence à venir quitte le cache des occurrences) : lecture seule.

Utilisés par `useCalendarEdits`.

### `components/CalendarsManager.tsx`

- `CalendarsManager()` : sections `OwnCalendars` (confirmation de suppression avec le nombre de temps supprimés, `LostOnDeleteRisk` sur `calendarId`) + `OtherCalendars`. Utilisé par `CalendarPage` (onglet Paramètres).
- Interne `OwnCalendars()` : `SettingsList` genre `CALENDAR` (`calendarFormSchema`, `listMutations`), export ICS par ligne (`IconAction` + `calendarIcsUrl`) et global (`CalendarsIcsButton`), `undeletable` pour le dernier.
- Interne `OtherCalendars()` : `SettingsSection` « Calendriers des autres espaces », `ByWorkspace` + `SubscriptionRow`, état vide.

### `components/CalendarCategoriesManager.tsx`

`CalendarCategoriesManager()` : `SettingsList` imbriquée (`nested`, `storageKey` `calendar-categories`) des catégories, avec `useCalendarCategoryItems`, `remove`, `move`, message de suppression (sous-catégories qui remontent). Utilisé par `CalendarPage`.

### `components/CalendarsIcsButton.tsx`

`CalendarsIcsButton({ disabled? })` : bouton « Tout exporter (.ics) » (`calendarIcsUrl(null)`), le même dans `CalendarsManager` et la section Exporter de `CalendarPage`.

### `components/SubscriptionRow.tsx`

`SubscriptionRow({ label, color, workspaceLabel, hint?, subscribed, onChange, actions?, pl? })` : ligne avatar + libellé + interrupteur « Abonné » d’un élément d’un autre espace (calendrier, type de créneau). Utilisé par `CalendarsManager`, `ScheduleSettings`.

### `components/ByWorkspace.tsx`

`ByWorkspace<T>({ items, workspaceOf, children })` : groupe des éléments d’autres espaces par espace (titre + `WorkspaceKindIcon`), dans l’ordre des éléments. Utilisé par `CalendarsManager`, `ScheduleSettings`.

### `components/SubscribedEvent.tsx`

`SubscribedEvent({ occurrence, subscription, onClose })` : fiche en lecture seule d’un évènement d’un calendrier abonné (moment, lieu, `MarkdownView` sans cibles `NO_TARGETS`, liens `ItemLinks`), bouton « Ouvrir dans « Espace » » (`switchWorkspace` vers `calendarPath`). Interne `when(occurrence)`. Utilisé par `CalendarPage`.

### `components/HiddenChecklist.tsx`

`HiddenChecklist({ label, empty, choices, hidden, disabled?, onChange })` : cases à cocher de ce qui s’affiche (cochée = affiché), conservées comme liste des masqués (`toggledIn`). Utilisé par `CalendarPage`.

### `components/LookToggle.tsx`

- `LookToggle({ label, ariaLabel, opened, onToggle })` : bouton icône ouvrant les réglages d’affichage d’un type.
- `LookPanel({ opened, children })` : panneau repliable teinté de ces réglages.

Utilisés par `ScheduleSettings`.

### `components/ScheduleLookEditor.tsx`

`ScheduleLookEditor({ value, onChange, name })` : affichage d’un type (semaine/jour `DAY_DISPLAYS`, « Bandeau en haut », mois `MONTH_DISPLAYS`), lu par `readScheduleDisplay`. Utilisé par `ScheduleSettings`, `useScheduleTypeItems`.

### `components/ScheduleSettings.tsx`

- `ScheduleSettings()` : `DefaultScheduleKind` + `ScheduleTypes` (créneaux) + `ScheduleTypes` (éphémérides, lot 16) + `ForeignSchedules`. Utilisé par `CalendarPage`.
- Interne `DefaultScheduleKind()` : couleur (`ColorField` non contrôlé, enregistrée par `onCommit`), libellé (badge « Par défaut »), affichage des créneaux sans type (`saveDefaultKind`).
- Interne `ScheduleTypes({ ephemeris })` : `SettingsList` des types d’une nature (`useScheduleTypeItems({ ephemeris })`, `removeType`), badge « Contexte du budget », menu « Convertir en … » (`SettingsList.menuItems`, `useScheduleConversion().type`), message de suppression d’un contexte du budget.
- Interne `ForeignSchedules()` : abonnements aux types des autres espaces (`ByWorkspace`, `SubscriptionRow`, `LookToggle`/`LookPanel`, `setLook`, « Reprendre ceux du type ») ; nombre de créneaux ou d’éphémérides ; rien sans autre espace ayant des créneaux.

### `components/ScheduleRepetition.tsx`

- `ScheduleRepetition({ value, onChange, error? })` : champ « Période et horaires » d’un créneau (`RepetitionField`), résumé (`describeScheduleCase`, `exceptionPeriod`). Utilisé par `ScheduleForm` (`WorkSchedulesManager`).
- Interne `ScheduleRepetitionEditor({ draft, setDraft })` : période (`dateRangeProps`), cas, exceptions (dates, motif, pause, cas propres).
- Interne `ScheduleCases({ cases, onChange, start })` : `RepetitionEditor` commun (modes `RULE`/`CASES`, `multiple`, `DURATION_UNITS`, `SCHEDULE_TIMES`).
- Interne `ScheduleTimesFields({ value, onChange, index })` : journée entière ou tranches horaires (`rangeProps`), « Ajouter des horaires » (propose 14:00–18:00 après une matinée).
- Constante interne `SCHEDULE_TIMES` (`RepetitionTimes<ScheduleTimes>` : rendu, `describeScheduleTimes`, `defaultScheduleTimes`) ; type interne `ScheduleRepetitionValue`.

### `components/WorkSchedulesManager.tsx`

- `WorkSchedulesManager({ ephemeris? })` : gestionnaire des créneaux, ou des éphémérides (lot 16 : mêmes tableau et formulaire, les schedules et types de cette nature ; mots par l’interne `wordsOf(ephemeris, perso)` ; sans type « Sans type », gris `EPHEMERIS_COLOR`) (panneau ouvert par `openSchedulesManager`) : `SectionHeader` (description PRO/PERSO/éphémérides), « Nouveaux créneaux » / « Nouvelle éphéméride », `DataTable` (`useDataView` clé `work-schedules` ou `ephemerides`, colonnes `label`, `type`, `start`, `end`, `hours`, `state`, `commentColumn`), cellules éditables (`EditableText`, `EditableSelect`, `EditableDate`, `followBounds` décision Q), édition groupée (`bulkSaver`, `bulkCellLabels`), sélection (`archiveRowsAction`, `deleteItemsAction`), `RowActions` (modifier, dupliquer, convertir `useScheduleConversion().schedule`, archiver `archiveEntry`, supprimer). Lignes archivées en lecture seule (`readOnlyCells`).
- Interne `scheduleInputOf(schedule)` : entrée d’un créneau tel qu’il est (valeurs de son formulaire, cellules et copie). Interne `duplicateSchedule` : « Dupliquer » (copie « … (copie) » avec ses dates, cas et type, sans exceptions, enregistrée puis ouverte, décision D20).
- Interne `ScheduleForm({ schedule?, ephemeris, onDone })` : formulaire de nouveaux créneaux ou d’une nouvelle éphéméride (« Créer » ; une éphéméride : aujourd’hui, `wholeDaysCase`) ou panneau d’un créneau existant enregistré champ par champ (décision D22, `useFieldSave`, le créneau entier par `update`, qui confirme les occurrences de routines perdues — `withLossConfirmation`, refusée : remis sans toast —, libellé en le quittant, `SaveStatus` ; le créneau du cache `useWorkSchedules` suivi ; archivé : lecture seule) (`workScheduleSchema`) : libellé, type (`CreatableSelect` + `itemCreator`), `ScheduleRepetition`, « Rappels » d’une éphéméride (`RemindersSelect`, lot 16), `Comments` (`SCHEDULE`).
- Interne `scheduleState(schedule, today)` : `CURRENT`/`UPCOMING`/`PAST` (`periodState`).
- Interne `ScheduleHours({ schedule })` : une ligne par cas.
- Constantes et types internes : `ScheduleValues`, `ScheduleState`, `PERIOD_OF`, `STATE_OF`, `STATE_LABELS`, `STATE_COLORS`, `STATE_ORDER`, `ScheduleRow`, `NO_KIND` = `none`.
- Interne au composant : `saveSchedule` (valide avec `workScheduleSchema`, ignore les archivées, toast « … Rien n’a été modifié. »), `openForm`, `deleteSchedules`, `kindLabel`.

### `components/SlotConditionBuilder.tsx`

`SlotConditionBuilder({ value, onChange, item })` : le champ « Créneaux de l’agenda » des tâches et des routines (une seule brique, décision D9), construit avec `FieldsFilterBuilder` : champs « Créneau » (`schedules` : « sur l’un des créneaux », « hors des créneaux »), « Type de créneau » (`kinds` : « sur l’un des types », « hors des types ») et « Temps libre » (`freeTime` : « hors de tous les créneaux », « hors de tous les créneaux sauf ») ; un groupe vide renvoie `null` (« Aucune condition : à n’importe quelle heure. »). Les créneaux et types des autres espaces de l’utilisateur sont proposés avec leur espace (« Sport · Perso ») ; les exceptions du temps libre sont des créneaux de l’espace. Créneaux et types archivés non proposés sauf ceux déjà dans la condition (`useSlotChoices`). `item` (`routine` ou `task`) choisit la phrase qui dit l’effet de la condition (constante interne `EFFECTS`, avec `OPERATOR_LABELS`). Utilisé par `RoutineSchedule` (routines, et chacun de leurs cas), `TaskPanel`, `TaskCreateForm`, `SlotsCell` (tâches). Déplacé de `features/routines/components`. `SlotRuleInput` (règle par types de créneaux) est supprimé.

## hooks

### `hooks/use-event-form.tsx`

`useEventForm(context)` : renvoie `open({ occurrence?, defaults? })` qui ouvre `EventForm` dans `openFormPanel` (taille `lg`, titre « Évènement » ou « Nouvel évènement ») ; une occurrence d’un récurrent qui n’est pas en lecture seule (archivée, ou calendrier archivé : `useCalendars`) demande d’abord la portée, une fois (`askScope`, titre « Ouvrir un évènement récurrent », note « Les modifications faites dans le panneau, chacune enregistrée aussitôt, s’y appliqueront. » ; fermée sans choix : le panneau s’ouvre en lecture seule, `scope` `null`), passée en `scope` (décision D22) ; « Dupliquer » ferme le formulaire et ouvre celui de la copie enregistrée (son occurrence lue par `fetchCalendarEvents` sur ses jours). Sans contexte : rien. Utilisé par `CalendarPage`, `QuickActions` (app), `event-cells` (tâches).

### `hooks/calendar-edits.tsx`

- `RoutineOccurrenceRef` (interface) : `{ routine, date, slot: { index, fromTime, dueTime } }`.
- `useCalendarEdits()` : renvoie `{ changeSlot, changeRoutine, openSlot, openRoutine }` :
  - `changeSlot(schedule, slot, change | null, revert?)` : demande la portée, calcule `changedScheduleSlot`, enregistre (`useWorkScheduleMutations().update`), toasts ;
  - `changeRoutine(occurrence, to, times, revert?)` : portée puis `changeOccurrence` (routines) ;
  - `openSlot(schedule, label, slot)` : demande d’abord la portée (« Modifier un créneau récurrent » ; fermée sans choix : `scope` `null`, panneau en lecture seule), puis panneau `SlotEditForm` (décision D22) ; sa suppression passe par `changeSlot(…, null)` ;
  - `openRoutine(occurrence, movedFrom)` : demande d’abord la portée (« Modifier une routine », sauf occurrence annulée ou d’une routine archivée ; fermée sans choix : `scope` `null`, panneau en lecture seule), puis panneau `RoutineOccurrenceForm` avec elle et `movedFrom` (décision D22) ; « Rétablir » retire l’exception (`removeMove`). `RoutineOccurrenceRef` porte `cancelled` et `archived` (occurrences annulées barrées et non déplaçables ; d’une routine archivée estompées, avec « Afficher les archivés »).
  - Interne `removeRoutine(occurrence, movedFrom)` : portée (`THIS`/`FOLLOWING`), `deleteOccurrence`, annulation via `removeMove` avec les commentaires supprimés (`comments`, décision EV).
- Type interne `RoutineSlotTimes`. Utilisé par `openSchedulesManager`.

### `hooks/use-schedule-conversion.tsx`

`useScheduleConversion()` (lot 16) : `schedule(schedule, type?)` et `type(type, count)`, entrées « Convertir en éphéméride » / « Convertir en créneau » et « Convertir en type d’éphémérides » / « Convertir en type de créneaux » (`ArrowsLeftRightIcon`) : `confirmDestructive({ reversible: true })` qui dit ce qui change (temps libre, heures de travail, type quitté), puis `setEphemeris` / `setTypeEphemeris` (occurrences perdues confirmées par `withLossConfirmation`) ; désactivées une fois archivé, et pour un contexte du budget vers les créneaux. Utilisé par `WorkSchedulesManager`, `ScheduleSettings`.

### `hooks/use-person-opener.tsx`

`usePersonOpener()` (lot 16) : ouvre le panneau de la personne d’un anniversaire (`BirthdayPerson` : `contributorId`, `relationId`) : la relation (`openRelationForm`, paramètres de trésorerie chargés au besoin par `treasurySettingsQuery`), sinon le contributeur (`useContributorForm`). Utilisé par `CalendarPage`, `AlarmCenter`.

### `hooks/use-settings-items.tsx`

- `useCalendarCategoryItems()` : `SettingsItemKind` des catégories (`CALENDAR_CATEGORY`, couleur requise, `calendarCategoryFormSchema`, `itemMutations` + `treeItemInput`). Utilisé par `CalendarCategoriesManager`, `EventForm` (création depuis la liste).
- `useScheduleTypeItems({ ephemeris?, budgetContext? })` : `SettingsItemKind<ScheduleType, ScheduleTypeExtra>` des types (`SCHEDULE_TYPE`, `labelFormSchema`, champs supplémentaires `ScheduleLookEditor` et, pour un type d’éphémérides, « Sert de contexte au budget » / « Partagé entre espaces » ; initial `DEFAULT_SCHEDULE_DISPLAY` et la nature demandée). `ScheduleTypeExtra` : affichage + `ephemeris`, `budgetContext`, `sharedContext`. Utilisé par `ScheduleSettings`, `ScheduleForm`, `Contexts` (trésorerie).

### `hooks/use-slot-rules.ts`

- `Doable` (interface) : `slotCondition?`, `assigneeIds`, `taskId`, `routineId`.
- `routineDoable(routine)` : une routine en `Doable`, sans condition (sa condition garde déjà ses moments) : seuls les évènements qui occupent ses assignés comptent. Utilisé par `AlarmCenter`, `RoutinesPage`, `LifeCards` (accueil), temps.
- `SlotRules` (interface) : `allowed`, `inSlots`, `blocking`, `nextAllowedAt`, `describe` (condition en mots, `describeSlotCondition` ; `null` sans condition).
- `useSlotRules()` : conditions de créneaux de l’espace, les mêmes pour tâches et routines, recalculées chaque minute (`useNow`) : créneaux et types de l’espace et des autres espaces de l’utilisateur, archivés compris, comme l’API (`useSlotSources`, `scheduleSlotsOn`, `conditionAllowsAt`, `nextConditionMoment`), occupation par les évènements (`blockingEvent`, `meId`), prochain moment permis (20 tours max, `busyUntil`). Sans condition : n’importe quand, en PRO comme en PERSO (décision D10). Utilisé par `AlarmCenter`, temps (`features/time/api`), routines, accueil, cellules des tâches.
- Constante interne `LOOKAHEAD_DAYS` = 14.

### `hooks/use-slot-sources.ts`

- `useSlotSources()` : ce qu’une condition de créneaux cite et sur quoi elle s’évalue : créneaux, types et type par défaut de l’espace (`useWorkSchedules`, `useScheduleTypes`, `useDefaultScheduleKind`), créneaux et types des autres espaces (`useOtherWorkspaceSchedules`, `useForeignScheduleKinds`), anniversaires des personnes de l’espace (`useBirthdays`, lot 16c). Utilisé par `useSlotRules` (qui les passe à `scheduleSlotsOn`).
- `useSlotChoices(keep?)` : `slotChoices` sur ces sources. Utilisé par `SlotConditionBuilder`, les routines (`routine-cells`, `RoutinesPage`, `RoutineSchedule`) et `use-task-columns` (tâches).

## lib

### `lib/ask-scope.tsx`

- `askScope(question)` : ouvre `ScopeChoices` dans une modale (`openModal`, au-dessus du panneau), résout la portée ou `null` (fermée). Utilisé par `CalendarPage`, `EventForm` (suppression), `useEventForm` et `calendar-edits` (portée d’un panneau choisie à son ouverture, décision D22), `event-cells` (tâches).

### `lib/scope-title.ts`

`scopeTitle(action)` : titre de la question (« Modifier un évènement récurrent », « Supprimer… », « Annuler… », « Rétablir… »). Constante interne `TITLES`.

### `lib/calendar-events.ts`

- `occurrenceSpan(occurrence)` : début/fin FullCalendar (fin exclusive en journée entière). Utilisé par `CalendarPage`, `RoutineDayAgenda`.
- `isArchivedOccurrence(occurrence, archivedCalendarIds)` : archivée par son évènement ou son calendrier.
- `scheduleLayerLabel(label, type, workspace?)` : « Libellé (Type) · Espace ». Utilisé ici et par `use-agenda-layers` (routines).
- `scheduleSources(own, foreign, types, defaultKind)` : créneaux de l’espace puis abonnés, avec règle, couleur, libellé, `foreign`, `ephemeris`, affichage (une éphéméride sans type : « Éphéméride », `EPHEMERIS_COLOR`). Utilisé par `CalendarPage`, `RoutineDayAgenda`.
- `slotBarLook({ color, foreign, ephemeris? })` : apparence du bandeau d’un créneau. Utilisé par `CalendarPage`, `RoutineDayAgenda`.
- `slotLookClasses({ foreign, ephemeris? })` : classes d’un créneau à part (hachures `subscribedSlot` d’un autre espace, pointillés `ephemeris` et italique `ephemerisBar` d’une éphéméride). Utilisé par `slotBarLook`, `CalendarPage`, `RoutineDayAgenda`.
- `EPHEMERIS_COLOR` : gris des éphémérides sans type. Utilisé ici et par `WorkSchedulesManager`.
- `birthdayEvents(birthdays, from, to, month)` (lot 16) : anniversaires d’une période en `EventInput` : barre `kind: 'birthday'` (« Anniversaire de Paul — 40 ans », `slotBarLook` gris pointillé, ouvre la personne) et fond du jour (semaine, jour) ; barre et fond du jour dans le mois aussi (lot 16c, décision FP). Utilisé par `CalendarPage`.
- Types internes `ForeignSchedule`, `DefaultKind`, `ScheduleSource`.

### `lib/open-schedules.tsx`

`openSchedulesManager(ephemeris, perso)` : ouvre `WorkSchedulesManager` (créneaux ou éphémérides) dans le panneau latéral, taille large. Utilisé par `CalendarPage` (« Créneaux… », « Éphémérides ») et `Contexts` (trésorerie, « Périodes »).

### `lib/calendar-pdf.ts`

- `pdfItems(items, closedClass)` : éléments FullCalendar en éléments du PDF (dates locales, fins journée entière incluses, couleurs résolues ; bandeaux et trajets exclus ; fonds et créneaux édités en `work`).
- `downloadCalendarPdf(view)` : `postExport('/api/exports/calendar.pdf', …)`, fichier « Agenda — <titre>.pdf ».
- Internes : types `PdfKind`, `PdfItem`, `hexColor(color, fallback)` (couleur CSS calculée en `#rrggbb`), `localDateTime(value)`.

### `lib/event-input.ts`

- `routineLinkKey(link)` / `routineLinkOf(key)` : clé `routineId|date` d’un lien de routine (option de liste) et inverse.
- `occurrenceInput(occurrence)` : champs d’une occurrence en `CalendarEventInput` (liens par `linkInputs`). Utilisé par `CalendarPage`, `EventForm`, `event-cells` (tâches).
- Type interne `RoutineLink`.

### `lib/event-moment.ts`

- `EventMoment` (interface) : jours et heures.
- `eventMomentText(moment)` : « Lundi 3 novembre 2026, 09:00 – 10:00 », « …, journée entière », « Du … au … ». Utilisé par `EventRepetition`, `SubscribedEvent`.

### `lib/layer-label.ts`

`inWorkspace(label, workspace?)` : « Libellé · Espace » (décision BG). Utilisé par la page, les abonnements, `calendar-events.ts`, `use-agenda-layers` (routines).

### `lib/routine-layout.ts`

- `RoutineBlock` (interface) : occurrence à heures d’une routine à placer (jour, assignés, fenêtre, minutes, position, routines requises, trajets, `travelWithin`).
- `placeRoutineBlocks(blocks)` : places (`start`, `end`, `leave`, `back`) jour par jour, une chose à la fois par personne, dépendances puis ordre manuel ; au plus tôt dans la fenêtre, ou au plus tard avec seulement une heure limite. Utilisé par `CalendarPage`.
- Internes : `BlockPlace`, `Interval`, `toTime`, `NOBODY`, `inOrder`.

### `lib/slot-columns.ts`

`slotColumns(slots)` : découpe les horaires en fond d’un jour là où les horaires simultanés changent, chaque morceau avec sa colonne et le nombre de colonnes. Types internes `DaySlot`, `SlotPart`. Utilisé par `CalendarPage`.

### `lib/schedule-text.ts`

- `schedulesTitle(perso)` : « Créneaux » / « Créneaux de travail » (brique imposée par une règle eslint). Utilisé par `CalendarPage`, `WorkSchedulesManager`, `PlannedTime` (temps), `openSchedulesManager`.
- `EPHEMERIDES_TITLE` : « Éphémérides ». Utilisé par `CalendarPage`, `WorkSchedulesManager`, `openSchedulesManager`.
- `describeScheduleTimes(times)` : « journée entière », « 09:00–12:30, 14:00–18:00 ».
- `defaultScheduleTimes()` : 09:00–17:00.
- `newScheduleCase(start)` : lundi–vendredi 09:00–17:00.
- `describeScheduleCase(item, start)` : « Toutes les semaines du lundi au vendredi · … » (`describeCase`).
- `exceptionPeriod(exception)` : « le … » ou « du … au … ».

### `lib/slot-choices.ts`

- `SlotSources` (interface) : créneaux, types et type par défaut de l’espace, créneaux et types des autres espaces.
- `SlotChoices` (interface) : options par champ (`schedules`, `kinds`, `freeTime`), `all` (créneaux et types, colonne « Créneaux » des tableaux) et `names` (nom de chaque créneau et type, archivés compris).
- `slotChoices(sources, keep?)` : ce qu’une condition propose (archivés exclus sauf gardés) ; créneaux et types des autres espaces nommés avec leur espace (`inWorkspace`) ; le type par défaut de l’espace d’abord ; éphémérides et types d’éphémérides suivis de « (éphéméride) » (interne `ephemerisLabel`), le temps libre ne proposant que des créneaux (`slotSchedules`) ; anniversaires de l’espace parmi les créneaux (« Anniversaire de Paul (éphéméride) », `birthdaySlotId`) et « Anniversaires (éphéméride) » parmi les types (`BIRTHDAY_SLOT_KIND`, lot 16c). Remplace `scheduleChoices`.

### `lib/slot-condition-text.ts`

| Export                                        | Rôle                                                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `emptySlotCondition()`                        | Groupe ET vide.                                                                                                                                            |
| `describeSlotCondition(node, names, nested?)` | Condition en clair (« sur « Déjeuner » ou « Dîner » », « sur le type « Sport · Perso » », « hors des types … », « hors de tous les créneaux sauf … »), groupes entre parenthèses ; « créneau supprimé » ou « type supprimé » si inconnu, « anniversaire retiré » pour l’anniversaire d’une personne qui n’en a plus (archivée, supprimée). |

Déplacé de `features/routines/lib` : utilisé par `SlotConditionBuilder`, `useSlotRules` et les routines.

### `lib/task-calendar.ts`

- `TaskSpanKind` (type) : `dates` ou `open`.
- `taskPlacement(task, today)` : période, échéance à part (`effectiveDeadline` : la sienne, sinon celle de son sprint unique) et retard d’une tâche dans l’agenda (`isTaskOverdue`). Utilisé par `CalendarPage`.
- Types internes `TaskDates`, `TaskSpan`, `TaskPlacement`.
