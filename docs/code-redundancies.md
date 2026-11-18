# Composants similaires et redondances de code

État au 18 novembre 2026 au soir, après six séries d'unifications (voir [Déjà unifié](#déjà-unifié)). Copier-coller (`npm run dup`) : 4 copies, 35 lignes (0,03 %). Les décisions déjà prises sont en [annexe](#décisions-déjà-prises).

Il ne reste plus de doublon lourd. Restent des détails :

- **Bugs :** une quinzaine, petits (pluriels, coupes de texte, identifiants générés, liens de pièces jointes, règles du chrono).
- **Restes des décisions :** quelques libellés cachés, menus et boutons de pliage qui ne suivent pas encore T, W et 11 ; des restes du renommage `label`.
- **Petits doublons :** adresses de l'app, boutons de pliage, onglets dans l'URL, ensembles d'archivés, sommes, aides de dates.
- **Règles eslint :** des trous (motifs écrits autrement), et toujours rien pour l'API et le code partagé.

La bibliothèque de documents n'est pas traitée : elle sera refaite entièrement.

## Bugs

### 1. Web

- **Pluriels faux sur une seule ligne :** « 1 élément seront retirés », « ses 1 élément seront supprimés » (`SheetPage.tsx:314`, `ChecklistPanel.tsx:164`, `ShoppingListPage.tsx:321`, `BaseList.tsx:274`, `ListActions.tsx:153`, `DashboardBoard.tsx:361`, `TaskDialogs.tsx:139`).
- **Libellé caché en anglais :** « Label de … » (`ShoppingTable.tsx:157`), reste du renommage.
- **Chrono d'un évènement :** ses tâches suivent la règle « même projet racine » (`EventForm.tsx:164-166`) au lieu de celle de l'API (le projet, ses sous-projets et les tâches sans projet) : une tâche proposée peut être refusée. Correction : `timeTasks(context, projectId)`.
- **Démarrer un chrono quand un autre tourne :** remplacé (`TimerToggle`, `TaskTime`), bloqué (`TimeLogActions.tsx:32-35`) ou sans avertissement (`EventForm.tsx:516`). Voir décision Y.
- **Texte d'une alarme :** coupé à 120 caractères alors que le schéma en accepte 200 (`TaskAlarms.tsx:24`).
- **« Plages de travail » écrit en dur** (`PlannedTime.tsx:97`), faux en perso.
- **Clic sur la carte sans adresse trouvée :** silencieux dans un évènement (`EventLocation.tsx:27`), une notification et les coordonnées dans les lieux (`PlacesManager.tsx:45-49`).
- **Règlement d'un document importé :** son libellé est reconstruit en retirant « (reste …) » du texte affiché (`EntryForm.tsx:345`). Correction : garder le libellé dans l'option.
- **Divers :** `deleteRowsAction([rows], …)` détourné dans `SheetPage.tsx:311` (`removeAll` existe) ; `bulk: true` mort sur la colonne « Archivé » du catalogue ; `QuantityInput` sans séparateur des milliers (« 1000 » saisi, « 1 000 » affiché).

### 2. API

- **Membre d'équipe ajouté par son nom :** l'identifiant généré (`treasury-team.ts:47-57`) garde `_` et coupe à 30 caractères sans vérifier ses règles : « A » ou « Tom_ » échouent, sur un champ que tu n'as pas saisi ; le nom est coupé à 100 au lieu de 120. La même boucle est dans `workspaces.ts:113-116`, et les deux ignorent `suggestHandle` (partagé). Proposition : un seul `freeHandle`.
- **Liens de pièces jointes :** construits à la main 9 fois, avec deux encodages (seul `tasks.ts:51` échappe les parenthèses, nécessaires dans le markdown, et le mail stocke son HTML sans) et trois noms de repli. Proposition : `attachmentUrl({ id, filename })`.
- **Coupes en dur :** sprint GitHub (120), entrée d'une liste (100, morte), relevé (300), `copyName` avec des nombres écrits en dur (et sans maximum dans trois formulaires web : une copie d'un libellé au maximum échoue). Proposition : les maximums exportés à côté de `TASK_LABEL_MAX`.
- **Petits :** la politique de sécurité du PDF écrite en dur (`routes/accounting.ts:24`, `fileSecurityPolicy` existe) ; `${title}.pdf` au lieu de `fileName` (`accounting-pdf.ts:1151`) ; un commentaire périmé sur l'unicité des drapeaux mail, plafonnés à 40 caractères au lieu de 50 (voir décision Z).
- **Valeur archivée choisie :** erreur sous le champ pour les contributeurs et les relations, notification pour tout le reste. Voir décision AA.

## Restes des décisions

### 3. Libellés, menus, boutons (décisions T, W, 11)

- **Libellés cachés au mauvais format** (« Libellé : nom ») : l'icône principale de `RowActions.tsx:30` (qui perd aussi l'aide et la couleur rouge de « danger »), `FileBadge.tsx:51` (ignore `removeLabel`), l'infobulle « Fermer : titre » (`SettingsButton.tsx:15`).
- **Menus :** « Actions de … » réécrit dans `SortableTabs.tsx:97` ; « Actions sur la sélection » dans `SelectionBar.tsx:35`.
- **Boutons texte sans `ActionButton` :** ~45 `<Button variant="default" leftSection>` (dont ~10 dans l'en-tête d'un document de facturation, deux en orange et en violet). Voir décision AB.
- **Icônes sans infobulle :** `SortPanel.tsx:59, 62`, `OrderPanel.tsx:197`, `tasks/extra-cells.tsx:162`, les boutons de pliage ; `Tooltip > Indicator > ActionIcon` dans `treasury/LinesEditor.tsx:253`.
- **Ajouter dans le panneau d'une tâche :** « Nouvelle alarme » en `ActionButton` dans l'en-tête de section, sous-tâches en `AddItemButton`.
- **Chrono :** « Démarrer un chrono », « Démarrer », « Démarrer le chrono » (décision 9) ; deux formulations de « celui en cours s'arrête » ; `TimerIcon` ou `PlayIcon`.
- **Boutons « retirer » :** « Retirer » ou « Retirer le/la … », et la documentation de `RemoveButton` donne un exemple contraire à la décision W.

### 4. Renommage `label` (décision O)

- **Type de plage par défaut :** `DefaultScheduleKind.name`, `Workspace.scheduleName`, `DEFAULT_SCHEDULE_KIND_NAME`, `PlannedPause.scheduleName` ; `kindLabel` ne sert qu'à faire le pont. Proposition : `label` / `scheduleLabel` (migration).
- **Recherche de lieux :** les résultats renvoient `{ label: adresse, name: nom du lieu }`, l'inverse de `Place { label, address }`. Proposition : `{ address, label }`.
- **Données en JSON :** `SheetSource.name`, les jeux de données et comparaisons des graphiques, l'instantané de prestation. Voir décision AC.
- **GraphQL :** `fileName` / `signedFileName` alors que le modèle dit `filename`.
- **Noms locaux :** `dashboardName`, `workspaceName`, `projectName`, `categoryName`, `scheduleName`, `name/setName` (espaces, factures récurrentes), `title/setTitle` (ressources), `NameForm` (champ `name`), `namePlaceholder`, `archiveEntry({ name })`, `TreeOption.name`, `FileBadge.name`, `openFile` / `FileLink` / `FilePreview` (`name`), `scheduleLayerName(name…)`, `HomeRow.title`, `EVENT_TITLES` et les paramètres des fixtures, le champ `title` du PDF d'agenda, `const label = name` dans la trésorerie partagée.
- **Formulaires sans schéma :** ressources de projet et factures récurrentes sont en `useState`, sans zod ; la longueur des espaces (60) est écrite en dur dans le web.
- **Mots affichés :** « Nom », « Libellé » ou « Titre » pour le même champ `label` ; « Nom de » ou « Libellé de » dans les libellés cachés ; les messages de `requiredText` disent « titre », « nom » ou « libellé ». Voir décision AD.

## Petits doublons

### 5. API et partagé

- **Archivés à ne pas choisir :** ~20 contrôles « les nouvelles valeurs ne sont pas archivées » écrits à la main. Proposition : `assertNotArchived(target, id, { keep, field })` et `assertNoneArchived(target, ids, { keep, field })`, le pendant de `unarchived(items, keep)` côté web.
- **Schéma nom + couleur :** `labelFormSchema` recopié 3 fois (`LABEL_SCHEMA`, statuts de document ×2, magasins et son alias rangements).
- **Lieu et trajet en GraphQL :** champs de sortie, d'entrée et passage à `null` recopiés dans l'agenda et les routines, avec trois descriptions du trajet retour. Proposition : `located-fields.ts`.
- **Totaux des documents :** `totalNet/Vat/Gross` 2 fois.
- **Comparaison de noms :** `foldLabel` (synchro GitHub) recopie `sameName`, et deux `toLowerCase() ===`.
- **Dates :**
  - un `day` local et trois `?.slice(0, 10)` dans la synchro ;
  - `formatOptionalDay` contourné (`stock.ts:314`) ;
  - `toISOString().slice(0, 10)` (`builder.ts:51`, `periods.ts:22`) ;
  - `item.start.slice(0, 10)` ×11 dans le PDF d'agenda ;
  - `monthOfDay(formatDay(date))` ×5 (proposition : `monthOfDate`) ;
  - `Number(day.slice(5, 7))` ×8 (proposition : `monthOfYear`) ;
  - `shiftMonth` en double ;
  - un `DAY` local ;
  - `DeductibleDeposit.issueDate` en texte au lieu du scalaire `Date`.
- **Divers :**
  - `.toNumber()` au lieu de `fromDecimal` (2) ;
  - le forçage de type du délégué Prisma ×7 (proposition : `modelDelegate`) ;
  - les libellés des statuts de document par défaut répètent `STATUS_CATEGORIES_BY_SCOPE` (et une branche de repli inatteignable) ;
  - le contexte de `downloadRoute`, parfois un nom, parfois une phrase ;
  - la chaîne de cache « immuable » ×2 ;
  - « en ligne sauf `?download` » ×2 ;
  - `filename` ou `name` selon le service qui produit un fichier ;
  - deux `requireSession` ;
  - la description « Archived: … » ×2 ;
  - trois enveloppes de `nextPositionIn`.
- **Fixtures :** `rule` ×3, `day` ×4 (qui masque `factories.day`), deux aides de jour locales, `clock`, le fuseau reconstruit, `86_400_000` ×3, `slice(0, 7)`, `#868e96`. Proposition : tout dans `factories.ts`.

### 6. Web

- **Adresses de l'app :** `/accounting/${id}` ×13, `/accounting/imported/` ×2, `/sheets/${id}` ×7, `/shopping/${id}` ×5, `/shopping?tab=lists` ×2, `/time?task=`, `/routines?tab=history&routine=`, `'/calendar'`, `'/routines'` ; `DetailHeader.back` écrit en dur. Propositions : `documentPath`, `sheetPath`, `shoppingListPath`, `timePath`, `routineHistoryPath`, `PAGES.x.path` ; `settingsPath` à ranger avec les autres dans `app/pages.ts`.
- **Boutons de pliage :** 6 copies (3 changent d'icône au lieu de tourner, comme `FoldChevron`), et l'espace vide des lignes sans enfant écrit de 5 façons. Proposition : `FoldButton` et `FoldSpacer`. Voir décision AE.
- **Onglet dans l'URL :** trois hooks (`usePageTab`, `useSettingsTab`, `useTabParam`), dont l'un garde le paramètre par défaut dans l'URL et un autre ne vérifie pas l'onglet. Proposition : `useUrlTab(param, tabs, fallback)`. Les redirections d'anciens onglets sont écrites deux fois.
- **Archivés :** `new Set(x.filter((i) => i.archived).map((i) => i.id))` ×8 (`archivedIds`) ; « (archivé) » ajouté à la main 2 fois (`archivedLabel`) ; `!x.archived && …` et `.find` / `.some(!x.archived)` hors règle.
- **Projets :** `descendantIds` puis ajout du projet à la main ×6, au lieu de `subtreeOf(projects, id)`.
- **Agenda :** les choix de plage recalculent `scheduleSources` (avec un vert par défaut qui diffère) ; l'aspect d'une barre de plage ×3 (`slotBarLook`), que l'agenda des routines applique sans les réglages d'affichage ni les hachures des plages abonnées.
- **Tâches :** la référence courte « #12 » / « Projet #12 » ×4 et `taskRef` recopié (`taskShortRef`) ; `cellCombobox` et `cellField` redéfinis localement avec `stopClick` ; `fieldLabel` (tâches, avec « ») et `routineCellLabel` (routines, sans).
- **Cartes de plan :** sprints et jalons répètent leurs actions et leur description ; le retard s'affiche en badge rouge ou en texte ; un sprint renvoie tous ses champs, un jalon seulement le modifié. Voir décision AF.
- **Accueil :** « N j de retard » ×3 (rouge, orange, texte) ; le sablier « En attente de … » ×2.
- **Formulaires et listes :**
  - `useSearchParam('token')` contourné (connexion) ;
  - l'aperçu PDF de la facturation redessine celui de `openFile` sans sa barre ;
  - deux chargeurs plein écran (`100dvh`, `100vh`) ;
  - la hauteur d'aperçu ×2 ;
  - les codes de clés de la trésorerie (`doc:`, `imp:`) écrits à la main ;
  - « N mails déplacés » ×2 ;
  - `fmt.number(q, 3)` ×10 au lieu de `fmt.quantity` ;
  - ~36 `reduce((sum, x) => sum + …, 0)` (`sumOf`) ;
  - `fold` (GitHub) recopie `sameName` ;
  - l'option avec avatar ×2 (`OptionRow`) ;
  - « X (moi) » construit 2 fois.
- **Code partagé contourné :** `applyDiff` refait `changedList` ; `moveToIndex` (dans `lib/mutation.ts`) refait `moveInOrder` de l'API (proposition : `movedTo` partagé) ; le trimestre calculé 3 fois (`quarterOf`) ; `monthOfDay` / `yearOfDay` importés par deux chemins ; `formatLongDate` n'enveloppe que `fmt.dayInWords`.
- **Mêmes noms, sens différents :** `stateOf` ×3, `describeTiming` ×2, `repetitionOf` ×3, `eventKey` ×2.
- **Composant en double :** `DataTableHeader` (201 lignes) ne sert qu'à la bibliothèque et recopie l'en-tête de `DataTable` : à déplacer dans la bibliothèque ou à supprimer avec elle. `confirmDestructive` ouvre ses fenêtres sans `openModal`.

### 7. Styles et rangement

- **CSS :** la règle de survol d'`EditableCells.module.css` recopie `styles/reveal.css` ; deux règles identiques dans `DataTable.module.css` ; transitions à 120 ms ou 150 ms (proposition : `--onoko-transition`) ; `28.999em` et `67.5em` en dur ; `PHONE_QUERY` répète le point de rupture ; l'opacité en dur des mails « en attente ».
- **Badges :** 24 avec `tt="none"`, ~66 en capitales (« Clôturée » à côté de « ARCHIVÉE »). Voir décision AG.
- **Archivés dans les tableaux :** le catalogue a sa colonne et ses vues « Actifs / Archivés », les routines « Oui / vide », le reste l'interrupteur. Voir décision AH.
- **Événement de carte :** l'adresse d'un clic sur la carte, voir le bug du point 1.
- **Rangement :** `UpdatePrompt`, `WeekDatesProvider` et `VisibilityToggleIcon` ne servent qu'à la racine de l'app (vers `app/`) ; le glisser-déposer (`DragHandle`, `sortable`…) vers `components/dnd/` ; `SortableTabs` refait `sortableStyle` ; un import au milieu de `tree-select.tsx`.
- **Code mort :** `categorySubtree` ; ~15 exports qui ne servent que dans leur fichier (`contentWidth`, `treeCollision`, `PAGE_TAB_PARAM`, les types de `date-range.ts`, `ReminderPreset`…) ; `subtreeIds` (web) n'enveloppe que `subtreeOf`.
- **Pages de détail :** l'en-tête du client et du projet (`EntityHeader`) reste à part de `DetailHeader` : exception à noter ou conversion.

## Règles eslint

### 8. Trous et API

- **Web, motifs qui passent :** `Tooltip` autour d'une variable ou d'un `Indicator` ; icône sans infobulle ; `!x.archived && …`, `.find` / `.some` ; `tt` conditionnel ; `slice(0, 4)` sur un nom qui ne finit pas par « date » ou « day » ; les adresses `/accounting/`, `/sheets/`, `/shopping/`, `/time?`, `/routines?` ; « countOf(…) seront » ; les pluriels ternaires autres que `'s'` ; `label.slice(0, N)` (`clipText`) ; `descendantIds(...).add(id)` ; le badge de retard ; les boutons de pliage `CaretRight` / `CaretDown` ; `<Button variant="default" leftSection>` ; « Plages de travail » en texte simple.
- **Exceptions trop larges :** `'no-restricted-imports': 'off'` sur `BatchMultiSelect`, `ColorField` et `lib/format.ts` retire aussi l'interdiction d'importer une feature.
- **API et partagé :** toujours aucune configuration eslint ; aucune de leurs briques n'est protégée (`orNotFound`, `reloaded`, `fileName`, `clipText`, `parseOptionalDay`, `sameName`, `queryFlag`…). Proposition : une configuration minimale reprenant les règles du web qui s'appliquent (dates, comparaisons, couleurs, formats).

## Plan proposé

1. **Bugs (1, 2).**
2. **Restes des décisions (3, 4)**, avec les décisions ci-dessous.
3. **Petits doublons (5, 6, 7).**
4. **Règles eslint (8)**, dont une configuration pour l'API et le code partagé.

Décisions (18 novembre 2026, soir) :

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

## Restent à part

- **Menu des lieux enregistrés** (`AddressInput.tsx:134`) : un arbre avec coches, trop particulier pour `ActionsMenu`.
- **Logo de l'entreprise :** il s'enregistre tout de suite et n'accepte que PNG ou JPEG, pour les PDF.
- **Mise en page des tableaux PDF (`tableWriter`) :** pas touchée sans essai visuel.

## Déjà unifié

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
