# Composants similaires et redondances de code

État au 17 novembre 2026, après le plan précédent en cinq étapes (22 points, voir [Déjà unifié](#déjà-unifié)).

Ce qui reste se range en trois familles :

- **API :** les vérifications « existe, sinon introuvable » et les erreurs de champ, recopiées partout ; les routes REST ; quelques modèles GraphQL répétés.
- **Web, briques existantes contournées :** les nouveaux composants communs (`SubSection`, `SectionHeader`, `ErrorAlert`, `categoryPaths`…) ne sont pas encore repris partout.
- **Web, nouveaux doublons :** surtout dans la trésorerie, la facturation, le stock et l'agenda (liens entre écritures, quantités, formulaires d'export, montants signés).

La relecture a aussi trouvé quelques bugs et incohérences, listés en premier.

La bibliothèque de documents n'est pas traitée : elle sera refaite entièrement.

## Bugs et incohérences

### 1. Dates d'un évènement décalées hors de France

`features/calendar/components/EventRepetition.tsx:30-36` formate `new Date(`${d}T00:00:00Z`)` comme un instant local. Dans un fuseau négatif, le résumé affiche la veille. `fmt.day(d)` sait déjà formater un jour seul.

### 2. Remise globale toujours en euros

`features/accounting/components/DocumentEditor.tsx:652` écrit `'€'` en dur, alors que l'acompte (`:599`) et les lignes suivent la devise du document.

### 3. Personnes des achats validées de trois façons

- `services/shopping/shopping.ts:47` exige un membre de l'équipe ;
- `services/shopping/stock.ts:126-129` accepte tout contributeur ;
- `services/shopping/sheets.ts` ne vérifie rien.

**Fait** (règle du 18 novembre 2026) : les bénéficiaires peuvent être n'importe qui (tout contributeur, toute relation) ; les contributeurs, n'importe qui sans projet, sinon les seuls contributeurs du projet. `assertPeople` (`services/shopping/people.ts`) vaut pour les achats, le stock et les fiches, et `usePeople` offre tous les contributeurs. Les assignés des tâches passent par `assertProjectContributors`, comme les routines et les évènements, au lieu d'être rattachés d'office au projet ; seul le transfert d'une tâche rattache encore ses assignés au projet cible.

### 4. Petites incohérences

- **GitHub :** `services/github/board.ts:693-707` (`createMilestone`) refait l'appel de `githubRequest` sans gérer 401, 403 et 429.
- **Mail :** `services/mail/sender.ts:44` et `reader.ts:472` cherchent les dossiers spéciaux sans repli sur le nom, contrairement à `organize.ts:67 specialFolder`.
- **Étiquettes :** `services/core/labels.ts:67-68` calcule la position suivante à la main, hors transaction, au lieu de `nextPositionIn`.
- **Recherche des tableaux :** `components/data-table/table/table-engine.ts:127-128, 173-188` est sensible aux accents, contrairement aux sélecteurs en arbre.
- **Erreurs de bénéficiaire :** **Fait** : une erreur de champ (`beneficiaryIds`) partout, routines, tâches et évènements.

## API

### 5. « Existe, sinon introuvable »

- **Un id :** `if (x && !(await prisma.M.findUnique({ where: { id: x }, select: { id: true } }))) throw notFound(…)`, 37 copies, dont 15 pour le projet. Les pires : `shopping/stock.ts`, `shopping.ts`, `treasury/treasury.ts:193-195`, `treasury-budgets.ts:40-42`, `tasks/tasks.ts:154-158`. `shopping/sheets.ts:76 assertProject` est un wrapper local.
- **Une liste :** `count({ where: { id: { in } } }) !== n`, 41 copies, chacune avec son dédoublonnage.
- **Proposition :** `assertExists(model, id, what)` et `assertAllExist(model, ids, what)` dans `services/core/lookup.ts`, avec un choix entre erreur de champ et NOT_FOUND (voir 4).

### 6. `fieldError` redéfini

- 6 copies locales : `routines.ts:64`, `tasks.ts:18`, `time-entries.ts:13`, `accounting-documents.ts:80`, `projects.ts:117` (`invalidParent`), `core/icons.ts:19`.
- ~35 `clientError('BAD_USER_INPUT', m, { fields: { [f]: m } })` en ligne (`treasury-settings.ts`, `treasury.ts`, `mail/accounts.ts`, `geo.ts`…).
- **Proposition :** un seul `fieldError` exporté par `graphql/errors.ts`.

### 7. Routes REST

- La même garde de session (4 lignes) 10 fois : `routes/accounting.ts`, `attachments.ts`, `exports.ts` ×4, `icons.ts`, `mail.ts`, `treasury.ts`.
- 9 blocs d'en-têtes de téléchargement (`Content-Disposition`, `no-store`, `nosniff`).
- 6 `catch` de `GraphQLError` aux réponses différentes : 400 en texte, 400 en JSON, 409.
- Le nettoyage du nom de fichier (`exports.ts` ×4, `treasury-pdf.ts:384`) et la lecture d'un paramètre texte (`accounting.ts:16`, `treasury.ts:15`).
- **Fait** : `routes/http.ts` avec `requireSession`, `queryText`, `safeFilename`, `sendDownload` et `sendServiceError` : une erreur de service part en JSON `{ error }`, avec le statut de son code (400, 401, 404, 409, 429, 503) ; une autre est journalisée et répond 500 sans détail.

### 8. GraphQL

- **Listes d'ids de relations :** `t.idList({ select: { X: { select: { id: true } } }, resolve: (r) => r.X.map((x) => x.id) })`, 22 fois (tâches ×6, routines, fiches, achats, stock, temps). Proposition : `relationIds(t, 'members')`.
- **Objets nom + couleur + position :** 9 définitions (`calendar.ts:21`, `shopping.ts` ×3, `tasks.ts:135`, `workspace.ts:21`, `sheets.ts:44`, `mail.ts:15`, `treasury.ts:81`). Proposition : `labelObject(name)` dans `graphql/label-inputs.ts`.
- **`BY_POSITION` contourné :** 21 `[{ position: 'asc' }, { createdAt: 'asc' }]` dans les modules, et deux constantes locales `byManualOrder` (`workspace.ts:11`, `tasks.ts:19`).
- **`String(id)` inutiles :** les ID arrivent déjà en `string` (`builder.ts:16`). 63 `String(id)` et 34 `ids.map(String)` (achats, routines, fiches, stock, commentaires, listes, lieux).

### 9. Arbres et ordre contournés

- `routines.ts:441-450 parseCategory` recopie `assertTreeParent`.
- `contributors.ts:137, 168` remontent les projets parents à la main, sans garde contre les cycles (`lineageOf`).
- `geo.ts:239-246 movePlace` refait le contrôle de parent et le déplacement de `moveInOrder`.
- `labels.ts` : le paramètre `transaction` et `findMany` ne servent plus depuis la suppression des déplacements ; `task-labels.ts:13` construit encore la transaction.

### 10. Mail et GitHub

- **Verrou de dossier IMAP :** `getMailboxLock` puis `try/finally release()`, 13 fois (`reader` ×6, `organize` ×3, `drafts` ×2, `linked`, `searches`). Proposition : `withMailbox(client, folder, fn)` dans `imap.ts`.
- **Dossier des brouillons :** trouver ou créer, recopié dans `drafts.ts:49` et `scheduled.ts:70-72` ; `organize.ts:67 specialFolder` est la version générale, à exporter.
- **Personnes des achats :** écriture et relecture des membres et relations recopiées dans `sheets.ts`, `shopping.ts` et `stock.ts`. Proposition : `services/shopping/people.ts` (`peopleData`, `peopleIds`, `assertPeople`), avec la règle du point 3.
- **Message d'erreur :** `e instanceof Error ? e.message : String(e)`, 7 fois. Proposition : `errorMessage()`.

### 11. Dates et argent partagés contournés

- **Dernier jour du mois** par `Date.UTC(y, m, 0)` : `routines.ts:222`, `work-schedules.ts:599`, `dates/recurrence.ts:264` (`daysInMonth`).
- **Index de mois :** `monthIndex` et `shiftMonth` privés (`work-schedules.ts:566-577`), `budgetMonths` (`accounting/treasury.ts:205-206`). Proposition : `monthIndex` et `monthFromIndex` dans `dates/months.ts`.
- **Jours :** `tables/filters.ts:46-53, 84-92` refait `addDays`, `formatDay`, `calendarStart`, `shiftCalendar` ; `86_400_000` dans `github/sync.ts:616` et `calendar-ics.ts:171` ; des dates en ``T00:00:00Z`` au lieu de `parseDay` (`graphql/modules/treasury.ts:828`, `treasury-pdf.ts:253`).
- **Expressions régulières :** HH:MM 7 fois, AAAA-MM-JJ 4 fois. Proposition : `timeOfDaySchema` et `daySchema` dans `dates/`.
- **Centimes :** `/ 100` au lieu de `fromCents` (`accounting-documents.ts`, `treasury-loans.ts`) ; `Math.round(x * pct / 100)` 7 fois (proposition : `percentOf`) ; `formatMoney` réécrit dans `shared/accounting/treasury.ts:315`.

## Web : briques existantes contournées

### 12. Blocs de page

- **`SubSection` :** la légende `Text size="xs" fw={600} c="dimmed" tt="uppercase"` écrite à la main 10 fois : `TaskPanel.tsx:281, 324, 358`, `RoutineMoveForm.tsx:167`, `RoutineForm.tsx:148`, `WorkCards.tsx:124`, `FinanceCards.tsx:39, 153`, `Comments.tsx:31`, `ProjectPage.tsx:259`.
- **`SectionHeader` :** `Group` + `Title order={2} size="h4"` + actions, 5 fois : `ClientBillingSection.tsx:142`, `ProjectBillingPanel.tsx:33`, `TimePage.tsx:39`, `ClientPage.tsx:79`, `ProjectPage.tsx:251`. Le texte d'introduction suivi d'un bouton (jalons, sprints, plages, facturation ×3, fiches, mail) gagnerait un `SectionHeader` sans titre.
- **`PageHeader` :** `HomePage.tsx:75-86` fait son propre titre.
- **`ErrorAlert` :** `ProjectGithubPanel.tsx:286`, `DocumentEditor.tsx:793` (sans icône).
- **`EmptyState` :** `ScheduledMailsList.tsx:20` (dans un `ThemeIcon`), `ImportedDocumentPage.tsx:84`, `GithubSettings.tsx:127` (une `Alert` grise).
- **`DragHandle` :** la poignée des cartes de l'accueil (`HomeCard.tsx:31-37`) n'a ni activateur ni curseur.

### 13. Listes, arbres et avatars

- **`categoryPaths` :** `new Map(categoryTree(x).map(…path))` écrit 6 fois (`stock-format.ts:31`, `StockTable.tsx:58`, `ChecklistPanel.tsx:42`, `SheetPage.tsx:156`, `shopping-columns.ts:31`, `ProductPicker.tsx:28`). `locationOptions`, `shoppingCategoryOptions` et `shoppingCategoryTree` ne sont que des alias.
- **Arbres partagés :** `workspace/lib/tree.ts:116, 172`, `use-task-context.ts:133`, `TimeLog.tsx:124`, `task-columns.ts:180`, `StockCountForm.tsx:31` remontent les parents à la main (`pathOf`, `lineageOf`, `ancestorsOf`, `isUnderOrSelf`).
- **`listSelectProps` :** options `{ value, label, color, iconUrl }` refaites dans la trésorerie (`LinesEditor.tsx:102`, `EntryLinesTable.tsx:98`, `entry-columns.tsx:74, 140`) et `SheetsTable.tsx:56`. Le sélecteur de contexte des lignes n'a donc pas d'avatars.
- **`routineTreeOptions` :** le filtre de colonne de `TimeLog.tsx:229` liste les routines à plat.
- **`ItemAvatar` :** `EntityAvatar` refait à la main dans `CategoryTree.tsx:58`, `BaseLists.tsx:136`, `ClientSelect.tsx:22`. `EntityAvatar` est dans `features/workspace` mais importé par `components/` : à déplacer.
- **Suggestions vides :** `NO_TARGETS` réécrit 3 fois ; son pendant `{ projectId: null, tasks: [], contributors: [] }` 6 fois. Proposition : `NO_SUGGESTIONS` à côté de `NO_TARGETS`.

### 14. Menus, panneaux et erreurs

- **`ActionsMenu` :** `CommentThread.tsx:95-119` écrit son menu Modifier / Supprimer. `SortableTabs` prend des `Menu.Item` bruts, que `BaseLists.tsx:150` et `ViewTabs.tsx:150` écrivent à la main ; il devrait prendre des `RowMenuEntry[]`.
- **`openFormPanel` et `confirmDestructive` :** `WorkSchedulesManager.tsx:192-299` remplace tout le panneau par son formulaire ou sa confirmation, comme le faisait `WorkspacesManager`. Il répète aussi 10 fois `String(schedule.startDate).slice(0, 10)`.
- **`onMutationError` :** `notifyError((error as Error).message)` dans `TaskDialogs.tsx:215`, `PlacesManager.tsx:48`, `TravelCalculator.tsx:76`, et 3 copies de `error instanceof Error ? error.message : fallback`.

### 15. Format et dates

- **`capitalize` :** réécrit dans `chart-period.ts:24`, `aggregate.ts:230`, `SubscribedEvent.tsx:14`, `use-slot-rules.ts:196`, `ChartEditor.tsx:280`.
- **Alias de `fmt` :** `longDay` (`use-routine-move.ts:12`), `printedDay` (`EventForm.tsx:50`), `clock` (`RoutineDayAgenda.tsx:60`).
- **Jours :** `86_400_000` dans `event-cells.tsx:183, 208` (`daysBetween`, `addDays`) ; `localTime` dans `use-slot-rules.ts:109` (`fmt.time`).
- **`plural` :** `selection-label.ts:9` écrit son pluriel.

## Web : nouveaux doublons

### 16. Formulaires asynchrones et exports

- **Envoi avec retour :** `setLoading(true); try { await …; notifySuccess; onDone() } catch { notifyError(…) } finally { … }`, 6 fois : `StatementForm.tsx:38`, `DocumentsZipForm.tsx:46`, `NewDocumentForm.tsx:33`, `SentForm.tsx:35`, `DepositInvoiceForm.tsx:86`, `StockPurchaseForm.tsx:77` (qui écrit aussi ses boutons au lieu de `FormActions`). Proposition : `useAsyncAction(fn, { success, fallback })` dans `lib/notify.tsx`.
- **Période d'export :** `StatementForm` et `DocumentsZipForm` partagent le choix de période, les dates Du / Au avec « Avant la date de début. » et le téléchargement. Proposition : `PeriodRangeFields` et `usePeriodRange` dans `components/inputs/`.

### 17. Trésorerie et facturation

- **Liens entre écritures :** les candidats sont construits deux fois (`LineAttachments.tsx:33-47`, `entry-cells.tsx:131-141`), avec le montant d'une ligne recalculé au lieu de `lineCents` ; la recherche (« Tapez au moins 2 caractères ») est copiée 3 fois ; le badge de lien rouge ou vert avec sa croix 4 fois. Proposition : `useLinkCandidates`, `EntryLinkSelect` et `LinkBadge` dans `features/treasury/components/entry-links.tsx`.
- **Lignes :** la bascule d'unité qui garde la part et la catégorie gardée selon le sens sont écrites dans `LinesEditor.tsx` et `EntryLinesTable.tsx`. Proposition : `valueInMode` et `categoryForDirection` dans `features/treasury/lib/lines.ts`.
- **Montant signé :** `Text ff="monospace" c={x < 0 ? 'red' : 'green'}` avec « + », 5 fois (prêts, import de relevé, lignes ×2, achats). Proposition : `SignedAmount` dans `components/money/`.
- **Pourcentage ou montant :** le montant avec son `%/€` est copié 3 fois (`accounting/LinesEditor.tsx:143-167`, `DocumentEditor.tsx:572-603, 634-656`). Proposition : `DiscountInput` ; corrige le point 2.
- **Projets d'un client :** filtrés puis passés à `projectOptions` 4 fois (`NewDocumentForm.tsx:27`, `ImportedDocumentForm.tsx:72`, `DocumentEditor.tsx:271, 293`), et la ligne 271 garde les archivés. Proposition : `clientProjectOptions` dans `features/workspace/lib/tree.ts`.

### 18. Quantités et petits champs

- **`quantityText` :** défini deux fois (`shopping-format.ts:15`, `sheet-format.ts:10`) et réécrit dans `StockMoveForm.tsx` et `StockCountForm.tsx`. Proposition : `fmt.quantity`.
- **Champ quantité :** `NumberInput decimalScale={3} decimalSeparator=","`, 6 fois (stock ×4, achats, facturation) ; champ multiplicateur « × », 2 fois (fiches). Proposition : `QuantityInput` et `MultiplierInput` dans `components/inputs/`.
- **Bouton retirer :** infobulle + `ActionIcon` gris + `XIcon`, 7 fois (écriture, lignes ×2, suivi ×2, fiches ×2). Proposition : `RemoveButton` dans `components/actions/`.
- **Rappels :** la sélection multiple des rappels est recopiée dans `EventForm.tsx:529`, `RoutineSchedule.tsx:360`, `routines/extra-cells.tsx:199`. Proposition : `RemindersSelect`.
- **Nouveau mot de passe** avec `PasswordStrength` : `ResetPasswordPage.tsx:45-60`, `AccountPage.tsx:164-168`. Proposition : `NewPasswordFields`.

### 19. Agenda, temps et tâches

- **Temps lié à un évènement :** la clé `${eventId}|${occurrenceDate}` est construite et relue à 4 endroits (`time-cells.tsx`, `TimeEntryForm.tsx`, `CalendarPage.tsx`), et la liste des évènements du jour 2 fois. Proposition : `features/time/lib/time-events.ts` (`eventKey`, `parseEventKey`, `dayEventOptions`).
- **Boutons du temps :** « Nouveau temps » et « Lancer un chrono » dans `TimePage.tsx:58-68` et `ProjectTimePanel.tsx:28-42`. Proposition : `TimeLogActions`.
- **Occurrences dans FullCalendar :** le début et la fin sont calculés 3 fois (`CalendarPage.tsx:207, 260`, `RoutineDayAgenda.tsx:227`), et les plages comme sources 2 fois. Proposition : `occurrenceSpan` et `scheduleSources` dans `features/calendar/lib/calendar-events.ts`.
- **Horloge :** `useMinute` (`use-slot-rules.ts:115`), un intervalle dans `event-cells.tsx:126-130` et `useNow`. Proposition : `useNow(active, everyMs)`.
- **Différence d'ids :** ajoutés et retirés calculés 5 fois dans les cellules. Proposition : `listDiff` à côté de `applyDiff`.
- **Archiver une sélection :** « Désarchiver » dans les tâches, « Restaurer » dans les routines. Proposition : `archiveRowsAction` dans `selection-actions.tsx`. À décider : le libellé.

### 20. Glisser-déposer et panneaux redimensionnables

- **Listes triables :** `DndContext` + `SortableContext`, le même style de déplacement et un `handleDragEnd` vers un index, 4 fois (jalons, tableaux de bord, accueil, cas de répétition). Proposition : `sortableStyle` et `SortableArea` dans `components/actions/sortable.tsx`.
- **Panneaux redimensionnables :** `use-resizable-aside.ts` et `use-resizable-sidebar.ts` font la même chose, et `.resizeHandle` est écrit deux fois. Proposition : `useResizablePanel`. Leur fermeture et leur double-clic diffèrent un peu.

### 21. Divers

- **Noms de période :** les trimestres s'écrivent « 1er trimestre 2026 » dans les tableaux et la trésorerie, « T2 2026 » dans les tableaux de bord ; `CURRENT_LABELS` (`aggregate.ts:213`) répète `PERIOD_PRESETS`. **Fait** : `periodName`, `quarterName` et `relativePeriodName` (`lib/periods.ts`) ; les trimestres s'écrivent « T4 2026 » partout.
- **Tableaux de bord :** les filtres de source sont copiés dans `ChartEditor.tsx:285-293` et `DatasetsEditor.tsx:227-235` ; `SOURCE_LABELS` est défini deux fois.
- **Mail :** les compteurs « à traiter » et « non lus » dans `MailNavBadge.tsx:18-31` et `MailFolders.tsx:321-334`.
- **Page indisponible :** `ProOnly.tsx:16` et `EntityState.tsx:33`. Proposition : `PageMessage` dans `components/feedback/`.
- **Évènement abonné :** sa description s'affiche en texte brut, pas en markdown (`SubscribedEvent.tsx:62`).
- **CSS mort :**
  - `TaskTable.module.css` recopie `DataTable.module.css`, et seuls `.table`, `.row` et `.recurring` servent ;
  - des classes inutilisées dans `Routines.module.css` et `Shopping.module.css` ;
  - `td[data-cell-selected]`, que plus rien n'émet ;
  - `table-extras.module.css`, importé nulle part ;
  - `ProjectMailsPanel.module.css`, dont seul `.panes` sert.
- **Exports inutiles :** `DRAG_DISTANCE`, `InvalidatingOptions`, `ParamChanges`, `FormPanelOptions`, `PersonKind`, `PeopleOptions`, `BulkTable` ne servent que dans leur fichier.

## Plan proposé

**Fait le 17 novembre 2026**, sans les décisions : points 1, 2, 4 (sauf l'erreur de bénéficiaire), 5, 6, 8 à 21, et 7. Écarts :

- `assertExists` et `assertAllExist` (`services/core/lookup.ts`) gardent l'erreur actuelle de chaque appel ; les listes sont dédoublonnées.
- `services/shopping/people.ts` : écriture et relecture communes, validation inchangée.
- `withMailbox` : 12 sites sur 13 (`reader.ts:158` ignore l'échec du verrou).
- `labelObject` : TaskStatus, DocumentStatus et ScheduleType restent écrits à la main (champs en plus).
- `ProjectMailsPanel.module.css` : toutes ses classes servent.
- D'autres croix « retirer » restent hors de `RemoveButton` (téléphones, répétitions, évènement, pièces jointes, déplacement de routine, mail, plages).

Reste à décider :

1. « Désarchiver » ou « Restaurer », puis `archiveRowsAction` (19).

## Restent à part

- **En-tête des pages de détail :** les quatre copies n'ont pas le même lien retour ; il faut choisir lequel garder.
- **Recherche mail :** l'état est dans l'URL d'un côté, dans le composant de l'autre.
- **Logo de l'entreprise :** il s'enregistre tout de suite et n'accepte que PNG ou JPEG, pour les PDF.
- **Menus bruts :** `tasks/components/extra-cells.tsx:179` (avec `Menu.Label`) et `AddressInput.tsx:134` (arbre avec coches).
- **Mise en page des tableaux PDF (`tableWriter`) :** pas touchée sans essai visuel.
- **Argent :** `formatMoney` (API) et `fmt.moneyCents` (web) font le même format, mais pas dans le même environnement.

## Déjà unifié

- **Plan précédent :**
  - jour courant autour de minuit, réordonnancements en transaction ;
  - utilitaires de collections, dates et argent partagés ;
  - API : `moveInList`, `nextPositionIn`, `BY_POSITION`, `assertTreeParent`, `deleteTreeNode`, `orNotFound`, `rethrowUnique`, `NameColorInput`, `schedulePerWorkspace`, `issuerName`, `PDF_TEXT`, `PDF_TABLE` ;
  - web : `useSetParams`, `useSearchParam`, `InlineActions`, `ActionsMenu`, `DragHandle`, les panneaux en `openFormPanel` ;
  - web : `SubSection`, `StatTile`, `PeriodNav`, `PlanCard`, `EditablePopoverCell`, `MailListControls`, `memberRelationOptions`, `PersonRow`, `countBy`, `scheduleChoices`, `ColorField`, `TravelField`, `ArchivedBadge`, `ErrorAlert`, `EmptyState` `plain`.
- **Données du web :**
  - `useInvalidatingMutation` et `patchQuery` (`lib/mutation.ts`) sous toutes les mutations, optimistes comprises.
  - Une seule action par opération, sur une ligne comme sur plusieurs : `useTaskRowsActions`, `useRoutineRowsActions`, `rowMenuEntry`, et les dialogues des tâches sur une liste.
  - Les mutations unitaires d'archivage, de suppression et de transfert sont supprimées de l'API.
- **Tableaux et édition :**
  - un seul `DataTable` pour tous les tableaux de données ;
  - une seule édition en masse (`bulkSaver`, `useEntityCellEdit`) ;
  - des cellules communes : `EditableCells`, `EditableTitle`, `cell-field`, les cellules assignés et projet ;
  - une seule ligne d'ajout (`AddRowField`) ;
  - des actions de sélection communes (`selection-actions`).
- **Interface :**
  - `openFormPanel` et `openModal` ;
  - `FormActions` et `DestructiveActions` ;
  - `SettingsSection` ;
  - `SortableTabs` et `useTabParam` ;
  - `ItemBadge`, `ClientSelect`, `TaskProgress`, `confirmPlanDelete`.
- **Personnes :** `components/people`, avec un schéma de clés, `PeopleSelect`, `PeopleCell`, `PersonOption` et `PersonAvatar` ; `AssigneesSelect` et `AssigneesCell` pour les évènements aussi.
- **Listes paramétrables :** un seul modèle, `SettingsList`, plat ou en arbre, avec couleur, image, nom et glisser-déposer, lieux compris. Les items s'affichent avec leur avatar partout ; côté API, `settings-lists`.
- **Hiérarchies :**
  - les arbres reposent sur `tree` ;
  - `tree.ts` (partagé) fait les parcours et les chemins ;
  - tout item hiérarchisé s'affiche par son chemin complet.
- **Code partagé :** `filters.ts`, `task-columns.ts`, `periods.ts`, `rules.ts`, `text.ts`, `table-views.ts`.
- **Utilitaires :**
  - `lib/download`, `lib/text`, `lib/drag`, `lib/fill-height`, `lib/notify` (`onMutationError`) ;
  - `localDay` ;
  - `parisToday` dans l'API.
- **Filtres :** les tableaux de bord et l'accueil filtrent les tâches dans le langage du tableau des tâches.
