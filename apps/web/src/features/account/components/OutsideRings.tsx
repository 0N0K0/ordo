import { Badge, Group, Paper, Stack, Switch, Text } from '@mantine/core';
import { DevicesIcon, PaperPlaneTiltIcon, PlusIcon, XIcon } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { NoticeAlert } from '../../../components/feedback/NoticeAlert';
import * as fmt from '../../../lib/format';
import { notifyError, notifySuccess, onMutationError } from '../../../lib/notify';
import { useAsyncAction } from '../../../lib/use-async-action';
import { pushQueryKey, usePushConfig, usePushMutations, type PushDevice } from '../../alarms/api';
import { currentPushSubscription, pushSupported, subscribeThisDevice, unsubscribeThisDevice } from '../../alarms/lib/push';

/**
 * Endpoint of the push subscription of this device, followed (null: not subscribed).
 * @param {unknown} refresh Value whose change reads it again (the devices of the user).
 * @returns {string | null} Endpoint.
 */
function useThisEndpoint(refresh: unknown): string | null {
  const [endpoint, setEndpoint] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void currentPushSubscription()
      .then((subscription) => live && setEndpoint(subscription?.endpoint ?? null))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [refresh]);
  return endpoint;
}

/**
 * A device receiving the push notifications: its label (« Cet appareil »), when it was added and last reached, « Tester »
 * and « Retirer » (confirmed).
 * @param {{ device: PushDevice, here: boolean }} props Device, and whether it is this one.
 * @returns {JSX.Element} Row.
 */
function DeviceRow({ device, here }: { device: PushDevice; here: boolean }) {
  const { remove, test } = usePushMutations();
  const queryClient = useQueryClient();

  /**
   * « Tester »: a test notification pushed to the device.
   * @returns {void}
   */
  const sendTest = () =>
    test.mutate(device.id, {
      onSuccess: (reached) =>
        reached ? notifySuccess(`Notification envoyée à « ${device.label} ».`) : notifyError(`« ${device.label} » n’a pas reçu la notification (un appareil expiré est retiré).`),
      onError: onMutationError,
    });

  /**
   * « Retirer », confirmed: the device receives nothing more (this one: its browser unsubscribed too).
   * @returns {void}
   */
  const askRemove = () =>
    confirmDestructive({
      title: 'Retirer l’appareil',
      risks: `« ${device.label} » ne recevra plus les sonneries hors de l’app. Il pourra être ajouté à nouveau depuis cet appareil.`,
      confirmLabel: 'Retirer',
      confirmIcon: <XIcon aria-hidden />,
      reversible: true,
      run: async () => {
        if (!here) return remove.mutateAsync(device.id);
        await unsubscribeThisDevice([device]);
        return queryClient.invalidateQueries({ queryKey: pushQueryKey });
      },
      done: 'Appareil retiré.',
    });

  return (
    <Paper withBorder p="sm">
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Stack gap={0}>
          <Group gap="xs">
            <Text fw={500}>{device.label}</Text>
            {here && <Badge variant="light">Cet appareil</Badge>}
          </Group>
          <Text size="sm" c="dimmed">
            Ajouté le {fmt.day(device.createdAt)} · {device.lastSuccessAt ? `dernier envoi le ${fmt.dateTime(device.lastSuccessAt)}` : 'aucun envoi encore'}
          </Text>
        </Stack>
        <Group gap="xs">
          <ActionButton priority="tertiary" icon={<PaperPlaneTiltIcon aria-hidden />} loading={test.isPending} onClick={sendTest}>
            Tester
          </ActionButton>
          <ActionButton priority="tertiary" danger icon={<XIcon aria-hidden />} onClick={askRemove}>
            Retirer
          </ActionButton>
        </Group>
      </Group>
    </Paper>
  );
}

/**
 * « Sonner hors de l'app »: switched on, it asks the permission of the notifications and
 * subscribes this device; switched off, it unsubscribes this device, and the server pushes to none of the others (the
 * setting is the user's: they stay listed, ready for when it is on again). Below, the devices of the user with « Tester »
 * and « Retirer », and « Recevoir sur cet appareil » when this one is not among them. Says when the server has no push
 * (no VAPID keys) or the browser cannot receive it.
 * @param {{ checked: boolean, onChange: (value: boolean) => void }} props Setting as in the form, and its change (saved by the form).
 * @returns {JSX.Element} Switch and devices.
 */
export function OutsideRings({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const { data } = usePushConfig();
  const queryClient = useQueryClient();
  const devices = data?.pushSubscriptions ?? [];
  const endpoint = useThisEndpoint(data);
  const publicKey = data?.pushPublicKey ?? null;
  const supported = pushSupported();
  const here = devices.some((device) => device.endpoint === endpoint);

  /**
   * Reads the devices again.
   * @returns {Promise<void>} Done.
   */
  const refresh = () => queryClient.invalidateQueries({ queryKey: pushQueryKey });

  const subscribe = useAsyncAction(async () => {
    await subscribeThisDevice(publicKey!);
    await refresh();
  });
  const toggle = useAsyncAction(async (on: boolean) => {
    if (on) await subscribeThisDevice(publicKey!);
    else await unsubscribeThisDevice(devices);
    await refresh();
    onChange(on);
  });

  return (
    <Stack gap="sm">
      <Switch
        label="Sonner hors de l’app"
        description="Notifications push sur les appareils ajoutés, app fermée : le son et la vibration du système à chaque envoi, renvoyé à chaque répétition jusqu’à « Arrêter ». Désactiver retire cet appareil ; les autres restent listés mais ne reçoivent plus rien."
        checked={checked}
        disabled={toggle.loading || (!checked && (!publicKey || !supported))}
        onChange={(event) => void toggle.run(event.currentTarget.checked)}
      />
      {data && !publicKey && <NoticeAlert kind="info">Les notifications push ne sont pas configurées sur ce serveur (clés VAPID manquantes) : les alarmes sonnent seulement app ouverte.</NoticeAlert>}
      {publicKey && !supported && <NoticeAlert kind="info">Ce navigateur ne reçoit pas de notifications push.</NoticeAlert>}
      {checked && publicKey && (
        <Stack gap="xs">
          {devices.length === 0 && <EmptyState compact icon={<DevicesIcon />} message="Aucun appareil ne reçoit les sonneries hors de l’app." />}
          {devices.map((device) => (
            <DeviceRow key={device.id} device={device} here={device.endpoint === endpoint} />
          ))}
          {supported && !here && (
            <Group>
              <ActionButton priority="secondary" icon={<PlusIcon aria-hidden />} loading={subscribe.loading} onClick={() => void subscribe.run()}>
                Recevoir sur cet appareil
              </ActionButton>
            </Group>
          )}
        </Stack>
      )}
    </Stack>
  );
}
