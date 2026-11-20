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
| `Contributor`         | Fragment `ContributorFields`.                                                                                                                   |
| `TaskLabel`           | Fragment `TaskLabelFields` (priorité, type, étiquette, statut sans catégorie).                                                                  |
| `TaskStatus`          | Statut avec sa `category`.                                                                                                                      |
| `Milestone`, `Sprint` | Fragments des jalons et sprints.                                                                                                                |
| `TaskStatusCategory`  | Ré-export du type GraphQL.                                                                                                                      |
| `TaskInputValues`     | Champs envoyés à la création / modification (`TaskInput` partagé).                                                                              |
| `TaskSave`            | Enregistrement immédiat d’un changement depuis le panneau (`updateTask.mutateAsync`), donné à `TaskDescription` et `TaskLinks`.                 |
| `TaskLabelKind`       | `'status' \| 'priority' \| 'type' \| 'tag'` (clés de `LabelDocuments`).                                                                         |
| `BulkChanges`         | Changements d’une modification en masse (statut, priorité, type, jalon, effort, dates, ajouts / retraits d’assignés, d’étiquettes, de sprints). |

Hooks et constantes exportés :

| Nom                           | Rôle                                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `tasksQueryKey`               | Clé `['tasks']` des données des tâches.                                                                                                         |
| `useTasksData()`              | Requête `TasksData` : tâches, contributeurs, listes de paramètres, jalons, sprints.                                                             |
| `useTaskComments(id)`         | Commentaires d’une tâche (clé `['tasks', id, 'comments']`).                                                                                     |
| `useCreateTask()`             | Mutation `createTask`.                                                                                                                          |
| `useUpdateTask()`             | Mutation `updateTask` (`{ id, input }`, sans projet : le projet change par transfert).                                                          |
| `useSetTasksClosed()`         | Mutation `setTasksClosed` ; met à jour `closed` dans le cache tout de suite (optimiste).                                                        |
| `useDuplicateTask()`          | Mutation `duplicateTask` (décision D20, « … (copie) ») ; renvoie `id` et `number` de la copie.                                                                                       |
| `useMoveTask()`               | Mutation `moveTask` (`id`, `beforeId`, `parentId?`) ; réordonne le cache tout de suite.                                                         |
| `useTaskBlock()`              | Ajoute (`add: true`) ou retire un lien « bloque ».                                                                                              |
| `useTaskRelation()`           | Ajoute ou retire un lien « relative à ».                                                                                                        |
| `useTaskCommentMutations()`   | `{ add, update, remove }` des commentaires de tâche.                                                                                            |
| `useContributorMutations()`   | `{ create, update, remove, setProjectContributors }` ; `remove` invalide aussi la facturation (`accountingQueryKey`).                           |
| `useTaskLabelMutations(kind)` | `{ create, update, remove }` d’une liste de paramètres (statut, priorité, type, étiquette).                                                     |
| `useTaskColumnDefaults()`     | Colonnes des nouvelles vues de l’espace (`readTaskColumnDefaults`).                                                                             |
| `useSetTaskColumnDefaults()`  | Les change (`null` : celles de l’app) ; mise à jour optimiste du cache.                                                                         |
| `useDoableTaskIds(enabled)`   | Ensemble des tâches faisables maintenant ; demandé seulement si `enabled`, rafraîchi chaque minute ; envoie le décalage UTC du navigateur.      |
| `useBulkTaskMutations()`      | `{ update, transfer, archive, remove }` : `bulkUpdateTasks` (avec `restoring`), `bulkTransferTasks`, `bulkSetTasksArchived`, `bulkDeleteTasks`. |
| `useMilestoneMutations()`     | `{ create, update, remove, move }` ; `move` (interne `useMoveMilestone`) réordonne le cache tout de suite.                                      |
| `useSprintMutations()`        | `{ create, update, remove }`.                                                                                                                   |

Interne : `LabelDocuments` (documents CRUD par type de libellé), `useTasksMutation`, `useMoveMilestone`, documents `*Document`.

## pages/

### `pages/TasksPage.tsx`

- `TasksPage()` : page `/tasks`. En-tête `PageHeader` (« Tâches »), paramètres dans la barre latérale (`PageSettings`, « Paramètres des tâches » → `TaskSettings`), puis `TaskBoard` avec `projectId={null}`. Utilisée par `app/router.tsx`.

## components/

### `components/TaskBoard.tsx`

- `TaskBoard({ projectId, projectIds?, createProjectId?, header?, emptyMessage, title, eventRange? })` : le tableau des tâches d’une portée (page ou projet). Utilisé par `TasksPage` et `features/projects/pages/ProjectPage.tsx`.
  - `projectId` : portée des vues (`null` pour la page) ; `projectIds` : projets listés (le projet et ses sous-projets) ; `createProjectId` : projet des nouvelles tâches ; `header` : contrôles avant les onglets ; `title` : titre des exports ; `eventRange` : jours des évènements au lieu de la période de la vue.
  - Vues (`useTableViews`, `tableKey: 'tasks'`) avec les premières vues `TASK_VIEWS` (« En cours », « Mes tâches », « Toutes ») et les colonnes par défaut de l’espace.
  - Options de vue `events` et `eventPeriod` : lignes d’évènements (`useCalendarEvents`) mêlées aux tâches.
  - `handleMove` (interne) : glisser-déposer → `moveTask`, ou `bulkUpdateTasks` vers un autre groupe (statut, priorité, type, jalon, assigné, étiquette, sprint).
  - `cells` (interne) : cellules d’une tâche (cellules de `inline-cells`, `extra-cells`) ou d’un évènement (`event-cells`).
  - Menu de ligne (`RowActions`), ligne d’ajout (`AddTaskRow` avec `groupDefaults`), actions de sélection (`useTaskSelectionActions`).
- Constantes internes : `EVENT_PERIOD_LABELS` (libellés des périodes), `TASK_VIEWS`.

### `components/TaskPanel.tsx`

- `TaskPanel()` : panneau latéral (`SidePanel`) de la tâche de l’URL (`?task=`), par-dessus toute page ; squelette pendant le chargement, `DetailNotFound` si introuvable. Monté par `app/layout/AppLayout.tsx`.
- Internes :
  - `TaskDetail({ task, context })` : en-tête (badges GitHub / archivée, « Fermer la tâche » / « Rouvrir » — `useTaskActions().close`, toast avec « Annuler » comme le menu et la sélection —, « Renommer » via `openLabelForm`, menu `useTaskActions`), description (`TaskDescription`), liens (`TaskLinks`), lieu (`TaskLocation`) et rappels (`TaskReminders`), dans la colonne de propriétés, sous-tâches, commentaires (`TaskComments`), colonne de propriétés (projet → transfert avec confirmation, libellés, assignés, étiquettes, bénéficiaires, effort, `TaskTime`, dates, parent, jalon, sprints, `SlotRuleInput`, liens, `TaskAlarms`, `TaskShopping`, `SheetsSection`). Chaque champ est enregistré dès qu’il change (décision D22) ; l’effort en le quittant (`useFieldSave` sur `effortFormSchema`, enregistré aussi à la fermeture du panneau) ; `SaveStatus` en tête de la colonne de propriétés (`updateTask`, transfert ou effort en cours). `Fieldset` désactivé sur une tâche archivée.
  - `LinkList({ label, tasks, candidates, context, onAdd, onRemove })` : liste « Bloque » / « Dépend de » / « Relative à » avec « Retirer » et « Ajouter une tâche » (`TaskSelect`).

### `components/TaskCreateForm.tsx`

- `TaskCreateForm({ context, defaults?, onDone })` : formulaire « Nouvelle tâche » (schéma `taskFormSchema`), lieu (`EventLocation`) et liens (`LinksField`) compris. `defaults` : projet et parent présélectionnés. Changer de projet retire parent, jalon et sprints d’une autre arborescence. Après création : toast et ouverture de la tâche (`useTaskLink`). Ouvert par `useTaskActions().create`.

### `components/TaskLinks.tsx`

- `TaskLinks({ task, locked, save })` : section « Liens » du panneau : `ItemLinks` (« Aucun lien. » sinon), `EditToggle` (« Modifier les liens », puis la coche « Terminer la modification des liens » ; sauf archivée). Interne : `TaskLinksEditor({ task, save })`, `LinksField` sur `useFieldSave` (`linksFormSchema`) : un lien est enregistré une fois validé (en quittant ses champs), un retrait tout de suite (décision D22, plus de bouton « Enregistrer »), erreurs sous les champs.

### `components/TaskDescription.tsx`

- `TaskDescription({ task, context, locked, save })` : section « Description » du panneau : `MarkdownView` (cases cochables en place, enregistrées tout de suite), `EditToggle` (« Modifier la description » / « Terminer la modification de la description »). Interne : `TaskDescriptionEditor({ task, context, save, onClose })`, `MarkdownEditor` sur `useFieldSave` (`descriptionFormSchema`) : enregistrée en quittant l’éditeur, et par Ctrl/⌘ + Entrée qui le ferme aussi (décision D22, plus de « Enregistrer » / « Annuler »).

### `components/TaskReminders.tsx`

- `TaskReminders({ value, minDate, deadline, onChange, error?, disabled? })` : « Rappels » d'une tâche (décision D16), dans « Nouvelle tâche » (`TaskCreateForm`) et le panneau (`TaskDetail`, enregistré à chaque changement) : `RemindersSelect` en « À HH:MM » et « N jours avant » l’échéance (`kinds={['at', 'days']}`, `day` vide, lot 16), aide selon « Ouverture » / « Échéance », désactivé sans échéance.

### `components/TaskLocation.tsx`

- `TaskLocation({ task, save })` : « Lieu » du panneau (`EventLocation`, sans trajet) ; enregistré au choix d'une adresse proposée ou d'un clic sur la carte, quand le texte est vidé, ou à la sortie du champ pour un texte libre (seulement s'il change ; `addressOf`, `locationOf`).

### `components/TaskDialogs.tsx`

Dialogues sur une ou plusieurs tâches (props `TasksDialogProps`), ouverts par `openTasksDialog` depuis `useTaskRowsActions` :

| Nom                   | Rôle                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DeleteTasksDialog`   | Confirmation destructive ; choix pour les sous-tâches (`CascadeChoice` : remonter ou supprimer) ; temps sans projet supprimés avec elles (`LostOnDeleteRisk`, selon le choix) ; ferme le panneau si la tâche ouverte est supprimée. |
| `TransferTasksDialog` | Projet de destination ou « Sans projet » ; avertissement de sortie d’arborescence ; annulation (`useBulkUndo().transfer`) seulement sans lien retiré. Interne : `movedLevels`. |

### `components/BulkBar.tsx`

| Nom                                | Rôle                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useTaskRowsActions(context)`      | Fabrique des actions sur des tâches (barre de sélection et menu d’une tâche) : `close` (fermer / rouvrir, `switchRowsAction`), `duplicate` (`duplicateRowsAction` sur `outermost`, avec sous-tâches, copie unique ouverte), `transfer`, `archive` (`archiveRowsAction`), `remove` ; chacune annulable depuis son toast si possible ; les tâches archivées ne sont prises que par l’archivage et la suppression. Interface interne `TaskRowsActions`. |
| `useTaskSelectionActions(context)` | Les mêmes actions en liste, pour la barre de sélection du tableau (`TaskBoard`).                                                                                                                                                                                                                                                                                 |

### `components/inline-cells.tsx`

Cellules modifiables en place des tâches (toutes en lecture seule sur une tâche archivée ; sur une sélection, la modification s’applique à toutes, via `useCellEdit`). Utilisées par `TaskBoard`.

| Nom                                         | Rôle                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `TaskLabelCell({ task, context, prefix? })` | Libellé (`EditableLabel`) : numéro en lien, renommage au double-clic, « 2/5 » des sous-tâches, `prefix` (icônes).                       |
| `LabelCell({ task, column, labels })`       | Statut, priorité ou type : pastille, liste de pastilles ; re-choisir la valeur la vide ; « Aucune valeur définie dans les paramètres ». |
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
| `TaskProjectCell({ task, context })`        | Projet : transfert, confirmation si sortie d’arborescence avec liens.                                                                   |
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
| `TimerCell({ task })`                    | « Chrono » : `TimerToggle` sur la tâche.                                                |
| `TrackedCell({ task })`                  | « Temps passé » : lien `timePath(task.id)`.                                             |
| `SubtasksCell({ task, context, onAdd })` | « Sous-tâches » (`ChildrenCell`) avec « Ajouter une sous-tâche ».                       |
| `ProgressCell({ task, context })`        | « Avancement » (`TaskProgress`).                                                        |
| `AlarmsCell({ task, context, count })`   | « Alarmes » : badge et « Nouvelle alarme » (`useAlarmForm`).                            |
| `ShoppingCell({ task, lists })`          | « Achats » : listes, « Nouvelle liste » (`openNewList`), « Rattacher une liste ».       |

### `components/event-cells.tsx`

Cellules des lignes d’évènements du tableau des tâches (`EventOccurrence`) :

| Nom                                   | Rôle                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EventLabelCell({ event, context })`  | Icône d’agenda, titre (ouvre l’évènement ; barré s’il est annulé ou reporté), lieu.                                                                                                           |
| `EventPeopleCell({ event, context })` | Personnes de l’évènement (multi-sélection, enregistrée à la fermeture).                                                                                                                       |
| `EventStatusCell({ event })`          | État en lecture seule (`eventState`, `EVENT_STATES`).                                                                                                                                         |
| `EventTimeCell({ event })`            | Temps passé sur l’évènement.                                                                                                                                                                  |
| `EventWhenCell({ event, side })`      | Début ou fin, modifiable (jour pour un évènement « journée », sinon date et heure, en heure de Paris) ; déplacer le début déplace la fin ; une fin avant le début déplace le début (décision Q). |
| `EventBeneficiariesCell({ event })`   | Bénéficiaires de l’évènement (toute la série si récurrent).                                                                                                                                   |

Internes : `useEventTargets` (évènements visés par une modification : la sélection ou celui-ci), `useEventCellLabel`, `useEventSave` (enregistre sur l’évènement ou sa série), `wall`, `fromWall`, `lengthOf`, `spanOf` (calculs de durée).

### `components/table-extras.tsx`

- `AddTaskRow({ context, defaults, projectId?, onOpenForm })` : ligne d’ajout (`AddRowField`) : un libellé + Entrée crée la tâche avec les valeurs du groupe et le statut par défaut (et la ferme si le groupe est « fermée ») ; sans projet, bouton qui ouvre le formulaire.

### `components/task-ui.tsx`

Petits composants communs des tâches :

| Nom                                                                                | Rôle                                                                                                         | Utilisé par                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `TaskRef({ task, closed?, blocked? })`                                             | Lien « #12 Libellé » avec icône d’état, ouvre le panneau.                                                    | panneau, cellules, temps      |
| `LabelSelect({ labels, value, onChange, kind?, ...SelectProps })`                  | Sélecteur d’un statut, d’une priorité ou d’un type ; avec `kind`, crée une valeur tapée (`CreatableSelect`). | formulaire, panneau           |
| `TagsSelect({ tags, value, onChange })`                                            | Multi-sélection d’étiquettes, création d’une étiquette tapée.                                                | formulaire, panneau           |
| `AssigneesSelect({ contributors, value, onChange, label?, description?, error? })` | Multi-sélection de contributeurs (`PeopleSelect`).                                                           | tâches, routines, évènements  |
| `ProjectSelect({ context, ...SelectProps })`                                       | Sélecteur de projet actif en arbre.                                                                          | tâches, temps, chrono         |
| `TaskSelect({ tasks, labelOf?, context?, ...SelectProps })`                        | Sélecteur de tâche, en arbre avec `context`.                                                                 | panneau, formulaire, cellules |
| `TaskStateIcon({ closed, blocked? })`                                              | Icône ouverte (vert), fermée (violet), bloquée (cadenas rouge), avec info-bulle.                             | partout                       |

Internes : `NEW_LABEL_TITLES`, `useLabelCreator(kind)` (ouvre le formulaire du libellé tapé via `itemCreator`).

### `components/TaskComments.tsx`

- `TaskComments({ task, context })` : fil `CommentThread` sur les commentaires de la tâche (`useTaskComments`, `useTaskCommentMutations`, `threadActions`), lecture seule si archivée. Utilisé par `TaskPanel`.

### `components/TaskSettings.tsx`

- `TaskSettings()` : paramètres des tâches : `ColumnDefaults`, puis `SettingsList` des statuts (avec catégorie), priorités, types, étiquettes, chacune avec son nombre d’utilisations. Utilisé par `TasksPage` et les paramètres d’un projet.

### `components/ColumnDefaults.tsx`

- `ColumnDefaults()` : section « Colonnes des nouvelles vues » : `DataColumnsPanel` sur les colonnes des tâches, enregistrement par `useSetTaskColumnDefaults`, bouton « Colonnes de l’app ».

### `components/TaskFilterBuilder.tsx`

- `TaskFilterBuilder({ filter, context, onChange })` : constructeur de filtre de tâches hors de leur tableau, avec les colonnes des tâches (`FieldsFilterBuilder`). Utilisé par `features/dashboards/components/source-filters.tsx`.

### `components/TaskProgress.tsx`

- `TaskProgress({ done, total, label, extra?, size?, unit? })` : barre d’avancement et « 3/5 tâches » (`unit=false` : « 3/5 »). Utilisé par le panneau, `ProgressCell`, jalons, sprints.

### `components/EffortInput.tsx`

- `EffortInput(props: NumberInputProps)` : champ « Effort » (≥ 0, deux décimales, virgule française). Utilisé par le formulaire et le panneau.

### `components/MilestonesPanel.tsx`

- `MilestonesPanel({ projectId })` : jalons d’un projet (paramètres du projet) : ordre (`SegmentedControl`, `useMilestoneOrder`), glisser-déposer en ordre manuel (`SortableArea`), archivés (`useArchivedToggle`), cartes `PlanCard`, création / modification / suppression.
- Internes : `MilestoneForm({ projectId, milestone?, onDone })` (schéma `milestoneFormSchema` ; nouveau : « Créer le jalon » ; existant : enregistré champ par champ, décision D22, `useFieldSave` — libellé et description en les quittant, la description par `fieldProps` —, seuls les champs changés envoyés, `SaveStatus` ; le jalon de `useTaskContext` suivi ; archivé ou projet archivé : lecture seule), `milestoneValues(milestone?)` (valeurs du formulaire), `SortableMilestone({ milestone, sortable, children })` (carte avec poignée `DragHandle`).

### `components/SprintsPanel.tsx`

- `SprintsPanel({ projectId })` : sprints d’un projet : état (`periodState`), avancement en tâches et en effort (`leafEffort`), cartes `PlanCard`, archivés, valeurs proposées pour un nouveau sprint (suite du dernier, même durée).
- Internes : `SprintForm({ projectId, sprint?, defaults, onDone })` (schéma `sprintFormSchema` ; nouveau : « Créer le sprint » ; existant : enregistré champ par champ, décision D22, `useFieldSave`, le sprint entier à chaque champ — libellé et objectif en les quittant —, `SaveStatus` ; le sprint de `useTaskContext` suivi ; archivé ou projet archivé : lecture seule), `sprintValues(sprint)`, `sprintInput(values)`.

### `components/PlanCard.tsx`

- `PlanCard({ icon, title, archived, badges?, late?, dates, actions, progress, description?, targets, onDescription? })` : contenu de la carte d’un jalon ou d’un sprint (titre, badges, retard en rouge — décision AF —, dates, menu, avancement, description cochable).

### `components/ProjectContributors.tsx`

- `ProjectContributors({ projectId })` : contributeurs d’un projet (directs, hérités « Via … », « Moi ») avec leur nombre de tâches ; ajout d’un contributeur existant, « Nouveau contributeur », retrait (`setProjectContributors`). Utilisé par les paramètres d’un projet.

### `components/ContributorsManager.tsx`

- `ContributorsManager({ contributors, usage })` : section « Contributeurs » des paramètres généraux : badges « Moi », « Membre », « Relation » / « Proche », archivé ; modifier, archiver, supprimer (confirmation). `usage` : nombre de tâches assignées par contributeur. Utilisé par `features/projects/pages/SettingsPage.tsx`.

### `components/ContributorForm.tsx`

- `ContributorForm({ contributor?, defaultProjectIds?, onDone })` : formulaire d’un nouveau contributeur (« Ajouter » ; identifiant proposé par `suggestHandle` tant qu’il n’est pas touché) ou panneau d’un contributeur existant enregistré champ par champ (décision D22, `useFieldSave` : nom et identifiant en les quittant, image et projets dès qu’ils changent, seuls les champs changés envoyés ; `SaveStatus` ; le contributeur de `useTaskContext` suivi ; archivé : lecture seule) : nom, identifiant, image (`IconField`, `formIconProps` : `avatar` / `removeAvatar`), projets (valeur du formulaire ; pas de projets pour « Moi »), et ses détails (`PersonDetailsFields` : date de naissance, rappels d’anniversaire, adresse mail, téléphones ; enregistrés en les quittant, les rappels dès qu’ils changent ; lot 16). Ouvert par `useContributorForm`.

### `components/TaskTable.module.css`

Classe `recurring` (dans la couche `app`) : les petites icônes devant le libellé (GitHub, alarmes) ne rétrécissent pas et sont en couleur atténuée.

## hooks/

### `hooks/use-task-context.ts`

- `TaskContext` (interface) : données et fonctions partagées des écrans de tâches : `tasks`, `contributors`, `statuses`, `priorities`, `types`, `tags`, `projects`, `milestones` (dans l’ordre choisi), `milestoneOrder`, `milestoneRank`, `sprints`, `meId`, index `taskById`, `statusById`, `priorityById`, `typeById`, `tagById`, `contributorById`, `projectById`, `milestoneById`, `sprintById`, et :
  - `taskLabel(task, fromProjectId?)` : chemin complet « Client › Projet › #3 Parent › #12 Titre » ;
  - `milestoneLabel`, `sprintLabel` : « Client › Projet › Nom » ;
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
| `taskRef(task)`      | « #12 » suivi d’une espace, vide sans projet.                  |
| `taskNumber(task)`   | « #12 », vide sans projet.                                     |
| `closedMark(task)`   | « (fermée) » avec son espace, ou rien.                         |
| `taskNumbered(task)` | « #12 Libellé », le libellé seul sans projet.                  |
| `taskName(task)`     | Nom dans un message : « #12 », ou « « Libellé » » sans projet. |

Internes : `NO_PROJECT_LABEL` (« Sans projet »), `NO_PROJECT_NODE`.

### `hooks/use-task-link.ts`

- `TASK_PARAM` : `'task'`, paramètre d’URL de la tâche ouverte.
- `useTaskLink()` : `{ to(id), open(id), close() }` : lien / navigation qui ouvre la tâche dans le panneau en gardant les autres paramètres ; `close` remplace l’entrée d’historique.

### `hooks/use-task-actions.tsx`

- `useTaskActions(context)` : `{ menu(task), close(task), create(defaults?) }` : entrées du menu d’une tâche (« Dupliquer », « Transférer », « Transformer en routine » — `useConvertActivity().toRoutine`, lot 15 —, « Archiver », « Supprimer » ; « Restaurer », « Supprimer » si archivée), « Fermer » / « Rouvrir » d’une tâche seule (`close` de `useTaskRowsActions` : toast avec « Annuler », bouton du panneau) et ouverture du formulaire de création dans le panneau (« Nouvelle tâche » / « Nouvelle sous-tâche »). Utilisé par `TaskBoard`, `TaskPanel`, le menu « Ajouter » de l’en-tête.

### `hooks/use-task-columns.ts`

- `useTaskColumns(context, today, { doable?, eventComments? })` : colonnes du tableau des tâches (`taskColumns`) avec ce qui leur manque : tâches faisables (`useDoableTaskIds`, seulement si `doable`), alarmes (`useTaskAlarmCounts`), listes d’achats, créneaux et types que la condition peut citer (`useSlotChoices().all`, `slotSchedules` : le filtre « Créneaux » porte sur les créneaux et types cités par la condition, `conditionReferences`), commentaires des évènements. Utilisé par `TaskBoard`, `ColumnDefaults`, `TaskFilterBuilder`, et les tableaux de bord / l’accueil via `matchTasks`.

### `hooks/use-label-items.tsx`

- `useTaskStatusItems()` : liste de paramètres des statuts (`SettingsItemKind`) avec le champ « Catégorie » ; inclut `remove` ; son `update` confirme d'abord (`confirmedDestructive`) une catégorie passée vers ou hors de « Annulé », avec le nombre de tâches fermées ou rouvertes (`statusClosing`, tâches du cache).
- `useTaskLabelItems(kind)` : liste de paramètres des priorités, types ou étiquettes.
- Internes : `STATUS_CATEGORY_OPTIONS`, `LIST_KINDS` (type de liste de paramètres par type de libellé).

### `hooks/use-contributor-form.tsx`

- `useContributorForm()` : ouvre `ContributorForm` dans le panneau (« Nouveau contributeur » / « Modifier le contributeur »), avec des projets par défaut.

## lib/

### `lib/task-columns.ts`

| Nom                                                                        | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TaskTableRow` (type)                                                      | Ligne du tableau : `{ kind: 'task', task }` ou `{ kind: 'event', event }`.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `taskColumns(context, today, extras?)`                                     | Toutes les colonnes `DataColumn` des tâches : libellés, tailles, tri (`sortValue`), texte (`taskCell` / `eventCell`), filtres (projet avec parents, « Moi », sprints relatifs, parent avec ancêtres…), groupes (projets en arbre), colonnes de masse ; plus les colonnes cachées « Numéro », « Description », drapeaux (`flag` interne : « Fermée », « En retard », « Bloquée », « A des sous-tâches », « Archivée », « Faisable maintenant », « A des achats », « A des alarmes », « A des commentaires ») et « Catégorie de statut ». |
| `matchTasks(tasks, columns, { filter, search?, includeArchived? }, today)` | Tâches gardées par un filtre exprimé dans les colonnes du tableau. Utilisé par l’accueil (`home-data.ts`) et les tableaux de bord (`chart-data.ts`).                                                                                                                                                                                                                                                                                                                                                                                    |
| `filterUses(group, field)`                                                 | Le filtre a-t-il une condition sur ce champ (pour ne charger que le nécessaire).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `eventRowKey(event)`                                                       | Clé de la ligne d’un évènement (`taggedKey('e', …)`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Internes : `TaskColumnExtras`, `STATUS_CATEGORY_ORDER`, `STATUS_CATEGORY_LABELS`, `SPRINT_TOKENS`.

### `lib/columns-meta.ts`

- `COLUMN_LABELS` : libellé de chaque colonne (`TaskColumn`).
- `LOCKED_COLUMNS` : colonnes non masquables (`label`).
- `COLUMN_SIZES` : largeur par défaut (px).
- `BULK_EDITABLE_COLUMNS` : colonnes modifiables sur une sélection de cellules.

### `lib/task-rows.ts`

- `sortValue(task, column, context)` : valeur de tri d’une tâche (positions des libellés, rang du jalon dans l’ordre choisi, premier sprint, nombre de liens…; vide en dernier).
- `eventSortValue(event, column, context, comments?)` : idem pour un évènement.
- Types internes `TaskSortKey`, `SortValue`.

### `lib/export.ts`

- `taskCell(task, column, context)` : texte d’une cellule de tâche (exports, recherche) ; liens « #12 » avec le projet ailleurs (`taskShortRef`).
- `eventCell(event, column, context, comments?)` : texte d’une cellule d’évènement.

### `lib/cell-edit.ts`

- `useCellEdit(task, column)` : enregistre une modification de cellule : sur la tâche seule (`updateTask`), ou sur toute la sélection en une requête de masse avec son annulation (`useEntityCellEdit`, `bulkUpdateTasks`, toast « Modification appliquée à … ») ; renvoie `{ apply, count, targets }`. Les tâches archivées sont exclues de la sélection.

### `lib/bulk-undo.ts`

- `useBulkUndo()` : fabriques des « Annuler » des toasts, à partir de l’état des tâches avant l’action : `changes(tasks, changes)` (rétablit champs et ajouts / retraits, `restoring: true`), `closed(tasks, closed)` (une tâche « Annulé » rouverte à la main retrouve aussi son statut, qui la referme : `update` du statut avec `restoring`), `archived(tasks, archived)`, `transfer(levels)` (remet chaque niveau dans son projet). Toasts « Action annulée. » / « L’action n’a pas pu être annulée. ».
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

- `inProjectTree(context, projectId)` : dit si un élément (tâche, routine) d'un projet est dans l'arborescence de projets d'un autre (sans projet : avec ceux sans projet). Utilisé aussi par `linkableRoutine` (routines).
- `linkableTasks(context, projectId, taskId, extra?)` : tâches liables (même arborescence, non archivées, pas elle-même).
- `countSubtasks(context, taskId)` : nombre de sous-tâches à toute profondeur.

### `lib/task-effort.ts`

- `leafEffort(task, context)` : effort compté dans une somme (le sien sans sous-tâches, 0 pour un parent). Utilisé par `SprintsPanel` et les tableaux de bord.

### `lib/task-overdue.ts`

- `isTaskOverdue(task, today)` : « Échéance » suivie (`effectiveDeadline`, calculée par l’API : la sienne, sinon celle de son sprint unique) passée et tâche non fermée (décision DD) ; la seule implémentation (règle eslint, sur `deadline` et `effectiveDeadline`).
- `sprintDateHint(task, field)` (`lib/sprint-dates.ts`) : « 12 nov. 2026 (sprint) » quand la tâche prend son « Ouverture » ou son « Échéance » de son sprint unique (`minDateFromSprint`, `deadlineFromSprint`), sinon `null` ; texte grisé du champ vide (`DateCell`, `TaskPanel`).

### `lib/my-tasks.ts`

- `myTasksFilter(period)` : filtre « Mes tâches » d’une période (`'today' | 'tomorrow' | 'week'`) : tâches ouvertes assignées à moi ou à personne, en retard, en cours, ou qui commencent, finissent, atteignent leur échéance ou se déroulent pendant la période. Utilisé par l’accueil (`home-data.ts`). Internes : `condition`, `group`.

### `lib/event-format.ts`

- `eventWhen(event, side, numeric?)` : début ou fin d’un évènement en texte (format numérique pour les exports).
- `EVENT_STATES` : libellés et couleurs : `PERIOD_STATES` + « Annulé », « Reporté ».
- `eventState(event, now)` : état actuel d’un évènement.

### `lib/milestone-order.ts`

- `MilestoneOrder` : `'dueDate' | 'label' | 'manual'`.
- `MILESTONE_ORDER_OPTIONS` : « Échéance », « Libellé », « Manuel ».
- `useMilestoneOrder()` : ordre choisi, retenu dans le navigateur (`ordo.milestones.order` ; l’ancien `title` relu `label`, décision BI). Interne : `readMilestoneOrder`.
- `sortMilestones(milestones, order)` : tri (sans échéance en dernier).

### `lib/plan-card-actions.tsx`

- `planCardActions(item, { type, locked, setArchived, onEdit, onDelete })` : menu d’un jalon ou d’un sprint : « Modifier » (ni archivé ni projet archivé), « Archiver » / « Restaurer », « Supprimer ».

### `lib/confirm-plan-delete.tsx`

- `confirmPlanDelete({ title, what, count, link, done, remove })` : confirmation de suppression d’un jalon ou d’un sprint (les tâches restent, sans lui).
