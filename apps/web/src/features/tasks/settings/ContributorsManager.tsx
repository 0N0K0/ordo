import { ActionIcon, Avatar, Button, Group, Paper, Stack, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { contributorFormSchema, suggestHandle, type ContributorFormValues } from '@ordo/shared';
import { PencilSimpleIcon, PlusIcon, TrashIcon, UsersIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { showFormError, useAppForm } from '../../../lib/form';
import { notifyError, notifySuccess } from '../../../lib/notify';
import { DestructiveActions } from '../../workspace/DeleteDialogs';
import { IconField, type IconValue } from '../../workspace/IconField';
import { useContributorMutations, type Contributor } from '../api';

interface ContributorFormProps {
  contributor?: Contributor;
  onDone: () => void;
}

/**
 * Contributor creation / edition form (name, mention handle, avatar), displayed in a modal.
 * @param {ContributorFormProps} props Component props.
 * @param {Contributor} [props.contributor] Contributor to edit. Optional.
 * @param {() => void} props.onDone Called after saving or cancelling.
 * @returns {JSX.Element} Form.
 */
function ContributorForm({ contributor, onDone }: ContributorFormProps) {
  const { create, update } = useContributorMutations();
  const [avatar, setAvatar] = useState<IconValue>({ file: null, remove: false });
  // The handle follows the name until it is edited by hand.
  const [handleTouched, setHandleTouched] = useState(Boolean(contributor));
  const form = useAppForm<ContributorFormValues>({
    initialValues: { name: contributor?.name ?? '', handle: contributor?.handle ?? '' },
    schema: contributorFormSchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    const callbacks = {
      onSuccess: () => {
        notifySuccess(contributor ? 'Contributeur modifié.' : 'Contributeur ajouté.');
        onDone();
      },
      onError: (error: Error) => showFormError(form, error),
    };
    if (contributor) {
      update.mutate(
        { id: contributor.id, input: { ...values, avatar: avatar.file, removeAvatar: avatar.remove } },
        callbacks,
      );
    } else {
      create.mutate({ ...values, avatar: avatar.file }, callbacks);
    }
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput
          label="Nom"
          required
          data-autofocus
          {...form.getInputProps('name')}
          onChange={(event) => {
            const name = event.currentTarget.value;
            form.setFieldValue('name', name);
            if (!handleTouched) form.setFieldValue('handle', suggestHandle(name));
          }}
        />
        <TextInput
          label="Identifiant de mention"
          description="Utilisé dans le markdown : @identifiant."
          leftSection="@"
          required
          {...form.getInputProps('handle')}
          onChange={(event) => {
            setHandleTouched(true);
            form.setFieldValue('handle', event.currentTarget.value);
          }}
        />
        <IconField
          value={avatar}
          onChange={setAvatar}
          currentUrl={contributor?.avatarUrl ?? null}
          name={form.values.name}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {contributor ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

let modalCount = 0;

interface ContributorsManagerProps {
  contributors: Contributor[];
  /** Number of tasks assigned to each contributor. */
  usage: Map<string, number>;
}

/**
 * List of the contributors that tasks can be assigned to.
 * @param {ContributorsManagerProps} props Component props.
 * @returns {JSX.Element} Manager.
 */
export function ContributorsManager({ contributors, usage }: ContributorsManagerProps) {
  const { remove } = useContributorMutations();

  /**
   * Opens the contributor form.
   * @param {Contributor} [contributor] Contributor to edit. Optional.
   * @returns {void}
   */
  const openForm = (contributor?: Contributor) => {
    const modalId = `contributor-${++modalCount}`;
    modals.open({
      modalId,
      title: contributor ? 'Modifier le contributeur' : 'Nouveau contributeur',
      children: <ContributorForm contributor={contributor} onDone={() => modals.close(modalId)} />,
    });
  };

  /**
   * Asks for confirmation before deleting a contributor.
   * @param {Contributor} contributor Contributor.
   * @returns {void}
   */
  const confirmDelete = (contributor: Contributor) => {
    const used = usage.get(contributor.id) ?? 0;
    const modalId = `delete-contributor-${contributor.id}`;
    modals.open({
      modalId,
      title: 'Supprimer le contributeur',
      children: (
        <Stack gap="md">
          <Text size="sm">
            {contributor.name} sera supprimé définitivement
            {used > 0 ? ` et retiré des ${used} tâche${used > 1 ? 's' : ''} qui lui sont assignées` : ''}. Ses mentions
            @{contributor.handle} resteront dans le texte, sans lien. Cette action est irréversible.
          </Text>
          <DestructiveActions
            loading={false}
            onCancel={() => modals.close(modalId)}
            onConfirm={() => {
              modals.close(modalId);
              remove.mutate(
                { id: contributor.id },
                {
                  onSuccess: () => notifySuccess(`${contributor.name} supprimé.`),
                  onError: (error) => notifyError(error.message),
                },
              );
            }}
          />
        </Stack>
      ),
    });
  };

  return (
    <Paper withBorder p="lg" radius="md" component="section">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2} size="h4">
              Contributeurs
            </Title>
            <Text size="sm" c="dimmed">
              Personnes à qui les tâches peuvent être assignées, sur n’importe quel projet.
            </Text>
          </Stack>
          <Button leftSection={<PlusIcon aria-hidden />} onClick={() => openForm()}>
            Ajouter
          </Button>
        </Group>
        {contributors.length === 0 ? (
          <Group gap="sm">
            <ThemeIcon variant="light" color="gray" radius="xl">
              <UsersIcon aria-hidden />
            </ThemeIcon>
            <Text size="sm" c="dimmed">
              Aucun contributeur pour le moment.
            </Text>
          </Group>
        ) : (
          <Stack gap="xs">
            {contributors.map((contributor) => (
              <Group key={contributor.id} gap="sm" wrap="nowrap">
                <Avatar src={contributor.avatarUrl} name={contributor.name} color="initials" />
                <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate>
                    {contributor.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    @{contributor.handle}
                    {(usage.get(contributor.id) ?? 0) > 0 && ` · ${usage.get(contributor.id)} tâche(s)`}
                  </Text>
                </Stack>
                <Tooltip label="Modifier">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${contributor.name}`} onClick={() => openForm(contributor)}>
                    <PencilSimpleIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Supprimer">
                  <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${contributor.name}`} onClick={() => confirmDelete(contributor)}>
                    <TrashIcon aria-hidden />
                  </ActionIcon>
                </Tooltip>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
