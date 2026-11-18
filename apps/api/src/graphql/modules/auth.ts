import { done } from '../errors';
import { prisma } from '../../db';
import * as auth from '../../services/core/auth';
import { builder } from '../builder';
import { requireSession } from '../context';
import { reloaded } from '../reload';

builder.queryField('me', (t) =>
  t.prismaField({
    type: 'User',
    nullable: true,
    skipTypeScopes: true,
    resolve: (query, _root, _args, ctx) =>
      ctx.session ? prisma.user.findUnique({ ...query, where: { id: ctx.session.userId } }) : null,
  }),
);

builder.mutationFields((t) => ({
  login: t.prismaField({
    type: 'User',
    skipTypeScopes: true,
    description: 'Opens a session with a username or email and a password.',
    args: {
      identifier: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args, ctx) => {
      const user = await auth.login(ctx.req, ctx.res, args);
      return reloaded(prisma.user, query, user);
    },
  }),

  logout: t.boolean({
    skipTypeScopes: true,
    resolve: (_root, _args, ctx) => done(auth.logout(ctx.res, ctx.session)),
  }),

  requestPasswordReset: t.boolean({
    skipTypeScopes: true,
    description: 'Always returns true, whether or not the account exists.',
    args: { identifier: t.arg.string({ required: true }) },
    resolve: (_root, { identifier }, ctx) => done(auth.requestPasswordReset(ctx.req, identifier)),
  }),

  resetPassword: t.boolean({
    skipTypeScopes: true,
    args: {
      token: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
    },
    resolve: (_root, { token, password }) => done(auth.resetPassword(token, password)),
  }),

  confirmEmailChange: t.boolean({
    skipTypeScopes: true,
    description: 'Works without a session: the link may be opened on another device.',
    args: { token: t.arg.string({ required: true }) },
    resolve: (_root, { token }) => done(auth.confirmEmailChange(token)),
  }),

  changePassword: t.boolean({
    description: 'Closes every other session.',
    args: {
      currentPassword: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
    },
    resolve: (_root, { currentPassword, password }, ctx) => done(auth.changePassword(requireSession(ctx), currentPassword, password)),
  }),

  changeUsername: t.prismaField({
    type: 'User',
    args: {
      currentPassword: t.arg.string({ required: true }),
      username: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, { currentPassword, username }, ctx) => {
      const user = await auth.changeUsername(requireSession(ctx), currentPassword, username);
      return reloaded(prisma.user, query, user);
    },
  }),

  requestEmailChange: t.prismaField({
    type: 'User',
    description: 'Sends a confirmation link to the new address; the email changes once confirmed.',
    args: {
      currentPassword: t.arg.string({ required: true }),
      email: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, { currentPassword, email }, ctx) => {
      const user = await auth.requestEmailChange(requireSession(ctx), currentPassword, email);
      return reloaded(prisma.user, query, user);
    },
  }),

  cancelEmailChange: t.prismaField({
    type: 'User',
    resolve: async (query, _root, _args, ctx) => {
      const user = await auth.cancelEmailChange(requireSession(ctx));
      return reloaded(prisma.user, query, user);
    },
  }),
}));
