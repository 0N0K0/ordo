import { Button, FileButton, Group, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { UploadSimpleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { notifySuccess } from '../../lib/notify';
import { useLibraryMutations, type DocumentFolder, type LibraryDocument } from './api';
import { treeOptions, treeSelectProps } from '../../components/tree-select/tree-select';

const ROOT = '__root__';

interface FolderSelectProps {
  folders: DocumentFolder[];
  value: string | null;
  onChange: (folderId: string | null) => void;
  /** Folders that cannot be chosen (a folder and its sub-folders when moving it). */
  excluded?: Set<string>;
  label?: string;
}

/**
 * Folder picker, with the root of the library.
 * @param {FolderSelectProps} props Component props.
 * @returns {JSX.Element} Select.
 */
export function FolderSelect({ folders, value, onChange, excluded, label = 'Dossier' }: FolderSelectProps) {
  const options = treeOptions(
    [{ id: ROOT, parentId: null, label: 'Documents (racine)' }, ...folders.map((folder) => ({ id: folder.id, parentId: folder.parentId ?? ROOT, label: folder.name }))],
    undefined,
    excluded,
  );
  return <Select label={label} searchable allowDeselect={false} {...treeSelectProps(options)} value={value ?? ROOT} onChange={(next) => onChange(!next || next === ROOT ? null : next)} />;
}

/**
 * New link: title, address and note.
 * @param {{ folderId: string | null, onDone: () => void }} props Folder and close callback.
 * @returns {JSX.Element} Form.
 */
export function LinkForm({ folderId, onDone }: { folderId: string | null; onDone: () => void }) {
  const { addLink } = useLibraryMutations();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        addLink.mutate(
          { folderId, title, url: url.trim(), note: note || null },
          {
            onSuccess: () => {
              notifySuccess('Lien ajouté.');
              onDone();
            },
            onError: (addError) => setError(addError.message),
          },
        );
      }}
    >
      <Stack gap="sm">
        <TextInput label="Adresse" required placeholder="https://drive.google.com/…" data-autofocus value={url} onChange={(event) => setUrl(event.currentTarget.value)} />
        <TextInput label="Titre" required placeholder="Statuts signés, dossier comptable…" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
        <Textarea label="Note" autosize minRows={2} value={note} onChange={(event) => setNote(event.currentTarget.value)} />
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={addLink.isPending}>
            Ajouter
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Edition of a document: title, note, address of a link, new version of a file.
 * @param {{ document: LibraryDocument, onDone: () => void }} props Document and close callback.
 * @returns {JSX.Element} Form.
 */
export function DocumentForm({ document, onDone }: { document: LibraryDocument; onDone: () => void }) {
  const { update } = useLibraryMutations();
  const [title, setTitle] = useState(document.title);
  const [url, setUrl] = useState(document.kind === 'LINK' ? document.url : '');
  const [note, setNote] = useState(document.note ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate(
          { id: document.id, title, url: document.kind === 'LINK' ? url.trim() : null, note: note || null, file },
          {
            onSuccess: () => {
              notifySuccess('Document modifié.');
              onDone();
            },
            onError: (saveError) => setError(saveError.message),
          },
        );
      }}
    >
      <Stack gap="sm">
        <TextInput label="Titre" required data-autofocus value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
        {document.kind === 'LINK' ? (
          <TextInput label="Adresse" required value={url} onChange={(event) => setUrl(event.currentTarget.value)} />
        ) : (
          <Group gap="sm">
            <Text size="sm" c="dimmed" style={{ flex: 1 }} truncate>
              Fichier : {file?.name ?? document.fileName}
            </Text>
            <FileButton onChange={setFile}>
              {(props) => (
                <Button size="xs" variant="light" leftSection={<UploadSimpleIcon aria-hidden />} {...props}>
                  Remplacer par une nouvelle version
                </Button>
              )}
            </FileButton>
          </Group>
        )}
        <Textarea label="Note" autosize minRows={2} placeholder="Date de validité, numéro…" value={note} onChange={(event) => setNote(event.currentTarget.value)} />
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={update.isPending}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Name of a new folder, or new name of a folder.
 * @param {{ initial: string, onSubmit: (name: string) => Promise<unknown>, onDone: () => void, submitLabel: string }} props Initial name, save, close callback, button label.
 * @returns {JSX.Element} Form.
 */
export function FolderNameForm({ initial, onSubmit, onDone, submitLabel }: { initial: string; onSubmit: (name: string) => Promise<unknown>; onDone: () => void; submitLabel: string }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        onSubmit(name)
          .then(onDone)
          .catch((saveError: Error) => setError(saveError.message))
          .finally(() => setPending(false));
      }}
    >
      <Stack gap="sm">
        <TextInput label="Nom" required data-autofocus value={name} error={error} placeholder="Administratif, Juridique, Identité visuelle…" onChange={(event) => setName(event.currentTarget.value)} />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onDone}>
            Annuler
          </Button>
          <Button type="submit" loading={pending}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

/**
 * Move of documents or of a folder: target folder.
 * @param {{ folders: DocumentFolder[], excluded?: Set<string>, initial: string | null, onSubmit: (folderId: string | null) => Promise<unknown>, onDone: () => void }} props Folders, excluded ones, current folder, save, close callback.
 * @returns {JSX.Element} Form.
 */
export function MoveForm({
  folders,
  excluded,
  initial,
  onSubmit,
  onDone,
}: {
  folders: DocumentFolder[];
  excluded?: Set<string>;
  initial: string | null;
  onSubmit: (folderId: string | null) => Promise<unknown>;
  onDone: () => void;
}) {
  const [folderId, setFolderId] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <Stack gap="sm">
      <FolderSelect folders={folders} value={folderId} onChange={setFolderId} excluded={excluded} label="Vers" />
      {error && (
        <Text size="sm" c="red">
          {error}
        </Text>
      )}
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button
          loading={pending}
          onClick={() => {
            setPending(true);
            onSubmit(folderId)
              .then(onDone)
              .catch((moveError: Error) => setError(moveError.message))
              .finally(() => setPending(false));
          }}
        >
          Déplacer
        </Button>
      </Group>
    </Stack>
  );
}
