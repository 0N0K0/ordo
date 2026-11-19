# Fichiers : visionneuse et téléchargement

Comment l’application ouvre les fichiers qu’elle stocke (pièces jointes de textes Markdown, ressources de projet, documents comptables, pièces de trésorerie, pièces jointes de mails, documents) : visionneuse intégrée pour les PDF et images, téléchargement pour le reste. Code web : `apps/web/src/features/files/` (voir [Fichiers, code web](../../web/features/cross-cutting/files.md)) ; API : `apps/api/src/services/core/attachments.ts`, `apps/api/src/routes/attachments.ts` ; règles : [Fichiers et pièces jointes](../../business-rules/cross-cutting/files-and-attachments.md).

## Ouvrir un fichier

- Un **PDF** ou une **image** (PNG, JPEG, GIF, WebP) s’ouvre dans une fenêtre de l’application, titrée par le nom du fichier, avec deux boutons : « Ouvrir dans un nouvel onglet » et « Télécharger ». Le PDF est affiché par le lecteur du navigateur, ajusté à la largeur ; l’image est contenue dans la fenêtre.
- Tout **autre fichier** est téléchargé directement.
- Un clic avec une touche (Ctrl, Cmd, Maj, Alt) ou un autre bouton de la souris garde le comportement du navigateur (nouvel onglet…).
- Le type est connu par le type MIME quand il est fourni, sinon par l’extension du nom ou de l’adresse.

## Aperçu dans une page

Sur la page d’un document importé et dans l’éditeur d’un document comptable, le PDF ou l’image s’affiche directement dans la page, sur la plus grande partie de la hauteur de la fenêtre (au moins 36rem). Voir [Facturation](../finances/accounting.md).

## Où c’est utilisé

- Liens de fichiers dans le Markdown (descriptions, commentaires) et dans les ressources d’un projet ([Projets](projects.md)).
- Documents comptables et documents importés, suivi, PDF générés ([Facturation](../finances/accounting.md)).
- Pièces des écritures de trésorerie ([Trésorerie](../finances/treasury.md)).
- Pièces jointes des mails ([Mails](../resources/mail.md)).
- Page « Documents » ([Documents](../resources/library.md)).

## Côté serveur

- Adresse d’une pièce jointe : `/api/attachments/<id>/<nom>` (le nom n’est là que pour la lisibilité) ; `?download=1` force le téléchargement.
- Les images reconnues et les PDF (vérifiés par leurs premiers octets, le type déclaré n’étant pas cru) sont servis pour être affichés ; le reste est servi en simple téléchargement. Les fichiers servis n’exécutent rien (politique de sécurité dédiée).
- Un fichier téléversé doit être non vide (« Ce fichier est vide. ») et faire 10 Mo au plus (« « x.pdf » est trop lourd (10 Mo maximum). »).
- Une pièce jointe introuvable : « Pièce jointe introuvable. ».
