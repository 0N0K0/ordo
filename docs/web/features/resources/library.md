# Code web de la bibliothèque

> **À réécrire.** La bibliothèque de documents sera entièrement réécrite. Cette page décrit le code actuel, tel quel ; il n’utilise pas encore toutes les briques communes (notamment pas `DataTable` : la page dessine son propre tableau avec les briques de `components/data-table`).

Tous les fichiers de `apps/web/src/features/library/`. Fonctionnalités : [Documents](../../../features/resources/library.md) ; règles : [Règles de la bibliothèque](../../../business-rules/resources/library.md).

## api/

### `api/index.ts`

| Export                        | Rôle                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type DocumentFolder`         | Dossier de la requête `Library` (`id`, `name`, `parentId`).                                                                                                                                                                                                                                                                      |
| `type LibraryDocument`        | Document (`id`, `folderId`, `kind`, `title`, `note`, `url`, `fileName`, `mimeType`, `size`, `updatedAt`).                                                                                                                                                                                                                        |
| `useLibrary()`                | Requête `Library` : `documentFolders` et `libraryDocuments`, clé `['library']`. Utilisée par `LibraryPage`.                                                                                                                                                                                                                      |
| `useLibraryMutations()`       | Mutations qui invalident la bibliothèque : `createFolder`, `renameFolder`, `moveFolder`, `deleteFolder`, `addFiles` (upload multipart), `addLink`, `update` (titre, adresse, description, fichier), `move` (documents), `remove` (documents), `reorderFolder`, `reorderDocument`. Utilisées par `LibraryPage` et `LibraryForms`. |
| `useLibraryOptimism()`        | Renvoie une fonction qui modifie la bibliothèque en cache tout de suite (glisser-déposer), avant la réponse.                                                                                                                                                                                                                     |
| `zipUrl({ folderId?, ids? })` | Adresse de `/api/library/zip` pour un dossier, des documents ou toute la bibliothèque.                                                                                                                                                                                                                                           |

Internes : `libraryKey`, documents GraphQL `LibraryQueryDocument`, `CreateFolder`, `RenameFolder`, `MoveFolder`, `DeleteFolder`, `AddFiles`, `AddLink`, `UpdateDocument`, `MoveDocuments`, `ReorderFolder`, `ReorderDocument`, `DeleteDocuments` ; `useLibraryMutation(fn)` (mutation invalidant `libraryKey` via `useInvalidatingMutation`).

## pages/

### `pages/LibraryPage.tsx`

| Export          | Rôle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LibraryPage()` | Page `/documents` (routée dans `app/router.tsx`) : en-tête et ses trois actions, arbre des dossiers, fil d’Ariane, `DataViewBar` (vue `tableKey: 'library'` par `useDataView`), tableau des sous-dossiers et documents (en-tête `DataTableHeader`, regroupement `groupRows`, `GroupHeaderRow`, `GroupFooter`, `TableFooter`), cellules `EditableText` avec édition en lot (`bulkSaver`), colonne de commentaires (`commentColumn`, `useCommentCounts('LIBRARY_DOCUMENT', …)`), sélection et `SelectionBar`, dépôt de fichiers, glisser-déposer `@dnd-kit` (`libraryCollision`, `handleDragEnd`). Dossier ouvert dans `?folder=`. |

Internes :

| Nom                                                                                                                                                    | Rôle                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IMAGE_TYPES`                                                                                                                                          | Types MIME d’image prévisualisables (png, jpeg, gif, webp).                                                                                                                                                                      |
| `DocumentIcon({ document })`                                                                                                                           | Icône colorée selon le type (lien, PDF, image, autre).                                                                                                                                                                           |
| `openDocument(document)`                                                                                                                               | Lien dans un nouvel onglet ; fichier par `openFile` (`features/files`) : PDF et images dans la visionneuse, le reste téléchargé.                                                                                                 |
| `interface FolderTreeProps`, `FolderTree(props)`                                                                                                       | Un niveau de l’arbre (récursif), avec pliage, compte de documents et dépôt (`DroppableFolderLink`).                                                                                                                              |
| `libraryColumns(paths)`                                                                                                                                | Colonnes `DataColumn<LibraryDocument>` : `name`, `folder`, `kind`, `size`, `note`, `updatedAt`.                                                                                                                                  |
| `FOLDER_SORT`                                                                                                                                          | Tri des dossiers (par nom seulement).                                                                                                                                                                                            |
| Dans `LibraryPage` : `saveDocument`, `setSelected`, `select`, `toggleFolder`, `upload`, `handleDrop`, `folderMenu`, `documentActions`, `handleDragEnd` | Enregistrement d’une cellule, sélection, ouverture d’un dossier, pliage, envoi de fichiers, dépôt de fichiers, menu d’un dossier (`RowActions`), actions d’un document, fin d’un glisser-déposer (reclasse ou range, optimiste). |

## components/

### `components/LibraryForms.tsx`

| Export                                                        | Rôle                                                                                                                                            |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `LinkForm({ folderId, onDone })`                              | Nouveau lien : adresse, titre, description (`MarkdownEditor`).                                                                                  |
| `DocumentForm({ document, onDone })`                          | Modification d’un document : titre, adresse (lien) ou nouvelle version (`FileButton`), description ; puis `Comments target="LIBRARY_DOCUMENT"`. |
| `FolderNameForm({ initial, onSubmit, onDone, submitLabel })`  | Nom d’un nouveau dossier ou d’un dossier renommé.                                                                                               |
| `MoveForm({ folders, excluded?, initial, onSubmit, onDone })` | Choix du dossier cible (« Vers ») d’un déplacement de documents ou de dossier.                                                                  |

Internes : `ROOT` (valeur de la racine), `interface FolderSelectProps`, `FolderSelect` (`CreatableSelect` en arbre via `treeOptions` / `treeSelectProps`, racine « Documents (racine) », dossiers exclus ; un nom tapé crée un dossier à la racine). Tous ces formulaires s’ouvrent dans le panneau latéral (`openFormPanel`) depuis `LibraryPage` et utilisent `FormActions`.

### `components/LibraryDnd.tsx`

| Export                                                                   | Rôle                                                                                                                                                                 |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SortableRow({ id, label, disabled?, bg?, style?, onClick?, children })` | Ligne de tableau triable (`useSortable`) avec sa poignée ; une ligne de dossier se met en évidence quand un document la survole. `id` : `folder:<id>` ou `doc:<id>`. |
| `DroppableFolderLink({ folderId, ...NavLinkProps })`                     | `NavLink` de l’arbre qui reçoit un dépôt (`useDroppable`, id `tree:<id>` ou `tree:root`).                                                                            |

## lib/

### `lib/folders.ts`

| Export                             | Rôle                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `folderPaths(folders)`             | Chemin de chaque dossier (« Administratif › Société »), pour la colonne « Dossier » et les sous-lignes.            |
| `folderSubtree(folders, folderId)` | Ids d’un dossier et de ses sous-dossiers (comptes, exclusions de déplacement, refus de déplacement dans soi-même). |

### `lib/library-dnd.ts`

| Export             | Rôle                                                                                                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dndId(value)`     | Décompose un id de glisser-déposer `kind:id` (`folder`, `doc`, `tree`).                                                                                                             |
| `libraryCollision` | Détection de collision : un dossier de l’arbre sous le pointeur d’abord ; pour un document, un dossier de la liste sous le pointeur ; sinon l’élément le plus proche du même genre. |
