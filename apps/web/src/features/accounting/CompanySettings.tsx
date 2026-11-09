import {
  Alert,
  Autocomplete,
  Avatar,
  Button,
  Fieldset,
  FileButton,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import {
  companyProfileSchema,
  DOCUMENT_PREFIXES,
  documentNumber,
  LATE_INTEREST_PRESETS,
  PAYMENT_METHOD_PRESETS,
  PAYMENT_TERMS_PRESETS,
  type CompanyProfileInput,
} from '@ordo/shared';
import { InfoIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { AddressFields } from '../../components/address/AddressFields';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import {
  useCompanyMutations,
  useCompanyProfile,
  useDocumentSequences,
  type AccountingDocumentType,
  type CompanyProfile,
} from './api';
import { DOCUMENT_TYPE_LABELS } from './labels';

type FormValues = CompanyProfileInput & Record<string, unknown>;

/**
 * Form values of a profile (empty strings for missing texts).
 * @param {CompanyProfile} profile Profile.
 * @returns {FormValues} Values.
 */
function toValues(profile: CompanyProfile): FormValues {
  return {
    name: profile.name,
    contact: profile.contact,
    legalForm: profile.legalForm ?? '',
    capital: profile.capital ?? '',
    registration: profile.registration ?? '',
    siren: profile.siren ?? '',
    siret: profile.siret ?? '',
    activityCode: profile.activityCode ?? '',
    vatNumber: profile.vatNumber ?? '',
    vatApplicable: profile.vatApplicable,
    vatExemptionText: profile.vatExemptionText,
    address: (profile.address as CompanyProfileInput['address']) ?? null,
    email: profile.email ?? '',
    phone: profile.phone ?? '',
    website: profile.website ?? '',
    bankName: profile.bankName ?? '',
    accountHolder: profile.accountHolder ?? '',
    iban: profile.iban ?? '',
    bic: profile.bic ?? '',
    paymentTerms: profile.paymentTerms,
    paymentDays: profile.paymentDays,
    paymentMethods: profile.paymentMethods,
    lateInterest: profile.lateInterest,
    otherMentions: profile.otherMentions,
    referenceLabel: profile.referenceLabel,
    quoteValidityDays: profile.quoteValidityDays,
  };
}

/**
 * Business profile form: identity, address, contact, VAT, bank details, default terms and mentions.
 * @param {{ profile: CompanyProfile }} props Current profile.
 * @returns {JSX.Element} Form.
 */
function CompanyForm({ profile }: { profile: CompanyProfile }) {
  const { update, setLogo } = useCompanyMutations();
  const form = useAppForm<FormValues>({
    initialValues: toValues(profile),
    schema: companyProfileSchema,
  });
  const addressErrors = Object.fromEntries(
    Object.entries(form.errors)
      .filter(([key]) => key.startsWith('address.'))
      .map(([key, message]) => [key.slice('address.'.length), String(message)]),
  );

  const handleSubmit = form.onSubmit((values) =>
    update.mutate(
      { ...values, address: values.address } as CompanyProfileInput as never,
      {
        onSuccess: () => notifySuccess('Profil de la société enregistré.'),
        onError: (error) => showFormError(form, error),
      },
    ),
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="lg">
        <Fieldset legend="Identité">
          <Stack gap="sm">
            <Group gap="md" align="center">
              <Avatar
                src={profile.logoUrl}
                size={64}
                radius="sm"
                color="initials"
                name={profile.name || 'Logo'}
              />
              <Stack gap={4}>
                <Group gap="xs">
                  <FileButton
                    accept="image/png,image/jpeg"
                    onChange={(file) =>
                      file &&
                      setLogo.mutate(file, {
                        onSuccess: () => notifySuccess('Logo enregistré.'),
                        onError: (error) => notifyError(error.message),
                      })
                    }
                  >
                    {(props) => (
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<UploadSimpleIcon aria-hidden />}
                        loading={setLogo.isPending}
                        {...props}
                      >
                        {profile.logoUrl
                          ? 'Changer le logo'
                          : 'Ajouter un logo'}
                      </Button>
                    )}
                  </FileButton>
                  {profile.logoUrl && (
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={() =>
                        setLogo.mutate(null, {
                          onError: (error) => notifyError(error.message),
                        })
                      }
                    >
                      Retirer
                    </Button>
                  )}
                </Group>
                <Text size="xs" c="dimmed">
                  PNG ou JPEG, imprimé en haut des documents.
                </Text>
              </Stack>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <TextInput
                label="Nom de la société"
                required
                {...form.getInputProps('name')}
              />
              <TextInput
                label="Forme juridique"
                placeholder="SASU, EURL, EI, micro-entreprise…"
                {...form.getInputProps('legalForm')}
              />
              <TextInput
                label="Capital"
                placeholder="1 000 €"
                {...form.getInputProps('capital')}
              />
              <TextInput label="SIREN" {...form.getInputProps('siren')} />
              <TextInput label="SIRET" {...form.getInputProps('siret')} />
              <TextInput
                label="Code NAF / APE"
                placeholder="62.01Z"
                {...form.getInputProps('activityCode')}
              />
            </SimpleGrid>
            <TextInput
              label="Immatriculation"
              placeholder="RCS Paris 123 456 789, RM…"
              {...form.getInputProps('registration')}
            />
          </Stack>
        </Fieldset>

        <AddressFields
          legend="Adresse"
          value={form.values.address ?? null}
          onChange={(address) => form.setFieldValue('address', address)}
          errors={addressErrors}
        />

        <Fieldset legend="Coordonnées">
          <TextInput
            label="Nom du contact"
            {...form.getInputProps('contact')}
          />
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            <TextInput label="Email" {...form.getInputProps('email')} />
            <TextInput label="Téléphone" {...form.getInputProps('phone')} />
            <TextInput
              label="Site internet"
              placeholder="https://…"
              {...form.getInputProps('website')}
            />
          </SimpleGrid>
        </Fieldset>

        <Fieldset legend="TVA">
          <Stack gap="sm">
            <Switch
              label="TVA non applicable"
              description="Franchise en base : pas de TVA sur les documents, la mention ci-dessous est imprimée."
              checked={!form.values.vatApplicable}
              onChange={(event) =>
                form.setFieldValue(
                  'vatApplicable',
                  !event.currentTarget.checked,
                )
              }
            />
            {form.values.vatApplicable ? (
              <TextInput
                label="Numéro de TVA intracommunautaire"
                placeholder="FR12345678901"
                {...form.getInputProps('vatNumber')}
              />
            ) : (
              <TextInput
                label="Mention"
                {...form.getInputProps('vatExemptionText')}
              />
            )}
          </Stack>
        </Fieldset>

        <Fieldset legend="Banque (RIB)">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput
              label="Titulaire du compte"
              {...form.getInputProps('accountHolder')}
            />
            <TextInput label="Banque" {...form.getInputProps('bankName')} />
            <TextInput label="IBAN" {...form.getInputProps('iban')} />
            <TextInput label="BIC" {...form.getInputProps('bic')} />
          </SimpleGrid>
        </Fieldset>

        <Fieldset legend="Conditions et mentions par défaut">
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              Reprises dans chaque nouveau document, où elles restent
              modifiables.
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <NumberInput
                label="Échéance des factures"
                description="Si les conditions ne la donnent pas."
                suffix=" jours"
                min={0}
                max={365}
                {...form.getInputProps('paymentDays')}
              />
              <NumberInput
                label="Validité des devis"
                suffix=" jours"
                min={1}
                max={365}
                {...form.getInputProps('quoteValidityDays')}
              />
              <TextInput
                label="Libellé de la référence client"
                placeholder="Référence dossier, bon de commande…"
                {...form.getInputProps('referenceLabel')}
              />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <Autocomplete
                label="Conditions de règlement"
                placeholder="À réception"
                data={PAYMENT_TERMS_PRESETS}
                {...form.getInputProps('paymentTerms')}
              />
              <Autocomplete
                label="Mode de règlement"
                placeholder="Virement bancaire"
                data={PAYMENT_METHOD_PRESETS}
                {...form.getInputProps('paymentMethods')}
              />
              <Autocomplete
                label="Intérêts de retard"
                placeholder="Taux d’intérêt légal en vigueur"
                data={LATE_INTEREST_PRESETS}
                {...form.getInputProps('lateInterest')}
              />
            </SimpleGrid>
            <Text size="xs" c="dimmed">
              Choisissez ou complétez. « À réception », « À 30 jours », « À 45
              jours fin de mois »… donnent aussi l’échéance des factures.
              L’indemnité forfaitaire de 40 € est ajoutée d’office pour les
              clients professionnels.
            </Text>
            <Textarea
              label="Autres mentions"
              autosize
              minRows={2}
              {...form.getInputProps('otherMentions')}
            />
          </Stack>
        </Fieldset>

        <Group justify="flex-end">
          <Button type="submit" loading={update.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Numbering of the year: the next number of each document type, to go on with a numbering started
 * elsewhere. Numbers already given cannot be given again.
 * @returns {JSX.Element} Section.
 */
function NumberingSettings() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: sequences, isPending } = useDocumentSequences(year);
  const { setSequence } = useCompanyMutations();
  const [edits, setEdits] = useState<
    Partial<Record<AccountingDocumentType, number>>
  >({});

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2} size="h4">
              Numérotation
            </Title>
            <Text size="sm" c="dimmed">
              Numéro du prochain document définitif de chaque type. Les
              brouillons n’ont pas de numéro : il est attribué à la validation,
              sans trou.
            </Text>
          </Stack>
          <Select
            aria-label="Année"
            w={110}
            data={[currentYear - 1, currentYear, currentYear + 1].map(String)}
            value={String(year)}
            onChange={(value) => {
              setYear(Number(value));
              setEdits({});
            }}
            allowDeselect={false}
          />
        </Group>
        {isPending ? (
          <Skeleton height={160} />
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Document</Table.Th>
                <Table.Th>Prochain numéro</Table.Th>
                <Table.Th>Aperçu</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sequences?.map((sequence) => {
                const value = edits[sequence.type] ?? sequence.nextNumber;
                return (
                  <Table.Tr key={sequence.type}>
                    <Table.Td>
                      {DOCUMENT_TYPE_LABELS[sequence.type]} (
                      {DOCUMENT_PREFIXES[sequence.type]})
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        aria-label={`Prochain numéro — ${DOCUMENT_TYPE_LABELS[sequence.type]}`}
                        w={120}
                        min={sequence.minimum}
                        max={99_999}
                        value={value}
                        onChange={(next) =>
                          typeof next === 'number' &&
                          setEdits({ ...edits, [sequence.type]: next })
                        }
                      />
                    </Table.Td>
                    <Table.Td ff="monospace">
                      {documentNumber(sequence.type, year, value)}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="light"
                        disabled={value === sequence.nextNumber}
                        onClick={() =>
                          setSequence.mutate(
                            { type: sequence.type, year, nextNumber: value },
                            {
                              onSuccess: () =>
                                notifySuccess('Numérotation enregistrée.'),
                              onError: (error) => notifyError(error.message),
                            },
                          )
                        }
                      >
                        Enregistrer
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Paper>
  );
}

/**
 * Settings of the business: profile printed on the accounting documents, and numbering.
 * @returns {JSX.Element} Settings.
 */
export function CompanySettings() {
  const { data: profile, isPending } = useCompanyProfile();
  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md" component="section">
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={2} size="h4">
              Ma société
            </Title>
            <Text size="sm" c="dimmed">
              Imprimée sur les devis, factures et avoirs.
            </Text>
          </Stack>
          {!isPending && profile && !profile.name && (
            <Alert color="blue" icon={<InfoIcon aria-hidden />}>
              Renseignez au moins le nom de la société avant d’éditer des
              documents.
            </Alert>
          )}
          {isPending || !profile ? (
            <Skeleton height={400} />
          ) : (
            <CompanyForm profile={profile} />
          )}
        </Stack>
      </Paper>
      <NumberingSettings />
    </Stack>
  );
}
