# Règles des routines

Règles appliquées par l'API et le code partagé aux routines : validation, calcul des occurrences (règle, cas, « à partir du », créneaux), états, coches, exceptions (déplacements), historique, ordre, archivage et suppression. Sources : `apps/api/src/services/routines/routines.ts`, `apps/api/src/graphql/modules/routines.ts`, `packages/shared/src/routines/` (`routines.ts`, `routine-views.ts`), `packages/shared/src/calendar/slot-conditions.ts`. L'usage côté écran est dans [Routines](../../features/activities/routines.md).

## Modèle

Tables Prisma : `Routine`, `RoutineCategory` (arbre), `RoutineDependency` (« A dépend de B »), `RoutineRelation` (« relative à », symétrique, stockée une seule fois avec `routineAId < routineBId`), `RoutineCheck` (un moment d'une occurrence coché). Les fiches et listes à cocher d'une routine sont décrites dans [Règles des fiches](../supplies/sheets.md).

Champs d'une routine qui comptent pour les occurrences :

| Champ           | Rôle                                                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `startDate`     | « Première fois » : la règle compte à partir de ce jour.                                                                                      |
| `recurrence`    | Règle de répétition commune aux évènements, alarmes et créneaux (voir [Dates](../cross-cutting/dates.md)).                                      |
| `moments`       | Moments de la journée de la règle : `[{ fromTime, dueTime, optional }]`.                                                                      |
| `slotCondition` | Condition sur les créneaux de l'agenda (groupe ET / OU), suivant la règle.                                                                      |
| `opensOn`       | « À partir du » des occurrences de la règle.                                                                                                  |
| `cases`         | Cas (chacun : `from`, `until`, `recurrence`, `slots`, `condition`, `opens`) ; non vide, ils remplacent la règle, ses moments et sa condition. |
| `moves`         | Exceptions : `[{ from, to, times }]` (jours `YYYY-MM-DD`).                                                                                    |
| `archivedAt`    | Archivée : plus aucune occurrence. `archivedByCascade` : archivée avec sa routine parente.                                                    |

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
| `cases`                                                                                | 20 au plus (« 20 cas au plus. ») ; chaque cas : 1 à 10 moments (« Ajoutez au moins un moment. », « 10 moments au plus. »), au moins un obligatoire, « à partir du » compatible.                                                                                      |
| `slotCondition`                                                                        | Groupe de conditions ; champs `schedules` (créneaux) et `kinds` (types de créneaux) avec `in` / `notIn`, champ `freeTime` avec `isEmpty` / `notIn` (sinon « Sur ou hors des créneaux. ») ; créneaux et types de cet espace ou d'un autre espace de l'utilisateur ; chacun doit exister (« Créneau », « Type de créneau », « Espace ») et ne pas être archivé, sauf s'il était déjà dans une condition de la routine (`assertConditionSchedules`, commun avec les tâches, voir [Agenda](calendar.md#condition-de-créneaux-des-tâches-et-routines)).                                                                          |
| `reminders`                                                                            | Rappels (décision D16, `remindersSchema`) : 10 au plus (« 10 rappels maximum. »), de types mêlés : `{ before }` minutes de 0 à 1 440 (« 24 heures maximum. »), `{ at }` heure `HH:MM` ; doublons retirés, triés.                                                                                                                                                                                |
| `location`                                                                             | 250 caractères au plus (« 250 caractères maximum. ») ; sans lieu, ou sans ses deux coordonnées, le point est effacé (`storedLocation`, commun avec les évènements et les tâches).                                                                                                                                                                               |
| `links`                                                                                | Liens (décision D5), ceux des évènements : 20 au plus (« 20 liens maximum. »), adresse http ou https (« Lien invalide (http ou https). »), libellé facultatif de 250 caractères (`itemLinksSchema`) ; requis dans l’entrée comme `relatedIds` (`[]` pour aucun) : une entrée qui les omet est refusée au lieu de les effacer (décision EE). |
| `travelBefore`, `travelAfter`                                                          | Minutes de trajet (schéma géo commun), 0 par défaut.                                                                                                                                                                                                                 |
| `opensOn`                                                                              | Refusé avec des cas, ou s'il ne convient pas à la fréquence : « Ce « à partir du » ne vaut pas pour cette répétition : un jour du mois (mensuelle), de l'année (annuelle), ou des jours avant. » Mode `BEFORE` : 1 (« Au moins 1. ») à 366 (« 366 maximum. ») jours. |
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

Une occurrence va de son premier jour (son « à partir du ») à son jour d'échéance (son dernier jour). Elle est identifiée par son jour d'échéance.

- Source : les cas s'il y en a, sinon la règle (`storedRule`). Une routine enregistrée avec des créneaux suivis avant les conditions (`scheduleIds` sans `slotCondition`) se répète chaque jour.
- Un cas compte à partir de son `from` (jamais avant la première fois de la routine) jusqu'à son `until`. Un jour dû par plusieurs cas suit le premier cas (`routineCaseOn`).
- Rien avant `startDate`. Une routine archivée n'a aucune occurrence.

### « À partir du » (`routineOpenDate`)

- `BEFORE` : `days` jours avant l'échéance ; valable pour toute fréquence.
- `DAY` (le n du mois, ou d'un mois pour une règle annuelle), `WEEKDAY` (le 1er à 4e ou dernier jour de semaine du mois), `WEEK` (un jour de semaine de la semaine 1 à 6 du mois, semaines du lundi, la première étant celle du 1er ; en annuel, semaine ISO 1 à 53) : seulement pour une règle mensuelle (sans mois) ou annuelle (avec mois, ou semaine ISO) (`opensFits`).
- Le jour est pris dans la période de l'échéance ; s'il tombe après l'échéance, celui de la période précédente.
- Sans « à partir du » (ou s'il ne convient pas), l'occurrence s'ouvre le jour de son échéance.

### Créneaux de l'agenda (`conditionWindows`, `windowsAllowed`)

- `schedules in [ids]` : sur les horaires d'un de ces créneaux ; `notIn` : hors de tous.
- `kinds in [types]` : sur les horaires d'un créneau de l'un de ces types (ceux créés plus tard compris) ; `notIn` : hors de tous. Un type sans aucun créneau ne permet aucun moment : la routine n'a alors aucune occurrence faisable tant qu'aucun créneau de ce type n'existe (comportement voulu). Créneaux et types d'un autre espace de l'utilisateur comptent comme ceux de l'espace (voir [Agenda](calendar.md#condition-de-créneaux-des-tâches-et-routines)).
- `freeTime isEmpty` : hors de tous les créneaux de l'espace (y compris ceux créés plus tard) ; `freeTime notIn [ids]` : hors de tous sauf ceux nommés (des créneaux de l'espace). Les créneaux des autres espaces n'y comptent pas.
- Groupes : ET = intersection, OU = union. Un groupe vide ne contraint rien.
- Horaires fusionnés quand ils se touchent ; un horaire « toute la journée » couvre la journée ; un horaire finissant à 23:59 va jusqu'à la fin du jour.
- Chaque moment est réduit aux heures permises (plusieurs fenêtres si des horaires le coupent) ; un moment sans heure permise disparaît ce jour-là. Une occurrence dont aucun jour n'a de moment permis n'existe pas (`doable`).

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
| `due` (« À faire »)      | Occurrence en cours non faite, échéance aujourd'hui (ou plus tard, pendant son « à partir du »).                         |

`done` (champ GraphQL) : il y a une occurrence en cours, elle a au moins un moment, et chaque moment est coché ou facultatif.

« En attente » (web, `waitingFor`) : une routine requise, non archivée, a une occurrence en cours non faite (calcul gardé tel quel par la décision DS).

### Départ, retour, rappels (`routineSchedule`, `routineReminderTime`, `reminderOccurrences`)

- Avec une heure limite : départ = limite − (trajet aller + temps estimé) ; retour = limite + trajet retour.
- Avec une heure de début seulement : départ = début − trajet aller ; retour = début + temps estimé + trajet retour.
- Les heures restent dans la journée (modulo 24 h).
- Rappels (décision D16) : un « avant » (« Au début », « N min avant ») compte depuis le premier jour de l'occurrence (« à partir du ») à l'heure « dès » de chaque moment non coché, sinon son heure maximale (`routineReminderTime`) ; plus depuis l'heure de départ ; un moment sans aucune heure n'en a pas. Un « À HH:MM » sonne une fois par occurrence, à cette heure de son premier jour. `reminderOccurrences` (champ GraphQL `reminderOccurrences` : `date`, `day`, `slots { slot, at }`, heure de Paris) donne l'occurrence en cours tant qu'elle n'est pas faite et la suivante ; aucune pour une routine archivée. Voir [Alarmes](alarms.md#rappels-des-tâches-routines-et-évènements).

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
- Requêtes : `doneDates` (30 dernières occurrences cochées), `lastDoneAt`, `routineChecks(from, to)` (2 000 au plus, plus récentes d'abord ; `fromTime` / `dueTime` du moment tels que la routine est maintenant), `routineOccurrences(from, to)` (routines non archivées, période de 100 jours au plus : « Période de 100 jours au plus. »).

## Exceptions et déplacements

Source : `moveRoutineOccurrence`, `removeRoutineMove`, `changeRoutineOccurrence`, `deleteRoutineOccurrence` ; `routineMoveSchema`, `withMove`.

- Une exception `{ from, to, times }` : `from` est le jour de la règle, `to` le nouveau jour (`null` : annulée), `times` les horaires changés par moment (`null` : ceux de la règle). Même jour et mêmes horaires : refusé (« Choisissez un autre jour ou d'autres horaires. »).
- 500 exceptions au plus par routine (« 500 exceptions au plus. »).
- Une occurrence cochée (un de ses moments) ne se déplace pas : « Cette occurrence est déjà cochée : décochez-la pour la déplacer. » (« … pour la changer. » depuis l'agenda).
- Pas avant la première fois : « La routine n'a pas encore commencé ce jour-là. » (champ `to`).
- Routine archivée : refusée.
- Redéplacer une occurrence déjà déplacée modifie son exception ; la remettre à son jour avec ses horaires supprime l'exception. Seuls les horaires qui diffèrent de la règle sont gardés.
- `removeRoutineMove` : supprime l'exception, l'occurrence revient à son jour.
- Les commentaires d'une occurrence déplacée la suivent (vers son nouveau jour, et retour quand l'exception est retirée ; décision D19). Depuis l'agenda, `FOLLOWING` et `ALL` ne déplacent que ceux de l'occurrence changée.

Depuis l'agenda (`changeRoutineOccurrence`, portée `THIS` / `FOLLOWING` / `ALL`) :

- `THIS` : une exception (jour et horaires d'un moment).
- `FOLLOWING` : s'il y a des occurrences avant, la règle (ou le cas) s'arrête avant celle-ci (même nombre d'occurrences si elle est comptée, sinon jusqu'à la veille) et un nouveau cas commence au nouveau jour avec le moment changé ; une règle sans cas devient deux cas. Sinon, comme `ALL`.
- `ALL` : la règle et le moment changent ; une règle hebdomadaire à jours listés change le jour de la semaine, une autre décale sa date de départ (ou celle du cas) d'autant de jours.
- Les exceptions des occurrences changées sont retirées (toutes pour `ALL` avec un décalage, celles à partir de l'occurrence pour `FOLLOWING`).
- Sans règle : « Cette routine n'a pas de répétition. » ; cas introuvable : « Occurrence introuvable. ».

Annulation depuis l'agenda (`deleteRoutineOccurrence`) :

- `THIS` : exception sans nouveau jour.
- `FOLLOWING` : les règles (ou cas) s'arrêtent avant ; les cas sans occurrence avant sont retirés ; s'il ne reste rien, la routine est archivée (la mutation renvoie `true`).
- `ALL` refusé : « Archivez ou supprimez la routine elle-même. »
- Les coches passées restent dans l'historique.
- Les commentaires des occurrences supprimées (celle-ci, ou à partir d'elle) sont supprimés (décision D19) ; « Annuler » (retrait de l'exception) ne les rend pas. La question de portée en donne le nombre pour chaque choix (`lostOnDelete`, `routineOccurrence`).

## Modifications en masse

Source : `bulkUpdateRoutines`, `patchRoutine` (GraphQL).

- Une sélection contenant une routine archivée est refusée entièrement.
- Listes (catégories, assignés, dépendances) : ajouts et retraits ; « Relative à » se change routine par routine (`patchRoutine`) ; une routine ne dépend jamais d'elle-même, même si elle est dans la sélection.
- Une nouvelle `recurrence` vide les cas ; des horaires (`fromTime` / `dueTime`) donnent un seul moment.
- Toutes les routines sont validées avant que la première soit enregistrée.
- Nouveau projet : la sélection part ensemble, ses liens internes restent (voir [Validation](#validation-routineschema-parseroutine) ci-dessus).
- `patchRoutine` (édition sur place) suit les mêmes règles en repartant de la routine entière (`inputOf`).

## Ordre, arbre, copie

Source : `moveRoutine`, `createRoutine`, `copySubRoutines`, `bulkDeleteRoutines` ; [Ordre](../cross-cutting/ordering.md).

- Copie d'une routine (« Dupliquer », formulaire ou sélection) : `createRoutine(input, copyOf)`, avec ses liens et son lieu ; une nouvelle sous-routine ne reprend pas les liens de sa parente ; les anciens liens de la routine copiée hors de l'arborescence de projets de la copie (gardés par elle tant qu'elle ne bouge pas) sont laissés de côté par l'API au lieu d'être refusés ; un autre lien hors de l'arborescence reste refusé.

- Un seul ordre manuel global pour toutes les routines (`position`), comme les tâches (décision DT) : créée, une routine va à la fin de cet ordre. L'ordre affiché reste l'arbre (chaque routine sous sa parente), les sœurs dans l'ordre global.
- `moveRoutine(id, beforeId, parentId?, categoryIds?)` : place la routine juste avant `beforeId` dans l'ordre global (`null` : à la fin ; voisine inconnue : « Routine introuvable. ») ; `parentId` donné change aussi de parente (vérifiée comme à l'enregistrement : existante, non archivée, pas sous elle-même), `null` : premier niveau, omis : inchangée. Placer « avant telle routine » fonctionne aussi dans une vue filtrée où la parente est masquée. Une routine archivée ne se déplace pas. Les catégories peuvent changer avec le déplacement. Seules les lignes dont la position change sont écrites.
- `copySubRoutines(fromId, toId)` : copie récursive des sous-routines sous la copie, dans leur ordre ; une dépendance ou une relation vers une routine copiée pointe vers sa copie ; un ancien lien d'une sous-routine hors de son arborescence de projets n'est pas copié (la copie se fait sans lui, plutôt que d'échouer à mi-chemin ; même règle que `copyOf`). La cible ne doit pas être archivée.
- Suppression (`bulkDeleteRoutines(ids, deleteSubRoutines)`), comme les tâches (décision DR) : ses sous-routines sont, au choix, supprimées avec elle (tout le sous-arbre) ou remontées d'un niveau sous sa parente ; les sous-routines sélectionnées remontées par la suppression de leur parente sont supprimées aussi. Ses coches, dépendances, relations, fiches et listes à cocher partent avec elle, le temps chronométré reste sans elle ; un temps sans projet qui ne porte plus sur rien (ni tâche, ni autre routine, ni évènement) est supprimé avec elle, sauf s'il est facturé, et la confirmation en donne le nombre (voir [Temps](time.md#suppression-de-ce-sur-quoi-porte-le-temps)). Les identifiants inexistants sont ignorés ; le résultat compte les routines données supprimées.

## Archivage

- `bulkSetRoutinesArchived(ids, archived)` : chaque routine doit exister ; archiver garde la date de celles déjà archivées. Comme les tâches (décision DQ, `archiveTree`) : archiver une routine archive aussi ses sous-routines actives (`archivedByCascade`) ; la restaurer restaure celles archivées avec elle, et ses parentes archivées (seules : leurs autres sous-routines archivées avec elles restent archivées, pour leur propre compte). Une routine sélectionnée sous une autre sélectionnée suit celle-ci. Le résultat compte les routines données qui ont changé d'état.
- Une routine archivée parce qu'une suppression d'occurrences depuis l'agenda ne lui laisse plus rien (`deleteRoutineOccurrence`, `FOLLOWING`) est archivée seule.
- Archivée : lecture seule (modification, coche, déplacement, ajout de sous-routine refusés), aucune occurrence, plus proposée comme parente ou dépendance (celles déjà en place restent). Voir [Archivage](../cross-cutting/archiving.md).

## Requête `routines`

Toutes les routines, archivées comprises, dans l'ordre manuel global ; `routineCategories` dans leur ordre. Les créneaux de l'espace et des autres espaces de l'utilisateur sont chargés une fois par requête (`loadScheduleContext`, sur `loadSlotsOn` commun avec les tâches) et les calculs mémorisés par routine.
