# Règles du stock

Règles appliquées par l'API au stock : emplacements, articles, lots, mouvements, inventaires, réglages de stock des références, entrées des achats et sorties des fiches et listes à cocher. Sources : `apps/api/src/services/shopping/stock.ts`, `refs.ts`, `people.ts`, `apps/api/src/graphql/modules/stock.ts`, `packages/shared/src/shopping/stock.ts`. Ce que voit l'utilisateur : [Inventaire](../../features/supplies/stock.md). Les commandes à distance, aussi dans `stock.ts`, sont décrites dans [Règles des achats](shopping.md#commandes-à-distance-et-livraisons).

Toutes les données sont propres à l'espace courant. Erreurs au format commun ([Erreurs](../cross-cutting/errors.md)).

## Quantités

- Les quantités sont des décimaux (12, 3), arrondies au millième (`roundQuantity`) à chaque calcul.
- La quantité d'un article est la somme de ses lots (`lotsQuantity`) ; elle n'est pas stockée.
- Un lot vidé (quantité ≤ 0) est supprimé.

## Emplacements

Source : `stock.ts` (« Places »), `services/core/trees.ts`.

- Arbre à ordre manuel : créé en dernier parmi ses frères ; changé de parent, il passe en dernier ; déplacement (`moveStockLocation`) sous un parent ou à la racine, à un index (dernier sans index).
- Libellé requis, 80 caractères ; couleur facultative (`#rrggbb`).
- Parent existant (« Emplacement parent introuvable. ») et ni lui-même ni un descendant (« Un emplacement ne peut pas être rangé sous lui-même. »). Rien de nouveau sous un emplacement archivé.
- Un emplacement archivé ne se modifie ni ne se déplace, et n'est plus accepté comme nouveau choix (article, inventaire, achat, réglage d'une référence) ; il reste valable là où il est déjà.
- Suppression : ses sous-emplacements remontent d'un niveau, ses articles et les références qui y allaient restent sans emplacement, ses inventaires aussi.

## Articles

Source : `stock.ts` (« Items »), `stockItemSchema`, `newStockItemSchema`.

| Champ                      | Règle                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `label`                    | Requis, 200 caractères.                                                                                                    |
| `productId`                | Référence (produit des achats) facultative : doit exister (« Produit introuvable. ») et ne pas être nouvellement archivée. |
| `categoryId`               | Catégorie des achats, existante (« Catégorie introuvable. »), non nouvellement archivée.                                   |
| `unit`                     | 50 caractères, vide → null ; unité archivée refusée si elle change.                                                        |
| `locationId`               | Emplacement existant (« Emplacement introuvable. »), non nouvellement archivé.                                             |
| `note`                     | 500 caractères, espaces retirés, vide → null.                                                                              |
| `perishable`               | Requis : géré par lots datés.                                                                                              |
| `memberIds`, `relationIds` | 100 au plus chacun ; bénéficiaires (tout contributeur, toute relation, voir [Personnes](../cross-cutting/people.md)).      |
| `quantity`, `expiresAt`    | Création seulement : quantité de départ (0 à 999 999) et date du premier lot.                                              |

- Création : en dernier ; si une quantité de départ est donnée, elle entre par un mouvement « Inventaire » (`COUNT`) noté « Quantité de départ », dans un lot daté si l'article est périssable.
- Modification (`updateStockItem`) : refusée si l'article est archivé (« Article introuvable. » s'il n'existe pas) ; les quantités ne changent pas (la quantité et la date envoyées sont ignorées).
- Suppression (`deleteStockItem`) : supprime l'article, ses lots et tout son historique (cascade). Possible même archivé.
- `consumable` (lu) : celui de sa référence ; un article sans référence est consommable.
- Libellé : gardé quand la référence est supprimée (lien vidé).

## Mouvements

Types (`STOCK_MOVEMENT_KINDS`, noms `STOCK_MOVEMENT_LABELS`) :

| Type          | Nom              | Origine                                                                                 |
| ------------- | ---------------- | --------------------------------------------------------------------------------------- |
| `PURCHASE`    | « Achat »        | Ajout à la main, achat d'une liste d'achats.                                            |
| `CONSUMPTION` | « Consommation » | Sortie à la main, fiche utilisée, liste à cocher cochée.                                |
| `COUNT`       | « Inventaire »   | Inventaire, quantité de départ d'un article.                                            |
| `LOSS`        | « Perte »        | Sortie à la main.                                                                       |
| `CORRECTION`  | « Correction »   | Quantité d'un lot changée à la main ; reprise d'un achat ou d'une consommation annulés. |

Un mouvement est signé (positif : entrée, négatif : sortie), daté de sa création, avec son lot (vidé si le lot a disparu), sa note et sa source : élément de liste d'achats, fiche, élément de liste à cocher, ou inventaire. Source affichée (`source`) : « Liste « X » », « Fiche « X » », « Liste à cocher », « Inventaire ». La requête `stockMovements` renvoie les 2000 plus récents (d'un article, ou de tous).

### Entrée (`addIn`)

Une quantité entre :

1. dans le lot donné (doit être un lot de l'article : « Lot introuvable. ») ;
2. sinon, article périssable : dans le lot de la même date (le plus ancien s'il y en a plusieurs) ;
3. sinon, article non périssable : dans son lot (le plus ancien) ;
4. sinon dans un nouveau lot (daté pour un périssable, sans date sinon).

### Sortie (`takeOut`)

Une quantité sort du lot donné (« Lot introuvable. » s'il n'est pas à l'article), sinon des lots qui périment le plus tôt (sans date en dernier, puis du plus ancien). On prend ce qu'il y a : si le stock est insuffisant, la sortie est partielle. Un mouvement est créé par lot touché.

### Mouvement à la main (`moveStock`)

- `stockMoveSchema` : type parmi « Achat », « Consommation », « Perte », « Correction » (pas « Inventaire ») ; quantité non nulle (« Quantité non nulle attendue. »), entre −999 999 et 999 999, positive sauf pour une correction (« Quantité positive attendue. ») ; note 2000 caractères.
- Article archivé refusé.
- Achat ou correction positive : entrée (lot donné, ou date `expiresAt`). Consommation, perte ou correction négative : sortie.
- Rien n'a pu sortir : « Il n'y en a plus en stock. ».
- Renvoie la quantité déplacée, signée.

### Date d'un lot

`setStockLotExpiry(id, expiresAt)` : « Lot introuvable. » ; refusé si l'article est archivé.

## Inventaires

`recordStockCount` (`stockCountSchema`) :

- Au moins une ligne (« Comptez au moins un article. »), 2000 au plus ; quantité comptée 0 à 999 999 ; note 2000 caractères.
- Emplacement facultatif (aucun : tout le stock), existant et non archivé. L'API ne vérifie pas que les articles comptés sont dans cet emplacement (c'est l'interface qui les filtre).
- Tous les articles doivent exister (« Article introuvable. ») et aucun n'être archivé.
- Pour chaque ligne, l'écart compté − attendu :
  - positif : entre dans le lot à la date la plus tardive (un nouveau lot sans date s'il n'y a aucun lot) ;
  - négatif : sort des lots qui périment le plus tôt ;
  - nul : rien n'est enregistré.
- Les mouvements sont de type « Inventaire », liés à l'inventaire ; le nombre d'« Écarts notés » est le nombre de ces mouvements (`lines`).

## Réglages de stock d'une référence

`setProductStock(id, input)` (`productStockSchema`) :

| Champ             | Rôle                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `stockTracked`    | « Suivie en stock » : ses achats entrent dans le stock.                                                                                    |
| `consumable`      | « Consommable » (vrai par défaut) : sort du stock quand une fiche ou une liste à cocher l'utilise ; faux pour ce qui dure (une casserole). |
| `autoStock`       | « Ajout auto au stock » : entre dans le stock tout seul une fois acheté (sinon proposé). Forcé à faux si la référence n'est pas suivie.    |
| `stockLocationId` | Emplacement par défaut ; l'emplacement actuel reste valable même archivé.                                                                  |

Référence absente : « Produit introuvable. » ; archivée : refusée.

## Achats et stock

### Article qui reçoit un achat (`itemFor`)

Parmi les articles **non archivés** du même produit (ou, sans produit, de même libellé et unité, casse, accents et espaces ignorés : `productKey`) :

- celui de l'emplacement demandé ;
- sans emplacement demandé : celui sans emplacement, sinon le premier (ordre manuel) ;
- sinon un nouvel article créé à partir de l'élément acheté (libellé, unité, catégorie, emplacement, périssable, bénéficiaires), en dernier.

### Ajout d'un achat (`addStockPurchase`)

`stockPurchaseSchema` : élément de liste (« Élément introuvable. »), quantité > 0 (« Quantité positive attendue. »), emplacement facultatif existant et non archivé, date facultative (sinon celle de l'élément). L'entrée est un mouvement « Achat » lié à l'élément.

### Ajout automatique et reprise (`syncPurchaseStock`)

- Élément coché acheté (sur la liste ou par la réception d'une livraison) : si sa référence est suivie en stock **et** en ajout automatique, et que l'élément n'a encore aucun mouvement de stock, il entre : sa quantité (1 sans quantité ou à 0), à l'emplacement de la référence, à la date de l'élément.
- Élément décoché : tous les mouvements liés à cet élément (automatiques ou ajoutés à la main par « Ajouter au stock ») sont repris : les entrées ressortent (des lots qui périment le plus tôt), les sorties rentrent dans leur lot ; ces mouvements sont supprimés, ainsi que les corrections « Annulé » créées dans la dernière minute pour les mêmes articles : rien ne reste dans l'historique.

### Quantité en stock d'une référence

`productStock` : somme des lots de tous les articles liés à chaque référence (archivés compris). Affichée dans la colonne « En stock » des listes d'achats.

## Fiches et listes à cocher

Voir aussi [Fiches](sheets.md).

- Sortie d'une référence (`consumeProduct`) : prend sur tous ses articles non archivés, en commençant par l'article dont le premier lot périme le plus tôt, puis lot par lot comme une sortie ; partielle si le stock manque.
- Utiliser une fiche (`useSheet(sheetId, multiplier)`) : multiplicateur > 0 (« Multiplicateur positif attendu. »), 999 au plus (« 999 au plus. ») ; fiche archivée refusée (« Fiche introuvable. » si absente). Chaque élément consommable, lié à une référence et avec une quantité sort quantité × multiplicateur (mouvement « Consommation » lié à la fiche). Renvoie le nombre d'éléments sortis et les libellés de ceux qui manquaient (`short`).
- Liste à cocher (`syncChecklistStock`) : élément consommable, lié à une référence, avec une quantité. Coché : sort sa quantité (une seule fois, s'il n'a pas déjà de mouvement). Décoché : repris comme un achat décoché.

## Commentaires et archivage

- Les articles prennent des commentaires, bloqués quand l'article est archivé ([Commentaires](../cross-cutting/comments.md)).
- Articles archivés par la mutation générique (`STOCK_ITEM`), emplacements par la liste de paramètres (`STOCK_LOCATION`). Un article archivé est en lecture seule : ni modification, ni mouvement, ni inventaire, ni date de lot ; il ne reçoit plus d'achats ni de consommations (un nouvel article est créé pour un achat). Voir [Archivage](../cross-cutting/archiving.md).

## Tâches de fond

Aucune.
