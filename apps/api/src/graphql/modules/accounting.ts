import { ACCOUNTING_DOCUMENT_TYPES } from '@ordo/shared';
import { prisma } from '../../db';
import * as parties from '../../services/client-parties';
import * as company from '../../services/company';
import { builder } from '../builder';
import { currentWorkspaceId } from '../../workspace-context';

export const AccountingDocumentTypeEnum = builder.enumType(
  'AccountingDocumentType',
  { values: ACCOUNTING_DOCUMENT_TYPES },
);

const ClientKindEnum = builder.enumType('ClientKind', {
  values: ['COMPANY', 'INDIVIDUAL'] as const,
});

builder.prismaObjectFields('Client', (t) => ({
  kind: t.field({ type: ClientKindEnum, resolve: (client) => client.kind }),
  firstName: t.exposeString('firstName', { nullable: true }),
  lastName: t.exposeString('lastName', { nullable: true }),
  address: t.field({
    type: 'JSON',
    nullable: true,
    description: 'Postal address { lines, postalCode, city, region, country }.',
    resolve: (client) => client.address,
  }),
  email: t.exposeString('email', { nullable: true }),
  phones: t.field({
    type: 'JSON',
    description: '[{ label, number }]',
    resolve: (client) => client.phones,
  }),
  website: t.exposeString('website', { nullable: true }),
  vatNumber: t.exposeString('vatNumber', { nullable: true }),
  siren: t.exposeString('siren', { nullable: true }),
  siret: t.exposeString('siret', { nullable: true }),
  activityCode: t.exposeString('activityCode', { nullable: true }),
  services: t.relation('services', {
    query: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
  }),
  contacts: t.relation('contacts', {
    query: { orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] },
  }),
}));

builder.prismaObject('ClientService', {
  fields: (t) => ({
    id: t.exposeID('id'),
    clientId: t.exposeID('clientId'),
    name: t.exposeString('name'),
    address: t.field({
      type: 'JSON',
      nullable: true,
      resolve: (service) => service.address,
    }),
    email: t.exposeString('email', { nullable: true }),
    phones: t.field({ type: 'JSON', resolve: (service) => service.phones }),
  }),
});

builder.prismaObject('ClientContact', {
  fields: (t) => ({
    id: t.exposeID('id'),
    clientId: t.exposeID('clientId'),
    serviceId: t.exposeID('serviceId', { nullable: true }),
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    email: t.exposeString('email', { nullable: true }),
    jobTitle: t.exposeString('jobTitle', { nullable: true }),
    phones: t.field({ type: 'JSON', resolve: (contact) => contact.phones }),
  }),
});

builder.prismaObject('CompanyProfile', {
  fields: (t) => ({
    name: t.exposeString('name'),
    contact: t.exposeString('contact', { nullable: true }),
    legalForm: t.exposeString('legalForm', { nullable: true }),
    capital: t.exposeString('capital', { nullable: true }),
    registration: t.exposeString('registration', { nullable: true }),
    siren: t.exposeString('siren', { nullable: true }),
    siret: t.exposeString('siret', { nullable: true }),
    activityCode: t.exposeString('activityCode', { nullable: true }),
    vatNumber: t.exposeString('vatNumber', { nullable: true }),
    vatApplicable: t.exposeBoolean('vatApplicable'),
    vatExemptionText: t.exposeString('vatExemptionText'),
    address: t.field({
      type: 'JSON',
      nullable: true,
      resolve: (profile) => profile.address,
    }),
    email: t.exposeString('email', { nullable: true }),
    phone: t.exposeString('phone', { nullable: true }),
    website: t.exposeString('website', { nullable: true }),
    logoUrl: t.string({
      nullable: true,
      select: { logoId: true },
      resolve: (profile) =>
        profile.logoId ? `/api/attachments/${profile.logoId}/logo` : null,
    }),
    bankName: t.exposeString('bankName', { nullable: true }),
    accountHolder: t.exposeString('accountHolder', { nullable: true }),
    iban: t.exposeString('iban', { nullable: true }),
    bic: t.exposeString('bic', { nullable: true }),
    paymentTerms: t.exposeString('paymentTerms'),
    paymentDays: t.exposeInt('paymentDays'),
    paymentMethods: t.exposeString('paymentMethods'),
    lateInterest: t.exposeString('lateInterest'),
    otherMentions: t.exposeString('otherMentions'),
    referenceLabel: t.exposeString('referenceLabel'),
    quoteValidityDays: t.exposeInt('quoteValidityDays'),
  }),
});

const DocumentSequence = builder
  .objectRef<company.SequenceInfo>('DocumentSequence')
  .implement({
    fields: (t) => ({
      type: t.field({
        type: AccountingDocumentTypeEnum,
        resolve: (sequence) => sequence.type,
      }),
      year: t.exposeInt('year'),
      nextNumber: t.exposeInt('nextNumber'),
      minimum: t.exposeInt('minimum', {
        description: 'Lowest allowed next number.',
      }),
    }),
  });

const ClientDetailsInput = builder.inputType('ClientDetailsInput', {
  fields: (t) => ({
    kind: t.field({ type: ClientKindEnum, required: true }),
    firstName: t.string({ required: true }),
    lastName: t.string({ required: true }),
    address: t.field({ type: 'JSON' }),
    email: t.string({ required: true }),
    phones: t.field({ type: 'JSON', required: true }),
    website: t.string({ required: true }),
    vatNumber: t.string({ required: true }),
    siren: t.string({ required: true }),
    siret: t.string({ required: true }),
    activityCode: t.string({ required: true }),
  }),
});

const ClientServiceInput = builder.inputType('ClientServiceInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    address: t.field({ type: 'JSON' }),
    email: t.string({ required: true }),
    phones: t.field({ type: 'JSON', required: true }),
  }),
});

const ClientContactInput = builder.inputType('ClientContactInput', {
  fields: (t) => ({
    serviceId: t.id(),
    firstName: t.string({ required: true }),
    lastName: t.string({ required: true }),
    email: t.string({ required: true }),
    jobTitle: t.string({ required: true }),
    phones: t.field({ type: 'JSON', required: true }),
  }),
});

const CompanyProfileInput = builder.inputType('CompanyProfileInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    contact: t.string(),
    legalForm: t.string({ required: true }),
    capital: t.string({ required: true }),
    registration: t.string({ required: true }),
    siren: t.string({ required: true }),
    siret: t.string({ required: true }),
    activityCode: t.string({ required: true }),
    vatNumber: t.string({ required: true }),
    vatApplicable: t.boolean({ required: true }),
    vatExemptionText: t.string({ required: true }),
    address: t.field({ type: 'JSON' }),
    email: t.string({ required: true }),
    phone: t.string({ required: true }),
    website: t.string({ required: true }),
    bankName: t.string({ required: true }),
    accountHolder: t.string({ required: true }),
    iban: t.string({ required: true }),
    bic: t.string({ required: true }),
    paymentTerms: t.string({ required: true }),
    paymentDays: t.int({ required: true }),
    paymentMethods: t.string({ required: true }),
    lateInterest: t.string({ required: true }),
    otherMentions: t.string({ required: true }),
    referenceLabel: t.string({ required: true }),
    quoteValidityDays: t.int({ required: true }),
  }),
});

builder.queryFields((t) => ({
  client: t.prismaField({
    type: 'Client',
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (query, _root, { id }) =>
      prisma.client.findUnique({ ...query, where: { id } }),
  }),
  companyProfile: t.prismaField({
    type: 'CompanyProfile',
    resolve: async (query) => {
      await company.getCompanyProfile();
      return prisma.companyProfile.findUniqueOrThrow({
        ...query,
        where: { workspaceId: currentWorkspaceId() },
      });
    },
  }),
  documentSequences: t.field({
    type: [DocumentSequence],
    args: { year: t.arg.int({ required: true }) },
    resolve: (_root, { year }) => company.documentSequences(year),
  }),
}));

builder.mutationFields((t) => ({
  updateCompanyProfile: t.prismaField({
    type: 'CompanyProfile',
    args: { input: t.arg({ type: CompanyProfileInput, required: true }) },
    resolve: async (query, _root, { input }) => {
      await company.updateCompanyProfile({
        ...input,
        contact: (input.contact ?? null) as never,
        address: (input.address ?? null) as never,
      });
      return prisma.companyProfile.findUniqueOrThrow({
        ...query,
        where: { workspaceId: currentWorkspaceId() },
      });
    },
  }),
  setCompanyLogo: t.prismaField({
    type: 'CompanyProfile',
    description: 'Sets (PNG or JPEG) or removes (null) the logo.',
    args: { file: t.arg({ type: 'File' }) },
    resolve: async (query, _root, { file }) => {
      await company.setCompanyLogo(file ?? null);
      return prisma.companyProfile.findUniqueOrThrow({
        ...query,
        where: { workspaceId: currentWorkspaceId() },
      });
    },
  }),
  setDocumentSequence: t.boolean({
    description:
      'Sets the number the next final document of a type gets in a year.',
    args: {
      type: t.arg({ type: AccountingDocumentTypeEnum, required: true }),
      year: t.arg.int({ required: true }),
      nextNumber: t.arg.int({ required: true }),
    },
    resolve: async (_root, { type, year, nextNumber }) => {
      await company.setSequenceStart(type, year, nextNumber);
      return true;
    },
  }),
  updateClientDetails: t.prismaField({
    type: 'Client',
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: ClientDetailsInput, required: true }),
    },
    resolve: async (query, _root, { id, input }) => {
      await parties.updateClientDetails(id, {
        ...input,
        address: (input.address ?? null) as never,
        phones: input.phones as never,
      });
      return prisma.client.findUniqueOrThrow({ ...query, where: { id } });
    },
  }),
  createClientService: t.prismaField({
    type: 'ClientService',
    args: {
      clientId: t.arg.id({ required: true }),
      input: t.arg({ type: ClientServiceInput, required: true }),
    },
    resolve: async (query, _root, { clientId, input }) =>
      prisma.clientService.findUniqueOrThrow({
        ...query,
        where: {
          id: (
            await parties.createClientService(clientId, {
              ...input,
              address: (input.address ?? null) as never,
              phones: input.phones as never,
            })
          ).id,
        },
      }),
  }),
  updateClientService: t.prismaField({
    type: 'ClientService',
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: ClientServiceInput, required: true }),
    },
    resolve: async (query, _root, { id, input }) =>
      prisma.clientService.findUniqueOrThrow({
        ...query,
        where: {
          id: (
            await parties.updateClientService(id, {
              ...input,
              address: (input.address ?? null) as never,
              phones: input.phones as never,
            })
          ).id,
        },
      }),
  }),
  deleteClientService: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await parties.deleteClientService(id);
      return true;
    },
  }),
  createClientContact: t.prismaField({
    type: 'ClientContact',
    args: {
      clientId: t.arg.id({ required: true }),
      input: t.arg({ type: ClientContactInput, required: true }),
    },
    resolve: async (query, _root, { clientId, input }) =>
      prisma.clientContact.findUniqueOrThrow({
        ...query,
        where: {
          id: (
            await parties.createClientContact(clientId, {
              ...input,
              serviceId: input.serviceId ?? null,
              phones: input.phones as never,
            })
          ).id,
        },
      }),
  }),
  updateClientContact: t.prismaField({
    type: 'ClientContact',
    args: {
      id: t.arg.id({ required: true }),
      input: t.arg({ type: ClientContactInput, required: true }),
    },
    resolve: async (query, _root, { id, input }) =>
      prisma.clientContact.findUniqueOrThrow({
        ...query,
        where: {
          id: (
            await parties.updateClientContact(id, {
              ...input,
              serviceId: input.serviceId ?? null,
              phones: input.phones as never,
            })
          ).id,
        },
      }),
  }),
  deleteClientContact: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: async (_root, { id }) => {
      await parties.deleteClientContact(id);
      return true;
    },
  }),
}));
