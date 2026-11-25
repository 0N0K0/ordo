# Code web de « Ma journée »

Tous les fichiers de `apps/web/src/features/my-day/` : la page « Ma journée » de l’espace courant. Règles : [Règles de « Ma journée »](../../../business-rules/activities/my-day.md). Calculs partagés : [`my-day.ts`](../../../shared/activities/calendar.md#my-dayts--placement-de--ma-journée-), [`my-day-settings.ts`](../../../shared/activities/calendar.md#my-day-settingsts--réglages-de--ma-journée-).

## api

### `api/index.ts`

Fragment `MyDaySettingsFields` (tous les champs de `MyDaySettings`, dont `showBirthdays`, `withoutProject`, `hiddenSlotKinds`) ; requête `MyDaySettings` ; mutation `UpdateMyDaySettings`.

| Export | Rôle | Utilisé par |
| ------ | ---- | ----------- |
| `myDaySettingsKey` | Clé `['my-day', 'settings']` des réglages (de l’utilisateur, dans l’espace de la fenêtre). | `useMyDaySettings`, `useSaveMyDaySettings` |
| `useMyDaySettings()` | Réglages de « Ma journée » de l’utilisateur dans l’espace courant, tels qu’enregistrés sur le serveur (les valeurs par défaut s’il n’en a jamais enregistré). | `useMyDay` |
| `useSaveMyDaySettings()` | Enregistre tout le jeu de réglages (`useInvalidatingMutation`) : montré tout de suite (optimiste), remis comme avant si l’enregistrement échoue (l’appelant dit l’erreur), relu en arrière-plan. | pas encore placé dans un écran |

## hooks

### `hooks/use-my-day.ts`

| Export | Rôle | Utilisé par |
| ------ | ---- | ----------- |
| `useMyDay(day)` | Tout ce que la page montre un jour, rassemblé et rangé (`myDayRows`) : `{ layout, settings, context, today, loading, error }`. Sources : `useTaskContext` (tâches, `taskDayReasons`, fenêtres `itemWindowsOn` sur `useSlotRules().slotsOn`), `useTimeEntriesSince(minuit, jour passé, minuit du lendemain)` (les temps du jour, `DayTask.times`, un jour passé seulement), `useRoutinesData` et `useRoutineOccurrences({ from: jour, to: jour, doneInPeriod: true })` (moments ouverts ce jour ou faits ce jour, `inRoutineHistoryOn` ; annulés le jour de leur échéance ; aujourd’hui, les routines en retard par leur occurrence en cours, réduites aux fenêtres d’aujourd’hui : `itemWindowsOn` de leur condition, `windowsAllowed`), `useCalendarEvents` (occurrences du jour), `useScheduleSources` et `scheduleSources` (éphémérides, et créneaux des heures non archivés avec `unavailable`), `useBirthdays`, `useForeignScheduleKinds` (types abonnés connus). Réglages : `useMyDaySettings` lus avec les ids encore connus (`readMyDaySettings`), appliqués par `myDayShows` et `myDayShowsSlot`. Liens avec les évènements : `taskIds` et `routineLinks` des occurrences du jour. `layout` vaut `null` tant que tout n’est pas chargé (au changement de jour aussi : pas d’occurrences de la veille gardées en attendant) ; `error` quand une requête du jour a échoué ; rafraîchi chaque minute (`useNow`). | `MyDayPage` |
| `MyDayEntry` | Élément du jour (`MyDayItem` avec sa donnée) : `MyDayTask` (`task`), `MyDayRoutine` (`routine`, `occurrence`, `slot`, `missed` : non fait un jour passé), `MyDayEvent` (`occurrence`), `MyDayEphemeris` (`label`, `color`), `MyDayBirthday` (`birthday`, `label`). | `MyDayRowView`, `MyDayPage` |
| `MyDayHourSlot` | Créneau des heures (`MyDaySlot` avec `label`, `color`). | `MyDayPage` |
| `MyDay` | Ce que rend `useMyDay`. | `MyDayPage` |

Internes : `NONE`, `linkedKeys` (occurrences liées à un élément), `parisTime` (heure de Paris d’un instant), `routineWindows` (les fenêtres d’un moment de routine coupé par des créneaux : plusieurs ; sinon aucune, il se range à son heure).

## components

### `components/MyDayRows.tsx`

| Export | Rôle | Utilisé par |
| ------ | ---- | ----------- |
| `MyDayRowView({ row, context, today })` | Une ligne du jour selon son type, avec sous elle (en retrait) les tâches et routines liées à un évènement. Tâche : `TaskDoneButton`, `TimerCell`, nom qui ouvre son panneau (`useTaskLink`), `LateBadge` en retard, menu `useTaskActions(context).menu`. Moment de routine : `RoutineTickButton`, `RoutineTimerToggle` (`routineTimer`), nom qui ouvre `openRoutineForm` sur l’occurrence, « Depuis … » en retard, « Non faite », « faite à HH:MM », « Modifier » et menu `useRoutineOccurrenceMenu` (`RowActions`). Évènement : pas de bouton d’état, `EventTimerToggle`, nom qui ouvre `useEventForm`, menu `useEventMenu`. Éphéméride : son nom. Anniversaire : ouvre la personne (`usePersonOpener`). | `MyDayPage` |

Internes : `RowLine` (la ligne commune : bouton d’état, heure, nom et détails, chrono et menu ; atténuée faite ou annulée, barrée annulée), `OpenLabel` (nom qui ouvre le panneau, `UnstyledButton`), `OtherWindows` (« aussi … »), `TaskRow`, `RoutineRow`, `EventRow`, `EphemerisRow`, `BirthdayRow`.

### `components/MyDay.module.css`

Blocs (`block`), heures (`hour` : grille heure / lignes, fond `--slot-color`, grisé `data-unavailable`, trait de l’heure de maintenant `data-current`), lignes de deux pas verticaux (`row`, `data-finished`), colonnes de la ligne (`state`, `time`, `label`, `open`), éléments liés en retrait (`children`).

## pages

### `pages/MyDayPage.tsx`

`MyDayPage` : route `/my-day` (`PAGES.myDay`). `PageHeader`, `DayNav` (aujourd’hui par défaut, jour en état local, pas dans l’adresse), `ErrorAlert` en cas d’échec, `ListSkeleton` au chargement, `EmptyState` sans rien ce jour, puis les blocs dans un `Paper` : en tête, « Sans horaire », les heures, « Faits et annulés » (titres `Caption`). Internes : `Rows`, `Block`, `hourStyle` (fond de l’heure : couleur du premier créneau, heures de travail en vert), `HourBlock` (heure, noms des créneaux, « Indisponible », lignes).
