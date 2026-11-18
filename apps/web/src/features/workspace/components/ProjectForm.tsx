import { unarchived } from '../../../lib/archive';
import { ColorField } from '../../../components/inputs/ColorField';
import { Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { byPosition, projectFormSchema, type ProjectFormValues } from '@ordo/shared';
import { useState } from 'react';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { MAX_PROJECT_DEPTH } from '@ordo/shared';
import { descendantIds, useCreateProject, useUpdateProject, useWorkspace, type Project } from '../api';
import { IconField, type IconValue } from '../../../components/inputs/IconField';
import { CategoriesInput, StatusInput } from './labels';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { projectDepth, projectHeight, projectOptions } from '../lib/tree';

import { useActiveWorkspace } from '../../workspaces/api';
import { FormActions } from '../../../components/dialogs/FormActions';
import { dateRangeProps, formRange } from '../../../components/inputs/date-range';

interface ProjectFormProps {
  /** Project to edit; creates a new one when absent. */
  project?: Project;
  /** Client or parent preselected when creating. */
  defaults?: { clientId?: string; parentId?: string };
  /** Called after saving or cancelling; none (in the settings sidebar): no cancel, the form stays. */
  onDone?: () => void;
}

/**
 * Project creation / edition form: in a modal, or in the settings sidebar of the project page.
 * @param {ProjectFormProps} props Component props.
 * @param {Project} [props.project] Project to edit. Optional.
 * @param {{ clientId?: string, parentId?: string }} [props.defaults] Client or parent preselected on creation. Optional.
 * @param {() => void} [props.onDone] Called after saving or cancelling. Optional.
 * @returns {JSX.Element} Form.
 */
export function ProjectForm({ project, defaults, onDone }: ProjectFormProps) {
  const { data: workspace } = useWorkspace();
  // No clients in a personal workspace.
  const { perso } = useActiveWorkspace();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const [icon, setIcon] = useState<IconValue>({ file: null, remove: false });
  const form = useAppForm<ProjectFormValues>({
    initialValues: {
      title: project?.title ?? '',
      clientId: project ? project.clientId : (defaults?.clientId ?? null),
      parentId: project ? project.parentId : (defaults?.parentId ?? null),
      categoryIds: project?.categories.map((category) => category.id) ?? [],
      statusId: project?.statusId ?? null,
      description: project?.description ?? '',
      startDate: project?.startDate ?? null,
      endDate: project?.endDate ?? null,
      color: project?.color ?? '',
    },
    schema: projectFormSchema,
  });
  const period = dateRangeProps(formRange(form, 'startDate', 'endDate'));
  const pending = createProject.isPending || updateProject.isPending;
  const projects = workspace?.projects ?? [];
  const parent = projects.find((item) => item.id === form.values.parentId);

  // A parent must be active, outside the project's own sub-tree, and leave room for its levels.
  const excluded = project ? descendantIds(projects, project.id).add(project.id) : new Set<string>();
  const height = project ? projectHeight(projects, project.id) : 1;
  const parentOptions = projectOptions(
    workspace,
    unarchived(projects, project?.parentId).filter((item) => !excluded.has(item.id) && projectDepth(projects, item.id) + height <= MAX_PROJECT_DEPTH),
  );

  // Archived clients cannot receive projects, except the one the project already belongs to.
  const clientOptions = unarchived(workspace?.clients ?? [], project?.clientId)
    .sort(byPosition)
    .map((client) => ({ value: client.id, label: client.name }));

  const handleSubmit = form.onSubmit((values) => {
    const input = {
      title: values.title,
      parentId: values.parentId,
      // A sub-project inherits the client of its parent.
      clientId: values.parentId ? (parent?.clientId ?? null) : values.clientId,
      categoryIds: values.categoryIds,
      statusId: values.statusId,
      description: values.description?.trim() || null,
      startDate: values.startDate,
      endDate: values.endDate,
      color: values.color || null,
      icon: icon.file,
    };
    const callbacks = formCallbacks(form, project ? 'Projet modifié.' : 'Projet créé.', onDone && (() => onDone()));

    if (project) {
      updateProject.mutate({ id: project.id, input: { ...input, removeIcon: icon.remove } }, callbacks);
    } else {
      createProject.mutate(input, callbacks);
    }
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Stack gap="md">
        <TextInput label="Titre" required data-autofocus={onDone ? true : undefined} {...form.getInputProps('title')} />
        <SimpleGrid cols={{ base: 1, xs: perso ? 1 : 2 }} spacing="md">
          <Select label="Projet parent" placeholder="Aucun (projet racine)" {...treeSelectProps(parentOptions)} searchable clearable {...form.getInputProps('parentId')} />
          {!perso && (
            <Select
              label="Client"
              placeholder="Sans client"
              description={parent ? 'Hérité du projet parent.' : undefined}
              data={clientOptions}
              searchable
              clearable
              disabled={Boolean(parent)}
              {...form.getInputProps('clientId')}
              value={parent ? parent.clientId : form.values.clientId}
            />
          )}
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <StatusInput
            statuses={workspace?.projectStatuses ?? []}
            value={form.values.statusId}
            onChange={(value) => form.setFieldValue('statusId', value)}
            error={form.errors.statusId as string | undefined}
          />
          <ColorField placeholder="Aucune" {...form.getInputProps('color')} />
        </SimpleGrid>
        <CategoriesInput
          categories={workspace?.projectCategories ?? []}
          value={form.values.categoryIds}
          onChange={(value) => form.setFieldValue('categoryIds', value)}
          error={form.errors.categoryIds as string | undefined}
        />
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <DatePickerInput label="Début" placeholder="—" clearable {...period.start} />
          <DatePickerInput label="Fin" placeholder="—" clearable {...period.end} />
        </SimpleGrid>
        <Textarea label="Description" autosize minRows={3} maxRows={10} {...form.getInputProps('description')} />
        <IconField value={icon} onChange={setIcon} currentUrl={project?.iconUrl ?? null} name={form.values.title} color={form.values.color || null} error={form.errors.icon as string | undefined} />
        <FormActions onCancel={onDone} submitLabel={project ? 'Enregistrer' : 'Créer le projet'} loading={pending} />
      </Stack>
    </form>
  );
}
