# Composants similaires et redondances de code

État au 17 novembre 2026, après deux séries d'unifications (voir [Déjà unifié](#déjà-unifié)).

Le plus gros reste se trouve dans l'API : l'ordre des listes, les arbres et le CRUD des listes simples, recopiés service par service. Côté web, ce sont surtout des contournements des briques déjà communes : panneaux ouverts à la main, menus d'actions écrits à la main, paramètres d'URL. S'y ajoutent de petits utilitaires de collections et de dates recopiés partout.

La relecture a aussi trouvé quatre bugs de « jour courant », listés en premier.

La bibliothèque de documents n'est pas traitée : elle sera refaite entièrement.

## Bugs trouvés en passant

### 1. « Aujourd'hui » faux autour de minuit

- **API :**
  - `services/accounting/recurring-invoices.ts:126` prend le jour du fuseau du serveur (`Intl.DateTimeFormat('en-CA')`) ;
  - `services/treasury/treasury-budgets.ts:105` prend le jour UTC (`formatDay(new Date())`).
  - Les deux devraient passer par `parisToday`.
- **Web :**
  - `components/filters/FilterBuilder.tsx:70` et `features/dashboards/lib/finance-records.ts:117` prennent le jour UTC (`new Date().toISOString().slice(0, 10)`) ;
  - les factures en retard et la valeur « aujourd'hui » d'un filtre sont donc décalées entre minuit et 1 h ou 2 h.
  - Les deux devraient passer par `localToday`.

**Fait** : `parisToday` pour les factures récurrentes et le rapport des budgets ; `localToday` pour la valeur « aujourd'hui » des filtres et les factures en retard des tableaux de bord.

### 2. Réordonnancements sans transaction

- `settings-lists.reorder` (`services/core/settings-lists.ts:88`) et `movePlace` (`services/core/geo.ts:251`) écrivent les positions une par une.
- Une erreur au milieu laisse l'ordre à moitié appliqué. `saveSiblingOrder` le fait déjà dans une transaction.

**Fait** : les deux écrivent leurs positions dans une seule transaction.

## Gros doublons

### 3. API : déplacement et position suivante, liste par liste

- **Déplacement :**
  - 16 services appellent `moveInOrder`, puis réécrivent la même transaction de positions : calendriers, étiquettes, achats ×4, tableaux de bord ×2, statuts de documents, ressources de projet, jalons, statuts, vues, comptes mail, clients, projets.
  - Trois autres (espaces, routines, lieux) n'utilisent pas `ordering.ts` du tout.
  - Au total, environ 250 lignes.
- **Deux chemins pour les mêmes listes :**
  - `reorderSettingsItems` couvre déjà les statuts de projet, les libellés des tâches, les statuts de documents, les catégories de fiches, les listes des achats et les calendriers ;
  - les mutations `moveProjectStatus`, `moveDocumentStatus`, `moveSheetCategory`, `moveCalendar`, `moveShopping{Store,Unit,Storage,BaseList}` et `moveTask{Status,Priority,Type,Tag}` existent pourtant toujours.
- **Position suivante :**
  - `(_max.position ?? -1) + 1` est écrit environ 44 fois, dans 28 fichiers ;
  - 14 de ces copies concernent des listes paramétrables qui ont déjà `nextPosition` ;
  - les arbres ne peuvent pas l'utiliser : il n'a pas de `where`.
- **Cible :**
  - `moveInList(modèle, id, index, where?)` et `nextPosition(modèle, where?)` dans `ordering.ts` ;
  - suppression des mutations de déplacement que `reorderSettingsItems` couvre déjà.

**Fait** :

- **Outils :** `moveInList(modèle, id, index, where)` et `nextPositionIn(modèle, where)` dans `ordering.ts`. La version des listes paramétrables (`nextPosition`) repose sur le second.
- **Remplacés :**
  - les déplacements des tableaux de bord, des graphiques, des vues, des jalons, des comptes mail, des clients et des ressources ;
  - ceux des espaces et des routines, sur `moveInOrder` et `saveSiblingOrder` ;
  - une quarantaine de calculs de position suivante.
- **Supprimées :** les 12 mutations en double (statuts de projet et de documents, catégories de fiches, calendriers, magasins, unités, conservations, références, libellés des tâches) et leurs services. Le web réordonne ces listes par `reorderSettingsItems`, onglets des références compris.
- **Restent à part :**
  - le déplacement des projets, qui change aussi le parent et le client ;
  - les positions calculées dans une transaction ouverte (`tx`).

### 4. API : arbres

- **Détection de cycle :**
  - la boucle « le nouveau parent n'est pas sous l'élément » est recopiée 9 fois : catégories de l'agenda, de la trésorerie, des achats, emplacements du stock, lieux ×2, routines (`reaches`) ;
  - `ProjectTree.ancestors` refait `ancestorsOf`.
- **Déplacement dans un arbre** (nouveau parent et ordre des frères) : 4 `moveCategory` quasi identiques, plus `moveLocation`.
- **Suppression** (les enfants remontent d'un niveau, puis suppression) : 6 copies.
- **Cible :**
  - `assertNotUnder` dans `tree.ts` (partagé) ;
  - `moveInTree` et `deleteTreeNode` dans `ordering.ts`.

**Fait** :

- `isUnderOrSelf` dans `tree.ts` (partagé) ;
- dans `core/trees.ts` : `assertTreeParent`, qui vérifie qu'un parent existe et n'est pas sous l'élément, et `deleteTreeNode`, qui fait remonter les enfants puis supprime ;
- les déplacements dans un arbre passent par `moveInList` avec le parent ;
- toutes les vérifications de parent et toutes les suppressions recopiées sont remplacées.

Reste à part : `ProjectTree`, la vue en mémoire des projets.

### 5. API : CRUD des listes simples (nom et couleur)

- **Services :**
  - `createLabelService` ne sert qu'aux 4 libellés des tâches ;
  - le même créer / modifier / supprimer / déplacer est écrit à la main pour les statuts de projet, les magasins, unités, conservations et références des achats, les catégories de fiches, les drapeaux mail, les contextes de la trésorerie et les statuts de documents.
- **Erreur de nom déjà pris :**
  - la conversion de l'erreur Prisma P2002 en erreur de champ est faite 6 fois, plus 6 fois en ligne ;
  - les achats vérifient le nom avant, autrement.
- **GraphQL :**
  - les objets `{ id, name, color, position }` sont définis 7 fois, les entrées `{ name, color }` environ 14 fois ;
  - environ 178 résolveurs finissent par `await …; return true;`, et un seul `done()` existe (stock).
- **Cible :**
  - `createLabelService` généralisé (périmètre `where`, crochets) ;
  - une fabrique `labelMutations(kind, service)` ;
  - `LabelInput` et `LabelPatch` communs ;
  - `rethrowUnique` et `done()` dans `graphql/`.

**Fait** :

- `rethrowUnique` et `isUniqueConflict` (`graphql/errors.ts`) remplacent toutes les conversions de l'erreur P2002, avec un seul code (`CONFLICT`) ;
- `done()` remplace 171 résolveurs `await …; return true;` ;
- `NameColorInput` et `NameColorPatch` (`graphql/label-inputs.ts`) remplacent 10 types d'entrée identiques ; les documents du web sont mis à jour.

Restent : la généralisation de `createLabelService` à toutes les listes nom + couleur, et une fabrique de mutations pour elles.

### 6. API : chercher, sinon « introuvable »

- `findUnique`, puis `if (!x) throw notFound(…)`, est écrit environ 146 fois. Les plus gros fichiers : achats (14), routines (9), stock (7), trésorerie, fiches.
- S'y ajoutent une vingtaine de `findX` locaux et une quinzaine de vérifications d'existence `select: { id: true }`.
- **Cible :** `findOrThrow(modèle, id, libellé)` et `assertExists`, dans `services/core/lookup.ts`.

**Fait** : `orNotFound(requête, libellé)` (`graphql/errors.ts`), qui garde le type de la requête, remplace 136 copies. Les autres `notFound` sont des cas à part : décomptes, suppressions groupées, recherches en mémoire.

### 7. Web : panneaux et fenêtres ouverts à la main

- **Panneaux :** une quinzaine de formulaires sont dans un `<SidePanel>` piloté par un état local (titre, contenu conditionnel) au lieu de `openFormPanel` :
  - trésorerie : page, budgets, équipe ×2, mouvement, mouvements ×2, lignes, emprunts ;
  - suivi de facturation, évènement, agenda, évènement abonné.
- **Fenêtres :** des `<Modal>` bruts au lieu de `openModal` ou `confirmDestructive` :
  - suppression d'un évènement (`EventForm.tsx:280`) ;
  - fermeture d'un mail (`MailComposer.tsx:281`) ;
  - choix de la portée (`ask-scope.tsx`) ;
  - répétition (`RepetitionField.tsx`).
- **Confirmation en ligne :** `WorkspacesManager.tsx` confirme une suppression dans la ligne même.

**Fait** :

- **`openFormPanel` partout :**
  - équipe et relations, budgets, suivi de facturation, mouvements, import et export d'un relevé, commentaires des emprunts ;
  - plages de travail, report d'un évènement (`PostponePanel` garde son état d'attente) ;
  - évènement d'un calendrier abonné (`SubscribedEvent`, ex-`SubscribedEventModal`).
- **`confirmDestructive`** pour la suppression d'un évènement et celle d'un espace (plus de confirmation dans la ligne).
- **`openModal`** pour la question « Fermer le mail ».
- **`askScope`** partout : `useScopeQuestion` est supprimé, car le formulaire d'évènement est maintenant dans le panneau.
- **Restent à part**, parce que leur contenu suit un état vivant :
  - les rattachements d'une ligne de mouvement ;
  - les créations depuis le formulaire de mouvement ;
  - la fenêtre de répétition (`RepetitionField`), qui édite un brouillon ;
  - le panneau routé d'une tâche.

### 8. Web : menus et boutons d'actions écrits à la main

- **Menus Modifier / Supprimer** au lieu de `ActionsMenu` : jalons, sprints, recherches mail, dossiers mail, graphiques des tableaux de bord.
- **Rangées de boutons Modifier / Dupliquer / Supprimer** (infobulle et icône) : alarmes, contributeurs, facturation d'un client ×2, ressources de projet, comptes mail, espaces. `SettingsList` fait la même chose en interne.
- **Boutons Monter / Descendre :** lignes d'un document, espaces, ressources de projet, panneau de tri.
- **Poignées de glisser-déposer** (`useSortable` avec une icône de poignée) : jalons, graphiques, cas d'une répétition.
- **Cible :** `InlineActions items={RowMenuEntry[]}` (à côté de `RowActions`), `MoveButtons`, `DragHandle`.

**Fait** :

- **`InlineActions`** (`RowActions.tsx`), des icônes côte à côte avec leur infobulle et les actions destructives en rouge : alarmes, contributeurs, facturation d'un client ×2, ressources de projet, comptes mail, espaces, lignes d'un document. Les boutons Monter / Descendre en sont des entrées.
- **`ActionsMenu`** remplace les menus écrits à la main : jalons, sprints, recherches et dossiers mail, graphiques. Il gagne `inRow` (clics gardés dans le menu), `size` et `loading`.
- **`DragHandle`** (`components/actions`) remplace les poignées des jalons, des graphiques et des cas d'une répétition.
- **Restent à part :** la poignée de la liste des projets (glisser-déposer sans tri) et `SettingsList`.

### 9. Web : paramètres d'URL

- `new URLSearchParams(…)`, puis `set` ou `delete`, puis `setParams(…, { replace: true })` : une vingtaine de copies.
- **Où :**
  - changements d'onglet qui contournent `useTabParam` : routines, achats, stock, paramètres, trésorerie, projet ;
  - setters locaux : facturation, mail, vues, temps, réglages de page ;
  - effets « lire un ancien paramètre puis le retirer » : facturation ×2, mail, agenda, trésorerie, projet.
- **Incohérence :** deux pages (stock, paramètres) ajoutent une entrée dans l'historique au lieu de la remplacer.
- **Cible :** `useSearchParam(clé)`, `useSetParams()` et `useConsumeParam(clé, …)` dans `lib/search-params.ts`, avec `useTabParam` construit dessus.

**Fait** : `useSetParams` et `useSearchParam` (`lib/search-params.ts`) changent l'URL partout (routines, achats, stock, paramètres, temps, agenda, mail, facturation, trésorerie, projet, vues, réglages de page) ; `useTabParam` repose dessus. Toutes les pages remplacent l'entrée de l'historique, stock et paramètres compris. Restent les `URLSearchParams` qui construisent un lien ou une adresse d'API.

## Doublons moyens

### 10. Petits utilitaires de collections

- **`byId` :** `new Map(list.map((x) => [x.id, x]))` est écrit 52 fois, plus une quinzaine de tables « id → nom ».
- **Regroupements** (`m.set(k, [...(m.get(k) ?? []), x])`) : 13 copies, dont 3 exactes des enfants par parent (orphelins à la racine) dans `routine-format.ts`, `category-tree.ts` et `tree-select.tsx`.
- **Tri par position :** `(a, b) => a.position - b.position` est écrit 24 fois ; côté API, `orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]` l'est 49 fois.
- **Déplacement dans une liste en cache :** 6 copies dans les mises à jour optimistes (tâches, vues, jalons, tableaux de bord, graphiques, références).
- **Cible :**
  - `byId`, `groupBy`, `childrenOf`, `byPosition` dans `tree.ts` (partagé) ;
  - `BY_POSITION` dans `ordering.ts` ;
  - `moveToIndex` dans `lib/mutation.ts`.

**Fait** :

- **Outils partagés :** `mapById`, `groupBy` et `byPosition` (`core/collections.ts`), et `childrenByParent` dans `tree.ts`.
- **Remplacés :**
  - les tables par id (`mapById`, renommé ainsi parce que beaucoup de variables s'appellent déjà `byId`) ;
  - les tris par position ;
  - les trois copies des enfants par parent ;
  - les regroupements simples ;
  - `BY_POSITION` dans `ordering.ts` pour l'ordre des requêtes de l'API ;
  - `moveToIndex` dans `lib/mutation.ts` pour 5 des 6 déplacements en cache.
- **Restent à part :** les regroupements à plusieurs clés ou conditionnels, et le déplacement des tâches, qui change aussi le parent.

### 11. Dates et heures

- **Web :**
  - le jour local est recalculé au lieu de `localDay` 5 fois : temps, factures en retard, accueil ;
  - minuit local en ISO est écrit 3 fois ;
  - les débuts et décalages de périodes des tableaux de bord (`aggregate.ts:160`) refont `calendarStart` et `shiftCalendar` ;
  - un `isoWeek` privé (`table-engine.ts`) double celui du code partagé ;
  - 3 écarts de jours sont calculés en `/ 86_400_000` au lieu de `daysBetween`.
- **Heures :** la conversion « HH:MM ↔ minutes » existe au moins 5 fois (agenda, créneaux, temps, plages de travail).
- **API :**
  - le même `toDate()` est défini 4 fois (projets, tâches, jalons, alarmes) ;
  - `new Date(\`${jour}T00:00:00Z\`)` est écrit en ligne une dizaine de fois ;
  - `toISOString().slice(0, 10)` est utilisé au lieu de `formatDay` ;
  - le dernier jour du mois et le jour borné au mois sont recalculés dans plusieurs fichiers.
- **Cible :**
  - `localMidnight` dans `lib/dates.ts` ;
  - `timeToMinutes` et `minutesToTime` dans le code partagé ;
  - `parseOptionalDay` ;
  - un `months.ts` partagé.

**Fait** :

- **Web :**
  - `lib/dates` réunit `localDay`, `localParts` (sorti de l'agenda et du formulaire de temps) et `localMidnight`, à la place des copies du temps, des factures en retard et de l'accueil ;
  - les périodes des tableaux de bord passent par `calendarStart` et `shiftCalendar` ;
  - la semaine ISO des tableaux passe par `isoWeek` et `isoWeekYear` (partagés) ;
  - `daysBetween` remplace les calculs en `/ 86_400_000`.
- **Partagé :**
  - `timeToMinutes` et `minutesToTime` (`dates/times.ts`) ;
  - `daysInMonth`, `dayInMonth` et `lastDayOfMonth` (`dates/months.ts`).
- **API :**
  - `parseOptionalDay` à la place des 4 `toDate` ;
  - `parseDay` et `formatDay` à la place des conversions écrites en ligne, seed compris.

### 12. Argent

- **Arrondi à 2 décimales :** une dizaine de copies dans le web (lignes de trésorerie, factures importées, stock, tableaux), alors qu'un `round` existe déjà dans `aggregate.ts`.
- **Centimes :** `Math.round(x * 100)` est écrit à la main au lieu de `toCents`, dans l'API et le code partagé.
- **Montant d'une ligne de trésorerie** (pourcentage ou montant) : recalculé dans `treasury-loans.ts:40` et dans le module GraphQL de la trésorerie, alors que `splitAmounts` le fait déjà.
- **Cible :** `round2`, `toCents` partout, `lineCents` dans le code partagé.

**Fait** : `round2` à côté de `toCents`, et `toCents` partout dans le web, l'API et le code partagé. `lineCents` donne le montant d'une ligne de trésorerie, utilisé par `splitAmounts`, les emprunts et le module GraphQL. L'arrondi local des tableaux de bord est supprimé.

### 13. Blocs de page

- **Navigation de période** (« Aujourd'hui », précédent, suivant, libellé) : 3 copies (agenda, trésorerie, historique des routines), avec des boutons dans un ordre différent.
- **En-tête de page de détail** (retour, titre, badge, sous-titre, actions) : 4 copies (document, facture importée, liste d'achats, fiche), avec trois styles de lien retour.
- **Petite section à titre en capitales** (titre, action à droite, contenu) : une dizaine de copies. `Property` du panneau d'une tâche et `Detail` de la page projet sont le même composant.
- **Chiffre clé :** `Figure` (trésorerie) double `StatTile` (accueil).
- **Section d'éditeur :** `EditorSection` (facturation) double `SettingsSection`, avec un titre plus petit.
- **Cible :** `PeriodNav`, `DetailHeader`, `SubSection`, `StatTile` dans `components/`, et une taille de titre pour `SettingsSection`.

**Fait** :

- `SubSection` (`components/page`) : propriétés d'une tâche, détails d'un projet, alertes et achats d'une tâche ;
- `StatTile` sorti de l'accueil vers `components/page`, repris par les chiffres de la trésorerie (`valueColor`) ;
- `PeriodNav` : agenda, trésorerie et historique des routines, dans un seul ordre (« Aujourd'hui », précédent, la période, suivant).

Restent à part :

- l'en-tête des pages de détail : ses quatre copies n'ont pas le même lien retour, c'est un choix d'interface à faire d'abord ;
- les autres petites sections à titre écrites en ligne ;
- `EditorSection`.

### 14. Tâches : cartes et cellules

- **Jalon et sprint :** la même carte (titre, badges, dates, menu, progression, description modifiable) est recopiée dans `MilestonesPanel` et `SprintsPanel`. Environ 45 lignes chacune.
- **Progression :** `TaskProgress` est contourné par la cellule de progression et par le panneau d'une tâche (sous-tâches faites sur total).
- **Cellules en popover** (un tiret grisé, puis un éditeur dans un popover) : 5 copies (lieu, rappels, ouverture, créneaux, temps).
- **Cible :** `PlanCard`, `TaskProgress` avec une unité, `EditablePopoverCell`.

**Fait** :

- `PlanCard` pour les jalons et les sprints ;
- `TaskProgress`, avec une taille et une unité, sert aussi aux sous-tâches (cellule et panneau) ;
- `EditablePopoverCell` (`EditableCells`) pour le lieu, les alertes et l'ouverture des routines, les créneaux des tâches et l'évènement d'un temps.

### 15. Mail : barre de la liste

- La recherche, la recherche avancée, le tri, le filtre « Tous / À traiter / Traités » et les messages vides sont recopiés entre `MailPage` et `ProjectMailsPanel`, environ 60 lignes chacun.
- La liste `SORTS` est en double.
- **Cible :** `MailListToolbar`, `MAIL_SORTS`.

**Fait** : `MAIL_SORTS`, `MAIL_SORTS_ACROSS` et `DONE_FILTERS` (`lib/mail-list.ts`), et `MailListControls` (tri et état traité) pour la page Mails et les mails d'un projet. Reste à part la recherche et la recherche avancée : leur état diffère entre les deux (dans l'URL pour l'une, dans le composant pour l'autre).

### 16. Personnes : restes

- **Options « membres puis relations »** : construites 4 fois (lignes, tableau des lignes, budgets, achats).
- **Noms des bénéficiaires** : calculés deux fois dans `use-beneficiaries.ts`.
- **Ligne d'un contributeur** (avatar, nom, badge « Moi ») : écrite avec un `Avatar` brut 4 fois (contributeurs d'un projet, gestion des contributeurs, équipe, éditeur markdown).
- **Code mort :** `Assignees` (`task-ui.tsx`) n'est plus utilisé.
- **Cible :** `memberRelationOptions` dans `components/people`, et `PersonRow`.

**Fait** :

- `memberRelationOptions` (`people-keys`) pour les lignes, le tableau des lignes et les budgets ;
- un seul calcul des noms des bénéficiaires ;
- `PersonRow` pour les contributeurs d'un projet et de l'espace ;
- `Assignees` supprimé.

Restent les options des achats (« Moi », contributeurs du projet), et l'équipe de la trésorerie et l'éditeur markdown, aux lignes plus simples.

### 17. Listes paramétrables : restes

- **Compteurs d'usage** (combien d'éléments utilisent un item) : 9 copies, dont deux `usageOf` locaux.
- **Options des plages de travail** : construites 3 fois, leurs noms 2 fois.
- **Options d'arbre des routines** : `routineTreeOptions` est contourné par le formulaire et une cellule des routines, et le temps en fait une liste plate.
- **Cible :** `countBy` à côté de `SettingsList`, et `useScheduleChoices()`.

**Fait** : `countBy` (`collections.ts`, partagé) pour les 9 compteurs d'usage ; `scheduleChoices` pour les options et les noms des plages ; `routineTreeOptions` dans le formulaire et la cellule de la routine parente.

### 18. Requêtes : clés et invalidations hors des `api.ts`

- **Clés écrites en dur :**
  - `['workspaces']` dans `lib/week.ts` (la clé n'est pas exportée) ;
  - `['accounting', 'treasury']` dans les achats, invalidé dans le `mutationFn` même ;
  - la clé des réglages de la trésorerie reconstruite dans les bénéficiaires.
- **Invalidations dans des composants :** gestion des contributeurs, éditeur de document. Elles appartiennent à la liste `invalidate` de leurs mutations.
- **Cible :** exporter les clés et passer par `useInvalidatingMutation`.

**Fait** :

- `workspacesQueryKey`, `treasurySettingsKey` et `tasksQueryKey` sont utilisés au lieu des clés écrites en dur ;
- le rattachement d'un mouvement à une liste d'achats rafraîchit la trésorerie par sa liste `invalidate` ;
- la suppression d'un contributeur et l'enregistrement d'un document rafraîchissent leurs requêtes dans leurs mutations, et non plus dans les composants.

Restent les deux invalidations « tout sauf une sous-clé » (document supprimé, mail lu), propres à leur cas.

### 19. API : PDF

- **Émetteur :** le PDF de trésorerie relit le nom de l'entreprise, ce que fait déjà `issuer()`.
- **Mise en page :** le PDF de trésorerie et celui des tableaux partagent la même structure (titre, ligne d'en-tête, sauts de page avec en-tête répété, bandeau).
- **Thème :** couleurs, marges et tailles sont redéclarées dans 5 fichiers.
- **Cible :** `issuer()`, le thème et un `tableWriter` exportés par `pdf-report.ts`. Environ 80 lignes.

**Fait** : `issuerName()`, `PDF_TEXT`, `PDF_TABLE` et `REPORT_MARGIN` sont exportés par `pdf-report.ts` et repris par les PDF de trésorerie, des tableaux, des graphiques et de l'agenda. Reste à part la mise en page commune des tableaux (`tableWriter`) : sans essai visuel, elle n'a pas été touchée.

### 20. API : tâches de fond

- La boucle « pour chaque espace, au démarrage puis à intervalle » est recopiée 4 fois : factures récurrentes, GitHub, mails liés, mails programmés.
- La connexion GitHub de l'espace courant est cherchée 4 fois.
- **Cible :** `schedulePerWorkspace` et `currentGithubConnection`.

**Fait** : `schedulePerWorkspace` (`workspaces.ts`) lance les 4 tâches de fond, et `currentGithubConnection` cherche la connexion GitHub de l'espace courant.

### 21. Autres champs et badges

- **Couleur :** `ColorInput` avec les nuances du thème est écrit 8 fois, avec des réglages différents (7 ou 9 nuances par ligne, `hex` ou pas). Cible : `ColorField`.
- **Logo :** le logo de l'entreprise (`CompanySettings.tsx:84`) refait `IconField`. Cible : `IconField` générique dans `components/`.
- **Trajet aller / retour :** les champs sont recopiés entre l'évènement et la répétition des routines. Cible : `TravelFields`.
- **Édition de markdown en ligne** avec « Annuler » et « Enregistrer » écrits à la main : commentaires et description d'une tâche. Cible : `FormActions` avec une taille.
- **Description du projet :** elle est affichée en texte brut au lieu de `MarkdownView`.
- **Badge « Archivé(e) » :** 6 styles différents. Cible : `ArchivedBadge`.
- **États vides :** `EmptyState` est contourné à l'accueil (`HomeEmpty`), dans la barre latérale, les graphiques, l'équipe, le mail et GitHub ; deux gestionnaires l'entourent d'un `ThemeIcon` au lieu de lui passer `icon`.
- **Erreur de chargement :** `<Alert color="red" icon={<ErrorIcon />}>{error.message}</Alert>` est écrit une douzaine de fois. Cible : `ErrorAlert`.

**Fait** :

- **Composants :**
  - `ColorField` (8 champs) ;
  - `TravelField` ;
  - `ArchivedBadge` ;
  - `ErrorAlert` (12 alertes) ;
  - `FormActions` avec une taille, pour l'édition d'un commentaire et de la description d'une tâche.
- **États vides :** la variante `plain` d'`EmptyState` remplace `HomeEmpty` et les copies des graphiques et des gestionnaires.
- **Description du projet :** elle est maintenant affichée en markdown.

Restent à part :

- le logo de l'entreprise : il s'enregistre tout de suite et n'accepte que PNG ou JPEG, pour les PDF ;
- le petit vide de la barre latérale, plus dense.

## Petites redondances

### 22. Divers

- **`stopClick` :** redéclaré localement dans 6 fichiers de cellules.
- **Erreurs :** `notifyError(e.message)` est utilisé au lieu de `onMutationError` dans 13 fichiers.
- **Pluriels :** une trentaine sont encore écrits à la main (« + N autres » de l'accueil, factures en retard, import de relevé, mail, barre des routines).
- **Tris et recherches :**
  - `localeCompare` est utilisé au lieu de `collator` 6 fois ;
  - 3 recherches comparent en minuscules au lieu de passer par `normalize`.
- **Validation :**
  - les drapeaux mail redéfinissent la règle de nom et la couleur ;
  - deux expressions de couleur hexadécimale existent en plus de `colorSchema` ;
  - les ressources de projet refont `requiredText` et `optionalText` ;
  - le schéma d'une nouvelle liste d'achats est en double.
- **Accessibilité dans un graphe** (cycle de blocages, prérequis des routines) : écrite deux fois. Cible : `reaches` dans `tree.ts`.

**Fait** :

- `stopClick` est partagé par les fichiers de cellules ;
- `onMutationError` remplace 20 `notifyError(e.message)` ;
- `plural` et `countOf` remplacent la plupart des pluriels écrits à la main ;
- `collator` trie les noms, et `normalize` sert aux trois recherches ;
- les règles partagées (`requiredText`, `optionalText`, `colorSchema`) remplacent leurs copies, et `shoppingListFormSchema` est commun aux deux formulaires de liste ;
- `reaches` (`tree.ts`) vérifie les cycles de blocages et de prérequis.

Restent écrits à la main : quelques pluriels de phrases à plusieurs compteurs (synthèse GitHub, corbeille du mail).

## Plan proposé

1. **Bugs (1, 2) :** quelques lignes chacun.
2. **Sans risque, rapide :**
   - les utilitaires de collections (10) ;
   - les dates et l'argent (11, 12) ;
   - les petites redondances (22).
3. **API, par blocs :**
   - l'ordre et la position suivante, avec la suppression des mutations de déplacement en trop (3) ;
   - les arbres (4) ;
   - le CRUD des listes simples (5) ;
   - les recherches « sinon introuvable » (6) ;
   - le PDF et les tâches de fond (19, 20).
4. **Web, contournements des briques communes :**
   - les panneaux et les fenêtres (7) ;
   - les menus et les boutons d'actions (8) ;
   - les paramètres d'URL (9) ;
   - les requêtes (18).
5. **Web, nouveaux composants communs :**
   - les blocs de page (13) ;
   - les cartes et cellules des tâches (14) ;
   - le mail (15) ;
   - les restes des personnes et des listes (16, 17) ;
   - les champs et badges (21).

## Déjà unifié

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
- **Code partagé :**
  - `filters.ts` et `task-columns.ts` ;
  - `periods.ts` ;
  - `rules.ts` ;
  - `text.ts` ;
  - `table-views.ts`.
- **Utilitaires :**
  - `lib/download`, `lib/text`, `lib/drag`, `lib/fill-height`, `lib/notify` (`onMutationError`) ;
  - `localDay` ;
  - `parisToday` dans l'API.
- **Filtres :** les tableaux de bord et l'accueil filtrent les tâches dans le langage du tableau des tâches.
