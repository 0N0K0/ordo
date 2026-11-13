import { Button, Group, Stack, TextInput } from '@mantine/core';
import { contributorFormSchema, suggestHandle, type ContributorFormValues } from '@ordo/shared';
import { useState } from 'react';
import { showFormError, useAppForm } from '../../../lib/form';
import { notifySuccess } from '../../../lib/notify';
import { useWorkspace } from '../../workspace/api';
import { IconField, type IconValue } from '../../workspace/IconField';
import { treeSelectProps } from '../../../components/tree-select/tree-select';
import { projectOptions } from '../../workspace/tree';
import { useContributorMutations, type Contributor } from '../api';
import { BatchMultiSelect } from '../../../components/BatchMultiSelect';

interface ContributorFormProps {
  contributor?: Contributor;
  /** Projects of a new contributor. */
  defaultProjectIds?: string[];
  onDone: () => void;
}

/**
 * Contributor creation / edition form (name, mention handle, avatar, projects), displayed in a modal.
 * @param {ContributorFormProps} props Component props.
 * @param {Contributor} [props.contributor] Contributor to edit. Optional.
 * @param {string[]} [props.defaultProjectIds] Projects of a new contributor. Optional.
 * @param {() => void} props.onDone Called after saving or cancelling.
 * @returns {JSX.Element} Form.
 */
export function ContributorForm({ contributor, defaultProjectIds = [], onDone }: ContributorFormProps) {
  const { create, update } = useContributorMutations();
  const { data: workspace } = useWorkspace();
  const [projectIds, setProjectIds] = useState(contributor?.projectIds ?? defaultProjectIds);
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
      update.mutate({ id: contributor.id, input: { ...values, avatar: avatar.file, removeAvatar: avatar.remove, projectIds } }, callbacks);
    } else {
      create.mutate({ ...values, avatar: avatar.file, projectIds }, callbacks);
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
        <IconField value={avatar} onChange={setAvatar} currentUrl={contributor?.avatarUrl ?? null} name={form.values.name} />
        {/* The app user belongs to every project. */}
        {!contributor?.isMe && (
          <BatchMultiSelect
            label="Projets"
            description="Le contributeur est aussi rattaché à leurs sous-projets."
            placeholder={projectIds.length ? undefined : 'Aucun'}
            {...treeSelectProps(
              projectOptions(
                workspace,
                (workspace?.projects ?? []).filter((project) => !project.archived || projectIds.includes(project.id)),
              ),
            )}
            value={projectIds}
            onChange={setProjectIds}
            searchable
            clearable
            nothingFoundMessage="Aucun projet"
          />
        )}
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
