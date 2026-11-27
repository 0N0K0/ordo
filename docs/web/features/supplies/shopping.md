# Code web : achats

Référence de chaque fichier de `apps/web/src/features/shopping/` : requêtes et mutations, pages, composants, hooks et fonctions, avec leur rôle et où ils servent. Les fonctionnalités sont décrites dans [Achats](../../../features/supplies/shopping.md), les règles de l'API dans [Règles des achats](../../../business-rules/supplies/shopping.md). Le stock et les commandes à distance utilisent aussi [Code web : inventaire](stock.md).

Plusieurs briques de ce dossier sont partagées avec les fiches (`features/sheets`), le stock (`features/stock`), les tâches et l'accueil : elles sont signalées « (partagé) ».

## api

### `api/index.ts`

Requêtes GraphQL et mutations TanStack Query de la fonctionnalité.

Types (déduits des requêtes générées) :

| Export                                                                                                        | Rôle                                                                                            |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ShoppingCategory`, `ShoppingStore`, `ShoppingBaseList`, `ShoppingStorage`, `ShoppingUnit`, `ShoppingProduct` | Lignes de `ShoppingDataQuery` (paramètres, références, produits).                               |
| `ShoppingList`, `ShoppingItem`                                                                                | Une liste de `ShoppingListsQuery` (avec mouvement, livraisons, éléments) et un de ses éléments. |

Constantes et documents :

- `shoppingKey` (`['shopping']`) : clé de toutes les requêtes des achats ; invalidée par les mutations des achats, du stock (`features/stock/api`) et des fiches (`features/sheets/api`). (partagé)
- `ShoppingDataDocument` (interne) : `query ShoppingData` — catégories, modes, unités, magasins, références, produits (avec réglages de stock).
- `ShoppingListsDocument` (interne) : `query ShoppingLists($taskId)` — listes, leur mouvement, livraisons et éléments (avec `sheetSources`).
- Documents de mutations (internes) : `CreateCategory`, `UpdateCategory`, `DeleteCategory`, `MoveCategory`, `CreateUnit`, `UpdateUnit`, `DeleteUnit`, `MoveProducts`, `CreateStorage`, `UpdateStorage`, `DeleteStorage`, `DuplicateItem`, `CreateStore`, `UpdateStore`, `DeleteStore`, `CreateBaseList`, `RenameBaseList`, `DeleteBaseList`, `CreateProduct`, `UpdateProduct`, `SetProductsMissing`, `DeleteProduct`, `CreateList`, `UpdateList`, `SetListClosed`, `DuplicateList`, `DeleteList`, `AttachEntry`, `AddItem`, `AddProducts`, `UpdateItem`, `SetItemPurchased`, `SaveItemToBase`, `DeleteItem`.

Hooks :

- `useShoppingData()` : requête `[...shoppingKey, 'data']`. Utilisé partout dans les achats, le stock, les fiches (`SheetPage`, `ChecklistPanel`, `SheetsSettings`), l'accueil (`LifeCards`). (partagé)
- `useShoppingLists(taskId = null)` : requête `[...shoppingKey, 'lists', taskId]`, toutes les listes ou celles d'une tâche. Utilisé aussi par les tâches (`TaskBoard`, `use-task-columns`), les fiches et l'accueil. (partagé)
- `useShoppingMutations()` : objet de mutations (toutes invalident `shoppingKey`) :
  - catégories : `createCategory`, `updateCategory`, `deleteCategory`, `moveCategory` (optimiste, `moveInTree`) ;
  - unités : `createUnit`, `updateUnit`, `deleteUnit` ;
  - `moveProducts` ;
  - modes : `createStorage`, `updateStorage`, `deleteStorage` ;
  - magasins : `createStore`, `updateStore`, `deleteStore` ;
  - références : `createBaseList`, `renameBaseList`, `deleteBaseList`, `moveBaseList` (optimiste ; enregistre l'ordre complet par `reorderSettingsItems('SHOPPING_BASE_LIST', ids)`) ;
  - produits : `createProduct`, `updateProduct` (optimiste), `setMissing` (optimiste), `deleteProduct` ;
  - listes : `createList`, `updateList`, `setClosed`, `duplicateList`, `deleteList`, `attachEntry` (invalide aussi `treasuryKey`) ;
  - éléments : `addItem`, `addProducts`, `updateItem` (optimiste), `duplicateItem`, `setPurchased` (optimiste), `saveToBase`, `deleteItem`.
    Utilisé aussi par `features/tasks/components/extra-cells.tsx`.

Fonctions internes : `useShoppingMutation` (mutation qui invalide `shoppingKey`), `useOptimisticMutation` (mutation avec patch optimiste du cache, remis en cas d'échec), `patchItem` (change un élément dans les listes en cache), `patchProducts` (change des produits dans le cache des données), `cached` (champs d'une saisie tels que mis en cache : textes vides → null, mode et date seulement si périssable), `itemVariables` / `productVariables` (variables GraphQL, bénéficiaires toujours fournis).

## pages

### `pages/ShoppingPage.tsx`

- `ShoppingPage()` : page `/shopping` (route dans `app/router.tsx`) : `PageHeader`, `ShoppingPageSettings`, onglets `base` (« Références », `BaseLists`) et `lists` (« Listes », `ListsPanel`) via `usePageTab(SHOPPING_TABS)`.
- `ListsPanel({ projectId?, projectIds? })` : table des listes (`DataTable`, `useDataView` clé `shopping-lists`), vues `LIST_VIEWS`, cellules modifiables (libellé `EditableText`, tâches `TasksCell`, progression `ShoppingProgressBadge`), menu `ListActionsMenu`, actions de sélection (dupliquer, clôturer / rouvrir, archiver, supprimer), interrupteur des archivées. Avec `projectIds`, seules les listes des tâches de ces projets (`listsOfProjects`) et les vues du projet. Utilisé aussi par `features/projects/pages/ProjectPage.tsx` (onglet « shopping »).
- Colonnes : `useShoppingListColumns(lists)` (`hooks/use-shopping-columns.tsx`).
- Internes : `LIST_VIEWS` (vues « En cours » / « Clôturées »), `SHOPPING_TABS`.

### `pages/ShoppingListPage.tsx`

- `ShoppingListPage()` : page `/shopping/:id`. Charge listes, données, contexte des tâches, stock par référence (`useProductStock`) ; prend les colonnes de `useShoppingItemColumns(list)`, la vue `shopping-list` (vues `LIST_VIEWS`, colonne de lot « Acheté »), l'en-tête `DetailHeader`, la barre `DataViewBar` (ajout depuis les références / hors références / une fiche via `SheetPicker`, « Commande à distance » → `OrderPanel`, « Mode collecte » → `StoreMode`, `ListActionsMenu`), le tableau `ShoppingTable` (bascule « Acheté » qui appelle `useStockProposal` après achat, actions de ligne, actions de sélection « Ajouter au stock… » et « Retirer de la liste »), le total estimé et les commentaires. Gère les états chargement (`TableSkeleton`), introuvable (`DetailNotFound`), vide (`EmptyState`), clos / archivé (lecture seule ; « Voir » ouvre un élément en lecture seule).
- Internes : `LIST_VIEWS` (« Tout », « À acheter », groupées par catégorie), `deliveryName` (nom affiché d'une livraison, `deliveryLabel`), `assignDelivery(moved, deliveryId)` (met des éléments dans une livraison en enregistrant les livraisons qu'ils quittent et rejoignent), `bulkDelivery` (cellule « Livraison » en lot).

## components

### `components/BaseLists.tsx`

- `BaseLists()` : onglets des références (`SortableTabs`, réordonnés par glisser-déposer, sélection par `useTabParam('base')`), avec avatar, badge archivée et compteur de manquants (`CountBadge`) ; menus « Modifier », archiver ; création / renommage dans `SettingsItemForm` (panneau `shopping-base-list`) ; suppression confirmée (`confirmDestructive`) ; état vide. Affiche `BaseList` de la référence choisie. Utilisé par `ShoppingPage`.
- Internes : `schema` (libellé `shoppingBaseListLabelSchema`), `move(id, target)` (index parmi toutes les références, archivées comprises), `openForm(baseList?)`, `confirmDelete(baseList)`.

### `components/BaseList.tsx`

- `BaseList({ baseList })` : produits d'une référence dans `ShoppingTable` : colonnes `useBaseListColumns(baseList, products)`, réglages de stock modifiés via `setProductStock` en lot ; bascule `MISSING_TOGGLE` ; boutons déplacer / nouveau produit / générer une liste ; actions de ligne et de sélection ; « Tout décocher ». Utilisé par `BaseLists`.
- Internes : `BASE_LIST_VIEWS` (« Tous », « Manquants », groupées par catégorie), `confirmDelete(product, onConfirm)` (confirmation « Retirer le produit »), `MISSING_TOGGLE(save)` (bascule « Manque », caddie orange), `stockBulk` (enregistre les réglages de stock).

### `components/ShoppingTable.tsx`

- `ShoppingTable<T>(props)` : tableau commun des produits et des éléments (sur `DataTable`), groupé seulement par la vue : le regroupement de la vue par « Catégorie », « Magasin », « Conservation » ou « Bénéficiaires » (`groupingOfColumn`) fait des glisser-déposer vers un autre groupe (qui a des lignes) un changement de ce champ (`moveToGroup`) et place la ligne ajoutée dans un groupe (`AddShoppingRow` + `placeInGroup`) ; groupé par une autre colonne ou pas groupé, une ligne lâchée ou ajoutée ne change pas de valeur. Sans tri, la place choisie par glisser-déposer est enregistrée dans la vue (`orderInView` de `DataTable` : `manualOrder`), dans un groupe ou sans regroupement. Cellules modifiables sur place et en lot (`bulkSaver`), bouton d’état en tête (`StateButton` avec les `states` du `toggle`, libellé de cellule `cellLabelOf`), « Facultatif » en bouton d’état (`OPTIONAL_STATES`). Props principales : `items`, `label`, `readOnly`, `rowReadOnly`, `onSave(row, input)`, `toggle`, `badge`, `extra`, `extraCells`, `actions`, `summary`, `done`, `categories`, `add`, `view`, `selectionActions`, `selectionLabel`. Utilisé par `BaseList` et `ShoppingListPage`.
- `ShoppingToggle<T>` (interface) : état d'une ligne basculé par son bouton d'état en tête (`id`, `name`, `value`, `states` : `YesNoStates`, `MISSING_STATES` ou `BOUGHT_STATES`, `onChange(rows, on)`). Utilisé par `BaseList` et `ShoppingListPage`.
- Interne : `ShoppingTableProps<T>`, `handleMove(move)`, `cells(item)` (cellules : libellé + note, catégorie, magasin, quantité, unité, prix, conservation, date, bénéficiaires, lien, facultatif, fiches).

### `components/AddShoppingRow.tsx`

- `AddShoppingRow({ label, onCreate, onPick?, place, groupName })` : champ au bout d'un groupe ; nom + Entrée crée une ligne dans le groupe ; si `onPick` est fourni, un menu propose d'abord « Depuis les références… » ou « Hors références ». Utilisé par `ShoppingTable`.
- `ShoppingAdd` (interface) : `label`, `onCreate(label, place)`, `onPick?`. Utilisé par `ShoppingTable`.
- Interne : `ShoppingPlace` (champs d'une ligne ajoutée dans un groupe), `AddShoppingRowProps`.

### `components/shopping-cells.tsx`

Cellules modifiables des tables de produits. (partagé avec les fiches et le stock)

| Export                                                                            | Rôle                                                                                                 | Utilisé par                                                  |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `UnitCell({ value, label, readOnly?, onSave })`                                   | Choix d'une unité des paramètres (non archivées, l'actuelle gardée).                                 | `ShoppingTable`, `StockTable`, `SheetPage`, `ChecklistPanel` |
| `StoreCell({ value, stores, label, readOnly?, onSave })`                          | Choix d'un magasin ou aucun.                                                                         | `ShoppingTable`, `SheetPage`                                 |
| `PeopleCell({ memberIds, relationIds, label, readOnly?, onSave })`                | Multi-choix des bénéficiaires (`usePeople`).                                                         | `ShoppingTable`, `SheetPage`                                 |
| `ConservationCell({ perishable, storageId, storages, label, readOnly?, onSave })` | « Non périssable », « Périssable » ou un mode (groupe « Périssable, à conserver »).                  | `ShoppingTable`, `SheetPage`                                 |
| `ExpiryCell({ value, label, disabled?, readOnly?, onSave })`                      | Date de péremption, rouge et en gras une fois dépassée (« Date dépassée ») ; rien si non périssable. | `ShoppingTable`                                              |
| `CategoryCell({ value, categories, label, readOnly?, onSave })`                   | Choix d'une catégorie en arbre, avec son avatar.                                                     | `ShoppingTable`, `StockTable`, `SheetPage`, `ChecklistPanel` |
| `TasksCell({ label, items, options, value, onSave, readOnly? })`                  | Tâches d'une liste, multi-sélection (« Aucune tâche »).                                              | `ShoppingPage`                                               |

Interfaces internes : `UnitCellProps`, `StoreCellProps`, `PeopleCellProps`, `ConservationCellProps`, `ExpiryCellProps`, `CategoryCellProps`.

### `components/ShoppingForm.tsx`

- `ShoppingForm({ target, onDone })` : formulaire d'un produit (`target.kind === 'product'`, avec `baseListId`, `product?`) ou d'un élément (`kind: 'item'`, `listId`, `item?`) : libellé, référence (produit), catégorie (`ShoppingCategoryField`), magasin (`CreatableSelect` + `itemCreator`), quantité, unité (`UnitField`), prix, périssable + mode + date, bénéficiaires (`PeopleField`), lien, description (`MarkdownEditor`), « Manque » (produit). Schéma `shoppingProductSchema` ou `shoppingItemSchema`. Nouveau : formulaire « Ajouter » (`createProduct` / `addItem`, `formCallbacks`). Existant : panneau enregistré champ par champ (`useFieldSave` : libellé, quantité, prix, lien et description en les quittant, le reste dès qu'il change ; `SaveStatus` en tête ; `updateProduct` / `updateItem` avec toutes les valeurs) ; le produit du cache (`useShoppingData`) ou l'élément du cache (sa liste suivie par `useCachedItem` sur les listes) est suivi ; produit archivé ou élément d'une liste close ou archivée (`listClosed`, aussi ailleurs, le panneau ouvert : ceux du cache) : lecture seule (`Fieldset` désactivé, commentaires aussi). Commentaires sous le formulaire. Utilisé par `openShoppingForm`.
- `ShoppingFormProps` (interface) : `target`, `onDone`. Utilisé par `open-shopping-form.tsx`.
- Internes : `FormValues`, `ON_BLUR`, `shoppingFormValues(target, current?)` (valeurs d'un produit ou d'un élément).

### `components/ProductFields.tsx`

Champs de formulaire partagés par les achats et le stock.

- `UnitField({ value, onChange, current?, ...SelectProps })` : unité (`CreatableSelect`) parmi les unités non archivées (l'actuelle gardée) ; une unité tapée absente est créée dans les paramètres (`createSettingsItem`). Utilisé par `ShoppingForm`, `StockItemForm`.
- `ShoppingCategoryField({ value, onChange, current?, baseListId?, ...SelectProps })` : catégorie en arbre (celles de la référence si `baseListId`), créable (à la racine, rattachée à la référence). Utilisé par `ShoppingForm`, `StockItemForm`.
- Interfaces internes : `UnitFieldProps`, `ShoppingCategoryFieldProps`.

### `components/PeopleField.tsx`

- `PeopleField({ form, label, description? })` : bénéficiaires d'un formulaire (`PeopleSelect`), avec les options de `usePeople().optionsFor` ; écrit `memberIds` / `relationIds` ; erreur de l'API sous le champ. Utilisé par `ShoppingForm`, `StockItemForm` (et le commentaire le destine aussi aux éléments de fiches). (partagé)
- Interne : `PeopleValues`.

### `components/ProductPicker.tsx`

- `ProductPicker({ list, onDone })` : panneau « Ajouter des produits des références » : recherche (`normalize`), filtre de référence, « Manquants seulement », tout cocher / décocher, produits groupés par référence (déjà présents cochés et verrouillés), « Ajouter (N) » → `addProducts`. Utilisé par `ShoppingListPage`.

### `components/MoveProductsForm.tsx`

- `MoveProductsForm({ baseList, productIds, onDone })` : choix des produits et de la référence cible, `moveProducts`. Utilisé par `openMoveProducts`.
- Interne : `MoveProductsFormProps`, `submit(event)`.

### `components/NewListForm.tsx`

- `NewListForm({ baseListIds, taskIds, projectIds?, onDone })` : nouvelle liste (libellé proposé selon PRO / PERSO, tâches — une requise depuis un projet —, références dont reprendre les manquants) ; `createList` puis navigation vers la liste. Utilisé par `openNewList`.
- Internes : `schema`, `Values`, `NewListFormProps`, `missingOf(id)` (manquants non archivés d'une référence), `handleSubmit`.

### `components/ListActions.tsx`

- `ListActionsMenu({ list, grouping?, header?, onDeleted? })` : menu des actions d'une liste (`ActionsMenu`, variante bordée dans l'en-tête de la page) ; exports groupés par `grouping` (sur la page de la liste : celui de sa vue s'il est d'achats, sinon par catégorie ; défaut par catégorie). Utilisé par `ShoppingPage` et `ShoppingListPage`.
- Internes :
  - `useListActions(list, grouping, onDeleted?)` : entrées du menu (renommer, rattacher / détacher un mouvement, dupliquer, copier en texte, PDF, clôturer / rouvrir, archiver, supprimer ; réduites pour une liste archivée) ;
  - `ListForm({ list })` : panneau « Modifier la liste » (libellé, tâches), enregistré champ par champ (`useFieldSave`, libellé en le quittant, `SaveStatus`) par `updateList` ; la liste du cache (`useShoppingLists`) est suivie ;
  - `EntryPicker({ list, onDone })` : recherche d'un mouvement de trésorerie (`useTreasuryEntrySearch`, saisie retardée de 250 ms) et rattachement ;
  - `ListActionsMenuProps`, `listSchema`.

### `components/StoreMode.tsx`

- `StoreMode({ list, onClose })` : mode collecte plein écran (`Modal fullScreen`) : sections des livraisons (avec « Réceptionnée »), puis par magasin et arbre de catégories (`shoppingRows` + `visibleRows`), lignes touchables entières avec un `StateButton` « Acheté » (`BOUGHT_STATES`, taille `xl`) en tête, un tap sur le bouton ou la ligne bascule, section « Acheté » ; propose le stock après achat (`useStockProposal`). Utilisé par `ShoppingListPage`.
- Internes : `HeadingProps`, `Heading(props)` (titre repliable avec badge du reste à acheter, vert à 0), `toggle(key)`, `row(item, depth)`, `categories(storeKey, storeItems)`.

### `components/OrderPanel.tsx`

- `OrderPanel({ listId })` : panneau « Commande à distance » ; relit la liste à chaque changement et affiche `OrderFields`. Utilisé par `ShoppingListPage`.
- Internes :
  - `OrderFields({ list })` : interrupteur, lieu de livraison (`AddressInput`, enregistré au choix d'une adresse proposée ou au texte vidé), liste des livraisons (réception, modification, suppression confirmée) ;
  - `DeliveryForm({ list, delivery?, onDone })` : formulaire d'une nouvelle livraison (« Ajouter », `createDelivery`) ou panneau d'une livraison existante enregistré champ par champ (`useFieldSave` : libellé et suivi en les quittant, le lieu par `useLocationDraft` — choisi, vidé ou quitté —, le reste dès qu'il change ; `SaveStatus` ; `updateDelivery`), la livraison et la liste du cache suivies (`useShoppingLists`) ; schéma `shoppingDeliverySchema` ; ses dates sont liées à `windowFrom` / `windowTo` par `formRange`. Internes : `DeliveryValues`, `ON_BLUR`, `deliveryValues(list, delivery?)`.

### `components/ShoppingSettings.tsx`

- `ShoppingSettings()` : paramètres des achats : `ShoppingCategories`, `SettingsList` des magasins, `ShoppingUnits`, `SettingsList` des modes de conservation, puis en dernier les `ColumnDefaults` des tableaux `shopping-base-list` (« Références »), `shopping-lists` (« Listes ») et `shopping-list` (« Une liste »). Interne : `NO_PRODUCTS`. Utilisé par `ShoppingPageSettings` et l’onglet « Achats » des paramètres d’un projet.
- `ShoppingPageSettings()` : `ShoppingSettings` dans la barre latérale (`PageSettings` « Paramètres des achats »). Utilisé par `ShoppingPage` et `ShoppingListPage`.

### `components/ShoppingCategories.tsx`

- `ShoppingCategories()` : `SettingsList` en arbre des catégories (glisser-déposer → `moveCategory`, suppression → `deleteCategory`), badges des références de chaque catégorie ; usage compté sur les produits, les éléments des listes et des fiches (`useSheets`) et les articles du stock (`useStockItems`). Utilisé par `ShoppingSettings`, `features/sheets/components/SheetsSettings.tsx` et `StockSettings` (`features/stock/pages/StockPage.tsx`). (partagé)

### `components/ShoppingUnits.tsx`

- `ShoppingUnits()` : `SettingsList` « Unités » (`useUnitItems`), usage par libellé sur les produits et les éléments des listes. Utilisé par `ShoppingSettings`, `SheetsSettings` et `StockSettings`. Garde eslint : une `SettingsList` titrée « Unités » ailleurs est refusée. (partagé)

### `components/TaskShopping.tsx`

- `TaskShopping({ task })` : section « Achats » du panneau d'une tâche : ses listes non archivées (lien, progression, total), « Nouvelle liste » (avec la tâche), « Rattacher une liste existante » (listes ouvertes non rattachées). Rien de modifiable pour une tâche archivée. Utilisé par `features/tasks/components/TaskPanel.tsx`.

### `components/ShoppingProgressBadge.tsx`

- `ShoppingProgressBadge({ items })` : badge « achetés/requis » (`ProgressBadge`, gris, montré même à « 0/0 » ; infobulle « 3 achetées sur 5 requises » ; `shoppingProgress`), vert quand tout est acheté. Utilisé par `ShoppingPage` et `TaskShopping`.

### `components/Shopping.module.css`

Classes : `.table` (tables d'achats), `.itemRow` (ligne ; barrée quand `data-done`), `.storeList`, `.storeHeading`, `.storeRow`, `.storeName`, `.nowrap` (mode collecte, et `.storeRow` pour les résultats de `EntryPicker`).

## hooks

### `hooks/use-settings-items.tsx`

Définitions des listes de paramètres (liste + formulaire + création depuis un select, `SettingsItemKind`).

| Export                       | Rôle                                                                                                                   | Utilisé par                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `useStoreItems()`            | Magasins (`SHOPPING_STORE`, `labelFormSchema`), avec `remove`.                                                         | `ShoppingSettings`, `ShoppingForm`            |
| `useStorageItems()`          | Modes de conservation (`SHOPPING_STORAGE`), avec `remove`.                                                             | `ShoppingSettings`, `ShoppingForm`            |
| `useUnitItems()`             | Unités (`SHOPPING_UNIT`, sans couleur, envoyées avec `UNIT_COLOR`), avec `remove`.                                     | `ShoppingUnits`, `UnitField`                  |
| `useShoppingCategoryItems()` | Catégories (`SHOPPING_CATEGORY`, `shoppingCategorySchema`), avec le champ en plus « Références » (`BatchMultiSelect`). | `ShoppingCategories`, `ShoppingCategoryField` |

Interne : `WithRemove`.

### `hooks/use-shopping-columns.tsx`

Colonnes des tableaux des achats, chacune lue par son tableau et par `ShoppingSettings` (colonnes des nouvelles vues).

| Export | Rôle |
| --- | --- |
| `useShoppingListColumns(lists)` | Colonnes de la table des listes (`shopping-lists`) : liste, tâches, projet, état (`stateColumn` : « En cours » bleu, « Clôturée » gris ; interne `LIST_STATES`), achats, restant, produits, total estimé, créée le, clôturée le, payée, catégories, magasins, libellés des produits, commentaires. |
| `listSheets(items)` | Fiches d'origine des éléments d'une liste, chacune une fois. Utilisé aussi par `ShoppingListPage` (`SheetPicker`). |
| `useShoppingItemColumns(list)` | Colonnes des éléments d'une liste (`shopping-list`) : `itemColumns` + `optionalColumn` + « Acheté », « En stock », « Livraison » (masquée hors commande à distance), « Fiches », commentaires ; sans liste (paramètres) : sans livraisons, fiches ni commentaires. |
| `useBaseListColumns(baseList, products)` | Colonnes des produits d'une référence (`shopping-base-list`) : `itemColumns` + commentaires, « Dernier achat », « Manque », « Suivie en stock », « Consommable », « Ajout auto au stock », « Emplacement en stock » ; sans référence : toutes les catégories. |
| `MISSING_STATES`, `BOUGHT_STATES`, `STOCK_TRACKED_STATES`, `AUTO_STOCK_STATES` | États des boutons d'état (`YesNoStates`) : « Manque » / « Pourvu » (chariot blanc sur fond bleu, `ShoppingCartIcon` en `badge` / carré gris vide), « Acheté » / « À acheter », « Suivie en stock » / « Non suivie en stock », « Ajoutée au stock une fois achetée » / « Pas ajoutée au stock », avec ce que fait un clic ; aussi les icônes et noms de leurs colonnes (`booleanColumn({ states })`). Utilisé par `BaseList`, `ShoppingListPage`, `StoreMode`. |

Internes : `ListEnv`, `projectsOf(list, context)`, `listColumns(env)`.

## lib

### `lib/shopping-format.ts`

Fonctions de mise en forme et de calcul des produits et éléments. (partagé)

| Export                                              | Rôle                                                                                                                                                                                              | Utilisé par                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `taskShoppingLists(lists, taskId)` | Listes d’achats d’une tâche, archivées masquées : « Achats » de `TaskShopping` et compte de « Ressources » du panneau de la tâche. |
| `unitOptions(units, current?)`                      | Noms des unités proposées, l'actuelle en tête si elle n'y est plus.                                                                                                                               | `UnitField`, `UnitCell`                                     |
| `ShoppingFields` (interface)                        | Champs communs d'un produit et d'un élément tels qu'affichés.                                                                                                                                     | `ShoppingTable`, `shopping-columns`                         |
| `inputOf(row)`                                      | Saisie `ShoppingItemInput` à partir d'une ligne (garde `optional` d'un élément).                                                                                                                  | `ShoppingTable`                                             |
| `leftToBuy(items)`                                  | Éléments non achetés et non facultatifs.                                                                                                                                                          | `ShoppingPage`, `LifeCards` (accueil)                       |
| `shoppingProgress(items)`                           | `{ bought, total }` des éléments requis.                                                                                                                                                          | `ShoppingProgressBadge`, `ShoppingPage`, `ShoppingListPage` |
| `blankInput(label, place)`                          | Saisie d'un nouveau produit ou élément avec seulement un libellé, dans un groupe.                                                                                                                 | `BaseList`, `ShoppingListPage`                              |
| `categoriesForBaseList(categories, baseListId)`     | Catégories proposées dans une référence (et leurs parents pour garder l'arbre).                                                                                                                   | `BaseList`, `ShoppingCategoryField`                         |
| `ShoppingGrouping` (type)                           | `'category' \| 'store' \| 'storage' \| 'people'`.                                                                                                                                                 | tables, exports                                             |
| `groupingOfColumn(columnId)` | Regroupement d'achats d'une vue groupée par « Catégorie », « Magasin », « Conservation » ou « Bénéficiaires » (`category`, `store`, `storage`, `people`) ; `null` pour une autre colonne ou aucune. | `ShoppingTable`, `ShoppingListPage` (exports) |
| `NO_GROUP_NAME`                                     | Nom du groupe « sans » de chaque regroupement.                                                                                                                                                    | `shopping-columns` (`groupNoneLabel`), `shoppingRows`                             |
| `rowPeopleKeys(row)`                                | Clés de personnes (`m:id`, `r:id`) d'une ligne.                                                                                                                                                   | cellules, colonnes, `PeopleField`, `StockTable`             |
| `rowPeopleOf(keys)`                                 | `{ memberIds, relationIds }` à partir de clés.                                                                                                                                                    | `PeopleCell`, `PeopleField`, `StockTable`                   |
| `groupsOfRow(row, grouping)`                        | Groupes d'une ligne (plusieurs pour les personnes).                                                                                                                                               | `shoppingRows`                                             |
| `moveToGroup(row, grouping, from, to)`              | Champs changés quand une ligne passe d'un groupe à un autre (null si rien).                                                                                                                       | `ShoppingTable`                                             |
| `placeInGroup(grouping, groupId)`                   | Champs d'une ligne ajoutée dans un groupe.                                                                                                                                                        | `ShoppingTable`                                             |
| `ShoppingRow<T>` (type)                             | Ligne d'un rendu groupé : titre de groupe ou produit / élément.                                                                                                                                   | `export.ts`, `StoreMode`                                    |
| `NO_GROUP`                                          | Clé du groupe « sans » dans les groupes repliés (`'none'`).                                                                                                                                       | `StoreMode`                                                 |
| `shoppingRows(items, grouping, labels)` | Lignes groupées (arbre des catégories, ou magasins, modes, personnes ; groupes sans ligne retirés ; le groupe « sans » à la fin).                                                                                              | `ListActions` (exports), `StoreMode`       |
| `visibleRows(rows, collapsed)`                      | Lignes restantes une fois des groupes repliés.                                                                                                                                                    | `StoreMode`                                                 |
| `usePeople()`                                       | Personnes possibles (tout contributeur, toute relation ; relation liée à un contributeur proposée comme lui) : `members`, `relations`, `byKey`, `options`, `optionsFor(relationIds)`, `archived`. | tables et formulaires des achats, `StockTable`, `SheetPage` |
| `taskChoices(context)`                              | Tâches ouvertes non archivées et leur libellé (interne en pratique).                                                                                                                              | `taskOptions`                                               |
| `taskOptions(context, chosen)`                      | Options des tâches d'une liste (ouvertes + déjà choisies).                                                                                                                                        | `ListsPanel`, `ListForm`, `NewListForm`                     |
| `listTasks(list, context)`                          | Tâches d'une liste connues du contexte.                                                                                                                                                           | `ShoppingPage`, `ShoppingListPage`                          |
| `listClosed(list, context)`                         | Liste close (à la main, ou toutes ses tâches fermées, d'après le contexte à jour).                                                                                                                | `ShoppingPage`, `ShoppingListPage`, `ListActions`           |
| `listsOfProjects(lists, context, projectIds)`       | Listes dont une tâche appartient à ces projets.                                                                                                                                                   | `ListsPanel`                                                |
| `UNIT_COLOR`                                        | Couleur envoyée pour les unités (`DEFAULT_LABEL_COLOR`).                                                                                                                                          | `useUnitItems`                                              |
| `sheetSourceText(source)`                           | « Gâteau · 1,5 » : fiche d'origine et sa part.                                                                                                                                                    | `ShoppingTable`, `ShoppingForm`                             |

Interne : `ShoppingGroupLabels`.

### `lib/shopping-columns.ts`

- `itemColumns<T>(names, extra?)` : colonnes communes des produits et éléments (libellé, catégorie, magasin, quantité, unité, prix, conservation, date, bénéficiaires, lien), toutes affichées ; « Catégorie » (arbre), « Magasin », « Conservation » (`groupValue` : le mode d'un périssable) et « Bénéficiaires » se groupent avec leurs groupes dans l'ordre des paramètres (`groupTree`) et leur groupe « sans » (`groupNoneLabel` = `NO_GROUP_NAME`). Utilisé par `BaseList`, `ShoppingListPage`.
- `optionalColumn<T>()` : colonne oui / non « Facultatif » (`booleanColumn`, « Facultatif » / « Obligatoire », `NEUTRAL_YES_WARNING_NO_ICONS`). Utilisé par `ShoppingListPage`, `SheetPage`.
- `OPTIONAL_STATES` : états de « Facultatif » (colonne et bouton d'état) : « Facultatif » / « Obligatoire », coche bleue / triangle orange, « Marquer comme facultatif » / « Marquer comme obligatoire ». Utilisé par `ShoppingTable`, `SheetPage`.
- `sheetShoppingColumns<T>(names)` : colonnes magasin, conservation, bénéficiaires, lien pour les éléments de fiches. Utilisé par `SheetPage`.
- Internes : `ItemNames`, `SHEET_SHOPPING_COLUMNS`, `flatGroups(items)` (groupes des magasins, modes), `peopleGroups(names)` (membres puis relations, par clé de personne).

### `lib/product-columns.ts`

Colonnes de produits partagées par achats, stock, fiches et listes à cocher. (partagé)

| Export                                 | Rôle                                                                  | Utilisé par                                                                |
| -------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `quantityColumn(options?)`             | « Quantité », numérique.                                              | `itemColumns`, `StockTable`, `SheetPage`, `ChecklistPanel`                 |
| `unitColumn(options?)`                 | « Unité ».                                                            | idem                                                                       |
| `categoryColumn(categories, options?)` | « Catégorie » : chemin complet, filtre en arbre (archivées marquées), groupée en arbre (`groupTree`, couleur héritée), « Sans catégorie ». | idem                                                                       |
| `consumableColumn(options?)`           | « Consommable », colonne oui / non (`booleanColumn`, « Consommable » / « Permanent »). | `useStockItemColumns`, `useSheetItemColumns`, `useChecklistColumns`, `useBaseListColumns` |
| `CONSUMABLE_STATES`                    | États de « Consommable » (colonne et bouton d'état) : « Consommable » / « Permanent », « Marquer comme consommable » / « Marquer comme permanent ». | `BaseList`, `SheetPage`, `ChecklistPanel` |
| `noteColumn(options?)`                 | « Description » (note).                                               | `StockPage`, `StockTable`, `MovementsTable`, `SheetPage`, `ChecklistPanel` |

Interne : `ColumnOptions<T>`.

### `lib/conservation.ts`

Clés de conservation (filtres, regroupement, cellule). (partagé)

- `Conservation` (interface) : `{ perishable, storageId }`.
- `NOT_PERISHABLE` (`'no'`), `PERISHABLE` (`'yes'`).
- `conservationKey(item)` : clé d'une ligne (non périssable, périssable sans mode, ou id du mode). Utilisé par `ConservationCell`, `itemColumns`.
- `conservationOf(key)` : inverse. Utilisé par `ConservationCell`, `features/sheets/lib/sheet-format.ts`.

### `lib/export.ts`

- `shoppingTotal(items)` : total estimé (éléments sans prix ignorés, `shoppingCost`). Utilisé par `ShoppingPage`, `ShoppingListPage`, `TaskShopping`.
- `shoppingText(list, rows, people)` : liste en texte (« Copier en texte »). Utilisé par `ListActions`.
- `downloadShoppingPdf(list, tableRows, people)` : PDF construit par l'API (`postTablePdf`). Utilisé par `ListActions`.
- Interne : `peopleText(item, people)` (noms des bénéficiaires d'un élément).

### `lib/delivery-format.ts`

- `deliveryWindow(delivery)` : « du 12 au 14 nov. », « le 12 nov. », ou rien. Utilisé par `OrderPanel`, `StoreMode`, `deliveryLabel`.
- `deliveryLabel(deliveries, id)` : nom d'une livraison d'une liste (son libellé, sinon « Retrait » / « Livraison » et quand elle est attendue ; rien sans livraison). Utilisé par `ShoppingListPage` et `useShoppingItemColumns`.
- `deliveryInput(delivery, itemIds)` : saisie d'une livraison telle qu'elle est, avec d'autres éléments. Utilisé par `ShoppingListPage` (`assignDelivery`).

### `lib/open-new-list.tsx`

- `openNewList({ baseListIds?, taskIds?, projectIds? })` : ouvre « Nouvelle liste » dans le panneau latéral (`panelId: 'new-shopping-list'`). Utilisé par `ListsPanel`, `BaseList`, `TaskShopping`, `features/tasks/components/extra-cells.tsx`.

### `lib/open-shopping-form.tsx`

- `openShoppingForm(target, readOnly?)` : ouvre `ShoppingForm` avec le bon titre (« Nouveau produit », « Modifier le produit », « Élément hors références », « Modifier l'élément », « Élément » quand `readOnly` : liste close ou archivée ; le panneau suit sa liste). Utilisé par `BaseList`, `ShoppingListPage`.

### `lib/open-move-products.tsx`

- `openMoveProducts(baseList, productIds = [])` : ouvre « Déplacer vers une autre référence » (`MoveProductsForm`). Utilisé par `BaseList`.
