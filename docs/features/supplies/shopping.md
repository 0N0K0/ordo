# Achats

Ce que l'utilisateur peut faire dans la fonctionnalité « Achats » : les références (listes types de produits), les listes d'achats, le mode collecte, les commandes à distance et les paramètres (catégories, magasins, unités, modes de conservation). Sources : `apps/web/src/features/shopping/**`, et les liens vers le stock (`apps/web/src/features/stock/**`). Les règles appliquées par l'API sont dans [Règles des achats](../../business-rules/supplies/shopping.md).

## Vocabulaire

| Terme dans l'app              | Terme dans le code              | Rôle                                                                                    |
| ----------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| « Référence »                 | `ShoppingBaseList` (liste type) | Ensemble de produits achetés d'habitude (alimentation, fournitures scolaires…).         |
| « Produit » (d'une référence) | `ShoppingProduct`               | Ce qu'on achète d'habitude ; coché « Manque » quand il faut en racheter.                |
| « Liste »                     | `ShoppingList`                  | Liste d'achats concrète, faite à partir des produits manquants ou à la main.            |
| « Élément »                   | `ShoppingItem`                  | Ligne d'une liste : copie d'un produit d'une référence, ou élément « hors références ». |
| « Catégorie »                 | `ShoppingCategory`              | Classement des produits, en arbre ; peut être réservée à certaines références.          |
| « Magasin »                   | `ShoppingStore`                 | Magasin ou fournisseur où l'on achète.                                                  |
| « Unité »                     | `ShoppingUnit`                  | Unité de quantité (« kg », « boîte »…), gardée en texte sur les produits.               |
| « Mode de conservation »      | `ShoppingStorage`               | Comment se conserve un produit périssable (frais, congélation…).                        |
| « Livraison »                 | `ShoppingDelivery`              | Colis ou retrait d'une commande à distance.                                             |

## Accès et différences PRO / PERSO

- Menu latéral, groupe « Économat » : « Achats » (`/shopping`), avec « Fiches » et « Inventaire ». La page existe dans les deux types d'espace (seule la facturation est réservée au PRO).
- Différences PERSO / PRO :
  - nom proposé pour une nouvelle liste : « Achats du <date> » en PERSO, « Consommables du <date> » en PRO ;
  - description des magasins dans les paramètres : « Où vous achetez les produits. » (PERSO) ou « Magasins et fournisseurs des produits. » (PRO) ;
  - dans le formulaire d'un produit, la description du champ « Bénéficiaires » nomme les relations selon l'espace (`relationNoun`).
- Autres points d'entrée :
  - fiche d'une tâche (panneau) : section « Achats » (`TaskShopping`) ;
  - tableau des tâches : colonne « Achats » (listes de la tâche, lien vers une liste existante ou nouvelle liste) ;
  - page d'un projet : onglet des listes d'achats du projet (listes rattachées à une tâche du projet ou d'un sous-projet) ;
  - accueil : carte « Achats » (produits manquants, listes ouvertes et ce qu'il reste à acheter) ;
  - page d'une fiche : « Ajouter à une liste » (voir [Fiches](sheets.md)).

## Page « Achats » (`/shopping`)

En-tête « Achats », paramètres dans la barre latérale (« Paramètres des achats », voir plus bas), deux onglets (paramètre d'URL `tab`) :

- « Références » (`tab=base`, par défaut) ;
- « Listes » (`tab=lists`, adresse `SHOPPING_LISTS_PATH`).

### Onglet « Références »

- Un onglet par référence (paramètre d'URL `base` = id de la référence), avec son avatar (image ou initiales sur sa couleur), son nom, un badge « Archivée » le cas échéant et un badge orange du nombre de produits manquants.
- Onglets réordonnés par glisser-déposer (ordre enregistré comme les listes de paramètres).
- Menu de chaque onglet : « Modifier » (sauf archivée), « Archiver » / « Restaurer », « Supprimer ». Bouton « + » : « Nouvelle référence ».
- Interrupteur « Afficher les archivées » : les références archivées sont masquées par défaut ; affichées, elles sont en lecture seule.
- Formulaire de référence (panneau latéral « Nouvelle référence » / « Modifier la référence ») : libellé (requis, 250 caractères), image et couleur facultative (formulaire commun des paramètres). Une référence créée est sélectionnée à la fermeture.
- Suppression : confirmation « Supprimer la référence » : « « X » sera supprimée définitivement, avec N produits et leur historique d'achat. Les listes déjà faites gardent leurs éléments. » Toast « Référence supprimée. ».
- Aucune référence : état vide « Aucune référence : créez-en une par sorte d'achats (alimentation, fournitures scolaires, vêtements des enfants…), puis cochez ce qui manque pour générer une liste. » avec « Nouvelle référence ».

### Produits d'une référence

Tableau commun (`ShoppingTable`, la table de données de l'app) sous les onglets :

- Vues créées la première fois, groupées par catégorie : « Tous », « Manquants » (filtre « Manque » vrai). Recherche « Rechercher un produit ». Sans tri : l'ordre choisi à la main, sinon les produits par libellé (texte « Sans tri : l’ordre choisi à la main (glissez les produits), sinon par libellé. »).
- Regroupement : seulement celui de la vue, comme tout tableau (« Grouper par » des options, ou le menu d'en-tête d'une colonne) ; il se change ou se retire et s'enregistre dans la vue. « Catégorie » groupe en arbre des catégories proposées dans cette référence (« Sans catégorie » pour les produits sans) ; « Magasin », « Conservation » et « Bénéficiaires » dans l'ordre de leurs paramètres, avec « Sans magasin », « Non périssable ou sans mode », « Personne en particulier ». Un produit pour plusieurs personnes apparaît sous chacune. Les groupes sans produit ne s'affichent pas.
- Résumé de chaque groupe : « N manquants sur M ».
- Bascule en tête de ligne « Manque » (caddie orange) : clic pour marquer manquant ou non (« Manque : sera sur la prochaine liste générée (cliquer : ne manque plus) »). Modifiable en lot (sélection de cellules).
- Colonnes (affichables, triables, filtrables, groupables, exportables comme toute table) : « Libellé » (modifiable sur place, description en gris dessous), « Catégorie », « Magasin », « Quantité », « Unité », « Prix unitaire estimé » (total en pied), « Conservation » (« Non périssable », « Périssable » ou un mode), « Date de péremption » (rouge une fois dépassée), « Bénéficiaires », « Lien vers le produit », commentaires, « Dernier achat » (date · prix), et masquées par défaut : « Manque » (oui / non « Manquants » / « Pourvus » : triangle orange, coche bleue), « Suivie en stock » (« Suivis en stock » / « Non suivis en stock »), « Consommable » (« Consommable » / « Permanent »), « Ajout auto au stock » (« Ajoutés automatiquement au stock » / « Non ajoutés automatiquement au stock » ; modifiable seulement si suivie en stock), « Emplacement en stock ».
- Toutes les cellules sont modifiables sur place et en lot ; groupé par catégorie, magasin, conservation ou bénéficiaires, glisser une ligne sur un autre groupe (l'en-tête ou une ligne d'un groupe affiché) change sa catégorie, son magasin, son mode de conservation ou sa personne. Les groupes vides n'apparaissent pas pendant le glisser : pour mettre un produit dans une catégorie (un magasin…) qui n'a encore rien, on change sa cellule « Catégorie » (ou le champ du formulaire). Groupé par une autre colonne, le glisser ne change pas de valeur. Quand la vue n'a pas de tri, glisser une ligne la place aussi à la main (dans son groupe, dans un autre ou sans regroupement) : cet ordre est enregistré dans la vue (`manualOrder`, comme les tableaux sans enregistrement propre ; les produits et éléments n'ont pas de mutation d'ordre côté API).
- Ligne d'ajout au bout de chaque groupe et du tableau (non groupé, ou groupé en arbre sans groupe « Sans catégorie » affiché) : taper un nom puis Entrée crée un produit coché « Manque », dans ce groupe quand le tableau est groupé par catégorie, magasin, conservation ou bénéficiaires.
- Boutons : « Afficher les archivés », « Déplacer des produits » (vers une autre référence), « Nouveau produit », « Générer une liste (N) » (N = produits manquants non archivés ; ouvre « Nouvelle liste » avec cette référence cochée).
- Actions d'une ligne : « Modifier » (formulaire), « Déplacer vers une autre référence… », « Archiver » / « Restaurer », « Retirer » (confirmation « Retirer le produit » : « « X » sera retiré de la référence, avec son historique d'achat. Les listes déjà faites le gardent. »).
- Actions de la sélection : « Déplacer vers une autre référence… », « Retirer » (confirmation « Retirer les produits »), « Archiver ».
- Sous le tableau, quand des produits manquent : « Cocher un produit comme acheté sur une liste le retire des manquants. » et « Tout décocher » (plus aucun manquant).
- Référence archivée : tout est en lecture seule. Produit archivé : ligne grisée en lecture seule, badge « Archivé », absent des listes générées.
- Référence vide : « « X » est vide : ajoutez-y ce que vous achetez d'habitude. ».

### Formulaire d'un produit ou d'un élément

Panneau latéral « Nouveau produit » / « Modifier le produit » / « Élément hors références » / « Modifier l'élément » (`ShoppingForm`) :

| Champ                    | Règle                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| « Label »                | Requis, 250 caractères.                                                                                         |
| « Référence »            | Produit seulement, requis (« La liste type est requise. »).                                                     |
| « Catégorie »            | Arbre des catégories (celles de la référence pour un produit) ; taper un nom absent crée la catégorie.          |
| « Magasin »              | Facultatif ; taper un nom absent crée le magasin.                                                               |
| « Quantité »             | ≥ 0, facultative.                                                                                               |
| « Unité »                | Une unité des paramètres ; taper une unité absente l'ajoute aux paramètres.                                     |
| « Prix unitaire estimé » | ≥ 0, facultatif.                                                                                                |
| « Périssable »           | Case ; cochée, affiche « Mode de conservation » (créable) et « Date de péremption ».                            |
| « Bénéficiaires »        | Contributeurs et relations ; sert à la répartition d'un mouvement de trésorerie qui paie la liste.              |
| « Lien vers le produit » | URL http ou https.                                                                                              |
| « Description »          | Markdown, 65 536 caractères.                                                                                    |
| « Manque »               | Produit seulement ; coché par défaut pour un nouveau produit (« Il sera mis sur la prochaine liste générée. »). |

Un élément venu de fiches affiche « Vient de la fiche … » avec leur part. Les commentaires du produit ou de l'élément s'affichent sous le formulaire. Un nouveau produit ou élément : bouton « Ajouter », toast « Ajouté. ». Un produit ou un élément existant s'enregistre champ par champ : chaque champ dès qu'il change (« Label », « Quantité », « Prix unitaire estimé », « Lien vers le produit » et « Description » en les quittant), sans bouton « Enregistrer » ; « Enregistrement… » puis « Enregistré » en haut du panneau ; un champ invalide garde son erreur dessous et n'est pas enregistré, un échec le remet comme il était, dans un toast d'erreur ; un champ changé ailleurs (une cellule, un autre onglet) est repris, sauf pendant sa saisie. Un produit archivé s'ouvre en lecture seule, comme un élément d'une liste close ou archivée (action « Voir », panneau « Élément », commentaires en lecture seule) ; un produit d'une référence reste modifiable.

### Déplacer des produits

Panneau « Déplacer vers une autre référence » : « Produits » (multi-sélection, requis), « Vers la référence » (requis ; « Ils y passent après ses produits ; une catégorie qu'elle ne propose pas leur est retirée. »). Toast « N produits déplacés vers « X ». ».

### Onglet « Listes »

Table des listes (`ListsPanel`) :

- Vues créées la première fois : « En cours », « Clôturées ». Recherche « Rechercher (liste, produit) ». Sans tri : les plus récentes d'abord.
- Colonnes : « Liste » (modifiable sur place, lien « Ouvrir la liste », badges « Archivée » et « Payée »), « Tâches » (modifiables sur place), « Achats » (badge « achetés / requis », vert quand tout est acheté), « Total estimé », « Créée le », commentaires ; masquées par défaut : « Projet », « État » (« En cours » / « Clôturée »), « Restant », « Produits », « Clôturée le », « Payée » (oui / non : « Payée » / « À payer »), « Catégories », « Magasins », « Libellés des produits ».
- Une liste close ou archivée est en lecture seule.
- Boutons : « Afficher les archivées », « Nouvelle liste ».
- Menu de chaque ligne : les actions de la liste (voir « Actions d'une liste »).
- Sélection : « Dupliquer », « Clôturer » (ou « Rouvrir » si toutes sont closes à la main), « Archiver », « Supprimer » (confirmation : « N listes et leurs éléments seront supprimés définitivement. Les références et la répartition d'un mouvement rattaché ne changent pas. »). Aucune copie ni clôture si une liste archivée est sélectionnée.
- Vide : « Aucune liste pour le moment. » (sur un projet : « Aucune liste : une liste rattachée à une tâche du projet s'affiche ici. »).

### Nouvelle liste

Panneau « Nouvelle liste » (`NewListForm`) :

- « Libellé » (requis, 250 caractères ; proposé « Achats du … » ou « Consommables du … »).
- « Tâches » (multi-sélection des tâches ouvertes ; requis depuis un projet : « Choisissez une tâche du projet : la liste y apparaît par ses tâches. »).
- « Reprendre les produits manquants de » : une case par référence non archivée, « X (N manquants) », désactivée sans manquant.
- « D'autres produits des références pourront être ajoutés ensuite. »
- « Créer » : toast « Liste créée. » puis ouverture de la liste.

## Page d'une liste (`/shopping/:id`)

- Lien retour « Listes d'achats », titre, badge « Archivée » ou « Clôturée ».
- Sous-titre : tâches de la liste (avec leur état bloqué), mouvement de trésorerie rattaché (libellé · montant · date, lien vers la trésorerie), « N sur M achetés · X sur Y estimés » (les éléments facultatifs ne comptent pas dans la progression).
- Liste introuvable : page « Cette liste » introuvable, retour « Listes d'achats ».
- Chargement : squelette de tableau.

### Tableau des éléments

Même tableau que les références (`ShoppingTable`), avec :

- Vues créées la première fois, groupées par catégorie : « Tout », « À acheter » (filtre « Acheté » faux). Recherche « Rechercher un produit ». Sans tri : l'ordre choisi à la main, sinon celui de la liste (texte « Sans tri : l’ordre choisi à la main (glissez les éléments), sinon celui de la liste. »). Regroupement, glisser-déposer et ordre manuel de la vue, comme les références.
- Bascule en tête « Acheté » (coche verte) : « À acheter (cliquer : acheté) » / « Acheté (cliquer : pas encore acheté) ». Une ligne achetée est barrée. En lot aussi.
- Une fois des éléments cochés achetés, si certains sont des produits suivis en stock sans ajout automatique, le panneau « Ajouter au stock » s'ouvre (voir [Inventaire](stock.md)).
- Colonnes en plus de celles des produits : « Facultatif » (acheté si possible, la liste est faite sans ; oui / non « Facultatif » / « Obligatoire » : coche bleue, triangle orange), « Acheté » (masquée ; « Acheté » / « À acheter »), « En stock » (quantité en stock de la référence), « Livraison » (visible pour une commande à distance, modifiable : choix d'une livraison), « Fiches » (fiches d'origine, avec leur part : « Gâteau · 1,5 »), commentaires.
- Badge « hors liste » sur un élément qui ne vient d'aucune référence.
- Résumé de groupe : « achetés / total ».
- Ligne d'ajout : un menu propose « Depuis les références… » (s'il y a des références) ou « Hors références » (saisie d'un nom).
- Liste vide : « La liste est vide : ajoutez des produits des références ou d'autres éléments. ».
- Total en bas : « Total estimé : X ».
- Commentaires de la liste en bas de page (lecture seule si archivée).

### Boutons de la barre

- « Ajouter un produit » (si la liste n'est pas close) : « Depuis les références… » (désactivé sans référence), « Hors références… », « Depuis une fiche… » (panneau « Ajouter une fiche » : ajoute ou retire une fiche, avec un multiplicateur).
- « Commande à distance » ou « Commande · N livraisons en cours » (désactivé si archivée).
- « Mode collecte » (désactivé si vide ou archivée).
- Menu des actions de la liste.

### Ajouter des produits des références

Panneau « Ajouter des produits des références » (`ProductPicker`) : recherche, filtre par référence (« Toutes les références »), « Manquants seulement », « Tout cocher » / « Tout décocher », produits groupés par référence avec le chemin de leur catégorie et les badges « manque » et « déjà dans la liste » (cochés et verrouillés). « Ajouter (N) » : toast « N produits ajoutés. ». Références et produits archivés non proposés.

### Actions d'un élément

- « Modifier » (panneau de l'élément, liste non close) ; liste close ou archivée : « Voir » (même panneau, en lecture seule).
- « Ajouter à « Référence » » pour chaque référence (élément hors références, liste non close) : crée le produit dans la référence et lie l'élément. Toast « Ajouté à « X ». ».
- « Ajouter avec une autre date » (élément périssable) : ajoute la même ligne, non achetée, sans date (« Le même produit, acheté avec une autre date de péremption »). Toast « Ligne ajoutée : indiquez sa date. ».
- « Ajouter au stock… » : panneau « Ajouter au stock ».
- « Retirer de la liste » : sans confirmation pour un élément venu d'une référence ; confirmation « Retirer l'élément » (« « X » n'est dans aucune référence : il sera supprimé définitivement. ») sinon.
- Sélection : « Ajouter au stock… », « Retirer de la liste » (confirmation « Retirer les éléments »).

### Actions d'une liste

Menu de la liste (page et table des listes, `ListActionsMenu`) :

- « Renommer, changer de tâche » : panneau « Modifier la liste » (« Libellé », « Tâches » — les tâches de la liste restent proposées même closes), chaque champ enregistré dès qu'il change (le libellé en le quittant), « Enregistrement… » / « Enregistré », sans bouton.
- « Rattacher à un mouvement » : panneau « Rattacher à un mouvement de trésorerie » ; recherche d'un mouvement ou d'une prévision (2 caractères au moins) ; explication : chaque personne concernée reçoit une ligne de répartition. Toast « Liste rattachée : la répartition a été ajoutée au mouvement. ». Une fois rattachée : « Détacher du mouvement » (« Liste détachée du mouvement (sa répartition reste). »).
- « Dupliquer » : toast « Liste dupliquée. » puis ouverture de la copie.
- « Copier en texte » : texte pour un message (catégories indentées, ☐/☑, quantité, personnes, prix, note, lien, total). Toasts « Liste copiée : collez-la dans un message. » ou « La liste n'a pas pu être copiée. ».
- « Exporter en PDF » : colonnes « Acheté » (« Oui » pour un élément acheté, vide sinon : plus lisible sur papier), « Produit », « Quantité », « Pour », « Note », « Prix estimé » ; sous-titre « Total estimé : X ». Groupé comme la liste est affichée sur sa page quand sa vue est groupée par catégorie, magasin, conservation ou bénéficiaires ; sinon (et depuis la table des listes) par catégorie.
- « Clôturer » / « Rouvrir » (« Liste clôturée. » / « Liste rouverte. »). Une liste close avec ses tâches ne se rouvre pas d'ici : « Les tâches de la liste sont fermées : rouvrez-en une pour rouvrir la liste. ».
- « Archiver » / « Restaurer ».
- « Supprimer » : confirmation « Supprimer la liste » (« « X » et ses N éléments seront supprimés définitivement. Les références et la répartition d'un mouvement rattaché ne changent pas. »). Toast « Liste supprimée. », retour aux listes.
- Liste archivée : seulement les exports, « Restaurer » et « Supprimer ».

### États d'une liste

| État                                                   | Affichage          | Effet                                                                                                      |
| ------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| En cours                                               | —                  | Tout est modifiable.                                                                                       |
| Clôturée (à la main ou avec ses tâches toutes fermées) | Badge « Clôturée » | Éléments en lecture seule (ajout, modification, retrait masqués ; l'API les refuse) ; reste utilisable en mode collecte. |
| Archivée                                               | Badge « Archivée » | Lecture seule (l'API refuse les changements) ; masquée par défaut dans la table.                           |
| Payée                                                  | Badge « Payée »    | Rattachée à un mouvement de trésorerie.                                                                    |

## Mode collecte

Bouton « Mode collecte » : vue plein écran (`StoreMode`) pour faire les courses au pouce.

- En-tête : nom de la liste, « N à acheter · M sur T achetés », bouton « Quitter le mode collecte ».
- Commande à distance : d'abord une section par livraison avec ses éléments à recevoir, « À retirer » / « À livrer », la fenêtre de dates, le lieu, un lien « Suivi », et un bouton « Réceptionnée » (toast « Livraison réceptionnée. », ses éléments sont cochés achetés et proposés pour le stock).
- Puis une section par magasin (dans l'ordre des magasins, puis « Sans magasin »), et dans chaque magasin l'arbre des catégories. Chaque titre se replie et porte le nombre d'éléments restant (vert à 0).
- Chaque élément est une grande ligne cochée d'un tap (avec sa quantité) ; cocher propose l'ajout au stock si besoin.
- Les achetés sont regroupés en bas sous « Acheté » (repliable). Tout acheté : « Tout est acheté. ».

## Commande à distance

Panneau « Commande à distance » (`OrderPanel`) :

- Interrupteur « Commande à distance » (« Livrée, ou à retirer : suivie par ses livraisons. »).
- « Lieu de livraison » : recherche d'adresse ou de lieu enregistré ; enregistré quand une adresse proposée est choisie ou quand le texte est vidé.
- Section « Livraisons » : « Ajouter une livraison » ; vide : « Aucune livraison : ajoutez-en une par colis (ou par retrait). ».
- Chaque livraison : nom (ou « Retrait » / « Livraison »), badges « à retirer », « réceptionnée le … », fenêtre, adresse, nombre d'éléments, lien « Suivi » ; actions « Réceptionnée (ses éléments achetés) » / « Pas encore réceptionnée », « Modifier », « Supprimer » (confirmation : « La livraison sera supprimée ; ses éléments restent sur la liste, sans livraison. »).
- Formulaire d'une livraison (« Nouvelle livraison » / « Modifier la livraison ») : « Libellé » (« Colis 1, Drive, Pharmacie… », 250 caractères), « Suivi de livraison » (URL), « À retirer », période « Attendue » (bouts « À partir du » / « Au plus tard le » ; « À retirer » : « À partir du » / « Jusqu’au »), un seul champ, chaque bout facultatif, « Lieu de livraison » ou « Lieu de retrait » (vide : celui de la commande), « Éléments de la livraison » (par défaut, pour une nouvelle livraison, les éléments sans livraison). Nouvelle : bouton « Ajouter », toast « Livraison ajoutée. ». Existante : chaque champ enregistré dès qu'il change (libellé et suivi en les quittant, le lieu quand une adresse proposée est choisie, quand le texte est vidé ou en le quittant), « Enregistrement… » / « Enregistré », sans bouton ; un champ invalide garde son erreur dessous et n'est pas enregistré, un échec le remet comme il était, dans un toast d'erreur ; un champ changé ailleurs (une cellule, un autre onglet) est repris, sauf pendant sa saisie. Voir la remarque sur les dates dans [Code web des achats](../../web/features/supplies/shopping.md#componentsorderpaneltsx).

## Paramètres des achats

Barre latérale « Paramètres des achats » (pages `/shopping` et `/shopping/:id` ; les catégories aussi dans les paramètres des fiches) :

- « Catégories » : arbre ; glisser une catégorie sur une autre pour l'y ranger ; une sous-catégorie sans couleur prend celle de sa parente ; champ « Références » (aucune : toutes ; une sous-catégorie sans liste prend celles de sa parente) ; badges des références de chaque catégorie ; nombre de produits, éléments et éléments de fiches qui l'utilisent.
- « Magasins » : nom, couleur, image ; usage en nombre de produits et éléments.
- « Unités » : nom et image, sans couleur ; « Renommer une unité la renomme dans les produits et les listes. » ; un nouvel espace commence avec « pièce », « kg », « g », « L », « cl », « boîte », « paquet », « bouteille », « sachet », « lot », « rouleau », « carton », « paire ».
- « Modes de conservation » : « Comment se conservent les produits périssables : frais, congélation, à l'abri de la lumière… ».
- Chaque liste : ajout, modification, archivage, suppression, ordre manuel (voir [Paramètres](../cross-cutting/settings.md)).

## Ce qui se passe automatiquement

- Cocher un élément acheté : son produit n'est plus « Manque », sa date et son prix de dernier achat sont mis à jour ; décoché, il manque à nouveau.
- Produit suivi en stock avec « Ajout auto au stock » : l'achat entre dans le stock sans question (et en sort si on décoche).
- Liste dont toutes les tâches sont fermées : affichée « Clôturée ».

Pas de tâche de fond pour les achats.
