import { done } from '../errors';
import { prisma } from '../../db';
import * as comments from '../../services/core/comments';
import { builder } from '../builder';
import { reloaded } from '../reload';
import { readOccurrenceKey } from '@ordo/shared';
import { placeLegacyEventComments } from '../../services/calendar/calendar-events';
import { placeLegacyRoutineComments } from '../../services/routines/routines';

/** Placing of the comments written before they were on occurrences, by kind of item. */
const PLACE_LEGACY: Partial<Record<comments.CommentTarget, (ids: readonly string[]) => Promise<void>>> = { ROUTINE: placeLegacyRoutineComments, EVENT: placeLegacyEventComments };

/**
 * Places the comments of routines or events written before they were on occurrences, before they are read.
 * @param {comments.CommentTarget} target Kind of items.
 * @param {readonly string[]} ids Items (occurrence keys taken as their item).
 * @returns {Promise<void>}
 */
const placeLegacy = (target: comments.CommentTarget, ids: readonly string[]) => PLACE_LEGACY[target]?.(ids.map((id) => readOccurrenceKey(id).id)) ?? Promise.resolve();

const CommentTargetEnum = builder.enumType('CommentTarget', {
  description: 'Kind of item a comment goes on (tasks have their own comments).',
  values: Object.keys(comments.COMMENT_TARGETS) as (keyof typeof comments.COMMENT_TARGETS)[],
});

builder.prismaObject('Comment', {
  description: 'Comment (markdown) of an item.',
  fields: (t) => ({
    id: t.exposeID('id'),
    body: t.exposeString('body'),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
  }),
});

const CommentCountRef = builder.objectRef<{ id: string; count: number }>('CommentCount').implement({
  fields: (t) => ({ id: t.exposeID('id'), count: t.exposeInt('count') }),
});

builder.queryFields((t) => ({
  comments: t.prismaField({
    type: ['Comment'],
    description: 'Comments of an item, oldest first; of one occurrence for a routine or an event.',
    args: {
      target: t.arg({ type: CommentTargetEnum, required: true }),
      id: t.arg.string({ required: true, description: 'Item id (Message-ID for a mail).' }),
      occurrenceDate: t.arg({ type: 'Date', description: 'Occurrence of a routine or a recurring event (none: a one-off event).' }),
    },
    resolve: async (query, _root, { target, id, occurrenceDate }) => {
      await placeLegacy(target, [id]);
      return prisma.comment.findMany({ ...query, where: comments.commentsWhere(target, id, occurrenceDate ?? null), orderBy: { createdAt: 'asc' } });
    },
  }),
  commentCounts: t.field({
    type: [CommentCountRef],
    description: 'Number of comments of items of a kind (descriptions not counted); of occurrences for routines and events.',
    args: {
      target: t.arg({ type: CommentTargetEnum, required: true }),
      ids: t.arg.stringList({ required: true, description: 'Items; for routines and events, occurrence keys (« id|YYYY-MM-DD », the id alone for a one-off event).' }),
    },
    resolve: async (_root, { target, ids }) => {
      await placeLegacy(target, ids);
      return comments.commentCounts(target, ids);
    },
  }),
}));

builder.mutationFields((t) => ({
  addComment: t.prismaField({
    type: 'Comment',
    args: {
      target: t.arg({ type: CommentTargetEnum, required: true }),
      id: t.arg.string({ required: true }),
      body: t.arg.string({ required: true }),
      occurrenceDate: t.arg({ type: 'Date', description: 'Occurrence of a routine or a recurring event (required for them).' }),
    },
    resolve: async (query, _root, { target, id, body, occurrenceDate }) => reloaded(prisma.comment, query, comments.addComment(target, id, body, occurrenceDate ?? null)),
  }),
  updateComment: t.prismaField({
    type: 'Comment',
    args: { id: t.arg.id({ required: true }), body: t.arg.string({ required: true }) },
    resolve: async (query, _root, { id, body }) => reloaded(prisma.comment, query, comments.updateComment(id, body)),
  }),
  deleteComment: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => done(comments.deleteComment(id)),
  }),
}));
