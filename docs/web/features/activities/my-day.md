# Code web de « Ma journée »

Tous les fichiers de `apps/web/src/features/my-day/` : la page « Ma journée » de l’espace courant. Règles : [Règles de « Ma journée »](../../../business-rules/activities/my-day.md). Calculs partagés : [`my-day.ts`](../../../shared/activities/calendar.md#my-dayts--placement-de--ma-journée-), [`my-day-settings.ts`](../../../shared/activities/calendar.md#my-day-settingsts--réglages-de--ma-journée-).

## api

### `api/index.ts`

Fragment `MyDaySettingsFields` (tous les champs de `MyDaySettings` : `tasks`, `routines`, `schedules`, `hiddenCalendarIds`, `hiddenScheduleIds`, `filters` en JSON) ; requête `MyDaySettings` ; mutation `UpdateMyDaySettings` ; les réponses lues par `readMyDaySettings`.

| Export | Rôle | Utilisé par |
| ------ | ---- | ----------- |
| `myDaySettingsKey` | Clé `['my-day', 'settings']` des réglages (de l’utilisateur, dans l’espace de la fenêtre). | `useMyDaySettings`, `useSaveMyDaySettings` |
| `useMyDaySettings()` | Réglages de « Ma journée » de l’utilisateur dans l’espace courant, tels qu’enregistrés sur le serveur (les valeurs par défaut s’il n’en a jamais enregistré). | `useMyDaySettingsState` |
| `useSaveMyDaySettings()` | Enregistre tout le jeu de réglages (`useInvalidatingMutation`) : montré tout de suite (optimiste), remis comme avant si l’enregistrement échoue (l’appelant dit l’erreur), relu en arrière-plan ; les enregistrements attendent les uns les autres (`queue` « my-day-settings ») : celui qu’un plus récent attend n’est pas envoyé, et les réglages ne sont relus qu’après le dernier (deux changements rapides ne se défont pas à l’écran). | `useMyDaySettingsState` |
| `useMyDaySettingsState()` | `{ query, ready, settings, change }` : les réglages tels que la page les montre (le dernier changement demandé tant qu’il n’est pas enregistré, sinon ceux du cache, sinon les valeurs par défaut) et `change(patch \| (current) => patch)`, qui part du dernier changement demandé (même en cours d’enregistrement), le montre tout de suite et enregistre tout le jeu (une valeur tapée dans un filtre n’arrive qu’en quittant son champ : `useTypedField`, voir [Filtres](../../components/filters.md#principes)) ; l’échec du dernier changement demandé : toast (`onMutationError`) et les réglages du cache montrés (celui d’un plus ancien n’est pas dit : le plus récent l’envoie aussi) ; rien ne change tant que les réglages enregistrés ne sont pas chargés (`ready`). | `useMyDay` |
| `MyDaySettingsChange` (type) | Un changement des réglages : les champs changés, ou comment les changer depuis les réglages actuels. | `useMyDay`, `MyDayPage` |

Interne : `NO_SETTINGS` (réglages jamais choisis).

## hooks

### `hooks/use-my-day.ts`

| Export | Rôle | Utilisé par |
| ------ | ---- | ----------- |
| `useMyDay(day)` | Tout ce que la page montre un jour, rassemblé et rangé (`myDayRows`) : `{ layout, settings, settingsReady, changeSettings, filterSections, context, today, loading, error }`. Sources : `useTaskContext` (tâches, `taskDayReasons`, fenêtres `itemWindowsOn` sur `useSlotRules().slotsOn`), `useTimeEntriesSince(minuit, jour passé, minuit du lendemain)` (les temps du jour, `DayTask.times`, un jour passé seulement), `useRoutinesData` et `useRoutineOccurrences({ from: jour, to: jour, doneInPeriod: true })` (les moments du jour par `routineDayEntries` partagé, le même que la pastille du menu : ouverts ce jour ou faits ce jour, annulés le jour de leur échéance, aujourd’hui les routines en retard réduites aux fenêtres d’aujourd’hui, `itemWindowsOn` de leur condition ; les routines parentes présentes ce jour-là par `routineGroupStatesOn`, chacune un élément `routineGroup` sous lequel se rangent ses sous-routines qui comptent ce jour-là, dues ce jour-là, `groupKey`), `useCalendarEvents` (occurrences du jour), `useScheduleSources` et `scheduleSources(…, false)` (éphémérides, et créneaux des heures avec `unavailable`, ni archivés ni d’un type archivé dans leur espace), `useBirthdays`, `useCalendars` et `useCalendarCategories` (champs du filtre des évènements), `useActiveWorkspace` (`perso`). Réglages : `useMyDaySettingsState` ; appliqués comme dans l’agenda : `tasks`, `routines`, `schedules` (éphémérides, anniversaires, créneaux des heures), `hiddenCalendarIds`, `hiddenScheduleIds`, et `useCalendarFilters({ ...settings, timers: false }, …)` (`filterSections` pour « Filtrer », `kept` : `event`, `task`, `routine`, `schedule` ; ce qui vient d’un autre espace n’est pas filtré). Liens avec les évènements : `taskIds` et `routineLinks` des occurrences du jour. `layout` vaut `null` tant que tout n’est pas chargé (au changement de jour aussi : pas d’occurrences de la veille gardées en attendant) ; `error` quand une requête du jour a échoué ; rafraîchi chaque minute (`useNow`). | `MyDayPage` |
| `MyDayEntry` | Élément du jour (`MyDayItem` avec sa donnée) : `MyDayTask` (`task`), `MyDayRoutine` (`routine`, `occurrence`, `slot`, `missed` : non fait un jour passé), `MyDayRoutineGroup` (`routine`, `state` : son état du jour, `RoutineGroupState`, `occurrence` : la sienne due ce jour-là ou `null`), `MyDayEvent` (`occurrence`), `MyDayEphemeris` (`label`, `color`), `MyDayBirthday` (`birthday`, `label`). | `MyDayRowView`, `MyDayPage` |
| `MyDayHourSlot` | Créneau des heures (`MyDaySlot` avec `label`, `color`). | `MyDayPage` |
| `MyDay` | Ce que rend `useMyDay`. | `MyDayPage` |

Internes : `NONE`, `linkedKeys` (occurrences liées à un élément), `parisTime` (heure de Paris d’un instant), `routineShown` (routine affichée : réglage, pas une parente, gardée par le filtre), `routineWindows` (les fenêtres d’un moment de routine coupé par des créneaux : plusieurs ; sinon aucune, il se range à son heure).

### `hooks/use-day-add.ts`

| Export | Rôle | Utilisé par |
| ------ | ---- | ----------- |
| `useDayAdd(context)` | Les nouveaux éléments d’un jour, la même règle pour « Ajouter » de la page et celui de l’en-tête sur cette page : `{ task(on, defaults?), event(on, defaults?), routine(on, defaults?) }`, chacun ouvert dans le panneau latéral ; `on` (`AddDay` : le jour et les calendriers masqués) préremplit une tâche ouverte et due ce jour (`useTaskActions(context).create` avec `minDate` et `deadline`), un évènement toute la journée ce jour dans le premier calendrier affiché (`useEventForm`, `newEventDefaults`), une routine faite la première fois ce jour (`openRoutineForm({ startDate })`) ; `on` nul : les nouveaux éléments comme ailleurs. `defaults` : les autres champs (le projet d’une page projet, pour une routine aussi : `projectId`). Règle eslint : pas d’`openRoutineForm` avec `startDate` ni de `create` d’actions de tâches avec `minDate` / `deadline` écrits à la main. | `MyDayAdd`, `QuickActions` |
| `DayAdd` (type) | Ce que rend `useDayAdd`. | `QuickActions` |

## components

### `components/MyDayRows.tsx`

| Export | Rôle | Utilisé par |
| ------ | ---- | ----------- |
| `MyDayRowView({ row, context, today, day })` | Une ligne du jour selon son type, avec sous elle (en retrait) les tâches et routines liées à un évènement, ou les sous-routines d’une routine parente. Tâche : `TaskDoneButton`, `TimerCell` (`size="sm"`, comme les autres chronos des lignes), nom qui ouvre son panneau (`useTaskLink`), `LateBadge` en retard, menu `useTaskActions(context).menu`. Moment de routine : `RoutineTickButton` (un jour passé, avec `day` : « Faite le » proposé ce jour-là), `RoutineTimerToggle` (`routineTimer`), nom qui ouvre `openRoutineForm` sur l’occurrence, « Depuis … » en retard, « Non faite », « faite à HH:MM », « Modifier » et menu `useRoutineOccurrenceMenu` (`RowActions`). Routine parente (interne `RoutineGroupRow`) : pas de bouton d’état, nom qui ouvre `openRoutineForm`, `RoutineGroupProgress` (« 2/3 », « aujourd’hui » ou « ce jour-là »), menu `useRoutineOccurrenceMenu` sur son occurrence due ce jour-là (`occurrence` du `MyDayRoutineGroup`, `null` sans elle : pas de report) ; atténuée une fois toutes ses sous-routines dues faites. Évènement : pas de bouton d’état, `EventTimerToggle`, nom qui ouvre `useEventForm`, menu `useEventMenu`. Éphéméride : son nom. Anniversaire : ouvre la personne (`usePersonOpener`). | `MyDayPage` |

Internes : `RowLine` (la ligne commune : bouton d’état, heure, nom et détails, chrono et menu ; atténuée faite ou annulée, barrée annulée), `OpenLabel` (nom qui ouvre le panneau, `UnstyledButton`), `OtherWindows` (« aussi … »), `TaskRow`, `RoutineRow`, `EventRow`, `EphemerisRow`, `BirthdayRow`.

### `components/MyDay.module.css`

Blocs (`block`), heures (`hour` : grille heure / lignes, fond `--slot-color`, grisé `data-unavailable`, trait entre deux heures en ombre intérieure pour rester sur le rythme vertical, trait de l’heure de maintenant `data-current`), lignes de deux pas verticaux (`row` : teinte légère au survol, `data-finished` atténuée, transitions sobres), colonnes de la ligne (`state`, `time`, `label`), nom qui ouvre le panneau (`open` : souligné au survol, contour au focus du clavier, barré annulé), éléments liés en retrait (`children`).

## pages

### `pages/MyDayPage.tsx`

`MyDayPage` : route `/my-day` (`PAGES.myDay`). `PageHeader`, puis la barre (à gauche le jour et « Filtrer », à droite « Ajouter ») : `DayNav` (aujourd’hui par défaut, jour en état local, pas dans l’adresse) et `CalendarFilters` (sections `filterSections` de `useMyDay`, un filtre changé par `changeSettings` ; affiché une fois les réglages chargés, `settingsReady`), `PageSettings` « Paramètres de Ma journée » (`ListSkeleton` tant que les réglages ne sont pas chargés), `ErrorAlert` en cas d’échec, `ListSkeleton` au chargement, `EmptyState` sans rien ce jour, puis les blocs dans un `Paper` : en tête, « Sans horaire », les heures, « Faits et annulés » (titres `Caption`). Le jour où ajouter (`AddDay` : le jour affiché et les calendriers masqués des réglages, nul tant que les réglages enregistrés et les calendriers ne sont pas chargés) est donné à l’en-tête (`useProvideAddDay`, voir [Application web](../../app.md)). Internes : `MyDayAdd` (« Ajouter » : `ActionButton` à menu, comme l’agenda ; « Tâche », « Évènement » et « Routine » par `useDayAdd` sur ce jour, désactivés sans lui, « Tâche » et « Évènement » aussi sans contexte des tâches), `Rows`, `Block`, `hourStyle` (fond de l’heure : couleur du premier créneau, heures de travail en vert), `HourBlock` (heure, noms des créneaux, « Indisponible », lignes), `MyDaySettingsPanel` (section « Affichage » : `CalendarDisplayChoices` avec les calendriers non archivés de l’espace, `calendarChoices`, et les créneaux et éphémérides ni archivés ni d’un type archivé, `scheduleChoices` sur `scheduleSources(…, false)`, « Aussi dans Ma journée »).
