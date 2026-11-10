import { prisma } from '../../db';
import * as auth from '../../services/auth';
import { builder } from '../builder';
import { requireSession } from '../context';

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
      return prisma.user.findUniqueOrThrow({ ...query, where: { id: user.id } });
    },
  }),

  logout: t.boolean({
    skipTypeScopes: true,
    resolve: async (_root, _args, ctx) => {
      await auth.logout(ctx.res, ctx.session);
      return true;
    },
  }),

  requestPasswordReset: t.boolean({
    skipTypeScopes: true,
    description: 'Always returns true, whether or not the account exists.',
    args: { identifier: t.arg.string({ required: true }) },
    resolve: async (_root, { identifier }, ctx) => {
      await auth.requestPasswordReset(ctx.req, identifier);
      return true;
    },
  }),

  setUpAccount: t.boolean({
    skipTypeScopes: true,
    description: 'Chooses the password of a new account from the link sent at its creation.',
    args: {
      token: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
    },
    resolve: async (_root, { token, password }) => {
      await auth.setUpAccount(token, password);
      return true;
    },
  }),

  resetPassword: t.boolean({
    skipTypeScopes: true,
    args: {
      token: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
    },
    resolve: async (_root, { token, password }) => {
      await auth.resetPassword(token, password);
      return true;
    },
  }),

  confirmEmailChange: t.boolean({
    skipTypeScopes: true,
    description: 'Works without a session: the link may be opened on another device.',
    args: { token: t.arg.string({ required: true }) },
    resolve: async (_root, { token }) => {
      await auth.confirmEmailChange(token);
      return true;
    },
  }),

  changePassword: t.boolean({
    description: 'Closes every other session.',
    args: {
      currentPassword: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
    },
    resolve: async (_root, { currentPassword, password }, ctx) => {
      await auth.changePassword(requireSession(ctx), currentPassword, password);
      return true;
    },
  }),

  changeUsername: t.prismaField({
    type: 'User',
    args: {
      currentPassword: t.arg.string({ required: true }),
      username: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, { currentPassword, username }, ctx) => {
      const user = await auth.changeUsername(requireSession(ctx), currentPassword, username);
      return prisma.user.findUniqueOrThrow({ ...query, where: { id: user.id } });
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
      return prisma.user.findUniqueOrThrow({ ...query, where: { id: user.id } });
    },
  }),

  cancelEmailChange: t.prismaField({
    type: 'User',
    resolve: async (query, _root, _args, ctx) => {
      const user = await auth.cancelEmailChange(requireSession(ctx));
      return prisma.user.findUniqueOrThrow({ ...query, where: { id: user.id } });
    },
  }),
}));
