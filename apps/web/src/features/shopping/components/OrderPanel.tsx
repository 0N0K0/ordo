import { IconAction } from '../../../components/actions/IconAction';
import { SubSection } from '../../../components/page/SubSection';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { Anchor, Badge, Checkbox, Group, Paper, Stack, Switch, Text, TextInput } from '@mantine/core';
import { shoppingDeliverySchema, type ShoppingDeliveryInput } from '@ordo/shared';
import { ArrowSquareOutIcon, CheckIcon, PackageIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';
import { useAppForm, useFieldSave, formCallbacks } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { useLocationDraft } from '../../geo/hooks/use-location-draft';
import * as fmt from '../../../lib/format';
import { notifySuccess, ON_ERROR } from '../../../lib/notify';
import { AddressInput, type AddressValue } from '../../geo/components/AddressInput';
import { useStockMutations } from '../../stock/api';
import { useStockProposal } from '../../stock/hooks/use-stock-proposal';
import { useShoppingLists, type ShoppingList } from '../api';
import { deliveryWindow } from '../lib/delivery-format';
import { countOf } from '../../../lib/text';
import { FormActions } from '../../../components/dialogs/FormActions';
import { formRange } from '../../../components/inputs/date-range';
import { PeriodField } from '../../../components/inputs/PeriodField';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EXTERNAL_LINK } from '../../../components/actions/link-props';
import { LabelField } from '../../../components/inputs/LabelField';

type Delivery = ShoppingList['deliveries'][number];

/** Values of the form of a delivery. */
type DeliveryValues = ShoppingDeliveryInput & Record<string, unknown>;

/** Fields of a delivery saved on leaving them, in its panel: its texts and its place. */
const ON_BLUR = ['label', 'trackingUrl', 'address', 'lat', 'lon'] as const;

/**
 * Values of the form of a delivery (a new one: the items without delivery).
 * @param {ShoppingList} list List.
 * @param {Delivery} [delivery] Delivery, as the cache holds it. Optional.
 * @returns {DeliveryValues} Values.
 */
const deliveryValues = (list: ShoppingList, delivery?: Delivery): DeliveryValues => ({
  label: delivery?.label ?? null,
  trackingUrl: delivery?.trackingUrl ?? null,
  pickup: delivery?.pickup ?? false,
  windowFrom: delivery?.windowFrom ? delivery.windowFrom : null,
  windowTo: delivery?.windowTo ? delivery.windowTo : null,
  address: delivery?.address ?? null,
  lat: delivery?.lat ?? null,
  lon: delivery?.lon ?? null,
  itemIds: list.items.filter((item) => (delivery ? item.deliveryId === delivery.id : !item.deliveryId)).map((item) => item.id),
});

/**
 * Delivery of a remote order: its name, tracking, to pick up or not, when, where (when other than the place of the
 * order), and the items it brings. A new one is a form with « Ajouter »; an existing one, its panel, saves each field as
 * soon as it changes (its texts on leaving them, its place once chosen, cleared or left: `useFieldSave`),
 * the delivery of the cache followed.
 * @param {{ list: ShoppingList, delivery?: Delivery, onDone: () => void }} props List, delivery edited (none: a new one), and what follows.
 * @returns {JSX.Element} Form.
 */
function DeliveryForm({ list, delivery, onDone }: { list: ShoppingList; delivery?: Delivery; onDone: () => void }) {
  const { createDelivery, updateDelivery } = useStockMutations();
  const { data: lists } = useShoppingLists();
  const currentList = lists?.find((item) => item.id === list.id) ?? list;
  const current = delivery && (currentList.deliveries.find((item) => item.id === delivery.id) ?? delivery);
  const base = useAppForm<DeliveryValues>({ initialValues: deliveryValues(list, delivery), schema: shoppingDeliverySchema });
  const { form, saving, commit } = useFieldSave(base, {
    save: delivery ? (_changes, input) => updateDelivery.mutateAsync({ id: delivery.id, input }) : null,
    schema: shoppingDeliverySchema,
    saved: current && deliveryValues(currentList, current),
    onBlur: ON_BLUR,
  });
  const values = form.getValues();
  // Put in the form once chosen, cleared or left (as every place), then saved at once for an existing delivery.
  // A delivery names its place `address`, `lat`, `lon`.
  const place = useLocationDraft({ location: values.address, locationLat: values.lat, locationLon: values.lon }, ({ location, locationLat, locationLon }) => {
    form.setValues({ address: location, lat: locationLat, lon: locationLon });
    commit(['address', 'lat', 'lon']);
  });
  // A new delivery only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit((input) => createDelivery.mutate({ listId: list.id, input }, formCallbacks(form, 'Livraison ajoutée.', onDone)));
  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        {delivery && <SaveStatus saving={saving} />}
        <LabelField
          required={false}
          placeholder="Colis 1, Drive, Pharmacie…"
          data-autofocus={delivery ? undefined : true}
          value={values.label ?? ''}
          onChange={(event) => form.setFieldValue('label', event.currentTarget.value || null)}
          onBlur={() => commit(['label'])}
        />
        <TextInput
          label="Suivi de livraison"
          placeholder="https://…"
          type="url"
          value={values.trackingUrl ?? ''}
          onChange={(event) => form.setFieldValue('trackingUrl', event.currentTarget.value || null)}
          onBlur={() => commit(['trackingUrl'])}
          error={form.errors.trackingUrl}
        />
        <Checkbox label="À retirer" description="Point relais, retrait en magasin, consigne… plutôt que livré." {...form.getInputProps('pickup', { type: 'checkbox' })} />
        <PeriodField
          label={values.pickup ? 'À retirer' : 'Attendue'}
          bounds={values.pickup ? ['À partir du', 'Jusqu’au'] : ['À partir du', 'Au plus tard le']}
          {...formRange(form, 'windowFrom', 'windowTo')}
        />
        <AddressInput
          label={values.pickup ? 'Lieu de retrait' : 'Lieu de livraison'}
          description={list.deliveryAddress ? `Vide : ${list.deliveryAddress}.` : undefined}
          placeholder="Si différent de celui de la commande"
          value={place.value}
          onChange={place.onChange}
          onBlur={place.leave}
        />
        <BatchMultiSelect label="Éléments de la livraison" data={currentList.items.map((item) => ({ value: item.id, label: item.label }))} searchable clearable {...form.getInputProps('itemIds')} />
        {!delivery && <FormActions onCancel={onDone} submitLabel="Ajouter" loading={createDelivery.isPending} />}
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
  const save = (remote: boolean, next: AddressValue) =>
    setOrder.mutate({ listId: list.id, input: { remote, deliveryAddress: next.text || null, deliveryLat: next.point?.lat ?? null, deliveryLon: next.point?.lon ?? null } }, ON_ERROR);
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
              // eslint-disable-next-line no-restricted-syntax -- the address of an order, not the location of an item.
              if (next.point || !next.text.trim()) save(true, next);
            }}
          />
          <SubSection
            title="Livraisons"
            gap="md"
            action={
              <ActionButton priority="secondary" size="xs" icon={<PlusIcon aria-hidden />} onClick={() => openFormPanel('Nouvelle livraison', (close) => <DeliveryForm list={list} onDone={close} />)}>
                Ajouter une livraison
              </ActionButton>
            }
          >
            {list.deliveries.length === 0 && <EmptyState compact icon={<PackageIcon aria-hidden />} message="Aucune livraison : ajoutez-en une par colis (ou par retrait)." />}
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
                          <Badge size="xs" variant="light">
                            à retirer
                          </Badge>
                        )}
                        {delivery.receivedAt && (
                          <Badge size="xs" variant="light" color="green">
                            réceptionnée le {fmt.day(delivery.receivedAt)}
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed">
                        {[deliveryWindow(delivery), delivery.address, countOf(items.length, 'élément')].filter(Boolean).join(' · ')}
                      </Text>
                      {delivery.trackingUrl && /^https?:\/\//i.test(delivery.trackingUrl) && (
                        <Anchor href={delivery.trackingUrl} {...EXTERNAL_LINK} size="xs">
                          Suivi <ArrowSquareOutIcon aria-hidden style={{ verticalAlign: 'middle' }} />
                        </Anchor>
                      )}
                    </Stack>
                    <Group gap={2} wrap="nowrap">
                      <IconAction
                        label={delivery.receivedAt ? 'Pas encore réceptionnée' : 'Réceptionnée (ses éléments achetés)'}
                        variant={delivery.receivedAt ? 'light' : 'subtle'}
                        color={delivery.receivedAt ? 'green' : 'gray'}
                        item={delivery.label || 'Livraison'}
                        onClick={() =>
                          setDeliveryReceived.mutate(
                            { id: delivery.id, received: !delivery.receivedAt },
                            {
                              onSuccess: (ids) => {
                                if (!delivery.receivedAt) notifySuccess('Livraison réceptionnée.');
                                propose(list.items.filter((item) => ids.includes(item.id)));
                              },
                              ...ON_ERROR,
                            },
                          )
                        }
                      >
                        <CheckIcon aria-hidden />
                      </IconAction>
                      <IconAction
                        label="Modifier"
                        aria-label="Modifier la livraison"
                        onClick={() => openFormPanel('Modifier la livraison', (close) => <DeliveryForm list={list} delivery={delivery} onDone={close} />)}
                      >
                        <PencilSimpleIcon aria-hidden />
                      </IconAction>
                      <RemoveButton
                        label="Supprimer"
                        aria-label="Supprimer la livraison"
                        onClick={() =>
                          confirmDestructive({
                            title: 'Supprimer la livraison',
                            risks: 'La livraison sera supprimée ; ses éléments restent sur la liste, sans livraison.',
                            run: () => deleteDelivery.mutateAsync(delivery.id),
                          })
                        }
                      />
                    </Group>
                  </Group>
                </Paper>
              );
            })}
          </SubSection>
        </>
      )}
    </Stack>
  );
}
