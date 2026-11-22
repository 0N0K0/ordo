# Temps passé et chrono

Ce que l’utilisateur peut faire avec le temps passé : la page « Chronos », l’onglet « Temps » d’un projet, le chrono (démarrer, mettre en pause, arrêter, abandonner) dans l’en-tête et ailleurs, les temps saisis à la main, la comparaison avec le temps prévu. Sources : `apps/web/src/features/time/**`, avec les cellules et le panneau des tâches (`apps/web/src/features/tasks/**`), `apps/web/src/app/layout/AppLayout.tsx` et `QuickActions.tsx`.

Règles appliquées par l’API : [Règles métier — Temps passé](../../business-rules/activities/time.md). Code : [Code web — Temps passé](../../web/features/activities/time.md). Voir aussi : [Tâches](tasks.md), [Routines](routines.md), [Agenda](calendar.md), [Facturation](../finances/accounting.md), [Alarmes](alarms.md), [Accueil](../cross-cutting/home.md).

## Où se trouve le temps

| Endroit                            | Adresse                        | Contenu                                                                                                                                  |
| ---------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Page « Chronos »                   | `/time` (`PAGES.time`)         | « Prévu et réalisé » (espace PRO) puis « Temps passé » : tous les temps, de tous les projets.                                            |
| Temps d’une tâche                  | `/time?task=<id>` (`timePath`) | La même page limitée aux temps de la tâche, avec un badge « Tâche : #12 Libellé » ; sa croix (« Voir tous les temps ») retire le filtre. |
| Onglet « Temps » d’un projet       | `/projects/:id?tab=time`       | Les temps du projet et de ses sous-projets.                                                                                              |
| En-tête de l’app                   | partout (pas sur téléphone)    | Les chronos en cours : celui qui tourne, ou « 2 chronos » et la liste.                                                     |
| Menu « Ajouter »                   | partout                        | « Chrono » ouvre « Nouveau chrono » (projet courant présélectionné sur une page de projet).                                              |
| Panneau d’une tâche                | `?task=<id>`                   | « Temps passé » de la tâche et « Démarrer le chrono ».                                                                                   |
| Colonne « Chrono » des tâches      | tableaux de tâches             | Démarrer / arrêter le chrono sur la tâche.                                                                                               |
| Colonne « Temps passé » des tâches | tableaux de tâches             | Lien vers les temps de la tâche.                                                                                                         |
| Accueil                            | `/`                            | Carte du chrono (`ChronoCard`, voir [Accueil](../cross-cutting/home.md)).                                                                |
| Agenda                             | `/calendar`                    | Les temps de la période (voir [Agenda](calendar.md)).                                                                                    |

## Le chrono

**Plusieurs chronos tournent à la fois** : chacun est montré et arrêté à part, et compte en entier dans les totaux (deux tâches menées en parallèle pendant 1 h font 2 h). Les **minuteurs** (comptes à rebours) et les **temps morts** sont à part : ce ne sont pas des temps passés (voir [Alarmes](alarms.md#minuteurs)).

### Démarrer

- Depuis « Démarrer le chrono » (page « Chronos », onglet « Temps » d’un projet), le menu « Ajouter » › « Chrono » : panneau « Nouveau chrono » (`TimerStartForm`) avec « Projet » (« Facultatif avec une tâche, une routine ou un évènement. »), « Routines », « Tâches » (celles du projet et de ses sous-projets, et celles sans projet ; sans projet, seulement celles sans projet), « Évènements » (ceux du jour), plusieurs de chaque, « Description » (markdown). Bouton « Démarrer le chrono », désactivé sans projet, ni routine, ni tâche, ni évènement.
- Depuis une tâche (colonne « Chrono », panneau de la tâche) : démarre directement sur la tâche et son projet (aucun pour une tâche sans projet).
- Depuis une routine ou un évènement : voir [Routines](routines.md) et [Agenda](calendar.md).
- Les chronos qui tournent déjà continuent. Toast : « Chrono démarré. ».
- Avertissement (toast) « Hors des moments prévus » si une routine ou une tâche est hors de ses créneaux, ou une tâche hors de ses horaires (« Libellé : hors de ses horaires »), ou si ses assignés sont pris par un évènement (autre que ceux du chrono) : « Le chrono tourne quand même. Libellé : pendant « Réunion » · … ».
- Bouton désactivé sur un élément archivé ou dans un projet archivé.

### Pendant qu’il tourne

- **En-tête** (`TimerWidget`, pastille `RunningPill`) : un seul chrono : point, projet (sinon première routine, premier évènement ou première tâche, suivi de « + N » pour les autres, `entrySubject`), horloge `1:05:09` ; clic : bulle « Détails du chrono » ; boutons pause / reprise et arrêt. Plusieurs : « 2 chronos » et l’horloge du plus long ; clic : la liste « Chronos en cours », chacun avec ce sur quoi il porte, son horloge, pause / reprise et arrêt, puis « Arrêter tout » (toast « 2 chronos arrêtés. Temps enregistré : 1 h 40. »). Le point est gris quand tous sont en pause.
- **Accueil** : chaque chrono en cours en détail, puis « Démarrer un autre chrono » ; sans chrono, le formulaire « Nouveau chrono ».
- **Détails** (`RunningTimer`, aussi sur l’accueil) : horloge, « Chrono en cours » ou « Chrono en pause », « depuis 09:12 », lien vers le projet (onglet « Temps ») ou vers les routines, sinon le libellé du premier évènement ou de la première tâche, sans lien ; « Pause » / « Reprendre », « Arrêter le chrono » (rouge), « Abandonner (sans enregistrer) » ; le projet, les routines, les tâches, les évènements (du jour du chrono) et la description restent modifiables (changer de projet vide les routines et les tâches ; la description s’enregistre à la sortie du champ ; retirer le dernier d’un chrono sans projet est refusé : « Choisissez un projet, une tâche, une routine ou un évènement. »).
- **Abandonner** : confirmation « Abandonner le chrono » : « Le temps en cours (12 min) ne sera pas enregistré. ». Toast « Chrono abandonné. ».
- **Arrêter** : toast « Temps enregistré : 1 h 05. ». Un chrono en pause s’arrête au début de sa pause.
- Une tâche ou une routine montre le chrono qui tourne sur elle (colonne « Chrono », panneau), même si d’autres tournent ailleurs.
- Dans le tableau des temps, un chrono en cours a le badge « Chrono en cours » à la place de sa durée ; il n’a pas de menu (il se modifie depuis le chrono).
- L’état des chronos est relu quand la fenêtre reprend le focus (un autre onglet a pu le changer).

## Le tableau des temps

Le même tableau (`TimeLog`) sur la page « Chronos » et l’onglet « Temps » d’un projet : tableau commun de l’app ([Tableaux](../../web/components/data-table.md)) avec vues enregistrées. Vues créées la première fois :

- « Cette semaine » (ouverte d’abord), « Ce mois-ci », « Tous » ; groupées par jour, du plus récent au plus ancien.

Colonnes :

| Colonne                     | Contenu, édition en place                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Date » (toujours visible) | Jour en toutes lettres ; modifiable (l’heure est gardée). Groupable.                                                                                      |
| « Mois »                    | Mois du temps.                                                                                                                                            |
| « Heure de début »          | Modifiable.                                                                                                                                               |
| « Heure de fin »            | Lecture seule (calculée).                                                                                                                                 |
| « Durée »                   | Modifiable en tapant « 1:30 », « 1h30 », « 90 » ou « 1,5h » ; total en pied et par groupe.                                                                |
| « Projet »                  | Modifiable (un projet ne peut être vidé que si le temps garde une tâche, une routine ou un évènement) ; le filtre garde les sous-projets.                  |
| « Routines »                | Routines du projet (et sans projet), en arbre, plusieurs. Groupable (un temps sur deux routines est dans les deux groupes).               |
| « Tâches »                  | Tâches du projet (et sans projet), en arbre, les fermées marquées « (fermée) ».                                                                           |
| « Évènements »              | Évènements de l’agenda du jour (chargés à l’ouverture), plusieurs. Groupable.                                                              |
| « Facture »                 | « Non facturé », badge « Brouillon » (gris) ou « Facturé : F-… » (vert), lien vers la facture. Filtre « Non facturé », « Sur un brouillon », « Facturé ». |
| « Commentaires »            | Nombre (la description compte pour un), masquée par défaut.                                                                                               |

- Recherche : « Rechercher (projet, routine, tâche, évènement) ».
- Barre : « 12 h 30 au total, dont 2 h 00 non facturé. » ou « …, tout est facturé. » (temps terminés des lignes affichées).
- Un temps est modifiable en place s’il est terminé et pas sur une facture validée ; sinon ses cellules sont en lecture seule.
- Sélection de cellules : une modification s’applique à toutes les cellules sélectionnées de la colonne ; pour les routines, tâches et évènements, chaque temps reçoit ceux ajoutés et perd ceux retirés. Retirer le dernier d’un temps sans projet est refusé (« Choisissez un projet, une tâche, une routine ou un évènement. »).
- Filtres « Routines » et « Évènements » : « inclut l’un de », « inclut tous », « n’inclut aucun de » ; un filtre enregistré « est » / « n’est pas » (quand la colonne n’avait qu’une valeur) se lit « inclut l’un de » / « n’inclut aucun de ».
- Menu d’une ligne (temps terminés) : « Modifier » (pas s’il est facturé sur une facture validée), « Dupliquer », « Supprimer » (idem).
- Sélection : « Supprimer les temps » (les temps facturés sont gardés : « (les temps facturés sont gardés) »).
- Vide : « Aucun temps pour le moment. » (page) / « Aucun temps sur ce projet. ».
- Boutons : « Nouveau temps », « Démarrer le chrono » (désactivés sur un projet archivé).

## Formulaire d’un temps

Panneau « Ajouter un temps » ou « Temps » (existant, `TimeEntryForm`) :

| Champ           | Détail                                                                                                                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Projet »      | « Facultatif avec une tâche, une routine ou un évènement. » : sans aucun des quatre, « Choisissez un projet, une tâche, une routine ou un évènement. ». Changer de projet vide les routines et les tâches.                     |
| « Début »       | Requis : le jour et l’heure dans un seul sélecteur (aujourd’hui à 09:00 par défaut).                                                                                                                                                       |
| « Durée »       | Requise (« 1:30, 1h30, 90 ou 1,5h » ; 1:00 par défaut).                                                                                                                                                                                      |
| « Routines »    | Plusieurs : routines du projet, de ses sous-projets et sans projet ; sans projet, les routines sans projet (« Sans projet : routines sans projet. ») ; les archivées ne sont proposées que si le temps les a ; avec plusieurs : « Le temps est réparti à parts égales entre les 2 routines. ». |
| « Tâches »      | Tâches du projet, de ses sous-projets et sans projet ; sans projet, les tâches sans projet (« Sans projet : tâches sans projet. ») ; avec plusieurs tâches : « Le temps est réparti à parts égales entre les 3 tâches. ».                                                                                                               |
| « Évènements »  | Plusieurs, parmi les évènements du jour choisi (« 09:00–10:00 · Titre », « Journée · Titre », « (annulé) ») : « Le temps passé sur des évènements de l’agenda : seule la part hors de ces évènements y apparaît. » (avec plusieurs : « … ; il est réparti à parts égales entre les 2 évènements. ») ; « Aucun évènement ce jour-là » s’il n’y en a pas. |
| « Description » | Markdown (« Ce que vous avez fait… »).                                                                                                                                                                                                       |

Bouton « Ajouter » pour un nouveau temps (toast « Temps ajouté. »). Un temps existant s'enregistre champ par champ : chaque champ dès qu'il change (« Durée » et « Description » en les quittant ; changer de projet vide et enregistre ensemble routines et tâches), sans bouton « Enregistrer » ; « Enregistrement… » puis « Enregistré » en haut du panneau ; un champ invalide garde son erreur dessous et n'est pas enregistré, un échec le remet comme il était, dans un toast d'erreur ; un champ changé ailleurs (une cellule, un autre onglet) est repris dans le panneau, sauf pendant sa saisie. « Dupliquer » enregistre tout de suite une copie (mêmes projet, tâches, routines, évènements, description, début et durée ; jamais facturée), « Temps dupliqué. », puis ouvre son panneau « Temps ». En modification, les commentaires du temps s’affichent sous le formulaire ([Commentaires](../cross-cutting/comments.md)).

Suppression d’un temps : confirmation « Supprimer le temps » : « Ce temps (1 h 30) sera supprimé définitivement et retiré du temps passé de ses tâches. ». Toast « Temps supprimé. ».

## Prévu et réalisé

En haut de la page « Chronos », **en espace PRO seulement** (en PERSO, les créneaux ne sont pas des heures de travail), et seulement s’il existe des créneaux de travail :

- jauges « Aujourd’hui » et « Cette semaine » : temps chronométré / temps prévu (orange au-delà de 100 %) ;
- une barre par jour de la semaine de l’espace (qui peut commencer un autre jour que lundi), info-bulle « 6 h 30 chronométrées sur 7 h 00 prévues » ;
- note : « Temps prévu par vos créneaux de travail (Agenda › Créneaux de travail), hors pauses. » (`schedulesTitle`, voir [Agenda](calendar.md)).
- Le chrono en cours compte en direct.
- Les éphémérides, les créneaux archivés et ceux d’un type archivé ne comptent pas dans le temps prévu ; s’il ne reste aucun créneau compté, la section ne s’affiche pas.

## Temps passé d’une tâche

- Colonne « Temps passé » et panneau d’une tâche : somme des parts de la tâche dans chaque temps terminé (un temps sur trois tâches compte un tiers pour chacune). De même pour une routine (colonne « Temps passé » des routines) et une occurrence d’évènement, entre les routines ou les évènements du temps.
- Supprimer une tâche, une routine ou un évènement supprime aussi les temps sans projet qui ne portent sur rien d’autre (la confirmation le dit : « 2 temps sans projet, qui ne portent sur rien d’autre, seront aussi supprimés (les temps facturés sont gardés). ») ; un temps facturé n’est jamais supprimé.
- Lien vers `/time?task=<id>`.

## Facturation

Les temps se facturent depuis une facture (voir [Facturation](../finances/accounting.md)). Dans la liste : badge de la facture ; un temps sur une facture validée ne se modifie ni ne se supprime (il reste duplicable).

## Espace PRO / PERSO

- « Prévu et réalisé » : PRO seulement.
- Le reste est identique.
