# Code web — Tâches

Tous les fichiers de `apps/web/src/features/tasks/` et ce qu’ils exportent : requêtes et mutations (`api`), page, composants (tableau, panneau, cellules, formulaires, jalons, sprints, contributeurs), hooks et fonctions (`lib`). Ce module porte aussi le **contexte des tâches** (`useTaskContext`) utilisé par presque toutes les autres fonctionnalités.

Fonctionnalités : [Tâches](../../../features/activities/tasks.md). Règles : [Règles métier — Tâches](../../../business-rules/activities/tasks.md). Briques partagées utilisées : [Tableaux](../../components/data-table.md), [Actions](../../components/actions.md), [Dialogues](../../components/dialogs.md), [Panneaux](../../components/panels.md), [Personnes](../../components/people.md), [Markdown](../../components/markdown.md), [Commentaires](../../components/comments.md), [Paramètres](../../components/settings.md), [Arbres](../../components/tree.md), [Glisser-déposer](../../components/dnd.md), [Bibliothèque web](../../lib.md). Partagé : [shared/tasks](../../../shared/activities/tasks.md).

## api/

### `api/index.ts`

Requêtes GraphQL (documents `graphql(...)`) et hooks TanStack Query des tâches. Clé de cache principale : `tasksQueryKey = ['tasks']`, invalidée par toutes les mutations du module (`useTasksMutation`, interne).

Fragments : `ContributorFields`, `SprintFields`, `MilestoneFields`, `TaskLabelFields` (sur `TaskStatus`, réutilisé pour priorités, types, étiquettes), `TaskFields`, `TaskCommentFields`. Requête `TasksData` : `tasks`, `contributors`, `taskStatuses` (+ `category`), `taskPriorities`, `taskTypes`, `taskTags`, `milestones`, `sprints`.

Types exportés :

| Nom                   | Rôle                                                                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `Task`                | Fragment `TaskFields` (tous les champs d’une tâche lus par le web, lieu et liens compris).                                                                             |
| `TaskComment`         | Fragment `TaskCommentFields` (`id`, `body`, `createdAt`, `githubAuthor`).                                                                       |
| `Contributor`         | Fragment `ContributorFields` (avec `link`, `relationId`, `contactId`, `linkName`, et les coordonnées et l’anniversaire de ce à quoi il est lié).                                                                                                                   |
| `TaskLabel`           | Fragment `TaskLabelFields` (priorité, type, étiquette, statut sans catégorie).                                                                  |
| `TaskStatus`          | Statut avec sa `category`.                                                                                                                      |
| `Milestone`, `Sprint` | Fragments des jalons et sprints.                                                                                                                |
| `TaskStatusCategory`  | Ré-export du type GraphQL.                                                                                                                      |
| `TaskInputValues`     | Champs envoyés à la création / modification (`TaskInput` partagé).                                                                              |
| `TaskSave`            | Enregistrement immédiat d’un changement depuis le panneau (`updateTask.mutateAsync`), donné à `TaskDescription` et `TaskLinks`.                 |
| `TaskLabelKind`       | `'status' \| 'priority' \| 'type' \| 'tag'` (clés de `LabelDocuments`).                                                                         |
| `BulkChanges`         | Changements d’une modification en masse : `TaskBulkChanges` partagé (statut, priorité, type, jalon, effort, dates, ajouts / retraits d’assignés, d’étiquettes, de sprints ; `inheritFields` / `clearFields` : héritage rétabli ou vidé exprès). |

Hooks et constantes exportés :

| Nom                           | Rôle                                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `tasksQueryKey`               | Clé `['tasks']` des données des tâches.                                                                                                         |
| `useTasksData()`              | Requête `TasksData` : tâches, contributeurs, listes de paramètres, jalons, sprints ; chaque tâche telle que les écrans la lisent (`taskRow` : ses champs hérités avec la valeur suivie). Le fragment `TaskFields` lit `inheritedFields`, `inheritance { ...FieldOriginFields }` et `effective { … }`. |
| `useTaskComments(id)`         | Commentaires d’une tâche (clé `['tasks', id, 'comments']`).                                                                                     |
| `useCreateTask()`             | Mutation `createTask`.                                                                                                                          |
| `useUpdateTask()`             | Mutation `updateTask` (`{ id, input }`, sans projet : le projet change par transfert).                                                          |
| `useSetTasksClosed()`         | Mutation `setTasksClosed` (`{ ids, closed, reason?, restoring? }` : `NOT_PLANNED` annule, terminée par défaut ; `restoring` pour « Annuler » d’une règle, tâches archivées depuis acceptées) ; met à jour `closed`, `closeReason` et `cancelled` dans le cache tout de suite (optimiste). |
| `useDuplicateTask()`          | Mutation `duplicateTask` (« … (copie) ») ; renvoie `id` et `number` de la copie.                                                                                       |
| `useMoveTask()`               | Mutation `moveTask` (`id`, `beforeId`, `parentId?`) ; réordonne le cache tout de suite.                                                         |
| `useTaskBlock()`              | Ajoute (`add: true`) ou retire un lien « bloque ».                                                                                              |
| `useTaskRelation()`           | Ajoute ou retire un lien « relative à ».                                                                                                        |
| `useTaskCommentMutations()`   | `{ add, update, remove }` des commentaires de tâche.                                                                                            |
| `useContributorMutations()`   | `{ create, update, remove, setProjectContributors }` ; `create`, `update`, `remove` dans `withLossConfirmation` (anniversaire cité par des routines), rechargent les tâches, les routines et la facturation (`accountingQueryKey` : membres et relations de la trésorerie suivent le lien). |
| `useTaskLabelMutations(kind)` | `{ create, update, remove }` d’une liste de paramètres (statut, priorité, type, étiquette).                                                     |
| `useDoableTaskIds(enabled)`, `useTaskWaitReasons(enabled)`, `TaskWaitReasons`, `doableTasksKey` | Une seule requête `doableTasks` (interne `useDoableTasks`, lue par deux `select`) : l’ensemble des tâches faisables maintenant, et la raison de chaque tâche ouverte qui ne l’est pas (`TaskWaitReason` par id) ; demandée seulement si `enabled`, rafraîchie chaque minute ; envoie le décalage UTC du navigateur. Sa clé est rechargée avec les sources des conditions (`SLOT_DEPENDENT_KEYS`). |
| `useBulkTaskMutations()`      | `{ update, transfer, undoTransfer, archive, remove }` : `bulkUpdateTasks` (avec `restoring`), `bulkTransferTasks` (`{ removedLinks, lost }`), `undoTaskTransfer` (annulation d’un transfert, tout ou rien : `{ moves, links }`), `bulkSetTasksArchived`, `bulkDeleteTasks`. |
| `useMilestoneMutations()`     | `{ create, update, remove, move }` ; `move` (interne `useMoveMilestone`) réordonne le cache tout de suite.                                      |
| `useSprintMutations()`        | `{ create, update, remove }`.                                                                                                                   |

Interne : `LabelDocuments` (documents CRUD par type de libellé), `useTasksMutation`, `useMoveMilestone`, documents `*Document`.

### `api/automations.ts`

| Export                           | Rôle                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `TaskAutomation`                 | Fragment `TaskAutomationFields` (nom, couleur, image, ordre, archivée, `enabled`, `trigger`, `condition`, `actions`). |
| `TaskAutomationInput`, `TaskAutomationPatch` | Ré-exports des types GraphQL de création et de modification.                                |
| `taskAutomationsQueryKey`        | Clé `['tasks', 'automations']` (déclarée dans `lib/query-keys`).                                        |
| `useTaskAutomations()`           | Requête `taskAutomations` (ordre manuel, archivées comprises).                                          |
| `useTaskAutomationMutations()`   | `{ create, update, remove }` : `createTaskAutomation`, `updateTaskAutomation`, `deleteTaskAutomation`. |

## pages/

### `pages/TasksPage.tsx`

- `TasksPage()` : page `/tasks`. En-tête `PageHeader` (« Tâches »), paramètres dans la barre latérale (`PageSettings`, « Paramètres des tâches » → `TaskSettings`), puis `TaskBoard` avec `projectId={null}`. Utilisée par `app/router.tsx`.

### `pages/TaskAutomationsPage.tsx`

- `TaskAutomationsPage()` : page `/tasks/automations` (`TASK_AUTOMATIONS_PATH`) : `BackLink` vers « Tâches », `PageHeader` « Automatisations des tâches », puis la `SettingsList` « Règles » (`useTaskAutomationItems`) : badge du déclencheur (interne `triggerText`), badge « Désactivée », « Désactiver » / « Activer » dans le menu « … » (`updateTaskAutomation` de `enabled`). Utilisée par `app/router.tsx`.

## components/

### `components/TaskBoard.tsx`

- `TaskBoard({ projectId, projectIds?, createProjectId?, header?, emptyMessage, title, eventRange? })` : le tableau des tâches d’une portée (page ou projet). Utilisé par `TasksPage` et `features/projects/pages/ProjectPage.tsx`.
  - `projectId` : portée des vues (`null` pour la page) ; `projectIds` : projets listés (le projet et ses sous-projets) ; `createProjectId` : projet des nouvelles tâches ; `header` : contrôles avant les onglets ; `title` : titre des exports ; `eventRange` : jours des évènements au lieu de la période de la vue.
  - Vues (`useTableViews`, `tableKey: 'tasks'`) avec les premières vues `TASK_VIEWS` (« En cours », « Mes tâches », « Toutes ») qui partent des colonnes par défaut du tableau `tasks` dans l’espace (lues par `useTableViews`).
  - Options de vue `events` et `eventPeriod` : lignes d’évènements (`useCalendarEvents`) mêlées aux tâches.
  - `handleMove` (interne) : glisser-déposer → `moveTask`, ou `bulkUpdateTasks` vers un autre groupe (statut, priorité, type, jalon, assigné, étiquette, sprint).
  - `cells` (interne) : cellules d’une tâche (cellules de `inline-cells`, `extra-cells`) ou d’un évènement (`event-cells`).
  - Menu de ligne (`RowActions`), ligne d’ajout (`AddTaskRow` avec `groupDefaults`), actions de sélection (`useTaskSelectionActions`).
- Constantes internes : `EVENT_PERIOD_LABELS` (libellés des périodes), `TASK_VIEWS`.

- Ses cellules passent par `inheritedCells` (`TASK_CELL_FIELDS`, `taskParentName`) : un champ hérité est grisé, « Hérité de … » en infobulle.

### `components/TaskPanel.tsx`

- `TaskPanel()` : panneau latéral (`SidePanel`) de la tâche de l’URL (`?task=`), par-dessus toute page ; squelette pendant le chargement, `DetailNotFound` si introuvable. Monté par `app/layout/AppLayout.tsx`.
- Internes :
  - `TaskDetail({ task, context })` : disposition commune `DetailLayout` ([Panneaux](../../components/panels.md#detaillayouttsx)). En-tête : `TaskStateIcon` et numéro, « Libellé » (enregistré en le quittant), « Fermer la tâche » / « Rouvrir » (`useTaskActions().close`, toast avec « Annuler » comme la sélection), menu `useTaskActions` (`ActionsMenu`) ; projet (→ transfert avec confirmation), badges GitHub (`TaskGithubBadge`, [Code web : GitHub](../cross-cutting/github.md)) / archivée, `SaveStatus` (`updateTask`, transfert ou texte en cours). Colonne principale : `TaskDescription`, groupe « Relations » (tâche parente, sous-tâches avec avancement et « Ajouter une sous-tâche », « Dépend de », « Bloque », « Relative à » : `LinkList`, fonction interne `linkList`), « Commentaires » (`TaskComments`). Colonne de droite (`PanelGroup`, titres `PANEL_GROUPS`) : « Classement » (statut, priorité, type, étiquettes), « Parties prenantes » (assignés, bénéficiaires), « Charge » (effort, `TrackedTime`), « Périodes » (jalon, sprints, dates, ouverture et échéance, temps morts `DeadTimesField` / `taskCountdownItem`, créneaux `SlotConditionBuilder`, `TaskHoursField`), « Alarmes » (`TaskReminders`, `SavedCountdownsField` `TASK`), le lieu seul (`TaskLocation`), « Ressources » (`TaskLinks`, `DocumentsField` de [Code web : documents liés](../cross-cutting/documents.md) sur `inProjectTree` du projet de la tâche, enregistré par `save`, `TaskShopping`, `SheetsSection`). Changer de projet hors de l’arborescence demande confirmation quand la tâche a des liens (`hasTreeLinks`) ou des sous-tâches. Chaque champ est enregistré dès qu’il change ; le libellé et l’effort en les quittant (`useFieldSave` sur `taskPanelFormSchema`, enregistrés aussi à la fermeture du panneau ; Entrée dans le libellé aussi). Tâche archivée : `readOnly` de `DetailLayout` (tout désactivé sauf le menu).
  - `LinkList({ label, tasks, candidates, context, onAdd, onRemove })` : liste « Bloque » / « Dépend de » / « Relative à » avec « Retirer » et « Ajouter une tâche » (`TaskSelect`).

- Champs hérités (projet, priorité, assignés, bénéficiaires, jalon, créneaux, horaires — `TaskHoursField` —, lieu) dans `InheritedField` : grisés « Hérité de … », « Vider », « Rétablir l’héritage » (`taskFieldState`). « Ouverture » et « Échéance » forment une période, `PeriodField` « Ouverture et échéance », chaque bout hérité à part : grisé dans le champ (`hints` : `inheritedDateHint`), sa mention et ses actions sous le champ (`inheritance` : `taskFieldState`, fonction interne `inheritedBound`) ; « Début » et « Fin » : `PeriodField` « Dates ».

### `components/TaskCreateForm.tsx`

- `TaskCreateForm({ context, defaults?, onDone })` : formulaire « Nouvelle tâche » (schéma `taskFormSchema`), lieu (`EventLocation`), liens (`LinksField`) et horaires (`TaskHoursField`, hérités comme la condition de créneaux) compris. `defaults` : projet et parent présélectionnés. Changer de projet retire parent, jalon et sprints d’une autre arborescence. Une sous-tâche hérite de son parent : les valeurs du parent montrées grisées (`InheritedField`, `formInheritance` sur les clés `FORM_COLUMNS`, interne `parentValues`), la liste des champs encore hérités envoyée (`inheritedFields`) ; choisir un autre parent reprend les siennes, n’en choisir aucun ne garde que les valeurs. Après création : toast et ouverture de la tâche (`useTaskLink`). Ouvert par `useTaskActions().create`.

### `components/TaskLinks.tsx`

- `TaskLinks({ task, locked, save })` : section « Liens » du panneau : `ItemLinks` (« Aucun lien. » sinon), `EditToggle` (« Modifier les liens », puis la coche « Terminer la modification des liens » ; sauf archivée). Interne : `TaskLinksEditor({ task, save })`, `LinksField` sur `useFieldSave` (`linksFormSchema`) : un lien est enregistré une fois validé (en quittant ses champs), un retrait tout de suite (sans bouton « Enregistrer »), erreurs sous les champs.

### `components/TaskDescription.tsx`

- `TaskDescription({ task, context, locked, save })` : section « Description » du panneau (`DescriptionSection`) : sans description, l’éditeur directement ; sinon `MarkdownView` (cases cochables en place, enregistrées tout de suite), `EditToggle` (« Modifier la description » / « Terminer la modification de la description »). Interne : `TaskDescriptionEditor({ task, context, save, onClose, autoFocus })`, `MarkdownEditor` sur `useFieldSave` (`descriptionFormSchema`) : enregistrée en quittant l’éditeur, et par Ctrl/⌘ + Entrée qui le ferme aussi (sans « Enregistrer » ni « Annuler »).

### `components/TaskReminders.tsx`

- `TaskReminders({ value, minDate, deadline, onChange, error?, disabled? })` : « Rappels » d'une tâche, dans « Nouvelle tâche » (`TaskCreateForm`) et le panneau (`TaskDetail`, enregistré à chaque changement) : `RemindersSelect` en « À HH:MM » et « N jours avant » l’échéance (`kinds={['at', 'days']}`, `day` vide ; une ligne par rappel, case « Chaque jour » : `dayLabel`), aide selon « Ouverture » / « Échéance », désactivé sans échéance.

### `components/TaskHoursField.tsx`

- `TaskHoursField({ value, onChange, readOnly? })` : « Horaires » d'une tâche, dans « Nouvelle tâche » et le panneau : `RepetitionField` (résumé `taskHoursLines`, « N’importe quand » sans horaires, `valid` = `taskHoursSchema`), la fenêtre étant l’éditeur des cas d’un créneau (`ScheduleCases`, `newScheduleCase`).
- `TaskHoursModal({ value, title, onClose, onApply, header? })` : la même fenêtre hors du panneau (cellule « Horaires » du tableau) : `RepetitionModal` sur un brouillon partant des horaires à l’ouverture (montée à l’ouverture), « Appliquer » désactivé tant que `taskHoursSchema` refuse ; `header` : à quoi elle s’applique.
- Internes `HOURS_CASE_START` (« À partir du » des cas qui le demandent : `hoursCaseNeedsStart`, `HOURS_START_REQUIRED`), `validHours`, `TaskHoursEditor({ draft, setDraft, start })` : `ScheduleCases` (`caseStart`), première erreur de `taskHoursSchema` hors « À partir du » manquant (montré sous son champ) (`Input.Error`), « Retirer les horaires » ; sans horaires : « Aucun horaire : la tâche est faisable à n’importe quelle heure. » et « Ajouter des horaires ».

### `components/TaskLocation.tsx`

- `TaskLocation({ task, save })` : « Lieu » du panneau (`EventLocation`, sans trajet) ; enregistré au choix d'une adresse proposée ou d'un clic sur la carte, quand le texte est vidé, ou à la sortie du champ pour un texte libre (seulement s'il change ; `addressOf`, `locationOf`).

### `components/TaskDialogs.tsx`

Dialogues sur une ou plusieurs tâches (props `TasksDialogProps`), ouverts par `openTasksDialog` depuis `useTaskRowsActions` :

| Nom                   | Rôle                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DeleteTasksDialog`   | Confirmation destructive ; choix pour les sous-tâches (`CascadeChoice` : remonter ou supprimer) ; temps sans projet supprimés avec elles (`LostOnDeleteRisk`, selon le choix) ; ferme le panneau si la tâche ouverte est supprimée. |
| `TransferTasksDialog` | Projet de destination ou « Sans projet » ; avertissement de sortie d’arborescence ; transfert et annulation par `useTransferTasks`. |

### `components/BulkBar.tsx`

| Nom                                | Rôle                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useTaskRowsActions(context)`      | Fabrique des actions sur des tâches (barre de sélection et menu d’une tâche) : `close` (fermer comme terminées les tâches ouvertes / rouvrir, `switchRowsAction`), `cancel` (« Annuler » : fermer comme annulées celles qui ne le sont pas, désactivé sinon), `duplicate` (`duplicateRowsAction` sur `outermost`, avec sous-tâches, copie unique ouverte), `transfer`, `inheritance` (« Héritage… » des sous-tâches, `inheritanceRowsAction` : `inheritFields` / `clearFields` en masse, « Annuler » par `useBulkUndo().inheritance`), `archive` (`archiveRowsAction`), `github` (« Envoyer sur GitHub » des tâches `githubSendable`, `useSendTasksToGithub` : toast `notifyProgress` « Envoi sur GitHub… » changé en succès ou en erreur ; absente quand aucune ne peut l’être), `remove` ; chacune annulable depuis son toast si possible ; les tâches archivées ne sont prises que par l’archivage et la suppression. Interface interne `TaskRowsActions`. Utilisé aussi par `TaskDoneButton` (`close`). |
| `useTaskSelectionActions(context)` | Les mêmes actions en liste (sans celles absentes), pour la barre de sélection du tableau (`TaskBoard`).                                                                                                                                                                                                                                                                                 |

### `components/inline-cells.tsx`

Cellules modifiables en place des tâches (toutes en lecture seule sur une tâche archivée ; sur une sélection, la modification s’applique à toutes, via `useCellEdit`). Utilisées par `TaskBoard`.

| Nom                                         | Rôle                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `TaskLabelCell({ task, context, prefix? })` | Libellé (`EditableLabel`) : numéro en lien, renommage au double-clic, « 2/5 » des sous-tâches, `prefix` (icônes).                       |
| `LabelCell({ task, column, labels })`       | Statut, priorité ou type : `ChipChoiceCell` (pastille, liste de pastilles ; re-choisir la valeur la vide ; « Aucune valeur définie dans les paramètres »). |
| `MilestoneCell({ task, context })`          | Jalon de l’arborescence.                                                                                                                |
| `TagsCell({ task, context })`               | Étiquettes (ajouts / retraits en masse).                                                                                                |
| `SprintCell({ task, context })`             | Sprints de l’arborescence.                                                                                                              |
| `AssigneesCell({ task, context })`          | Assignés ; sur une sélection, les contributeurs communs à tous les projets. Enveloppe `context-cells.AssigneesCell`.                    |
| `BlockedByCell({ task, context })`          | « Dépend de » : ajoute / retire des blocages sur chaque tâche visée ; icône `DependencyIcon`.                                           |
| `EffortCell({ task })`                      | Effort (`EditableNumber`).                                                                                                              |
| `DateCell({ task, column, alert? })`        | « Début », « Fin », « Ouverture », « Échéance » ; garde la période valide pour une seule tâche ; `alert` : couleur de retard.              |
| `TaskBeneficiariesCell({ task })`           | Bénéficiaires (`BeneficiariesCell`, `beneficiariesDiff`).                                                                               |
| `TaskLinksCell({ task, context, kind })`    | « Bloque » ou « Relative à ».                                                                                                           |
| `ParentCell({ task, context })`             | Tâche parente (pas elle-même ni ses sous-tâches).                                                                                       |
| `TaskProjectCell({ task, context })`        | Projet : transfert (`useTransferTasks`, « Annuler »), confirmation si sortie d’arborescence avec liens.                                 |
| `TaskHoursCell({ task })`                   | « Horaires » : un cas par ligne (`taskHoursLines`, `StackedLines` ; « N’importe quand » sans horaires) ; un clic ouvre `TaskHoursModal`, appliqué sur la sélection (`useCellEdit`, enregistré tâche par tâche) ; lecture seule sur une tâche archivée. |
| `TaskLocationCell({ task })`                | « Lieu » : `LocationCell` (features/geo) sur la sélection (`useCellEdit`, enregistré tâche par tâche).                                  |

Internes : `fieldLabel` (libellé accessible), `LABEL_FIELDS`, `LABEL_NAMES`, `DATE_LABELS`, `DATE_RANGES`.

### `components/context-cells.tsx`

Cellules partagées entre tâches et routines (avec un `TaskContext`) :

| Nom                                                                                   | Rôle                                                                                                                             |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `AssigneesCell({ value, projectId, projectIds?, context, label, readOnly?, onSave })` | Assignés avec avatars ; propose `assignableFor` ; `onSave(ids, { added, removed })`. Utilisé par `inline-cells` et les routines. |
| `ProjectCell({ value, context, label, placeholder?, readOnly?, onSave })`             | Projet dans l’arbre des projets (archivés exclus sauf la valeur). Utilisé par `inline-cells` et les routines.                    |

### `components/extra-cells.tsx`

Cellules non textuelles du tableau des tâches :

| Nom                                      | Rôle                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------- |
| `SlotsCell({ task })`                    | « Créneaux » : condition en mots (`useSlotRules().describe`, « N’importe quand » sans condition), modifiée dans une bulle (`SlotConditionBuilder`). |
| `TimerCell({ task })`                    | « Chrono » : `TimerToggle` sur la tâche (le chrono qui tourne sur elle : `runningOn`, d’autres peuvent tourner). |
| `TrackedCell({ task })`                  | « Temps passé » : lien `timePath(task.id)`.                                             |
| `SubtasksCell({ task, context, onAdd })` | « Sous-tâches » (`ChildrenCell`) avec « Ajouter une sous-tâche ».                       |
| `ProgressCell({ task, context })`        | « Avancement » (`TaskProgress`).                                                        |
| `AlarmsCell({ task, context, count })`   | « Alarmes » : badge et « Nouvelle alarme » (`useAlarmForm`).                            |
| `ShoppingCell({ task, lists })`          | « Achats » : listes, « Nouvelle liste » (`openNewList`), « Rattacher une liste ».       |

### `components/event-cells.tsx`

Cellules des lignes d’évènements du tableau des tâches (`EventOccurrence`) :

| Nom                                   | Rôle                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EventLabelCell({ event, context })`  | Icône d’agenda, titre (ouvre l’évènement ; barré s’il est annulé ou reporté ; infobulle « Annulé », « Reporté au … » ou les jours du report l’un sous l’autre), lieu (`LocationText`).                                                                                                           |
| `EventPeopleCell({ event, context })` | Personnes de l’évènement (multi-sélection, enregistrée à la fermeture).                                                                                                                       |
| `EventStatusCell({ event })`          | État en lecture seule (`eventState`, `EVENT_STATES`).                                                                                                                                         |
| `EventTimeCell({ event })`            | Temps passé sur l’évènement.                                                                                                                                                                  |
| `EventWhenCell({ event, side })`      | Début ou fin, modifiable (jour pour un évènement « journée », sinon date et heure, en heure de Paris) ; déplacer le début déplace la fin ; une fin avant le début déplace le début. |
| `EventBeneficiariesCell({ event })`   | Bénéficiaires de l’évènement (toute la série si récurrent).                                                                                                                                   |

Internes : `useEventTargets` (évènements visés par une modification : la sélection ou celui-ci), `useEventCellLabel`, `useEventSave(event, column, series?)` (enregistre sur l’évènement ou sa série ; portée demandée une fois par `askScope`, sans « Cette occurrence » pour un champ de toute la série, `series` : personnes, bénéficiaires), `wall`, `fromWall`, `lengthOf`, `spanOf` (calculs de durée).

### `components/table-extras.tsx`

- `AddTaskRow({ context, defaults, projectId?, onOpenForm })` : ligne d’ajout (`AddRowField`) : un libellé + Entrée crée la tâche avec les valeurs du groupe et le statut par défaut (et la ferme si le groupe est « fermée ») ; sans projet, bouton qui ouvre le formulaire.

### `components/task-ui.tsx`

Petits composants communs des tâches :

| Nom                                                                                | Rôle                                                                                                         | Utilisé par                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `TaskRef({ task, closed?, blocked? })`                                             | Lien « #12 Libellé » avec icône d’état, ouvre le panneau.                                                    | panneau, cellules, temps      |
| `LabelSelect({ labels, value, onChange, kind?, ...SelectProps })`                  | Sélecteur d’un statut, d’une priorité ou d’un type ; avec `kind`, crée une valeur tapée (`CreatableSelect`). | formulaire, panneau           |
| `TagsSelect({ tags, value, onChange })`                                            | Multi-sélection d’étiquettes, création d’une étiquette tapée.                                                | formulaire, panneau           |
| `AssigneesSelect({ contributors, value, onChange, label?, description?, error? })` | Multi-sélection de contributeurs (`PeopleSelect`).                                                           | tâches, routines             |
| `ProjectSelect({ context, ...SelectProps })`                                       | Sélecteur de projet actif en arbre.                                                                          | tâches, temps, chrono         |
| `TaskSelect({ tasks, labelOf?, context?, ...SelectProps })`                        | Sélecteur de tâche, en arbre avec `context`.                                                                 | panneau, formulaire, cellules |
| `TaskStateIcon({ closed, cancelled?, blocked? })`                                  | Icône ouverte (cercle vert), terminée (coche violette), annulée (cercle barré gris), bloquée (cadenas rouge), avec info-bulle. | partout                       |

Internes : `NEW_LABEL_TITLES`, `useLabelCreator(kind)` (ouvre le formulaire du libellé tapé via `itemCreator`).

### `components/TaskDoneButton.tsx`

- `TaskDoneButton({ task, context, size? })` : bouton d’état d’une tâche dans une ligne (`StateButton` avec `DONE_STATES`) : « À faire » (rond gris vide) ou « Faite » (coche verte) ; annulée, « Annulée » (cercle barré gris de `TaskStateIcon`, interne `TASK_CANCELLED_STATES`). Un clic la ferme comme terminée ou la rouvre (`close` de `useTaskRowsActions(context)`, celui de `useTaskActions().close` : comme « Fermer » / « Rouvrir » de la sélection, toast avec « Annuler ») ; archivée, montrée seulement. Pas encore placé dans un écran (« Ma journée »).

### `components/TaskComments.tsx`

- `TaskComments({ task, context })` : fil `CommentThread` sur les commentaires de la tâche (`useTaskComments`, `useTaskCommentMutations`, `threadActions`), lecture seule si archivée. Utilisé par `TaskPanel`.

### `components/TaskSettings.tsx`

- `TaskSettings()` : paramètres des tâches : `SettingsList` des statuts (avec catégorie), `PriorityTypeSettings`, étiquettes, chacune avec son nombre d’utilisations, la section « Automatisations » (bouton « Gérer les règles » vers `TASK_AUTOMATIONS_PATH`), puis `ColumnDefaults` (`components/data-table/views`, `tableKey: 'tasks'`, colonnes `useTaskColumns`) en dernier (une longue liste). Utilisé par `TasksPage` et l’onglet « Tâches » des paramètres d’un projet.

### `components/PriorityTypeSettings.tsx`

- `PriorityTypeSettings()` : les deux `SettingsList` « Priorités » et « Types », communes aux tâches et aux routines (leur nombre d’utilisations compte les deux, `useRoutinesData` ; interne `ACTIVITY_USAGE`). Utilisé par `TaskSettings` et `RoutineSettings`. Garde eslint : une `SettingsList` titrée « Priorités » ou « Types » ailleurs est refusée.

### `components/TaskAutomationFields.tsx`

| Export                   | Rôle                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `TaskAutomationFields({ values, errors, context, onChange })` | Champs d’une règle au-delà de son nom et de sa couleur : « Active » ; « Quand » (déclencheur, champ, changement, valeur précise) ; « Si » (`FieldsFilterBuilder` sur `tableFilterFields` des colonnes des tâches limitées à `TASK_AUTOMATION_FILTER_FIELDS`) ; « Alors » (lignes d’actions : action, champ, valeur, « Ajouter une action », 20 au plus). Les choix des valeurs sont ceux des filtres des colonnes (sans « Moi » ni sprints relatifs). Internes : `ValueEditor` (choix, choix multiples, `DayValue`, nombre), `choicesOf`, `FIELD_COLUMNS`. |
| `TriggerValues`, `ActionValues`, `TaskAutomationExtra` | Valeurs du formulaire : déclencheur, action, champs propres à la règle (`enabled`, `trigger`, `condition`, `actions`). |

### `components/TaskAutomationToasts.tsx`

- `TaskAutomationToasts()` : monté une fois dans `AppLayout` ; lit les `extensions.taskAutomations` de chaque réponse (`onResponseExtensions`) : par règle appliquée, `notifyWithUndo(taskAutomationMessage(report), useBulkUndo().automation(report.reverts))` ; par règle refusée, `notifyWarning('Règle non appliquée', …)` ; puis recharge les tâches.

### `components/TaskFilterBuilder.tsx`

- `TaskFilterBuilder({ filter, context, onChange })` : constructeur de filtre de tâches hors de leur tableau, avec les colonnes des tâches (`FieldsFilterBuilder`). Utilisé par `features/dashboards/components/source-filters.tsx`.

### `components/TaskProgress.tsx`

- `TaskProgress({ done, total, label, extra?, size?, unit? })` : barre d’avancement et « 3/5 tâches » (`unit=false` : « 3/5 »). Utilisé par le panneau, `ProgressCell`, jalons, sprints.

### `components/EffortInput.tsx`

- `EffortInput(props: NumberInputProps)` : champ « Effort » (≥ 0, deux décimales, virgule française). Utilisé par le formulaire et le panneau.

### `components/MilestonesPanel.tsx`

- `MilestonesPanel({ projectId })` : jalons d’un projet (paramètres du projet) : ordre (`SegmentedControl`, `useMilestoneOrder`), glisser-déposer en ordre manuel (`SortableArea`), archivés (`useArchivedToggle`), cartes `PlanCard`, création / modification / suppression.
- Internes : `MilestoneForm({ projectId, milestone?, onDone })` (schéma `milestoneFormSchema` ; nouveau : « Créer le jalon » ; existant : enregistré champ par champ, `useFieldSave` — libellé et description en les quittant, la description par `fieldProps` —, seuls les champs changés envoyés, `SaveStatus` ; le jalon de `useTaskContext` suivi ; archivé ou projet archivé : lecture seule), `milestoneValues(milestone?)` (valeurs du formulaire), `SortableMilestone({ milestone, sortable, children })` (carte avec poignée `DragHandle`).

### `components/SprintsPanel.tsx`

- `SprintsPanel({ projectId })` : sprints d’un projet : état (`periodState`), avancement en tâches et en effort (`leafEffort`), cartes `PlanCard`, archivés, valeurs proposées pour un nouveau sprint (suite du dernier, même durée).
- Internes : `SprintForm({ projectId, sprint?, defaults, onDone })` (schéma `sprintFormSchema` ; nouveau : « Créer le sprint » ; existant : enregistré champ par champ, `useFieldSave`, le sprint entier à chaque champ — libellé et objectif en les quittant —, `SaveStatus` ; le sprint de `useTaskContext` suivi ; archivé ou projet archivé : lecture seule), `sprintValues(sprint)`, `sprintInput(values)`.

### `components/PlanCard.tsx`

- `PlanCard({ icon, title, archived, badges?, late?, dates, actions, progress, description?, targets, onDescription? })` : contenu de la carte d’un jalon ou d’un sprint (titre, badges, retard en rouge, dates, menu, avancement, description cochable).

### `components/ProjectContributors.tsx`

- `ProjectContributors({ projectId })` : contributeurs d’un projet (directs, hérités « Via … », « Moi ») avec leur nombre de tâches ; ajout d’un contributeur existant, « Nouveau contributeur », retrait (`setProjectContributors`). Utilisé par les paramètres d’un projet.

### `components/ContributorsManager.tsx`

- `ContributorsManager({ contributors, usage })` : section « Contributeurs » des paramètres généraux : badges « Moi », puis selon son lien (`link`) « Membre », « Relation » / « Proche » ou « Contact » (infobulle `linkName`), archivé ; modifier, archiver, supprimer (confirmation). `usage` : nombre de tâches assignées par contributeur. Utilisé par `features/projects/pages/SettingsPage.tsx`.

### `components/ContributorForm.tsx`

- `ContributorForm({ contributor?, defaultProjectIds?, onDone })` : formulaire d’un nouveau contributeur (« Ajouter » ; identifiant proposé par `suggestHandle` tant qu’il n’est pas touché) ou panneau d’un contributeur existant enregistré champ par champ (`useFieldSave` : nom et identifiant en les quittant, image et projets dès qu’ils changent, seuls les champs changés envoyés ; `SaveStatus` ; le contributeur de `useTaskContext` suivi ; archivé : lecture seule) : nom, identifiant, image (`IconField`, `formIconProps` : `avatar` / `removeAvatar`), son lien (`ContributorLinkField`, valeur `link`, enregistrée dès qu’elle est choisie), projets (valeur du formulaire ; pas de projets pour « Moi »). Ouvert par `useContributorForm`.

### `components/ContributorLinkField.tsx`

- `ContributorLinkField({ value, onChange, contributor?, errors })` : « Coordonnées et anniversaire » d’un contributeur (`LabeledField`) : `SegmentedControl` « Membre », « Relation » / « Proche », « Contact » (PRO), « Aucun » (désactivé pour « Moi ») ; membre et aucun envoyés aussitôt, une relation ou un contact une fois choisi dans sa liste (`Select`, relations libres de `useTreasurySettings`, contacts libres de `useClientContacts` groupés par client ; archivés non proposés sauf l’actuel ; erreurs `link.relationId`, `link.contactId`, `link`) ; dessous, en lecture seule, la provenance, la date de naissance (`birthDateText`) et les coordonnées (`ContactLines`) de ce à quoi il est lié, et « Ouvrir la fiche » (`ActionButton` tertiaire) qui ouvre la fiche où elles se modifient : `openMemberForm`, `openRelationForm`, `openContactForm` (rien pour un nouveau membre ni pour « Aucun », ni pendant un choix). Utilisé par `ContributorForm`.

### `components/TaskTable.module.css`

Classe `recurring` (dans la couche `app`) : les petites icônes devant le libellé (GitHub, alarmes) ne rétrécissent pas et sont en couleur atténuée.

## hooks/

### `hooks/use-task-context.ts`

- `TaskContext` (interface) : données et fonctions partagées des écrans de tâches : `tasks`, `contributors`, `statuses`, `priorities`, `types`, `tags`, `projects`, `milestones` (dans l’ordre choisi), `milestoneOrder`, `milestoneRank`, `sprints`, `meId`, index `taskById`, `statusById`, `priorityById`, `typeById`, `tagById`, `contributorById`, `projectById`, `milestoneById`, `sprintById`, et :
  - `taskLabel(task, fromProjectId?)` : chemin complet « Client › Projet › #3 Parent › #12 Titre » ;
  - `milestoneLabel`, `sprintLabel` : le nom seul, sans le chemin du projet ;
  - `projectLabel(projectId)` : chemin du projet, « Sans projet » ;
  - `projectOptions(projects)`, `taskOptions(tasks)` : options d’arbre pour les sélecteurs ;
  - `rootOf(projectId)` : projet racine (`null` sans projet) ;
  - `childrenOf(taskId)` : sous-tâches dans l’ordre manuel ;
  - `milestonesFor(projectId, keep?)`, `sprintsFor(projectId, keep?)` : ceux de l’arborescence, archivés exclus sauf `keep` ;
  - `assignableFor(projectIds, keep?, withArchived?)` : contributeurs assignables à tous ces projets (« Moi », rattachés au projet ou à un parent, plus `keep`) ;
  - `contributorName` (« Moi » pour l’utilisateur), `isBlocked`, `isClosed` ;
  - `suggestionsFor(projectId)`, `targetsFor(projectId)` : suggestions `#`/`@` et cibles des références markdown.
- `useTaskContext()` : construit le contexte à partir de `useTasksData`, `useProjectTree`, `useMe`, `useMilestoneOrder` ; renvoie `{ context, isPending, error }`. Utilisé par les tâches, le temps, les commentaires, les routines, l’agenda, l’accueil, les tableaux de bord, etc.
- Fonctions de nommage (une seule source, gardées par une règle eslint) :

| Nom                  | Résultat                                                       |
| -------------------- | -------------------------------------------------------------- |
| `taskRef(task)`      | Réexporté de `@ordo/shared` : « #12 » suivi d’une espace, vide sans projet.                  |
| `taskNumber(task)`   | « #12 », vide sans projet.                                     |
| `closedMark(task)`   | « (fermée) » avec son espace, ou rien.                         |
| `taskNumbered(task)` | Réexporté de `@ordo/shared` : « #12 Libellé », le libellé seul sans projet.                  |
| `taskName(task)`     | Nom dans un message : « #12 », ou « « Libellé » » sans projet. |

Internes : `NO_PROJECT_LABEL` (« Sans projet »), `NO_PROJECT_NODE`.

### `hooks/use-task-link.ts`

- `TASK_PARAM` : `'task'`, paramètre d’URL de la tâche ouverte.
- `useTaskLink()` : `{ to(id), open(id), close() }` : lien / navigation qui ouvre la tâche dans le panneau en gardant les autres paramètres ; `close` remplace l’entrée d’historique.

### `hooks/use-transfer-tasks.ts`

- `useTransferTasks(context)` : `{ transfer(tasks, projectId, message, onDone?), isPending }` : le seul transfert de tâches (avec leurs sous-tâches) vers un projet ou hors de tout projet : dialogue « Transférer », cellule « Projet », panneau d’une tâche. Toast `message` suivi des liens retirés (`removedLinksNote`), avec « Annuler » (`useBulkUndo().transfer` sur les tâches déplacées les plus hautes, `outermost`, et les liens retirés, `lost`). eslint interdit de prendre `transfer` de `useBulkTaskMutations` ailleurs.

### `hooks/use-task-actions.tsx`

- `useTaskActions(context)` : `{ menu(task), close(task), create(defaults?) }` : entrées du menu d’une tâche (« Annuler » sauf une tâche annulée, « Dupliquer », « Transférer », « Héritage… » (une sous-tâche), « Transformer en routine » — `useConvertActivity().toRoutine` —, « Envoyer sur GitHub » (`github` de `useTaskRowsActions`, quand il existe), « Archiver », « Supprimer », puis « Lancer » chacun de ses temps morts et de ses minuteurs enregistrés — `useCountdownMenuEntries` — ; « Restaurer », « Supprimer » si archivée), « Fermer » / « Rouvrir » d’une tâche seule (`close` de `useTaskRowsActions` : toast avec « Annuler », bouton du panneau) et ouverture du formulaire de création dans le panneau (« Nouvelle tâche » / « Nouvelle sous-tâche »). Utilisé par `TaskBoard`, `TaskPanel`, le menu « Ajouter » de l’en-tête.

### `hooks/use-task-columns.ts`

- `useTaskColumns(context, today, { doable?, eventComments? })` : colonnes du tableau des tâches (`taskColumns`) avec ce qui leur manque : tâches faisables (`useDoableTaskIds`, seulement si `doable`), alarmes (`useTaskAlarmCounts`), listes d’achats, créneaux et types que la condition peut citer (`useSlotChoices().all`, `slotSchedules` : le filtre « Créneaux » porte sur les créneaux et types cités par la condition, `conditionReferences`), commentaires des évènements. Utilisé par `TaskBoard`, `TaskSettings` (colonnes des nouvelles vues), `TaskFilterBuilder`, la carte « Tâches » de l’accueil (`TasksCard`), et les tableaux de bord / l’accueil via `matchTasks`.

### `hooks/use-task-automation-items.tsx`

- `useTaskAutomationItems(context)` : `SettingsItemKind` des règles pour `SettingsList` : type `TASK_AUTOMATION`, « Nom », schéma `taskAutomationSchema`, champs `TaskAutomationFields` (valeurs de départ lues par les schémas partagés, sinon « Quand le début est renseigné » et « Donner une valeur au statut » ; interne `extraOf`), création et modification (`itemMutations` ; un filtre vide est envoyé `null`). Utilisé par `TaskAutomationsPage`.

### `hooks/use-label-items.tsx`

- `useTaskStatusItems()` : liste de paramètres des statuts (`SettingsItemKind`) avec le champ « Catégorie » (un classement : la changer ne change pas les tâches) ; inclut `remove`.
- `useTaskLabelItems(kind)` : liste de paramètres des priorités, types ou étiquettes.
- Internes : `STATUS_CATEGORY_OPTIONS`, `LIST_KINDS` (type de liste de paramètres par type de libellé).

### `hooks/use-contributor-form.tsx`

- `useContributorForm()` : ouvre `ContributorForm` dans le panneau (« Nouveau contributeur » / « Modifier le contributeur »), avec des projets par défaut.

## lib/

### `lib/task-columns.ts`

| Nom                                                                        | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TaskTableRow` (type)                                                      | Ligne du tableau : `{ kind: 'task', task }` ou `{ kind: 'event', event }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `taskColumns(context, today, extras?)`                                     | Toutes les colonnes `DataColumn` des tâches : libellés, tailles, tri (`sortValue`), texte (`taskCell` / `eventCell`), filtres (projet avec parents, « Moi », sprints relatifs, parent avec ancêtres…), groupes (projets en arbre), colonnes de masse ; plus les colonnes cachées « Numéro », « Description », « Documents » (`documentsColumn`, [Code web : documents liés](../cross-cutting/documents.md)), drapeaux (`flag(id, label, value, groupLabels, icons?)` interne, sur `booleanColumn` : vides sur un évènement, chacun avec les noms de ses valeurs, « En retard » par `LATE_GROUP_LABELS`, « En retard » et « Bloquée » avec `WARNING_YES_ICONS` ; « Fermée », « En retard », « Bloquée », « A des sous-tâches », « Archivée », « Faisable maintenant », « A des achats », « A des alarmes », « A des commentaires » ; « Faisable maintenant » vide sur une tâche fermée, groupée par `DOABLE_GROUP_LABELS`), « Catégorie de statut », « Fermeture » (`closeReason` : « Terminée » / « Annulée », vide pour une tâche ouverte) et « GitHub » (`githubState`, états `GITHUB_STATE_BADGES` ; vide hors d’une arborescence liée), pastilles par `stateColumn`. |
| `DOABLE_GROUP_LABELS` | « Maintenant » / « Plus tard » : les groupes de « Faisable maintenant » (tâches et routines) et les sections de la carte « Tâches » de l’accueil. Utilisé par `routines`, `home`. |
| `taskTableRows(tasks)` | Lignes du tableau faites de tâches, dans leur ordre manuel (puis par numéro). Utilisé par `TaskBoard` et l’accueil (`TasksCard`). |
| `isArchivedTaskRow(row)` | Ligne d’une tâche archivée (écartée tant que « Afficher les archivées » est éteint). Utilisé par `TaskBoard` et l’accueil. |
| `matchTasks(tasks, columns, { filter, search?, includeArchived? }, today)` | Tâches gardées par un filtre exprimé dans les colonnes du tableau. Utilisé par l’accueil (`home-data.ts`) et les tableaux de bord (`chart-data.ts`).                                                                                                                                                                                                                                                                                                                                                                                    |
| `filterUses(group, field)`                                                 | Le filtre a-t-il une condition sur ce champ (pour ne charger que le nécessaire).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `viewUses(config, field)` | La vue a-t-elle besoin de cette colonne masquée par défaut : son filtre, son tri ou son regroupement s’en sert, ou la colonne est affichée (« Faisable maintenant » n’est calculé qu’alors : `TaskBoard`, `TasksCard`). |
| `eventRowKey(event)`                                                       | Clé de la ligne d’un évènement (`taggedKey('e', …)`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Internes : `TaskColumnExtras`, `STATUS_CATEGORY_COLORS` (À faire gris, En cours bleu, Terminé vert, Annulé gris), `STATUS_CATEGORY_BADGES`, `CLOSE_REASON_BADGES` (Terminée vert, Annulée gris), `SPRINT_TOKENS`.

### `lib/columns-meta.ts`

- `COLUMN_LABELS` : libellé de chaque colonne (`TaskColumn`).
- `LOCKED_COLUMNS` : colonnes non masquables (`label`).
- `COLUMN_SIZES` : largeur par défaut (px).
- `BULK_EDITABLE_COLUMNS` : colonnes modifiables sur une sélection de cellules.

### `lib/task-hours-text.ts`

- `taskHoursLines(hours, start)` : « Horaires » d’une tâche en mots, une ligne par cas (`describeScheduleCase`). Utilisé par `TaskHoursField`, `TaskHoursCell`.
- `taskHoursText(hours, start)` : les mêmes en un texte (cas séparés par « ; »), vide sans horaires : texte, tri, filtre et export de la colonne « Horaires » (`taskCell`, `sortValue`) ; la cellule montre un cas par ligne.

### `lib/task-rows.ts`

- `sortValue(task, column, context)` : valeur de tri d’une tâche (positions des libellés, rang du jalon dans l’ordre choisi, premier sprint, nombre de liens…; vide en dernier).
- `eventSortValue(event, column, context, comments?)` : idem pour un évènement.
- Types internes `TaskSortKey`, `SortValue`.

### `lib/export.ts`

- `taskCell(task, column, context)` : texte d’une cellule de tâche (exports, recherche) ; liens « #12 » avec le projet ailleurs (`taskShortRef`).
- `eventCell(event, column, context, comments?)` : texte d’une cellule d’évènement.

### `lib/cell-edit.ts`

- `useCellEdit(task, column)` : enregistre une modification de cellule : sur la tâche seule (`updateTask`), ou sur toute la sélection en une requête de masse avec son annulation (`useEntityCellEdit`, `bulkUpdateTasks`, toast « Modification appliquée à … ») ; renvoie `{ apply, count, targets }`. Les tâches archivées sont exclues de la sélection.

### `lib/task-inheritance.ts`

Héritage des sous-tâches à l’écran (règles : [Héritage](../../../business-rules/activities/tasks.md#héritage)).

- `taskRow(task)` : tâche telle que les écrans la lisent : chaque champ hérité avec la valeur suivie (`inheritedRow` sur `TASK_INHERITED_COLUMNS`) ; une « Ouverture » ou une « Échéance » héritée prend celle du parent, sinon reste vide (la date du jalon, du projet ou du sprint s’affiche à sa place, `inheritedDateHint`). Appliquée par `useTasksData` : cellules, panneau, filtres, tris, groupes et export.
- `TASK_FIELD_LABELS`, `TASK_INHERITANCE_OPTIONS` (champs de « Héritage… », le projet sans « Vider »), `TASK_CELL_FIELDS` (champ hérité de chaque colonne).
- `taskFieldState(task, field, save)` : état et actions d’un champ du panneau (`clear`, `inherit` enregistrés aussitôt).
- `taskParentName(task, taskById)` : « « #12 Libellé » », nom du parent dans les mentions.

### `lib/bulk-undo.ts`

- `useBulkUndo()` : fabriques des « Annuler » des toasts, à partir de l’état des tâches avant l’action : `changes(tasks, changes)` (rétablit champs et ajouts / retraits, `restoring: true` ; un champ qui était hérité ou vidé exprès redevient hérité ou vidé : `inheritFields` / `clearFields`), `inheritance(tasks, fields, all)` (après « Héritage… » : chaque champ remis hérité, vidé ou à sa valeur propre par `updateTask`, le projet propre par `undoTransfer`, ses sous-tâches d'un autre projet que leur parent remises dans le leur d'après `all`, les tâches d'avant le changement, `subtaskProjects` ; interne `restoredField`), `closed(tasks, closed, reason?)` (seules les tâches dont l’état a changé reviennent comme elles étaient : ouvertes, terminées ou annulées), `archived(tasks, archived)`, `transfer(moved, lost)` (remet les tâches transférées dans leur projet, les sous-tâches d'un autre projet que leur parent dans le leur d'après `lost.projects`, puis les liens retirés, en un seul appel `undoTransfer`), `automation(reverts)` (après une règle d’automatisation, d’après les `TaskAutomationRevert` de l’API : les tâches que la règle a archivées restaurées, puis celles qu’elle a changées de projet remises toutes ensemble dans leur projet avec ce que leurs transferts ont retiré (`links` réunis par `mergeTaskLinksLost`, un seul appel `undoTransfer` : un lien entre deux d’entre elles revient une fois les deux remises), puis les champs de chaque tâche redonnés avec `restoring`, puis son état ouvert / fermé). Toasts « Action annulée. » / « L’action n’a pas pu être annulée. ».
- Internes : `SCALAR_FIELDS`, `revertChanges`, `idsBy`.

### `lib/bulk-label.ts`

- `tasksLabel(count)` : « 1 tâche » / « 3 tâches ».
- `removedLinksNote` est passé dans `lib/text.ts` (commun aux tâches et aux routines, voir [lib](../../lib.md)).

### `lib/open-tasks-dialog.tsx`

- `TasksDialogProps` : `{ tasks, context, onDone(success) }`.
- `openTasksDialog(title, Dialog, { tasks, context, asForm?, onSuccess? })` : ouvre un dialogue sur des tâches, dans le panneau latéral (`asForm`) ou une modale.

### `lib/new-task-defaults.ts`

- `NewTaskDefaults` : valeurs d’une nouvelle tâche (avec `closed`).
- `defaultStatusId(context)` : premier statut « À faire » non archivé, sinon le premier non archivé.
- `groupDefaults(groupBy, key, context)` : valeurs données par le groupe où la tâche est créée.

### `lib/task-links.ts`

- `inProjectTree(context, projectId)` : dit si un élément (tâche, routine) d'un projet est dans l'arborescence de projets d'un autre (sans projet : avec ceux sans projet). Utilisé aussi par `linkableRoutine` (routines) et par le champ « Documents » des tâches, routines et évènements.
- `hasTreeLinks(task)` : la tâche a des liens qu'un passage dans une autre arborescence retire (parent, blocages, relations, jalon, sprints, documents de projet) ; décide de la confirmation « Changer de projet » du panneau (`TaskPanel`) et de la cellule « Projet » (`inline-cells`).
- `linkableTasks(context, projectId, taskId, extra?)` : tâches liables (même arborescence, non archivées, pas elle-même).
- `subtasksOf(context, taskId)` : sous-tâches à toute profondeur (la confirmation de suppression y lit les items GitHub supprimés avec elles).
- `countSubtasks(context, taskId)` : nombre de sous-tâches à toute profondeur (`subtasksOf`).

### `lib/task-effort.ts`

- `leafEffort(task, context)` : effort compté dans une somme (le sien sans sous-tâches, 0 pour un parent). Utilisé par `SprintsPanel` et les tableaux de bord.

### `lib/inherited-dates.ts`

- `inheritedDateHint(task, field)` : « 12 nov. 2026 (parent) », « (jalon) », « (projet) » ou « (sprint) » quand la tâche n’a pas d’« Ouverture » ou d’« Échéance » à elle (`minDateSource`, `deadlineSource`, mots de `INHERIT_SOURCE_LABELS`), à la place du champ vide (tableau et panneau) ; `null` avec sa propre date ou sans date suivie. Remplace `sprintDateHint`.

### `lib/my-tasks.ts`

- `myTasksFilter(period)` : filtre « Mes tâches » d’une période (`'today' | 'tomorrow' | 'week'`) : tâches ouvertes assignées à moi ou à personne, en retard, en cours, ou qui commencent, finissent, atteignent leur échéance ou se déroulent pendant la période. Utilisé par l’accueil (`home-data.ts`). Internes : `condition`, `group`.

### `lib/event-format.ts`

- `eventWhen(event, side, numeric?)` : début ou fin d’un évènement en texte (format numérique pour les exports).
- `EVENT_STATES` : libellés et couleurs : `PERIOD_STATES` + « Annulé », « Reporté ».
- `eventState(event, now)` : état actuel d’un évènement.

### `lib/milestone-order.ts`

- `MilestoneOrder` : `'dueDate' | 'label' | 'manual'`.
- `MILESTONE_ORDER_OPTIONS` : « Échéance », « Libellé », « Manuel ».
- `useMilestoneOrder()` : ordre choisi, retenu dans le navigateur (`ordo.milestones.order` ; l’ancien `title` relu `label`). Interne : `readMilestoneOrder`.
- `sortMilestones(milestones, order)` : tri (sans échéance en dernier).

### `lib/plan-card-actions.tsx`

- `planCardActions(item, { type, locked, setArchived, onEdit, onDelete })` : menu d’un jalon ou d’un sprint : « Modifier » (ni archivé ni projet archivé), « Archiver » / « Restaurer », « Supprimer ».

### `lib/confirm-plan-delete.tsx`

- `confirmPlanDelete({ title, what, count, link, done, remove })` : confirmation de suppression d’un jalon ou d’un sprint (les tâches restent, sans lui).
