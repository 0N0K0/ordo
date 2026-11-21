# Alarmes

Ce que l’utilisateur peut faire avec les alarmes : la page `/alarms` (« Alarmes »), les alarmes d’une tâche, et ce qui sonne pendant qu’Ordo est ouvert (alarmes, rappels des tâches, des routines, des évènements, des éphémérides et des anniversaires), y compris pour les autres espaces. Code : `apps/web/src/features/alarms/**` (voir [Code web des alarmes](../../web/features/activities/alarms.md)) ; règles : [Règles des alarmes](../../business-rules/activities/alarms.md).

## Types d’alarmes

| Type                | Libellé dans le formulaire | Quand elle sonne                                                                                             |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `REMINDER`          | « Rappel »                 | « Sonne aux dates et heures prévues. »                                                                       |
| `NOT_TRACKING`      | « Si pas de chrono »       | « Sonne aux dates et heures prévues, seulement si aucun chrono ne tourne (ex. « Lance ton chrono » à 9 h). » |
| `TRACKING_DURATION` | « Pendant le chrono »      | « Sonne après chaque durée de chrono (ex. une pause toutes les 50 minutes). »                                |

Les alarmes ne sonnent que tant qu’Ordo est ouvert dans un onglet du navigateur.

## Page « Alarmes » (`/alarms`)

Route `PAGES.alarms.path` = `/alarms`, composant `AlarmsPage`. Contenu centré, 7 colonnes au plus.

- En-tête « Alarmes » avec « Nouvelle alarme » (désactivé tant que le contexte des tâches n’est pas chargé).
- Tant que le navigateur n’a ni autorisé ni refusé les notifications : encart « Notifications du navigateur » (« Autorisez-les pour voir les alarmes même quand l’onglet d’Ordo n’est pas au premier plan. ») avec « Autoriser les notifications ».
- Section « Minuteurs » : les minuteurs en cours (voir plus bas), « Aucun minuteur en cours. », « Lancer un minuteur ».
- Section « Alarmes » : chargement : squelette de liste. Vide : « Aucune alarme. ». Liste des alarmes, triées par date, heure puis création : une carte par alarme.

### Carte d’une alarme

- Libellé ; badge « Terminée » pour une alarme active planifiée qui ne sonnera plus.
- Description de la programmation : « Le 3 nov. 2026 à 09:00 », « Tous les jours à 07:30 », suivi de « , si aucun chrono ne tourne » pour `NOT_TRACKING` ; « Toutes les 50 min de chrono » / « Chaque minute de chrono » pour `TRACKING_DURATION`.
- « Prochaine : … » (prochaine sonnerie, alarmes actives planifiées).
- Lien vers la tâche (« Projet #12 Libellé ») ou à défaut le projet.
- Description (note), sur plusieurs lignes.
- Interrupteur « Activer « X » » / « Désactiver « X » » : une alarme inactive est estompée.
- Actions : « Modifier », « Dupliquer », « Supprimer » (confirmation « Supprimer l’alarme » : « L’alarme « X » sera supprimée définitivement et ne sonnera plus. », toast « Alarme supprimée. »).

## Formulaire d’alarme

Panneau latéral « Nouvelle alarme » ou « Alarme » (existante). Ouvert depuis la page, la section « Alarmes » d’une tâche, la cellule « Alarmes » du tableau des tâches, la carte « Chrono et alarmes » de l’accueil, et les actions rapides « Ajouter › Alarme ».

| Champ                              | Détail                                                                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Libellé »                        | Requis, 250 caractères ; exemple « Appeler le client, faire une pause… »                                                                                                                            |
| Type (« Type d’alarme »)           | « Rappel » (défaut), « Si pas de chrono », « Pendant le chrono », avec l’aide du type                                                                                                               |
| « Toutes les » … « min de chrono » | Type « Pendant le chrono » : requis, 1 à 1 440 ; 50 par défaut                                                                                                                                      |
| « Date, heure et répétition »      | Autres types : requis. Résumé ; la fenêtre de répétition commune contient la règle (aucune : une seule fois), « Date » (ou « À partir du » si répétée) et « Heure ». Par défaut aujourd’hui à 09:00 |
| « Projet »                         | Facultatif ; le changer vide la tâche                                                                                                                                                               |
| « Tâche »                          | Choisir d’abord un projet (« Choisissez d’abord un projet ») ; tâches que prend un chrono sur ce projet                                                                                             |
| « Description »                    | Texte multiligne, 4 000 caractères                                                                                                                                                                  |
| « Active »                         | Activée par défaut                                                                                                                                                                                  |

Bouton « Créer l’alarme » pour une nouvelle alarme (toast « Alarme créée. »). Une alarme existante s’enregistre champ par champ : chaque champ dès qu’il change (« Libellé », « Description » et les minutes en les quittant ; le projet et la tâche vidée ensemble), sans bouton « Enregistrer » ; « Enregistrement… » puis « Enregistré » en haut du panneau ; un champ invalide garde son erreur dessous et n’est pas enregistré, un échec le remet comme il était, dans un toast d’erreur. « Dupliquer » enregistre tout de suite une copie qui reprend tout, avec le suffixe de copie dans le libellé (« Alarme dupliquée. »), puis ouvre son panneau « Alarme ».

Modifier la programmation d’une alarme repart de zéro : les occurrences déjà passées ne sonnent pas.

## Minuteurs

Un minuteur compte à rebours une durée et sonne à sa fin, par la sonnerie commune (voir [Ce qui sonne](#ce-qui-sonne)). Plusieurs tournent à la fois ; ils sont à l’utilisateur, les mêmes dans tous ses espaces et sur tous ses appareils (gardés par l’API). Ce n’est pas du temps passé.

- **Lancer** : « Ajouter › Minuteur », « Lancer un minuteur » (page « Alarmes », liste de l’en-tête, carte « Chrono et alarmes » de l’accueil) : panneau « Nouveau minuteur » (`CountdownForm`) : « Nom » (facultatif, « Minuteur » par défaut), « Durée » (requise : « 10 », « 1:30 », « 1h30 », « 1,5 h » ; « Durée attendue : 1:30, 1h30, 90 (minutes) ou 1,5 h. »), durées proposées en un clic (1, 3, 5, 10, 15, 30 min, 1 h), « Sonnerie » (« Celle des réglages » par défaut, `RingtoneSelect`), bouton « Lancer » ; toast « Minuteur lancé : 10 min. ».
- **En-tête** (`CountdownWidget`, pas sur téléphone) : point orange, le nom du minuteur qui sonnera le premier (ou « 2 minuteurs ») et son temps restant `0:09:58` ; clic : la liste des minuteurs.
- **Un minuteur** (`CountdownRow`) : nom, son élément (temps mort), temps restant en direct et barre de progression ; « Pause » / « Reprendre », « + 1 min », « + 5 min », « Annuler » (croix, sans confirmation : rien de durable n’est perdu ; toast « Minuteur annulé. »).
- **À la fin** : il sonne comme une alarme : titre = son nom, « Minuteur de 10 min terminé », son élément et un lien vers lui (« Projet #12 Libellé », « Voir les routines ») ; « Arrêter », « Répéter dans N min ». Il quitte alors la liste.

### Temps morts

Une tâche ou une routine a des **temps morts** : des attentes pendant lesquelles on fait autre chose (« Lave-linge », 1 h 30), avec une alarme à la fin du temps estimé. Ce n’est pas du temps passé.

- **Champ « Temps morts »** (`DeadTimesField`) du panneau d’une tâche (colonne de droite, après « Rappels ») et d’une routine (après « Temps à y consacrer ») : une ligne par temps mort : libellé (« Le libellé est requis. »), durée estimée (« 1:30 » ; « Durée attendue : … »), « Sonnerie » ; « Lancer » (icône minuteur ; « Enregistrez d’abord l’élément. » sur une nouvelle routine), « Retirer » ; « Ajouter un temps mort » (30 min par défaut ; 20 au plus). Chaque temps mort s’enregistre dès qu’il est valide, en quittant ses champs ; un temps mort laissé invalide garde son erreur et retient l’enregistrement. Les minuteurs lancés pour l’élément s’affichent dessous, avec leurs commandes.
- **Lancer** : « Lancer » d’une ligne, le menu « … » d’une tâche (tableau, panneau) ou d’une routine (tableau : son occurrence en cours ; panneau : celle ouverte), section « Temps morts » : « Lancer « Lave-linge (1 h 30) » » ; l’agenda du jour des routines (panneau d’un moment : un bouton par temps mort, pour cette occurrence). Tous ouvrent « Lancer un temps mort · Lessive » : le formulaire du minuteur prérempli (nom, durée, sonnerie du temps mort, durée modifiable ; « Temps mort » pour en choisir un autre de l’élément).

## Alarmes d’une tâche

Dans le panneau d’une tâche, section « Alarmes » : ses alarmes (mêmes cartes, sans le lien vers la tâche), « Aucune alarme pour cette tâche. », et « Ajouter une alarme » (pré-remplie avec la tâche, son projet et son titre). Dans le tableau des tâches, la colonne « Alarmes » affiche le nombre d’alarmes actives de la tâche et un bouton « Nouvelle alarme » (voir [Tâches](tasks.md)).

## Accueil

La carte « Chrono et alarmes » affiche la prochaine alarme (« Prochaine alarme : libellé · date ») et permet d’en programmer une (voir [Accueil](../cross-cutting/home.md)).

## Ce qui sonne

Composant `AlarmCenter`, monté dans la mise en page de l’application : il vérifie toutes les 15 secondes.

Une sonnerie = la sonnerie choisie (celle du rappel, sinon celle des réglages ; silencieuse tant que l’onglet n’a reçu ni clic ni touche), qui sonne pendant la durée réglée, en boucle ou une fois ; une notification système (si autorisée) ; et un toast qui reste, avec des liens et deux boutons :

- « Arrêter » : la sonnerie s’arrête pour de bon, dans tous les onglets et appareils.
- « Répéter dans N min » (N : la répétition des réglages, 5 sans répétition) : silencieuse, elle resonne dans N minutes.

Sans réponse, la sonnerie se tait à la fin de sa durée ; avec une répétition, elle resonne N minutes plus tard, et ainsi de suite jusqu’à « Arrêter » (le toast indique « Sonne à nouveau à HH:MM ») ; sans répétition, le toast reste, silencieux, jusqu’à « Arrêter ». Plusieurs alarmes peuvent sonner en même temps : chacune a son toast et ses boutons. Un lien du toast (« Voir l’agenda »…) le garde. L’état d’une sonnerie (en train de sonner, en attente, arrêtée) survit à un rechargement et se retrouve dans les autres onglets et appareils (suivi chaque minute) : « Arrêter » comme « Répéter dans N min » faits ailleurs sont suivis, et une sonnerie remontrée garde « Marquer comme faite » (routine de l’espace ouvert) et « Ouvrir la fiche » (anniversaire) ; elle est oubliée 6 heures après son dernier changement.

### Réglages de la sonnerie

Dans « Mon compte », section « Sonnerie des alarmes », pour tous les espaces : durée, boucle, répétition, sonnerie (avec « Écouter »), « Sonner hors de l’app » et ses appareils (voir [Mon compte](../cross-cutting/account.md)). Six sonneries générées par l’app : Carillon, Bip, Marimba, Cloche, Réveil, Harpe.

### Hors de l’app (notifications push)

Avec « Sonner hors de l’app » et un appareil ajouté, ce qui sonne quand l’app est fermée (alarmes, rappels, minuteurs, de tous les espaces) arrive en notification sur les appareils (Android Chrome visé, l’app installée ou non) : le son et la vibration du système, une fois par envoi, avec le titre et les lignes du toast, et deux boutons « Arrêter » et « Répéter dans N min ». Le serveur la renvoie à chaque répétition des réglages jusqu’à « Arrêter » (la nouvelle remplace l’ancienne). Toucher la notification ouvre l’app sur la page de son lien, dans son espace. La sonnerie choisie et la boucle ne jouent que dans l’app ouverte : un onglet visible reçoit la sonnerie poussée et la fait sonner lui-même (pas de notification). Délai : 30 secondes après l’heure au moins (l’app ouverte sonne d’abord), plus le réveil du serveur (jusqu’à quelques minutes sur l’hébergement) ; au réveil, ce qui est dû depuis 6 heures au plus est envoyé. Règles : [Alarmes, hors de l’app](../../business-rules/activities/alarms.md#hors-de-lapp-notifications-push).

### Alarmes

- Planifiées (`REMINDER`, `NOT_TRACKING`) : à leur heure ; une occurrence manquée (application fermée) sonne à l’ouverture si elle date de moins de 6 heures. Une occurrence n’est sonnée qu’une fois ; `NOT_TRACKING` ne sonne pas si un chrono au moins tourne (l’occurrence est quand même comptée comme passée).
- `TRACKING_DURATION` : à chaque multiple de la durée de chacun des chronos en cours (hors pause ; plusieurs chronos à la fois). Les paliers déjà franchis à la première vérification ne sonnent pas.
- Toast : icône d’alarme, libellé, note, lien vers la tâche (« Projet #12 Libellé ») ou le projet.

### Rappels des tâches, des routines et des évènements

Les rappels (« Rappels », 10 au plus, de types mêlés : « Au début », « N min avant », « À HH:MM le jour J », « N jours avant, à HH:MM » (1 à 30 jours)) fonctionnent de la même façon partout, en heure de Paris, au plus 6 heures en retard, quel que soit l’espace ouvert ; ils sont à côté des alarmes, qui restent. Pour les évènements, ils se comptent aussi depuis la **fin** ; pour les routines, depuis le début ou la fin du jour de l’ouverture ou de celui de l’échéance. L’éditeur a **une ligne par rappel** : « Ajouter un rappel », « Retirer » ; sur chaque ligne, « Le jour J » (une heure le jour même ; « Chaque jour » pour une tâche), sinon un nombre et son unité (« min », « h », « jours ») suivis de « avant », « Depuis » (évènements : « le début » / « la fin » ; routines : « le début de l’ouverture », « la fin de l’ouverture », « le début de l’échéance », « la fin de l’échéance »), et « à » une heure pour un rappel à une heure ; les erreurs sous les champs une fois quittés ; « Sonneries » replié sous la liste.

- Évènements : « Au début », minutes avant le début (24 heures au plus ; journée entière : minuit du premier jour), ou à une heure du premier jour ou de N jours avant ; de même depuis la fin (la fin de l’évènement ; journée entière : minuit après le dernier jour ; « À HH:MM » le dernier jour) ; les occurrences d’hier à J+31 sont rechargées toutes les 5 minutes ; une occurrence annulée ne sonne pas. Toast : libellé, « Journée entière » ou date et heure, lieu ; lien « Voir l’agenda ».
- Routines : minutes (24 heures au plus) avant le début ou la fin de chaque moment non coché (« dès » / « jusqu’à » ; sans heure, de 0 h à minuit), le jour de l’ouverture ou celui de l’échéance de l’occurrence, ou à une heure de l’un de ces jours ou de N jours avant (une fois par occurrence) ; reporté au prochain moment libre pendant un évènement qui occupe ses assignés (dans l’app pour l’espace ouvert, et hors de l’app) ; pour l’occurrence en cours tant qu’elle n’est pas faite et pour la suivante ; pendant un évènement qui occupe ses assignés, le rappel attend le prochain moment libre. Toast : libellé, horaires du moment et lieu ; actions « Marquer comme faite » (occurrence en cours) et « Voir les routines ». Voir [Routines](routines.md).
- Tâches : à une heure seulement, à une ou plusieurs heures du jour, chaque jour de l’ouverture à l’échéance (le jour de l’échéance seulement sans ouverture), ou une fois N jours avant l’échéance ; aucun sans échéance ; une tâche fermée ou archivée ne sonne pas. Toast : libellé, « Échéance » ; lien vers la tâche. Voir [Tâches](tasks.md).
- Éphémérides : leurs rappels (panneau d’une éphéméride) comptent depuis le premier jour de chaque suite de jours qu’elle couvre (minuit pour une journée entière) ; une éphéméride archivée ne sonne pas. Toast : libellé, jour ; lien « Voir l’agenda ».
- Anniversaires : les « Rappels d’anniversaire » d’un membre de l’équipe ou du foyer ou d’une relation (le jour même ou N jours avant, à une heure). Toast : « Anniversaire de Paul — 40 ans » (l’âge quand l’année de naissance est connue), le jour ; action « Ouvrir la fiche ». Voir [Personnes](../../business-rules/cross-cutting/people.md#coordonnées-date-de-naissance-anniversaire).

### Plusieurs onglets

Une occurrence n’est sonnée que par un seul onglet (de n’importe quel espace) : le premier qui la réclame dans le stockage du navigateur ; de même pour chaque répétition. Les autres onglets montrent son toast (à la minute suivante au plus tard) ; « Arrêter » ou « Répéter » dans l’un vaut aussitôt pour les autres.

### Notifications des autres espaces

Pour chaque autre espace, le composant `ElsewhereNotifier` fait toujours sonner ses alarmes (rechargées chaque minute) et les rappels de ses évènements, tâches, routines, éphémérides et anniversaires (rechargés toutes les 5 minutes ; un anniversaire ouvre l’agenda de cet espace), sans choix de l’espace ; ses nouveaux mails selon son réglage « Nouveaux mails » (voir [Espaces](../cross-cutting/workspaces.md)). Les rappels d’une routine d’un autre espace n’attendent pas un moment libre et ne proposent pas « Marquer comme faite ». Le toast indique « Espace « X » » et ses liens ouvrent cet espace.

## Différences PRO / PERSO

Aucune : les alarmes fonctionnent de la même façon dans les deux genres d’espace.
