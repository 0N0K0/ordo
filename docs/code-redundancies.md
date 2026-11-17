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

À faire : tout ramener à `bulkSaver`.

### 2. Deux moteurs de filtres

- Générique : filtres de colonnes `DataColumn`, évalués dans le navigateur (`components/data-table/table-engine.ts`).
- Ancien, celui des tâches : `TASK_FILTER_FIELDS`, `features/tasks/views/filter-meta.ts` et la requête serveur `matchingTaskIds`. Il sert encore aux tableaux de bord (`features/dashboards/chart-data.ts`) et à l'accueil (`features/home/home-data.ts`).

Même constructeur de filtres à l'écran, mais deux langages et deux moteurs.

### 3. Cellules éditables en double

| Rôle           | Doublons                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Titre          | `TitleCell` (tâches) · `TitleCell` (routines)                                                            |
| Assignés       | `AssigneesCell` (tâches) · `AssigneesCell` (routines)                                                    |
| Projet         | `TaskProjectCell` · `ProjectCell` (routines)                                                             |
| Texte          | `TextCell` (achats) · `EditableText` (générique)                                                         |
| Nombre / durée | `NumberCell` (achats) · `EffortCell` (tâches) · `EstimateCell` (routines) · `EditableNumber` (générique) |

`features/tasks/views/inline-cells.tsx` (675 lignes) et `features/routines/routine-cells.tsx` (506 lignes) n'utilisent pas les cellules génériques de `components/data-table/EditableCells.tsx` ; les achats, la trésorerie et les temps ne s'en servent qu'en partie.

### 4. Deux en-têtes de tableau

`DataTable` a son en-tête TanStack ; l'ancien `DataTableHeader` ne sert plus qu'à la bibliothèque, exclue de la migration. C'est la même logique en double : déplacer, redimensionner, ajuster au contenu, menu de colonne.

## Doublons moyens

### 5. Trois lignes d'ajout presque identiques

`AddTaskRow`, `AddRoutineRow` et `AddShoppingRow` ont le même champ « + Ajouter… (Entrée pour valider) » et la même gestion d'Échap ; seule la création change. À faire : un `AddRowField` générique qui reçoit la fonction de création.

### 6. Arbres de catégories réécrits par domaine

| Domaine       | Fichier                                                         |
| ------------- | --------------------------------------------------------------- |
| Générique     | `components/category-tree` (`categoryTree`, `categoryOptions`)  |
| Trésorerie    | `features/treasury/categories.ts`, avec le sens entrée / sortie |
| Calendrier    | `features/calendar/category-tree.ts`                            |
| Projets       | `features/workspace/tree.ts`                                    |
| Alias simples | `shoppingCategoryTree`, `locationOptions`                       |

La trésorerie et le calendrier pourraient reposer sur le générique avec un filtre.

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
