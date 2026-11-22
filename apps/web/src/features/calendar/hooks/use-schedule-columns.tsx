import { DEFAULT_SCHEDULE_KIND_LABEL, mapById, readScheduleCases, readScheduleExceptions } from '@ordo/shared';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { itemChoices } from '../../../components/items/item-look';
import * as fmt from '../../../lib/format';
import { PERIOD_STATES, periodState, type PeriodState } from '../../../lib/periods';
import { useCommentCounts } from '../../comments/api';
import { commentColumn } from '../../comments/lib/comment-column';
import { useDefaultScheduleKind, useScheduleTypes, useWorkSchedules, type ScheduleType, type WorkSchedule } from '../api';
import { describeScheduleCase } from '../lib/schedule-text';

/** State of a schedule today (the values kept in the saved views' filters). */
export type ScheduleState = 'CURRENT' | 'UPCOMING' | 'PAST';
/** State of its period, for its label and color. */
const PERIOD_OF: Record<ScheduleState, PeriodState> = { CURRENT: 'current', UPCOMING: 'upcoming', PAST: 'past' };
const STATE_OF: Record<PeriodState, ScheduleState> = { current: 'CURRENT', upcoming: 'UPCOMING', past: 'PAST' };
export const STATE_LABELS = Object.fromEntries(Object.entries(PERIOD_OF).map(([state, period]) => [state, PERIOD_STATES[period].label])) as Record<ScheduleState, string>;
export const STATE_COLORS = Object.fromEntries(Object.entries(PERIOD_OF).map(([state, period]) => [state, PERIOD_STATES[period].color])) as Record<ScheduleState, string>;
const STATE_ORDER: Record<ScheduleState, number> = { CURRENT: 0, UPCOMING: 1, PAST: 2 };

/** Row of the table of the schedules: a schedule, its state today, its exceptions. */
export type ScheduleRow = { schedule: WorkSchedule; state: ScheduleState; exceptions: ReturnType<typeof readScheduleExceptions> };
/** Kind filter value of the schedules without kind. */
export const NO_KIND = 'none';
/** Kind of the éphémérides without kind (there is no default kind of éphémérides). */
export const NO_KIND_LABEL = 'Sans type';

/**
 * State of a schedule on a day: current, upcoming or past.
 * @param {WorkSchedule} schedule Schedule.
 * @param {string} today YYYY-MM-DD.
 * @returns {ScheduleState} State.
 */
export function scheduleState(schedule: WorkSchedule, today: string): ScheduleState {
  return STATE_OF[periodState(schedule.startDate, schedule.endDate ?? null, today)];
}

/** Columns of the table of the créneaux or of the éphémérides, with what they read. */
interface ScheduleColumns {
  columns: DataColumn<ScheduleRow>[];
  /** Schedules of that nature. */
  schedules: WorkSchedule[] | undefined;
  /** Kinds of that nature. */
  types: ScheduleType[] | undefined;
  /** Kind of the créneaux without kind. */
  defaultKind: ReturnType<typeof useDefaultScheduleKind>['data'];
  /** Every kind, by id. */
  typeById: Map<string, ScheduleType>;
  /** Name of the schedules without kind. */
  defaultLabel: string;
}

/**
 * Columns of the table of the créneaux, or of the éphémérides, with their kinds and comments: in the table, and in the
 * settings of the calendar.
 * @param {boolean} ephemeris The éphémérides instead of the créneaux.
 * @returns {ScheduleColumns} Columns, with the schedules and kinds they read.
 */
export function useScheduleColumns(ephemeris: boolean): ScheduleColumns {
  const { data: allSchedules } = useWorkSchedules();
  const schedules = allSchedules?.filter((schedule) => schedule.ephemeris === ephemeris);
  const { data: allTypes } = useScheduleTypes();
  const types = allTypes?.filter((type) => type.ephemeris === ephemeris);
  const { data: defaultKind } = useDefaultScheduleKind();
  const typeById = mapById(allTypes ?? []);
  // Without kind: the working hours for the créneaux, no kind for the éphémérides.
  const defaultLabel = ephemeris ? NO_KIND_LABEL : (defaultKind?.label ?? DEFAULT_SCHEDULE_KIND_LABEL);
  const kindLabel = (schedule: WorkSchedule) => (schedule.typeId ? (typeById.get(schedule.typeId)?.label ?? '') : defaultLabel);
  const scheduleComments = useCommentCounts(
    'SCHEDULE',
    (schedules ?? []).map((schedule) => schedule.id),
  );
  const columns: DataColumn<ScheduleRow>[] = [
    { id: 'label', required: true, label: 'Libellé', size: 220, locked: true, bulk: true, sortValue: ({ schedule }) => schedule.label, text: ({ schedule }) => schedule.label },
    {
      id: 'type',
      required: true,
      bulk: true,
      label: 'Type',
      size: 160,
      sortValue: ({ schedule }) => kindLabel(schedule),
      text: ({ schedule }) => kindLabel(schedule),
      filter: {
        kind: 'choice',
        value: ({ schedule }) => schedule.typeId ?? NO_KIND,
        options: [{ value: NO_KIND, label: defaultLabel }, ...itemChoices(types ?? [])],
      },
      groupable: true,
    },
    {
      id: 'start',
      required: true,
      bulk: true,
      label: 'Début',
      size: 120,
      sortValue: ({ schedule }) => schedule.startDate,
      text: ({ schedule }) => fmt.day(schedule.startDate),
      filter: { kind: 'date', value: ({ schedule }) => schedule.startDate },
    },
    {
      id: 'end',
      bulk: true,
      label: 'Fin',
      size: 120,
      sortValue: ({ schedule }) => (schedule.endDate ? schedule.endDate : '9999-12-31'),
      text: ({ schedule }) => (schedule.endDate ? fmt.day(schedule.endDate) : 'Sans fin'),
      filter: { kind: 'date', value: ({ schedule }) => schedule.endDate || null },
    },
    {
      id: 'hours',
      label: 'Horaires',
      size: 320,
      text: ({ schedule, exceptions }) =>
        [...readScheduleCases(schedule.cases, schedule.startDate).map((item) => describeScheduleCase(item, schedule.startDate)), ...exceptions.map((exception) => exception.label)]
          .filter(Boolean)
          .join(' ; '),
    },
    {
      id: 'state',
      required: true,
      label: 'État',
      size: 110,
      sortValue: ({ state: rowState }) => STATE_ORDER[rowState],
      text: ({ state: rowState }) => STATE_LABELS[rowState],
      filter: { kind: 'choice', value: ({ state: rowState }) => rowState, options: (['CURRENT', 'UPCOMING', 'PAST'] as const).map((value) => ({ value, label: STATE_LABELS[value] })) },
      groupable: true,
    },
    commentColumn<ScheduleRow>(scheduleComments, ({ schedule }) => schedule.id),
  ];
  return { columns, schedules, types, defaultKind, typeById, defaultLabel };
}
