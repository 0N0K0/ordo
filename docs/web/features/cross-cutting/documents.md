# Code web : documents liés

Tous les fichiers de `apps/web/src/features/documents/` : les documents de l’application (bibliothèque, documents de projet) liés à un élément, leur requête, leurs clés, leur sélecteur, le champ « Documents » des panneaux et la colonne « Documents » des tableaux. Utilisés par la trésorerie (pièces justificatives), les tâches, les routines et les évènements. Règles : [Documents liés](../../../business-rules/cross-cutting/files-and-attachments.md#documents-liés-aux-tâches-routines-et-évènements).

## `api/index.ts`

| Export                        | Rôle                                                                                                                                                                       | Utilisé par                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `LinkedDocument`              | Document de l’application qui peut être lié (type GraphQL `LinkedDocument`, fragment `LinkedDocumentFields`) : `id`, `source` (`LIBRARY` / `PROJECT`), `kind` (`FILE` / `LINK`), `label`, `url`, `projectId`, `place` (dossier ou projet). | `DocumentsPicker`, `DocumentsField`                      |
| `useDocumentOptions(enabled?)` | Documents qui peuvent être liés (`documentOptions`) : la bibliothèque, puis les documents des projets ; clé `documentOptionsKey` (`lib/query-keys`).                       | `DocumentsField`, `EventForm`, `EntryForm`, `useEntryEnv` |

Interne : `DocumentOptionsDocument`. Le fragment `LinkedDocumentFields` sert aussi aux pièces des mouvements et des lignes (`features/treasury/api`).

## `lib/document-keys.ts`

| Export                                     | Rôle                                                                                                                                                                            | Utilisé par                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `DocumentSource`                           | Document proposé : `source`, `id`, `label`, `place`, `projectId?`.                                                                                                              | `documentGroups`, `resourcesInTree`                                          |
| `DocumentGroup`                            | Groupe d’options d’un select (`{ group, items }`).                                                                                                                              | `DocumentsPicker`, `EntryEnv`, `SupportingDocumentsSelect`                   |
| `documentKey(document)`                    | `lib:<id>` ou `res:<id>`.                                                                                                                                                       | `DocumentsPicker`, `DocumentsField`                                          |
| `documentKeys(ids)`, `documentIdsOfKeys(keys)` | `LinkedDocumentIds` ↔ clés.                                                                                                                                                 | `DocumentsPicker`, `DocumentsField`, `SupportingDocumentsSelect`             |
| `documentGroups(documents, projectId?)`    | Documents groupés : « Bibliothèque », puis « Projet X » (celui de l’élément d’abord) ; dossier entre parenthèses hors « Documents » ; chacun une fois.                         | `DocumentsField`, `EntryForm`, `useEntryEnv`                                 |
| `resourcesInTree(ids, documents, inTree)`  | Documents de projet gardés dans une nouvelle arborescence (un inconnu reste : l’API décide), comme l’API les garde.                                                             | `EventForm` (changement de projet)                                           |

Garde eslint : `taggedKey` / `taggedIds` avec `'lib'` ou `'res'` hors de ce fichier sont refusés (utiliser ces fonctions).

## `lib/documents-column.ts`

| Export                        | Rôle                                                                                                                                         | Utilisé par                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `documentCount(item)`         | Nombre de documents liés (bibliothèque et projet).                                                                                           | `documentsColumn`                   |
| `documentsColumn(documents)`  | Colonne « Documents » d’un tableau, masquée par défaut : nombre de documents de la ligne, triée et filtrée comme un nombre, non groupable. | `task-columns`, `routine-columns`   |

## `components/`

### `components/DocumentsPicker.tsx`

`DocumentsPicker({ documents, options, label, action?, removable?, readOnly?, onSave })` : documents liés, les mêmes partout : badges `FileBadge` (infobulle « Bibliothèque · dossier » ou « Projet X »), ouverts d’un clic (un fichier de l’application dans la visionneuse, `handleFileClick`, un lien dans un nouvel onglet), retirés par leur croix avec `removable` ; crayon (`action`, « Choisir les documents » par défaut) ouvrant un `BatchMultiSelect` groupé dans une bulle ; les documents liés absents des options restent proposés (groupe « Choisis »). Utilisé par `DocumentsField` et `DocumentsCell` (trésorerie, « Choisir les pièces justificatives »).

### `components/DocumentsField.tsx`

`DocumentsField({ value, projectId, inTree, readOnly?, description?, error?, onChange })` : champ « Documents » du groupe « Ressources » des panneaux d’une tâche, d’une routine et d’un évènement (`LabeledField`) : les documents de `value` résolus par `useDocumentOptions`, « Aucun document. » sinon, `DocumentsPicker` amovible ; proposés : la bibliothèque et les documents des projets de l’arborescence (`inTree`, `inProjectTree` des tâches), groupés par `documentGroups` (le projet de l’élément d’abord). Chaque changement passe par `onChange` (enregistré tout de suite). Utilisé par `TaskPanel` (`save`), `RoutineForm` et `EventForm` (`form.setValues`, `useFieldSave` ; sur « Cette occurrence », en lecture seule).
