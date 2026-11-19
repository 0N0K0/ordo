import { prisma } from '../../db';
import { activeIds } from './archive';
import { assertAllExist } from './lookup';

/** Name of a beneficiary in the errors. */
const WHAT = 'Bénéficiaire';

/** Beneficiaries chosen: contributors and relations, all shown in one field. */
export interface Beneficiaries {
  contributorIds?: readonly string[] | null;
  relationIds?: readonly string[] | null;
}

/** How beneficiaries are checked. */
export interface BeneficiaryOptions {
  /** Field of the errors. Optional. Default = `beneficiaryIds`. */
  field?: string;
  /** Beneficiaries already there (kept even when archived); `'all'`: archived ones are not refused here. Optional. Default = none kept. */
  keep?: { contributorIds?: readonly string[]; relationIds?: readonly string[] } | 'all';
}

/**
 * Checks the beneficiaries of an element: any contributor and any relation, that exist and, unless kept, are not archived
 * (« Bénéficiaire introuvable. », « Élément archivé… », under the field).
 * @param {Beneficiaries} chosen Contributors and relations chosen.
 * @param {BeneficiaryOptions} [options] Field of the errors and beneficiaries kept. Optional.
 * @returns {Promise<void>}
 */
export async function assertBeneficiaries(chosen: Beneficiaries, options: BeneficiaryOptions = {}): Promise<void> {
  const { field = 'beneficiaryIds', keep } = options;
  if (keep === 'all') {
    await assertAllExist(prisma.contributor, chosen.contributorIds, WHAT, { field });
    await assertAllExist(prisma.treasuryRelation, chosen.relationIds, WHAT, { field });
    return;
  }
  await activeIds(prisma.contributor, chosen.contributorIds, WHAT, { keep: keep?.contributorIds, field, missingField: field });
  await activeIds(prisma.treasuryRelation, chosen.relationIds, WHAT, { keep: keep?.relationIds, field, missingField: field });
}
