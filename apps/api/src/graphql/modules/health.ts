import { builder } from '../builder';

builder.queryField('health', (t) => t.string({ resolve: () => 'ok' }));
