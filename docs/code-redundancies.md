# Composants similaires et redondances de code

État au 18 novembre 2026, après cinq séries d'unifications (voir [Déjà unifié](#déjà-unifié)) et des règles eslint contre le retour des motifs unifiés. Les décisions déjà prises sont en [annexe](#décisions-déjà-prises).

Il n'y a plus de gros doublon. Restent :

- **Bugs :** une vingtaine, presque tous petits (textes faux, drapeaux d'URL, archivés encore modifiables, textes coupés trop long).
- **Briques contournées :** surtout `ON_ERROR` (~70 copies), `unarchived` (~30), le compteur de `ShowArchivedSwitch` (16), la création à la volée de la trésorerie, `AddItemButton`, `InlineActions`.
- **Petites incohérences :** libellés, opacités, en-têtes de page de détail, menus, chrono.
- **Partage web / API :** pluriels et formats de nombre à passer dans le code partagé.

La bibliothèque de documents n'est pas traitée : elle sera refaite entièrement.

## Bugs

### 1. Textes et affichage faux

- **Catégorie d'agenda :** la suppression annonce que les sous-catégories « seront supprimées définitivement » (`CalendarCategoriesManager.tsx:33`), alors qu'elles remontent d'un niveau (décision 2).
- **Nom d'une fiche caché :** `SheetPage.tsx:275` met le nom et le badge « archivé » dans `PageHeader`, que `PageTitle` masque à partir de 48em : sur tablette et ordinateur, on ne voit que « Fiches ».
- **Description d'une ligne de facture :** les lignes sont indexées par position (`accounting/LinesEditor.tsx:202`, `key={index}`), et l'état « description ouverte » passe à la ligne voisine après une suppression ou un déplacement.
- **Tiers d'un mouvement :** options construites deux fois, avec des règles différentes : le formulaire (`EntryForm.tsx:110-136`) filtre les archivés et met le lieu des pièces entre parenthèses ; le tableau (`entry-env.ts:65-73`) les garde et n'affiche que le titre.
- **« Relation » en perso :** `ContributorsManager.tsx:114-117` ; et le sélecteur des bénéficiaires dit « contributeurs ou proches » même en pro (décision 15).
- **« (moi) » absent :** l'export et le tri des tâches (`tasks/lib/export.ts:38, 43, 126`, `task-rows.ts:36`, `beneficiaryNames`) et le filtre des assignés (`task-columns.ts:130`).
- **Cellules des routines sur une sélection :** elles ne disent pas « (appliqué aux N cellules sélectionnées) » (`routines/extra-cells.tsx:43, 103, 124, 147, 171, 250`, décision G) ; `inline-cells.tsx:264, 386` construisent leur propre libellé.
- **Plages de travail :** appelées « Horaires de travail » (`WorkSchedulesManager.tsx:290`) ou « Plages de travail » (`CalendarPage.tsx`, `PlannedTime.tsx:97`).
- **Date « longue » courte :** `formatLongDate` (`describe-recurrence.ts:35`) promet « 3 novembre 2026 » et donne « 3 nov. 2026 ».
- **Graphiques :** le menu dit « Avancer / Reculer » au lieu de « Monter / Descendre », sans `moveEntries` ni gestion d'erreur (`DashboardBoard.tsx:254-255`) ; même oubli d'`onError` dans `ProjectResourcesPanel.tsx:144`.

### 2. Archivage

- **Clients et projets archivés modifiables :** « Modifier » reste dans `EntityMenu.tsx:66-70`, et `updateClient` / `updateProject` ne vérifient pas l'archivage (les tâches et les routines, si).
- **Titre d'une tâche archivée :** il ne s'ouvre plus d'un clic, car `EditableTitle` confond « lecture seule » et « ne s'ouvre pas » (`EditableTitle.tsx:67-71`).
- **Restaurer une tâche :** `setTaskArchived` (`tasks.ts:384-395`) restaure les parents archivés, mais ne marque pas comme archivées « d'elles-mêmes » leurs sœurs archivées en cascade, contrairement aux projets (`projects.ts:410-417`) : un nouvel archivage puis une restauration du parent les fait revenir.
- **Routines :** `bulkSetRoutinesArchived` (`routines.ts:885`) réécrit la date d'archivage des routines déjà archivées et ne vérifie pas que les ids existent ; `setRoutineArchived` (`:874`) et `archivedFilter` (`core/archive.ts:120`) ne servent plus.
- **Emplacement prérempli :** `StockItemForm.tsx:72` ne garde pas l'emplacement en cours (`unarchivedOffered` sans `keep`).
- **Commentaires :** acceptés sur un élément archivé (voir décision P).

### 3. Données

- **Synchro GitHub :** elle coupe les titres de tâche à 300 caractères (le schéma : 256), les noms d'étiquette à 60 (50) et les titres de jalon à 200 (120) (`sync.ts:266, 309, 334, 703`) : ces éléments ne passent plus leur formulaire. Proposition : les maximums exportés et un `clipText(text, max)` partagé (la coupe des fiches s'en servira).
- **Export ICS :** une occurrence modifiée n'y est pas la même que dans l'app (`calendar-ics.ts:236-258` contre `toOccurrence`) : une description ou un lieu effacés y reprennent la valeur de la série, les liens et la durée de la règle sont ignorés. Correction : construire l'exception avec `toOccurrence`.
- **Même produit :** le stock (`itemFor`, `stock.ts:356-361`) et les fiches (`sheetItemKey`) ne comparent pas les libellés de la même façon (espaces). Proposition : un seul `productKey` partagé.
- **Accents :** `creatable.ts:27` décide d'offrir « Créer « … » » sans ignorer les accents, alors que la recherche les ignore : « eleve » à côté de « Élève » propose un quasi-doublon (même chose dans `SheetPage.tsx:253`). Proposition : `sameName(a, b)` partagé.
- **Champs produit en GraphQL :** dans les achats, un identifiant vide reste `''` (`?? null`) au lieu de devenir `null` comme dans les fiches et le stock (voir point 6).

### 4. Routes et erreurs

- **Drapeaux d'URL :** `?paid=0` imprime quand même la facture acquittée (`Boolean(req.query.paid)`, `routes/accounting.ts:22`), et `?download=0` télécharge quand même (`attachments.ts:21`, `mail.ts:23`, `accounting.ts:24`). Proposition : `queryFlag(value)`.
- **`?tab=` inconnu :** une page vide dans le stock, la trésorerie et la facturation (`StockPage.tsx:96`, `TreasuryPage.tsx:195`, `AccountingPage.tsx:250`). Proposition : `usePageTab(tabs, fallback)`, sur lequel repose `useSettingsTab` (voir point 7).
- **Erreurs :** `routes/mail.ts:31` répond 404 à toute erreur, panne IMAP comprise ; `reminders.ts:86` montre à l'utilisateur le message brut de n'importe quelle erreur (`errorMessage` contourné).

## API

### 5. Briques contournées

- **`nextPositionIn` dans une transaction :** écrit à la main 5 fois, faute de pouvoir lui passer la transaction (`tasks.ts:502`, `treasury-team.ts:100`, `document-statuses.ts:58`, `stock.ts:364`, `workspaces.ts:144`) ; `addSheetToShoppingList` lit la position hors de sa transaction. Proposition : un paramètre `client` sur `nextPositionIn` et `moveInList`.
- **Jours facultatifs :** des copies de `parseOptionalDay` (`day`, `asDate`, `dayOf` ×5) et ~10 `x ? parseDay(x) : null` ; son miroir `x ? formatDay(x) : null` ~15 fois. Proposition : `formatOptionalDay`, et sortir les aides de jour de `dates/recurrence.ts` vers `dates/days.ts` (exporté par `index.ts`).
- **`orNotFound` et `done()` :** quelques `findUnique` + `throw` et `return true` restants (`routines.ts:952`, `workspaces.ts:158, 210`, `stock.ts:402`, `calendars.ts:127` ; `calendar.ts:482`, `accounting-documents.ts:465`, `sheets.ts:284`, `settings-lists.ts:80`, `github.ts:179`, `routines.ts:513`).
- **Routes :** pièces jointes, icônes et mail refont la session et les statuts à la main ; `mail.ts` n'utilise pas `queryText` ni `INLINE_TYPES` ; `core/attachments.ts:50` teste `%PDF-` au lieu d'`isPdf`.
- **Nombres :** `toLocaleString('fr-FR')` 7 fois (PDF et documents) ; voir point 11.

### 6. Doublons pas encore traités

- **Champs produit en GraphQL :** la liste des champs et leur passage à `null` copiés 3 fois (`graphql/modules/sheets.ts:105-166`, `shopping.ts:128-170`, `stock.ts:130-200`), avec des écarts (`memberIds` et `perishable` obligatoires ou non, `label` ou `name`). Proposition : `productInputFields` et `productInput` dans `graphql/product-inputs.ts`. Voir décision O.
- **Recharger l'objet enregistré :** `findUniqueOrThrow({ ...query, where: { id } })` ~26 fois, plus 5 aides locales. Proposition : `reloaded(model, query, saved)`.
- **Fin après le début :** ~15 contrôles, en 4 formulations (« La date de fin doit suivre la date de début. », « La fin doit suivre le début. », « La fin de la période précède son début. », « Période invalide. »). Proposition : un `endAfter(start, end)` partagé. Voir décision Q.
- **Mail :** les drapeaux et l'état « traité » lus depuis IMAP 2 fois (`reader.ts:97, 269`) ; « (sans objet) » 6 fois (API et web). Propositions : `flagMarks(flags)`, `NO_SUBJECT`.
- **Exports :** `safeFilename(title) + '.pdf'` 3 fois (`routes/exports.ts`) ; le nom de repli est « sans-nom » ou « fichier » ; les pièces jointes nettoient les noms avec leur propre règle.
- **Commentaires :** le schéma du corps 4 fois ; `assertTarget` est une table de `findUnique` là où une table de modèles + `assertExists` suffit.
- **« Le premier actif, sinon le premier » :** 3 fois (agendas, statuts de document, tableaux de bord).
- **Petits :** la clé de mois `slice(0, 7)` côté API (budgets, PDF) ; la liste `WEEKDAYS` et une expression régulière locales dans `calendar-pdf.ts` ; deux verts et un gris par défaut répétés 5 fois (`PDF_COLORS`, `DEFAULT_LABEL_COLOR`) ; « Europe/Paris » écrit 2 fois ; les mutations groupées renvoient un nombre (routines) ou `true` (tâches) ; des alias `nextPosition` d'une ligne ; `work-schedules.ts` toujours en guillemets doubles.

## Web : briques contournées

### 7. Rappels, archivés, onglets

- **`ON_ERROR` :** ~70 `{ onError: onMutationError }` écrits en ligne (~40 fichiers), et une copie locale qui masque l'import (`inline-cells.tsx:383`) ; `SettingsPanel.tsx:124` utilise `formCallbacks(null, msg)` pour un simple `toastCallbacks(msg)`.
- **`unarchived(items, keep)` :** `!x.archived || x.id === …` écrit à la main ~11 fois (formulaires de tâche, contributeur, projet, mouvement, règle de plage, fiches, temps, et `table-engine.ts:74`), et ~20 `filter((x) => !x.archived)`.
- **Interrupteur « Afficher les archivés » :** le même état + `visibleItems` + compte des archivés, 16 fois (contributeurs, sprints, jalons, tableaux de bord ×3, équipe ×3, stock, fiches, comptes mail, listes de base ×2, achats, réglages). Proposition : `useArchivedToggle(items)` qui donne la liste visible et les props de l'interrupteur.
- **Onglet de page `?tab=` :** lu à la main sur chaque page, avec son défaut (routines, réglages, projet, trésorerie, stock, facturation, achats). Proposition : `usePageTab` (corrige le bug du point 4).
- **`confirmDestructive` (`run` / `done`) :** ~10 `onConfirm: () => x.mutate(id, toastCallbacks(…))` restent (équipe, budgets, trésorerie, écritures, stock, fiches, checklists, facturation, chrono).
- **`archiveEntry` :** `EntityMenu.tsx:76-80` le refait (le message de cascade d'un client peut passer en option).
- **Liens de réglages :** `?settings=1&section=…` écrit à la main (`SettingsPage.tsx:60-65`, `ProjectContributors.tsx:135`). Proposition : `settingsPath(path, section?)`.
- **Liens de projet, client et mail :** ~15 adresses écrites à la main (`/projects/${id}?tab=time`, `/mail?account=…&uid=`…). Propositions : `projectPath`, `clientPath`, `mailPath`, à côté de `taskPath`.

### 8. Composants

- **Création à la volée (décision M) :** le formulaire de mouvement garde son « + » à côté des sélecteurs et son panneau à 5 états (`EntryForm.tsx:53-63, 228-266, 445-509`, et deux « + » dans `treasury/LinesEditor.tsx`), alors que `BudgetsPanel.tsx:201-205` utilise déjà `CreatableSelect` + `itemCreator`. L'emplacement du stock pourrait aussi se créer à la volée (`useLocationSelect`).
- **`AddItemButton` (décision 16) :** adresse, tri, filtres, jeux de données, tâche (×2, avec le libellé vague « Ajouter »), écriture.
- **`InlineActions` (décision 7) :** les membres de l'équipe (`TeamPanel.tsx:96-118`) et les icônes de `SettingsList.tsx:249-266` sont faits à la main ; ~62 paires `<Tooltip><ActionIcon>` dans l'app. Proposition : `IconAction` pour une icône seule.
- **`SettingsSection` (décision D) :** trois cartes à la main dans `ClientBillingSection.tsx:96, 155, 175`.
- **Petits :**
  - des aides recopiées dans le formulaire de mouvement (`documentKey`, `payerKey`, le décodage `client:` / `tiers:`) ;
  - `listMutations` impose `remove`, donc 5 hooks réécrivent `create` et `update` ;
  - `TimeInput` brut dans l'agenda des routines (les réglages par défaut pourraient aller dans `app/theme.ts`, et `TimeField` disparaîtrait) ;
  - `valueFormat` répété dans les budgets ;
  - `[data-reveal]` pas encore dans `EditableCells.module.css` ;
  - `collator` et `normalize` importés par deux chemins ;
  - `localDay(x.toISOString())` inutile ;
  - le `dayOf` local de `CalendarPage.tsx:108`, qui masque `lib/dates.dayOf` ;
  - `CardDragHandle` recopie `SortableHandle` ;
  - un `fullDate` qui n'enveloppe que `fmt.dateTime` ;
  - les heures d'envoi programmé recalculées à la main (`localInstant`, `weekdayOfDate`) ;
  - `QuantityInput` lu de deux façons ;
  - `PersonOption.tsx` écrit deux `<Avatar>` au lieu de son `PersonAvatar`.

## Web : doublons pas encore traités

_Créés par nos propres lots (à ne plus jamais reproduire) : l'état « Afficher les archivés » ×16 (point 7), les paramètres d'`archiveRowsAction` ×8 (point 9), `documentKey` et `payerKey` recopiés (point 8). Le reste existait avant._

### 9. Actions de tableau

- **Supprimer une ligne et une sélection :** chaque tableau définit deux suppressions aux textes différents (menu de ligne et sélection) : stock, écritures, catalogue, fiches, budgets, trésorerie, facturation, documents. Proposition : une action par type, `rowMenuEntry(deleteRowsAction([row], …))`, comme les tâches et les routines.
- **Archiver une sélection :** le même bloc de paramètres d'`archiveRowsAction` 8 fois sur 14. Proposition : `archiveRowsAction.of(rows, mutation, mot, feminine?)`.

### 10. Écrans

- **En-tête des pages de détail :** 5 formes (tailles de titre h2 / h3, « Archiver » en icône, en bouton ou dans un menu ; la fiche, voir le bug du point 1). Proposition : `DetailHeader({ back, title, badges, subtitle, actions })`. Voir décision R.
- **Mail :** la barre de recherche et l'en-tête « Recherche avancée » (`MailPage.tsx`, `ProjectMailsPanel.tsx`), et la sélection d'une page de mails (`MailPage.tsx`, `MailSearchFolders.tsx`). Propositions : `MailSearchBar`, `AdvancedSearchHeader`, `usePageSelection`.
- **Achats :** le regroupement et « catégories vides » (état + contrôles) 3 fois. Proposition : `useShoppingGrouping` et `GroupingControls`.
- **Stock :** le sélecteur d'emplacement 4 fois. Proposition : `useLocationSelect(keep)`.
- **Agenda :** les listes « agendas / plages à afficher » et cinq interrupteurs recopiés dans `CalendarPage.tsx:820-917`. Proposition : `HiddenChecklist` et `toggleIn(list, id, on)`.
- **Chrono :** l'arrêt n'a ni le même aspect ni le même libellé (`TimerToggle` : « Arrêter le chrono », rouge clair ; `TimerControls` : « Arrêter et enregistrer ») ; « Chrono en cours » ou « En cours ». Voir décision S.
- **Menus de la barre latérale :** ils remplacent les trois points verticaux d'`ActionsMenu` par des points horizontaux, avec « Actions sur … » au lieu d'« Actions de … » et un séparateur placé différemment. Voir décision T.
- **Petits :**
  - le champ d'effort des tâches 2 fois (`EffortInput`) ;
  - le bouton « ajouter un sous-élément » des tâches et des routines (`AddChildButton`) ;
  - le nom d'un contact (`contactName`) ;
  - les libellés Mois / Trimestre / Année 4 fois (`SCALE_LABELS`) ;
  - « il y a N jours » de trois façons (`fmt.daysAgo`) ;
  - deux composants `Figure` (accueil, trésorerie) ;
  - le tri du tableau par flèches, les colonnes par glisser ;
  - les pages « introuvable » (taille d'icône, `backTo` manquant au client et au projet, `ErrorAlert` pour une tâche) ;
  - les avertissements en jaune (notifications) ou en orange (alertes, décision 12) ;
  - la carte « Agenda » de l'accueil sans « + N autres » ni liens.

### 11. Libellés et styles

- **Opacité « atténué » :** archivé 0,6, 0,55 ou 0,45 ; fait / fermé 0,55 ou 0,6 ; les tâches fermées ne sont pas atténuées. Proposition : `--onoko-muted-opacity` et un état de ligne `done` dans `DataTable.module.css`. Voir décision U.
- **Ordinaux :** « 1er / 2e / dernier » (répétitions) contre « premier / deuxième » (ouverture des routines), et les listes de jours, mois et positions construites 2 fois. Proposition : `POSITION_LABELS`, `MONTH_LABELS`, `weekdayOptions` partagés. Voir décision V.
- **Libellés d'action :** `RowActions` écrit « Libellé : nom », `InlineActions` « Libellé nom ». Voir décision W.
- **« Cette action est irréversible. » :** dans 22 confirmations, absente des ~34 qui disent « définitivement », et parfois en double. Voir décision X.
- **Libellés d'archivage :** préfixés par le type (« Fiche « … » ») ou non (« « … » ») ; sans guillemets dans l'équipe ; « Budget » générique.
- **Retirer une ligne :** « Supprimer » (lignes de facture, `InlineActions`) contre « Retirer la ligne » (lignes d'écriture, `RemoveButton`).
- **Alarmes :** « Alertes » / « Nouvelle alerte » pour une tâche et une routine, « Alarme » sur la page.
- **Export ICS :** « Tout exporter (.ics) » et « Calendriers (.ics) » pour le même lien.
- **Calques de l'agenda :** « Nom (Type) » pour une plage à soi, « Type · Espace » pour une autre.
- **Légendes en capitales :** graisse 600 ou 700.
- **Glisser « dans » :** fond et contour (tableaux) ou fond seul (arbres).
- **Points de rupture :** `88em`, `62em`, `70em` écrits en dur dans trois CSS.
- **Divers :** le nom d'un tableau de bord se modifie avec un `let` et une notification au lieu d'un formulaire.

### 12. Rangement

- `ArchivedBadge` vers `components/feedback/` (à côté d'`ArchivedNotice`) ; `NoMatch` vers `components/data-table/table/` (il n'y sert qu'au tableau).
- `AddressFields`, `PhonesField` et `countries` ne servent qu'à la facturation : vers `features/accounting/components/`, ou exception notée.
- `lib/attachments.ts` (envoi de fichier) ne sert qu'aux éditeurs : vers `components/markdown/`.
- `PersonOption.tsx` exporte aussi `PersonAvatar` et `PersonRow` : à renommer `people-rows.tsx` (ou un fichier par composant).
- Code mort : `monthOf` (`describe-recurrence.ts:44`), l'export de `SortableHandle`, l'`action` vide de `NoMatch`.

## Partage web / API

### 13. Code partagé

- **Pluriels et coupe :** `plural`, `countOf` et `ellipsis` n'existent que côté web ; l'API écrit ses pluriels à la main (PDF d'agenda et de trésorerie). Proposition : `shared/core/text.ts`, réexporté par `lib/text`.
- **Nombres :** `fmt.number`, `fmt.percent`, `fmt.quantity` web seulement. Proposition : `formatNumber`, `formatPercent` partagés, à côté de `formatMoney`.
- **Constantes en double :** `CALENDAR_DAY` (web) et `DAY_PATTERN` (partagé) ; `LOCALE` deux fois ; `yearOfDay` à ajouter à côté de `monthOfDay` (~6 `slice(0, 4)`).

### 14. Règles eslint

- **Trous :**
  - la règle `onSuccess` ne voit que la flèche dont le corps est l'appel lui-même (les blocs passent) ;
  - rien contre `{ onError: onMutationError }` en ligne, les filtres `unarchived` à la main, un bouton « + » discret (`AddItemButton`), `Intl.RelativeTimeFormat`, `substring(0, 10)` / `split('T')[0]`, ni `collator` et `normalize` importés de `@ordo/shared`.
- **Trop larges :** chaque brique exemptée l'est de tout `no-restricted-syntax` (`lib/dates.ts`, `month-column.ts`, `RemoveButton`, `ErrorAlert`, `NoticeAlert`, `lib/format.ts`, `lib/notify.tsx`). Proposition : un `eslint-disable-next-line` ciblé, avec sa raison.
- **API :** pas de configuration eslint.
- **Prettier :** il reste des fichiers mal formatés (`work-schedules.ts`, `ClientBillingSection.tsx`, des lignes vides dans les props de `PersonRow`…). Proposition : un passage Prettier sur tout le dépôt, en commit à part.

## Plan proposé

**Garde-fous de chaque lot** (pour ne plus créer de doublons) :

- factoriser dès la deuxième copie, avant de rendre le lot ;
- chaque nouvelle brique arrive avec la règle eslint qui interdit son ancien motif ;
- chaque agent lit d'abord la liste des briques existantes ;
- un détecteur de copier-coller (`jscpd`) vérifie que le lot n'en ajoute pas ;
- pas d'agents en parallèle sur une même brique.

1. **Bugs (1 à 4).**
2. **Briques contournées (5, 7, 8)**, puis les règles eslint qui les verrouillent (14).
3. **Doublons pas encore traités (6, 9, 10, 13)**, avec les décisions.
4. **Libellés et styles (11)**, avec les décisions.
5. **Rangement (12)**, puis un passage Prettier sur tout le dépôt, en commit séparé.

Décisions (18 novembre 2026, après-midi) :

- **O. Noms :** `label` pour tout, `title` compris, base comprise (migrations de renommage) ; gardent `name` les personnes : contributeurs, utilisateurs, relations, contacts, clients, tiers de trésorerie. Les espaces de travail passent en `label`.
- **P. Commentaires :** refusés sur un élément archivé.
- **Q. Dates qui se suivent** (début / fin, min / max, toute période) : un seul message, « La fin doit suivre le début. » ; changer le début après la fin déplace la fin à la même date, et inversement ; les dates impossibles ne sont pas sélectionnables. Un champ de période commun.
- **R. En-tête des pages de détail** (document de facturation, document importé, fiche, liste de courses, panneau de tâche) : un seul `DetailHeader` (retour, nom en h3, badges, actions). « Archiver » n'est jamais un bouton : toujours dans le menu « … », partout.
- **S. Chrono :** « Arrêter le chrono » et « Chrono en cours », un seul aspect.
- **T. Menus :** trois points verticaux partout.
- **U. Atténué :** opacité 0,5 (`--onoko-muted-opacity`) ; les tâches fermées sont atténuées.
- **V. Ordinaux :** « 1er / 2e / … / dernier » partout.
- **W. Boutons icône :** l'infobulle dit l'action (« Modifier ») ; le libellé caché, lu par les lecteurs d'écran, dit l'action et l'élément (« Modifier « Urgent » »).
- **X. « Cette action est irréversible. » :** dans toutes les confirmations destructives (ajoutée par `confirmDestructive`).

## Décisions déjà prises

1. **Noms en double des listes des achats :** conflit (`rethrowUnique`), comme les autres listes.
2. **Arbres :** les emplacements passent en dernier quand leur parent change ; supprimer une catégorie d'agenda remonte ses sous-catégories au lieu de les supprimer ; la signature de `moveCalendarCategory` est alignée.
3. **Dates :** contrôle de la date réelle (`z.iso.date`) partout.
4. **Titre des PDF :** 16 pt, sous-titre 10 pt gris.
5. **Retirer :** croix grise pour un élément dans un champ (puce de sélection multiple, pièce jointe, lien dans un badge), corbeille rouge partout ailleurs ; `RemoveButton` a les deux variantes.
6. **Barre latérale :** `SectionEmpty` remplacé par `EmptyState` compact.
7. **Équipe de la trésorerie :** `InlineActions` (icônes avec infobulle), comme les autres listes.
8. **Création rapide de la trésorerie :** les mêmes champs que les réglages, couleur et image comprises.
9. **Chrono :** « Démarrer le chrono », « Chrono démarré. ».
10. **Cartes de l'accueil :** 10 lignes.
11. **Boutons d'action :** icône et libellé partout (« Supprimer » avec sa corbeille, sans points de suspension) ; un bouton icône seul garde son infobulle.
12. **Alertes :** `NoticeAlert` avec les couleurs standards (succès vert, info bleu, avertissement orange, erreur rouge) et une icône par type.
13. **Réglages de page :** onglets.
14. **Point de rupture :** 48em.
15. **Personnes :** « Contributeurs » et « Relations » en pro, « Contributeurs » et « Proches » en perso ; « Prénom (moi) » partout ; un seul constructeur d'options.
16. **Ajouter une ligne :** `AddItemButton`, bouton discret `xs` avec une icône « + » et un libellé précis, aligné à gauche sous la liste.
17. **En-tête des pages de détail :** un lien texte « ← Nom de la liste » au-dessus du titre (fil d'Ariane), dans un composant commun, pour le document importé, le document de facturation, la fiche et la liste de courses ; les boutons retour en double disparaissent.
18. **Recherche mail :** l'état de la recherche et de la recherche avancée dans l'URL partout, onglet Mails d'un projet compris.
19. **Menus :** `ActionsMenu` accepte des titres de section, et le menu « Achats » d'une tâche (`tasks/components/extra-cells.tsx:179`) l'utilise.
20. **Argent :** `fmt.moneyCents` repose sur `formatMoney` (partagé) ; un seul format des montants en centimes.

- **A. Limites des produits** (fiches, stock, achats) : unité 50 caractères, note 500, quantité ≥ 0, dans des schémas communs.
- **B. Archivage par booléen :** comptes, tiers et catalogue passent à `archivedAt` (migration qui reprend les archivés), archivage par `setArchived` seulement, plus de case « Archivé » dans les formulaires.
- **C. Lieux :** supprimer un lieu supprime ses zones (gardé).
- **D. Carte avec titre :** `SettingsSection` partout, facturation et trésorerie comprises.
- **E. Fichiers :** un seul `FileBadge` (badge, trombone, nom coupé), avec la taille en option pour le mail.
- **F. États d'une période :** « À venir / En cours / Passée ».
- **G. Cellule sur une sélection :** « (appliqué aux N cellules sélectionnées) » partout.
- **H. Catégories de statut :** une table partagée aux deux formes, accordées avec le nom qualifié : « Terminé / Annulé » pour un statut, « Terminée / Annulée » pour une tâche.
- **I. Périodes prédéfinies :** « Ce mois-ci / Le mois dernier » (et leurs équivalents), un seul système.
- **J. Onglet des réglages de page :** dans l'URL partout.
- **K. Opacité de glissement :** 0,5.
- **L. Drapeaux mail :** unicité du nom par espace (migration ; aucun doublon dans les fixtures, aucun drapeau en production).
- **M. Création à la volée :** partout (étiquettes, statuts, catégories, unités, magasins, lieux…), le formulaire des réglages avec couleur et image.
- **N. Description d'un temps :** markdown partout.

## Restent à part

- **Menu des lieux enregistrés** (`AddressInput.tsx:134`) : un arbre avec coches, trop particulier pour `ActionsMenu`.
- **Logo de l'entreprise :** il s'enregistre tout de suite et n'accepte que PNG ou JPEG, pour les PDF.
- **Mise en page des tableaux PDF (`tableWriter`) :** pas touchée sans essai visuel.

## Déjà unifié

- **Série du 18 novembre 2026 (soir) :** schémas produit communs, `archivedAt` pour comptes, tiers et catalogue, drapeaux mail uniques, tâches et routines archivées en lecture seule ; `deleteOrNotFound`, `decimalCents`, `scopedStatus`, `ownerScope`, `copyName` ; `toastCallbacks`, `ON_ERROR`, `confirmDestructive` (`run`, `done`), `archiveEntry`, `ArchivedNotice` ; `SettingsSection`, `FileBadge`, `periodState`, `cellLabel`, `TASK_STATUS_CATEGORY_LABELS`, `DATE_PERIODS`, `useSettingsTab`, `createSettingsItem`, `MailListItem`, `monthColumn`, `DetailNotFound`, `TimerControls`, `useSortableItem`, `localInstant` ; `ActionsMenu` partout ; `labelMutations` pour toutes les listes nom + couleur ; règles eslint.
- **Série du 18 novembre 2026 (après-midi) :**
  - API : `deleteOrNotFound`, `downloadRoute`, `createLabelService` pour tout modèle, `labelMutations`, `treeListService`, `subtreeIds`, `lineageIds`, `assertDateRange`, `connectIds`, `toDecimal`, `writeHeading` ; partagé : `daySchema` à date réelle, `sprintSchema`, `safeFilename`, `printedDay`, `roundQuantity`, `weekdayOfDate`, `formatMoney` en cache ;
  - web : `RemoveButton` (croix et corbeille), `useAsyncAction`, `FormActions` (zone `danger`, icônes), `EditableMultiSelect`, `EditableTime`, `DependencyIcon`, `SignedAmountCell`, `BackLink`, colonnes et champs produit, `SettingsItemForm`, `AmountInput` avec devise, `NoticeAlert`, `CountBadge`, `AddItemButton`, `LabeledField`, `formCallbacks`, `SettingsTabs`, `app/pages.ts`, `useIsPhone`, `people-options`, `useStartTimer` et `TimerToggle`, `HomeList`, `use-mail-search`, titres de section d'`ActionsMenu`, dossiers `components/page` et `components/items` ; icône et libellé sur tous les boutons d'action ; ligne d'ajout des fiches dans le tableau ; « Annuler » qui remet une valeur archivée (`restoring`).
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
