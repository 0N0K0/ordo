import { Button, ColorInput, Group, Stack, TextInput } from '@mantine/core';
import { clientFormSchema, type ClientFormValues } from '@ordo/shared';
import { useState } from 'react';
import { showFormError, useAppForm } from '../../lib/form';
import { notifySuccess } from '../../lib/notify';
import { useCreateClient, useUpdateClient, type Client } from './api';
import { IconField, type IconValue } from './IconField';
import { useColorSwatches } from './use-color-swatches';

interface ClientFormProps {
  /** Client to edit; creates a new one when absent. */
  client?: Client;
  onDone: () => void;
}

/**
 * Client creation / edition form, displayed in a modal.
 * @param {ClientFormProps} props Component props.
 * @param {Client} [props.client] Client to edit. Optional.
 * @param {() => void} props.onDone Called after saving or cancelling.
 * @returns {JSX.Element} Form.
 */
export function ClientForm({ client, onDone }: ClientFormProps) {
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const swatches = useColorSwatches();
  const [icon, setIcon] = useState<IconValue>({ file: null, remove: false });
  const form = useAppForm<ClientFormValues>({
    initialValues: { name: client?.name ?? '', color: client?.color ?? '' },
    schema: clientFormSchema,
  });
  const pending = createClient.isPending || updateClient.isPending;

  const handleSubmit = form.onSubmit((values) => {
    const color = values.color || null;
    const callbacks = {
      onSuccess: () => {
        notifySuccess(client ? 'Client modifié.' : 'Client créé.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };

    if (client) {
      updateClient.mutate(
        { id: client.id, input: { name: values.name, color, icon: icon.file, removeIcon: icon.remove } },
        callbacks,
      );
    } else {
      createClient.mutate({ name: values.name, color, icon: icon.file }, callbacks);
    }
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Nom" required data-autofocus {...form.getInputProps('name')} />
        <ColorInput
          label="Couleur"
          placeholder="Aucune"
          swatches={swatches}
          swatchesPerRow={7}
          {...form.getInputProps('color')}
        />
        <IconField
          value={icon}
          onChange={setIcon}
          currentUrl={client?.iconUrl ?? null}
          contain
          name={form.values.name}
          color={form.values.color || null}
          error={form.errors.icon as string | undefined}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={pending}>
            {client ? 'Enregistrer' : 'Créer le client'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
