import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((value) => value || null)
    .nullable();

/** Postal address, in the order of international postal conventions (ISO 19160 / UPU). */
export const addressSchema = z.object({
  /** Street lines: number and street, building, floor, PO box… */
  lines: z.array(z.string().trim().max(120, '120 caractères maximum.')).max(4),
  postalCode: z.string().trim().max(20),
  city: z.string().trim().max(100),
  /** Region, state or province, when the country uses it. */
  region: z.string().trim().max(100),
  /** ISO 3166-1 alpha-2 code. */
  country: z.string().regex(/^[A-Z]{2}$/, 'Pays invalide.'),
});
export type Address = z.infer<typeof addressSchema>;

export const EMPTY_ADDRESS: Address = {
  lines: [''],
  postalCode: '',
  city: '',
  region: '',
  country: 'FR',
};

/**
 * Whether an address has content.
 * @param {Address | null | undefined} address Address.
 * @returns {boolean} True when something is filled in.
 */
export function hasAddress(address: Address | null | undefined): boolean {
  return Boolean(
    address &&
    (address.lines.some((line) => line.trim()) ||
      address.city.trim() ||
      address.postalCode.trim()),
  );
}

/**
 * Address as printed lines: street lines, then postal code and city, region, country (omitted for France).
 * @param {Address} address Address.
 * @param {(code: string) => string} countryName Country name of a code.
 * @returns {string[]} Lines.
 */
export function addressLines(
  address: Address,
  countryName: (code: string) => string,
): string[] {
  return [
    ...address.lines.filter((line) => line.trim()),
    [address.postalCode, address.city].filter(Boolean).join(' '),
    address.region,
    address.country === 'FR' ? '' : countryName(address.country).toUpperCase(),
  ].filter((line) => line.trim());
}

export const phoneSchema = z.object({
  label: z.string().trim().max(40),
  number: z
    .string()
    .trim()
    .min(3, 'Numéro invalide.')
    .max(30, 'Numéro invalide.'),
});
export const phonesSchema = z.array(phoneSchema).max(10);
export type Phone = z.infer<typeof phoneSchema>;

const emailSchema = z
  .union([z.email({ error: 'Adresse email invalide.' }), z.literal('')])
  .transform((value) => value || null)
  .nullable();
const websiteSchema = z
  .union([
    z.url({ protocol: /^https?$/, error: 'Adresse invalide (http ou https).' }),
    z.literal(''),
  ])
  .transform((value) => value || null)
  .nullable();

/**
 * Luhn check (SIREN, SIRET).
 * @param {string} digits Digits.
 * @returns {boolean} True when valid.
 */
function luhn(digits: string): boolean {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) digit = digit * 2 > 9 ? digit * 2 - 9 : digit * 2;
    sum += digit;
  }
  return sum % 10 === 0;
}

const sirenSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ''))
  .refine(
    (value) => value === '' || (/^\d{9}$/.test(value) && luhn(value)),
    'SIREN invalide (9 chiffres).',
  )
  .transform((value) => value || null)
  .nullable();
const siretSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ''))
  // La Poste's establishments do not follow the Luhn key.
  .refine(
    (value) =>
      value === '' ||
      (/^\d{14}$/.test(value) &&
        (luhn(value) || value.startsWith('356000000'))),
    'SIRET invalide (14 chiffres).',
  )
  .transform((value) => value || null)
  .nullable();

/**
 * IBAN check (ISO 13616, mod 97).
 * @param {string} iban IBAN without spaces.
 * @returns {boolean} True when valid.
 */
export function isValidIban(iban: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`.replace(
    /[A-Z]/g,
    (letter) => String(letter.charCodeAt(0) - 55),
  );
  let remainder = 0;
  for (const digit of rearranged)
    remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

/** Client details used on accounting documents. */
export const clientDetailsSchema = z.object({
  kind: z.enum(['COMPANY', 'INDIVIDUAL']),
  firstName: optionalText(100),
  lastName: optionalText(100),
  address: addressSchema.nullable(),
  email: emailSchema,
  phones: phonesSchema,
  website: websiteSchema,
  vatNumber: optionalText(20),
  siren: sirenSchema,
  siret: siretSchema,
  activityCode: optionalText(20),
});
export type ClientDetailsInput = z.input<typeof clientDetailsSchema>;

export const clientServiceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom est requis.')
    .max(120, '120 caractères maximum.'),
  address: addressSchema.nullable(),
  email: emailSchema,
  phones: phonesSchema,
});
export type ClientServiceInput = z.input<typeof clientServiceSchema>;

export const clientContactSchema = z.object({
  serviceId: z.string().nullable(),
  firstName: z
    .string()
    .trim()
    .min(1, 'Le prénom est requis.')
    .max(100, '100 caractères maximum.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Le nom est requis.')
    .max(100, '100 caractères maximum.'),
  email: emailSchema,
  jobTitle: optionalText(120),
  phones: phonesSchema,
});
export type ClientContactInput = z.input<typeof clientContactSchema>;

/** The user's business. */
export const companyProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom de la société est requis.')
    .max(200, '200 caractères maximum.'),
  contact: optionalText(120),
  legalForm: optionalText(80),
  capital: optionalText(40),
  registration: optionalText(120),
  siren: sirenSchema,
  siret: siretSchema,
  activityCode: optionalText(20),
  vatNumber: optionalText(20),
  vatApplicable: z.boolean(),
  vatExemptionText: z
    .string()
    .trim()
    .min(1, 'La mention est requise.')
    .max(300),
  address: addressSchema.nullable(),
  email: emailSchema,
  phone: optionalText(30),
  website: websiteSchema,
  bankName: optionalText(120),
  accountHolder: optionalText(120),
  iban: z
    .string()
    .transform((value) => value.replace(/\s/g, '').toUpperCase())
    .refine((value) => value === '' || isValidIban(value), 'IBAN invalide.')
    .transform((value) => value || null)
    .nullable(),
  bic: z
    .string()
    .transform((value) => value.replace(/\s/g, '').toUpperCase())
    .refine(
      (value) =>
        value === '' || /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value),
      'BIC invalide (8 ou 11 caractères).',
    )
    .transform((value) => value || null)
    .nullable(),
  paymentTerms: z.string().trim().max(1000),
  paymentDays: z.number().int().min(0, 'Au moins 0.').max(365, '365 maximum.'),
  paymentMethods: z.string().trim().max(500),
  lateInterest: z.string().trim().max(1000),
  otherMentions: z.string().trim().max(2000),
  referenceLabel: z.string().trim().min(1, 'Le libellé est requis.').max(60),
  quoteValidityDays: z
    .number()
    .int()
    .min(1, 'Au moins 1 jour.')
    .max(365, '365 maximum.'),
});
export type CompanyProfileInput = z.input<typeof companyProfileSchema>;

export const ACCOUNTING_DOCUMENT_TYPES = [
  'QUOTE',
  'INVOICE',
  'DEPOSIT_INVOICE',
  'CREDIT_NOTE',
] as const;
export type AccountingDocumentType = (typeof ACCOUNTING_DOCUMENT_TYPES)[number];

/** Number prefix of each document type. */
export const DOCUMENT_PREFIXES: Record<AccountingDocumentType, string> = {
  QUOTE: 'D',
  INVOICE: 'F',
  DEPOSIT_INVOICE: 'FA',
  CREDIT_NOTE: 'A',
};

/**
 * Number of a document: prefix, two-digit year, five-digit counter ("F2600042").
 * @param {AccountingDocumentType} type Document type.
 * @param {number} year Full year.
 * @param {number} counter Counter in the year.
 * @returns {string} Number.
 */
export function documentNumber(
  type: AccountingDocumentType,
  year: number,
  counter: number,
): string {
  return `${DOCUMENT_PREFIXES[type]}${String(year % 100).padStart(2, '0')}${String(counter).padStart(5, '0')}`;
}
