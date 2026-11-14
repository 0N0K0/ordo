import { ActionButton } from '../../components/actions/ActionButton';
import { ActionsRow } from '../../components/actions/ActionsRow';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ActionIcon, ColorInput, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { DestructiveActions } from '../../components/dialogs/DestructiveActions';
import { useMailLabelMutations, useMailLabels, type MailLabel } from './api';

const SWATCHES = ['#fa5252', '#fd7e14', '#fab005', '#40c057', '#15aabf', '#228be6', '#7950f2', '#e64980', '#868e96'];

/**
 * One flag: name and color saved when left, deletion after confirmation.
 * @param {{ label: MailLabel }} props Component props.
 * @returns {JSX.Element} Row.
 */
function LabelRow({ label }: { label: MailLabel }) {
  const { update, remove } = useMailLabelMutations();
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const [confirming, setConfirming] = useState(false);

  /**
   * Saves the flag when it changed.
   * @param {{ name?: string, color?: string }} changes Changes.
   * @returns {void}
   */
  const save = (changes: { name?: string; color?: string }) => {
    const next = { name: (changes.name ?? name).trim(), color: changes.color ?? color };
    if (!next.name || (next.name === label.name && next.color === label.color)) return;
    update.mutate({ id: label.id, ...next }, { onError: (error) => notifyError(error.message) });
  };

  if (confirming) {
    return (
      <Stack gap="xs">
        <Text size="sm">Le drapeau « {label.name} » sera supprimé définitivement et retiré des mails qui l’ont.</Text>
        <DestructiveActions
          loading={remove.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() => remove.mutate(label.id, { onSuccess: () => notifySuccess('Drapeau supprimé.'), onError: (error) => notifyError(error.message) })}
        />
      </Stack>
    );
  }
  return (
    <Group gap="xs" wrap="nowrap">
      <ColorInput aria-label={`Couleur de ${label.name}`} w={130} swatches={SWATCHES} value={color} onChange={setColor} onChangeEnd={(value) => save({ color: value })} withEyeDropper={false} />
      <TextInput aria-label="Nom du drapeau" style={{ flex: 1 }} value={name} onChange={(event) => setName(event.currentTarget.value)} onBlur={() => save({ name })} maxLength={40} />
      <Tooltip label="Supprimer">
        <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${label.name}`} onClick={() => setConfirming(true)}>
          <TrashIcon aria-hidden />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

/**
 * Flags of mails: add, rename, recolor, delete. They are set on the mails as IMAP keywords (or kept in Ordo for
 * servers without keywords).
 * @returns {JSX.Element} Manager.
 */
export function MailLabelsManager() {
  const { data: labels } = useMailLabels();
  const { create } = useMailLabelMutations();
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Les drapeaux sont posés sur les mails côté serveur (mots-clés IMAP), ou gardés dans Ordo quand le serveur ne les accepte pas.
      </Text>
      {(labels ?? []).map((label) => (
        <LabelRow key={label.id} label={label} />
      ))}
      {labels?.length === 0 && <EmptyState compact message="Aucun drapeau." />}
      <ActionsRow>
        <ActionButton
          priority="secondary"
          size="xs"

          icon={<PlusIcon aria-hidden />}
          loading={create.isPending}
          onClick={() => create.mutate({ name: `Drapeau ${(labels?.length ?? 0) + 1}`, color: SWATCHES[(labels?.length ?? 0) % SWATCHES.length] }, { onError: (error) => notifyError(error.message) })}
        >
          Nouveau drapeau
        </ActionButton>
      </ActionsRow>
    </Stack>
  );
}
