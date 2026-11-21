import { mapById, occurrenceKey } from '@ordo/shared';
import { useMemo } from 'react';
import type { DataColumn } from '../../../components/data-table/table/data-table';
import { useBeneficiaries } from '../../beneficiaries/hooks/use-beneficiaries';
import { useSlotChoices } from '../../calendar/hooks/use-slot-sources';
import { routineDoable, useSlotRules } from '../../calendar/hooks/use-slot-rules';
import { useCommentCounts } from '../../comments/api';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { isDraftRoutine, type Routine, type RoutineCategory } from '../api';
import { routineColumns } from '../lib/routine-columns';
import { panelOccurrence } from '../lib/routine-format';

/** Columns of the routines and what they are computed from, also used by the cells. */
export interface RoutineColumns {
  /** Columns (none while the task context loads). */
  columns: DataColumn<Routine>[];
  /** Routines by id. */
  byId: Map<string, Routine>;
  /** Whether the slot rule of a routine allows now. */
  doable: (routine: Routine) => boolean;
}

/**
 * Columns of the routine table (their filters, sorts, groups), with what they need that the routines do not hold: the
 * slot rules, the calendar schedules, the comments, the people routines can be for.
 * @param {readonly Routine[]} routines Every routine.
 * @param {RoutineCategory[]} categories Categories of the routines.
 * @param {string} today Today, YYYY-MM-DD.
 * @returns {RoutineColumns} Columns, routines by id and their doable test.
 */
export function useRoutineColumns(routines: readonly Routine[], categories: RoutineCategory[], today: string): RoutineColumns {
  const { context } = useTaskContext();
  const slotRules = useSlotRules();
  const slotChoices = useSlotChoices();
  // Without those being created (no comment yet): no count asked again for them.
  const comments = useCommentCounts(
    'ROUTINE',
    useMemo(() => routines.filter((routine) => !isDraftRoutine(routine)).map((routine) => occurrenceKey(routine.id, panelOccurrence(routine))), [routines]),
  );
  const { choices: beneficiaries } = useBeneficiaries();
  const byId = useMemo(() => mapById(routines), [routines]);
  const doable = useMemo(() => (routine: Routine) => slotRules.allowed(routineDoable(routine)), [slotRules]);
  const columns = useMemo(
    () => (context ? routineColumns({ today, byId, categories, context, doable, comments, slotKinds: slotChoices.all, beneficiaries }) : []),
    [today, byId, categories, context, doable, comments, slotChoices, beneficiaries],
  );
  return { columns, byId, doable };
}
