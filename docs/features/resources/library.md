# Documents (bibliothèque)

> **À réécrire.** La bibliothèque de documents (`features/library`, `services/library`) sera entièrement réécrite. Cette page décrit l’état actuel, tel quel ; ne pas s’en servir comme cible.

Ce que l’utilisateur peut faire dans la page « Documents » : dossiers imbriqués, fichiers et liens, aperçu, téléchargement, ZIP, déplacement et glisser-déposer. Sources : `apps/web/src/features/library/**`, `apps/api/src/services/library/library.ts`, `apps/api/src/routes/library.ts`. Règles : [Règles de la bibliothèque](../../business-rules/resources/library.md) ; code : [Code web de la bibliothèque](../../web/features/resources/library.md).

## Page

- Route `/documents`, menu « Ressources » › « Documents ». Présente dans les espaces PRO et PERSO, sans différence.
- En-tête « Documents », description « Documents de l’entreprise : Kbis, statuts, logo, attestations… en fichiers ou en liens vers votre cloud. »
- Actions de l’en-tête : « Ajouter des fichiers » (sélection multiple), « Ajouter un lien », « Nouveau dossier ». Tout s’ajoute dans le dossier ouvert.
- Le dossier ouvert est gardé dans l’adresse (`?folder=<id>`) ; sans paramètre (ou dossier inconnu) : la racine « Documents ».
- Chargement : squelette de tableau ; erreur : message en rouge.

## Arborescence (colonne de gauche)

- Racine « Documents » puis les dossiers, dans l’ordre choisi par glisser-déposer, avec le nombre de documents **directement** dans chaque dossier.
- Les dossiers sur le chemin du dossier ouvert sont dépliés ; chaque dossier ayant des sous-dossiers se plie ou se déplie (« Déplier X » / « Replier X »).
- Chaque dossier de l’arbre (et la racine) reçoit ce qu’on y dépose : documents ou dossiers.

## Contenu du dossier ouvert

- Fil d’Ariane « Documents › … › dossier ».
- Barre de vue du tableau (`DataViewBar`) : recherche « Rechercher dans tous les documents », filtres, vues enregistrées, colonnes, regroupement ; export « Fichiers du dossier (.zip) » ou « Tous les fichiers (.zip) » à la racine (désactivé si la bibliothèque est vide).
- **Recherche ou filtre actif** : les documents de **tous** les dossiers qui correspondent, sans les sous-dossiers ; le chemin du dossier s’affiche sous le titre.
- **Sinon** : les sous-dossiers du dossier ouvert (en premier, triables par nom seulement), puis ses documents.

### Colonnes

| Colonne         | Contenu                                                                                                                                                                          | Par défaut                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| « Nom »         | Icône (PDF rouge, image violette, lien bleu, autre fichier gris), titre modifiable en place, sous-ligne : dossier (en recherche), domaine du lien ou nom du fichier, description | Visible, verrouillée, modifiable en lot   |
| « Dossier »     | Chemin du dossier (« Documents » à la racine)                                                                                                                                    | Masquée, groupable                        |
| « Type »        | « Lien » ou type MIME                                                                                                                                                            | Masquée, groupable                        |
| « Taille »      | Taille du fichier, ou « Lien »                                                                                                                                                   | Visible                                   |
| « Description » | Description modifiable en place                                                                                                                                                  | Masquée, modifiable en lot                |
| « Modifié le »  | Date de dernière modification, filtrable par date                                                                                                                                | Visible                                   |
| Commentaires    | Nombre de commentaires du document                                                                                                                                               | Selon la colonne commune des commentaires |

Une ligne de dossier montre son nom et, dans la colonne « Taille », le nombre de documents qu’il contient avec ses sous-dossiers. Un clic sur la ligne ouvre le dossier.

Regroupement (par dossier ou type) avec en-têtes repliables et pied de groupe ; pied de tableau avec totaux si configuré dans la vue.

### État vide

- Dossier vide : « Dossier vide. Glissez des fichiers ici, ou ajoutez des fichiers et des liens avec les boutons ci-dessus. »
- Recherche sans résultat : « Aucun document ne correspond à la recherche. »

Aide sous la liste : « Fichiers de 25 Mo au plus. Glissez-déposez des fichiers sur la liste pour les ajouter au dossier ouvert. Réordonnez dossiers et documents par leur poignée ; déposez un document sur un dossier, ou un dossier dans l’arborescence, pour l’y ranger. »

## Actions sur un document

- Action principale : « Télécharger » (fichier) ou « Ouvrir le lien » (nouvel onglet).
- Menu : « Aperçu » (PDF et images seulement, dans la visionneuse de l’app), « Modifier », « Déplacer », « Supprimer ».
- **Modifier** (panneau « Modifier le document ») : « Titre » (requis), « Adresse » (lien, requise) ou le nom du fichier avec « Remplacer par une nouvelle version », « Description » (Markdown, placeholder « Date de validité, numéro… »), puis les commentaires du document. Notification « Document modifié. »
- **Déplacer** (panneau « Déplacer le document ») : champ « Vers », arborescence avec « Documents (racine) » ; on peut y taper un nouveau nom de dossier, créé à la racine.
- **Supprimer** : confirmation « Supprimer le document » : « « X » sera supprimé définitivement [avec son fichier]. Cette action est irréversible. » Notification « Document supprimé. »
- Titre et description se modifient aussi directement dans leurs cellules.

## Actions sur un dossier

Menu de la ligne du dossier :

- « Renommer » (panneau « Renommer le dossier », champ « Nom »).
- « Déplacer » (panneau « Déplacer le dossier ») : ni lui-même ni ses sous-dossiers ne sont proposés.
- « Télécharger (.zip) » : le dossier avec ses sous-dossiers (désactivé s’il ne contient aucun document).
- « Supprimer » : confirmation « Supprimer le dossier » : « « X » sera supprimé définitivement, avec ses sous-dossiers et ses N documents. Cette action est irréversible. » Si le dossier ouvert était dedans, la page revient à son parent. Notification « Dossier supprimé. »

**Nouveau dossier** (panneau « Nouveau dossier », placeholder « Administratif, Juridique, Identité visuelle… ») : créé dans le dossier ouvert, puis ouvert.

## Ajouter

- **Fichiers** : bouton « Ajouter des fichiers » ou glisser-déposer de fichiers sur la liste (contour en pointillés pendant le survol). Le titre est le nom du fichier sans son extension. Notification « N fichiers ajoutés. » ; erreur en notification persistante (fichier vide, plus de 25 Mo).
- **Lien** (panneau « Ajouter un lien ») : « Adresse » (requise, placeholder « https://drive.google.com/… »), « Titre » (requis, placeholder « Statuts signés, dossier comptable… »), « Description » (Markdown). Notification « Lien ajouté. » ; l’erreur s’affiche dans le formulaire.

## Sélection et actions groupées

- Case par document et case « Tout sélectionner » (documents affichés). Changer de dossier vide la sélection.
- Barre de sélection « N documents sélectionnés » : « Télécharger (.zip) », « Déplacer » (panneau « Déplacer les documents »), « Supprimer » (confirmation « Supprimer les documents » : « N documents seront supprimés définitivement avec leurs fichiers. Cette action est irréversible. », notification « Documents supprimés. »).
- Les cellules titre et description des documents cochés se modifient en lot.

## Glisser-déposer

- Par la poignée de chaque ligne (souris après 6 px, ou clavier).
- Document sur un autre document : réordonne dans le dossier ouvert. Désactivé pendant une recherche, un filtre, un regroupement ou un tri par colonne.
- Document sur une ligne de dossier ou un dossier de l’arbre : le range dedans ; si le document fait partie de la sélection, **toute la sélection** suit. Notification « Document déplacé. » / « N documents déplacés. »
- Dossier sur un autre dossier de la liste : réordonne parmi les sous-dossiers (désactivé pendant un tri).
- Dossier sur un dossier de l’arbre (ou la racine) : le range dedans. Refusé dans lui-même ou un de ses sous-dossiers : « Un dossier ne peut pas aller dans lui-même ni dans l’un de ses sous-dossiers. » Notification « Dossier déplacé. »
- L’affichage change aussitôt, avant la réponse du serveur.

## Ailleurs dans l’app

Les documents de la bibliothèque peuvent servir de pièces justificatives aux écritures et lignes de trésorerie (« Pièces justificatives ») ; voir [Trésorerie](../finances/treasury.md). Ils se lient aussi aux tâches, routines et évènements (« Documents », dans le groupe « Ressources » de leur panneau) ; voir [Documents liés](../../business-rules/cross-cutting/files-and-attachments.md#documents-liés-aux-tâches-routines-et-évènements). Ils portent des commentaires ([Commentaires](../cross-cutting/comments.md)).
