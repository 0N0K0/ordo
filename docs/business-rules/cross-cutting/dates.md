# Dates : jours, périodes, semaines, fuseaux, répétitions

Comment l'application compte les jours et les heures : jour de calendrier sans fuseau, « aujourd'hui » de l'API, semaine de l'espace, périodes relatives, règle début / fin, répétitions et leurs exceptions. Sources : `packages/shared/src/dates/**`, `packages/shared/src/tables/filters.ts`, `apps/api/src/today.ts`, `apps/web/src/lib/dates.ts`, `apps/api/src/graphql/builder.ts`, `apps/api/src/services/core/date-range.ts`.

Voir aussi : [dates](../../shared/cross-cutting/dates.md), [calendar](../../shared/activities/calendar.md), [routines](../../shared/activities/routines.md), [Calendrier](../activities/calendar.md), [Routines](../activities/routines.md), [Tâches](../activities/tasks.md).

## Jours et instants

- Un **jour** est une chaîne `YYYY-MM-DD` (scalaire GraphQL `Date`, qui refuse un jour inexistant comme le 31 février). Il est stocké et calculé à minuit UTC, sans fuseau : il s'affiche tel quel partout (le 13 mai reste le 13 mai quel que soit le fuseau).
- Un **instant** est une date-heure ISO 8601 (scalaire `DateTime`).
- Toute heure et tout jour sont lus à l'heure de **Paris** (`Europe/Paris`, `PARIS_ZONE`), côté web comme côté API, quel que soit le fuseau du navigateur ou du serveur : un instant s'affiche à l'heure de Paris, son jour est son jour à Paris, une heure saisie (temps passé, envoi programmé d'un mail, coche d'une routine après coup…) est une heure de Paris, « maintenant » se compare aux horaires et créneaux à l'heure de Paris, l'agenda est réglé sur Paris, le jour mis en avant dans les sélecteurs de dates est aujourd'hui à Paris. Un jour `YYYY-MM-DD` n'a pas de fuseau.
- Formats d'affichage communs (`fr-FR`) : « ven. 13 nov. » (`weekdayText`), « novembre 2026 » (`monthText`), « 13 novembre 2026 » / « 1er juin 2026 » (`longDayText`), « 13/11/2026 » dans les documents et mails (`printedDay`), « T4 2026 » pour un trimestre.
- Ordinaux : « 1er », « 2e »… « dernier », partout.

## « Aujourd'hui »

- Côté API, « aujourd'hui » est le jour à **Paris** (`parisToday()`, `Europe/Paris`), quel que soit le fuseau du serveur : factures en retard, routines dues, émission des factures récurrentes, budgets, date d'acceptation d'un devis…
- Les dates d'export des PDF sont imprimées à l'heure de Paris.
- Côté web aussi, « aujourd'hui » est le jour à Paris (`parisToday()`, `useToday()`) : le web et l'API comptent le même jour. Aucune requête n'envoie le fuseau du navigateur (les tâches faisables maintenant le sont à l'heure de Paris, `doableTasks`).
- Une occurrence de routine à venir ne peut pas être cochée : « Une occurrence à venir ne peut pas être cochée. » (`apps/api/src/services/routines/routines.ts`).

## Début et fin

- Règle unique pour toute paire de dates (début / fin, min / max, toute période) : la fin suit le début (égale permise), sinon « La fin doit suivre le début. » sous le champ de fin. Une borne absente est toujours acceptée (`endsAfter`, `endAfter`).
- Dans les formulaires, un seul champ de période commun : changer le début après la fin déplace la fin à la même date, changer la fin avant le début déplace le début ; les dates impossibles ne sont pas sélectionnables.
- Restent en deux champs : les tableaux (une cellule par bout, début et fin), un budget (deux champs de mois, « À partir de » et « Jusqu’à »), les heures seules (moments de routine, cas d'une répétition).
- Report d'un évènement : la fin reste modifiable ; déplacer le début garde la durée (la fin se déplace d'autant).
- Strictement après pour les heures d'une tranche (créneaux, moments de routine).
- Modification partielle : `assertDateRange` fusionne les jours envoyés avec ceux enregistrés (un jour omis est inchangé) avant de vérifier ; l’erreur va sous le champ de fin donné (`endDate` par défaut, `deadline` pour l’« Échéance » d’une tâche).
- Variantes de message : « L’échéance doit suivre la date du document. », « La fin de la répétition doit suivre le début. ».

## Semaine de l'espace

- Chaque espace choisit son premier et son dernier jour de semaine (`weekStart`, `weekEnd`, 1 = lundi … 7 = dimanche ; lundi à dimanche par défaut), via `setWorkspaceWeek`, réglés dans les paramètres de l’agenda (section « Semaine »).
- Le même jour deux fois (mercredi à mercredi) donne des semaines de 8 jours qui se chevauchent sur ce jour ; un intervalle court (lundi à vendredi) laisse des jours hors semaine.
- La semaine sert à la vue semaine du calendrier, aux périodes « cette semaine » des filtres, aux regroupements par semaine.
- Les sélecteurs de date (calendriers des champs de date) ne la suivent pas : leurs semaines vont toujours du lundi au dimanche.
- Les numéros de semaine (répétitions, durées) sont ISO : la semaine du 4 janvier est la première.

## Périodes relatives

Filtres, formulaires d'export et graphiques (`filterDay`, `filterPeriod`, `calendarRange`) :

- Jour relatif : `today`, `today+3`, `today-7`.
- Périodes nommées : semaine, mois, trimestre, année, en cours / dernier / prochain (« Cette semaine », « Ce mois-ci », « Le mois dernier »…), un seul jeu de noms pour les filtres, les exports et les tableaux de bord.
- État d'une période par rapport à aujourd'hui : « À venir », « En cours », « Passée ».
- Périodes glissantes : `past:N` (les N derniers jours, aujourd'hui compris), `next:N` (les N prochains, aujourd'hui compris).
- Graphiques : périodes glissantes `past:28` … `next:365`, `all`, ou période calendaire `month|quarter|year:0|-1|<premier jour>`.
- La fin d'une période est exclusive dans les calculs (`jour < fin`).

## Répétitions

Une seule forme de répétition (`recurrenceSchema`) pour les événements, les alarmes, les mouvements prévus de trésorerie, les factures récurrentes, les créneaux et les routines.

- Fréquences : quotidienne, hebdomadaire, mensuelle, annuelle, tous les N (1 à 999).
- Hebdomadaire : jours choisis (vide : le jour de la première date), toutes les N semaines, ou semaines ISO paires / impaires : toutes (« Les semaines paires »), ou une sur x (« Toutes les x semaines paires / impaires », x de 1 à 999). Une sur x compte depuis la première semaine de cette parité de la série (celle de la première date, ou la suivante si elle n'a pas cette parité) : x = 2 en semaines paires depuis la semaine 1 ou 2 donne les semaines 2, 6, 10… Les semaines suivent ISO 8601 (lundi à dimanche, la semaine 1 contient le premier jeudi de l'année, le numéro donne la parité) ; la semaine 53 est impaire et suivie de la semaine 1, impaire aussi : deux semaines impaires de suite, comptées l'une après l'autre (aucune alternance forcée). L'intervalle « tous les N » ne sert pas avec les semaines paires / impaires (les règles enregistrées avant gardent toutes les semaines de leur parité, quel que soit leur intervalle). Un nombre de semaines paires / impaires sans semaines paires ou impaires est refusé (« Toutes les n semaines paires ou impaires : choisissez d’abord les semaines paires ou impaires. »).
- Mensuelle et annuelle : même numéro de jour (le dernier jour pour un mois plus court : le 31 tombe le 30 ou le 28), « Le dernier jour du mois » (le 31, 30, 29 ou 28 selon le mois ; en annuelle, le dernier jour de son mois : le 28 ou le 29 février), ou n-ième jour de semaine (1er à 4e, ou dernier) ; mensuelle aussi : le jour de semaine de la n-ième (1re à 3e) ou de la dernière semaine paire / impaire du mois (« Le mardi de la 1re semaine paire de chaque mois » : le premier mardi du mois dont la semaine ISO est paire ; la dernière comptée de même depuis la fin du mois). Un mois a 2 ou 3 de ces jours : sans n-ième, aucune occurrence ce mois-là (pas de report) ; une 4e est refusée (« Un mois n’a jamais de 4e semaine paire ou impaire : choisissez la 1re, la 2e, la 3e ou la dernière. »), et la semaine paire / impaire hors « Un jour de semaine du mois » mensuel aussi (« Une semaine paire ou impaire du mois va seulement avec « Un jour de semaine du mois », chaque mois. ») ; annuelle aussi : même jour d'une semaine ISO. Le dernier jour vaut pour toutes les répétitions (évènements, routines, créneaux, éphémérides, alarmes, mouvements prévus, factures récurrentes) ; l'export iCalendar l'écrit `BYMONTHDAY=-1` (avec `BYMONTH` en annuelle).
- Fin : une date (incluse) **ou** un nombre d'occurrences (1 à 9999), pas les deux (« Choisissez une date de fin ou un nombre d’occurrences. »).
- **Exceptions** : une seule notion, partout où il y a une répétition (évènements, créneaux et éphémérides, routines, alarmes, horaires des tâches, mouvements prévus, factures récurrentes). Une exception est « rien ce jour-là » (l'occurrence n'a pas lieu), « annulée » (gardée, barrée) ou « modifiée » (déplacée, autres heures, autre montant…). Modifier ou déplacer une occurrence crée une exception, sans rompre la série.
  - « Rien » : les jours de la règle (`exceptions`, 5000 au plus) qui n'ont pas lieu ; ils ne comptent pas dans le nombre d'occurrences. Une prévision de trésorerie réalisée y met son occurrence ; les alarmes, mouvements prévus et factures récurrentes n'ont que celles-là pour l'instant.
  - « Annulée » et « modifiée » : celles de chaque domaine (évènements : `CalendarEventException` ; routines : leurs exceptions `moves` ; créneaux et éphémérides : les exceptions de l'horaire, dont celle sur une période sans horaires, « rien » sur toute la période).
  - Il n'y a plus de pauses. Une règle enregistrée avec des pauses est lue avec, à la place, une exception « rien » pour chaque jour de la pause qui peut être un jour de la règle (ses jours de la semaine, son jour du mois, son mois… choisis), et réécrite sans pause au prochain enregistrement ; au-delà de 5000 exceptions, les derniers jours de pause sont laissés de côté (ces occurrences reviennent).
  - Les horaires des tâches n'ont pas d'occurrences : seulement les exceptions « rien » de leurs règles (anciennes pauses comprises).
  - Elles se voient sous la répétition (une synthèse, la même partout) et se modifient dans une fenêtre : chacune s'y retire (« Rétablir » : l'occurrence revient comme sa règle la donne) ; une exception « rien » s'y ajoute un jour de la règle, là où il n'y a qu'une règle (évènements, routines à une seule règle).
- La première date est toujours une occurrence (sauf une exception « rien »).
- Durée d'une occurrence : un jour par défaut ; N jours, N semaines (jusqu'à la fin de la dernière semaine), N mois (jusqu'à la fin du dernier mois : 1 mois depuis le 15 novembre finit le 30 novembre), ou jusqu'à un jour / une semaine ISO / un mois donné (le suivant s'il tombe avant). Jusqu'à un jour : un numéro (le dernier jour d'un mois plus court), ou « le dernier jour du mois » : celui du mois du premier jour (jamais le suivant : il ne tombe jamais avant), ou celui d'un mois donné (« jusqu'au dernier jour de février » : le 28 ou le 29, l'année suivante s'il tombe avant). Routines (cas), créneaux, éphémérides et évènements journée entière répétés.
- Une série des semaines paires / impaires (toutes, ou une sur x) déplacée d'un nombre de semaines (« Celle-ci et les suivantes », « Toutes » : évènement, routine, créneau, éphéméride) emmène ses semaines dans leur ordre : chaque occurrence est décalée d'autant, même à travers une semaine 53 (impaires depuis le 14 décembre 2026, décalées de 14 jours : 28 déc., 11 janv., 18 janv., 1er févr. ; les semaines 53 et 1, impaires toutes deux, deviennent les semaines 2 et 3). Sa parité affichée est celle de ses semaines hors d'une semaine 53 (échangée pour un nombre impair de semaines) ; la règle garde le nombre de semaines du décalage (`parityShift`), qui s'ajoute à chaque nouveau déplacement et disparaît quand il revient à 0 ou que le formulaire choisit une autre parité, « Toutes les semaines » ou une autre fréquence.
- Couper une série à une date (« celle-ci et les suivantes ») : la partie avant garde le nombre d'occurrences déjà passées (`occurrencesBefore`).
- Une répétition le dernier jour du mois déplacée à un autre jour (« Celle-ci et les suivantes », « Toutes » : évènement, routine, créneau, éphéméride) ne reçoit jamais de nouvelle règle décidée seule, car tous les mois n'ont pas le même nombre de jours : un formulaire demande la nouvelle règle, prérempli avec la règle décalée comme une autre (fin, exceptions, nombre d'occurrences) sur le jour d'arrivée (le dernier jour du mois quand ce jour est le dernier de son mois, sinon son numéro). Sans nouvelle règle, le déplacement est refusé (« Cette répétition tombe le dernier jour du mois : choisissez sa nouvelle règle pour la déplacer. »). « Cette occurrence » seule (une exception) ne demande rien, ni un changement d'heures sans changement de jour.

### Portée d'une modification

Événements répétés et créneaux : `THIS` (cette occurrence : une exception), `FOLLOWING` (celle-ci et les suivantes : la série est coupée la veille et une nouvelle suit), `ALL` (toute la série). Voir [Calendrier](../activities/calendar.md).

### Répétition par cas

Les créneaux, les éphémérides, les horaires des tâches et les routines peuvent combiner plusieurs **cas** (1 à 20), chacun avec son **début**, sa règle (et sa **fin** : jamais, une date ou un nombre de fois) et ses horaires (voir [dates](../../shared/cross-cutting/dates.md), `repetition.ts`). Les jours d'occurrence sont l'union des débuts d'occurrence des cas, moins leurs exceptions « rien » (qui ne sont plus recréées) ; un jour pris par plusieurs cas suit le premier.

- **Début** : le jour d'où compte le rythme du cas (tous les n jours, semaines, mois, ans, nombre de fois), et son premier jour possible ; sans début, le cas commence avec l'élément : le premier jour de la série (routine), le début de la période (créneau, éphéméride, période d'exception). Les horaires d'une tâche n'ont pas de premier jour : un cas dont le rythme compte depuis un jour (`ruleCountsFromDay`) demande son début.
- **Fin** : celle de sa règle ; une occurrence qui dure plusieurs jours va jusqu'à son dernier jour.
- Un cas enregistré avec une période (`since`, `until`) et un jour de départ du rythme (`anchor`) est lu ainsi, et réécrit au prochain enregistrement : son début est ce jour de départ, sinon le début de sa période ; un rythme qui partait avant la période commence à sa première occurrence qui y entre (une occurrence de plusieurs jours commencée avant compte) (valeurs mensuelles et annuelles et jour de la semaine de l'ancien départ gardés, nombre de fois diminué des occurrences d'avant) ; la fin de la période devient la fin de la règle (un nombre de fois gardé, réduit aux occurrences jusqu'à elle ; une date de fin plus tôt gardée). Un cas sans plus aucune occurrence n'est pas lu. Les cas des routines (`from`, `until`) gardent leur dernier jour (`until`) jusqu'à leur prochain enregistrement depuis le formulaire, qui le passe dans la fin de leur règle.

### Fuseaux

- Les heures d'un évènement sont des heures de **Paris** (un évènement n'a pas de fuseau propre) ; l'instant réel est calculé par `zonedInstant(…, 'Europe/Paris')` (deux passes pour les changements d'heure). L'export iCalendar écrit toujours `Europe/Paris`. Les rappels des tâches, routines et évènements sonnent aussi en heure de Paris (`parisInstant`). Il n'y a pas d'import iCalendar.
- Les alarmes sonnent à l'heure de Paris, dans l'app comme sur le serveur (`previousOccurrence`, `nextOccurrence`, recherche sur 2 jours en arrière et 800 jours en avant), jamais à l'heure de l'appareil.

## Durées

- Temps passé : 1 minute à 24 heures ; saisie libre « 1:30 », « 1h30 », « 90 » (minutes), « 1,5 h » (`parseDuration`) ; affichage « 2 h 05 », « 45 min ».
- Trajets : minutes entières de 0 à 1440, arrondies aux 5 minutes supérieures quand elles viennent d'un itinéraire.
