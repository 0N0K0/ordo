import { Badge, Group, Text, Tooltip } from '@mantine/core';
import { entrySeconds, formatClock, formatDuration, routineSchema } from '@ordo/shared';
import { ArrowBendUpRightIcon } from '@phosphor-icons/react';
import { localToday } from '../../../lib/dates';
import * as fmt from '../../../lib/format';
import { useNow } from '../../../lib/use-now';
import { TimerToggle } from '../../time/components/TimerToggle';
import type { TimeEntry } from '../../time/api';
import { AddRowField } from '../../../components/data-table/cells/AddRowField';
import { useRoutineMutations, type Routine } from '../api';
import { DAILY, moveTo, scheduleOf, stateOf, windowOf, windowText } from '../lib/routine-format';
import classes from './Routines.module.css';

/**
 * Badge of a routine due today: past its latest time (late), time to leave (its way there has started), or its time window
 * (grey before it opens).
 * @param {{ routine: Routine }} props Component props.
 * @returns {JSX.Element} Badge.
 */
function DueBadge({ routine }: { routine: Routine }) {
  const now = new Date().toTimeString().slice(0, 5);
  const { fromTime, dueTime } = windowOf(routine);
  const { leaveAt } = scheduleOf(routine);
  if (dueTime && now > dueTime) {
    return (
      <Badge variant="light" color="red" tt="none">
        Après {dueTime}
      </Badge>
    );
  }
  if (leaveAt && now >= leaveAt) {
    return (
      <Badge variant="filled" color="orange" tt="none">
        Partir maintenant
      </Badge>
    );
  }
  const window = windowText({ fromTime, dueTime });
  return (
    <Badge variant="light" color={fromTime && now < fromTime ? 'gray' : undefined} tt="none">
      Aujourd’hui{window ? ` ${window}` : ''}
    </Badge>
  );
}

/**
 * Where a routine stands today: due, late since a date, done, or its next date.
 * @param {{ routine: Routine, today: string, doable: boolean }} props Component props: `doable` when its slots allow now.
 * @returns {JSX.Element} Badge or text.
 */
export function StateCell({ routine, today, doable }: { routine: Routine; today: string; doable: boolean }) {
  const state = stateOf(routine, today, doable);
  const next = routine.nextDate ? `Prochaine fois : ${fmt.weekday(routine.nextDate)}` : 'Plus d’occurrence à venir';
  // The occurrence shown comes from another day (an exception).
  const moved = moveTo(routine, state === 'upcoming' ? routine.nextDate : routine.currentDate);
  const label = moved ? `${next} · ${moved.to > moved.from ? 'reportée' : 'avancée'} (prévue le ${fmt.weekday(moved.from)})` : next;
  return (
    <Tooltip label={label}>
      <span className={classes.nowrap}>
        {moved && <ArrowBendUpRightIcon aria-label={moved.to > moved.from ? 'Reportée' : 'Avancée'} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
        {state === 'done' && (
          <Badge variant="light" color="green" tt="none">
            Fait
          </Badge>
        )}
        {state === 'due' && <DueBadge routine={routine} />}
        {state === 'late' && (
          <Badge variant="light" color="orange" tt="none">
            Depuis {fmt.weekday(routine.currentDate!)}
          </Badge>
        )}
        {state === 'upcoming' && (
          <Text size="xs" c="dimmed" className={classes.nowrap}>
            {routine.nextDate ? fmt.weekday(routine.nextDate) : '—'}
          </Text>
        )}
      </span>
    </Tooltip>
  );
}

/**
 * Chrono of a routine: its tracked time, and a button starting the timer on it (or stopping it while it runs on it).
 * @param {{ routine: Routine, running: TimeEntry | null | undefined }} props Component props.
 * @returns {JSX.Element} Cell.
 */
export function ChronoCell({ routine, running }: { routine: Routine; running: TimeEntry | null | undefined }) {
  const mine = running?.routineId === routine.id ? running : null;
  const now = useNow(Boolean(mine) && !mine?.pausedAt);
  return (
    <Group gap={4} wrap="nowrap">
      <TimerToggle name={routine.title} mine={mine} othersRunning={Boolean(running) && !mine} input={{ routineId: routine.id, taskIds: [] }} disabled={routine.archived} size="sm" />
      <Text size="xs" c={mine ? undefined : 'dimmed'} className={classes.nowrap}>
        {mine ? formatClock(entrySeconds(mine, now)) : routine.trackedSeconds ? formatDuration(routine.trackedSeconds) : ''}
      </Text>
    </Group>
  );
}

/**
 * Field of the add row at the end of a category (or of the table): a title typed then Enter adds a routine in it, every
 * day from today.
 * @param {{ categoryId: string | null, projectId: string | null, groupName: string }} props Component props (the category
 *   and the project of the routines added, the name of the group).
 * @returns {JSX.Element} Row.
 */
export function AddRoutineRow({ categoryId, projectId, groupName }: { categoryId: string | null; projectId: string | null; groupName: string }) {
  const { create } = useRoutineMutations();
  return (
    <AddRowField
      label="Ajouter une routine"
      where={`dans ${groupName}`}
      hint="tous les jours"
      schema={routineSchema.shape.title}
      onCreate={(title) =>
        create.mutateAsync({
          title,
          description: null,
          categoryIds: categoryId ? [categoryId] : [],
          parentId: null,
          startDate: localToday(),
          recurrence: DAILY,
          estimate: null,
          projectId,
          assigneeIds: [],
          requiredIds: [],
        })
      }
    />
  );
}
