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
- Chaque vue garde sa recherche, ses filtres, tris, groupes, colonnes et options ; renommer, dupliquer, supprimer, réordonner, choisir la vue par défaut (voir [Tableaux](../../web/components/data-table.md)). La vue par défaut de la page (sinon son premier onglet) est aussi celle de la carte « Tâches » de l’accueil (voir [Accueil](../cross-cutting/home.md#cartes)).
- Les vues de la page et celles de chaque projet sont distinctes.
- Une nouvelle vue part des colonnes choisies pour l’espace (« Colonnes des nouvelles vues »).

### Barre

- Recherche : « Rechercher (libellé, numéro, description) ».
- Bouton « Nouvelle tâche » (toujours visible : une tâche peut n’appartenir à aucun projet).
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
| « Début », « Fin », « Ouverture », « Échéance » | Sélecteurs de date ; l’échéance s’affiche en couleur de retard quand la tâche est en retard. Sans « Ouverture » ou « Échéance » à elle, une tâche dans un seul sprint montre celle du sprint, grisée : « 12 nov. 2026 (sprint) » ; une date saisie l’emporte.                                                                                                                                                                                                                                                                                                  |
| « Créneaux »                                     | Condition de créneaux en mots (« N’importe quand » sans condition), modifiée dans une bulle (même éditeur que les routines).                                                                                                                                                                                                                                                                                                 |
| « Horaires »                                     | Horaires suivis en mots, un cas après l’autre séparés par « ; » (« Toutes les semaines du lundi au vendredi · 09:00–12:00, 14:00–17:00 ») ; « N’importe quand » sans horaires ; hérités grisés « Hérité de … ». Un clic ouvre la fenêtre « Horaires de « … » » (l’éditeur du panneau), enregistrée sur « Appliquer » ; sur une sélection, « S’applique à 3 tâches : chacune prend ces horaires entiers. ». |
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

Colonnes masquées par défaut (sauf choix de l’espace) : « Horaires », « Lieu », « Bloque », « Relative à », « Jalon », « Créée le », « Modifiée le ». Colonnes supplémentaires masquées, surtout utiles aux filtres : « Numéro », « Description », « Fermée », « En retard », « Bloquée », « A des sous-tâches », « Archivée », « Faisable maintenant », « A des achats », « A des alarmes », « A des commentaires », « Catégorie de statut ». Les colonnes oui / non (« Fermée » … « A des commentaires ») montrent une coche verte ou une croix rouge (« Oui » / « Non » à l’export) ; une ligne d’évènement y reste vide (et compte comme « non » pour leurs filtres).

### Filtres

Chaque colonne filtrable a son filtre (voir [Filtres](../../web/components/filters.md)). Particularités :

- « Projet » : un projet garde ses sous-projets.
- « Assignés » : « Moi » en plus des contributeurs.
- « Sprint » : sprints relatifs « Sprint en cours », « Sprint précédent », « Sprint suivant », « Sprints passés », « Sprints à venir » (par arborescence de projets).
- « Tâche parente » : une tâche garde ses sous-tâches à tous les niveaux.
- « Faisable maintenant » : tâches ouvertes dont l’« Ouverture » (la leur, sinon celle de leur parent, de leur jalon, de leur projet ou de leur premier sprint) est passée ou aujourd’hui, que leur condition de créneaux et leurs horaires autorisent tous deux maintenant (sans l’un ni l’autre : toujours, dans les deux types d’espace) et dont les assignés ne sont pas pris par un évènement (rafraîchi chaque minute, calculé seulement quand la vue s’en sert : son filtre, son tri, son regroupement ou la colonne « Faisable maintenant » affichée ; toujours pour la carte « Tâches » de l’accueil, qui sépare « Maintenant » et « Plus tard »). Une tâche fermée n’est ni faisable maintenant ni plus tard : sa cellule est vide, ni « oui » ni « non » ne la gardent, elle est vide à l’export.
- « Horaires » : filtre de texte sur les horaires en mots (contient, « est vide » / « n’est pas vide »), tri sur ce texte (sans horaires en dernier) ; exportés en mots.
- « Catégorie de statut » : « À faire », « En cours », « Terminé », « Annulé ».
- Les valeurs archivées gardent leur libellé et ne sont proposées que si elles sont déjà dans le filtre.

### Groupes

Grouper par : état, projet (en arbre), statut, priorité, type, assignés, bénéficiaires, étiquettes, tâche parente, jalon, sprint, « Dépend de », « Bloque », « Relative à », et par mois de « Début », « Fin », « Ouverture », « Échéance ». Non groupables : créneaux, horaires, chrono, sous-tâches, avancement, alarmes, achats, commentaires. Les colonnes oui / non se groupent en « Oui » puis « Non », sauf « Faisable maintenant » : « Maintenant » puis « Plus tard » (les tâches fermées dans « Sans valeur »).

### Modifier

- Chaque cellule se modifie en place (pas sur une tâche archivée : lecture seule).
- **Sélection de cellules** ou **tâches cochées** : un changement dans une cellule s’applique à toutes ; toast « Modification appliquée à 3 tâches. » avec « Annuler ».
- Colonnes modifiables en masse : libellé, projet, bénéficiaires, créneaux, horaires, lieu, parent, « Dépend de », « Bloque », « Relative à », achats, statut, priorité, type, assignés, étiquettes, effort, dates, jalon, sprint.
- En masse, assignés, étiquettes et sprints ajoutés sont ajoutés à chaque tâche, ceux retirés sont retirés.

### Glisser-déposer

- Déplacer une tâche à un autre endroit (ordre manuel) ou sous un autre parent.
- Vers un autre groupe : la valeur du groupe remplace celle de la tâche (statut, priorité, type, jalon, un assigné, une étiquette ou un sprint).
- Une tâche archivée ne se déplace pas.

### Ajouter

- Ligne « Ajouter une tâche » en bas du tableau et de chaque groupe : taper un libellé puis Entrée. La tâche prend les valeurs du groupe (statut, priorité, type, assigné, étiquette, jalon, sprint, parent, projet, bénéficiaire ; groupe « fermée » : créée fermée ; pas de valeur pour un groupe « aucun » ni pour une valeur archivée) et le premier statut « À faire ».
- Sans projet à qui la rattacher (page « Tâches » hors groupe de projet), la ligne ouvre le formulaire.
- Message vide : « Aucune tâche. » (page) / « Aucune tâche dans ce projet. » ; « Nouvelle tâche » reste en haut à droite et la ligne « Ajouter une tâche » en bas, avec ou sans projet dans l’espace (une tâche peut n’appartenir à aucun projet).

### Menu d’une ligne

- « Ouvrir » (panneau latéral).
- « Ajouter une sous-tâche » (pas sur une tâche archivée).
- « Dupliquer », « Transférer », « Héritage… » (une sous-tâche), « Transformer en routine », « Archiver », « Supprimer » ; puis, avec des temps morts, la section « Temps morts » : « Lancer « Lave-linge (1 h 30) » » ; avec des minuteurs enregistrés, la section « Minuteurs » : « Lancer « Œufs durs (9 min) » » (aussitôt) ; sur une tâche archivée : « Restaurer », « Supprimer ». Le même menu est celui du panneau d’une tâche (« … »).

### Transformer en routine

« Transformer en routine » (menu d’une ligne et du panneau) remplace la tâche par une routine. Désactivé sur une tâche qui a des sous-tâches (infobulle « Une tâche qui a des sous-tâches ne devient pas une routine. »).

- Confirmation destructive « Transformer en routine » : « La tâche est remplacée par une routine répétée chaque jour (sa répétition se choisit ensuite dans son panneau) : son échéance devient celle de la première occurrence, qui reçoit ses commentaires et sa liste à cocher ; ses temps et ses fiches la suivent. Les liens écrits vers la tâche dans les textes ne mèneront plus nulle part. », puis « Elle perd : » et la liste de ce qui est perdu, avec les nombres (« son numéro », « son statut », « sa priorité », « son type », « ses 3 étiquettes », « son jalon », « ses 2 sprints », « son lien GitHub (l’item est retiré du tableau) », « son effort », « ses dates de début et de fin », « ses 2 liens « Dépend de », « Bloque » ou « Relative à » avec d’autres tâches », « son lien avec sa liste d’achats », « son lien avec son alarme (gardées, sans tâche) », « son lien avec un évènement » (évènement récurrent), « ses horaires (une routine suit ses moments et sa condition de créneaux) », « son parent (elle passe au premier niveau) »), puis « Cette action est irréversible. ». Boutons « Transformer en routine » puis « Annuler ».
- Une fois fait : toast « Tâche transformée en routine : choisissez sa répétition. », le panneau encore ouvert sur la tâche se ferme (depuis sa ligne comme depuis son panneau) et celui de la nouvelle routine s’ouvre (répétition quotidienne par défaut, à changer dans « Quand »).
- Ce qui est gardé : libellé, description, projet, assignés, bénéficiaires, liens, lieu, condition de créneaux, rappels « À HH:MM » et « N jours avant », temps passés, fiches ; l’« Échéance » (la sienne, sinon celle de son sprint) devient le jour de la première occurrence (sans échéance : son « Ouverture », sinon aujourd’hui) et l’« Ouverture », si elle est avant, l’« Ouverture » de la routine (« N jours avant ») ; ses commentaires et sa liste à cocher vont sur la première occurrence ; un évènement non récurrent lié à la tâche est lié à la routine le jour de l’évènement. Une tâche fermée (annulée comprise) donne une routine dont la première occurrence est cochée (tous ses moments), pour qu’elle ne soit pas en retard ; une première occurrence à venir n’est pas cochée. Règles : [Tâches](../../business-rules/activities/tasks.md#transformer-en-routine).

### Actions sur les tâches cochées

Barre de sélection (« 3 tâches sélectionnées ») : « Fermer » / « Rouvrir », « Dupliquer », « Transférer », « Héritage… », « Archiver » / « Restaurer », « Supprimer ». Les tâches archivées ne sont prises que par l’archivage et la suppression. Chaque action est annulable depuis son toast quand c’est possible.

### Champs hérités

Une sous-tâche hérite de son parent le projet, les assignés, les bénéficiaires, la condition de créneaux, les horaires, l’« Ouverture », l’« Échéance », le lieu, la priorité et le jalon (règles : [Héritage](../../business-rules/activities/tasks.md#héritage)).

- Dans le tableau, la valeur héritée est grisée, en italique ; l’infobulle dit « Hérité de « #12 Libellé » ». Filtres, tris, groupes et export lisent cette valeur.
- Dans le panneau et le formulaire « Nouvelle sous-tâche » : la même valeur grisée, et sous le champ « Hérité de « #12 Libellé » » avec « Vider » ; un champ vidé dit « Vidé exprès » avec « Rétablir l’héritage » ; un champ propre offre « Rétablir l’héritage ». Choisir une valeur rend le champ propre.
- « Héritage… » (menu « … » d’une sous-tâche, barre de sélection) : panneau « Héritage », « 3 tâches : choisissez, champ par champ, de reprendre la valeur du parent ou de vider le champ exprès. Un élément sans parent n’hérite de rien. », pour chaque champ « Inchangé », « Rétablir l’héritage », « Vider » (pas « Vider » pour le projet), bouton « Appliquer ». Toast « Héritage changé pour 3 tâches. » avec « Annuler ». Désactivé sans sous-tâche dans la sélection.

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
| « Rappels »                                                | « À HH:MM » et « N jours avant, à HH:MM » seulement, comme dans le panneau ; désactivé sans échéance. |
| « Lieu »                                                   | Facultatif, le champ des évènements et des routines : texte libre (salle, visio…), lieu enregistré ou adresse proposée, montrée sur une carte où un clic la déplace. Ni trajet ni heure.|
| « Liens »                                                  | Comme ceux des évènements : adresse (http/https) + libellé facultatif, « Ajouter un lien », « Retirer » ; 20 au plus.                                                          |
| « Statut »                                                 | Premier statut « À faire » non archivé par défaut ; un statut, une priorité ou un type tapé et inexistant peut être créé.                                                      |
| « Priorité », « Type »                                     | Facultatifs.                                                                                                                                                                   |
| « Assignés »                                               | Contributeurs du projet.                                                                                                                                                       |
| « Étiquettes »                                             | Une étiquette tapée peut être créée.                                                                                                                                           |
| « Bénéficiaires »                                          | Contributeurs et relations.                                                                                                                                                    |
| « Effort », « Début », « Fin », « Ouverture », « Échéance » | Facultatifs ; la fin ne précède pas le début, l’échéance ne précède pas l’ouverture.                                                                                  |
| « Créneaux de l’agenda »                                     | Condition facultative, comme une routine : « Créneau » (éphémérides comprises, suivies de « (éphéméride) » ; le « Temps libre » les ignore ; anniversaires des personnes de l’espace, « Anniversaire de Paul (éphéméride) », et tous, « Anniversaires (éphéméride) » parmi les types) (« sur l’un des créneaux », « hors des créneaux »), « Type de créneau » (« sur l’un des types », « hors des types » : tous les créneaux de ces types, même ajoutés ensuite ; un type qui n’a encore aucun créneau ne permet aucun moment : la tâche ou la routine n’est jamais faisable tant qu’un créneau de ce type n’existe pas) et « Temps libre » (« hors de tous les créneaux », « hors de tous les créneaux sauf » certains de l’espace), créneaux et types de cet espace ou de vos autres espaces, en groupes ET / OU ; « Aucune condition : à n’importe quelle heure. » ; texte « La tâche n’est faisable que sur les heures que la condition permet. ».                                                                                                                                          |
| « Horaires »                                               | Facultatifs : « Facultatif : les jours et heures où la tâche est faisable (un cabinet joignable du lundi au vendredi, 9:00–12:00 et 14:00–17:00). Avec une condition de créneaux, quand les deux le permettent. » ; résumé (« N’importe quand » sans horaires), « Modifier » ouvre la fenêtre « Horaires » : l’éditeur des cas d’un créneau (« Une règle » ou « Plusieurs cas », jours, « Journée entière » ou tranches, « Ajouter des horaires »), « Retirer les horaires » ; un cas dont le rythme compte depuis un jour (tous les 2 jours, toutes les 3 semaines, un nombre d’occurrences…) sans période à lui montre « À partir du » obligatoire (« À choisir »), « Choisissez le jour à partir duquel compter. » sous lui tant qu’il est vide ; sans horaires, « Aucun horaire : la tâche est faisable à n’importe quelle heure. » et « Ajouter des horaires ». La première erreur s’affiche sous les cas (messages d’un créneau, « Des horaires se chevauchent. »…), « Appliquer » reste désactivé tant qu’il y en a une. Rien dans l’agenda. |

Bouton « Créer la tâche ». Toast « Tâche #12 créée. » (« Tâche « Libellé » créée. » sans projet). La tâche créée s’ouvre dans le panneau.

## Panneau d’une tâche

Ouvert par `?task=<id>` par-dessus la page courante (titre « Projet · Tâche #12 »). Introuvable : « Cette tâche » introuvable (`DetailNotFound`).

En-tête :

- libellé et numéro, badge GitHub (« GitHub #12 », lien vers l’issue, ou « Brouillon GitHub »), badge « Archivée » ;
- boutons « Fermer la tâche » / « Rouvrir » (toast « 1 tâche fermée. » / « 1 tâche rouverte. » avec « Annuler », comme la sélection et le menu) et « Renommer » (formulaire « Renommer la tâche ») ;
- menu : « Dupliquer », « Transférer », « Archiver » / « Restaurer », « Supprimer » ;
- icône d’état et lien vers le projet (ou « Sans projet »).

Colonne principale :

- « Description » : affichée en markdown (cases à cocher cochables en place), crayon « Modifier la description » pour l’éditer : enregistrée en quittant l’éditeur, Ctrl/⌘ + Entrée l’enregistre et ferme l’éditeur ; la coche « Terminer la modification de la description » revient au texte affiché.
- « Liens » : ouverts dans un nouvel onglet (« Aucun lien. » sinon) ; crayon « Modifier les liens » : le champ des liens des évènements, chaque lien enregistré une fois validé (en quittant ses champs), un retrait tout de suite ; la coche « Terminer la modification des liens » revient aux liens affichés.
- « Sous-tâches » : « 2/5 », barre d’avancement, liste, « Ajouter une sous-tâche ».
- « Commentaires » : le fil de commentaires (voir [Commentaires](../cross-cutting/comments.md)).

Colonne de propriétés (chaque champ enregistré dès qu’il change ; « Enregistrement… » puis « Enregistré » en tête) :

- « Projet » (changement = transfert ; confirmation « Changer de projet » si la tâche quitte son arborescence et a des liens : elle prend le numéro suivant du projet, ou perd son numéro et son lien GitHub hors projet) ;
- « Statut », « Priorité », « Type », « Assignés », « Étiquettes », « Bénéficiaires », « Effort » ;
- « Temps passé » et bouton « Démarrer le chrono » (ou commandes du chrono s’il tourne sur la tâche ; les autres chronos continuent) ;
- « Début », « Fin », « Ouverture » (« Avant, la tâche n’est pas à faire. »), « Échéance » (« Au-delà, la tâche ouverte est en retard. », suivi de « En retard. » en couleur de retard (orange) si c’est le cas) ; vides, celles que la tâche suit en grisé (« … (parent) », « (jalon) », « (projet) », « (sprint) ») ; les rappels suivent les dates de la tâche, sinon celles du sprint ;
- « Tâche parente », « Jalon », « Sprints », créneaux, « Horaires » (le champ du formulaire de création) ;
- « Rappels » : à une heure seulement (pas d’« avant » : une tâche n’a pas d’heures), dans l’éditeur en lignes commun : « Chaque jour » à une heure, ou « N jours avant » l’échéance à une heure (30 jours au plus, une fois) ; 10 au plus ; aide « Chaque jour de l’ouverture à l’échéance, à ces heures ; ou quelques jours avant l’échéance. » (« Le jour de l’échéance, à ces heures ; ou quelques jours avant. » sans ouverture) ; désactivé sans échéance (« Donnez-lui une échéance pour recevoir des rappels. ») ;
- « Temps morts » : attentes de la tâche (« Lave-linge », 1 h 30) avec leur sonnerie, chacune lançable en minuteur ; les minuteurs lancés pour la tâche dessous (voir [Alarmes](alarms.md#temps-morts)) ;
- « Minuteurs » : minuteurs enregistrés de l’espace que la tâche lance (son menu « … »), enregistrés dès qu’ils changent (voir [Alarmes](alarms.md#minuteurs-enregistrés)) ;
- « Lieu » : enregistré au choix d’une adresse proposée ou d’un clic sur la carte, quand le texte est vidé, ou à la sortie du champ pour un texte libre ;
- « Bloque », « Dépend de », « Relative à » : listes avec « Retirer » et « Ajouter une tâche » ;
- alarmes de la tâche ([Alarmes](alarms.md)), listes d’achats ([Achats](../supplies/shopping.md)), fiches ([Fiches](../supplies/sheets.md)).

Une tâche archivée : tous les champs désactivés, pas de bouton, commentaires en lecture seule ; « Restaurer » dans le menu.

## Fermer, dupliquer, transférer, archiver, supprimer

- **Fermer / Rouvrir** : toast « 2 tâches fermées. » / « rouvertes. », annulable. Une tâche fermée est atténuée dans le tableau (icône d’état violette ; seule une tâche annulée a son libellé barré), ne bloque plus, n’est plus en retard.
- **Statut « Annulé »** : choisir un statut de cette catégorie ferme la tâche ; son libellé est alors barré (tableau, titre du panneau ; agenda, comme toute tâche fermée). Choisir ensuite un autre statut (ou aucun) la rouvre. « Terminé » ne ferme pas la tâche. « Rouvrir » une tâche annulée lui donne le premier statut « À faire » (« Annuler » du toast lui rend son statut « Annulé » et la referme) ; « Fermer » ne change pas le statut. Dans les paramètres, passer un statut vers ou hors de « Annulé » demande une confirmation : « Fermer ses tâches » (« Un statut « Annulé » ferme ses tâches : 3 tâches ouvertes de ce statut seront fermées et barrées. », « Fermer et enregistrer ») ou « Rouvrir ses tâches » (« Ce statut n’est plus « Annulé » : 2 tâches fermées de ce statut seront rouvertes. », « Rouvrir et enregistrer »).
- **Dupliquer** : sans fenêtre, chaque tâche du haut de la sélection est copiée tout de suite, nommée « … (copie) » : tous les champs, les assignés et les liens (le lieu, les liens (URL) et les rappels compris ; un ancien lien hors de l’arborescence de projets de la tâche n’est pas copié), pas les commentaires ; ses sous-tâches sont copiées sous la copie (leurs libellés gardés). Toast « Tâche dupliquée. » (« 3 tâches dupliquées. ») ; la copie d’une tâche seule s’ouvre dans le panneau.
- **Transférer** (panneau « Transférer la tâche » / « Transférer les tâches ») : « Projet de destination » ou case « Sans projet » (perte du numéro, du jalon, des sprints et du lien GitHub). Avertissement si le projet est dans une autre arborescence. Toast « Tâche #12 transférée. » ; annulable s’il n’a retiré aucun lien, sinon il indique « 2 liens retirés. ».
- **Archiver / Restaurer** : en cascade sur les sous-tâches ; annulable.
- **Supprimer** (fenêtre de confirmation destructive) : « La tâche « #12 Libellé » et ses commentaires seront supprimés définitivement. Pour la retirer des listes sans perdre ses données, archivez-la plutôt. », suivi s'il y en a de « 2 temps sans projet, qui ne portent sur rien d’autre, seront aussi supprimés (les temps facturés sont gardés). » (selon le choix pour les sous-tâches). Avec des sous-tâches : choix « Les conserver (elles remontent d’un niveau) » ou les supprimer. Le panneau de la tâche supprimée se ferme.

## Paramètres des tâches

Dans la barre latérale des paramètres (page « Tâches », ou onglet « Tâches » des paramètres d’un projet ; ce sont les paramètres de l’espace) :

- « Colonnes des nouvelles vues » : colonnes affichées et leur ordre (glisser-déposer) pour les vues créées ensuite ; « Colonnes par défaut » (sous la liste) rétablit celles de l’app. Les vues existantes gardent les leurs.
- « Statuts de tâche » : libellé, couleur, image, « Catégorie » (« À faire », « En cours », « Terminé », « Annulé ») ; texte : « La catégorie donne son sens au statut quel que soit son libellé (filtres, tâches « en cours » de l’accueil). C’est l’état ouvert / fermé de la tâche qui dit si elle est terminée ; seul un statut « Annulé » la ferme (et la barre), le quitter la rouvre. ».
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
- « Nouveau jalon » (panneau) : « Libellé » requis, « Échéance », « Description » ; bouton « Créer le jalon ». « Modifier le jalon » : panneau enregistré champ par champ (l’échéance dès qu’elle change, le libellé et la description en les quittant, « Enregistrement… » / « Enregistré », sans bouton). Toasts « Jalon créé. », « Jalon supprimé. ».
- « Afficher les archivés ». Vide : « Aucun jalon pour ce projet. ».

## Sprints d’un projet

Paramètres d’un projet › « Sprints » :

- « Les sprints sont utilisables par les tâches du projet et de ses sous-projets. ».
- Carte : titre, état (« À venir », « En cours », « Passée », `PERIOD_STATES`), badge rouge des tâches non terminées si la fin est passée, « Du … au … », avancement en tâches et en effort (« · effort 3/8 », effort des tâches sans sous-tâches), objectif.
- « Nouveau sprint » : propose « Sprint n », commençant le lendemain du dernier sprint (ou aujourd’hui si le dernier est passé), pour la même durée (14 jours sans sprint précédent). Champs : « Libellé », « Début », « Fin » (requis), « Objectif » ; bouton « Créer le sprint ». « Modifier le sprint » : panneau enregistré champ par champ (les dates dès qu’elles changent, le libellé et l’objectif en les quittant, sans bouton).
- Menu identique aux jalons. Vide : « Aucun sprint pour ce projet. ».

## Contributeurs

- Paramètres d’un projet › « Contributeurs » : les contributeurs du projet (rattachés directement, hérités d’un projet parent avec le badge « Via … », « Moi » avec « Tous les projets »), le nombre de leurs tâches dans le projet ; « Ajouter un contributeur existant », « Nouveau contributeur », « Retirer du projet (ses tâches restent assignées) ». Seuls ces contributeurs sont proposés comme assignés des tâches du projet.
- « Paramètres » (`/settings`) › onglet « Équipe et contributeurs » (PRO) / « Foyer et contributeurs » (PERSO), section « Contributeurs » (`ContributorsManager`) : tous les contributeurs, badges « Moi », « Membre », « Relation » (PRO) / « Proche » (PERSO), « Contact » (infobulle : la relation ou le contact), « Archivé » ; « Modifier », « Archiver », « Supprimer » (pas pour « Moi »). Archiver ou restaurer un contributeur archive ou restaure aussi sa relation ou son contact (une seule confirmation).
- Formulaire : « Nom », « Identifiant de mention » (proposé depuis le nom, `@identifiant`), image, « Coordonnées et anniversaire » (« Un contributeur n’en a pas de propres : ce sont ceux de ce à quoi il est lié. ») : un choix « Membre », « Relation » (PRO) / « Proche » (PERSO), « Contact » (PRO), « Aucun » (pas modifiable pour « Moi », toujours membre), puis pour une relation ou un contact une liste « Choisir la relation… » / « Choisir le contact… » (contacts groupés par client ; ceux déjà liés à un autre contributeur et les archivés ne sont pas proposés) ; dessous, en lecture seule, leur provenance (« Celles du membre, modifiables dans « Équipe » des paramètres. », « Celles de la relation « Paul », modifiables dans sa fiche. », « Celles du contact « … », modifiables dans sa fiche client (un contact n’a pas d’anniversaire). », « Aucune coordonnée ni anniversaire. »), la date de naissance, les adresses mail et les téléphones, et « Ouvrir la fiche » qui ouvre la fiche du membre, de la relation ou du contact (pas pour un nouveau membre ni « Aucun ») ; puis « Projets » (hérités par les sous-projets ; pas pour « Moi »). Nouveau : bouton « Ajouter », toast « Contributeur ajouté. ». Existant : panneau enregistré champ par champ (nom et identifiant en les quittant, image, lien et projets dès qu’ils changent — une relation ou un contact une fois choisi —, sans bouton) ; archivé : lecture seule. Changer le lien (membre, relation), archiver, restaurer ou supprimer un contributeur dont l’anniversaire est cité par une condition de routine (la personne ou « Anniversaires ») et qui fait disparaître des occurrences demande d’abord la confirmation « Occurrences supprimées », comme un changement de créneau (refusée : le champ revient) ; les routines, les tâches faisables et l’agenda sont ensuite rechargés.

Règles : [Personnes](../../business-rules/cross-cutting/people.md).

## États particuliers

- **Archivée** : lecture seule partout, cachée sauf « Afficher les archivées ».
- **Bloquée** : cadenas rouge, « Bloquée : dépend d’au moins une tâche encore ouverte ».
- **En retard** : « Échéance » en couleur de retard (tableau, panneau, accueil, agenda).
- **Sans projet** : pas de numéro (nommée « « Libellé » » dans les messages), ni jalon, ni sprint, ni GitHub.

## Espace PRO / PERSO

Même fonctionnement. Le défaut des créneaux d’une tâche suit l’espace (heures de travail en PRO). Les badges des contributeurs (membre de l’équipe ou du foyer, relation) suivent le vocabulaire de l’espace.
