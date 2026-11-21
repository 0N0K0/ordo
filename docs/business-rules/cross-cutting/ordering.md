# Ordre manuel

Règles de l'ordre des listes et des arbres : positions, tri de secours, déplacement, ajout en fin de liste, ordre choisi à la main dans les tableaux. Sources : `apps/api/src/services/core/ordering.ts`, `apps/api/src/services/core/trees.ts`, `apps/api/src/services/core/settings-lists.ts`, `packages/shared/src/core/collections.ts`, `packages/shared/src/core/tree.ts`, `packages/shared/src/tables/table-views.ts`.

Voir aussi : [core](../../shared/cross-cutting/core.md), [tables](../../shared/cross-cutting/tables.md), [Archivage](archiving.md).

## Positions

- Les éléments ordonnables ont un champ `position` (entier). L'ordre manuel est `BY_POSITION` : par position, puis par libellé à position égale, partout.
- Listes de personnes (clients, tiers, dossiers de la bibliothèque) : par position puis par nom (`BY_POSITION_NAME`).
- Listes sans libellé (liens de fiches, abonnements d'agenda, documents de la bibliothèque) : par position seule (`BY_POSITION_ONLY`).
- Côté web, `byPosition` trie par position.

## Ajout

Un élément créé va **en fin** de sa liste : `nextPositionIn(model, where)` donne la position maximale + 1 parmi ses futurs frères (même parent, même projet, même tableau de bord…), 0 pour une liste vide.

- Un espace créé va en dernier du sélecteur d'espaces.
- Un élément d'arbre créé, ou placé sous un autre parent, va en dernier parmi ses nouveaux frères.

## Déplacement

- `moveInList(model, id, index, where, tx?)` : déplace un élément à un index parmi ses frères (`where`) ; toutes les positions des frères sont réécrites (chacun reçoit son index), en une transaction.
- `saveSiblingOrder(orderedIds, id, index, save)` et `moveInOrder` : même chose à partir d'une liste d'ids déjà chargée ; l'index est borné à la liste (`movedTo`).
- `moveBefore(model, id, beforeId, what, also?)` : ordre global d'un modèle (tâches, routines) ; place l'élément juste avant un autre (`null` : à la fin ; voisin inconnu : « X introuvable. »), en ne réécrivant que les positions qui changent, dans une transaction avec les autres écritures données (changement de parent). Placer « avant tel élément » fonctionne aussi dans une vue filtrée.
- `reorder(kind, ids)` : remet tous les éléments d'une liste de réglages plate dans l'ordre donné, tout ou rien (transaction).
- Espaces : `moveWorkspace(id, index)` (« Espace introuvable. »).

## Arbres

Arbres de réglages (`treeListService`) : catégories de routines, de courses, de trésorerie, d'agenda, emplacements de stock, lieux ; et arbres métier propres (projets, tâches, routines parentes, dossiers de la bibliothèque). Les tâches et les routines ont un seul ordre global (pas d'ordre parmi les frères) ; l'arbre affiché range les frères dans cet ordre.

- Le parent doit exister (« X parente introuvable. » selon le message du domaine) et ne peut pas être l'élément ni un de ses descendants (message de boucle du domaine, ex. « Une zone ne peut pas être dans elle-même. ») : `assertTreeParent`, via `isUnderOrSelf`.
- Un parent archivé ne reçoit pas de nouvel enfant (les enfants existants restent).
- `move(id, parentId, index)` : change de parent (si différent), puis place à l'index parmi les nouveaux frères ; sans index, l'élément reste en dernier.
- Glisser-déposer d'un arbre de réglages ou de projets : position relative `BEFORE`, `AFTER` ou `INSIDE` (`TreePlace` du web).
- Supprimer un élément d'arbre de réglages fait **remonter ses enfants** d'un niveau, sous son parent (`deleteTreeNode`). Exceptions : un lieu supprime ses zones (cascade de la base) ; un projet supprime tout son sous-arbre ; une tâche et une routine suppriment ou remontent leurs sous-éléments selon le choix (`deleteTreeItems`, voir [Tâches](../activities/tasks.md), [Routines](../activities/routines.md)).
- Sélection dans un arbre (tâches, routines) : seuls les éléments du haut sont traités, un élément sous un autre sélectionné le suit (`topmostIds`).
- Projets : profondeur maximale `MAX_PROJECT_DEPTH` = 5 niveaux.
- Lieux : un lieu de premier niveau (avec adresse) ne devient jamais une zone et inversement (« Un lieu garde son adresse : il ne peut pas devenir une zone. », « Une zone n’a pas d’adresse : elle ne peut pas devenir un lieu. »).
- Tout élément d'un arbre s'affiche par son chemin complet, dans les choix comme dans les cellules : « Maison › Étage › Chambre » (`pathOf`, séparateur `LEVEL`).

## Ordre choisi à la main dans les tableaux

Une vue de tableau peut garder un ordre manuel des lignes : `manualOrder` (clés des lignes, 5000 max), utilisé quand aucun tri n'est actif ; les lignes absentes viennent après, dans leur ordre. Voir [tables](../../shared/cross-cutting/tables.md).

## Ordres non manuels

- Mails : par date (défaut), correspondant, objet ou taille (`MAIL_SORTS`).
- Les listes métier (tâches, documents, mouvements…) ont leurs tris de tableau (voir les pages de domaine).
