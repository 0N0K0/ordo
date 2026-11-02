import { builder } from '../builder';

// passwordHash is never exposed.
builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
    email: t.exposeString('email'),
    pendingEmail: t.exposeString('pendingEmail', { nullable: true }),
    contributorId: t.exposeID('contributorId', { nullable: true, description: 'Contributor profile ("Moi").' }),
  }),
});
