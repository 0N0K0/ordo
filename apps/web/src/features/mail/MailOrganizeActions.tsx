import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { ActionIcon, ColorSwatch, Group, Menu, Text, Tooltip } from '@mantine/core';
import { CheckCircleIcon, CircleIcon, EnvelopeOpenIcon, EnvelopeSimpleIcon, FlagIcon, FolderSimpleIcon, GearIcon, ProhibitIcon, TrashIcon, TrayIcon, XIcon } from '@phosphor-icons/react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useMailActions, useMailFolders, useMailLabels } from './api';
import type { MailGroup } from './mail-groups';

interface MailOrganizeActionsProps {
  /** Mails, by account and folder (a search may gather several). */
  groups: MailGroup[];
  /** Done state of the mails (all of them). */
  done: boolean;
  /** Flags set on every mail. */
  labelIds: string[];
  /** Called once the mails left their folder (spam, move). */
  onMoved?: () => void;
  /** Opens the flags settings. */
  onManageLabels: () => void;
  /** No move to another folder (where the folders are not shown: the mails of a project). Optional. */
  noMove?: boolean;
}

/**
 * Organizing actions on one or several mails, possibly from several folders and accounts: done / to do, flags,
 * spam (or not spam when they are all in the junk folder), move to another folder (mails of one account, unless
 * noMove).
 * @param {MailOrganizeActionsProps} props Component props.
 * @returns {JSX.Element} Actions.
 */
export function MailOrganizeActions({ groups, done, labelIds, onMoved, onManageLabels, noMove }: MailOrganizeActionsProps) {
  const { mark, spam, move } = useMailActions();
  const { data: labels } = useMailLabels();
  const accountIds = [...new Set(groups.map((group) => group.accountId))];
  // Moving needs the folders of a single account.
  const oneAccount = accountIds.length === 1 ? accountIds[0] : null;
  const { data: folders } = useMailFolders(oneAccount);
  const junkPath = folders?.find((item) => item.specialUse === '\\Junk')?.path;
  const junk = oneAccount !== null && junkPath !== undefined && groups.every((group) => group.folder === junkPath);
  const count = groups.reduce((sum, group) => sum + group.uids.length, 0);
  const onError = (error: Error) => notifyError(error.message);

  /**
   * Runs an action on every group.
   * @param {(group: MailGroup) => Promise<unknown>} action Action.
   * @returns {Promise<void>}
   */
  const each = (action: (group: MailGroup) => Promise<unknown>) => Promise.all(groups.map(action)).then(() => undefined);

  return (
    <Group gap={4} wrap="nowrap">
      <Tooltip label={done ? 'Marquer à traiter' : 'Marquer comme traité'}>
        <ActionIcon
          variant="subtle"
          color={done ? 'green' : 'gray'}
          aria-label={done ? 'Marquer à traiter' : 'Marquer comme traité'}
          aria-pressed={done}
          loading={mark.isPending}
          onClick={() => void each((group) => mark.mutateAsync({ ...group, done: !done })).catch(onError)}
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
                onClick={() => void each((group) => mark.mutateAsync({ ...group, labelId: label.id, on: !on })).catch(onError)}
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
          loading={spam.isPending}
          onClick={() =>
            void each((group) => spam.mutateAsync({ ...group, spam: !junk }))
              .then(() => {
                notifySuccess(junk ? `${count > 1 ? 'Mails remis' : 'Mail remis'} en réception.` : `${count > 1 ? 'Mails signalés' : 'Mail signalé'} comme spam.`);
                onMoved?.();
              })
              .catch(onError)
          }
        >
          {junk ? <TrayIcon aria-hidden /> : <ProhibitIcon aria-hidden />}
        </ActionIcon>
      </Tooltip>
      {oneAccount && !noMove && (
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
              .filter((item) => !(groups.length === 1 && item.path === groups[0].folder))
              .map((item) => (
                <Menu.Item
                  key={item.path}
                  style={{ paddingLeft: `calc(var(--mantine-spacing-sm) + ${item.depth} * var(--mantine-spacing-md))` }}
                  onClick={() =>
                    void each((group) => (group.folder === item.path ? Promise.resolve() : move.mutateAsync({ ...group, target: item.path })))
                      .then(() => {
                        notifySuccess(`${count > 1 ? `${count} mails déplacés` : 'Mail déplacé'} dans « ${item.name} ».`);
                        onMoved?.();
                      })
                      .catch(onError)
                  }
                >
                  {item.name}
                </Menu.Item>
              ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );
}

interface MailSelectionBarProps {
  groups: MailGroup[];
  done: boolean;
  labelIds: string[];
  /** Called once the mails left their folder (spam, move, deletion). */
  onGone: () => void;
  onClear: () => void;
  onManageLabels: () => void;
  /** No move to another folder (the mails of a project). Optional. */
  noMove?: boolean;
}

/**
 * Actions on the mails ticked in a list (of a folder or of a search): organizing actions, read / unread,
 * deletion (after confirmation), unselect.
 * @param {MailSelectionBarProps} props Component props.
 * @returns {JSX.Element} Bar.
 */
export function MailSelectionBar({ groups, done, labelIds, onGone, onClear, onManageLabels, noMove }: MailSelectionBarProps) {
  const { setSeen, remove } = useMailActions();
  const count = groups.reduce((sum, group) => sum + group.uids.length, 0);
  const onError = (error: Error) => notifyError(error.message);

  /**
   * Asks for confirmation before deleting the mails.
   * @returns {void}
   */
  const confirmDelete = () => {
    const targets = groups.map((group) => ({ ...group, uids: [...group.uids] }));
    confirmDestructive({
      title: 'Supprimer les mails',
      risks: (
        <>
          <Text size="sm">
            {count} mail{count > 1 ? 's seront placés' : ' sera placé'} dans la corbeille de leur boîte (supprimé{count > 1 ? 's' : ''} définitivement s’ils y sont déjà). Leurs copies rattachées à des
            projets sont conservées.
          </Text>
        </>
      ),
      onConfirm: () => {
        void Promise.all(targets.map((group) => remove.mutateAsync(group)))
          .then(() => {
            notifySuccess(count > 1 ? 'Mails supprimés.' : 'Mail supprimé.');
            onGone();
          })
          .catch(onError);
      },
    });
  };

  return (
    <Group gap={4} wrap="nowrap" style={{ flex: 1 }} justify="flex-end">
      <Text size="xs" c="dimmed" mr="auto">
        {count} sélectionné{count > 1 ? 's' : ''}
      </Text>
      <MailOrganizeActions groups={groups} done={done} labelIds={labelIds} onMoved={onGone} onManageLabels={onManageLabels} noMove={noMove} />
      <Tooltip label="Marquer comme lu">
        <ActionIcon variant="subtle" color="gray" aria-label="Marquer comme lu" onClick={() => void Promise.all(groups.map((group) => setSeen.mutateAsync({ ...group, seen: true }))).catch(onError)}>
          <EnvelopeOpenIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Marquer comme non lu">
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label="Marquer comme non lu"
          onClick={() => void Promise.all(groups.map((group) => setSeen.mutateAsync({ ...group, seen: false }))).catch(onError)}
        >
          <EnvelopeSimpleIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Supprimer">
        <ActionIcon variant="subtle" color="red" aria-label="Supprimer les mails sélectionnés" onClick={confirmDelete}>
          <TrashIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Désélectionner">
        <ActionIcon variant="subtle" color="gray" aria-label="Désélectionner" onClick={onClear}>
          <XIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
