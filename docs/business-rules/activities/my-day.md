# Règles de « Ma journée »

Règles de la page « Ma journée » (menu Activités) : quelles tâches y sont un jour, où chaque élément du jour se range, et ses réglages. « Ma journée » est une liste du jour, pas une vue d’agenda : les routines, tâches et évènements du jour de l’espace courant, avec leurs horaires. Sources : `packages/shared/src/tasks/task-day.ts` (`taskDayReasons`, `isTaskOverdue`, `taskPlacement`), `packages/shared/src/calendar/my-day.ts` (`myDayRows`), `packages/shared/src/calendar/slot-conditions.ts` (`itemWindowsOn`), `packages/shared/src/calendar/my-day-settings.ts` (`readMyDaySettings`, `myDaySettingsSchema`), `apps/web/src/features/my-day/hooks/use-my-day.ts` (`useMyDay`), `apps/web/src/features/my-day/hooks/use-day-add.ts` (`useDayAdd`), `apps/web/src/features/calendar/hooks/use-calendar-filters.ts` (`useCalendarFilters`, le filtre de l’agenda), `apps/api/src/services/calendar/my-day-settings.ts`, `apps/api/src/graphql/modules/my-day.ts`. Tout est lu en jours et heures de Paris.

Voir aussi : [Tâches](tasks.md), [Routines](routines.md), [Agenda](calendar.md), [Dates](../cross-cutting/dates.md), [Espaces et accès](../cross-cutting/workspaces-and-access.md).

## Tâches du jour

Une tâche est dans « Ma journée » d’un jour pour au moins une de ces raisons (`taskDayReasons`, dans l’ordre de `TASK_DAY_REASONS`) ; sans aucune, elle n’y est pas.

| Raison | Règle |
| ------ | ----- |
| En retard (`late`) | Le jour affiché est aujourd’hui et la tâche est en retard (`isTaskOverdue` : « Échéance » suivie passée, tâche ouverte ; voir [Dates et retard](tasks.md#dates-et-retard)). Un autre jour, une tâche en retard n’y est pas par son retard. |
| Échéance (`due`) | Son « Échéance » suivie (la sienne, sinon celle de son parent, de son jalon ou de son premier sprint : [Dates suivies](tasks.md#dates-suivies)) est ce jour. |
| En cours (`inProgress`) | Son statut est de la catégorie « En cours » (`IN_PROGRESS`, voir [Catégories de statut](tasks.md#catégories-de-statut)) : aujourd’hui ; un jour passé, seulement si l’un de ses temps (chrono ou temps saisi, voir [Temps passé](time.md)) a tourné pendant ce jour de Paris (`entryMeets`, un chrono en cours jusqu’à maintenant) ; jamais un jour à venir. |
| Prévue (`planned`) | Ses dates (« Début » – « Fin ») la placent ce jour dans l’agenda (`taskPlacement`) : tous les jours du début à la fin ; un début passé sans fin, du début à aujourd’hui ; un début seul à venir, ce jour ; une fin seule, ce jour. |
| Période d’ouverture (`open`) | Elle a une « Ouverture » et une « Échéance » suivies, et le jour est de l’une à l’autre (bornes comprises). Une « Ouverture » seule, ou une « Échéance » seule, n’ouvre pas de période ; une « Ouverture » suivie après l’« Échéance » suivie (dates héritées, non comparées) ne couvre que le jour de l’échéance. |
| Faite (`done`) | Fermée comme terminée, le jour de Paris de sa fermeture (`closedAt`). |
| Annulée (`cancelled`) | Fermée comme annulée, le jour de Paris de sa fermeture (une tâche terminée puis annulée garde sa date de fermeture). |

- Les raisons d’une tâche ouverte (retard, échéance, en cours, prévue, période) ne comptent que pour une tâche ouverte ; une tâche fermée n’est que le jour de sa fermeture, faite ou annulée, quelles que soient ses dates.
- Toutes les tâches de l’espace sont regardées ; le filtre de la page (voir [Réglages](#réglages)) n’est pas une règle.

## Fenêtres où un élément peut se faire

Les fenêtres d’un jour où une tâche ou une routine peut se faire (`itemWindowsOn`) : dans ses horaires propres s’il en a (les « Horaires » d’une tâche, voir [Horaires](tasks.md#horaires)), permises par sa condition de créneaux, hors des créneaux « Indisponible » de l’espace (voir [Condition de créneaux](calendar.md#condition-de-créneaux-des-tâches-et-routines)). C’est exactement ce que permet le test « faisable » (`conditionAllowsAt`), minute par minute :

- rien ne la limite (ni horaires, ni condition, ou un groupe vide, ni créneau indisponible ce jour) : aucune fenêtre, n’importe quand ;
- aucune fenêtre ce jour (horaires d’autres jours, type sans créneau, créneau indisponible toute la journée) : elle ne peut pas se faire ce jour, et n’est pas dans « Ma journée » ce jour-là (voir [Placement](#placement)) ;
- les fenêtres se suivent dans l’ordre, sans se toucher ; un créneau jusqu’à 23:59 va jusqu’à la fin du jour, la fin d’une fenêtre est exclue.

## Éléments de la page

La page « Ma journée » (menu Activités, espace courant) montre aujourd'hui à son ouverture, puis le jour choisi (jour précédent / suivant, ou une date). Elle rassemble pour ce jour (`useMyDay`) :

- **Tâches** : toutes les tâches non archivées de l'espace qui ont une raison ce jour (voir [Tâches du jour](#tâches-du-jour)) ; un jour passé, leurs temps de ce jour sont chargés (requête `timeEntries` sur le jour), pour « En cours ». Elles se rangent par leurs fenêtres (`itemWindowsOn` : leurs « Horaires », leur condition de créneaux, les créneaux « Indisponible »).
- **Routines** : chaque moment d'une occurrence ouverte ce jour (de son premier jour à son échéance) ; fait, le jour où il a été fait seulement ; une occurrence annulée, le jour de son échéance ; aujourd'hui, en plus, les moments non faits et non facultatifs de l'occurrence en cours d'une routine en retard (échéance passée, « Depuis … »), réduits aux heures que sa condition de créneaux et les créneaux « Indisponible » permettent aujourd'hui (aucune : pas dans la page). Un jour passé, un moment non fait d'une occurrence dont l'échéance est passée est « Non faite » (un moment facultatif non). Un moment coché depuis un jour passé est proposé ce jour-là, à son heure prévue, sinon à l'heure de maintenant (`routineTickPrefill` avec ce jour ; aujourd'hui, comme partout : le jour de son échéance). Une routine parente ne s'y voit que par ses sous-routines (elle se coche avec elles : [Coches d'une routine parente](routines.md#coches-dune-routine-parente)) ; une routine archivée n'y est pas. Un moment coupé par des créneaux (plusieurs fenêtres) se range à l'une d'elles ; sinon à son heure « dès », sinon « jusqu'à ».
- **Évènements** : les occurrences des calendriers de l'espace ce jour (pas celles des calendriers abonnés, ni les archivées), annulées comprises (barrées), celles sur plusieurs jours chacun de leurs jours.
- **Éphémérides** de l'espace et des types abonnés d'un autre espace ce jour (ni archivées, ni d'un type archivé, dans leur espace), et **anniversaires** des personnes de l'espace (archivées exclues), en tête.
- **Créneaux des heures** : ceux de l'espace et des types abonnés d'un autre espace (ni archivés, ni d'un type archivé, dans leur espace : un créneau d'un autre espace archivé là-bas, ou d'un type archivé là-bas, n'y est pas), « Indisponible » tel que l'espace le règle.

Rien d'archivé n'est dans la page, et elle n'a pas d'« Afficher les archivés » : ni tâche archivée, ni routine archivée ou occurrence archivée, ni évènement archivé ou d'un calendrier archivé, ni créneau ou éphéméride archivé ou d'un type archivé, ni anniversaire d'une personne archivée ; les calendriers proposés dans les réglages sont ceux non archivés de l'espace, et les créneaux et éphémérides proposés ceux de l'espace et des types abonnés ni archivés ni d'un type archivé, dans leur espace. Elle n'a pas non plus de graduation « Par 5 minutes » : c'est une liste rangée par heure, pas une grille.

Chaque ligne a son bouton d'état (une tâche : faite / à faire ; un moment de routine : « Faite le » ; aucun pour un évènement, qui s'annule ou se reporte par son menu), son chrono (un évènement prend son projet et ses tâches liées), son nom qui ouvre son panneau, et son menu (celui de la tâche, de l'occurrence de la routine ou de l'occurrence de l'évènement). Le menu d'une occurrence d'un évènement répété l'annule ou la rétablit seule, sans demander la portée (« Supprimer » la demande) ; une occurrence de routine s'annule par « Reporter, changer l'horaire ou annuler… ». Les réglages ci-dessous filtrent ces éléments avant le placement.

## Ajouter un élément du jour

« Ajouter » crée, dans le panneau latéral, par les formulaires de création habituels, un élément prérempli avec le jour affiché, quel qu’il soit : aujourd’hui, un jour à venir, et aussi un jour passé :

- **Tâche** : son « Ouverture » et son « Échéance » sont ce jour.
- **Évènement** : comme un jour choisi dans l’agenda, toute la journée ce jour-là, dans le premier calendrier non archivé de l’espace que les réglages ne masquent pas (aucun : sans calendrier, à choisir).
- **Routine** : sa « Première fois » est ce jour.

Tout le reste est celui d’un nouvel élément, et tout, dates comprises, est modifiable avant « Créer ». Le menu « Ajouter » de l’en-tête, ouvert sur « Ma journée », préremplit de même sa « Tâche », son « Évènement » et sa « Routine » avec le jour affiché (`useDayAdd`, la même règle) ; ailleurs, sa « Routine » est une nouvelle routine vierge (son projet présélectionné sur une page de projet, comme une tâche). Le jour n’est prérempli qu’une fois les réglages et les calendriers chargés (« Ajouter » de la page est désactivé jusque-là ; celui de l’en-tête ajoute alors sans jour).

## Placement

Les éléments du jour se rangent en quatre blocs (`myDayRows`), dans cet ordre :

1. **En tête** : éphémérides, évènements de toute la journée, jours du milieu d’un évènement sur plusieurs jours, anniversaires, puis routines en retard (« Depuis … »), puis tâches en retard, aujourd’hui seulement (un autre jour, une routine se range à son heure, une tâche à sa place).
2. **Sans horaire** : les éléments sans heure et sans limite (une tâche, ou une routine sans horaire, que rien ne limite ce jour, une seule fenêtre de toute la journée comprise).
3. **Par heure** :
   - un évènement à son heure de début ; sur plusieurs jours, son premier jour à son heure de début, son dernier jour à son heure de fin (un évènement qui finit à minuit a fini la veille : il n’est pas le jour de sa fin) ;
   - un moment de routine à son heure « dès », sinon à son heure « jusqu’à » ;
   - une tâche, ou une routine sans horaire, limitée par des fenêtres : à une seule de ses fenêtres, la prochaine encore à venir aujourd’hui (une fenêtre commencée est encore à venir et se range à l’heure de maintenant ; toutes passées : la dernière, à son début), la première un autre jour, à son début ; ses autres fenêtres sont écrites dans sa ligne ;
   - à heure égale : évènements, puis routines, puis tâches, puis l’ordre donné ;
   - seules les heures qui ont un élément ou un créneau s’affichent, et l’heure de maintenant aujourd’hui (marquée) ; chaque heure porte les créneaux rencontrés pendant elle (fond coloré) et dit si l’un est « Indisponible » (grisé) ; un créneau de toute la journée colore les heures affichées sans les faire toutes afficher.
4. **En bas** : les faits, dans l’ordre où ils l’ont été (routines « faite à HH:MM »), puis les tâches et routines annulées, même en retard. Un évènement annulé reste à sa place, barré.

Une tâche ou une routine qui ne peut pas se faire ce jour (aucune fenêtre) n’est pas dans « Ma journée » ce jour-là, même en retard, à son échéance ou liée à un évènement ; faite ou annulée ce jour, elle reste en bas. Ses horaires et sa condition de créneaux disent quand elle se fait : une tâche des heures de travail n’apparaît pas un jour sans travail, une tâche de la maison ne se range jamais pendant les heures de travail (et pas du tout un jour où elle n’a aucune fenêtre), qu’elle soit en retard ou non.

Une tâche ou une routine liée à un évènement affiché ce jour se range sous cet évènement (de ses évènements liés affichés ce jour, le premier dans l’ordre où ils lui sont liés), et nulle part ailleurs, même en retard ou faite : sous l’évènement, les éléments liés suivent l’ordre des heures, faits et annulés en dernier. Liée à un évènement qui n’est pas affiché ce jour, elle se range seule.

## Réglages

Les filtres et choix d'affichage de « Ma journée » sont ceux de l'agenda, repris tels quels (mêmes champs, mêmes règles qu'une vue de l'agenda, voir [Agenda › Filtres](../../features/activities/calendar.md#filtres)) : un filtre par sorte d'éléments affichée, pas un filtre commun, pour ne rien approcher. Ils sont enregistrés sur le serveur, **par utilisateur et par espace** : un seul jeu de réglages (pas de vues multiples, pas de copie de travail), le même dans tous les onglets et appareils de l'utilisateur, différent d'un espace à l'autre (`UserWorkspaceSettings.myDay`, champ JSON, une ligne par utilisateur et par espace). Ce sont des filtres de la page : ils ne changent ni les tâches du jour ni le placement ci-dessus.

| Réglage | Champ | Par défaut |
| ------- | ----- | ---------- |
| Tâches affichées | `tasks` | oui |
| Routines affichées | `routines` | oui |
| Créneaux et éphémérides affichés, avec les anniversaires | `schedules` | oui |
| Calendriers masqués (ceux de l'espace) | `hiddenCalendarIds` | aucun : tous affichés |
| Créneaux et éphémérides masqués, un par un : de l'espace, ou des types abonnés d'un autre espace (ni archivés, ni d'un type archivé, dans leur espace : les autres ne sont pas proposés) | `hiddenScheduleIds` | aucun : tous affichés |
| Filtre de chaque sorte d'éléments : `events`, `tasks`, `routines`, `slots`, `ephemerides` (et `timers`, gardé vide : la page n'a pas de chronos) | `filters` | aucun filtre |

- Application, comme dans l'agenda : un évènement d'un calendrier masqué n'est pas dans la page ; sans « Tâches » ou « Routines », aucune tâche ou aucune routine ; sans « Créneaux et éphémérides », ni éphémérides, ni anniversaires, ni créneaux sur les heures. Un créneau ou une éphéméride masqué n'est pas dans la page. Chaque filtre ne s'applique qu'aux éléments de sa sorte, dans l'espace, avec les règles du tableau de sa sorte (`useCalendarFilters`) : une routine gardée l'est avec toutes ses occurrences ; ce qui vient d'un autre espace (créneaux et éphémérides des types abonnés) n'est pas filtré, seuls les créneaux masqués s'y appliquent ; les anniversaires ne sont pas filtrés. Projet, assignés, faits ou annulés se filtrent par les colonnes du tableau de chaque sorte, comme dans l'agenda.
- Un créneau masqué ou écarté par le filtre ne colore plus les heures, mais compte toujours pour les fenêtres (le placement ne change pas).
- Les créneaux et les calendriers sont enregistrés par ceux qui sont **masqués** : un créneau ou un calendrier créé ensuite est affiché.
- Jamais choisis : les valeurs par défaut. Lecture (`readMyDaySettings`, le schéma d'une vue de l'agenda réduit à ces champs) : un champ absent ou invalide prend sa valeur par défaut (une liste d'ids qui n'en est pas une, ou de plus de 500 ids : aucun masqué ; un filtre invalide : aucun filtre), une clé inconnue est ignorée, quelle qu'elle soit.
- Un calendrier ou un créneau supprimé depuis n'est pas une erreur : son id reste enregistré, sans effet.
- Une valeur tapée dans un filtre (texte, nombre, nombre de jours) n'est enregistrée qu'en quittant son champ (ou Entrée), comme dans l'agenda et les tableaux ; les choix le sont aussitôt.
- Enregistrement : tout le jeu à la fois (`updateMyDaySettings`), lu par `myDaySettingsSchema` comme une vue de l'agenda (un champ invalide prend sa valeur par défaut) ; les ids ne sont pas comparés aux calendriers et créneaux de l'espace. Les enregistrements faits coup sur coup attendent les uns les autres : celui qu'un plus récent attend n'est pas envoyé (le plus récent porte tout), et les réglages ne sont relus qu'après le dernier.
- Accès : un utilisateur ne lit et n'écrit que **ses** réglages (l'utilisateur de la session, jamais un id envoyé), et seulement dans l'espace de la requête dont il est membre (il y a son profil « Moi », voir [Personnes](../cross-cutting/people.md#-moi-)) ; sinon « Espace introuvable. » (`NOT_FOUND`). Supprimer l'espace ou l'utilisateur supprime ses réglages.
