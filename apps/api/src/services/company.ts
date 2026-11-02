import { ACCOUNTING_DOCUMENT_TYPES, companyProfileSchema, type AccountingDocumentType, type CompanyProfileInput } from '@ordo/shared';
import { prisma } from '../db';
import type { CompanyProfile } from '../generated/prisma/client';
import { clientError, parseInput } from '../graphql/errors';
import { storeAttachment } from './attachments';

/**
 * The user's business profile (created empty on first access).
 * @returns {Promise<CompanyProfile>} Profile.
 */
export async function getCompanyProfile(): Promise<CompanyProfile> {
  return prisma.companyProfile.upsert({ where: { id: 'company' }, create: {}, update: {} });
}

/**
 * Updates the business profile.
 * @param {CompanyProfileInput} input Profile.
 * @returns {Promise<CompanyProfile>} Profile.
 */
export async function updateCompanyProfile(input: CompanyProfileInput): Promise<CompanyProfile> {
  const data = parseInput(companyProfileSchema, input);
  await getCompanyProfile();
  return prisma.companyProfile.update({ where: { id: 'company' }, data: { ...data, address: data.address ?? undefined } });
}

/**
 * Sets (PNG or JPEG, for the PDF documents) or removes the logo.
 * @param {File | null} file Image, or null to remove it.
 * @returns {Promise<CompanyProfile>} Profile.
 */
export async function setCompanyLogo(file: File | null): Promise<CompanyProfile> {
  const profile = await getCompanyProfile();
  let logoId: string | null = null;
  if (file) {
    const stored = await storeAttachment(file);
    if (stored.mimeType !== 'image/png' && stored.mimeType !== 'image/jpeg') {
      await prisma.attachment.delete({ where: { id: stored.id } });
      throw clientError('BAD_USER_INPUT', 'Logo en PNG ou JPEG uniquement.');
    }
    logoId = stored.id;
  }
  const updated = await prisma.companyProfile.update({ where: { id: 'company' }, data: { logoId } });
  if (profile.logoId) await prisma.attachment.delete({ where: { id: profile.logoId } }).catch(() => undefined);
  return updated;
}

export interface SequenceInfo {
  type: AccountingDocumentType;
  year: number;
  nextNumber: number;
  /** Lowest allowed next number: the numbers already given cannot be given again. */
  minimum: number;
}

/**
 * Highest counter already given to a final document of a type in a year.
 * @param {AccountingDocumentType} type Type.
 * @param {number} year Year.
 * @returns {Promise<number>} Counter, 0 when none.
 */
export async function usedCounter(type: AccountingDocumentType, year: number): Promise<number> {
  const rows = await prisma.$queryRaw<{ max: number | null }[]>`
    SELECT MAX("counter") AS max FROM "AccountingDocument" WHERE "type"::text = ${type} AND "year" = ${year} AND "counter" IS NOT NULL`;
  return Number(rows[0]?.max ?? 0);
}

/**
 * Numbering of the document types for a year: next numbers and their minimums.
 * @param {number} year Year.
 * @returns {Promise<SequenceInfo[]>} Sequences.
 */
export async function documentSequences(year: number): Promise<SequenceInfo[]> {
  const stored = await prisma.documentSequence.findMany({ where: { year } });
  return Promise.all(
    ACCOUNTING_DOCUMENT_TYPES.map(async (type) => {
      const minimum = (await usedCounter(type, year)) + 1;
      const nextNumber = stored.find((item) => item.type === type)?.nextNumber ?? 1;
      return { type, year, nextNumber: Math.max(nextNumber, minimum), minimum };
    }),
  );
}

/**
 * Sets the number the next final document of a type will get in a year (to continue a numbering started
 * elsewhere). It cannot go back below the numbers already given.
 * @param {AccountingDocumentType} type Type.
 * @param {number} year Year.
 * @param {number} nextNumber Next counter.
 * @returns {Promise<void>}
 */
export async function setSequenceStart(type: AccountingDocumentType, year: number, nextNumber: number): Promise<void> {
  if (!Number.isInteger(nextNumber) || nextNumber < 1 || nextNumber > 99_999) {
    throw clientError('BAD_USER_INPUT', 'Numéro invalide (1 à 99 999).');
  }
  const minimum = (await usedCounter(type, year)) + 1;
  if (nextNumber < minimum) throw clientError('BAD_USER_INPUT', `Les numéros jusqu’à ${minimum - 1} sont déjà attribués.`);
  await prisma.documentSequence.upsert({
    where: { type_year: { type, year } },
    create: { type, year, nextNumber },
    update: { nextNumber },
  });
}
