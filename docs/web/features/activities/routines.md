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
| `CommentSnapshot`                        | Commentaire supprimé avec une occurrence (texte, dates), rendu par « Annuler » (`removeMove`). |
| `useRoutineChecks(from, to)`             | Coches d'une période (historique).                                                                                                                                                        |
| `RoutineOccurrence`                      | Type d'une occurrence (`routineOccurrences`).                                                                                                                                             |
| `useRoutineOccurrences(range, enabled?)` | Occurrences des routines d'une période (100 jours au plus), les annulées comprises (`cancelled`, écartées de l'historique et du formulaire de report) et celles des routines archivées dues avant leur archivage (`archived`) ; `range` `null` : rien chargé. Utilisée par l'historique, le formulaire de report, `CalendarPage`, `EventForm`. |
| `useRoutinesData()`                      | Routines et catégories ; rechargées au retour du focus (les occurrences changent avec le jour) ; chaque routine telle que les écrans la lisent (interne `fetchRoutinesData`, `routineRow` : ses champs hérités avec la valeur suivie ; la requête lit `inheritedFields`, `inheritance`, `effective`). Utilisée partout (accueil, agenda, alarmes, temps).                                       |
| `fetchRoutine(queryClient, id)`          | Une routine telle que les routines se lisent maintenant (rechargées, même là où elles ne sont pas chargées) : celle qu'une tâche vient de devenir, pour ouvrir son panneau (`useConvertActivity`). |
| `isDraftRoutine(routine)`                | Vrai pour une routine en cours de création (id `draft-…`, affichée avant d'être enregistrée).                                                                                             |
| `RoutineMove`                            | Variables de `move` : `id`, `beforeId` (routine à précéder dans l'ordre global ; `null` : à la fin), `parentId?` (omis : inchangé), `categoryIds?`.                                       |
| `RoutinePatchValues`                     | Champs d'une édition sur place (`patchRoutine`), `inherit` / `clear` compris (héritage rétabli, vidé exprès) ; affichés tout de suite, un champ donné devenu propre (`ownedFields`, `routineFieldsGiven`), comme dans une modification en masse.                                                                                                                                          |
| `RoutineBulkChanges`                     | Réexport du type partagé des changements en masse.                                                                                                                                        |
| `routineInputOf(routine)`                | Routine en `RoutineInput` complet (annulation, duplication) : tous les champs de l’entrée, liens compris (`linkInputs`), priorité et type, bénéficiaires (contributeurs et relations) et « Ouverture » (`opensOn`) compris, et sa liste de champs hérités (`inheritedFields` : une annulation la rend, une copie sous la même parente la garde), et ses exceptions propres (`moves` : une annulation les rend, une copie n’en prend pas). |
| `useRoutineMutations()`                  | Toutes les mutations (voir ci-dessous).                                                                                                                                                   |

Mutations de `useRoutineMutations()` (toutes invalident `routinesKey` en arrière-plan ; `update`, `patch` et `bulkUpdate` aussi `tasksQueryKey`, car un changement de projet y rattache les assignés) :

| Clé                                                                    | Mutation                                                    | Mise à jour immédiate du cache                  |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| `createCategory`, `updateCategory`, `deleteCategory`                   | catégories                                                  | —                                               |
| `moveCategory`                                                         | `moveRoutineCategory`                                       | `moveInTree`                                    |
| `create`                                                               | `createRoutine` (`copyOf` pour une copie : l'API laisse de côté ses anciens liens hors de l'arborescence) | ajoute un brouillon (`draftRoutine`)            |
| `update`                                                               | `updateRoutine` (renvoie `removedLinks`)                    | —                                               |
| `copySubRoutines`                                                      | `copySubRoutines`                                           | —                                               |
| `convertTask`, `convertToTask`                                         | `convertTaskToRoutine`, `convertRoutineToTask` (`withLossConfirmation` avec `conversionDialog` ; rendent l'id du nouvel élément ; invalident aussi `tasksQueryKey` et `timeQueryKey`) | —                                               |
| `patch`                                                                | `patchRoutine` (renvoie `removedLinks`)                     | fusionne les champs                             |
| `move`                                                                 | `moveRoutine`, sous `withLossConfirmation` (une nouvelle parente qui fait perdre des occurrences commentées est confirmée ; refusé, le cache revient) | `moveInCache`                                   |
| `setDone`                                                              | `setRoutineDone`                                            | `withSlotsDone` (occurrence en cours seulement) |
| `moveOccurrence`, `changeOccurrence`, `deleteOccurrence`, `removeMove` | exceptions ; `deleteOccurrence` renvoie `{ archived, comments }`, `removeMove` rend ces `comments` (avec `undo`, « Annuler » d'une annulation ou d'une fusion, « Rétablir » d'une occurrence annulée : l'occurrence revient avec son exception d'avant) ; `update`, `patch`, `bulkUpdate`, `moveOccurrence`, `changeOccurrence` passent par `withLossConfirmation` (sauf `moveOccurrence`) ; `moveOccurrence` et `changeOccurrence` par `withSameDayChoice` (sur un jour qui a son occurrence : « Garder les deux » ou « Fusionner », `sameDay`), et renvoient le jour qui identifie l'occurrence ensuite ; `moveOccurrence` prend aussi `sameDay` donné (l'annulation d'un déplacement) | —                                               |
| `bulkUpdate`                                                           | `bulkUpdateRoutines` (renvoie `removedLinks`)               | `withBulkChanges`                               |
| `bulkArchive`                                                          | `bulkSetRoutinesArchived`                                   | `archiveInCache` (sous-routines, parentes)      |
| `bulkDone`                                                             | `bulkSetRoutinesDone`                                       | tous les moments                                |
| `bulkRemove`                                                           | `bulkDeleteRoutines` (`ids`, `deleteSubRoutines`)           | —                                               |
| `restore`                                                              | `updateRoutine` avec `restoring: true`, routine par routine | —                                               |

Fonctions internes : `useRoutineMutation` (mutation invalidante avec cache optimiste, et d'autres requêtes `also`), `draftRoutine` (brouillon dernier de l'ordre global), `withSlotsDone` (moments, `done`, `doneDates` recalculés), `patchRoutine` (cache), `moveInCache` (ordre global, comme `useMoveTask`), `archiveInCache` (archiver prend les sous-routines, restaurer les parentes), `withBulkChanges`, `fetchChecks`.

## `pages/`

### `pages/RoutinesPage.tsx`

| Export                                       | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutinesPanel({ projectId?, projectIds? })` | Tableau des routines (`DataTable`, vue `routines`) : vues « À faire » et « Toutes » (`ROUTINE_VIEWS`), groupes par catégories, sous-routines sous leur parente, cellules éditables, glisser-déposer (`handleMove` : avant la routine qui suit dans l'ordre global, sous le nouveau parent), menu par ligne, ligne d'ajout, barre de sélection. Sur un projet, filtre les routines de `projectIds` et passe `projectId` aux créations. Utilisé ici et dans `features/projects/pages/ProjectPage.tsx`. |
| `RoutinesPage()`                             | Page `/routines` : en-tête, `PageSettings` « Paramètres des routines » (`RoutineSettings`), onglets `routines` / `history` (`ROUTINE_TABS`, `usePageTab`), `RoutineHistory` lié au paramètre `routine`. Route dans `app/router.tsx`.                                                                                                                                                                                                                                                                                                              |

Internes : `ROUTINE_VIEWS`, `movedCategories(categoryIds, from, to)` (catégories après un dépôt dans un autre groupe), `cells(routine)` (par `inheritedCells` : champs hérités grisés ; interne `routineCells`), `actions(routine)` (« Héritage… » d’une sous-routine compris) (menu d'une ligne, « Transformer en tâche » compris : `useConvertActivity` ; puis les temps morts et les minuteurs enregistrés pour l’occurrence en cours : `useCountdownMenuEntries`).

## `components/`

### `components/RoutineForm.tsx`

| Export               | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutineFormProps`   | `routine?`, `parent?`, `categoryId?`, `projectId?`, `onDone`.                                                                                                                                                                                                                                                                                                                                                                      |
| `RoutineForm(props)` | Formulaire de création (bouton « Créer », en bas) ou panneau d’une routine existante, enregistré champ par champ (`useFieldSave` : libellé, description, temps, liens, lieu et trajets en les quittant, la répétition (`ROUTINE_REPETITION_KEYS`) au `onCommit` de `RoutineRepetition`, le reste dès qu’il change ; enregistrement par `update` avec toute la routine, `formInput`), disposé par `DetailLayout` ([Panneaux](../../components/panels.md#detaillayouttsx)). En-tête : coche faite / à faire de l’occurrence en cours (`RoutineDoneToggles`), « Libellé », menu « … », projet (`ProjectSelect`), badge « Archivée », `SaveStatus`. Colonne principale : description (`FormDescription` : l’éditeur directement quand elle est vide), « Relations » (parente, sous-routines : un bouton par sous-routine qui ouvre son panneau, « Aucune sous-routine. », « Ajouter une sous-routine » (`openRoutineForm`) ; « Dépend de » et « Relative à » : `linkableRoutine`, même arborescence de projets ; « Bloque » d’une routine existante : `blockedRoutineIds`, écrit dans le « Dépend de » des autres routines par `useSetBlockedRoutines`, aussitôt), « Répétition et moments » (`RoutineRepetition`), « Commentaires du … » de l’occurrence (prop `occurrenceDate` donnée par l’agenda, sinon `panelOccurrence` ; `Comments` sans titre propre). Colonne de droite (`PanelGroup`, `PANEL_GROUPS`) : « Classement » (catégories, création en ligne ; « Priorité » héritable et « Type » par `LabelSelect` sur `context.priorities` / `context.types`, création en ligne), « Parties prenantes » (assignés, bénéficiaires), « Planification » (« Première fois » : `DateField` hors de la fenêtre de répétition, temps à y consacrer, temps morts `DeadTimesField` / `routineCountdownItem` sur l’occurrence ouverte, `TrackedTime` d’une routine existante), « Lieu » (`RoutinePlace`), « Alarmes » (`RoutineReminders`, `SavedCountdownsField` `ROUTINE`), « Ressources » (`LinksField` ; `DocumentsField` de [Code web : documents liés](../cross-cutting/documents.md) sur `inProjectTree` du projet du formulaire, `form.setValues` ; ni lien ni document pour une nouvelle sous-routine ; `SheetsSection`). Une sous-routine hérite : nouvelle, les valeurs de la parente (première fois comprise) montrées grisées et toutes héritées, exceptions comprises (`NEW_SUB_ROUTINE_FIELDS`) ; existante, chaque champ hérité grisé « Hérité de … » avec « Vider » / « Rétablir l’héritage » (`InheritedField`, `formInheritance` sur `FORM_COLUMNS`, `inheritedFields` dans les valeurs du formulaire et envoyé avec la routine entière ; « Vider » / « Rétablir » enregistrés aussitôt, lieu compris) ; la première fois à part, le reste de la répétition en bloc (`ROUTINE_REPETITION_FIELDS`). Nouvelle parente choisie : une nouvelle routine hérite de tout, une existante garde ce qu’elle héritait (de la nouvelle). Menu « … » d’une routine existante, hors de la partie en lecture seule (`ActionsMenu`, interne `menu(item)`, comme celui d’une tâche : « Dupliquer », « Archiver » / « Restaurer », « Supprimer » de `useRoutineRowsActions`, `rowMenuEntry`, et « Transformer en tâche » de `useConvertActivity`, puis les temps morts et les minuteurs enregistrés (`useCountdownMenuEntries`) ; archivée : « Restaurer », « Supprimer » ; supprimée ou transformée, son panneau se ferme, `closeRoutinePanels`) ; pas de mode copie. Passée dans une autre arborescence : toast « Routine déplacée. » suivi de `removedLinksNote`. Validé par `routineSchema` ; la routine du cache est suivie (`saved`) ; archivée, aussi ailleurs pendant que le panneau est ouvert, elle est en lecture seule (`readOnly` de `DetailLayout`, plus de `SaveStatus`). |

Internes : `RoutineFormValues`, `routineFormValues(routine)` (valeurs d’une routine existante, sa liste de champs hérités comprise), `formInput(values, inheritedFields)` (entrée de l’API, « Ouverture » retirée si elle ne va plus avec la répétition), `ON_BLUR`, `FORM_COLUMNS`, `FORM_FIELDS`, `pickParent(values)`.

### `components/RoutineSchedule.tsx`

| Export                                                                   | Rôle                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutineRepetitionModal({ routine, opened, onClose, onApply, header? })` | Fenêtre « Répétition et moments de « … » » hors formulaire (cellule « Échéance ») ; `onApply` reçoit la répétition entière. Utilisée par `RepetitionCell`.                                                                                   |
| `RoutineRepetition({ values, errors, onChange, onCommit?, inherited? })`            | « Répétition et moments » du panneau (`inherited` : sous-routine, dans `InheritedField`), directement dans le panneau (`LabeledField` et `RoutineRepetitionEditor`, sans la première fois, montrée à part dans « Planification ») : chaque changement donné aussitôt par `onChange`, `onCommit(ROUTINE_REPETITION_KEYS)` dès qu’un choix est fait (mode, fréquence, cas, « Facultatif », moment ajouté ou retiré, condition, « Ouverture »…) et une heure ou un nombre une fois quitté. |
| `RoutinePlace({ values, errors, onChange, onCommit?, inherited? })`                  | Groupe « Lieu » : lieu (`EventLocation` par `useFormLocation`, hérité dans `InheritedField`), trajets (`TravelTimes`, « Pour y aller » / « Pour en revenir ») et la ligne départ / retour (`routineSchedule`, un seul moment), montrée seulement avec un trajet aller ; `onCommit` enregistre tout de suite le lieu (choisi, vidé ou quitté) et les trajets (quittés ou calculés). |
| `RoutineReminders({ values, errors, onChange })`                                     | « Rappels » (`RemindersSelect` aux quatre repères `ROUTINE_REMINDER_ANCHORS` ; sans aucune heure, seulement à une heure du jour). |

Internes : `RoutineScheduleValues`, `RoutineFieldsProps`, `inheritedProps`, `RoutineRepetitionValue`, `RoutineTimes`, `ANY_TIME`, `MomentsEditor` (moments avec « Facultatif » ; `onCommit` après un choix, une heure quittée), `describeMoments`, `routineTimes(names)` (moments, condition et « Ouverture » pour l'éditeur commun, qui leur passe son `onCommit`), `editedCases`, `fittingOpens`, `withEditedCases`, `RoutineRepetitionEditor` (première fois, sauf `withStart={false}` dans le panneau, et `RepetitionEditor` en mode règle ou cas, `onCommit` transmis), `routineRepetitionValue`, `validRepetition`.

### `components/OpensOnInput.tsx`

| Export                                                 | Rôle                                                                                                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OpensOnInput({ frequency, value, onChange, onCommit?, error? })` | Champ « Ouverture » : modes selon la fréquence, jour, position, jour de semaine, mois, semaine, jours avant ; `onCommit` après un choix, un nombre une fois quitté. Utilisé par la répétition des routines (`RoutineSchedule.tsx`) et `OpensOnCell`. |

Internes : `NONE`, `modeOptions(frequency)`, `firstValue(mode, frequency)`.

### `components/SlotTimesFields.tsx`

| Export                                       | Rôle                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SlotTimesFields({ value, onChange, name, onBlur? })` | Deux `TimePicker` « dès » / « avant » d'un moment (`rangeProps` : l'autre suit quand ils se croisent) ; `onBlur` en quittant l'un d'eux. Utilisé par `MomentsEditor` et `RoutineMoveForm`. |

### `components/RoutineMoveForm.tsx`

| Export                                   | Rôle                                                                                                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutineMoveForm({ routineId, onDone })` | Panneau « Reporter ou annuler » : occurrence (30 jours avant à 68 après, à son échéance, « déplacée du … » pour une occurrence gardée à part ; avec dessous quand elle ouvre : `OccurrenceOpening`), nouvelle date (par défaut le lendemain de son échéance), horaires, « Annuler l'occurrence » (confirmation), liste des exceptions (« à part de celle du jour » pour une occurrence gardée à part) avec « Remettre à son jour ». |

Internes : `shortText`, `PAST_DAYS`, `NEXT_DAYS`, `Times`, `timesOf(occurrence)`.

### `components/OccurrenceOpening.tsx`

| Export                                             | Rôle |
| -------------------------------------------------- | ---- |
| `OccurrenceOpening({ routine, occurrence, children })` | L’échéance d’une occurrence (`children` : le champ ou la ligne qui la montre) avec dessous, en petit et atténué, quand elle ouvre (`occurrenceOpensWords`) ; sans « Ouverture » (ou sans routine ni occurrence), l’échéance seule. Utilisé par `RoutineMoveForm`, `TickForm` (`RoutineDayAgenda`) et `RoutineOccurrenceForm` (agenda). |

### `components/RoutineHistory.tsx`

| Export                                     | Rôle                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutineHistory({ routineId, onRoutine })` | Onglet « Historique » : navigation par jour (`PeriodNav`), filtre de routine, calques créneaux / calendriers (localStorage `ordo.routines.history.layers`), résumé, `RoutineDayAgenda`. |

Le jour vient de `useRoutineDay(day, routineId)`.

### `components/RoutineDayAgenda.tsx`

| Export                                                  | Rôle                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HistoryItem`                                           | Moment de l'historique : routine, jour qui identifie l’occurrence (`date`) et son échéance (`dueDate`, montrée), premier jour de l’occurrence (`startDate`), index, horaires, `planned`, `optional`, `movedFrom`, `check`.                                                                     |
| `AgendaLayers`                                          | `{ scheduleIds, calendarIds }` affichés avec les routines.                                                                                                                |
| `RoutineDayAgenda({ day, today, items, byId, layers })` | Agenda FullCalendar d'un jour, à l'heure de Paris comme l'agenda (`parisCalendarOptions`) : horaires des créneaux en fond, évènements des calendriers (non archivés), moments des routines colorés par état, de leur début à leur fin (`routineSlotSpan` avec `routineMinutes(estimate)` : le temps estimé, 30 min sans lui) ; un clic ouvre `TickForm` (avec `CountdownLaunchButtons` pour l’occurrence : temps morts et minuteurs enregistrés), sauf pour une routine archivée (estompée, « (archivée) », lecture seule). |

Internes : `ItemState`, `STATES` (couleur et texte), `MIDNIGHT` (`24:00`, fin à minuit après le jour), `historyItemState`, `proposedTime`, `TickForm` (jour, horaires et état, avec dessous quand l’occurrence ouvre, `OccurrenceOpening` ; cocher après coup à une heure, changer l'heure, décocher, avec annulation).

### `components/DoneToggle.tsx`

| Export                                                   | Rôle                                                                                                                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutineDoneToggles({ routine, dateLabel?, disabled? })` | Bouton(s) d'état « Faite » / « À faire » de l'occurrence en cours (`ROUTINE_DONE_STATES`) : un seul, ou un par moment (facultatif en pointillés). Utilisé par `RoutinesPanel`, `RoutineForm` et `features/home/components/LifeCards.tsx`. |

Interne : `DoneToggle` (`StateButton` : rond gris vide, puis rond vert coché).

### `components/RoutineBulkBar.tsx`

| Export                         | Rôle                                                                                                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useRoutineRowsActions()`      | Actions d'une ou plusieurs routines : `done` (cocher / décocher), `postpone`, `inheritance` (« Héritage… » des sous-routines, `inheritanceRowsAction` sur `ROUTINE_INHERITANCE_OPTIONS`, `bulkUpdate` avec `inheritFields` / `clearFields`, « Annuler » par `restore`), `duplicate` (`duplicateRowsAction` : enregistrée tout de suite, « … (copie) », avec sous-routines, `outermost` ; liens hors de l'arborescence laissés de côté par l'API, `copyOf` ; la copie d'une seule routine s'ouvre, `cachedItem`), `archive`, `remove` (ouvre `DeleteRoutinesDialog` dans une fenêtre ; une fois supprimées, les panneaux ouverts sur elles se ferment, `closeRoutinePanels`). Les archivées sont exclues sauf pour archiver / supprimer. |
| `useRoutineSelectionActions()` | Liste de ces actions pour la barre de sélection.                                                                                                                                                                                                             |

Interne : `RoutineRowsActions`.

### `components/DeleteRoutinesDialog.tsx`

| Export                                            | Rôle                                                                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DeleteRoutinesDialog({ routines, all, onDone })` | Confirmation de la suppression de routines, comme celle des tâches (`DestructiveRisks`, `CascadeChoice`, `DestructiveActions`) : avec des sous-routines non supprimées avec elles, les conserver (remontées) ou les supprimer ; les temps sans projet supprimés avec elles (`LostOnDeleteRisk`, selon le choix). |

### `components/routine-cells.tsx`

Cellules éditables du tableau (toutes passent par `useRoutineCellEdit`, donc par la sélection).

| Export                     | Rôle                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `RoutineLabelCell`         | Libellé : clic ouvre le formulaire, double-clic renomme.                                                                                     |
| `EstimateCell`             | Temps estimé (minutes).                                                                                                                      |
| `CategoriesCell`           | Catégories (chemins, avatars), ajouts / retraits en masse.                                                                                   |
| `RoutineLabelChipCell`     | `column` `priority` ou `type` : pastille choisie sur place (`ChipChoiceCell`) parmi les listes des tâches (`items`) ; re-choisir la valeur la vide ; sur une sélection, `priorityId` / `typeId` donnés à toutes. |
| `AssigneesCell`            | Assignés (contributeurs du ou des projets).                                                                                                  |
| `RoutineLinksCell`         | `kind` `requires` (« Dépend de », icône faite / non faite) ou `related` (« Relative à ») : routines de son arborescence (`linkableRoutine`). Sur une sélection, les deux passent par une modification en masse (`addRequiredIds` / `removeRequiredIds`, `addRelatedIds` / `removeRelatedIds`) avec « Annuler ». |
| `ProjectCell`              | Projet.                                                                                                                                      |
| `RepetitionText`           | Répétition en clair (un cas par ligne, `StackedLines` ; ou règle et condition), sous le libellé et dans la colonne « Répétition ».                                         |
| `RepetitionCell`           | Bouton ouvrant `RoutineRepetitionModal` (contenu : `StateCell`).                                                                             |
| `RoutineBeneficiariesCell` | Bénéficiaires (`beneficiariesDiff`).                                                                                                         |

Internes : `CellProps`, `LABEL_FIELDS`.

### `components/extra-cells.tsx`

| Export              | Rôle                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ParentRoutineCell` | Parente choisie sur place.                                                                                            |
| `SubRoutinesCell`   | Sous-routines actives et « Ajouter une sous-routine ».                                                                |
| `TimeOfDayCell`     | « À partir de » / « Avant », seulement pour une routine à un seul moment propre.                                      |
| `RoutineLocationCell` | Lieu : `LocationCell` (features/geo) sur la sélection du tableau (`useRoutineCellEdit`).                           |
| `TravelCell`        | Trajet aller / retour.                                                                                                |
| `RemindersCell`     | Rappels (badge cloche, `RemindersSelect` aux quatre repères `ROUTINE_REMINDER_ANCHORS`, une ligne par rappel, bulle de 480 px), différence appliquée à chaque routine sélectionnée. |
| `OpensOnCell`       | « Ouverture » (pas pour une routine à cas) ; en masse, seulement aux routines dont la fréquence convient.           |
| `BlocksCell`        | Routines qui attendent celle-ci (`blockedRoutineIds`, de son arborescence, `linkableRoutine`) ; dépendances des autres routines écrites par `useSetBlockedRoutines` (chaque routine de la sélection). |

Interne : `hasOwnTimes(routine)`.

### `components/routine-table-cells.tsx`

| Export                                                | Rôle                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `StateCell({ routine, today, doable })`               | Badge d'état (« Fait », « Depuis … », date à venir, ou `DueBadge`) et flèche d'exception. |
| `ChronoCell({ routine, running })`                    | `TimerToggle` (chrono démarré sur `routineIds: [id]`) et temps passé (ou le chrono en cours qui porte sur la routine, `runningOn` ; `running` : les chronos en cours). |
| `AddRoutineRow({ categoryId, projectId, groupName })` | Ligne d'ajout : routine quotidienne dès aujourd'hui.                                      |

Interne : `DueBadge` (« D'ici … » pendant l'« Ouverture », « Après … », « Partir maintenant », « Aujourd'hui … », à l'heure de Paris par `parisParts`, rafraîchi chaque minute).

### `components/WaitingIcon.tsx`

| Export                     | Rôle                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `WaitingIcon({ waiting })` | Sablier orange « En attente de : … » ; rien sans attente. Utilisé par `RoutinesPanel` et `LifeCards`. |

### `components/RoutineSettings.tsx`

| Export              | Rôle                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `RoutineSettings()` | Paramètres des routines : `SettingsList` en arbre des catégories (usage, suppression, déplacement), puis `PriorityTypeSettings` (priorités et types, communs avec les tâches), puis en dernier `ColumnDefaults` du tableau `routines` (colonnes `useRoutineColumns`). Utilisé par `RoutinesPage` (dans `PageSettings` « Paramètres des routines ») et l’onglet « Routines » des paramètres d’un projet. |

### `components/Routines.module.css`

Classes `table` (taille de police), `row` (survol, lignes `data-done` / `data-archived` estompées, libellé barré si fait), `nowrap`.

## `hooks/`

### `hooks/use-routine-day.ts`

- `RoutineDay` (interface) : routines, `byId`, moments prévus du jour (`items`), cochés (`doneCount`), chargement.
- `useRoutineDay(day, routineId?)` : chaque moment prévu ce jour-là (`useRoutineOccurrences` du jour, celles dues ce jour-là, annulées écartées, une routine seule ou toutes ; deux occurrences d’une routine ce jour-là, chacune les siens) avec sa coche (`useRoutineChecks` du plus ancien au plus récent des jours qui les identifient : celle d’une occurrence gardée à part est à son jour d’origine, plus tôt ou plus tard), triés par heure puis libellé (interne `historyItems`), et combien sont cochés. Utilisé par `RoutineHistory` (onglet « Historique ») et `RoutinesNavBadge` (barre latérale, aujourd’hui).

### `hooks/use-routine-columns.ts`

| Export | Rôle |
| ------ | ---- |
| `RoutineColumns` (interface) | `columns`, `byId`, `doable(routine)`. |
| `useRoutineColumns(routines, categories, today)` | Colonnes du tableau des routines (`routineColumns`) avec ce qui leur manque : règles des créneaux (`useSlotRules`, `routineDoable`), créneaux et types (`useSlotChoices`), commentaires (`useCommentCounts`, sans les routines en création), bénéficiaires ; aucune colonne sans contexte des tâches. Utilisé par `RoutinesPanel`, `RoutineSettings` (colonnes des nouvelles vues) et la carte « Routines » de l’accueil. |

### `hooks/use-routine-move.ts`

| Export                 | Rôle                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useRoutineMove()`     | `(routine, to, date?, onDone?, times?)` : déplace une occurrence (par défaut `movableOccurrence` ; `date` : le jour qui l’identifie) avec toast et « Annuler » (mouvement inverse, depuis le jour qui l’identifie ensuite, rendu par l’API ; à part de nouveau si elle l’était ; fusionnée : `removeMove` avec `undo`, elle revient avec son exception d’avant la fusion). |
| `usePostponeRoutine()` | `(routine)` : reporte au lendemain de son échéance. Utilisé par le menu, la barre de sélection et `LifeCards` (seulement s’il y a une occurrence à reporter, `movableOccurrence`).                                                   |

Interne : `MovedTimes`.

### `hooks/use-routine-blocks.ts`

| Export                            | Rôle                                                                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useSetBlockedRoutines(routines)` | `(blocked, next, blockers)` : change le « Bloque » de routines : les routines ajoutées dépendent ensuite de chaque routine de `blockers`, les retirées plus ; `patch` de leur `requiredIds` (contrôles de l’API, erreur en toast). Utilisé par `RoutineForm` et `BlocksCell`. |

### `hooks/use-convert-activity.tsx`

| Export                 | Rôle                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useConvertActivity()` | Entrées « Transformer en routine » (`toRoutine(task, hasChildren)`) et « Transformer en tâche » (`toTask(routine, hasChildren)`) des menus « … » : désactivées avec sous-éléments (infobulle) ; confirmation par la mutation (`convertTask` / `convertToTask`) ; ensuite toast, panneau encore ouvert sur l'ancien élément fermé, qu'il vienne de sa ligne ou de son panneau (`?task=` retiré, ou `closeRoutinePanels`), panneau du nouveau ouvert (`fetchRoutine` puis `openRoutineForm` ; tâches rechargées puis `useTaskLink().open`). Utilisé par `useTaskActions().menu`, `RoutinesPanel` (`actions`) et `RoutineForm`. |

### `hooks/use-agenda-layers.ts`

| Export                    | Rôle                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `useAgendaLayerOptions()` | Options des calques de l'historique : créneaux (de l'espace, non archivés, et des espaces suivis) et calendriers (propres et abonnements). |

### `hooks/use-category-items.tsx`

| Export                      | Rôle                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `useRoutineCategoryItems()` | `SettingsItemKind` des catégories (`ROUTINE_CATEGORY`, `routineCategorySchema`, mutations) pour `SettingsList` et la création depuis un select. |

## `lib/`

### `lib/same-day.tsx`

- `askSameDay(day)` : question « Deux occurrences le même jour » (`askChoice`) : « Garder les deux » (`KEEP_BOTH`), « Fusionner » (`MERGE`), « Annuler » (`null`).
- `withSameDayChoice(run)` : lance un déplacement d'occurrence sans réponse (`run()`) ; si l'API répond `CONFIRMATION_REQUIRED` avec `lost.merge` (le jour), pose `askSameDay` puis relance avec la réponse (`run(choice)`) ; « Annuler » : `ActionDeclined` ; les autres refus passent. Utilisé par `moveOccurrence` et `changeOccurrence`.

### `lib/conversion-loss.tsx`

| Export                              | Rôle                                                                                                                                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConversionDirection`               | `'TASK_TO_ROUTINE' \| 'ROUTINE_TO_TASK'`.                                                                                                                                                                                  |
| `conversionDialog(direction, lost)` | Confirmation destructive d'une transformation (`LossDialog` de `withLossConfirmation`) : ce qui se passe, puis « Elle perd : » et la liste de l'extension `lost` (`ConversionLoss`) dans l'ordre de `CONVERSION_LOSSES`, avec les nombres (`countWith`). Internes : `LOSS_TEXT`, `DIRECTIONS`. |

### `lib/routine-inheritance.ts`

Héritage des sous-routines à l’écran (règles : [Héritage](../../../business-rules/activities/routines.md#héritage)).

| Export | Rôle |
| --- | --- |
| `routineRow(routine)` | Routine telle que les écrans la lisent : chaque champ hérité avec la valeur suivie (`inheritedRow` sur `ROUTINE_INHERITED_COLUMNS`), ses horaires ceux de son premier moment. Ses occurrences sont celles que l’API calcule, sur le même « quand » suivi. |
| `ROUTINE_FIELD_LABELS` | Nom de chaque champ hérité. |
| `ROUTINE_INHERITANCE_OPTIONS` | Champs de « Héritage… » : tous les champs hérités (projet, catégories, priorité, assignés, bénéficiaires, lieu, créneaux, « Ouverture », première fois, répétition, cas, moments, exceptions) ; « Vider » sauf pour la première fois et la répétition. |
| `ROUTINE_REPETITION_FIELDS` | Champs de « Répétition et moments » du panneau, hérités et rétablis ensemble : répétition, cas, moments, « Ouverture », condition (la première fois à part). |
| `ROUTINE_REPETITION_KEYS` | Clés du formulaire que « Répétition et moments » change dans le panneau (`recurrence`, `cases`, `slotCondition`, `moments`, `opensOn`), enregistrées ensemble à son `onCommit`. |
| `ROUTINE_CELL_FIELDS` | Champ hérité de chaque colonne du tableau. |
| `routineParentName(routine, byId)` | « « Libellé » », nom de la parente dans les mentions. |

### `lib/routine-format.ts`

| Export                                                 | Rôle                                                                                                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DAILY`                                                | Règle « tous les jours » d'une nouvelle routine (`DAILY_RECURRENCE` partagée).                                                                                                            |
| `ruleOf(routine)`                                      | Règle enregistrée, `null` si invalide.                                                                                                                                                    |
| `isDone(routine)`                                      | Occurrence en cours faite.                                                                                                                                                                |
| `currentRoutineState(routine, today, doable?)`         | État du jour ; `due` devient `upcoming` si les créneaux ne le permettent pas. Utilisé aussi par `LifeCards`.                                                                                |
| `routineTreeOptions(routines, offered?, label?)`       | Options d'un select en arbre (non proposées grisées). Utilisé aussi par `features/time`.                                                                                                  |
| `routinePath(routine, byId)`                           | « Linge › Étendre ».                                                                                                                                                                      |
| `waitingFor(routine, byId)`                            | Routines requises encore à faire.                                                                                                                                                         |
| `blockedRoutineIds(routines, id)`                      | « Bloque » d'une routine : les routines qui dépendent d'elle. Utilisé par `RoutineForm`, `BlocksCell` et les colonnes (`routine-columns`).                                                |
| `linkableRoutine(context, projectId, selfId, linked?)` | Routines proposées pour un lien (« Dépend de », « Bloque », « Relative à ») : pas elle-même, non archivées, de son arborescence de projets (`inProjectTree`) ; celles déjà liées restent. |
| `windowOf(routine)`                                    | `{ fromTime: windowFrom, dueTime: windowTo }`.                                                                                                                                            |
| `scheduleOf(routine)`                                  | Départ / retour (`routineSchedule`).                                                                                                                                                      |
| `windowText(window)`                                   | Réexporté de `@ordo/shared` (aussi les sonneries poussées) : « 8:20–8:30 », « avant 8:30 », « dès 16:30 », fenêtres jointes par « ou ». Utilisé aussi par l'accueil.                                                                    |
| `describeRoutineCase(item, start)`                     | Cas en clair.                                                                                                                                                                             |
| `movesOf(routine)`                                     | Exceptions qu'elle suit (`effective.moves` : celles de la routine dont elle hérite, aucune vidées exprès), comme ses occurrences ; lues par la liste « Exceptions », `moveTo` et « Annuler » d'un déplacement ou d'une fusion. |
| `movableOccurrence(routine)`                           | Occurrence déplaçable : en cours si rien n'est coché, sinon la suivante.                                                                                                                  |
| `panelOccurrence(routine)`                             | Occurrence ouverte par le panneau sans occurrence choisie (ses commentaires) : en cours, sinon la suivante, sinon la première ; `null` sans aucune. Utilisée par `RoutineForm` et la colonne « Commentaires » (`routine-columns.ts`, `RoutinesPage`). |
| `moveTo(routine, date)`                                | Exception qui a amené une occurrence à son jour (`date` : le jour qui l'identifie, `moveKey`).                                                                                            |
| `dueDayOf(routine, date)`                              | Échéance de l'occurrence en cours ou suivante d'après le jour qui l'identifie (`currentDueDate`, `nextDueDate` : une autre seulement pour une occurrence gardée à part sur le jour d'une autre) ; un autre jour est rendu tel quel. Utilisé par `useRoutineMove`, `usePostponeRoutine`, `RoutineMoveForm`. |
| `manualOrder(routines)`                                | Rang de chaque routine dans l'ordre manuel (parent puis enfants, chacun par sa position globale). Utilisé par `features/calendar/pages/CalendarPage.tsx`.                                 |

### `lib/routine-view.ts`

| Export                      | Rôle                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `opensWords(routine)`       | « Ouverture » de la règle en clair, capitalisé.                                                                                  |
| `occurrenceOpensWords(routine, occurrence)` | Quand une occurrence ouvre (`occurrenceOpensText`) : l’« Ouverture » qu’elle suit (celle de son cas, `routineCaseOn` sur son jour dans la règle, sinon de la règle ; la routine lue comme les écrans la lisent, héritage compris) et son premier jour donné par l’API (`startDate` de `routineOccurrences`, jamais recalculé) ; `null` sans « Ouverture ». |
| `ROUTINE_STATE_BADGES`      | États du jour d’une routine dans leur ordre, avec leur pastille (`ColumnState`) : « En retard » (`LATE_COLOR`), « À faire » (bleu, comme le badge d’une routine due aujourd’hui), « À venir » (gris), « Faite » (vert). Colonne « État » (`stateColumn`). Interne : `ROUTINE_STATE_LOOKS`. |
| `REPETITION_LABELS`         | « Chaque jour » … « Selon un planning ».                                                                                           |
| `routineFrequency(routine)` | Fréquence (quotidienne par défaut).                                                                                                |
| `RoutineEnv`                | Ce dont les colonnes ont besoin : `today`, `byId`, `categories`, `context`, `doable`, `comments?`, `slotKinds?`, `beneficiaries?`. |

### `lib/routine-columns.ts`

| Export                | Rôle                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `routineColumns(env)` | Définitions des colonnes du tableau (libellés, tri, texte, filtres, totaux, `groupTree` des catégories, « Priorité » et « Type » des listes des tâches (`context.priorities` / `context.types` : tri dans l’ordre de la liste, filtre `choice`, groupes), « État » par `stateColumn` (`ROUTINE_STATE_BADGES`) ; colonne de commentaires ; « Faite », « En attente », « Faisable maintenant » par `booleanColumn`, nommées « Faites » / « À faire », « En attente » / « Libre » et `DOABLE_GROUP_LABELS` ; « Documents » par `documentsColumn`, [Code web : documents liés](../cross-cutting/documents.md)). |
| `ROUTINE_DONE_STATES` | États du bouton d'état « Faite » d'une routine ou d'un moment : « Faite » / « À faire », « Marquer comme faite » / « Marquer comme à faire ». Utilisé par `DoneToggle`. |

Internes : `dayText(date)`, `labelColumn` (colonne « Priorité » ou « Type »).

### `lib/routine-cell-edit.ts`

| Export                                    | Rôle                                                                                                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routinesLabel(count)`                    | « 3 routines ».                                                                                                                                                                                                              |
| `useRoutineCellEdit(routine, column)`     | `{ apply, count, targets }` : applique une édition à la routine ou à la sélection (une requête en masse avec annulation). Les colonnes « Échéance » et « Répétition » partagent la sélection, de même que les deux horaires. |
| `routineCellLabel(field, routine, count)` | Libellé accessible d'une cellule, mentionnant la sélection.                                                                                                                                                                  |

Internes : `RoutineColumn`, `TABLE_COLUMNS`, `useBulkRoutineChanges` (instantané avant, toast « Annuler » via `restore`, suivi de `removedLinksNote`). Une édition sur place qui retire des liens (changement d'arborescence) le dit : « Routine déplacée. 2 liens retirés. ».

### `lib/opens-format.ts`

| Export                        | Rôle                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `opensText(opens, frequency, { ofDue })` | « le 15 du mois », « le 2e mardi de mars », « 3 jours avant l'échéance », « la veille de l'échéance » ; `ofDue: false` : « 3 jours avant », « la veille » (sous l’échéance) ; vide si incompatible. |
| `occurrenceOpensText(opens, frequency, open, due)` | Ligne d’aide sous l’échéance d’une occurrence : « Ouverte 3 jours avant (le 5 nov.) », « Ouverte dès la veille (le 4 nov.) », « Ouverte dès le 15 du mois (le 15 oct.) », « Ouverte le jour même » (premier jour = échéance) ; vide si incompatible. |

### `lib/open-routine-form.tsx`

| Export                    | Rôle                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `openRoutineForm(props?)` | Ouvre `RoutineForm` dans le panneau latéral (`lg` ; une routine existante : un panneau par routine, d’identifiant `routine-<id>` interne `routinePanelId`, rouvert il se remplace) avec le titre adapté (« Routine » pour une routine existante, « Nouvelle routine », « Nouvelle sous-routine de « … » »). Utilisé aussi par `features/calendar/components/CalendarEditForms.tsx`. |
| `closeRoutinePanels(ids)` | Ferme les panneaux ouverts sur des routines qui n’existent plus (supprimées, transformées en tâche), d’où que vienne l’action (ligne, panneau, sélection). Utilisé par `useRoutineRowsActions().remove` et `useConvertActivity().toTask`. |

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
- `features/projects/components/NavBadges.tsx` : `useRoutineDay`.
- `app/router.tsx` : `RoutinesPage`.
