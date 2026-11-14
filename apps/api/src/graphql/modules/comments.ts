import { prisma } from '../../db';
import * as comments from '../../services/comments';
import { builder } from '../builder';

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
    description: 'Comments of an item, oldest first.',
    args: { target: t.arg({ type: CommentTargetEnum, required: true }), id: t.arg.string({ required: true, description: 'Item id (Message-ID for a mail).' }) },
    resolve: (query, _root, { target, id }) => prisma.comment.findMany({ ...query, where: { [comments.COMMENT_TARGETS[target]]: id }, orderBy: { createdAt: 'asc' } }),
  }),
  commentCounts: t.field({
    type: [CommentCountRef],
    description: 'Number of comments of items of a kind (descriptions not counted).',
    args: { target: t.arg({ type: CommentTargetEnum, required: true }), ids: t.arg.stringList({ required: true }) },
    resolve: (_root, { target, ids }) => comments.commentCounts(target, ids),
  }),
}));

builder.mutationFields((t) => ({
  addComment: t.prismaField({
    type: 'Comment',
    args: { target: t.arg({ type: CommentTargetEnum, required: true }), id: t.arg.string({ required: true }), body: t.arg.string({ required: true }) },
    resolve: async (query, _root, { target, id, body }) => prisma.comment.findUniqueOrThrow({ ...query, where: { id: (await comments.addComment(target, id, body)).id } }),
  }),
  updateComment: t.prismaField({
    type: 'Comment',
    args: { id: t.arg.id({ required: true }), body: t.arg.string({ required: true }) },
    resolve: async (query, _root, { id, body }) => prisma.comment.findUniqueOrThrow({ ...query, where: { id: (await comments.updateComment(String(id), body)).id } }),
  }),
  deleteComment: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await comments.deleteComment(String(id));
      return true;
    },
  }),
}));
