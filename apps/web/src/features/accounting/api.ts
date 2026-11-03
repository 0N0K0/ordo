import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '../../graphql';
import type {
  AccountingDocumentType,
  ClientContactInput,
  ClientDetailsInput,
  ClientServiceInput,
  CompanyProfileFieldsFragment,
  CompanyProfileInput,
  ClientBillingQuery,
} from '../../graphql/graphql';
import { execute } from '../../lib/graphql-client';

export type CompanyProfile = CompanyProfileFieldsFragment;
export type ClientBilling = NonNullable<ClientBillingQuery['client']>;
export type ClientService = ClientBilling['services'][number];
export type ClientContact = ClientBilling['contacts'][number];
export type { AccountingDocumentType, ClientContactInput, ClientDetailsInput, ClientServiceInput, CompanyProfileInput };

graphql(`
  fragment CompanyProfileFields on CompanyProfile {
    name
    legalForm
    capital
    registration
    siren
    siret
    activityCode
    vatNumber
    vatApplicable
    vatExemptionText
    address
    email
    phone
    website
    logoUrl
    bankName
    accountHolder
    iban
    bic
    paymentTerms
    paymentDays
    paymentMethods
    lateInterest
    otherMentions
    referenceLabel
    quoteValidityDays
  }
`);

const CompanyProfileDocument = graphql(`
  query CompanyProfile {
    companyProfile {
      ...CompanyProfileFields
    }
  }
`);

const DocumentSequencesDocument = graphql(`
  query DocumentSequences($year: Int!) {
    documentSequences(year: $year) {
      type
      year
      nextNumber
      minimum
    }
  }
`);

const ClientBillingDocument = graphql(`
  query ClientBilling($id: ID!) {
    client(id: $id) {
      id
      name
      kind
      firstName
      lastName
      address
      email
      phones
      website
      vatNumber
      siren
      siret
      activityCode
      services {
        id
        name
        address
        email
        phones
      }
      contacts {
        id
        serviceId
        firstName
        lastName
        email
        jobTitle
        phones
      }
    }
  }
`);

const UpdateCompanyProfileDocument = graphql(`
  mutation UpdateCompanyProfile($input: CompanyProfileInput!) {
    updateCompanyProfile(input: $input) {
      name
    }
  }
`);

const SetCompanyLogoDocument = graphql(`
  mutation SetCompanyLogo($file: File) {
    setCompanyLogo(file: $file) {
      logoUrl
    }
  }
`);

const SetDocumentSequenceDocument = graphql(`
  mutation SetDocumentSequence($type: AccountingDocumentType!, $year: Int!, $nextNumber: Int!) {
    setDocumentSequence(type: $type, year: $year, nextNumber: $nextNumber)
  }
`);

const UpdateClientDetailsDocument = graphql(`
  mutation UpdateClientDetails($id: ID!, $input: ClientDetailsInput!) {
    updateClientDetails(id: $id, input: $input) {
      id
    }
  }
`);

const CreateClientServiceDocument = graphql(`
  mutation CreateClientService($clientId: ID!, $input: ClientServiceInput!) {
    createClientService(clientId: $clientId, input: $input) {
      id
    }
  }
`);

const UpdateClientServiceDocument = graphql(`
  mutation UpdateClientService($id: ID!, $input: ClientServiceInput!) {
    updateClientService(id: $id, input: $input) {
      id
    }
  }
`);

const DeleteClientServiceDocument = graphql(`
  mutation DeleteClientService($id: ID!) {
    deleteClientService(id: $id)
  }
`);

const CreateClientContactDocument = graphql(`
  mutation CreateClientContact($clientId: ID!, $input: ClientContactInput!) {
    createClientContact(clientId: $clientId, input: $input) {
      id
    }
  }
`);

const UpdateClientContactDocument = graphql(`
  mutation UpdateClientContact($id: ID!, $input: ClientContactInput!) {
    updateClientContact(id: $id, input: $input) {
      id
    }
  }
`);

const DeleteClientContactDocument = graphql(`
  mutation DeleteClientContact($id: ID!) {
    deleteClientContact(id: $id)
  }
`);

export const accountingQueryKey = ['accounting'] as const;

/**
 * The user's business profile.
 * @returns {UseQueryResult} Query state.
 */
export function useCompanyProfile() {
  return useQuery({ queryKey: [...accountingQueryKey, 'company'], queryFn: async () => (await execute(CompanyProfileDocument)).companyProfile });
}

/**
 * Numbering of the document types for a year.
 * @param {number} year Year.
 * @returns {UseQueryResult} Query state.
 */
export function useDocumentSequences(year: number) {
  return useQuery({
    queryKey: [...accountingQueryKey, 'sequences', year],
    queryFn: async () => (await execute(DocumentSequencesDocument, { year })).documentSequences,
  });
}

/**
 * Billing details, services and contacts of a client.
 * @param {string} id Client.
 * @returns {UseQueryResult} Query state.
 */
export function useClientBilling(id: string) {
  return useQuery({ queryKey: [...accountingQueryKey, 'client', id], queryFn: async () => (await execute(ClientBillingDocument, { id })).client });
}

/**
 * Mutation refreshing the accounting data once done.
 * @param {(variables: TVariables) => Promise<TResult>} mutationFn Request.
 * @returns {UseMutationResult} Mutation state.
 */
function useAccountingMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVariables>({ mutationFn, onSettled: () => queryClient.invalidateQueries({ queryKey: accountingQueryKey }) });
}

/**
 * Business profile and numbering.
 * @returns {object} Mutations.
 */
export function useCompanyMutations() {
  return {
    update: useAccountingMutation(async (input: CompanyProfileInput) => (await execute(UpdateCompanyProfileDocument, { input })).updateCompanyProfile),
    setLogo: useAccountingMutation(async (file: File | null) => (await execute(SetCompanyLogoDocument, { file })).setCompanyLogo),
    setSequence: useAccountingMutation(
      async (variables: { type: AccountingDocumentType; year: number; nextNumber: number }) =>
        (await execute(SetDocumentSequenceDocument, variables)).setDocumentSequence,
    ),
  };
}

/**
 * Client billing details, services and contacts.
 * @returns {object} Mutations.
 */
export function useClientPartyMutations() {
  return {
    updateDetails: useAccountingMutation(
      async (variables: { id: string; input: ClientDetailsInput }) => (await execute(UpdateClientDetailsDocument, variables)).updateClientDetails,
    ),
    createService: useAccountingMutation(
      async (variables: { clientId: string; input: ClientServiceInput }) => (await execute(CreateClientServiceDocument, variables)).createClientService,
    ),
    updateService: useAccountingMutation(
      async (variables: { id: string; input: ClientServiceInput }) => (await execute(UpdateClientServiceDocument, variables)).updateClientService,
    ),
    deleteService: useAccountingMutation(async (id: string) => (await execute(DeleteClientServiceDocument, { id })).deleteClientService),
    createContact: useAccountingMutation(
      async (variables: { clientId: string; input: ClientContactInput }) => (await execute(CreateClientContactDocument, variables)).createClientContact,
    ),
    updateContact: useAccountingMutation(
      async (variables: { id: string; input: ClientContactInput }) => (await execute(UpdateClientContactDocument, variables)).updateClientContact,
    ),
    deleteContact: useAccountingMutation(async (id: string) => (await execute(DeleteClientContactDocument, { id })).deleteClientContact),
  };
}
