# Composants similaires et redondances de code

État au 19 novembre 2026, matin, après neuf séries d'unifications (voir [Déjà unifié](#déjà-unifié)). Copier-coller (`npm run dup`) : 4 copies. Les décisions déjà prises sont en [annexe](#décisions-déjà-prises).

La série du 19 novembre (lots 1 à 4 ci-dessous) est faite : les points 1 à 6 de cette page sont traités. Décisions de suivi :

- **CN, CO, CP :** tranchées et appliquées (lot 5 : `ActionButton` primary plein, secondary clair, danger plein rouge ; bascules en `StateSwitch`). Voir l'annexe.

La bibliothèque de documents n'est pas traitée : elle sera refaite entièrement.

## Bugs

### 1. Web

- **Échap dans une cellule :** il enregistre probablement la saisie au lieu de l'annuler (`cell-field.ts:52-57` : l'annulation est appliquée trop tard, le `blur` enregistre l'ancien brouillon). Touche `EditableText` et `EditableNumber`. À vérifier dans le navigateur.
- **Temps d'une routine dans l'agenda :** affiché « Projet » (`CalendarPage.tsx:286-307`) ; le nom d'un temps est construit de trois façons (agenda, `TimerWidget`, `TimerCard`). Proposition : `entrySubject(entry, context)`.
- **Pluriels et accords :** « 1 tâches aujourd'hui », « 1 évènements aujourd'hui » (`NavBadges.tsx:29, 42`), « 0 sur 1 sous-tâches fermées » (`extra-cells.tsx:103`), « 1 temps seront supprimés » (`TimeLog.tsx:249`), « tâches et leurs commentaires seront supprimées » (`TaskDialogs.tsx:60`), « Le facture est créé » (`NewDocumentForm.tsx:75`).
- **Menu d'un document :** son numéro est entre guillemets deux fois (« Actions de « « F-2026-001 » » », `DocumentEditor.tsx:343, 381`).
- **« Relations » en perso :** `ShoppingForm.tsx:171` (décision 15).
- **Évènements annulés sur l'accueil :** la carte Agenda et le badge de navigation les montrent et les comptent sans les marquer (voir décision CA).
- **Infobulle du chrono :** affichée sur un bouton désactivé (`TimerToggle.tsx:34`) ; construite de quatre façons. Proposition : `useStartTimer().hint(disabled)`.
- **Compte mail inconnu dans l'URL :** gardé au lieu de revenir au premier compte actif (`MailPage.tsx:62`).
- **Clients des tableaux de bord :** options sans avatar (`source-filters.tsx:47-50`).
- **Menu d'un bouton à libellé JSX :** « [object Object] » possible (`ActionButton.tsx:68, 88, 90`).
- **Code mort :** trois propriétés `about` jamais lues (`TrackingBadge.tsx:42`, `MailOrganizeActions.tsx:70, 109`) ; un test d'archivé toujours faux (`RoutineDayAgenda.tsx:207`) ; des JSDoc orphelines (`TreasuryPage.tsx:69-73`, `home-data.ts:28`, `routine-view.ts:47-48`).
- **Message eslint :** la règle `doc:` / `imp:` renvoie vers un `documentKey` qui n'existe pas dans `EntryForm.tsx`.

### 2. API et partagé

- **Document importé :** si la suppression de l'ancien fichier échoue, le nouveau est supprimé aussi et le document reste sans fichier (`imported-documents.ts:83-88`).
- **« 1er » dans le PDF de trésorerie :** `longDayText` (partagé) écrit encore « 1 juin » (décision V) ; le « 1er » n'est ajouté que côté web.
- **Suppressions de pièces jointes :** six appels ignorent un fichier manquant, quatre non. Proposition : `deleteAttachment(id)`.
- **Petits :** `isInvoice` contourné (`document-tracking.ts:243`), `orNotFound` contourné (`calendar-ics.ts:260-261`), les noms des fichiers PDF des exports construits dans la route ; deux commentaires de schéma périmés (`schema.prisma:2677, 3024`).

## Petits doublons

### 3. API et partagé

- **Chercher sinon introuvable :** 19 fonctions `findX` qui enveloppent `orNotFound`, souvent avec une variable inutile. Proposition : `findOrNotFound(model, id, what, args?)`.
- **Existe puis non archivé :** `assertExists` puis `assertNotArchived` ×~22, `orNotFound` puis `assertNotArchived` ×26, la même séquence sur une liste ×4 ; `if (x.archivedAt) throw … ARCHIVED_MESSAGE` sur une ligne déjà chargée ×11. Propositions : `assertActive`, `activeIds`, `refuseArchived`.
- **Archivage en cascade :** écrit deux fois (tâches, projets), avec le même retour anticipé ×3. Proposition : `cascadeArchive`.
- **Arbres :** `ProjectTree` refait `ancestorsOf` / `subtreeOf`, l'archivage d'une tâche remonte les parents une requête par niveau, `descendantIds` n'enveloppe que `subtreeIds`.
- **JSON :** ~24 forçages de type à l'écriture (`toJson`).
- **Comparaison de noms :** `labelKey` et `productKey` recopient `sameName`, et `productKey` réduit aussi les espaces (voir décision CB).
- **Divers :** `missing()` n'enveloppe que `notFound` ; `padStart(2, '0')` à la main ; le GraphQL des ressources de projet toujours dans la facturation ; dans les fixtures, les catégories de trésorerie ×2, des catégories d'agenda créées en direct, `projectOf` et `rootOf`.
- **Vues enregistrées :** la migration a déjà renommé leurs identifiants ; la correspondance à la lecture (`LEGACY_LABEL_COLUMNS`, ~60 lignes) ne sert plus, mais reste en place jusqu'à la mise en production (décision CC).

### 4. Web

- **Document :** le nom d'un brouillon s'écrit « Brouillon », « (brouillon) », « ce brouillon », ou laisse une espace en fin de titre et de nom de fichier. Proposition : `documentName`, `documentTitle` (voir décision CD).
- **Compte mail :** affiché de quatre façons (`addressLabel` contourné, « libellé (adresse) », l'adresse seule). Proposition : `accountLabel` (voir décision CE).
- **Retard :** rouge plein dans le suivi, rouge clair dans la trésorerie, orange sur l'accueil (voir décision CF).
- **Boutons destructifs :** trois apparences rouges (`ActionButton danger`, `DestructiveButton`, la confirmation pleine). Proposition : `danger` sur toutes les priorités (voir décision CG).
- **En-têtes repliables :** 6 boutons faits à la main (barre d'outils, cas de répétition, barre latérale, mode courses ×2, répartition d'une écriture), « lots (n) » dans le stock. Proposition : `FoldHeading` (voir décision CH).
- **Compteurs de groupe :** hors `CountBadge`, en trois tailles (voir décision CI).
- **Sélecteurs avec avatar :** `Select` + `listSelectProps` + avatar de l'élément courant ×5, le même couple en sélection multiple ×2. Proposition : `ItemSelect`.
- **Temps :** les options de tâches d'un temps de trois façons (arbre, liste plate, chemin), « (fermée) » écrit 4 fois. Proposition : `timeTaskOptions`.
- **Divers :**
  - `useInvalidatingMutation` contourné (espaces, contributeurs de la trésorerie) ;
  - le champ nombre facultatif ×4 (`optionalNumberProps`) ;
  - l'unité vide `''` ou `null` selon le formulaire produit ;
  - les types de client ×2 ;
  - le type de mouvement du stock réécrit, avec d'autres libellés ;
  - les erreurs de connexion hors `formCallbacks` ;
  - `{ remove }` ×4 ;
  - la colonne commentaires des routines refait `commentColumn`, avec une autre apparence (voir décision CJ) ;
  - le diff des bénéficiaires ×3 ;
  - les liens d'alarme ×2 ;
  - `SignedAmount` contourné (sarcelle au lieu de vert) ;
  - « dans 30 jours » ×2 ;
  - la valeur « vide en dernier » de 5 façons ;
  - une clé `${workspaceId}|${typeId}` au lieu de `foreignSlotKind` ;
  - deux formats de clé d'occurrence (`id:date` côté API, `id|date` côté web) ;
  - le renommage en ligne refait dans le panneau d'une tâche et l'éditeur de graphique (voir décision CK) ;
  - quelques aides d'une ligne.
- **Libellés cachés sans guillemets :** « Redimensionner la colonne X », « Total de X », « Sélectionner X », « la répartition de X » ; « la fiche « … » » en `about` au lieu de `name`.
- **Routes :** `'projects/:id'` et `'clients/:id'` écrits 4 fois ; `taskPath` n'utilise pas `PAGES.tasks.path`.
- **Panneaux :** le voile des réglages en dur (`0.35`, `#000`) et un en-tête en h4 au lieu de celui du panneau latéral (voir décision CL).
- **En-tête du tableau :** `DataTableHeader` (bibliothèque) recopie celui de `DataTable` (à supprimer avec la refonte de la bibliothèque).
- **Survol des cellules :** la section droite refait `styles/reveal.css`.

### 5. Restes du renommage `label`

- `TitleCell` ×2, `EditableTitle`, `titleDraft` / `saveTitle`, `NEW_CHART_TITLES`, `AgendaItem.title`, `StackedItem.title` (une infobulle : `hint`), `AppPage.title` et `PAGES`, `AddRowField` (`onCreate(name)`), `deleteItemsAction({ name })`, `SheetsSection name`, `TimeBillingForm title`, des `label: name` à la déstructuration, `extendedProps.name`, des JSDoc périmées.
- Un `projectPath` local qui masque celui d'`app/pages.ts`.
- **Noms prêtant à confusion :** `features/projects/api` exporte encore `Workspace`, `useWorkspace`, `workspaceQueryKey` pour l'arbre des projets, à côté du `Workspace` des espaces ; deux `LinesEditor`, `newLine`, `KIND_LABELS`, `MOVED_TABS`, `toValues` (voir décision CM).

## Règles eslint

### 6. Trous

- **Web :** un nombre juste avant un nom au pluriel sans `plural` ; `${n} ${plural(n, nom)}` au lieu de `countOf` (y compris dans le JSX) ; `<Button variant="light" leftSection>` et `variant={cond ? … : …}` ; un texte « Réduire / Développer » écrit à la main ; `FoldChevron` dans un bouton ; un `name` dans un objet `menu={{ … }}` ou déjà entre guillemets ; un filtre d'archivés passé à une aide plutôt qu'à `.filter` ; un `Badge` avec un compte seul ; les `aria-label` sans guillemets hors `IconAction` ; les routes `'projects/:id'` ; les clés `${a}|${b}` autres que routines et sprints.
- **API :** `if (id && !x)` après une recherche (`orNotFound`) ; `normalize(x.trim())` ; un test de facture écrit à la main ; `if (x.archivedAt) throw …` ; `prisma.attachment.delete` hors aide.

## Plan proposé

1. **Bugs (1, 2).** Environ 30 minutes.
2. **Petits doublons et restes du renommage (3, 4, 5)**, avec les décisions. Environ 45 à 60 minutes.
3. **Règles eslint (6).** Environ 20 à 40 minutes.

Toutes les décisions de ce round sont prises (CA à CM, voir plus bas).

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

- **BA. Tri de secours :** après la position, par libellé (`BY_POSITION` devient position puis libellé, partout).
- **BB. Nom d'une personne :** 100 caractères au maximum, un seul schéma.
- **BC. Messages d'archivé :** un seul message partout, « Élément archivé : restaurez-le pour le modifier. » (`ARCHIVED_MESSAGE`), en erreur sous le champ.
- **BD. Libellés cachés des cellules :** la forme commune (`itemCellLabel`, « (appliqué aux N cellules sélectionnées) ») sur toutes les cellules modifiables, partout.
- **BE. Petits boutons texte discrets :** un `ActionButton priority="tertiary"` commun.
- **BF. Menus :** « Actions de « X » » avec guillemets.
- **BG. Calques :** suffixe « · Espace ».
- **BH. Sens d'un mouvement :** « Entrées / Sorties » partout.
- **BI. Identifiants de colonnes :** `title` / `name` renommés `label`, avec une migration des vues enregistrées.
- **BJ. Dossier :** `features/workspace` renommé `features/projects`.
- **CA. Évènements annulés sur l'accueil :** masqués (carte Agenda et badge de navigation), et non comptés.
- **CB. Comparaison de noms :** les espaces intérieurs en trop sont réduits partout, en plus de la casse et des espaces au début et à la fin ; une seule règle commune (`sameName`), reprise par `labelKey` et `productKey`.
- **CC. Anciens identifiants de colonnes :** la correspondance à la lecture (`LEGACY_LABEL_COLUMNS`) est gardée pour l'instant ; à supprimer une fois la migration `label_column_ids` passée en production.
- **CD. Brouillon de document :** « Brouillon », sans parenthèses ni espace en fin de titre et de nom de fichier.
- **CE. Compte mail :** « Nom <adresse> » partout (`accountLabel`).
- **CF. Retard dans la facturation et la trésorerie :** orange, comme l'accueil.
- **CG. Bouton destructif secondaire :** ~~contour rouge~~ remplacé par CN : `primary` rouge.
- **CH. En-têtes repliables :** toute la ligne est cliquable, partout (`FoldHeading`), groupes de tableau compris.
- **CI. Compteurs de groupe :** taille `xs`.
- **CJ. Colonne commentaires :** avec l'icône, comme les tâches.
- **CK. Renommage en ligne :** supprimé ; le titre du panneau de tâche et celui d'un graphique se renomment comme ailleurs, par `LabelForm` dans le panneau latéral.
- **CL. En-tête des panneaux :** celui du panneau latéral partout, réglages compris ; le voile des réglages est tiré des tokens de couleur (plus de `#000` ni d'opacité en dur).
- **CM. Arbre des projets :** `Workspace` / `useWorkspace` renommés `ProjectTree` / `useProjectTree`, et les doublons de noms (`LinesEditor`…) renommés.
- **CN. Aspect des boutons :** variante `primary` (plein) seulement pour ajouter un élément, valider une action ou soumettre un formulaire ; tous les autres boutons en `light` ; les petits boutons discrets (`xs`, « + Ajouter une ligne ») restent sans fond. Un bouton destructif (Supprimer…) est `primary` rouge, ni clair ni contour (remplace CG). Les bascules (`aria-pressed`) ne sont pas des boutons : ce sont des interrupteurs (`Switch`, ou choix segmenté pour un mode).
- **CO. Colonnes de comptage :** 0 n'est pas vide ; elles n'ont pas « est vide ».
- **CP. Colonnes incertaines :** restent facultatives. La colonne « Temps » de la facturation du temps montre les tâches et la description d'un temps : un temps peut n'avoir ni l'un ni l'autre, donc elle peut être vide.

## Restent à part

- **Menu des lieux enregistrés** (`AddressInput.tsx:134`) : un arbre avec coches, trop particulier pour `ActionsMenu`.
- **Logo de l'entreprise :** il s'enregistre tout de suite et n'accepte que PNG ou JPEG, pour les PDF.
- **Mise en page des tableaux PDF (`tableWriter`) :** pas touchée sans essai visuel.

## Déjà unifié

- **Série du 19 novembre 2026 (matin) :** décisions CA à CM ; Échap annule dans les cellules (`useCellDraft`), `entrySubject`, `useHeldEvents`, `useTimerHint`, `clientItems`, `deleteAttachment`, « 1er » partagé, `startReport` nomme ses fichiers ; `findOrNotFound`, `assertActive` / `activeIds` / `refuseArchived` / `cascadeArchive`, `toJson`, `nameKey` ; `documentName` / `documentTitle` partagés, `accountLabel`, `LATE_COLOR`, `ActionButton danger`, `FoldHeading`, `itemSelectProps`, `timeTaskOptions`, `useInvalidatingMutation`, `occurrenceKey`, `joinedKey`, `PanelTitle`, `--onoko-overlay-color`, `CommentCount` dans toutes les colonnes commentaires ; restes du renommage `label`, `ProjectTree` ; trous eslint fermés ; filtres « est vide / n'est pas vide » sur tous les champs facultatifs (`DataColumn.required`, `EMPTY_LABELS`).
- **Série du 18 novembre 2026 (nuit) :** décisions BA à BJ ; un seul message d'archivé ; création à la volée des catégories et statuts de projet ; `relationWords`, `dayOfMonthText`, `storeAttachment` partout, `labelKey`, `ActionTooltip`, `notifyFailure` ; `BY_POSITION` par libellé, `personNameSchema`, `bulkCellLabels`, `ActionButton priority="tertiary"`, `MenuCaret`, `EXTERNAL_LINK`, `AUTH_PATHS` ; identifiants de colonnes en `label` (migration des vues) ; `features/projects` ; trous eslint fermés.
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
