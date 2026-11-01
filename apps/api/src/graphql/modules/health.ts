import { builder } from '../builder';

builder.queryField('health', (t) => t.string({ skipTypeScopes: true, resolve: () => 'ok' }));
