# Code web : accueil

Tous les fichiers de `apps/web/src/features/home/` : la page d’accueil, ses cartes, la grille réordonnable et les calculs partagés (tâches du jour, temps de la semaine, facturation, trésorerie). Fonctionnalités : [Accueil](../../../features/cross-cutting/home.md).

## `pages/`

### `pages/HomePage.tsx`

`HomePage()` : route `/` (index de `AppLayout`) ; son « aujourd’hui » (`useToday`) change tout seul à minuit. En-tête « Bonjour … » avec « Nouveau client » (PRO) et « Nouveau projet » (`useEntityActions`), tuiles `StatTile`, puis `SortableGrid` des cartes. Ordre gardé par `useLocalStorage` `ordo.home.cards` ; bouton « Disposition par défaut ».

Internes : `CardId`, `DEFAULT_ORDER` (`tasks`, `routines`, `agenda`, `chrono`, `shopping`, `billing`, `quotes`, `treasury`, `mail`, `time`), `PRO_CARDS` (`billing`, `quotes`). Données : `useMyTodayTasks`, `useWeekTime`, `useAccountingDocuments`, `useImportedDocuments` + `billingSummary`, `useTreasuryProjection` sur 90 jours + `balanceIn30Days`, `useMailAccounts`, `useUnreadMailCount`.

## `components/`

### `components/HomeCard.tsx`

- `HomeCard({ title, icon, to?, linkLabel = 'Tout voir', loading?, note?, children })` : carte (titre, icône, lien, note sous le titre, squelette `ListSkeleton`) ; dans la grille, affiche la poignée lue dans `DragHandleContext`. Utilisé par toutes les cartes.
- `CardFigure({ label, value, color? })` : petit chiffre d’une carte. Utilisé par `TasksCard`… (`WorkCards`, `LifeCards`, `FinanceCards`).
- Tout retard de l’accueil est en orange, la couleur de retard commune (`LATE_COLOR`, `LateBadge` de `components/feedback`) : indices des tuiles, tâches, routines, factures et prochaines échéances de trésorerie.

### `components/HomeList.tsx` (+ `Home.module.css`)

- `HOME_ROWS = 10` : lignes au plus dans une liste. Utilisé aussi par `TreasuryCard`.
- `HomeList({ items, render, group? })` : premières lignes, éventuellement groupées (`groupBy`, titres `SubSection`), puis « + N autres ».
- `HomeRow({ to, label, subtitle?, value?, emphasis? })` : ligne-lien d’une carte (style de `StatTile.module.css`).

Utilisés par `WorkCards`, `LifeCards`, `FinanceCards`, `MailCard`. `Home.module.css` porte le style des lignes (`row`).

### `components/SortableGrid.tsx`

`SortableGrid({ items, onReorder })` : grille `SimpleGrid` (1 / 2 / 3 colonnes) dans `SortableArea` (`components/dnd/sortable`), réordonnée par `arrayMove`. Interne : `SortableItem({ id, children })` (`useSortableItem`, fournit `DragHandleContext`). Utilisé par `HomePage`.

### `components/WorkCards.tsx`

- `TasksCard({ context, todayTasks, today })` : « Tâches » : ses tâches de `useHomeTasks` (vue par défaut de la page des tâches, sans vue « Mes tâches du jour » `todayTasks`), lien `viewPath` sur la vue ; note `viewNote`. Sections « Maintenant » / « Plus tard » (`HomeList` groupé par section, interne `SECTION_TITLES`, titres tirés de `DOABLE_GROUP_LABELS`), raison d’une tâche « Plus tard » par `TASK_WAIT_REASON_LABELS` ; « Maintenant » vide : `SubSection` et `EmptyState` « Rien à faire maintenant. » ; lien de tâche `useTaskLink` (panneau), sous-titre projet, `taskNumber` et raison, `LateBadge` ou statut.
- `AgendaCard({ today })` : « Agenda » des 7 jours d’aujourd’hui à J+6 : `useHeldEvents(today, today + 6)` + `nextRings(useAlarms)` avant J+7, triés par jour puis heure, groupés par jour (`dayLabel`) ; un évènement commencé avant aujourd’hui va sous aujourd’hui, sans heure. Interne : `AgendaItem`.
- `TimeCard({ context, time })` : « Temps passé » ; 4 premiers projets avec `Progress`. Interne : `ProjectName({ context, projectId })` (libellé et parent en gris).

### `components/LifeCards.tsx`

- `RoutinesCard({ today })` : « Routines » : vue par défaut de la page des routines (`useDefaultTableView('routines')`, colonnes `useRoutineColumns`, `useViewRows` sans les archivées, `viewList`), lien `viewPath` ; sans vue, « Routines du jour » : routines `due` ou `late` (`currentRoutineState`, `doable` de `useRoutineColumns`), triées ; note `viewNote` ; « Reporter au lendemain » seulement avec `movableOccurrence` ; `RoutineDoneToggles`, `WaitingIcon` (`waitingFor`), `LateBadge`, horaires (`scheduleOf`, `windowText`, `windowOf`), « Reporter au lendemain » (`usePostponeRoutine`).
- `ShoppingCard()` : « Achats » : produits manquants (`useShoppingData`), listes ouvertes (`useShoppingLists`, `leftToBuy`).

### `components/FinanceCards.tsx`

- `BillingCard({ summary, today })` : « Facturation » : chiffres de `BillingSummary` et factures en retard (`useOverdueInvoices`).
- `QuotesCard({ summary, today })` : « Devis en attente » (`summary.pendingQuotes`, `fmt.daysAgo`).
- `TreasuryCard({ projection, today })` : « Trésorerie » : aujourd’hui, à 30 jours (`balanceIn30Days`), point bas sur 3 mois, `Sparkline`, mouvements prévus dans les 30 jours (non `ACTUAL`, non archivés) avec `SignedAmount`.

### `components/ChronoCard.tsx`

`ChronoCard({ context })` : « Chrono et alarmes » : un `RunningTimer` par chrono en cours (`useRunningTimers`) puis « Démarrer un autre chrono » (`openTimerForm`), sinon `TimerStartForm` (`features/time/components/TimerCard`), les minuteurs en cours avec leurs commandes et « Lancer un minuteur » (`CountdownList bare`), prochaine alarme (`nextRings`), « Programmer une alarme » (`useAlarmForm`).

### `components/MailCard.tsx`

`MailCard({ today })` : « Mails non lus » des boîtes actives (`useMailAccounts`, `useUnreadMails`), lien `mailPath(account, 'INBOX', uid)`, objet ou `NO_SUBJECT`, heure (aujourd’hui) ou `dayLabel`.

## `lib/`

### `lib/drag-handle.ts`

`DragHandleContext` : contexte de la poignée (`SortableHandle`) de la carte en cours de tri, `null` hors grille. Fourni par `SortableGrid`, lu par `HomeCard`.

### `lib/home-data.ts`

| Export                                        | Rôle                                                                                                                                                                                                                                    | Utilisé par                             |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `dayLabel(date, today)`                       | « Aujourd’hui », « Demain », « Hier » ou `fmt.weekday`.                                                                                                                                                                                 | `WorkCards`, `FinanceCards`, `MailCard` |
| `viewNote(view, page, fallback)`              | Note d’une carte qui montre la vue par défaut d’une page : « Vue « … » de la page « … ». », ou « Aucune vue enregistrée sur la page « … » : … ». | `TasksCard`, `RoutinesCard` |
| `ViewItem<T>`, `viewList(view, keyOf)`        | Lignes d’une vue (`ViewRows`) en éléments de `HomeList` (`key`, `group`, `row` ; une ligne de plusieurs groupes dans chacun), avec les titres de groupes quand la vue regroupe. | `RoutinesCard` |
| `useHeldEvents(from, to)`                     | Évènements de la période sans les annulés (`calledOff`).                                                                                                                                                                                | `AgendaCard`, `AgendaNavBadge`          |
| `IN_30_DAYS`                                  | Libellé « Dans 30 jours ».                                                                                                                                                                                                              | `HomePage`, `TreasuryCard`              |
| `balanceIn30Days(series, today)`              | Dernier point de la projection à J+30 au plus tard.                                                                                                                                                                                     | `HomePage`, `TreasuryCard`              |
| `BillingSummary`                              | Reste dû, en retard (montant et nombre), CA HT du mois et de l’année, devis en attente (et total HT), brouillons.                                                                                                                       | `HomePage`, `FinanceCards`              |
| `billingSummary(documents, today, imported?)` | Calcul du résumé : archivés exclus ; brouillons comptés à part ; devis en attente = catégorie de suivi `SENT` ; avoirs en négatif ; documents importés (hors devis) comptés dans le CA ; devis triés du plus ancien envoi.              | `HomePage`                              |
| `useMyTodayTasks(context, today)`             | `{ tasks, overdue }` (tuile « Tâches du jour », pastille, et carte « Tâches » sans vue) : mes tâches du jour par le filtre `myTasksFilter('today')` et les colonnes du tableau des tâches (`useTaskColumns`, `matchTasks`), en retard d’abord (`isTaskOverdue`), puis par échéance ou date de fin, puis numéro. | `HomePage`, `TasksNavBadge` (avec `useHomeTasks`) |
| `HomeTaskSection`, `HomeTaskItem`, `HomeTasks`, `useHomeTasks(context, todayTasks, today)` | Tâches de l’accueil : celles de la vue par défaut de la page des tâches (`useDefaultTableView('tasks')`, `useTaskColumns` avec `viewUses`, `taskTableRows`, `useViewRows` sans les archivées `isArchivedTaskRow`, ses lignes sans les groupes) ; sans vue, `todayTasks` ; sans les tâches fermées ; section `now` (faisables maintenant, `useDoableTaskIds(true)`) puis `later`, chacune dans l’ordre de la vue ; `nowCount`, `waitReasons` (`useTaskWaitReasons(true)`, la même requête), `view`, `viewPending`, `loading`. | `TasksCard`, `TasksNavBadge` |
| `WeekTime`                                    | Secondes du jour, de la semaine, et par projet (décroissant).                                                                                                                                                                           | `HomePage`, `TimeCard`                  |
| `useWeekTime(today)`                          | Temps depuis le début de la semaine de l’espace (`filterPeriod('thisWeek', …, currentWeek())`, `useTimeEntriesSince`), chrono en cours compté jusqu’à maintenant (`useNow`).                                                            | `HomePage`, `TimeNavBadge`              |
