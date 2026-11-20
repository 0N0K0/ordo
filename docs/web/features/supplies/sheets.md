# Code web : fiches

Tous les fichiers de `apps/web/src/features/sheets/` (api, pages, components, lib) avec leurs exports et fonctions internes notables. Fonctionnalités : [Fiches](../../../features/supplies/sheets.md) ; règles : [Règles des fiches](../../../business-rules/supplies/sheets.md).

## `api/`

### `api/index.ts`

Requêtes et mutations GraphQL des fiches et listes à cocher.

| Export                           | Rôle                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Sheet`                          | Type d'une fiche de la liste (`SheetsQuery`), avec ses éléments et `usedBy`.                                                    |
| `SheetDetail`, `SheetDetailItem` | Fiche de sa page (`SheetQuery`) et son élément.                                                                                 |
| `SheetCategory`                  | Catégorie de fiches.                                                                                                            |
| `SheetItem`                      | Élément d'une fiche de la liste.                                                                                                |
| `SheetLink`                      | Rattachement (`sheetId`, `multiplier`).                                                                                         |
| `Checklist`, `ChecklistItem`     | Liste à cocher et son élément (avec `sources`, `checkedAt`).                                                                    |
| `SheetOwner`                     | `{ routineId } \| { eventId } \| { taskId }`.                                                                                   |
| `sheetsKey`                      | Clé de cache `['sheets']` (toutes les requêtes du dossier en dépendent ; archivage via `useSetArchived('SHEET', [sheetsKey])`). |
| `useSheets(projectId?)`          | Fiches, toutes ou d'un projet. Utilisée aussi par `features/shopping/components/ShoppingSettings.tsx` (usage des catégories).   |
| `useSheet(id)`                   | Une fiche avec ses éléments.                                                                                                    |
| `useSheetCategories()`           | Catégories de fiches.                                                                                                           |
| `useSheetLinks(owner)`           | Fiches d'une routine, d'un évènement ou d'une tâche (`null` : rien chargé).                                                     |
| `useChecklist(owner)`            | Liste à cocher d'un propriétaire et d'une occurrence (faite côté API à la première demande).                                    |
| `useSheetMutations()`            | Mutations (toutes invalident `sheetsKey` et `shoppingKey`).                                                                     |

Clés de `useSheetMutations()` : `create`, `update`, `addItem`, `addProducts`, `updateItem`, `removeItems`, `use` (`useSheet`, renvoie `{ taken, short }`), `createCategory`, `updateCategory`, `deleteCategory`, `duplicate`, `remove`, `addToShoppingList`, `removeFromShoppingList`, `setLinks`, `resetChecklist`, `addToChecklist`, `addChecklistItem`, `updateChecklistItem`, `setChecked`, `removeChecklistItem`. `useSheetMutations` est aussi utilisé par `features/shopping/pages/ShoppingListPage.tsx`.

Internes : `ownerVariables(owner)` (variables `routineId` / `eventId` / `taskId`), `useSheetMutation(fn)`, documents GraphQL.

## `pages/`

### `pages/SheetsPage.tsx`

| Export         | Rôle                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- |
| `SheetsPage()` | Page `/sheets` : en-tête, `SheetsTable`, `SheetsSettings`. Route dans `app/router.tsx`. |

### `pages/SheetPage.tsx`

| Export        | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SheetPage()` | Page `/sheets/:id` : `DetailHeader` (retour, badge archivée, sous-titre, « Utiliser cette fiche », menu Dupliquer / Archiver / Supprimer), `SheetFields`, tableau des éléments (vue `sheet-items`, colonnes produit, catégorie, quantité, unité, consommable, colonnes des achats, facultatif, description en markdown `EditableMarkdown`, commentaires), ligne d'ajout (reconnaît un produit par son nom, valeur du groupe via `itemGroupFields`), « Depuis les références », retrait, `SheetsSettings`. Squelette au chargement, `DetailNotFound` si absente. Route dans `app/router.tsx`. |

Internes : `ItemChange`, `SheetProductsForm({ sheetId, onDone })` (produits des références groupés par liste de base, `addProducts`), `SheetFields({ sheet })` (libellé, projet, catégories, note sur `useFieldSave` + `sheetSchema` : enregistrés chacun dès qu'il change, les textes en les quittant, décision D22 ; `SaveStatus` ; la fiche du cache suivie par `saved` ; lecture seule si archivée), `SheetValues`, `sheetValues(sheet)`, `addRow(group)`.

## `components/`

### `components/SheetsTable.tsx`

| Export                        | Rôle                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SheetsTable({ projectId? })` | Tableau des fiches (vue `sheets`) : ligne cliquable vers la page, catégories et projet éditables (en masse), éléments empilés, interrupteur des archivées, « Nouvelle fiche », menu (Modifier / Voir, Utiliser, Dupliquer, Archiver, Supprimer), sélection (Dupliquer, Archiver, Supprimer). Utilisé par `SheetsPage` et `features/projects/pages/ProjectPage.tsx` (onglet « Fiches »). |

Internes : `sheetColumns(context, categories, inProject)` (colonnes `label`, `categories`, `project`, `items`, `usedBy`, `updatedAt`), `createSheet()`.

### `components/ChecklistPanel.tsx`

| Export                                       | Rôle                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChecklistPanel({ owner, occurrenceDate? })` | Liste à cocher (vue `checklist`) : compteur faits / total, « Ajouter une fiche » (`SheetPicker`), « Refaire depuis les fiches » (confirmation), colonnes Fait, Élément, Quantité, Unité, Catégorie, Consommable, Description (`EditableMarkdown`), Fiches ; édition sur place et en masse, ligne d'ajout, retrait ; `SheetLinksField` en dessous. Sans liste : état vide et champ des fiches. |

Interne : `ItemChange`, `saveItem(item, change)` (coche par `setChecked`, sinon `updateChecklistItem` avec les autres champs gardés).

### `components/SheetsSection.tsx`

| Export                                             | Rôle                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SheetsSection({ owner, occurrenceDate?, label })` | Section « Fiches » (`SheetLinksField`) et bouton « Liste à cocher » ouvrant `ChecklistPanel` dans le panneau latéral. Utilisé par `features/routines/components/RoutineForm.tsx`, `features/calendar/components/EventForm.tsx`, `features/tasks/components/TaskPanel.tsx`. |

### `components/SheetLinksField.tsx`

| Export                       | Rôle                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SheetLinksField({ owner })` | Fiches attachées avec leur multiplicateur, une fois chargées (`useSheetLinks`) : rend `SheetLinksForm`. |
| `SheetLinksForm({ owner, links })` (interne) | Enregistré champ par champ (décision D22, `useFieldSave` sur `sheetLinksFormSchema`, `setLinks` avec toutes les fiches) : fiche choisie, ajoutée ou retirée aussitôt (`commit`), multiplicateur en le quittant (`getInputProps`, erreur dessous) et à la fermeture du panneau (décision FJ) ; fiches du cache suivies (`saved`) ; fiches archivées non proposées sauf déjà attachées ; « Ajouter une fiche » prend la première libre. Dans la garde eslint D22 (`D22_PANELS`). Types internes `LinkValue`, `LinksValues`. |

### `components/SheetPicker.tsx`

| Export                                                | Rôle                                                                                                                                                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SheetPicker({ onAdd, present?, onRemove?, onDone })` | Choix d'une fiche (non archivée) et d'un multiplicateur à ajouter à une liste ; liste des fiches présentes avec « Retirer » (confirmation) si `present` et `onRemove` sont donnés. Utilisé par `ChecklistPanel` et `features/shopping/pages/ShoppingListPage.tsx`. |

Interne : `SheetPickerProps`.

### `components/SheetUseForm.tsx`

| Export                                     | Rôle                                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SheetUseForm({ sheetId, label, onDone })` | « Utiliser « … » » : multiplicateur, mutation `use`, toast de succès ou d'information (manques, rien de suivi en stock). Utilisé par `SheetPage` et `SheetsTable`. |

### `components/MultiplierInput.tsx`

| Export                   | Rôle                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `MultiplierInput(props)` | `NumberInput` de 0,25 à 999, 2 décimales, format français, préfixe « × ». Utilisé par `SheetLinksField`, `SheetPicker`, `SheetUseForm`. |

### `components/SheetsSettings.tsx`

| Export             | Rôle                                                                                                                                                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SheetsSettings()` | Barre latérale « Paramètres des fiches » : `SettingsList` des catégories de fiches (`SHEET_CATEGORY`, `labelFormSchema`, usage par fiche) et `ShoppingCategories` (usage par produits, éléments de listes et de fiches). Utilisé par `SheetsPage` et `SheetPage`. |

## `lib/`

### `lib/sheet-format.ts`

| Export                           | Rôle                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sheetInput(sheet, change)`      | `SheetInput` complet d'une fiche avec des champs changés (mise à jour complète par `updateSheet`).                                                                                                                                                                                                                        |
| `sheetItemInput(item, change)`   | `SheetItemInput` complet d'un élément avec des champs changés.                                                                                                                                                                                                                                                            |
| `itemGroupFields(columnId, key)` | Champs d'un élément ajouté dans un groupe (catégorie, unité, magasin, consommable, facultatif, conservation via `conservationOf`, bénéficiaires via `idsOfKind`) ; `null` quand rien ne peut y être ajouté (groupe « avec référence », « fait », autre colonne avec valeur). Utilisé par `SheetPage` et `ChecklistPanel`. |

### `lib/delete-sheets.ts`

| Export                                     | Rôle                                                                                                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deleteSheetsAction(rows, remove, clear?)` | Action « Supprimer » de fiches (`deleteItemsAction`), mêmes textes sur une ligne, une sélection et la page : éléments supprimés, rattachements retirés, listes déjà faites conservées. Utilisé par `SheetsTable` et `SheetPage`. |

Interne : `DeletedSheet` (`label`, `items`, `usedBy?`).

## Utilisations hors du dossier

- `app/router.tsx` : `SheetsPage`, `SheetPage`.
- `features/projects/pages/ProjectPage.tsx` : `SheetsTable`.
- `features/routines/components/RoutineForm.tsx`, `features/calendar/components/EventForm.tsx`, `features/tasks/components/TaskPanel.tsx` : `SheetsSection`.
- `features/shopping/pages/ShoppingListPage.tsx` : `SheetPicker`, `useSheetMutations`.
- `features/shopping/components/ShoppingSettings.tsx` : `useSheets`.
