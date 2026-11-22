# Projets et clients

Ce que l’utilisateur peut faire avec les clients et les projets : la barre latérale (arbre, favoris, archives), les pages d’un client et d’un projet, leurs formulaires, et la page « Paramètres ». Code web : `apps/web/src/features/projects/` (voir [Projets, code web](../../web/features/cross-cutting/projects.md)) ; règles : [Règles des projets](../../business-rules/cross-cutting/projects.md).

## Différences PRO / PERSO

- Espace **PRO** : clients et projets ; un projet racine peut être rattaché à un client ou rester « Sans client ».
- Espace **PERSO** : pas de clients. La section de la barre latérale s’appelle « Projets », le groupe des projets « Tous les projets », le formulaire de projet n’a pas de champ « Client », la page d’un projet n’a pas l’onglet « Facturation » ni la mention « Sans client », la page d’un client affiche « Indisponible dans un espace personnel » (voir [Espaces](workspaces.md)).

## Barre latérale

Composant `Sidebar`, à gauche de l’application.

### Menu

- « Accueil » (`/`).
- Groupes repliables, fermés au départ ; l’état de chaque groupe est gardé par fenêtre ; le groupe de la page ouverte se déplie, et est surligné s’il est replié :
  - « Activités » : « Tâches » (pastille : nombre de tâches faisables maintenant de la vue par défaut de la page « Tâches », comme la section « Maintenant » de la carte de l’accueil, sans vue celles de mes tâches du jour ; pleine et en couleur de retard si certaines sont en retard), « Routines » (pastille : moments faits sur prévus aujourd’hui, « 3/7 », comme l’onglet « Historique » ; verte quand tout est fait), « Agenda » (pastille : évènements du jour, journée entière comprise, hors annulés), « Chronos » (pastille : temps du jour, « 2 h 30 », chronos en cours comptés en direct ; rouge quand un chrono tourne), « Alarmes » (pastille : temps jusqu’à la prochaine sonnerie, « 12 min », « 2 h », « 3 j », recalculé chaque minute : rappels des évènements, tâches, routines, éphémérides et anniversaires, alarmes programmées, paliers des chronos en cours, fins des minuteurs, comme le centre des alarmes).
  - Une pastille sans valeur (0, rien de prévu) ne s’affiche pas ; chacune a un libellé pour les lecteurs d’écran (« 5 tâches faisables maintenant », « Prochaine sonnerie dans 12 min »…).
  - « Économat » : « Achats », « Fiches », « Inventaire ».
  - « Finances » : « Facturation » (absente en PERSO), « Trésorerie » (pastille : solde du jour des comptes ouverts, rouge s’il est négatif).
  - « Ressources » : « Mails » (pastille du nombre de non lus), « Documents », « Tableaux de bord ».
- « Paramètres » en bas.

### Recherche, tri, création

- Champ « Rechercher » (clients et projets, sans tenir compte des accents ni de la casse) ; un client trouvé garde tous ses projets, un projet trouvé garde tous ses sous-projets, et les parents d’un projet trouvé restent affichés. Pendant une recherche, toutes les branches sont dépliées ; « Aucun résultat. » si rien ne correspond. Bouton « Effacer la recherche ».
- Menu « Trier » : « Ordre manuel » (par défaut) ou « Alphabétique ». Le choix est gardé par fenêtre.
- Bouton « Créer » : « Nouveau client » (PRO seulement) et « Nouveau projet ».

### Sections

| Section                            | Contenu                                                                                                                                                         | Affichage                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| « Favoris »                        | clients favoris avec leurs projets actifs, projets favoris avec leurs sous-projets actifs, sous leur client et leurs parents (affichés en grisé comme contexte) | seulement s’il y a au moins un favori                                                                                  |
| « Clients » (« Projets » en PERSO) | clients actifs avec leurs arbres de projets actifs, puis le groupe « Sans client » (« Tous les projets » en PERSO)                                              | toujours ; état vide « Aucun client pour le moment. » ou « Aucun projet pour le moment. » avec les boutons de création |
| « Archives »                       | clients archivés avec leurs projets, projets archivés avec leurs sous-projets, sous leur client et leurs parents (en contexte)                                  | seulement s’il y a des archives ; fermée par défaut                                                                    |

- Chaque section se replie (titre avec compteur) ; son menu « … » propose les créations (section principale) et « Tout déplier » / « Tout replier ». L’ouverture des sections et le pliage de chaque nœud sont gardés.
- Le compteur de « Favoris » et « Archives » ne compte pas les éléments de contexte.

### Lignes de l’arbre

- Un clic ouvre la page du client (`/clients/:id`) ou du projet (`/projects/:id`) ; la ligne de la page ouverte est surlignée ; un élément archivé est grisé.
- Double-clic : renommer (formulaire « Renommer le client » / « Renommer le projet » dans le panneau latéral).
- Menu « … » ou clic droit :
  - client actif : « Ajouter un projet » ;
  - projet actif sous la profondeur maximale : « Ajouter un sous-projet » ;
  - « Tout déplier » / « Tout replier » s’il a des enfants ;
  - élément actif : « Modifier », « Ajouter aux favoris » / « Retirer des favoris » ;
  - « Archiver » / « Restaurer » (« avec ses projets et ses contacts » pour un client) et « Supprimer ».
- Groupe « Sans client » : menu avec « Ajouter un projet » (section principale) et le pliage.

### Glisser-déposer (section principale)

Disponible en ordre manuel, hors recherche, et pas sur écran tactile ni téléphone.

- Un client se déplace parmi les clients.
- Un projet se déplace avec ses sous-projets : verticalement pour choisir la place, horizontalement pour choisir le niveau (sous le projet du dessus, ou au même niveau), dans la limite de 5 niveaux. Il peut changer de client ou passer « Sans client » ; ses sous-projets suivent le client.
- Erreur éventuelle : toast d’erreur.

## Page d’un client

Route `/clients/:id` (PRO seulement). Composant `ClientPage`.

- En-tête : avatar (logo ou initiales sur sa couleur), nom, badge « Archivé », nombre de projets, interrupteur « Favori » (client actif), bouton « Nouveau projet » (client actif), menu « … » (archiver / restaurer, supprimer).
- Section « Projets » : liste encadrée de ses projets et sous-projets en retrait, actifs puis archivés, avec avatar, statut et badge « Archivé ». Chaque projet replie ses sous-projets ; les projets actifs se déplacent par leur poignée : en haut d’une ligne = avant, en bas = après, au milieu = dedans (en dernier), dans la limite de profondeur. État vide « Aucun projet pour ce client. ».
- Documents de facturation du client et de ses projets (et sous-projets) : voir [Facturation](../finances/accounting.md).
- Panneau des paramètres (« Paramètres du client »), deux onglets : « Facturation » (coordonnées, prestations, contacts : voir [Facturation](../finances/accounting.md)) et « Nom, couleur et icône » (formulaire du client).
- Client inconnu : page « Introuvable », « Ce client n’existe pas ou a été supprimé. ». Chargement : squelette.

## Page d’un projet

Route `/projects/:id`. Composant `ProjectPage`. L’onglet est dans l’adresse (`?tab=`). Projet inconnu : page « Introuvable », « Ce projet n’existe pas ou a été supprimé. ».

### En-tête

Avatar, libellé, badge « Archivé », fil d’Ariane (client ou « Sans client » en PRO, puis les projets parents, chacun cliquable), interrupteur « Favori », bouton « Nouveau sous-projet » (projet actif sous la profondeur maximale), menu « … » (archiver / restaurer, supprimer).

### Onglets

| Onglet          | Contenu                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Aperçu »      | statut, catégories, début, fin ; liste « Sous-projets » ; « Description » en Markdown (« Aucune description. ») ; tableau de bord du projet ([Tableaux de bord](../resources/dashboards.md)) |
| « Tâches »      | tâches du projet et de ses sous-projets ; création dans ce projet s’il est actif ; vide : « Aucune tâche dans ce projet. » ([Tâches](../activities/tasks.md))                                |
| « Routines »    | routines du projet et de ses sous-projets ([Routines](../activities/routines.md))                                                                                                            |
| « Achats »      | listes d’achats du projet et de ses sous-projets ([Achats](../supplies/shopping.md))                                                                                                         |
| « Fiches »      | fiches du projet ([Fiches](../supplies/sheets.md))                                                                                                                                           |
| « Temps »       | temps passé ([Temps](../activities/time.md))                                                                                                                                                 |
| « Facturation » | PRO seulement ([Facturation](../finances/accounting.md))                                                                                                                                     |
| « Mails »       | mails liés ([Mails](../resources/mail.md))                                                                                                                                                   |
| « Ressources »  | fichiers et liens du projet (maquettes, dépôts, cahiers des charges…) : ajout, renommage, note, ordre, suppression ; un PDF ou une image s’ouvre dans la visionneuse ([Fichiers](files.md))  |

Changer d’onglet efface la vue et la tâche ouverte de l’onglet précédent, et garde le panneau des paramètres tel quel.

### Paramètres du projet

Panneau « Paramètres du projet », une section à la fois :

- « Tâches » : réglages des tâches de l’espace ([Tâches](../activities/tasks.md)) ;
- « Jalons », « Sprints » ;
- « Contributeurs » : contributeurs rattachés au projet ([Personnes](../../business-rules/cross-cutting/people.md)) ;
- « GitHub » : liaison au tableau GitHub ([GitHub](github.md)) ;
- « Projet » : formulaire du projet.

Depuis l’onglet « Tâches », le panneau s’ouvre sur « Tâches », sinon sur « Jalons ». Les anciennes adresses `?tab=settings` ou `?tab=<section>` ouvrent le panneau sur la section.

## Formulaires

Ouverts dans le panneau latéral (création, « Modifier ») ou dans le panneau des paramètres de la page (sans « Annuler »).

### Client (« Nouveau client » / « Modifier le client »)

| Champ   | Détail                                      |
| ------- | ------------------------------------------- |
| « Nom » | requis, 250 caractères                      |
| Couleur | facultative (« Aucune »)                    |
| Icône   | image facultative (logo, affiché en entier) |

Un nouveau client : bouton « Créer le client », toast « Client créé. ». Un client existant (son panneau, l’onglet « Nom, couleur et icône » de sa page) s’enregistre champ par champ : le nom en le quittant, la couleur dès qu’elle est choisie dans le nuancier (tapée : en la quittant), l’icône dès qu’elle est choisie ou retirée ; « Enregistrement… » / « Enregistré » en haut, sans bouton ; un client archivé est en lecture seule.

### Projet (« Nouveau projet », « Nouveau sous-projet », « Modifier le projet »)

| Champ              | Détail                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| « Libellé »        | requis, 250 caractères                                                                                                               |
| « Projet parent »  | facultatif (« Aucun (projet racine) ») ; propose les projets actifs hors de son propre sous-arbre et laissant la place à ses niveaux |
| « Client »         | PRO seulement, facultatif (« Sans client ») ; désactivé et « Hérité du projet parent. » quand un parent est choisi                   |
| « Statut »         | facultatif (« Aucun »), avec création à la volée                                                                                     |
| Couleur            | facultative                                                                                                                          |
| « Catégories »     | plusieurs, avec création à la volée                                                                                                  |
| « Dates »          | période en un seul champ, chaque bout facultatif (« Dès le début » / « Jusqu’à la fin ») ; la fin doit suivre le début              |
| « Description »    | Markdown, 65 536 caractères                                                                                                          |
| Icône              | image facultative                                                                                                                    |

Défauts à la création : le client ou le parent d’où l’action est lancée. Un nouveau projet : bouton « Créer le projet », toast « Projet créé. ». Un projet existant (son panneau, l’onglet « Projet » de ses paramètres) s’enregistre champ par champ : chaque champ dès qu’il change (libellé et description en les quittant ; la couleur dès qu’elle est choisie dans le nuancier, tapée en la quittant ; seuls les champs changés sont envoyés : l’icône n’est pas renvoyée) ; « Enregistrement… » / « Enregistré » en haut, sans bouton ; un projet archivé est en lecture seule.

## Actions et confirmations

- **Favori** : toast « « X » ajouté aux favoris. » / « retiré des favoris. » avec « Annuler ».
- **Archiver / restaurer** : avec toast d’annulation (règle commune, voir [Archivage](../../business-rules/cross-cutting/archiving.md)). Un élément archivé est en lecture seule : ni « Modifier », ni favori, ni ajout de projet.
- **Supprimer un client** (fenêtre « Supprimer le client ») : risque « Le client « X » sera supprimé définitivement. Pour le retirer de la liste sans perdre ses données, archivez-le plutôt. » ; s’il a des projets, choix « Que faire de ses N projets ? » : les supprimer (alors « Leurs tâches ne sont pas supprimées : elles sortent des projets, sans numéro, jalon, sprints ni lien GitHub. ») ou « Les conserver, sans client » (par défaut). Toast « Client « X » supprimé. ».
- **Supprimer un projet** (« Supprimer le projet ») : « Le projet « X » [et ses N sous-projets] sera supprimé / seront supprimés définitivement. Ses tâches ne sont pas supprimées : elles sortent du projet et perdent leur numéro, leur jalon, leurs sprints, leur lien GitHub et leurs liens avec les tâches restées dans un projet. Pour le retirer… archivez-le plutôt. ». Toast « Projet « X » supprimé. ».
- Après la suppression de l’élément affiché, retour à l’accueil.

## Page « Paramètres »

Route `/settings`, onglet dans l’adresse (`?tab=`). Contenu de chaque section : voir aussi [Paramètres](settings.md).

| Onglet                                                            | Contenu                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Projets »                                                       | « Statuts de projet » (« Un projet a au plus un statut. L’ordre est celui des listes de sélection. ») et « Catégories de projet » (« Un projet peut avoir plusieurs catégories. ») : libellé, couleur, image, ordre, archivage, suppression, avec le nombre de projets qui les utilisent |
| « Équipe et contributeurs » (« Foyer et contributeurs » en PERSO) | équipe, relations, contributeurs ([Personnes](../../business-rules/cross-cutting/people.md))                                                                                                                                                                                             |
| « Lieux »                                                         | lieux et zones ([Lieux](geo.md))                                                                                                                                                                                                                                                         |
| « GitHub »                                                        | connexion et logins ([GitHub](github.md))                                                                                                                                                                                                                                                |
| « Espaces »                                                       | gestion des espaces ([Espaces](workspaces.md))                                                                                                                                                                                                                                           |

Anciennes adresses redirigées : `?tab=tracking` et `?tab=company` vers les paramètres de la facturation (accueil en PERSO), `?tab=calendar` vers ceux de l’agenda, `?tab=mail` vers ceux des mails, `?tab=tasks` vers ceux des tâches.
