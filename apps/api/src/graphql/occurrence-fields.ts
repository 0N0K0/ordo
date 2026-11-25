import { recurrenceSchema, type Recurrence } from '@ordo/shared';
import type { CommentSnapshot } from '../services/core/comments';
import { builder } from './builder';
import { parseInput } from './errors';

/** Comment deleted with an occurrence, as « Annuler » gives it back. */
export const CommentSnapshotRef = builder.objectRef<CommentSnapshot>('CommentSnapshot').implement({
  description: 'Comment deleted with an occurrence (its text and dates), to give it back on undo.',
  fields: (t) => ({
    body: t.exposeString('body'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
  }),
});

/** Comment given back on undo (its text checked again). */
export const CommentSnapshotInput = builder.inputType('CommentSnapshotInput', {
  fields: (t) => ({
    body: t.string({ required: true }),
    createdAt: t.field({ type: 'DateTime', required: true }),
    updatedAt: t.field({ type: 'DateTime', required: true }),
  }),
});

/** Argument of the changes that may make occurrences disappear with their comments or times. */
export const CONFIRM_LOSS_DESCRIPTION =
  'Occurrences made to disappear with their comments or times are confirmed: false (default) refuses with CONFIRMATION_REQUIRED and extension lost { times, comments } when there are some; true deletes them.';

/** Argument of the moves of an occurrence of a rule on the last day of the month to another day (« Celle-ci et les suivantes », « Toutes »). */
export const MOVED_RULE_DESCRIPTION =
  'New rule (recurrence JSON) of a rule on the last day of the month moved to another day, chosen by the user: omitted there, refuses with RULE_CHOICE_REQUIRED and extension movedRule { rule, start } (the rule proposed, the day it is shown from); ignored otherwise.';

/**
 * New rule chosen for a move of a rule on the last day of the month, validated (`recurrenceSchema`).
 * @param {unknown} value GraphQL argument (JSON), or none.
 * @returns {Recurrence | null} Rule, or null when none is given.
 */
export const chosenRule = (value: unknown): Recurrence | null => (value === null || value === undefined ? null : parseInput(recurrenceSchema, value));
