# Règles des fiches

Règles des fiches (listes d'éléments réutilisables), de leurs catégories, de leur ajout aux listes d'achats, de leur usage sur le stock, et des listes à cocher des routines, évènements et tâches. Sources : `apps/api/src/services/shopping/sheets.ts`, `apps/api/src/services/shopping/stock.ts` (`useSheet`, `syncChecklistStock`), `apps/api/src/graphql/modules/sheets.ts`, `packages/shared/src/shopping/sheets.ts`. L'usage côté écran est dans [Fiches](../../features/supplies/sheets.md).

## Modèle

| Table           | Rôle                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Sheet`         | Fiche : libellé, note, projet (sinon fiche de l'espace), catégories, ordre, archivage.                                                                                                            |
| `SheetItem`     | Élément : produit des références ou libellé propre, catégorie des achats, quantité, unité, note, consommable, magasin, lien, périssable et conservation, bénéficiaires, facultatif, commentaires. |
| `SheetCategory` | Catégorie de fiches (liste plate, libellé et couleur).                                                                                                                                            |
| `SheetLink`     | Fiche attachée à une routine, un évènement ou une tâche, avec un multiplicateur.                                                                                                                  |
| `Checklist`     | Liste à cocher d'une occurrence de routine ou d'évènement (`occurrenceDate`), ou d'une tâche.                                                                                                     |
| `ChecklistItem` | Élément d'une liste à cocher : produit ou libellé, catégorie, quantité, unité, note, sources, consommable, `checkedAt`.                                                                           |

Une fiche « consommable » (recette) est consommée quand elle sert ; un élément non consommable (valise) revient. Un élément est consommable par défaut (schéma et GraphQL) ; dans une liste à cocher, une ligne faite depuis les fiches l'est si l'une de ses parts l'est, et le web ajoute les éléments saisis à la main comme non consommables.

## Validation

Source : `packages/shared/src/shopping/sheets.ts`, `packages/shared/src/shopping/shopping.ts`.

Fiche (`sheetSchema`) :

| Champ         | Règle et message                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `label`       | Requis (« Le libellé est requis. »), 250 caractères au plus (`TEXT_MAX`, décision DO).                      |
| `note`        | Texte multiligne, 4 000 caractères au plus (« 4 000 caractères maximum. ») ; vide enregistrée `null`.       |
| `projectId`   | Projet actif (« Projet ») ; un projet archivé déjà en place est accepté.                                    |
| `categoryIds` | 50 au plus ; doublons retirés ; existantes et non archivées, sauf celles déjà sur la fiche (« Catégorie »). |

Élément de fiche (`sheetItemSchema`, aussi `checklistItemSchema`) :

| Champ                      | Règle et message                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `label`                    | Requis, 250 caractères au plus.                                                                                        |
| `productId`, `categoryId`  | Doivent exister (« Produit », « Catégorie ») ; non archivés, sauf ceux déjà sur l'élément.                             |
| `quantity`                 | Nombre (« Nombre attendu. »), ≥ 0 (« Quantité positive attendue. »), ≤ 999 999 (« Quantité trop grande. »), ou `null`. |
| `unit`                     | 250 caractères au plus (`unitSchema`), vide = `null` ; unité archivée refusée si nouvelle.                             |
| `note`                     | Markdown, 65 536 caractères au plus (`itemNoteSchema`), vide = `null`.                                                 |
| `consumable`               | Vrai par défaut (élément de fiche).                                                                                    |
| `storeId`                  | Magasin non archivé (sauf déjà en place).                                                                              |
| `url`                      | Lien `http(s)` (« Lien invalide (http ou https). ») ou vide.                                                           |
| `perishable`, `storageId`  | Le mode de conservation n'est gardé que pour un élément périssable ; non archivé sauf déjà en place.                   |
| `memberIds`, `relationIds` | 50 au plus chacun ; personnes vérifiées (`assertPeople`).                                                              |
| `optional`                 | Faux par défaut.                                                                                                       |

Catégorie de fiches (`sheetCategorySchema`) : libellé requis, 250 caractères au plus, unique dans l'espace (« Une catégorie porte déjà ce libellé. ») ; couleur `#rrggbb` requise (« Couleur invalide (format #rrggbb). »).

Multiplicateur (`sheetMultiplierSchema`) : strictement positif (« Multiplicateur positif attendu. »), 999 au plus (« 999 au plus. »). Le web propose de 0,25 à 999 avec 2 décimales.

## Fiches

Source : `createSheet`, `updateSheet`, `duplicateSheet`, `deleteSheet`.

- Créée en dernière de la liste ; ses éléments s'ajoutent ensuite un par un.
- Fiche archivée : lecture seule (« Fiche » archivée refusée à la modification, à l'ajout, au changement et au retrait d'éléments, à la duplication, à l'usage). L'archivage passe par la mutation commune `setArchived` (type `SHEET`) : voir [Archivage](../cross-cutting/archiving.md).
- Duplication : « … (copie) » (coupé pour tenir dans 250 caractères, `copyName`), mêmes note, projet, catégories, éléments (tous leurs champs, bénéficiaires compris, même ordre), en dernière de la liste ; les commentaires ne sont pas copiés.
- Suppression : ses éléments (et leurs commentaires) et ses rattachements aux routines, évènements et tâches partent avec elle ; les listes d'achats et listes à cocher déjà faites gardent leurs éléments (leurs sources gardent le libellé de la fiche).
- Requête `sheets(projectId?)` : toutes, ou celles d'un projet, dans l'ordre ; `usedBy` = nombre de rattachements.

## Éléments de fiche

Source : `addSheetItem`, `addSheetProducts`, `updateSheetItem`, `deleteSheetItems`.

- Ajouté en dernier.
- Depuis les références (`addSheetProducts`) : produits non archivés, triés par libellé, chacun avec sa catégorie, quantité, unité, consommable, magasin, lien, conservation et bénéficiaires ; renvoie le nombre ajouté.
- Retrait de plusieurs éléments refusé si l'un est dans une fiche archivée ; leurs commentaires partent avec eux.
- Un élément dont le produit est supprimé garde son libellé.

## Catégories de fiches

Source : `sheetCategories = createLabelService('sheetCategory', …)` ; mutations communes `labelMutations('SheetCategory', …)` ; voir [Noms et libellés](../cross-cutting/naming.md).

- Supprimer une catégorie la retire des fiches (les fiches restent).
- Archivée : plus choisissable, celles déjà en place restent.

## Ajouter une fiche à une liste d'achats

Source : `addSheetToShoppingList`, `removeSheetFromShoppingList`, `fitForShopping`, `withSource`.

- La liste doit être ouverte (non archivée), la fiche non archivée.
- Chaque élément est multiplié (`timesSheet`, arrondi au millième) puis adapté aux limites des achats : libellé et unité coupés à 250 caractères, note à 65 536 (textes enregistrés avant ces limites), quantité plafonnée à 999 999.
- Clé d'addition (`productKey`) : le produit, sinon le libellé et l'unité normalisés (`nameKey` : sans casse, accents ni espaces en trop). Un élément de la liste **pas encore acheté** de même clé voit sa quantité augmentée et la part de la fiche notée dans ses sources (`sheetSources` : `[{ sheetId, label, quantity }]`) ; il ne reste facultatif que si toutes ses fiches le disent.
- Sinon un nouvel élément est créé en dernier : avec un produit, ses champs (ceux de l'élément de fiche en priorité) ; sans produit, ceux de l'élément de fiche.
- Renvoie le nombre d'éléments de la fiche.
- Retirer une fiche d'une liste : sa part est retirée des quantités (jamais en dessous de 0) et de ses sources ; un élément qu'elle seule apportait, pas encore acheté, sans quantité restante, est supprimé.

## Utiliser une fiche (stock)

Source : `useSheet` dans `apps/api/src/services/shopping/stock.ts`.

- Fiche non archivée, multiplicateur valide.
- Pour chaque élément consommable, de produit, avec quantité : quantité × multiplicateur retirée du stock de ce produit (articles non archivés), les articles dont les lots périment le plus tôt d'abord ; mouvement de type `CONSUMPTION` lié à la fiche.
- Renvoie `taken` (éléments dont quelque chose a été retiré) et `short` (libellés en manque : ce qu'il y avait a été pris).

Voir [Règles du stock](stock.md).

## Fiches d'une routine, d'un évènement, d'une tâche

Source : `setSheetLinks`, `ownerScope`.

- Exactement un propriétaire : routine, évènement ou tâche (« Une routine, un évènement ou une tâche, un seul. ») ; il doit exister (« Routine », « Évènement », « Tâche »).
- 50 fiches au plus (« 50 fiches au plus. »), chacune existante, avec son multiplicateur.
- Une fiche archivée déjà attachée reste ; elle n'est pas attachée à nouveau.
- L'enregistrement remplace tous les rattachements, dans l'ordre donné.
- Les listes à cocher déjà faites ne changent pas ; celles faites ensuite suivent les nouvelles fiches.
- Supprimer la routine, l'évènement ou la tâche supprime ses rattachements et ses listes à cocher.
- Une tâche transformée en routine (lot 15, décision FL) lui passe ses fiches et sa liste à cocher (sur la première occurrence) ; une routine transformée en tâche lui passe ses fiches et la liste à cocher de son occurrence en cours (sinon la suivante, sinon la première), les autres partent avec elle.

## Listes à cocher

Source : `checklist`, `resetChecklist`, `addSheetToChecklist`, `addChecklistItem`, `updateChecklistItem`, `setChecklistItemsChecked`, `deleteChecklistItem`.

- Propriétaire : une routine ou un évènement avec une date d'occurrence (sinon « Date de l'occurrence requise. »), ou une tâche ; aucun : « Une routine, un évènement ou une tâche. ».
- Une seule liste par occurrence de routine, par occurrence d'évènement (contraintes d'unicité), et par tâche.
- Faite à la première demande (`checklist`) à partir des fiches non archivées du propriétaire : éléments multipliés et additionnés par clé (même produit, ou même libellé et unité), sources notées, consommable si l'une des parts l'est, dans l'ordre des fiches. Sans fiche attachée : pas de liste (`null`). Si deux requêtes la créent en même temps, la première créée est renvoyée.
- Refaire (`resetChecklist`) : tous ses éléments sont supprimés et recréés depuis les fiches actuelles (coches et changements perdus).
- Ajouter une fiche : fiche non archivée ; éléments additionnés à ceux de la liste de même clé (cochés ou non), sinon ajoutés en dernier.
- Élément ajouté à la main : schéma d'un élément de fiche (seuls produit, libellé, catégorie, quantité, unité, note, consommable sont gardés) ; produit et catégorie vérifiés.
- Cocher / décocher (`setChecklistItemsChecked`) : `checkedAt` mis à maintenant ou effacé ; dans la même transaction, chaque élément consommable de produit avec quantité est retiré du stock à la coche (une seule fois : pas de nouveau retrait s'il a déjà un mouvement) et rendu au décochage.
- Retirer un élément : supprimé.
- Les listes à cocher ne sont pas archivables ; elles ne vérifient pas l'archivage de leur propriétaire.
