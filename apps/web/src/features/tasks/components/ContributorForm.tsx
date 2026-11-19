import { unarchived } from '../../../lib/archive';
import { Stack, TextInput } from '@mantine/core';
import { contributorFormSchema, suggestHandle, type ContributorFormValues } from '@ordo/shared';
import { useState } from 'react';
import { useAppForm, formCallbacks } from '../../../lib/form';

import { useProjectTree } from '../../projects/api';
import { IconField, type IconValue } from '../../../components/inputs/IconField';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { projectOptions } from '../../projects/lib/tree';
import { useContributorMutations, type Contributor } from '../api';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { FormActions } from '../../../components/dialogs/FormActions';

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
  const { data: workspace } = useProjectTree();
  const [projectIds, setProjectIds] = useState(contributor?.projectIds ?? defaultProjectIds);
  const [avatar, setAvatar] = useState<IconValue>({ file: null, remove: false });
  // The handle follows the name until it is edited by hand.
  const [handleTouched, setHandleTouched] = useState(Boolean(contributor));
  const form = useAppForm<ContributorFormValues>({
    initialValues: { name: contributor?.name ?? '', handle: contributor?.handle ?? '' },
    schema: contributorFormSchema,
  });

  const handleSubmit = form.onSubmit((values) => {
    const callbacks = formCallbacks(form, contributor ? 'Contributeur modifié.' : 'Contributeur ajouté.', onDone);
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
            {...treeSelectProps(projectOptions(workspace, unarchived(workspace?.projects ?? [], projectIds)))}
            value={projectIds}
            onChange={setProjectIds}
            searchable
            clearable
            nothingFoundMessage="Aucun projet"
          />
        )}
        <FormActions onCancel={onDone} submitLabel={contributor ? 'Enregistrer' : 'Ajouter'} loading={create.isPending || update.isPending} />
      </Stack>
    </form>
  );
}
