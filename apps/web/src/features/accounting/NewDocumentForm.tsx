import { Button, Group, Select, Stack, Text } from '@mantine/core';
import type { AccountingDocumentType } from '@ordo/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { localToday } from '../../lib/dates';
import { notifyError } from '../../lib/notify';
import { useWorkspace } from '../workspace/api';
import { fetchNewDocumentDefaults, useDocumentMutations } from './documents-api';
import { DOCUMENT_TYPE_LABELS } from './labels';

/**
 * New document: its client (and project), then the draft opens with the company's default terms.
 * @param {{ type: AccountingDocumentType, clientId?: string | null, projectId?: string | null, onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
export function NewDocumentForm({ type, clientId: initialClient = null, projectId: initialProject = null, onDone }: { type: AccountingDocumentType; clientId?: string | null; projectId?: string | null; onDone: () => void }) {
  const { data: workspace } = useWorkspace();
  const { create } = useDocumentMutations();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState<string | null>(initialClient);
  const [projectId, setProjectId] = useState<string | null>(initialProject);
  const [loading, setLoading] = useState(false);
  const projects = (workspace?.projects ?? []).filter((project) => !project.archived && project.clientId === clientId);

  /**
   * Creates the draft and opens it.
   * @returns {Promise<void>}
   */
  const submit = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const defaults = await fetchNewDocumentDefaults({ type, clientId, issueDate: localToday() });
      const id = await create.mutateAsync({ type, input: { ...defaults, projectId } });
      onDone();
      void navigate(`/accounting/${id}`);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : 'Création impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack gap="md">
      <Select
        label="Client"
        required
        searchable
        data-autofocus
        data={(workspace?.clients ?? []).filter((client) => !client.archived).map((client) => ({ value: client.id, label: client.name }))}
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
        data={projects.map((project) => ({ value: project.id, label: project.title }))}
        value={projectId}
        onChange={setProjectId}
      />
      <Text size="xs" c="dimmed">
        Le {DOCUMENT_TYPE_LABELS[type].toLowerCase()} est créé en brouillon, sans numéro, avec vos conditions par défaut.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onDone}>
          Annuler
        </Button>
        <Button onClick={() => void submit()} disabled={!clientId} loading={loading}>
          Créer
        </Button>
      </Group>
    </Stack>
  );
}
