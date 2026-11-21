# Règles métier — Commentaires

Règles des commentaires markdown : ceux des tâches (`TaskComment`, synchronisables avec GitHub) et ceux de tous les autres éléments (`Comment`, une cible par commentaire). Sources : `apps/api/src/services/core/comments.ts`, `apps/api/src/services/core/occurrence-rows.ts`, `apps/api/src/services/tasks/tasks.ts` (commentaires de tâche), `apps/api/src/graphql/modules/comments.ts`, `apps/api/src/graphql/modules/tasks.ts`, `packages/shared/src/tasks/tasks.ts` (`commentBodySchema`), `apps/api/src/services/github/sync.ts` et `links.ts`.

Voir aussi : [Tâches](../activities/tasks.md), [Archivage](archiving.md), [GitHub](github.md), [Mails](../resources/mail.md), [Erreurs](errors.md).

## Deux sortes de commentaires

|        | Commentaires de tâche                                                                                  | Commentaires des autres éléments                                            |
| ------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Modèle | `TaskComment`                                                                                          | `Comment`                                                                   |
| API    | `addTaskComment`, `updateTaskComment`, `deleteTaskComment`, champ `Task.comments`, `Task.commentCount` | `comments`, `commentCounts`, `addComment`, `updateComment`, `deleteComment` |
| GitHub | synchronisés avec les commentaires de l’issue                                                          | non                                                                         |
| Champs | `body`, `createdAt`, `updatedAt`, `githubCommentId`, `githubBody`, `githubAuthor`                      | `body`, `createdAt`, `updatedAt`, une colonne de cible, `occurrenceDate`    |

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
| `SCHEDULE`          | `scheduleId`         | l’horaire (créneaux de travail)         |
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

## Commentaires d’une occurrence (routines et évènements)

Source : `TARGET_MODELS` (`occurrences`), `onOccurrences`, `commentsWhere`, `remapOccurrenceRows`.

- Un commentaire d’une routine ou d’un évènement récurrent porte sur **une occurrence**, pas sur toute la série : `occurrenceDate`, le jour de l’occurrence (pour une routine, le jour de ses coches, `RoutineCheck.date` ; pour un évènement, la date d’occurrence, comme `TimeEntryEvent.occurrenceDate`).
- Un évènement unique n’a qu’une occurrence : ses commentaires ont `occurrenceDate` vide.
- `addComment` : l’occurrence est requise pour une routine et un évènement récurrent (« Occurrence manquante. ») ; refusée pour un évènement unique et les autres éléments (« Cet élément n’a pas d’occurrences. ») ; date invalide sous `occurrenceDate` (« Date invalide. »). L’API ne vérifie pas que la date est bien une occurrence de la règle.
- Modifier ou supprimer un commentaire ne change pas son occurrence.
- Les commentaires suivent leur occurrence quand elle change :
  - évènement : série coupée (« celle-ci et les suivantes ») : ceux des occurrences à partir de la coupure passent au nouvel évènement, décalés d’autant de jours que l’occurrence ; série déplacée (« toute la série ») : décalés d’autant de jours ; évènement unique devenu récurrent : sa première occurrence affichée ; série devenue unique : ceux de la première occurrence deviennent ceux de l’évènement unique (les autres restent à leur date) ;
  - routine : une occurrence déplacée (exception, ou changée depuis l’agenda) emmène ses commentaires à son nouveau jour, et les ramène quand l’exception est retirée ; les autres occurrences gardent les leurs.
- Les temps d’un évènement (`TimeEntryEvent`) suivent leur occurrence de la même façon (même brique, `remapOccurrenceRows`).
- Une occurrence **supprimée** (évènement : « cette occurrence », « celle-ci et les suivantes » ; routine : depuis l’agenda) supprime ses commentaires (`deleteGoneComments`) ; tout l’évènement ou toute la routine : en cascade. La confirmation en donne le nombre (`lostOnDelete`, `commentsLostOnDelete`, avec les temps).
- Une occurrence **reportée** emmène ses commentaires (et ses temps) vers l’évènement de report.
- « Annuler » après la suppression d’une occurrence de routine (`THIS`) rend ses commentaires (`deleteGoneComments` renvoie ceux supprimés, `restoreComments` les recrée sur l’occurrence, texte vérifié, dates d’origine). Une occurrence d’évènement supprimée n’a pas d’« Annuler ».
- Une règle changée qui fait disparaître des occurrences (sans les décaler) supprime leurs commentaires, après confirmation (`lostOccurrences`, `assertLossConfirmed`, `settleLostOccurrences` de `occurrence-rows.ts`, erreur `CONFIRMATION_REQUIRED` tant que `confirmLoss` n’est pas vrai). Voir [Agenda](../activities/calendar.md) et [Routines](../activities/routines.md).

### Commentaires écrits avant les occurrences

Source : `placeLegacyComments` (`services/core/comments.ts`), `placeLegacyRoutineComments` (`services/routines/routines.ts`), `placeLegacyEventComments` et `firstShownOccurrence` (`services/calendar/calendar-events.ts`).

- Les commentaires existants n’ont pas d’occurrence (`occurrenceDate` vide) : la migration `20261120120000_comment_occurrences` n’ajoute que la colonne.
- L’API les place la première fois qu’ils sont lus (`comments`, `commentCounts`, `lostOnDelete`), ou avant un changement des occurrences (déplacement, coupure, report, suppression), avec les règles d’occurrences de l’application, puis les enregistre :
  - routine : l’occurrence en cours le jour où le commentaire a été écrit (`createdAt`, heure de Paris), calculée comme `currentDate` (règle, cas, créneaux, exceptions, « Ouverture ») ; aucune en cours ce jour-là : la suivante ; aucune non plus (écrit après la fin de sa répétition) : la dernière (`lastOccurrenceBefore`, cherchée sur dix ans en arrière) ; sinon la première ; sinon le premier jour de la routine. Une routine archivée est calculée comme si elle ne l’était pas ;
  - évènement récurrent : la première occurrence affichée de la série (dates exclues, pauses et occurrences supprimées une à une sautées ; cherchée sur dix ans ; aucune : laissés sans date).
- Un commentaire sans date d’un évènement **unique** est le sien (sa seule occurrence) : il n’est jamais déplacé. Sur un évènement récurrent, un commentaire sans date ne peut être qu’ancien : un évènement unique devenu récurrent passe aussitôt les siens à sa première occurrence affichée. Aucun marqueur n’est donc nécessaire.

## Archivage : lecture seule

- Un élément archivé est en lecture seule, ses commentaires aussi : ajouter, modifier ou supprimer un commentaire d’un élément archivé (ou d’un article d’une liste ou fiche archivée) est refusé : « Élément archivé : restaurez-le pour le modifier. ».
- Même règle pour les tâches : pas de commentaire ajouté, modifié ou supprimé sur une tâche archivée (« Tâche introuvable. » si la tâche n’existe pas, « Commentaire introuvable. » si le commentaire n’existe pas).

## Lecture et comptage

- `comments(target, id, occurrenceDate?)` : les commentaires de l’élément, du plus ancien au plus récent ; pour une routine ou un évènement, ceux de l’occurrence donnée (aucune : ceux d’un évènement unique). `Task.comments` : même ordre.
- `commentCounts(target, ids)` : nombre de commentaires par élément demandé (0 compris), sans doublon ; pour `ROUTINE` et `EVENT`, les `ids` sont des clés d’occurrence (`occurrenceKey` : « id|AAAA-MM-JJ », l’identifiant seul pour un évènement unique).
- `Task.commentCount` : nombre de commentaires de la tâche.
- Les compteurs de l’API ne comptent **pas** la description. Dans les tableaux du web, une description remplie compte pour un commentaire (`commentTotal`) ; la colonne des commentaires montre l’icône et le nombre, dans tous les tableaux.

## Commentaires de tâche et GitHub

Source : `services/github/sync.ts` (`syncComments`), `forgetGithubComment` (`services/github/links.ts`).

- Pour une tâche liée à une issue GitHub, les commentaires sont synchronisés dans les deux sens : un nouveau commentaire de chaque côté est copié de l’autre ; un commentaire modifié est fusionné à trois voies contre son dernier corps synchronisé (`githubBody`), la modification la plus récente gagnant un conflit ; un commentaire supprimé d’un côté est supprimé de l’autre.
- `githubAuthor` : auteur sur GitHub quand ce n’est pas le compte connecté (ses propres commentaires n’affichent pas d’auteur).
- Supprimer un commentaire de tâche synchronisé supprime aussi le commentaire de l’issue (en tâche de fond ; un échec est seulement journalisé : « Commentaire GitHub non supprimé. »).
- Détails dans [GitHub](github.md).

## Duplication et suppression de tâche

- Dupliquer une tâche ne copie pas ses commentaires.
- Supprimer une tâche supprime ses commentaires.
- Transformer une tâche en routine recopie ses commentaires en commentaires de la routine, sur sa première occurrence (textes et dates gardés, lien GitHub perdu) ; transformer une routine en tâche recopie ceux de son occurrence en cours (sinon la suivante, sinon la première) en commentaires de tâche, les autres sont supprimés avec la routine (comptés dans la confirmation). Voir [Tâches](../activities/tasks.md#transformer-en-routine) et [Routines](../activities/routines.md#transformer-en-tâche).
