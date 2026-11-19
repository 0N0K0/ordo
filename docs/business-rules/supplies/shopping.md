# Règles des achats

Règles appliquées par l'API aux références (listes types), produits, listes d'achats, éléments, commandes à distance et paramètres des achats. Sources : `apps/api/src/services/shopping/shopping.ts`, `refs.ts`, `people.ts`, la partie « Remote orders » de `stock.ts`, `apps/api/src/graphql/modules/shopping.ts` et `stock.ts`, `packages/shared/src/shopping/shopping.ts` et `stock.ts`. Ce que voit l'utilisateur : [Achats](../../features/supplies/shopping.md).

Toutes les données sont propres à l'espace de travail courant (colonne `workspaceId`, voir [Espaces et accès](../cross-cutting/workspaces-and-access.md)). Les erreurs suivent le format commun ([Erreurs](../cross-cutting/errors.md)) : « X introuvable. » (NOT_FOUND), « Élément archivé : restaurez-le pour le modifier. » (BAD_USER_INPUT, sous le champ quand il y en a un).

## Limites et formats communs

Source : `packages/shared/src/shopping/shopping.ts`.

| Champ                                             | Règle                                                          | Message                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Libellé d'un produit ou d'un élément              | Requis, 120 caractères (`SHOPPING_LABEL_MAX`), espaces retirés | « Le libellé est requis. », « 120 caractères maximum. »                           |
| Libellé d'une liste                               | Requis, 120 caractères (`SHOPPING_LIST_LABEL_MAX`)             | idem                                                                              |
| Libellé d'une référence                           | Requis, 80 caractères                                          | idem                                                                              |
| Libellé d'une catégorie                           | Requis, 100 caractères                                         | idem                                                                              |
| Libellé d'un magasin, mode de conservation, unité | Requis, 50 caractères (`labelFormSchema`)                      | idem                                                                              |
| Quantité                                          | Nombre, 0 à 999 999, facultative                               | « Nombre attendu. », « Quantité positive attendue. », « Quantité trop grande. »   |
| Unité                                             | Texte facultatif, 50 caractères (`UNIT_MAX`) ; vide → null     | « 50 caractères maximum. »                                                        |
| Note (description)                                | Texte facultatif, 500 caractères (`ITEM_NOTE_MAX`)             | « 500 caractères maximum. »                                                       |
| Prix unitaire                                     | 0 à 9 999 999, facultatif                                      | « Montant attendu. », « Le prix ne peut pas être négatif. », « Prix trop grand. » |
| Lien                                              | URL http ou https, ou vide (→ null)                            | « Lien invalide (http ou https). »                                                |
| Bénéficiaires                                     | 50 membres et 50 relations au plus                             | —                                                                                 |
| Date de péremption                                | `YYYY-MM-DD` ou null                                           | —                                                                                 |

Ces limites (unité, note, quantité) sont les mêmes pour les fiches et le stock (décision A de `docs/code-redundancies.md`).

Stockage : quantité en décimal (12, 3), prix en décimal (14, 4).

## Paramètres : catégories, magasins, modes de conservation, unités

Source : `apps/api/src/services/shopping/shopping.ts`, `services/core/trees.ts`, `services/core/labels.ts`.

### Catégories (arbre)

- Créée en dernier parmi ses sœurs ; déplacée sous un autre parent, elle passe en dernier. Déplacement (`moveShoppingCategory`) sous un parent ou à la racine, à un index (dernier sans index), en gardant nom, couleur et références.
- Le parent doit exister (« Catégorie parente introuvable. ») et ne pas être la catégorie ni une descendante (« Une catégorie ne peut pas être rangée sous elle-même. », sous `parentId`).
- Rien de nouveau sous un parent archivé (le parent actuel reste valable). Une catégorie archivée ne se modifie ni ne se déplace.
- Couleur facultative (`#rrggbb`) ; sans couleur, une sous-catégorie prend celle de sa parente (affichage).
- `baseListIds` (100 au plus) : références où elle est proposée. Aucune : toutes. Une sous-catégorie sans référence prend celles de son ancêtre le plus proche qui en a. Une référence archivée ne peut plus être choisie (« Référence introuvable. » si elle n'existe pas) ; celles déjà là restent.
- Suppression : ses sous-catégories remontent d'un niveau (sous son parent), ses produits, éléments, éléments de fiches, de listes à cocher et articles du stock restent sans catégorie.

### Magasins et modes de conservation

- Liste à ordre manuel, créé en dernier, libellé unique dans l'espace : « Un magasin porte déjà ce libellé. » / « Un mode de conservation porte déjà ce libellé. » (CONFLICT).
- Couleur requise (`labelFormSchema`). Un élément archivé ne se modifie pas.
- Suppression : les produits, éléments (et éléments de fiches) qui l'utilisaient restent sans magasin / sans mode.

### Unités

- Même service de libellés, libellé unique (« Une unité porte déjà ce libellé. »), couleur inutilisée (`gray` par défaut).
- Les produits et éléments gardent l'unité **en texte**. Renommer une unité renomme ce texte sur tous les produits et éléments des listes qui l'avaient (même transaction).
- Supprimer une unité vide l'unité des produits et éléments qui l'avaient (leur quantité reste).
- Un nouvel espace commence avec les unités `DEFAULT_SHOPPING_UNITS` (« pièce », « kg », « g », « L », « cl », « boîte », « paquet », « bouteille », « sachet », « lot », « rouleau », « carton », « paire »), si l'espace n'en a aucune (`services/workspaces/workspaces.ts`).

### Archivage des paramètres

Catégories, magasins, modes, unités, références et emplacements sont des listes de paramètres archivables par la mutation générique ([Archivage](../cross-cutting/archiving.md)). Règle commune des valeurs choisies (`services/shopping/refs.ts`, `assertActiveRefs`) : une catégorie, un magasin, un mode, un emplacement, une référence ou une unité **archivés** sont refusés quand on les choisit de nouveau, mais restent valables sur un élément qui les a déjà. Pour l'unité, le test se fait par libellé : une unité changée vers une unité archivée est refusée.

## Références (listes types)

- Création en dernier (`nextPositionIn`). Ordre changé comme les autres listes de paramètres (`reorderSettingsItems('SHOPPING_BASE_LIST')`).
- Renommer : refusé si archivée (« Référence introuvable. » si absente).
- Suppression (`deleteShoppingBaseList`) : supprime ses produits (cascade) avec leur historique d'achat. Les éléments des listes faites à partir d'eux restent (leur lien `productId` est vidé).

## Produits d'une référence

### Création et modification

- Champs : ceux d'un élément + `baseListId` (requis : « La liste type est requise. ») + `missing`.
- La catégorie, le magasin et le mode doivent exister (« Catégorie introuvable. », « Magasin introuvable. », « Mode de conservation introuvable. ») et ne pas être nouvellement archivés.
- La référence choisie doit exister et ne pas être archivée (« Référence introuvable. » / « Élément archivé… » sous `baseListId`).
- Modification refusée pour un produit archivé (« Produit introuvable. » s'il n'existe pas) ou dont la référence actuelle est archivée (`assertNotArchived('SHOPPING_BASE_LIST')`).
- Non périssable : mode de conservation et date de péremption sont mis à null, quoi qu'on envoie.
- Les bénéficiaires sont vérifiés comme des bénéficiaires : tout contributeur, toute relation (`assertPeople` → `assertBeneficiaries`, voir [Personnes](../cross-cutting/people.md)).
- Modifier un produit ne change pas les listes déjà faites (elles en ont une copie).

### Manque

- `setShoppingProductsMissing(ids, missing)` : tous les produits doivent exister et ne pas être archivés.
- Cocher acheté un élément issu d'un produit : le produit n'est plus manquant, `lastPurchasedAt` = maintenant, `lastPrice` = prix unitaire de l'élément (s'il en a un). Décocher : le produit redevient manquant (sa date et son prix de dernier achat restent).
- Date du produit (`expiresAt`) : recalculée à chaque achat ou modification d'un élément acheté : la date la plus tardive parmi les éléments achetés de ce produit **sur la liste de son dernier achat** (null sans achat). Elle est pour information ; le stock garde les dates de ses lots. La description GraphQL annonce « once past, the product is marked missing » : aucun code ni tâche de fond ne le fait (à vérifier).

### Déplacement vers une autre référence

`moveShoppingProducts(ids, baseListId)` :

- La référence cible doit exister et ne pas être archivée ; les produits doivent exister et ne pas être archivés.
- Ceux déjà dans la cible ne bougent pas ; les autres passent après les produits de la cible, dans leur ordre.
- Un produit garde sa catégorie si la cible la propose (catégorie rattachée à la cible, ou à aucune référence, ou via son ancêtre le plus proche qui a des références) ; sinon il la perd.
- Renvoie le nombre de produits déplacés.

### Suppression d'un produit

`deleteShoppingProduct` : possible même archivé ; les éléments des listes qui en viennent restent (lien vidé). Les articles du stock liés gardent leur libellé (lien vidé).

## Listes d'achats

### Création

`createShoppingList(label, taskIds, baseListIds)` :

- Tâches : doivent exister et ne pas être archivées (« Tâche introuvable. »).
- Références : doivent exister et ne pas être archivées (« Référence introuvable. »).
- La liste reçoit une copie de chaque produit **manquant et non archivé** des références choisies, triés par libellé : libellé, catégorie, magasin, lien, note, quantité, unité, prix, périssable, mode, bénéficiaires, lien `productId`. La date de péremption n'est pas copiée.
- L'interface ne passe que les références qui ont des manquants ; depuis un projet, elle exige une tâche du projet (« Choisissez une tâche du projet : la liste y apparaît par ses tâches. ») — règle de l'interface, pas de l'API.

### Modification d'une liste

`updateShoppingList(id, label, taskIds)` : refusé si la liste est archivée. Les tâches déjà rattachées restent valables même archivées ; une nouvelle tâche archivée est refusée.

### Clôture

- Une liste est **close** si `closedAt` est rempli (à la main) **ou** si elle a des tâches et que toutes sont fermées (champ calculé `closed`).
- `setShoppingListClosed(id, closed)` : refusé si archivée. Clore garde la date d'une clôture déjà faite.
- Rouvrir une liste dont toutes les tâches sont fermées est refusé : « La tâche de cette liste est fermée : rouvrez la tâche. » (une tâche) ou « Les tâches de cette liste sont fermées : rouvrez-en une. » (plusieurs).
- La lecture seule d'une liste close est appliquée par l'interface : l'API ne refuse les changements d'éléments que pour une liste **archivée**.

### Duplication

`duplicateShoppingList` : refusée si archivée. La copie s'appelle « X (copie) » (coupée à 120 caractères en gardant le suffixe), ouverte, avec une copie de tous les éléments (dans l'ordre), **sans** tâche ni mouvement de trésorerie. Les éléments copiés (`copyOf`) ne sont pas achetés et n'ont ni date de péremption, ni « Facultatif », ni fiches d'origine, ni livraison ; leur lien au produit, leurs champs d'achat et leurs bénéficiaires sont gardés. La commande à distance n'est pas copiée.

### Suppression d'une liste

`deleteShoppingList` : supprime la liste, ses éléments et ses livraisons (cascade). Les lignes de répartition ajoutées au mouvement de trésorerie restent. Les mouvements de stock qui venaient de ses éléments restent (lien vidé).

### Rattachement à un mouvement de trésorerie

`attachShoppingListEntry(id, entryId)` :

- Refusé si la liste est archivée.
- `entryId` null : détache ; les lignes de répartition ajoutées restent.
- Déjà rattachée à ce mouvement : « La liste est déjà rattachée à ce mouvement. ».
- Mouvement archivé refusé ; absent : « Mouvement introuvable. ».
- Calcul (`shoppingShares`, `packages/shared/src/shopping/shopping.ts`) :
  - coût d'un élément = quantité (1 sans quantité) × prix unitaire, arrondi au centime (`shoppingCost`) ; sans prix, 0 ;
  - un élément pour plusieurs personnes est partagé à parts égales ; les centimes restants vont aux premières personnes (membres puis relations) ;
  - un élément pour personne n'est pas réparti (mais compte dans le total).
- Une ligne de répartition par personne, ajoutée après les lignes existantes, libellée du nom de la liste (coupé à 200 caractères) :
  - en montant si le total de la liste ≤ |montant du mouvement| : valeur = part en euros, du signe du mouvement (négatif pour un mouvement à 0) ;
  - en pourcentage sinon : part / total × 100, arrondi à 4 décimales.
- Plus de 50 lignes au total : « Le mouvement aurait plus de 50 lignes de répartition. ».
- Voir aussi [Trésorerie](../finances/treasury.md).

## Éléments d'une liste

### Règles générales

- Toute modification d'un élément (ajout, modification, achat, duplication, ajout à une référence, retrait) est refusée si la liste est archivée (« Liste introuvable. » si absente, « Élément introuvable. » pour un élément absent).
- Mêmes validations que les produits (catégorie, magasin, mode, valeurs archivées, bénéficiaires, périssable).
- `optional` (« Facultatif ») : acheté si possible, la liste est faite sans ; ne compte pas dans la progression ni dans « Restant ».
- `sheetSources` : fiches d'origine avec leur part de la quantité (vide : ajouté à la main). Rempli par l'ajout d'une fiche, voir [Fiches](sheets.md).
- Ordre : position manuelle, un nouvel élément va en dernier.

### Ajouts

- `addShoppingItem` : élément « hors références » (sans produit).
- `addShoppingProducts(listId, productIds)` : 500 produits au plus à la fois (« 500 produits au plus à la fois. ») ; produits existants et non archivés ; ceux déjà dans la liste (même `productId`) sont ignorés ; ajoutés par libellé, après les éléments existants. Renvoie le nombre ajouté.
- `duplicateShoppingItem` : ajoute la même ligne (même produit, mêmes champs copiés par `copyOf`), non achetée, sans date, en dernier — pour le même produit acheté avec une autre date.
- `saveShoppingItemToBase(id, baseListId)` : refusé si l'élément vient déjà d'une référence (« Cet élément est déjà dans une référence. ») ou si la référence est archivée. Crée le produit avec les champs de l'élément ; acheté : avec sa date de péremption, `lastPurchasedAt`, `lastPrice`, non manquant ; non acheté : manquant. L'élément est lié au nouveau produit.

### Modification d'un élément

`updateShoppingItem` : le produit de la référence ne change pas, sauf sa date (recalculée si l'élément est acheté).

### Achat

`setShoppingItemPurchased(id, purchased)` (transaction) :

- Cocher garde la date d'un achat déjà fait.
- Produit d'origine : voir « Manque » ci-dessus.
- Stock : voir [Règles du stock](stock.md#achats-et-stock) (ajout automatique d'une référence suivie, reprise au décochage).

### Retrait

`deleteShoppingItem` : supprime l'élément (les mouvements de stock qui en viennent restent, lien vidé).

## Commandes à distance et livraisons

Source : `apps/api/src/services/shopping/stock.ts` (« Remote orders »), `packages/shared/src/shopping/stock.ts`.

- `setShoppingOrder(listId, { remote, deliveryAddress, deliveryLat, deliveryLon })` : liste existante et non archivée ; adresse 500 caractères, vide → null.
- Livraison (`shoppingDeliverySchema`) :
  - « Libellé » 120 caractères (« 120 caractères maximum. »), vide → null ;
  - lien de suivi http(s) (« Lien invalide (http ou https). ») ;
  - `pickup` : à retirer plutôt que livrée ;
  - fenêtre `windowFrom` / `windowTo` : la fin doit suivre le début (« La fin doit suivre le début. ») ;
  - adresse 500 caractères ; sans adresse, lat / lon sont mis à null ;
  - `itemIds` : 500 au plus, tous de la liste de la livraison (sinon « Élément introuvable. »).
- Un élément appartient à une seule livraison : l'assigner à une livraison l'enlève de la précédente ; enregistrer une livraison retire d'elle les éléments qui ne sont plus dans `itemIds`.
- Création en dernier parmi les livraisons de la liste ; création refusée si la liste est archivée ; modification, suppression et réception refusées si la liste est archivée (« Livraison introuvable. » si absente).
- Suppression : ses éléments restent sur la liste, sans livraison.
- Réception (`setShoppingDeliveryReceived(id, true)`) : `receivedAt` (garde une date déjà mise) ; chaque élément non encore acheté de la livraison est coché acheté (même effets qu'un achat : produit, stock automatique). Renvoie les éléments cochés maintenant (l'interface propose de les mettre en stock). Annuler la réception vide seulement `receivedAt` : les éléments restent achetés.

## Commentaires

Les listes, produits et éléments prennent des commentaires (`services/core/comments.ts`) ; un commentaire sur un élément est bloqué quand sa liste est archivée, sur un produit quand il est archivé. Voir [Commentaires](../cross-cutting/comments.md).

## Archivage

Listes et produits sont archivés par la mutation générique (`SHOPPING_LIST`, `SHOPPING_PRODUCT`) ; les références par la liste de paramètres (`SHOPPING_BASE_LIST`). Archivé = lecture seule jusqu'à restauration. Un produit archivé n'est plus copié dans les nouvelles listes ni proposé à l'ajout. Voir [Archivage](../cross-cutting/archiving.md).

## Tâches de fond

Aucune.
