# Code web — Commentaires

Tous les fichiers de `apps/web/src/features/comments/` : requêtes et mutations des commentaires génériques (`api`), le composant `Comments` posé sur chaque élément, le compteur et la colonne « Commentaires » des tableaux. Le fil lui-même (`CommentThread`, `threadActions`) est une brique partagée : voir [Composants — Commentaires](../../components/comments.md). Les commentaires de tâche ont leurs propres hooks dans [Code web — Tâches](../activities/tasks.md) (`useTaskComments`, `useTaskCommentMutations`, `TaskComments`).

Fonctionnalités : [Commentaires](../../../features/cross-cutting/comments.md). Règles : [Règles métier — Commentaires](../../../business-rules/cross-cutting/comments.md).

## api/

### `api/index.ts`

Documents GraphQL : `Comments`, `CommentCounts`, `AddComment`, `UpdateComment`, `DeleteComment`. Clé de cache : `['comments']` (interne `commentsKey`).

| Nom                             | Rôle                                                                                                                                                                                                                                                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CommentTarget` (type)          | Ré-export de l’enum GraphQL des cibles (`ROUTINE`, `EVENT`, `TIME_ENTRY`, `MAIL`…).                                                                                                                                                                                                                                            |
| `useComments(target, id)`       | Commentaires d’un élément, du plus ancien au plus récent ; rien chargé si `id` est `null`.                                                                                                                                                                                                                                     |
| `useCommentCounts(target, ids)` | `Map` id → nombre de commentaires (description non comptée) ; ids dédoublonnés et triés ; garde les anciennes valeurs pendant le rechargement ; la même `Map` tant que les comptes ne changent pas (dépendance stable des tableaux). Utilisé par `TaskBoard` (évènements), `TimeLog` et les tableaux d’autres fonctionnalités. |
| `useCommentMutations()`         | `{ add({ target, id, body }), update({ id, body }), remove(id) }` ; invalident toutes les requêtes `['comments']` (fils et comptes).                                                                                                                                                                                           |

## components/

### `components/Comments.tsx`

- `Comments({ target, id, projectId?, title?, readOnly? })` : fil de commentaires d’un élément, sous un titre (« Commentaires » par défaut ; `title={null}` : sans titre). `projectId` : « #12 » désigne la tâche 12 de ce projet ; suggestions `#`/`@` et cibles de références tirées de `useTaskContext` (valeurs vides `NO_SUGGESTIONS`/`NO_TARGETS` pendant le chargement). `readOnly` sur un élément archivé. Utilisé par les routines (`RoutineForm`), l’agenda (`EventForm`, `WorkSchedulesManager`), le temps (`TimeEntryForm`), les achats (`ShoppingForm`, `ShoppingListPage`), les fiches (`SheetPage`), la facturation (`DocumentEditor`, `ImportedDocumentPage`, `CatalogPanel`), la trésorerie (`EntryForm`, `BudgetsPanel`, `LoansPanel`), la bibliothèque (`LibraryForms`), les mails (`MailReader`).

### `components/CommentCount.tsx`

- `CommentCount({ count })` : nombre de commentaires d’une ligne avec l’icône de bulle (décision CJ) ; rien à 0. Utilisé par `commentColumn` et `TaskBoard`.

## lib/

### `lib/comment-column.tsx`

- `commentTotal(count, description?)` : nombre de commentaires d’un élément, sa description remplie comptant pour un. Utilisé par les tâches (colonnes, tri, export, filtre « A des commentaires »).
- `commentColumn(counts, idOf, descriptionOf?)` : colonne `DataColumn` « Commentaires » (`id: 'comments'`, numérique, masquée par défaut, triable, filtrable comme un nombre, cellule `CommentCount`). Seule façon de construire cette colonne (règle eslint). Utilisée par `TimeLog`, les routines (`routine-columns.ts`), la trésorerie (`EntriesPanel`, `BudgetsPanel`), la facturation (`CatalogPanel`, `DocumentsTable`), l’agenda (`WorkSchedulesManager`), le stock (`StockTable`), les fiches (`SheetPage`), les achats (`ShoppingPage`, `BaseList`, `ShoppingListPage`), la bibliothèque (`LibraryPage`).
