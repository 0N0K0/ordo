import { RECURRENCE_FREQUENCIES } from '../dates/recurrence';

/** States of the current occurrence of a routine. */
export const ROUTINE_STATES = ['late', 'due', 'upcoming', 'done'] as const;

/** Repetitions of a routine: its rule, or the slots of a calendar schedule. */
export const ROUTINE_REPETITIONS = [...RECURRENCE_FREQUENCIES, 'SCHEDULE'] as const;
