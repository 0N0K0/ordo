# Dates : jours, périodes, semaines, fuseaux, répétitions

Comment l'application compte les jours et les heures : jour de calendrier sans fuseau, « aujourd'hui » de l'API, semaine de l'espace, périodes relatives, règle début / fin, répétitions et leurs exceptions. Sources : `packages/shared/src/dates/**`, `packages/shared/src/tables/filters.ts`, `apps/api/src/today.ts`, `apps/api/src/graphql/builder.ts`, `apps/api/src/services/core/date-range.ts`.

Voir aussi : [dates](../../shared/cross-cutting/dates.md), [calendar](../../shared/activities/calendar.md), [routines](../../shared/activities/routines.md), [Calendrier](../activities/calendar.md), [Routines](../activities/routines.md), [Tâches](../activities/tasks.md).

## Jours et instants

- Un **jour** est une chaîne `YYYY-MM-DD` (scalaire GraphQL `Date`, qui refuse un jour inexistant comme le 31 février). Il est stocké et calculé à minuit UTC, sans fuseau : il s'affiche tel quel partout (le 13 novembre reste le 13 novembre quel que soit le fuseau).
- Un **instant** est une date-heure ISO 8601 (scalaire `DateTime`) : il s'affiche dans le fuseau de l'environnement (celui de l'utilisateur dans le web).
- Formats d'affichage communs (`fr-FR`) : « ven. 13 nov. » (`weekdayText`), « novembre 2026 » (`monthText`), « 13 novembre 2026 » / « 1er juin 2026 » (`longDayText`, décision V), « 13/11/2026 » dans les documents et mails (`printedDay`).
- Ordinaux : « 1er », « 2e »… « dernier » (décision V).

## « Aujourd'hui »

- Côté API, « aujourd'hui » est le jour à **Paris** (`parisToday()`, `Europe/Paris`), quel que soit le fuseau du serveur : factures en retard, routines dues, émission des factures récurrentes, budgets, date d'acceptation d'un devis…
- Les dates d'export des PDF sont imprimées à l'heure de Paris.
- Côté web, « aujourd'hui » est le jour local de l'utilisateur ; certaines requêtes envoient le décalage horaire (`utcOffset`, ex. tâches faisables maintenant).
- Une occurrence de routine à venir ne peut pas être cochée : « Une occurrence à venir ne peut pas être cochée. » (`apps/api/src/services/routines/routines.ts`).

## Début et fin

- Règle unique (décision Q) : la fin suit le début (égale permise), sinon « La fin doit suivre le début. » sous le champ de fin. Une borne absente est toujours acceptée (`endsAfter`, `endAfter`).
- Strictement après pour les heures d'une tranche (plages horaires, moments de routine).
- Modification partielle : `assertDateRange` fusionne les jours envoyés avec ceux enregistrés (un jour omis est inchangé) avant de vérifier.
- Variantes de message : « L’échéance doit suivre la date du document. », « La fin de la répétition doit suivre le début. ».

## Semaine de l'espace

- Chaque espace choisit son premier et son dernier jour de semaine (`weekStart`, `weekEnd`, 1 = lundi … 7 = dimanche ; lundi à dimanche par défaut), via `setWorkspaceWeek`.
- Le même jour deux fois (mercredi à mercredi) donne des semaines de 8 jours qui se chevauchent sur ce jour ; un intervalle court (lundi à vendredi) laisse des jours hors semaine.
- La semaine sert à la vue semaine du calendrier, aux périodes « cette semaine » des filtres, aux regroupements par semaine.
- Les numéros de semaine (répétitions, durées) sont ISO : la semaine du 4 janvier est la première.

## Périodes relatives

Filtres, formulaires d'export et graphiques (`filterDay`, `filterPeriod`, `calendarRange`) :

- Jour relatif : `today`, `today+3`, `today-7`.
- Périodes nommées : semaine, mois, trimestre, année, en cours / dernier / prochain (« Cette semaine », « Le mois dernier »…).
- Périodes glissantes : `past:N` (les N derniers jours, aujourd'hui compris), `next:N` (les N prochains, aujourd'hui compris).
- Graphiques : périodes glissantes `past:28` … `next:365`, `all`, ou période calendaire `month|quarter|year:0|-1|<premier jour>`.
- La fin d'une période est exclusive dans les calculs (`jour < fin`).

## Répétitions

Une seule forme de répétition (`recurrenceSchema`) pour les événements, les tâches répétées, les alarmes, les mouvements prévus de trésorerie, les factures récurrentes, les plages horaires et les routines.

- Fréquences : quotidienne, hebdomadaire, mensuelle, annuelle, tous les N (1 à 999).
- Hebdomadaire : jours choisis (vide : le jour de la première date), ou semaines ISO paires / impaires.
- Mensuelle et annuelle : même numéro de jour (le dernier jour pour un mois plus court : le 31 tombe le 30 ou le 28), ou n-ième jour de semaine (1er à 4e, ou dernier) ; annuelle aussi : même jour d'une semaine ISO.
- Fin : une date (incluse) **ou** un nombre d'occurrences (1 à 9999), pas les deux (« Choisissez une date de fin ou un nombre d’occurrences. »).
- Exceptions (dates supprimées une à une, 5000 max) et pauses (périodes incluses, 100 max) : elles n'ont pas lieu et ne comptent pas dans le nombre d'occurrences.
- La première date est toujours une occurrence (sauf exclue ou en pause).
- Durée d'une occurrence : un jour par défaut ; N jours, N semaines (jusqu'à la fin de la dernière semaine), N mois (jusqu'à la fin du dernier mois), ou jusqu'à un jour / une semaine ISO / un mois donné (le suivant s'il tombe avant).
- Couper une série à une date (« celle-ci et les suivantes ») : la partie avant garde le nombre d'occurrences déjà passées (`occurrencesBefore`).

### Portée d'une modification

Événements répétés et plages horaires : `THIS` (cette occurrence : une exception), `FOLLOWING` (celle-ci et les suivantes : la série est coupée la veille et une nouvelle suit), `ALL` (toute la série). Voir [Calendrier](../activities/calendar.md).

### Répétition par cas

Tâches répétées, plages horaires et routines peuvent combiner plusieurs **cas** (1 à 20), chacun avec sa période (`since`, `until`), sa règle et ses horaires (voir [dates](../../shared/cross-cutting/dates.md), `repetition.ts`). Les jours d'occurrence sont l'union des débuts d'occurrence des cas, moins les jours supprimés (qui ne sont plus recréés).

### Fuseaux

- Les heures d'un événement sont locales à son fuseau (`timeZone`, IANA) ; l'instant réel est calculé par `zonedInstant` (deux passes pour les changements d'heure). L'export iCalendar utilise ce fuseau.
- Les alarmes sonnent à l'heure locale de l'appareil (`previousOccurrence`, `nextOccurrence`, recherche sur 2 jours en arrière et 800 jours en avant).

## Durées

- Temps passé : 1 minute à 24 heures ; saisie libre « 1:30 », « 1h30 », « 90 » (minutes), « 1,5 h » (`parseDuration`) ; affichage « 2 h 05 », « 45 min ».
- Trajets : minutes entières de 0 à 1440, arrondies aux 5 minutes supérieures quand elles viennent d'un itinéraire.
