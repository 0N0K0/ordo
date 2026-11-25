# Règles de « Ma journée »

Règles de la page « Ma journée » (menu Activités) : quelles tâches y sont un jour, et où chaque élément du jour se range. « Ma journée » est une liste du jour, pas une vue d’agenda : les routines, tâches et évènements du jour de l’espace courant, avec leurs horaires. Sources : `packages/shared/src/tasks/task-day.ts` (`taskDayReasons`, `isTaskOverdue`, `taskPlacement`), `packages/shared/src/calendar/my-day.ts` (`myDayRows`), `packages/shared/src/calendar/slot-conditions.ts` (`itemWindowsOn`). Tout est lu en jours et heures de Paris.

Voir aussi : [Tâches](tasks.md), [Routines](routines.md), [Agenda](calendar.md), [Dates](../cross-cutting/dates.md).

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
- Toutes les tâches de l’espace sont regardées ; « à moi / sans assigné » est un filtre de la page, pas une règle.

## Fenêtres où un élément peut se faire

Les fenêtres d’un jour où une tâche ou une routine peut se faire (`itemWindowsOn`) : dans ses horaires propres s’il en a (les « Horaires » d’une tâche, voir [Horaires](tasks.md#horaires)), permises par sa condition de créneaux, hors des créneaux « Indisponible » de l’espace (voir [Condition de créneaux](calendar.md#condition-de-créneaux-des-tâches-et-routines)). C’est exactement ce que permet le test « faisable » (`conditionAllowsAt`), minute par minute :

- rien ne la limite (ni horaires, ni condition, ou un groupe vide, ni créneau indisponible ce jour) : aucune fenêtre, n’importe quand ;
- aucune fenêtre ce jour (horaires d’autres jours, type sans créneau, créneau indisponible toute la journée) : elle ne peut pas se faire ce jour, et n’est pas dans « Ma journée » ce jour-là (voir [Placement](#placement)) ;
- les fenêtres se suivent dans l’ordre, sans se toucher ; un créneau jusqu’à 23:59 va jusqu’à la fin du jour, la fin d’une fenêtre est exclue.

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
