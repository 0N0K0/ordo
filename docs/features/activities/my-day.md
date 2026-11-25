# Ma journée

Ce que l’utilisateur peut faire avec la page « Ma journée » : la liste d’un jour de l’espace courant, ses routines, tâches et évènements avec leurs horaires. Code : `apps/web/src/features/my-day/**` (voir [Code web de « Ma journée »](../../web/features/activities/my-day.md)) ; règles : [Règles de « Ma journée »](../../business-rules/activities/my-day.md).

## Page « Ma journée » (`/my-day`)

Route `PAGES.myDay.path` = `/my-day`, composant `MyDayPage`, premier lien du groupe « Activités » du menu (icône soleil).

- En-tête « Ma journée ».
- Navigation entre jours (`DayNav`) : « Aujourd’hui », « Jour précédent », le jour dans un sélecteur de date, « Jour suivant ». Aujourd’hui à l’ouverture ; le jour choisi n’est pas gardé dans l’adresse (comme l’historique des routines).
- Chargement : squelette de liste. Échec : « Journée indisponible » (« Les éléments de ce jour n’ont pas pu être chargés. Rechargez la page pour réessayer. »). Rien ce jour : « Rien de prévu aujourd’hui. » (« Rien de prévu ce jour-là. » un autre jour), icône soleil.
- Sinon, un bloc encadré, en quatre parties (règles : [Placement](../../business-rules/activities/my-day.md#placement)) :
  - **en tête** : éphémérides (en italique, couleur de leur type), évènements de toute la journée (« toute la journée ») et jours du milieu d’un évènement sur plusieurs jours, anniversaires, puis, aujourd’hui, routines en retard (« Depuis ven. 13 nov. ») et tâches en retard (« 3 j de retard ») ;
  - **« Sans horaire »** : les éléments que rien ne limite ce jour ;
  - **par heure** : chaque heure affichée (« 08:00 ») avec ses lignes ; les créneaux rencontrés pendant l’heure la colorent (couleur de leur type, heures de travail en vert) et sont nommés sous l’heure ; un créneau « Indisponible » la grise (« Indisponible ») ; aujourd’hui, l’heure de maintenant est marquée d’un trait à gauche ;
  - **« Faits et annulés »** : les faits (« faite à HH:MM » pour un moment de routine), puis les annulés.
- Une ligne : bouton d’état, heure où elle se range, nom (ouvre son panneau : la tâche, la routine sur cette occurrence, l’évènement), détails (retard, « Non faite » un jour passé pour un moment de routine, « (facultatif) », « aussi 14:00–16:00 » pour ses autres fenêtres, « début » / « fin » d’un évènement sur plusieurs jours, « Annulé »), puis son chrono et son menu « … ». Faite ou annulée : atténuée ; annulée : barrée.
  - Tâche : `TaskDoneButton` (un clic la ferme comme faite ou la rouvre, toast avec « Annuler »), chrono de la tâche (pas pour une tâche fermée), menu d’une ligne de tâche.
  - Moment de routine : bouton « Faite le » (comme le tableau des routines), chrono de la routine (pas pour un moment fait ou annulé), menu de l’occurrence (« Modifier », « Reporter au lendemain », « Reporter, changer l’horaire ou annuler… »…).
  - Évènement : pas de bouton d’état ; chrono de l’occurrence (son projet et ses tâches liées ; pas pour un évènement annulé), menu de l’occurrence (« Annuler l’évènement » / « Rétablir », « Reporter », « Archiver », « Supprimer »…).
  - Anniversaire : ouvre la fiche de la personne.
  - Les tâches et les routines liées à un évènement affiché sont sous lui, en retrait.
- Les réglages de la page (types affichés, projets et « Sans projet », faits et annulés, créneaux masqués) sont appliqués ; leur écran vient ensuite (voir [Réglages](../../business-rules/activities/my-day.md#réglages)).
