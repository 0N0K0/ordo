# Composants similaires et redondances de code

État au 18 novembre 2026, après quatre séries d'unifications (voir [Déjà unifié](#déjà-unifié)). Les décisions déjà prises sont en [annexe](#décisions-déjà-prises).

Ce qui reste est surtout petit :

- **Bugs :** une quinzaine, dont des dates prises en UTC, des copies de fiches non validées, des dates impossibles encore acceptées et des tâches archivées encore modifiables.
- **Briques contournées :** `formCallbacks` (~50 rappels écrits à la main), `deleteOrNotFound`, `assertExists`, `toDecimal`, `RemoveButton`, `EmptyState`, `itemOptions`, l'archivage.
- **Nouveaux doublons :** la ligne de mail, la colonne « Mois », la confirmation de suppression, l'instant local, les commandes du chrono, les règles CSS d'actions au survol.
- **Rangement :** quelques composants communs qui importent une feature ou ne servent qu'à une seule.

La bibliothèque de documents n'est pas traitée : elle sera refaite entièrement.

## Bugs

### 1. Jours pris en UTC

Un instant (DateTime) coupé par `.slice(0, 10)` donne le jour UTC : entre minuit et 1 h (heure de Paris), la ligne tombe la veille, et le 1er du mois à minuit, dans le mois précédent.

- **Stock :** `MovementsTable.tsx:28, 35-36`, `StockPage.tsx:37`, `LotsTable.tsx:45`, `StockTable.tsx:163`.
- **Évènements dans les tâches :** `tasks/lib/task-columns.ts:93, 215` (`event.start.slice(0, 10)`), alors que `event.startDate` existe.
- Correction : `localDay(x)`, comme `SheetsTable.tsx:97` et `BaseList.tsx:143`.

### 2. Copie d'une fiche dans une liste de courses sans contrôle

`services/shopping/sheets.ts:397-433` recopie les valeurs d'une fiche dans un élément de liste sans les valider. Les limites diffèrent :

| Champ    | Fiche         | Élément de liste     |
| -------- | ------------- | -------------------- |
| Unité    | 40 caractères | 20                   |
| Note     | 20 000        | 500                  |
| Libellé  | 200           | 120                  |
| Quantité | 0 accepté     | strictement positive |

Les éléments créés ne passent plus leur propre formulaire à la modification suivante. Une unité des réglages peut aussi faire 50 caractères. Correction : des schémas communs `quantitySchema`, `unitSchema`, `itemNoteSchema` (voir décision A).

### 3. Dates impossibles encore acceptées

`parseDay('2026-02-31')` donne le 3 mars : `statementDate` (`shared/accounting/treasury.ts:485`) et `accounting-zip.ts:30-33` acceptent donc le 31 février, contre la décision 3. Des `z.iso.date()` bruts, avec le message anglais de Zod, restent dans `calendar/calendar.ts:56`, `accounting-documents.ts:46-48, 340`, `mail/mail.ts:52-53`, `calendar-pdf.ts:9`. Correction : `daySchema()` partout.

### 4. Tâches et routines archivées encore modifiables

- **Tâches :** `updateTask` ne vérifie pas l'archivage, les cellules et le panneau ne sont jamais en lecture seule, et l'édition en masse (`tasks/lib/cell-edit.ts:26`) inclut les tâches archivées, contrairement aux routines. La règle « masqué, lecture seule » s'applique à elles aussi.
- **Routines :** `RoutinesPage.tsx:202-210` ne passe pas `readOnly` aux cellules de `extra-cells.tsx` (heure, ouverture, lieu, trajet, rappels, bloque, parent) : la modification part, puis l'API la refuse.

### 5. Autres bugs

- **Taille de fichier :** `ProjectResourcesPanel.tsx:137` écrit « 5120 Ko » pour 5 Mo. Correction : `fmt.fileSize`.
- **« Moi (moi) » :** `BudgetsPanel.tsx:338, 379, 409` quand il n'y a pas de membre « moi ». Correction : `personName` / un `meName(me)` commun (6 copies de « (moi) » dans la trésorerie).
- **Chrono :** `useNow` garde l'heure du montage jusqu'au premier tic quand il s'active (`lib/use-now.ts:11-31`) : le chrono démarre à 0 ou moins pendant une seconde.
- **Pièce jointe d'une facture :** retirée d'un coup dans l'éditeur (`DocumentEditor.tsx:769`), avec confirmation et notification dans le tableau (`document-cells.tsx:84-89`). Correction : la confirmation partout.
- **Relations d'un évènement :** `EventForm.tsx:217-219` propose les relations archivées et écrit « Relations » même en perso (contre la décision 15).
- **Statut d'une nouvelle tâche :** le premier statut dans `TaskCreateForm.tsx:37`, aucun dans `table-extras.tsx:25`. Proposition : `defaultStatusId(context)`.
- **Erreur masquée :** `graphql/modules/sheets.ts:177, 180` lance un `Error` brut (l'utilisateur voit une erreur générique), et `sheetLinks` (`:216`) répond `{ taskId: '' }` sans propriétaire, alors que le service le refuse.
- **Couleur des emplacements :** `shared/shopping/stock.ts:10` accepte n'importe quelle chaîne (`colorSchema` ailleurs).
- **Import circulaire :** le paquet partagé s'importe lui-même (`@ordo/shared` dans `shopping/sheets.ts:1`, `routines/routines.ts:1`, `calendar/work-schedules.ts:1`, `accounting/accounting-documents.ts:1`, `dates/recurrence.ts:1`) : une valeur lue au chargement peut être `undefined`.
- **PDF de trésorerie :** son titre est écrit à la main en 14 / 8,5 pt (`treasury-pdf.ts:146-153`), contre la décision 4.
- **Cases à cocher des lignes sur écran tactile :** `.rowCheck` (`DataTable.module.css:187-200`) n'a pas la règle `@media (hover: none)` des autres éléments révélés au survol. À confirmer sur un téléphone.
- **Ordre optimiste :** `moveToIndex` (web) ne borne pas l'index, `moveInOrder` (API) si : l'ordre affiché peut différer de celui du serveur.

## API

### 6. Briques contournées

- **`deleteOrNotFound` :** 7 `assertExists` suivis d'un `.delete` (deux requêtes, avec une course possible) : `alarms.ts:69`, `client-parties.ts:74, 110`, `catalog.ts:53`, `mail/linked.ts:99`, `core/comments.ts:104`, `shopping.ts:281`.
- **`assertExists` / `assertAllExist` :** `workspaces.ts:157, 175, 187`, `calendars.ts:127`, `calendar-ics.ts:274`, `mail/drafts.ts:69`, `routines.ts:952`, `assertOwner` (`sheets.ts:484-491`) ; `findMany` + longueur dans `calendar-events.ts:218, 228`, `tasks.ts:85`.
- **`toDecimal` / `fromDecimal` :** seuls les achats les utilisent ; 24 `new Prisma.Decimal` et ~40 `Number(decimal)` ailleurs (facturation, trésorerie, catalogue), et 10 `toCents(Number(x))`. Proposition : `decimalCents(x)`.
- **`labelMutations` :** pas utilisé par les magasins, rangements, unités, catégories de fiche, drapeaux mail et types de plage, dont les mutations renvoient un id ou un booléen (le web devrait suivre).
- **`createLabelService` :** des options `schema` qui répètent le schéma par défaut (`shopping.ts:179, 185, 334`) ; `updateUnit` refait `update` pour renommer les produits. Proposition : un crochet `save`.
- **Petits :** `collator` redéfini (`mail/reader.ts:227`) ; `day()` et `.slice(0, 10)` sur le scalaire `Date` (`graphql/modules/stock.ts:187`, `sheets.ts:226`) ; le champ `archived` écrit à la main pour Client, Project, Routine et Task alors que la boucle d'`archive.ts:41` le couvre ; `work-schedules.ts` toujours pas formaté.

### 7. Nouveaux doublons

- **Statut de document dans sa portée :** `findUnique` + contrôle de portée + `notFound('Statut')`, 3 fois (`document-tracking.ts:141, 162`, `imported-documents.ts:127`). Proposition : `scopedStatus(statusId, type)`.
- **Propriétaire d'une fiche :** la condition routine / évènement / tâche refaite 5 fois, et « charger les liens puis `partsOf` » 2 fois. Proposition : `ownerScope(owner)` et `sheetPartsOf(owner)`.
- **Archivage par booléen :** comptes, tiers et catalogue gardent `archived` (booléen) et leur formulaire peut archiver ; le même contrôle est copié 3 fois (`treasury.ts:58-60`, `catalog.ts:46-48`, `treasury-settings.ts:148-149`). Voir décision B.
- **Lieux :** un sixième arbre hors de `treeListService` (`core/geo.ts:194-268`) ; un lieu déplacé ne passe pas en dernier, et supprimer un lieu supprime ses zones (cascade). Voir décision C.
- **Petits :** l'enveloppe des erreurs SMTP 2 fois (`rethrowSmtpError`) ; `` `${name} (copie)`.slice(0, max) `` 3 fois, qui coupe le suffixe d'un nom déjà plein (`copyName(name, max)` partagé) ; le gris des bordures PDF a 3 valeurs.

## Web : briques contournées

### 8. Rappels et notifications

- **`formCallbacks(null, message, onDone)` :** ~50 rappels écrits à la main : `onSuccess: () => { notifySuccess(…); onDone() }` (événement ×4, déplacement de routine, graphique, suppressions de tâches, contributeurs, mouvements et inventaire du stock, fiche…) et `onSuccess: () => notifySuccess(…)` (~40 : alarmes, temps, tableaux de bord, plages, facturation, équipe, achats, mails programmés…).
- **`onError` :** 18 alias locaux sous deux formes (`= onMutationError`, `= { onError: onMutationError }`). Proposition : `toastCallbacks(message)` et `ON_ERROR` dans `lib/notify.tsx`.
- **Confirmer, supprimer, annoncer :** 7 copies (alarmes, temps, tableaux de bord ×2, contributeurs, plages, évènement, où `run('ALL')` est recopié). Proposition : options `run` et `done` sur `confirmDestructive`, qui généralisent `confirmPlanDelete`. Les textes passés dans un `<Text>` en plus (18 fois) sont inutiles, et « Cette action est irréversible. » manque dans `DashboardBoard.tsx:213`.
- **Archiver :** `archiveEntry` (`accounting/lib/archive-entry.tsx`) est réécrit ~16 fois (contributeurs, sprints, jalons, tableaux de bord, plages, menu des entités…). Proposition : le déplacer dans `lib/archive.ts`. Le bandeau « archivé » est écrit 3 fois (`EventForm.tsx:339`, `DocumentEditor.tsx:429`, `DashboardBoard.tsx:546`) : `ArchivedNotice`.

### 9. Composants

- **`RemoveButton` :** corbeilles rouges faites à la main (`DocumentEditor.tsx:365`, `MailReader.tsx:200`, `MailOrganizeActions.tsx:221`, `WorkspacesManager.tsx:98-121`) ; corbeille grise contre la décision 5 (`OrderPanel.tsx:205-217`). Supprimer un brouillon : icône seule dans l'éditeur, bouton avec libellé dans le lecteur de mail ; la décision 11 donne le libellé.
- **`EmptyState` :** `OrderPanel.tsx:139`, `ProductPicker.tsx:93`, `MailSearchFolders.tsx:141`, `MailPage.tsx:294`.
- **`SubSection` / `LabeledField` :** `ProjectGithubPanel.tsx:218, 226, 234`, `TrackingPanel.tsx:235`, `OrderPanel.tsx:131`, `RichEditor.tsx:71`, `CalendarPage.tsx:821, 844, 868, 914` (ce dernier gardé pour son espacement : à revoir avec un `gap`).
- **`itemOptions` / `itemChoices` :** `use-agenda-layers.ts:24`, `task-columns.ts:151, 157, 163, 171`, `WorkSchedulesManager.tsx:246`.
- **`ActionsMenu` :** le menu « Créer » de la barre latérale (`Sidebar.tsx:346-371`, avec `newEntityEntries`) et son menu de tri (`:309-344`, qui demande une entrée cochée).
- **Petits :** `CountBadge` dans `NavBadges.tsx:21, 37` ; `PersonAvatar` dans `MailHeader.tsx:35` ; `plural` au lieu de « (s) » et `> 1 ? 's'` (~13 fois : trésorerie, listes de base, fiches, mot de passe, GitHub, relances, import de relevé, mail) ; `commentTotal` au lieu de 4 copies ; `DURATION_UNITS` à exporter au lieu de 3 listes de durées ; `safeFilename` partagé dans `lib/download.ts:35` ; `printedDay` local (`time-lines.ts:36`, `tasks/lib/export.ts:15`) ; `LoansPanel.tsx:87` (`.slice(0, 10)` sur un jour).

## Web : nouveaux doublons

### 10. Écrans

- **Ligne et liste de mails :** la ligne (case, « Traité », expéditeur, drapeaux, trombone, date, objet), l'en-tête « tout sélectionner » et la pagination sont copiés dans `MailPage.tsx:256-366` et `MailSearchFolders.tsx:151-243`. Proposition : `MailListItem` et `MailListPane`.
- **Colonne « Mois » :** 7 copies (documents ×2, écritures, colonnes d'écriture, mouvements du stock, trésorerie, temps) ; `BudgetsPanel.tsx:62` laisse le mois en minuscule. Proposition : `monthColumn(id, label, day)`, qui prend un jour ou un instant (corrige aussi le bug 1).
- **Carte avec titre :** `EditorSection` (facturation) et ses copies à la main dans la trésorerie (`BudgetsPanel.tsx:570, 625, 675`, `TreasuryPage.tsx:379`). Voir décision D.
- **Page de détail introuvable :** 5 apparences (404, `ErrorAlert`, `EmptyState` + bouton retour, `PageMessage`). Proposition : `DetailNotFound({ what, backTo, backLabel })` sur `PageMessage`, avec le `BackLink`.
- **Badge de fichier :** trombone + nom coupé à 24 caractères, 4 fois (`document-cells.tsx`, `entry-cells.tsx`) ; les puces de fichier du mail en sont une autre copie. Proposition : `FileBadge` et `ellipsis(text, max)`. Voir décision E.
- **Monter / Descendre :** 3 menus (`ProjectResourcesPanel.tsx:144`, `accounting/LinesEditor.tsx:92`, `WorkspacesManager.tsx:93`). Proposition : `moveEntries(index, count, move)`.
- **Commandes du chrono :** pause et arrêt en double (`TimerCard.tsx:146-160`, `TimerWidget.tsx:44-58`) avec des `aria-label` différents ; `TaskTime.tsx:28` utilise `title` et ne permet pas d'arrêter. Proposition : `TimerControls`.
- **Élément triable :** `useSortable` + `sortableStyle` + `DragHandle`, 5 fois. Proposition : `useSortableItem(id, disabled)`.

### 11. Logique

- **Instant local d'un jour et d'une heure :** 6 copies (sonnerie ×2, agenda des routines, temps ×2, règles de plages). Proposition : `localInstant(day, time?)` ; `localDay(new Date(x))` est inutile et `localParts` devrait accepter une chaîne.
- **Prochaine sonnerie d'une alarme :** 3 copies, et « Le … à … » 2 fois. Proposition : `nextRing` et `describeTiming` dans `alarms/lib/alarm-labels.ts`.
- **Portée d'une modification d'évènement :** « tout, ou demander si répété » 3 fois dans `EventForm.tsx`. Proposition : `chooseScope`.
- **État d'une période :** À venir / En cours / Terminé(e) / Passée, avec sa couleur, 3 copies (sprints, évènements, plages). Proposition : `periodState` dans `lib/periods.ts`. Voir décision F.
- **Libellés de cellule sur une sélection :** « (appliqué aux N cellules sélectionnées) » dans les tâches, « (N routines) » dans les routines. Proposition : `cellLabel`. Voir décision G.
- **Catégories de statut :** « Terminé / Annulé » (tâches ×2) contre « Terminée / Annulée » (tableaux de bord). Proposition : `TASK_STATUS_CATEGORY_LABELS` partagé. Voir décision H.
- **Périodes prédéfinies :** deux systèmes calculent les mêmes intervalles (`presetRange` à fin incluse, `filterPeriod` à fin exclue), avec deux jeux de libellés : « Mois en cours / Mois précédent » et « Ce mois-ci / Le mois dernier ». Voir décision I.
- **Argent et dates côté API :** `lib/format.ts` refait le cache de formats monétaires de `formatMoney` (proposition : exporter `moneyFormat`) ; les PDF refont `fmt.dayLong`, `fmt.month`, `fmt.weekday`, `fmt.capitalize` (proposition : sortir les formats de jour dans `shared/dates/format.ts`).
- **Onglet des réglages de page :** gardé en stockage local (agenda, facturation, client) ou dans l'URL (projet). Proposition : `useSettingsTab`. Voir décision J.

### 12. CSS

- **Actions au survol :** opacité 0, visibles au survol ou au focus de la ligne et toujours sur écran tactile : 5 copies. Proposition : une règle `[data-reveal]` dans `styles/reveal.css`.
- **Opacité de glissement :** 0,4, 0,5 ou 0,6 selon l'endroit. Proposition : un jeton `--onoko-dragging-opacity`. Voir décision K.
- **Arbres :** deux largeurs de chevron (les lignes des deux arbres ne s'alignent pas) ; `.groupRow` (`Tree.module.css`) recopie `.row` ; deux fichiers `TreeRow.module.css` aux rôles différents (renommer le commun `tree-drop.module.css`).
- **CSS mort :** les règles `.row` de `TaskTable.module.css:9-35` (copie de `DataTable.module.css`), `[data-over]` dans `Shopping.module.css:17-20`.

### 13. Rangement

- `ActionsMenu` et `InlineActions` sont dans `components/data-table/cells/RowActions.tsx` mais servent dans 15 fichiers hors des tableaux : `components/actions/ActionsMenu.tsx`.
- Des composants communs importent une feature : `SettingsItemForm` importe `IconField` (à déplacer dans `components/inputs/`) ; `ByWorkspace` importe `features/workspaces` et ne sert qu'à l'agenda (vers `features/calendar/components/`) ; `use-saved-views.ts` dépend de `features/tasks/api` (ses requêtes vers `components/data-table/views/api`).
- Utilisés par une seule feature : `MultiplierInput` (fiches), `RichEditor` (mail), `lib/published-height.ts` (tableaux).
- `SettingsTabs` est dans `app/layout/` mais sert à 4 pages : `components/tabs/`. `page-title.ts` n'enveloppe que `pageOfPath` pour un seul appelant.
- Exports à retirer (servent dans leur seul fichier) : `openPanel`, `archivedMessage`, `UNEXPECTED_ERROR`, les types `PersonChoice`, `People`, `NoticeKind`, `SettingsItemExtra`, `SettingsTabItem`, `AppPage`.

## Plan proposé

**Fait le 18 novembre 2026** : points 1 à 13 et décisions A à N ; règles eslint contre le retour des motifs unifiés (`apps/web/eslint.config.js`). Restent : 12 fichiers qui importent encore `Menu` de Mantine directement, 5 imports de `features/` depuis `components/` et `lib/` (espace actif, liens de fichiers, clés de requête), commentés en exceptions ; `labelMutations` pour les listes des achats, du mail et des plages (le schéma changerait).

1. **Bugs (1 à 5)**, avec les décisions A, B et C si elles touchent les données.
2. **Briques contournées (6, 8, 9) :** mécanique.
3. **Nouveaux doublons (7, 10, 11, 12)**, avec les décisions D à L.
4. **Rangement (13)**, seul dans l'arbre.

Décisions (18 novembre 2026, soir) :

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

Ensuite : des règles eslint qui interdisent les motifs déjà unifiés, et plus d'agents en parallèle sur une même brique commune.

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

## Restent à part

- **Menu des lieux enregistrés** (`AddressInput.tsx:134`) : un arbre avec coches, trop particulier pour `ActionsMenu`.
- **Logo de l'entreprise :** il s'enregistre tout de suite et n'accepte que PNG ou JPEG, pour les PDF.
- **Mise en page des tableaux PDF (`tableWriter`) :** pas touchée sans essai visuel.

## Déjà unifié

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
