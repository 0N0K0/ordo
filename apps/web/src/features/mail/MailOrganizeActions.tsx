import { ActionIcon, ColorSwatch, Group, Menu, Tooltip } from '@mantine/core';
import { CheckCircleIcon, CircleIcon, FlagIcon, FolderSimpleIcon, GearIcon, ProhibitIcon, TrayIcon } from '@phosphor-icons/react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useMailActions, useMailFolders, useMailLabels } from './api';

interface MailOrganizeActionsProps {
  accountId: string;
  folder: string;
  uids: number[];
  /** Done state of the mails (all of them). */
  done: boolean;
  /** Flags set on every mail. */
  labelIds: string[];
  /** Called once the mails left the folder (spam, move). */
  onMoved?: () => void;
  /** Opens the flags settings. */
  onManageLabels: () => void;
}

/**
 * Organizing actions on one or several mails: done / to do, flags, spam (or not spam in the junk folder), move
 * to another folder of the account.
 * @param {MailOrganizeActionsProps} props Component props.
 * @returns {JSX.Element} Actions.
 */
export function MailOrganizeActions({ accountId, folder, uids, done, labelIds, onMoved, onManageLabels }: MailOrganizeActionsProps) {
  const { mark, spam, move } = useMailActions();
  const { data: labels } = useMailLabels();
  const { data: folders } = useMailFolders(accountId);
  const junk = folders?.find((item) => item.path === folder)?.specialUse === '\\Junk';
  const count = uids.length;
  const onError = (error: Error) => notifyError(error.message);

  return (
    <Group gap={4} wrap="nowrap">
      <Tooltip label={done ? 'Marquer à traiter' : 'Marquer comme traité'}>
        <ActionIcon
          variant="subtle"
          color={done ? 'green' : 'gray'}
          aria-label={done ? 'Marquer à traiter' : 'Marquer comme traité'}
          aria-pressed={done}
          onClick={() => mark.mutate({ accountId, folder, uids, done: !done }, { onError })}
        >
          {done ? <CheckCircleIcon weight="fill" aria-hidden /> : <CircleIcon aria-hidden />}
        </ActionIcon>
      </Tooltip>
      <Menu position="bottom-end" shadow="md" withinPortal closeOnItemClick={false}>
        <Menu.Target>
          <Tooltip label="Drapeaux">
            <ActionIcon variant="subtle" color="gray" aria-label="Drapeaux">
              <FlagIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          {(labels ?? []).map((label) => {
            const on = labelIds.includes(label.id);
            return (
              <Menu.Item
                key={label.id}
                leftSection={<ColorSwatch color={label.color} size={12} withShadow={false} />}
                rightSection={on ? <CheckCircleIcon weight="fill" aria-hidden /> : null}
                onClick={() => mark.mutate({ accountId, folder, uids, labelId: label.id, on: !on }, { onError })}
              >
                {label.name}
              </Menu.Item>
            );
          })}
          {(labels ?? []).length > 0 && <Menu.Divider />}
          <Menu.Item leftSection={<GearIcon aria-hidden />} onClick={onManageLabels}>
            Gérer les drapeaux…
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Tooltip label={junk ? 'Pas un spam (retour en réception)' : 'Signaler comme spam'}>
        <ActionIcon
          variant="subtle"
          color={junk ? 'gray' : 'orange'}
          aria-label={junk ? 'Pas un spam' : 'Signaler comme spam'}
          onClick={() =>
            spam.mutate(
              { accountId, folder, uids, spam: !junk },
              {
                onSuccess: () => {
                  notifySuccess(junk ? `${count > 1 ? 'Mails remis' : 'Mail remis'} en réception.` : `${count > 1 ? 'Mails signalés' : 'Mail signalé'} comme spam.`);
                  onMoved?.();
                },
                onError,
              },
            )
          }
        >
          {junk ? <TrayIcon aria-hidden /> : <ProhibitIcon aria-hidden />}
        </ActionIcon>
      </Tooltip>
      <Menu position="bottom-end" shadow="md" withinPortal>
        <Menu.Target>
          <Tooltip label="Déplacer vers…">
            <ActionIcon variant="subtle" color="gray" aria-label="Déplacer vers un dossier">
              <FolderSimpleIcon aria-hidden />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown mah={360} style={{ overflowY: 'auto' }}>
          {(folders ?? [])
            .filter((item) => item.path !== folder)
            .map((item) => (
              <Menu.Item
                key={item.path}
                style={{ paddingLeft: `calc(var(--mantine-spacing-sm) + ${item.depth} * var(--mantine-spacing-md))` }}
                onClick={() =>
                  move.mutate(
                    { accountId, folder, uids, target: item.path },
                    {
                      onSuccess: () => {
                        notifySuccess(`${count > 1 ? `${count} mails déplacés` : 'Mail déplacé'} dans « ${item.name} ».`);
                        onMoved?.();
                      },
                      onError,
                    },
                  )
                }
              >
                {item.name}
              </Menu.Item>
            ))}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
