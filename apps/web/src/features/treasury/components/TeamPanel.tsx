import { NO_SUGGESTIONS, NO_TARGETS } from '../../../components/markdown/remark-references';
import { ColorField } from '../../../components/inputs/ColorField';
import { openFormPanel } from '../../../components/panels/panels';
import { ActionButton } from '../../../components/actions/ActionButton';
import { PersonOption, PersonRow } from '../../../components/people/PersonOption';
import { listSelectProps } from '../../../components/items/item-look';
import { ItemAvatar } from '../../../components/items/ItemAvatar';
import { createdId } from '../../../components/settings/settings-api';
import { SettingsList } from '../../../components/settings/SettingsList';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { confirmDestructive } from '../../../components/dialogs/confirm-destructive';

import { ActionIcon, Badge, Group, Select, SimpleGrid, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { mapById, EVERYDAY_CONTEXT, treasuryContextPeriodSchema, treasuryContextSchema, treasuryRelationSchema } from '@ordo/shared';
import { ArchiveIcon, ArrowCounterClockwiseIcon, CalendarBlankIcon, PencilSimpleIcon, PlusIcon, TrashIcon, UserMinusIcon } from '@phosphor-icons/react';
import { ArchivedBadge } from '../../../components/items/ItemBadge';
import { ShowArchivedSwitch } from '../../../components/filters/ShowArchivedSwitch';
import { archiveWithUndo, unarchived, useSetArchived, visibleItems } from '../../../lib/archive';
import { useState } from 'react';
import { useAppForm, formCallbacks } from '../../../lib/form';
import { notifySuccess, onMutationError } from '../../../lib/notify';
import { useTaskContext } from '../../tasks/hooks/use-task-context';
import { useColorSwatches } from '../../../lib/use-color-swatches';
import { useActiveWorkspace } from '../../workspaces/api';
import { treasuryKey, useTreasurySettings, useTreasuryTeamMutations, type TreasuryContext, type TreasuryContextPeriod, type TreasuryRelation } from '../api';
import * as fmt from '../../../lib/format';
import { MarkdownEditor } from '../../../components/markdown/MarkdownEditor';
import { MarkdownView } from '../../../components/markdown/MarkdownView';
import { countOf } from '../../../lib/text';
import { FormActions } from '../../../components/dialogs/FormActions';
import { SettingsSection } from '../../../components/settings/SettingsSection';
import { InlineActions } from '../../../components/data-table/cells/RowActions';

/**
 * Members of the team (professional workspace) or household (personal one): "Moi" always is one; a member is a
 * contributor (an existing one, or a new one created with their name). A member removed stays a contributor. An
 * archived member is hidden unless asked, and archived contributors are not offered as new members.
 * @returns {JSX.Element} Section.
 */
export function TeamMembers() {
  const { data: settings } = useTreasurySettings();
  const { context } = useTaskContext();
  const { perso } = useActiveWorkspace();
  const { addMember, removeMember } = useTreasuryTeamMutations();
  const [name, setName] = useState('');
  const setArchived = useSetArchived('CONTRIBUTOR');
  const [showArchived, setShowArchived] = useState(false);
  // Names and avatars as the contributors have them now (renamed or removed in the list of contributors).
  const contributorById = mapById(context?.contributors ?? []);
  const members = (settings?.treasuryMembers ?? [])
    .filter((member) => !context || contributorById.has(member.id))
    .map((member) => ({
      ...member,
      archived: contributorById.get(member.id)?.archived ?? false,
      ...(contributorById.get(member.id) ? { name: contributorById.get(member.id)!.name, avatarUrl: contributorById.get(member.id)!.avatarUrl } : {}),
    }));
  const memberIds = new Set(members.map((member) => member.id));
  const shownMembers = visibleItems(members, showArchived);
  // A relation is not a member too.
  const relationContributors = new Set((settings?.treasuryRelations ?? []).map((relation) => relation.contributorId));
  const others = unarchived(context?.contributors ?? []).filter((contributor) => !memberIds.has(contributor.id) && !relationContributors.has(contributor.id));
  const onError = onMutationError;
  const team = perso ? 'Foyer' : 'Équipe';

  return (
    <SettingsSection
      title={team}
      description="Les mouvements se répartissent entre les membres. Chaque membre est aussi un contributeur (tâches, projets, agenda) ; retiré, il le reste."
      actions={<ShowArchivedSwitch checked={showArchived} onChange={setShowArchived} count={members.filter((member) => member.archived).length} />}
    >
      <Table verticalSpacing={4}>
        <Table.Tbody>
          {shownMembers.map((member) => (
            <Table.Tr key={member.id}>
              <Table.Td>
                <Group gap="xs" wrap="nowrap">
                  <PersonRow
                    name={member.name}
                    avatarUrl={member.avatarUrl}
                    badges={
                      <>
                        {member.isMe && (
                          <Badge size="xs" variant="light">
                            Moi
                          </Badge>
                        )}
                        {member.archived && <ArchivedBadge size="xs" />}
                      </>
                    }
                  />
                </Group>
              </Table.Td>
              <Table.Td w={1}>
                {!member.isMe && (
                  <Group gap={4} wrap="nowrap">
                    <Tooltip label={member.archived ? 'Restaurer le contributeur' : 'Archiver le contributeur'}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={member.archived ? `Restaurer ${member.name}` : `Archiver ${member.name}`}
                        onClick={() => void archiveWithUndo(setArchived, { ids: [member.id], archived: !member.archived, label: member.name })}
                      >
                        {member.archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={`Retirer du ${team.toLowerCase()} (reste contributeur)`}>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={`Retirer ${member.name}`}
                        loading={removeMember.isPending && removeMember.variables === member.id}
                        onClick={() => removeMember.mutate(member.id, { onSuccess: () => notifySuccess(`${member.name} n’est plus membre.`), onError })}
                      >
                        <UserMinusIcon aria-hidden />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
        <Select
          size="xs"
          aria-label="Ajouter un contributeur existant"
          placeholder={others.length ? 'Ajouter un contributeur…' : 'Tous les contributeurs sont membres'}
          disabled={!others.length}
          searchable
          data={others.map((item) => ({ value: item.id, label: item.name }))}
          renderOption={({ option }) => {
            const contributor = contributorById.get(option.value);
            return <PersonOption name={option.label} label={option.label} avatarUrl={contributor?.avatarUrl} hint={contributor?.handle ? `@${contributor.handle}` : undefined} />;
          }}
          value={null}
          onChange={(contributorId) => contributorId && addMember.mutate({ contributorId }, { onSuccess: () => notifySuccess('Membre ajouté.'), onError })}
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            addMember.mutate({ name: name.trim() }, { onSuccess: () => (notifySuccess('Membre ajouté.'), setName('')), onError });
          }}
        >
          <Group gap={4} wrap="nowrap">
            <TextInput size="xs" style={{ flex: 1 }} aria-label="Nom d’un nouveau membre" placeholder="Ou un nouveau membre…" value={name} onChange={(event) => setName(event.currentTarget.value)} />
            <Tooltip label="Ajouter (crée le contributeur)">
              <ActionIcon type="submit" variant="light" size="input-xs" aria-label="Ajouter le nouveau membre" disabled={!name.trim()} loading={addMember.isPending}>
                <PlusIcon aria-hidden />
              </ActionIcon>
            </Tooltip>
          </Group>
        </form>
      </SimpleGrid>
    </SettingsSection>
  );
}

/**
 * Context form: name and color.
 * @param {{ context?: TreasuryContext, onDone: (createdId?: string) => void }} props Component props; the form closes with the id of the context created.
 * @returns {JSX.Element} Form.
 */
export function ContextForm({ context, onDone }: { context?: TreasuryContext; onDone: (createdId?: string) => void }) {
  const { saveContext } = useTreasuryTeamMutations();
  const swatches = useColorSwatches();
  const form = useAppForm<{ name: string; color: string }>({ initialValues: { name: context?.name ?? '', color: context?.color ?? swatches[0] }, schema: treasuryContextSchema });
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) =>
        saveContext.mutate(
          { id: context?.id ?? null, input },
          formCallbacks(form, context ? 'Contexte modifié.' : 'Contexte créé.', (id: string) => onDone(context ? undefined : id)),
        ),
      )}
    >
      <Stack gap="sm">
        <TextInput label="Nom" required data-autofocus placeholder="Vacances, Rentrée…" {...form.getInputProps('name')} />
        <ColorField required {...form.getInputProps('color')} />
        <FormActions onCancel={() => onDone()} loading={saveContext.isPending} />
      </Stack>
    </form>
  );
}

/**
 * Planned period form: context, first and last days, note.
 * @param {{ period?: TreasuryContextPeriod, contexts: TreasuryContext[], onDone: () => void }} props Component props.
 * @returns {JSX.Element} Form.
 */
function PeriodForm({ period, contexts, onDone }: { period?: TreasuryContextPeriod; contexts: TreasuryContext[]; onDone: () => void }) {
  const { saveContextPeriod } = useTreasuryTeamMutations();
  const form = useAppForm<{ contextId: string; startDate: string; endDate: string; note: string | null }>({
    initialValues: {
      contextId: period?.contextId ?? unarchived(contexts)[0]?.id ?? '',
      startDate: period ? period.startDate : '',
      endDate: period ? period.endDate : '',
      note: period?.note ?? null,
    },
    schema: treasuryContextPeriodSchema,
  });
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) =>
        saveContextPeriod.mutate({ id: period?.id ?? null, input: { ...input, note: input.note || null } }, formCallbacks(form, period ? 'Période modifiée.' : 'Période planifiée.', onDone)),
      )}
    >
      <Stack gap="sm">
        <Select label="Contexte" required allowDeselect={false} {...listSelectProps(contexts, undefined, period?.contextId)} {...form.getInputProps('contextId')} />
        <SimpleGrid cols={2} spacing="sm">
          <DatePickerInput
            label="Du"
            required
            {...form.getInputProps('startDate')}
            // The end follows a start set after it.
            onChange={(date) => form.setValues({ startDate: date ?? '', ...(date && (!form.values.endDate || form.values.endDate < date) ? { endDate: date } : {}) })}
          />
          <DatePickerInput label="Au" required minDate={form.values.startDate || undefined} {...form.getInputProps('endDate')} />
        </SimpleGrid>
        <MarkdownEditor label="Description" value={form.values.note ?? ''} onChange={(note) => form.setFieldValue('note', note)} suggestions={NO_SUGGESTIONS} minRows={2} />
        <FormActions onCancel={onDone} loading={saveContextPeriod.isPending} />
      </Stack>
    </form>
  );
}

/**
 * Contexts of spending (not in a tree; a line without context is everyday spending) and the periods they are
 * planned for: the lines of the entries dated in a period get its context proposed. The periods of an archived context
 * are hidden (and read only) unless the archived ones are shown.
 * @returns {JSX.Element} Sections.
 */
function Contexts() {
  const { data: settings } = useTreasurySettings();
  const { saveContext, deleteContext, deleteContextPeriod } = useTreasuryTeamMutations();
  const contexts = settings?.treasuryContexts ?? [];
  const contextById = mapById(contexts);
  const [showArchived, setShowArchived] = useState(false);
  const allPeriods = settings?.treasuryContextPeriods ?? [];
  const archivedPeriod = (period: TreasuryContextPeriod) => Boolean(contextById.get(period.contextId)?.archived);
  const periods = allPeriods.filter((period) => showArchived || !archivedPeriod(period));
  const onError = onMutationError;
  /**
   * Opens the form of a new or changed period.
   * @param {TreasuryContextPeriod} [period] Period changed. Optional.
   * @returns {void}
   */
  const openPeriod = (period?: TreasuryContextPeriod) =>
    openFormPanel(period ? 'Modifier la période' : 'Planifier un contexte', (close) => <PeriodForm period={period} contexts={contexts} onDone={close} />);

  return (
    <>
      <SettingsList
        kind="TREASURY_CONTEXT"
        title="Contextes"
        description={`Une même dépense ne compte pas pareil en vacances ou au quotidien. Une ligne sans contexte est du « ${EVERYDAY_CONTEXT} ».`}
        noun="le contexte"
        items={contexts}
        schema={treasuryContextSchema}
        create={async (values) => createdId(await saveContext.mutateAsync({ id: null, input: { name: values.name, color: values.color } }))}
        update={(id, values) => saveContext.mutateAsync({ id, input: { name: values.name, color: values.color } })}
        remove={(id) => deleteContext.mutateAsync(id)}
        deleteMessage={(item) => (
          <>
            « {item.name} » sera supprimé définitivement avec ses périodes planifiées. Les lignes qui l’avaient deviendront du « {EVERYDAY_CONTEXT} ». Cette action est irréversible.
          </>
        )}
      />

      <SettingsSection
        title="Contextes planifiés"
        actions={
          <>
            <ShowArchivedSwitch checked={showArchived} onChange={setShowArchived} count={allPeriods.filter(archivedPeriod).length} label="Afficher les archivées" />
            <ActionButton priority="secondary" size="xs" icon={<PlusIcon aria-hidden />} disabled={!unarchived(contexts).length} onClick={() => openPeriod()}>
              Nouvelle période
            </ActionButton>
          </>
        }
        description="Les lignes des mouvements datés dans une période prennent son contexte (modifiable). Changer une période ne modifie pas les lignes déjà enregistrées."
      >
        {periods.length === 0 ? (
          <EmptyState compact icon={<CalendarBlankIcon aria-hidden />} message={contexts.length ? 'Aucune période planifiée.' : 'Créez d’abord un contexte.'} />
        ) : (
          <Table verticalSpacing={4}>
            <Table.Tbody>
              {periods.map((period) => {
                const item = contextById.get(period.contextId);
                return (
                  <Table.Tr key={period.id}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        {item && <ItemAvatar name={item.name} iconUrl={item.iconUrl} color={item.color} />}
                        <Text size="sm">{item?.name}</Text>
                        {item?.archived && <ArchivedBadge size="xs" />}
                      </Group>
                      {period.note && (
                        <Text size="xs" c="dimmed">
                          {period.note}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {fmt.day(period.startDate)} → {fmt.day(period.endDate)}
                      </Text>
                    </Table.Td>
                    <Table.Td w={1}>
                      {/* A period is part of its context: read only while it is archived. */}
                      {!item?.archived && (
                        <InlineActions
                          name={`la période ${item?.name ?? ''} du ${fmt.day(period.startDate)}`}
                          items={[
                            { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openPeriod(period) },
                            {
                              label: 'Supprimer',
                              icon: <TrashIcon aria-hidden />,
                              danger: true,
                              onClick: () =>
                                confirmDestructive({
                                  title: 'Supprimer la période',
                                  risks: `La période « ${item?.name ?? ''} » du ${fmt.day(period.startDate)} au ${fmt.day(period.endDate)} sera supprimée. Les lignes déjà enregistrées gardent leur contexte.`,
                                  onConfirm: () => deleteContextPeriod.mutate(period.id, { onSuccess: () => notifySuccess('Période supprimée.'), onError }),
                                }),
                            },
                          ]}
                        />
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </SettingsSection>
    </>
  );
}

/**
 * Contexts and their planned periods, one under the other (they are in the settings sidebar; the team or household
 * is in the settings, with the contributors).
 * @returns {JSX.Element} Sections.
 */
export function TeamPanel() {
  return (
    <Stack gap="md">
      <Contexts />
    </Stack>
  );
}

/**
 * Relation form: name and note.
 * @param {{ relation?: TreasuryRelation, onDone: (createdId?: string) => void }} props Component props; the form closes with the id of the relation created.
 * @returns {JSX.Element} Form.
 */
export function RelationForm({ relation, onDone }: { relation?: TreasuryRelation; onDone: (createdId?: string) => void }) {
  const { saveRelation } = useTreasuryTeamMutations();
  const { data: settings } = useTreasurySettings();
  const { context } = useTaskContext();
  const form = useAppForm<{ name: string; note: string | null; contributorId: string | null }>({
    initialValues: { name: relation?.name ?? '', note: relation?.note ?? null, contributorId: relation?.contributorId ?? null },
    schema: treasuryRelationSchema,
  });
  // Contributors that are no member nor another relation already.
  const members = new Set((settings?.treasuryMembers ?? []).map((member) => member.id));
  const taken = new Set((settings?.treasuryRelations ?? []).filter((item) => item.id !== relation?.id).map((item) => item.contributorId));
  // Archived contributors are not offered (the current one stays).
  const contributors = unarchived(context?.contributors ?? [], form.values.contributorId).filter((contributor) => !members.has(contributor.id) && !taken.has(contributor.id));
  return (
    <form
      noValidate
      onSubmit={form.onSubmit((input) =>
        saveRelation.mutate(
          { id: relation?.id ?? null, input: { name: input.name, note: input.note || null, contributorId: input.contributorId ?? null } },
          formCallbacks(form, relation ? 'Relation modifiée.' : 'Relation ajoutée.', (id: string) => onDone(relation ? undefined : id)),
        ),
      )}
    >
      <Stack gap="sm">
        <TextInput label="Nom" required data-autofocus placeholder="Paul, Mamie, Association du quartier…" {...form.getInputProps('name')} />
        <Select
          label="Contributeur"
          description="Si cette personne intervient aussi sur des projets ou des tâches."
          placeholder="Aucun"
          clearable
          searchable
          data={contributors.map((item) => ({ value: item.id, label: item.name }))}
          {...form.getInputProps('contributorId')}
          onChange={(contributorId) => {
            const chosen = contributors.find((contributor) => contributor.id === contributorId);
            // Without a name yet, it takes the contributor's.
            form.setValues({ contributorId, ...(chosen && !form.values.name.trim() ? { name: chosen.name } : {}) });
          }}
        />
        <TextInput label="Note" placeholder="Facultative" {...form.getInputProps('note')} value={form.values.note ?? ''} />
        <FormActions onCancel={() => onDone()} loading={saveRelation.isPending} />
      </Stack>
    </form>
  );
}

/**
 * Relations: people out of the team or household (friends, family, partners…) lines and budgets can be for, to
 * follow loans, gifts… One may also be a contributor (not a member); organizations stay counterparties. An archived
 * relation is hidden (from the list unless asked, and from the pickers) and read only.
 * @returns {JSX.Element} Section.
 */
export function TeamRelations() {
  const { data: settings } = useTreasurySettings();
  const { deleteRelation } = useTreasuryTeamMutations();
  const setArchived = useSetArchived('TREASURY_RELATION', [treasuryKey]);
  const [showArchived, setShowArchived] = useState(false);
  /**
   * Opens the form of a new or changed relation.
   * @param {TreasuryRelation} [relation] Relation changed. Optional.
   * @returns {void}
   */
  const openRelation = (relation?: TreasuryRelation) => openFormPanel(relation ? 'Modifier la relation' : 'Nouvelle relation', (close) => <RelationForm relation={relation} onDone={close} />);
  const { context } = useTaskContext();
  const contributorName = new Map((context?.contributors ?? []).map((contributor) => [contributor.id, contributor.name]));
  const allRelations = settings?.treasuryRelations ?? [];
  const relations = visibleItems(allRelations, showArchived);
  const uses = (relation: TreasuryRelation) =>
    [relation.lineCount ? countOf(relation.lineCount, 'ligne') : '', relation.budgetCount ? countOf(relation.budgetCount, 'budget') : ''].filter(Boolean).join(', ');

  return (
    <SettingsSection
      title="Relations"
      actions={
        <>
          <ShowArchivedSwitch checked={showArchived} onChange={setShowArchived} count={allRelations.filter((relation) => relation.archived).length} label="Afficher les archivées" />
          <ActionButton priority="secondary" size="xs" icon={<PlusIcon aria-hidden />} onClick={() => openRelation()}>
            Nouvelle relation
          </ActionButton>
        </>
      }
      description="Personnes hors de l’équipe ou du foyer (amis, famille, partenaires…) pour qui une ligne ou un budget peut être : prêt, cadeau… Les organismes restent des tiers."
    >
      {relations.length === 0 ? (
        <EmptyState compact message="Aucune relation." />
      ) : (
        <Table verticalSpacing={4}>
          <Table.Tbody>
            {relations.map((relation) => (
              <Table.Tr key={relation.id}>
                <Table.Td>
                  <Group gap={6}>
                    <Text size="sm">{relation.name}</Text>
                    {relation.archived && <ArchivedBadge feminine size="xs" />}
                    {relation.contributorId && (
                      <Badge size="xs" variant="light" color="gray">
                        Contributeur
                        {contributorName.get(relation.contributorId) && contributorName.get(relation.contributorId) !== relation.name ? ` · ${contributorName.get(relation.contributorId)}` : ''}
                      </Badge>
                    )}
                  </Group>
                  {relation.note && <MarkdownView targets={NO_TARGETS}>{relation.note}</MarkdownView>}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {uses(relation)}
                  </Text>
                </Table.Td>
                <Table.Td w={1}>
                  <InlineActions
                    name={relation.name}
                    items={[
                      !relation.archived && { label: 'Modifier', icon: <PencilSimpleIcon aria-hidden />, onClick: () => openRelation(relation) },
                      {
                        label: relation.archived ? 'Restaurer' : 'Archiver',
                        icon: relation.archived ? <ArrowCounterClockwiseIcon aria-hidden /> : <ArchiveIcon aria-hidden />,
                        onClick: () => void archiveWithUndo(setArchived, { ids: [relation.id], archived: !relation.archived, label: `« ${relation.name} »`, feminine: true }),
                      },
                      {
                        label: 'Supprimer',
                        icon: <TrashIcon aria-hidden />,
                        danger: true,
                        onClick: () =>
                          confirmDestructive({
                            title: 'Supprimer la relation',
                            risks: `« ${relation.name} » sera supprimée définitivement.${relation.budgetCount ? ` Ses budgets aussi.` : ''}${relation.lineCount ? ` Ses lignes vous seront attribuées.` : ''}`,
                            onConfirm: () => deleteRelation.mutate(relation.id, { onSuccess: () => notifySuccess('Relation supprimée.'), onError: onMutationError }),
                          }),
                      },
                    ]}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </SettingsSection>
  );
}
