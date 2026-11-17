# Composants similaires et redondances de code

État au 17 novembre 2026, après le passage de tous les tableaux sur un `DataTable` unique (`apps/web`).

Onze redondances relevées : quatre grosses, quatre moyennes, trois petites. Les plus coûteuses sont les trois mécanismes d'édition en masse et les deux moteurs de filtres : ils obligent à coder chaque nouvelle fonction en double, voire en triple. Le [plan](#plan-proposé) commence par les nettoyages sans risque, qui simplifient les chantiers suivants.

## Gros doublons

### 1. Trois mécanismes d'édition en masse des cellules

Le même rôle est codé trois fois ; les tableaux des tâches et des routines passent par un adaptateur ajouté lors de la migration.

| Mécanisme                                                      | Fichier                                  | Utilisé par                        |
| -------------------------------------------------------------- | ---------------------------------------- | ---------------------------------- |
| Générique (`bulkSaver`)                                        | `components/data-table/bulk-edit.ts`     | achats, trésorerie, fiches, stock… |
| Tâches (`useCellEdit`, `CellSelectionContext`)                 | `features/tasks/views/cell-edit.ts`      | cellules des tâches                |
| Routines (`useRoutineCellEdit`, `RoutineCellSelectionContext`) | `features/routines/routine-cell-edit.ts` | cellules des routines              |

**Fait** : `DataTable` partage sa sélection avec ses cellules (`BulkTableContext`, `useBulkTable`) ; `useCellEdit` et `useRoutineCellEdit` ne sont plus que des couches sur `bulkSaver` (avec leur requête groupée et son annulation), les contextes propres aux tâches et aux routines et leurs adaptateurs sont supprimés.

### 2. Deux moteurs de filtres

- Générique : filtres de colonnes `DataColumn`, évalués dans le navigateur (`components/data-table/table-engine.ts`).
- Ancien, celui des tâches : `TASK_FILTER_FIELDS`, `features/tasks/views/filter-meta.ts` et la requête serveur `matchingTaskIds`. Il sert encore aux tableaux de bord (`features/dashboards/chart-data.ts`) et à l'accueil (`features/home/home-data.ts`).

Même constructeur de filtres à l'écran, mais deux langages et deux moteurs.

**Fait** : les tableaux de bord et l'accueil filtrent les tâches dans le navigateur avec les colonnes du tableau des tâches (`matchTasks`, `useTaskColumns`). Les anciens filtres enregistrés sont traduits à la lecture (`translateTaskFilter` dans `@ordo/shared`), sprints relatifs compris. L'historique par sprint se calcule à partir des statuts de fin de sprint. Supprimés : `matchingTaskIds`, `matchingTaskIdsBySprint`, le service `task-filters` et le constructeur de filtres propre aux tâches. Côté serveur, il ne reste que `doableTaskIds`. Restent pour le point 11 : `TASK_FILTER_FIELDS` et `taskFilterSchema`, qui servent encore au schéma des anciennes vues de tâches.

### 3. Cellules éditables en double

| Rôle           | Doublons                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Titre          | `TitleCell` (tâches) · `TitleCell` (routines)                                                            |
| Assignés       | `AssigneesCell` (tâches) · `AssigneesCell` (routines)                                                    |
| Projet         | `TaskProjectCell` · `ProjectCell` (routines)                                                             |
| Texte          | `TextCell` (achats) · `EditableText` (générique)                                                         |
| Nombre / durée | `NumberCell` (achats) · `EffortCell` (tâches) · `EstimateCell` (routines) · `EditableNumber` (générique) |

`features/tasks/views/inline-cells.tsx` (675 lignes) et `features/routines/routine-cells.tsx` (506 lignes) n'utilisent pas les cellules génériques de `components/data-table/EditableCells.tsx` ; les achats, la trésorerie et les temps ne s'en servent qu'en partie.

**Fait** :

- Titre : un `EditableTitle` générique. Un clic ouvre la ligne (page de la tâche, formulaire de la routine), un double-clic renomme.
- Assignés et projet : `AssigneesCell` et `ProjectCell` partagés par les tâches et les routines (`features/tasks/views/context-cells.tsx`).
- Texte et nombres : `EditableText` et `EditableNumber`, qui acceptent désormais la règle zod du champ, un lien ouvrable, des bornes et l'enregistrement d'une valeur inchangée sur une sélection. `TextCell`, `NumberCell`, `EffortCell` et `EstimateCell` ne sont plus que des appels de ces cellules, ou ont disparu.
- Styles des champs et touches Entrée / Échap : un seul `cell-field.ts`, au lieu de cinq copies.

Restent propres à leur domaine les cellules sans équivalent générique : statut, jalon, sprint, dépendances, horaires, conservation…

### 4. Deux en-têtes de tableau

`DataTable` a son en-tête TanStack ; l'ancien `DataTableHeader` ne sert plus qu'à la bibliothèque, exclue de la migration. C'est la même logique en double : déplacer, redimensionner, ajuster au contenu, menu de colonne.

**Écarté** : la bibliothèque de documents doit être revue entièrement ; son en-tête suivra cette refonte.

## Doublons moyens

### 5. Trois lignes d'ajout presque identiques

`AddTaskRow`, `AddRoutineRow` et `AddShoppingRow` ont le même champ « + Ajouter… (Entrée pour valider) » et la même gestion d'Échap ; seule la création change.

**Fait** : un `AddRowField` générique (`components/data-table/AddRowField.tsx`) reçoit la règle du nom et la fonction de création. Le champ se vide dès Entrée et le nom revient si la création échoue ; un nom invalide est signalé. Un `AddRowButton` sert quand l'ajout ouvre autre chose : le formulaire d'une tâche sans projet, le menu des achats.

### 6. Arbres de catégories réécrits par domaine

| Domaine       | Fichier                                                         |
| ------------- | --------------------------------------------------------------- |
| Générique     | `components/category-tree` (`categoryTree`, `categoryOptions`)  |
| Trésorerie    | `features/treasury/categories.ts`, avec le sens entrée / sortie |
| Calendrier    | `features/calendar/category-tree.ts`                            |
| Projets       | `features/workspace/tree.ts`                                    |
| Alias simples | `shoppingCategoryTree`, `locationOptions`                       |

La trésorerie et le calendrier pourraient reposer sur le générique avec un filtre.

**En cours** (étape 1 sur 4, l'affichage) :

- La trésorerie et le calendrier reposent sur l'arbre générique. Les chemins et les sous-arbres sont dans `category-tree.ts`, et la copie du calendrier est supprimée.
- Toute option d'arbre porte son chemin complet (« Client › Projet », « Maison › Cuisine »), qui s'affiche une fois choisie ; la liste déroulante garde le nom seul, indenté.
- « Sans client » et « Sans projet » ne figurent plus dans les chemins, et les tâches sans numéro n'affichent plus « #null ».

Étape 2 faite : dans tous les multi-selects (`BatchMultiSelect`), les items choisis s'empilent dans le champ, 5 au plus, sinon 4 et « X de plus » / « Réduire ».

Étape 3 faite : un seul composant de liste paramétrable, `SettingsList`, plate ou en arbre. Chaque item a un avatar (son image, sinon ses initiales sur sa couleur) et se modifie dans le panneau latéral (nom, couleur, image, parent, champs propres à la liste). Il se réordonne par glisser-déposer et, dans un arbre, se range sous un autre. `LabelManager` et `CategoryTreeManager` sont supprimés. Côté API, `setSettingsItemLook` (couleur, image) et `reorderSettingsItems` (ordre) servent toutes les listes. Toutes les listes y passent : tâches, projets, documents, fiches, achats, routines, stock, drapeaux, calendriers, types de plages, catégories d'agenda et trésorerie (comptes, contextes, catégories, moyens de paiement, tiers). Les listes de base gardent leurs onglets, avec le même formulaire et leur avatar.

Restent : un modèle unique de liste paramétrable (couleur, image, nom, glisser-déposer), et les lieux sur ce modèle.

### 7. Actions de sélection et dialogues dupliqués

- `useTaskSelectionActions` et `useRoutineSelectionActions` refont les actions groupées (fermer ou cocher, dupliquer, archiver, supprimer) à côté des actions génériques `deleteRowsAction` et `duplicateRowsAction`.
- `CloneTaskDialog` (une tâche) et `BulkCloneDialog` (plusieurs) se recoupent.

### 8. Deux panneaux de colonnes et deux calculs de hauteur

- Colonnes : `features/tasks/views/ColumnsPanel.tsx` (réglages des colonnes par défaut des tâches) et `DataColumnsPanel` générique.
- Hauteur : `useFillHeight` (lieux, mails) et `useTableHeight` (tableaux) font le même calcul.

## Petites redondances

### 9. Fonctions utilitaires recopiées

| Fonction                                       | Copies                       | Où la ranger             |
| ---------------------------------------------- | ---------------------------- | ------------------------ |
| `new Intl.Collator('fr', …)`                   | 11                           | `lib/collator` (à créer) |
| `localDay`                                     | 6, dont celle de `lib/dates` | `lib/dates`              |
| `printedDay`                                   | 5 variantes                  | `lib/format`             |
| `normalize`                                    | 3                            | `lib/`                   |
| `dayText`, `suppressClickAfterDrop`, `ofMonth` | 2 chacune                    | `lib/`                   |

### 10. Code commun rangé chez les tâches

`components/data-table` importe depuis `features/tasks/…` des pièces communes à tous les tableaux, qui devraient vivre dans `components/` :

- `column-fit` ;
- `FilterBuilder` et `filter-meta` ;
- `ViewTabs` ;
- `use-saved-views`.

### 11. Code mort depuis les vues génériques

- Côté serveur et code partagé, les schémas des vues `TASKS`, `ROUTINES` et `SHOPPING_LISTS` (`routineViewConfigSchema`, `shoppingListViewConfigSchema`, `taskViewConfigSchema`) ne servent plus qu'à valider d'anciennes vues.
- `firstRoutineViews` et `firstShoppingListViews` ne sont plus utilisés nulle part.

## Plan proposé

Cinq chantiers, du moins risqué au plus structurant ; chacun prépare le suivant.

1. **Points 9 et 10** : utilitaires dans `lib/`, pièces communes dans `components/`. Sans risque, rapide.
2. **Point 5, puis point 3** : une ligne d'ajout commune, puis des cellules partagées (titre, assignés, projet et nombres d'abord).
3. **Point 1** : un seul mécanisme d'édition en masse, possible une fois les cellules unifiées.
4. **Point 2, puis point 11** : tableaux de bord et accueil sur le moteur générique, puis suppression de `matchingTaskIds`, de l'ancien langage de filtres et des anciens schémas de vues.
5. **Points 4, 6, 7 et 8** selon les priorités. Le point 4 suppose de passer la bibliothèque sur `DataTable`, à décider puisqu'elle avait été exclue.
