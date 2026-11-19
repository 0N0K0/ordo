# Temps passé et chrono

Ce que l’utilisateur peut faire avec le temps passé : la page « Chronos », l’onglet « Temps » d’un projet, le chrono (démarrer, mettre en pause, arrêter, abandonner) dans l’en-tête et ailleurs, les temps saisis à la main, la comparaison avec le temps prévu. Sources : `apps/web/src/features/time/**`, avec les cellules et le panneau des tâches (`apps/web/src/features/tasks/**`), `apps/web/src/app/layout/AppLayout.tsx` et `QuickActions.tsx`.

Règles appliquées par l’API : [Règles métier — Temps passé](../../business-rules/activities/time.md). Code : [Code web — Temps passé](../../web/features/activities/time.md). Voir aussi : [Tâches](tasks.md), [Routines](routines.md), [Agenda](calendar.md), [Facturation](../finances/accounting.md), [Alarmes](alarms.md), [Accueil](../cross-cutting/home.md).

## Où se trouve le temps

| Endroit                            | Adresse                        | Contenu                                                                                                                                  |
| ---------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Page « Chronos »                   | `/time` (`PAGES.time`)         | « Prévu et réalisé » (espace PRO) puis « Temps passé » : tous les temps, de tous les projets.                                            |
| Temps d’une tâche                  | `/time?task=<id>` (`timePath`) | La même page limitée aux temps de la tâche, avec un badge « Tâche : #12 Libellé » ; sa croix (« Voir tous les temps ») retire le filtre. |
| Onglet « Temps » d’un projet       | `/projects/:id?tab=time`       | Les temps du projet et de ses sous-projets.                                                                                              |
| En-tête de l’app                   | partout (pas sur téléphone)    | Le chrono en cours, s’il y en a un.                                                                                                      |
| Menu « Ajouter »                   | partout                        | « Chrono » ouvre « Nouveau chrono » (projet courant présélectionné sur une page de projet).                                              |
| Panneau d’une tâche                | `?task=<id>`                   | « Temps passé » de la tâche et « Démarrer le chrono ».                                                                                   |
| Colonne « Chrono » des tâches      | tableaux de tâches             | Démarrer / arrêter le chrono sur la tâche.                                                                                               |
| Colonne « Temps passé » des tâches | tableaux de tâches             | Lien vers les temps de la tâche.                                                                                                         |
| Accueil                            | `/`                            | Carte du chrono (`ChronoCard`, voir [Accueil](../cross-cutting/home.md)).                                                                |
| Agenda                             | `/calendar`                    | Les temps de la période (voir [Agenda](calendar.md)).                                                                                    |

## Le chrono

Un seul chrono tourne à la fois.

### Démarrer

- Depuis « Démarrer le chrono » (page « Chronos », onglet « Temps » d’un projet), le menu « Ajouter » › « Chrono » : panneau « Nouveau chrono » (`TimerStartForm`) avec « Projet » (« Facultatif avec une tâche. »), « Tâches » (celles du projet et de ses sous-projets, et celles sans projet ; sans projet, seulement celles sans projet), « Description » (markdown). Bouton « Démarrer le chrono », désactivé sans projet ni tâche (décision D17).
- Depuis une tâche (colonne « Chrono », panneau de la tâche) : démarre directement sur la tâche et son projet (aucun pour une tâche sans projet).
- Depuis une routine ou un évènement : voir [Routines](routines.md) et [Agenda](calendar.md).
- Si un chrono tourne déjà, il s’arrête et son temps est enregistré (décision Y). Les boutons le disent en info-bulle : « Le chrono en cours s’arrête (son temps est enregistré). ». Toast : « Chrono démarré. » ou « Chrono démarré. Le chrono en cours s’est arrêté. Temps enregistré : 1 h 05. ».
- Avertissement (toast) « Hors des moments prévus » si la routine ou une tâche est hors de ses créneaux, ou si ses assignés sont pris par un évènement (autre que celui du chrono) : « Le chrono tourne quand même. Libellé : pendant « Réunion » · … ».
- Bouton désactivé sur un élément archivé ou dans un projet archivé.

### Pendant qu’il tourne

- **En-tête** (`TimerWidget`) : point, projet (sinon routine, évènement ou première tâche, `entrySubject`), horloge `1:05:09` ; clic : bulle « Détails du chrono » ; boutons pause / reprise et arrêt.
- **Détails** (`RunningTimer`, aussi sur l’accueil) : horloge, « Chrono en cours » ou « Chrono en pause », « depuis 09:12 », lien vers le projet (onglet « Temps ») ou vers les routines, sinon le libellé de l’évènement ou de la première tâche, sans lien ; « Pause » / « Reprendre », « Arrêter le chrono » (rouge), « Abandonner (sans enregistrer) » ; le projet, les tâches et la description restent modifiables (changer de projet vide les tâches ; la description s’enregistre à la sortie du champ).
- **Abandonner** : confirmation « Abandonner le chrono » : « Le temps en cours (12 min) ne sera pas enregistré. ». Toast « Chrono abandonné. ».
- **Arrêter** : toast « Temps enregistré : 1 h 05. ». Un chrono en pause s’arrête au début de sa pause.
- Dans le tableau des temps, le chrono en cours a le badge « Chrono en cours » à la place de sa durée ; il n’a pas de menu (il se modifie depuis le chrono).
- L’état du chrono est relu quand la fenêtre reprend le focus (un autre onglet a pu le changer).

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
| « Routine »                 | Modifiable.                                                                                                                                               |
| « Tâches »                  | Tâches du projet (et sans projet), en arbre, les fermées marquées « (fermée) ».                                                                           |
| « Évènement »               | Évènement de l’agenda du jour (chargé à l’ouverture).                                                                                                     |
| « Facture »                 | « Non facturé », badge « Brouillon » (gris) ou « Facturé : F-… » (vert), lien vers la facture. Filtre « Non facturé », « Sur un brouillon », « Facturé ». |
| « Commentaires »            | Nombre (la description compte pour un), masquée par défaut.                                                                                               |

- Recherche : « Rechercher (projet, routine, tâche, évènement) ».
- Barre : « 12 h 30 au total, dont 2 h 00 non facturé. » ou « …, tout est facturé. » (temps terminés des lignes affichées).
- Un temps est modifiable en place s’il est terminé et pas sur une facture validée ; sinon ses cellules sont en lecture seule.
- Sélection de cellules : une modification s’applique à toutes les cellules sélectionnées de la colonne.
- Menu d’une ligne (temps terminés) : « Modifier » (pas s’il est facturé sur une facture validée), « Dupliquer », « Supprimer » (idem).
- Sélection : « Supprimer les temps » (les temps facturés sont gardés : « (les temps facturés sont gardés) »).
- Vide : « Aucun temps pour le moment. » (page) / « Aucun temps sur ce projet. ».
- Boutons : « Nouveau temps », « Démarrer le chrono » (désactivés sur un projet archivé).

## Formulaire d’un temps

Panneau « Ajouter un temps », « Modifier le temps » ou « Dupliquer le temps » (`TimeEntryForm`) :

| Champ           | Détail                                                                                                                                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Projet »      | « Facultatif avec une tâche, une routine ou un évènement. » : sans aucun des quatre, « Choisissez un projet, une tâche, une routine ou un évènement. » (décision D17). Changer de projet vide les tâches.                                     |
| « Routine »     | Facultative (les routines archivées ne sont proposées que si c’est la valeur actuelle).                                                                                                                                                      |
| « Tâches »      | Tâches du projet, de ses sous-projets et sans projet ; sans projet, les tâches sans projet (« Sans projet : tâches sans projet. ») ; avec plusieurs tâches : « Le temps est réparti à parts égales entre les 3 tâches. ».                                                                                                               |
| « Jour »        | Requis (aujourd’hui par défaut).                                                                                                                                                                                                             |
| « Début »       | Requis (09:00 par défaut).                                                                                                                                                                                                                   |
| « Durée »       | Requise (« 1:30, 1h30, 90 ou 1,5h » ; 1:00 par défaut).                                                                                                                                                                                      |
| « Évènement »   | Évènements du jour choisi (« 09:00–10:00 · Titre », « Journée · Titre », « (annulé) ») : « Le temps passé sur un évènement de l’agenda : seule la part hors de l’évènement y apparaît. » ; « Aucun évènement ce jour-là » s’il n’y en a pas. |
| « Description » | Markdown (« Ce que vous avez fait… »).                                                                                                                                                                                                       |

Boutons « Ajouter » / « Enregistrer ». Toasts « Temps ajouté. », « Temps modifié. », « Temps dupliqué. ». En modification, les commentaires du temps s’affichent sous le formulaire ([Commentaires](../cross-cutting/comments.md)).

Suppression d’un temps : confirmation « Supprimer le temps » : « Ce temps (1 h 30) sera supprimé définitivement et retiré du temps passé de ses tâches. ». Toast « Temps supprimé. ».

## Prévu et réalisé

En haut de la page « Chronos », **en espace PRO seulement** (en PERSO, les créneaux ne sont pas des heures de travail), et seulement s’il existe des créneaux de travail :

- jauges « Aujourd’hui » et « Cette semaine » : temps chronométré / temps prévu (orange au-delà de 100 %) ;
- une barre par jour de la semaine de l’espace (qui peut commencer un autre jour que lundi), info-bulle « 6 h 30 chronométrées sur 7 h 00 prévues » ;
- note : « Temps prévu par vos créneaux de travail (Agenda › Créneaux de travail), hors pauses. » (`schedulesTitle`, voir [Agenda](calendar.md)).
- Le chrono en cours compte en direct.

## Temps passé d’une tâche

- Colonne « Temps passé » et panneau d’une tâche : somme des parts de la tâche dans chaque temps terminé (un temps sur trois tâches compte un tiers pour chacune).
- Lien vers `/time?task=<id>`.

## Facturation

Les temps se facturent depuis une facture (voir [Facturation](../finances/accounting.md)). Dans la liste : badge de la facture ; un temps sur une facture validée ne se modifie ni ne se supprime (il reste duplicable).

## Espace PRO / PERSO

- « Prévu et réalisé » : PRO seulement.
- Le reste est identique.
