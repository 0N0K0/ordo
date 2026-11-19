import { Select, type SelectProps } from '@mantine/core';
import { itemSelectProps } from '../../../components/items/item-look';

import { useProjectTree } from '../api';
import { clientItems } from '../lib/tree';

/**
 * Searchable select of a client of the workspace, each with its avatar (its logo, or its initials on its color): the
 * clients still active, and the one chosen even when archived.
 * @param {Omit<SelectProps, 'data'>} props Select props.
 * @returns {JSX.Element} Select.
 */
export function ClientSelect({ value, ...props }: Omit<SelectProps, 'data'>) {
  const { data: workspace } = useProjectTree();
  // Clients keep their name: offered under it as the label of the options.
  const clients = clientItems(workspace?.clients ?? []);
  return (
    // eslint-disable-next-line no-restricted-syntax -- the clients' select itself.
    <Select label="Client" searchable nothingFoundMessage="Aucun client" {...itemSelectProps(clients, value)} value={value} {...props} />
  );
}
