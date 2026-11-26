# Routines (composants communs)

Composants des routines partagés par plusieurs pages (« Ma journée », le tableau des routines). Source : `apps/web/src/components/routines/`. Règles : [Routine parente](../../business-rules/activities/routines.md#routine-parente).

## `RoutineGroupProgress.tsx`

- `RoutineGroupProgress({ state, when })` : avancement d’une routine parente un jour, « 2/3 » (ses sous-routines faites sur celles dues ce jour-là, `RoutineGroupState` de `routineGroupStatesOn`), par `ProgressBadge` : vert quand toutes le sont ; infobulle « 2 sous-routines faites sur 3 dues aujourd’hui » (`when` : « aujourd’hui », « ce jour-là »), et avec plusieurs moments l’état de chacun (« 08:00–09:00 : fait », « fois 2 : à faire »). Utilisé par `RoutinesPanel` (cellule « Échéance ») et les lignes de « Ma journée » (`MyDayRowView`).
