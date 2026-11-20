import type { ItemLink } from '@ordo/shared';
import { builder } from './builder';

/** Link of an item (event, task, routine): its address and its label. */
export const ItemLinkRef = builder.objectRef<ItemLink>('ItemLink').implement({
  description: 'Link of an event, a task or a routine.',
  fields: (t) => ({ url: t.exposeString('url'), label: t.exposeString('label', { description: 'Empty: none (the address is shown).' }) }),
});

/** Link of an item as sent (checked by `itemLinksSchema`: 20 at most, http or https). */
export const ItemLinkInput = builder.inputType('ItemLinkInput', {
  fields: (t) => ({ url: t.string({ required: true }), label: t.string({ required: true }) }),
});
