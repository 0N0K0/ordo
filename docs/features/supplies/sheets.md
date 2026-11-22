# Fiches

Ce que l'utilisateur peut faire avec les fiches : des listes d'éléments utilisés ensemble (une recette, le contenu d'une valise, une trousse…), ajoutées aux listes d'achats, utilisées pour retirer leurs éléments du stock, ou attachées à une routine, un évènement ou une tâche pour en faire une liste à cocher. Sources : `apps/web/src/features/sheets/`. Règles : [Règles des fiches](../../business-rules/supplies/sheets.md) ; code : [Code web des fiches](../../web/features/supplies/sheets.md).

## Accès

- Page « Fiches », route `/sheets` (`PAGES.sheets`, icône `ClipboardTextIcon`), dans la navigation principale.
- Page d'une fiche : `/sheets/:id` (`sheetPath(id)`).
- Onglet « Fiches » de la page d'un projet : le même tableau, limité aux fiches du projet (la colonne « Projet » y est masquée par défaut ; une fiche créée là est rattachée au projet).
- Paramètres (barre latérale « Paramètres des fiches »), sur la liste et sur la page d'une fiche ; aussi dans les paramètres d’un projet, depuis son onglet « Fiches ».

## Liste des fiches

Tableau de données commun (vue `sheets`, voir [Tableau de données](../../web/components/data-table.md)).

| Colonne (id) | Libellé         | Par défaut                       | Contenu                                                                                                          |
| ------------ | --------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `label`      | « Libellé »     | visible, verrouillée             | Lien vers la page de la fiche, badge « Archivée ».                                                               |
| `categories` | « Catégories »  | visible                          | Catégories de fiches, modifiables sur place (ajouts et retraits appliqués à la sélection). Filtre, regroupement. |
| `project`    | « Projet »      | visible (masquée dans un projet) | Projet, modifiable sur place. Filtre, regroupement.                                                              |
| `items`      | « Éléments »    | visible                          | Éléments l'un sous l'autre avec leur quantité (la description en infobulle).                                     |
| `usedBy`     | « Rattachée à » | masquée                          | Nombre de routines, évènements et tâches qui l'utilisent.                                                        |
| `updatedAt`  | « Modifiée le » | masquée                          | Date de dernière modification.                                                                                   |

- Recherche : « Rechercher (libellé, élément) ».
- Interrupteur « Afficher les archivées » ; une fiche archivée est en lecture seule.
- Un clic sur une ligne ouvre la page de la fiche.
- « Nouvelle fiche » crée une fiche « Nouvelle fiche » (dans le projet de l'onglet) et ouvre sa page.
- Menu d'une fiche : « Modifier » (ou « Voir » si archivée), « Utiliser cette fiche… », « Dupliquer » (toast « Fiche dupliquée. »), « Archiver » / « Restaurer », « Supprimer ».
- Sélection (« 3 fiches sélectionnées ») : « Dupliquer » (pas si une fiche archivée est sélectionnée), « Archiver » / « Restaurer », « Supprimer ».
- État vide : « Aucune fiche : une recette, le contenu d'une valise, une trousse… à ajouter aux listes d'achats ou à cocher pour une routine, un évènement, une tâche. »

Suppression (dialogue de confirmation) : « La fiche « … » et ses 3 éléments seront supprimés définitivement, et retirés des 2 routines, évènements ou tâches qui l'ont. Les listes d'achats et les listes à cocher déjà faites la gardent. » (le texte s'adapte au nombre de fiches, d'éléments et d'utilisations).

## Page d'une fiche

- En-tête : retour « Fiches », titre, badge « Archivée », sous-titre « 3 éléments · rattachée à 2 routines, évènements ou tâches ».
- Action « Utiliser cette fiche » (pas si archivée).
- Menu : « Dupliquer » (ouvre la copie), « Archiver » / « Restaurer », « Supprimer » (retour à la liste) ; avec des minuteurs enregistrés (fiche non archivée), section « Minuteurs » : « Lancer « Œufs durs (9 min) » » démarre aussitôt le minuteur, rattaché à la fiche (sa sonnerie : « Ouvrir la fiche »).
- Champs enregistrés chacun dès qu'il change (les textes en les quittant) : « Libellé » (requis, 250 caractères au plus ; vide, l'erreur s'affiche dessous et rien n'est enregistré), « Projet » (« Aucun : fiche de l'espace »), « Catégories », « Note » (texte multiligne, 4 000 caractères au plus), « Minuteurs » (minuteurs enregistrés de l’espace que la fiche lance, voir [Alarmes](../activities/alarms.md#minuteurs-enregistrés) ; enregistrés à part, dès qu’ils changent). « Enregistrement… » puis « Enregistré » au-dessus ; un échec remet le champ comme il était, dans un toast d'erreur ; un champ changé ailleurs est repris. En lecture seule si la fiche est archivée.
- Fiche introuvable : page « Cette fiche » introuvable, avec un retour vers « Fiches ».

### Tableau des éléments

Vue `sheet-items`. Chaque cellule se modifie sur place, et sur une sélection de cellules d'une colonne pour toutes les lignes sélectionnées.

| Colonne (id)   | Libellé                  | Contenu                                                                                                                      |
| -------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `label`        | « Élément »              | Libellé (250 caractères au plus).                                                                                            |
| `product`      | « Référence »            | Produit des références (base de produits des achats) ; les produits archivés ne sont plus proposés (sauf celui déjà choisi). |
| `category`     | « Catégorie »            | Catégorie des achats (groupée en arbre, « Sans catégorie »).                                                                                                        |
| `quantity`     | « Quantité »             | Nombre, 3 décimales.                                                                                                         |
| `unit`         | « Unité »                | Unité.                                                                                                                       |
| `consumable`   | « Consommable »          | Coché : consommé quand la fiche est utilisée (une recette) ; décoché : revient (une valise). Groupes « Consommable » / « Permanent ».                                 |
| `store`        | « Magasin »              | Comme les éléments des listes d'achats.                                                                                      |
| `conservation` | Conservation             | Périssable et mode de conservation.                                                                                          |
| `people`       | « Bénéficiaires »        | Membres et relations.                                                                                                        |
| `url`          | « Lien vers le produit » | Lien `http` ou `https`.                                                                                                      |
| `optional`     | « Facultatif »           | Acheté si possible. « Facultatif » / « Obligatoire » (coche bleue, triangle orange).                                                                                                          |
| `note`         | « Description »          | Markdown, modifiable dans l'éditeur markdown ouvert dans un popover.                                                         |
| commentaires   | (colonne commune)        | Nombre de commentaires de l'élément.                                                                                         |

- Recherche : « Rechercher (élément, description) ».
- Ligne d'ajout « Ajouter un élément dans … » : un libellé puis Entrée ; s'il correspond au nom d'un produit des références, l'élément devient ce produit (catégorie, unité, consommable). Dans un groupe, l'élément prend la valeur du groupe (catégorie, unité, magasin, consommable, facultatif, conservation, bénéficiaires) ; pas de ligne dans les groupes où c'est impossible (« avec référence »…).
- « Depuis les références » : panneau « Ajouter des produits des références », produits groupés par liste de base ; toast « 3 éléments ajoutés. ».
- Menu d'un élément : « Commentaires » (panneau), « Retirer » (confirmation : « « … » sera retiré de la fiche, avec ses commentaires. Les listes déjà faites le gardent. »).
- Sélection : « Retirer » (« 3 éléments seront retirés de la fiche. »).
- État vide : « Aucun élément : tapez-en un ci-dessous, ou ajoutez des produits des références. » (« Aucun élément. » si archivée).

## Utiliser une fiche

Panneau « Utiliser « … » » : « Combien de fois » (multiplicateur de 0,25 à 999, 2 décimales, préfixe « × »), bouton « Utiliser ». Les éléments consommables qui sont des références suivies en stock en sont retirés, les lots qui périment le plus tôt d'abord.

- Tout retiré : toast « 3 éléments retirés du stock. ».
- Sinon : toast d'information « 2 éléments retirés du stock » / « Rien n'a été retiré du stock », avec « Pas assez en stock : … » ou « Aucun élément consommable de cette fiche n'est suivi en stock. ».

Voir [Stock](stock.md).

## Fiches dans une liste d'achats

Sur la page d'une liste d'achats, « Ajouter » › « Depuis une fiche… » ouvre « Ajouter une fiche » :

- « Fiche » (les archivées ne sont pas proposées) et « Fois ».
- Texte : « Ses éléments s'ajoutent à ceux de la liste : un même produit (ou un même libellé dans la même unité) n'y figure qu'une fois, quantités additionnées et fiches indiquées. »
- « Fiches de la liste » : chaque fiche déjà ajoutée, avec « Retirer » (confirmation : « La part de « … » sera retirée des quantités de la liste, et les éléments qu'elle seule apportait (pas encore achetés ou cochés) seront supprimés. »).
- Toasts « Fiche ajoutée. », « Fiche retirée. ».

Voir [Achats](shopping.md).

## Fiches d'une routine, d'un évènement, d'une tâche

Dans le formulaire d'une routine, d'une occurrence d'évènement et le panneau d'une tâche, la section « Fiches » :

- « Chaque occurrence a sa liste à cocher, faite de ces fiches à son ouverture (modifiable ensuite). »
- Une ligne par fiche : choix de la fiche, multiplicateur (« Fois »), « Retirer » ; « Ajouter une fiche » (désactivé s'il n'en reste aucune à ajouter). Enregistré à chaque changement : une fiche choisie, ajoutée ou retirée aussitôt, un multiplicateur en quittant son champ (ou en fermant le panneau pendant sa saisie) ; vidé ou nul, il n'est pas enregistré, « Multiplicateur positif attendu. » dessous. Les fiches archivées ne sont plus proposées (celles déjà attachées restent).
- Bouton « Liste à cocher » (tâche) ou « Liste à cocher du 10 nov. 2026 » (occurrence en cours de la routine, occurrence de l'évènement) : ouvre la liste dans le panneau latéral (`lg`), titre « Liste à cocher · … · … ».

## Liste à cocher

Une liste par occurrence de routine ou d'évènement, une par tâche. Faite à la première ouverture à partir des fiches attachées (éléments additionnés : même produit, ou même libellé et unité, sur une seule ligne), puis indépendante des fiches.

- En-tête : « 2 / 5 faits · lundi 10 novembre 2026 ».
- « Ajouter une fiche » : même panneau que pour les listes d'achats (sans retrait), éléments additionnés à ceux de la liste.
- « Refaire depuis les fiches » (confirmation : « La liste sera refaite à partir des fiches : ce qui est coché, ajouté ou modifié dans cette liste sera perdu. », toast « Liste refaite. »).
- Tableau (vue `checklist`) : « Fait » (case ; oui / non « Collectés » / « À collecter »), « Élément », « Quantité », « Unité », « Catégorie », « Consommable » (masquée ; coché, un élément de référence est retiré du stock quand il est coché et rendu quand il est décoché), « Description » (masquée ; markdown, modifiable dans l'éditeur markdown ouvert dans un popover), « Fiches » (d'où vient l'élément ; filtre, regroupement). Les lignes faites sont marquées comme telles.
- Ligne d'ajout « Ajouter un élément dans … » (élément non consommable par défaut, valeur du groupe reprise).
- « Retirer » un élément (menu, sans confirmation) ou une sélection (avec confirmation).
- Sans fiche attachée : « Aucune fiche : ajoutez-en pour faire la liste à cocher. » et le champ des fiches.

## Paramètres

« Paramètres des fiches » :

- « Catégories de fiches » : « Classent les fiches (recettes, valises, trousses…) : une fiche peut en avoir plusieurs. » Libellé (250 caractères au plus, unique) et couleur ; usage affiché ; supprimer une catégorie la retire des fiches. Voir [Paramètres](../cross-cutting/settings.md).
- Les catégories des éléments (celles des achats, aussi dans les paramètres des achats), avec leur usage par produits, éléments de listes et éléments de fiches.

## PRO et PERSO

Aucune différence : les fiches et listes à cocher fonctionnent de la même façon dans les deux types d'espace.
