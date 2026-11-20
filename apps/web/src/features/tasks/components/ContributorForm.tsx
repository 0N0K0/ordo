import { unarchived } from '../../../lib/archive';
import { Fieldset, Stack, TextInput } from '@mantine/core';
import { contributorFormSchema, suggestHandle, type ContributorFormValues } from '@ordo/shared';
import { useState } from 'react';
import { useAppForm, formCallbacks, useFieldSave } from '../../../lib/form';

import { useProjectTree } from '../../projects/api';
import { IconField } from '../../../components/inputs/IconField';
import { formIconProps } from '../../../components/inputs/icon-field';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { projectOptions } from '../../projects/lib/tree';
import { useContributorMutations, type Contributor } from '../api';
import { useTaskContext } from '../hooks/use-task-context';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { FormActions } from '../../../components/dialogs/FormActions';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { PersonDetailsFields } from '../../../components/people/PersonDetailsFields';
import { NO_PERSON_DETAILS_VALUES, PERSON_DETAILS_ON_BLUR, personDetailsProps, personDetailsValues } from '../../../components/people/person-details';

interface ContributorFormProps {
  contributor?: Contributor;
  /** Projects of a new contributor. */
  defaultProjectIds?: string[];
  onDone: () => void;
}

/** Values of the contributor form: its fields, its projects, and the avatar chosen or removed (a file sent with the values). */
type ContributorValues = ContributorFormValues & { projectIds: string[]; avatar: File | null; removeAvatar: boolean };

/**
 * Values of the form of a contributor (or of a new one, with its projects).
 * @param {Contributor} [contributor] Contributor. Optional.
 * @param {string[]} [defaultProjectIds] Projects of a new contributor. Optional.
 * @returns {ContributorValues} Values.
 */
function contributorValues(contributor?: Contributor, defaultProjectIds: string[] = []): ContributorValues {
  return {
    name: contributor?.name ?? '',
    handle: contributor?.handle ?? '',
    ...(contributor ? personDetailsValues(contributor) : NO_PERSON_DETAILS_VALUES),
    projectIds: contributor?.projectIds ?? defaultProjectIds,
    avatar: null,
    removeAvatar: false,
  };
}

/**
 * Contributor form (name, mention handle, avatar, projects, and its details: birth date, birthday reminders, email,
 * phones, lot 16), in the side panel: a new contributor, added by its button;
 * an existing one, saved field by field (decision D22), read only once archived.
 * @param {ContributorFormProps} props Component props.
 * @param {Contributor} [props.contributor] Contributor to edit. Optional.
 * @param {string[]} [props.defaultProjectIds] Projects of a new contributor. Optional.
 * @param {() => void} props.onDone Called after adding or cancelling.
 * @returns {JSX.Element} Form.
 */
export function ContributorForm({ contributor, defaultProjectIds = [], onDone }: ContributorFormProps) {
  const { create, update } = useContributorMutations();
  const { data: workspace } = useProjectTree();
  const { context } = useTaskContext();
  const current = contributor && (context?.contributors.find((item) => item.id === contributor.id) ?? contributor);
  const readOnly = Boolean(current?.archived);
  // The handle follows the name until it is edited by hand.
  const [handleTouched, setHandleTouched] = useState(Boolean(contributor));
  const base = useAppForm<ContributorValues>({ initialValues: contributorValues(contributor, defaultProjectIds), schema: contributorFormSchema });
  const { form, saving, fieldProps } = useFieldSave(base, {
    // Only the fields changed: the avatar is not sent again.
    save: contributor ? (changes) => update.mutateAsync({ id: contributor.id, input: changes }) : null,
    schema: contributorFormSchema,
    saved: current && contributorValues(current),
    onBlur: ['name', 'handle', ...PERSON_DETAILS_ON_BLUR],
    readOnly,
  });

  // A new contributor only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit(({ name, handle, avatar, projectIds, birthDate, birthdayReminders, email, phones }) =>
    create.mutate({ name, handle, avatar, projectIds, birthDate, birthdayReminders, email, phones }, formCallbacks(form, 'Contributeur ajouté.', onDone)),
  );

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
        <Stack gap="md">
          {contributor && !readOnly && <SaveStatus saving={saving} />}
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
          <IconField {...formIconProps(form, 'avatar', 'removeAvatar')} currentUrl={current?.avatarUrl ?? null} name={form.values.name} />
          <PersonDetailsFields {...personDetailsProps(form, fieldProps)} />
          {/* The app user belongs to every project. */}
          {!contributor?.isMe && (
            <BatchMultiSelect
              label="Projets"
              description="Le contributeur est aussi rattaché à leurs sous-projets."
              placeholder={form.values.projectIds.length ? undefined : 'Aucun'}
              {...treeSelectProps(projectOptions(workspace, unarchived(workspace?.projects ?? [], form.values.projectIds)))}
              value={form.values.projectIds}
              onChange={(projectIds) => form.setFieldValue('projectIds', projectIds)}
              searchable
              clearable
              nothingFoundMessage="Aucun projet"
            />
          )}
          {!contributor && <FormActions onCancel={onDone} submitLabel="Ajouter" loading={create.isPending} />}
        </Stack>
      </Fieldset>
    </form>
  );
}
