# Règles de l’agenda

Règles appliquées par l’API et les schémas partagés pour les calendriers, abonnements, catégories, évènements et occurrences (portées, annulation, report), plages (horaires prévus), types de plages, règles de plages des tâches et routines, et exports PDF / iCalendar. Sources : `apps/api/src/services/calendar/**`, `apps/api/src/graphql/modules/calendar.ts`, `apps/api/src/routes/exports.ts`, `packages/shared/src/calendar/**`. Fonctionnalités : [Agenda](../../features/activities/calendar.md).

Toutes les données sont propres à l’espace courant (colonne `workspaceId`, voir [Espaces et accès](../cross-cutting/workspaces-and-access.md)), sauf les lectures explicites d’autres espaces (abonnements).

## Calendriers

Source : `apps/api/src/services/calendar/calendars.ts`, schéma `calendarFormSchema` (`packages/shared/src/calendar/calendar.ts`).

- Champs : libellé requis (250 caractères max, décision DO ; « Le libellé est requis. »), couleur `#rrggbb` (« Couleur invalide (format #rrggbb). »), image facultative, position.
- Création : en dernière position (`nextPositionIn('calendar')`).
- Modification : refusée si archivé (`ARCHIVED_MESSAGE` « Élément archivé : restaurez-le pour le modifier. »).
- Calendrier par défaut d’un évènement (`resolveCalendarId`) : celui demandé (doit exister dans l’espace, sinon « Calendrier » introuvable), sinon le premier non archivé (ordre de position) ; s’il n’y en a aucun, un calendrier est créé au nom de l’espace, couleur `#228be6`.
- Suppression : supprime ses évènements (cascade base) et les abonnements des autres espaces ; refusée pour le dernier calendrier de l’espace : « Le dernier calendrier ne peut pas être supprimé. ». Les temps suivis sur ses évènements restent, sans lien (`TimeEntry.calendarEvent`, `onDelete: SetNull`).
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
| `links`                                                                     | 20 max ; `url` http/https ; `label` 250 caractères                                       | « 20 liens maximum. », « Lien invalide (http ou https). »                                       |
| `startDate`, `endDate`                                                      | Jours valides requis                                                                     | « La date de début est requise. », « La date de fin est requise. »                              |
| `startTime`, `endTime`                                                      | `HH:MM`, requis si non journée entière                                                   | « L’heure de début est requise. », « L’heure de fin est requise. », « Heure attendue (HH:MM). » |
| Fin / début                                                                 | La fin (date + heure) doit suivre le début                                               | « La fin doit suivre le début. »                                                                |
| `recurrence`                                                                | Règle commune (voir [Dates](../cross-cutting/dates.md)) ; sa fin ne précède pas le début | « La fin de la répétition doit suivre le début. »                                               |
| `timeZone`                                                                  | 1 à 64 caractères (fuseau IANA du navigateur à la création)                              | —                                                                                               |
| `reminders`                                                                 | 10 max, entiers 0 à 43 200 min (30 jours) ; dédoublonnés et triés à l’enregistrement     | —                                                                                               |
| `travelBefore`, `travelAfter`                                               | Entiers 0 à 1 440                                                                        | « Durée positive attendue. », « 24 h maximum. »                                                 |
| `contributorIds`, `relationIds`, `beneficiaryIds`, `beneficiaryRelationIds` | 200 max chacun                                                                           | —                                                                                               |
| `categoryIds`                                                               | 50 max                                                                                   | —                                                                                               |
| `taskIds`                                                                   | 50 max                                                                                   | « 50 tâches maximum. »                                                                          |
| `routineLinks`                                                              | 200 max, `{ routineId, date }`                                                           | —                                                                                               |

### Règles appliquées par le service (`parseEvent`)

- Projet : doit exister et ne pas être archivé, sauf s’il est déjà celui de l’évènement.
- Contributeurs : doivent exister ; avec un projet, uniquement les contributeurs du projet (et de sa lignée) : « Seuls les contributeurs du projet peuvent être choisis. » ; ceux déjà présents restent. Voir [Personnes](../cross-cutting/people.md).
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

### Écriture d’un évènement existant

- Refusée si l’évènement est archivé ou si son calendrier l’est (`assertEventWritable`) — modification, annulation/rétablissement, report. La **suppression** n’est pas refusée pour un évènement archivé.
- Évènement unique : tous les champs remplacés, répétition effacée si absente.

### Portées d’un évènement récurrent (`EVENT_SCOPES`)

`THIS` (cette occurrence), `FOLLOWING` (celle-ci et les suivantes), `ALL` (toute la série). Pour un récurrent, `occurrenceDate` est obligatoire : « Occurrence manquante. ».

Modification (`updateCalendarEvent`) :

- `THIS` : une exception (`CalendarEventException`, unique par `(eventId, date)`) reçoit libellé, description, lieu, liens, journée entière, dates, heures, trajets de l’occurrence ; calendrier, projet, contributeurs, catégories, tâches et rappels restent ceux de la série. L’interface n’offre pas `THIS` quand la répétition change.
- `ALL` (ou `FOLLOWING` sur la première occurrence) : la série se déplace d’autant que l’occurrence (décalage en jours appliqué au début de la série, même durée) ; si le décalage n’est pas nul, toutes les exceptions sont supprimées (elles ne correspondent plus).
- `FOLLOWING` : la série s’arrête la veille de l’occurrence (`endSeriesBefore` : nombre d’occurrences réduit, ou date de fin à la veille ; exceptions à partir de cette date supprimées) et un nouvel évènement commence avec les changements. Si la règle a un nombre d’occurrences inchangé, le nouveau nombre est diminué des occurrences déjà passées (au moins 1). Les liens de routines des jours suivants passent au nouvel évènement.

Suppression (`deleteCalendarEvent`) :

- évènement unique, `ALL`, ou `FOLLOWING` depuis la première occurrence : suppression de l’évènement (et en cascade : exceptions, liens de routines…) ;
- `THIS` : exception marquée `cancelled` (l’occurrence n’apparaît plus) ;
- `FOLLOWING` : la série s’arrête la veille (`endSeriesBefore`).

Annulation / rétablissement (`setEventCalledOff`) — l’évènement reste affiché, barré :

- unique ou `ALL` : drapeau de l’évènement et de toutes ses exceptions ;
- `THIS` : drapeau de l’exception existante seule (une occurrence rétablie d’une série annulée reste annulée avec elle), sinon une exception est créée avec tous les champs actuels de l’occurrence ;
- `FOLLOWING` : la série est coupée (comme une modification `FOLLOWING`) et le nouvel évènement porte l’état.

Report (`postponeCalendarEvent`) :

- crée un évènement unique (répétition supprimée) avec les champs donnés, lié par `postponedFromId` et `postponedFromDate` (l’occurrence d’origine) ;
- puis annule l’occurrence d’origine (`THIS`).
- Supprimer l’évènement d’origine remet le lien du report à vide (`onDelete: SetNull`).

### Occurrences (`eventOccurrences`, `toOccurrence`)

- Une période (dates incluses) renvoie les occurrences qui la chevauchent, triées par début. Sont lus les évènements récurrents commençant au plus 62 jours après la fin, et les uniques finissant au plus 62 jours avant le début ; les dates de la règle sont calculées avec une marge (durée la plus longue + 62 jours) pour les occurrences déplacées.
- Occurrences supprimées (`cancelled`) omises.
- Clé : l’identifiant de l’évènement, suivi de `|date` pour un récurrent (`occurrenceKey`).
- Durée d’une occurrence : celle de la règle (`duration` en semaines, mois, jusqu’au jour/semaine/mois…), sinon celle de l’évènement ; une exception donne ses propres dates.
- Instants : heures locales au fuseau de l’évènement (`zonedInstant`) ; journée entière : minuit UTC des dates, fin = lendemain du dernier jour.
- `calledOff` : celui de l’évènement ou de l’exception.
- `trackedSeconds` : somme des temps suivis sur cette occurrence (chronos en cours jusqu’à maintenant).
- `postponedTo` : reports de cette occurrence ; `postponedFrom` : origine du report.
- `archived` : l’évènement (sa série) est archivé. Le paramètre `activeOnly` (calendriers abonnés, disponibilité) exclut les évènements archivés et ceux des calendriers archivés.

### Archivage

Genre `CALENDAR_EVENT` de `setArchived` : archive toute la série. Un évènement archivé est masqué par défaut, en lecture seule, exclu de l’export ICS et de la disponibilité. Voir [Archivage](../cross-cutting/archiving.md).

### Commentaires et fiches

Commentaires sur `EVENT` (toute la série) — voir [Commentaires](../cross-cutting/comments.md) ; fiches par occurrence (`sheetLinks`, `checklists`) — voir [Fiches](../supplies/sheets.md).

## Disponibilité et occupation

Source : `packages/shared/src/calendar/event-busy.ts`.

- `blockingEvent` : un évènement empêche une tâche ou une routine d’être faite à un moment s’il n’est pas annulé, s’il a lieu à ce moment (journée entière : tout le jour), s’il a un contributeur commun avec ses assignés (un évènement sans contributeur et un élément sans assigné comptent comme « Moi »), et s’il ne porte pas sur cette tâche, ni sur cette routine ce jour-là.
- `busyUntil` : fin de l’occupation, la fin de l’évènement, ou minuit local après le dernier jour pour une journée entière.
- `sharePeople` : règle de personne commune (voir plus haut).

## Plages (horaires prévus)

Source : `apps/api/src/services/calendar/work-schedules.ts`, schémas dans `packages/shared/src/calendar/work-schedules.ts`.

### Validation (`workScheduleSchema`)

- Libellé requis, 250 caractères.
- `startDate` requise ; `endDate` facultative, après le début : « La fin doit suivre le début. ».
- `cases` : 1 à 20 (« Ajoutez au moins un cas. », « 20 cas au plus. »). Chaque cas : période facultative (`since`, `until`), ancre, règle de répétition commune avec durée, horaires.
  - Règle hebdomadaire : au moins un jour (« Choisissez au moins un jour. »).
  - Horaires : journée entière, ou au moins une tranche (« Ajoutez des horaires, ou « Journée entière ». ») ; 12 tranches max (« 12 tranches au plus. ») ; la fin d’une tranche suit son début ; tranches sans chevauchement (« Des horaires se chevauchent. »).
- `exceptions` : 200 max (« 200 exceptions au plus. ») ; chacune `from` ≤ `to`, motif 250 caractères, 20 cas max ; sans cas : une pause. Triées par date de début à l’enregistrement.
- `typeId` : type de plage existant, non archivé sauf s’il est déjà celui de la plage (« Type de plage »).

### Enregistrement

- L’ancien format (`intervalWeeks`, `slots`, `pauses`) est vidé à chaque enregistrement ; il n’est plus que lu et converti (`fromLegacySchedule` : jours ayant les mêmes horaires → un cas toutes les n semaines ; pauses → exceptions sans cas). L’ancienne forme des cas (`pattern`, `every`…) est aussi convertie à la lecture (`readScheduleCases`). Les éléments stockés invalides sont ignorés à la lecture.
- Modification refusée si la plage est archivée.
- Suppression : définitive (« Plage de travail » introuvable sinon). Les évènements ne sont pas touchés.
- Archivage générique (`WORK_SCHEDULE`) : lecture seule ; les routines qui la suivent continuent à la lire.

### Calcul des créneaux (`plannedSlots`)

- Pour chaque jour de la période de la plage (dates incluses, sans fin possible), les cas en vigueur sont ceux de l’exception qui couvre le jour (la plus récemment commencée ; à égalité, la plus courte), sinon les cas généraux.
- Un cas produit les tranches de ses horaires sur les jours de sa règle (ou toute la journée : `00:00`–`24:00`).
- `plannedPauses` : exceptions sans cas chevauchant une période.
- `slotMinutes` : minutes des créneaux, les journées entières exclues (pas du temps de travail prévu). Utilisé par le temps prévu, voir [Temps](time.md).
- `withinSlots` : une tranche horaire tient dans un créneau du jour.

### Changement d’un créneau depuis l’agenda (`changedScheduleSlot`)

- `THIS` : une exception d’un jour donne à ce jour ses propres créneaux (et au jour d’arrivée s’il change).
- `FOLLOWING` : le cas s’arrête la veille (seulement s’il avait des jours avant), un nouveau suit avec le changement.
- `ALL` : tous les jours du cas.
- Les autres horaires du cas, et ce créneau ses autres jours de la semaine, restent.
- Refus : fin avant début (« La fin doit suivre le début. »), jour hors de la période (« Ce jour est en dehors de la période de la plage. »), créneau introuvable (« Horaires introuvables ce jour-là. »), suppression des derniers horaires (« Ce sont les derniers horaires de la plage : supprimez la plage elle-même. »).
- Le résultat est enregistré par `updateWorkSchedule` (mêmes validations).

## Types de plages

- Service de libellés commun (`createLabelService`, voir [Nommage](../cross-cutting/naming.md)) : libellé requis 250 caractères, unique dans l’espace (« Un type porte déjà ce libellé. »), couleur `#rrggbb`, image, position, affichage.
- Affichage (`ScheduleDisplay`) : `dayDisplay` ∈ `SLOT_BACKGROUND` (défaut), `DAY_BACKGROUND`, `SLOT_BORDER`, `NONE` ; `dayBar` (défaut vrai) ; `monthDisplay` ∈ `BACKGROUND` (défaut), `BORDER`, `NONE`. Une valeur stockée inconnue retombe sur le défaut (`readScheduleDisplay`).
- Suppression : les plages restent, sans type (`onDelete: SetNull`).
- Archivage générique (`SCHEDULE_TYPE`) : plus proposé, mais gardé là où il est choisi.

### Type par défaut (plages sans type)

- Stocké sur l’espace (`scheduleLabel`, `scheduleColor`, `scheduleDayDisplay`, `scheduleDayBar`, `scheduleMonthDisplay`).
- Libellé 250 caractères max ; vide → « Travail » (`DEFAULT_SCHEDULE_KIND_LABEL`) ; couleur facultative (aucune : le vert des heures de travail).

### Abonnements aux types de plages d’autres espaces

- `foreignScheduleKinds` : pour chaque autre espace, son type par défaut (s’il a des plages sans type) et chacun de ses types, avec nombre de plages, couleur et affichage effectifs ici (ceux de l’abonnement, sinon du type), `customized`, `subscribed`.
- `subscribeScheduleKind` : refus pour l’espace courant (« Ces plages appartiennent déjà à cet espace. ») ; espace source existant (« Espace ») ; type appartenant à cet espace (« Type de plage ») ; sans effet si déjà abonné (vérifié en code, car un type nul n’est pas unique en base).
- Abonné à un type, l’espace voit toutes les plages de ce type, même ajoutées ensuite (`subscribedSchedules`), en lecture seule.
- `setScheduleSubscriptionLook` : couleur et affichage propres (chaque champ nul : celui du type) ; « Abonnement » introuvable si non abonné.
- Suppression du type source ou de l’espace source : l’abonnement disparaît (cascade).

## Règles de plages des tâches et routines

Source : `packages/shared/src/calendar/slot-rules.ts`, `apps/api/src/services/calendar/slot-rules.ts`.

- Une règle `{ inside, outside }` : listes de genres de créneaux (30 max, 120 caractères). Genre d’un type de l’espace : son id ; plages sans type : `default` ; d’un autre espace : `ws:<espace>:<type ou default>`.
- Un genre ne peut être à la fois choisi et exclu : « Un type de plages ne peut pas être à la fois choisi et exclu. ».
- Un moment est permis s’il tombe dans un créneau d’un genre `inside` (n’importe quand si vide) et dans aucun genre `outside` ; les deux vides : partout.
- Sans règle propre (`effectiveSlotRule`) : pendant les plages sans type en PRO, partout en PERSO.
- Les genres sans aucune plage sont ignorés (`knownSlotRule`) : un espace PRO sans plage ne bloque rien.
- L’ancienne forme `{ mode, kinds }` (`ANY`, `INSIDE`, `OUTSIDE`) est lue ; une règle invalide vaut « aucune ».
- `nextAllowed` : prochain moment permis (le moment même, sinon le prochain début d’un créneau `inside` ou la prochaine fin d’un créneau `outside`).
- `doableTaskIds(utcOffset, meId)` (requête `doableTaskIds` des tâches) : tâches ouvertes et non archivées dont la règle permet le moment actuel de l’utilisateur et qu’aucun évènement actif n’occupe (voir [Tâches](tasks.md)).

## Export iCalendar

Source : `apps/api/src/services/calendar/calendar-ics.ts`, route `GET /api/exports/calendar.ics?calendar=<id>` (`apps/api/src/routes/exports.ts`, message d’échec « Export ICS impossible. »).

- Un calendrier (doit exister : « Calendrier ») ou tous ceux de l’espace ; évènements archivés exclus, et calendriers archivés exclus du fichier global. Nom : le calendrier, ou « Agenda » ; fichier `<nom>.ics`.
- `VCALENDAR` 2.0, `PRODID:-//Ordo//Agenda//FR`, `METHOD:PUBLISH`, `X-WR-CALNAME`.
- Chaque évènement : `UID` `<id>@ordo`, `SUMMARY`, `DESCRIPTION` (description + liens « libellé: url »), `LOCATION`, `URL` (premier lien), `DTSTART`/`DTEND` (date pour une journée entière, fin exclusive ; sinon heure locale avec `TZID`), `STATUS` `CANCELLED` ou `CONFIRMED`, `CATEGORIES`, `X-APPLE-TRAVEL-DURATION` (trajet aller seulement), un `VALARM` par rappel (`TRIGGER:-PT<n>M`).
- Répétition : `RRULE` (FREQ, INTERVAL, BYDAY/WKST, BYMONTHDAY, BYMONTH, BYWEEKNO selon le mode) ; un nombre d’occurrences est converti en `UNTIL` à la dernière occurrence (Ordo ne compte pas les dates exclues ni en pause) ; `UNTIL` en UTC (fin du dernier jour) quand il y a une heure. Les mois sans le jour (31 → 30 avril) sont ajoutés en `RDATE`. `EXDATE` : dates exclues, dates des pauses et occurrences supprimées, jusqu’à 10 ans pour une série sans fin.
- Occurrences modifiées : un `VEVENT` de même `UID` avec `RECURRENCE-ID`.
- Texte échappé (`\`, `;`, `,`, sauts de ligne), lignes pliées à 75 octets sans couper un caractère UTF-8, fins de ligne CRLF.

## Export PDF

Source : `apps/api/src/services/calendar/calendar-pdf.ts`, route `POST /api/exports/calendar.pdf` (5 Mo, « Export PDF impossible. »).

- Entrée : la vue telle qu’affichée (`view` mois/semaine/jour, `from`, `to`, `today`, titre et sous-titre) et ses éléments (5 000 max ; libellé 500 caractères, `PRINTED_LABEL_MAX` = 2 × `TEXT_MAX` ; genre `event`, `task`, `time`, `pause`, `work` ; dates ou date-heures locales ; couleur ; `struck`).
- `from` ≤ `to`, 45 jours d’écart au plus : « Période invalide. ».
- A4 paysage, gabarit commun (`startReport`, voir [Erreurs](../cross-cutting/errors.md) pour le format des refus).

## Rappels d’évènements

Les rappels (minutes avant le début ; pour une journée entière, avant minuit local du premier jour) sont sonnés par le navigateur : voir [Règles des alarmes](alarms.md#rappels-dévènements).
