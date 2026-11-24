import { sumOf } from '@ordo/shared';
import { IconAction } from '../../../components/actions/IconAction';
import { StateButton } from '../../../components/data-table/cells/StateButton';
import { RemoveButton } from '../../../components/actions/RemoveButton';
import { countOf, plural } from '../../../lib/text';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { Group, Text } from '@mantine/core';
import { ActionsMenu } from '../../../components/actions/ActionsMenu';
import { EnvelopeOpenIcon, EnvelopeSimpleIcon, FlagIcon, FolderSimpleIcon, GearIcon, ProhibitIcon, TrayIcon, XIcon } from '@phosphor-icons/react';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useMailActions, useMailFolders, useMailLabels } from '../api';
import type { MailGroup } from '../lib/mail-groups';
import { unarchived } from '../../../lib/archive';
import { MAIL_DONE_STATES, movedMailsMessage } from '../lib/mail-format';

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
 * Organizing actions on one or several mails, possibly from several folders and accounts: done / to do (a state button), flags,
 * spam (or not spam when they are all in the junk folder), move to another folder (mails of one account, unless
 * noMove).
 * @param {MailOrganizeActionsProps} props Component props.
 * @returns {JSX.Element} Actions.
 */
export function MailOrganizeActions({ groups, done, labelIds, onMoved, onManageLabels, noMove }: MailOrganizeActionsProps) {
  const { mark, spam, move } = useMailActions();
  // An archived flag is not put on mails anymore (it can still be taken off).
  const { data: allLabels } = useMailLabels();
  const labels = unarchived(allLabels ?? [], labelIds);
  const accountIds = [...new Set(groups.map((group) => group.accountId))];
  // Moving needs the folders of a single account.
  const oneAccount = accountIds.length === 1 ? accountIds[0] : null;
  const { data: folders } = useMailFolders(oneAccount);
  const junkPath = folders?.find((item) => item.specialUse === '\\Junk')?.path;
  const junk = oneAccount !== null && junkPath !== undefined && groups.every((group) => group.folder === junkPath);
  const count = sumOf(groups, (group) => group.uids.length);

  /**
   * Runs an action on every group.
   * @param {(group: MailGroup) => Promise<unknown>} action Action.
   * @returns {Promise<void>}
   */
  const each = (action: (group: MailGroup) => Promise<unknown>) => Promise.all(groups.map(action)).then(() => undefined);

  return (
    <Group gap={4} wrap="nowrap">
      <StateButton
        {...MAIL_DONE_STATES}
        value={done}
        size="md"
        onChange={(checked) => void each((group) => mark.mutateAsync({ ...group, done: checked })).catch(onMutationError)}
      />
      <ActionsMenu
        keepOpen
        target={
          <IconAction label="Drapeaux">
            <FlagIcon aria-hidden />
          </IconAction>
        }
        items={[
          ...labels.map((label) => {
            const on = labelIds.includes(label.id);
            return {
              label: label.label,
              icon: <ItemAvatar name={label.label} iconUrl={label.iconUrl} color={label.color} />,
              checked: on,
              onClick: () => void each((group) => mark.mutateAsync({ ...group, labelId: label.id, on: !on })).catch(onMutationError),
            };
          }),
          'divider',
          { label: 'Gérer les drapeaux…', icon: <GearIcon aria-hidden />, onClick: onManageLabels },
        ]}
      />
      <IconAction
        label={junk ? 'Pas un spam' : 'Signaler comme spam'}
        hint={junk ? 'Pas un spam (retour en réception)' : undefined}
        color={junk ? 'gray' : 'orange'}
        loading={spam.isPending}
        onClick={() =>
          void each((group) => spam.mutateAsync({ ...group, spam: !junk }))
            .then(() => {
              notifySuccess(junk ? `${plural(count, 'Mail remis', 'Mails remis')} en réception.` : `${plural(count, 'Mail signalé', 'Mails signalés')} comme spam.`);
              onMoved?.();
            })
            .catch(onMutationError)
        }
      >
        {junk ? <TrayIcon aria-hidden /> : <ProhibitIcon aria-hidden />}
      </IconAction>
      {oneAccount && !noMove && (
        <ActionsMenu
          maxHeight={360}
          target={
            <IconAction label="Déplacer vers…" aria-label="Déplacer vers un dossier">
              <FolderSimpleIcon aria-hidden />
            </IconAction>
          }
          items={(folders ?? [])
            .filter((item) => !(groups.length === 1 && item.path === groups[0].folder))
            .map((item) => ({
              label: item.name,
              indent: item.depth,
              onClick: () =>
                void each((group) => (group.folder === item.path ? Promise.resolve() : move.mutateAsync({ ...group, target: item.path })))
                  .then(() => {
                    notifySuccess(movedMailsMessage(count, item.name));
                    onMoved?.();
                  })
                  .catch(onMutationError),
            }))}
        />
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
  const count = sumOf(groups, (group) => group.uids.length);

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
          {countOf(count, 'mail')} {plural(count, 'sera placé', 'seront placés')} dans la corbeille de leur boîte ({plural(count, 'supprimé')} définitivement s’ils y sont déjà). Leurs copies
          rattachées à des projets sont conservées.
        </>
      ),
      run: () => Promise.all(targets.map((group) => remove.mutateAsync(group))).then(onGone),
      done: plural(count, 'Mail supprimé.', 'Mails supprimés.'),
    });
  };

  return (
    <Group gap={4} wrap="nowrap" style={{ flex: 1 }} justify="flex-end">
      <Text size="xs" c="dimmed" mr="auto">
        {countOf(count, 'sélectionné')}
      </Text>
      <MailOrganizeActions groups={groups} done={done} labelIds={labelIds} onMoved={onGone} onManageLabels={onManageLabels} noMove={noMove} />
      <IconAction label="Marquer comme lu" onClick={() => void Promise.all(groups.map((group) => setSeen.mutateAsync({ ...group, seen: true }))).catch(onMutationError)}>
        <EnvelopeOpenIcon aria-hidden />
      </IconAction>
      <IconAction label="Marquer comme non lu" onClick={() => void Promise.all(groups.map((group) => setSeen.mutateAsync({ ...group, seen: false }))).catch(onMutationError)}>
        <EnvelopeSimpleIcon aria-hidden />
      </IconAction>
      <RemoveButton label="Supprimer" aria-label="Supprimer les mails sélectionnés" onClick={confirmDelete} />
      <IconAction label="Désélectionner" onClick={onClear}>
        <XIcon aria-hidden />
      </IconAction>
    </Group>
  );
}
