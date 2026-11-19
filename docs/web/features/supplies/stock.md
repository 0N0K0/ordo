# Code web : inventaire

Référence de chaque fichier de `apps/web/src/features/stock/` : requêtes et mutations du stock et des commandes à distance, page, composants, hooks et fonctions. Les fonctionnalités sont décrites dans [Inventaire](../../../features/supplies/stock.md), les règles de l'API dans [Règles du stock](../../../business-rules/supplies/stock.md). Le stock réutilise beaucoup de briques des achats : voir [Code web : achats](shopping.md).

## api

### `api/index.ts`

Types (déduits des requêtes générées) :

| Export          | Rôle                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `StockLocation` | Emplacement (`StockLocationsQuery`).                                                                   |
| `StockItem`     | Article avec ses lots, sa quantité, `consumable`, ses bénéficiaires (`StockItemsQuery`).               |
| `StockLot`      | Lot d'un article.                                                                                      |
| `StockMovement` | Mouvement (`StockMovementsQuery`), avec `itemLabel`, `source`, `shoppingListId`, `sheetId`, `countId`. |
| `StockCount`    | Inventaire (`StockCountsQuery`), avec `lines`.                                                         |

Constantes et documents :

- `stockKey` (`['stock']`) : clé des requêtes du stock. Utilisé par `StockTable` (archivage).
- Documents de requêtes (internes) : `StockLocationsDocument`, `StockItemsDocument`, `StockMovementsDocument` (`$itemId`), `StockCountsDocument`, `ProductStockDocument`.
- Documents de mutations (internes) : `CreateLocation`, `UpdateLocation`, `MoveLocation`, `DeleteLocation`, `CreateItem`, `UpdateItem`, `DeleteItem`, `MoveStock`, `SetLotExpiry`, `RecordCount`, `SetProductStock`, `AddPurchase`, `SetOrder`, `CreateDelivery`, `UpdateDelivery`, `DeleteDelivery`, `SetDeliveryReceived`.

Hooks :

| Export                             | Rôle                                                                                                                                                                                                                                                                                                                                          | Utilisé par                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useStockLocations()`              | Emplacements (`[...stockKey, 'locations']`).                                                                                                                                                                                                                                                                                                  | `StockPage`, `StockTable`, `StockCountForm`, `StockPurchaseForm`, `StockLocations`, `use-location-select`, `features/shopping/components/BaseList.tsx` |
| `useStockItems()`                  | Articles avec leurs lots (`[...stockKey, 'items']`).                                                                                                                                                                                                                                                                                          | `StockPage`, `StockTable`, `StockCountForm`                                                                                                            |
| `useStockMovements(itemId = null)` | Mouvements, tous ou d'un article (`[...stockKey, 'movements', itemId]`).                                                                                                                                                                                                                                                                      | `MovementsTable`                                                                                                                                       |
| `useStockCounts()`                 | Inventaires (`[...stockKey, 'counts']`).                                                                                                                                                                                                                                                                                                      | `StockPage` (`CountsTable`)                                                                                                                            |
| `useProductStock()`                | `Map` référence → quantité en stock (`[...stockKey, 'products']`).                                                                                                                                                                                                                                                                            | `features/shopping/pages/ShoppingListPage.tsx`                                                                                                         |
| `useStockMutations()`              | Mutations (toutes invalident `stockKey` et `shoppingKey`) : `createLocation`, `updateLocation`, `moveLocation`, `deleteLocation`, `createItem`, `updateItem`, `deleteItem`, `move`, `setLotExpiry`, `recordCount`, `setProductStock`, `addPurchase`, `setOrder`, `createDelivery`, `updateDelivery`, `deleteDelivery`, `setDeliveryReceived`. | composants du stock ; `BaseList`, `ShoppingListPage`, `OrderPanel`, `StoreMode` (achats)                                                               |

Interne : `useStockMutation(fn)` (mutation qui invalide le stock et les achats).

## pages

### `pages/StockPage.tsx`

- `StockPage()` : page `/stock` (route dans `app/router.tsx`) : `PageHeader` « Inventaire », onglets `stock` (`StockTable`), `movements` (`MovementsTable`), `counts` (`CountsTable`) via `usePageTab(STOCK_TABS)` (un changement d'onglet ne garde que `tab` : `{ only: true }`), et `StockSettings`.
- Internes :
  - `CountsTable()` : table des inventaires (`useDataView` clé `stock-counts`) : « Date », « Emplacement » (chemin ou « Tout le stock »), « Écarts notés », « Description » ; état vide ;
  - `StockSettings()` : « Paramètres de l'inventaire » (`PageSettings`) avec `StockLocations` (usage = nombre d'articles par emplacement, `countBy`) ;
  - `STOCK_TABS`.

## components

### `components/StockTable.tsx`

- `StockTable()` : table des articles (`DataTable`, clé `stock`) : colonnes « Article », « Emplacement », « Catégorie » (`categoryColumn`), « Quantité » (`quantityColumn`), « Unité » (`unitColumn`), « Date de péremption » (`nextExpiry`, badge rouge / orange / gris), « Lots », « Bénéficiaires », « Périssable », « Consommable » (`consumableColumn`), « Référence », « Valeur » (dernier prix × quantité), « Description » (`noteColumn`), « Modifié le », commentaires. Cellules modifiables sur place et en lot (`bulkSaver` → `updateItem` avec `stockItemInput` ; articles archivés ignorés) : libellé, emplacement (`EditableSelect` + `locationSelectProps`), catégorie (`CategoryCell`), unité (`UnitCell`), bénéficiaires (`EditableMultiSelect`, `rowPeopleKeys` / `rowPeopleOf`), périssable, description. Lots dépliés sous la ligne (`details` → `LotsTable`) via `FoldHeading`. Barre : « Afficher les archivés », « Faire l'inventaire » (`StockCountForm`, panneau large), « Nouvel article » (`StockItemForm`). Ligne : « Retirer 1 » (mouvement `CONSUMPTION` de 1), « Consommer, ajouter, perdre… » (`StockMoveForm`), « Historique » (`MovementsTable itemId`), archiver, supprimer. Sélection : archiver, supprimer. Utilisé par `StockPage`.
- Internes : `Change` (champs modifiables), `SOON` (3 jours avant la date : « bientôt »), `whom(item)` (noms des bénéficiaires), `value(item)` (valeur estimée), `toggle(id)` (déplie les lots), `deleteItems(rows, clear?)` (action « Supprimer » commune ligne / sélection, `deleteItemsAction`).

### `components/LotsTable.tsx`

- `LotsTable({ item, readOnly? })` : lots d'un article (clé `stock-lots`) : « Quantité » (`EditableNumber` ; l'écart part en mouvement `CORRECTION` sur ce lot), « Date de péremption » (`EditableDate` → `setLotExpiry`), « Entré le ». Modifiable en lot. Utilisé par `StockTable`.

### `components/MovementsTable.tsx`

- `MovementsTable({ itemId? })` : mouvements, les plus récents d'abord (clé `stock-movements`, ou `stock-item-movements` pour un article) : « Date », « Mois » (`monthColumn`), « Article », « Mouvement » (badge coloré), « Quantité » (`SignedAmount`, signée), « Origine » (lien vers la liste d'achats ou la fiche), « Description ». Utilisé par `StockPage` et `StockTable` (« Historique »).
- Interne : `KIND_COLORS` (couleur de chaque type : achat vert, consommation bleu, inventaire violet, perte rouge, correction gris).

### `components/StockItemForm.tsx`

- `StockItemForm({ locationId = null, onDone })` : panneau « Nouvel article » (création seulement, `newStockItemSchema`) : « Article » (`Autocomplete` sur les références non archivées ; une référence choisie remplit catégorie, unité, périssable et emplacement par défaut), « Emplacement » (`CreatableSelect` + `useLocationSelect`), « Catégorie » (`ShoppingCategoryField`), « Quantité », « Unité » (`UnitField`), « Périssable », « Date de péremption », « Bénéficiaires » (`PeopleField`), « Description ». Utilisé par `StockTable`.
- Interne : `Values`.

### `components/StockMoveForm.tsx`

- `StockMoveForm({ item, kind = 'CONSUMPTION', onDone })` : entrée ou sortie à la main : type (`SegmentedControl` « Consommation », « Achat », « Perte »), quantité, lot (sortie : ceux qui périment le plus tôt par défaut ; ajout : nouveau lot ou lot de l'article), date d'un nouveau lot périssable, note ; `move`. Utilisé par `StockTable`.
- Internes : `Kind` (types sans `COUNT`), `KINDS` (options du sélecteur ; la correction se fait depuis un lot).

### `components/StockCountForm.tsx`

- `StockCountForm({ onDone })` : panneau « Faire l'inventaire » : emplacement (ses sous-emplacements compris, `isUnderOrSelf`), table des articles non archivés (clé `stock-count` : « Article », « Emplacement », « Attendu », « Compté » saisi par `QuantityInput`), description ; « Enregistrer l'inventaire » envoie seulement les articles comptés (`recordCount`). Utilisé par `StockTable`.
- Interne : `within(id)` (emplacement dans celui choisi).

### `components/StockPurchaseForm.tsx`

- `StockPurchaseForm({ items, onDone })` : panneau « Ajouter au stock » pour des éléments de listes d'achats : une carte par élément (quantité, emplacement, date) ; « Plus tard » ou « Ajouter au stock » (`addPurchase` pour chaque ligne > 0, `useAsyncAction`). Utilisé par `useStockProposal` et `features/shopping/pages/ShoppingListPage.tsx`.
- Internes : `Line` (élément, quantité, emplacement choisi ou indéfini, date), `locationOf(line)` (emplacement choisi, sinon celui de la référence, sinon — s'il est archivé — le premier non archivé), `change(index, patch)`.

### `components/StockLocations.tsx`

- `StockLocations({ usage })` : `SettingsList` en arbre des emplacements (glisser-déposer → `moveLocation`, suppression → `deleteLocation`, repli gardé sous `ordo.stock.locations`). Utilisé par `StockSettings` (`StockPage`).

## hooks

### `hooks/use-location-select.tsx`

- `useLocationItems()` : définition de la liste de paramètres des emplacements (`STOCK_LOCATION`, `stockLocationSchema`, `treeItemInput`). Utilisé par `StockLocations` et `useLocationSelect`.
- `locationSelectProps(locations, keep)` : props d'un select d'emplacement en arbre (non archivés, l'actuel gardé). Utilisé par `StockTable`, `StockCountForm`.
- `useLocationSelect()` : renvoie `(keep) => props` d'un `CreatableSelect` d'emplacement, avec création d'un emplacement tapé (« Nouvel emplacement », parent parmi les emplacements). Utilisé par `StockItemForm`, `StockPurchaseForm`.

### `hooks/use-stock-proposal.ts`

- `useStockProposal()` : renvoie `(items) => void` qui ouvre « Ajouter au stock » (`StockPurchaseForm`) pour les éléments achetés dont la référence est suivie en stock **sans** ajout automatique (les autres sont ajoutés par le serveur, ou non suivis) ; rien si aucun n'est concerné. Utilisé par `ShoppingListPage`, `StoreMode`, `OrderPanel`.

## lib

### `lib/stock-format.ts`

- `stockItemInput(item, change)` : saisie `NewStockItemInput` d'un article tel qu'il est, avec des champs changés (quantité et date à null). Utilisé par `StockTable`.
- `nextExpiry(item)` : première date parmi les lots (`YYYY-MM-DD`), ou null. Utilisé par `StockTable` (colonne et badge).

## Briques venues des achats

Le stock utilise, de `features/shopping` : `useShoppingData`, `shoppingKey`, `ShoppingItem`, `usePeople`, `rowPeopleKeys`, `rowPeopleOf`, `PeopleField`, `UnitField`, `ShoppingCategoryField`, `CategoryCell`, `UnitCell`, `categoryColumn`, `quantityColumn`, `unitColumn`, `consumableColumn`, `noteColumn`. Leur description est dans [Code web : achats](shopping.md).
