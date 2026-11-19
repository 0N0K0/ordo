# Règles de la bibliothèque

> **À réécrire.** La bibliothèque de documents (`features/library`, `services/library`) sera entièrement réécrite. Cette page décrit les règles actuelles, telles quelles.

Règles appliquées aux dossiers et documents de la bibliothèque : validations, ordre, déplacements, suppressions, fichiers, archive ZIP et aperçu. Sources : `apps/api/src/services/library/library.ts`, `apps/api/src/graphql/modules/library.ts`, `apps/api/src/routes/library.ts`. Fonctionnalités : [Documents](../../features/resources/library.md).

## Modèle

- `DocumentFolder` : `name`, `parentId` (null : racine), `position`, `workspaceId`. Les sous-dossiers et les documents sont supprimés en cascade avec leur dossier.
- `LibraryDocument` : `folderId` (null : racine), `kind` (`FILE` ou `LINK`, type `ProjectResourceKind`), `title`, `url` (liens), `attachmentId` (fichiers, unique), `note`, `position`, `createdAt`, `updatedAt`. Lié aux écritures et lignes de trésorerie qu’il justifie et à des commentaires.
- Pas d’archivage : dossiers et documents sont seulement supprimés.
- Chaque ligne appartient à l’espace actif ([Espaces et accès](../cross-cutting/workspaces-and-access.md)).

## Validations

| Champ                   | Règle                                                     | Messages                                                                                                                                   |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Nom de dossier          | Requis, rogné, 100 caractères max                         | « Le nom est requis. », « 100 caractères maximum. »                                                                                        |
| Titre (lien ou fichier) | Requis, rogné, 200 caractères max                         | « Le titre est requis. », « 200 caractères maximum. »                                                                                      |
| Adresse d’un lien       | URL `http` ou `https`                                     | « Lien invalide (http ou https). »                                                                                                         |
| Description (`note`)    | Rognée, 2 000 caractères max, vide enregistrée comme null | « 2 000 caractères maximum. »                                                                                                              |
| Fichier                 | Non vide, 25 Mo max (`MAX_LIBRARY_BYTES`)                 | « « nom » est vide. », « « nom » est trop lourd (25 Mo maximum). » ; au remplacement : « « nom » est vide ou trop lourd (25 Mo maximum). » |

Un dossier parent ou cible inexistant : « Dossier introuvable. » ; un document inexistant : « Document introuvable. ». Les noms ne sont pas uniques ([Nommage](../cross-cutting/naming.md)).

## Ordre

Voir aussi [Ordre](../cross-cutting/ordering.md).

- Dossiers triés par `position` puis nom, parmi ceux d’un même parent ; documents par `position` puis titre, parmi ceux d’un même dossier.
- Un dossier créé ou déplacé dans un parent va **après** les dossiers déjà là ; un document ajouté ou déplacé dans un dossier va après les documents déjà là (plusieurs documents déplacés : dans l’ordre donné).
- `reorderDocumentFolder` / `reorderLibraryDocument` : déplacent d’abord dans le nouveau parent ou dossier s’il diffère, puis renumérotent toutes les positions des frères dans une transaction.

## Dossiers

- **Création** : parent existant (ou racine).
- **Renommer** : dossier existant.
- **Déplacer** (`moveFolder`) : dossier et cible existants ; refusé dans lui-même ou un de ses sous-dossiers : « Un dossier ne peut pas aller dans lui-même ni dans l’un de ses sous-dossiers. » Le contenu suit.
- **Suppression** (`deleteFolder`) : définitive, avec tous ses sous-dossiers et documents ; les fichiers (pièces jointes) des documents de tout le sous-arbre sont supprimés dans la même transaction.

## Documents

- **Ajout de fichiers** (`addFiles`) : tous les fichiers sont vérifiés avant d’en enregistrer un ; chaque fichier devient une pièce jointe (`attachmentData`) et un document `FILE` dont le titre est le nom du fichier sans son extension (1 à 8 caractères après le dernier point), coupé à 200 caractères.
- **Ajout d’un lien** (`addLink`) : validé par le schéma des liens.
- **Modification** (`updateDocument`) : un lien revalide titre, adresse (l’ancienne si non fournie) et description ; un fichier revalide titre et description. Un fichier peut être remplacé : nouvelle pièce jointe, puis l’ancienne est supprimée. Un fichier envoyé pour un lien est ignoré.
- **Déplacement** (`moveDocuments`) : dossier cible existant ; les documents déjà dans ce dossier ne bougent pas ; les ids inconnus sont ignorés.
- **Suppression** (`deleteDocuments`) : tous les ids doivent exister (sinon « Document introuvable. ») ; documents et pièces jointes supprimés ensemble dans une transaction.

## Lecture

- `documentFolders` et `libraryDocuments` renvoient toute la bibliothèque de l’espace (sans le contenu des fichiers).
- `url` d’un document : l’adresse d’un lien, ou `/api/attachments/<id>/<nom>` pour un fichier ; `fileName`, `mimeType`, `size` viennent de la pièce jointe.

## Archive ZIP

Route `GET /api/library/zip` (`libraryZip`), erreur générique « Archive impossible. ».

- Portée : `?folderId=` (le dossier et ses sous-dossiers ; « Dossier introuvable. » s’il n’existe pas), `?ids=a,b` (documents choisis), ou rien (toute la bibliothèque).
- Les sous-dossiers deviennent des dossiers de l’archive, relatifs au dossier exporté ; pour des documents choisis, tout est à plat.
- Les fichiers gardent leur nom ; les liens deviennent des raccourcis Internet `<titre>.url` (`[InternetShortcut]`, `URL=…`). Caractères interdits (`\ / : * ? " < > |`) remplacés par « - » ; nom vide : « sans-nom ». Doublons suffixés « (2) », « (3) »… avant l’extension. Date des entrées : `updatedAt`.
- Aucun document : « Aucun document à télécharger. »
- Nom de l’archive : `<nom du dossier>.zip`, ou `Documents.zip`.

## Aperçu

Route `GET /api/library/:id/view` : session requise ; renvoie en ligne le PDF d’un document (politique de sécurité `default-src 'none'; frame-ancestors 'self'`, sans `sandbox`) ; 404 pour un document absent, sans fichier, ou qui n’est pas un PDF. Les autres fichiers se téléchargent par `/api/attachments` ([Fichiers et pièces jointes](../cross-cutting/files-and-attachments.md)).
