import { moveEntries } from '../../../components/actions/move-entries';
import { SectionHeader } from '../../../components/page/SectionHeader';
import { InlineActions } from '../../../components/actions/ActionsMenu';
import { ActionButton } from '../../../components/actions/ActionButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { ListSkeleton } from '../../../components/feedback/Skeletons';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';
import { openFormPanel } from '../../../components/panels/panels';
import { Anchor, FileButton, Group, Paper, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { FigmaLogoIcon, FileIcon, GithubLogoIcon, GitlabLogoIcon, LinkIcon, PaperclipIcon, PencilSimpleIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { ON_ERROR, toastCallbacks } from '../../../lib/notify';
import { formCallbacks } from '../../../lib/form';
import { useProjectResourceMutations, useProjectResources, type ProjectResource } from '../api/documents';
import { FileLink } from '../../files/components/FileLink';
import { FormActions } from '../../../components/dialogs/FormActions';
import * as fmt from '../../../lib/format';

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
 * Link form: title, address (links only) and note.
 * @param {{ projectId: string, resource?: ProjectResource, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function ResourceForm({ projectId, resource, onDone }: { projectId: string; resource?: ProjectResource; onDone: () => void }) {
  const { addLink, update } = useProjectResourceMutations();
  const [title, setTitle] = useState(resource?.title ?? '');
  const [url, setUrl] = useState(resource?.kind === 'LINK' ? resource.url : '');
  const [note, setNote] = useState(resource?.note ?? '');
  const isLink = !resource || resource.kind === 'LINK';
  const callbacks = formCallbacks(null, resource ? 'Ressource modifiée.' : 'Lien ajouté.', onDone);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (resource) update.mutate({ id: resource.id, title, url: isLink ? url : null, note }, callbacks);
        else addLink.mutate({ projectId, title, url, note }, callbacks);
      }}
    >
      <Stack gap="md">
        <TextInput label="Titre" required data-autofocus placeholder="Maquettes Figma, dépôt GitHub…" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
        {isLink && <TextInput label="Adresse" required placeholder="https://…" value={url} onChange={(event) => setUrl(event.currentTarget.value)} />}
        <TextInput label="Note" value={note} onChange={(event) => setNote(event.currentTarget.value)} />
        <FormActions onCancel={onDone} submitLabel={resource ? 'Enregistrer' : 'Ajouter'} loading={addLink.isPending || update.isPending} disabled={!title.trim() || (isLink && !url.trim())} />
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
      risks: <>{resource.kind === 'FILE' ? `Le fichier « ${resource.title} » sera supprimé définitivement d’Ordo.` : `Le lien « ${resource.title} » sera retiré du projet.`}</>,
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
                      <FileLink url={resource.url} name={resource.title} fw={600} size="sm" truncate>
                        {resource.title}
                      </FileLink>
                    ) : (
                      <Anchor href={resource.url} target="_blank" rel="noopener noreferrer" fw={600} size="sm" truncate>
                        {resource.title}
                      </Anchor>
                    )}
                    <Text size="xs" c="dimmed" truncate>
                      {resource.note ?? (resource.kind === 'LINK' ? resource.url : resource.size ? fmt.fileSize(resource.size) : '')}
                    </Text>
                  </Stack>
                </Group>
                <InlineActions
                  name={resource.title}
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
