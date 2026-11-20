# Tâches

Ce que l’utilisateur peut faire avec les tâches : la page « Tâches », l’onglet « Tâches » d’un projet, le panneau latéral d’une tâche, les jalons, les sprints, les contributeurs d’un projet et les paramètres des tâches. Sources : `apps/web/src/features/tasks/**`, avec `apps/web/src/features/projects/pages/ProjectPage.tsx` et `apps/web/src/app/layout/**` pour leur place dans l’app.

Règles appliquées par l’API : [Règles métier — Tâches](../../business-rules/activities/tasks.md). Code : [Code web — Tâches](../../web/features/activities/tasks.md). Voir aussi : [Temps passé](time.md), [Commentaires](../cross-cutting/comments.md), [Projets](../cross-cutting/projects.md), [Alarmes](alarms.md), [Achats](../supplies/shopping.md), [Fiches](../supplies/sheets.md), [Agenda](calendar.md), [GitHub](../cross-cutting/github.md), [Tableaux de bord](../resources/dashboards.md), [Accueil](../cross-cutting/home.md).

## Où se trouvent les tâches

| Endroit                                    | Adresse                                                                                                                      | Contenu                                                                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Page « Tâches »                            | `/tasks` (`PAGES.tasks`)                                                                                                     | Toutes les tâches, de tous les projets et sans projet, avec leurs propres vues enregistrées.                                                   |
| Onglet « Tâches » d’un projet              | `/projects/:id?tab=tasks`                                                                                                    | Les tâches du projet et de ses sous-projets, avec les vues du projet.                                                                          |
| Panneau d’une tâche                        | n’importe quelle page + `?task=<id>`                                                                                         | Le détail de la tâche, par-dessus la page courante (`taskPath` ouvre l’onglet « Tâches » du projet, ou « Tâches » pour une tâche sans projet). |
| Paramètres des tâches                      | bouton des paramètres de la page « Tâches » (titre « Paramètres des tâches »), ou paramètres d’un projet › onglet « Tâches » | Colonnes des nouvelles vues, statuts, priorités, types, étiquettes.                                                                            |
| Jalons, sprints, contributeurs d’un projet | paramètres d’un projet › onglets « Jalons », « Sprints », « Contributeurs »                                                  | Gestion par projet.                                                                                                                            |
| Menu « Ajouter » de l’en-tête              | partout                                                                                                                      | « Tâche » ouvre le formulaire de nouvelle tâche (projet courant présélectionné sur une page de projet).                                        |

Ailleurs : les tâches « en cours » et « Mes tâches » de l’[Accueil](../cross-cutting/home.md), les tâches datées dans l’[Agenda](calendar.md), les graphiques de tâches des [Tableaux de bord](../resources/dashboards.md).

## Le tableau des tâches

Le même tableau (`TaskBoard`) sert à la page et à l’onglet d’un projet. C’est le tableau commun de l’app (recherche, filtres, tris, groupes, colonnes, export, sélection) : voir [Tableaux](../../web/components/data-table.md).

### Vues

- Onglets de vues enregistrées. À la première ouverture, trois vues sont créées :
  - « En cours » : tâches ouvertes ;
  - « Mes tâches » : tâches ouvertes assignées à « Moi » ;
  - « Toutes ».
- Chaque vue garde sa recherche, ses filtres, tris, groupes, colonnes et options ; renommer, dupliquer, supprimer, réordonner, choisir la vue par défaut (voir [Tableaux](../../web/components/data-table.md)).
- Les vues de la page et celles de chaque projet sont distinctes.
- Une nouvelle vue part des colonnes choisies pour l’espace (« Colonnes des nouvelles vues »).

### Barre

- Recherche : « Rechercher (libellé, numéro, description) ».
- Bouton « Nouvelle tâche » (visible s’il existe au moins un projet non archivé).
- Sans tri, l’ordre est l’ordre manuel : « Sans tri : l’ordre choisi à la main (glissez les tâches), sous-tâches sous leur parent. ».
- Options d’affichage :
  - interrupteur « Afficher les évènements » : liste aussi les évènements de l’agenda d’une période ;
  - « Période des évènements » : « Cette semaine », « Semaine prochaine », « Ce mois-ci », « Mois prochain », « 7 prochains jours », « 30 prochains jours » (défaut), « 90 prochains jours », « 30 derniers jours » (les quatre premiers libellés viennent de `DATE_PERIOD_LABELS`) ; la période réelle s’affiche « Du … au … » ;
  - « Afficher les archivées » (tâches archivées).

### Colonnes

| Colonne                                        | Contenu, édition en place                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Libellé » (toujours visible)                 | Icône d’état (ouverte vert, fermée violet, bloquée cadenas rouge), icône GitHub (« Synchronisée avec l’issue GitHub #n » ou « Synchronisée avec un brouillon GitHub »), icône d’alarmes actives, numéro `#12` (lien vers le panneau), libellé (double-clic pour renommer), avancement des sous-tâches « 2/5 ». |
| « Projet »                                     | Change de projet en place (transfert ; confirmation si la tâche quitte son arborescence).                                                                                                                                                                                                                                                                                                          |
| « Statut », « Priorité », « Type »             | Pastille de couleur ; clic : liste des pastilles ; re-choisir la valeur actuelle la vide.                                                                                                                                                                                                                                                                                                          |
| « Assignés »                                   | Contributeurs du projet (avec avatar).                                                                                                                                                                                                                                                                                                                                                             |
| « Bénéficiaires »                              | Contributeurs et relations.                                                                                                                                                                                                                                                                                                                                                                        |
| « Étiquettes »                                 | Plusieurs.                                                                                                                                                                                                                                                                                                                                                                                         |
| « Effort »                                     | Nombre (validé à la sortie du champ ou Entrée).                                                                                                                                                                                                                                                                                                                                                    |
| « Temps passé »                                | Lien vers les temps de la tâche (`/time?task=<id>`). Total en pied.                                                                                                                                                                                                                                                                                                                                |
| « Début », « Fin », « Date min », « Date max » | Sélecteurs de date ; la « Date max » s’affiche en couleur de retard quand la tâche est en retard.                                                                                                                                                                                                                                                                                                  |
| « Créneaux »                                     | Condition de créneaux en mots (« N’importe quand » sans condition), modifiée dans une bulle (même éditeur que les routines).                                                                                                                                                                                                                                                                                                 |
| « Lieu »                                         | Adresse ou lieu enregistré choisi dans une bulle (comme les routines : enregistré au choix d’une adresse proposée, quand le texte est vidé, ou pour un texte libre en quittant la cellule) ; lieu des évènements affiché en lecture.                                                                                                                                                                                                                                     |
| « Chrono »                                     | Démarre le chrono sur la tâche, ou l’arrête s’il tourne sur elle.                                                                                                                                                                                                                                                                                                                                  |
| « Tâche parente »                              | Choix parmi les tâches de l’arborescence (pas elle-même ni ses sous-tâches).                                                                                                                                                                                                                                                                                                                       |
| « Sous-tâches »                                | Liste des sous-tâches et bouton « Ajouter une sous-tâche ».                                                                                                                                                                                                                                                                                                                                        |
| « Avancement »                                 | Barre des sous-tâches fermées.                                                                                                                                                                                                                                                                                                                                                                     |
| « Jalon »                                      | Jalons de l’arborescence du projet.                                                                                                                                                                                                                                                                                                                                                                |
| « Sprint »                                     | Sprints de l’arborescence (plusieurs).                                                                                                                                                                                                                                                                                                                                                             |
| « Dépend de »                                  | Tâches qui la bloquent (icône fermée / ouverte).                                                                                                                                                                                                                                                                                                                                                   |
| « Bloque »                                     | Tâches qu’elle bloque.                                                                                                                                                                                                                                                                                                                                                                             |
| « Relative à »                                 | Tâches liées.                                                                                                                                                                                                                                                                                                                                                                                      |
| « Commentaires »                               | Nombre (la description compte pour un).                                                                                                                                                                                                                                                                                                                                                            |
| « Alarmes »                                    | Nombre d’alarmes actives et bouton « Nouvelle alarme ».                                                                                                                                                                                                                                                                                                                                            |
| « Achats »                                     | Listes d’achats de la tâche, menu « Nouvelle liste » / « Rattacher une liste ».                                                                                                                                                                                                                                                                                                                    |
| « Créée le », « Modifiée le »                  | Dates.                                                                                                                                                                                                                                                                                                                                                                                             |

Colonnes masquées par défaut (sauf choix de l’espace) : « Lieu », « Bloque », « Relative à », « Jalon », « Créée le », « Modifiée le ». Colonnes supplémentaires masquées, surtout utiles aux filtres : « Numéro », « Description », « Fermée », « En retard », « Bloquée », « A des sous-tâches », « Archivée », « Faisable maintenant », « A des achats », « A des alarmes », « A des commentaires », « Catégorie de statut ».

### Filtres

Chaque colonne filtrable a son filtre (voir [Filtres](../../web/components/filters.md)). Particularités :

- « Projet » : un projet garde ses sous-projets.
- « Assignés » : « Moi » en plus des contributeurs.
- « Sprint » : sprints relatifs « Sprint en cours », « Sprint précédent », « Sprint suivant », « Sprints passés », « Sprints à venir » (par arborescence de projets).
- « Tâche parente » : une tâche garde ses sous-tâches à tous les niveaux.
- « Faisable maintenant » : tâches ouvertes que leur condition de créneaux autorise maintenant (sans condition : toujours, dans les deux types d’espace) et dont les assignés ne sont pas pris par un évènement (rafraîchi chaque minute, chargé seulement si le filtre l’utilise).
- « Catégorie de statut » : « À faire », « En cours », « Terminé », « Annulé ».
- Les valeurs archivées gardent leur libellé et ne sont proposées que si elles sont déjà dans le filtre.

### Groupes

Grouper par : état, projet (en arbre), statut, priorité, type, assignés, bénéficiaires, étiquettes, tâche parente, jalon, sprint, « Dépend de », « Bloque », « Relative à », et par mois de « Début », « Fin », « Date min », « Date max ». Non groupables : créneaux, chrono, sous-tâches, avancement, alarmes, achats, commentaires.

### Modifier

- Chaque cellule se modifie en place (pas sur une tâche archivée : lecture seule).
- **Sélection de cellules** ou **tâches cochées** : un changement dans une cellule s’applique à toutes ; toast « Modification appliquée à 3 tâches. » avec « Annuler ».
- Colonnes modifiables en masse : libellé, projet, bénéficiaires, créneaux, parent, « Dépend de », « Bloque », « Relative à », achats, statut, priorité, type, assignés, étiquettes, effort, dates, jalon, sprint.
- En masse, assignés, étiquettes et sprints ajoutés sont ajoutés à chaque tâche, ceux retirés sont retirés.

### Glisser-déposer

- Déplacer une tâche à un autre endroit (ordre manuel) ou sous un autre parent.
- Vers un autre groupe : la valeur du groupe remplace celle de la tâche (statut, priorité, type, jalon, un assigné, une étiquette ou un sprint).
- Une tâche archivée ne se déplace pas.

### Ajouter

- Ligne « Ajouter une tâche » en bas du tableau et de chaque groupe : taper un libellé puis Entrée. La tâche prend les valeurs du groupe (statut, priorité, type, assigné, étiquette, jalon, sprint, parent, projet, bénéficiaire ; groupe « fermée » : créée fermée ; pas de valeur pour un groupe « aucun » ni pour une valeur archivée) et le premier statut « À faire ».
- Sans projet à qui la rattacher (page « Tâches » hors groupe de projet), la ligne ouvre le formulaire.
- Message vide : « Aucune tâche. » (page) / « Aucune tâche dans ce projet. » ; sans projet actif : « Créez d’abord un projet : chaque tâche appartient à un projet. ».

### Menu d’une ligne

- « Ouvrir » (panneau latéral).
- « Ajouter une sous-tâche » (pas sur une tâche archivée).
- « Cloner », « Transférer », « Archiver », « Supprimer » ; sur une tâche archivée : « Restaurer », « Supprimer ».

### Actions sur les tâches cochées

Barre de sélection (« 3 tâches sélectionnées ») : « Fermer » / « Rouvrir », « Cloner », « Transférer », « Archiver » / « Restaurer », « Supprimer ». Les tâches archivées ne sont prises que par l’archivage et la suppression. Chaque action est annulable depuis son toast quand c’est possible.

### Évènements dans le tableau

Avec « Afficher les évènements », les évènements de la période (du projet et de ses sous-projets sur un projet) s’ajoutent comme lignes : titre (et lieu, repris dans la colonne « Lieu »), projet, personnes, bénéficiaires, état (« À venir », « En cours », « Passée », « Annulé », « Reporté »), temps passé, début et fin, commentaires. Ils ne se glissent pas et ne sont pas sélectionnables comme des tâches ; leurs personnes, bénéficiaires et dates se modifient dans leurs cellules (sur la série pour un évènement récurrent). Voir [Agenda](calendar.md).

## Formulaire « Nouvelle tâche »

Ouvert dans le panneau latéral (titre « Nouvelle tâche » ou « Nouvelle sous-tâche »), depuis « Nouvelle tâche », le menu « Ajouter », « Ajouter une sous-tâche » ou la ligne d’ajout.

| Champ                                                      | Détail                                                                                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| « Libellé »                                                | Requis.                                                                                                                                                                        |
| « Projet »                                                 | Facultatif : « Facultatif : sans projet, la tâche n’a ni numéro, ni jalon, ni sprint. ». Changer de projet retire le parent, le jalon et les sprints d’une autre arborescence. |
| « Tâche parente »                                          | Tâches de l’arborescence du projet choisi (ou sans projet).                                                                                                                    |
| « Jalon »                                                  | Désactivé sans projet.                                                                                                                                                         |
| « Sprints »                                                | Désactivé sans projet.                                                                                                                                                         |
| « Description »                                            | Markdown, `#` et `@` proposent tâches et contributeurs ; Ctrl/Cmd + Entrée envoie.                                                                                             |
| « Rappels »                                                | « À HH:MM » seulement, comme dans le panneau ; désactivé sans « Date max ». |
| « Lieu »                                                   | Facultatif, le champ des évènements et des routines : texte libre (salle, visio…), lieu enregistré ou adresse proposée, montrée sur une carte où un clic la déplace. Ni trajet ni heure.|
| « Liens »                                                  | Comme ceux des évènements : adresse (http/https) + libellé facultatif, « Ajouter un lien », « Retirer » ; 20 au plus.                                                          |
| « Statut »                                                 | Premier statut « À faire » non archivé par défaut ; un statut, une priorité ou un type tapé et inexistant peut être créé.                                                      |
| « Priorité », « Type »                                     | Facultatifs.                                                                                                                                                                   |
| « Assignés »                                               | Contributeurs du projet.                                                                                                                                                       |
| « Étiquettes »                                             | Une étiquette tapée peut être créée.                                                                                                                                           |
| « Bénéficiaires »                                          | Contributeurs et relations.                                                                                                                                                    |
| « Effort », « Début », « Fin », « Date min », « Date max » | Facultatifs ; la fin ne précède pas le début, la « Date max » ne précède pas la « Date min ».                                                                                  |
| « Créneaux de l’agenda »                                     | Condition facultative, comme une routine : « Créneau » (« sur l’un des créneaux », « hors des créneaux »), « Type de créneau » (« sur l’un des types », « hors des types » : tous les créneaux de ces types, même ajoutés ensuite ; un type qui n’a encore aucun créneau ne permet aucun moment : la tâche ou la routine n’est jamais faisable tant qu’un créneau de ce type n’existe pas) et « Temps libre » (« hors de tous les créneaux », « hors de tous les créneaux sauf » certains de l’espace), créneaux et types de cet espace ou de vos autres espaces, en groupes ET / OU ; « Aucune condition : à n’importe quelle heure. » ; texte « La tâche n’est faisable que sur les heures que la condition permet. ».                                                                                                                                          |

Bouton « Créer la tâche ». Toast « Tâche #12 créée. » (« Tâche « Libellé » créée. » sans projet). La tâche créée s’ouvre dans le panneau.

## Panneau d’une tâche

Ouvert par `?task=<id>` par-dessus la page courante (titre « Projet · Tâche #12 »). Introuvable : « Cette tâche » introuvable (`DetailNotFound`).

En-tête :

- libellé et numéro, badge GitHub (« GitHub #12 », lien vers l’issue, ou « Brouillon GitHub »), badge « Archivée » ;
- boutons « Fermer la tâche » / « Rouvrir » et « Renommer » (formulaire « Renommer la tâche ») ;
- menu : « Cloner », « Transférer », « Archiver » / « Restaurer », « Supprimer » ;
- icône d’état et lien vers le projet (ou « Sans projet »).

Colonne principale :

- « Description » : affichée en markdown (cases à cocher cochables en place), crayon « Modifier la description » pour l’éditer.
- « Liens » : ouverts dans un nouvel onglet (« Aucun lien. » sinon) ; crayon « Modifier les liens » : le champ des liens des évènements, « Enregistrer » / « Annuler ».
- « Sous-tâches » : « 2/5 », barre d’avancement, liste, « Ajouter une sous-tâche ».
- « Commentaires » : le fil de commentaires (voir [Commentaires](../cross-cutting/comments.md)).

Colonne de propriétés (chaque champ enregistré dès qu’il change) :

- « Projet » (changement = transfert ; confirmation « Changer de projet » si la tâche quitte son arborescence et a des liens : elle prend le numéro suivant du projet, ou perd son numéro et son lien GitHub hors projet) ;
- « Statut », « Priorité », « Type », « Assignés », « Étiquettes », « Bénéficiaires », « Effort » ;
- « Temps passé » et bouton « Démarrer le chrono » (ou commandes du chrono s’il tourne sur la tâche) ;
- « Début », « Fin », « Date min » (« Avant, la tâche n’est pas à faire. »), « Date max » (« Au-delà, la tâche ouverte est en retard. », suivi de « En retard. » en rouge si c’est le cas) ;
- « Tâche parente », « Jalon », « Sprints », créneaux ;
- « Rappels » : « À HH:MM » seulement (pas d’« avant » : une tâche n’a pas d’heures), toutes les demi-heures ou une heure tapée (« 8:15 », « 8h15 », « 8 ») ; une saisie qui n’est pas une heure affiche « Heure attendue (HH:MM). » sous le champ, 10 au plus ; aide « Chaque jour de la « Date min » à la « Date max », à ces heures. » (« Le jour de la « Date max », à ces heures. » sans « Date min ») ; désactivé sans « Date max » (« Donnez-lui une « Date max » pour recevoir des rappels. ») ;
- « Lieu » : enregistré au choix d’une adresse proposée ou d’un clic sur la carte, quand le texte est vidé, ou à la sortie du champ pour un texte libre ;
- « Bloque », « Dépend de », « Relative à » : listes avec « Retirer » et « Ajouter une tâche » ;
- alarmes de la tâche ([Alarmes](alarms.md)), listes d’achats ([Achats](../supplies/shopping.md)), fiches ([Fiches](../supplies/sheets.md)).

Une tâche archivée : tous les champs désactivés, pas de bouton, commentaires en lecture seule ; « Restaurer » dans le menu.

## Fermer, cloner, transférer, archiver, supprimer

- **Fermer / Rouvrir** : toast « 2 tâches fermées. » / « rouvertes. », annulable. Une tâche fermée est barrée de violet, ne bloque plus, n’est plus en retard.
- **Cloner** (fenêtre « Cloner la tâche » / « Cloner les tâches ») : « tous les champs, les assignés et les liens sont copiés ; les commentaires ne le sont pas » (le lieu, les liens (URL) et les rappels compris) (un ancien lien hors de l’arborescence de projets de la tâche n’est pas copié) ; les sous-tâches sont clonées sous le clone. Toast « Tâche #12 clonée en #13. » ; un clone unique s’ouvre.
- **Transférer** (panneau « Transférer la tâche » / « Transférer les tâches ») : « Projet de destination » ou case « Sans projet » (perte du numéro, du jalon, des sprints et du lien GitHub). Avertissement si le projet est dans une autre arborescence. Toast « Tâche #12 transférée. » ; annulable s’il n’a retiré aucun lien, sinon il indique « 2 liens retirés. ».
- **Archiver / Restaurer** : en cascade sur les sous-tâches ; annulable.
- **Supprimer** (fenêtre de confirmation destructive) : « La tâche « #12 Libellé » et ses commentaires seront supprimés définitivement. Pour la retirer des listes sans perdre ses données, archivez-la plutôt. », suivi s'il y en a de « 2 temps sans projet, qui ne portent sur rien d’autre, seront aussi supprimés (les temps facturés sont gardés). » (selon le choix pour les sous-tâches). Avec des sous-tâches : choix « Les conserver (elles remontent d’un niveau) » ou les supprimer. Le panneau de la tâche supprimée se ferme.

## Paramètres des tâches

Dans la barre latérale des paramètres (page « Tâches », ou onglet « Tâches » des paramètres d’un projet ; ce sont les paramètres de l’espace) :

- « Colonnes des nouvelles vues » : colonnes affichées et leur ordre (glisser-déposer) pour les vues créées ensuite ; « Colonnes de l’app » rétablit celles de l’app. Les vues existantes gardent les leurs.
- « Statuts de tâche » : libellé, couleur, image, « Catégorie » (« À faire », « En cours », « Terminé », « Annulé ») ; texte : « La catégorie donne son sens au statut quel que soit son libellé (filtres, tâches « en cours » de l’accueil). C’est l’état ouvert / fermé de la tâche, et non son statut, qui dit si elle est terminée. ».
- « Priorités » : « L’ordre est celui des listes de sélection et du tri par priorité. ».
- « Types de tâche » : « Bug, fonctionnalité, amélioration… ».
- « Étiquettes » : « Une tâche peut en avoir plusieurs. Synchronisées avec les labels GitHub. ».

Chaque liste : ajout, modification, réordonnancement, archivage, suppression avec le nombre de tâches qui l’utilisent (voir [Paramètres](../cross-cutting/settings.md)).

## Jalons d’un projet

Paramètres d’un projet › « Jalons » :

- « Les jalons sont utilisables par les tâches du projet et de ses sous-projets. ».
- Ordre au choix « Échéance », « Libellé », « Manuel » (retenu dans ce navigateur) ; en ordre manuel, les cartes se glissent par leur poignée.
- Carte : titre, badge « Archivé », badge rouge « 3 tâches non terminées » si l’échéance est passée, « Échéance : … » ou « Sans échéance », avancement des tâches, description (cases cochables).
- Menu : « Modifier » (pas archivé ni projet archivé), « Archiver » / « Restaurer », « Supprimer » (« Le jalon « V2 » sera supprimé définitivement et retiré des 3 tâches qui l’utilisent. Les tâches ne sont pas supprimées. »).
- « Nouveau jalon » (panneau) : « Libellé » requis, « Échéance », « Description ». Toasts « Jalon créé. », « Jalon modifié. », « Jalon supprimé. ».
- « Afficher les archivés ». Vide : « Aucun jalon pour ce projet. ».

## Sprints d’un projet

Paramètres d’un projet › « Sprints » :

- « Les sprints sont utilisables par les tâches du projet et de ses sous-projets. ».
- Carte : titre, état (« À venir », « En cours », « Passée », `PERIOD_STATES`), badge rouge des tâches non terminées si la fin est passée, « Du … au … », avancement en tâches et en effort (« · effort 3/8 », effort des tâches sans sous-tâches), objectif.
- « Nouveau sprint » : propose « Sprint n », commençant le lendemain du dernier sprint (ou aujourd’hui si le dernier est passé), pour la même durée (14 jours sans sprint précédent). Champs : « Libellé », « Début », « Fin » (requis), « Objectif ».
- Menu identique aux jalons. Vide : « Aucun sprint pour ce projet. ».

## Contributeurs

- Paramètres d’un projet › « Contributeurs » : les contributeurs du projet (rattachés directement, hérités d’un projet parent avec le badge « Via … », « Moi » avec « Tous les projets »), le nombre de leurs tâches dans le projet ; « Ajouter un contributeur existant », « Nouveau contributeur », « Retirer du projet (ses tâches restent assignées) ». Seuls ces contributeurs sont proposés comme assignés des tâches du projet.
- « Paramètres » (`/settings`) › onglet « Équipe et contributeurs » (PRO) / « Foyer et contributeurs » (PERSO), section « Contributeurs » (`ContributorsManager`) : tous les contributeurs, badges « Moi », « Membre », « Relation » (PRO) / « Proche » (PERSO), « Archivé » ; « Modifier », « Archiver », « Supprimer » (pas pour « Moi »).
- Formulaire : « Nom », « Identifiant de mention » (proposé depuis le nom, `@identifiant`), image, « Projets » (hérités par les sous-projets ; pas pour « Moi »).

Règles : [Personnes](../../business-rules/cross-cutting/people.md).

## États particuliers

- **Archivée** : lecture seule partout, cachée sauf « Afficher les archivées ».
- **Bloquée** : cadenas rouge, « Bloquée : dépend d’au moins une tâche encore ouverte ».
- **En retard** : « Date max » en couleur de retard (tableau, panneau, accueil, agenda).
- **Sans projet** : pas de numéro (nommée « « Libellé » » dans les messages), ni jalon, ni sprint, ni GitHub.

## Espace PRO / PERSO

Même fonctionnement. Le défaut des créneaux d’une tâche suit l’espace (heures de travail en PRO). Les badges des contributeurs (membre de l’équipe ou du foyer, relation) suivent le vocabulaire de l’espace.
