# Composants similaires et redondances de code

État au 19 novembre 2026, fin de matinée, après neuf séries d'unifications (voir [Déjà unifié](#déjà-unifié)). Copier-coller (`npm run dup`) : 4 copies. Les décisions déjà prises sont en [annexe](#décisions-déjà-prises).

Aucun doublon lourd. La série du 19 novembre (après-midi) a traité les points 1 à 7 ci-dessous, sauf : `slotEvents` (agenda de l'historique d'une routine, à essayer à l'écran), les réponses d'API qui renvoient un id (changeraient le schéma GraphQL), `findTask` dans `task-recurrence` (import circulaire), et quelques détails (`reveal.css` des cellules, `optionalNumber` du panneau de tâche, « Oui » d'une colonne oui/non, durée filtrée en texte).

La bibliothèque de documents n'est pas traitée : elle sera refaite entièrement.

## Bugs

### 1. API : archivage et erreurs

- **Tâche archivée modifiable :** répétition (`task-recurrence.ts:48-62`), blocages et relations (`tasks.ts:548, 586` ; `assertSameTree` ignore `archivedAt`).
- **Projet archivé :** ses ressources s'ajoutent, se renomment, se déplacent et se suppriment (`project-resources.ts:16, 52, 66, 79`).
- **Client archivé :** ses coordonnées, prestations et contacts restent modifiables (`client-parties.ts:15, 48, 63, 84`), alors que `updateClient` refuse.
- **Choisir une valeur archivée :** statut et catégories de projet seulement vérifiés (`projects.ts:136, 180`) ; un projet archivé reste choisissable pour routines, évènements, documents, trésorerie, mail, tableaux de bord, vues ; un client archivé n'est refusé que pour un projet (voir décision DA).
- **Éléments de réglages archivés :** `setLook` change couleur et image d'un archivé ; un élément absent donne une erreur brute au lieu de « X introuvable. » (`settings-lists.ts:66-74`).
- **Mauvais type d'erreur :** un document absent (`document-tracking.ts:269`) et un devis importé absent (`accounting-documents.ts:634-635`, écrit deux fois) donnent BAD_USER_INPUT au lieu de NOT_FOUND.
- **Petits :** `cancelScheduled` marche sur un compte mail archivé (`mail/scheduled.ts:68`) ; `parseRoutine` lit deux fois la routine (`routines.ts:480, 529`) ; « Facture archivée. » au lieu de `ARCHIVED_MESSAGE` (`reminders.ts:53`).
- **Libellés d'erreur :** « Référence » désigne une liste de base dans les courses mais un produit dans le stock (`stock.ts:111, 328`) ; bénéficiaires « Membre » / « Relation » sans champ (`shopping/people.ts:38-39`), « Membre » et « Contributeur » pour la même recherche (`treasury-team.ts:64, 135`), assignés « Contributeur » ou « Assigné » ; « catégorie d'entrée » / « d'entrées », « Un X porte déjà ce libellé. » / « Ce magasin existe déjà. ».

### 2. Web

- **Icône des commentaires perdue** dans les tableaux des routines et des listes de courses : le texte passé dans `content` masque la cellule `CommentCount` (`RoutinesPage.tsx:172`, `ShoppingPage.tsx:288`). Correction : `readOnlyCells`.
- **Évènements dans le tableau des tâches :** leurs commentaires et leur heure sont affichés mais vides pour la recherche, l'export, le filtre et le tri (`export.ts:120-144`, `task-columns.ts:223-225`, `task-rows.ts:107`).
- **Colonnes de comptage (CO) :** les commentaires des tâches ne sont pas obligatoires et 0 trie comme vide (`task-columns.ts:270`, `task-rows.ts:91`) ; « Chrono » des routines filtré en texte, 0 vide (`routine-columns.ts:163-171`) ; « Chrono » veut dire temps passé dans les routines, chrono dans les tâches.
- **Colonnes mal filtrées :** « Envoi » des impayés jamais vide mais facultatif (`OverdueInvoicesPanel.tsx:56`) ; « Emplacement » du stock jamais vide (« Tout le stock »), tri et texte différents (`StockPage.tsx:41-47`) ; comptes filtrés en texte (`ShoppingPage.tsx:132, 141`, `AccountingPage.tsx:106`) ; « Moi » et le contexte quotidien trient comme vides (`BudgetsPanel.tsx:431, 444`).
- **Retard :** quatre règles (tableau et panneau, accueil sans test de clôture, agenda qui exige aussi l'absence de fin : `task-calendar.ts:49`). Proposition : `isTaskOverdue` (voir décision DD). Encore en rouge malgré CF : prévision en retard (`TreasuryPage.tsx:532`), impayés après 45 jours (`OverdueInvoicesPanel.tsx:257`), onglet des impayés (`AccountingPage.tsx:286`), et côté tâches, routines et accueil (voir décisions DB, DC).
- **Montant nul :** une ligne à 0 est « Sortie » pour sa catégorie mais se voit proposer des catégories d'entrée (`SplitLinesEditor.tsx:95, 205, 209`).
- **« Mouvements liés » :** le texte ignore les liens portés par les lignes, alors que la cellule et le filtre les comptent (`entry-columns.tsx:177`).
- **Même personne proposée deux fois** dans les courses et le stock : une relation liée à un contributeur (`shopping-format.ts:331-345`), contrairement à `useBeneficiaries`.
- **Réglages :** genre deviné par `startsWith('la ')`, donc « l'étiquette » au masculin (`SettingsList.tsx:96`) ; « sera supprimé » toujours au masculin, « retiré des 1 tâches » (`:187-192`) ; le glisser annonce « Catégorie déplacée » pour toutes les listes (`CategoryTree.tsx:129-130`).
- **Vues :** « Les tâches ne sont pas modifiées. » sur tous les tableaux, pas de message « Vue supprimée. » (`ViewTabs.tsx:42`) ; `taskViewLabelSchema` sert à toutes les vues.
- **Menus :** « Actions de « la vue X » » et « « la référence X » » (`ViewTabs.tsx:56`, `BaseLists.tsx:138`), contre la décision BF.
- **Session expirée :** silencieuse dans les formulaires, toast d'erreur ailleurs (`lib/form.ts:52`, `lib/notify.tsx:162`). Proposition : le test dans `notifyFailure`.
- **Mention `@nom` :** lien vers `/?assignee=…` que personne ne lit (`remark-references.ts:86`) (voir décision DK).
- **Badge d'une routine due :** heure lue une fois, sans `useNow` (`routine-table-cells.tsx:21`).
- **Réglé :** « Réglée » dans le tableau, « Réglé » dans la page d'un document importé (`DocumentsTable.tsx:226`, `ImportedDocumentPage.tsx:136`). Proposition : `BalanceBadge`.
- **Petits :** recherche des tableaux de bord sans libellé (`source-filters.tsx:131`) ; flèche d'un `ActionButton danger` à menu pas rouge (`ActionButton.tsx:104`) ; fil d'Ariane de l'en-tête refait à la main sans garde de cycle (`HeaderTitle.tsx:29-34`, variable `workspace`) ; boutons de fermeture des panneaux et modales sans nom (`SidePanel.tsx:46`, `open-modal.ts:18`) ; code mort (`QuickAction.disabled`, gardes `CountBadge`, JSDoc orphelines `table-engine.ts:29`, `use-task-context.ts:112`, fragments vides, gabarits inutiles).

## Contournements des briques

### 3. API et partagé

- **`reloaded` :** ×10 (`calendar.ts:402, 411`, `accounting.ts:279-343`, `tasks.ts:499, 592, 612`, `mail.ts:531`).
- **`deleteOrNotFound` :** chercher puis supprimer ×7 (jalons, sprints, tableaux de bord, stock, courses ×2, vues).
- **`refuseArchived` / `assertActive` / `activeIds` :** `assertNotArchived` après chargement ×7, `assertBaseList` puis `assertNotArchived` ×5, et `contributors.ts:132`, `organize.ts:30`, `shopping.ts:251, 554`.
- **`notFound(what, field)` :** `fieldError(field, 'X introuvable.')` ×5.
- **`findRoutine`, `findTask` :** contournés ×5.
- **Énumérations GraphQL** qui recopient des constantes partagées : unités, types de ligne, remises, sens, modes de ligne, statut d'écriture, type de client, type d'espace. Proposition : les exporter du partagé.
- **`pathOf`** (`geo.ts:178`) et `labelObject` (`workspace.ts:15`).

### 4. Web

- **`itemSelectProps` :** ~15 sélections sans l'avatar du choix (paiement, relevé, écriture, équipe, budgets, courses, suivi, cellules de trésorerie, calendrier d'un évènement, horaires) ; statuts de suivi et comptes des tableaux de bord.
- **`itemChoices`, `withArchived`, arbres :** options sans couleur (`shopping-columns.ts:46, 77`, `ShoppingPage.tsx:199`) ; `withArchived` recopié (`StockTable.tsx:119`, `shopping-columns.ts:102`) ; catégorie sans chemin (`ShoppingPage.tsx:183`) ; projets et tâches à plat (`SheetsTable.tsx:77`, `TimeLog.tsx:153`).
- **`DraftBadge`, `ItemBadge`, `CountBadge`, `LATE_COLOR`, `ErrorAlert` :** contournés (`DocumentEditor.tsx:355`, `TrackingBadge.tsx:109`, `BaseLists.tsx:147`, `MailFolders.tsx:240`).
- **`ActionButton priority="tertiary"` :** `Anchor component="button"` dans le mail et les courses ×5.
- **`FoldHeading` :** citation du message répondu (`MailComposer.tsx:382`), recherche avancée sans `aria-expanded`.
- **`confirmDestructive` `run`/`done` :** `formCallbacks(null…)` dans `onConfirm` ×7 (mail, espaces, routines).
- **`addressLabel` / `senderName` :** refaits pour le transfert (`compose-options.ts:128, 144`).
- **Inline :** `toggledIn` ×2, `optionalNumber` (`TaskPanel.tsx:319`), `FRENCH_NUMBER_FORMAT` (×4 avec la seule virgule), `stoppedCellField` ×7 dans `EditableCells.tsx`, `ActionTooltip` refait dans `StateSwitch`, `readOnlyCells` dans les horaires.
- **Renommage en ligne (CK) :** encore dans l'arbre des projets (double-clic, `TreeRow.tsx:50-90`) et la liste des espaces (au blur, Échap n'annule pas : `WorkspacesManager.tsx:77`) (voir décision DF).
- **Libellés cachés sans guillemets :** `Lier X à…` (`entry-columns.tsx:310`, `EntryLinesTable.tsx:224, 325`), `Ouvrir ${number}`, `Affichage de ${name}`, `SlotTimesFields`, `Désactiver ${alarm.label}`.

## Petits doublons

### 5. API

- **Chercher puis refuser si archivé :** 6 aides à 5 noms (`findWritableDashboard`, `findActiveAccount`, `findOpenItem`…) et ~20 en ligne. Proposition : `findActive(model, id, what)`.
- **`as never` :** 27 conversions dans 7 modules GraphQL. Proposition : services en `unknown`, ou une seule aide `unchecked()`.
- **Catégories de facture et d'avoir** lues ×3 ; profil de l'entreprise relu (×3, dans une boucle, ×2). Proposition : `invoiceCategories()`.
- **Espace courant** lu de 4 façons ; `moveWorkspace` refait `saveSiblingOrder`.
- **Moyen de paiement selon le sens** ×2 (`assertMethodFor`) ; prestation du client ×2 ; bénéficiaires vérifiés de 3 façons (`assertBeneficiaries`) ; type d'un fichier d'après ses octets ×2 (`sniffedType`) ; `LabelColorInput` / `LabelColorPatch` ×6 (`nameColor` dans les courses).
- **Partagé :** jour du mois ×3 (`dayOfMonthOf`), chevauchement d'horaires ×2, types de série ×2 + web (`SERIES_TYPES`), `fileName(title…)`.
- **API inégale :** réglages de trésorerie et recherches mail renvoient un id au lieu de l'objet ; `treasuryStatementPdf` sans `ReportFile`.
- **Noms :** `graphql/modules/workspace.ts` (projets, clients) à côté de `workspaces.ts` ; `services/workspace/` ; `projectStatuses` dans les tâches (voir décision DL).

### 6. Web

- **Sens d'un montant** (`< 0 ? 'OUT' : 'IN'`) ×7. Proposition : `directionOf` (corrige le montant nul).
- **Montant signé** `+` / `−` ×8. Proposition : `signedText`, à côté de `SignedAmount`.
- **Clés étiquetées** `préfixe:id` codées et décodées de 4 façons, plus `${projectId}:${number}` ×3. Proposition : `taggedKey` / `parseTaggedKey`, `taskNumberKey`, `referenceTargets`.
- **Accord au féminin** (« cochée », « sélectionnée », « archivée ») ×4. Proposition : `agreed(word, feminine, count)`. `archivedMessage` ×2.
- **Plis mémorisés** de 4 façons (`useFolded`, barre latérale, dossiers mail). Proposition : `useFoldedIds(key)`.
- **Agenda de l'historique d'une routine :** refait en plus simple (pas de barre de plages réglable, pas de hachures ni de couleur) (`RoutineDayAgenda.tsx:180-215`). Proposition : `slotEvents`.
- **Moment d'un évènement :** 3 formateurs ; « Journée entière » / « Toute la journée », interrupteur ou case (voir décision DE).
- **« Modifications non enregistrées » :** deux pastilles différentes, « Annuler » / « Annuler les modifications ».
- **Divers :** « X de plus / Réduire » ×2 ; résumé de synchronisation GitHub ×2 ; prochaine alarme ×2 ; `hasComments` ; `LateBadge` à déplacer dans `components/feedback` ; boutons ouverts/fermés `IconAction variant={open…}` ×2 (prop `expanded`) ; deux tailles d'interrupteurs dans le même panneau ; état vide des réglages avec sa propre icône ; `EditableCells.module.css` refait `reveal.css` ; « Moi » vaut `'none'` ou `'me'` ; 0 exporté vide ou « 0 » (voir décision DH).
- **Mots :** « Bénéficiaire » / « Bénéficiaires », « Note » / « Description », « Oui » dans une colonne oui/non, « Produits (libellés) », progression « x / y » ou « x sur y achetés », durée filtrée en heures ou en texte, « Marquer comme à faire » / « Marquer à traiter », confirmations « archivez-le plutôt » / « archivez plutôt » et noms en gras au lieu de « ».
- **Restes du renommage `label` :** `onCreate(name)` (`CreatableSelect`, `BatchMultiSelect`), `promptName`, `QuickAction.title`, `look.name`, `AddChild.name`, `Heading name`, JSDoc « name » dans les courses, `entryCategories` = `entryProjects`.

## Règles eslint

### 7. Trous

- **Web :** clés `:` ; ``name={(x) => `la …`}`` (BF) ; `stoppedCellField` en attributs JSX ; `FoldHeading` contre `Anchor` + `Collapse` ; règles de boutons qui se recouvrent (322, 333, 577 couvertes par 770) ; participe passé écrit à la main ; parents remontés à la main ; `LATE_COLOR` contre un `color="red"` conditionnel ; `LinksCell` exclu de la règle des libellés ; `listSelectProps` seul sur une sélection simple ; `Badge` avec un compte seul ; `readOnlyCells` en `columns.filter().map` ; avatar dans une IIFE ; `decimalSeparator` seul ; `formCallbacks(null…)` dans `onConfirm` ; identifiant nu dans un `aria-label` ; `Anchor component="button"` ; ajout/retrait à la main dans un tableau.
- **API :** chercher puis supprimer ; `findUniqueOrThrow({ ...query, where: { id: (await …).id } })` ; `fieldError(_, /introuvable\.$/)` ; `assertNotArchived` après chargement ; `enumType` avec une liste écrite ; `as never` ; `join(' › ')`.

## Plan proposé

1. **Bugs (1, 2).** Environ 45 à 60 minutes (API d'archivage comprise).
2. **Contournements et petits doublons (3 à 6)**, avec les décisions. Environ 60 à 90 minutes.
3. **Règles eslint (7).** Environ 30 à 45 minutes.

Toutes les décisions de ce round sont prises (DA à DM, voir plus bas).

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
21. **Sécurité par défaut :** l'API tourne en production sauf `NODE_ENV` contraire, et le `.env` l'emporte sur l'hébergeur ; CORS désactivé ; une seule définition des en-têtes de sécurité (`security-headers.ts`) pour l'API et pour le `.htaccess` d'Apache.
22. **CSP des images :** `https:` permis (tuiles, images liées, images distantes d'un mail à la demande) ; scripts, cadres et connexions restent limités à l'origine.
23. **Sessions :** 14 jours sans activité, 90 jours au plus ; la déconnexion vide le cache du navigateur.
24. **Mails reçus :** aucune adresse `/api/` hors de leurs images intégrées ; polices distantes bloquées.
25. **Limites de tentatives :** comptées en base ; connexion : 5 par 15 min par IP, 100 par 15 min par identifiant (un tiers ne verrouille pas le compte en échouant quelques fois).

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
- **DA. Valeur archivée choisie :** un projet ou un client archivé est refusé partout, comme les éléments de réglages.
- **DB. Impayés de plus de 45 jours :** second palier en rouge (orange avant).
- **DC. Retard :** orange (`LATE_COLOR`) partout : tâches, routines, badge de navigation, panneau, finances de l'accueil.
- **DD. Tâche en retard dans l'agenda :** même règle que le tableau (échéance passée et non close), via `isTaskOverdue`.
- **DE. Journée entière :** « Journée entière », avec un interrupteur.
- **DF. Renommage dans l'arbre des projets et la liste des espaces :** par `openLabelForm`, comme ailleurs.
- **DG. En-tête des pages projet et client :** même règle qu'ailleurs (`DetailHeader`, menu « … » avec archiver et supprimer).
- **DH. Zéro dans l'export :** « 0 » pour un montant, vide pour un compte.
- **DI. Flèche :** sur tous les boutons qui ouvrent un menu ou un panneau (Filtrer, Trier compris).
- **DJ. Archiver dans une liste de réglages :** dans le menu « … ».
- **DK. Mention `@nom` :** plus de lien.
- **DL. Noms dans l'API :** `graphql/modules/workspace.ts` et `services/workspace/` renommés `projects`.
- **DM. Glisser-déposer du mail :** sur `components/dnd`, comme le reste.

## Restent à part

- **Menu des lieux enregistrés** (`AddressInput.tsx:134`) : un arbre avec coches, trop particulier pour `ActionsMenu`.
- **Logo de l'entreprise :** il s'enregistre tout de suite et n'accepte que PNG ou JPEG, pour les PDF.
- **Mise en page des tableaux PDF (`tableWriter`) :** pas touchée sans essai visuel.

## Déjà unifié

- **Série du 19 novembre 2026 (après-midi) :** décisions DA à DM ; archivé refusé partout dans l'API (`findActive`, `assertBeneficiaries`, `assertMethodFor`, `assertService`), `unchecked()`, `invoiceCategories`, `sniffedType`, énumérations GraphQL tirées du partagé, `services/projects` et `services/workspaces` ; `isTaskOverdue`, `LATE_COLOR` partout, `DocumentBalanceBadge`, `PeopleField`, `directionOf`, `signedText`, `taggedKey`, `taskNumberKey`, `agreed`, `archivedMessage`, `useFoldedIds`, `eventMomentText`, `UnsavedIndicator`, `LateBadge` dans `components/feedback`, `DetailHeader` pour projets et clients, glisser-déposer du mail sur `components/dnd`, `MenuCaret` sur tout bouton qui ouvre ; alias de lecture `LEGACY_FILTER_VALUES` (« Moi » des budgets) ; trous eslint fermés.
- **Série du 19 novembre 2026 (fin de matinée) :** décisions CN à CP ; `ActionButton` plein / clair / discret, destructif plein rouge, prop `after` ; bascules en `StateSwitch` ; `aria-pressed` et variantes écrites à la main interdites.
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
  - API : `assertExists`, `assertAllExist`, `fieldError`, `errorMessage`, `relationIds`, `labelObject`, `routes/http.ts` (`requireSession`, `sessionRequired`, `sendDownload`, `sendServiceError`), `withMailbox`, `specialFolder`, `githubFetch`, `services/shopping/people.ts` (`assertPeople`), `assertProjectContributors` pour les tâches ;
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
