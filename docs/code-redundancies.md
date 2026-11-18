# Composants similaires et redondances de code

État au 18 novembre 2026, après trois séries d'unifications (voir [Déjà unifié](#déjà-unifié)).

Ce qui reste :

- **API :** des contrôles d'existence qui contournent encore `assertExists`, le CRUD des listes nom + couleur et des arbres de catégories recopiés service par service, quelques conversions de quantités et de dates.
- **Web, briques contournées :** `RemoveButton`, `useAsyncAction`, `FormActions`, `EditableMultiSelect`, `DragHandle` ; une centaine de `String(date)` inutiles.
- **Web, nouveaux doublons :** les colonnes produit (achats, stock, fiches), les formulaires de réglages de la trésorerie en double, le chrono, les rappels de formulaire, les champs étiquetés à la main.

La relecture a aussi trouvé trois bugs, listés en premier.

La bibliothèque de documents n'est pas traitée : elle sera refaite entièrement.

## Bugs

### 1. Jours décalés hors de France (suite)

Même bug que l'ancien point 1 (un jour seul formaté comme un instant local), à deux autres endroits :

- `features/dashboards/lib/aggregate.ts:186` (`bucketLabel`) : les axes des graphiques par jour, semaine ou mois ;
- `components/recurrence/describe-recurrence.ts:123` : « du … au … » des cas de répétition.

Correction : passer la chaîne `AAAA-MM-JJ` à `fmt`.

### 2. Prix unitaire toujours en euros

`features/accounting/components/LinesEditor.tsx:116` écrit `suffix=" €"` alors qu'il reçoit la devise du document. Même bug que la remise globale, corrigée avant.

### 3. Mail : dossier Envoyés sans repli sur le nom

`services/mail/linked.ts:152` cherche le dossier Envoyés par son rôle seulement, sans le repli de `findSpecialFolder`.

## API

### 4. Briques contournées

- **`assertExists` :** 34 `orNotFound(prisma.X.findUnique({ where: { id }, select: { id: true } }), 'X')` qui ne font que vérifier l'existence (trésorerie, catalogue, stock, achats, fiches, commentaires, GitHub), et 4 `if (!findUnique) throw` dans `calendar/work-schedules.ts`.
- **Supprimer sinon introuvable :** `deleteMany({ where: { id } })` puis `if (!count) throw notFound`, 19 fois. Proposition : `deleteOrNotFound(model, id, what)` dans `core/lookup.ts`.
- **Divers :**
  - `BY_POSITION` dans `work-schedules.ts:346, 352` (fichier non formaté Prettier) ;
  - `requiredText` dans `treasury-team.ts:69` ;
  - `errorMessage` dans `mail/linked.ts:204` ;
  - `DAY_PATTERN` dans `graphql/builder.ts:52` ;
  - `String(id)` restants : `routines.ts:312, 531`, `sheets.ts:177-180`, `time.ts:73` (valeurs typées `string | number`) ;
  - `routines.ts:465-466` cherche deux fois la même catégorie.
- **Noms de fichier :** `safeFilename` est dans `routes/http.ts`, mais `treasury-pdf.ts:384` et `accounting-zip.ts:21` nettoient à la main. Proposition : le déplacer dans `packages/shared/src/core/text.ts`.
- **Routes de téléchargement :** les 7 ont la même forme (session, `try`, `sendDownload`, `sendServiceError`). Proposition : `downloadRoute(produce, context)`.

### 5. Listes nom + couleur hors de `createLabelService`

- Copies : statuts de projet (`tasks/statuses.ts`), catégories de projet (`workspace/project-categories.ts`), magasins, rangements et unités (`shopping/shopping.ts`), catégories de fiche (`shopping/sheets.ts:280-313`) ; variantes dans `work-schedules.ts:136-166` et `mail/organize.ts:221-255`.
- GraphQL : la boucle `labelKinds` de `modules/tasks.ts:648-684` est recopiée dans `workspace.ts` et `shopping.ts`.
- Proposition : `createLabelService` pour tout modèle, dans `services/core/labels.ts`, et un `labelMutations(kind)`.
- **À décider :** les listes des achats vérifient les noms en double par `findFirst` (erreur de saisie, avec une course possible) au lieu de `rethrowUnique` (CONFLICT), alors que la base a déjà un `@@unique`.

### 6. Arbres de catégories

- Valider le parent, créer en dernier, déplacer en dernier quand le parent change, déplacer, supprimer avec `deleteTreeNode` : 5 copies (catégories de routine, de trésorerie, des achats, emplacements du stock, catégories d'agenda).
- Parcours à la main : `graphql/modules/time.ts:157-161`, `github.ts:64-66`, `treasury-settings.ts:59-68`, `tasks.ts:16-26` (`loadRootOf`) et `:784-791` (`topmost`) ; « charger tous les projets puis `subtreeOf` / `lineageOf` » 4 fois.
- Proposition : `treeListService(model, messages, hooks)`, `subtreeIds(model, id)` et `lineageIds(model, id)` dans `services/core/trees.ts`.
- **À décider :** les écarts actuels.
  - `updateLocation` ne place pas un emplacement en dernier quand son parent change. _À harmoniser avec les règles communes_
  - `deleteCalendarCategory` supprime les sous-catégories au lieu de les remonter. _Surtout pas !_
  - `moveCalendarCategory` prend ses arguments dans un autre ordre. _Je ne comprends pas ce que ça veut dire_

### 7. Petits doublons

- **Dates de début et de fin :** la même vérification, qui fusionne les dates enregistrées et les nouvelles, dans `tasks/tasks.ts:205-209` et `workspace/projects.ts:205-210`. Proposition : `assertDateRange`.
- **Relations :** `ids.map((id) => ({ id }))` 41 fois, dont 28 avec `new Set`. Proposition : `connectIds(ids)`.
- **Schémas :** celui des sprints (`tasks/sprints.ts:17-24`) recopie `sprintFormSchema`. `z.iso.date({ error: 'Date invalide.' })` est défini dans 4 fichiers partagés, et « La date de début est requise. » est écrit 6 fois. Proposition : `isoDaySchema(message)`. **À décider :** `daySchema` vérifie la forme `AAAA-MM-JJ`, `z.iso.date` refuse aussi les dates qui n'existent pas ; en garder un.
- **PDF :** `accounting-pdf.ts:1280-1294` refait la création du document de `pdf-report.ts:65-83`, et le titre / sous-titre est écrit 3 fois (agenda, graphiques, tableaux). Proposition : `createPdf`, `reportHeadingSchema`, `writeHeading`. **À décider :** une taille de titre (16, 14 ou 8,5 pt aujourd'hui).
- **Dates JJ/MM/AAAA :** 5 copies (PDF de facture, documents ×2, PDF de trésorerie, trésorerie partagée). Proposition : `printedDay` dans `packages/shared/src/dates`.
- **Quantités :** Decimal vers nombre 5 fois avec deux comportements (`null` devient 0 ou reste `null`), nombre vers Decimal 3 fois, arrondi au millième 5 fois, total d'un lot calculé 2 fois. Proposition : `roundQuantity` (partagé), `toDecimal` et `fromDecimal`.
- **Mail :** « trouver le dossier, refuser un dossier spécial » 3 fois dans `organize.ts`. Proposition : `userFolder`. `reader.ts:197-222` additionne deux fois sur tous les comptes.
- **Jour de la semaine :** `recurrence.ts:44, 229` et `calendar-ics.ts:101` refont `weekdayOfDate`, mais `weeks.ts` importe déjà `recurrence.ts` : il faut d'abord sortir la fonction dans un fichier sans dépendance.

## Web : briques existantes contournées

### 8. Actions et formulaires

- **`RemoveButton` :**
  - croix grises : `PhonesField.tsx:33`, `RecurrenceEditor.tsx:283`, `EventForm.tsx:412`, `RoutineMoveForm.tsx:179`, `ProjectContributors.tsx:163`, `DocumentEditor.tsx:732-741` (pièces jointes), `MailComposer.tsx:404-424` (la même puce de pièce jointe 2 fois) ;
  - sans infobulle : `RoutineSchedule.tsx:96`, `ScheduleRepetition.tsx:54` ;
  - **À décider :** les variantes corbeille (`ScheduleRepetition.tsx:174`, `CaseCard.tsx:56`) et rouges (`DatasetsEditor.tsx:152, 252`) deviennent-elles la croix grise ? Et la croix dans un badge (`document-cells.tsx:68-83`, comme `LinkBadge`) demande une variante.
- **`useAsyncAction` :** `TaskDialogs.tsx:201`, `TravelCalculator.tsx:68`, `CalendarPage.tsx:744`, `DashboardBoard.tsx:180, 275, 432`, `ImageExportForm.tsx:89`, `MailReader.tsx:123-151`, `SheetPicker.tsx:78-90`.
- **`FormActions` :** `SubscribedEvent.tsx:71`, `StatementImport.tsx:351, 443`, `ScopeChoices.tsx:53`, `ListActions.tsx:123`, `MailComposer.tsx:326`, `LineAttachments.tsx:94`. Les espacements y varient.
- **`onMutationError` :** `notifyError(error.message)` puis retour en arrière, dans `calendar-edits.tsx:57, 81` et `CalendarPage.tsx:678, 703`.
- **`ActionButton` :** `MailAccountsManager.tsx:58` utilise un `Button` plein, à faire aussi pour le bouton « Ajouter » de `SettingsList` (après l'archivage).

### 9. Cellules et glisser-déposer

- **`EditableMultiSelect` :** `StackedMultiCell` + `BatchMultiSelect` assemblés à la main 7 fois (`inline-cells.tsx:175, 211, 276, 423`, `routine-cells.tsx:97, 159`, `shopping-cells.tsx:230`). `PeopleCell` ne fait que relayer, et `cellMulti` n'est qu'un autre nom de `cellCombobox`.
- **`DependencyIcon` :** l'icône faite / en attente d'une dépendance est écrite 2 fois (`inline-cells.tsx:285`, `routine-cells.tsx:170`).
- **`EditableNumber` et `EditableTime` :** `TravelCell` (`routines/extra-cells.tsx:142`) utilise un champ brut ; deux cellules d'heure non stylées (`routines/extra-cells.tsx:88`, `time-cells.tsx:44`). Proposition : `EditableTime`.
- **`UnitCell` et `CategoryCell` des achats :** non utilisées dans le stock et les fiches (`StockTable.tsx:259, 273`, `ChecklistPanel.tsx:204-205`, `SheetPage.tsx:319, 329`). L'unité y est un texte libre, la catégorie n'a pas d'avatar.
- **`AddRowField` :** les fiches et les checklists écrivent leur ligne d'ajout sous le tableau (`ChecklistPanel.tsx:231-249`, `SheetPage.tsx:380-411`).
- **`DragHandle` :** poignées faites à la main dans `CategoryTree.tsx:45`, `ProjectList.tsx:73`, `ColumnsPanel.tsx:29`, `DataTable.tsx:985` ; `ActiveTree.tsx:198` refait `sortableStyle`.
- **CSS des arbres :** les règles de dépôt (`data-drop`, `data-dragging`) sont copiées dans `CategoryTree.module.css`, `ProjectList.module.css` et `Routines.module.css` (cette dernière copie est morte) ; `.handle` et `.caretSpace` en double.

### 10. Blocs et retours

- **`SubSection` :** `TableToolbar.tsx:128` (`SectionTitle` local), `NoClientRow.tsx:65`.
- **`ErrorAlert` :** `ChartEditor.tsx:299`, `TrackingPanel.tsx:148`.
- **`EmptyState` :** `CalendarsManager.tsx:76` (dans un `ThemeIcon`), `TeamPanel.tsx:283-289` ; **à décider :** `SectionEmpty` de la barre latérale (`Sidebar.tsx:32`), plus petit.
- **`SettingsSection` :** `ScheduleSettings.tsx:29` et `PlannedTime.tsx:68` (un `Paper` et un titre) ; `TeamPanel.tsx:261, 426` (description dans un `Text`).
- **`InlineActions` :** les boutons texte Modifier / Supprimer de `TeamPanel.tsx:296-313, 455-472`. **À décider :** icônes ou texte.
- **`PageMessage` :** la page 404 (`app/NotFoundPage.tsx`) le refait avec « 404 ». Proposition : une prop `code`.
- **`PersonRow` / `PersonOption` :** `TeamPanel.tsx:69`, `MarkdownEditor.tsx:183`.
- **`relativePeriodName` :** `CalendarPeriodPicker.tsx:12-28` réécrit « Mois en cours », « Mois précédent »….
- **`SignedAmount` :** la quantité signée de `MovementsTable.tsx:76-79` (il faudrait une prop de format) ; la cellule de montant signé éditable est copiée dans `EntriesPanel.tsx:249-257` et `TreasuryPage.tsx:545-554`. Proposition : `SignedAmountCell`.

### 11. Dates et horloge

- **`String(date)` inutiles :** le scalaire `Date` arrive déjà en `AAAA-MM-JJ`. Il reste ~125 `String(x.startDate)`, `.slice(0, 10)` ou `new Date(…)` autour de `fmt` (planning, routines, finances, sprints, lots, livraisons, écritures, suivi…), et des aides locales (`dayOf` ×2, `day`, `calendar-pdf.ts:68, 70`, `chart-data.ts:98`).
- **Horloge :** `HeaderClock` a son `useMinute` calé sur la minute ; `useNow(true, 60_000)` ne l'est pas et peut afficher une heure en retard d'une minute. Proposition : caler `useNow` et supprimer `useMinute`.

## Web : nouveaux doublons

### 12. Achats, stock et fiches

- **Colonnes produit :** quantité, unité, catégorie, consommable et note sont définies 4 fois (`shopping-columns.ts:39-70`, `StockTable.tsx:71-100`, `ChecklistPanel.tsx:56-87`, `SheetPage.tsx:174-213`), avec des écarts : la quantité s'écrit `String(q).replace('.', ',')` dans les achats (et dans `ShoppingForm.tsx:108`, `EntryLinesTable.tsx:102`), `fmt.number` ailleurs ; les fiches filtrent les catégories sans arbre. Proposition : `quantityColumn`, `unitColumn`, `categoryColumn`, `consumableColumn`, `noteColumn`.
- **Champs unité et catégorie :** `StockItemForm.tsx:66-77` (`Select` et `Autocomplete`) contre `ShoppingForm.tsx:115-156` (`CreatableSelect`, qui ajoute l'unité aux réglages). Proposition : `UnitField` et `ShoppingCategoryField`. Effet : le stock pourra créer des unités.

### 13. Trésorerie et facturation

- **Formulaires de réglages en double :**
  - `AccountForm` recopie les champs de `AccountsSettings.tsx:42-56`, sans la coupe `.slice(0, 10)` que fait ce dernier.
  - `CategoryForm`, `MethodForm` et `CounterpartyForm` (`SettingsPanel.tsx:40-235`) recopient ceux de `SettingsList`, avec 3 copies des rappels de création.
  - Ces formulaires ne servent qu'à créer depuis une écriture (`EntryForm.tsx:475-520`, `TreasuryPage.tsx:299`) : leur branche « modifier » est morte.
  - Proposition : un `SettingsItemForm` par type, qui partage ses champs avec la liste.
  - **À décider :** la création rapide montre-t-elle aussi la couleur et l'image ?
- **Symbole « € » écrit à la main :** 12 `AmountInput suffix=" €"` et 5 `EditableNumber amount suffix="€"` (sans espace). Proposition : une prop `currency` sur `AmountInput` et un suffixe par défaut pour `EditableNumber amount`. Corrige le bug 2.
- **Petits doublons :** le menu « Nouveau document » (`ProjectBillingPanel.tsx:40-47`, `AccountingPage.tsx:282-284`) ; le sens entrée / sortie (`BudgetsPanel.tsx:111-117`, `SettingsPanel.tsx:92, 307-314`, `EntryForm.tsx:217`) ; le texte des fiches sources (`ShoppingForm.tsx:108`, `ShoppingTable.tsx:243`).

### 14. Temps, agenda et tableaux de bord

- **Chrono :** lancer et arrêter sont écrits 4 fois (`tasks/extra-cells.tsx:51`, `routine-table-cells.tsx:88`, `TaskTime.tsx:39`, `EventForm.tsx:153`) ; la cellule des tâches n'utilise pas `useStopTimer` et n'affiche pas « Temps enregistré ». Proposition : `useStartTimer` et `TimerToggle`. **À décider :** « Lancer » ou « Démarrer », « Chrono lancé. » ou « Chrono démarré. ».
- **Plages de l'agenda :** les 4 mêmes requêtes dans `CalendarPage.tsx:149`, `RoutineDayAgenda.tsx:166`, `use-slot-rules.ts:114`. Proposition : `useScheduleSources`.
- **Réglages de l'agenda :** la ligne « Abonné » (`CalendarsManager.tsx:85`, `ScheduleSettings.tsx:133`) et le bouton d'apparence (`ScheduleSettings.tsx:59-70, 143-195`). Proposition : `SubscriptionRow` et `LookToggle`.
- **Accueil :** la ligne « + N autres » 4 fois, la ligne lien titre / sous-titre / valeur 4 fois. Proposition : `HomeList` et `HomeRow`. **À décider :** un seul nombre de lignes (5, 6 ou 7 aujourd'hui).
- **Petits doublons :** l'effort d'une tâche feuille (`SprintsPanel.tsx:141`, `task-records.ts:159`) ; les actions des fils de commentaires (`TaskComments.tsx:26`, `Comments.tsx:34`) ; le suffixe « (copie) » 5 fois.

### 15. Formulaires et mise en page

- **Rappels de formulaire :** `{ onSuccess: notifySuccess(créé ou modifié); onDone(), onError: showFormError }`, ~26 fois. Proposition : `formCallbacks(form, message, onDone)` dans `lib/form.ts`.
- **Champ étiqueté à la main :** `Stack gap={4}` + `Text size="sm" fw={500}` au-dessus d'un contrôle, 29 fois, sans lien pour les lecteurs d'écran. Proposition : `LabeledField` sur `Input.Wrapper`.
- **Pied de formulaire avec suppression à gauche :** `EventForm.tsx:552`, `CalendarEditForms.tsx:62, 115`. Proposition : un emplacement `danger` dans `FormActions`. **À décider :** « Supprimer » avec icône ou « Supprimer… » sans.
- **Alertes succès / info / avertissement :** 5 succès avec 3 icônes différentes, 3 « à configurer d'abord » (bleue, jaune, jaune avec icône), 5 avertissements avec 4 icônes. Proposition : `NoticeAlert kind="success|info|warning"`. **À décider :** les couleurs et icônes.
- **Menus de la barre latérale :** « Tout déplier / Tout replier » 3 fois, « Nouveau client / Nouveau projet » 2 fois. Proposition : `foldEntries` et `ActionsMenu` (qui devra accepter `opened` et `position`).
- **Onglets des réglages de page :** `Tabs` brut dans l'agenda, la facturation, le client et le projet (ce dernier en `pills`). Proposition : `SettingsTabs`. **À décider :** onglets ou pilules.
- **Noms et icônes des pages :** écrits 3 fois (`page-title.ts`, `Sidebar.tsx`, chaque `PageHeader`). Proposition : un registre `app/pages.ts`.
- **Point de rupture :** `45em` dans 6 fichiers CSS (alors que `sm` vaut 48em et que les commentaires disent le contraire), `useMediaQuery('(max-width: 48em)')` 3 fois. Proposition : une variable PostCSS et `useIsPhone`. **À décider :** 45em ou 48em.
- **Options de personnes :** trois constructeurs aux libellés différents (« Contributeurs / Proches », « Membres / Relations », « Contributeurs / Relations » ; « (moi) » ou « Moi »). Proposition : un seul dans `components/people`. **À décider :** les libellés.
- **Boutons « + ajouter une ligne » :** tailles et variantes mélangées dans 7 formulaires. Proposition : `AddItemButton`. **À décider :** une seule apparence.
- **Badges de compte :** le petit badge rond des onglets et de la navigation, 5 copies. Proposition : `CountBadge`.

### 16. Rangement

- `PageHeader` et `SectionHeader` sont dans `components/actions/`, alors que `PageTitle` et `SubSection` sont dans `components/page/` : à déplacer.
- `ItemAvatar`, `ItemBadge` et `item-look` servent partout, mais sont rangés dans `components/settings/`. Proposition : `components/items/`.
- `EntityAvatar` et `ItemAvatar` tiennent le même rôle. Proposition : fusionner (`radius`, `contain`).
- `NoMatch`, un état vide, est rangé dans `data-table/table/GroupHeaderRow.tsx:62`.

## Plan proposé

**Fait le 18 novembre 2026** : points 1 à 16 et décisions 1 à 20. La ligne d'ajout des fiches et checklists prend la valeur du groupe ; « Annuler » peut remettre une valeur archivée (`restoring`) ; icône et libellé sur tous les boutons d'action.

1. **Bugs (1 à 3).**
2. **Briques contournées, sans décision (4, 8 à 11) :** mécanique.
3. **API, blocs (5 à 7)**, avec les décisions sur les noms en double et les arbres.
4. **Web, nouveaux composants sans décision :** colonnes produit, champs unité et catégorie, « € », `formCallbacks`, `LabeledField`, `useScheduleSources`, `CountBadge`, rangement (12, 13, 15, 16).
5. **Le reste, après décisions.**

Décisions (18 novembre 2026) :

1. **Noms en double des listes des achats :** conflit (`rethrowUnique`), comme les autres listes. _Validé_
2. **Arbres :** les emplacements passent en dernier quand leur parent change ; supprimer une catégorie d'agenda remonte ses sous-catégories au lieu de les supprimer ; la signature de `moveCalendarCategory` est alignée. _Validé_
3. **Dates :** contrôle de la date réelle (`z.iso.date`) partout. _Validé_
4. **Titre des PDF :** 16 pt, sous-titre 10 pt gris. _Validé_
5. **Retirer :** croix grise pour un élément dans un champ (puce de sélection multiple, pièce jointe, lien dans un badge), corbeille rouge partout ailleurs ; `RemoveButton` a les deux variantes. _Validé_
6. **Barre latérale :** `SectionEmpty` remplacé par `EmptyState` compact. _Validé_
7. **Équipe de la trésorerie :** `InlineActions` (icônes avec infobulle), comme les autres listes. _Validé_
8. **Création rapide de la trésorerie :** les mêmes champs que les réglages, couleur et image comprises. _Validé_
9. **Chrono :** « Démarrer le chrono », « Chrono démarré. ». _Validé_
10. **Cartes de l'accueil :** 10 lignes. _Validé_
11. **Boutons d'action :** icône et libellé partout (« Supprimer » avec sa corbeille, sans points de suspension) ; un bouton icône seul garde son infobulle. _Validé_
12. **Alertes :** `NoticeAlert` avec les couleurs standards (succès vert, info bleu, avertissement orange, erreur rouge) et une icône par type. _Validé_
13. **Réglages de page :** onglets. _Validé_
14. **Point de rupture :** 48em. _Validé_
15. **Personnes :** « Contributeurs » et « Relations » en pro, « Contributeurs » et « Proches » en perso ; « Prénom (moi) » partout ; un seul constructeur d'options. _Validé_
16. **Ajouter une ligne :** `AddItemButton`, bouton discret `xs` avec une icône « + » et un libellé précis, aligné à gauche sous la liste. _Validé_
17. **En-tête des pages de détail :** un lien texte « ← Nom de la liste » au-dessus du titre (fil d'Ariane), dans un composant commun, pour le document importé, le document de facturation, la fiche et la liste de courses ; les boutons retour en double disparaissent.
18. **Recherche mail :** l'état de la recherche et de la recherche avancée dans l'URL partout, onglet Mails d'un projet compris.
19. **Menus :** `ActionsMenu` accepte des titres de section, et le menu « Achats » d'une tâche (`tasks/components/extra-cells.tsx:179`) l'utilise.
20. **Argent :** `fmt.moneyCents` repose sur `formatMoney` (partagé) ; un seul format des montants en centimes.

## Restent à part

- **Menu des lieux enregistrés** (`AddressInput.tsx:134`) : un arbre avec coches, trop particulier pour `ActionsMenu`.
- **Logo de l'entreprise :** il s'enregistre tout de suite et n'accepte que PNG ou JPEG, pour les PDF.
- **Mise en page des tableaux PDF (`tableWriter`) :** pas touchée sans essai visuel.

## Déjà unifié

- **Série du 17-18 novembre 2026 :**
  - archivage : `services/core/archive.ts` et la mutation `setArchived` (API), `lib/archive.ts`, `ShowArchivedSwitch`, `archiveRowsAction`, l'archivage dans `SettingsList`, les options et filtres de colonnes sans les archivés sauf les valeurs en cours ;
  - API : `assertExists`, `assertAllExist`, `fieldError`, `errorMessage`, `relationIds`, `labelObject`, `routes/http.ts` (`requireSession`, `sendDownload`, `sendServiceError`), `withMailbox`, `specialFolder`, `githubFetch`, `services/shopping/people.ts` (`assertPeople`), `assertProjectContributors` pour les tâches ;
  - partagé : `monthIndex`, `timeOfDaySchema`, `daySchema`, `percentOf`, les aides de dates et de centimes reprises ;
  - web : `SectionHeader` sans titre, `itemOptions`, `NO_SUGGESTIONS`, `notifyFailure`, `useAsyncAction`, `PeriodRangeFields`, les liens entre écritures, `SignedAmount`, `DiscountInput`, `QuantityInput`, `MultiplierInput`, `RemoveButton`, `RemindersSelect`, `NewPasswordFields`, `SortableArea`, `useResizablePanel`, `useNow`, `listDiff`, `SourceFilters`, `MailCountBadges`, `PageMessage`, `periodName`, `archiveRowsAction` ;
  - règles : une seule règle des personnes (bénéficiaires libres, contributeurs du projet), erreur de champ pour un bénéficiaire introuvable, trimestres « T4 2026 », « Restaurer » partout.
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
