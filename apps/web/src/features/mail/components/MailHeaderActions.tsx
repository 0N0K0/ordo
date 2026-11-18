import { Tooltip } from '@mantine/core';
import { ArrowsClockwiseIcon, PencilSimpleLineIcon } from '@phosphor-icons/react';
import { ActionButton } from '../../../components/actions/ActionButton';
import { useMailRefresh } from '../api';

/**
 * Actions of a mail list header: fetch the mails now, and write a new one.
 * @param {object} props Component props.
 * @param {() => void} props.onCompose Opens the composer.
 * @param {boolean} [props.composeDisabled] No account to write from. Optional.
 * @returns {JSX.Element} Actions.
 */
export function MailHeaderActions({ onCompose, composeDisabled = false }: { onCompose: () => void; composeDisabled?: boolean }) {
  const { refresh, fetching } = useMailRefresh();
  return (
    <>
      <Tooltip label="Relever les mails maintenant (sinon toutes les 10 minutes)">
        <ActionButton priority="secondary" icon={<ArrowsClockwiseIcon aria-hidden />} loading={fetching} onClick={refresh}>
          Relever
        </ActionButton>
      </Tooltip>
      <ActionButton icon={<PencilSimpleLineIcon aria-hidden />} disabled={composeDisabled} onClick={onCompose}>
        Nouveau mail
      </ActionButton>
    </>
  );
}
