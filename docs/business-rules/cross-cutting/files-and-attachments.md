# Fichiers et pièces jointes

Stockage des fichiers téléversés (pièces jointes, ressources de projet, documents, logo), des icônes et avatars, leur service par l'API (affichage ou téléchargement, cache, sécurité) et les exports. Sources : `apps/api/src/services/core/attachments.ts`, `apps/api/src/services/projects/linked-documents.ts`, `apps/api/src/services/core/icons.ts`, `apps/api/src/services/core/settings-lists.ts`, `apps/api/src/services/core/zip.ts`, `apps/api/src/routes/**`, `packages/shared/src/core/workspace.ts`, `packages/shared/src/core/text.ts`.

Voir aussi : [Nommage](naming.md) (noms de fichiers), [Erreurs](errors.md), [Espaces et accès](workspaces-and-access.md).

## Stockage

- Les fichiers sont stockés **en base**, dans la table `Attachment` (nom, type, taille, octets), chacun dans son espace. Les icônes sont dans une table à part, `Icon`, pour que les listes ne chargent jamais les octets.
- Aucune limite d'espace disque n'est gérée par l'application.

## Pièces jointes (`storeAttachment`)

Règles identiques partout (texte markdown, documents comptables, documents importés, ressources de projet, document signé, logo de l'entreprise, justificatifs de trésorerie, bibliothèque) :

- Fichier vide refusé : « Ce fichier est vide. ».
- 10 Mo au plus (`MAX_ATTACHMENT_BYTES`) : « « nom » est trop lourd (10 Mo maximum). » (même message côté web).
- Nom : coupé à 200 caractères puis nettoyé (`safeFilename` : caractères interdits remplacés par « - », « sans-nom » si vide).
- Type : déterminé par les **premiers octets**, pas par l'extension ni le type déclaré (`sniffedType`) : PNG, JPEG, GIF, WebP et PDF gardent leur type, tout le reste devient `application/octet-stream` (téléchargement simple).
- Mutation `uploadAttachment(file)` : fichier à lier depuis un texte markdown (description, commentaire…). Le lien est `/api/attachments/{id}/{nom}` (`attachmentUrl`, nom encodé, parenthèses comprises pour le markdown).
- Logo de l'entreprise : PNG ou JPEG uniquement (« Logo en PNG ou JPEG uniquement. »), pour les PDF des documents ; l'ancien logo est supprimé.
- Documents comptables : des fichiers peuvent être joints aux brouillons comme aux définitifs (ils ne font pas partie du document) ; pas sur un document archivé.
- Ressources de projet : fichiers (libellé = nom du fichier) ou liens (http/https), ajoutés en fin de liste ; pas sur un projet archivé ; supprimer une ressource fichier supprime le fichier.

### Suppression

`deleteAttachment(id, leftover)` : un fichier déjà absent n'est pas une erreur. Un « reste » (ancien fichier remplacé, fichier d'un élément supprimé, nouveau fichier d'une modification refusée) ne fait jamais échouer l'action principale : son échec est seulement journalisé.

## Documents liés aux tâches, routines et évènements

Une tâche, une routine ou un évènement peut citer des **documents** : des documents de la bibliothèque (`LibraryDocument`) et des documents de projet (`ProjectResource`), comme les pièces justificatives d'un mouvement de trésorerie ([Trésorerie](../finances/treasury.md#pièces-justificatives)). Sources : `apps/api/src/services/projects/linked-documents.ts`, `apps/api/src/graphql/document-fields.ts`, `packages/shared/src/core/documents.ts`.

- Champs `libraryDocumentIds` et `projectResourceIds` (lus et envoyés), 50 au plus de chaque sorte (« 50 documents maximum. », `linkedDocumentIdsSchema`). Tables de liaison implicites `_TaskLibraryDocuments`, `_TaskProjectResources`, `_RoutineLibraryDocuments`, `_RoutineProjectResources`, `_EventLibraryDocuments`, `_EventProjectResources` : supprimer un document, ou l'élément, supprime le lien.
- Chaque document doit exister : « Document introuvable. » (bibliothèque), « Document du projet introuvable. » (projet), les mêmes messages que la trésorerie. Ni la bibliothèque ni les documents de projet ne s'archivent : il n'y a pas de contrôle d'archivage.
- **Arborescence** (`checkLinkedDocuments`) : un document de projet doit appartenir à l'arborescence du projet de l'élément (le projet racine commun, comme les sprints d'une tâche), celui qu'il suit (pour un élément qui hérite de son projet, le projet de son parent). Sinon : « Les documents de projet doivent appartenir au projet de l’élément ou à son arborescence. » (champ `projectResourceIds`) ; sans projet : « Sans projet, seuls des documents de la bibliothèque se lient. ». Un document qu'il avait déjà reste tant que son arborescence ne change pas (un projet déplacé dans l'arbre).
- **Changement de projet** : les documents de la bibliothèque restent ; les documents de projet hors de la nouvelle arborescence sont retirés, comme les liens entre tâches (ou routines) de deux arborescences. Ils comptent dans les liens retirés que l'API renvoie (`removedLinks` du transfert de tâches et de l'enregistrement d'une routine).
- **Pas d'héritage** : une sous-tâche ou une sous-routine n'hérite pas des documents de son parent (comme les liens).
- **Copie** (« Dupliquer ») et **transformation** tâche ↔ routine : les documents sont gardés (une copie laisse ceux hors de son arborescence, comme ses autres liens). Un évènement les porte pour toute sa série : une occurrence seule ne les change pas ; la coupure d'une série (« Celle-ci et les suivantes ») et le report les gardent.
- Options proposées (`documentOptions`) : bibliothèque par titre, puis documents de projet par projet et position ; chaque document : source (`LIBRARY` / `PROJECT`), sorte (`FILE` / `LINK`), URL, lieu (dossier, « Documents » par défaut, ou projet). La même requête sert la trésorerie.

## Icônes et avatars (`storeIcon`)

Icônes des clients, projets, éléments des listes de réglages ; avatars des contributeurs.

- 1 Mo au plus : « Image trop lourde (1 Mo maximum). ».
- Formats reconnus par leurs octets : PNG, JPEG, WebP, SVG ; sinon « Format non pris en charge (JPG, PNG, WebP ou SVG). » (GIF refusé).
- Les images matricielles sont redressées (EXIF) et redimensionnées dans un carré de 256 px, converties en WebP (qualité 85) ; illisible : « Cette image est illisible. ».
- Les SVG sont nettoyés (DOMPurify : scripts, gestionnaires d'événements, références externes retirés) ; invalide : « Ce fichier SVG est invalide. ».
- Remplacer ou retirer une icône (`resolveIconUpdate`) puis supprimer les icônes orphelines, plus utilisées par rien (`deleteOrphanIcons`).
- Couleur d'un élément de réglage : `#rrggbb` (« Couleur invalide (format #rrggbb). »), `setLook`.
- URL : `/api/icons/{id}`.

## Service des fichiers

Toutes les routes exigent une session (401 sinon) et envoient `X-Content-Type-Options: nosniff`. Le corps JSON des exports n'est lu qu'une fois la session vérifiée.

| Route                                                      | Contenu                                                            | Affichage                                                                                                  | Cache                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `GET /api/attachments/:id/:nom?`                           | Pièce jointe                                                       | Images (PNG, JPEG, GIF, WebP) et PDF en place, le reste téléchargé ; `?download=1` force le téléchargement | 1 an, immuable (un fichier ne change jamais d'URL) |
| `GET /api/icons/:id`                                       | Icône                                                              | En place, CSP `default-src 'none'; style-src 'unsafe-inline'; sandbox`                                     | 1 an, immuable                                     |
| `GET /api/mail/:accountId/attachment?folder&uid&index`     | Pièce jointe d'un mail lue sur le serveur                          | Type déterminé par les octets ; images et PDF en place                                                     | 1 heure                                            |
| `GET /api/library/:id/view`                                | PDF de la bibliothèque                                             | En place                                                                                                   | sans cache                                         |
| `GET /api/library/zip?folderId` / `?ids=a,b`               | ZIP d'un dossier, de toute la bibliothèque ou de documents choisis | Téléchargement                                                                                             | sans cache                                         |
| `GET /api/accounting/documents/:id/pdf`                    | PDF d'un document (`?paid=1` : facture acquittée)                  | En place, `?download=1`                                                                                    | sans cache                                         |
| `GET /api/accounting/documents/zip?from&to&types&imported` | ZIP des documents émis sur une période                             | Téléchargement                                                                                             | sans cache                                         |
| `GET /api/treasury/statement.pdf?from&to&accountId`        | Relevé des mouvements réels d'une période                          | Téléchargement                                                                                             | sans cache                                         |
| `POST /api/exports/table.pdf`                              | PDF d'un tableau mis en forme par le web (5 Mo de JSON max)        | Téléchargement                                                                                             | sans cache                                         |
| `POST /api/exports/charts.pdf`                             | PDF de graphiques (images PNG, 50 Mo max)                          | Téléchargement                                                                                             | sans cache                                         |
| `POST /api/exports/calendar.pdf`                           | PDF d'une vue du calendrier                                        | Téléchargement                                                                                             | sans cache                                         |
| `POST /api/exports/typical-weeks.pdf`                      | PDF des semaines types d'une période                               | Téléchargement                                                                                             | sans cache                                         |
| `GET /api/exports/calendar.ics?calendar`                   | iCalendar d'un agenda ou de tous                                   | Téléchargement                                                                                             | sans cache                                         |

Sécurité des fichiers affichés (`fileSecurityPolicy`) : aucun contenu ne s'exécute (`default-src 'none'; sandbox`) ; un PDF affiché en place peut être encadré par l'application (`frame-ancestors 'self'`, sans `sandbox` : les navigateurs n'affichent pas un PDF dans un cadre isolé). Un fichier n'est reconnu PDF que par ses premiers octets (`%PDF-`).

## Exports PDF et ZIP

- Gabarit commun des exports PDF (`apps/api/src/services/core/pdf-report.ts`) : A4 paysage, police Inter, logo de l'entreprise (ou nom de l'entreprise, ou de l'espace) et titre en haut de chaque page (le titre de chaque page avec `pageTitles` : les semaines types), pied « Émetteur · Exporté le … » à l'heure de Paris, numéros de page (avec `singlePageNumber: false`, aucun quand le document n'a qu'une page : l'agenda) ; en tête du contenu, le titre de l'export en 16 pt gras et son sous-titre en 10 pt gris (`writeHeading` ; l'agenda n'en a pas, sa période est dans l'en-tête).
- Nom de l'émetteur : la société en espace PRO, sinon le libellé de l'espace (`issuerName`).
- ZIP sans compression (PDF et images déjà compressés), noms UTF-8, dossiers par « / » (`zipFiles`).
- Nom d'un fichier exporté : `fileName(libellé, extension)` (voir [Nommage](naming.md)).
