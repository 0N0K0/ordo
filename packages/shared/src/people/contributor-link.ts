import { z } from 'zod';

/**
 * What a contributor's details (email addresses, phones, birth date, birthday) come from, one at most: itself as a
 * member of the team or household (its own details, edited in the member's form), a relation (the relation's), a
 * client contact (its single email and its phones, no birthday), or nothing (no details).
 */
export const CONTRIBUTOR_LINKS = ['MEMBER', 'RELATION', 'CONTACT', 'NONE'] as const;
export type ContributorLinkKind = (typeof CONTRIBUTOR_LINKS)[number];

/** Link of a contributor: its kind, and the relation or the contact it is linked to. */
export const contributorLinkSchema = z
  .object({
    kind: z.enum(CONTRIBUTOR_LINKS),
    relationId: z.string().nullish(),
    contactId: z.string().nullish(),
  })
  .superRefine((link, context) => {
    if (link.kind === 'RELATION' && !link.relationId) context.addIssue({ code: 'custom', path: ['relationId'], message: 'Choisissez la relation.' });
    if (link.kind === 'CONTACT' && !link.contactId) context.addIssue({ code: 'custom', path: ['contactId'], message: 'Choisissez le contact.' });
  });
export type ContributorLinkInput = z.input<typeof contributorLinkSchema>;

/** Link of a contributor as a form holds it. */
export interface ContributorLinkValues {
  kind: ContributorLinkKind;
  relationId: string | null;
  contactId: string | null;
}

/** No link: a contributor without details. */
export const NO_CONTRIBUTOR_LINK: ContributorLinkValues = { kind: 'NONE', relationId: null, contactId: null };
