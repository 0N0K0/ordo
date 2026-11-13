import {
  Badge,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { ACCOUNTING_UNITS, catalogItemSchema, formatMoney, UNIT_LABELS, VAT_RATES, type CatalogItemInput } from '@ordo/shared';
import { PackageIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { DataTable } from '../../components/data-table/DataTable';
import { RowActions } from '../../components/data-table/RowActions';
import type { DataColumn } from '../../components/data-table/data-table';
import { showFormError, useAppForm } from '../../lib/form';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../workspace/DeleteDialogs';
import { useCompanyProfile } from './api';
import { useCatalogItems, useCatalogMutations, type CatalogItem } from './catalog-api';

let modalCount = 0;

/** Columns of the catalog. */
const CATALOG_COLUMNS: DataColumn<CatalogItem>[] = [
  { id: 'title', label: 'Article', size: 320, locked: true, sortValue: (item) => item.title },
  { id: 'unit', label: 'Unité', size: 120, sortValue: (item) => UNIT_LABELS[item.unit].label },
  { id: 'price', label: 'Prix HT', size: 120, numeric: true, sortValue: (item) => item.unitPrice },
  { id: 'vat', label: 'TVA', size: 90, numeric: true, sortValue: (item) => (item.kind === 'DISBURSEMENT' ? null : item.vatRate) },
];

/**
 * Catalogue item form: kind, title, description, unit, price, VAT.
 * @param {{ item?: CatalogItem, onDone: () => void }} props Item to edit (none: new item) and close callback.
 * @returns {JSX.Element} Form.
 */
function CatalogItemForm({ item, onDone }: { item?: CatalogItem; onDone: () => void }) {
  const { data: company } = useCompanyProfile();
  const { create, update } = useCatalogMutations();
  const form = useAppForm<CatalogItemInput & Record<string, unknown>>({
    initialValues: {
      kind: (item?.kind as CatalogItemInput['kind']) ?? 'ITEM',
      title: item?.title ?? '',
      description: item?.description ?? '',
      unit: item?.unit ?? 'HOUR',
      unitPrice: item?.unitPrice ?? 0,
      vatRate: item?.vatRate ?? (company?.vatApplicable === false ? 0 : 20),
      archived: item?.archived ?? false,
    },
    schema: catalogItemSchema,
  });
  const disbursement = form.values.kind === 'DISBURSEMENT';
  return (
    <form
      noValidate
      onSubmit={form.onSubmit(() => {
        const callbacks = {
          onSuccess: () => {
            notifySuccess(item ? 'Article modifié.' : 'Article ajouté au catalogue.');
            onDone();
          },
          onError: (error: Error) => showFormError(form, error),
        };
        // The raw values: the API validates (and trims) them.
        if (item) update.mutate({ id: item.id, input: form.values }, callbacks);
        else create.mutate(form.values, callbacks);
      })}
    >
      <Stack gap="sm">
        <SegmentedControl
          data={[
            { value: 'ITEM', label: 'Produit ou service' },
            { value: 'DISBURSEMENT', label: 'Débours' },
          ]}
          {...form.getInputProps('kind')}
          onChange={(kind) => form.setValues({ kind: kind as CatalogItemInput['kind'], ...(kind === 'DISBURSEMENT' && { vatRate: 0, unit: 'FLAT' }) })}
        />
        <TextInput label="Libellé" required data-autofocus {...form.getInputProps('title')} />
        <Textarea label="Description" description="Reprise dans la ligne (markdown)." autosize minRows={2} {...form.getInputProps('description')} />
        <SimpleGrid cols={{ base: 1, sm: disbursement ? 2 : 3 }} spacing="sm">
          <Select label="Unité" allowDeselect={false} data={ACCOUNTING_UNITS.map((unit) => ({ value: unit, label: UNIT_LABELS[unit].label }))} {...form.getInputProps('unit')} />
          <NumberInput label="Prix unitaire HT" decimalScale={2} decimalSeparator="," thousandSeparator=" " suffix=" €" {...form.getInputProps('unitPrice')} />
          {!disbursement && (
            <Select
              label="TVA"
              allowDeselect={false}
              data={[...new Set([...VAT_RATES, form.values.vatRate])].map((rate) => ({ value: String(rate), label: `${rate.toLocaleString('fr-FR')} %` }))}
              value={String(form.values.vatRate)}
              onChange={(rate) => rate !== null && form.setFieldValue('vatRate', Number(rate))}
              error={form.errors.vatRate}
            />
          )}
        </SimpleGrid>
        {item && <Checkbox label="Archivé (n’est plus proposé dans les documents)" {...form.getInputProps('archived', { type: 'checkbox' })} />}
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Catalogue of products and services: default title, unit, price and VAT of the lines, added, edited,
 * archived or deleted.
 * @returns {JSX.Element} Panel.
 */
export function CatalogPanel() {
  const { data: items, isPending } = useCatalogItems();
  const { remove } = useCatalogMutations();
  const [showArchived, setShowArchived] = useState(false);
  const shown = (items ?? []).filter((item) => showArchived || !item.archived);

  /**
   * Opens the item form.
   * @param {CatalogItem} [item] Item to edit. Optional.
   * @returns {void}
   */
  const openForm = (item?: CatalogItem) => {
    const modalId = `catalog-item-${++modalCount}`;
    modals.open({ modalId, title: item ? 'Modifier l’article' : 'Nouvel article', size: 'lg', children: <CatalogItemForm item={item} onDone={() => modals.close(modalId)} /> });
  };

  /**
   * Asks for confirmation before deleting an item.
   * @param {CatalogItem} item Item.
   * @returns {void}
   */
  const confirmDelete = (item: CatalogItem) => {
    const modalId = `delete-catalog-${item.id}`;
    modals.open({
      modalId,
      title: 'Supprimer l’article',
      children: (
        <Stack gap="md">
          <Text size="sm">« {item.title} » sera supprimé du catalogue. Les documents qui l’utilisent gardent leurs lignes. Pour seulement ne plus le proposer, archivez-le.</Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(item.id, { onSuccess: () => notifySuccess('Article supprimé.'), onError: (error) => notifyError(error.message) });
            }}
          />
        </Stack>
      ),
    });
  };

  if (isPending) return <Skeleton height={160} />;
  if (!items?.length) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Stack align="center" gap="sm">
          <ThemeIcon size="xl" radius="xl" variant="light" color="gray">
            <PackageIcon aria-hidden />
          </ThemeIcon>
          <Text size="sm" c="dimmed" ta="center">
            Catalogue vide. Ajoutez vos prestations (journée, heure, forfait…) avec leur prix et leur TVA : vous les ajouterez aux documents en un clic.
          </Text>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Ajouter un article
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <DataTable
      framed
      tableKey="catalog"
      tools={
        <Button variant="light" leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()}>
          Ajouter un article
        </Button>
      }
      displayOptions={<Switch label="Articles archivés" checked={showArchived} onChange={(event) => setShowArchived(event.currentTarget.checked)} />}
      verticalSpacing="xs"
      columns={CATALOG_COLUMNS}
      rows={shown}
      getKey={(item) => item.id}
      rowProps={(item) => ({ opacity: item.archived ? 0.6 : 1 })}
      cells={(item) => ({
        title: (
          <>
            <Group gap={6}>
              <Text size="sm" fw={600}>
                {item.title}
              </Text>
              {item.kind === 'DISBURSEMENT' && (
                <Badge size="xs" variant="light" color="grape">
                  Débours
                </Badge>
              )}
              {item.archived && (
                <Badge size="xs" variant="light" color="gray">
                  Archivé
                </Badge>
              )}
            </Group>
            {item.description && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {item.description}
              </Text>
            )}
          </>
        ),
        unit: UNIT_LABELS[item.unit].label,
        price: formatMoney(Math.round(item.unitPrice * 100)),
        vat: item.kind === 'DISBURSEMENT' ? '—' : `${item.vatRate.toLocaleString('fr-FR')} %`,
      })}
      actions={(item) => (
        <RowActions
          name={item.title}
          primary={{ label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm(item) }}
          items={[{ label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(item) }]}
        />
      )}
    />
  );
}
