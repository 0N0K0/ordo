import { ActionButton } from '../../components/actions/ActionButton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ListSkeleton } from '../../components/feedback/Skeletons';
import { confirmDestructive } from '../../components/dialogs/confirm-destructive';
import { closePanel, openPanel } from '../../components/panels/panels';
import { ActionIcon, Anchor, Button, FileButton, Group, Paper, Stack, Text, TextInput, ThemeIcon, Tooltip } from '@mantine/core';
import { ArrowDownIcon, ArrowUpIcon, FigmaLogoIcon, FileIcon, GithubLogoIcon, GitlabLogoIcon, LinkIcon, PaperclipIcon, PencilSimpleIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import { useState, type ReactNode } from 'react';
import { notifyError, notifySuccess } from '../../lib/notify';
import { useProjectResourceMutations, useProjectResources, type ProjectResource } from './documents-api';
import { FileLink } from '../files/FileLink';

let modalCount = 0;

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
  const callbacks = {
    onSuccess: () => {
      notifySuccess(resource ? 'Ressource modifiée.' : 'Lien ajouté.');
      onDone();
    },
    onError: (error: Error) => notifyError(error.message),
  };
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
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={addLink.isPending || update.isPending} disabled={!title.trim() || (isLink && !url.trim())}>
            {resource ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </Group>
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
    const modalId = `project-resource-${++modalCount}`;
    openPanel({ panelId: modalId, title: resource ? 'Modifier' : 'Ajouter un lien', children: <ResourceForm projectId={projectId} resource={resource} onDone={() => closePanel(modalId)} /> });
  };

  /**
   * Asks for confirmation before removing a resource.
   * @param {ProjectResource} resource Resource.
   * @returns {void}
   */
  const confirmDelete = (resource: ProjectResource) => {
    confirmDestructive({ title: resource.kind === 'FILE' ? 'Supprimer le fichier' : 'Retirer le lien', risks: (
<>
<Text size="sm">
            {resource.kind === 'FILE' ? `Le fichier « ${resource.title} » sera supprimé définitivement d’Ordo.` : `Le lien « ${resource.title} » sera retiré du projet.`} Cette action est
            irréversible.
          </Text>
</>
), onConfirm: () => { remove.mutate(resource.id, { onSuccess: () => notifySuccess('Ressource supprimée.'), onError: (error) => notifyError(error.message) }); } });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Documents et liens utiles au projet : cahier des charges, maquettes, dépôt de code…
        </Text>
        <Group gap="xs">
          <FileButton
            multiple
            onChange={(files) =>
              files.length && addFiles.mutate({ projectId, files }, { onSuccess: () => notifySuccess('Fichiers ajoutés.'), onError: (error) => notifyError(error.message) })
            }
          >
            {(props) => (
              <ActionButton icon={<UploadSimpleIcon aria-hidden />} loading={addFiles.isPending} {...props}>Ajouter des fichiers</ActionButton>
            )}
          </FileButton>
          <ActionButton priority="secondary" icon={<LinkIcon aria-hidden />} onClick={() => openForm()}>Ajouter un lien</ActionButton>
        </Group>
      </Group>
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
                      {resource.note ?? (resource.kind === 'LINK' ? resource.url : resource.size ? `${Math.max(1, Math.round(resource.size / 1024))} Ko` : '')}
                    </Text>
                  </Stack>
                </Group>
                <Group gap={2} wrap="nowrap">
                  <Tooltip label="Monter">
                    <ActionIcon variant="subtle" color="gray" aria-label={`Monter ${resource.title}`} disabled={index === 0} onClick={() => move.mutate({ id: resource.id, index: index - 1 })}>
                      <ArrowUpIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Descendre">
                    <ActionIcon variant="subtle" color="gray" aria-label={`Descendre ${resource.title}`} disabled={index === resources.length - 1} onClick={() => move.mutate({ id: resource.id, index: index + 1 })}>
                      <ArrowDownIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Modifier">
                    <ActionIcon variant="subtle" color="gray" aria-label={`Modifier ${resource.title}`} onClick={() => openForm(resource)}>
                      <PencilSimpleIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Supprimer">
                    <ActionIcon variant="subtle" color="red" aria-label={`Supprimer ${resource.title}`} onClick={() => confirmDelete(resource)}>
                      <TrashIcon aria-hidden />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
