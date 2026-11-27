import { moveEntries } from '../../../components/actions/move-entries';
import { SectionHeader } from '../../../components/page/SectionHeader';
import { InlineActions } from '../../../components/actions/ActionsMenu';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';
import { Anchor, FileButton, Group, Paper, Stack, Text, Textarea, TextInput, ThemeIcon } from '@mantine/core';
import { FigmaLogoIcon, FileIcon, GithubLogoIcon, GitlabLogoIcon, LinkIcon, PaperclipIcon, PencilSimpleIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { type ReactNode } from 'react';
import { ON_ERROR, toastCallbacks } from '../../../lib/notify';
import { formCallbacks, useAppForm, useFieldSave } from '../../../lib/form';
import { SaveStatus } from '../../../components/feedback/SaveStatus';
import { useProjectResourceMutations, useProjectResources, type ProjectResource } from '../api/documents';
import { FileLink } from '../../files/components/FileLink';
import { FormActions } from '../../../components/dialogs/FormActions';
import * as fmt from '../../../lib/format';
import { projectLinkSchema } from '@ordo/shared';
import { EXTERNAL_LINK } from '../../../components/actions/link-props';
import { LabelField } from '../../../components/inputs/LabelField';

/**
 * Icon of a link, from its site.
 * @param {string} url Address.
 * @returns {ReactNode} Icon.
 */
function linkIcon(url: string): ReactNode {
  if (/figma\.com/i.test(url)) return <FigmaLogoIcon aria-hidden />;
  if (/github\.com/i.test(url)) return <GithubLogoIcon aria-hidden />;
  if (/gitlab\./i.test(url)) return <GitlabLogoIcon aria-hidden />;
  return <LinkIcon aria-hidden />;
}

/**
 * Values of the form of a link or a file, as it is (a new link: empty).
 * @param {ProjectResource} [resource] Resource, as the cache holds it. Optional.
 * @returns {{ label: string, url: string, note: string }} Values.
 */
const resourceValues = (resource?: ProjectResource) => ({ label: resource?.label ?? '', url: resource?.kind === 'LINK' ? (resource.url ?? '') : '', note: resource?.note ?? '' });

/**
 * Link form: label, address (links only) and note. A new link is a form with « Ajouter »; an existing resource, its
 * panel, saves each field on leaving it (`useFieldSave`), the one of the cache followed.
 * @param {{ projectId: string, resource?: ProjectResource, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function ResourceForm({ projectId, resource, onDone }: { projectId: string; resource?: ProjectResource; onDone: () => void }) {
  const { addLink, update } = useProjectResourceMutations();
  const { data: resources } = useProjectResources(projectId);
  const isLink = !resource || resource.kind === 'LINK';
  // A file has no address.
  const schema = isLink ? projectLinkSchema : projectLinkSchema.omit({ url: true });
  const base = useAppForm({ initialValues: resourceValues(resource), schema });
  const current = resource && (resources?.find((item) => item.id === resource.id) ?? resource);
  const { form, saving } = useFieldSave(base, {
    save: resource ? (_changes, { label, url, note }) => update.mutateAsync({ id: resource.id, label, url: isLink ? url : null, note }) : null,
    schema,
    saved: current && resourceValues(current),
    onBlur: ['label', 'url', 'note'],
  });
  return (
    <form
      noValidate
      // A new link only: an existing resource is saved field by field (Enter saves the text typed).
      onSubmit={form.onSubmit(({ label, url, note }) => addLink.mutate({ projectId, label, url, note }, formCallbacks(form, 'Lien ajouté.', onDone)))}
    >
      <Stack gap="md">
        {resource && <SaveStatus saving={saving} />}
        <LabelField data-autofocus={resource ? undefined : true} placeholder="Maquettes Figma, dépôt GitHub…" {...form.getInputProps('label')} />
        {isLink && <TextInput label="Adresse" required placeholder="https://…" {...form.getInputProps('url')} />}
        <Textarea label="Note" autosize minRows={2} {...form.getInputProps('note')} />
        {!resource && <FormActions onCancel={onDone} submitLabel="Ajouter" loading={addLink.isPending} />}
      </Stack>
    </form>
  );
}

/**
 * Resources tab of a project: files (specifications, briefs, assets…) and links (mock-ups, repositories…).
 * @param {{ projectId: string }} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function ProjectResourcesPanel({ projectId }: { projectId: string }) {
  const { data: resources, isPending } = useProjectResources(projectId);
  const { addFiles, remove, move } = useProjectResourceMutations();

  /**
   * Opens the link form.
   * @param {ProjectResource} [resource] Resource edited. Optional.
   * @returns {void}
   */
  const openForm = (resource?: ProjectResource) => {
    openFormPanel(resource ? 'Modifier' : 'Ajouter un lien', (close) => <ResourceForm projectId={projectId} resource={resource} onDone={close} />);
  };

  /**
   * Asks for confirmation before removing a resource.
   * @param {ProjectResource} resource Resource.
   * @returns {void}
   */
  const confirmDelete = (resource: ProjectResource) => {
    confirmDestructive({
      title: resource.kind === 'FILE' ? 'Supprimer le fichier' : 'Retirer le lien',
      risks: <>{resource.kind === 'FILE' ? `Le fichier « ${resource.label} » sera supprimé définitivement d’Ordo.` : `Le lien « ${resource.label} » sera retiré du projet.`}</>,
      run: () => remove.mutateAsync(resource.id),
      done: 'Ressource supprimée.',
    });
  };

  return (
    <Stack gap="md">
      <SectionHeader
        description="Documents et liens utiles au projet : cahier des charges, maquettes, dépôt de code…"
        actions={
          <>
            <FileButton multiple onChange={(files) => files.length && addFiles.mutate({ projectId, files }, toastCallbacks('Fichiers ajoutés.'))}>
              {(props) => (
                <ActionButton icon={<UploadSimpleIcon aria-hidden />} loading={addFiles.isPending} {...props}>
                  Ajouter des fichiers
                </ActionButton>
              )}
            </FileButton>
            <ActionButton priority="secondary" icon={<LinkIcon aria-hidden />} onClick={() => openForm()}>
              Ajouter un lien
            </ActionButton>
          </>
        }
      />
      {isPending ? (
        <ListSkeleton items={3} />
      ) : !resources?.length ? (
        <EmptyState icon={<PaperclipIcon aria-hidden />} message="Aucun document ni lien." />
      ) : (
        <Paper withBorder radius="md" p="xs">
          <Stack gap={4}>
            {resources.map((resource, index) => (
              <Group key={resource.id} justify="space-between" wrap="nowrap" px="xs" py={4}>
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <ThemeIcon variant="light" color={resource.kind === 'FILE' ? 'gray' : 'blue'}>
                    {resource.kind === 'FILE' ? <FileIcon aria-hidden /> : linkIcon(resource.url)}
                  </ThemeIcon>
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    {resource.kind === 'FILE' ? (
                      <FileLink url={resource.url} filename={resource.label} fw={600} size="sm" truncate>
                        {resource.label}
                      </FileLink>
                    ) : (
                      <Anchor href={resource.url} {...EXTERNAL_LINK} fw={600} size="sm" truncate>
                        {resource.label}
                      </Anchor>
                    )}
                    <Text size="xs" c="dimmed" truncate>
                      {resource.note ?? (resource.kind === 'LINK' ? resource.url : resource.size ? fmt.fileSize(resource.size) : '')}
                    </Text>
                  </Stack>
                </Group>
                <InlineActions
                  name={resource.label}
                  items={[
                    ...moveEntries(index, resources.length, (to) => move.mutate({ id: resource.id, index: to }, ON_ERROR)),
                    { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openForm(resource) },
                    { label: 'Supprimer', icon: <TrashIcon aria-hidden />, danger: true, onClick: () => confirmDelete(resource) },
                  ]}
                />
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
