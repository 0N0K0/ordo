# Règles métier — Commentaires

Règles des commentaires markdown : ceux des tâches (`TaskComment`, synchronisables avec GitHub) et ceux de tous les autres éléments (`Comment`, une cible par commentaire). Sources : `apps/api/src/services/core/comments.ts`, `apps/api/src/services/tasks/tasks.ts` (commentaires de tâche), `apps/api/src/graphql/modules/comments.ts`, `apps/api/src/graphql/modules/tasks.ts`, `packages/shared/src/tasks/tasks.ts` (`commentBodySchema`), `apps/api/src/services/github/sync.ts` et `links.ts`.

Voir aussi : [Tâches](../activities/tasks.md), [Archivage](archiving.md), [GitHub](github.md), [Mails](../resources/mail.md), [Erreurs](errors.md).

## Deux sortes de commentaires

|        | Commentaires de tâche                                                                                  | Commentaires des autres éléments                                            |
| ------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Modèle | `TaskComment`                                                                                          | `Comment`                                                                   |
| API    | `addTaskComment`, `updateTaskComment`, `deleteTaskComment`, champ `Task.comments`, `Task.commentCount` | `comments`, `commentCounts`, `addComment`, `updateComment`, `deleteComment` |
| GitHub | synchronisés avec les commentaires de l’issue                                                          | non                                                                         |
| Champs | `body`, `createdAt`, `updatedAt`, `githubCommentId`, `githubBody`, `githubAuthor`                      | `body`, `createdAt`, `updatedAt`, une colonne de cible                      |

## Corps d’un commentaire

Source : `commentBody` (`services/core/comments.ts`), `commentBodySchema`.

- Markdown, 65 536 caractères au plus : « Texte trop long. ».
- Non vide (après `trim`) : « Le commentaire est vide. ».
- Erreur rendue sous le champ `body`.
- Mentions `@identifiant` et références `#12` : voir le composant markdown ([Markdown](../../web/components/markdown.md)).

## Cibles des commentaires génériques

Source : `COMMENT_TARGETS`, `TARGET_MODELS`.

Chaque `Comment` a exactement une cible. Types de cible (enum GraphQL `CommentTarget`) et élément qui verrouille le commentaire quand il est archivé :

| Cible               | Colonne              | Verrou d’archivage                    |
| ------------------- | -------------------- | ------------------------------------- |
| `ROUTINE`           | `routineId`          | la routine                            |
| `EVENT`             | `eventId`            | l’évènement                           |
| `SCHEDULE`          | `scheduleId`         | l’horaire (plages de travail)         |
| `TIME_ENTRY`        | `timeEntryId`        | aucun                                 |
| `SHOPPING_LIST`     | `shoppingListId`     | la liste                              |
| `SHOPPING_PRODUCT`  | `shoppingProductId`  | le produit                            |
| `SHOPPING_ITEM`     | `shoppingItemId`     | la liste de l’article (`listId`)      |
| `SHEET_ITEM`        | `sheetItemId`        | la fiche de l’élément (`sheetId`)     |
| `STOCK_ITEM`        | `stockItemId`        | l’article                             |
| `DOCUMENT`          | `documentId`         | le document de facturation            |
| `IMPORTED_DOCUMENT` | `importedDocumentId` | le document importé                   |
| `CATALOG_ITEM`      | `catalogItemId`      | l’article du catalogue                |
| `TREASURY_ENTRY`    | `treasuryEntryId`    | l’écriture                            |
| `BUDGET`            | `budgetId`           | le budget                             |
| `RELATION`          | `relationId`         | la relation                           |
| `LIBRARY_DOCUMENT`  | `libraryDocumentId`  | aucun                                 |
| `MAIL`              | `mailMessageId`      | aucun (le mail reste sur son serveur) |

- Un mail est désigné par son en-tête `Message-ID` (sans chevrons) : seul un identifiant vide est refusé (« Élément introuvable. »), le mail n’est pas vérifié.
- Pour les autres cibles, l’élément doit exister (« Élément introuvable. »).
- Supprimer l’élément supprime ses commentaires (`onDelete: Cascade`). Les commentaires d’un mail ne sont pas supprimés avec le mail (pas de clé étrangère).

## Archivage : lecture seule

- Un élément archivé est en lecture seule, ses commentaires aussi : ajouter, modifier ou supprimer un commentaire d’un élément archivé (ou d’un article d’une liste ou fiche archivée) est refusé : « Élément archivé : restaurez-le pour le modifier. ».
- Même règle pour les tâches : pas de commentaire ajouté, modifié ou supprimé sur une tâche archivée (« Tâche introuvable. » si la tâche n’existe pas, « Commentaire introuvable. » si le commentaire n’existe pas).

## Lecture et comptage

- `comments(target, id)` : les commentaires de l’élément, du plus ancien au plus récent. `Task.comments` : même ordre.
- `commentCounts(target, ids)` : nombre de commentaires par élément demandé (0 compris), sans doublon.
- `Task.commentCount` : nombre de commentaires de la tâche.
- Les compteurs de l’API ne comptent **pas** la description. Dans les tableaux du web, une description remplie compte pour un commentaire (`commentTotal`, décision CJ).

## Commentaires de tâche et GitHub

Source : `services/github/sync.ts` (`syncComments`), `forgetGithubComment` (`services/github/links.ts`).

- Pour une tâche liée à une issue GitHub, les commentaires sont synchronisés dans les deux sens : un nouveau commentaire de chaque côté est copié de l’autre ; un commentaire modifié est fusionné à trois voies contre son dernier corps synchronisé (`githubBody`), la modification la plus récente gagnant un conflit ; un commentaire supprimé d’un côté est supprimé de l’autre.
- `githubAuthor` : auteur sur GitHub quand ce n’est pas le compte connecté (ses propres commentaires n’affichent pas d’auteur).
- Supprimer un commentaire de tâche synchronisé supprime aussi le commentaire de l’issue (en tâche de fond ; un échec est seulement journalisé : « Commentaire GitHub non supprimé. »).
- Détails dans [GitHub](github.md).

## Clonage et suppression de tâche

- Cloner une tâche ne copie pas ses commentaires.
- Supprimer une tâche supprime ses commentaires.
