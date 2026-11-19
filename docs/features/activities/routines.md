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
| `fromTime`                    | « À partir de »                     | visible              | Heure de début, modifiable sur place pour une routine à un seul moment ; sinon « Selon les plages », « Selon les cas » ou « Plusieurs moments ».                           |
| `dueTime`                     | « Avant »                           | visible              | Heure limite, même règle.                                                                                                                                                  |
| `opensOn`                     | « À partir du »                     | masquée              | Jour dès lequel chaque occurrence peut être faite (« Le 15 du mois »…) ; vide pour une routine à cas.                                                                      |
| `location`                    | « Lieu »                            | masquée              | Adresse choisie sur place (avec son point).                                                                                                                                |
| `travelBefore`, `travelAfter` | « Trajet aller », « Trajet retour » | masquées             | Minutes.                                                                                                                                                                   |
| `alarms`                      | « Rappels »                         | masquée              | Cloche avec le nombre de rappels, choisis sur place.                                                                                                                       |
| `slots`                       | « Plages »                          | masquée              | Plages de l'agenda nommées par sa condition (et celles de ses cas).                                                                                                        |
| `trackedTime`                 | « Temps passé »                     | visible              | Bouton chrono (démarre ou arrête le chronomètre sur la routine) et temps chronométré ; total en pied.                                                                      |
| `lastDoneAt`                  | « Faite pour la dernière fois »     | masquée              | Date et heure de la dernière coche.                                                                                                                                        |
| `assignees`                   | « Assignés »                        | visible              | Contributeurs (ceux du projet si la routine en a un).                                                                                                                      |
| `beneficiaries`               | « Bénéficiaires »                   | visible              | Contributeurs et relations pour qui elle est faite.                                                                                                                        |
| `categories`                  | « Catégories »                      | visible              | Chemins des catégories, choisis sur place.                                                                                                                                 |
| `requires`                    | « Dépend de »                       | visible              | Routines à faire avant (icône de dépendance faite ou non).                                                                                                                 |
| `blocks`                      | « Bloque »                          | masquée              | Routines qui attendent celle-ci ; les choisir ici leur ajoute la dépendance.                                                                                               |
| `parent`                      | « Routine parente »                 | masquée              | Choisie sur place (ni elle-même ni une de ses sous-routines).                                                                                                              |
| `subRoutines`                 | « Sous-routines »                   | masquée              | Noms des sous-routines actives, bouton « Ajouter une sous-routine ».                                                                                                       |
| `project`                     | « Projet »                          | visible              | Projet où va le temps chronométré.                                                                                                                                         |
| `description`                 | « Description »                     | masquée              | Texte.                                                                                                                                                                     |
| `done`                        | « Faite »                           | masquée              | « Oui » si l'occurrence en cours est faite.                                                                                                                                |
| `waiting`                     | « En attente »                      | masquée              | « Oui » si une routine requise n'est pas encore faite.                                                                                                                     |
| `doableNow`                   | « Faisable maintenant »             | masquée              | « Oui » si les plages de l'espace permettent de la faire maintenant.                                                                                                       |
| commentaires                  | (colonne commune)                   |                      | Nombre de commentaires (la description compte pour un).                                                                                                                    |

Recherche : « Rechercher (libellé, description, lieu) ».

### États affichés dans « Échéance »

- « Fait » (vert) : occurrence en cours cochée (tous ses moments obligatoires).
- À faire aujourd'hui : badge « Aujourd'hui 8:20–8:30 » (gris avant l'heure de début) ; « Partir maintenant » (orange plein) dès l'heure de départ calculée avec le trajet ; « Après 8:30 » (couleur de retard) une fois l'heure limite passée. Rafraîchi chaque minute.
- « Depuis lun. 10 nov. » (orange) : en retard depuis cette date.
- À venir : la date de la prochaine fois en gris (ou « — »).
- Une flèche indique une occurrence reportée ou avancée ; l'infobulle donne « Prochaine fois : … » (ou « Plus d'occurrence à venir ») et le jour prévu à l'origine.
- Une routine « à faire » mais hors des plages de l'espace (voir [PRO et PERSO](#pro-et-perso)) passe « à venir ».

Les lignes faites et archivées sont estompées ; le libellé d'une routine faite est barré.

### Cocher

- Un interrupteur vert « faite » à gauche du libellé coche l'occurrence en cours. Infobulle « Marquer comme faite (lun. 10 nov.) », puis « Marquer comme à faire ».
- Une routine à plusieurs moments a un petit interrupteur par moment (« 7:00–9:00 », « fois 2 »…), chacun coché à part ; les moments facultatifs ont une piste en pointillés.
- Désactivé (« Pas encore commencée ») avant la première occurrence, et pour une routine archivée ou en cours de création.

### Modifier sur place et en masse

Chaque cellule éditable se modifie sur place. Sur une sélection de cellules d'une colonne (ou sur les routines cochées), la modification s'applique à toutes, avec un toast « Modification appliquée à 3 routines. » proposant « Annuler » (les routines sont remises exactement comme avant). Les listes (catégories, assignés, dépendances, bénéficiaires, rappels) ajoutent et retirent ce qui a été ajouté ou retiré, sans écraser le reste. La cellule « Échéance » ouvre la répétition complète, qui s'applique en entier à chaque routine sélectionnée (texte d'avertissement dans la fenêtre). Les routines archivées sont exclues des modifications en masse.

### Ligne d'ajout

En bas du tableau (ou de chaque catégorie quand il est regroupé par catégories) : champ « Ajouter une routine dans … », indice « tous les jours ». Un libellé puis Entrée crée une routine quotidienne à partir d'aujourd'hui, dans la catégorie du groupe et le projet de la page. Elle s'affiche aussitôt (brouillon en lecture seule) en attendant d'être enregistrée. Pas de ligne d'ajout quand le tableau est regroupé par autre chose que les catégories.

### Glisser-déposer

Une routine se déplace par glisser-déposer : avant une autre (même parent), sous une autre (devient sous-routine, en dernier), ou en dernier au premier niveau. Déposée dans une autre catégorie (tableau regroupé par catégories), elle quitte la catégorie d'origine pour la nouvelle ; déposée dans le groupe sans catégorie, elle perd toutes ses catégories.

### Menu d'une routine

- « Modifier » (action principale) : formulaire.
- « Ajouter une sous-routine ».
- « Reporter au lendemain » et « Reporter, changer l'horaire ou annuler… » (quand une occurrence peut être déplacée).
- « Dupliquer » (avec ses sous-routines).
- « Historique » (onglet Historique filtré sur elle).
- « Archiver » / « Restaurer ».
- « Supprimer ».

Une routine archivée n'offre que « Historique », « Restaurer » et « Supprimer ».

### Actions sur la sélection

Barre de sélection (« 3 routines sélectionnées ») : « Cocher » / « Décocher » (occurrence en cours de chacune), « Reporter au lendemain », « Dupliquer » (chacune avec ses sous-routines ; une sous-routine sélectionnée avec sa parente n'est copiée qu'une fois), « Archiver » / « Restaurer » (annulable depuis le toast), « Supprimer ».

Suppression : dialogue de confirmation « Supprimer la routine » : « « … » sera supprimée définitivement avec l'historique de ses coches. Ses sous-routines remonteront d'un niveau ; le temps chronométré reste, sans routine. Pour la retirer sans perdre ses données, archivez-la plutôt. »

### État vide

« Aucune routine pour le moment. Une routine est une tâche qui revient : laver le linge, arroser les plantes… », et le bouton « Nouvelle routine ».

## Formulaire d'une routine

Ouvert dans le panneau latéral (largeur `lg`) par « Nouvelle routine », « Modifier », un clic sur le libellé, « Ajouter une sous-routine » ou une copie. Titres : « Nouvelle routine », « Modifier la routine », « Dupliquer la routine », « Nouvelle sous-routine de « … » ».

| Champ                                                                        | Règle                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Libellé »                                                                  | Requis, 250 caractères au plus.                                                                                                                                                               |
| « Description »                                                              | Éditeur markdown (suggestions du projet), 65 536 caractères au plus.                                                                                                                          |
| « Quand » › « Répétition et moments »                                        | Requis : résumé, et tous les réglages dans une fenêtre (voir ci-dessous).                                                                                                                     |
| Lieu                                                                         | Adresse libre ou point sur la carte.                                                                                                                                                          |
| « Trajet aller » (« Pour y aller »), « Trajet retour » (« Pour en revenir ») | Minutes, avec un calculateur de trajet depuis le lieu.                                                                                                                                        |
| « Rappels »                                                                  | Minutes avant le moment (« À l'heure », puis préréglages courts) ; désactivé tant que la routine n'a ni horaire ni plage (« Donnez-lui un horaire ou une plage pour recevoir des rappels. »). |
| « Projet »                                                                   | Facultatif : le temps chronométré y est compté. Changer de projet garde les assignés : ils y sont rattachés à l'enregistrement.                                                               |
| « Catégories »                                                               | Arbre ; une catégorie peut être créée en tapant son libellé. Les catégories archivées ne sont plus proposées (celles déjà choisies restent).                                                  |
| « Assignés »                                                                 | Contributeurs (ceux du projet s'il y en a un), plus ceux déjà choisis.                                                                                                                        |
| « Bénéficiaires »                                                            | Contributeurs et relations.                                                                                                                                                                   |
| « Temps à y consacrer »                                                      | Minutes, 1 à 1 440.                                                                                                                                                                           |
| « Routine parente »                                                          | Arbre ; ni elle-même ni ses sous-routines.                                                                                                                                                    |
| « Dépend de »                                                                | Routines à faire avant : « tant qu'elles ne sont pas cochées, celle-ci est en attente ».                                                                                                      |

Sous le texte, quand la routine existe : la section des fiches et de la liste à cocher de l'occurrence en cours (voir [Fiches](../supplies/sheets.md)), puis les commentaires.

Valeurs par défaut d'une nouvelle routine : tous les jours à partir d'aujourd'hui, un moment sans horaire. Une sous-routine reprend de sa parente les catégories, la répétition, les moments, la condition de plages, les cas, le projet, les assignés et les bénéficiaires (et sa date de départ si elle est future). Une copie s'appelle « … (copie) », et ses sous-routines sont copiées avec elle (pas ses coches ni son temps).

Sous les trajets, une ligne résume « Partir à 8 h 05 (trajet et 15 min sur place) · retour vers 9 h 00 » quand la routine a un seul moment.

Toasts : « Routine créée. », « Routine modifiée. », « Routine dupliquée. ».

### Fenêtre « Répétition et moments »

- « Première fois » (requis) : jour dont part la règle.
- Mode : une règle, ou des cas (éditeur de répétition commun, voir [Répétition](../../web/components/recurrence.md)). Une règle : quotidienne, hebdomadaire (jours de la semaine), mensuelle, annuelle, intervalle, fin (date ou nombre), dates exclues. Des cas (20 au plus) : chacun a sa règle, ses dates de début et de fin, ses moments, sa condition de plages et son « à partir du » ; un jour dû par plusieurs cas suit le premier.
- « Moments de la journée » (10 au plus) : « dès » et « avant » (chacun facultatif), case « Facultatif » ; au moins un moment obligatoire. « Ajouter un moment », « Retirer ».
- « Plages de l'agenda » : condition facultative sur les plages (« Sur l'une des plages », « Hors des plages », « Temps libre » hors de toutes les plages sauf certaines), combinée en groupes ET / OU comme les filtres des tableaux. Les moments sont restreints aux heures permises ; un jour sans aucune heure permise n'est pas une occurrence. Sans condition : « à n'importe quelle heure ».
- « À partir du » : « Dès son premier jour » (aucun), « Des jours avant l'échéance » (1 à 366), et pour une règle mensuelle ou annuelle « Un jour du mois / de l'année », « Un jour de semaine du mois / d'un mois » (le 2e mardi, le dernier vendredi), « Un jour d'une semaine du mois / de l'année » (semaine 1 à 6 du mois, semaine ISO 1 à 53 de l'année). Retiré s'il ne correspond plus à la fréquence.

Le résumé s'écrit une ligne par élément : « À partir du 10 nov. 2026 », puis « Cas 1 · Tous les jours · avant 08:00, 12:00–14:00 (facultatif) · sur « Déjeuner » · dès le 15 du mois ».

## Reporter, changer l'horaire ou annuler une occurrence

- « Reporter au lendemain » : déplace l'occurrence en cours (ou la suivante si un moment de l'occurrence en cours est déjà coché) au jour suivant. Toast « « … » reportée au … » avec « Annuler ».
- « Reporter, changer l'horaire ou annuler… » ouvre le panneau « Reporter ou annuler « … » » :
  - « Occurrence » : parmi celles non cochées de 30 jours avant à 68 jours après aujourd'hui, marquées « (aujourd'hui) », « (en retard) », avec leurs horaires ; par défaut celle qui peut être déplacée. Description : « Ne change que celle-ci : c'est une exception, la règle ne change pas. » ou « Déjà déplacée depuis le … ».
  - « Nouvelle date » (requise, pas avant la première fois) : plus tard pour reporter, plus tôt pour avancer, le même jour pour ne changer que l'horaire.
  - « Horaires » : « dès » / « avant » de chaque moment.
  - Bouton « Reporter », « Avancer » ou « Changer l'horaire » selon la date.
  - « Annuler l'occurrence » (destructif) : confirmation « Annuler cette occurrence ? » expliquant qu'elle se rétablit depuis la liste des exceptions ; toast « Occurrence du … annulée. ».
  - « Exceptions » : chaque occurrence déplacée (« reportée », « avancée », « autres horaires », « annulée ») avec « Remettre à son jour ».
- Depuis l'agenda, une occurrence se déplace aussi par glisser-déposer, pour « cette occurrence », « celle-ci et les suivantes » ou « toutes » (voir [Agenda](calendar.md)).

Une occurrence déjà cochée ne se déplace pas : il faut d'abord la décocher.

## Onglet « Historique »

- Navigation jour par jour (« Jour précédent », « Jour suivant », « Aujourd'hui ») ou par un sélecteur de date ; pas de jour futur.
- Filtre « Toutes les routines » ou une seule (arbre, archivées marquées comme telles), lié à l'adresse (`routine=`).
- Calques mémorisés dans le navigateur : « Plages » (de l'espace et des espaces suivis) en fond, et « Calendriers » (leurs évènements, en lecture seule).
- Résumé : « 2 faites sur 5 prévues. Cliquez sur une routine pour la cocher (à l'heure prévue par défaut) ou la décocher. », ou « Aucune routine prévue aujourd'hui. » / « Rien de prévu pour « … » le … ».
- Agenda du jour : chaque moment prévu ce jour-là, à ses heures (ou pour son temps estimé, 30 min par défaut ; sinon à l'heure où il a été fait ; sinon dans la rangée « journée »), coloré selon son état : faite (vert), à faire (orange), facultatif non fait (gris), non faite (rouge). Les occurrences déplacées ont un style à part.
- Un clic ouvre un panneau : « Faite le » (date, pas après aujourd'hui), « Faite à » (heure prévue par défaut ; « Cette heure n'est pas encore passée. » pour une heure future), boutons « Cocher comme faite » / « Changer l'heure » et « Décocher ». Toast « Routine cochée. » / « Routine décochée. » avec « Annuler ».

## Ailleurs dans l'application

- Accueil : carte des routines à faire aujourd'hui (en retard d'abord), cochées depuis la carte, avec report au lendemain et sablier d'attente (voir [Accueil](../cross-cutting/home.md)).
- Agenda : occurrences des routines dans l'agenda, déplaçables, et routines liées à un évènement pour un jour (voir [Agenda](calendar.md)).
- Alarmes : les rappels sonnent pour chaque moment non coché d'une routine due aujourd'hui, avant l'heure de départ (sinon le début, sinon l'heure limite) ; le toast propose de la cocher ; hors des plages permises, l'alarme attend le prochain moment permis (voir [Alarmes](alarms.md)).
- Temps : une saisie de temps ou le chronomètre peut porter sur une routine (projet de la routine par défaut) (voir [Temps](time.md)).

## PRO et PERSO

- L'état « À faire » et la colonne « Faisable maintenant » tiennent compte de la règle de plages par défaut de l'espace : dans un espace professionnel, les heures de travail ; dans un espace personnel, n'importe quand ; et des évènements qui occupent les assignés. Hors de ces plages, une routine due est affichée « À venir ».
- Le reste est identique dans les deux types d'espace.

## Paramètres : catégories

« Catégories » : « Classent les routines, en arborescence : glissez une catégorie sur une autre pour l'y ranger. Une sous-catégorie sans couleur prend celle de sa catégorie parente. » Chaque catégorie a un libellé (250 caractères au plus), une couleur facultative, une image et une parente ; le nombre de routines qui l'utilisent est affiché. Archiver, restaurer, supprimer (ses routines la perdent, ses sous-catégories remontent d'un niveau). Voir [Paramètres](../cross-cutting/settings.md).
