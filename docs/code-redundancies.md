# Composants similaires et redondances de code

État au 17 novembre 2026, après une première série d'unifications (voir [Déjà unifié](#déjà-unifié)).

Les plus coûteuses des redondances restantes sont les enveloppes de mutations du web et la logique d'ordre et de CRUD des listes dans l'API, recopiées liste par liste. Viennent ensuite les doublons d'interface : onglets triables, actions « une ligne » contre « plusieurs », deux modèles de personnes.

La bibliothèque de documents n'est pas traitée : elle sera refaite entièrement.

## Gros doublons

### 1. Mutations du web : la même enveloppe recopiée par fonctionnalité

- **Enveloppe simple** (une mutation puis l'invalidation de ses requêtes) : une vingtaine de copies, dans `github`, `alarms`, `tasks` (×2), `treasury`, `stock`, `time`, `calendar`, `library`, `dashboards`, `sheets`, `mail`, `shopping` et `accounting/catalog-api`. Il y a même trois `useAccountingMutation` du même nom, dans `accounting/api.ts`, `documents-api.ts` et `tracking-api.ts`.
- **Variante optimiste** (annulation, instantané, modification, retour arrière, invalidation) : copiée dans `routines/api.ts`, `shopping/api.ts` et `workspace/api.ts`, et faite à la main dans `tasks/api.ts` et `dashboards/api.ts`.
- **Au total :** environ 350 lignes. Les clés invalidées sont parfois écrites en dur (`['shopping']` dans le stock et les fiches).
- **Styles mélangés :** `workspace/api.ts` a un hook par mutation, quand les autres fonctionnalités les regroupent dans un `useXMutations()`.
- **Cible :** `lib/mutation.ts`, avec une `useInvalidatingMutation(clés, fn, { optimiste? })`. La version de `workspace/api.ts` a déjà la bonne forme.

### 2. API : déplacement, position suivante et CRUD recopiés liste par liste

- **Déplacement dans une liste plate :** une vingtaine de fonctions `moveX(id, index)`, toutes bâties sur `moveInOrder`. Elles se trouvent dans `clients`, `calendars`, `statuses`, `document-statuses`, `milestones`, `dashboards`, `task-views`, `project-resources`, `labels`, `mail/accounts`, `workspaces`, `shopping` (magasins, modes de conservation, listes de base, unités) et `sheets`.
- **Mutations GraphQL en trop :** la plupart de ces listes sont des listes paramétrables, déjà servies par `reorderSettingsItems`. Le web leur passe pourtant encore leurs propres mutations de déplacement : `moveShoppingStore`, `moveTaskStatus`, `moveProjectStatus`, `moveSheetCategory`, `moveDocumentStatus`…
- **Déplacement dans un arbre :** `moveCategory` est recopié presque ligne pour ligne dans `shopping`, `treasury-settings`, `routines`, `stock` et `calendar-categories`. `movePlace` en est une variante.
- **Position suivante :** `_max: { position }` est réécrit environ 25 fois, alors que `nextPosition` existe dans `settings-lists.ts`.
- **CRUD des listes nom et couleur :** `createLabelService` ne sert qu'aux libellés des tâches. Les magasins, modes de conservation, unités, statuts de projet, catégories de fiches et statuts des documents ont chacun leur CRUD écrit à la main. Les modules GraphQL répètent leurs quatre champs (créer, modifier, supprimer, déplacer), soit 63 champs en tout.
- **Cible :**
  - dans `services/ordering.ts`, des fonctions `moveFlat`, `moveInTree` et `nextPosition` génériques ;
  - `createLabelService`, étendu et piloté par `SETTINGS_LISTS`, avec un utilitaire GraphQL qui déclare les quatre champs d'une liste ;
  - les listes plates réordonnées par `reorderSettingsItems` seulement.

### 3. Onglets triables : trois copies identiques

- **Où :** `SortableTab` est identique dans `components/data-table/ViewTabs.tsx`, `features/shopping/BaseLists.tsx` et `features/dashboards/DashboardBoard.tsx`.
- **Ce qui se répète :** la barre entière, avec les onglets, le glisser-déposer horizontal, le menu (renommer, déplacer à gauche ou à droite, supprimer) et l'onglet choisi dans l'URL. Environ 150 lignes.
- **Cible :** un composant `components/SortableTabs`, avec des emplacements pour le contenu de l'onglet et pour le menu, que `ViewTabs` utiliserait lui aussi.

### 4. Actions sur une ligne contre actions sur plusieurs

- **Dialogues des tâches :** `TaskDialogs.tsx` (supprimer, transférer une tâche) double `BulkDialogs.tsx` (les mêmes sur plusieurs tâches). On y retrouve le même choix « Que faire de ses sous-tâches », les mêmes boutons et les mêmes messages.
- **« N liens retirés » :** le message est construit quatre fois, et une cinquième fois en « lien(s) retiré(s) ».
- **Ouverture des dialogues :** deux fonctions `openDialog` différentes. `BulkTransferDialog` refait aussi `outermost` à la main.
- **Routines :** le menu d'une ligne archive sans annulation, supprime avec un autre texte et duplique par le formulaire. La barre de sélection archive avec annulation et duplique avec les sous-routines. Les deux chemins se comportent donc différemment.
- **API :** les actions groupées enveloppent déjà les actions unitaires. Les points d'entrée unitaires (archiver, supprimer, transférer une tâche ; archiver, supprimer une routine) sont donc en trop.
- **Cible :**
  - un seul dialogue par action, sur une liste de tâches (une seule tâche étant une liste d'une) ;
  - les menus d'une ligne construits avec les mêmes actions génériques que la barre de sélection ;
  - les seules mutations groupées.

### 5. Deux modèles de personnes

- **Bénéficiaires :** clés `c:` et `r:` (`features/beneficiaries`).
- **Achats, stock et trésorerie :** `memberIds` et `relationIds`, avec des clés `m:` et `r:`. `PeopleCell` (achats) refait `BeneficiariesCell`.
- **Sélecteurs de contributeurs :** l'agenda (`EventForm`, sans avatars) et l'équipe de la trésorerie (`TeamPanel`) écrivent le leur au lieu d'utiliser `AssigneesSelect`. L'affichage des contributeurs avec leur avatar est recopié trois fois, et `EventPeopleCell` refait `AssigneesCell`.
- **Cible :**
  - `components/people`, avec `PeopleSelect` et `PeopleCell`, un seul schéma de clés et un seul rendu avec avatar ;
  - `AssigneesCell` pour les évènements aussi.

## Doublons moyens

### 6. Ouverture des panneaux et des fenêtres

- **Le constat :** 30 fichiers gardent leur propre compteur (`let modalCount = 0`) avec `openPanel` et `closePanel`, alors que `openFormPanel` existe. Une quinzaine d'entre eux sont des fichiers de 15 à 20 lignes qui ne font qu'ouvrir un panneau.
- **Cible :** `openFormPanel` partout, et son équivalent pour les fenêtres, `openModal`.

**Fait** : `openFormPanel` (options : largeur, verrouillage, action à la fermeture, identifiant fixe pour un panneau qui se remplace) et `openModal` (`components/panels/open-modal.ts`) ouvrent tous les panneaux et toutes les fenêtres ; plus aucun compteur propre à un fichier. `confirmDestructive` reste la confirmation des actions destructives. Corrigé au passage : le panneau du nom d'un tableau de bord ne se fermait pas à l'enregistrement (il était fermé comme une fenêtre).

### 7. Boutons de bas de formulaire

- **Le constat :** « Annuler » et le bouton d'envoi, alignés à droite, sont écrits à la main dans environ 45 formulaires, avec des écarts qui varient.
- **Cible :** un `FormActions` à côté de `DestructiveActions`, qui prend le texte du bouton, l'état d'envoi et l'annulation.

**Fait** : `FormActions` (`components/dialogs/FormActions.tsx`), à côté de `DestructiveActions`, dans 78 formulaires et dialogues : « Annuler » (facultatif) puis l'action, avec son texte, son icône, son attente, sa désactivation, et un envoi par clic quand il n'y a pas de formulaire. Deux copies locales de `FormActions` (facturation, trésorerie) sont supprimées. Restent à part : les boutons collés à un champ (ajouter un membre, un élément, un espace…), la validation d'une facture (l'action d'abord, comme une action irréversible), et les dialogues qui n'ont qu'« Annuler ».

### 8. Cartes de section des paramètres

- **Le constat :** le même bloc (cadre, titre, description et actions) est recopié une quinzaine de fois, en deux tailles de titre : utilisateurs, calendriers, comptes mail, espaces, GitHub, compte, entreprise, équipe de la trésorerie, colonnes par défaut…
- **Un composant inutilisé :** `components/actions/SectionHeader.tsx` existe mais n'est importé nulle part.
- **Cible :** une `SettingsSection` construite sur `SectionHeader`, que `SettingsList` utiliserait aussi.

**Fait** : `SettingsSection` (`components/settings/SettingsSection.tsx`), construite sur `SectionHeader`, dans 22 cartes : utilisateurs, calendriers, comptes mail, espaces, GitHub, compte, entreprise, facturation, équipe et paramètres de la trésorerie, colonnes par défaut, et `SettingsList` elle-même. Une seule taille de titre. Deux copies locales (compte, agenda) sont supprimées. Restent à part les sections de l'éditeur de documents (`EditorSection`, plus denses) et les cartes des pages de la trésorerie (budgets), qui ne sont pas des paramètres.

### 9. Parcours d'arbres et chemins réécrits

- **Web :**
  - **sous-arbres :** `subtreeOf` (formulaire des routines), `subtreeIds` (tâches), `descendantIds` (projets) ;
  - **chaînes de parents :** `routinePath`, `categoryLineage`, `rootPlace`, les achats, le contexte des tâches, les contributeurs d'un projet, la page d'un projet ;
  - **glisser-déposer :** `ProjectList.tsx` refait `treeDestination` ;
  - **séparateur :** `LEVEL` est redéfini dans `geo/api.ts`, et « › » est écrit en dur dans `treasury/lines.ts`.
- **API :**
  - **chemins :** PDF de trésorerie, lieux, prêts ;
  - **sous-arbres et ancêtres :** temps, tâches, synchronisation GitHub ;
  - **existant à réutiliser :** `projects.ts` a sa propre classe privée `ProjectTree`.
- **Cible :**
  - côté web, `ancestors`, `lineage` et `subtree` dans `category-tree.ts`, et une contrainte facultative pour `treeDestination` ;
  - côté API, un `services/tree.ts`, ou des utilitaires d'arbre placés dans le code partagé.

**Fait** : `packages/shared/src/tree.ts` (`LEVEL`, `subtreeOf`, `lineageOf`, `ancestorsOf`, `pathOf`, à l'abri des cycles), utilisé par le web et l'API. Remplacés : les sous-arbres des routines, des tâches, des projets, des catégories, des temps et des liens GitHub ; les chaînes de parents des routines, de la trésorerie, des lieux, des achats, des tâches et des projets ; les chemins des catégories du PDF de trésorerie et des lieux ; les séparateurs « › » écrits en dur. Restent à part : la `ProjectTree` de l'API (une vue en mémoire avec ses enfants, plus rapide pour ses nombreux usages), le sous-arbre de la synchronisation GitHub (chargé niveau par niveau en base), et le dépôt de la liste des projets, qui a ses règles (projets archivés, profondeur maximale) en plus de la détection de cycle, désormais partagée.

### 10. Téléchargements et exports PDF ou CSV

- **Téléchargement :** `lib/download.ts` est recopié dans `dashboards/chart-image.ts`, et refait à la main dans les achats, l'archive des documents et les relevés.
- **Export PDF de tableau :** l'appel à `/api/exports/table.pdf` est écrit trois fois (tableaux, achats, graphiques).
- **CSV :** l'échappement et le BOM sont écrits deux fois.
- **Cible :** `postPdf` et `toCsv` dans `lib/download.ts`.

**Fait** : `lib/download.ts` regroupe `download` (un blob ou une image en data URL), `fileName`, `fetchDownload` (un fichier servi par l'API : archive des documents, relevé), `postExport` (un export construit par l'API : graphiques, agenda), `postTablePdf` (le PDF d'un tableau : tableaux, achats, graphiques) et `downloadCsv` (au format des tableurs français). Les copies de `chart-image.ts` (`saveFile`, `exportFileName`) et les téléchargements écrits à la main sont supprimés ; les erreurs de l'API sont lues de la même façon partout.

### 11. Calcul des périodes de calendrier

- **Où :** le même calcul existe dans trois endroits, `shared/dashboards.ts` (`calendarStart`, `shiftCalendar`…), `treasury/chart-period.ts` (`periodStart`, `shiftPeriod`…) et `lib/periods.ts`.
- **Cible :** des utilitaires de périodes dans le code partagé.

**Fait** : `packages/shared/src/periods.ts` (`CalendarScale`, `calendarStart`, `shiftCalendar`, `calendarEnd`). Les périodes des graphiques (`calendarRange`), le graphique de solde de la trésorerie et les périodes proposées des exports reposent dessus ; `chart-period.ts` ne garde que les noms des échelles et des périodes.

### 12. Édition des cellules : tâches et routines jumelles

- **Le constat :** `useCellEdit` et `useRoutineCellEdit` font environ 40 lignes chacun, identiques aux types près. L'annulation des modifications groupées est elle aussi séparée en deux.
- **Cible :** un `useEntityCellEdit` dans `bulk-edit.ts`.

### 13. Autres doublons d'interface

- **Abonnements aux autres espaces :** les calendriers et les types de plages ont chacun leur liste, regroupée par espace, avec un interrupteur d'abonnement.
- **Jalons et sprints :** les deux panneaux se ressemblent, avec la même carte de progression, le même compte « faites / total » et la même confirmation de suppression (mal mise en forme dans les deux).
- **Clients :** leur sélecteur est écrit trois fois dans la facturation, et leurs groupes deux fois dans la trésorerie. Cible : un `ClientSelect` avec avatar.
- **Pastilles de couleur à la place des avatars :** encore dans les calendriers, les types de plages, les statuts des documents, le mode magasin et les plages de travail.
- **Badges des listes paramétrables :** `LabelBadge` est générique mais rangé dans les tâches, et d'autres écrans font leurs propres badges colorés (page d'un projet, liste des projets, accueil, trésorerie, mails, suivi des documents). Cible : un `ItemBadge` dans `components/settings`.
- **Catégories de fiches :** le formulaire d'une fiche les affiche par leur nom seul, sans `listSelectProps`.

### 14. Glisser-déposer : capteurs recopiés

- **Le constat :** la configuration des capteurs est écrite 14 fois, avec une distance d'activation qui varie (4 ou 6 pixels). La détection « sous le pointeur, sinon le plus proche » est écrite trois fois.
- **Cible :** `useDragSensors` et la détection commune dans `lib/drag.ts`.

**Fait** : un seul `useDragSensors` dans `lib/drag.ts`, avec une distance de 5 pixels partout, et le clavier là où il était. La bibliothèque garde sa configuration en attendant sa refonte. La détection « sous le pointeur, sinon le plus proche » reste propre à l'arbre et au tableau, qui ne la font pas de la même façon.

### 15. Code partagé : `task-filters.ts` mélange le générique et les tâches

- **Le constat :** la mécanique de filtres commune (opérateurs, périodes, schémas de conditions et de groupes) y est rangée à côté des colonnes, des regroupements et des colonnes par défaut des tâches.
- **Cible :**
  - séparer en `filters.ts` (générique) et `task-columns.ts` (tâches) ;
  - garder `task-filter-translation.ts` pour les anciens filtres des tableaux de bord seulement.

### 16. Règles de validation qui divergent

- **Couleurs :** `colorSchema` (code partagé) n'accepte que `#rrggbb`. L'API (`settings-lists.ts`) accepte aussi les noms de la palette, et le web envoie `'gray'`.
- **Noms :** certains schémas sont définis dans les services de l'API (`workspaces`, `library`, `recurring-invoices`). Une quarantaine de règles « nom requis, N caractères au plus » sont réécrites à la main dans le code partagé.
- **Cible :** un `requiredText(max)` partagé, à côté de `optionalText`, et un seul schéma de couleur.

## Petites redondances

### 17. Pluriels et libellés de nombres

- **Le constat :** environ 80 `${n} truc${n > 1 ? 's' : ''}` sont écrits à la main.
- **Libellés éparpillés :** `tasksLabel`, `routinesLabel`, `entries` (trésorerie), `countLabel` (graphiques).
- **Un existant ignoré :** `selectedLabel` existe, mais la page des tâches et celle des routines le refont.
- **Cible :** `plural` et `countOf` dans `lib/text.ts`.

**Fait** : `plural` et `countOf` dans `lib/text.ts`, à la place du motif écrit à la main dans 22 fichiers. Une trentaine de formes plus libres (« lien(s) », pluriels d'adjectifs dans des phrases composées) restent à reprendre au cas par cas.

### 18. Petits utilitaires de dates et de texte

- **Jour de la semaine :** `weekdayOfDate` est en double, `weekdayOf` aussi.
- **Écart en jours :** `daysBetween` est en double (accueil et code partagé).
- **Noms des jours :** définis quatre fois. Les ordinaux, deux fois.
- **Alias d'une ligne :** des alias de `fmt.day` dans cinq fichiers. `todayIso` est un alias de `localToday`.
- **« Aujourd'hui » dans l'API :** calculé trois fois, de trois façons (heure du serveur, Europe/Paris, UTC).
- **Texte sans accents :** la recherche GitHub (web et API), le code partagé et l'équipe de la trésorerie refont `normalize`.
- **Cible :** `normalize` et `collator` déplacés dans le code partagé.

**Fait** : `normalize` et `collator` sont dans le code partagé (`text.ts`), utilisés par le web, l'API et GitHub ; un seul `weekdayOfDate` ; une seule liste des noms des jours ; `daysBetween` partagé ; les alias de `fmt.day` et `todayIso` supprimés. « Aujourd'hui » de l'API : un seul `parisToday` (`apps/api/src/today.ts`), le jour à Paris quel que soit le fuseau du serveur. Restent les ordinaux en double.

### 19. Messages d'erreur

- **Le constat :** `onError: (error) => notifyError(error.message)` est écrit environ 124 fois.
- **Cible :** un `onMutationError` exporté, ou une valeur par défaut dans l'enveloppe de mutations (point 1).

**Fait** : `onMutationError` dans `lib/notify.tsx`, à la place de 177 copies.

### 20. Code mort

- **Fichiers web inutilisés :** `components/actions/SectionHeader.tsx`, `components/data-table/SortableRow.tsx`.
- **Exports web jamais utilisés :** `TimeWindowCell` (environ 100 lignes), `categoryGrouping`, `PeopleBadges`, `isExpired`, `blankSheetItem`, `bulkCount`, `weekdayOfMonth`, `formatDayMonth`.
- **Exports de l'API jamais utilisés :** `currentWeek`, `maybeWorkspace`, `enterWorkspace`, `modeOf`, `listCalendars`.
- **Exports partagés jamais utilisés :** `SLOT_CONDITION_OPERATORS`, `windowsWithin`, `slotWindows`, `newRepetitionCase`, `casesOccurrences`, `zonedDate`, `periodRhythm`.
- **Exports utilisés seulement dans leur fichier :** une trentaine côté web, une vingtaine côté API, une soixantaine dans le code partagé. Le mot-clé `export` y est en trop.

**Fait** : `SortableRow.tsx` et une vingtaine de fonctions et composants jamais utilisés supprimés (web, API, code partagé) ; le mot-clé `export` retiré de 192 noms utilisés seulement dans leur fichier. `SectionHeader` est gardé : il servira de base aux cartes de section (point 8). Les alias de types jamais importés sont gardés : ils décrivent les schémas. `enterWorkspace` n'était pas mort : il sert au seed.

## Plan proposé

1. **Sans risque, rapide (fait) :** le code mort (20), les petits utilitaires (17, 18, 19) et les capteurs de glisser-déposer (14).
2. **Briques d'interface communes :**
   - `FormActions` (7), `SettingsSection` (8) et `openFormPanel` partout (6) ;
   - `SortableTabs` (3) ;
   - `ItemBadge`, `ClientSelect` et les avatars restants (13).
3. **Données :**
   - l'enveloppe de mutations du web (1) ;
   - côté API, l'ordre et le CRUD des listes, avec la suppression des mutations de déplacement en trop (2).
4. **Comportements :**
   - une action par opération, d'une ligne à plusieurs (4) ;
   - les personnes (5) ;
   - l'édition des cellules (12) ;
   - les arbres (9).
5. **Code partagé :** la séparation de `task-filters.ts` (15), la validation (16), les périodes (11) et les exports (10).

## Déjà unifié

- **Tableaux et édition :**
  - un seul `DataTable` pour tous les tableaux de données ;
  - une seule édition en masse (`bulkSaver`) ;
  - des cellules communes : `EditableCells`, `EditableTitle`, `cell-field`, les cellules assignés et projet ;
  - une seule ligne d'ajout (`AddRowField`) ;
  - des actions de sélection communes (`selection-actions`) et un seul dialogue de clonage.
- **Filtres :** les tableaux de bord et l'accueil filtrent les tâches dans le langage du tableau des tâches. L'ancien langage de filtres et les anciens schémas de vues sont supprimés.
- **Listes paramétrables :** un seul modèle, `SettingsList`, plat ou en arbre, avec couleur, image, nom et glisser-déposer, lieux compris. Les items s'affichent avec leur avatar partout.
- **Hiérarchies :** les arbres reposent sur `category-tree` ; tout item hiérarchisé s'affiche par son chemin complet ; les multi-selects empilent leurs valeurs.
- **Utilitaires :** `lib/text` (`collator`, `normalize`), `lib/drag`, `lib/fill-height`, `localDay`. Les pièces communes sont sorties de `features/tasks` vers `components/`.
- **Colonnes par défaut des vues de tâches :** elles passent par le panneau de colonnes générique.
