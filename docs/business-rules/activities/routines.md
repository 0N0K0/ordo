# Règles des routines

Règles appliquées par l'API et le code partagé aux routines : validation, calcul des occurrences (règle, cas, « Ouverture », créneaux), états, coches, exceptions (déplacements), historique, ordre, archivage et suppression. Sources : `apps/api/src/services/routines/routines.ts`, `apps/api/src/graphql/modules/routines.ts`, `packages/shared/src/routines/` (`routines.ts`, `routine-views.ts`), `packages/shared/src/calendar/slot-conditions.ts`. L'usage côté écran est dans [Routines](../../features/activities/routines.md).

## Modèle

Tables Prisma : `Routine`, `RoutineCategory` (arbre), `RoutineDependency` (« A dépend de B »), `RoutineRelation` (« relative à », symétrique, stockée une seule fois avec `routineAId < routineBId`), `RoutineCheck` (un moment d'une occurrence coché). Les fiches et listes à cocher d'une routine sont décrites dans [Règles des fiches](../supplies/sheets.md).

Champs d'une routine qui comptent pour les occurrences :

| Champ           | Rôle                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `startDate`     | « Première fois » : la règle compte à partir de ce jour.                                                                                      |
| `recurrence`    | Règle de répétition commune aux évènements, alarmes et créneaux (voir [Dates](../cross-cutting/dates.md)).                                      |
| `moments`       | Moments de la journée de la règle : `[{ fromTime, dueTime, optional }]`.                                                                      |
| `slotCondition` | Condition sur les créneaux de l'agenda (groupe ET / OU), suivant la règle.                                                                      |
| `opensOn`       | « Ouverture » des occurrences de la règle.                                                                                                  |
| `cases`         | Cas (chacun : `from`, `until`, `recurrence`, `slots`, `condition`, `opens`) ; non vide, ils remplacent la règle, ses moments et sa condition. |
| `moves`         | Exceptions : `[{ from, to, times }]` (jours `YYYY-MM-DD`).                                                                                    |
| `archivedAt`    | Archivée : plus aucune occurrence qui s'ouvre à partir du jour de l'archivage, celles ouvertes avant restent, archivées (décision D21). `archivedByCascade` : archivée avec sa routine parente. |

Anciennes formes encore lues mais plus écrites : `fromTime` / `dueTime` seuls (un seul moment), `scheduleIds` / `excludedScheduleIds` (créneaux suivis / exclus, convertis en condition), `scheduleId` / `scheduleAnchor` (créneau suivi, plus utilisé), `opensOn` en texte `"DD"` (mensuel) ou `"MM-DD"` (annuel).

## Validation (`routineSchema`, `parseRoutine`)

Source : `packages/shared/src/routines/routines.ts`, `apps/api/src/services/routines/routines.ts`.

| Champ                                                                                  | Règle et message                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`                                                                                | Requis (« Le libellé est requis. »), 250 caractères au plus (`TEXT_MAX`, « 250 caractères maximum. », décision DO), espaces retirés.                                                                                                                                 |
| `description`                                                                          | Markdown, 65 536 caractères au plus (« Texte trop long. ») ; blanche enregistrée `null`.                                                                                                                                                                             |
| `categoryIds`                                                                          | 100 au plus ; doublons retirés ; chacune doit exister (« Catégorie »).                                                                                                                                                                                               |
| `startDate`                                                                            | Jour valide requis (« La date de début est requise. »).                                                                                                                                                                                                              |
| `recurrence`                                                                           | Règle valide ; si elle a une date de fin, elle doit suivre la date de début (« La fin de la répétition doit suivre la date de début. »).                                                                                                                             |
| `estimate`                                                                             | Entier, 1 minute (« Au moins 1 minute. ») à 24 heures (« 24 heures maximum. »), ou `null`.                                                                                                                                                                           |
| `fromTime`, `dueTime`                                                                  | `HH:MM` (« Heure attendue (HH:MM). ») ou `null` ; la fin doit suivre strictement le début (« La fin doit suivre le début. »).                                                                                                                                        |
| `moments`                                                                              | 10 au plus (« 10 moments au plus. ») ; chacun : fin après début ; s'il y en a, au moins un obligatoire (« Au moins un moment doit être obligatoire. »).                                                                                                              |
| `cases`                                                                                | 20 au plus (« 20 cas au plus. ») ; chaque cas : 1 à 10 moments (« Ajoutez au moins un moment. », « 10 moments au plus. »), au moins un obligatoire, « Ouverture » compatible.                                                                                      |
| `slotCondition`                                                                        | Groupe de conditions ; champs `schedules` (créneaux, anniversaires d’une personne) et `kinds` (types de créneaux, `birthday` : tous les anniversaires, lot 16c) avec `in` / `notIn`, champ `freeTime` avec `isEmpty` / `notIn` (sinon « Sur ou hors des créneaux. ») ; créneaux et types de cet espace ou d'un autre espace de l'utilisateur ; chacun doit exister (« Créneau », « Type de créneau », « Espace », « Contributeur », « Relation ») et ne pas être archivé, sauf s'il était déjà dans une condition de la routine (`assertConditionSchedules`, commun avec les tâches, voir [Agenda](calendar.md#condition-de-créneaux-des-tâches-et-routines)).                                                                          |
| `reminders`                                                                            | Rappels (décision D16, `remindersSchema`) : 10 au plus (« 10 rappels maximum. »), de types mêlés : `{ before }` minutes de 0 à 1 440 (« 24 heures maximum. »), `{ at }` heure `HH:MM`, `{ at, days }` « N jours avant, à HH:MM » (1 à 30 jours, lot 16), chacun depuis l’un des quatre repères d’une occurrence (`anchor` : début ou fin du jour de l’ouverture, début ou fin du jour de l’échéance, décision FV) et avec sa sonnerie ou non (`ringtone`) ; doublons retirés, triés.                                                                                                                                                                                |
| `deadTimes`                                                                            | Temps morts (décision FT, lot 17b) : `[{ label, minutes, ringtone? }]`, 20 au plus ; requis à chaque enregistrement (comme `links` : un champ omis ne les efface pas) ; « Lancer » l’un d’eux lance un minuteur rattaché à la routine et à une occurrence ; ce n’est pas du temps passé. Voir [Alarmes](alarms.md#temps-morts). |
| `location`                                                                             | 250 caractères au plus (« 250 caractères maximum. ») ; sans lieu, ou sans ses deux coordonnées, le point est effacé (`storedLocation`, commun avec les évènements et les tâches).                                                                                                                                                                               |
| `links`                                                                                | Liens (décision D5), ceux des évènements : 20 au plus (« 20 liens maximum. »), adresse http ou https (« Lien invalide (http ou https). »), libellé facultatif de 250 caractères (`itemLinksSchema`) ; requis dans l’entrée comme `relatedIds` (`[]` pour aucun) : une entrée qui les omet est refusée au lieu de les effacer (décision EE). |
| `travelBefore`, `travelAfter`                                                          | Minutes de trajet (schéma géo commun), 0 par défaut.                                                                                                                                                                                                                 |
| `opensOn`                                                                              | Refusée avec des cas, ou si elle ne convient pas à la fréquence : « Cette ouverture ne vaut pas pour cette répétition : un jour du mois (mensuelle), de l'année (annuelle), ou des jours avant. » Mode `BEFORE` : 1 (« Au moins 1. ») à 366 (« 366 maximum. ») jours. |
| `assigneeIds`, `beneficiaryIds`, `beneficiaryRelationIds`, `requiredIds`, `relatedIds` | 100 au plus chacun, doublons retirés.                                                                                                                                                                                                                                |

Références vérifiées par `parseRoutine` :

- Projet actif (« Projet ») ; un projet archivé déjà en place est accepté.
- Assignés existants (« Assigné ») et, si la routine a un projet, contributeurs de ce projet (ceux déjà assignés restent) : voir [Personnes](../cross-cutting/people.md).
- Changement de projet (formulaire, modification en masse, annulation) : les assignés restent et **suivent** la routine ; ceux qui ne sont pas rattachés au nouveau projet (ni à un de ses parents) y sont rattachés (`followProject`, décision DP). Les sous-routines gardent leur projet et leurs assignés. Retirer le projet ne rattache personne.
- Bénéficiaires existants et non archivés (ceux déjà en place restent).
- Catégories et créneaux non archivés, sauf ceux déjà présents sur la routine.
- Parente : doit exister (« Routine parente »), non archivée (sauf si inchangée), ni la routine elle-même ni une de ses sous-routines (« Une routine ne peut pas être rangée sous elle-même. »).
- Dépendances : chaque routine requise doit exister (« Routine »), non archivée (sauf si déjà présente) ; pas elle-même (« Une routine ne peut pas dépendre d'elle-même. ») ; pas de cycle, même indirect (« Ces dépendances forment une boucle. »).
- « Relative à » (`relatedIds`) : chaque routine doit exister (« Routine »), non archivée (sauf si déjà liée) ; pas elle-même (« Une routine ne peut pas être liée à elle-même. »).
- Dépendances et relations dans la **même arborescence de projets** que la routine, comme les tâches (décision DS) : une routine nouvellement liée d'une autre arborescence est refusée, « Les routines liées doivent appartenir au même projet ou à l’un de ses sous-projets. » ; sans projet : « Une routine sans projet ne se lie qu’à des routines sans projet. » (sous `requiredIds` ou `relatedIds`). Un lien déjà en place hors de l'arborescence reste tant qu'elle n'en change pas.
- Changement d'arborescence de projets (formulaire, modification en masse, édition sur place) : ses liens avec les routines restées hors de la nouvelle arborescence sont retirés sans erreur, dans les deux sens (celles dont elle dépend, celles qui dépendent d'elle, ses relations), comme lors d'un transfert de tâche. `updateRoutine`, `patchRoutine` et `bulkUpdateRoutines` renvoient le nombre de liens retirés (`removedLinks`), annoncé à l'utilisateur comme pour les tâches. Une sélection changée de projet d'un coup (`bulkUpdateRoutines`) part ensemble, comme un transfert de tâches en masse : les liens entre ses routines restent, seuls tombent ceux avec les routines restées hors de la nouvelle arborescence (`movedWith`, `outsideMovedTree` commun avec `moveTaskTrees`).
- `restoring` (annulation d'une modification en masse) : les valeurs archivées remises sont acceptées, seul ce contrôle est sauté.

Normalisation à l'enregistrement :

- Un horaire seul (`fromTime` / `dueTime` sans moments ni cas, anciens clients) devient un moment.
- Avec des cas : `moments` et `slotCondition` sont vidés.
- `scheduleIds`, `excludedScheduleIds` (convertis en condition avant), `scheduleId`, `scheduleAnchor` sont remis à vide ; `fromTime` / `dueTime` prennent ceux du premier moment.

## Catégories

Source : `treeListService('routineCategory', …)` dans `routines.ts`, schéma `routineCategorySchema`.

- Libellé requis, 250 caractères au plus ; couleur `#rrggbb` facultative ; parente facultative.
- Créée en dernier parmi ses sœurs ; modifiée sous une autre parente, elle passe en dernier ; déplacée à un index (dernier sans index).
- Pas de boucle : « Une catégorie ne peut pas être rangée sous elle-même. » ; parente manquante : « Catégorie parente ».
- Supprimée : ses routines la perdent, ses sous-catégories remontent d'un niveau.
- Archivage par la mutation commune `setArchived` (voir [Archivage](../cross-cutting/archiving.md)) : une catégorie archivée n'est plus choisissable, celles déjà en place restent.

## Calcul des occurrences

Source : `apps/api/src/services/routines/routines.ts` (`ruleSpans`, `occurrencesOf`, `occurrenceSpansBetween`, `slotsOf`), `packages/shared/src/routines/routines.ts`, `packages/shared/src/calendar/slot-conditions.ts`. Tout est calculé en jours de Paris (`parisToday`).

### Occurrence

Une occurrence va de son premier jour (son ouverture) à son jour d'échéance (son dernier jour). Elle est identifiée par son jour d'échéance.

- Source : les cas s'il y en a, sinon la règle (`storedRule`). Une routine enregistrée avec des créneaux suivis avant les conditions (`scheduleIds` sans `slotCondition`) se répète chaque jour.
- Un cas compte à partir de son `from` (jamais avant la première fois de la routine) jusqu'à son `until`. Un jour dû par plusieurs cas suit le premier cas (`routineCaseOn`).
- Rien avant `startDate`. Une routine archivée n'a plus aucune occurrence due ni à venir ; celles ouvertes (premier jour) avant le jour de son archivage (heure de Paris, `archivedOn`) restent, archivées, en lecture seule, même dues ce jour-là ou après ; aucune qui s'ouvre à partir de ce jour. La restaurer remet toutes ses occurrences, comme avant (décision D21, Q5).

### « Ouverture » (`routineOpenDate`)

- `BEFORE` : `days` jours avant l'échéance ; valable pour toute fréquence.
- `DAY` (le n du mois, ou d'un mois pour une règle annuelle), `WEEKDAY` (le 1er à 4e ou dernier jour de semaine du mois), `WEEK` (un jour de semaine de la semaine 1 à 6 du mois, semaines du lundi, la première étant celle du 1er ; en annuel, semaine ISO 1 à 53) : seulement pour une règle mensuelle (sans mois) ou annuelle (avec mois, ou semaine ISO) (`opensFits`).
- Le jour est pris dans la période de l'échéance ; s'il tombe après l'échéance, celui de la période précédente.
- Sans ouverture (ou si elle ne convient pas), l'occurrence s'ouvre le jour de son échéance.

### Créneaux de l'agenda (`conditionWindows`, `windowsAllowed`)

- `schedules in [ids]` : sur les horaires d'un de ces créneaux ; `notIn` : hors de tous.
- `kinds in [types]` : sur les horaires d'un créneau de l'un de ces types (ceux créés plus tard compris) ; `notIn` : hors de tous. Un type sans aucun créneau ne permet aucun moment : la routine n'a alors aucune occurrence faisable tant qu'aucun créneau de ce type n'existe (comportement voulu). Créneaux et types d'un autre espace de l'utilisateur comptent comme ceux de l'espace (voir [Agenda](calendar.md#condition-de-créneaux-des-tâches-et-routines)).
- `freeTime isEmpty` : hors de tous les créneaux de l'espace (y compris ceux créés plus tard) ; `freeTime notIn [ids]` : hors de tous sauf ceux nommés (des créneaux de l'espace). Les créneaux des autres espaces n'y comptent pas, ni les éphémérides (lot 16).
- Les éphémérides (et leurs types) se citent par `schedules` et `kinds` comme des créneaux (voir [Agenda](calendar.md#éphémérides-lot-16-décision-fm)).
- Un créneau archivé, un créneau d'un type archivé et l'anniversaire d'une personne archivée ne comptent nulle part : ni `in`, ni `notIn`, ni le temps libre (décision FQ, 2026-11-20 ; avant, les créneaux archivés comptaient encore). La condition peut continuer à les citer.
- Groupes : ET = intersection, OU = union. Un groupe vide ne contraint rien.
- Horaires fusionnés quand ils se touchent ; un horaire « toute la journée » couvre la journée ; un horaire finissant à 23:59 va jusqu'à la fin du jour.
- Chaque moment est réduit aux heures permises (plusieurs fenêtres si des horaires le coupent) ; un moment sans heure permise disparaît ce jour-là. Une occurrence dont aucun jour n'a de moment permis n'est pas programmée (`doable`) : elle n'existe pas (agenda, liste, état, rappels, « à faire », comptes), **sauf si elle a déjà été faite** (au moins un moment coché) : elle reste alors (lot 12). Les occurrences cochées des routines à condition ou à cas sont chargées une fois par requête avec les créneaux (`loadScheduleContext`, `checked`).
- Un changement de créneau (création, modification, suppression ; `createWorkSchedule`, `updateWorkSchedule`, `deleteWorkSchedule`, argument `confirmLoss`) qui fait ainsi disparaître des occurrences de routines de l'espace passe par la même confirmation qu'un changement de règle (décision EW, `settleScheduleChange`) : leurs commentaires sont supprimés une fois confirmé, sinon `CONFIRMATION_REQUIRED` et rien ne change. Sont regardées les routines non archivées, à condition ou à cas, de l'espace, et celles des autres espaces de l'utilisateur dont une condition cite un créneau de cet espace ou un de ses types (lues et réglées dans leur espace, `runInWorkspace`, comme `assertConditionSchedules` / `loadSlotsOn`). La suppression d'un type de créneau (`deleteScheduleType` : ses créneaux deviennent sans type) et la conversion d'un créneau ou d'un type entre créneau et éphéméride (`setWorkScheduleEphemeris`, `setScheduleTypeEphemeris`, lot 16 : une éphéméride sort du temps libre) passent par la même confirmation. De même (décision FQ, 2026-11-20) : l'archivage et la restauration d'un créneau ou d'un type (`setArchived`, `confirmLoss` : un archivé ne donne plus aucun moment), et tout changement de l'anniversaire d'une personne de l'espace pour les routines dont une condition cite un anniversaire (la personne, ou « Anniversaires ») : date de naissance changée ou retirée, contributeur ou relation créé avec une date, archivé, restauré ou supprimé, relation liée à un contributeur ou déliée (`createContributor`, `updateContributor`, `deleteContributor`, `saveTreasuryRelation`, `deleteTreasuryRelation`, `setArchived` des genres `CONTRIBUTOR` et `TREASURY_RELATION`, argument `confirmLoss` ; `settleScheduleChange({ people })`, les autres espaces ne citant pas ces anniversaires). Les occurrences cochées restent.

### Occurrence en cours et suivante (`occurrencesOf`)

- En cours : la dernière ouverte au plus tard aujourd'hui ; suivante : la première qui s'ouvre après aujourd'hui.
- Recherche à ± 35 jours, puis ± 400 jours si rien n'est trouvé (règles mensuelles, annuelles, pauses).
- Une fois la règle terminée, une dernière occurrence passée n'est plus « en cours ».
- Exceptions (`movedOccurrences`) : une occurrence déplacée n'a plus lieu à son jour mais au jour où elle va. Si la dernière occurrence de la règle est déplacée plus loin, rien n'est dû jusqu'au jour où elle va (les précédentes ne reviennent pas). Les occurrences suivantes déplacées sont sautées (60 au plus).
- Champs GraphQL : `currentDate`, `nextDate`, `firstDate` (première occurrence, cherchée sur 10 ans).
- Jour d'affichage (`shownDay`) : l'échéance une fois passée, aujourd'hui pendant qu'elle court, son premier jour avant.

### Moments d'une occurrence (`slotsOf`)

- Ceux de la règle (ou du cas) pour son jour d'échéance, réduits par la condition sur le jour où elle s'affiche ; à défaut, le premier jour de l'occurrence qui a des moments.
- Une occurrence déplacée garde les moments de son jour d'origine (réduits sur le nouveau jour), avec les horaires que son exception change.
- Champ `slots` : moments de l'occurrence en cours (de la suivante avant qu'elle commence), avec `index`, `fromTime`, `dueTime`, `optional`, `done`, `windows`.
- `windowFrom` / `windowTo` : horaires du moment à venir (le premier non coché obligatoire, sinon le premier non coché, sinon le premier).

### États (`routineState`)

Source : `packages/shared/src/routines/routines.ts`, `ROUTINE_STATES`.

| État                     | Règle                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `upcoming` (« À venir ») | Pas d'occurrence en cours. Le web y range aussi une routine due dont un évènement occupe les assignés maintenant.        |
| `done` (« Faite »)       | Occurrence en cours faite.                                                                                               |
| `late` (« En retard »)   | Occurrence en cours non faite, échéance avant aujourd'hui.                                                               |
| `due` (« À faire »)      | Occurrence en cours non faite, échéance aujourd'hui (ou plus tard, pendant son ouverture).                         |

`done` (champ GraphQL) : il y a une occurrence en cours, elle a au moins un moment, et chaque moment est coché ou facultatif.

« En attente » (web, `waitingFor`) : une routine requise, non archivée, a une occurrence en cours non faite (calcul gardé tel quel par la décision DS).

### Départ, retour, rappels (`routineSchedule`, `routineSlotSpan`, `reminderOccurrences`)

- Avec une heure limite : départ = limite − (trajet aller + temps estimé) ; retour = limite + trajet retour.
- Avec une heure de début seulement : départ = début − trajet aller ; retour = début + temps estimé + trajet retour.
- Sans temps estimé (ou 0), partout 30 min (`ROUTINE_DEFAULT_MINUTES`, `routineMinutes`, décision FX) : départ et retour, agenda du jour, agenda, rappels.
- Les heures restent dans la journée (modulo 24 h).
- Rappels (décisions D16, FV) : un « avant » (« Au début », « N min avant ») compte depuis l’un des quatre repères de l’occurrence (`anchor`) pour chaque moment non coché : le **début de l’ouverture** (défaut : le premier jour, « Ouverture », à l’heure de début du moment), la **fin de l’ouverture** (`openEnd`), le **début de l’échéance** (`dueStart` : le jour dû) ou la **fin de l’échéance** (`end`). Le début et la fin d’un moment (`routineSlotSpan`, décision FW, les mêmes pour l’agenda du jour et les rappels, dans l’app et sur le serveur) : son « dès » et son « jusqu’à » ; sans « jusqu’à », la fin est « dès » + le temps estimé (minuit après le jour au plus) ; sans « dès », le début est « jusqu’à » − le temps estimé (00:00 au plus tôt). Sans temps estimé (ou 0) : 30 min (`ROUTINE_DEFAULT_MINUTES`, décision FX du 2026-11-21, remplace le repli de D16 / FV « jusqu’à minuit » ou « depuis le « jusqu’à » ») : un moment « dès 08:00 » finit à 08:30, un moment « jusqu’à 10:00 » commence à 09:30, pour l’affichage comme pour les rappels (« 15 min avant la fin » d’un moment « dès 08:00 » sonne à 08:15). Un moment **sans aucune heure** n’a pas de rappel « avant » (décision FW, comme avant FV) : une routine dont aucun moment n’a d’heure (ni « dès » ni « jusqu’à », ni condition sur des créneaux, `routineHasHours`) n’a que des « Le jour J à HH:MM » et « N jours avant, à HH:MM » ; l’éditeur n’offre qu’eux, l’API refuse un nouveau « avant » (« Sans heure « dès » ni « jusqu’à » (ni créneau), une routine n’a que des rappels à une heure : le jour J ou quelques jours avant. ») ; ceux déjà enregistrés (avant le 2026-11-21, ou d’une routine dont on retire les heures) restent enregistrés mais ne sonnent pas ; une copie garde ceux de sa source. Plus depuis l’heure de départ. Un « À HH:MM » sonne une fois par occurrence, à cette heure du jour de l’ouverture (ou de l’échéance, `end`) ; un « N jours avant, à HH:MM » une fois par occurrence, N jours avant ce jour (lot 16, décision FO). Les rappels enregistrés avant gardent leur sens (sans repère : début de l’ouverture ; `end` : fin de l’échéance). `reminderOccurrences` (champ GraphQL `reminderOccurrences` : `date`, `day`, `slots { slot, fromTime, dueTime }`, heure de Paris) donne l'occurrence en cours tant qu'elle n'est pas faite et la suivante, et, avec des « N jours avant », les suivantes qui s'ouvrent d'ici le plus grand nombre de jours (cherchées jusqu'à 31 jours après) ; aucune pour une routine archivée. Pendant un évènement qui occupe ses assignés, un rappel attend le prochain moment libre (`nextAllowedMoment`, dans l’app et hors de l’app). Voir [Alarmes](alarms.md#depuis-le-début-ou-la-fin-décisions-fs-fv).

## Coches et historique

Source : `setRoutineDone`, `bulkSetRoutinesDone`, `routineChecks`.

- Une coche porte sur un moment (`slot`, 0 sans moments multiples) d'une occurrence (`date`), avec l'heure où il a été fait (`doneAt`, maintenant par défaut).
- Par défaut, l'occurrence en cours ; sans occurrence : « Cette routine n'a pas encore commencé. »
- Une occurrence future ne se coche pas : « Une occurrence à venir ne peut pas être cochée. »
- Index hors des moments de ce jour : « Moment introuvable ce jour-là. »
- `doneAt` futur refusé : « Une routine ne peut pas être faite dans le futur. » (champ `doneAt`).
- Cocher à nouveau met à jour `doneAt` s'il est donné ; décocher supprime la coche.
- Routine archivée : refusée (lecture seule).
- En masse : chaque routine non archivée qui a une occurrence en cours voit tous ses moments cochés ou décochés ; les autres sont ignorées.
- Les coches restent quand la routine est modifiée ; elles sont supprimées avec elle.
- Requêtes : `doneDates` (30 dernières occurrences cochées), `lastDoneAt`, `routineChecks(from, to)` (2 000 au plus, plus récentes d'abord ; `fromTime` / `dueTime` du moment tels que la routine est maintenant), `routineOccurrences(from, to)` (période de 100 jours au plus : « Période de 100 jours au plus. » ; avec les occurrences annulées, `cancelled`, et celles des routines archivées ouvertes avant leur archivage, `archived`).

## Exceptions et déplacements

Source : `moveRoutineOccurrence`, `removeRoutineMove`, `changeRoutineOccurrence`, `deleteRoutineOccurrence` ; `routineMoveSchema`, `withMove`.

- Une exception `{ from, to, times }` : `from` est le jour de la règle, `to` le nouveau jour (`null` : annulée), `times` les horaires changés par moment (`null` : ceux de la règle). Même jour et mêmes horaires : refusé (« Choisissez un autre jour ou d'autres horaires. »).
- 500 exceptions au plus par routine (« 500 exceptions au plus. »).
- Une occurrence cochée (un de ses moments) ne se déplace pas : « Cette occurrence est déjà cochée : décochez-la pour la déplacer. » (« … pour la changer. » depuis l'agenda).
- Pas avant la première fois : « La routine n'a pas encore commencé ce jour-là. » (champ `to`).
- Routine archivée : refusée.
- Redéplacer une occurrence déjà déplacée modifie son exception ; la remettre à son jour avec ses horaires supprime l'exception. Seuls les horaires qui diffèrent de la règle sont gardés.
- `removeRoutineMove(id, from, comments?)` : supprime l'exception, l'occurrence revient à son jour ; après une annulation (« Annuler » du toast), les commentaires supprimés avec elle lui sont rendus (`comments`, texte vérifié à nouveau, dates d'origine ; décision EV).
- Les commentaires d'une occurrence déplacée la suivent (vers son nouveau jour, et retour quand l'exception est retirée ; décision D19). Depuis l'agenda, `FOLLOWING` et `ALL` ne déplacent que ceux de l'occurrence changée.

Depuis l'agenda (`changeRoutineOccurrence`, portée `THIS` / `FOLLOWING` / `ALL`) :

- `THIS` : une exception (jour et horaires d'un moment).
- `FOLLOWING` : s'il y a des occurrences avant, la règle (ou le cas) s'arrête avant celle-ci (même nombre d'occurrences si elle est comptée, sinon jusqu'à la veille) et un nouveau cas commence au nouveau jour avec le moment changé ; une règle sans cas devient deux cas. Sinon, comme `ALL`.
- `ALL` : la règle et le moment changent ; une règle hebdomadaire à jours listés change le jour de la semaine, une autre décale sa date de départ (ou celle du cas) d'autant de jours.
- Les exceptions des occurrences changées sont retirées (toutes pour `ALL` avec un décalage, celles à partir de l'occurrence pour `FOLLOWING`).
- Sans règle : « Cette routine n'a pas de répétition. » ; cas introuvable : « Occurrence introuvable. ».

Occurrences qui disparaissent (décision EW) : un changement de la règle (formulaire `updateRoutine`, cellule `patchRoutine`, modification en masse `bulkUpdateRoutines`, `changeRoutineOccurrence` en `FOLLOWING` / `ALL`) qui retire des occurrences actuelles (jours d'une occurrence avant le changement et plus après, `occurrencesBetween`) supprime leurs commentaires ; l'occurrence changée depuis l'agenda garde les siens (ils la suivent). Sans `confirmLoss: true`, rien n'est changé : `CONFIRMATION_REQUIRED`, extension `lost` (`{ times: 0, comments }` : les temps d'une routine ne sont pas sur ses occurrences), une seule fois pour toute une sélection. Un retour arrière (`restoring`) et les changements internes (copie, suppression d'occurrences) ne demandent rien.

Annulation depuis l'agenda (`deleteRoutineOccurrence`) :

- `THIS` (question « Annuler cette occurrence ») : exception sans nouveau jour : l'occurrence est **annulée** et reste visible, barrée, comme un évènement annulé (décision D23), avec ses commentaires (aucun n'est supprimé ; `comments` renvoyé vide). Elle n'est plus due : ni état, ni rappels, ni coche dans l'historique, ni « à faire ». Seule la requête `routineOccurrences` la renvoie (`cancelled: true`). Retirer l'exception (`removeRoutineMove`, « Annuler » du toast, « Rétablir ») la rétablit.
- `FOLLOWING` (« Supprimer celle-ci et les suivantes ») : les règles (ou cas) s'arrêtent avant ; les cas sans occurrence avant sont retirés ; les commentaires des occurrences à partir d'elle sont supprimés (décision D19). S'il ne reste rien, la routine est archivée comme par « Archiver », ses sous-routines avec elle (`archiveTree`, décision D12) ; la mutation renvoie `archived: true`.
- `ALL` refusé : « Archivez ou supprimez la routine elle-même. »
- Les coches passées restent dans l'historique.
- La question de portée donne le nombre de commentaires perdus pour chaque choix (`lostOnDelete`, `routineOccurrence` : rien pour `THIS`). Une occurrence déjà déplacée revient à son jour de règle, pas au jour où elle avait été déplacée.

## Modifications en masse

Source : `bulkUpdateRoutines`, `patchRoutine` (GraphQL).

- Une sélection contenant une routine archivée est refusée entièrement.
- Listes (catégories, assignés, dépendances, « Relative à ») : ajouts et retraits (`addRelatedIds` / `removeRelatedIds` pour « Relative à », lot 14a : une seule modification en masse, annulable) ; une routine ne dépend jamais d'elle-même, ni n'est relative à elle-même, même si elle est dans la sélection.
- Une nouvelle `recurrence` vide les cas ; des horaires (`fromTime` / `dueTime`) donnent un seul moment.
- Toutes les routines sont validées avant que la première soit enregistrée.
- Nouveau projet : la sélection part ensemble, ses liens internes restent (voir [Validation](#validation-routineschema-parseroutine) ci-dessus).
- `patchRoutine` (édition sur place) suit les mêmes règles en repartant de la routine entière (`inputOf`).

## Ordre, arbre, copie

Source : `moveRoutine`, `createRoutine`, `copySubRoutines`, `bulkDeleteRoutines` ; [Ordre](../cross-cutting/ordering.md).

- Copie d'une routine (« Dupliquer », menu ou sélection, enregistrée tout de suite puis ouverte, décision D20) : `createRoutine(input, copyOf)`, libellé « … (copie) », avec ses liens, son lieu et ses temps morts ; une nouvelle sous-routine ne reprend ni les liens ni les temps morts de sa parente ; les anciens liens de la routine copiée hors de l'arborescence de projets de la copie (gardés par elle tant qu'elle ne bouge pas) sont laissés de côté par l'API au lieu d'être refusés ; un autre lien hors de l'arborescence reste refusé.

- Un seul ordre manuel global pour toutes les routines (`position`), comme les tâches (décision DT) : créée, une routine va à la fin de cet ordre. L'ordre affiché reste l'arbre (chaque routine sous sa parente), les sœurs dans l'ordre global.
- `moveRoutine(id, beforeId, parentId?, categoryIds?)` : place la routine juste avant `beforeId` dans l'ordre global (`null` : à la fin ; voisine inconnue : « Routine introuvable. ») ; `parentId` donné change aussi de parente (vérifiée comme à l'enregistrement : existante, non archivée, pas sous elle-même), `null` : premier niveau, omis : inchangée. Placer « avant telle routine » fonctionne aussi dans une vue filtrée où la parente est masquée. Une routine archivée ne se déplace pas. Les catégories peuvent changer avec le déplacement. Seules les lignes dont la position change sont écrites.
- `copySubRoutines(fromId, toId)` : copie récursive des sous-routines sous la copie, dans leur ordre ; une dépendance ou une relation vers une routine copiée pointe vers sa copie ; un ancien lien d'une sous-routine hors de son arborescence de projets n'est pas copié (la copie se fait sans lui, plutôt que d'échouer à mi-chemin ; même règle que `copyOf`). La cible ne doit pas être archivée.
- Suppression (`bulkDeleteRoutines(ids, deleteSubRoutines)`), comme les tâches (décision DR) : ses sous-routines sont, au choix, supprimées avec elle (tout le sous-arbre) ou remontées d'un niveau sous sa parente ; les sous-routines sélectionnées remontées par la suppression de leur parente sont supprimées aussi. Ses coches, dépendances, relations, fiches et listes à cocher partent avec elle, le temps chronométré reste sans elle ; un temps sans projet qui ne porte plus sur rien (ni tâche, ni autre routine, ni évènement) est supprimé avec elle, sauf s'il est facturé, et la confirmation en donne le nombre (voir [Temps](time.md#suppression-de-ce-sur-quoi-porte-le-temps)). Les identifiants inexistants sont ignorés ; le résultat compte les routines données supprimées.

## Transformer en tâche

Source : `convertRoutineToTask(id, confirm)` (`services/routines/conversion.ts`, mutation GraphQL du même nom), lot 15 (décision FL). Le sens inverse est dans [Tâches](tasks.md#transformer-en-routine).

- Refusée pour une routine archivée (« Élément archivé : restaurez-le pour le modifier. ») et pour une routine qui a des sous-routines, archivées comprises : « Une routine qui a des sous-routines ne devient pas une tâche : déplacez ou supprimez d’abord ses sous-routines. ».
- Sans `confirm`, rien ne change : `CONFIRMATION_REQUIRED` (« Transformer la routine en tâche lui fait perdre ce qu’une tâche n’a pas : confirmez pour continuer. »), extension `lost` (`ConversionLoss`), toujours demandé, même vide.
- Une seule transaction : une nouvelle tâche est créée (à la fin de l’ordre manuel, numéro suivant de son projet donné par la base), la routine supprimée ; l’identifiant n’est pas gardé. Les commentaires écrits avant d’être sur des occurrences sont d’abord placés (`placeLegacyRoutineComments`).
- Occurrence prise : celle en cours, sinon la suivante, sinon la première (comme le panneau, `panelOccurrence`). Son jour d’échéance devient l’« Échéance » de la tâche, son premier jour l’« Ouverture » s’il est avant ; sans aucune occurrence, la tâche n’a pas de date.
- Gardés : libellé, description, projet, assignés, bénéficiaires, liens, lieu et son point, temps morts, condition de créneaux (celle de la règle ; celles des cas sont perdues avec la répétition), rappels « À HH:MM » et « N jours avant » (comptés ensuite depuis l'échéance ; ils perdent leur repère, décisions FS, FV). Les valeurs déjà sur la routine restent, même archivées ou plus rattachées au projet. La tâche prend le premier statut « À faire » non archivé (aucun s’il n’y en a pas), ouverte.
- Repris par la tâche : ses temps chronométrés (tous : ils ne sont pas sur une occurrence), ses fiches ; de l’occurrence prise : ses commentaires (dates et textes gardés), sa liste à cocher et ses évènements (liés à la tâche).
- Perdus (comptés dans `lost`) : la répétition (règle, cas, moments, exceptions, « Ouverture »), les coches (`checks`), les rappels « avant » (`beforeReminders`), les dépendances et relations avec d’autres routines (`routineLinks`), les catégories, le temps à y consacrer (`estimate`), les trajets (`travel`), les commentaires, listes à cocher et liens d’évènements des autres occurrences, la routine parente (`parent` : la tâche est au premier niveau).

## Archivage

- `bulkSetRoutinesArchived(ids, archived)` : chaque routine doit exister ; archiver garde la date de celles déjà archivées. Comme les tâches (décision DQ, `archiveTree`) : archiver une routine archive aussi ses sous-routines actives (`archivedByCascade`) ; la restaurer restaure celles archivées avec elle, et ses parentes archivées (seules : leurs autres sous-routines archivées avec elles restent archivées, pour leur propre compte). Une routine sélectionnée sous une autre sélectionnée suit celle-ci. Le résultat compte les routines données qui ont changé d'état.
- Une routine archivée parce qu'une suppression d'occurrences depuis l'agenda ne lui laisse plus rien (`deleteRoutineOccurrence`, `FOLLOWING`) l'est comme par « Archiver » : ses sous-routines actives avec elle (lot 12).
- Archivée : lecture seule (modification, coche, déplacement, ajout de sous-routine refusés), plus d'occurrence à venir (ses occurrences ouvertes avant le jour de l'archivage restent, archivées : décision D21), plus proposée comme parente ou dépendance (celles déjà en place restent). Restaurée, elle retrouve toutes ses occurrences. Voir [Archivage](../cross-cutting/archiving.md).

## Requête `routines`

Toutes les routines, archivées comprises, dans l'ordre manuel global ; `routineCategories` dans leur ordre. Les créneaux de l'espace et des autres espaces de l'utilisateur sont chargés une fois par requête (`loadScheduleContext`, sur `loadSlotsOn` commun avec les tâches) et les calculs mémorisés par routine.
