import type { CommentSnapshot } from '../services/core/comments';
import { builder } from './builder';

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

/** Argument of the changes that may make occurrences disappear with their comments or times (decision EW). */
export const CONFIRM_LOSS_DESCRIPTION =
  'Occurrences made to disappear with their comments or times are confirmed: false (default) refuses with CONFIRMATION_REQUIRED and extension lost { times, comments } when there are some; true deletes them.';
