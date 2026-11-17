import { ActionIcon, Anchor, Badge, Button, Checkbox, Group, Paper, SimpleGrid, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { shoppingDeliverySchema, type ShoppingDeliveryInput } from '@ordo/shared';
import { ArrowSquareOutIcon, CheckIcon, PackageIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';
import { showFormError, useAppForm } from '../../../lib/form';
import * as fmt from '../../../lib/format';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { AddressInput, type AddressValue } from '../../geo/components/AddressInput';
import { useStockMutations } from '../../stock/api';
import { useStockProposal } from '../../stock/hooks/use-stock-proposal';
import { useShoppingLists, type ShoppingList } from '../api';
import { deliveryWindow } from '../lib/delivery-format';
import { countOf } from '../../../lib/text';
import { FormActions } from '../../../components/dialogs/FormActions';

type Delivery = ShoppingList['deliveries'][number];

/**
 * Delivery of a remote order: its name, tracking, to pick up or not, when, where (when other than the place of the
 * order), and the items it brings.
 * @param {{ list: ShoppingList, delivery?: Delivery, onDone: () => void }} props List, delivery edited (none: a new one), and what follows.
 * @returns {JSX.Element} Form.
 */
function DeliveryForm({ list, delivery, onDone }: { list: ShoppingList; delivery?: Delivery; onDone: () => void }) {
  const { createDelivery, updateDelivery } = useStockMutations();
  const form = useAppForm<ShoppingDeliveryInput & Record<string, unknown>>({
    initialValues: {
      label: delivery?.label ?? null,
      trackingUrl: delivery?.trackingUrl ?? null,
      pickup: delivery?.pickup ?? false,
      windowFrom: delivery?.windowFrom ? String(delivery.windowFrom).slice(0, 10) : null,
      windowTo: delivery?.windowTo ? String(delivery.windowTo).slice(0, 10) : null,
      address: delivery?.address ?? null,
      lat: delivery?.lat ?? null,
      lon: delivery?.lon ?? null,
      itemIds: delivery ? list.items.filter((item) => item.deliveryId === delivery.id).map((item) => item.id) : list.items.filter((item) => !item.deliveryId).map((item) => item.id),
    },
    schema: shoppingDeliverySchema,
  });
  const values = form.getValues();
  const address: AddressValue = { text: values.address ?? '', point: values.lat !== null && values.lon !== null ? { lat: values.lat, lon: values.lon } : null };
  const handleSubmit = form.onSubmit((input) => {
    const callbacks = { onSuccess: () => (notifySuccess(delivery ? 'Livraison modifiée.' : 'Livraison ajoutée.'), onDone()), onError: (error: Error) => showFormError(form, error) };
    if (delivery) updateDelivery.mutate({ id: delivery.id, input }, callbacks);
    else createDelivery.mutate({ listId: list.id, input }, callbacks);
  });
  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput
          label="Nom"
          placeholder="Colis 1, Drive, Pharmacie…"
          data-autofocus
          value={values.label ?? ''}
          onChange={(event) => form.setFieldValue('label', event.currentTarget.value || null)}
        />
        <TextInput
          label="Suivi de livraison"
          placeholder="https://…"
          type="url"
          value={values.trackingUrl ?? ''}
          onChange={(event) => form.setFieldValue('trackingUrl', event.currentTarget.value || null)}
          error={form.errors.trackingUrl}
        />
        <Checkbox label="À retirer" description="Point relais, retrait en magasin, consigne… plutôt que livré." {...form.getInputProps('pickup', { type: 'checkbox' })} />
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
          <DatePickerInput label={values.pickup ? 'À retirer à partir du' : 'Attendue à partir du'} placeholder="—" clearable {...form.getInputProps('windowFrom')} />
          <DatePickerInput label={values.pickup ? 'Jusqu’au' : 'Au plus tard le'} placeholder="—" clearable minDate={values.windowFrom ?? undefined} {...form.getInputProps('windowTo')} />
        </SimpleGrid>
        <AddressInput
          label={values.pickup ? 'Lieu de retrait' : 'Lieu de livraison'}
          description={list.deliveryAddress ? `Vide : ${list.deliveryAddress}.` : undefined}
          placeholder="Si différent de celui de la commande"
          value={address}
          onChange={(next) => form.setValues({ address: next.text || null, lat: next.point?.lat ?? null, lon: next.point?.lon ?? null })}
        />
        <BatchMultiSelect label="Éléments de la livraison" data={list.items.map((item) => ({ value: item.id, label: item.name }))} searchable clearable {...form.getInputProps('itemIds')} />
        <FormActions onCancel={onDone} submitLabel={delivery ? 'Enregistrer' : 'Ajouter'} loading={createDelivery.isPending || updateDelivery.isPending} />
      </Stack>
    </form>
  );
}

/**
 * Remote order of a shopping list: ordered or not, where it is delivered, and its deliveries (each with its tracking,
 * when and where, received or not).
 * @param {{ listId: string }} props List (read again as it changes).
 * @returns {JSX.Element | null} Panel.
 */
export function OrderPanel({ listId }: { listId: string }) {
  const { data: lists } = useShoppingLists();
  const list = lists?.find((item) => item.id === listId);
  return list ? <OrderFields list={list} /> : null;
}

/**
 * Fields of the remote order of a list, and its deliveries.
 * @param {{ list: ShoppingList }} props List.
 * @returns {JSX.Element} Fields.
 */
function OrderFields({ list }: { list: ShoppingList }) {
  const { setOrder, setDeliveryReceived, deleteDelivery } = useStockMutations();
  const propose = useStockProposal();
  const [address, setAddress] = useState<AddressValue>({
    text: list.deliveryAddress ?? '',
    point: list.deliveryLat !== null && list.deliveryLat !== undefined && list.deliveryLon !== null && list.deliveryLon !== undefined ? { lat: list.deliveryLat, lon: list.deliveryLon } : null,
  });
  const onError = { onError: onMutationError };
  const save = (remote: boolean, next: AddressValue) =>
    setOrder.mutate({ listId: list.id, input: { remote, deliveryAddress: next.text || null, deliveryLat: next.point?.lat ?? null, deliveryLon: next.point?.lon ?? null } }, onError);
  return (
    <Stack gap="md">
      <Switch label="Commande à distance" description="Livrée, ou à retirer : suivie par ses livraisons." checked={list.remote} onChange={(event) => save(event.currentTarget.checked, address)} />
      {list.remote && (
        <>
          <AddressInput
            label="Lieu de livraison"
            placeholder="Adresse ou lieu enregistré"
            value={address}
            onChange={(next) => {
              setAddress(next);
              // Saved once a proposed address is chosen, or when the text is cleared.
              if (next.point || !next.text.trim()) save(true, next);
            }}
          />
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              Livraisons
            </Text>
            <Button size="xs" variant="default" leftSection={<PlusIcon aria-hidden />} onClick={() => openFormPanel('Nouvelle livraison', (close) => <DeliveryForm list={list} onDone={close} />)}>
              Ajouter une livraison
            </Button>
          </Group>
          {list.deliveries.length === 0 && (
            <Text size="xs" c="dimmed">
              Aucune livraison : ajoutez-en une par colis (ou par retrait).
            </Text>
          )}
          {list.deliveries.map((delivery) => {
            const items = list.items.filter((item) => item.deliveryId === delivery.id);
            return (
              <Paper key={delivery.id} withBorder radius="sm" p="xs">
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Group gap={6}>
                      <PackageIcon aria-hidden />
                      <Text size="sm" fw={600}>
                        {delivery.label || (delivery.pickup ? 'Retrait' : 'Livraison')}
                      </Text>
                      {delivery.pickup && (
                        <Badge size="xs" variant="light" tt="none">
                          à retirer
                        </Badge>
                      )}
                      {delivery.receivedAt && (
                        <Badge size="xs" variant="light" color="green" tt="none">
                          réceptionnée le {fmt.day(new Date(delivery.receivedAt))}
                        </Badge>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {[deliveryWindow(delivery), delivery.address, countOf(items.length, 'élément')].filter(Boolean).join(' · ')}
                    </Text>
                    {delivery.trackingUrl && /^https?:\/\//i.test(delivery.trackingUrl) && (
                      <Anchor href={delivery.trackingUrl} target="_blank" rel="noopener noreferrer" size="xs">
                        Suivi <ArrowSquareOutIcon aria-hidden style={{ verticalAlign: 'middle' }} />
                      </Anchor>
                    )}
                  </Stack>
                  <Group gap={2} wrap="nowrap">
                    <Tooltip label={delivery.receivedAt ? 'Pas encore réceptionnée' : 'Réceptionnée (ses éléments achetés)'}>
                      <ActionIcon
                        variant={delivery.receivedAt ? 'light' : 'subtle'}
                        color={delivery.receivedAt ? 'green' : 'gray'}
                        aria-label={`Réceptionnée : ${delivery.label || 'livraison'}`}
                        onClick={() =>
                          setDeliveryReceived.mutate(
                            { id: delivery.id, received: !delivery.receivedAt },
                            {
                              onSuccess: (ids) => {
                                if (!delivery.receivedAt) notifySuccess('Livraison réceptionnée.');
                                propose(list.items.filter((item) => ids.includes(item.id)));
                              },
                              ...onError,
                            },
                          )
                        }
                      >
                        <CheckIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label="Modifier la livraison"
                      onClick={() => openFormPanel('Modifier la livraison', (close) => <DeliveryForm list={list} delivery={delivery} onDone={close} />)}
                    >
                      <PencilSimpleIcon aria-hidden />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label="Supprimer la livraison"
                      onClick={() =>
                        confirmDestructive({
                          title: 'Supprimer la livraison',
                          risks: 'La livraison sera supprimée ; ses éléments restent sur la liste, sans livraison.',
                          onConfirm: () => deleteDelivery.mutate(delivery.id, onError),
                        })
                      }
                    >
                      <TrashIcon aria-hidden />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </>
      )}
    </Stack>
  );
}
