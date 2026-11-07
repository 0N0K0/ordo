import * as workspaces from '../../services/workspaces';
import { builder } from '../builder';

// passwordHash is never exposed.
builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
    email: t.exposeString('email'),
    pendingEmail: t.exposeString('pendingEmail', { nullable: true }),
    contributorId: t.id({
      nullable: true,
      description: 'Contributor profile ("Moi") in the current workspace.',
      resolve: (user) => workspaces.meContributorId(user.id),
    }),
  }),
});
