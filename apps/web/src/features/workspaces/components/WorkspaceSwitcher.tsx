import { openFormPanel } from '../../../components/panels/panels';
import { UnstyledButton } from '@mantine/core';
import { ActionButton } from '../../../components/actions/ActionButton';
import { GearSixIcon } from '@phosphor-icons/react';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { useActiveWorkspace, useWorkspaces } from '../api';
import { switchWorkspace } from '../lib/switch';
import { WorkspaceKindIcon } from './WorkspaceKindIcon';
import { WorkspacesManager } from './WorkspacesManager';
import classes from './WorkspaceSwitcher.module.css';

/**
 * Opens the management of the workspaces.
 * @returns {void}
 */
function openWorkspacesManager(): void {
  openFormPanel('Espaces', () => <WorkspacesManager />, 'lg');
}

/**
 * Switcher of the top bar, like the other menus of the bar (on hover, or a click by touch or keyboard): the
 * workspace shown, the others to open one, and their management. A button on a phone; from the tablet on, the
 * name of the workspace as plain text, before the name of the page.
 * @param {{ variant?: 'button' | 'text' }} props Component props.
 * @param {'button' | 'text'} [props.variant='button'] Look of the target. Optional. Default = button.
 * @returns {JSX.Element} Switcher.
 */
export function WorkspaceSwitcher({ variant = 'button' }: { variant?: 'button' | 'text' }) {
  const { data } = useWorkspaces();
  const { workspace } = useActiveWorkspace();
  const label = `Espace : ${workspace?.label ?? ''}. Changer d’espace`;
  return (
    <ActionsMenu
      about="l’espace"
      hover
      position="bottom-start"
      items={[
        { section: 'Espaces' },
        ...(data?.workspaces ?? []).map((item) => ({
          label: item.label,
          icon: <WorkspaceKindIcon kind={item.kind} />,
          checked: item.id === workspace?.id,
          onClick: () => item.id !== workspace?.id && switchWorkspace(item.id),
        })),
        'divider',
        { label: 'Gérer les espaces…', icon: <GearSixIcon aria-hidden />, onClick: openWorkspacesManager },
      ]}
      target={
        variant === 'text' ? (
          <UnstyledButton className={classes.text} aria-label={label}>
            {workspace?.label ?? 'Espace'}
          </UnstyledButton>
        ) : (
          <ActionButton priority="tertiary" icon={workspace && <WorkspaceKindIcon kind={workspace.kind} />} aria-label={label} maw={220}>
            {workspace?.label ?? 'Espace'}
          </ActionButton>
        )
      }
    />
  );
}
