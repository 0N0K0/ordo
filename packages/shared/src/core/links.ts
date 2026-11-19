import { z } from 'zod';
import { shortTextSchema } from './rules';

/** Link of an item (event, task, routine): its address, http or https, and an optional label. */
export const itemLinkSchema = z.object({
  url: z.url({ protocol: /^https?$/, error: 'Lien invalide (http ou https).' }),
  label: shortTextSchema,
});
export type ItemLink = z.infer<typeof itemLinkSchema>;

/** Most links of an item. */
export const ITEM_LINKS_MAX = 20;

/** Links of an item (event, task, routine): `ITEM_LINKS_MAX` at most (decision D5). */
export const itemLinksSchema = z.array(itemLinkSchema).max(ITEM_LINKS_MAX, `${ITEM_LINKS_MAX} liens maximum.`);

/** Links of an item edited on their own (the detail panel of a task). */
export const linksFormSchema = z.object({ links: itemLinksSchema });
export type LinksFormValues = z.input<typeof linksFormSchema>;
