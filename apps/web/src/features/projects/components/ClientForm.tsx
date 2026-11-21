import { ColorField } from '../../../components/inputs/ColorField';
import { Fieldset, Stack, TextInput } from '@mantine/core';
import { clientFormSchema, type ClientFormValues } from '@ordo/shared';
import { useAppForm, formCallbacks, useFieldSave } from '../../../lib/form';
import { useCreateClient, useProjectTree, useUpdateClient, type Client } from '../api';
import { IconField } from '../../../components/inputs/IconField';
import { formIconProps } from '../../../components/inputs/icon-field';
import { SaveStatus } from '../../../components/feedback/SaveStatus';

import { FormActions } from '../../../components/dialogs/FormActions';

interface ClientFormProps {
  /** Client to edit; creates a new one when absent. */
  client?: Client;
  /** Called after creating or cancelling; none (in the settings sidebar): no cancel, the form stays. */
  onDone?: () => void;
}

/** Values of the client form: its fields, and the icon chosen or removed (a file sent with the values). */
type ClientValues = ClientFormValues & { icon: File | null; removeIcon: boolean };

/**
 * Values of the form of a client (or of a new one).
 * @param {Client} [client] Client. Optional.
 * @returns {ClientValues} Values.
 */
function clientValues(client?: Client): ClientValues {
  return { name: client?.name ?? '', color: client?.color ?? '', icon: null, removeIcon: false };
}

/**
 * Client form: a new client, created by its button; an existing one (its panel, the settings sidebar of its page),
 * saved field by field, read only once archived.
 * @param {ClientFormProps} props Component props.
 * @param {Client} [props.client] Client to edit. Optional.
 * @param {() => void} [props.onDone] Called after creating or cancelling. Optional.
 * @returns {JSX.Element} Form.
 */
export function ClientForm({ client, onDone }: ClientFormProps) {
  const { data: workspace } = useProjectTree();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const current = client && (workspace?.clients.find((item) => item.id === client.id) ?? client);
  const readOnly = Boolean(current?.archived);
  const base = useAppForm<ClientValues>({ initialValues: clientValues(client), schema: clientFormSchema });
  const { form, saving, commitProps } = useFieldSave(base, {
    // Only the fields changed: the icon is not sent again.
    save: client ? (changes) => updateClient.mutateAsync({ id: client.id, input: { ...changes, color: changes.color === undefined ? undefined : changes.color || null } }) : null,
    schema: clientFormSchema,
    saved: current && clientValues(current),
    onBlur: ['name', 'color'],
    readOnly,
  });

  // A new client only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit((values) => {
    createClient.mutate({ name: values.name, color: values.color || null, icon: values.icon }, formCallbacks(form, 'Client créé.', onDone && (() => onDone())));
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
        <Stack gap="md">
          {client && !readOnly && <SaveStatus saving={saving} />}
          <TextInput label="Nom" required data-autofocus={onDone ? true : undefined} {...form.getInputProps('name')} />
          <ColorField placeholder="Aucune" {...commitProps('color')} />
          <IconField
            {...formIconProps(form, 'icon', 'removeIcon')}
            currentUrl={current?.iconUrl ?? null}
            contain
            name={form.values.name}
            color={form.values.color || null}
            error={form.errors.icon as string | undefined}
          />
          {!client && <FormActions onCancel={onDone} submitLabel="Créer le client" loading={createClient.isPending} />}
        </Stack>
      </Fieldset>
    </form>
  );
}
