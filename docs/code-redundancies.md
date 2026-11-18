# Composants similaires et redondances de code

État au 18 novembre 2026 au soir, après sept séries d'unifications (voir [Déjà unifié](#déjà-unifié)). Copier-coller (`npm run dup`) : 4 copies, 35 lignes (0,03 %). Les décisions déjà prises sont en [annexe](#décisions-déjà-prises).

Aucun doublon lourd. Restent surtout des **restes de décisions déjà prises** (archivés encore proposés, « Relation » en perso, couleurs du retard, « 1er »…), des **trous dans les règles eslint**, et des détails.

La bibliothèque de documents n'est pas traitée : elle sera refaite entièrement.

## Bugs

### 1. Restes de décisions déjà prises

- **Archivés encore proposés (règle d'archivage, AA) :**
  - clients dans `ImportedDocumentForm.tsx:101-112` (à remplacer par `ClientSelect`) ;
  - tarifs et devis dans `TimeBillingForm.tsx:90`, `DepositInvoiceForm.tsx:55, 67` ;
  - évènements archivés dans l'agenda d'une journée de routine (`RoutineDayAgenda.tsx:202-213`), et les agendas archivés d'un calque enregistré ;
  - les saisies de temps acceptent une tâche, une routine, un évènement ou un nouveau projet archivé (`time-entries.ts:23, 41-42, 65-70, 218`).
- **Création à la volée (M) :** le formulaire de projet crée ses catégories et ses statuts dans un popover fait main, sans image (`workspace/components/labels.tsx:19-62`) ; la page des réglages construit ses listes sans `SettingsItemKind`.
- **Relation ou Proche (15) :** la trésorerie écrit « Relations », « Nouvelle relation », « Relation modifiée », « Supprimer la relation » même en perso (`TeamPanel.tsx:371-473`, `treasury/LinesEditor.tsx:63`, `LoansPanel.tsx:49`).
- **Libellé ou Nom (AD) :** le formulaire de création d'une tâche dit « Titre » (`TaskCreateForm.tsx:81`) ; celui des tiers dit « Libellé » au lieu de « Nom » (`SettingsItemForm.tsx:132`).
- **Retard en orange sur l'accueil (AI) :** rouge dans `HomePage.tsx:99, 117` et `FinanceCards.tsx:144`, texte simple dans `FinanceCards.tsx:46` (qui affiche « 0 j de retard » sans échéance).
- **« 1er » (V) :** « Tous les mois le 1 », « le 1 janvier », « jusqu'au 1 juin » (`describe-recurrence.ts:39, 47, 71`). Proposition : `dayOfMonthText(n)`.
- **Glisser (K) :** les onglets ne s'atténuent pas pendant qu'on les glisse (`SortableTabs.tsx:20-27`).
- **Libellés cachés (W) :** « Autres façons : X » (`ActionButton.tsx:64`).
- **Pluriels :** « Ses 1 mouvement » (`SettingsPanel.tsx:101`), « des 1 routine, évènement ou tâche » (`delete-sheets.ts:29`), « ses 0 éléments » (`ListActions.tsx:154`, `delete-sheets.ts:28`).
- **Accords :** « « Paul » sera supprimée » (`TeamPanel.tsx:471`), « « fichier.pdf » sera supprimée » (`remove-attachment.ts:14`). Proposition : « La relation « … » », « La pièce jointe « … » ».
- **« Archiver » écrit à la main :** `BaseList.tsx:357-361` au lieu d'`archiveEntry`.

### 2. Comportements

- **Tâches d'un évènement :** le formulaire propose les tâches du même projet racine (`EventForm.tsx:480`), alors que sa description et son chrono suivent « le projet, ses sous-projets et les tâches sans projet » (`timeTasks`).
- **Envois de fichiers :** trois envois contournent `storeAttachment` (ressources de projet, pièces des documents, documents importés) : ils recopient la limite de 10 Mo et son message, et acceptent un fichier vide.
- **Note d'une relance :** coupée sans prévenir à 500 caractères (`document-tracking.ts:244`) au lieu d'être refusée.
- **Pièces jointes des mails :** affichées dans la page selon le type qu'elles déclarent (`routes/mail.ts:21-22`), alors que les fichiers enregistrés sont vérifiés sur leur contenu. Impact faible (`nosniff` et le bac à sable sont posés).
- **Ressource de projet :** une note omise est effacée, une adresse omise est gardée (`project-resources.ts:58-60`).
- **Étiquettes GitHub :** comparées de deux façons (`sync.ts:136` contre `:321, 442, 452, 762`) ; « Été » et « ete » peuvent se dédoubler. Correction : `normalize(name.trim())` partout.
- **Identifiant suggéré :** `suggestHandle` peut finir par « - » et échouer à la validation (le web ne le répare pas).
- **Clavier :** les colonnes du tableau ne se réordonnent pas au clavier (`ColumnsPanel.tsx:54`).
- **Notifications d'erreur vides :** `notifyFailure` affiche une notification vide pour une erreur sans message ; `onMutationError`, `useAsyncAction` et `AddRowField` ont trois règles de repli ; `LabelForm` met toute erreur sous son champ, session expirée comprise.
- **Infobulles sur un bouton désactivé :** elles ne s'affichent sans doute pas (`EventForm.tsx:517`, `CalendarsIcsButton.tsx:14`, `CalendarPage.tsx:853`).
- **Chrono d'un élément archivé :** caché à un endroit, grisé à un autre (`TimeLogActions.tsx:30-37`, `TaskTime.tsx:38`) ; `TimeLogActions` est le seul bouton principal.
- **Alarme d'une tâche :** le lien affiche le projet à un endroit (`AlarmCenter.tsx:86`), pas à l'autre (`ElsewhereNotifier.tsx:96`).
- **Messages d'archivé :** « Ce projet est archivé. », « Ce client est archivé. » écrits à la main à côté d'`ARCHIVED_MESSAGE`, dont deux en notification (jalons, sprints). Voir décision BC.
- **Règles eslint :** trois messages pointent vers un mauvais endroit (`settingsPath`, `yearOfDay`, `documentKey`).

## Petits doublons

### 3. API et partagé

- **Fichiers :** l'identification des images (PNG, JPEG, WebP) ×2 (`imageKind`) ; l'adresse d'un lien ou d'un fichier ×2 (`resourceUrl`) ; les noms de repli « piece-jointe », « fichier », « sans-nom » ; les messages de taille (« 1 Mo », « 10 Mo ») écrits dans le web et l'API (`fileTooLarge`, `ICON_ERRORS`).
- **Mail :** `toUpperCase() === 'INBOX'` ×8, « Réception » ×2, le filtre des dossiers non sélectionnables ×2 (`isInbox`, `folderLabel`, `selectableFolders`) ; l'adresse de la boîte de l'utilisateur ×4 côté web (`useOwnAddresses`) ; le type de tri ×3.
- **Validation :** `parseInput(z.object({ f: s }), { f: v }).f` ×9 (`parseField`) ; les liens d'évènement relus avec un forçage de type ×3 (`readEventLinks`) ; les types de facture ×4 (`INVOICE_TYPES`, `isInvoice`) ; deux schémas de nom de personne identiques, et 100 ou 120 caractères selon l'endroit (voir décision BB) ; `39` écrit 3 fois (`HANDLE_MAX`).
- **Tri :** `BY_POSITION`, `position` puis `label` ×9, ou `position` seul ×15 (voir décision BA).
- **Jours :** le jour d'un instant dans un fuseau ×3 (`dayIn`) ; un `localDay` partagé privé qui fait l'inverse de celui du web.
- **Comparaisons :** `productKey` ignore la casse mais pas les accents ; les conditions de paiement comparées à la main ×2.
- **Divers :**
  - les 24 types de listes réécrits dans le module GraphQL ;
  - des alias locaux dans les PDF (`COLORS`, `MARGIN`, `isoDate`, `hexColor`, `type Doc` ×4) ;
  - un forçage de type qui contourne `modelDelegate` ;
  - les exports de tableaux et de graphiques construisent leur nom de fichier eux-mêmes ;
  - l'ICS renvoie `name` au lieu de `filename` ;
  - le GraphQL des ressources de projet est rangé dans la facturation, avec des mutations à plat qui renvoient des booléens.
- **Fixtures :** 6 paires d'aides recopiées entre fichiers ; restes `title` / `name` dans leurs paramètres.

### 4. Web

- **Référence d'une tâche :** `${taskRef(t)}${t.label}` ×13 et `taskRef(t).trim()` ×8. Proposition : `taskNumbered` et `taskNumber`.
- **Clés composées :** `${routineId}|${date}` ×4 avec un double `split`, `${sprintId}|${taskId}` ×3 (`routineLinkKey`, `sprintTaskKey`) ; `documentKey` défini deux fois avec deux sens dans la trésorerie.
- **Facturation :** `useAccountingMutation` ×3 ; les options de taux de TVA ×4 (`vatRateOptions`) ; `${Math.round(x)} %` ×5 au lieu de `fmt.percent` ; `/ 100` ×4 au lieu de `fromCents`.
- **Achats :** la conservation codée de trois façons, avec deux constantes `PERISHABLE` de valeurs différentes (`conservationKey`) ; les vues par défaut à une condition ×6 (`filterView`) ; les noms des relations ×3.
- **Listes en arbre :** l'entrée `{ label, color, parentId }` ×4 (`treeItemInput`).
- **Accueil :** le solde à 30 jours ×2, « tâche en retard » ×2.
- **Options sans `itemOptions` :** comptes dans les filtres des tableaux de bord, lieux dans le calcul de trajet (qui filtre aussi les archivés à la main) ; « Recettes / Dépenses » et « Entrées / Sorties » dans le même formulaire (voir décision BH).
- **Calques de l'agenda :** ils contournent `scheduleChoices` ; le suffixe d'espace s'écrit « X (type) », « type · espace » ou « X (espace) » (voir décision BG).
- **Briques contournées :**
  - `useAsyncAction` (export PDF, `LabelForm`, `SettingsItemForm`) ;
  - `SortableArea` (colonnes, onglets) ;
  - `FoldButton` (journée entière de l'agenda, et une rotation à la main dans la barre d'outils) ;
  - `FileBadge` (pièces de l'éditeur de facture et du suivi) ;
  - `confirmDestructive` (`run` / `done` réécrits) ;
  - `ClientSelect` ;
  - `archivedIds` (`archivedCalendarIds` ne fait que l'envelopper) ;
  - `descendantIds` (n'enveloppe que `subtreeOf`) ;
  - `longDayText` (`fmt.dayInWords` le redéfinit).
- **Boutons :**
  - la poignée de glissement sans infobulle ni `item` ×7 ;
  - les propriétés d'une icône d'action écrites dans `RowActions` et dans `InlineActions` ;
  - la flèche des boutons de menu ×5, avec `aria-haspopup` ajouté à la main (`MenuCaret`) ;
  - `IconAction` utilisé à l'envers (texte long dans `label`, action dans `aria-label`) ou avec le nom dans `aria-label` au lieu d'`item`, ~10 fois ;
  - ~40 `<Button leftSection>` pleins ou discrets hors `ActionButton`, et les petits boutons « Retirer » et « par défaut » en trois tailles et deux couleurs (voir décision BE).
- **Liens externes :** trois valeurs de `rel` pour le même rôle (~18). Proposition : `EXTERNAL_LINK`.
- **Libellés cachés des cellules :** ~25 cellules de la facturation, du stock, de la trésorerie, des achats et des fiches écrivent « Libellé de X » sans « » ni la mention de la sélection (voir décision BD) ; « Actions de X » sans guillemets dans les menus (voir décision BF).
- **Adresses :** `/accounting?tab=overdue` ×2, `/settings?tab=github`, `'/'` ×6, `'/login'` ×3, `'/forgot-password'` ×2 ; les routes du routeur répètent `PAGES`.
- **Restes du renommage `label` :**
  - identifiants de colonnes `'title'` / `'name'` (tâches, routines, facturation, fiches, achats, catalogue, documents, agenda) et l'ordre des jalons `'title'` (voir décision BI) ;
  - noms locaux : `promptName`, `onCreate(name)` dans les sélecteurs et `AddRowField`, `typeName`, `AgendaItem.title`, `StackedItem.title`, `AppPage.title`, `useLabelCreator(name)`, `ItemAvatar name=`, `title/setTitle`, `guessOption(name)`, JSDoc périmées.
- **Petits :**
  - `useSearchParam` partout ;
  - `tt="none"` sur des chiffres ;
  - `x ? x : null` ×5 ;
  - « Date de péremption » ou « Péremption » ;
  - des magasins triés à la main ;
  - `ErrorAlert` en `red` au lieu de la couleur d'erreur ;
  - des noms d'icônes de retour incohérents (`SuccessIcon`, `InfoFeedbackIcon`) ;
  - `cellPicker` perd la bordure au survol des autres cellules ;
  - des écarts entre boutons d'en-tête (`sm` ou `xs`).

### 5. Styles et rangement

- **CSS :** deux blocs `[data-disabled]` dans une même règle (`PageTabs.module.css`), deux couches `@layer app` dans `DataTable.module.css`, des opacités en dur (`0.6`, `0.4`, `0.35`), deux systèmes de points de rupture (Mantine `md` / `xl` dans les features, `tablet` / `desktop` dans la mise en page) ; le commentaire de `use-is-phone.ts` cite une variable qui n'existe pas.
- **Rangement :** `features/workspace` (projets, clients) et `features/workspaces` (espaces) ne diffèrent que d'une lettre (voir décision BJ) ; `lib/drag.ts` irait dans `components/dnd/` ; `capitalize` est rangé dans les dates.

## Règles eslint

### 6. Trous

- **Web :**
  - les filtres d'archivés écrits autrement (`!x.archived` à droite d'un `&&`, imbriqué, dans un `||`) ;
  - les boutons de pliage en `CaretUp` ;
  - les adresses `/accounting?`, `/settings?tab=`, `'/'`, `/login` ;
  - `${taskRef(x)}${x.label}` ;
  - une infobulle autour d'un bouton désactivé ;
  - « Archiver » dans une propriété `label:` ;
  - un pluriel passé par une aide locale ;
  - `relationNoun` contourné par un texte littéral ;
  - `<Button leftSection>` sans `variant="default"` ;
  - `Math.round(…) %` et `/ 100` ;
  - « Libellé de ${…} » écrit à la main ;
  - `IconAction` avec `label` et `aria-label` ;
  - `<Select>` de clients au lieu de `ClientSelect`.
- **API et partagé :**
  - `x.trim().slice(0, N)` ;
  - une comparaison `toLowerCase() ===` dont un seul côté est un appel ;
  - `10 * 1024 * 1024` et la création de pièce jointe sans `storeAttachment` ;
  - `toUpperCase() === 'INBOX'` ;
  - une forme d'`orNotFound` ;
  - le forçage de type simple du délégué Prisma ;
  - les messages « … est archivé » écrits à la main ;
  - les exceptions de la bibliothèque, qui oublient `graphql/modules/library.ts` et les fixtures.

## Plan proposé

1. **Bugs (1, 2).**
2. **Petits doublons (3, 4, 5).**
3. **Règles eslint (6).**

Estimation : environ 45 minutes à 1 heure pour les trois lots, plus pour les règles eslint si elles remontent beaucoup d'erreurs.

Décisions à prendre :

- **BA. Tri de secours :** après la position, trier par date de création (`BY_POSITION`) ou par libellé ?
- **BB. Nom d'une personne :** 100 ou 120 caractères au maximum ?
- **BC. Messages d'archivé :** garder les messages précis (« Ce projet est archivé. ») ou un seul message partout (« Élément archivé : restaurez-le pour le modifier. ») ?
- **BD. Libellés cachés des cellules (G) :** les appliquer à toutes les cellules modifiables en masse, ou seulement aux tâches et aux routines ?
- **BE. Petits boutons texte discrets** (« Retirer », « Valeurs par défaut », « Ajouter une ligne »…) : un `ActionButton priority="tertiary"` commun, ou les laisser ?
- **BF. Menus (W) :** « Actions de « X » » avec guillemets, comme les autres libellés cachés ?
- **BG. Suffixe d'espace des calques :** « · Espace » ou « (Espace) » ?
- **BH. Sens d'un mouvement :** « Recettes / Dépenses » ou « Entrées / Sorties » ?
- **BI. Identifiants de colonnes `title` / `name` :** les renommer en `label` avec une migration des vues enregistrées, ou les garder ?
- **BJ. Dossier `features/workspace` :** le renommer `features/projects`, pour ne plus le confondre avec `features/workspaces` ?

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

- **Y. Chrono déjà en cours :** démarrer un chrono arrête l'ancien (son temps est enregistré) et en démarre un nouveau, en le disant, partout.
- **Z. Drapeaux mail :** 50 caractères, comme les autres libellés.
- **AA. Valeur archivée choisie :** erreur sous le champ, partout.
- **AB. Boutons de l'en-tête d'un document :** `ActionButton` sans couleur, comme ailleurs.
- **AC. Données en JSON** (sources des fiches, jeux de données et comparaisons des graphiques, instantané de prestation) : renommées en `label`, avec une migration des données.
- **AD. Mot affiché :** « Libellé » pour tout `label` ; « Nom » seulement pour les personnes, physiques ou morales (contributeurs, relations, contacts, clients, tiers, entreprise).
- **AE. Pliage :** « Développer / Réduire » partout.
- **AF. Retard d'un sprint ou d'un jalon :** badge rouge.
- **AG. Badges :** en capitales (défaut de Mantine) ; les `tt="none"` disparaissent.
- **AH. Archivés dans les tableaux :** l'interrupteur partout ; le catalogue perd sa colonne et ses vues « Actifs / Archivés », les routines leur colonne « Oui ».
- **AI. Retard sur l'accueil :** orange.

## Restent à part

- **Menu des lieux enregistrés** (`AddressInput.tsx:134`) : un arbre avec coches, trop particulier pour `ActionsMenu`.
- **Logo de l'entreprise :** il s'enregistre tout de suite et n'accepte que PNG ou JPEG, pour les PDF.
- **Mise en page des tableaux PDF (`tableWriter`) :** pas touchée sans essai visuel.

## Déjà unifié

- **Série du 18 novembre 2026 (soirée) :** décisions Y à AI ; `useStartTimer` (remplace le chrono en cours), `assertNotArchived` / `assertNoneArchived` avec `field`, `freeHandle`, `attachmentUrl`, maximums de libellés exportés, `countWith`, `FoldButton`, `LateBadge`, `planCardActions`, `LabelForm`, JSON en `label`, `scheduleLabel`, adresses (`documentPath`, `sheetPath`…), `useUrlTab`, `archivedIds`, `taskShortRef`, `sumOf`, `movedTo`, `quarterOf`, `components/dnd/`, eslint dans l'API et le code partagé.
- **Série du 18 novembre 2026 (fin de journée) :** points 1 à 14 et décisions O à X : `queryFlag`, `usePageTab`, `clipText`, `productKey`, `sameName`, `nextPositionIn` en transaction, `dates/days.ts`, `endAfter`, `productInputFields`, `reloaded`, pluriels et nombres partagés ; `ON_ERROR`, `unarchived`, `useArchivedToggle`, `DestructiveRisks`, `IconAction`, `CreatableSelect` dans la trésorerie et le stock, adresses (`projectPath`…), `date-range`, `DetailHeader`, « Archiver » dans les menus, `TimerStop`, `deleteItemsAction`, menus à points verticaux, `--onoko-muted-opacity`, ordinaux partagés, `Caption`, `NameForm` ; renommage `label` en base ; `jscpd` (65 → 4 copies).
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
