import { Button, Menu } from '@mantine/core';
import { modals } from '@mantine/modals';
import { CaretDownIcon, CheckIcon, GearSixIcon } from '@phosphor-icons/react';
import { useActiveWorkspace, useWorkspaces } from './api';
import { switchWorkspace } from './switch';
import { WorkspaceKindIcon } from './WorkspaceKindIcon';
import { WorkspacesManager } from './WorkspacesManager';

/**
 * Opens the management of the workspaces.
 * @returns {void}
 */
function openWorkspacesManager(): void {
  modals.open({ title: 'Espaces', size: 'xl', children: <WorkspacesManager /> });
}

/**
 * Switcher of the top bar, like the other menus of the bar (on hover, or a click by touch or keyboard): the
 * workspace shown, the others to open one, and their management.
 * @returns {JSX.Element} Switcher.
 */
export function WorkspaceSwitcher() {
  const { data } = useWorkspaces();
  const { workspace } = useActiveWorkspace();
  return (
    <Menu trigger="click-hover" openDelay={60} closeDelay={150} position="bottom-start" shadow="md" withinPortal>
      <Menu.Target>
        <Button
          variant="subtle"
          size="xs"
          leftSection={workspace && <WorkspaceKindIcon kind={workspace.kind} />}
          rightSection={<CaretDownIcon aria-hidden size={12} />}
          aria-label={`Espace : ${workspace?.name ?? ''}. Changer d’espace`}
          aria-haspopup="menu"
          maw={220}
        >
          {workspace?.name ?? 'Espace'}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Espaces</Menu.Label>
        {(data?.workspaces ?? []).map((item) => (
          <Menu.Item
            key={item.id}
            leftSection={<WorkspaceKindIcon kind={item.kind} />}
            rightSection={item.id === workspace?.id ? <CheckIcon aria-hidden /> : null}
            onClick={() => item.id !== workspace?.id && switchWorkspace(item.id)}
          >
            {item.name}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item leftSection={<GearSixIcon aria-hidden />} onClick={openWorkspacesManager}>
          Gérer les espaces…
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
