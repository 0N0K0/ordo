# Fil de commentaires (composant commun)

Le fil de commentaires d'un élément (tâche, routine, évènement, document…), le même partout. Source : `apps/web/src/components/comments/`. Les requêtes et colonnes de commentaires sont dans `features/comments` (voir [Code web : commentaires](../features/cross-cutting/comments.md)) ; les règles (commentaires refusés sur un élément archivé) dans [Règles : commentaires](../../business-rules/cross-cutting/comments.md).

## `CommentThread.tsx`

### `ThreadActions` (interface)

Enregistrements d'un fil ; chacun appelle `done` une fois enregistré, les erreurs sont dites par l'appelant :

- `add(body, done)` ;
- `update(id, body, done?)` ;
- `remove(id)` ;
- `adding`, `updating` : envois en cours (boutons en attente).

### `CommentThread`

Fil de commentaires d'un élément. Props :

- `comments` : liste (`id`, `body` markdown, `createdAt`, `githubAuthor` facultatif pour un commentaire écrit sur GitHub) ;
- `loading` : `ListSkeleton` de 2 éléments avec avatar ;
- `actions` : `ThreadActions` ;
- `suggestions` (`MarkdownSuggestions`) : « # » et « @ » proposés à la saisie ;
- `targets` (`ReferenceTargets`) : tâches visées par les références ;
- `readOnly` : élément archivé, commentaires affichés seulement.

Comportement :

- en lecture seule et sans commentaire : `EmptyState` compact « Aucun commentaire. » ;
- sinon, en bas : `MarkdownEditor` « Ajouter un commentaire » (placeholder « Écrivez un commentaire… », 3 lignes, Ctrl/⌘ + Entrée envoie) et bouton « Commenter » (désactivé tant que le texte est vide) ;
- le texte est vidé une fois le commentaire ajouté.

Composant interne `CommentCard` (un commentaire) :

- en-tête : « @auteur sur GitHub » le cas échéant, date relative (`fmt.fromNow`) avec la date complète en infobulle (`fmt.dateTime`) ;
- menu « … » (sujet « ce commentaire ») : « Modifier » (édition en place, `MarkdownEditor` + `FormActions` `xs`, Ctrl/⌘ + Entrée enregistre, vide refusé) et « Supprimer » (confirmation `confirmDestructive` « Supprimer le commentaire », « Le commentaire sera supprimé définitivement. ») ;
- corps : `MarkdownView` ; hors lecture seule, cocher une case de liste de tâches enregistre le commentaire.

Utilisé par `features/tasks` (panneau de tâche) et `features/comments`.

## `thread-actions.ts`

### `threadActions(mutations, variables)`

Construit les `ThreadActions` d'un fil à partir de trois mutations TanStack Query (`add`, `update`, `remove`) et des variables d'ajout (`variables.add(body)`) et de suppression (`variables.remove(id)`). Les erreurs vont dans un toast (`ON_ERROR`), `done` est appelé au succès ; `adding` / `updating` reprennent `isPending`. Utilisé par les tâches et `features/comments`.
