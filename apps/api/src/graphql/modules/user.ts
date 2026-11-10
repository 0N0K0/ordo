import * as workspaces from '../../services/workspaces';
import { builder } from '../builder';

// passwordHash is never exposed.
builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
    email: t.exposeString('email'),
    pendingEmail: t.exposeString('pendingEmail', { nullable: true }),
    role: t.exposeString('role', { description: 'ADMIN (the one account managing the others) or MEMBER.' }),
    disabled: t.boolean({ description: 'Disabled: it cannot log in.', resolve: (user) => user.disabledAt !== null }),
    passwordPending: t.exposeBoolean('passwordPending', { description: 'Created by the admin, waiting for its owner to choose a password.' }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    contributorId: t.id({
      nullable: true,
      description: 'Contributor profile ("Moi") in the current workspace.',
      resolve: (user) => workspaces.meContributorId(user.id),
    }),
  }),
});
