# Code web : fichiers

Tous les fichiers de `apps/web/src/features/files/` : le lien vers un fichier, l’aperçu d’un PDF ou d’une image, l’ouverture dans la visionneuse et la détection du type. Fonctionnalités : [Fichiers](../../../features/cross-cutting/files.md).

## `components/`

### `components/FileLink.tsx`

`FileLink({ url, filename, mimeType?, children, ...AnchorProps })` : lien vers un fichier ; un PDF ou une image s’ouvre dans la visionneuse (`handleFileClick`, attributs `EXTERNAL_LINK` pour l’ouverture hors application), un autre fichier pointe vers son adresse de téléchargement (`downloadUrl`). Utilisé par `components/markdown/MarkdownView.tsx` et `features/accounting/components/ProjectResourcesPanel.tsx`.

### `components/FilePreview.tsx`

| Export                                                  | Rôle                                                                            | Utilisé par                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `PAGE_PREVIEW_HEIGHT`                                   | Hauteur d’un aperçu dans une page : `max(36rem, calc(100dvh - 16rem))`.         | `ImportedDocumentPage`, `DocumentEditor`             |
| `FilePreview({ url, filename, kind, height = '80vh' })` | PDF dans une `iframe` (`#view=FitH`) ou image contenue (`Image fit="contain"`). | `openFile`, `ImportedDocumentPage`, `DocumentEditor` |

## `lib/`

### `lib/open-file.tsx`

| Export                         | Rôle                                                                                                                                                                                                                                                             | Utilisé par                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `openFile(file)`               | PDF ou image : `openModal` titré par le nom avec « Ouvrir dans un nouvel onglet » et « Télécharger » (`IconAction`), contenu `FilePreview` (taille `64rem` pour un PDF, `xl` pour une image) ; sinon téléchargement (`window.location.href = downloadUrl(url)`). | `LibraryPage`, `DocumentsTable`, `document-cells`, `TrackingPanel`, `DocumentEditor`, `document-pdf` |
| `handleFileClick(event, file)` | Gestionnaire de clic : ouvre la visionneuse pour un clic gauche simple sur un fichier affichable, laisse le navigateur faire sinon (touches de modification, autre bouton, fichier non affichable).                                                              | `FileLink`, `treasury/entry-cells`, `mail/MailHeader`                                                |

### `lib/viewable.ts`

| Export               | Rôle                                                                                                                                                             | Utilisé par                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ViewableKind`       | `'pdf'` ou `'image'`.                                                                                                                                            | `FilePreview`                                                                  |
| `viewableKind(file)` | Type affichable depuis le MIME (`application/pdf`, PNG, JPEG, GIF, WebP), sinon (MIME absent) depuis l’extension du nom puis de l’adresse ; `null` = téléchargé. | `FileLink`, `openFile`, `ImportedDocumentPage`, `MailHeader`                   |
| `downloadUrl(url)`   | Ajoute `download=1` à l’adresse (les fichiers de l’API le comprennent).                                                                                          | `FileLink`, `openFile`, `ImportedDocumentPage`, `DocumentsTable`, `MailHeader` |

Internes : `IMAGE_TYPES`, `IMAGE_EXTENSIONS`.
