# Règles de l’agenda

Règles appliquées par l’API et les schémas partagés pour les calendriers, abonnements, catégories, évènements et occurrences (portées, annulation, report), créneaux (horaires prévus) et éphémérides, types de créneaux et d’éphémérides, règles de créneaux des tâches et routines, et exports PDF / iCalendar. Sources : `apps/api/src/services/calendar/**`, `apps/api/src/graphql/modules/calendar.ts`, `apps/api/src/routes/exports.ts`, `packages/shared/src/calendar/**`. Fonctionnalités : [Agenda](../../features/activities/calendar.md).

Toutes les données sont propres à l’espace courant (colonne `workspaceId`, voir [Espaces et accès](../cross-cutting/workspaces-and-access.md)), sauf les lectures explicites d’autres espaces (abonnements).

## Calendriers

Source : `apps/api/src/services/calendar/calendars.ts`, schéma `calendarFormSchema` (`packages/shared/src/calendar/calendar.ts`).

- Champs : libellé requis (250 caractères max ; « Le libellé est requis. »), couleur `#rrggbb` (« Couleur invalide (format #rrggbb). »), image facultative, position.
- Création : en dernière position (`nextPositionIn('calendar')`).
- Modification : refusée si archivé (`ARCHIVED_MESSAGE` « Élément archivé : restaurez-le pour le modifier. »).
- Calendrier par défaut d’un évènement (`resolveCalendarId`) : celui demandé (doit exister dans l’espace, sinon « Calendrier » introuvable), sinon le premier non archivé (ordre de position) ; s’il n’y en a aucun, un calendrier est créé au nom de l’espace, couleur `#228be6`.
- Suppression : supprime ses évènements (cascade base) et les abonnements des autres espaces ; refusée pour le dernier calendrier de l’espace : « Le dernier calendrier ne peut pas être supprimé. ». Les temps suivis sur ses évènements restent, sans eux (`TimeEntryEvent`, `onDelete: Cascade`), sauf ceux sans projet qui ne portent plus sur rien, supprimés avant (`releaseSubjectTime` sur `calendarEventsGone` ; la confirmation en donne le nombre, avec celui des commentaires de ses évènements, `lostOnDelete(calendarId)`, voir [Temps](time.md#suppression-de-ce-sur-quoi-porte-le-temps)) ; un temps facturé est toujours gardé.
- Archivage : par la mutation générique `setArchived` (genre `CALENDAR`, liste de paramètres). Un calendrier archivé ne prend aucun nouvel évènement et rend ses évènements non modifiables (voir plus bas). Voir [Archivage](../cross-cutting/archiving.md).
- Ordre : `BY_POSITION` (voir [Ordre](../cross-cutting/ordering.md)).

### Abonnements aux calendriers d’autres espaces

- `subscribableCalendars` : tous les calendriers des autres espaces (lecture hors espace), triés par position puis date de création de l’espace, puis du calendrier, avec `subscribed`.
- `subscribe(calendarId)` : le calendrier doit exister (sinon introuvable) ; refus s’il appartient à l’espace courant : « Ce calendrier appartient déjà à cet espace. » ; sans effet si déjà abonné ; en dernière position. Unicité `(workspaceId, calendarId)`.
- `unsubscribe` : supprime l’abonnement (sans erreur s’il n’existe pas).
- Les occurrences abonnées (`subscribedOccurrences`) sont lues dans l’espace source (`runInWorkspace`), sans les évènements archivés ni ceux des calendriers archivés ; elles sont en lecture seule (aucune mutation ne les vise dans l’espace abonné).
- Le calendrier abonné affiche le libellé et la couleur du calendrier source.

## Catégories d’agenda

Source : `apps/api/src/services/calendar/calendar-categories.ts` (service d’arbre commun `treeListService`, `apps/api/src/services/core/trees`), schéma `calendarCategoryFormSchema`.

- Libellé requis (250 caractères), couleur requise `#rrggbb`, parent facultatif, image.
- Création : à la fin des enfants de son parent ; parent inexistant : « Catégorie parente » introuvable.
- Modification : changer de parent la place en dernier.
- Déplacement (`moveCalendarCategory`) : sous un autre parent (ou à la racine) puis à un index parmi ses frères ; refus des boucles : « Une catégorie ne peut pas être placée sous elle-même ou sous l’une de ses sous-catégories. ».
- Suppression : ses sous-catégories remontent d’un niveau (sous son parent), ses évènements la perdent seulement.
- Archivage générique (`CALENDAR_CATEGORY`) : une catégorie archivée ne peut plus être ajoutée à un évènement ; celles déjà présentes restent.

## Évènements

Source : `apps/api/src/services/calendar/calendar-events.ts`, schéma `calendarEventInputSchema`.

### Validation des champs

| Champ                                                                       | Règle                                                                                    | Message                                                                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `label`                                                                     | Requis, 250 caractères (`TEXT_MAX`)                                                      | « Le libellé est requis. », « 250 caractères maximum. »                                         |
| `description`                                                               | Markdown, 65 536 caractères ; vide → null                                                | « Texte trop long. »                                                                            |
| `location`                                                                  | 250 caractères, vide → null                                                              | « 250 caractères maximum. »                                                                     |
| `links`                                                                     | 20 max ; `url` http/https ; `label` 250 caractères (`itemLinksSchema`, communs avec les tâches et les routines) | « 20 liens maximum. », « Lien invalide (http ou https). »                                       |
| `startDate`, `endDate`                                                      | Jours valides requis                                                                     | « La date de début est requise. », « La date de fin est requise. »                              |
| `startTime`, `endTime`                                                      | `HH:MM`, requis si non journée entière                                                   | « L’heure de début est requise. », « L’heure de fin est requise. », « Heure attendue (HH:MM). » |
| Fin / début                                                                 | La fin (date + heure) doit suivre le début                                               | « La fin doit suivre le début. »                                                                |
| `recurrence`                                                                | Règle commune (voir [Dates](../cross-cutting/dates.md)) ; sa fin ne précède pas le début | « La fin de la répétition doit suivre le début. »                                               |
| `reminders`                                                                 | 10 max, de types mêlés (`eventRemindersSchema` : depuis le début ou la fin ; `openEnd` et `dueStart` refusés) : `{ before }` minutes avant le début, 0 à 1 440 (24 heures), `{ at }` heure `HH:MM` du premier jour, ou `{ at, days }` cette heure N jours avant (1 à 30) ; dédoublonnés et triés à l’enregistrement (`normalizedReminders`) |  « 10 rappels maximum. », « 24 heures maximum. », « 30 jours maximum. », « Heure attendue (HH:MM). »                  |
| `travelBefore`, `travelAfter`                                               | Entiers 0 à 1 440                                                                        | « Durée positive attendue. », « 24 h maximum. »                                                 |
| `contributorIds`, `relationIds`, `beneficiaryIds`, `beneficiaryRelationIds` | 200 max chacun                                                                           | —                                                                                               |
| `categoryIds`                                                               | 50 max                                                                                   | —                                                                                               |
| `taskIds`                                                                   | 50 max                                                                                   | « 50 tâches maximum. »                                                                          |
| `routineLinks`                                                              | 200 max, `{ routineId, date }`                                                           | —                                                                                               |

### Règles appliquées par le service (`parseEvent`)

- Projet : doit exister et ne pas être archivé, sauf s’il est déjà celui de l’évènement.
- Contributeurs : doivent exister ; avec un projet, uniquement les contributeurs du projet (et de sa lignée) : « Seuls les contributeurs du projet peuvent être choisis. » ; ceux déjà présents restent. Voir [Personnes](../cross-cutting/people.md).
- Changement de projet (portée `ALL`, `FOLLOWING`, évènement unique, report) : les contributeurs restent et **suivent** l'évènement ; ceux qui ne sont pas rattachés au nouveau projet (ni à un de ses parents) y sont rattachés (`followProject`). Avec `FOLLOWING`, la série d'avant garde son projet. `THIS` ne change pas le projet (celui de la série reste). Les relations (participants hors équipe ou foyer) ne sont pas des contributeurs : rien n'est rattaché pour elles.
- Bénéficiaires (contributeurs ou relations) : vérifiés par `assertBeneficiaries` (existence, non archivés, sauf ceux déjà présents).
- Relations : doivent exister, non archivées (sauf déjà présentes).
- Catégories : doivent exister, non archivées (sauf déjà présentes).
- Tâches : doivent exister (« Tâche » introuvable). Une tâche ne peut être rattachée que si elle partage une personne avec l’évènement (ses assignés et les contributeurs de l’évènement ont quelqu’un en commun, ou l’un des côtés est vide, `sharePeople`).
- Routines rattachées : chaque date doit tomber entre le début et la fin de l’évènement : « Une routine rattachée doit l’être un jour de l’évènement. » ; routines existantes (« Routine » introuvable) ; même règle de personne commune.
- Message en cas de personne absente : « Sans contributeur en commun avec l’évènement : « A », « B ». » (sur `routineLinks` si seules des routines sont en cause, sinon sur `taskIds`).
- Point du lieu : gardé seulement avec un lieu et les deux coordonnées, sinon les deux sont effacées.
- Journée entière : heures effacées, trajets remis à 0.
- Calendrier : résolu comme ci-dessus ; refusé s’il est archivé (champ `calendarId`).
- Liens des routines : ceux des jours de l’occurrence enregistrée sont remplacés (ceux des autres jours sont gardés), dédoublonnés par `routineId|date`.
- Tâche transformée en routine : un évènement non récurrent lié à la tâche est lié à la routine le jour de son début ; un évènement récurrent perd ce lien. Routine transformée en tâche : les évènements liés à son occurrence en cours (sinon la suivante, sinon la première) sont liés à la tâche, les autres liens partent avec elle. La règle de la personne commune n'est pas revérifiée (lien déjà en place).

### Écriture d’un évènement existant

- Refusée si l’évènement est archivé ou si son calendrier l’est (`assertEventWritable`) — modification, annulation/rétablissement, report. La **suppression** n’est pas refusée pour un évènement archivé.
- Évènement unique : tous les champs remplacés, répétition effacée si absente. Devenu récurrent, ses temps et commentaires vont à sa première occurrence.

### Portées d’un évènement récurrent (`EVENT_SCOPES`)

`THIS` (cette occurrence), `FOLLOWING` (celle-ci et les suivantes), `ALL` (toute la série). Pour un récurrent, `occurrenceDate` est obligatoire : « Occurrence manquante. ».

Modification (`updateCalendarEvent`) :

- `THIS` : une exception (`CalendarEventException`, unique par `(eventId, date)`) reçoit libellé, description, lieu, liens, journée entière, dates, heures, trajets de l’occurrence ; calendrier, projet, contributeurs, bénéficiaires, relations, catégories, tâches, rappels et répétition restent ceux de la série (ignorés sans erreur). L’interface, dont le panneau choisit la portée à son ouverture, met ces champs en lecture seule quand il est ouvert sur `THIS`. Après un `FOLLOWING`, le panneau modifie la nouvelle série (`ALL`, id renvoyé) ; après un `ALL`, l’occurrence suit son nouveau jour.
- `ALL` (ou `FOLLOWING` sur la première occurrence) : la série se déplace d’autant que l’occurrence (décalage en jours appliqué au début de la série, même durée) ; si le décalage n’est pas nul, toutes les exceptions sont supprimées (elles ne correspondent plus) ; les temps et commentaires des occurrences sont décalés d’autant. Sans répétition, ceux de la première occurrence deviennent ceux de l’évènement unique.
- `FOLLOWING` : la série s’arrête la veille de l’occurrence (`endSeriesBefore` : nombre d’occurrences réduit, ou date de fin à la veille ; exceptions à partir de cette date supprimées) et un nouvel évènement commence avec les changements. Si la règle a un nombre d’occurrences inchangé, le nouveau nombre est diminué des occurrences déjà passées (au moins 1). Les liens de routines des jours suivants passent au nouvel évènement, ainsi que les temps (`TimeEntryEvent`) et les commentaires des occurrences à partir de la coupure, décalés d’autant de jours que l’occurrence (`remapOccurrenceRows`).
- Occurrences qui disparaissent : avec `ALL` ou `FOLLOWING`, une occurrence actuelle (à partir de la coupure pour `FOLLOWING`) que la nouvelle règle n’a plus une fois décalée (autre règle, répétition retirée : seule la première devient l’évènement unique) perd ses commentaires et ses temps, avec les règles d’une occurrence supprimée (temps sans projet qui ne portent plus sur rien supprimés, facturés gardés, les autres quittent l’occurrence ; `settleLostOccurrences`). Sans `confirmLoss: true`, rien n’est changé : `CONFIRMATION_REQUIRED` (« Ce changement fait disparaître des occurrences qui ont des commentaires ou des temps : confirmez pour continuer. », extension `lost` : `{ times, comments }`) ; le web demande la confirmation puis renvoie. Les commentaires et temps déjà sur une date qui n’est pas une occurrence ne sont pas comptés.

Suppression (`deleteCalendarEvent`) :

- évènement unique, `ALL`, ou `FOLLOWING` depuis la première occurrence : suppression de l’évènement (et en cascade : exceptions, liens de routines…) ;
- `THIS` : exception marquée `cancelled` (l’occurrence n’apparaît plus) ;
- `FOLLOWING` : la série s’arrête la veille (`endSeriesBefore`) ;
- les commentaires des occurrences supprimées sont supprimés (`deleteGoneComments` ; ceux de tout l’évènement, en cascade).

Avant, les temps des occurrences supprimées les perdent ; ceux sans projet qui ne portent plus sur rien sont supprimés (`goneOccurrences`, `releaseSubjectTime`), sauf les facturés ; la confirmation en donne le nombre pour chaque choix, avec celui des commentaires (`lostOnDelete`). Voir [Temps](time.md#suppression-de-ce-sur-quoi-porte-le-temps).

Annulation / rétablissement (`setEventCalledOff`) — l’évènement reste affiché, barré :

- unique ou `ALL` : drapeau de l’évènement et de toutes ses exceptions ;
- `THIS` : drapeau de l’exception existante seule (une occurrence rétablie d’une série annulée reste annulée avec elle), sinon une exception est créée avec tous les champs actuels de l’occurrence ;
- `FOLLOWING` : la série est coupée (comme une modification `FOLLOWING`) et le nouvel évènement porte l’état.

Report (`postponeCalendarEvent`) :

- crée un évènement unique (répétition supprimée) avec les champs donnés, lié par `postponedFromId` et `postponedFromDate` (l’occurrence d’origine) ;
- puis annule l’occurrence d’origine (`THIS`) ;
- les commentaires et les temps de l’occurrence d’origine passent au report.
- Supprimer l’évènement d’origine remet le lien du report à vide (`onDelete: SetNull`).

### Occurrences (`eventOccurrences`, `toOccurrence`)

- Une période (dates incluses) renvoie les occurrences qui la chevauchent, triées par début. Sont lus les évènements récurrents commençant au plus 62 jours après la fin, et les uniques finissant au plus 62 jours avant le début ; les dates de la règle sont calculées avec une marge (durée la plus longue + 62 jours) pour les occurrences déplacées.
- Occurrences supprimées (`cancelled`) omises.
- Clé : l’identifiant de l’évènement, suivi de `|date` pour un récurrent (`occurrenceKey`).
- Durée d’une occurrence : celle de la règle (`duration` en semaines, mois, jusqu’au jour/semaine/mois…), sinon celle de l’évènement ; une exception donne ses propres dates.
- Instants : heures de Paris (`zonedInstant` avec `Europe/Paris`) : un évènement n’a pas de fuseau propre, ses heures sont lues en heure de Paris ; journée entière : minuit UTC des dates, fin = lendemain du dernier jour.
- `calledOff` : celui de l’évènement ou de l’exception.
- `trackedSeconds` : somme des temps suivis sur cette occurrence (chronos en cours jusqu’à maintenant), chacun divisé par le nombre d’évènements du temps.
- `postponedTo` : reports de cette occurrence ; `postponedFrom` : origine du report.
- `archived` : l’évènement (sa série) est archivé. Le paramètre `activeOnly` (calendriers abonnés, disponibilité) exclut les évènements archivés et ceux des calendriers archivés.

### Archivage

Genre `CALENDAR_EVENT` de `setArchived` : archive toute la série. Un évènement archivé est masqué par défaut, en lecture seule, exclu de l’export ICS et de la disponibilité. Comme une routine (`archivedOn`) : seules ses occurrences commencées avant le jour de l’archivage (heure de Paris) restent, archivées, même finies ce jour-là ou après ; aucune qui commence à partir de ce jour (`eventOccurrences`). Le restaurer remet toutes ses occurrences. Voir [Archivage](../cross-cutting/archiving.md).

### Commentaires et fiches

Commentaires sur `EVENT`, par occurrence — voir [Commentaires](../cross-cutting/comments.md) ; fiches par occurrence (`sheetLinks`, `checklists`) — voir [Fiches](../supplies/sheets.md).

## Disponibilité et occupation

Source : `packages/shared/src/calendar/event-busy.ts`.

- `blockingEvent` : un évènement empêche une tâche ou une routine d’être faite à un moment s’il n’est pas annulé, s’il a lieu à ce moment (journée entière : tout le jour), s’il a un contributeur commun avec ses assignés (un évènement sans contributeur et un élément sans assigné comptent comme « Moi »), et s’il ne porte pas sur cette tâche, ni sur cette routine ce jour-là.
- `busyUntil` : fin de l’occupation, la fin de l’évènement, ou minuit après le dernier jour pour une journée entière (local, ou dans un fuseau : Paris pour le report d’un rappel de routine, `nextAllowedMoment`).
- `sharePeople` : règle de personne commune (voir plus haut).

## Créneaux (horaires prévus)

Source : `apps/api/src/services/calendar/work-schedules.ts`, schémas dans `packages/shared/src/calendar/work-schedules.ts`.

### Validation (`workScheduleSchema`)

- Libellé requis, 250 caractères.
- `startDate` requise ; `endDate` facultative, après le début : « La fin doit suivre le début. ».
- `cases` : 1 à 20 (« Ajoutez au moins un cas. », « 20 cas au plus. »). Chaque cas : période facultative (`since`, `until`), ancre, règle de répétition commune avec durée, horaires.
  - Règle hebdomadaire : au moins un jour (« Choisissez au moins un jour. »).
  - Horaires : journée entière, ou au moins une tranche (« Ajoutez des horaires, ou « Journée entière ». ») ; 12 tranches max (« 12 tranches au plus. ») ; la fin d’une tranche suit son début ; tranches sans chevauchement (« Des horaires se chevauchent. »).
- `exceptions` : 200 max (« 200 exceptions au plus. ») ; chacune `from` ≤ `to`, motif 250 caractères, 20 cas max ; sans cas : une pause. Triées par date de début à l’enregistrement.
- `typeId` : type de créneau existant, non archivé sauf s’il est déjà celui du créneau (« Type de créneau »).
- `ephemeris` : une éphéméride plutôt qu’un créneau ; avec un type, c’est la nature du type qui s’applique (la valeur envoyée est ignorée), sans type celle envoyée (défaut : créneau).

### Enregistrement

- Le format `intervalWeeks`, `slots`, `pauses` est vidé à chaque enregistrement ; il n’est que lu et converti (`fromLegacySchedule` : jours ayant les mêmes horaires → un cas toutes les n semaines ; pauses → exceptions sans cas). La forme des cas `pattern`, `every`… est aussi convertie à la lecture (`readScheduleCases`). Les éléments stockés invalides sont ignorés à la lecture.
- Modification refusée si le créneau est archivé.
- Suppression : définitive (« Créneau de travail » introuvable sinon). Les évènements ne sont pas touchés.
- Création, modification et suppression prennent `confirmLoss` : les occurrences de routines (de cet espace, et des autres espaces de l’utilisateur qui citent ce créneau ou un type de cet espace) qu’elles font disparaître (plus aucun moment permis, celles cochées gardées) perdent leurs commentaires une fois confirmé (voir [Routines](routines.md#créneaux-de-lagenda-conditionwindows-windowsallowed)) ; vérifié après la validation du créneau, avant son enregistrement (`ScheduleChangeSettler`).
- Archivage générique (`WORK_SCHEDULE`) : lecture seule ; un créneau archivé ne donne aucun moment aux conditions de créneaux qui le citent, ni n’en retire au temps libre. Archiver et restaurer prennent `confirmLoss` (`setArchived`, `settleScheduleChange`) comme une modification.

### Calcul des horaires du jour (`plannedSlots`)

- Pour chaque jour de la période du créneau (dates incluses, sans fin possible), les cas en vigueur sont ceux de l’exception qui couvre le jour (la plus récemment commencée ; à égalité, la plus courte), sinon les cas généraux.
- Un cas produit les tranches de ses horaires sur les jours de sa règle (ou toute la journée : `00:00`–`24:00`).
- `plannedPauses` : exceptions sans cas chevauchant une période.
- `slotMinutes` : minutes des horaires, les journées entières exclues (pas du temps de travail prévu). Utilisé par le temps prévu, voir [Temps](time.md).
- `withinSlots` : une tranche horaire tient dans un horaire du jour.

### Changement des horaires d’un jour depuis l’agenda (`changedScheduleSlot`)

- `THIS` : une exception d’un jour donne à ce jour ses propres horaires (et au jour d’arrivée s’il change).
- `FOLLOWING` : le cas s’arrête la veille (seulement s’il avait des jours avant), un nouveau suit avec le changement.
- `ALL` : tous les jours du cas.
- Les autres horaires du cas, et cet horaire ses autres jours de la semaine, restent.
- Éphéméride changée de jour : une éphéméride d’un seul jour (début = fin) se déplace avec toute sa période du même nombre de jours, quelle que soit la portée ; une éphéméride sur plusieurs jours fait de même avec `ALL`. Début, fin, bornes et ancres des cas, fin, jours sautés et pauses de leur règle, jours de la semaine et valeurs mensuelles ou annuelles des cas, exceptions avec leurs cas : tout se décale du même nombre de jours ; un changement d’heures en plus s’applique ensuite à tous les jours du cas. Avec `THIS` ou `FOLLOWING`, une éphéméride sur plusieurs jours garde la règle des créneaux : le jour reste dans sa période. Un créneau ne change jamais de période depuis l’agenda (avec `ALL`, son rythme suit le jour : nouveau jour de semaine, nouveau jour du mois…).
- Refus, dans les mots du créneau ou de l’éphéméride (`slotWords`) : fin avant début (« La fin doit suivre le début. »), jour hors de la période (« Ce jour est en dehors de la période du créneau. » / « Ce jour est en dehors de la période de l’éphéméride. »), horaire introuvable (« Horaires introuvables ce jour-là. »), suppression des derniers horaires (« Ce sont les derniers horaires du créneau : supprimez le créneau lui-même. » / « Ce sont les derniers horaires de l’éphéméride : supprimez l’éphéméride elle-même. »).
- Le résultat (période, cas et exceptions) est enregistré par `updateWorkSchedule` (mêmes validations, même confirmation des occurrences de routines perdues).

## Types de créneaux

- Service de libellés commun (`createLabelService`, voir [Nommage](../cross-cutting/naming.md)) : libellé requis 250 caractères, unique dans l’espace (« Un type porte déjà ce libellé. »), couleur `#rrggbb`, image, position, affichage. Une modification ne change que les champs envoyés : un champ omis garde sa valeur.
- Affichage (`ScheduleDisplay`) : `dayDisplay` ∈ `SLOT_BACKGROUND` (défaut), `DAY_BACKGROUND`, `SLOT_BORDER`, `NONE` ; `dayBar` (défaut vrai) ; `monthDisplay` ∈ `BACKGROUND` (défaut), `BORDER`, `NONE`. Une valeur stockée inconnue retombe sur le défaut (`readScheduleDisplay`).
- Suppression : les créneaux restent, sans type (`onDelete: SetNull`), avec leur nature (les éphémérides d’un type d’éphémérides restent des éphémérides sans type). Elle prend `confirmLoss` (`deleteScheduleType`) : les occurrences de routines qu’elle fait disparaître perdent leurs commentaires une fois confirmé, comme pour un créneau. Un type qui sert de contexte au budget emporte ses contextes (`TreasuryContext.scheduleType` en `onDelete: Cascade`, dans tous les espaces s’il est partagé) : voir [Trésorerie](../finances/treasury.md#contextes-et-leurs-périodes-éphémérides).
- Nature : `ephemeris` est fixé à la création (`ScheduleTypeInput.ephemeris`, défaut : créneaux) et ignoré ensuite ; seule la conversion le change (voir « Éphémérides »).
- Champs du budget (`budgetContext`, `sharedContext`, `scheduleTypeContextError`) : seul un type d’éphémérides sert de contexte au budget (« Seul un type d’éphémérides sert de contexte au budget. ») ; seul un contexte se partage entre espaces (« Seul un contexte du budget se partage entre espaces. ») ; « Partagé entre espaces » retombe à faux quand « Sert de contexte au budget » est retiré.
- Archivage générique (`SCHEDULE_TYPE`) : plus proposé, mais gardé là où il est choisi ; ses créneaux ne donnent aucun moment aux conditions (ni par le type, ni cités un à un, ni au temps libre). Archiver et restaurer prennent `confirmLoss` comme une modification de créneau.

## Éphémérides

Source : `apps/api/src/services/calendar/work-schedules.ts` (`setWorkScheduleEphemeris`, `setScheduleTypeEphemeris`), `packages/shared/src/calendar/work-schedules.ts` (`slotSchedules`, `wholeDaysCase`, `UNTYPED_EPHEMERIS_LABEL`).

- Une éphéméride (vacances, jours fériés, vacances scolaires, anniversaires…) est un créneau d’une autre **nature** : même table (`WorkSchedule.ephemeris`), mêmes règles (validation, jours entiers ou horaires, répétition, exceptions, archivage, « Dupliquer », commentaires, abonnements des autres espaces, changement des horaires depuis l’agenda). Pas de table à part : une éphéméride garde son id quand elle est convertie.
- La nature est portée par le type (`ScheduleType.ephemeris` : un type est tout de créneaux ou tout d’éphémérides) et, sans type, par le créneau lui-même. Un créneau typé prend la nature de son type (à l’enregistrement, et quand le type est converti : `updateMany` de ses créneaux).
- Il n’y a pas de type par défaut des éphémérides : une éphéméride sans type n’a aucun type au sens des conditions (`scheduleSlotKind` renvoie `null`), n’entre pas dans `default` (« Travail », les créneaux sans type) ni dans l’abonnement aux créneaux sans type d’un autre espace ; elle s’appelle « Éphéméride » (`UNTYPED_EPHEMERIS_LABEL`) et n’a pas de couleur côté API (gris côté web).
- Conditions de créneaux : une éphéméride se cite comme un créneau (`schedules`), un type d’éphémérides comme un type (`kinds`). En revanche le **temps libre ne tient pas compte des éphémérides** : seuls les créneaux de l’espace en sont exclus (`scheduleSlotsOn`, `slotSchedules`), et les exceptions « sauf » du temps libre ne proposent que des créneaux.
- Heures de travail : les éphémérides ne comptent ni dans l’avertissement PRO « hors des heures de travail » (`AvailabilityHint`), ni dans le temps prévu (`PlannedTime`, `slotMinutes`), ni dans le type par défaut. Les créneaux archivés et ceux d’un type archivé non plus, comme pour les conditions (`useWorkingHours`, `countedSchedules`).
- Conversion (`setWorkScheduleEphemeris(id, ephemeris, confirmLoss)`) : un créneau devient éphéméride ou l’inverse, son id gardé (web : menu « … » du gestionnaire et du panneau d'un créneau ouvert depuis l'agenda) ; refusée s’il est archivé ; sans effet s’il a déjà cette nature. Un créneau d’un type de l’autre nature **quitte son type** (il devient sans type) : un type n’est jamais mixte. Les occurrences de routines que la conversion fait disparaître passent par `confirmLoss` (`settleScheduleChange`), comme une modification.
- Conversion d’un type entier (`setScheduleTypeEphemeris(id, ephemeris, confirmLoss)`) : le type et tous ses créneaux changent de nature, ids gardés ; refusée s’il est archivé, et vers les créneaux tant qu’il sert de contexte au budget (« Ce type sert de contexte au budget : retirez d’abord « Sert de contexte au budget ». ») ; même `confirmLoss`.
- Une nouvelle éphéméride (web) dure la journée du jour, journée entière, tous les jours de sa période (`wholeDaysCase`).
- Rappels : une éphéméride a des rappels (`reminders`, `remindersSchema` : « Au début », « N min avant », « À HH:MM », « N jours avant, à HH:MM », 10 au plus), comptés depuis le premier jour de chaque suite de jours consécutifs qu'elle couvre (voir [Alarmes](alarms.md#rappels-des-tâches-routines-et-évènements)). Omis à l'enregistrement : inchangés (un horaire changé depuis l'agenda les garde). Un créneau n'en sonne aucun ; une conversion les garde.

### Type par défaut (créneaux sans type)

- Stocké sur l’espace (`scheduleLabel`, `scheduleColor`, `scheduleDayDisplay`, `scheduleDayBar`, `scheduleMonthDisplay`).
- Libellé 250 caractères max ; vide → « Travail » (`DEFAULT_SCHEDULE_KIND_LABEL`) ; couleur facultative (aucune : le vert des heures de travail).

### Abonnements aux types de créneaux d’autres espaces

- `foreignScheduleKinds` : pour chaque autre espace, son type par défaut (s’il a des créneaux sans type, éphémérides sans type non comptées) et chacun de ses types (avec `ephemeris`), avec nombre de créneaux, couleur et affichage effectifs ici (ceux de l’abonnement, sinon du type), `customized`, `subscribed`.
- `subscribeScheduleKind` : refus pour l’espace courant (« Ces créneaux appartiennent déjà à cet espace. ») ; espace source existant (« Espace ») ; type appartenant à cet espace (« Type de créneau ») ; sans effet si déjà abonné (vérifié en code, car un type nul n’est pas unique en base).
- Abonné à un type, l’espace voit tous les créneaux de ce type, même ajoutés ensuite (`subscribedSchedules`), en lecture seule ; abonné aux créneaux sans type, il ne voit que les créneaux (pas les éphémérides sans type).
- `otherWorkspaceSchedules` : tous les créneaux des autres espaces (archivés compris, avec `archived`), abonné ou non : ce qu’une condition de créneaux peut en citer. `foreignScheduleKinds` donne aussi `archived` pour chaque type.
- `setScheduleSubscriptionLook` : couleur et affichage propres (chaque champ nul : celui du type) ; « Abonnement » introuvable si non abonné.
- Suppression du type source ou de l’espace source : l’abonnement disparaît (cascade).


## Anniversaires

Source : `apps/api/src/services/calendar/birthdays.ts` (requête `birthdays`), `apps/api/src/services/calendar/work-schedules.ts` (`birthdayLook`, `saveBirthdayLook`), `packages/shared/src/people/birthdays.ts`.

- Un anniversaire découle de la date de naissance d'un membre de l'équipe ou du foyer ou d'une relation (un contributeur lié à une relation a celui de la relation) : il n'est pas enregistré (pas de `WorkSchedule`), il est calculé à la lecture, donc toujours à jour. Règles de la date et des rappels : [Personnes](../cross-cutting/people.md#coordonnées-date-de-naissance-anniversaire).
- Affiché comme un **évènement d'une journée entière** « Anniversaire de Paul — 40 ans » (l'âge quand l'année est connue), dans la couleur choisie pour les anniversaires de l'espace (ci-dessous), en semaine et en jour (ligne journée entière) comme dans le mois. Il n'est ni déplaçable, ni étirable, ni modifiable dans l'agenda ; un clic ouvre le panneau de la personne (la relation, sinon le contributeur), où se changent la date et les rappels.
- **Affichage des anniversaires** : stocké sur l'espace comme le type par défaut (`birthdayShown`, `birthdayColor` ; requête `birthdayLook`, mutation `saveBirthdayLook`, `birthdayLookSchema`) : affichés ou non (défaut : oui) et couleur facultative (aucune : le gris des éphémérides). Ils n'ont pas d'affichage de créneau (semaine/jour, bandeau, mois) : les colonnes `birthdayDayDisplay`, `birthdayDayBar` et `birthdayMonthDisplay` de l'espace ne sont plus lues ni écrites. Masqués, ils ne s'affichent plus dans l'agenda, mais leurs rappels sonnent toujours et ils comptent toujours dans les conditions de créneaux. Masqués aussi avec les créneaux et éphémérides (« Créneaux et éphémérides » des filtres).
- Personnes archivées : pas d'anniversaire (ni affiché, ni sonné, ni compté par les conditions ; la requête `birthdays(archived: true)` les donne aussi, marqués `archived`, pour nommer ceux qu'une condition cite encore). Autres espaces : non affiché (aucun abonnement ne montre les éphémérides sans type), mais ses rappels sonnent quel que soit l'espace ouvert.
- Citable par une condition de créneaux : celui d'une personne parmi les créneaux, tous parmi les types ; pas un contexte du budget. Règles : [Personnes](../cross-cutting/people.md#coordonnées-date-de-naissance-anniversaire) et la section suivante.

## Condition de créneaux des tâches et routines

Source : `packages/shared/src/calendar/slot-conditions.ts`, `packages/shared/src/calendar/slot-kinds.ts`, `apps/api/src/services/calendar/slot-conditions.ts`. Les tâches et les routines ont la même condition.

- Une condition (`slotConditionSchema`) : groupes ET / OU, comme les filtres des tableaux, de conditions sur des créneaux ou des types de créneaux : champ `schedules` (« Créneau » : des créneaux nommés) ou `kinds` (« Type de créneau » : tous les créneaux de ces types, ceux créés ensuite compris), avec `in` (« sur l’un des créneaux », « sur l’un des types ») ou `notIn` (« hors des créneaux », « hors des types »), au moins une valeur ; champ `freeTime` (« temps libre ») avec `isEmpty` (hors de tous les créneaux de l’espace, ceux créés ensuite compris) ou `notIn` (hors de tous les créneaux de l’espace sauf ceux cités, des créneaux de l’espace seulement). Les éphémérides se citent comme les créneaux (`schedules`, `kinds`), mais le temps libre les ignore ; de même les anniversaires : `birthday:contributor:<id>` / `birthday:relation:<id>` parmi les créneaux, `birthday` (tous) parmi les types. Autre opérateur : « Sur ou hors des créneaux. ».
- Un type se note comme les abonnements : l’id du type, `default` pour les créneaux sans type de l’espace (`ownSlotKind`), `ws:<espace>:<type | default>` pour un type d’un autre espace (`foreignSlotKind`), `birthday` pour tous les anniversaires de l’espace (`BIRTHDAY_SLOT_KIND`, pas d’équivalent d’un autre espace).
- Créneaux et types d’un **autre espace de l’utilisateur** (PRO ↔ PERSO) : une condition peut les citer, abonné ou non à ce type (tous les espaces sont accessibles à l’utilisateur connecté, voir [Espaces et accès](../cross-cutting/workspaces-and-access.md)). Le web les propose avec leur espace (« Sport · Perso »).
- Valeurs citées (`assertConditionSchedules`, erreurs sous `slotCondition`) : un créneau doit exister, dans cet espace ou un autre (« Créneau » introuvable) ; un type de cet espace doit exister (« Type de créneau » introuvable ; `default` et `birthday` existent toujours) ; une personne dont l’anniversaire est cité doit exister dans cet espace (« Contributeur » ou « Relation » introuvable) ; un type d’un autre espace doit appartenir à cet espace (« Espace » introuvable s’il n’existe plus, « Type de créneau » sinon ; `ws:` sur l’espace courant : « Type de créneau » introuvable). Un créneau, un type ou une personne archivé (dans son espace) n’est pas proposé, celui déjà dans la condition reste (« Élément archivé », sous la règle commune, voir [Archivage](../cross-cutting/archiving.md)) : il est encore nommé, suivi de « (archivé) » (« (archivée) » pour une éphéméride), mais ne donne aucun moment (ci-dessous).
- Heures permises un jour (`conditionWindows`) : `in` = les horaires des créneaux cités (ou des créneaux des types cités), fusionnés ; `notIn` = hors d’eux ; temps libre = hors de tous les horaires des créneaux de l’espace (sauf ceux des créneaux cités ; éphémérides exclues) ; « et » = intersection, « ou » = union. Les créneaux évalués sont ceux de l’espace et ceux des autres espaces de l’utilisateur, chargés quand une condition en cite une ou cite un de leurs types (`loadSlotsOn(conditions?)` sur `otherWorkspaceSchedules` ; toujours chargées pour les routines, dont les conditions ne sont pas connues d’avance), et les anniversaires des personnes de l’espace (journée entière, requête `birthdays`), chargés de même quand une condition en cite ; `scheduleSlotsOn(rules, foreign, birthdays)`. **Un créneau archivé, un créneau d’un type archivé et l’anniversaire d’une personne archivée ne comptent pas** : ils ne donnent aucun moment à `in`, `notIn` les permet toutes, et ils ne retirent rien au temps libre (`countedSchedules`) : **un créneau archivé ne réduit pas le temps libre**, ses heures y redeviennent libres ; de même dans les autres espaces (`ws:`), pour les tâches (« faisable », `doableTaskIds`), les occurrences de routines et les avertissements du web (`useSlotRules`). L’anniversaire cité d’une relation liée à un contributeur suit celui de la personne : celui du contributeur quand il a une date de naissance (la relation n’en a pas d’autre, voir [Personnes](../cross-cutting/people.md#coordonnées-date-de-naissance-anniversaire)), et l’inverse, `birthday:contributor:<id>` d’un contributeur sans date suit celui de sa relation (`aliases` de la requête `birthdays`). Un type sans aucun créneau n’a aucun horaire : `in` ne permet aucune heure, `notIn` les permet toutes. Ainsi, **un type sans aucun créneau ne permet aucun moment** : une tâche ou une routine limitée à ce type (« sur l’un des types ») n’est jamais faisable tant qu’aucun créneau de ce type n’existe (comportement voulu).
- **Sans condition** (ou un groupe vide) : à n’importe quelle heure. Le type d’espace ne joue pas : aucune condition par défaut, pas même les heures de travail en PRO.
- Routine : la condition garde ses moments aux heures permises (voir [Routines](routines.md)). Tâche : elle est faisable à un moment que la condition permet (`conditionAllowsAt`).
- `nextConditionMoment` : premier moment permis à partir d’un moment, sur quelques jours (le moment même sans condition).
- `doableTaskIds(utcOffset, meId)` (requête `doableTaskIds` des tâches) : tâches ouvertes et non archivées dont l’« Ouverture » suivie n’est pas après le jour de l’utilisateur, dont la condition permet le moment actuel de l’utilisateur et qu’aucun évènement actif n’occupe (voir [Tâches](tasks.md)).
- L’avertissement d’un évènement hors des créneaux de travail (espace PRO, formulaire d’évènement, `AvailabilityHint`) n’est pas une condition : il porte toujours sur tous les créneaux comptés de l’espace, jamais sur ses éphémérides ni sur ses créneaux archivés ou d’un type archivé.

## Export iCalendar

Source : `apps/api/src/services/calendar/calendar-ics.ts`, route `GET /api/exports/calendar.ics?calendar=<id>` (`apps/api/src/routes/exports.ts`, message d’échec « Export ICS impossible. »).

- Un calendrier (doit exister : « Calendrier ») ou tous ceux de l’espace ; évènements archivés exclus, et calendriers archivés exclus du fichier global. Nom : le calendrier, ou « Agenda » ; fichier `<nom>.ics`.
- `VCALENDAR` 2.0, `PRODID:-//Ordo//Agenda//FR`, `METHOD:PUBLISH`, `X-WR-CALNAME`.
- Chaque évènement : `UID` `<id>@ordo`, `SUMMARY`, `DESCRIPTION` (description + liens « libellé: url »), `LOCATION`, `URL` (premier lien), `DTSTART`/`DTEND` (date pour une journée entière, fin exclusive ; sinon heure de Paris avec `TZID=Europe/Paris`, toujours), `STATUS` `CANCELLED` ou `CONFIRMED`, `CATEGORIES`, `X-APPLE-TRAVEL-DURATION` (trajet aller seulement), un `VALARM` par rappel, relatif au début (`TRIGGER:-PT<n>M` ; un « À HH:MM » devient l’écart à l’heure de début, `TRIGGER:PT<n>M` s’il est après, un « N jours avant » compte ses jours en plus, `minutesBeforeMoment`) ; un rappel depuis la fin est relatif à la fin (`TRIGGER;RELATED=END:-PT<n>M`, un « À HH:MM » le dernier jour devenant l’écart à l’heure de fin, minuit après le dernier jour en journée entière).
- Répétition : `RRULE` (FREQ, INTERVAL, BYDAY/WKST, BYMONTHDAY, BYMONTH, BYWEEKNO selon le mode) ; un nombre d’occurrences est converti en `UNTIL` à la dernière occurrence (Ordo ne compte pas les dates exclues ni en pause) ; `UNTIL` en UTC (fin du dernier jour à Paris) quand il y a une heure. Les mois sans le jour (31 → 30 avril) sont ajoutés en `RDATE`. `EXDATE` : dates exclues, dates des pauses et occurrences supprimées, jusqu’à 10 ans pour une série sans fin.
- Occurrences modifiées : un `VEVENT` de même `UID` avec `RECURRENCE-ID`.
- Texte échappé (`\`, `;`, `,`, sauts de ligne), lignes pliées à 75 octets sans couper un caractère UTF-8, fins de ligne CRLF.

## Export PDF

Source : `apps/api/src/services/calendar/calendar-pdf.ts`, route `POST /api/exports/calendar.pdf` (5 Mo, « Export PDF impossible. »).

- Entrée : la vue telle qu’affichée (`view` mois/semaine/jour, `from`, `to`, `today`, titre et sous-titre) et ses éléments (5 000 max ; libellé 500 caractères, `PRINTED_LABEL_MAX` = 2 × `TEXT_MAX` ; aspect `CALENDAR_PDF_KINDS`, la même liste pour l’application et l’API ; dates ou date-heures locales ; couleur ; `struck`).
- Aspects : `event` plein dans sa couleur, texte blanc ; `task` et `time` teinte claire et liseré à gauche dans leur couleur ; `travel` teinte très claire, liseré, texte grisé ; `slot` plein dans sa couleur, texte foncé ; `background` en fond translucide dans sa couleur, derrière les autres éléments (la journée entière d’une case du mois, ou ses heures en semaine et jour). Un élément barré est aussi en teinte claire, estompé.
- Les heures de la semaine et du jour vont de 8 h à 19 h au moins, élargies aux éléments ; les fonds ne les élargissent pas (ils sont coupés aux heures affichées).
- `from` ≤ `to`, 45 jours d’écart au plus : « Période invalide. ».
- A4 paysage, gabarit commun (`startReport`, voir [Erreurs](../cross-cutting/errors.md) pour le format des refus).

## Rappels d’évènements

Les rappels (« Au début », minutes avant le début, 24 heures au plus, « À HH:MM » le premier jour, ou « N jours avant, à HH:MM », 30 jours au plus ; le début d’une journée entière est minuit de Paris du premier jour ; les mêmes depuis la fin : la fin d’une journée entière est minuit après son dernier jour, « À HH:MM » son dernier jour ; chacun avec sa sonnerie ou non) sont sonnés par le navigateur, quel que soit l’espace ouvert, sauf pour une occurrence annulée : voir [Règles des alarmes](alarms.md#rappels-des-tâches-routines-et-évènements).
