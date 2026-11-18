import { Button, Group, Paper, SegmentedControl, SimpleGrid, Stack, Switch, Text, TextInput, type GroupProps } from '@mantine/core';
import { listSelectProps } from '../../../components/items/item-look';
import { DatePickerInput } from '@mantine/dates';
import { EMPTY_MAIL_SEARCH, type MailSearchCriteria } from '@ordo/shared';
import { FloppyDiskIcon, MagnifyingGlassIcon, EraserIcon, SlidersHorizontalIcon, XIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useMailLabels } from '../api';
import { BatchMultiSelect } from '../../../components/inputs/BatchMultiSelect';
import { dateRangeProps } from '../../../components/inputs/date-range';
import { ActionButton } from '../../../components/actions/ActionButton';

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
  const received = dateRangeProps({ value: [criteria.since, criteria.until], onChange: ([since, until]) => set({ since, until }) });

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
            <DatePickerInput size="xs" label="Du" clearable placeholder="—" {...received.start} />
            <DatePickerInput size="xs" label="Au" clearable placeholder="—" {...received.end} />
          </SimpleGrid>
          <BatchMultiSelect
            size="xs"
            label="Drapeaux (l’un d’eux)"
            placeholder={criteria.labelIds.length ? undefined : 'Peu importe'}
            {...listSelectProps(labels ?? [], undefined, criteria.labelIds)}
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
              <ActionButton priority="secondary" size="xs" icon={<EraserIcon aria-hidden />} onClick={onClear}>
                Effacer
              </ActionButton>
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

interface AdvancedSearchHeaderProps extends Omit<GroupProps, 'children'> {
  /** The criteria are shown. */
  open: boolean;
  /** Shows or hides the criteria. */
  onToggle: () => void;
  /** Leaves the advanced search. */
  onQuit: () => void;
}

/**
 * Header of the results of an advanced search: its title, « Modifier » / « Masquer les critères » and « Quitter ».
 * @param {AdvancedSearchHeaderProps} props Component props (and those of its group).
 * @returns {JSX.Element} Header.
 */
export function AdvancedSearchHeader({ open, onToggle, onQuit, ...props }: AdvancedSearchHeaderProps) {
  return (
    <Group justify="space-between" gap="xs" {...props}>
      <Text size="sm" fw={600}>
        Recherche avancée
      </Text>
      <Group gap={4}>
        <Button size="compact-xs" variant="subtle" leftSection={<SlidersHorizontalIcon aria-hidden />} onClick={onToggle}>
          {open ? 'Masquer les critères' : 'Modifier'}
        </Button>
        <Button size="compact-xs" variant="subtle" color="gray" leftSection={<XIcon aria-hidden />} onClick={onQuit}>
          Quitter
        </Button>
      </Group>
    </Group>
  );
}
