# Code web : routines

Tous les fichiers de `apps/web/src/features/routines/` (api, pages, components, hooks, lib) avec leurs exports et fonctions internes notables. Fonctionnalités : [Routines](../../../features/activities/routines.md) ; règles : [Règles des routines](../../../business-rules/activities/routines.md).

## `api/`

### `api/index.ts`

Requêtes et mutations GraphQL des routines (TanStack Query).

| Export                                   | Rôle                                                                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutineCategory`                        | Type d'une catégorie (`RoutinesDataQuery['routineCategories'][number]`).                                                                                                                  |
| `Routine`                                | Type d'une routine telle que la charge `RoutinesData` (occurrences, moments, coches, état calculés par l'API).                                                                            |
| `routinesKey`                            | Clé de cache `['routines']` ; préfixe aussi des coches et occurrences. Utilisée par `features/time/api` pour rafraîchir.                                                                  |
| `RoutineCheck`                           | Type d'une coche (`routineChecks`).                                                                                                                                                       |
| `useRoutineChecks(from, to)`             | Coches d'une période (historique).                                                                                                                                                        |
| `RoutineOccurrence`                      | Type d'une occurrence (`routineOccurrences`).                                                                                                                                             |
| `useRoutineOccurrences(range, enabled?)` | Occurrences des routines non archivées d'une période (100 jours au plus) ; `range` `null` : rien chargé. Utilisée par l'historique, le formulaire de report, `CalendarPage`, `EventForm`. |
| `useRoutinesData()`                      | Routines et catégories ; rechargées au retour du focus (les occurrences changent avec le jour). Utilisée partout (accueil, agenda, alarmes, temps).                                       |
| `isDraftRoutine(routine)`                | Vrai pour une routine en cours de création (id `draft-…`, affichée avant d'être enregistrée).                                                                                             |
| `RoutinePlace`                           | `'BEFORE' \| 'AFTER' \| 'INSIDE'`.                                                                                                                                                        |
| `RoutineMove`                            | Variables de `move` : `id`, `targetId`, `place`, `categoryIds?`.                                                                                                                          |
| `RoutinePatchValues`                     | Champs d'une édition sur place (`patchRoutine`).                                                                                                                                          |
| `RoutineBulkChanges`                     | Réexport du type partagé des changements en masse.                                                                                                                                        |
| `routineInputOf(routine)`                | Routine en `RoutineInput` complet (annulation, duplication).                                                                                                                              |
| `useRoutineMutations()`                  | Toutes les mutations (voir ci-dessous).                                                                                                                                                   |

Mutations de `useRoutineMutations()` (toutes invalident `routinesKey` en arrière-plan) :

| Clé                                                                    | Mutation                                                    | Mise à jour immédiate du cache                  |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| `createCategory`, `updateCategory`, `deleteCategory`                   | catégories                                                  | —                                               |
| `moveCategory`                                                         | `moveRoutineCategory`                                       | `moveInTree`                                    |
| `create`                                                               | `createRoutine`                                             | ajoute un brouillon (`draftRoutine`)            |
| `update`                                                               | `updateRoutine`                                             | —                                               |
| `copySubRoutines`                                                      | `copySubRoutines`                                           | —                                               |
| `patch`                                                                | `patchRoutine`                                              | fusionne les champs                             |
| `move`                                                                 | `moveRoutine`                                               | `moveInCache`                                   |
| `setDone`                                                              | `setRoutineDone`                                            | `withSlotsDone` (occurrence en cours seulement) |
| `moveOccurrence`, `changeOccurrence`, `deleteOccurrence`, `removeMove` | exceptions                                                  | —                                               |
| `bulkUpdate`                                                           | `bulkUpdateRoutines`                                        | `withBulkChanges`                               |
| `bulkArchive`                                                          | `bulkSetRoutinesArchived`                                   | `archived`                                      |
| `bulkDone`                                                             | `bulkSetRoutinesDone`                                       | tous les moments                                |
| `bulkRemove`                                                           | `bulkDeleteRoutines`                                        | —                                               |
| `restore`                                                              | `updateRoutine` avec `restoring: true`, routine par routine | —                                               |

Fonctions internes : `useRoutineMutation` (mutation invalidante avec cache optimiste), `draftRoutine` (brouillon dernier de ses sœurs), `withSlotsDone` (moments, `done`, `doneDates` recalculés), `patchRoutine` (cache), `moveInCache`, `withBulkChanges`, `fetchChecks`.

## `pages/`

### `pages/RoutinesPage.tsx`

| Export                                       | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutinesPanel({ projectId?, projectIds? })` | Tableau des routines (`DataTable`, vue `routines`) : vues « À faire » et « Toutes » (`ROUTINE_VIEWS`), groupes par catégories, sous-routines sous leur parente, cellules éditables, glisser-déposer (`handleMove`), menu par ligne, ligne d'ajout, barre de sélection. Sur un projet, filtre les routines de `projectIds` et passe `projectId` aux créations. Utilisé ici et dans `features/projects/pages/ProjectPage.tsx`. |
| `RoutinesPage()`                             | Page `/routines` : en-tête, `RoutineSettings`, onglets `routines` / `history` (`ROUTINE_TABS`, `usePageTab`), `RoutineHistory` lié au paramètre `routine`. Route dans `app/router.tsx`.                                                                                                                                                                                                                                      |

Internes : `ROUTINE_VIEWS`, `movedCategories(categoryIds, from, to)` (catégories après un dépôt dans un autre groupe), `cells(routine)`, `actions(routine)`.

## `components/`

### `components/RoutineForm.tsx`

| Export               | Rôle                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutineFormProps`   | `routine?`, `copy?`, `parent?`, `categoryId?`, `projectId?`, `onDone`.                                                                                                                                                                                                                                                                                               |
| `RoutineForm(props)` | Formulaire complet (panneau latéral) : libellé, description markdown, « Quand » (`RoutineSchedule`), fiches (`SheetsSection`), commentaires, projet, catégories (création en ligne), assignés, bénéficiaires, temps, parente, dépendances. Valeurs par défaut reprises de la parente ; copie avec ses sous-routines (`copySubRoutines`). Validé par `routineSchema`. |

Interne : `RoutineFormValues`.

### `components/RoutineSchedule.tsx`

| Export                                                                   | Rôle                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutineRepetitionModal({ routine, opened, onClose, onApply, header? })` | Fenêtre « Répétition et moments de « … » » hors formulaire (cellule « Échéance ») ; `onApply` reçoit la répétition entière. Utilisée par `RepetitionCell`.                                                                                   |
| `RoutineSchedule({ values, errors, onChange })`                          | Bloc « Quand » du formulaire : `RepetitionField` (résumé et fenêtre), lieu (`EventLocation`), trajets (`TravelField`, `TravelCalculator`), rappels (`RemindersSelect`, `ROUTINE_REMINDERS`, désactivés sans horaire), ligne départ / retour. |

Internes : `RoutineScheduleValues`, `RoutineRepetitionValue`, `RoutineTimes`, `ANY_TIME`, `MomentsEditor` (moments avec « Facultatif »), `describeMoments`, `routineTimes(names)` (moments, condition et « à partir du » pour l'éditeur commun), `editedCases`, `fittingOpens`, `withEditedCases`, `RoutineRepetitionEditor` (première fois et `RepetitionEditor` en mode règle ou cas), `describeRepetition`, `routineRepetitionValue`, `validRepetition`.

### `components/OpensOnInput.tsx`

| Export                                                 | Rôle                                                                                                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OpensOnInput({ frequency, value, onChange, error? })` | Champ « À partir du » : modes selon la fréquence, jour, position, jour de semaine, mois, semaine, jours avant. Utilisé par `RoutineSchedule` et `OpensOnCell`. |

Internes : `NONE`, `modeOptions(frequency)`, `firstValue(mode, frequency)`.

### `components/SlotConditionBuilder.tsx`

| Export                                      | Rôle                                                                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SlotConditionBuilder({ value, onChange })` | Condition « Plages de l'agenda » construite avec `FieldsFilterBuilder` (champs `schedules`, `freeTime`) ; un groupe vide renvoie `null`. Plages archivées non proposées sauf celles déjà dans la condition. |

Interne : `OPERATOR_LABELS`.

### `components/SlotTimesFields.tsx`

| Export                                       | Rôle                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SlotTimesFields({ value, onChange, name })` | Deux `TimePicker` « dès » / « avant » d'un moment (`rangeProps` : l'autre suit quand ils se croisent). Utilisé par `MomentsEditor` et `RoutineMoveForm`. |

### `components/RoutineMoveForm.tsx`

| Export                                   | Rôle                                                                                                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutineMoveForm({ routineId, onDone })` | Panneau « Reporter ou annuler » : occurrence (30 jours avant à 68 après), nouvelle date, horaires, « Annuler l'occurrence » (confirmation), liste des exceptions avec « Remettre à son jour ». |

Internes : `shortText`, `PAST_DAYS`, `NEXT_DAYS`, `Times`, `timesOf(occurrence)`.

### `components/RoutineHistory.tsx`

| Export                                     | Rôle                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutineHistory({ routineId, onRoutine })` | Onglet « Historique » : navigation par jour (`PeriodNav`), filtre de routine, calques plages / calendriers (localStorage `ordo.routines.history.layers`), résumé, `RoutineDayAgenda`. |

Interne : `historyItems(occurrences, checks, byId)` (moments prévus du jour, triés par heure puis libellé).

### `components/RoutineDayAgenda.tsx`

| Export                                                  | Rôle                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HistoryItem`                                           | Moment de l'historique : routine, jour, index, horaires, `planned`, `optional`, `movedFrom`, `check`.                                                                     |
| `AgendaLayers`                                          | `{ scheduleIds, calendarIds }` affichés avec les routines.                                                                                                                |
| `RoutineDayAgenda({ day, today, items, byId, layers })` | Agenda FullCalendar d'un jour : créneaux des plages en fond, évènements des calendriers (non archivés), moments des routines colorés par état ; un clic ouvre `TickForm`. |

Internes : `ItemState`, `STATES` (couleur et texte), `historyItemState`, `proposedTime`, `TickForm` (cocher après coup à une heure, changer l'heure, décocher, avec annulation).

### `components/DoneToggle.tsx`

| Export                                                   | Rôle                                                                                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutineDoneToggles({ routine, dateLabel?, disabled? })` | Interrupteur(s) « faite » de l'occurrence en cours : un seul, ou un par moment (facultatif en pointillés). Utilisé par `RoutinesPanel` et `features/home/components/LifeCards.tsx`. |

Interne : `DoneToggle` (`StateSwitch` vert avec coche).

### `components/RoutineBulkBar.tsx`

| Export                         | Rôle                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useRoutineRowsActions()`      | Actions d'une ou plusieurs routines : `done` (cocher / décocher), `postpone`, `duplicate` (avec sous-routines, `outermost`), `archive`, `remove` (confirmation et textes). Les archivées sont exclues sauf pour archiver / supprimer. |
| `useRoutineSelectionActions()` | Liste de ces actions pour la barre de sélection.                                                                                                                                                                                      |

Interne : `RoutineRowsActions`.

### `components/routine-cells.tsx`

Cellules éditables du tableau (toutes passent par `useRoutineCellEdit`, donc par la sélection).

| Export                     | Rôle                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `RoutineLabelCell`         | Libellé : clic ouvre le formulaire, double-clic renomme.                                             |
| `EstimateCell`             | Temps estimé (minutes).                                                                              |
| `CategoriesCell`           | Catégories (chemins, avatars), ajouts / retraits en masse.                                           |
| `AssigneesCell`            | Assignés (contributeurs du ou des projets).                                                          |
| `RequiresCell`             | Dépendances, icône faite / non faite.                                                                |
| `ProjectCell`              | Projet.                                                                                              |
| `RepetitionText`           | Répétition en clair (cas, ou règle et condition), sous le libellé et dans la colonne « Répétition ». |
| `RepetitionCell`           | Bouton ouvrant `RoutineRepetitionModal` (contenu : `StateCell`).                                     |
| `RoutineBeneficiariesCell` | Bénéficiaires (`beneficiariesDiff`).                                                                 |

Interne : `CellProps`.

### `components/extra-cells.tsx`

| Export              | Rôle                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| `ParentRoutineCell` | Parente choisie sur place.                                                                                  |
| `SubRoutinesCell`   | Sous-routines actives et « Ajouter une sous-routine ».                                                      |
| `TimeOfDayCell`     | « À partir de » / « Avant », seulement pour une routine à un seul moment propre.                            |
| `LocationCell`      | Adresse (`AddressInput`), enregistrée au choix d'une proposition ou à l'effacement.                         |
| `TravelCell`        | Trajet aller / retour.                                                                                      |
| `RemindersCell`     | Rappels (badge cloche, `RemindersSelect`), différence appliquée à chaque routine sélectionnée.              |
| `OpensOnCell`       | « À partir du » (pas pour une routine à cas) ; en masse, seulement aux routines dont la fréquence convient. |
| `BlocksCell`        | Routines qui attendent celle-ci ; patch des dépendances des autres routines.                                |

Interne : `hasOwnTimes(routine)`.

### `components/routine-table-cells.tsx`

| Export                                                | Rôle                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `StateCell({ routine, today, doable })`               | Badge d'état (« Fait », « Depuis … », date à venir, ou `DueBadge`) et flèche d'exception. |
| `ChronoCell({ routine, running })`                    | `TimerToggle` et temps passé (ou chrono en cours).                                        |
| `AddRoutineRow({ categoryId, projectId, groupName })` | Ligne d'ajout : routine quotidienne dès aujourd'hui.                                      |

Interne : `DueBadge` (« Après … », « Partir maintenant », « Aujourd'hui … », rafraîchi chaque minute).

### `components/WaitingIcon.tsx`

| Export                     | Rôle                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `WaitingIcon({ waiting })` | Sablier orange « En attente de : … » ; rien sans attente. Utilisé par `RoutinesPanel` et `LifeCards`. |

### `components/RoutineSettings.tsx`

| Export              | Rôle                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `RoutineSettings()` | Barre latérale « Paramètres des routines » : `SettingsList` en arbre des catégories, avec usage, suppression, déplacement. |

### `components/Routines.module.css`

Classes `table` (taille de police), `row` (survol, lignes `data-done` / `data-archived` estompées, libellé barré si fait), `nowrap`.

## `hooks/`

### `hooks/use-routine-move.ts`

| Export                 | Rôle                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useRoutineMove()`     | `(routine, to, date?, onDone?, times?)` : déplace une occurrence (par défaut `movableOccurrence`) avec toast et « Annuler » (mouvement inverse). |
| `usePostponeRoutine()` | `(routine)` : reporte au lendemain. Utilisé par le menu, la barre de sélection et `LifeCards`.                                                   |

Interne : `MovedTimes`.

### `hooks/use-agenda-layers.ts`

| Export                    | Rôle                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `useAgendaLayerOptions()` | Options des calques de l'historique : plages (de l'espace, non archivées, et des espaces suivis) et calendriers (propres et abonnements). |

### `hooks/use-category-items.tsx`

| Export                      | Rôle                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `useRoutineCategoryItems()` | `SettingsItemKind` des catégories (`ROUTINE_CATEGORY`, `routineCategorySchema`, mutations) pour `SettingsList` et la création depuis un select. |

## `lib/`

### `lib/routine-format.ts`

| Export                                           | Rôle                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `DAILY`                                          | Règle « tous les jours » d'une nouvelle routine.                                                                          |
| `ruleOf(routine)`                                | Règle enregistrée, `null` si invalide.                                                                                    |
| `isDone(routine)`                                | Occurrence en cours faite.                                                                                                |
| `currentRoutineState(routine, today, doable?)`   | État du jour ; `due` devient `upcoming` si les plages ne le permettent pas. Utilisé aussi par `LifeCards`.                |
| `routineTreeOptions(routines, offered?, label?)` | Options d'un select en arbre (non proposées grisées). Utilisé aussi par `features/time`.                                  |
| `routinePath(routine, byId)`                     | « Linge › Étendre ».                                                                                                      |
| `waitingFor(routine, byId)`                      | Routines requises encore à faire.                                                                                         |
| `windowOf(routine)`                              | `{ fromTime: windowFrom, dueTime: windowTo }`.                                                                            |
| `scheduleOf(routine)`                            | Départ / retour (`routineSchedule`).                                                                                      |
| `windowText(window)`                             | « 8:20–8:30 », « avant 8:30 », « dès 16:30 », fenêtres jointes par « ou ». Utilisé aussi par les alarmes et l'accueil.    |
| `describeRoutineCase(item, start)`               | Cas en clair.                                                                                                             |
| `movesOf(routine)`                               | Exceptions.                                                                                                               |
| `movableOccurrence(routine)`                     | Occurrence déplaçable : en cours si rien n'est coché, sinon la suivante.                                                  |
| `moveTo(routine, date)`                          | Exception qui a amené une occurrence à ce jour.                                                                           |
| `manualOrder(routines)`                          | Rang de chaque routine dans l'ordre manuel (parent puis enfants). Utilisé par `features/calendar/pages/CalendarPage.tsx`. |

### `lib/routine-view.ts`

| Export                      | Rôle                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `opensWords(routine)`       | « À partir du » de la règle en clair, capitalisé.                                                                                  |
| `ROUTINE_STATE_LABELS`      | « En retard », « À faire », « À venir », « Faite ».                                                                                |
| `REPETITION_LABELS`         | « Chaque jour » … « Selon un planning ».                                                                                           |
| `routineFrequency(routine)` | Fréquence (quotidienne par défaut).                                                                                                |
| `RoutineEnv`                | Ce dont les colonnes ont besoin : `today`, `byId`, `categories`, `context`, `doable`, `comments?`, `slotKinds?`, `beneficiaries?`. |

### `lib/routine-columns.ts`

| Export                | Rôle                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `routineColumns(env)` | Définitions des colonnes du tableau (libellés, tri, texte, filtres, totaux, `groupTree` des catégories, colonne de commentaires). |

Interne : `dayText(date)`.

### `lib/routine-cell-edit.ts`

| Export                                    | Rôle                                                                                                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routinesLabel(count)`                    | « 3 routines ».                                                                                                                                                                                                              |
| `useRoutineCellEdit(routine, column)`     | `{ apply, count, targets }` : applique une édition à la routine ou à la sélection (une requête en masse avec annulation). Les colonnes « Échéance » et « Répétition » partagent la sélection, de même que les deux horaires. |
| `routineCellLabel(field, routine, count)` | Libellé accessible d'une cellule, mentionnant la sélection.                                                                                                                                                                  |

Internes : `RoutineColumn`, `TABLE_COLUMNS`, `useBulkRoutineChanges` (instantané avant, toast « Annuler » via `restore`).

### `lib/opens-format.ts`

| Export                        | Rôle                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `opensText(opens, frequency)` | « le 15 du mois », « le 2e mardi de mars », « 3 jours avant l'échéance », « la veille de l'échéance » ; vide si incompatible. |

### `lib/slot-condition-text.ts`

| Export                                        | Rôle                                                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `emptySlotCondition()`                        | Groupe ET vide.                                                                                                                                            |
| `describeSlotCondition(node, names, nested?)` | Condition en clair (« sur « Déjeuner » ou « Dîner » », « hors de toutes les plages sauf … »), groupes entre parenthèses ; « plage supprimée » si inconnue. |

### `lib/open-routine-form.tsx`

| Export                    | Rôle                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `openRoutineForm(props?)` | Ouvre `RoutineForm` dans le panneau latéral (`lg`) avec le titre adapté. Utilisé aussi par `features/calendar/components/CalendarEditForms.tsx`. |

### `lib/open-routine-move.tsx`

| Export                     | Rôle                                                     |
| -------------------------- | -------------------------------------------------------- |
| `openRoutineMove(routine)` | Ouvre `RoutineMoveForm` (« Reporter ou annuler « … » »). |

## Utilisations hors du dossier

- `features/home/components/LifeCards.tsx` : `useRoutinesData`, `RoutineDoneToggles`, `WaitingIcon`, `usePostponeRoutine`, fonctions de `routine-format`.
- `features/calendar/` : `useRoutineOccurrences`, `useRoutinesData`, `useRoutineMutations`, `manualOrder`, `openRoutineForm`.
- `features/alarms/` : `useRoutinesData`, `useRoutineMutations`, `isDone`, `windowText`.
- `features/time/` : `useRoutinesData`, `routineTreeOptions`, `routinesKey`.
- `features/projects/pages/ProjectPage.tsx` : `RoutinesPanel`.
- `app/router.tsx` : `RoutinesPage`.
