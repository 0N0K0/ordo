import { unarchived } from '../../../lib/archive';
import { ColorField } from '../../../components/inputs/ColorField';
import { Fieldset, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { projectFormSchema, type ProjectFormValues, subtreeOf } from '@ordo/shared';
import { useAppForm, formCallbacks, useFieldSave } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { MAX_PROJECT_DEPTH } from '@ordo/shared';
import { useCreateProject, useUpdateProject, useProjectTree, type Project } from '../api';
import { IconField } from '../../../components/inputs/IconField';
import { formIconProps } from '../../../components/inputs/icon-field';
import { CategoriesInput, StatusInput } from './labels';
import { ClientSelect } from './ClientSelect';
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
  /** Called after creating or cancelling; none (in the settings sidebar): no cancel, the form stays. */
  onDone?: () => void;
}

/** Values of the project form: its fields, and the icon chosen or removed (a file sent with the values). */
type ProjectValues = ProjectFormValues & {
  icon: File | null;
  removeIcon: boolean;
};

/**
 * Values of the form of a project (or of a new one, with its defaults).
 * @param {Project} [project] Project. Optional.
 * @param {{ clientId?: string, parentId?: string }} [defaults] Client or parent preselected on creation. Optional.
 * @returns {ProjectValues} Values.
 */
function projectValues(project?: Project, defaults?: { clientId?: string; parentId?: string }): ProjectValues {
  return {
    label: project?.label ?? '',
    clientId: project ? project.clientId : (defaults?.clientId ?? null),
    parentId: project ? project.parentId : (defaults?.parentId ?? null),
    categoryIds: project?.categories.map((category) => category.id) ?? [],
    statusId: project?.statusId ?? null,
    description: project?.description ?? '',
    startDate: project?.startDate ?? null,
    endDate: project?.endDate ?? null,
    color: project?.color ?? '',
    icon: null,
    removeIcon: false,
  };
}

/**
 * Input of the API for the values of a project changed (the others left as they are).
 * @param {Partial<ProjectValues>} values Values changed.
 * @returns {object} Input.
 */
function projectInput(values: Partial<ProjectValues>) {
  return {
    ...values,
    description: values.description === undefined ? undefined : values.description?.trim() || null,
    color: values.color === undefined ? undefined : values.color || null,
  };
}

/**
 * Project form: a new project, created by its button; an existing one (its panel, the settings sidebar of its page),
 * saved field by field, read only once archived.
 * @param {ProjectFormProps} props Component props.
 * @param {Project} [props.project] Project to edit. Optional.
 * @param {{ clientId?: string, parentId?: string }} [props.defaults] Client or parent preselected on creation. Optional.
 * @param {() => void} [props.onDone] Called after creating or cancelling. Optional.
 * @returns {JSX.Element} Form.
 */
export function ProjectForm({ project, defaults, onDone }: ProjectFormProps) {
  const { data: workspace } = useProjectTree();
  // No clients in a personal workspace.
  const { perso } = useActiveWorkspace();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const projects = workspace?.projects ?? [];
  const current = project && (projects.find((item) => item.id === project.id) ?? project);
  const readOnly = Boolean(current?.archived);
  const base = useAppForm<ProjectValues>({
    initialValues: projectValues(project, defaults),
    schema: projectFormSchema,
  });
  const { form, saving, commitProps } = useFieldSave(base, {
    // Only the fields changed: the icon is not sent again, the client of a sub-project stays its parent's.
    save: project
      ? (changes) =>
          updateProject.mutateAsync({
            id: project.id,
            input: projectInput(changes),
          })
      : null,
    schema: projectFormSchema,
    saved: current && projectValues(current),
    onBlur: ['label', 'description', 'color'],
    readOnly,
  });
  const period = dateRangeProps(formRange(form, 'startDate', 'endDate'));
  const parent = projects.find((item) => item.id === form.values.parentId);

  // A parent must be active, outside the project's own sub-tree, and leave room for its levels.
  const excluded = project ? subtreeOf(projects, project.id) : new Set<string>();
  const height = project ? projectHeight(projects, project.id) : 1;
  const parentOptions = projectOptions(
    workspace,
    unarchived(projects, project?.parentId).filter((item) => !excluded.has(item.id) && projectDepth(projects, item.id) + height <= MAX_PROJECT_DEPTH),
  );

  // A new project only: an existing one is saved field by field (Enter saves the text typed).
  const handleSubmit = form.onSubmit((values) => {
    createProject.mutate(
      {
        label: values.label,
        parentId: values.parentId,
        // A sub-project inherits the client of its parent.
        clientId: values.parentId ? (parent?.clientId ?? null) : values.clientId,
        categoryIds: values.categoryIds,
        statusId: values.statusId,
        description: values.description?.trim() || null,
        startDate: values.startDate,
        endDate: values.endDate,
        color: values.color || null,
        icon: values.icon,
      },
      formCallbacks(form, 'Projet créé.', onDone && (() => onDone())),
    );
  });

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Fieldset variant="unstyled" disabled={readOnly} p={0} m={0}>
        <Stack gap="md">
          {project && !readOnly && <SaveStatus saving={saving} />}
          <TextInput label="Libellé" required data-autofocus={onDone ? true : undefined} {...form.getInputProps('label')} />
          <SimpleGrid cols={{ base: 1, xs: perso ? 1 : 2 }} spacing="md">
            <Select label="Projet parent" placeholder="Aucun (projet racine)" {...treeSelectProps(parentOptions)} searchable clearable {...form.getInputProps('parentId')} />
            {!perso && (
              <ClientSelect
                placeholder="Sans client"
                description={parent ? 'Hérité du projet parent.' : undefined}
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
            <ColorField placeholder="Aucune" {...commitProps('color')} />
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
          <IconField
            {...formIconProps(form, 'icon', 'removeIcon')}
            currentUrl={current?.iconUrl ?? null}
            name={form.values.label}
            color={form.values.color || null}
            error={form.errors.icon as string | undefined}
          />
          {!project && <FormActions onCancel={onDone} submitLabel="Créer le projet" loading={createProject.isPending} />}
        </Stack>
      </Fieldset>
    </form>
  );
}
