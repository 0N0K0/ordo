import { Button, Group, Paper, SegmentedControl, SimpleGrid, Stack, Switch, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { EMPTY_MAIL_SEARCH, type MailSearchCriteria } from '@ordo/shared';
import { FloppyDiskIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useMailLabels } from './api';
import { BatchMultiSelect } from '../../components/BatchMultiSelect';

/** Where an advanced search looks: the folder shown, every folder of its account, or every account. */
type Where = 'folder' | 'account' | 'everywhere';

interface AdvancedSearchPanelProps {
  accountId: string;
  folder: string;
  /** Criteria applied (to edit them again), or null. */
  value: MailSearchCriteria | null;
  onSearch: (criteria: MailSearchCriteria) => void;
  onClear: () => void;
  /** Saves the criteria as a search folder. */
  onSave: (criteria: MailSearchCriteria) => void;
}

/**
 * Advanced search: sender, recipient, subject, body, period, attachment, unread, flags, done state; in the folder
 * shown, every folder of its account or every account. The search can be saved as a search folder.
 * @param {AdvancedSearchPanelProps} props Component props.
 * @returns {JSX.Element} Panel.
 */
export function AdvancedSearchPanel({ accountId, folder, value, onSearch, onClear, onSave }: AdvancedSearchPanelProps) {
  const { data: labels } = useMailLabels();
  const [criteria, setCriteria] = useState<MailSearchCriteria>(value ?? { ...EMPTY_MAIL_SEARCH, accountIds: [accountId], scope: 'folder', folder });
  const where: Where = criteria.scope === 'folder' ? 'folder' : criteria.accountIds.length ? 'account' : 'everywhere';
  const set = (changes: Partial<MailSearchCriteria>) => setCriteria((current) => ({ ...current, ...changes }));

  /**
   * Changes where the search looks.
   * @param {Where} next Place.
   * @returns {void}
   */
  const setWhere = (next: Where) =>
    set(
      next === 'folder'
        ? { accountIds: [accountId], scope: 'folder', folder }
        : next === 'account'
          ? { accountIds: [accountId], scope: 'all', folder: null }
          : { accountIds: [], scope: 'all', folder: null },
    );

  return (
    <Paper withBorder radius="md" p="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(criteria);
        }}
      >
        <Stack gap="xs">
          <SegmentedControl
            size="xs"
            data={[
              { value: 'folder', label: 'Ce dossier' },
              { value: 'account', label: 'Toute la boîte' },
              { value: 'everywhere', label: 'Toutes les boîtes' },
            ]}
            value={where}
            onChange={(next) => setWhere(next as Where)}
          />
          <SimpleGrid cols={2} spacing="xs">
            <TextInput size="xs" label="De" placeholder="Nom ou adresse" value={criteria.from} onChange={(event) => set({ from: event.currentTarget.value })} />
            <TextInput size="xs" label="À" placeholder="Nom ou adresse" value={criteria.to} onChange={(event) => set({ to: event.currentTarget.value })} />
            <TextInput size="xs" label="Objet" value={criteria.subject} onChange={(event) => set({ subject: event.currentTarget.value })} />
            <TextInput size="xs" label="Corps" value={criteria.body} onChange={(event) => set({ body: event.currentTarget.value })} />
            <DatePickerInput size="xs" label="Du" clearable valueFormat="D MMM YYYY" placeholder="—" value={criteria.since} onChange={(since) => set({ since })} />
            <DatePickerInput
              size="xs"
              label="Au"
              clearable
              valueFormat="D MMM YYYY"
              placeholder="—"
              minDate={criteria.since ?? undefined}
              value={criteria.until}
              onChange={(until) => set({ until })}
            />
          </SimpleGrid>
          <BatchMultiSelect
            size="xs"
            label="Drapeaux (l’un d’eux)"
            placeholder={criteria.labelIds.length ? undefined : 'Peu importe'}
            data={(labels ?? []).map((label) => ({ value: label.id, label: label.name }))}
            value={criteria.labelIds}
            onChange={(labelIds) => set({ labelIds })}
            clearable
          />
          <Group gap="md">
            <SegmentedControl
              size="xs"
              aria-label="Mails traités"
              data={[
                { value: 'all', label: 'Tous' },
                { value: 'todo', label: 'À traiter' },
                { value: 'done', label: 'Traités' },
              ]}
              value={criteria.state}
              onChange={(state) => set({ state: state as MailSearchCriteria['state'] })}
            />
            <Switch size="xs" label="Non lus" checked={criteria.unread} onChange={(event) => set({ unread: event.currentTarget.checked })} />
            <Switch size="xs" label="Avec pièce jointe" checked={criteria.attachments} onChange={(event) => set({ attachments: event.currentTarget.checked })} />
          </Group>
          <Text size="xs" c="dimmed">
            Les 200 mails les plus récents de chaque dossier sont examinés.
          </Text>
          <Group justify="space-between" gap="xs">
            <Button size="xs" variant="subtle" leftSection={<FloppyDiskIcon aria-hidden />} onClick={() => onSave(criteria)}>
              Enregistrer en dossier de recherche
            </Button>
            <Group gap="xs">
              <Button size="xs" variant="default" onClick={onClear}>
                Effacer
              </Button>
              <Button size="xs" type="submit" leftSection={<MagnifyingGlassIcon aria-hidden />}>
                Rechercher
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
