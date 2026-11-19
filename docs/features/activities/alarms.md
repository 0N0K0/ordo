# Alarmes

Ce que l’utilisateur peut faire avec les alarmes : la page `/alarms` (« Alarmes »), les alarmes d’une tâche, et ce qui sonne pendant qu’Ordo est ouvert (alarmes, rappels d’évènements, alertes de routines), y compris pour les autres espaces. Code : `apps/web/src/features/alarms/**` (voir [Code web des alarmes](../../web/features/activities/alarms.md)) ; règles : [Règles des alarmes](../../business-rules/activities/alarms.md).

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
- Chargement : squelette de liste. Vide : « Aucune alarme. ».
- Liste des alarmes, triées par date, heure puis création : une carte par alarme.

### Carte d’une alarme

- Libellé ; badge « Terminée » pour une alarme active planifiée qui ne sonnera plus.
- Description de la programmation : « Le 3 nov. 2026 à 09:00 », « Tous les jours à 07:30 », suivi de « , si aucun chrono ne tourne » pour `NOT_TRACKING` ; « Toutes les 50 min de chrono » / « Chaque minute de chrono » pour `TRACKING_DURATION`.
- « Prochaine : … » (prochaine sonnerie, alarmes actives planifiées).
- Lien vers la tâche (« Projet #12 Libellé ») ou à défaut le projet.
- Description (note), sur plusieurs lignes.
- Interrupteur « Activer « X » » / « Désactiver « X » » : une alarme inactive est estompée.
- Actions : « Modifier », « Dupliquer », « Supprimer » (confirmation « Supprimer l’alarme » : « L’alarme « X » sera supprimée définitivement et ne sonnera plus. », toast « Alarme supprimée. »).

## Formulaire d’alarme

Panneau latéral « Nouvelle alarme », « Modifier l’alarme » ou « Dupliquer l’alarme ». Ouvert depuis la page, la section « Alarmes » d’une tâche, la cellule « Alarmes » du tableau des tâches, la carte « Chrono et alarmes » de l’accueil, et les actions rapides « Ajouter › Alarme ».

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

Boutons « Créer l’alarme » / « Enregistrer ». Toasts « Alarme créée. », « Alarme modifiée. », « Alarme dupliquée. ». Une copie reprend tout, avec le suffixe de copie dans le libellé.

Modifier la programmation d’une alarme repart de zéro : les occurrences déjà passées ne sonnent pas.

## Alarmes d’une tâche

Dans le panneau d’une tâche, section « Alarmes » : ses alarmes (mêmes cartes, sans le lien vers la tâche), « Aucune alarme pour cette tâche. », et « Ajouter une alarme » (pré-remplie avec la tâche, son projet et son titre). Dans le tableau des tâches, la colonne « Alarmes » affiche le nombre d’alarmes actives de la tâche et un bouton « Nouvelle alarme » (voir [Tâches](tasks.md)).

## Accueil

La carte « Chrono et alarmes » affiche la prochaine alarme (« Prochaine alarme : libellé · date ») et permet d’en programmer une (voir [Accueil](../cross-cutting/home.md)).

## Ce qui sonne

Composant `AlarmCenter`, monté dans la mise en page de l’application : il vérifie toutes les 15 secondes.

Une sonnerie = un carillon de trois notes (si l’onglet a déjà reçu un clic ou une touche, sinon silencieux), une notification système (si autorisée) et un toast d’information qui reste jusqu’à fermeture, avec des liens.

### Alarmes

- Planifiées (`REMINDER`, `NOT_TRACKING`) : à leur heure ; une occurrence manquée (application fermée) sonne à l’ouverture si elle date de moins de 6 heures. Une occurrence n’est sonnée qu’une fois ; `NOT_TRACKING` ne sonne pas si un chrono tourne (l’occurrence est quand même comptée comme passée).
- `TRACKING_DURATION` : à chaque multiple de la durée du chrono en cours (hors pause). Les paliers déjà franchis à la première vérification ne sonnent pas.
- Toast : icône d’alarme, libellé, note, lien vers la tâche (« Projet #12 Libellé ») ou le projet.

### Rappels d’évènements et alertes de routines

- Rappels d’évènements : les occurrences d’hier à J+8 sont rechargées toutes les 5 minutes ; chaque rappel sonne à « début − minutes » (journée entière : minuit local du premier jour), au plus 6 heures en retard. Toast : libellé, « Journée entière » ou date et heure, lieu ; lien « Voir l’agenda ».
- Alertes de routines : pour les routines du jour non cochées, chaque heure du jour non cochée sonne à ses minutes avant son moment (heure de départ, sinon début de sa fenêtre, sinon son heure limite), au plus 6 heures en retard ; pendant un évènement qui occupe ses assignés, l’alerte attend le prochain moment libre. Toast : libellé, « Partir à HH:MM » le cas échéant, fenêtre et lieu ; actions « Marquer comme faite » et « Voir les routines ». Voir [Routines](routines.md).

### Plusieurs onglets

Une occurrence n’est sonnée que par un seul onglet (de n’importe quel espace) : le premier qui la réclame dans le stockage du navigateur.

### Notifications des autres espaces

Pour chaque autre espace, selon son réglage « notifications quand un autre espace est ouvert » (alarmes, agenda, mails — voir [Espaces](../cross-cutting/workspaces.md)), le composant `ElsewhereNotifier` vérifie ses alarmes (rechargées chaque minute), ses rappels d’évènements (toutes les 5 minutes) et ses nouveaux mails. Le toast indique « Espace « X » » et ses liens ouvrent cet espace.

## Différences PRO / PERSO

Aucune : les alarmes fonctionnent de la même façon dans les deux genres d’espace.
