# Routines

Ce que l'utilisateur peut faire avec les routines : des tâches qui reviennent selon une règle de calendrier (laver le linge, arroser les plantes, se brosser les dents matin, midi et soir), cochées une fois faites pour leur occurrence en cours. Sources : `apps/web/src/features/routines/`, et les endroits qui les reprennent (accueil, agenda, alarmes, temps). Les règles appliquées par l'API sont dans [Règles des routines](../../business-rules/activities/routines.md) ; le code web est décrit dans [Code web des routines](../../web/features/activities/routines.md).

## Accès

- Page « Routines », route `/routines` (`PAGES.routines`, icône `ArrowsClockwiseIcon`), dans la navigation principale.
- Deux onglets, mémorisés dans l'adresse (`?tab=`) : « Routines » (`routines`, par défaut) et « Historique » (`history`). L'historique d'une routine précise s'ouvre par `/routines?tab=history&routine=<id>` (`routineHistoryPath`), par exemple depuis l'entrée « Historique » du menu d'une routine.
- Paramètres de la page (barre latérale « Paramètres des routines ») : la liste des catégories.
- Sur la page d'un projet, un onglet reprend le même tableau (`RoutinesPanel`) limité aux routines du projet et de ses sous-projets ; une routine créée depuis cet onglet est rattachée au projet, et les vues du tableau sont celles du projet.

## Onglet « Routines » : le tableau

Un tableau de données commun (voir [Tableau de données](../../web/components/data-table.md)), clé de vue `routines`.

### Vues

La vue par défaut de la page (sinon son premier onglet) est aussi celle de la carte « Routines » de l’accueil (voir [Accueil](../cross-cutting/home.md#cartes)).

Créées la première fois :

| Vue         | Réglage                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| « À faire » | Filtre « État » dans « En retard » ou « À faire », regroupée par catégories. |
| « Toutes »  | Regroupée par catégories.                                                    |

L'utilisateur peut en créer d'autres (colonnes, tris, filtres, regroupement), comme sur tout tableau. Les routines archivées sont masquées tant que l'interrupteur « Afficher les archivées » n'est pas activé.

Le regroupement par catégories suit l'arbre des catégories (une sous-catégorie sous sa parente). Une routine dans plusieurs catégories apparaît dans chacune. Les sous-routines s'affichent sous leur routine parente (arborescence de lignes).

### Colonnes

| Colonne (id)                  | Libellé                             | Par défaut           | Contenu, édition                                                                                                                                                           |
| ----------------------------- | ----------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`                       | « Libellé »                         | visible, verrouillée | Interrupteur(s) « faite », libellé (un clic ouvre le formulaire, un double-clic renomme sur place), répétition en clair dessous, sablier si elle attend d'autres routines. |
| `currentDate`                 | « Échéance »                        | visible              | État du jour (badge) ; un clic ouvre la fenêtre « Répétition et moments ». Filtre par date.                                                                                |
| `state`                       | « État »                            | masquée              | « En retard », « À faire », « À venir », « Faite ». Filtre par choix.                                                                                                      |
| `firstDate`                   | « Première échéance »               | visible              | Première occurrence calculée.                                                                                                                                              |
| `nextDate`                    | « Échéance suivante »               | masquée              | Première occurrence après aujourd'hui.                                                                                                                                     |
| `startDate`                   | « Première fois »                   | masquée              | Jour de départ de la règle.                                                                                                                                                |
| `repetition`                  | « Répétition »                      | masquée              | « Chaque jour », « Chaque semaine », « Chaque mois », « Chaque année » (« Selon un planning » existe dans la liste des choix pour l'ancien format).                        |
| `estimate`                    | « Temps estimé »                    | visible              | Minutes, saisies sur place (1 à 1 440) ; total en pied de colonne.                                                                                                         |
| `fromTime`                    | « À partir de »                     | visible              | Heure de début, modifiable sur place pour une routine à un seul moment ; sinon « Selon les créneaux », « Selon les cas » ou « Plusieurs moments ».                           |
| `dueTime`                     | « Avant »                           | visible              | Heure limite, même règle.                                                                                                                                                  |
| `opensOn`                     | « Ouverture »                     | masquée              | Jour dès lequel chaque occurrence peut être faite (« Le 15 du mois »…) ; vide pour une routine à cas.                                                                      |
| `location`                    | « Lieu »                            | masquée              | Adresse choisie sur place (avec son point), ou texte libre enregistré en quittant la cellule ; texte vidé : aucun lieu.                                                       |
| `travelBefore`, `travelAfter` | « Trajet aller », « Trajet retour » | masquées             | Minutes.                                                                                                                                                                   |
| `alarms`                      | « Rappels »                         | masquée              | Cloche avec le nombre de rappels, choisis sur place.                                                                                                                       |
| `slots`                       | « Créneaux »                          | masquée              | Créneaux et types de créneaux de l'agenda nommés par sa condition (et ceux de ses cas).                                                                                                        |
| `trackedTime`                 | « Temps passé »                     | visible              | Bouton chrono (démarre ou arrête le chronomètre sur la routine ; les autres chronos continuent) et temps chronométré ; total en pied.                           |
| `lastDoneAt`                  | « Faite pour la dernière fois »     | masquée              | Date et heure de la dernière coche.                                                                                                                                        |
| `assignees`                   | « Assignés »                        | visible              | Contributeurs (ceux du projet si la routine en a un).                                                                                                                      |
| `beneficiaries`               | « Bénéficiaires »                   | visible              | Contributeurs et relations pour qui elle est faite.                                                                                                                        |
| `categories`                  | « Catégories »                      | visible              | Chemins des catégories, choisis sur place.                                                                                                                                 |
| `requires`                    | « Dépend de »                       | visible              | Routines à faire avant (icône de dépendance faite ou non), choisies parmi celles de son arborescence de projets.                                                           |
| `related`                     | « Relative à »                      | masquée              | Routines liées, sans ordre entre elles, choisies parmi celles de son arborescence de projets.                                                                              |
| `blocks`                      | « Bloque »                          | masquée              | Routines qui attendent celle-ci ; les choisir ici leur ajoute la dépendance (même arborescence de projets).                                                                |
| `parent`                      | « Routine parente »                 | masquée              | Choisie sur place (ni elle-même ni une de ses sous-routines).                                                                                                              |
| `subRoutines`                 | « Sous-routines »                   | masquée              | Noms des sous-routines actives, bouton « Ajouter une sous-routine ».                                                                                                       |
| `project`                     | « Projet »                          | visible              | Projet où va le temps chronométré.                                                                                                                                         |
| `description`                 | « Description »                     | masquée              | Texte.                                                                                                                                                                     |
| `done`                        | « Faite »                           | masquée              | Oui / non (coche verte, croix rouge) : l'occurrence en cours est faite ; « Faites » / « À faire ».                                                                                                    |
| `waiting`                     | « En attente »                      | masquée              | Oui / non : une routine requise n'est pas encore faite ; « En attente » (triangle orange) / « Libre » (coche verte).                                                                                                                    |
| `doableNow`                   | « Faisable maintenant »             | masquée              | Oui / non : aucun évènement n'occupe ses assignés maintenant (sa condition de créneaux garde déjà ses moments aux heures permises) ; groupée en « Maintenant » / « Plus tard ». |
| commentaires                  | (colonne commune)                   |                      | Nombre de commentaires (la description compte pour un).                                                                                                                    |

Recherche : « Rechercher (libellé, description, lieu) ».

### États affichés dans « Échéance »

- « Fait » (vert) : occurrence en cours cochée (tous ses moments obligatoires).
- À faire aujourd'hui : badge « Aujourd'hui 8:20–8:30 » (gris avant l'heure de début) ; « Partir maintenant » (orange plein) dès l'heure de départ calculée avec le trajet ; « Après 8:30 » (couleur de retard) une fois l'heure limite passée. Rafraîchi chaque minute.
- « Depuis lun. 10 nov. » (orange) : en retard depuis cette date.
- À venir : la date de la prochaine fois en gris (ou « — »).
- Une flèche indique une occurrence reportée ou avancée ; l'infobulle donne « Prochaine fois : … » (ou « Plus d'occurrence à venir ») et le jour prévu à l'origine.
- Une routine « à faire » dont un évènement occupe les assignés maintenant passe « à venir ».

Les lignes faites et archivées sont estompées ; le libellé d'une routine faite est barré.

### Cocher

- Un interrupteur vert « faite » à gauche du libellé coche l'occurrence en cours. Infobulle « Marquer comme faite (lun. 10 nov.) », puis « Marquer comme à faire ».
- Une routine à plusieurs moments a un petit interrupteur par moment (« 7:00–9:00 », « fois 2 »…), chacun coché à part ; les moments facultatifs ont une piste en pointillés.
- Désactivé (« Pas encore commencée ») avant la première occurrence, et pour une routine archivée ou en cours de création.

### Modifier sur place et en masse

Chaque cellule éditable se modifie sur place. Sur une sélection de cellules d'une colonne (ou sur les routines cochées), la modification s'applique à toutes, avec un toast « Modification appliquée à 3 routines. » proposant « Annuler » (les routines sont remises exactement comme avant). Les listes (catégories, assignés, dépendances, bénéficiaires, rappels) ajoutent et retirent ce qui a été ajouté ou retiré, sans écraser le reste. La cellule « Échéance » ouvre la répétition complète, qui s'applique en entier à chaque routine sélectionnée (texte d'avertissement dans la fenêtre). Les routines archivées sont exclues des modifications en masse.

### Ligne d'ajout

En bas du tableau (et de chaque catégorie quand il est regroupé par catégories ; regroupé, la ligne du bas reste seulement quand le groupe « Sans valeur » n'est pas affiché) : champ « Ajouter une routine dans … », indice « tous les jours ». Un libellé puis Entrée crée une routine quotidienne à partir d'aujourd'hui, dans la catégorie du groupe et le projet de la page. Elle s'affiche aussitôt (brouillon en lecture seule) en attendant d'être enregistrée. Pas de ligne d'ajout quand le tableau est regroupé par autre chose que les catégories.

### Glisser-déposer

Une routine se déplace par glisser-déposer, comme une tâche : avant une autre dans un seul ordre manuel global, et sous un autre parent quand elle change de niveau (devient sous-routine, ou remonte au premier niveau). Le déplacement fonctionne aussi dans une vue filtrée où sa parente est masquée. Une routine archivée ne se déplace pas. Rangée sous une autre parente, une sous-routine qui en hérite son « quand » change d'occurrences : si des occurrences commentées disparaissent (sur elle ou ses sous-routines), la même confirmation que dans le panneau est demandée (« Occurrences supprimées ») ; refusée, rien ne bouge. Déposée dans une autre catégorie (tableau regroupé par catégories), elle quitte la catégorie d'origine pour la nouvelle ; déposée dans le groupe sans catégorie, elle perd toutes ses catégories. Les catégories sans routine n'apparaissent pas pendant le glisser : pour mettre une routine dans une catégorie vide, on change sa cellule « Catégories » ou son panneau.

### Menu d'une routine

- « Modifier » (action principale) : panneau de la routine, enregistré champ par champ.
- « Ajouter une sous-routine ».
- « Reporter au lendemain » et « Reporter, changer l'horaire ou annuler… » (quand une occurrence peut être déplacée).
- « Héritage… » (une sous-routine) : comme sur la sélection, ci-dessous.
- « Dupliquer » (enregistrée tout de suite, « … (copie) », avec ses sous-routines ; un ancien lien hors de l'arborescence de projets de la routine n'est pas copié) ; toast « Routine dupliquée. », puis le panneau de la copie s'ouvre.
- « Transformer en tâche » (désactivé sur une routine qui a des sous-routines, infobulle « Une routine qui a des sous-routines ne devient pas une tâche. »).
- « Historique » (onglet Historique filtré sur elle).
- « Archiver » / « Restaurer ».
- « Supprimer ».
- Avec des temps morts (routine non archivée) : section « Temps morts », « Lancer « Lave-linge (1 h 30) » » pour son occurrence en cours ; avec des minuteurs enregistrés, section « Minuteurs », « Lancer « Œufs durs (9 min) » » (aussitôt, pour son occurrence en cours). Le menu du panneau les propose aussi, pour l’occurrence ouverte ; l’agenda du jour, un bouton par temps mort et par minuteur.

Le panneau d’une routine existante a aussi un menu « … » (en haut, à côté de « Enregistré »), comme celui d’une tâche : « Dupliquer », « Héritage… » (une sous-routine), « Transformer en tâche », « Archiver », « Supprimer » ; archivée : « Restaurer », « Supprimer ». Ce sont les mêmes actions que celles de sa ligne (même confirmation de suppression, avec le choix pour ses sous-routines) ; après « Supprimer », le panneau se ferme (supprimée depuis sa ligne ou la sélection aussi).

« Transformer en tâche » remplace la routine par une tâche :

- Confirmation destructive « Transformer en tâche » : « La routine est remplacée par une tâche « À faire », datée par son occurrence en cours : elle en reçoit les commentaires, la liste à cocher et les évènements ; ses temps et ses fiches la suivent. », puis « Elle perd : » et la liste, avec les nombres (« sa répétition », « l’historique de ses occurrences (ses 12 coches) », « ses 2 rappels « avant » », « son lien « Dépend de » ou « Relative à » avec d’autres routines », « ses 2 catégories », « son temps à y consacrer », « ses trajets », « les 4 commentaires des autres occurrences », « ses 2 autres listes à cocher », « ses 3 liens avec des évènements », « son parent (elle passe au premier niveau) »), puis « Cette action est irréversible. ». Boutons « Transformer en tâche » puis « Annuler ».
- Une fois fait : toast « Routine transformée en tâche. », le panneau encore ouvert sur la routine se ferme (depuis sa ligne comme depuis son panneau) et celui de la nouvelle tâche s’ouvre.
- Ce qui est gardé : libellé, description, projet, assignés, bénéficiaires, liens, lieu, condition de créneaux, rappels « À HH:MM » et « N jours avant », temps chronométrés, fiches ; l’occurrence en cours (sinon la suivante, sinon la première) donne l’« Échéance » (son jour d’échéance) et l’« Ouverture » (son premier jour, s’il est avant), ses commentaires, sa liste à cocher et ses évènements ; la tâche prend le premier statut « À faire ». Règles : [Routines](../../business-rules/activities/routines.md#transformer-en-tâche).

Une routine archivée n'offre que « Historique », « Restaurer » et « Supprimer ». Archivée, elle n'a plus d'occurrence à venir ; ses occurrences ouvertes avant le jour de l'archivage restent, archivées, même dues après (agenda avec « Afficher les archivés », lecture seule ; « Historique » : estompées, marquées « (archivée) », un clic n'ouvre rien) ; la restaurer remet tout comme avant.

### Actions sur la sélection

Barre de sélection (« 3 routines sélectionnées ») : « Cocher » / « Décocher » (occurrence en cours de chacune), « Reporter au lendemain », « Dupliquer » (chacune avec ses sous-routines ; une sous-routine sélectionnée avec sa parente n'est copiée qu'une fois), « Héritage… », « Archiver » / « Restaurer » (annulable depuis le toast), « Supprimer ».

« Héritage… » (désactivé sans sous-routine) : panneau « Héritage », pour le projet, les catégories, les assignés, les bénéficiaires, le lieu, les créneaux, l’« Ouverture », la première fois, la répétition, les cas, les moments et les exceptions : « Inchangé », « Rétablir l’héritage » ou « Vider » (pas pour la première fois ni la répétition) ; « Appliquer » (si des occurrences avec des commentaires disparaissent, des routines choisies ou de leurs sous-routines, la confirmation habituelle le demande une fois), toast « Héritage changé pour 3 routines. » avec « Annuler » (qui remet aussi les exceptions vidées). Le même formulaire s’ouvre depuis le menu « … » d’une sous-routine et celui de son panneau.

### Champs hérités

Une sous-routine hérite de sa parente ([Héritage](../../business-rules/activities/routines.md#héritage)) : dans le tableau, la valeur héritée est grisée, en italique, avec l’infobulle « Hérité de « … » » (projet, catégories, assignés, bénéficiaires, lieu, créneaux, « Ouverture », première fois, répétition, horaires) ; dans le panneau et le formulaire de création, la valeur grisée avec « Hérité de « … » » et « Vider » dessous, « Vidé exprès » ou « Rétablir l’héritage » ; le « Quand » est grisé en bloc, « En partie hérité de « … » : répétition, moments » quand une partie seulement l’est, avec « Rétablir l’héritage ». Filtres, tris, groupes et export lisent la valeur héritée.

Archiver une routine archive aussi ses sous-routines ; la restaurer restaure celles archivées avec elle, et ses parentes archivées (comme les tâches).

Suppression : dialogue de confirmation « Supprimer la routine » (« Supprimer les routines ») : « « … » sera supprimée définitivement avec l'historique de ses coches ; le temps chronométré reste, sans elle. Pour la retirer sans perdre ses données, archivez-la plutôt. Cette action est irréversible. », suivi, s'il y en a, de « 2 temps sans projet, qui ne portent sur rien d’autre, seront aussi supprimés (les temps facturés sont gardés). » et de « 3 commentaires seront aussi supprimés. » (selon le choix pour les sous-routines). Si elle a des sous-routines : « Que faire de sa sous-routine / ses N sous-routines ? » (plusieurs : « Que faire de leurs sous-routines non sélectionnées ? »), au choix « Les conserver (elles remontent d'un niveau) » (par défaut) ou « Les supprimer aussi, définitivement ». Boutons « Supprimer » puis « Annuler ». Toast « Routine « … » supprimée. » / « 3 routines supprimées. ».

### État vide

« Aucune routine pour le moment. Une routine est une tâche qui revient : laver le linge, arroser les plantes… », et le bouton « Nouvelle routine ».

## Formulaire d'une routine

Ouvert dans le panneau latéral (largeur `lg`) par « Nouvelle routine », « Modifier », un clic sur le libellé, « Ajouter une sous-routine » ou une copie qui vient d'être enregistrée. Titres : « Nouvelle routine », « Routine » (existante), « Nouvelle sous-routine de « … » ».

Une routine existante s'enregistre champ par champ, comme une tâche : chaque champ est enregistré dès qu'il change (libellé, description, « Temps à y consacrer », liens, lieu et trajets en les quittant ; Entrée dans le libellé aussi ; la fenêtre « Répétition et moments » une fois validée), sans bouton « Enregistrer » ; « Enregistrement… » puis « Enregistré » en haut du panneau. Un champ invalide garde son erreur dessous et n'est pas enregistré ; un échec le remet comme il était, dans un toast d'erreur ; un changement qui fait disparaître des occurrences demande la confirmation habituelle (refusée : le champ revient). La création garde son bouton « Créer ».

| Champ                                                                        | Règle                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Libellé »                                                                  | Requis, 250 caractères au plus.                                                                                                                                                                                                                                               |
| « Description »                                                              | Éditeur markdown (suggestions du projet), 65 536 caractères au plus.                                                                                                                                                                                                          |
| « Liens »                                                                    | Comme ceux des évènements : adresse (http/https) + libellé facultatif, « Ajouter un lien », « Retirer » ; 20 au plus. Copiés par « Dupliquer » ; une nouvelle sous-routine n’en reprend pas.                                                                    |
| « Quand » › « Répétition et moments »                                        | Requis : résumé, et tous les réglages dans une fenêtre (voir ci-dessous).                                                                                                                                                                                                     |
| Lieu                                                                         | Adresse libre ou point sur la carte.                                                                                                                                                                                                                                          |
| « Trajet aller » (« Pour y aller »), « Trajet retour » (« Pour en revenir ») | Minutes, avec un calculateur de trajet depuis le lieu.                                                                                                                                                                                                                        |
| « Rappels »                                                                  | L’éditeur en lignes commun (`RemindersSelect`), 10 au plus : « N min / h avant » le début ou la fin de chaque moment non coché, le jour de l’ouverture ou celui de l’échéance (24 heures au plus), « Le jour J à HH:MM », « N jours avant, à HH:MM » ; aide « Pour chaque occurrence : avant le début ou la fin de chaque moment non coché, le jour de l’ouverture ou celui de l’échéance (« dès » / « jusqu’à », l’autre heure selon le temps à y consacrer), 24 h au plus ; ou à une heure de l’un de ces jours ou de quelques jours avant. ». Sans aucune heure ni créneau (`routineHasHours`), seulement « Le jour J à HH:MM » et « N jours avant » (« À une heure du jour de l’ouverture ou de l’échéance, ou de quelques jours avant : donnez une heure « dès » ou « jusqu’à » à ses moments (ou un créneau) pour des rappels avant eux. ») ; de même dans la cellule « Rappels ». |
| « Projet »                                                                   | Facultatif : le temps chronométré y est compté. Changer de projet garde les assignés : ils y sont rattachés à l'enregistrement. Changer d'arborescence de projets retire ses liens (« Dépend de », « Bloque », « Relative à ») avec les routines restées hors de la nouvelle. |
| « Catégories »                                                               | Arbre ; une catégorie peut être créée en tapant son libellé. Les catégories archivées ne sont plus proposées (celles déjà choisies restent).                                                                                                                                  |
| « Assignés »                                                                 | Contributeurs (ceux du projet s'il y en a un), plus ceux déjà choisis.                                                                                                                                                                                                        |
| « Bénéficiaires »                                                            | Contributeurs et relations.                                                                                                                                                                                                                                                   |
| « Temps à y consacrer »                                                      | Minutes, 1 à 1 440.                                                                                                                                                                                                                                                           |
| « Temps morts »                                                              | Attentes de la routine (« Lave-linge », 1 h 30) avec leur sonnerie, enregistrées chacune une fois valide ; « Lancer » lance un minuteur pour l’occurrence ouverte ; les minuteurs lancés pour elle dessous (voir [Alarmes](alarms.md#temps-morts)). |
| « Minuteurs »                                                                | Minuteurs enregistrés de l’espace que la routine lance (son menu « … »), enregistrés dès qu’ils changent ; « Enregistrez d’abord l’élément. » sur une nouvelle routine (voir [Alarmes](alarms.md#minuteurs-enregistrés)). |
| « Routine parente »                                                          | Arbre ; ni elle-même ni ses sous-routines.                                                                                                                                                                                                                                    |
| « Dépend de »                                                                | Routines à faire avant : « tant qu'elles ne sont pas cochées, celle-ci est en attente ». Celles de son arborescence de projets (sans projet : celles sans projet), plus celles déjà choisies.                                                                                 |
| « Relative à »                                                               | « Routines liées, sans ordre entre elles. » Même choix que « Dépend de ».                                                                                                                                                                                                     |

Sous le texte, quand la routine existe : la section des fiches et de la liste à cocher de l'occurrence en cours (voir [Fiches](../supplies/sheets.md)), puis les commentaires de l'occurrence ouverte (« Commentaires du 12 nov. 2026 ») : celle cliquée dans l'agenda (« Ouvrir la routine »), sinon l'occurrence en cours, à défaut la suivante, à défaut la première. La colonne « Commentaires » compte ceux de cette même occurrence.

Valeurs par défaut d'une nouvelle routine : tous les jours à partir d'aujourd'hui, un moment sans horaire. Une sous-routine hérite de sa parente le projet, les catégories, les assignés, les bénéficiaires, le lieu et tout son « quand » (première fois, répétition, cas, moments, exceptions, condition, « Ouverture »), montrés grisés avec « Hérité de « … » » tant qu’ils ne sont pas changés (voir [Héritage](../../business-rules/activities/routines.md#héritage)) ; ses occurrences (agenda, « à faire », état, rappels) suivent ceux de sa parente, et changent quand ils changent. Une copie s'appelle « … (copie) », et ses sous-routines sont copiées avec elle (pas ses coches ni son temps).

Sous les trajets, une ligne résume « Partir à 8 h 05 (trajet et 15 min sur place) · retour vers 9 h 00 » quand la routine a un seul moment.

Toasts : « Routine créée. ». Une routine passée dans une autre arborescence de projets perd ses liens hors d'elle : « Routine déplacée. 2 liens retirés. » (panneau et tableau), « Modification appliquée à 3 routines. 2 liens retirés. » sur une sélection. Les routines d'une sélection changées de projet ensemble gardent les liens entre elles.

### Fenêtre « Répétition et moments »

- « Première fois » (requis) : jour dont part la règle.
- Mode : une règle, ou des cas (éditeur de répétition commun, voir [Répétition](../../web/components/recurrence.md)). Une règle : quotidienne, hebdomadaire (jours de la semaine), mensuelle, annuelle, intervalle, fin (date ou nombre), dates exclues. Des cas (20 au plus) : chacun a sa règle, ses dates de début et de fin, ses moments, sa condition de créneaux et son ouverture ; un jour dû par plusieurs cas suit le premier.
- « Moments de la journée » (10 au plus) : « dès » et « avant » (chacun facultatif), case « Facultatif » ; au moins un moment obligatoire. « Ajouter un moment », « Retirer ».
- « Créneaux de l'agenda » : condition facultative : « Créneau » (éphémérides comprises, suivies de « (éphéméride) » ; le « Temps libre » les ignore ; anniversaires des personnes de l'espace, « Anniversaire de Paul (éphéméride) », et tous, « Anniversaires (éphéméride) » parmi les types) (« sur l'un des créneaux », « hors des créneaux »), « Type de créneau » (« sur l'un des types », « hors des types » : tous les créneaux de ces types, même ajoutés ensuite ; un type qui n'a encore aucun créneau ne permet aucun moment : la tâche ou la routine n'est jamais faisable tant qu'un créneau de ce type n'existe pas) et « Temps libre » (« hors de tous les créneaux », « hors de tous les créneaux sauf » certains de l'espace), créneaux et types de cet espace ou de vos autres espaces (avec leur espace), combinés en groupes ET / OU comme les filtres des tableaux. Les moments sont restreints aux heures permises ; un jour sans aucune heure permise n'est pas une occurrence. Sans condition : « à n'importe quelle heure ».
- « Ouverture » : « Dès son premier jour » (aucune), « Des jours avant l'échéance » (1 à 366), et pour une règle mensuelle ou annuelle « Un jour du mois / de l'année », « Un jour de semaine du mois / d'un mois » (le 2e mardi, le dernier vendredi), « Un jour d'une semaine du mois / de l'année » (semaine 1 à 6 du mois, semaine ISO 1 à 53 de l'année). Retiré s'il ne correspond plus à la fréquence.

Le résumé s'écrit une ligne par élément : « À partir du 10 nov. 2026 », puis « Cas 1 · Tous les jours · avant 08:00, 12:00–14:00 (facultatif) · sur « Déjeuner » · dès le 15 du mois ».

## Reporter, changer l'horaire ou annuler une occurrence

- « Reporter au lendemain » : déplace l'occurrence en cours (ou la suivante si un moment de l'occurrence en cours est déjà coché) au jour suivant. Toast « « … » reportée au … » avec « Annuler ».
- « Reporter, changer l'horaire ou annuler… » ouvre le panneau « Reporter ou annuler « … » » :
  - « Occurrence » : parmi celles non cochées de 30 jours avant à 68 jours après aujourd'hui, marquées « (aujourd'hui) », « (en retard) », avec leurs horaires ; par défaut celle qui peut être déplacée. Description : « Ne change que celle-ci : c'est une exception, la règle ne change pas. » ou « Déjà déplacée depuis le … ».
  - « Nouvelle date » (requise, pas avant la première fois) : plus tard pour reporter, plus tôt pour avancer, le même jour pour ne changer que l'horaire.
  - « Horaires » : « dès » / « avant » de chaque moment.
  - Bouton « Reporter », « Avancer » ou « Changer l'horaire » selon la date.
  - « Annuler l'occurrence » (destructif) : confirmation « Annuler cette occurrence ? » (« L’occurrence du … n’aura pas lieu : elle reste affichée, barrée, avec ses commentaires ; c’est une exception, les autres occurrences ne changent pas. Elle se rétablit depuis la liste des exceptions ou l’agenda. ») ; toast « Occurrence du … annulée. ». Une occurrence annulée reste dans l'agenda, barrée, mais n'est plus à faire (ni état, ni rappels, ni « Historique ») ; elle n'est plus proposée dans « Occurrence ».
  - « Exceptions » : chaque occurrence déplacée (« reportée », « avancée », « autres horaires », « annulée ») avec « Remettre à son jour ».
- Depuis l'agenda, une occurrence se déplace aussi par glisser-déposer, pour « cette occurrence », « celle-ci et les suivantes » ou « toutes » (voir [Agenda](calendar.md)).

Une occurrence déjà cochée ne se déplace pas : il faut d'abord la décocher.

## Onglet « Historique »

- Navigation jour par jour (« Jour précédent », « Jour suivant », « Aujourd'hui ») ou par un sélecteur de date ; pas de jour futur.
- Filtre « Toutes les routines » ou une seule (arbre, archivées marquées comme telles), lié à l'adresse (`routine=`).
- Calques mémorisés dans le navigateur : « Créneaux » (de l'espace et des espaces suivis) en fond, et « Calendriers » (leurs évènements, en lecture seule).
- Résumé : « 2 faites sur 5 prévues. Cliquez sur une routine pour la cocher (à l'heure prévue par défaut) ou la décocher. », ou « Aucune routine prévue aujourd'hui. » / « Rien de prévu pour « … » le … ».
- Agenda du jour : chaque moment prévu ce jour-là, de son début à sa fin (`routineSlotSpan`, comme ses rappels : « dès » et « jusqu’à », sans l’un d’eux l’autre ± le temps estimé, 30 min sans lui ; sans aucune heure, à l'heure où il a été fait pour son temps estimé ; sinon dans la rangée « journée »), coloré selon son état : faite (vert), à faire (orange), facultatif non fait (gris), non faite (rouge). Les occurrences déplacées ont un style à part.
- Un clic ouvre un panneau : « Faite le » (date, pas après aujourd'hui), « Faite à » (heure prévue par défaut ; « Cette heure n'est pas encore passée. » pour une heure future), boutons « Cocher comme faite » / « Changer l'heure » et « Décocher », puis un bouton « Lancer « Lave-linge (1 h 30) » » par temps mort de la routine, pour cette occurrence. Toast « Routine cochée. » / « Routine décochée. » avec « Annuler ».

## Ailleurs dans l'application

- Accueil : carte des routines à faire aujourd'hui (en retard d'abord), cochées depuis la carte, avec report au lendemain et sablier d'attente (voir [Accueil](../cross-cutting/home.md)).
- Agenda : occurrences des routines dans l'agenda, déplaçables, et routines liées à un évènement pour un jour (voir [Agenda](calendar.md)).
- Rappels : un « avant » sonne pour chaque moment non coché qui a une heure, de l'occurrence en cours non faite (et de la suivante), depuis le début ou la fin du moment, le jour de l'ouverture ou celui de l'échéance (`routineSlotSpan` : « dès » / « jusqu’à », l’autre selon le temps estimé, 30 min sans lui) ; un « À HH:MM » une fois par occurrence, ce jour-là ; un « N jours avant » une fois par occurrence, N jours avant ce jour ; le toast propose de la cocher ; pendant un évènement qui occupe ses assignés, le rappel attend le prochain moment libre ; ils sonnent quel que soit l'espace ouvert (voir [Alarmes](alarms.md)).
- Temps : une saisie de temps ou le chronomètre peut porter sur une ou plusieurs routines (projet de la première par défaut ; temps réparti à parts égales entre elles) (voir [Temps](time.md)).

## PRO et PERSO

- Aucune différence : sans condition de créneaux, une routine se fait n'importe quand dans les deux types d'espace ; l'état « À faire » et la colonne « Faisable maintenant » ne tiennent compte que de sa condition (qui garde ses moments) et des évènements qui occupent les assignés.

## Paramètres : catégories

« Catégories » : « Classent les routines, en arborescence : glissez une catégorie sur une autre pour l'y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente. » Chaque catégorie a un libellé (250 caractères au plus), une couleur facultative, une image et une parente ; le nombre de routines qui l'utilisent est affiché. Archiver, restaurer, supprimer (ses routines la perdent, ses sous-catégories remontent d'un niveau). Voir [Paramètres](../cross-cutting/settings.md).
