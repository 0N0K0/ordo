# Inventaire

Ce que l'utilisateur peut faire sur la page « Inventaire » : le stock (articles et lots), ses mouvements, les inventaires faits, les emplacements, et les liens avec les achats et les fiches. Sources : `apps/web/src/features/stock/**`, et les réglages de stock des références dans `apps/web/src/features/shopping/components/BaseList.tsx`. Les règles de l'API sont dans [Règles du stock](../../business-rules/supplies/stock.md).

## Vocabulaire

| Terme dans l'app              | Terme dans le code             | Rôle                                                                                                  |
| ----------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| « Article »                   | `StockItem`                    | Ce qui est en stock : une référence suivie en stock, ou un article à lui.                             |
| « Lot »                       | `StockLot`                     | Quantité d'un article avec sa date de péremption ; la quantité de l'article est la somme de ses lots. |
| « Mouvement »                 | `StockMovement`                | Entrée ou sortie de quantité, signée, avec son origine.                                               |
| « Inventaire »                | `StockCount`                   | Comptage d'un emplacement (ou de tout le stock) un jour donné.                                        |
| « Emplacement »               | `StockLocation`                | Où sont rangés les articles, en arbre (« Cuisine › Frigo »).                                          |
| « Référence suivie en stock » | `ShoppingProduct.stockTracked` | Produit d'une référence des achats dont les achats entrent dans le stock.                             |

## Accès

- Menu latéral, groupe « Économat » : « Inventaire » (`/stock`). Identique en PRO et en PERSO.
- Paramètres dans la barre latérale : « Paramètres de l'inventaire ».
- Trois onglets (paramètre `tab`) : « Stock » (`stock`, par défaut), « Mouvements » (`movements`), « Inventaires » (`counts`).

## Onglet « Stock »

Table des articles (`StockTable`), comme toutes les tables (vues, filtres, tris, groupes, export) :

- Recherche « Rechercher (article, description) ».
- Colonnes :
  - « Article » (modifiable sur place ; badge « Archivé » ; si l'article a plusieurs lots, un repli « lots » montre le tableau de ses lots sous la ligne) ;
  - « Emplacement » (modifiable, arbre des emplacements) ;
  - « Catégorie » (catégorie des achats, modifiable ; groupée, en arbre des catégories avec « Sans catégorie ») ;
  - « Quantité » (somme des lots, grisée à 0) ;
  - « Unité » (modifiable, unités des achats) ;
  - « Date de péremption » : la première date des lots, en badge rouge si dépassée, orange avec un signe d'alerte à 3 jours ou moins, gris sinon ;
  - « Bénéficiaires » (modifiables) ;
  - masquées par défaut : « Lots » (quantité · date de chaque lot), « Périssable » (case modifiable ; oui / non « Périssable » / « Durable » : triangle orange, coche bleue), « Consommable » (celui de la référence ; un article à lui est consommable ; « Consommable » / « Permanent »), « Référence » (nom de la référence ; filtre oui / non), « Valeur » (dernier prix de la référence × quantité, total en pied), « Description » (markdown, modifiable dans l'éditeur markdown ouvert dans un popover), « Modifié le » ;
  - commentaires.
- Toutes les cellules modifiables le sont aussi en lot (sélection de cellules).
- Boutons : « Afficher les archivés », « Faire l'inventaire » (désactivé sans article non archivé), « Nouvel article ».
- Action principale d'une ligne : « Retirer 1 » (consommation d'une unité ; « Il n'y en a plus en stock. » s'il n'y a rien).
- Menu d'une ligne : « Consommer, ajouter, perdre… », « Historique » (mouvements de l'article, panneau large), « Archiver » / « Restaurer », « Supprimer ».
- Sélection : « Archiver », « Supprimer » (confirmation : « … seront supprimés définitivement du stock, avec leurs lots et leur historique. »).
- Article archivé : masqué par défaut, en lecture seule (ni retrait, ni mouvement).
- Vide : « Rien en stock : ajoutez des articles (le contenu du garage, du congélateur…), ou cochez « suivie en stock » sur des références : leurs achats y arrivent. ».

Il n'y a pas de formulaire de modification d'un article : ses champs se changent dans le tableau.

### Lots d'un article

Tableau des lots déplié sous l'article (`LotsTable`) : « Quantité » (modifiable : l'écart est enregistré comme une « Correction »), « Date de péremption » (modifiable), « Entré le ». Modifiable en lot ; lecture seule si l'article est archivé.

### Nouvel article

Panneau « Nouvel article » (`StockItemForm`) :

| Champ             | Règle                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Article »       | Requis, 250 caractères. Saisie libre avec proposition des références : choisir une référence reprend sa catégorie, son unité, « Périssable » et son emplacement par défaut. |
| « Emplacement »   | Facultatif ; taper un nom absent crée l'emplacement.                                                                                                                        |
| « Catégorie »     | Catégorie des achats, créable.                                                                                                                                              |
| « Quantité »      | ≥ 0, quantité de départ (enregistrée comme un inventaire « Quantité de départ »).                                                                                           |
| « Unité »         | Unité des achats, créable.                                                                                                                                                  |
| « Périssable »    | « Par lots datés » ; cochée, affiche « Date de péremption » (date du premier lot).                                                                                          |
| « Bénéficiaires » | Contributeurs et relations.                                                                                                                                                 |
| « Description »   | Markdown, dans l'éditeur markdown partagé, 65 536 caractères (règle des notes de produit).                                                                                  |

Toast « Article ajouté au stock. ».

### Consommer, ajouter, perdre

Panneau au nom de l'article (`StockMoveForm`) :

- Rappel « En stock : X. ».
- Type : « Consommation » (par défaut), « Achat », « Perte ».
- « Quantité » (> 0, 1 par défaut, avec l'unité).
- « Lot » (s'il y a plusieurs lots, ou à l'ajout s'il y en a un) : sans choix, la sortie se fait sur « Ceux qui périment le plus tôt », l'ajout sur « Un nouveau lot » (périssable) ou « Le lot de l'article ».
- « Date de péremption » à l'ajout d'un article périssable sans lot choisi.
- « Note » : markdown, dans l'éditeur markdown partagé (65 536 caractères).
- Toasts « Ajouté au stock. » / « Retiré du stock. ».

### Faire l'inventaire

Panneau large « Faire l'inventaire » (`StockCountForm`) :

- « Emplacement » (« Tout le stock » par défaut) : les articles de l'emplacement et de ses sous-emplacements ; les archivés ne sont pas comptés.
- Tableau : « Article », « Emplacement », « Attendu », « Compté » (saisie, l'attendu en indication).
- « Saisissez ce que vous comptez : seuls les articles comptés sont enregistrés, l'écart avec l'attendu est noté dans l'historique. »
- « Description » : markdown, dans l'éditeur markdown partagé (65 536 caractères).
- « Enregistrer l'inventaire » (désactivé sans compte) : toast « Inventaire enregistré (N articles). ».

## Onglet « Mouvements »

Table des mouvements, les plus récents d'abord (2000 au plus) (`MovementsTable`) : « Date » (date et heure), « Mois », « Article », « Mouvement » (badge coloré : « Achat » vert, « Consommation » bleu, « Inventaire » violet, « Perte » rouge, « Correction » gris), « Quantité » (signée), « Origine » (« Liste « X » » avec lien vers la liste, « Fiche « X » » avec lien vers la fiche, « Liste à cocher », « Inventaire »), « Description » (note). Vide : « Aucun mouvement. ». La même table, filtrée sur un article, sert à « Historique ».

## Onglet « Inventaires »

Table des inventaires, les plus récents d'abord : « Date », « Emplacement » (son chemin, ou « Tout le stock »), « Écarts notés » (nombre de mouvements créés), « Description ». Vide : « Aucun inventaire : « Faire l'inventaire » depuis le stock. ».

## Paramètres de l'inventaire

« Emplacements » : arbre (« Où sont rangés les articles, en arborescence (Cuisine › Frigo) : glissez un emplacement sur un autre pour l'y ranger. »), nom, couleur, image, parent ; usage en nombre d'articles ; ajout, modification, archivage, suppression (ses sous-emplacements remontent d'un niveau, ses articles restent sans emplacement). Puis « Catégories » et « Unités » des articles : celles des achats, les mêmes listes et le même enregistrement que dans les paramètres des achats (voir [Achats](shopping.md)). En dernier, « Colonnes des nouvelles vues » des tableaux « Stock », « Lots d’un article », « Mouvements », « Historique d’un article », « Inventaires » et « Faire l’inventaire » ([Colonnes des nouvelles vues](../cross-cutting/settings.md#colonnes-des-nouvelles-vues)). Voir [Paramètres](../cross-cutting/settings.md).

## Lien avec les achats

- Sur une référence des achats (colonnes masquées par défaut du tableau des produits) : « Suivie en stock », « Consommable », « Ajout auto au stock » (seulement si suivie), « Emplacement en stock ». Modifiables sur place et en lot.
- Élément coché acheté sur une liste (tableau, mode collecte, livraison réceptionnée) :
  - référence suivie avec ajout automatique : l'achat entre dans le stock tout seul (quantité de l'élément, ou 1 ; emplacement de la référence ; date de l'élément) ;
  - référence suivie sans ajout automatique : le panneau « Ajouter au stock » s'ouvre ;
  - décoché : ce que l'achat avait mis dans le stock en est retiré, sans trace dans l'historique.
- Panneau « Ajouter au stock » (`StockPurchaseForm`, aussi par « Ajouter au stock… » sur un élément ou une sélection) : « Ce qui est acheté entre dans le stock ; les dates de péremption créent des lots. » Pour chaque élément : « Quantité » (celle de l'élément, ou 1), « Emplacement » (celui de la référence ; s'il est archivé, le premier emplacement non archivé), « Date de péremption » (celle de l'élément). Boutons « Plus tard » et « Ajouter au stock » (toast « Ajouté au stock. »). Les lignes à 0 sont ignorées.
- Colonne « En stock » d'une liste d'achats : quantité en stock de la référence (tous ses articles).

## Lien avec les fiches et les listes à cocher

- « Utiliser » une fiche (avec un multiplicateur) retire du stock les quantités de ses éléments consommables liés à une référence ; l'API renvoie ceux qui manquaient. Voir [Fiches](sheets.md).
- Cocher un élément consommable d'une liste à cocher retire sa quantité du stock ; décocher la rend.

## Tâches de fond

Aucune.
