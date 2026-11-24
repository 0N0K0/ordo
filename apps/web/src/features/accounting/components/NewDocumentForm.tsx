import { Select, Stack, Text } from '@mantine/core';
import { ClientSelect } from '../../projects/components/ClientSelect';
import { agreed, type AccountingDocumentType } from '@ordo/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { parisToday } from '../../../lib/dates';
import { useAsyncAction } from '../../../lib/use-async-action';
import { useProjectTree } from '../../projects/api';
import { fetchNewDocumentDefaults, useDocumentMutations } from '../api/documents';
import { isFeminineDocumentType, THE_DOCUMENT_TYPE } from '../lib/labels';
import { clientProjectOptions } from '../../projects/lib/tree';
import { treeSelectProps } from '../../../components/tree/tree-select';
import { FormActions } from '../../../components/dialogs/FormActions';
import { documentPath } from '../../../app/pages';

/**
 * New document: its client (and project), then the draft opens with the company's default terms.
 * @param {{ type: AccountingDocumentType, clientId?: string | null, projectId?: string | null, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function NewDocumentForm({
  type,
  clientId: initialClient = null,
  projectId: initialProject = null,
  onDone,
}: {
  type: AccountingDocumentType;
  clientId?: string | null;
  projectId?: string | null;
  onDone: () => void;
}) {
  const { data: workspace } = useProjectTree();
  const { create } = useDocumentMutations();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState<string | null>(initialClient);
  const [projectId, setProjectId] = useState<string | null>(initialProject);
  const { run: submit, loading } = useAsyncAction(
    async () => {
      if (!clientId) throw new Error('Choisissez un client.');
      const defaults = await fetchNewDocumentDefaults({ type, clientId, issueDate: parisToday() });
      return create.mutateAsync({ type, input: { ...defaults, projectId } });
    },
    {
      fallback: 'Création impossible.',
      onDone: (id) => {
        onDone();
        void navigate(documentPath(id));
      },
    },
  );

  return (
    <Stack gap="md">
      <ClientSelect
        required
        data-autofocus
        value={clientId}
        onChange={(value) => {
          setClientId(value);
          setProjectId(null);
        }}
        nothingFoundMessage="Aucun client"
      />
      <Select
        label="Projet"
        clearable
        placeholder={clientId ? 'Aucun' : 'Choisissez d’abord un client'}
        disabled={!clientId}
        {...treeSelectProps(clientProjectOptions(workspace, clientId))}
        searchable
        value={projectId}
        onChange={setProjectId}
      />
      <Text size="xs" c="dimmed">
        {THE_DOCUMENT_TYPE[type]} est {agreed('créé', isFeminineDocumentType(type))} en brouillon, sans numéro, avec vos conditions par défaut.
      </Text>
      <FormActions onCancel={onDone} submitLabel="Créer" onSubmit={() => void submit()} disabled={!clientId} loading={loading} />
    </Stack>
  );
}
