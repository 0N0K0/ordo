import { unscopedPrisma } from '../../db';
import * as accounts from '../../services/accounts';
import { builder } from '../builder';
import { requireSession, type Context } from '../context';

/**
 * Throws unless the logged-in account is the admin.
 * @param {Context} ctx GraphQL context.
 * @returns {Promise<void>}
 */
const admin = (ctx: Context) => accounts.requireAdmin(requireSession(ctx).userId);

builder.queryFields((t) => ({
  accounts: t.prismaField({
    type: ['User'],
    description: 'Every account (admin only).',
    resolve: async (query, _root, _args, ctx) => {
      await admin(ctx);
      return unscopedPrisma.user.findMany({ ...query, orderBy: [{ role: 'asc' }, { createdAt: 'asc' }] });
    },
  }),
}));

const AccountInput = builder.inputType('AccountInput', {
  fields: (t) => ({
    username: t.string({ required: true }),
    email: t.string({ required: true }),
  }),
});

builder.mutationFields((t) => ({
  createAccount: t.prismaField({
    type: 'User',
    description: 'Creates an account (admin only): its owner receives by email a link to choose the password.',
    args: { input: t.arg({ type: AccountInput, required: true }) },
    resolve: async (query, _root, { input }, ctx) => {
      await admin(ctx);
      const user = await accounts.createAccount(input);
      return unscopedPrisma.user.findUniqueOrThrow({ ...query, where: { id: user.id } });
    },
  }),
  resendAccountSetup: t.boolean({
    description: 'Sends again the link of an account waiting for its password (admin only).',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      await admin(ctx);
      await accounts.resendSetupLink(id);
      return true;
    },
  }),
  setAccountDisabled: t.prismaField({
    type: 'User',
    description: 'Disables an account (logged out, cannot log in) or enables it again (admin only).',
    args: { id: t.arg.id({ required: true }), disabled: t.arg.boolean({ required: true }) },
    resolve: async (query, _root, { id, disabled }, ctx) => {
      await admin(ctx);
      await accounts.setAccountDisabled(id, disabled);
      return unscopedPrisma.user.findUniqueOrThrow({ ...query, where: { id } });
    },
  }),
  deleteAccount: t.boolean({
    description: 'Deletes an account with its workspaces and everything in them (admin only).',
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }, ctx) => {
      await admin(ctx);
      await accounts.deleteAccount(id);
      return true;
    },
  }),
}));
