import { Select, type SelectProps } from '@mantine/core';
import { listSelectProps } from '../../../components/items/item-look';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { useWorkspace } from '../api';

/**
 * Searchable select of a client of the workspace, each with its avatar (its logo, or its initials on its color): the
 * clients still active, and the one chosen even when archived.
 * @param {Omit<SelectProps, 'data'>} props Select props.
 * @returns {JSX.Element} Select.
 */
export function ClientSelect({ value, ...props }: Omit<SelectProps, 'data'>) {
  const { data: workspace } = useWorkspace();
  // Clients keep their name: offered under it as the label of the options.
  const clients = (workspace?.clients ?? []).map((client) => ({ ...client, label: client.name }));
  const current = clients.find((client) => client.id === value);
  return (
    // eslint-disable-next-line no-restricted-syntax -- the clients' select itself.
    <Select
      label="Client"
      searchable
      nothingFoundMessage="Aucun client"
      {...listSelectProps(clients, undefined, value)}
      leftSection={current ? <ItemAvatar name={current.name} iconUrl={current.iconUrl} color={current.color} /> : undefined}
      value={value}
      {...props}
    />
  );
}
