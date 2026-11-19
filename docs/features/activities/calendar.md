# Agenda

Ce que l’utilisateur peut faire dans l’agenda : la page `/calendar` (« Agenda »), les évènements et leurs occurrences, les calendriers et leurs abonnements, les catégories, les plages (horaires prévus) et leurs types, les exports PDF et iCalendar. Code : `apps/web/src/features/calendar/**` (voir [Code web de l’agenda](../../web/features/activities/calendar.md)) ; règles : [Règles de l’agenda](../../business-rules/activities/calendar.md).

## Page « Agenda » (`/calendar`)

Route `PAGES.calendar.path` = `/calendar`, composant `CalendarPage`. L’adresse `/calendar?date=YYYY-MM-DD` (`calendarPath(date)`) ouvre l’agenda sur ce jour, puis le paramètre est retiré de l’adresse (liens d’un report, d’un évènement d’un autre espace…).

### Barre d’outils

- À gauche : le choix de la vue (« Mois », « Semaine », « Jour ») et la navigation de période (aujourd’hui, précédent, suivant) avec le titre de la période.
- À droite :
  - « Plages de travail » (espace PRO) ou « Plages » (espace PERSO) : ouvre le gestionnaire des plages dans le panneau latéral (taille large) ;
  - l’interrupteur « Modifier les plages » (un mode, pas un bouton) : les plages de l’espace deviennent des éléments déplaçables ;
  - « Nouvel évènement » : ouvre le formulaire d’évènement (désactivé tant que le contexte des tâches n’est pas chargé).
- En cas d’échec du chargement des évènements ou des calendriers abonnés : alerte « Agenda incomplet » au-dessus de l’agenda.

### Vues

- **Mois** : la grille grandit avec ses jours (toutes les tâches visibles).
- **Semaine** : la semaine de l’espace (`currentWeek()` : premier jour et longueur réglés dans l’espace, voir [Dates](../../business-rules/cross-cutting/dates.md)), avancée d’une semaine à la fois ; numéros de semaine affichés.
- **Jour**.
- Semaine et jour remplissent la fenêtre (défilement interne), défilement initial à 08:00, indicateur de l’heure actuelle.
- Ligne « journée entière » (semaine, jour) : repliée à 2 lignes par défaut ; le bouton de pliage dans l’en-tête de la ligne, ou le lien « +N », la déplie sur tous les jours (mémorisé).
- Graduation des heures par 30 minutes, ou par 5 minutes (réglage « Par 5 minutes ») ; un glisser déplace d’autant.
- Vue, filtres et dépliage de la ligne journée entière sont mémorisés dans le navigateur (`localStorage` : `ordo.calendar.view`, `ordo.calendar.filters`, `ordo.calendar.allDayExpanded`). Vue par défaut : semaine.

### Ce que l’agenda affiche

| Élément                                                     | Affichage                                                                                                                                                                                                                      | Clic                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Évènements de l’espace                                      | Couleur de la 1re catégorie, sinon du projet, sinon du calendrier ; avec plusieurs calendriers, bordure gauche à la couleur du calendrier. Récurrents : style distinct. Annulés : barrés. Archivés : estompés, non déplaçables | Formulaire de l’évènement (son occurrence)         |
| Trajets aller / retour (semaine, jour, évènements à heures) | Blocs hachurés « Trajet aller · 20 min » avant le début, « Trajet retour » après la fin, non déplaçables                                                                                                                       | Formulaire de l’évènement (cas par défaut du clic) |
| Évènements des calendriers d’autres espaces                 | Couleur du calendrier, non déplaçables                                                                                                                                                                                         | Fiche en lecture seule (`SubscribedEvent`)         |
| Tâches datées (filtre « Tâches »)                           | Ligne journée entière, bordure couleur du projet ; fermées barrées ; échéance à part ; retard en couleur de retard                                                                                                             | Ouvre la tâche                                     |
| Routines (filtre « Routines », affiché par défaut)          | À leurs heures (placées selon le temps qu’elles prennent, voir plus bas) ou en journée entière ; « (facultatif) » ; faites barrées ; déplacées en style distinct ; trajets hachurés                                            | Formulaire de l’occurrence de routine              |
| Chronos (filtre « Chronos », masqué par défaut)             | Blocs du début à la fin (maintenant s’il tourne, mis à jour chaque minute), couleur du projet ; « ● » s’il tourne ; un temps sur un évènement n’affiche que sa part hors de l’évènement (« Hors « X » · »)                     | Formulaire du temps                                |
| Plages (filtre « Plages de travail »/« Plages »)            | En fond selon l’affichage de leur type (voir plus bas) ; plages d’autres espaces hachurées                                                                                                                                     | Rien (les bandeaux n’ouvrent rien)                 |

Placement des tâches (`taskPlacement`) :

- début et fin : tous les jours de l’un à l’autre ;
- début passé sans fin : du début à aujourd’hui (la tâche continue) ;
- début futur sans fin : son jour de début seul ;
- fin seule : ce jour-là ;
- échéance (« date au plus tard ») : affichée à part ce jour-là, sauf si la période finit déjà dessus ; en retard (échéance passée, tâche non fermée) : affichée aujourd’hui, portée par sa période si elle atteint aujourd’hui, en couleur de retard.

Routines : une routine parente (qui a des sous-routines) n’est pas affichée, seules ses sous-routines le sont. Une routine à heures est placée dans sa fenêtre, aussi longue que son estimation (30 min par défaut), chaque personne ne faisant qu’une chose à la fois (trajets compris), celles attendues d’abord, puis l’ordre manuel (`placeRoutineBlocks`).

Affichage des plages, selon le type (ou l’abonnement) :

- semaine et jour : « Fond sur les horaires » (les plages simultanées se partagent la largeur), « Fond sur toute la journée », « Fine bordure à gauche des horaires », ou « Rien » ; plus un « Bandeau en haut » (dans la ligne journée entière) portant le libellé « Libellé (Type) » ;
- mois : « Fond du jour », « Bordure en bas », ou « Rien » ;
- les jours en pause n’ont simplement pas de plage.

### Interactions dans la grille

- **Sélectionner une période** : ouvre « Nouvel évènement » pré-rempli (journée entière si la sélection l’est), dans le premier calendrier affiché non archivé.
- **Glisser / étirer un évènement** : enregistre ses nouvelles dates ; pour une occurrence d’un évènement récurrent, demande « Cette occurrence » / « Celle-ci et les suivantes » / « Toutes les occurrences » (annuler remet l’évènement en place). En cas d’erreur : toast d’erreur et retour en place.
- **Glisser / étirer une tâche** : change ses dates (échéance seule si on déplace l’échéance ; sa date de début seule si la période va jusqu’à aujourd’hui ; sinon début et fin). Une période « ouverte » (jusqu’à aujourd’hui) ne s’étire pas.
- **Glisser une routine** (si aucune de ses heures du jour n’est cochée) : vers un autre jour ou une autre heure (sa fenêtre bouge d’autant) ; on ne peut pas l’étirer ; demande la portée. Refus « Une routine reste dans sa journée. » si la fenêtre sortirait du jour.
- **Mode « Modifier les plages »** : chaque plage de l’espace (non archivée) devient un élément à déplacer, étirer (sauf journée entière) ou ouvrir ; les plages des autres espaces restent en fond. Une plage à heures doit finir le jour où elle commence (« Une plage s’arrête le jour où elle commence. »). La portée est demandée (« Modifier une plage récurrente » / « Supprimer une plage récurrente »).

Toasts : « Exception ajoutée à la plage pour ce jour. », « Plage modifiée. », « Horaires retirés de la plage. », « Exception ajoutée : « X » le …, la règle ne change pas. », « « X » modifiée. », « Occurrence du … supprimée. » (avec annulation), « Plus aucune occurrence : « X » est archivée. », « « X » s’arrête avant le …. ».

## Paramètres de l’agenda (panneau « Paramètres de l’agenda »)

Ouvert par le bouton de paramètres de la page (`?settings=1`), deux onglets.

### Onglet « Affichage et export »

Section « Affichage » :

- « Calendriers » : une case par calendrier de l’espace et par calendrier abonné (« Libellé · Espace »), cochée s’il est affiché ; « Aucun calendrier. » sinon.
- « Plages de travail » / « Plages » : une case par plage (de l’espace puis des autres espaces) ; désactivée quand le calque des plages est masqué ; « Aucune plage. ».
- « Aussi dans l’agenda » : interrupteurs « Tâches » (actif par défaut), « Routines » (actif), « Plages de travail »/« Plages » (actif), « Chronos » (inactif) et l’interrupteur commun « Afficher les archivés » (évènements et calendriers archivés, en lecture seule).
- « Heures (semaine, jour) » : « Par 5 minutes » (« Sinon par 30 minutes : les routines courtes se lisent mieux par 5 minutes. »).

Section « Exporter » :

- « Vue en PDF » (« La vue affichée, pour l’imprimer ») : télécharge la vue affichée, filtres appliqués (voir [Export PDF](#export-pdf)). Toast « Agenda exporté. » ou « Export PDF impossible. ».
- « Tout exporter (.ics) » : tous les calendriers de l’espace en un fichier iCalendar.

### Onglet « Paramètres »

- **Calendriers** (liste de paramètres standard, voir [Paramètres](../cross-cutting/settings.md)) : ajouter, modifier (libellé, couleur, image), réordonner par glisser-déposer, archiver/restaurer, supprimer. Action par ligne « Exporter (.ics) » ; bouton d’en-tête « Tout exporter (.ics) ». Suppression impossible pour le dernier (« Le dernier calendrier ne peut pas être supprimé »). Message de suppression : le calendrier est supprimé avec tous ses évènements (récurrents compris), les temps suivis sont conservés sans lien, les espaces abonnés ne le voient plus.
- **Calendriers des autres espaces** : par espace (icône PRO/PERSO), chaque calendrier avec un interrupteur « Abonné ». Un calendrier abonné s’affiche en lecture seule. État vide : « Aucun autre espace pour le moment. ».
- **Catégories d’agenda** : liste en arbre (sous-catégories), ajout, modification (libellé, couleur obligatoire, image, parent), glisser-déposer (ordre et parent), archivage, suppression (« retirée des évènements (qui sont conservés) », les sous-catégories remontent d’un niveau). Une catégorie peut aussi être créée depuis le formulaire d’évènement (« Nouvelle catégorie d’agenda »).
- **Plages sans type** : couleur (vide : vert), libellé (vide : « Travail », badge « Par défaut »), et affichage dans l’agenda (bouton « Affichage dans l’agenda »). Enregistrement à la sortie du champ.
- **Types de plages** : liste de paramètres (libellé, couleur, image, affichage semaine/jour, bandeau, affichage mois), réordonnables ; suppression : « ses plages restent, sans type ».
- **Plages des autres espaces** (affiché seulement s’il en existe) : par espace, chaque type (et « Travail » si l’espace a des plages sans type) avec le nombre de plages, l’interrupteur « Abonné » et, une fois abonné, un réglage de couleur et d’affichage propre à cet espace, avec « Reprendre ceux du type ». Abonné à un type, l’espace voit toutes ses plages, même celles ajoutées ensuite.

## Formulaire d’évènement

Ouvert dans le panneau latéral (large) : « Nouvel évènement », « Évènement » (existant) ou « Copie de l’évènement ». Accessible depuis l’agenda, les actions rapides « Ajouter › Évènement » (pré-rempli avec le projet ouvert), les cellules d’évènements des tâches.

### Champs

| Champ                                     | Détail                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Libellé »                               | Requis, 250 caractères max                                                                                                                                                                                                                                                                                                                                                                  |
| « Date et répétition »                    | Requis. Résumé ; la fenêtre de répétition commune contient « Journée entière », « Début », « Heure de début », « Fin », « Heure de fin » et la règle de répétition (voir [Répétition](../../web/components/recurrence.md)). Pour un évènement journée entière répété, durée de chaque occurrence (jours, semaines, mois, jusqu’au jour/semaine/mois…). Par défaut : aujourd’hui 09:00–10:00 |
| « Trajet aller » / « Trajet retour »      | Évènements à heures : « Avant le début », « Après la fin » ; calculateur de trajet depuis le lieu                                                                                                                                                                                                                                                                                           |
| Avertissement de disponibilité            | Espace PRO avec plages : « En dehors de vos plages de travail ce jour-là (…) », « Pendant une pause de vos plages de travail : … », « Pas de plage de travail prévue ce jour-là. » (évènement à heures d’un seul jour)                                                                                                                                                                      |
| Lieu                                      | Texte, avec point sur la carte ou issu d’une recherche                                                                                                                                                                                                                                                                                                                                      |
| « Liens »                                 | Adresse (http/https) + libellé facultatif, « Ajouter un lien », « Retirer » ; 20 max                                                                                                                                                                                                                                                                                                        |
| « Calendrier »                            | Par défaut le premier non archivé ; « Pour toute la série. » pour un récurrent                                                                                                                                                                                                                                                                                                              |
| « Projet »                                | Facultatif ; changer de projet garde les contributeurs, rattachés au nouveau projet à l'enregistrement                                                                                                                                                                                                                                                                                      |
| « Contributeurs »                         | Ceux du projet s’il y en a un (« Contributeurs du projet. »), plus ceux déjà choisis                                                                                                                                                                                                                                                                                                        |
| « Bénéficiaires »                         | « Pour qui est l’évènement (l’anniversaire de votre fils) : ni forcément présents, ni contributeurs. »                                                                                                                                                                                                                                                                                      |
| « Relations » (PRO) / « Proches » (PERSO) | Personnes hors du foyer / de l’équipe, sans contributeur ; non archivées                                                                                                                                                                                                                                                                                                                    |
| « Catégories »                            | Arbre, création possible ; les archivées ne sont plus proposées mais restent si déjà choisies                                                                                                                                                                                                                                                                                               |
| « Tâches »                                | Tâches du projet, de ses sous-projets ou sans projet ; avec un contributeur commun (ou sans assigné) ; 100 options affichées                                                                                                                                                                                                                                                                |
| « Routines »                              | Routines dues ces jours-là, faites pendant l’évènement (ce jour seulement), avec un contributeur commun                                                                                                                                                                                                                                                                                     |
| « Rappels »                               | Préréglages : « Au début », rappels courts, « 6 h avant (la veille à 18 h pour une journée entière) », « 1 jour avant », « 2 jours avant », « 1 semaine avant » ; 15 min par défaut                                                                                                                                                                                                         |
| « Description »                           | Markdown, avec suggestions (références de tâches, projets)                                                                                                                                                                                                                                                                                                                                  |

Pour un récurrent : « Projet, contributeurs, catégories, tâches et rappels s’appliquent à toute la série. ».

« Journée entière » est un interrupteur, dans la répétition d'un évènement comme dans une plage.

### Sections et actions d’un évènement existant

- « Démarrer le chrono » (nécessite un projet) : chrono rattaché à l’occurrence ; affiche « X chronométrées sur cet évènement. ».
- Fiches (checklists par occurrence, voir [Fiches](../supplies/sheets.md)) et commentaires (« Commentaires (toute la série) » pour un récurrent, voir [Commentaires](../cross-cutting/comments.md)).
- « Enregistrer » (récurrent : choix de la portée ; si la répétition a changé, « Cette occurrence » n’est pas proposée).
- « Supprimer » : confirmation « Supprimer l’évènement » (« … sera supprimé définitivement. ») ou, pour un récurrent, choix de la portée (« La suppression est définitive. »).
- « Dupliquer » : ouvre une copie non enregistrée (suffixe de copie ajouté au libellé, `copyName`) ; une occurrence d’une série devient un évènement unique.
- « Annuler l’évènement » : reste barré dans l’agenda ; « Rétablir » l’inverse. Portée demandée pour un récurrent.
- « Reporter » : panneau « Reporter l’évènement » avec « Libellé » (par défaut « Report de l’évènement « X » », le nom coupé pour tenir en 250 caractères, `fitName`), « Nouvelle date » (lendemain par défaut), « Début », « Fin » ; l’évènement garde sa durée ; la date initiale est annulée et un nouvel évènement unique, lié, est créé. Toast « Évènement reporté. ».
- Menu « … » : archiver / restaurer (toute la série).
- Bandeaux : « Évènement annulé » (« Il reste dans l’agenda, barré. Reporté au … ») ; « Report de l’évènement « X » du … » avec lien vers ce jour.
- Archivé (ou calendrier archivé) : formulaire en lecture seule, « Évènement archivé » / « Calendrier archivé », seules restent la suppression, le menu d’archivage (si le calendrier n’est pas archivé) et « Fermer ».

Toasts : « Évènement créé. », « Évènement modifié. », « Évènement supprimé. », « Évènement annulé. », « Évènement rétabli. ».

## Évènement d’un autre espace

Fiche en lecture seule : calendrier « Libellé · Espace », badge « Lecture seule », badge « Annulé » s’il l’est, moment, lieu, description (ses références ne sont pas suivies), liens ; bouton « Ouvrir dans « Espace » » qui bascule d’espace sur ce jour.

## Plages (gestionnaire « Plages de travail » / « Plages »)

Panneau latéral ouvert depuis l’agenda. Description : en PRO « Vos plages de travail prévues : affichées dans l’agenda, comparées au temps chronométré, et signalées quand un évènement tombe en dehors. » ; en PERSO « Vos plages prévues, affichées dans l’agenda. … ».

### Tableau

Tableau de données commun ([Tableau de données](../../web/components/data-table.md)), clé `work-schedules`, vue « Toutes » triée par début décroissant. Recherche « Rechercher (libellé, type, exception)… ».

| Colonne      | Édition en ligne                                                        | Filtre / tri / groupement         |
| ------------ | ----------------------------------------------------------------------- | --------------------------------- |
| « Libellé »  | Texte                                                                   | Tri                               |
| « Type »     | Liste (dont « Travail » / plages sans type)                             | Filtre par choix, tri, groupement |
| « Début »    | Date (une fin antérieure suit)                                          | Filtre date, tri                  |
| « Fin »      | Date, effaçable (« Sans fin »)                                          | Filtre date, tri                  |
| « Horaires » | — (une ligne par cas, « N exceptions » avec infobulle)                  | —                                 |
| « État »     | — (« En cours », « À venir », « Passée » — libellés de `PERIOD_STATES`) | Filtre, tri, groupement           |
| Commentaires | —                                                                       | —                                 |

Actions : « Nouvelles plages » ; par ligne « Modifier », « Dupliquer (sans dates ni exceptions) », archiver/restaurer, « Supprimer » ; sur une sélection : archiver/restaurer, supprimer (édition groupée des colonnes éditables). Les plages archivées sont en lecture seule (toujours suivies par les routines qui les utilisent). Suppression : la plage et ses exceptions sont supprimées définitivement (PRO : « elle ne comptera plus dans le temps prévu »), les espaces abonnés ne la voient plus, les évènements ne sont pas touchés. État vide : « Aucune plage. ».

### Formulaire de plages

« Nouvelles plages », « Modifier « X » », « Dupliquer « X » » :

- « Libellé » (requis, 250 caractères ; « Semaine type » par défaut) ;
- « Type » (vide : plages sans type, création possible « Nouveau type de plage ») ;
- « Période et horaires » (requis) : « À partir du », « Jusqu’au » (« Sans fin ») ; « Cas » : une règle, ou plusieurs cas chacun avec sa période ; chaque cas : règle de répétition, durée, horaires (« Journée entière » ou tranches « Ajouter des horaires ») ; nouveau cas : lundi à vendredi 09:00–17:00 ;
- « Exceptions (congés, horaires particuliers…) » : « Du », « Au », « Motif », case « Pause (aucune plage pendant cette période) », sinon ses propres cas ; « Ajouter une exception » (aujourd’hui, « Congés », pause) ;
- commentaires (plage existante).

Une copie reprend les cas et le type, sans dates ni exceptions (« choisissez ses dates »). Toasts « Plages créées. » / « Plages modifiées. » ; une erreur sur un champ sans saisie est annoncée par un toast.

### Formulaire d’une plage dans l’agenda (mode « Modifier les plages »)

« Plage du … » : « Jour », « Journée entière », « Début », « Fin », « Enregistrer… » (puis portée), « Supprimer ».

## Occurrence de routine dans l’agenda

« « Routine » du … » : « Jour » (pas avant le début de la routine), « À partir de », « Avant », « Enregistrer… » (portée demandée), « Supprimer » (cette occurrence, ou elle et les suivantes), « Ouvrir la routine ». Voir [Routines](routines.md).

## Condition de plages des tâches et routines

Le champ « Plages de l’agenda » (`SlotConditionBuilder`, le même pour les tâches et les routines) : condition facultative : « Créneau » (« sur l’un des créneaux », « hors des créneaux »), « Type de créneau » (« sur l’un des types », « hors des types » : toutes les plages de ces types, même ajoutées ensuite) et « Temps libre » (« hors de tous les créneaux », « hors de tous les créneaux sauf » certains de l’espace), combinés en groupes ET / OU comme les filtres des tableaux. Les plages et types de vos autres espaces sont proposés aussi, avec leur espace (« Sport · Perso »), abonné ou non ; les archivés ne sont plus proposés, ceux déjà choisis restent ; « Aucune condition : à n’importe quelle heure. ». Sans condition, une tâche ou une routine se fait n’importe quand, en PRO comme en PERSO.

## Exports

### Export PDF

« Vue en PDF » : A4 paysage, au gabarit commun des exports (logo, date, numéro de page), titre = période, sous-titre « Agenda » ; contient exactement ce qui est affiché (calendriers, tâches, routines, chronos, plages en fond). Mois : grille avec « +N autres » quand une case déborde. Semaine/jour : ligne journée entière (5 lignes max), heures de 8 h à 19 h au moins (élargies aux éléments), plages en fond, éléments simultanés côte à côte. Annulés et faits barrés ; aujourd’hui surligné. Fichier « Agenda — <période>.pdf ».

### Export iCalendar

« Exporter (.ics) » (un calendrier) ou « Tout exporter (.ics) » (« Tous les calendriers de l’espace, dans un fichier pour un autre agenda (Google, Apple, Outlook…) ») : téléchargement direct de `/api/exports/calendar.ics`. Voir les règles d’export dans [Règles de l’agenda](../../business-rules/activities/calendar.md#export-icalendar).

## Notifications

Les rappels d’évènements sonnent tant qu’Ordo est ouvert (et pour d’autres espaces selon leur réglage) : voir [Alarmes](alarms.md#rappels-dévènements-et-alertes-de-routines).

## Différences PRO / PERSO

- Nom des plages : « Plages de travail » (PRO) / « Plages » (PERSO).
- Avertissement hors plages dans le formulaire d’évènement : PRO seulement.
- Libellés des relations (« Relations » / « Proches ») et message de suppression des plages (temps prévu en PRO).
